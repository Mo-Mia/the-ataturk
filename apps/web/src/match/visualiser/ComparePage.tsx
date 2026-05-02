import type { MatchSnapshot, MatchTick } from "@the-ataturk/match-engine";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { EventDock } from "./components/EventDock";
import {
  HeatmapPitch,
  ShapeDiagnostics,
  buildHeatmap,
  type HeatmapFilter,
  type HeatmapSubject
} from "./components/HeatmapPanel";
import { StatsPanel, statsForReplay } from "./components/StatsPanel";
import type { MatchRunListResponse, PersistedMatchRun } from "./runTypes";

interface LoadedRun {
  run: PersistedMatchRun;
  snapshot: MatchSnapshot;
}

type CompareSlot = "a" | "b";

const HEATMAP_FILTER: HeatmapFilter = "all";
const HEATMAP_SUBJECT: HeatmapSubject = "ball";

export function ComparePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const runAId = searchParams.get("a") ?? "";
  const runBId = searchParams.get("b") ?? "";
  const [runs, setRuns] = useState<PersistedMatchRun[]>([]);
  const [runA, setRunA] = useState<LoadedRun | null>(null);
  const [runB, setRunB] = useState<LoadedRun | null>(null);
  const [status, setStatus] = useState<"loading" | "idle" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadRuns(): Promise<void> {
      try {
        const response = await fetch("/api/match-engine/runs?page=1&limit=100");
        if (!response.ok) {
          throw new Error(`Run list failed with ${response.status}`);
        }
        const body = (await response.json()) as MatchRunListResponse;
        if (!cancelled) {
          setRuns(body.runs);
        }
      } catch (requestError) {
        if (!cancelled) {
          setError(requestError instanceof Error ? requestError.message : "Could not load runs");
          setStatus("error");
        }
      }
    }

    void loadRuns();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadSelectedRuns(): Promise<void> {
      if (!runAId || !runBId) {
        setRunA(null);
        setRunB(null);
        setStatus("idle");
        return;
      }

      setStatus("loading");
      setError(null);
      try {
        const [nextA, nextB] = await Promise.all([loadRun(runAId), loadRun(runBId)]);
        if (!cancelled) {
          setRunA(nextA);
          setRunB(nextB);
          setStatus("idle");
        }
      } catch (requestError) {
        if (!cancelled) {
          setRunA(null);
          setRunB(null);
          setStatus("error");
          setError(requestError instanceof Error ? requestError.message : "Could not load comparison");
        }
      }
    }

    void loadSelectedRuns();
    return () => {
      cancelled = true;
    };
  }, [runAId, runBId]);

  const sharedHeatmapMax = useMemo(() => {
    if (!runA || !runB) {
      return undefined;
    }
    return Math.max(
      buildHeatmap(runA.snapshot, HEATMAP_FILTER, HEATMAP_SUBJECT).max,
      buildHeatmap(runB.snapshot, HEATMAP_FILTER, HEATMAP_SUBJECT).max
    );
  }, [runA, runB]);

  const crossMatchup = Boolean(
    runA &&
      runB &&
      (runA.run.homeClubId !== runB.run.homeClubId || runA.run.awayClubId !== runB.run.awayClubId)
  );

  function setRun(slot: CompareSlot, runId: string): void {
    const next = new URLSearchParams(searchParams);
    if (runId) {
      next.set(slot, runId);
    } else {
      next.delete(slot);
    }
    setSearchParams(next);
  }

  return (
    <main className="compare-shell">
      <header className="compare-header">
        <div>
          <p className="eyebrow">Match Visualiser</p>
          <h1>Run Comparison</h1>
          <p className="sim-runner-note">Compare two persisted match-engine runs side by side.</p>
        </div>
        <a className="sim-runner-link" href="/visualise/run">
          Sim runner
        </a>
      </header>

      <section className="compare-picker" aria-label="Run comparison picker">
        <RunSelect label="Run A" runs={runs} value={runAId} onChange={(id) => setRun("a", id)} />
        <RunSelect label="Run B" runs={runs} value={runBId} onChange={(id) => setRun("b", id)} />
      </section>

      {error ? <p className="error">{error}</p> : null}
      {!runAId || !runBId ? (
        <p className="sim-runner-empty">Choose two persisted runs to compare.</p>
      ) : null}
      {status === "loading" && runAId && runBId ? <p>Loading comparison...</p> : null}
      {crossMatchup ? (
        <p className="compare-warning">
          These runs use different matchups. The comparison still renders, but tactical conclusions
          may be noisy.
        </p>
      ) : null}

      {runA && runB ? (
        <>
          <SummaryDiff runA={runA} runB={runB} />
          <section className="compare-grid" aria-label="Run comparison columns">
            <RunColumn title="Run A" loaded={runA} heatmapMax={sharedHeatmapMax} />
            <RunColumn title="Run B" loaded={runB} heatmapMax={sharedHeatmapMax} />
          </section>
        </>
      ) : null}
    </main>
  );
}

function RunSelect({
  label,
  runs,
  value,
  onChange
}: {
  label: string;
  runs: PersistedMatchRun[];
  value: string;
  onChange: (runId: string) => void;
}) {
  return (
    <label>
      {label}
      <select value={value} onChange={(event) => onChange(event.currentTarget.value)}>
        <option value="">Select run</option>
        {runs.map((run) => (
          <option key={run.id} value={run.id}>
            {run.seed} · {run.summary.score.home}-{run.summary.score.away} ·{" "}
            {new Date(run.createdAt).toLocaleString()}
          </option>
        ))}
      </select>
    </label>
  );
}

function SummaryDiff({ runA, runB }: { runA: LoadedRun; runB: LoadedRun }) {
  const aFinal = finalTick(runA.snapshot);
  const bFinal = finalTick(runB.snapshot);
  const aShots = runA.run.summary.shots.home + runA.run.summary.shots.away;
  const bShots = runB.run.summary.shots.home + runB.run.summary.shots.away;
  const aAttack = attackingThirdPct(runA.snapshot);
  const bAttack = attackingThirdPct(runB.snapshot);

  return (
    <section className="compare-summary" aria-label="Summary difference">
      <strong>
        Run A: {aFinal.score.home}-{aFinal.score.away}, {aShots} shots.
      </strong>
      <strong>
        Run B: {bFinal.score.home}-{bFinal.score.away}, {bShots} shots.
      </strong>
      <span>
        Run A had {signedPct(aAttack - bAttack)} attacking-third entries compared with Run B.
      </span>
    </section>
  );
}

function RunColumn({
  title,
  loaded,
  heatmapMax
}: {
  title: string;
  loaded: LoadedRun;
  heatmapMax?: number | undefined;
}) {
  const tick = finalTick(loaded.snapshot);
  const stats = statsForReplay(loaded.snapshot.ticks);
  const events = loaded.snapshot.ticks.flatMap((snapshotTick) => snapshotTick.events);

  return (
    <article className="compare-column" aria-label={title}>
      <header className="compare-column-header">
        <h2>{title}</h2>
        <p>
          Seed {loaded.run.seed} · {loaded.snapshot.meta.homeTeam.shortName} {tick.score.home}-
          {tick.score.away} {loaded.snapshot.meta.awayTeam.shortName}
        </p>
      </header>
      <StatsPanel snapshot={loaded.snapshot} tick={tick} stats={stats} />
      <div className="compare-heatmap">
        <HeatmapPitch
          snapshot={loaded.snapshot}
          filter={HEATMAP_FILTER}
          subject={HEATMAP_SUBJECT}
          maxOverride={heatmapMax}
        />
      </div>
      <ShapeDiagnostics snapshot={loaded.snapshot} tick={tick} />
      <EventDock snapshot={loaded.snapshot} events={events} title={`${title} events`} />
    </article>
  );
}

async function loadRun(runId: string): Promise<LoadedRun> {
  const runResponse = await fetch(`/api/match-engine/runs/${encodeURIComponent(runId)}`);
  if (!runResponse.ok) {
    throw new Error(`Run ${runId} could not be loaded`);
  }
  const run = (await runResponse.json()) as PersistedMatchRun;
  const artifactResponse = await fetch(
    `/api/visualiser/artifacts/${encodeURIComponent(run.artefactId)}`
  );
  if (!artifactResponse.ok) {
    throw new Error(`Artifact ${run.artefactId} could not be loaded`);
  }
  const snapshot = (await artifactResponse.json()) as MatchSnapshot;
  return { run, snapshot };
}

function finalTick(snapshot: MatchSnapshot): MatchTick {
  const tick = snapshot.ticks.at(-1);
  if (!tick) {
    throw new Error("Snapshot has no ticks");
  }
  return tick;
}

function attackingThirdPct(snapshot: MatchSnapshot): number {
  return buildHeatmap(snapshot, "all", "ball").diagnostics.attackingThirdPct;
}

function signedPct(value: number): string {
  return `${value >= 0 ? "+" : ""}${value}%`;
}
