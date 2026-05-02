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
  type Fc25Club,
  type Fc25ClubId,
  type MatchRun
} from "@the-ataturk/data";
import {
  simulateMatch,
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
  };
  away?: {
    clubId?: unknown;
    tactics?: unknown;
  };
  seed?: unknown;
  batch?: unknown;
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
          const snapshot = simulateMatch({
            homeTeam: buildTeam(parsed.home.clubId, parsed.home.tactics),
            awayTeam: buildTeam(parsed.away.clubId, parsed.away.tactics),
            duration: "second_half",
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
            summary: summaryFor(snapshot)
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
    const limit = Math.min(parseOptionalPositiveInteger(query.limit, DEFAULT_RUN_LIST_LIMIT), MAX_RUN_LIST_LIMIT);
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

  app.get<{ Params: BatchParams }>("/api/match-engine/batches/:batchId/runs", async (request, reply) => {
    const runs = await filterRunsWithArtifacts(listMatchRunsByBatch(request.params.batchId));
    if (runs.length === 0) {
      return reply.code(404).send({ error: "Batch not found" });
    }

    return { runs: runs.map(runResponse) };
  });

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
      home: { clubId: Fc25ClubId; tactics: TeamTactics };
      away: { clubId: Fc25ClubId; tactics: TeamTactics };
      seed: number;
      batch: number;
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

  return {
    home,
    away,
    seed,
    batch
  };
}

function parseTeamSelection(
  value: unknown,
  label: "home" | "away"
): { clubId: Fc25ClubId; tactics: TeamTactics } | ErrorReply {
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

  return {
    clubId: value.clubId,
    tactics
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

function buildTeam(clubId: Fc25ClubId, tactics: TeamTactics): TeamV2 {
  const squad = loadFc25Squad(clubId);

  return {
    id: clubId,
    name: squad.clubName,
    shortName: squad.shortName,
    players: squad.players,
    tactics
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

function summaryFor(snapshot: MatchSnapshot): SimulateRunSuccess["summary"] {
  const { home, away } = snapshot.finalSummary.statistics;
  return {
    score: snapshot.finalSummary.finalScore,
    shots: { home: home.shots.total, away: away.shots.total },
    fouls: { home: home.fouls, away: away.fouls },
    cards: {
      home: home.yellowCards + home.redCards,
      away: away.yellowCards + away.redCards
    },
    possession: { home: home.possession, away: away.possession }
  };
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
