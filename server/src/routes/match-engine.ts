import { createHash, randomUUID } from "node:crypto";

import {
  FC25_CLUB_IDS,
  createMatchRunId,
  createMatchRuns,
  deleteMatchRun,
  getDb,
  getMatchRun,
  listFc25Clubs,
  listAllMatchRuns,
  listMatchRunsByBatch,
  loadFc25Squad,
  selectLineup,
  supportedFormation,
  formationRoles,
  type Fc25Club,
  type Fc25ClubId,
  type Fc25SquadPlayer,
  type MatchRunLineupPlayer,
  type MatchRunLineupSelection,
  type MatchRun
} from "@the-ataturk/data";
import {
  simulateMatch,
  type MatchDuration,
  type MatchSnapshot,
  type TeamTactics,
  type TeamV2
} from "@the-ataturk/match-engine";
import type { FastifyInstance } from "fastify";

import {
  deleteVisualiserArtifact,
  visualiserArtifactExists,
  writeVisualiserArtifact
} from "./visualiser-artifacts";

interface SimulateBody {
  home?: {
    clubId?: unknown;
    tactics?: unknown;
    startingPlayerIds?: unknown;
  };
  away?: {
    clubId?: unknown;
    tactics?: unknown;
    startingPlayerIds?: unknown;
  };
  seed?: unknown;
  batch?: unknown;
  duration?: unknown;
}

interface SimulateRunSuccess {
  id: string;
  seed: number;
  batchId: string | null;
  createdAt: string;
  homeClubId: Fc25ClubId;
  awayClubId: Fc25ClubId;
  artefactId: string;
  summary: {
    score: { home: number; away: number };
    shots: { home: number; away: number };
    fouls: { home: number; away: number };
    cards: { home: number; away: number };
    possession: { home: number; away: number };
    duration: MatchDuration;
    xi: {
      home: MatchRunLineupPlayer[];
      away: MatchRunLineupPlayer[];
    };
    bench: {
      home: MatchRunLineupPlayer[];
      away: MatchRunLineupPlayer[];
    };
    xiSelection: {
      home: MatchRunLineupSelection;
      away: MatchRunLineupSelection;
    };
  };
}

interface SimulateRunError {
  seed: number;
  error: string;
}

interface SimulateResponse {
  runs: SimulateRunSuccess[];
  errors: SimulateRunError[];
}

interface ErrorReply {
  error: string;
}

interface RunParams {
  id: string;
}

interface BatchParams {
  batchId: string;
}

interface ClubParams {
  clubId: string;
}

interface SquadQuery {
  formation?: unknown;
}

const MAX_BATCH = 50;
const DEFAULT_RUN_LIST_LIMIT = 50;
const MAX_RUN_LIST_LIMIT = 100;
const DEFAULT_TACTICS: TeamTactics = {
  formation: "4-4-2",
  mentality: "balanced",
  tempo: "normal",
  pressing: "medium",
  lineHeight: "normal",
  width: "normal"
};
const FORMATIONS = ["4-4-2", "4-3-1-2", "4-3-3", "4-2-3-1"] as const;
const MENTALITIES = ["defensive", "balanced", "attacking"] as const;
const TEMPOS = ["slow", "normal", "fast"] as const;
const PRESSING_LEVELS = ["low", "medium", "high"] as const;
const LINE_HEIGHTS = ["deep", "normal", "high"] as const;
const WIDTHS = ["narrow", "normal", "wide"] as const;

export function registerMatchEngineRoutes(app: FastifyInstance): void {
  app.get<{ Reply: Fc25Club[] }>("/api/match-engine/clubs", () => listFc25Clubs());

  app.get<{ Params: ClubParams; Querystring: SquadQuery }>(
    "/api/match-engine/clubs/:clubId/squad",
    (request, reply) => {
      if (!isFc25ClubId(request.params.clubId)) {
        return reply.code(404).send({ error: "Club not found" });
      }

      const formation =
        request.query.formation === undefined ? DEFAULT_TACTICS.formation : request.query.formation;
      if (typeof formation !== "string" || !supportedFormation(formation)) {
        return reply.code(400).send({ error: `formation must be one of: ${FORMATIONS.join(", ")}` });
      }

      const squad = loadFc25Squad(request.params.clubId, undefined, { include: "all" });
      const lineup = selectLineup(squad.players, formation);

      return {
        clubId: request.params.clubId,
        clubName: squad.clubName,
        shortName: squad.shortName,
        formation,
        roles: formationRoles(formation),
        squad: squad.players.map(squadPlayerResponse),
        autoXi: lineup.xi.map(lineupPlayer),
        bench: lineup.bench.map(lineupPlayer),
        assignments: lineup.assignments,
        warnings: lineup.warnings
      };
    }
  );

  app.post<{ Body: SimulateBody; Reply: SimulateResponse | { error: string } }>(
    "/api/match-engine/simulate",
    async (request, reply) => {
      const parsed = parseSimulateBody(request.body);
      if ("error" in parsed) {
        reply.code(400);
        return parsed;
      }

      const runs: SimulateRunSuccess[] = [];
      const errors: SimulateRunError[] = [];
      const batchId = parsed.batch > 1 ? randomUUID() : null;
      const now = new Date().toISOString();

      for (let offset = 0; offset < parsed.batch; offset += 1) {
        const seed = parsed.seed + offset;
        try {
          const home = buildTeam(
            parsed.home.clubId,
            parsed.home.tactics,
            parsed.home.startingPlayerIds
          );
          const away = buildTeam(
            parsed.away.clubId,
            parsed.away.tactics,
            parsed.away.startingPlayerIds
          );
          const snapshot = simulateMatch({
            homeTeam: home.team,
            awayTeam: away.team,
            duration: parsed.duration,
            seed
          });
          const artefactId = await writeSnapshot(snapshot, seed);
          const id = createMatchRunId();
          runs.push({
            id,
            seed,
            batchId,
            createdAt: now,
            homeClubId: parsed.home.clubId,
            awayClubId: parsed.away.clubId,
            artefactId,
            summary: summaryFor(snapshot, parsed.duration, home, away)
          });
        } catch (error) {
          errors.push({
            seed,
            error: error instanceof Error ? error.message : "Simulation failed"
          });
        }
      }

      if (runs.length > 0) {
        createMatchRuns(
          runs.map((run) => ({
            id: run.id,
            created_at: run.createdAt,
            batch_id: run.batchId,
            seed: run.seed,
            home_club_id: run.homeClubId,
            away_club_id: run.awayClubId,
            home_tactics: parsed.home.tactics,
            away_tactics: parsed.away.tactics,
            summary: run.summary,
            artefact_filename: run.artefactId
          }))
        );
      }

      return { runs, errors };
    }
  );

  app.get("/api/match-engine/runs", async (request) => {
    const query = isRecord(request.query) ? request.query : {};
    const page = parseOptionalPositiveInteger(query.page, 1);
    const limit = Math.min(
      parseOptionalPositiveInteger(query.limit, DEFAULT_RUN_LIST_LIMIT),
      MAX_RUN_LIST_LIMIT
    );
    const visibleRuns = await filterRunsWithArtifacts(listAllMatchRuns());
    const offset = (page - 1) * limit;
    const runs = visibleRuns.slice(offset, offset + limit);

    return {
      runs: runs.map(runResponse),
      total: visibleRuns.length,
      page,
      hasMore: offset + runs.length < visibleRuns.length
    };
  });

  app.get<{ Params: RunParams }>("/api/match-engine/runs/:id", async (request, reply) => {
    const run = getMatchRun(request.params.id);
    if (!run || !(await visualiserArtifactExists(run.artefact_filename))) {
      return reply.code(404).send({ error: "Run not found" });
    }

    return runResponse(run);
  });

  app.get<{ Params: BatchParams }>(
    "/api/match-engine/batches/:batchId/runs",
    async (request, reply) => {
      const runs = await filterRunsWithArtifacts(listMatchRunsByBatch(request.params.batchId));
      if (runs.length === 0) {
        return reply.code(404).send({ error: "Batch not found" });
      }

      return { runs: runs.map(runResponse) };
    }
  );

  app.delete<{ Params: RunParams }>("/api/match-engine/runs/:id", async (request, reply) => {
    const deleted = deleteMatchRun(request.params.id, getDb());
    if (deleted) {
      await deleteVisualiserArtifact(deleted.artefact_filename);
    }

    return reply.code(204).send();
  });
}

function parseSimulateBody(body: SimulateBody):
  | {
      home: { clubId: Fc25ClubId; tactics: TeamTactics; startingPlayerIds?: string[] };
      away: { clubId: Fc25ClubId; tactics: TeamTactics; startingPlayerIds?: string[] };
      seed: number;
      batch: number;
      duration: MatchDuration;
    }
  | ErrorReply {
  if (!isRecord(body)) {
    return { error: "Request body must be an object" };
  }

  const home = parseTeamSelection(body.home, "home");
  if ("error" in home) {
    return home;
  }

  const away = parseTeamSelection(body.away, "away");
  if ("error" in away) {
    return away;
  }

  const seed = parseInteger(body.seed, "seed", 1, Number.MAX_SAFE_INTEGER);
  if (isErrorReply(seed)) {
    return seed;
  }

  const batch = body.batch === undefined ? 1 : parseInteger(body.batch, "batch", 1, MAX_BATCH);
  if (isErrorReply(batch)) {
    return batch;
  }
  const duration =
    body.duration === undefined ? "full_90" : parseDuration(body.duration, "duration");
  if (isErrorReply(duration)) {
    return duration;
  }

  return {
    home,
    away,
    seed,
    batch,
    duration
  };
}

function parseTeamSelection(
  value: unknown,
  label: "home" | "away"
): { clubId: Fc25ClubId; tactics: TeamTactics; startingPlayerIds?: string[] } | ErrorReply {
  if (!isRecord(value)) {
    return { error: `${label} must be an object` };
  }

  if (typeof value.clubId !== "string" || !isFc25ClubId(value.clubId)) {
    return { error: `${label}.clubId must be one of: ${FC25_CLUB_IDS.join(", ")}` };
  }

  const tactics = parseTactics(value.tactics);
  if ("error" in tactics) {
    return { error: `${label}.${tactics.error}` };
  }

  const startingPlayerIds = parseOptionalPlayerIds(value.startingPlayerIds, `${label}.startingPlayerIds`);
  if (isErrorReply(startingPlayerIds)) {
    return startingPlayerIds;
  }

  return {
    clubId: value.clubId,
    tactics,
    ...(startingPlayerIds ? { startingPlayerIds } : {})
  };
}

function parseTactics(value: unknown): TeamTactics | { error: string } {
  if (value === undefined) {
    return DEFAULT_TACTICS;
  }

  if (!isRecord(value)) {
    return { error: "tactics must be an object" };
  }

  const formation = parseEnum(value.formation, FORMATIONS, "formation");
  if (isErrorReply(formation)) {
    return formation;
  }

  const mentality = parseEnum(value.mentality, MENTALITIES, "mentality");
  if (isErrorReply(mentality)) {
    return mentality;
  }

  const tempo = parseEnum(value.tempo, TEMPOS, "tempo");
  if (isErrorReply(tempo)) {
    return tempo;
  }

  const pressing = parseEnum(value.pressing, PRESSING_LEVELS, "pressing");
  if (isErrorReply(pressing)) {
    return pressing;
  }

  const lineHeight = parseEnum(value.lineHeight, LINE_HEIGHTS, "lineHeight");
  if (isErrorReply(lineHeight)) {
    return lineHeight;
  }

  const width = parseEnum(value.width, WIDTHS, "width");
  if (isErrorReply(width)) {
    return width;
  }

  return {
    formation,
    mentality,
    tempo,
    pressing,
    lineHeight,
    width
  };
}

function buildTeam(
  clubId: Fc25ClubId,
  tactics: TeamTactics,
  startingPlayerIds?: readonly string[]
): {
  team: TeamV2;
  xi: MatchRunLineupPlayer[];
  bench: MatchRunLineupPlayer[];
  selection: MatchRunLineupSelection;
} {
  if (!supportedFormation(tactics.formation)) {
    throw new Error(`Unsupported formation '${tactics.formation}'`);
  }

  const squad = loadFc25Squad(clubId, undefined, { include: "all" });
  const lineup = selectLineup(squad.players, tactics.formation, startingPlayerIds);

  return {
    team: {
      id: clubId,
      name: squad.clubName,
      shortName: squad.shortName,
      players: lineup.xi,
      tactics
    },
    xi: lineup.xi.map(lineupPlayer),
    bench: lineup.bench.map(lineupPlayer),
    selection: { mode: lineup.mode, warnings: lineup.warnings }
  };
}

async function writeSnapshot(snapshot: MatchSnapshot, seed: number): Promise<string> {
  const serialised = JSON.stringify(snapshot, null, 2);
  const timestamp = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
  const home = safeSlug(snapshot.meta.homeTeam.shortName);
  const away = safeSlug(snapshot.meta.awayTeam.shortName);
  const hash = createHash("sha256").update(serialised).digest("hex").slice(0, 8);
  const filename = `match-engine-${timestamp}-${home}-${away}-seed-${seed}-${hash}.json`;
  return writeVisualiserArtifact(filename, serialised);
}

function summaryFor(
  snapshot: MatchSnapshot,
  duration: MatchDuration,
  homeLineup: {
    xi: MatchRunLineupPlayer[];
    bench: MatchRunLineupPlayer[];
    selection: MatchRunLineupSelection;
  },
  awayLineup: {
    xi: MatchRunLineupPlayer[];
    bench: MatchRunLineupPlayer[];
    selection: MatchRunLineupSelection;
  }
): SimulateRunSuccess["summary"] {
  const { home, away } = snapshot.finalSummary.statistics;
  return {
    score: snapshot.finalSummary.finalScore,
    shots: { home: home.shots.total, away: away.shots.total },
    fouls: { home: home.fouls, away: away.fouls },
    cards: {
      home: home.yellowCards + home.redCards,
      away: away.yellowCards + away.redCards
    },
    possession: { home: home.possession, away: away.possession },
    duration,
    xi: {
      home: homeLineup.xi,
      away: awayLineup.xi
    },
    bench: {
      home: homeLineup.bench,
      away: awayLineup.bench
    },
    xiSelection: {
      home: homeLineup.selection,
      away: awayLineup.selection
    }
  };
}

function lineupPlayer(player: TeamV2["players"][number]): MatchRunLineupPlayer {
  return {
    id: player.id,
    name: player.name,
    shortName: player.shortName,
    position: player.position,
    ...(player.squadNumber === undefined ? {} : { squadNumber: player.squadNumber })
  };
}

function squadPlayerResponse(player: Fc25SquadPlayer) {
  return {
    id: player.id,
    name: player.name,
    shortName: player.shortName,
    squadNumber: player.squadNumber,
    overall: player.overall,
    position: player.position,
    sourcePosition: player.sourcePosition,
    alternativePositions: player.alternativePositions,
    preferredFoot: player.preferredFoot,
    weakFootRating: player.weakFootRating
  };
}

function parseOptionalPlayerIds(value: unknown, field: string): string[] | undefined | ErrorReply {
  if (value === undefined) {
    return undefined;
  }
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
    return { error: `${field} must be an array of player ids` };
  }
  return value;
}

function parseEnum<const T extends readonly string[]>(
  value: unknown,
  allowed: T,
  field: string
): T[number] | ErrorReply {
  if (typeof value !== "string" || !allowed.includes(value)) {
    return { error: `${field} must be one of: ${allowed.join(", ")}` };
  }
  return value as T[number];
}

function parseInteger(
  value: unknown,
  field: string,
  min: number,
  max: number
): number | ErrorReply {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
    return { error: `${field} must be an integer from ${min} to ${max}` };
  }
  return value;
}

function parseDuration(value: unknown, field: string): MatchDuration | ErrorReply {
  if (value === "second_half" || value === "full_90") {
    return value;
  }
  return { error: `${field} must be one of: second_half, full_90` };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isErrorReply(value: unknown): value is ErrorReply {
  return isRecord(value) && typeof value.error === "string";
}

function isFc25ClubId(value: string): value is Fc25ClubId {
  return FC25_CLUB_IDS.includes(value as Fc25ClubId);
}

async function filterRunsWithArtifacts(runs: MatchRun[]): Promise<MatchRun[]> {
  const visibleRuns: MatchRun[] = [];
  for (const run of runs) {
    if (await visualiserArtifactExists(run.artefact_filename)) {
      visibleRuns.push(run);
    }
  }
  return visibleRuns;
}

function runResponse(run: MatchRun) {
  return {
    id: run.id,
    createdAt: run.created_at,
    batchId: run.batch_id,
    seed: run.seed,
    homeClubId: run.home_club_id,
    awayClubId: run.away_club_id,
    homeTactics: run.home_tactics,
    awayTactics: run.away_tactics,
    summary: run.summary,
    artefactId: run.artefact_filename
  };
}

function parseOptionalPositiveInteger(value: unknown, fallback: number): number {
  if (typeof value !== "string" && typeof value !== "number") {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function safeSlug(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "team"
  );
}
