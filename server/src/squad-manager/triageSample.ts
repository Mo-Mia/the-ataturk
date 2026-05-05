import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import {
  getActiveFc25DatasetVersion,
  listFc25DatasetVersions,
  type Fc25ClubId,
  type SquadManagerSuggestion
} from "@the-ataturk/data";
import type { FastifyInstance } from "fastify";

export const DEFAULT_TRIAGE_SAMPLE_CLUBS: Fc25ClubId[] = [
  "liverpool",
  "sunderland",
  "manchester-united"
];
export const TRIAGE_REPORT_DATE = "2026-05-05";
export const TRIAGE_REPORT_BASENAME = `SQUAD_MANAGER_TRIAGE_PL20_SAMPLE_${TRIAGE_REPORT_DATE}`;

export type SuggestionRiskBucket = "low" | "medium" | "high";

export interface TriageSuggestionRecord {
  sourceClass: "missingPlayers" | "suggestions" | "attributeWarnings";
  risk: SuggestionRiskBucket;
  suggestion: SquadManagerSuggestion;
}

export interface TriageClubResult {
  clubId: Fc25ClubId;
  status: "ok" | "failed";
  cacheStatus?: string;
  apiQuotaRemaining?: { minute: number; day: number };
  suggestions: TriageSuggestionRecord[];
  riskCounts: Record<SuggestionRiskBucket, number>;
  error?: string;
}

export interface TriageSampleReport {
  schemaVersion: 1;
  generatedAt: string;
  mode: "review-only";
  sampleClubs: Fc25ClubId[];
  datasetBefore: DatasetMutationSnapshot;
  datasetAfter: DatasetMutationSnapshot;
  noDatasetMutation: boolean;
  summary: {
    clubs: number;
    ok: number;
    failed: number;
    suggestions: number;
    riskCounts: Record<SuggestionRiskBucket, number>;
  };
  clubs: TriageClubResult[];
}

interface DatasetMutationSnapshot {
  activeDatasetVersionId: string | null;
  datasetVersionCount: number;
}

interface VerifySquadResponse {
  verification: {
    missingPlayers: SquadManagerSuggestion[];
    suggestions: SquadManagerSuggestion[];
    attributeWarnings: SquadManagerSuggestion[];
  };
  cacheStatus: string;
  apiQuotaRemaining: { minute: number; day: number };
}

interface ErrorResponse {
  error?: string;
}

/**
 * Run the review-only Squad Manager triage sample and write JSON/Markdown evidence.
 *
 * @param input Fastify app, output directory, optional sample clubs, and optional clock.
 * @returns Report payload and written file paths.
 * @throws Error when the triage path mutates active dataset metadata.
 */
export async function runSquadManagerTriageSample(input: {
  app: FastifyInstance;
  outputDir: string;
  clubs?: Fc25ClubId[];
  now?: Date;
}): Promise<{ report: TriageSampleReport; jsonPath: string; markdownPath: string }> {
  const clubs = input.clubs ?? DEFAULT_TRIAGE_SAMPLE_CLUBS;
  const before = datasetMutationSnapshot();
  const results: TriageClubResult[] = [];

  for (const clubId of clubs) {
    results.push(await verifyClub(input.app, clubId, before.activeDatasetVersionId));
  }

  const after = datasetMutationSnapshot();
  const report = buildTriageReport({
    generatedAt: (input.now ?? new Date()).toISOString(),
    clubs,
    results,
    before,
    after
  });

  await mkdir(input.outputDir, { recursive: true });
  const jsonPath = join(input.outputDir, `${TRIAGE_REPORT_BASENAME}.json`);
  const markdownPath = join(input.outputDir, `${TRIAGE_REPORT_BASENAME}.md`);
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await writeFile(markdownPath, renderMarkdownReport(report), "utf8");

  if (!report.noDatasetMutation) {
    throw new Error("Squad Manager triage mutated the active dataset metadata");
  }

  return { report, jsonPath, markdownPath };
}

/**
 * Classify a Squad Manager suggestion into the sprint risk buckets.
 *
 * @param suggestion Suggestion emitted by the verification route.
 * @returns Low for name/age/nationality updates, medium for position updates, high for additions/removals.
 */
export function classifySuggestionRisk(suggestion: SquadManagerSuggestion): SuggestionRiskBucket {
  if (suggestion.type === "player_addition" || suggestion.type === "player_removal") {
    return "high";
  }

  if (suggestion.changes.position !== undefined) {
    return "medium";
  }

  return "low";
}

function buildTriageReport(input: {
  generatedAt: string;
  clubs: Fc25ClubId[];
  results: TriageClubResult[];
  before: DatasetMutationSnapshot;
  after: DatasetMutationSnapshot;
}): TriageSampleReport {
  const riskCounts = emptyRiskCounts();
  let suggestions = 0;

  for (const club of input.results) {
    suggestions += club.suggestions.length;
    for (const [risk, count] of Object.entries(club.riskCounts)) {
      riskCounts[risk as SuggestionRiskBucket] += count;
    }
  }

  const failed = input.results.filter((result) => result.status === "failed").length;

  return {
    schemaVersion: 1,
    generatedAt: input.generatedAt,
    mode: "review-only",
    sampleClubs: input.clubs,
    datasetBefore: input.before,
    datasetAfter: input.after,
    noDatasetMutation:
      input.before.activeDatasetVersionId === input.after.activeDatasetVersionId &&
      input.before.datasetVersionCount === input.after.datasetVersionCount,
    summary: {
      clubs: input.results.length,
      ok: input.results.length - failed,
      failed,
      suggestions,
      riskCounts
    },
    clubs: input.results
  };
}

async function verifyClub(
  app: FastifyInstance,
  clubId: Fc25ClubId,
  datasetVersionId: string | null
): Promise<TriageClubResult> {
  const response = await app.inject({
    method: "POST",
    url: "/api/ai/verify-squad",
    payload: datasetVersionId ? { clubId, datasetVersionId } : { clubId }
  });

  if (response.statusCode !== 200) {
    let error = `HTTP ${response.statusCode}`;
    try {
      error = response.json<ErrorResponse>().error ?? error;
    } catch {
      // Keep the status fallback for non-JSON errors.
    }
    return {
      clubId,
      status: "failed",
      suggestions: [],
      riskCounts: emptyRiskCounts(),
      error
    };
  }

  const body = response.json<VerifySquadResponse>();
  const suggestions = flattenSuggestions(body.verification);

  return {
    clubId,
    status: "ok",
    cacheStatus: body.cacheStatus,
    apiQuotaRemaining: body.apiQuotaRemaining,
    suggestions,
    riskCounts: riskCountsFor(suggestions)
  };
}

function flattenSuggestions(
  verification: VerifySquadResponse["verification"]
): TriageSuggestionRecord[] {
  return [
    ...verification.missingPlayers.map((suggestion) => ({
      sourceClass: "missingPlayers" as const,
      risk: classifySuggestionRisk(suggestion),
      suggestion
    })),
    ...verification.suggestions.map((suggestion) => ({
      sourceClass: "suggestions" as const,
      risk: classifySuggestionRisk(suggestion),
      suggestion
    })),
    ...verification.attributeWarnings.map((suggestion) => ({
      sourceClass: "attributeWarnings" as const,
      risk: classifySuggestionRisk(suggestion),
      suggestion
    }))
  ];
}

function riskCountsFor(
  suggestions: TriageSuggestionRecord[]
): Record<SuggestionRiskBucket, number> {
  const counts = emptyRiskCounts();
  for (const suggestion of suggestions) {
    counts[suggestion.risk] += 1;
  }
  return counts;
}

function emptyRiskCounts(): Record<SuggestionRiskBucket, number> {
  return { low: 0, medium: 0, high: 0 };
}

function datasetMutationSnapshot(): DatasetMutationSnapshot {
  return {
    activeDatasetVersionId: getActiveFc25DatasetVersion()?.id ?? null,
    datasetVersionCount: listFc25DatasetVersions().length
  };
}

function renderMarkdownReport(report: TriageSampleReport): string {
  const lines = [
    `# Squad Manager PL20 Sample Triage - ${TRIAGE_REPORT_DATE}`,
    "",
    "Mode: review-only. No suggestions were applied and no dataset version was activated.",
    "",
    "## Dataset Mutation Check",
    "",
    `- Active before: ${report.datasetBefore.activeDatasetVersionId ?? "none"}`,
    `- Active after: ${report.datasetAfter.activeDatasetVersionId ?? "none"}`,
    `- Dataset versions before: ${report.datasetBefore.datasetVersionCount}`,
    `- Dataset versions after: ${report.datasetAfter.datasetVersionCount}`,
    `- No dataset mutation: ${report.noDatasetMutation ? "yes" : "no"}`,
    "",
    "## Summary",
    "",
    `- Clubs sampled: ${report.sampleClubs.join(", ")}`,
    `- Clubs ok: ${report.summary.ok}/${report.summary.clubs}`,
    `- Suggestions captured: ${report.summary.suggestions}`,
    `- Risk counts: low ${report.summary.riskCounts.low}, medium ${report.summary.riskCounts.medium}, high ${report.summary.riskCounts.high}`,
    "",
    "## Club Results",
    "",
    "| Club | Status | Suggestions | Low | Medium | High | Cache | Quota |",
    "| --- | --- | ---: | ---: | ---: | ---: | --- | --- |"
  ];

  for (const club of report.clubs) {
    const quota = club.apiQuotaRemaining
      ? `${club.apiQuotaRemaining.minute}/min, ${club.apiQuotaRemaining.day}/day`
      : "";
    lines.push(
      `| ${club.clubId} | ${club.status}${club.error ? `: ${club.error}` : ""} | ${club.suggestions.length} | ${club.riskCounts.low} | ${club.riskCounts.medium} | ${club.riskCounts.high} | ${club.cacheStatus ?? ""} | ${quota} |`
    );
  }

  lines.push("", "## Suggestion Evidence", "");

  for (const club of report.clubs) {
    lines.push(`### ${club.clubId}`, "");
    if (club.suggestions.length === 0) {
      lines.push("No suggestions.", "");
      continue;
    }

    for (const record of club.suggestions) {
      lines.push(
        `- ${record.risk} / ${record.sourceClass} / ${record.suggestion.type}: ${suggestionLabel(
          record.suggestion
        )}`
      );
    }
    lines.push("");
  }

  return `${lines.join("\n")}\n`;
}

function suggestionLabel(suggestion: SquadManagerSuggestion): string {
  if (suggestion.type === "player_addition") {
    return `add ${suggestion.proposed.name} (${suggestion.proposed.position})`;
  }
  if (suggestion.type === "player_removal") {
    return `remove ${suggestion.playerId}`;
  }
  return `update ${suggestion.playerId} [${Object.keys(suggestion.changes).join(", ")}]`;
}
