import { useEffect, useRef, useState } from "react";

import {
  runMatchStream,
  type FinalMatchSummary,
  type MatchDetails,
  type MatchScore,
  type MatchTick,
  type SemanticEvent
} from "./api";

interface EventLogItem {
  id: string;
  text: string;
}

const INITIAL_SCORE: MatchScore = {
  home: {
    club_id: "liverpool",
    name: "Liverpool",
    goals: 0
  },
  away: {
    club_id: "ac-milan",
    name: "AC Milan",
    goals: 3
  }
};

export function MatchPage() {
  const [fastForward, setFastForward] = useState(false);
  const [runState, setRunState] = useState<"idle" | "running" | "finished" | "error">("idle");
  const [currentTick, setCurrentTick] = useState<MatchTick | null>(null);
  const [eventLog, setEventLog] = useState<EventLogItem[]>([]);
  const [finalSummary, setFinalSummary] = useState<FinalMatchSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(
    () => () => {
      abortControllerRef.current?.abort();
    },
    []
  );

  async function kickOff(): Promise<void> {
    abortControllerRef.current?.abort();
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    setRunState("running");
    setCurrentTick(null);
    setEventLog([]);
    setFinalSummary(null);
    setError(null);

    try {
      const summary = await runMatchStream(
        {
          fastForward,
          signal: abortController.signal
        },
        (streamEvent) => {
          if (streamEvent.event === "tick") {
            setCurrentTick(streamEvent.data);
            if (streamEvent.data.events.length > 0) {
              setEventLog((items) => [
                ...streamEvent.data.events.map((event, index) => ({
                  id: `${streamEvent.data.iteration}-${index}-${event.type}`,
                  text: formatEvent(event, streamEvent.data.matchDetails)
                })),
                ...items
              ].slice(0, 200));
            }
          }

          if (streamEvent.event === "final") {
            setFinalSummary(streamEvent.data);
            setRunState("finished");
          }

          if (streamEvent.event === "error") {
            setError(streamEvent.data.error);
            setRunState("error");
          }
        }
      );

      setFinalSummary(summary);
      setRunState("finished");
    } catch (matchError) {
      if (abortController.signal.aborted) {
        return;
      }

      setError(matchError instanceof Error ? matchError.message : "Match run failed");
      setRunState("error");
    }
  }

  const score = currentTick?.score ?? INITIAL_SCORE;
  const clock = currentTick?.matchClock ?? { half: 2, minute: 45, seconds: 0 };

  return (
    <main className="match-shell">
      <header>
        <p className="eyebrow">The Atatürk</p>
        <h1>The Atatürk - 2nd half kickoff</h1>
      </header>

      <section className="match-scoreboard" aria-label="Match scoreboard">
        <p className="match-clock">{formatClock(clock.minute, clock.seconds)}</p>
        <p className="scoreline">
          {score.home.name} {score.home.goals}-{score.away.goals} {score.away.name}
        </p>
      </section>

      <section className="controls" aria-label="Match controls">
        <button type="button" onClick={() => void kickOff()} disabled={runState === "running"}>
          {runState === "running" ? "Match running..." : runState === "finished" ? "Replay" : "Kick off"}
        </button>
        <label className="match-toggle">
          <input
            checked={fastForward}
            disabled={runState === "running"}
            onChange={(event) => setFastForward(event.target.checked)}
            type="checkbox"
          />
          Fast-forward (dev-only)
        </label>
      </section>

      {error ? <p className="error">{error}</p> : null}

      {finalSummary ? (
        <section aria-label="Final score">
          <h2>Full time</h2>
          <p className="scoreline">
            Liverpool {finalSummary.finalScore.home}-{finalSummary.finalScore.away} AC Milan
          </p>
          <p>
            Final clock: {formatClock(finalSummary.finalClock.minute, finalSummary.finalClock.seconds)};{" "}
            iterations: {finalSummary.iterations}
          </p>
        </section>
      ) : null}

      <section aria-label="Event log">
        <h2>Event log</h2>
        {eventLog.length === 0 ? (
          <pre>No second-half events yet.</pre>
        ) : (
          <ol className="match-event-log">
            {eventLog.map((event) => (
              <li key={event.id}>{event.text}</li>
            ))}
          </ol>
        )}
      </section>
    </main>
  );
}

function formatEvent(event: SemanticEvent, matchDetails: MatchDetails): string {
  const teamName = event.team === "home" ? "Liverpool" : "Milan";
  const playerName = findPlayerName(matchDetails, event.playerId);
  const playerText = playerName ? ` (${playerName})` : "";
  const detailText = event.detail ? ` ${event.detail.replace("_", " ")}` : "";

  return `${formatClock(event.minute, event.second)} - ${eventLabel(event.type)}${detailText}, ${teamName}${playerText}`;
}

function eventLabel(type: SemanticEvent["type"]): string {
  switch (type) {
    case "goal":
      return "Goal";
    case "shot":
      return "Shot";
    case "save":
      return "Save";
    case "foul":
      return "Foul";
    case "yellow":
      return "Yellow card";
    case "red":
      return "Red card";
  }
}

function findPlayerName(matchDetails: MatchDetails, playerId: string | undefined): string | null {
  if (!playerId) {
    return null;
  }

  const player = [...matchDetails.kickOffTeam.players, ...matchDetails.secondTeam.players].find(
    (candidate) => String(candidate.playerID) === playerId
  );

  return player?.name ?? null;
}

function formatClock(minute: number, seconds: number): string {
  return `${minute}:${seconds.toString().padStart(2, "0")}`;
}
