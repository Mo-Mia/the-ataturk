import { chromium, type Browser, type Page } from "@playwright/test";
import react from "@vitejs/plugin-react";
import { closeDb, importFc25Dataset, migrate, seed } from "../packages/data/src/index";
import { buildApp } from "../server/src/app";
import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";
import { createServer, type ViteDevServer } from "vite";

import {
  buildAdminVerificationFixture,
  buildGeminiUatPrompt,
  directionAssertion,
  formatSastTimestamp,
  isExpiredTempDir,
  parseUatResearchArgs,
  renderDeterministicReport,
  type DirectionAssertion,
  type UatReportInput,
  type UatResearchOptions
} from "./uatResearchSupport";

type ScenarioState = "pass" | "fail" | "warning";

interface ScenarioEvidence {
  id: string;
  title: string;
  state: ScenarioState;
  observations: string[];
  screenshots: string[];
}

interface SimRun {
  id: string;
  seed: number;
  batchId: string | null;
  artefactId: string;
  summary: {
    score: { home: number; away: number };
    shots: { home: number; away: number };
    fouls: { home: number; away: number };
    cards: { home: number; away: number };
    possession: { home: number; away: number };
    xi: {
      home: Array<{ id: string; name: string; position: string }>;
      away: Array<{ id: string; name: string; position: string }>;
    };
  };
}

interface SimResponse {
  runs: SimRun[];
  errors: Array<{ seed: number; error: string }>;
}

interface UatEvidence {
  runId: string;
  startedAt: string;
  finishedAt: string | null;
  options: UatResearchOptions;
  environment: {
    tempDir: string;
    databasePath: string;
    serverUrl: string;
    webUrl: string;
    fixtureSource: string;
    importedDatasetVersionId: string;
  };
  scenarios: ScenarioEvidence[];
  assertions: DirectionAssertion[];
  adminApply: UatReportInput["adminApply"];
  summary: UatReportInput["summary"] | null;
  consoleIssues: Array<{ type: string; text: string }>;
  createdRunIds: string[];
}

const REPO_ROOT = path.resolve(import.meta.dirname, "..");
const WEB_ROOT = path.join(REPO_ROOT, "apps/web");
const FC26_CSV = path.join(REPO_ROOT, "data/fc-25/FC26_20250921.csv");
const TEMP_ROOT = path.join(tmpdir(), "the-ataturk-uat");
const IMPORTED_DATASET_VERSION_ID = "uat-fc26-pl20";

const DEFAULT_TACTICS = {
  formation: "4-4-2",
  mentality: "balanced",
  tempo: "normal",
  pressing: "medium",
  lineHeight: "normal",
  width: "normal"
};

async function main(): Promise<void> {
  const options = parseUatResearchArgs(process.argv.slice(2));
  const runStamp = formatSastTimestamp();
  const runId = `UAT_RESEARCH_${runStamp}`;
  const outputDir = path.resolve(REPO_ROOT, options.outputDir);
  const assetsDir = path.join(outputDir, `${runId}_assets`);
  const evidencePath = path.join(outputDir, `${runId}.json`);
  const reportPath = path.join(outputDir, `${runId}.md`);
  const aiReportPath = path.join(outputDir, `${runId}_GEMINI.md`);
  const tempDir = path.join(TEMP_ROOT, `research-${runStamp}-${process.pid}-${randomUUID()}`);
  const databasePath = path.join(tempDir, "uat.sqlite");
  const startedAt = new Date().toISOString();
  const previousDatabaseUrl = process.env.DATABASE_URL;
  const previousLogLevel = process.env.LOG_LEVEL;
  let app: Awaited<ReturnType<typeof buildApp>> | null = null;
  let vite: ViteDevServer | null = null;
  let browser: Browser | null = null;
  let evidence: UatEvidence | null = null;

  await pruneOldTempDirs();
  await fs.mkdir(assetsDir, { recursive: true });
  await fs.mkdir(tempDir, { recursive: true });

  try {
    process.env.DATABASE_URL = databasePath;
    process.env.LOG_LEVEL = process.env.LOG_LEVEL ?? "warn";
    closeDb();

    migrate({ databasePath });
    seed({ databasePath });
    const imported = importFc25Dataset({
      databasePath,
      csvPath: FC26_CSV,
      datasetVersionId: IMPORTED_DATASET_VERSION_ID,
      name: "UAT FC26 PL20",
      format: "fc26",
      clubUniverse: "pl20",
      now: new Date("2026-05-05T08:00:00.000Z")
    });

    app = buildApp();
    await app.listen({ host: "127.0.0.1", port: 0 });
    const address = app.server.address() as AddressInfo;
    const serverUrl = `http://127.0.0.1:${address.port}`;

    vite = await createServer({
      configFile: false,
      root: WEB_ROOT,
      plugins: [react()],
      server: {
        host: "127.0.0.1",
        port: 0,
        strictPort: false,
        proxy: {
          "/api": serverUrl
        }
      },
      appType: "spa"
    });
    await vite.listen();
    const viteAddress = vite.httpServer?.address() as AddressInfo;
    const webUrl = `http://127.0.0.1:${viteAddress.port}`;

    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1440, height: 980 } });
    const page = await context.newPage();
    page.setDefaultTimeout(60_000);

    if (!options.liveAdmin) {
      await page.route("**/api/ai/verify-squad", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(buildAdminVerificationFixture())
        });
      });
    }

    evidence = {
      runId,
      startedAt,
      finishedAt: null,
      options,
      environment: {
        tempDir,
        databasePath,
        serverUrl,
        webUrl,
        fixtureSource: FC26_CSV,
        importedDatasetVersionId: imported.datasetVersionId
      },
      scenarios: [],
      assertions: [],
      adminApply: null,
      summary: null,
      consoleIssues: [],
      createdRunIds: []
    };

    page.on("console", (message) => {
      if (message.type() === "error" || message.type() === "warning") {
        evidence?.consoleIssues.push({ type: message.type(), text: message.text() });
      }
    });
    page.on("pageerror", (error) => {
      evidence?.consoleIssues.push({ type: "pageerror", text: error.message });
    });

    await runDashboardScenario(page, webUrl, assetsDir, evidence);
    const baseline = await runReplayScenario(page, webUrl, assetsDir, evidence);
    await runTacticalContrastScenario(page, evidence);
    await runFormationCompareScenario(page, webUrl, assetsDir, evidence, baseline);
    await runBatchScenario(page, webUrl, assetsDir, evidence, options.batchSize);
    await runAdminScenario(page, webUrl, assetsDir, evidence);

    evidence.finishedAt = new Date().toISOString();
    const summary = summarise(evidence);
    evidence.summary = summary;
    const reportInput: UatReportInput = {
      runId,
      startedAt: evidence.startedAt,
      finishedAt: evidence.finishedAt,
      options,
      summary,
      scenarios: evidence.scenarios,
      assertions: evidence.assertions,
      adminApply: evidence.adminApply,
      evidencePath: path.relative(REPO_ROOT, evidencePath),
      aiReportPath: options.noAi ? null : path.relative(REPO_ROOT, aiReportPath)
    };

    await fs.writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
    await fs.writeFile(reportPath, renderDeterministicReport(reportInput), "utf8");

    if (!options.noAi) {
      await writeGeminiReport(evidencePath, aiReportPath);
    }

    await cleanupCreatedRuns(page, evidence.createdRunIds);

    if (summary.state === "fail") {
      throw new Error(`UAT research run failed; see ${path.relative(REPO_ROOT, reportPath)}`);
    }

    console.log(`UAT research evidence: ${path.relative(REPO_ROOT, evidencePath)}`);
    console.log(`UAT research report: ${path.relative(REPO_ROOT, reportPath)}`);
  } finally {
    if (evidence) {
      await cleanupCreatedRunsSafe(evidence.environment.webUrl, evidence.createdRunIds);
    }
    await browser?.close().catch(() => undefined);
    await vite?.close().catch(() => undefined);
    await app?.close().catch(() => undefined);
    closeDb();
    if (!options.keepTemp) {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
    if (previousDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = previousDatabaseUrl;
    }
    if (previousLogLevel === undefined) {
      delete process.env.LOG_LEVEL;
    } else {
      process.env.LOG_LEVEL = previousLogLevel;
    }
  }
}

async function runDashboardScenario(
  page: Page,
  webUrl: string,
  assetsDir: string,
  evidence: UatEvidence
): Promise<void> {
  await page.goto(`${webUrl}/`);
  await page.waitForSelector('[data-uat="dashboard-page"]');
  await page.waitForSelector('[data-uat="dashboard-widget-active-dataset"][data-state="ready"]');
  const datasetId = await page
    .locator('[data-uat="dashboard-widget-active-dataset"]')
    .getAttribute("data-dataset-version-id");
  const clubs = await page
    .locator('[data-uat="active-dataset-club-count"]')
    .getAttribute("data-value");
  const players = await page
    .locator('[data-uat="active-dataset-player-count"]')
    .getAttribute("data-value");
  const screenshotPath = await screenshot(page, assetsDir, "dashboard");

  evidence.scenarios.push({
    id: "dashboard",
    title: "Dashboard Active Dataset",
    state: datasetId === IMPORTED_DATASET_VERSION_ID ? "pass" : "fail",
    observations: [
      `Active dataset selector reported ${datasetId ?? "missing"}.`,
      `PL20 fixture exposed ${clubs ?? "unknown"} clubs and ${players ?? "unknown"} players.`
    ],
    screenshots: [screenshotPath]
  });
}

async function runReplayScenario(
  page: Page,
  webUrl: string,
  assetsDir: string,
  evidence: UatEvidence
): Promise<SimRun> {
  await page.goto(`${webUrl}/visualise/run`);
  await page.waitForSelector('[data-uat="sim-runner-page"]');
  const response = await simulate(page, {
    home: { clubId: "liverpool", tactics: { ...DEFAULT_TACTICS, formation: "4-3-3" } },
    away: { clubId: "manchester-city", tactics: { ...DEFAULT_TACTICS, formation: "4-3-3" } },
    seed: 260501,
    batch: 1,
    duration: "full_90",
    autoSubs: true
  });
  const run = requireSingleRun(response, "baseline replay");
  evidence.createdRunIds.push(run.id);

  await page.goto(`${webUrl}/visualise?artifact=${encodeURIComponent(run.artefactId)}`);
  await page.waitForSelector('[data-uat="snapshot-replay-page"][data-state="ready"]');
  const screenshotPath = await screenshot(page, assetsDir, "replay");

  evidence.scenarios.push({
    id: "replay",
    title: "Run And Replay",
    state: "pass",
    observations: [
      `Created run ${run.id} with seed ${run.seed}.`,
      `Replay loaded artefact ${run.artefactId}.`,
      `Score ${run.summary.score.home}-${run.summary.score.away}; shots ${run.summary.shots.home}-${run.summary.shots.away}; fouls ${run.summary.fouls.home}-${run.summary.fouls.away}.`
    ],
    screenshots: [screenshotPath]
  });

  return run;
}

async function runTacticalContrastScenario(page: Page, evidence: UatEvidence): Promise<void> {
  const baseline = requireSingleRun(
    await simulate(page, {
      home: {
        clubId: "liverpool",
        tactics: { ...DEFAULT_TACTICS, pressing: "low", tempo: "slow" }
      },
      away: { clubId: "manchester-city", tactics: DEFAULT_TACTICS },
      seed: 260502,
      batch: 1,
      duration: "full_90",
      autoSubs: true
    }),
    "tactical baseline"
  );
  const aggressive = requireSingleRun(
    await simulate(page, {
      home: {
        clubId: "liverpool",
        tactics: {
          ...DEFAULT_TACTICS,
          mentality: "attacking",
          pressing: "high",
          tempo: "fast",
          lineHeight: "high"
        }
      },
      away: { clubId: "manchester-city", tactics: DEFAULT_TACTICS },
      seed: 260502,
      batch: 1,
      duration: "full_90",
      autoSubs: true
    }),
    "tactical aggressive"
  );
  evidence.createdRunIds.push(baseline.id, aggressive.id);

  const baselineFouls = baseline.summary.fouls.home + baseline.summary.fouls.away;
  const aggressiveFouls = aggressive.summary.fouls.home + aggressive.summary.fouls.away;
  const assertion = directionAssertion({
    metric: "same-seed high pressing and fast tempo total fouls",
    expected: "increase",
    baseline: baselineFouls,
    variant: aggressiveFouls
  });
  evidence.assertions.push(assertion);

  evidence.scenarios.push({
    id: "tactical-contrast",
    title: "Tactical Contrast",
    state: assertion.state,
    observations: [
      `Compared same teams and seed ${baseline.seed}.`,
      `Low pressing/slow tempo fouls: ${baselineFouls}.`,
      `High pressing/fast tempo fouls: ${aggressiveFouls}.`,
      "Assertion is direction-only; magnitude is retained as context."
    ],
    screenshots: []
  });
}

async function runFormationCompareScenario(
  page: Page,
  webUrl: string,
  assetsDir: string,
  evidence: UatEvidence,
  baseline: SimRun
): Promise<void> {
  const alternate = requireSingleRun(
    await simulate(page, {
      home: { clubId: "liverpool", tactics: { ...DEFAULT_TACTICS, formation: "4-2-3-1" } },
      away: { clubId: "manchester-city", tactics: { ...DEFAULT_TACTICS, formation: "4-4-2" } },
      seed: 260503,
      batch: 1,
      duration: "full_90",
      autoSubs: true
    }),
    "formation alternate"
  );
  evidence.createdRunIds.push(alternate.id);
  await page.goto(`${webUrl}/visualise/compare?a=${baseline.id}&b=${alternate.id}`);
  await page.waitForSelector('[data-uat="compare-page"][data-state="idle"]');
  await page.waitForSelector('[data-uat="compare-summary"]');
  const screenshotPath = await screenshot(page, assetsDir, "compare");
  const changedXi =
    baseline.summary.xi.home.map((player) => player.id).join(",") !==
    alternate.summary.xi.home.map((player) => player.id).join(",");

  evidence.scenarios.push({
    id: "formation-compare",
    title: "Formation Compare",
    state: changedXi ? "pass" : "warning",
    observations: [
      `Compared run ${baseline.id} with run ${alternate.id}.`,
      `Home XI changed: ${changedXi ? "yes" : "no"}.`,
      "Compare page loaded the line-up and summary surfaces."
    ],
    screenshots: [screenshotPath]
  });
}

async function runBatchScenario(
  page: Page,
  webUrl: string,
  assetsDir: string,
  evidence: UatEvidence,
  batchSize: number
): Promise<void> {
  const response = await simulate(page, {
    home: { clubId: "liverpool", tactics: { ...DEFAULT_TACTICS, formation: "4-3-3" } },
    away: { clubId: "arsenal", tactics: { ...DEFAULT_TACTICS, formation: "4-2-3-1" } },
    seed: 260600,
    batch: batchSize,
    duration: "full_90",
    autoSubs: true
  });
  if (response.errors.length > 0 || response.runs.length !== batchSize) {
    throw new Error(`Batch run returned ${response.runs.length}/${batchSize} runs`);
  }
  evidence.createdRunIds.push(...response.runs.map((run) => run.id));
  const batchId = response.runs[0]?.batchId;
  if (!batchId) {
    throw new Error("Batch run did not return a batch id");
  }
  const meanGoals = average(
    response.runs.map((run) => run.summary.score.home + run.summary.score.away)
  );
  const meanShots = average(
    response.runs.map((run) => run.summary.shots.home + run.summary.shots.away)
  );
  await page.goto(`${webUrl}/visualise/batch/${batchId}`);
  await page.waitForSelector('[data-uat="batch-page"][data-state="ready"]');
  const screenshotPath = await screenshot(page, assetsDir, "batch");

  evidence.scenarios.push({
    id: "batch-distribution",
    title: "Batch Distribution",
    state: "pass",
    observations: [
      `Created ${response.runs.length} runs in batch ${batchId}.`,
      `Mean goals: ${meanGoals.toFixed(2)}.`,
      `Mean shots: ${meanShots.toFixed(2)}.`
    ],
    screenshots: [screenshotPath]
  });
}

async function runAdminScenario(
  page: Page,
  webUrl: string,
  assetsDir: string,
  evidence: UatEvidence
): Promise<void> {
  await page.goto(`${webUrl}/admin/squad-manager`);
  await page.waitForSelector('[data-uat="squad-manager-page"][data-state="ready"]');
  await page.selectOption('[data-uat="squad-manager-home-club-select"]', "liverpool");
  await page.selectOption('[data-uat="squad-manager-away-club-select"]', "manchester-city");
  await page.selectOption('[data-uat="squad-manager-focused-club-select"]', "liverpool");
  const sourceDatasetVersionId =
    (await page.locator('[data-uat="squad-manager-dataset-select"]').inputValue()) ??
    IMPORTED_DATASET_VERSION_ID;

  await page.getByRole("button", { name: "Verify squad" }).click();
  await page.waitForSelector('[data-uat="squad-manager-apply-button"][data-risk-level="low"]');
  await page.getByRole("button", { name: "Inspect" }).first().click();
  const reviewToggle = page.locator('[data-uat="squad-manager-review-mode-toggle"]');
  const applyButton = page.locator(
    '[data-uat="squad-manager-apply-button"][data-risk-level="low"]'
  );
  const guarded = await applyButton.isDisabled();
  const guardState = await page
    .locator('[data-uat="squad-manager-apply-guard"]')
    .getAttribute("data-review-mode");
  const inspectScreenshot = await screenshot(page, assetsDir, "squad-manager-review");

  if (!guarded || guardState !== "on") {
    throw new Error("Squad Manager apply was not guarded in review mode");
  }

  await reviewToggle.uncheck();
  await applyButton.click();
  await page.waitForSelector('[data-uat="squad-manager-apply-confirmation-modal"]');
  const modalScreenshot = await screenshot(page, assetsDir, "squad-manager-apply-modal");
  const applyResponsePromise = page.waitForResponse((response) =>
    response.url().includes("/api/admin/squad-manager/apply")
  );
  await page
    .locator('[data-uat="squad-manager-apply-confirmation-modal"]')
    .getByRole("button", { name: "Apply" })
    .click();
  const applyResponse = await applyResponsePromise;
  if (!applyResponse.ok()) {
    throw new Error(`Squad Manager apply failed with ${applyResponse.status()}`);
  }
  const applyBody = (await applyResponse.json()) as {
    newDatasetVersionId: string;
    audit: {
      sourceDatasetVersionId: string;
      suggestionIds: string[];
      actor: string;
      riskLevel: string;
    };
  };
  await page.waitForSelector('[data-uat="squad-manager-apply-result"][data-state="success"]');
  await page.selectOption(
    '[data-uat="squad-manager-dataset-select"]',
    applyBody.newDatasetVersionId
  );
  await page.getByRole("button", { name: "Activate selected" }).click();
  await page.waitForFunction((datasetId) => {
    const select = document.querySelector<HTMLSelectElement>(
      '[data-uat="squad-manager-dataset-select"]'
    );
    const option = select?.selectedOptions[0];
    return option?.textContent?.includes("[Squad Manager apply:") && select?.value === datasetId;
  }, applyBody.newDatasetVersionId);
  const resultScreenshot = await screenshot(page, assetsDir, "squad-manager-applied");

  evidence.adminApply = {
    sourceDatasetVersionId,
    newDatasetVersionId: applyBody.newDatasetVersionId,
    activatedDatasetVersionId: applyBody.newDatasetVersionId,
    appliedSuggestionIds: applyBody.audit.suggestionIds,
    auditActor: applyBody.audit.actor,
    auditRiskLevel: applyBody.audit.riskLevel
  };
  evidence.scenarios.push({
    id: "admin-squad-manager",
    title: "Squad Manager Verify Apply Activate",
    state:
      applyBody.audit.riskLevel === "low" &&
      applyBody.audit.sourceDatasetVersionId === sourceDatasetVersionId
        ? "pass"
        : "fail",
    observations: [
      `Review mode defaulted on and guarded apply: ${guarded ? "yes" : "no"}.`,
      `Applied ${applyBody.audit.suggestionIds.length} low-risk fixture suggestions.`,
      `Created inactive dataset version ${applyBody.newDatasetVersionId}.`,
      `Activated ${applyBody.newDatasetVersionId} via explicit UI action.`,
      `Audit actor ${applyBody.audit.actor}; risk ${applyBody.audit.riskLevel}.`
    ],
    screenshots: [inspectScreenshot, modalScreenshot, resultScreenshot]
  });
}

async function simulate(page: Page, body: unknown): Promise<SimResponse> {
  return page.evaluate(async (payload) => {
    const response = await fetch("/api/match-engine/simulate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      throw new Error(`simulate failed with ${response.status}: ${await response.text()}`);
    }
    return (await response.json()) as SimResponse;
  }, body);
}

function requireSingleRun(response: SimResponse, label: string): SimRun {
  if (response.errors.length > 0) {
    throw new Error(`${label} returned errors: ${JSON.stringify(response.errors)}`);
  }
  const run = response.runs[0];
  if (!run) {
    throw new Error(`${label} returned no runs`);
  }
  return run;
}

async function screenshot(page: Page, assetsDir: string, name: string): Promise<string> {
  const filename = `${name}.png`;
  const filePath = path.join(assetsDir, filename);
  await page.screenshot({ path: filePath, fullPage: true });
  return path.relative(REPO_ROOT, filePath);
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function summarise(evidence: UatEvidence): UatReportInput["summary"] {
  const failedScenarios = evidence.scenarios.filter((scenario) => scenario.state === "fail").length;
  const failedAssertions = evidence.assertions.filter(
    (assertion) => assertion.state === "fail"
  ).length;
  const warnings = evidence.scenarios.filter((scenario) => scenario.state === "warning").length;
  const passed = evidence.scenarios.filter((scenario) => scenario.state === "pass").length;
  const failed = failedScenarios + failedAssertions;

  return {
    state: failed > 0 ? "fail" : "pass",
    passed,
    failed,
    warnings
  };
}

async function writeGeminiReport(evidencePath: string, aiReportPath: string): Promise<void> {
  const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    await fs.writeFile(
      aiReportPath,
      "Gemini report was requested but GEMINI_API_KEY/GOOGLE_API_KEY was not set.\n",
      "utf8"
    );
    return;
  }

  const model = process.env.GEMINI_UAT_MODEL ?? "gemini-2.5-pro";
  const evidenceJson = await fs.readFile(evidencePath, "utf8");
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      model
    )}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: buildGeminiUatPrompt(evidenceJson) }] }]
      })
    }
  );

  if (!response.ok) {
    await fs.writeFile(
      aiReportPath,
      `Gemini report failed with ${response.status}: ${await response.text()}\n`,
      "utf8"
    );
    return;
  }

  const body = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text =
    body.candidates?.[0]?.content?.parts
      ?.map((part) => part.text)
      .filter(Boolean)
      .join("\n") ?? "Gemini returned no text.";
  await fs.writeFile(aiReportPath, `${text}\n`, "utf8");
}

async function cleanupCreatedRuns(page: Page, runIds: string[]): Promise<void> {
  for (const runId of [...new Set(runIds)]) {
    await page.evaluate(async (id) => {
      await fetch(`/api/match-engine/runs/${encodeURIComponent(id)}`, { method: "DELETE" });
    }, runId);
  }
  runIds.length = 0;
}

async function cleanupCreatedRunsSafe(webUrl: string, runIds: string[]): Promise<void> {
  for (const runId of [...new Set(runIds)]) {
    await fetch(`${webUrl}/api/match-engine/runs/${encodeURIComponent(runId)}`, {
      method: "DELETE"
    }).catch(() => undefined);
  }
  runIds.length = 0;
}

async function pruneOldTempDirs(): Promise<void> {
  await fs.mkdir(TEMP_ROOT, { recursive: true });
  const entries = await fs.readdir(TEMP_ROOT, { withFileTypes: true });
  const nowMs = Date.now();
  await Promise.all(
    entries
      .filter((entry) => entry.isDirectory() && entry.name.startsWith("research-"))
      .map(async (entry) => {
        const dir = path.join(TEMP_ROOT, entry.name);
        const stat = await fs.stat(dir).catch(() => null);
        if (stat && isExpiredTempDir(nowMs, stat.mtimeMs, 24)) {
          await fs.rm(dir, { recursive: true, force: true });
        }
      })
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
