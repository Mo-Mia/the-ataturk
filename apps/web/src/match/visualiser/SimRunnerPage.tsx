import type { TeamTactics } from "@the-ataturk/match-engine";
import { useEffect, useMemo, useState } from "react";

interface Fc25Club {
  id: string;
  name: string;
  short_name: string;
}

interface SimRunSummary {
  score: { home: number; away: number };
  shots: { home: number; away: number };
  fouls: { home: number; away: number };
  cards: { home: number; away: number };
  possession: { home: number; away: number };
}

interface SimRun {
  seed: number;
  artefactId: string;
  summary: SimRunSummary;
}

interface SimError {
  seed: number;
  error: string;
}

interface SimResponse {
  runs: SimRun[];
  errors: SimError[];
}

type TeamSide = "home" | "away";

const DEFAULT_TACTICS: TeamTactics = {
  formation: "4-4-2",
  mentality: "balanced",
  tempo: "normal",
  pressing: "medium",
  lineHeight: "normal",
  width: "normal"
};

const FORMATIONS = ["4-4-2", "4-3-1-2", "4-3-3", "4-2-3-1"] as const;
const MENTALITIES: TeamTactics["mentality"][] = ["balanced", "attacking", "defensive"];
const TEMPOS: TeamTactics["tempo"][] = ["normal", "fast", "slow"];
const PRESSING_LEVELS: TeamTactics["pressing"][] = ["medium", "high", "low"];
const LINE_HEIGHTS: TeamTactics["lineHeight"][] = ["normal", "high", "deep"];
const WIDTHS: TeamTactics["width"][] = ["normal", "wide", "narrow"];

export function SimRunnerPage() {
  const [clubs, setClubs] = useState<Fc25Club[]>([]);
  const [homeClubId, setHomeClubId] = useState("");
  const [awayClubId, setAwayClubId] = useState("");
  const [homeTactics, setHomeTactics] = useState<TeamTactics>(DEFAULT_TACTICS);
  const [awayTactics, setAwayTactics] = useState<TeamTactics>(DEFAULT_TACTICS);
  const [seed, setSeed] = useState(() => String(randomSeed()));
  const [batch, setBatch] = useState<1 | 50>(1);
  const [history, setHistory] = useState<SimRun[]>([]);
  const [runErrors, setRunErrors] = useState<SimError[]>([]);
  const [status, setStatus] = useState<"loading-clubs" | "idle" | "running" | "error">(
    "loading-clubs"
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadClubs(): Promise<void> {
      try {
        const response = await fetch("/api/match-engine/clubs");
        if (!response.ok) {
          throw new Error(`Club request failed with ${response.status}`);
        }
        const loadedClubs = (await response.json()) as Fc25Club[];
        if (cancelled) {
          return;
        }
        setClubs(loadedClubs);
        setHomeClubId(preferredClubId(loadedClubs, "liverpool") ?? loadedClubs[0]?.id ?? "");
        setAwayClubId(
          preferredClubId(loadedClubs, "manchester-city") ??
            loadedClubs.find((club) => club.id !== loadedClubs[0]?.id)?.id ??
            ""
        );
        setStatus("idle");
      } catch (requestError) {
        if (cancelled) {
          return;
        }
        setStatus("error");
        setError(requestError instanceof Error ? requestError.message : "Could not load clubs");
      }
    }

    void loadClubs();

    return () => {
      cancelled = true;
    };
  }, []);

  const canRun = useMemo(
    () => status !== "running" && homeClubId.length > 0 && awayClubId.length > 0 && seed.length > 0,
    [awayClubId, homeClubId, seed, status]
  );

  async function runSimulation(): Promise<void> {
    setStatus("running");
    setError(null);
    setRunErrors([]);

    try {
      const parsedSeed = Number(seed);
      if (!Number.isInteger(parsedSeed) || parsedSeed < 1) {
        throw new Error("Seed must be a positive integer");
      }

      const response = await fetch("/api/match-engine/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          home: { clubId: homeClubId, tactics: homeTactics },
          away: { clubId: awayClubId, tactics: awayTactics },
          seed: parsedSeed,
          batch
        })
      });
      const payload = (await response.json()) as SimResponse | { error: string };

      if (!response.ok || "error" in payload) {
        throw new Error(
          "error" in payload ? payload.error : `Simulation failed with ${response.status}`
        );
      }

      setHistory((current) => [...payload.runs, ...current]);
      setRunErrors(payload.errors);
      setStatus("idle");
    } catch (requestError) {
      setStatus("error");
      setError(requestError instanceof Error ? requestError.message : "Simulation failed");
    }
  }

  function updateTactics(side: TeamSide, nextTactics: TeamTactics): void {
    if (side === "home") {
      setHomeTactics(nextTactics);
    } else {
      setAwayTactics(nextTactics);
    }
  }

  return (
    <main className="sim-runner-shell">
      <header className="sim-runner-header">
        <div>
          <p className="eyebrow">Match Visualiser</p>
          <h1>FC25 Sim Runner</h1>
          <p className="sim-runner-note">Second-half simulations only: 900 ticks, 0-0 start.</p>
        </div>
        <a className="sim-runner-link" href="/visualise">
          Replay panel
        </a>
      </header>

      {error ? <p className="error">{error}</p> : null}
      {clubs.length === 0 && status !== "loading-clubs" ? (
        <p className="sim-runner-empty">No active FC25 dataset found. Import FC25 data first.</p>
      ) : null}

      <section className="sim-runner-grid" aria-label="Simulation setup">
        <TeamPanel
          title="Home"
          clubs={clubs}
          clubId={homeClubId}
          tactics={homeTactics}
          onClubChange={setHomeClubId}
          onTacticsChange={(nextTactics) => updateTactics("home", nextTactics)}
        />
        <TeamPanel
          title="Away"
          clubs={clubs}
          clubId={awayClubId}
          tactics={awayTactics}
          onClubChange={setAwayClubId}
          onTacticsChange={(nextTactics) => updateTactics("away", nextTactics)}
        />
      </section>

      <section className="sim-runner-controls" aria-label="Run controls">
        <label>
          Seed
          <input
            type="number"
            min="1"
            value={seed}
            onChange={(event) => setSeed(event.target.value)}
          />
        </label>
        <button type="button" onClick={() => setSeed(String(randomSeed()))}>
          Random seed
        </button>
        <label>
          Batch
          <select
            value={batch}
            onChange={(event) => setBatch(Number(event.target.value) as 1 | 50)}
          >
            <option value={1}>1 run</option>
            <option value={50}>50 runs</option>
          </select>
        </label>
        <button type="button" onClick={() => void runSimulation()} disabled={!canRun}>
          {status === "running" ? "Running..." : "Run simulation"}
        </button>
      </section>

      {runErrors.length > 0 ? (
        <section className="sim-runner-errors" aria-label="Batch errors">
          <h2>Batch errors</h2>
          <ul>
            {runErrors.map((runError) => (
              <li key={runError.seed}>
                Seed {runError.seed}: {runError.error}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="sim-runner-history" aria-label="Run history">
        <h2>Run history</h2>
        {history.length === 0 ? (
          <p>No runs yet.</p>
        ) : (
          <div className="sim-runner-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Seed</th>
                  <th>Score</th>
                  <th>Shots</th>
                  <th>Fouls</th>
                  <th>Cards</th>
                  <th>Possession</th>
                  <th>Replay</th>
                </tr>
              </thead>
              <tbody>
                {history.map((run) => (
                  <tr key={`${run.seed}:${run.artefactId}`}>
                    <td>{run.seed}</td>
                    <td>
                      {run.summary.score.home}-{run.summary.score.away}
                    </td>
                    <td>
                      {run.summary.shots.home}/{run.summary.shots.away}
                    </td>
                    <td>
                      {run.summary.fouls.home}/{run.summary.fouls.away}
                    </td>
                    <td>
                      {run.summary.cards.home}/{run.summary.cards.away}
                    </td>
                    <td>
                      {run.summary.possession.home}%/{run.summary.possession.away}%
                    </td>
                    <td>
                      <a href={`/visualise?artifact=${encodeURIComponent(run.artefactId)}`}>
                        Open replay
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

function TeamPanel({
  title,
  clubs,
  clubId,
  tactics,
  onClubChange,
  onTacticsChange
}: {
  title: string;
  clubs: Fc25Club[];
  clubId: string;
  tactics: TeamTactics;
  onClubChange: (clubId: string) => void;
  onTacticsChange: (tactics: TeamTactics) => void;
}) {
  return (
    <section className="sim-runner-panel" aria-label={`${title} team setup`}>
      <h2>{title}</h2>
      <label>
        Club
        <select value={clubId} onChange={(event) => onClubChange(event.target.value)}>
          {clubs.map((club) => (
            <option key={club.id} value={club.id}>
              {club.name}
            </option>
          ))}
        </select>
      </label>
      <TacticsControls tactics={tactics} onChange={onTacticsChange} />
    </section>
  );
}

function TacticsControls({
  tactics,
  onChange
}: {
  tactics: TeamTactics;
  onChange: (tactics: TeamTactics) => void;
}) {
  return (
    <div className="sim-runner-tactics">
      <SelectField
        label="Formation"
        value={tactics.formation}
        options={FORMATIONS}
        onChange={(formation) => onChange({ ...tactics, formation })}
      />
      <SelectField
        label="Mentality"
        value={tactics.mentality}
        options={MENTALITIES}
        onChange={(mentality) => onChange({ ...tactics, mentality })}
      />
      <SelectField
        label="Tempo"
        value={tactics.tempo}
        options={TEMPOS}
        onChange={(tempo) => onChange({ ...tactics, tempo })}
      />
      <SelectField
        label="Pressing"
        value={tactics.pressing}
        options={PRESSING_LEVELS}
        onChange={(pressing) => onChange({ ...tactics, pressing })}
      />
      <SelectField
        label="Line height"
        value={tactics.lineHeight}
        options={LINE_HEIGHTS}
        onChange={(lineHeight) => onChange({ ...tactics, lineHeight })}
      />
      <SelectField
        label="Width"
        value={tactics.width}
        options={WIDTHS}
        onChange={(width) => onChange({ ...tactics, width })}
      />
    </div>
  );
}

function SelectField<T extends string>({
  label,
  value,
  options,
  onChange
}: {
  label: string;
  value: T;
  options: readonly T[];
  onChange: (value: T) => void;
}) {
  return (
    <label>
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value as T)}>
        {options.map((option) => (
          <option key={option} value={option}>
            {formatOption(option)}
          </option>
        ))}
      </select>
    </label>
  );
}

function preferredClubId(clubs: Fc25Club[], clubId: string): string | null {
  return clubs.find((club) => club.id === clubId)?.id ?? null;
}

function randomSeed(): number {
  return Math.floor(Math.random() * 999_999) + 1;
}

function formatOption(value: string): string {
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
