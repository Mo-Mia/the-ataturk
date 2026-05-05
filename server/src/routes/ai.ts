import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { GoogleGenAI } from "@google/genai";
import {
  FC25_CLUB_IDS,
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
  "afc-bournemouth": { footballDataTeamId: 1044, footballDataName: "AFC Bournemouth" },
  arsenal: { footballDataTeamId: 57, footballDataName: "Arsenal FC" },
  "aston-villa": { footballDataTeamId: 58, footballDataName: "Aston Villa FC" },
  brentford: { footballDataTeamId: 402, footballDataName: "Brentford FC" },
  brighton: { footballDataTeamId: 397, footballDataName: "Brighton & Hove Albion FC" },
  burnley: { footballDataTeamId: 328, footballDataName: "Burnley FC" },
  chelsea: { footballDataTeamId: 61, footballDataName: "Chelsea FC" },
  "crystal-palace": { footballDataTeamId: 354, footballDataName: "Crystal Palace FC" },
  everton: { footballDataTeamId: 62, footballDataName: "Everton FC" },
  fulham: { footballDataTeamId: 63, footballDataName: "Fulham FC" },
  "leeds-united": { footballDataTeamId: 341, footballDataName: "Leeds United FC" },
  liverpool: { footballDataTeamId: 64, footballDataName: "Liverpool FC" },
  "manchester-city": { footballDataTeamId: 65, footballDataName: "Manchester City FC" },
  "manchester-united": { footballDataTeamId: 66, footballDataName: "Manchester United FC" },
  "newcastle-united": { footballDataTeamId: 67, footballDataName: "Newcastle United FC" },
  "nottingham-forest": { footballDataTeamId: 351, footballDataName: "Nottingham Forest FC" },
  sunderland: { footballDataTeamId: 71, footballDataName: "Sunderland AFC" },
  "tottenham-hotspur": { footballDataTeamId: 73, footballDataName: "Tottenham Hotspur FC" },
  "west-ham-united": { footballDataTeamId: 563, footballDataName: "West Ham United FC" },
  "wolverhampton-wanderers": {
    footballDataTeamId: 76,
    footballDataName: "Wolverhampton Wanderers FC"
  }
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
- Do not invent suggestionId values. The server will assign suggestionId values after validation.
- Use only these type values: "player_addition", "player_update", "player_removal".
- player_addition items must include livePlayerId.
- player_update items must include playerId and changes.
- player_removal items must include playerId.
- Every item must include type, confidence, rationale, and enough player identifiers for deterministic apply.
- Use FC25 positions only: GK, CB, LB, RB, DM, CM, AM, LM, RM, LW, RW, ST.
- Do not suggest overall rating or individual stat changes.
- Prefer "confidence": "low" when the evidence is broad or ambiguous.
- Use en-GB spelling.`;

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

interface GeminiTextResponse {
  text: string | undefined;
}

interface ErrorReply {
  error: string;
}

const footballDataCache = new Map<Fc25ClubId, CachedTeam>();
const rateLimitGate = createSlidingWindowRateLimitGate({
  minuteLimit: envInteger("FOOTBALL_DATA_RATE_LIMIT_MINUTE", 10),
  dayLimit: envInteger("FOOTBALL_DATA_RATE_LIMIT_DAY", 100),
  minuteWindowMs: envInteger("FOOTBALL_DATA_RATE_LIMIT_MINUTE_WINDOW_MS", 60_000),
  dayWindowMs: envInteger("FOOTBALL_DATA_RATE_LIMIT_DAY_WINDOW_MS", 86_400_000)
});
const cacheTtlMs = envInteger("FOOTBALL_DATA_CACHE_TTL_MS", 86_400_000);
let footballDataCurlFallbackRunner = runFootballDataCurlFallback;
let geminiCurlFallbackRunner = runGeminiCurlFallback;

/**
 * Register AI-assisted Squad Manager routes for context, squad loading, and verification.
 *
 * @param app Fastify instance receiving the route registrations.
 * @returns Nothing; routes are registered for later HTTP handling.
 */
export function registerAiRoutes(app: FastifyInstance): void {
  /** GET `/api/ai/squad-manager/context`: load active dataset, versions, clubs, and live ids. */
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

  /** GET `/api/ai/squad-manager/squad`: load a club squad for verification review. */
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

  /** POST `/api/ai/verify-squad`: reconcile local FC25 squad data against football-data.org. */
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
      assertFootballDataMapping(parsed.clubId);
      const localSquad = loadFc25SquadForVerification(parsed.clubId, datasetVersionId);
      const teamResult = await getFootballDataTeam(parsed.clubId);
      const verification = await reconcileSquads({
        clubId: parsed.clubId,
        datasetVersionId,
        localSquad,
        liveSquad: teamResult.team.squad
      });
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

      if (error instanceof UnsupportedFootballDataClubError) {
        reply.code(400).send({ error: error.message });
        return;
      }

      reply.code(500).send({ error: errorMessage(error) });
    }
  });
}

/**
 * Override the Gemini curl fallback runner in tests.
 *
 * @param runner Replacement runner, or undefined to restore the default.
 * @returns Nothing.
 */
export function setGeminiCurlFallbackRunnerForTests(
  runner: typeof runGeminiCurlFallback | undefined
): void {
  geminiCurlFallbackRunner = runner ?? runGeminiCurlFallback;
}

/**
 * Override the football-data.org curl fallback runner in tests.
 *
 * @param runner Replacement runner, or undefined to restore the default.
 * @returns Nothing.
 */
export function setFootballDataCurlFallbackRunnerForTests(
  runner: typeof runFootballDataCurlFallback | undefined
): void {
  footballDataCurlFallbackRunner = runner ?? runFootballDataCurlFallback;
}

/**
 * Reset AI route caches, fallback runners, and rate-limit state between tests.
 *
 * @returns Nothing.
 */
export function resetAiRouteStateForTests(): void {
  footballDataCache.clear();
  footballDataCurlFallbackRunner = runFootballDataCurlFallback;
  geminiCurlFallbackRunner = runGeminiCurlFallback;
  rateLimitGate.reset();
}

/**
 * Create the in-memory football-data.org sliding-window rate limiter.
 *
 * @param config Minute/day limits and window durations.
 * @returns Gate with attempt, remaining, and reset operations.
 */
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

  const teamId = footballDataTeamIdFor(clubId);
  let response: Response;
  try {
    response = await fetch(`http://api.football-data.org/v4/teams/${teamId}`, {
      headers: {
        "X-Auth-Token": apiKey
      }
    });
  } catch (error) {
    if (!isFetchTransportError(error)) {
      throw error;
    }

    return footballDataCurlFallbackRunner(apiKey, teamId);
  }

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

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      timeout: envInteger("GEMINI_SDK_TIMEOUT_MS", 5_000),
      retryOptions: { attempts: 1 }
    }
  });
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
    const request = buildGeminiSquadReconciliationRequest(prompt);
    let response: GeminiTextResponse;
    try {
      response = await ai.models.generateContent(request);
    } catch (error) {
      if (!isGeminiSdkFallbackWorthyError(error)) {
        throw error;
      }

      response = await geminiCurlFallbackRunner(apiKey, request);
    }

    return normaliseGeminiVerification(response.text, input.liveSquad, input.localSquad);
  } catch (error) {
    if (error instanceof ReconciliationError) {
      throw error;
    }

    throw new ReconciliationError(`Gemini squad reconciliation failed: ${errorMessage(error)}`);
  }
}

function buildGeminiSquadReconciliationRequest(prompt: string) {
  return {
    model: SQUAD_RECONCILIATION_MODEL,
    contents: prompt,
    config: {
      systemInstruction: DATA_VERACITY_RECONCILER_PROMPT,
      temperature: 0.2,
      thinkingConfig: {
        thinkingBudget: 1024
      },
      responseMimeType: "application/json"
    }
  };
}

async function runGeminiCurlFallback(
  apiKey: string,
  request: ReturnType<typeof buildGeminiSquadReconciliationRequest>
): Promise<GeminiTextResponse> {
  const body = JSON.stringify({
    contents: [{ role: "user", parts: [{ text: request.contents }] }],
    systemInstruction: { parts: [{ text: request.config.systemInstruction }] },
    generationConfig: {
      temperature: request.config.temperature,
      thinkingConfig: request.config.thinkingConfig,
      responseMimeType: request.config.responseMimeType
    }
  });
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${request.model}:generateContent`;
  const tempDirectory = await mkdtemp(join(tmpdir(), "footsim-gemini-"));
  const bodyPath = join(tempDirectory, "request.json");

  try {
    await writeFile(bodyPath, body, "utf8");
    const config = [
      `url = "${url}"`,
      'request = "POST"',
      'header = "Content-Type: application/json"',
      `header = "x-goog-api-key: ${apiKey}"`,
      `max-time = ${envInteger("GEMINI_CURL_TIMEOUT_SECONDS", 60)}`,
      "silent",
      "show-error",
      `data-binary = "@${bodyPath}"`
    ].join("\n");
    const result = await runCurlWithConfig(`${config}\n`);
    if (result.statusCode >= 400) {
      throw new Error(`Gemini curl fallback failed with HTTP ${result.statusCode}: ${result.body}`);
    }
    return parseGeminiRestResponse(result.body);
  } finally {
    await rm(tempDirectory, { recursive: true, force: true });
  }
}

async function runFootballDataCurlFallback(
  apiKey: string,
  teamId: number
): Promise<FootballDataTeamResponse> {
  const config = [
    `url = "http://api.football-data.org/v4/teams/${teamId}"`,
    'header = "Accept: application/json"',
    `header = "X-Auth-Token: ${apiKey}"`,
    `max-time = ${envInteger("FOOTBALL_DATA_CURL_TIMEOUT_SECONDS", 20)}`,
    "silent",
    "show-error"
  ].join("\n");
  const result = await runCurlWithConfig(`${config}\n`);

  if (result.statusCode === 429) {
    throw new RateLimitError("football-data.org returned 429", 60);
  }
  if (result.statusCode >= 400) {
    throw new Error(`football-data.org curl fallback failed with ${result.statusCode}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(result.body);
  } catch {
    throw new Error("football-data.org curl fallback returned invalid JSON");
  }

  return parseFootballDataTeamResponse(parsed);
}

function runCurlWithConfig(config: string): Promise<{ body: string; statusCode: number }> {
  return new Promise((resolve, reject) => {
    const curl = spawn("curl", ["--config", "-", "--write-out", "\n%{http_code}"], {
      stdio: ["pipe", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";

    curl.stdout.setEncoding("utf8");
    curl.stderr.setEncoding("utf8");
    curl.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    curl.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    curl.on("error", (error) => {
      reject(error);
    });
    curl.on("close", (code) => {
      const statusMatch = stdout.match(/\n(\d{3})$/);
      const statusCode = statusMatch ? Number.parseInt(statusMatch[1]!, 10) : undefined;
      const responseBody = statusMatch ? stdout.slice(0, -4) : stdout;

      if (code !== 0) {
        reject(
          new Error(
            `curl fallback failed${statusCode ? ` with HTTP ${statusCode}` : ""}: ${
              responseBody.trim() || stderr.trim() || `curl exited with code ${code ?? "unknown"}`
            }`
          )
        );
        return;
      }

      resolve({ body: responseBody, statusCode: statusCode ?? 0 });
    });

    curl.stdin.end(config);
  });
}

function parseGeminiRestResponse(raw: string): GeminiTextResponse {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ReconciliationError("Gemini curl fallback returned invalid JSON");
  }

  if (!isRecord(parsed) || !Array.isArray(parsed.candidates)) {
    throw new ReconciliationError("Gemini curl fallback response is malformed");
  }

  const candidates = parsed.candidates as unknown[];
  const firstCandidate = candidates[0];
  const parts =
    isRecord(firstCandidate) &&
    isRecord(firstCandidate.content) &&
    Array.isArray(firstCandidate.content.parts)
      ? (firstCandidate.content.parts as unknown[])
      : undefined;
  const textPart = parts?.find((part) => isRecord(part) && typeof part.text === "string");

  if (!isRecord(textPart) || typeof textPart.text !== "string") {
    throw new ReconciliationError("Gemini curl fallback response did not include text");
  }

  return { text: textPart.text };
}

function isFetchTransportError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const cause = "cause" in error ? error.cause : undefined;
  const causeCode = isRecord(cause) && typeof cause.code === "string" ? cause.code : undefined;
  return (
    error.message === "fetch failed" &&
    (causeCode === undefined ||
      ["ENOTFOUND", "ECONNREFUSED", "ECONNRESET", "ETIMEDOUT", "EAI_AGAIN"].includes(causeCode))
  );
}

function isGeminiSdkFallbackWorthyError(error: unknown): boolean {
  if (isFetchTransportError(error)) {
    return true;
  }

  return error instanceof Error && error.message.includes("Bad Request sending request");
}

function normaliseGeminiVerification(
  rawText: string | undefined,
  liveSquad: FootballDataSquadMember[],
  localSquad: Fc25SquadPlayer[]
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

  const verification = {
    missingPlayers: parseSuggestionArray(parsed.missingPlayers, "missingPlayers", liveSquad),
    suggestions: parseSuggestionArray(parsed.suggestions, "suggestions", liveSquad),
    attributeWarnings: parseSuggestionArray(
      parsed.attributeWarnings,
      "attributeWarnings",
      liveSquad
    )
  };

  return {
    missingPlayers: verification.missingPlayers,
    suggestions: removeNoOpPlayerUpdates(verification.suggestions, localSquad),
    attributeWarnings: removeNoOpPlayerUpdates(verification.attributeWarnings, localSquad)
  };
}

function removeNoOpPlayerUpdates(
  suggestions: SquadManagerSuggestion[],
  localSquad: Fc25SquadPlayer[]
): SquadManagerSuggestion[] {
  const filtered: SquadManagerSuggestion[] = [];

  for (const suggestion of suggestions) {
    if (suggestion.type !== "player_update") {
      filtered.push(suggestion);
      continue;
    }

    const localPlayer = localSquad.find((player) => player.id === suggestion.playerId);
    if (!localPlayer) {
      if (Object.keys(suggestion.changes).length > 0) {
        filtered.push(suggestion);
      }
      continue;
    }

    const changes: Extract<SquadManagerSuggestion, { type: "player_update" }>["changes"] = {
      ...suggestion.changes
    };
    if (changes.name === localPlayer.name) {
      delete changes.name;
    }
    if (changes.position === localPlayer.position) {
      delete changes.position;
    }
    if (changes.age === localPlayer.age) {
      delete changes.age;
    }

    if (Object.keys(changes).length === 0) {
      continue;
    }

    filtered.push({ ...suggestion, changes });
  }

  return filtered;
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
  const type = normaliseSuggestionType(
    typeof item.type === "string"
      ? item.type
      : fieldName === "missingPlayers"
        ? "player_addition"
        : fieldName === "attributeWarnings"
          ? "player_update"
          : undefined,
    fieldName
  );

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

function normaliseSuggestionType(
  value: string | undefined,
  fieldName?: string
): SquadManagerSuggestion["type"] | undefined {
  if (!value) {
    return undefined;
  }

  const normalised = value.toLowerCase().replaceAll("-", "_").replaceAll(" ", "_");
  if (["player_addition", "missing_player", "transfer_in", "new_player"].includes(normalised)) {
    return "player_addition";
  }
  if (
    [
      "player_update",
      "attribute_update",
      "attribute_warning",
      "attribute_warnings",
      "name_update",
      "position_update",
      "nationality_update",
      "age_update",
      "name_mismatch",
      "position_mismatch",
      "nationality_mismatch",
      "age_mismatch",
      "name_conflict",
      "position_conflict",
      "nationality_conflict",
      "age_conflict",
      "name_difference",
      "position_difference",
      "nationality_difference",
      "age_difference"
    ].includes(normalised)
  ) {
    return "player_update";
  }
  if (
    normalised.includes("warning") ||
    normalised.includes("mismatch") ||
    normalised.includes("conflict") ||
    normalised.includes("difference") ||
    normalised.includes("drift")
  ) {
    return "player_update";
  }
  if (
    ["player_removal", "no_longer_in_club", "transfer_out", "removed_player"].includes(normalised)
  ) {
    return "player_removal";
  }

  if (fieldName === "attributeWarnings") {
    return "player_update";
  }

  return undefined;
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

function assertFootballDataMapping(clubId: Fc25ClubId): void {
  if (!FOOTBALL_DATA_TEAMS[clubId]) {
    throw new UnsupportedFootballDataClubError(
      `Squad verification is not configured for '${clubId}' yet`
    );
  }
}

function footballDataTeamIdFor(clubId: Fc25ClubId): number {
  const mapping = FOOTBALL_DATA_TEAMS[clubId];
  if (!mapping) {
    throw new UnsupportedFootballDataClubError(
      `Squad verification is not configured for '${clubId}' yet`
    );
  }
  return mapping.footballDataTeamId;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function errorMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    return "Request failed";
  }

  const details: string[] = [error.message];
  if (isRecord(error)) {
    const status = typeof error.status === "number" ? error.status : undefined;
    const code =
      typeof error.code === "string" || typeof error.code === "number" ? error.code : undefined;
    const errorDetails =
      error.details ??
      error.errorDetails ??
      error.response ??
      error.body ??
      error.data ??
      undefined;

    if (status !== undefined) {
      details.push(`status ${status}`);
    }
    if (code !== undefined) {
      details.push(`code ${code}`);
    }
    if (errorDetails !== undefined) {
      details.push(`details ${safeErrorDetails(errorDetails)}`);
    }
  }

  const cause = "cause" in error ? error.cause : undefined;
  if (cause instanceof Error && cause.message !== error.message) {
    details.push(`cause ${cause.message}`);
  }

  return details.join("; ");
}

function safeErrorDetails(value: unknown): string {
  if (typeof value === "string") {
    return value.slice(0, 500);
  }

  try {
    return JSON.stringify(value).slice(0, 500);
  } catch {
    return "unserialisable";
  }
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

class UnsupportedFootballDataClubError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsupportedFootballDataClubError";
  }
}
