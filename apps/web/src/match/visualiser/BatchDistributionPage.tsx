import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from "recharts";

import type { PersistedMatchRun } from "./runTypes";

interface BatchRunsResponse {
  runs: PersistedMatchRun[];
}

interface HistogramBucket {
  bucket: string;
  count: number;
  representative: PersistedMatchRun;
}

interface MetricDefinition {
  id: string;
  label: string;
  value: (run: PersistedMatchRun) => number;
  bucket?: (value: number) => string;
}

const METRICS: MetricDefinition[] = [
  { id: "home-goals", label: "Home goals", value: (run) => run.summary.score.home },
  { id: "away-goals", label: "Away goals", value: (run) => run.summary.score.away },
  { id: "home-shots", label: "Home shots", value: (run) => run.summary.shots.home },
  { id: "away-shots", label: "Away shots", value: (run) => run.summary.shots.away },
  {
    id: "home-possession",
    label: "Home possession %",
    value: (run) => run.summary.possession.home,
    bucket: (value) => `${Math.floor(value / 5) * 5}-${Math.floor(value / 5) * 5 + 4}`
  },
  { id: "home-fouls", label: "Home fouls", value: (run) => run.summary.fouls.home },
  { id: "away-fouls", label: "Away fouls", value: (run) => run.summary.fouls.away },
  { id: "home-cards", label: "Home cards", value: (run) => run.summary.cards.home },
  { id: "away-cards", label: "Away cards", value: (run) => run.summary.cards.away }
];

export function BatchDistributionPage() {
  const { batchId } = useParams();
  const navigate = useNavigate();
  const [runs, setRuns] = useState<PersistedMatchRun[]>([]);
  const [status, setStatus] = useState<"loading" | "idle" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadBatch(): Promise<void> {
      if (!batchId) {
        setStatus("error");
        setError("Batch id is required");
        return;
      }

      try {
        const response = await fetch(
          `/api/match-engine/batches/${encodeURIComponent(batchId)}/runs`
        );
        if (!response.ok) {
          throw new Error(`Batch request failed with ${response.status}`);
        }
        const body = (await response.json()) as BatchRunsResponse;
        if (!cancelled) {
          setRuns(body.runs);
          setStatus("idle");
          setError(null);
        }
      } catch (requestError) {
        if (!cancelled) {
          setStatus("error");
          setError(requestError instanceof Error ? requestError.message : "Could not load batch");
        }
      }
    }

    void loadBatch();
    return () => {
      cancelled = true;
    };
  }, [batchId]);

  const metadata = useMemo(() => batchMetadata(runs), [runs]);

  if (status === "loading") {
    return (
      <main className="batch-shell">
        <p>Loading batch...</p>
      </main>
    );
  }

  if (status === "error") {
    return (
      <main className="batch-shell">
        <p className="error">{error ?? "Batch not found"}</p>
      </main>
    );
  }

  return (
    <main className="batch-shell">
      <header className="batch-header">
        <div>
          <p className="eyebrow">Match Visualiser</p>
          <h1>Batch Distribution</h1>
          <p className="sim-runner-note">
            {metadata.matchup} · seeds {metadata.seedRange} · {runs.length} runs
          </p>
        </div>
        <div className="batch-header-links">
          {runs.length >= 2 ? (
            <a
              className="sim-runner-link"
              href={`/visualise/compare?a=${encodeURIComponent(runs[0]!.id)}&b=${encodeURIComponent(
                runs[1]!.id
              )}`}
            >
              Compare first two
            </a>
          ) : null}
          <a className="sim-runner-link" href="/visualise/run">
            Sim runner
          </a>
        </div>
      </header>

      <section className="batch-meta" aria-label="Batch metadata">
        <strong>Home tactics</strong>
        <span>{metadata.homeTactics}</span>
        <strong>Away tactics</strong>
        <span>{metadata.awayTactics}</span>
        <strong>Duration</strong>
        <span>{metadata.duration}</span>
      </section>

      <section className="batch-lineup" aria-label="Batch line-up">
        <h2>Batch XI</h2>
        <BatchLineup run={runs[0]} />
        <BatchSubstitutions runs={runs} />
        <BatchSetPieces runs={runs} />
      </section>

      <section className="batch-summary" aria-label="Batch summary statistics">
        <h2>Summary statistics</h2>
        <table>
          <thead>
            <tr>
              <th>Metric</th>
              <th>Mean</th>
              <th>Median</th>
              <th>Range</th>
            </tr>
          </thead>
          <tbody>
            {METRICS.map((metric) => {
              const summary = summarise(runs.map(metric.value));
              return (
                <tr key={metric.id}>
                  <td>{metric.label}</td>
                  <td>{summary.mean}</td>
                  <td>{summary.median}</td>
                  <td>{summary.range}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section className="batch-grid" aria-label="Batch histograms">
        {METRICS.map((metric) => (
          <HistogramCard
            key={metric.id}
            metric={metric}
            runs={runs}
            onOpen={(run) => {
              void navigate(`/visualise?artifact=${encodeURIComponent(run.artefactId)}`);
            }}
          />
        ))}
      </section>
    </main>
  );
}

function BatchSubstitutions({ runs }: { runs: PersistedMatchRun[] }) {
  const counts = runs.map(
    (run) =>
      (run.summary.substitutions?.home.length ?? 0) + (run.summary.substitutions?.away.length ?? 0)
  );
  if (counts.length === 0) {
    return null;
  }
  const summary = summarise(counts);
  return (
    <p className="sim-runner-note">
      Substitutions per run: mean {summary.mean}, median {summary.median}, range {summary.range}.
    </p>
  );
}

function BatchSetPieces({ runs }: { runs: PersistedMatchRun[] }) {
  const corners = runs.map(
    (run) => (run.summary.setPieces?.home.corners ?? 0) + (run.summary.setPieces?.away.corners ?? 0)
  );
  const penalties = runs.map(
    (run) =>
      (run.summary.setPieces?.home.penalties ?? 0) + (run.summary.setPieces?.away.penalties ?? 0)
  );
  const goals = runs.map(
    (run) =>
      (run.summary.setPieces?.home.setPieceGoals ?? 0) +
      (run.summary.setPieces?.away.setPieceGoals ?? 0)
  );
  if (corners.length === 0) {
    return null;
  }
  return (
    <p className="sim-runner-note">
      Set pieces per run: corners mean {summarise(corners).mean}, penalties mean{" "}
      {summarise(penalties).mean}, set-piece goals mean {summarise(goals).mean}.
    </p>
  );
}

function HistogramCard({
  metric,
  runs,
  onOpen
}: {
  metric: MetricDefinition;
  runs: PersistedMatchRun[];
  onOpen: (run: PersistedMatchRun) => void;
}) {
  const buckets = useMemo(() => buildBuckets(runs, metric), [metric, runs]);

  return (
    <article className="batch-card" aria-label={`${metric.label} histogram`}>
      <h2>{metric.label}</h2>
      <BarChart
        width={340}
        height={220}
        data={buckets}
        margin={{ top: 12, right: 12, bottom: 24, left: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="bucket" />
        <YAxis allowDecimals={false} />
        <Tooltip />
        <Bar
          dataKey="count"
          fill="#244f8f"
          cursor="pointer"
          name="Runs"
          onClick={(data) => {
            const bucket = histogramBucketFrom(data);
            if (bucket) {
              onOpen(bucket.representative);
            }
          }}
        />
      </BarChart>
    </article>
  );
}

function buildBuckets(runs: PersistedMatchRun[], metric: MetricDefinition): HistogramBucket[] {
  const buckets = new Map<string, HistogramBucket>();
  const sortedRuns = [...runs].sort((left, right) => left.seed - right.seed);

  for (const run of sortedRuns) {
    const value = metric.value(run);
    const bucketName = metric.bucket ? metric.bucket(value) : String(value);
    const existing = buckets.get(bucketName);
    if (existing) {
      existing.count += 1;
    } else {
      buckets.set(bucketName, { bucket: bucketName, count: 1, representative: run });
    }
  }

  return [...buckets.values()].sort(
    (left, right) => bucketSortValue(left.bucket) - bucketSortValue(right.bucket)
  );
}

function batchMetadata(runs: PersistedMatchRun[]) {
  const first = runs[0];
  if (!first) {
    return {
      matchup: "No runs",
      seedRange: "-",
      homeTactics: "-",
      awayTactics: "-",
      duration: "-"
    };
  }

  const seeds = runs.map((run) => run.seed);
  return {
    matchup: `${first.homeClubId} vs ${first.awayClubId}`,
    seedRange: `${Math.min(...seeds)}-${Math.max(...seeds)}`,
    homeTactics: tacticsSummary(first.homeTactics),
    awayTactics: tacticsSummary(first.awayTactics),
    duration: first.summary.duration === "full_90" ? "Full match" : "Second half"
  };
}

function BatchLineup({ run }: { run: PersistedMatchRun | undefined }) {
  const xi = run?.summary.xi;
  if (!xi) {
    return <p>XI not recorded for this batch.</p>;
  }

  return (
    <div className="lineup-summary">
      <div>
        <strong>Home</strong>
        <p>{xi.home.map((player) => `${player.position} ${player.shortName}`).join(", ")}</p>
      </div>
      <div>
        <strong>Away</strong>
        <p>{xi.away.map((player) => `${player.position} ${player.shortName}`).join(", ")}</p>
      </div>
    </div>
  );
}

function tacticsSummary(tactics: PersistedMatchRun["homeTactics"]): string {
  return `${tactics.formation}, ${tactics.mentality}, ${tactics.tempo}, ${tactics.pressing}, ${tactics.lineHeight}, ${tactics.width}`;
}

function summarise(values: number[]) {
  if (values.length === 0) {
    return { mean: "-", median: "-", range: "-" };
  }

  const sorted = [...values].sort((left, right) => left - right);
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const midpoint = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 0 ? (sorted[midpoint - 1]! + sorted[midpoint]!) / 2 : sorted[midpoint]!;
  return {
    mean: formatNumber(mean),
    median: formatNumber(median),
    range: `${sorted[0]}-${sorted.at(-1)}`
  };
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function bucketSortValue(bucket: string): number {
  return Number(bucket.split("-")[0]);
}

function histogramBucketFrom(value: unknown): HistogramBucket | null {
  if (isHistogramBucket(value)) {
    return value;
  }
  if (
    typeof value === "object" &&
    value !== null &&
    "payload" in value &&
    isHistogramBucket(value.payload)
  ) {
    return value.payload;
  }
  return null;
}

function isHistogramBucket(value: unknown): value is HistogramBucket {
  return (
    typeof value === "object" &&
    value !== null &&
    "bucket" in value &&
    "count" in value &&
    "representative" in value &&
    typeof value.bucket === "string" &&
    typeof value.count === "number"
  );
}
