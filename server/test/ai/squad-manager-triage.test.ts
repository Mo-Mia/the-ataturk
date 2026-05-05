import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  getActiveFc25DatasetVersion,
  importFc25Dataset,
  listFc25DatasetVersions
} from "@the-ataturk/data";
import { afterEach, describe, expect, it, vi } from "vitest";

const genAiMocks = vi.hoisted(() => ({
  generateContent: vi.fn<(request: { contents: string }) => Promise<{ text: string }>>()
}));

vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    models = {
      generateContent: genAiMocks.generateContent
    };
  }
}));

import { buildApp } from "../../src/app";
import {
  FOOTBALL_DATA_TEAMS,
  resetAiRouteStateForTests
} from "../../src/routes/ai";
import {
  classifySuggestionRisk,
  runSquadManagerTriageSample
} from "../../src/squad-manager/triageSample";
import { createServerTestDatabase, type TestDatabase } from "../admin/test-db";

const previousFootballDataApiKey = process.env.FOOTBALL_DATA_API_KEY;
const previousGeminiApiKey = process.env.GEMINI_API_KEY;
const FC26_PL20_FIXTURE_PATH = "data/fc-25/FC26_20250921.csv";

let testDatabase: TestDatabase | undefined;
let outputDir: string | undefined;

afterEach(async () => {
  vi.unstubAllGlobals();
  genAiMocks.generateContent.mockReset();
  resetAiRouteStateForTests();
  testDatabase?.cleanup();
  testDatabase = undefined;

  if (outputDir) {
    await rm(outputDir, { recursive: true, force: true });
    outputDir = undefined;
  }

  if (previousFootballDataApiKey === undefined) {
    delete process.env.FOOTBALL_DATA_API_KEY;
  } else {
    process.env.FOOTBALL_DATA_API_KEY = previousFootballDataApiKey;
  }

  if (previousGeminiApiKey === undefined) {
    delete process.env.GEMINI_API_KEY;
  } else {
    process.env.GEMINI_API_KEY = previousGeminiApiKey;
  }
});

describe("Squad Manager triage sample", () => {
  it("classifies suggestion risk buckets", () => {
    expect(
      classifySuggestionRisk({
        suggestionId: "sug-low",
        type: "player_update",
        playerId: "player-1",
        changes: { name: "Player One", age: 24, nationality: "England" }
      })
    ).toBe("low");
    expect(
      classifySuggestionRisk({
        suggestionId: "sug-medium",
        type: "player_update",
        playerId: "player-2",
        changes: { position: "CM" }
      })
    ).toBe("medium");
    expect(
      classifySuggestionRisk({
        suggestionId: "sug-add",
        type: "player_addition",
        livePlayer: { id: 1, name: "New Player", position: "Forward", nationality: "England" },
        proposed: { name: "New Player", position: "ST", nationality: "England", age: 21 }
      })
    ).toBe("high");
    expect(
      classifySuggestionRisk({
        suggestionId: "sug-remove",
        type: "player_removal",
        playerId: "player-3"
      })
    ).toBe("high");
  });

  it("captures the three sample clubs and writes review-only JSON and Markdown reports", async () => {
    testDatabase = createFc26Pl20ServerDatabase("squad-manager-triage");
    process.env.FOOTBALL_DATA_API_KEY = "football-data-key";
    process.env.GEMINI_API_KEY = "gemini-key";
    outputDir = await mkdtemp(join(tmpdir(), "squad-manager-triage-"));

    const fetchMock = vi.fn<typeof fetch>().mockImplementation((input) => {
      const teamId = Number.parseInt(String(input).split("/").at(-1) ?? "", 10);
      const mapping = Object.values(FOOTBALL_DATA_TEAMS).find(
        (candidate) => candidate.footballDataTeamId === teamId
      );
      return Promise.resolve(
        jsonResponse({
          id: teamId,
          name: mapping?.footballDataName ?? `Team ${teamId}`,
          squad: [
            {
              id: teamId * 1000 + 1,
              name: `Live Player ${teamId}`,
              position: "Forward",
              dateOfBirth: "2001-01-01",
              nationality: "England",
              shirtNumber: 9
            }
          ]
        })
      );
    });
    vi.stubGlobal("fetch", fetchMock);
    genAiMocks.generateContent
      .mockResolvedValueOnce({
        text: JSON.stringify({
          missingPlayers: [],
          suggestions: [],
          attributeWarnings: [
            {
              type: "player_update",
              playerId: "liverpool-audit-player",
              changes: { name: "Audit Player", age: 27, nationality: "England" },
              rationale: "Low-risk metadata-only update."
            }
          ]
        })
      })
      .mockResolvedValueOnce({
        text: JSON.stringify({
          missingPlayers: [
            {
              type: "player_addition",
              livePlayerId: 71001,
              rationale: "Live squad has a missing player."
            }
          ],
          suggestions: [
            {
              type: "player_removal",
              playerId: "sunderland-reserve-player",
              rationale: "Local player no longer appears in the live squad."
            }
          ],
          attributeWarnings: []
        })
      })
      .mockResolvedValueOnce({
        text: JSON.stringify({
          missingPlayers: [],
          suggestions: [
            {
              type: "player_update",
              playerId: "manchester-united-audit-player",
              changes: { position: "CM" },
              rationale: "Position changed in live evidence."
            }
          ],
          attributeWarnings: []
        })
      });
    const beforeActive = getActiveFc25DatasetVersion()?.id;
    const beforeCount = listFc25DatasetVersions().length;
    const app = buildApp();

    try {
      const { report, jsonPath, markdownPath } = await runSquadManagerTriageSample({
        app,
        outputDir,
        now: new Date("2026-05-05T08:00:00.000Z")
      });

      expect(report.sampleClubs).toEqual(["liverpool", "sunderland", "manchester-united"]);
      expect(report.summary).toMatchObject({
        clubs: 3,
        ok: 3,
        failed: 0,
        suggestions: 4,
        riskCounts: { low: 1, medium: 1, high: 2 }
      });
      expect(report.noDatasetMutation).toBe(true);
      expect(getActiveFc25DatasetVersion()?.id).toBe(beforeActive);
      expect(listFc25DatasetVersions()).toHaveLength(beforeCount);
      expect(fetchMock).toHaveBeenCalledTimes(3);
      expect(genAiMocks.generateContent).toHaveBeenCalledTimes(3);

      const json = JSON.parse(await readFile(jsonPath, "utf8")) as { mode?: string };
      const markdown = await readFile(markdownPath, "utf8");
      expect(json.mode).toBe("review-only");
      expect(markdown).toContain("No suggestions were applied");
      expect(markdown).toContain("| sunderland | ok | 2 | 0 | 0 | 2 |");
    } finally {
      await app.close();
    }
  }, 20_000);
});

function createFc26Pl20ServerDatabase(prefix: string): TestDatabase {
  const database = createServerTestDatabase(prefix);
  importFc25Dataset({
    databasePath: database.path,
    csvPath: FC26_PL20_FIXTURE_PATH,
    datasetVersionId: "fc26-pl20-base",
    name: "FC26 PL20 base",
    format: "fc26",
    clubUniverse: "pl20",
    now: new Date("2026-05-05T09:00:00.000Z")
  });
  return database;
}

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json", ...init.headers },
    ...init
  });
}
