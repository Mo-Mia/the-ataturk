import { useState } from "react";

type RequestState = "idle" | "loading" | "success" | "error";

interface HealthResponse {
  status: "ok";
  timestamp: string;
}

interface ShotStatistics {
  total: number;
  on: number;
  off: number;
}

interface TeamStatistics {
  goals: number;
  shots: ShotStatistics;
  corners: number;
  freekicks: number;
  penalties: number;
  fouls: number;
}

interface TeamSummary {
  name: string;
}

interface SmokeMatchResponse {
  kickOffTeam: TeamSummary;
  secondTeam: TeamSummary;
  kickOffTeamStatistics: TeamStatistics;
  secondTeamStatistics: TeamStatistics;
  iterationLog: string[];
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);

  if (!response.ok) {
    throw new Error(`Request failed with ${response.status}`);
  }

  return (await response.json()) as T;
}

function ScoreLine({ match }: { match: SmokeMatchResponse }) {
  return (
    <p className="scoreline">
      {match.kickOffTeam.name} {match.kickOffTeamStatistics.goals}-
      {match.secondTeamStatistics.goals} {match.secondTeam.name}
    </p>
  );
}

function StatisticsTable({ match }: { match: SmokeMatchResponse }) {
  const rows = [
    ["Shots", match.kickOffTeamStatistics.shots.total, match.secondTeamStatistics.shots.total],
    ["Shots on target", match.kickOffTeamStatistics.shots.on, match.secondTeamStatistics.shots.on],
    ["Corners", match.kickOffTeamStatistics.corners, match.secondTeamStatistics.corners],
    ["Free kicks", match.kickOffTeamStatistics.freekicks, match.secondTeamStatistics.freekicks],
    ["Penalties", match.kickOffTeamStatistics.penalties, match.secondTeamStatistics.penalties],
    ["Fouls", match.kickOffTeamStatistics.fouls, match.secondTeamStatistics.fouls]
  ] as const;

  return (
    <table>
      <thead>
        <tr>
          <th>Statistic</th>
          <th>{match.kickOffTeam.name}</th>
          <th>{match.secondTeam.name}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(([label, home, away]) => (
          <tr key={label}>
            <td>{label}</td>
            <td>{home}</td>
            <td>{away}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function App() {
  const [healthState, setHealthState] = useState<RequestState>("idle");
  const [matchState, setMatchState] = useState<RequestState>("idle");
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [match, setMatch] = useState<SmokeMatchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runHealthCheck(): Promise<void> {
    setHealthState("loading");
    setError(null);

    try {
      setHealth(await requestJson<HealthResponse>("/api/health"));
      setHealthState("success");
    } catch (requestError) {
      setHealthState("error");
      setError(requestError instanceof Error ? requestError.message : "Health check failed");
    }
  }

  async function runMatch(): Promise<void> {
    setMatchState("loading");
    setError(null);

    try {
      setMatch(
        await requestJson<SmokeMatchResponse>("/api/smoke-test/match", {
          method: "POST"
        })
      );
      setMatchState("success");
    } catch (requestError) {
      setMatchState("error");
      setError(requestError instanceof Error ? requestError.message : "Match run failed");
    }
  }

  return (
    <main>
      <header>
        <p className="eyebrow">The Atatürk</p>
        <h1>Smoke Test</h1>
      </header>

      <section className="controls" aria-label="Smoke test controls">
        <button
          type="button"
          onClick={() => void runHealthCheck()}
          disabled={healthState === "loading"}
        >
          {healthState === "loading" ? "Checking..." : "Health check"}
        </button>
        <button type="button" onClick={() => void runMatch()} disabled={matchState === "loading"}>
          {matchState === "loading" ? "Running match..." : "Run match"}
        </button>
      </section>

      {error ? <p className="error">{error}</p> : null}

      <section aria-label="Health response">
        <h2>Health</h2>
        <pre>{health ? JSON.stringify(health, null, 2) : "No health check run yet."}</pre>
      </section>

      <section aria-label="Match response">
        <h2>Match</h2>
        {match ? (
          <>
            <ScoreLine match={match} />
            <StatisticsTable match={match} />
            <h3>Iteration log</h3>
            <pre>{match.iterationLog.join("\n")}</pre>
          </>
        ) : (
          <pre>No match run yet.</pre>
        )}
      </section>
    </main>
  );
}
