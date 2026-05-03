import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

import { REPO_ROOT, resolveRepoPath } from "../paths";

type BaselineStatus = "PASS" | "FAIL" | "DIAGNOSTIC";

interface BaselineDocument {
  schemaVersion: 1;
  generatedAt: string;
  precisionTiers: Record<
    string,
    {
      seeds: number;
      analysis: string;
      useFor: string[];
    }
  >;
  characterisation: CharacterisationRow[];
  responsiveness: {
    csvPath: string;
    experiments: ExperimentRow[];
    manualXiPhase9: ExperimentRow & {
      pairedGoalDeltaAverage: number;
      pairedGoalDeltaStandardError: number;
      deltaStandardErrorPct: number;
      confidenceInterval95Pct: [number, number];
      source: string;
    };
  };
  anomalies: string[];
}

interface CharacterisationRow {
  id: string;
  duration: string;
  schema: string;
  preferredFootMode: string;
  seeds: number;
  metrics: MetricSet;
  targets: Record<keyof MetricSet, [number, number]>;
  setPieces: Record<string, number>;
  scoreDistribution: Array<{ score: string; count: number; sharePct: number }>;
  pass: boolean;
}

interface ExperimentRow {
  name: string;
  metric: string;
  tier: string;
  seeds: number;
  baselineLabel: string;
  variantLabel: string;
  baselineAverage: number | null;
  variantAverage: number | null;
  deltaPct: number | null;
  thresholdPct: number | null;
  status: BaselineStatus;
}

interface MetricSet {
  shots: number;
  goals: number;
  fouls: number;
  cards: number;
}

const DEFAULT_DOC_PATH = "docs/CALIBRATION_BASELINE_PHASE_8.md";
const JSON_START = "<!-- phase8-baseline-json:start -->";
const JSON_END = "<!-- phase8-baseline-json:end -->";
const NUMERIC_TOLERANCE = 0.015;

const options = parseArgs(process.argv.slice(2));
const baseline = readBaseline(options.docPath);
validateBaselineSchema(baseline);

if (!options.schemaOnly) {
  verifyCharacterisation(baseline);
}

console.log(
  `Phase 8 baseline verifier passed (${options.schemaOnly ? "schema only" : "schema + characterisation"}).`
);

function parseArgs(args: string[]): { docPath: string; schemaOnly: boolean } {
  const options = { docPath: DEFAULT_DOC_PATH, schemaOnly: false };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]!;
    const next = args[index + 1];
    if (arg === "--schema-only") {
      options.schemaOnly = true;
    } else if (arg === "--doc" && next) {
      options.docPath = next;
      index += 1;
    } else if (arg === "--") {
      continue;
    } else {
      throw new Error(`Unknown or incomplete option '${arg}'`);
    }
  }
  return options;
}

function readBaseline(docPath: string): BaselineDocument {
  const contents = readFileSync(resolveRepoPath(docPath), "utf8");
  const start = contents.indexOf(JSON_START);
  const end = contents.indexOf(JSON_END);
  if (start === -1 || end === -1 || end <= start) {
    throw new Error(`Could not find Phase 8 baseline JSON markers in ${docPath}`);
  }
  const markedBlock = contents.slice(start + JSON_START.length, end);
  const match = /```json\s*([\s\S]*?)\s*```/.exec(markedBlock);
  if (!match) {
    throw new Error(`Could not find fenced JSON block between Phase 8 baseline markers`);
  }
  return JSON.parse(match[1]!) as BaselineDocument;
}

function validateBaselineSchema(baseline: BaselineDocument): void {
  assert(baseline.schemaVersion === 1, "schemaVersion must be 1");
  assertString(baseline.generatedAt, "generatedAt");
  assertObject(baseline.precisionTiers, "precisionTiers");
  assertArray(baseline.characterisation, "characterisation");
  assertObject(baseline.responsiveness, "responsiveness");
  assertArray(baseline.responsiveness.experiments, "responsiveness.experiments");
  assertObject(baseline.responsiveness.manualXiPhase9, "responsiveness.manualXiPhase9");
  assertArray(baseline.anomalies, "anomalies");

  for (const [tierName, tier] of Object.entries(baseline.precisionTiers)) {
    assertString(tierName, "precision tier name");
    assertInteger(tier.seeds, `${tierName}.seeds`);
    assertString(tier.analysis, `${tierName}.analysis`);
    assertArray(tier.useFor, `${tierName}.useFor`);
  }

  for (const row of baseline.characterisation) {
    assertString(row.id, "characterisation.id");
    assertString(row.duration, `${row.id}.duration`);
    assertString(row.schema, `${row.id}.schema`);
    assertString(row.preferredFootMode, `${row.id}.preferredFootMode`);
    assertInteger(row.seeds, `${row.id}.seeds`);
    validateMetricSet(row.metrics, `${row.id}.metrics`);
    assertObject(row.targets, `${row.id}.targets`);
    for (const key of ["shots", "goals", "fouls", "cards"] as const) {
      const target = row.targets[key];
      assert(
        Array.isArray(target) && target.length === 2 && target.every((value) => typeof value === "number"),
        `${row.id}.targets.${key} must be a [min, max] number pair`
      );
    }
    assertObject(row.setPieces, `${row.id}.setPieces`);
    assertArray(row.scoreDistribution, `${row.id}.scoreDistribution`);
    assert(typeof row.pass === "boolean", `${row.id}.pass must be boolean`);
  }

  for (const experiment of [
    ...baseline.responsiveness.experiments,
    baseline.responsiveness.manualXiPhase9
  ]) {
    assertString(experiment.name, "experiment.name");
    assertString(experiment.metric, `${experiment.name}.metric`);
    assertString(experiment.tier, `${experiment.name}.tier`);
    assertInteger(experiment.seeds, `${experiment.name}.seeds`);
    assertString(experiment.baselineLabel, `${experiment.name}.baselineLabel`);
    assertString(experiment.variantLabel, `${experiment.name}.variantLabel`);
    assertNullableNumber(experiment.baselineAverage, `${experiment.name}.baselineAverage`);
    assertNullableNumber(experiment.variantAverage, `${experiment.name}.variantAverage`);
    assertNullableNumber(experiment.deltaPct, `${experiment.name}.deltaPct`);
    assertNullableNumber(experiment.thresholdPct, `${experiment.name}.thresholdPct`);
    assert(
      ["PASS", "FAIL", "DIAGNOSTIC"].includes(experiment.status),
      `${experiment.name}.status must be PASS, FAIL, or DIAGNOSTIC`
    );
  }
}

function verifyCharacterisation(baseline: BaselineDocument): void {
  for (const row of baseline.characterisation) {
    const output = execFileSync(
      "pnpm",
      [
        "--filter",
        "@the-ataturk/match-engine",
        "characterise",
        "--",
        "--schema",
        row.schema,
        "--preferred-foot-mode",
        row.preferredFootMode,
        "--duration",
        row.duration,
        "--seeds",
        String(row.seeds)
      ],
      { cwd: REPO_ROOT, encoding: "utf8" }
    );
    const actual = parseCharacterisationOutput(output);
    assertMetricClose(actual.shots, row.metrics.shots, `${row.id}.shots`);
    assertMetricClose(actual.goals, row.metrics.goals, `${row.id}.goals`);
    assertMetricClose(actual.fouls, row.metrics.fouls, `${row.id}.fouls`);
    assertMetricClose(actual.cards, row.metrics.cards, `${row.id}.cards`);
  }
}

function parseCharacterisationOutput(output: string): MetricSet {
  const metric = (name: keyof MetricSet): number => {
    const match = new RegExp(`${capitalise(name)}: ([0-9.]+)`).exec(output);
    if (!match) {
      throw new Error(`Could not parse ${name} from characterisation output`);
    }
    return Number(match[1]);
  };
  return {
    shots: metric("shots"),
    goals: metric("goals"),
    fouls: metric("fouls"),
    cards: metric("cards")
  };
}

function validateMetricSet(metrics: MetricSet, label: string): void {
  assertNumber(metrics.shots, `${label}.shots`);
  assertNumber(metrics.goals, `${label}.goals`);
  assertNumber(metrics.fouls, `${label}.fouls`);
  assertNumber(metrics.cards, `${label}.cards`);
}

function assertMetricClose(actual: number, expected: number, label: string): void {
  assert(
    Math.abs(actual - expected) <= NUMERIC_TOLERANCE,
    `${label} drifted: expected ${expected}, got ${actual}`
  );
}

function capitalise(value: string): string {
  return `${value[0]!.toUpperCase()}${value.slice(1)}`;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function assertObject(value: unknown, label: string): asserts value is Record<string, unknown> {
  assert(value !== null && typeof value === "object" && !Array.isArray(value), `${label} must be object`);
}

function assertArray(value: unknown, label: string): asserts value is unknown[] {
  assert(Array.isArray(value), `${label} must be array`);
}

function assertString(value: unknown, label: string): asserts value is string {
  assert(typeof value === "string" && value.length > 0, `${label} must be non-empty string`);
}

function assertNumber(value: unknown, label: string): asserts value is number {
  assert(typeof value === "number" && Number.isFinite(value), `${label} must be finite number`);
}

function assertNullableNumber(value: unknown, label: string): asserts value is number | null {
  assert(value === null || (typeof value === "number" && Number.isFinite(value)), `${label} must be finite number or null`);
}

function assertInteger(value: unknown, label: string): asserts value is number {
  assert(Number.isInteger(value), `${label} must be integer`);
}
