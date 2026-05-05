export interface UatResearchOptions {
  noAi: boolean;
  liveAdmin: boolean;
  keepTemp: boolean;
  batchSize: number;
  outputDir: string;
}

export interface DirectionAssertion {
  metric: string;
  expected: "increase" | "decrease";
  baseline: number;
  variant: number;
  delta: number;
  percentChange: number | null;
  state: "pass" | "fail";
}

export interface UatReportInput {
  runId: string;
  startedAt: string;
  finishedAt: string;
  options: UatResearchOptions;
  summary: {
    state: "pass" | "fail";
    passed: number;
    failed: number;
    warnings: number;
  };
  scenarios: Array<{
    id: string;
    title: string;
    state: "pass" | "fail" | "warning";
    observations: string[];
    screenshots: string[];
  }>;
  assertions: DirectionAssertion[];
  adminApply?: {
    sourceDatasetVersionId: string;
    newDatasetVersionId: string;
    activatedDatasetVersionId: string;
    appliedSuggestionIds: string[];
    auditActor: string;
    auditRiskLevel: string;
  } | null;
  evidencePath: string;
  aiReportPath?: string | null;
}

const DEFAULT_BATCH_SIZE = 50;
const DEFAULT_OUTPUT_DIR = "docs/UAT_REPORTS";

export function parseUatResearchArgs(args: string[]): UatResearchOptions {
  const options: UatResearchOptions = {
    noAi: false,
    liveAdmin: false,
    keepTemp: false,
    batchSize: DEFAULT_BATCH_SIZE,
    outputDir: DEFAULT_OUTPUT_DIR
  };

  for (const arg of args) {
    if (arg === "--no-ai") {
      options.noAi = true;
    } else if (arg === "--live-admin") {
      options.liveAdmin = true;
    } else if (arg === "--keep-temp") {
      options.keepTemp = true;
    } else if (arg.startsWith("--batch-size=")) {
      const value = Number(arg.slice("--batch-size=".length));
      if (!Number.isInteger(value) || value < 1 || value > 100) {
        throw new Error("--batch-size must be an integer between 1 and 100");
      }
      options.batchSize = value;
    } else if (arg.startsWith("--output-dir=")) {
      const value = arg.slice("--output-dir=".length).trim();
      if (!value) {
        throw new Error("--output-dir cannot be empty");
      }
      options.outputDir = value;
    } else if (arg === "--help" || arg === "-h") {
      throw new Error(helpText());
    } else {
      throw new Error(`Unknown option '${arg}'.\n\n${helpText()}`);
    }
  }

  return options;
}

export function helpText(): string {
  return [
    "Usage: pnpm uat:research [--no-ai] [--live-admin] [--batch-size=N] [--output-dir=PATH] [--keep-temp]",
    "",
    "Defaults:",
    "  --batch-size=50",
    "  --output-dir=docs/UAT_REPORTS",
    "",
    "Safety:",
    "  Uses a disposable temp database by default.",
    "  Live football-data.org/Gemini admin verification is opt-in via --live-admin.",
    "  --keep-temp preserves temp directories for debugging and leaves cleanup to you."
  ].join("\n");
}

export function directionAssertion(input: {
  metric: string;
  expected: "increase" | "decrease";
  baseline: number;
  variant: number;
}): DirectionAssertion {
  const delta = input.variant - input.baseline;
  const percentChange =
    input.baseline === 0 ? null : Number(((delta / input.baseline) * 100).toFixed(2));
  const state =
    input.expected === "increase" ? input.variant > input.baseline : input.variant < input.baseline;

  return {
    metric: input.metric,
    expected: input.expected,
    baseline: input.baseline,
    variant: input.variant,
    delta,
    percentChange,
    state: state ? "pass" : "fail"
  };
}

export function formatSastTimestamp(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Johannesburg",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  })
    .formatToParts(date)
    .reduce<Record<string, string>>((accumulator, part) => {
      accumulator[part.type] = part.value;
      return accumulator;
    }, {});

  return `${parts.year}${parts.month}${parts.day}-${parts.hour}${parts.minute}${parts.second}-SAST`;
}

export function isExpiredTempDir(nowMs: number, mtimeMs: number, ttlHours = 24): boolean {
  return nowMs - mtimeMs > ttlHours * 60 * 60 * 1000;
}

export function buildAdminVerificationFixture() {
  return {
    verification: {
      missingPlayers: [
        {
          suggestionId: "uat-high-add-999001",
          type: "player_addition" as const,
          livePlayer: {
            id: 999001,
            name: "UAT Academy Forward",
            position: "Forward",
            dateOfBirth: "2007-05-05",
            nationality: "England",
            shirtNumber: 99
          },
          proposed: {
            name: "UAT Academy Forward",
            position: "ST" as const,
            nationality: "England",
            age: 18,
            shirtNumber: 99
          },
          rationale: "Fixture high-risk addition; review-only in UAT."
        }
      ],
      suggestions: [
        {
          suggestionId: "uat-low-nationality-203376",
          type: "player_update" as const,
          playerId: "203376",
          changes: {
            name: "Virgil van Dijk",
            nationality: "Netherlands"
          },
          rationale: "Fixture low-risk nationality correction."
        },
        {
          suggestionId: "uat-low-name-212831",
          type: "player_update" as const,
          playerId: "212831",
          changes: {
            name: "Alisson",
            nationality: "Brazil"
          },
          rationale: "Fixture low-risk display metadata correction."
        },
        {
          suggestionId: "uat-medium-position-209331",
          type: "player_update" as const,
          playerId: "209331",
          changes: {
            position: "RW" as const,
            nationality: "Egypt"
          },
          rationale: "Fixture medium-risk position change; review-only in UAT."
        }
      ],
      attributeWarnings: [
        {
          suggestionId: "uat-high-remove-999002",
          type: "player_removal" as const,
          playerId: "999002",
          rationale: "Fixture high-risk removal; review-only in UAT."
        }
      ]
    },
    cacheStatus: "hit" as const,
    apiQuotaRemaining: { minute: 10, day: 10 }
  };
}

export function renderDeterministicReport(input: UatReportInput): string {
  const lines = [
    `# FootSim UAT Research Report ${input.runId}`,
    "",
    `Started: ${input.startedAt}`,
    `Finished: ${input.finishedAt}`,
    `State: ${input.summary.state.toUpperCase()}`,
    `Evidence JSON: ${input.evidencePath}`,
    input.aiReportPath ? `Gemini report: ${input.aiReportPath}` : "Gemini report: not requested",
    "",
    "## Run Configuration",
    "",
    `- Batch size: ${input.options.batchSize}`,
    `- AI interpretation: ${input.options.noAi ? "off (--no-ai)" : "on"}`,
    `- Admin verification: ${input.options.liveAdmin ? "live APIs" : "fixture"}`,
    `- Temp retention: ${input.options.keepTemp ? "kept for debugging" : "cleaned on success/failure"}`,
    "",
    "## Summary",
    "",
    `- Passed: ${input.summary.passed}`,
    `- Failed: ${input.summary.failed}`,
    `- Warnings: ${input.summary.warnings}`,
    "",
    "## Scenarios",
    ""
  ];

  for (const scenario of input.scenarios) {
    lines.push(`### ${scenario.title}`, "");
    lines.push(`State: ${scenario.state.toUpperCase()}`, "");
    for (const observation of scenario.observations) {
      lines.push(`- ${observation}`);
    }
    for (const screenshot of scenario.screenshots) {
      lines.push(`- Screenshot: ${screenshot}`);
    }
    lines.push("");
  }

  lines.push("## Direction-Only Assertions", "");
  for (const assertion of input.assertions) {
    const percent =
      assertion.percentChange === null ? "n/a" : `${assertion.percentChange.toFixed(2)}%`;
    lines.push(
      `- ${assertion.metric}: ${assertion.state.toUpperCase()} (${assertion.baseline} -> ${assertion.variant}, delta ${assertion.delta}, ${percent})`
    );
  }

  if (input.adminApply) {
    lines.push(
      "",
      "## Admin Apply Validation",
      "",
      `- Source dataset: ${input.adminApply.sourceDatasetVersionId}`,
      `- New inactive dataset: ${input.adminApply.newDatasetVersionId}`,
      `- Activated dataset: ${input.adminApply.activatedDatasetVersionId}`,
      `- Applied suggestions: ${input.adminApply.appliedSuggestionIds.join(", ")}`,
      `- Audit actor: ${input.adminApply.auditActor}`,
      `- Audit risk level: ${input.adminApply.auditRiskLevel}`
    );
  }

  lines.push("");
  return `${lines.join("\n")}\n`;
}

export function buildGeminiUatPrompt(evidenceJson: string): string {
  return [
    "You are authoring a concise UAT research report for the FootSim workbench.",
    "Use only the structured evidence JSON below, the scenario expectations in this prompt, and the calibration anchors listed here. Do not infer repository state or hidden files.",
    "",
    "Scenario expectations:",
    "- Dashboard should expose active PL20 dataset health and recent-run context.",
    "- Run, replay, compare, and batch surfaces should load using stable data-uat selectors.",
    "- Tactical contrast assertions are direction-only; magnitude is context, not a pass/fail threshold.",
    "- Squad Manager admin flow must preserve review mode by default, then explicitly toggle review mode off before low-risk apply.",
    "- Low-risk apply should create a new dataset version with audit metadata, and activation should be a separate explicit step.",
    "",
    "Calibration anchors:",
    "- Phase 14b pressing/tempo work expected more aggressive tactics to raise foul pressure directionally.",
    "- PL20 UAT fixture should be re-imported from CSV each run for correctness.",
    "- Evidence JSON is the source of truth; this report is interpretation.",
    "",
    "Evidence JSON:",
    evidenceJson
  ].join("\n");
}
