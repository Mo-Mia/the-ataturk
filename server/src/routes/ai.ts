import { randomUUID } from "node:crypto";

import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import {
  FC25_CLUB_IDS,
  applySquadManagerSuggestions,
  getActiveFc25DatasetVersion,
  getFc25DatasetVersion,
  listFc25Clubs,
  listFc25DatasetVersions,
  loadFc25SquadForVerification,
  type Fc25ClubId,
  type Fc25Position,
  type Fc25SquadPlayer,
  type SquadManagerSuggestion
} from "@the-ataturk/data";
import type { FastifyInstance } from "fastify";

export const SQUAD_RECONCILIATION_MODEL = "gemini-2.5-pro";
export const FOOTBALL_DATA_TEAMS: Record<
  Fc25ClubId,
  { footballDataTeamId: number; footballDataName: string }
> = {
  arsenal: { footballDataTeamId: 57, footballDataName: "Arsenal FC" },
  "aston-villa": { footballDataTeamId: 58, footballDataName: "Aston Villa FC" },
  liverpool: { footballDataTeamId: 64, footballDataName: "Liverpool FC" },
  "manchester-city": { footballDataTeamId: 65, footballDataName: "Manchester City FC" },
  "manchester-united": { footballDataTeamId: 66, footballDataName: "Manchester United FC" }
};

export const DATA_VERACITY_RECONCILER_PROMPT = `You are Data Veracity Reconciler for FootSim.

Compare a local EA FC25 squad snapshot with a live football-data.org squad snapshot. Use only the JSON supplied in the user message. Do not use outside knowledge.

Return strict JSON only with exactly:
{
  "missingPlayers": [],
  "suggestions": [],
  "attributeWarnings": []
}

Rules:
- missingPlayers are live players absent from local FC25 data.
- suggestions are name spelling, FC25 position notation, nationality, or no-longer-in-club corrections.
- attributeWarnings are local name/position/nationality/age values that conflict with live evidence.
- Every item must include suggestionId, type, confidence, rationale, and enough player identifiers for deterministic apply.
- Use FC25 positions only: GK, CB, LB, RB, DM, CM, AM, LM, RM, LW, RW, ST.
- Do not suggest overall rating or individual stat changes.
- Prefer "confidence": "low" when the evidence is broad or ambiguous.
- Use en-GB spelling.`;

const RECONCILIATION_RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    missingPlayers: { type: "array", items: { type: "object" } },
    suggestions: { type: "array", items: { type: "object" } },
    attributeWarnings: { type: "array", items: { type: "object" } }
  },
  required: ["missingPlayers", "suggestions", "attributeWarnings"]
} as const;

const FC25_POSITION_MAP: Record<string, Fc25Position> = {
  goalkeeper: "GK",
  goalkeeping: "GK",
  defence: "CB",
  defender: "CB",
  "centre-back": "CB",
  "left-back": "LB",
  "right-back": "RB",
  midfield: "CM",
  midfielder: "CM",
  "defensive midfield": "DM",
  "attacking midfield": "AM",
  "left midfield": "LM",
  "right midfield": "RM",
  offence: "ST",
  attack: "ST",
  attacker: "ST",
  forward: "ST",
  striker: "ST",
  wing: "LW",
  winger: "LW",
  "left wing": "LW",
  "right wing": "RW"
};

type CacheStatus = "hit" | "miss" | "stale";

interface VerifySquadBody {
  clubId: Fc25ClubId;
  datasetVersionId?: string;
}

interface ApplySuggestionsBody {
  clubId: Fc25ClubId;
  baseDatasetVersionId: string;
  suggestions: SquadManagerSuggestion[];
  rationale?: string;
}

interface FootballDataSquadMember {
  id: number;
  name: string;
  position: string;
  dateOfBirth?: string | null;
  nationality: string;
  shirtNumber?: number | null;
}

interface FootballDataTeamResponse {
  id: number;
  name: string;
  shortName?: string;
  squad: FootballDataSquadMember[];
}

interface CachedTeam {
  fetchedAt: number;
  response: FootballDataTeamResponse;
}

interface IssuedSuggestion {
  clubId: Fc25ClubId;
  datasetVersionId: string;
  type: SquadManagerSuggestion["type"];
  playerId?: string;
  livePlayerId?: number;
}

interface RateLimitConfig {
  minuteLimit: number;
  dayLimit: number;
  minuteWindowMs: number;
  dayWindowMs: number;
}

interface RateLimitDecision {
  allowed: boolean;
  retryAfterSeconds: number;
  remaining: { minute: number; day: number };
}

interface GeminiVerification {
  missingPlayers: SquadManagerSuggestion[];
  suggestions: SquadManagerSuggestion[];
  attributeWarnings: SquadManagerSuggestion[];
}

interface ErrorReply {
  error: string;
}

const footballDataCache = new Map<Fc25ClubId, CachedTeam>();
const issuedSuggestions = new Map<string, IssuedSuggestion>();
const rateLimitGate = createSlidingWindowRateLimitGate({
  minuteLimit: envInteger("FOOTBALL_DATA_RATE_LIMIT_MINUTE", 10),
  dayLimit: envInteger("FOOTBALL_DATA_RATE_LIMIT_DAY", 100),
  minuteWindowMs: envInteger("FOOTBALL_DATA_RATE_LIMIT_MINUTE_WINDOW_MS", 60_000),
  dayWindowMs: envInteger("FOOTBALL_DATA_RATE_LIMIT_DAY_WINDOW_MS", 86_400_000)
});
const cacheTtlMs = envInteger("FOOTBALL_DATA_CACHE_TTL_MS", 86_400_000);

export function registerAiRoutes(app: FastifyInstance): void {
  app.get("/api/ai/squad-manager/context", () => {
    const activeVersion = getActiveFc25DatasetVersion();
    return {
      activeVersion,
      datasetVersions: listFc25DatasetVersions(),
      clubs: listFc25Clubs(activeVersion?.id).map((club) => ({
        ...club,
        footballData: FOOTBALL_DATA_TEAMS[club.id]
      }))
    };
  });

  app.get<{
    Querystring: { clubId?: unknown; datasetVersionId?: unknown };
    Reply: { squad: Fc25SquadPlayer[] } | ErrorReply;
  }>("/api/ai/squad-manager/squad", (request, reply) => {
    const parsed = parseClubAndVersionQuery(request.query);
    if ("error" in parsed) {
      reply.code(400);
      return parsed;
    }

    try {
      return { squad: loadFc25SquadForVerification(parsed.clubId, parsed.datasetVersionId) };
    } catch (error) {
      reply.code(404);
      return { error: errorMessage(error) };
    }
  });

  app.post<{ Body: unknown }>("/api/ai/verify-squad", async (request, reply) => {
    const parsed = parseVerifySquadBody(request.body);
    if ("error" in parsed) {
      reply.code(400).send(parsed);
      return;
    }

    const datasetVersionId =
      parsed.datasetVersionId ?? getActiveFc25DatasetVersion()?.id ?? undefined;
    if (!datasetVersionId || !getFc25DatasetVersion(datasetVersionId)) {
      reply.code(404).send({ error: "FC25 dataset version does not exist" });
      return;
    }

    try {
      const localSquad = loadFc25SquadForVerification(parsed.clubId, datasetVersionId);
      const teamResult = await getFootballDataTeam(parsed.clubId);
      const verification = await reconcileSquads({
        clubId: parsed.clubId,
        datasetVersionId,
        localSquad,
        liveSquad: teamResult.team.squad
      });
      rememberIssuedSuggestions(parsed.clubId, datasetVersionId, verification);

      reply.send({
        verification,
        cacheStatus: teamResult.cacheStatus,
        apiQuotaRemaining: rateLimitGate.remaining(Date.now())
      });
    } catch (error) {
      if (error instanceof RateLimitError) {
        reply.header("retry-after", String(error.retryAfterSeconds));
        reply.code(429).send({ error: error.message });
        return;
      }

      if (error instanceof ReconciliationError) {
        reply.code(502).send({ error: error.message });
        return;
      }

      reply.code(500).send({ error: errorMessage(error) });
    }
  });

  app.post<{ Body: unknown }>("/api/ai/apply-suggestions", (request, reply) => {
    const parsed = parseApplySuggestionsBody(request.body);
    if ("error" in parsed) {
      reply.code(400).send(parsed);
      return;
    }

    try {
      validateIssuedSuggestions(parsed);
      const result = applySquadManagerSuggestions({
        clubId: parsed.clubId,
        baseDatasetVersionId: parsed.baseDatasetVersionId,
        suggestions: parsed.suggestions,
        ...(parsed.rationale === undefined ? {} : { rationale: parsed.rationale })
      });
      reply.send(result);
    } catch (error) {
      reply.code(400).send({ error: errorMessage(error) });
    }
  });
}

export function resetAiRouteStateForTests(): void {
  footballDataCache.clear();
  issuedSuggestions.clear();
  rateLimitGate.reset();
}

export function createSlidingWindowRateLimitGate(config: RateLimitConfig) {
  let minuteRequests: number[] = [];
  let dayRequests: number[] = [];

  function prune(now: number): void {
    minuteRequests = minuteRequests.filter((timestamp) => now - timestamp < config.minuteWindowMs);
    dayRequests = dayRequests.filter((timestamp) => now - timestamp < config.dayWindowMs);
  }

  return {
    attempt(now = Date.now()): RateLimitDecision {
      prune(now);
      const minuteAllowed = minuteRequests.length < config.minuteLimit;
      const dayAllowed = dayRequests.length < config.dayLimit;

      if (!minuteAllowed || !dayAllowed) {
        const minuteRetry =
          minuteRequests[0] === undefined ? 0 : config.minuteWindowMs - (now - minuteRequests[0]);
        const dayRetry =
          dayRequests[0] === undefined ? 0 : config.dayWindowMs - (now - dayRequests[0]);
        const retryMs =
          !minuteAllowed && !dayAllowed
            ? Math.min(minuteRetry, dayRetry)
            : !minuteAllowed
              ? minuteRetry
              : dayRetry;

        return {
          allowed: false,
          retryAfterSeconds: Math.max(1, Math.ceil(retryMs / 1000)),
          remaining: {
            minute: Math.max(0, config.minuteLimit - minuteRequests.length),
            day: Math.max(0, config.dayLimit - dayRequests.length)
          }
        };
      }

      minuteRequests.push(now);
      dayRequests.push(now);

      return {
        allowed: true,
        retryAfterSeconds: 0,
        remaining: {
          minute: Math.max(0, config.minuteLimit - minuteRequests.length),
          day: Math.max(0, config.dayLimit - dayRequests.length)
        }
      };
    },
    remaining(now = Date.now()) {
      prune(now);
      return {
        minute: Math.max(0, config.minuteLimit - minuteRequests.length),
        day: Math.max(0, config.dayLimit - dayRequests.length)
      };
    },
    reset(): void {
      minuteRequests = [];
      dayRequests = [];
    }
  };
}

async function getFootballDataTeam(
  clubId: Fc25ClubId
): Promise<{ team: FootballDataTeamResponse; cacheStatus: CacheStatus }> {
  const now = Date.now();
  const cached = footballDataCache.get(clubId);
  if (cached && now - cached.fetchedAt < cacheTtlMs) {
    return { team: cached.response, cacheStatus: "hit" };
  }

  const decision = rateLimitGate.attempt(now);
  if (!decision.allowed) {
    if (cached) {
      return { team: cached.response, cacheStatus: "stale" };
    }
    throw new RateLimitError("football-data.org quota exhausted", decision.retryAfterSeconds);
  }

  try {
    const team = await fetchFootballDataTeam(clubId);
    footballDataCache.set(clubId, { fetchedAt: now, response: team });
    return { team, cacheStatus: "miss" };
  } catch (error) {
    if (error instanceof RateLimitError && cached) {
      return { team: cached.response, cacheStatus: "stale" };
    }
    throw error;
  }
}

async function fetchFootballDataTeam(clubId: Fc25ClubId): Promise<FootballDataTeamResponse> {
  const apiKey = process.env.FOOTBALL_DATA_API_KEY;
  if (!apiKey) {
    throw new Error("FOOTBALL_DATA_API_KEY is required for squad verification");
  }

  const teamId = FOOTBALL_DATA_TEAMS[clubId].footballDataTeamId;
  const response = await fetch(`http://api.football-data.org/v4/teams/${teamId}`, {
    headers: {
      "X-Auth-Token": apiKey
    }
  });

  if (!response.ok) {
    if (response.status === 429) {
      throw new RateLimitError("football-data.org returned 429", retryAfterFromHeaders(response));
    }
    throw new Error(`football-data.org request failed with ${response.status}`);
  }

  const parsed = (await response.json()) as unknown;
  return parseFootballDataTeamResponse(parsed);
}

async function reconcileSquads(input: {
  clubId: Fc25ClubId;
  datasetVersionId: string;
  localSquad: Fc25SquadPlayer[];
  liveSquad: FootballDataSquadMember[];
}): Promise<GeminiVerification> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new ReconciliationError("GEMINI_API_KEY is required for squad reconciliation");
  }

  const ai = new GoogleGenAI({ apiKey });
  const prompt = JSON.stringify(
    {
      localSquad: input.localSquad.map((player) => ({
        id: player.id,
        name: player.name,
        position: player.position,
        age: player.age,
        nationality: "unknown"
      })),
      liveSquad: input.liveSquad
    },
    null,
    2
  );

  try {
    const response = await ai.models.generateContent({
      model: SQUAD_RECONCILIATION_MODEL,
      contents: prompt,
      config: {
        systemInstruction: DATA_VERACITY_RECONCILER_PROMPT,
        temperature: 0.2,
        thinkingConfig: {
          thinkingLevel: ThinkingLevel.LOW
        },
        responseMimeType: "application/json",
        responseJsonSchema: RECONCILIATION_RESPONSE_SCHEMA
      }
    });

    return normaliseGeminiVerification(response.text, input.liveSquad);
  } catch (error) {
    if (error instanceof ReconciliationError) {
      throw error;
    }

    throw new ReconciliationError("Gemini squad reconciliation failed");
  }
}

function normaliseGeminiVerification(
  rawText: string | undefined,
  liveSquad: FootballDataSquadMember[]
): GeminiVerification {
  if (!rawText) {
    throw new ReconciliationError("Gemini returned an empty squad reconciliation response");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new ReconciliationError("Gemini returned invalid JSON for squad reconciliation");
  }

  if (!isRecord(parsed)) {
    throw new ReconciliationError("Gemini squad reconciliation response must be an object");
  }

  return {
    missingPlayers: parseSuggestionArray(parsed.missingPlayers, "missingPlayers", liveSquad),
    suggestions: parseSuggestionArray(parsed.suggestions, "suggestions", liveSquad),
    attributeWarnings: parseSuggestionArray(
      parsed.attributeWarnings,
      "attributeWarnings",
      liveSquad
    )
  };
}

function parseSuggestionArray(
  value: unknown,
  fieldName: string,
  liveSquad: FootballDataSquadMember[]
): SquadManagerSuggestion[] {
  if (!Array.isArray(value)) {
    throw new ReconciliationError(`Gemini field '${fieldName}' must be an array`);
  }

  return value.map((item) => normaliseSuggestion(item, fieldName, liveSquad));
}

function normaliseSuggestion(
  item: unknown,
  fieldName: string,
  liveSquad: FootballDataSquadMember[]
): SquadManagerSuggestion {
  if (!isRecord(item)) {
    throw new ReconciliationError(`Gemini '${fieldName}' item must be an object`);
  }

  const suggestionId = `sug-${randomUUID()}`;
  const rationale = typeof item.rationale === "string" ? item.rationale : undefined;
  const type =
    typeof item.type === "string"
      ? item.type
      : fieldName === "missingPlayers"
        ? "player_addition"
        : undefined;

  if (type === "player_update") {
    const playerId = stringField(item.playerId ?? item.localPlayerId, "playerId");
    const changes = isRecord(item.changes) ? item.changes : item;
    const parsedChanges: Extract<SquadManagerSuggestion, { type: "player_update" }>["changes"] = {};

    if (typeof changes.name === "string") {
      parsedChanges.name = changes.name;
    }
    const position = parseFc25Position(changes.position);
    if (position) {
      parsedChanges.position = position;
    }
    if (typeof changes.nationality === "string") {
      parsedChanges.nationality = changes.nationality;
    }
    if (typeof changes.age === "number" && Number.isInteger(changes.age)) {
      parsedChanges.age = changes.age;
    }

    return {
      suggestionId,
      type: "player_update",
      playerId,
      changes: parsedChanges,
      ...(rationale === undefined ? {} : { rationale })
    };
  }

  if (type === "player_removal") {
    return {
      suggestionId,
      type: "player_removal",
      playerId: stringField(item.playerId ?? item.localPlayerId, "playerId"),
      ...(rationale === undefined ? {} : { rationale })
    };
  }

  if (type === "player_addition") {
    const livePlayer = livePlayerFromSuggestion(item, liveSquad);
    return {
      suggestionId,
      type: "player_addition",
      livePlayer,
      proposed: {
        name: typeof item.name === "string" ? item.name : livePlayer.name,
        position: parseFc25Position(item.position) ?? positionFromLive(livePlayer.position),
        nationality:
          typeof item.nationality === "string" ? item.nationality : livePlayer.nationality,
        age: ageFromDateOfBirth(livePlayer.dateOfBirth) ?? 18,
        shirtNumber: livePlayer.shirtNumber ?? null
      },
      ...(rationale === undefined ? {} : { rationale })
    };
  }

  throw new ReconciliationError(`Unsupported Gemini suggestion type in '${fieldName}'`);
}

function rememberIssuedSuggestions(
  clubId: Fc25ClubId,
  datasetVersionId: string,
  verification: GeminiVerification
): void {
  for (const suggestion of [
    ...verification.missingPlayers,
    ...verification.suggestions,
    ...verification.attributeWarnings
  ]) {
    issuedSuggestions.set(suggestion.suggestionId, {
      clubId,
      datasetVersionId,
      type: suggestion.type,
      ...(suggestion.type === "player_addition"
        ? { livePlayerId: suggestion.livePlayer.id }
        : { playerId: suggestion.playerId })
    });
  }
}

function validateIssuedSuggestions(body: ApplySuggestionsBody): void {
  for (const suggestion of body.suggestions) {
    const issued = issuedSuggestions.get(suggestion.suggestionId);
    if (!issued) {
      throw new Error(`Suggestion '${suggestion.suggestionId}' was not issued by this server`);
    }
    if (
      issued.clubId !== body.clubId ||
      issued.datasetVersionId !== body.baseDatasetVersionId ||
      issued.type !== suggestion.type
    ) {
      throw new Error(`Suggestion '${suggestion.suggestionId}' does not match its issued context`);
    }
    if (suggestion.type === "player_addition") {
      if (issued.livePlayerId !== suggestion.livePlayer.id) {
        throw new Error(`Suggestion '${suggestion.suggestionId}' live player does not match`);
      }
    } else if (issued.playerId !== suggestion.playerId) {
      throw new Error(`Suggestion '${suggestion.suggestionId}' player does not match`);
    }
  }
}

function parseFootballDataTeamResponse(value: unknown): FootballDataTeamResponse {
  if (!isRecord(value) || typeof value.id !== "number" || typeof value.name !== "string") {
    throw new Error("football-data.org team response is malformed");
  }
  if (!Array.isArray(value.squad)) {
    throw new Error("football-data.org team response did not include a squad");
  }

  return {
    id: value.id,
    name: value.name,
    ...(typeof value.shortName === "string" ? { shortName: value.shortName } : {}),
    squad: value.squad.map(parseFootballDataSquadMember)
  };
}

function parseFootballDataSquadMember(value: unknown): FootballDataSquadMember {
  if (!isRecord(value) || typeof value.id !== "number" || typeof value.name !== "string") {
    throw new Error("football-data.org squad member is malformed");
  }

  return {
    id: value.id,
    name: value.name,
    position: typeof value.position === "string" ? value.position : "Unknown",
    dateOfBirth: typeof value.dateOfBirth === "string" ? value.dateOfBirth : null,
    nationality: typeof value.nationality === "string" ? value.nationality : "Unknown",
    shirtNumber: typeof value.shirtNumber === "number" ? value.shirtNumber : null
  };
}

function parseVerifySquadBody(body: unknown): VerifySquadBody | ErrorReply {
  if (!isRecord(body)) {
    return { error: "Request body must be an object" };
  }
  if (!isFc25ClubId(body.clubId)) {
    return { error: "clubId must be a supported FC25 club id" };
  }
  if (body.datasetVersionId !== undefined && typeof body.datasetVersionId !== "string") {
    return { error: "datasetVersionId must be text" };
  }
  return {
    clubId: body.clubId,
    ...(body.datasetVersionId === undefined ? {} : { datasetVersionId: body.datasetVersionId })
  };
}

function parseApplySuggestionsBody(body: unknown): ApplySuggestionsBody | ErrorReply {
  if (!isRecord(body)) {
    return { error: "Request body must be an object" };
  }
  if (!isFc25ClubId(body.clubId)) {
    return { error: "clubId must be a supported FC25 club id" };
  }
  if (typeof body.baseDatasetVersionId !== "string") {
    return { error: "baseDatasetVersionId is required" };
  }
  if (!Array.isArray(body.suggestions)) {
    return { error: "suggestions must be an array" };
  }
  return {
    clubId: body.clubId,
    baseDatasetVersionId: body.baseDatasetVersionId,
    suggestions: body.suggestions as SquadManagerSuggestion[],
    ...(typeof body.rationale === "string" ? { rationale: body.rationale } : {})
  };
}

function parseClubAndVersionQuery(query: {
  clubId?: unknown;
  datasetVersionId?: unknown;
}): { clubId: Fc25ClubId; datasetVersionId?: string } | ErrorReply {
  if (!isFc25ClubId(query.clubId)) {
    return { error: "clubId must be a supported FC25 club id" };
  }
  if (query.datasetVersionId !== undefined && typeof query.datasetVersionId !== "string") {
    return { error: "datasetVersionId must be text" };
  }
  return {
    clubId: query.clubId,
    ...(query.datasetVersionId === undefined ? {} : { datasetVersionId: query.datasetVersionId })
  };
}

function livePlayerFromSuggestion(
  item: Record<string, unknown>,
  liveSquad: FootballDataSquadMember[]
): FootballDataSquadMember {
  const livePlayer = isRecord(item.livePlayer) ? item.livePlayer : item;
  const liveId =
    typeof livePlayer.id === "number"
      ? livePlayer.id
      : typeof item.livePlayerId === "number"
        ? item.livePlayerId
        : null;
  const fromSquad = liveId === null ? undefined : liveSquad.find((player) => player.id === liveId);
  if (fromSquad) {
    return fromSquad;
  }

  return parseFootballDataSquadMember(livePlayer);
}

function positionFromLive(position: string): Fc25Position {
  return FC25_POSITION_MAP[position.trim().toLowerCase()] ?? "CM";
}

function parseFc25Position(value: unknown): Fc25Position | null {
  if (typeof value !== "string") {
    return null;
  }
  const upper = value.toUpperCase();
  if (isFc25Position(upper)) {
    return upper;
  }
  return FC25_POSITION_MAP[value.trim().toLowerCase()] ?? null;
}

function ageFromDateOfBirth(dateOfBirth: string | null | undefined): number | null {
  if (!dateOfBirth) {
    return null;
  }
  const born = new Date(dateOfBirth);
  if (Number.isNaN(born.getTime())) {
    return null;
  }
  const today = new Date();
  let age = today.getUTCFullYear() - born.getUTCFullYear();
  const monthDelta = today.getUTCMonth() - born.getUTCMonth();
  if (monthDelta < 0 || (monthDelta === 0 && today.getUTCDate() < born.getUTCDate())) {
    age -= 1;
  }
  return age;
}

function retryAfterFromHeaders(response: Response): number {
  const raw =
    response.headers.get("X-Requests-Counter-Reset") ?? response.headers.get("retry-after");
  if (!raw) {
    return 60;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isNaN(parsed) ? 60 : Math.max(1, parsed);
}

function stringField(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ReconciliationError(`Gemini suggestion must include ${fieldName}`);
  }
  return value;
}

function envInteger(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function isFc25ClubId(value: unknown): value is Fc25ClubId {
  return FC25_CLUB_IDS.includes(value as Fc25ClubId);
}

function isFc25Position(value: unknown): value is Fc25Position {
  return ["GK", "CB", "LB", "RB", "DM", "CM", "AM", "LM", "RM", "LW", "RW", "ST"].includes(
    value as Fc25Position
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Request failed";
}

class RateLimitError extends Error {
  constructor(
    message: string,
    readonly retryAfterSeconds: number
  ) {
    super(message);
    this.name = "RateLimitError";
  }
}

class ReconciliationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReconciliationError";
  }
}
