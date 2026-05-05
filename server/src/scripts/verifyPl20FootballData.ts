import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";

import { config as loadEnv } from "dotenv";

loadEnv({
  path: fileURLToPath(new URL("../../../.env", import.meta.url))
});

const [{ buildApp }, { FOOTBALL_DATA_TEAMS }, data] = await Promise.all([
  import("../app"),
  import("../routes/ai"),
  import("@the-ataturk/data")
]);

const { FC25_CLUB_IDS, getActiveFc25DatasetVersion } = data;

interface FootballDataCompetitionTeamsResponse {
  teams?: Array<{
    id?: unknown;
    name?: unknown;
  }>;
}

interface VerifySquadResponse {
  cacheStatus: string;
  apiQuotaRemaining: { minute: number; day: number };
  verification: {
    missingPlayers: unknown[];
    suggestions: unknown[];
    attributeWarnings: unknown[];
  };
}

interface ErrorResponse {
  error?: string;
}

interface ClubVerificationSummary {
  clubId: string;
  footballDataTeamId: number;
  footballDataName: string;
  status: "ok" | "failed";
  cacheStatus?: string;
  suggestionCount?: number;
  quotaRemaining?: { minute: number; day: number };
  error?: string;
}

const activeVersion = getActiveFc25DatasetVersion();
if (!activeVersion) {
  throw new Error("No active FC25 dataset version exists");
}

await verifyLiveCompetitionMap();

const app = buildApp();
const summaries: ClubVerificationSummary[] = [];

try {
  for (const clubId of FC25_CLUB_IDS) {
    const mapping = FOOTBALL_DATA_TEAMS[clubId];
    const result = await verifyClubWithRetry(clubId, activeVersion.id);
    summaries.push({
      clubId,
      footballDataTeamId: mapping.footballDataTeamId,
      footballDataName: mapping.footballDataName,
      ...result
    });
    printClubSummary(summaries.at(-1)!);
  }
} finally {
  await app.close();
}

const failures = summaries.filter((summary) => summary.status === "failed");
const okCount = summaries.length - failures.length;

console.log(
  JSON.stringify(
    {
      datasetVersionId: activeVersion.id,
      total: summaries.length,
      ok: okCount,
      failed: failures.length,
      clubs: summaries
    },
    null,
    2
  )
);

if (failures.length > 0) {
  process.exitCode = 1;
}

async function verifyLiveCompetitionMap(): Promise<void> {
  const apiKey = process.env.FOOTBALL_DATA_API_KEY;
  if (!apiKey) {
    throw new Error("FOOTBALL_DATA_API_KEY is required for PL20 live verification");
  }

  const response = await fetchWithFootballDataRetry(
    "http://api.football-data.org/v4/competitions/PL/teams?season=2025",
    apiKey
  );
  const parsed = (await response.json()) as FootballDataCompetitionTeamsResponse;
  const liveTeams = new Map<number, string>();

  for (const team of parsed.teams ?? []) {
    if (typeof team.id === "number" && typeof team.name === "string") {
      liveTeams.set(team.id, team.name);
    }
  }

  const mismatches: string[] = [];
  for (const clubId of FC25_CLUB_IDS) {
    const mapping = FOOTBALL_DATA_TEAMS[clubId];
    const liveName = liveTeams.get(mapping.footballDataTeamId);
    if (!liveName) {
      mismatches.push(`${clubId}: team id ${mapping.footballDataTeamId} not in live PL teams`);
    } else if (liveName !== mapping.footballDataName) {
      mismatches.push(
        `${clubId}: mapped name '${mapping.footballDataName}' differs from live '${liveName}'`
      );
    }
  }

  if (mismatches.length > 0) {
    throw new Error(`football-data.org PL team mapping mismatch:\n${mismatches.join("\n")}`);
  }
}

async function fetchWithFootballDataRetry(url: string, apiKey: string): Promise<Response> {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const response = await fetch(url, {
      headers: {
        "X-Auth-Token": apiKey
      }
    });

    if (response.status !== 429) {
      if (!response.ok) {
        throw new Error(`football-data.org request failed with ${response.status}`);
      }
      return response;
    }

    const retryAfterSeconds = retryAfterFromHeaders(response) ?? 60;
    await sleep((retryAfterSeconds + 1) * 1_000);
  }

  throw new Error("football-data.org returned 429 after 3 attempts");
}

async function verifyClubWithRetry(
  clubId: string,
  datasetVersionId: string
): Promise<Omit<ClubVerificationSummary, "clubId" | "footballDataTeamId" | "footballDataName">> {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const response = await app.inject({
      method: "POST",
      url: "/api/ai/verify-squad",
      payload: { clubId, datasetVersionId }
    });

    if (response.statusCode === 429) {
      const retryAfter = Number.parseInt(String(response.headers["retry-after"] ?? "60"), 10);
      await sleep(((Number.isNaN(retryAfter) ? 60 : retryAfter) + 1) * 1_000);
      continue;
    }

    if (response.statusCode !== 200) {
      const body = response.json<ErrorResponse>();
      return { status: "failed", error: body.error ?? `HTTP ${response.statusCode}` };
    }

    const body = response.json<VerifySquadResponse>();
    const suggestionCount =
      body.verification.missingPlayers.length +
      body.verification.suggestions.length +
      body.verification.attributeWarnings.length;
    return {
      status: "ok",
      cacheStatus: body.cacheStatus,
      quotaRemaining: body.apiQuotaRemaining,
      suggestionCount
    };
  }

  return { status: "failed", error: "Rate limited after 3 attempts" };
}

function retryAfterFromHeaders(response: Response): number | undefined {
  const raw = response.headers.get("retry-after");
  if (!raw) {
    return undefined;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function printClubSummary(summary: ClubVerificationSummary): void {
  if (summary.status === "ok") {
    console.log(
      `${summary.clubId}: ok, ${summary.suggestionCount ?? 0} suggestions, cache=${summary.cacheStatus}`
    );
    return;
  }

  console.error(`${summary.clubId}: failed, ${summary.error ?? "unknown error"}`);
}
