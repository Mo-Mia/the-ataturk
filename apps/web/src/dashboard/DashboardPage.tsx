import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";

import type { MatchRunListResponse, PersistedMatchRun } from "../match/visualiser/runTypes";

interface SquadManagerContext {
  activeVersion: {
    id: string;
    name: string;
    source_file: string;
    source_file_sha256: string;
    description: string | null;
    is_active: boolean;
    created_at: string;
    updated_at: string;
  } | null;
  clubs: Array<{
    id: string;
    name: string;
    short_name: string;
    dataset_version_id: string;
  }>;
}

interface SquadResponse {
  squad: unknown[];
}

interface HealthResponse {
  status: string;
  timestamp: string;
}

type LoadState = "loading" | "ready" | "empty" | "error";

const BASELINE_DOC_URL =
  "https://github.com/Mo-Mia/the-ataturk/blob/main/docs/CALIBRATION_BASELINE_PHASE_14.md";
const BASELINE_DOC_PATH = "docs/CALIBRATION_BASELINE_PHASE_14.md";

const ENGINE_METRICS = [
  { id: "shots", label: "Shots", value: 22.67, bandMin: 19.4, bandMax: 30.2 },
  { id: "goals", label: "Goals", value: 2.19, bandMin: 1.16, bandMax: 4.34 },
  { id: "fouls", label: "Fouls", value: 17.47, bandMin: 16.6, bandMax: 26.6 },
  { id: "cards", label: "Cards", value: 5.1, bandMin: 1.83, bandMax: 5.87 },
  { id: "corners", label: "Corners", value: 7.01, bandMin: 6.7, bandMax: 13.2 }
] as const;

export function DashboardPage() {
  const dataset = useActiveDataset();
  const recentRuns = useRecentRuns();
  const latestBatch = useLatestBatch(recentRuns.runs);
  const health = useHealth();

  return (
    <main className="dashboard-shell" data-uat="dashboard-page">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">FootSim Workbench</p>
          <h1>Dashboard</h1>
          <p className="dashboard-note">
            Read-only status for the active runtime dataset, recent simulations, calibration
            anchor, and server health.
          </p>
        </div>
      </header>

      <section className="dashboard-grid" aria-label="Dashboard widgets">
        <ActiveDatasetWidget dataset={dataset} />
        <RecentRunsWidget state={recentRuns.state} runs={recentRuns.runs} />
        <LatestBatchWidget
          state={latestBatch.state}
          runs={latestBatch.runs}
          batchId={latestBatch.batchId}
          error={latestBatch.error}
        />
        <EngineCharacterWidget />
        <SystemStatusWidget health={health} lastRun={recentRuns.runs[0] ?? null} />
      </section>
    </main>
  );
}

function ActiveDatasetWidget({
  dataset
}: {
  dataset: ReturnType<typeof useActiveDataset>;
}) {
  const version = dataset.context?.activeVersion ?? null;
  const clubs = dataset.context?.clubs ?? [];
  const playerLabel = dataset.playerCount === null ? "Unavailable" : String(dataset.playerCount);

  return (
    <article
      id="dashboard-widget-active-dataset"
      className="dashboard-card"
      aria-label="Active dataset"
      data-uat="dashboard-widget-active-dataset"
      data-state={dataset.state}
      data-dataset-version-id={version?.id ?? ""}
    >
      <div className="dashboard-card__header">
        <h2>Active Dataset</h2>
        <Link className="dashboard-card__link" to="/admin/squad-manager">
          Open Squad Manager
        </Link>
      </div>
      {dataset.state === "loading" ? <p className="dashboard-muted">Loading dataset...</p> : null}
      {dataset.state === "error" ? (
        <p className="error">{dataset.error ?? "Could not load active dataset."}</p>
      ) : null}
      {dataset.state === "empty" ? (
        <p className="dashboard-empty">No active FC dataset found.</p>
      ) : null}
      {version ? (
        <dl className="dashboard-definition-list">
          <div>
            <dt>Name</dt>
            <dd>{version.name}</dd>
          </div>
          <div>
            <dt>Version ID</dt>
            <dd>{version.id}</dd>
          </div>
          <div>
            <dt>Source CSV</dt>
            <dd>{version.source_file}</dd>
          </div>
          <div>
            <dt>Imported</dt>
            <dd>{formatDate(version.created_at)}</dd>
          </div>
          <div>
            <dt>Clubs</dt>
            <dd data-uat="active-dataset-club-count" data-value={clubs.length}>
              {clubs.length}
            </dd>
          </div>
          <div>
            <dt>Players</dt>
            <dd data-uat="active-dataset-player-count" data-value={dataset.playerCount ?? ""}>
              {playerLabel}
            </dd>
          </div>
        </dl>
      ) : null}
    </article>
  );
}

function RecentRunsWidget({ state, runs }: { state: LoadState; runs: PersistedMatchRun[] }) {
  return (
    <article
      id="dashboard-widget-recent-runs"
      className="dashboard-card dashboard-card--wide"
      aria-label="Recent runs"
      data-uat="dashboard-widget-recent-runs"
      data-state={state}
    >
      <div className="dashboard-card__header">
        <h2>Recent Runs</h2>
        <Link className="dashboard-card__link" to="/visualise/run">
          Open Sim Runner
        </Link>
      </div>
      {state === "loading" ? <p className="dashboard-muted">Loading runs...</p> : null}
      {state === "error" ? <p className="error">Could not load recent runs.</p> : null}
      {state === "empty" ? <p className="dashboard-empty">No persisted runs yet.</p> : null}
      {runs.length > 0 ? (
        <div className="dashboard-run-strip" aria-label="Recent run links">
          {runs.map((run) => (
            <Link
              key={run.id}
              className="dashboard-run"
              to={`/visualise?artifact=${encodeURIComponent(run.artefactId)}`}
              data-uat="dashboard-recent-run"
              data-run-id={run.id}
              data-artifact-id={run.artefactId}
            >
              <strong>
                {run.homeClubId} {run.summary.score.home}-{run.summary.score.away}{" "}
                {run.awayClubId}
              </strong>
              <span>Seed {run.seed}</span>
              <span>{formatDate(run.createdAt)}</span>
            </Link>
          ))}
        </div>
      ) : null}
    </article>
  );
}

function LatestBatchWidget({
  state,
  runs,
  batchId,
  error
}: {
  state: LoadState;
  runs: PersistedMatchRun[];
  batchId: string | null;
  error: string | null;
}) {
  const summary = useMemo(() => summariseBatch(runs), [runs]);

  return (
    <article
      id="dashboard-widget-latest-batch"
      className="dashboard-card"
      aria-label="Latest batch"
      data-uat="dashboard-widget-latest-batch"
      data-state={state}
      data-batch-id={batchId ?? ""}
    >
      <div className="dashboard-card__header">
        <h2>Latest Batch</h2>
        {batchId ? (
          <Link className="dashboard-card__link" to={`/visualise/batch/${encodeURIComponent(batchId)}`}>
            Open Batch
          </Link>
        ) : null}
      </div>
      {state === "loading" ? <p className="dashboard-muted">Loading batch...</p> : null}
      {state === "error" ? <p className="error">{error ?? "Could not load latest batch."}</p> : null}
      {state === "empty" ? <p className="dashboard-empty">No recent batches.</p> : null}
      {summary ? (
        <dl className="dashboard-definition-list">
          <div>
            <dt>Batch ID</dt>
            <dd>{batchId}</dd>
          </div>
          <div>
            <dt>Runs</dt>
            <dd data-uat="latest-batch-run-count" data-value={runs.length}>
              {runs.length}
            </dd>
          </div>
          <div>
            <dt>Matchup</dt>
            <dd>{summary.matchup}</dd>
          </div>
          <div>
            <dt>Seed range</dt>
            <dd>{summary.seedRange}</dd>
          </div>
          <div>
            <dt>Mean goals</dt>
            <dd data-uat="latest-batch-mean-goals" data-value={summary.meanGoals}>
              {summary.meanGoals}
            </dd>
          </div>
          <div>
            <dt>Mean shots</dt>
            <dd data-uat="latest-batch-mean-shots" data-value={summary.meanShots}>
              {summary.meanShots}
            </dd>
          </div>
        </dl>
      ) : null}
    </article>
  );
}

function EngineCharacterWidget() {
  return (
    <article
      id="dashboard-widget-engine-character"
      className="dashboard-card dashboard-card--wide"
      aria-label="Engine character"
      data-uat="dashboard-widget-engine-character"
      data-state="ready"
      data-baseline-doc={BASELINE_DOC_PATH}
    >
      <div className="dashboard-card__header">
        <div>
          <h2>Calibration Baseline</h2>
          <p className="dashboard-muted">Phase 14b/17, real-PL anchored, FC26 PL20.</p>
        </div>
        <a className="dashboard-card__link" href={BASELINE_DOC_URL}>
          Open Baseline Doc
        </a>
      </div>
      <p className="dashboard-callout">
        Active baseline: Phase 14b/17. Last validated 2026-05-05 08:36 SAST.
      </p>
      <table className="dashboard-metrics-table">
        <thead>
          <tr>
            <th>Metric</th>
            <th>Measured</th>
            <th>Real-PL band</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {ENGINE_METRICS.map((metric) => {
            const inBand = metric.value >= metric.bandMin && metric.value <= metric.bandMax;
            return (
              <tr
                key={metric.id}
                data-uat="engine-character-metric"
                data-metric={metric.id}
                data-value={metric.value}
                data-band-min={metric.bandMin}
                data-band-max={metric.bandMax}
                data-status={inBand ? "in-band" : "out-of-band"}
              >
                <td>{metric.label}</td>
                <td>{metric.value.toFixed(metric.id === "cards" ? 2 : 2)}</td>
                <td>
                  {metric.bandMin}-{metric.bandMax}
                </td>
                <td>{inBand ? "In band" : "Out of band"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </article>
  );
}

function SystemStatusWidget({
  health,
  lastRun
}: {
  health: ReturnType<typeof useHealth>;
  lastRun: PersistedMatchRun | null;
}) {
  return (
    <article
      id="dashboard-widget-system-status"
      className="dashboard-card"
      aria-label="System status"
      data-uat="dashboard-widget-system-status"
      data-state={health.state}
    >
      <div className="dashboard-card__header">
        <h2>System Status</h2>
        <Link className="dashboard-card__link" to="/smoke-test">
          Smoke Test
        </Link>
      </div>
      {health.state === "loading" ? <p className="dashboard-muted">Checking server...</p> : null}
      {health.state === "error" ? <p className="error">Health check unavailable.</p> : null}
      {health.response ? (
        <dl className="dashboard-definition-list">
          <div>
            <dt>Server</dt>
            <dd data-uat="system-health-status" data-value={health.response.status}>
              {health.response.status}
            </dd>
          </div>
          <div>
            <dt>Checked</dt>
            <dd>{formatDate(health.response.timestamp)}</dd>
          </div>
          <div>
            <dt>Last run</dt>
            <dd data-uat="system-last-run" data-run-id={lastRun?.id ?? ""}>
              {lastRun ? formatDate(lastRun.createdAt) : "No runs yet"}
            </dd>
          </div>
        </dl>
      ) : null}
    </article>
  );
}

function useActiveDataset() {
  const [state, setState] = useState<LoadState>("loading");
  const [context, setContext] = useState<SquadManagerContext | null>(null);
  const [playerCount, setPlayerCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadDataset(): Promise<void> {
      try {
        const response = await fetch("/api/ai/squad-manager/context");
        if (!response.ok) {
          throw new Error(`Dataset context failed with ${response.status}`);
        }
        const body = (await response.json()) as SquadManagerContext;
        if (cancelled) {
          return;
        }
        setContext(body);
        if (!body.activeVersion) {
          setPlayerCount(null);
          setState("empty");
          return;
        }
        setState("ready");
        try {
          const squads = await Promise.all(
            body.clubs.map(async (club) => {
              const params = new URLSearchParams({
                clubId: club.id,
                datasetVersionId: body.activeVersion!.id
              });
              const squadResponse = await fetch(`/api/ai/squad-manager/squad?${params.toString()}`);
              if (!squadResponse.ok) {
                throw new Error(`Squad failed with ${squadResponse.status}`);
              }
              return (await squadResponse.json()) as SquadResponse;
            })
          );
          if (!cancelled) {
            setPlayerCount(squads.reduce((total, squad) => total + squad.squad.length, 0));
          }
        } catch {
          if (!cancelled) {
            setPlayerCount(null);
          }
        }
      } catch (requestError) {
        if (!cancelled) {
          setState("error");
          setContext(null);
          setPlayerCount(null);
          setError(requestError instanceof Error ? requestError.message : "Could not load dataset");
        }
      }
    }

    void loadDataset();
    return () => {
      cancelled = true;
    };
  }, []);

  return { state, context, playerCount, error };
}

function useRecentRuns() {
  const [state, setState] = useState<LoadState>("loading");
  const [runs, setRuns] = useState<PersistedMatchRun[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function loadRuns(): Promise<void> {
      try {
        const response = await fetch("/api/match-engine/runs?page=1&limit=10");
        if (!response.ok) {
          throw new Error(`Runs failed with ${response.status}`);
        }
        const body = (await response.json()) as MatchRunListResponse;
        if (!cancelled) {
          setRuns(body.runs);
          setState(body.runs.length > 0 ? "ready" : "empty");
        }
      } catch {
        if (!cancelled) {
          setRuns([]);
          setState("error");
        }
      }
    }

    void loadRuns();
    return () => {
      cancelled = true;
    };
  }, []);

  return { state, runs };
}

function useLatestBatch(recentRuns: PersistedMatchRun[]) {
  const batchId = useMemo(() => recentRuns.find((run) => run.batchId)?.batchId ?? null, [recentRuns]);
  const [loadedBatchId, setLoadedBatchId] = useState<string | null>(null);
  const [state, setState] = useState<LoadState>("loading");
  const [runs, setRuns] = useState<PersistedMatchRun[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadBatch(): Promise<void> {
      if (!batchId) {
        setLoadedBatchId(null);
        setRuns([]);
        setState("empty");
        setError(null);
        return;
      }
      setLoadedBatchId(batchId);
      setState("loading");
      try {
        const response = await fetch(`/api/match-engine/batches/${encodeURIComponent(batchId)}/runs`);
        if (!response.ok) {
          throw new Error(`Batch request failed with ${response.status}`);
        }
        const body = (await response.json()) as { runs: PersistedMatchRun[] };
        if (!cancelled) {
          setRuns(body.runs);
          setState(body.runs.length > 0 ? "ready" : "empty");
          setError(null);
        }
      } catch (requestError) {
        if (!cancelled) {
          setRuns([]);
          setState("error");
          setError(requestError instanceof Error ? requestError.message : "Could not load batch");
        }
      }
    }

    void loadBatch();
    return () => {
      cancelled = true;
    };
  }, [batchId]);

  return { state, runs, batchId: loadedBatchId, error };
}

function useHealth() {
  const [state, setState] = useState<LoadState>("loading");
  const [response, setResponse] = useState<HealthResponse | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadHealth(): Promise<void> {
      try {
        const healthResponse = await fetch("/api/health");
        if (!healthResponse.ok) {
          throw new Error(`Health failed with ${healthResponse.status}`);
        }
        const body = (await healthResponse.json()) as HealthResponse;
        if (!cancelled) {
          setResponse(body);
          setState("ready");
        }
      } catch {
        if (!cancelled) {
          setResponse(null);
          setState("error");
        }
      }
    }

    void loadHealth();
    return () => {
      cancelled = true;
    };
  }, []);

  return { state, response };
}

function summariseBatch(runs: PersistedMatchRun[]) {
  if (runs.length === 0) {
    return null;
  }
  const seeds = runs.map((run) => run.seed).sort((left, right) => left - right);
  const goals = runs.map((run) => run.summary.score.home + run.summary.score.away);
  const shots = runs.map((run) => run.summary.shots.home + run.summary.shots.away);
  return {
    matchup: `${runs[0]!.homeClubId} vs ${runs[0]!.awayClubId}`,
    seedRange: seeds[0] === seeds.at(-1) ? String(seeds[0]) : `${seeds[0]}-${seeds.at(-1)}`,
    meanGoals: average(goals),
    meanShots: average(shots)
  };
}

function average(values: number[]): string {
  if (values.length === 0) {
    return "0.0";
  }
  return (values.reduce((total, value) => total + value, 0) / values.length).toFixed(1);
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}
