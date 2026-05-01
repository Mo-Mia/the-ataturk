import { useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import type { MatchSnapshot, MatchTick, SemanticEvent, TeamId } from "@the-ataturk/match-engine";

const PITCH_WIDTH = 680;
const PITCH_LENGTH = 1050;
const SPEEDS = [1, 4, 16, "instant"] as const;
type ReplaySpeed = (typeof SPEEDS)[number];

export function VisualiserPage() {
  const [snapshot, setSnapshot] = useState<MatchSnapshot | null>(null);
  const [tickIndex, setTickIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<ReplaySpeed>(4);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<number | null>(null);

  const currentTick = snapshot?.ticks[tickIndex] ?? null;
  const stats = useMemo(
    () => (snapshot && currentTick ? statsForReplay(snapshot.ticks.slice(0, tickIndex + 1)) : null),
    [currentTick, snapshot, tickIndex]
  );

  useEffect(() => {
    if (!playing || !snapshot) {
      clearReplayInterval(intervalRef);
      return;
    }

    if (speed === "instant") {
      setTickIndex(snapshot.ticks.length - 1);
      setPlaying(false);
      return;
    }

    clearReplayInterval(intervalRef);
    intervalRef.current = window.setInterval(() => {
      setTickIndex((previous) => {
        const next = Math.min(previous + speed, snapshot.ticks.length - 1);
        if (next >= snapshot.ticks.length - 1) {
          setPlaying(false);
        }
        return next;
      });
    }, 300);

    return () => clearReplayInterval(intervalRef);
  }, [playing, snapshot, speed]);

  async function handleFile(file: File | undefined): Promise<void> {
    if (!file) {
      return;
    }

    try {
      const parsed = JSON.parse(await file.text()) as MatchSnapshot;
      validateSnapshot(parsed);
      setSnapshot(parsed);
      setTickIndex(0);
      setPlaying(false);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Snapshot could not be loaded");
      setSnapshot(null);
    }
  }

  const events = snapshot ? eventsUntil(snapshot.ticks, tickIndex) : [];
  const recentGoal =
    snapshot && currentTick ? recentGoalEvent(snapshot.ticks, tickIndex, currentTick) : null;

  return (
    <main style={styles.page}>
      <section style={styles.stage} aria-label="Snapshot replay visualiser">
        <header style={styles.header}>
          <div>
            <p style={styles.eyebrow}>Match visualiser</p>
            <h1 style={styles.title}>
              {snapshot && currentTick
                ? `${snapshot.meta.homeTeam.shortName} ${currentTick.score.home}-${currentTick.score.away} ${snapshot.meta.awayTeam.shortName}`
                : "Load snapshot"}
            </h1>
            <p style={styles.clock}>{currentTick ? formatClock(currentTick) : "45:00"}</p>
          </div>
          <label style={styles.fileButton}>
            JSON
            <input
              aria-label="Load snapshot JSON"
              type="file"
              accept="application/json,.json"
              style={styles.fileInput}
              onChange={(event) => void handleFile(event.currentTarget.files?.[0])}
            />
          </label>
        </header>

        {error ? <p style={styles.error}>{error}</p> : null}

        <div
          style={styles.dropZone}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            void handleFile(event.dataTransfer.files[0]);
          }}
        >
          {snapshot && currentTick ? (
            <div style={styles.pitchWrap}>
              <Pitch snapshot={snapshot} tick={currentTick} />
              {recentGoal ? (
                <GoalOverlay
                  snapshot={snapshot}
                  event={recentGoal.event}
                  score={recentGoal.score}
                />
              ) : null}
            </div>
          ) : (
            <p style={styles.empty}>Drop a MatchSnapshot JSON file here.</p>
          )}
        </div>

        <div style={styles.controls}>
          <button
            type="button"
            onClick={() => setPlaying((value) => !value)}
            disabled={!snapshot}
            style={styles.button}
          >
            {playing ? "Pause" : "Play"}
          </button>
          <input
            aria-label="Replay timeline"
            type="range"
            min={0}
            max={snapshot ? snapshot.ticks.length - 1 : 0}
            value={tickIndex}
            disabled={!snapshot}
            onChange={(event) => {
              setPlaying(false);
              setTickIndex(Number(event.currentTarget.value));
            }}
            style={styles.slider}
          />
          <span style={styles.clock}>{currentTick ? formatClock(currentTick) : "45:00"}</span>
          <select
            aria-label="Replay speed"
            value={String(speed)}
            onChange={(event) => setSpeed(parseSpeed(event.currentTarget.value))}
            style={styles.select}
          >
            {SPEEDS.map((value) => (
              <option key={String(value)} value={String(value)}>
                {value === "instant" ? "Instant" : `${value}x`}
              </option>
            ))}
          </select>
        </div>
      </section>

      <aside style={styles.sidePanel}>
        <section aria-label="Replay statistics" style={styles.panelSection}>
          <h2 style={styles.panelTitle}>Stats</h2>
          {snapshot && currentTick && stats ? (
            <StatsPanel snapshot={snapshot} tick={currentTick} stats={stats} />
          ) : (
            <p style={styles.muted}>No snapshot loaded.</p>
          )}
        </section>
        <section aria-label="Event log" style={styles.panelSection}>
          <h2 style={styles.panelTitle}>Events</h2>
          {snapshot ? (
            <EventLog snapshot={snapshot} events={events} />
          ) : (
            <p style={styles.muted}>No events.</p>
          )}
        </section>
      </aside>
    </main>
  );
}

function Pitch({ snapshot, tick }: { snapshot: MatchSnapshot; tick: MatchTick }) {
  return (
    <svg
      viewBox={`0 0 ${PITCH_WIDTH} ${PITCH_LENGTH}`}
      style={styles.pitch}
      role="img"
      aria-label="Football pitch"
    >
      <rect x="0" y="0" width={PITCH_WIDTH} height={PITCH_LENGTH} fill="#2f7d48" />
      <rect
        x="8"
        y="8"
        width={PITCH_WIDTH - 16}
        height={PITCH_LENGTH - 16}
        fill="none"
        stroke="#fff"
        strokeWidth="3"
      />
      <line
        x1="8"
        y1={PITCH_LENGTH / 2}
        x2={PITCH_WIDTH - 8}
        y2={PITCH_LENGTH / 2}
        stroke="#fff"
        strokeWidth="3"
      />
      <circle
        cx={PITCH_WIDTH / 2}
        cy={PITCH_LENGTH / 2}
        r="92"
        fill="none"
        stroke="#fff"
        strokeWidth="3"
      />
      <circle cx={PITCH_WIDTH / 2} cy={PITCH_LENGTH / 2} r="5" fill="#fff" />
      <rect x="140" y="8" width="400" height="165" fill="none" stroke="#fff" strokeWidth="3" />
      <rect x="248" y="8" width="184" height="56" fill="none" stroke="#fff" strokeWidth="3" />
      <rect
        x="140"
        y={PITCH_LENGTH - 173}
        width="400"
        height="165"
        fill="none"
        stroke="#fff"
        strokeWidth="3"
      />
      <rect
        x="248"
        y={PITCH_LENGTH - 64}
        width="184"
        height="56"
        fill="none"
        stroke="#fff"
        strokeWidth="3"
      />
      <line x1="295" y1="0" x2="385" y2="0" stroke="#fff" strokeWidth="7" />
      <line x1="295" y1={PITCH_LENGTH} x2="385" y2={PITCH_LENGTH} stroke="#fff" strokeWidth="7" />

      {tick.players.map((player) => (
        <PlayerCircle key={player.id} snapshot={snapshot} player={player} />
      ))}
      <circle
        cx={tick.ball.position[0]}
        cy={tick.ball.position[1]}
        r="7"
        fill="#fff"
        stroke="#111"
        strokeWidth="2"
        style={styles.moving}
      />
    </svg>
  );
}

function GoalOverlay({
  snapshot,
  event,
  score
}: {
  snapshot: MatchSnapshot;
  event: SemanticEvent;
  score: { home: number; away: number };
}) {
  const opponent =
    event.team === "home" ? snapshot.meta.awayTeam.shortName : snapshot.meta.homeTeam.shortName;

  return (
    <div style={styles.goalOverlay} role="status" aria-live="polite">
      <strong>GOAL!</strong> {teamName(snapshot, event.team)} {score.home}-{score.away} {opponent}
      {" | scored by "}
      {event.playerId ? playerName(snapshot, event.team, event.playerId) : "unknown"} at{" "}
      {event.minute}:{String(event.second).padStart(2, "0")}
    </div>
  );
}

function PlayerCircle({
  snapshot,
  player
}: {
  snapshot: MatchSnapshot;
  player: MatchTick["players"][number];
}) {
  if (!player.onPitch) {
    return null;
  }

  const rosterPlayer = snapshot.meta.rosters[player.teamId].find(
    (candidate) => candidate.id === player.id
  );
  const isGoalkeeper = rosterPlayer?.position === "GK";
  const fill = isGoalkeeper ? "#f4c542" : player.teamId === "home" ? "#c8102e" : "#f8f8f8";
  const textFill = player.teamId === "home" || isGoalkeeper ? "#fff" : "#111";

  return (
    <g style={styles.moving}>
      <circle
        cx={player.position[0]}
        cy={player.position[1]}
        r={isGoalkeeper ? 15 : 13}
        fill={fill}
        stroke={player.teamId === "home" ? "#fff" : "#111"}
        strokeWidth="3"
      />
      <text
        x={player.position[0]}
        y={player.position[1] + 5}
        textAnchor="middle"
        fontSize="12"
        fontFamily="Arial, sans-serif"
        fontWeight="700"
        fill={textFill}
      >
        {rosterPlayer?.squadNumber ?? ""}
      </text>
    </g>
  );
}

function StatsPanel({
  snapshot,
  tick,
  stats
}: {
  snapshot: MatchSnapshot;
  tick: MatchTick;
  stats: ReplayStats;
}) {
  return (
    <div style={styles.statsGrid}>
      <strong>{snapshot.meta.homeTeam.shortName}</strong>
      <strong>{tick.score.home}</strong>
      <strong>{tick.score.away}</strong>
      <strong>{snapshot.meta.awayTeam.shortName}</strong>
      <span>Possession</span>
      <span>
        {stats.possession.home}% / {stats.possession.away}%
      </span>
      <span>Shots</span>
      <span>
        {stats.home.shots} / {stats.away.shots}
      </span>
      <span>Fouls</span>
      <span>
        {stats.home.fouls} / {stats.away.fouls}
      </span>
      <span>Cards</span>
      <span>
        {stats.home.cards} / {stats.away.cards}
      </span>
    </div>
  );
}

function EventLog({ snapshot, events }: { snapshot: MatchSnapshot; events: SemanticEvent[] }) {
  if (events.length === 0) {
    return <p style={styles.muted}>No events yet.</p>;
  }

  return (
    <ol style={styles.eventList}>
      {events
        .slice()
        .reverse()
        .map((event, index) => (
          <li
            key={`${event.minute}-${event.second}-${event.type}-${index}`}
            style={styles.eventItem}
          >
            <strong>
              {event.minute}:{String(event.second).padStart(2, "0")}
            </strong>{" "}
            {eventLabel(event)}
            {event.type === "full_time" ? "" : ` · ${teamName(snapshot, event.team)}`}
            {event.playerId ? ` · ${playerName(snapshot, event.team, event.playerId)}` : ""}
            {event.detail ? (
              <span style={styles.eventDetail}> {formatEventDetail(snapshot, event)}</span>
            ) : null}
          </li>
        ))}
    </ol>
  );
}

interface ReplayStats {
  home: { shots: number; fouls: number; cards: number };
  away: { shots: number; fouls: number; cards: number };
  possession: { home: number; away: number };
}

function statsForReplay(ticks: MatchTick[]): ReplayStats {
  const stats: ReplayStats = {
    home: { shots: 0, fouls: 0, cards: 0 },
    away: { shots: 0, fouls: 0, cards: 0 },
    possession: { home: 50, away: 50 }
  };

  for (const tick of ticks) {
    if (tick.possession.teamId) {
      stats.possession[tick.possession.teamId] += 1;
    }
    for (const event of tick.events) {
      if (event.type === "shot") {
        stats[event.team].shots += 1;
      } else if (event.type === "foul") {
        stats[event.team].fouls += 1;
      } else if (event.type === "yellow" || event.type === "red") {
        stats[event.team].cards += 1;
      }
    }
  }

  const possessionTicks = stats.possession.home + stats.possession.away - 100;
  if (possessionTicks > 0) {
    const homeTicks = stats.possession.home - 50;
    stats.possession.home = Math.round((homeTicks / possessionTicks) * 100);
    stats.possession.away = 100 - stats.possession.home;
  }

  return stats;
}

function eventsUntil(ticks: MatchTick[], tickIndex: number): SemanticEvent[] {
  return ticks.slice(0, tickIndex + 1).flatMap((tick) => tick.events);
}

function recentGoalEvent(
  ticks: MatchTick[],
  tickIndex: number,
  currentTick: MatchTick
): { event: SemanticEvent; score: { home: number; away: number } } | null {
  const recentTicks = ticks.slice(Math.max(0, tickIndex - 4), tickIndex + 1);

  for (let index = recentTicks.length - 1; index >= 0; index -= 1) {
    const event = recentTicks[index]!.events.slice()
      .reverse()
      .find((candidate) => isGoalEvent(candidate));
    if (event) {
      return { event, score: scoreFromGoalEvent(event) ?? currentTick.score };
    }
  }

  return null;
}

function isGoalEvent(event: SemanticEvent): boolean {
  return event.type === "goal_scored" || event.type === "goal";
}

function scoreFromGoalEvent(event: SemanticEvent): { home: number; away: number } | null {
  const score = event.detail?.score;
  if (
    typeof score === "object" &&
    score !== null &&
    "home" in score &&
    "away" in score &&
    typeof score.home === "number" &&
    typeof score.away === "number"
  ) {
    return { home: score.home, away: score.away };
  }

  return null;
}

function formatClock(tick: MatchTick): string {
  return `${tick.matchClock.minute}:${String(tick.matchClock.seconds).padStart(2, "0")}`;
}

function playerName(snapshot: MatchSnapshot, team: TeamId, playerId: string): string {
  return (
    snapshot.meta.rosters[team].find((player) => player.id === playerId)?.shortName ?? playerId
  );
}

function teamName(snapshot: MatchSnapshot, team: TeamId): string {
  return team === "home" ? snapshot.meta.homeTeam.shortName : snapshot.meta.awayTeam.shortName;
}

function formatEventDetail(snapshot: MatchSnapshot, event: SemanticEvent): string {
  if (!event.detail) {
    return "";
  }

  if (event.type === "shot") {
    const outcome = event.detail.onTarget ? "on target" : "off target";
    const parts = [
      detailString(event.detail.distanceBand, ""),
      detailString(event.detail.shotType, ""),
      pressureText(event.detail.pressure),
      detailString(event.detail.foot, ""),
      typeof event.detail.distanceToGoalMetres === "number"
        ? `${event.detail.distanceToGoalMetres}m`
        : ""
    ].filter(Boolean);
    return `(${[outcome, ...parts].join(", ")})`;
  }

  if (isGoalEvent(event)) {
    const score = event.detail?.score;
    const parts = [
      score ? detailScore(score) : "",
      detailString(event.detail.distanceBand, ""),
      detailString(event.detail.shotType, "")
    ].filter(Boolean);
    return parts.length > 0 ? `(${parts.join(", ")})` : "";
  }

  if (event.type === "save") {
    const parts = [detailString(event.detail.quality, ""), resultText(event.detail.result)].filter(
      Boolean
    );
    return parts.length > 0 ? `(${parts.join(", ")})` : "";
  }

  if (event.type === "foul") {
    const parts = [
      detailString(event.detail.severity, ""),
      detailString(event.detail.tackleType, ""),
      zoneLabel(event.detail.location)
    ].filter(Boolean);
    return parts.length > 0 ? `(${parts.join(", ")})` : "";
  }

  if (event.type === "pass") {
    const target =
      typeof event.detail.targetPlayerId === "string"
        ? `to ${playerNameById(snapshot, event.detail.targetPlayerId)}`
        : "";
    const parts = [
      target,
      detailString(event.detail.passType, ""),
      event.detail.progressive === true ? "progressive" : "",
      event.detail.keyPass === true ? "key pass" : "",
      event.detail.complete === false ? "incomplete" : ""
    ].filter(Boolean);
    return parts.length > 0 ? `(${parts.join(", ")})` : "";
  }

  if (event.type === "carry") {
    const parts = [
      detailString(event.detail.carryType, ""),
      event.detail.progressive === true ? "progressive" : "",
      detailString(event.detail.flank, ""),
      zoneLabel(event.detail.zone)
    ].filter(Boolean);
    return parts.length > 0 ? `(${parts.join(", ")})` : "";
  }

  if (event.type === "throw_in") {
    return `(${detailString(event.detail.reason, "out of play")})`;
  }

  if (event.type === "red") {
    return `(${detailString(event.detail.reason, "sent off")})`;
  }

  if (event.type === "yellow") {
    return event.detail.cardCount === 2 ? "(second booking)" : "";
  }

  if (event.type === "possession_change") {
    return `(${possessionChangeText(snapshot, event)})`;
  }

  if (event.type === "full_time") {
    const score = event.detail.finalScore;
    return score ? `(${detailScore(score)})` : "";
  }

  return "";
}

function eventLabel(event: SemanticEvent): string {
  if (event.type === "full_time") {
    return "Full time";
  }
  return event.type.replaceAll("_", " ");
}

function detailString(value: unknown, fallback: string): string {
  return typeof value === "string" || typeof value === "number" ? String(value) : fallback;
}

function pressureText(value: unknown): string {
  return typeof value === "string" ? `${value} pressure` : "";
}

function resultText(value: unknown): string {
  return typeof value === "string" ? value.replaceAll("_", " ") : "";
}

function zoneLabel(value: unknown): string {
  if (value === "def") {
    return "defensive third";
  }
  if (value === "mid") {
    return "midfield";
  }
  if (value === "att") {
    return "attacking third";
  }
  return "";
}

function possessionChangeText(snapshot: MatchSnapshot, event: SemanticEvent): string {
  const detail = event.detail;
  if (!detail) {
    return "cause unknown";
  }

  const winner = event.playerId ? playerName(snapshot, event.team, event.playerId) : "new carrier";
  const loser =
    typeof detail.previousPossessor === "string"
      ? playerNameById(snapshot, detail.previousPossessor)
      : "previous carrier";
  const zone = zoneLabel(detail.zone);
  const suffix = zone ? `, ${zone}` : "";

  switch (detail.cause) {
    case "successful_tackle":
      return `${winner} tackled ${loser}${suffix}`;
    case "failed_dribble":
      return `${loser} lost a dribble to ${winner}${suffix}`;
    case "intercepted_pass":
      return `${winner} intercepted ${loser}${suffix}`;
    case "loose_ball_recovered":
      return `${winner} recovered a loose ball${suffix}`;
    case "clearance_recovered":
      return `${winner} recovered a clearance${suffix}`;
    case "goalkeeper_save":
      return `${winner} claimed after a save${suffix}`;
    case "shot_blocked":
      return `${winner} recovered after a block${suffix}`;
    case "foul_against_carrier":
      return `${winner} won a free kick${suffix}`;
    case "restart_throw_in":
      return `${winner} restarts with a throw-in${suffix}`;
    case "restart_goal_kick":
      return `${winner} restarts with a goal kick${suffix}`;
    case "restart_corner":
      return `${winner} restarts with a corner${suffix}`;
    case "kickoff_after_goal":
      return `${winner} kicks off after the goal${suffix}`;
    case "kickoff_match_start":
      return `${winner} takes the kick-off${suffix}`;
    default:
      return `cause unknown; ${detailString(detail.from, "?")} to ${detailString(detail.to, "?")}`;
  }
}

function detailScore(value: unknown): string {
  if (
    typeof value === "object" &&
    value !== null &&
    "home" in value &&
    "away" in value &&
    typeof value.home === "number" &&
    typeof value.away === "number"
  ) {
    return `${value.home}-${value.away}`;
  }

  return "";
}

function playerNameById(snapshot: MatchSnapshot, playerId: string): string {
  return (
    snapshot.meta.rosters.home.find((player) => player.id === playerId)?.shortName ??
    snapshot.meta.rosters.away.find((player) => player.id === playerId)?.shortName ??
    playerId
  );
}

function validateSnapshot(snapshot: MatchSnapshot): void {
  if (!Array.isArray(snapshot.ticks) || snapshot.ticks.length === 0) {
    throw new Error("Snapshot has no ticks");
  }
}

function parseSpeed(value: string): ReplaySpeed {
  if (value === "instant") {
    return "instant";
  }
  if (value === "1" || value === "4" || value === "16") {
    return Number(value) as ReplaySpeed;
  }
  return 4;
}

function clearReplayInterval(ref: MutableRefObject<number | null>): void {
  if (ref.current !== null) {
    window.clearInterval(ref.current);
    ref.current = null;
  }
}

const styles = {
  page: {
    minHeight: "100vh",
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) 360px",
    background: "#17201b",
    color: "#f5f7f5",
    fontFamily: "Arial, sans-serif"
  },
  stage: { padding: "18px", minWidth: 0 },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px" },
  eyebrow: { margin: 0, color: "#aeb8b1", fontSize: "13px", textTransform: "uppercase" as const },
  title: { margin: "4px 0", fontSize: "28px", lineHeight: 1.1 },
  clock: { margin: 0, color: "#d8ded9", fontVariantNumeric: "tabular-nums" as const },
  fileButton: {
    position: "relative" as const,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "64px",
    height: "36px",
    border: "1px solid #d8ded9",
    cursor: "pointer"
  },
  fileInput: { position: "absolute" as const, inset: 0, opacity: 0, cursor: "pointer" },
  error: { color: "#ffb4a8" },
  dropZone: {
    marginTop: "16px",
    height: "calc(100vh - 150px)",
    minHeight: "520px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    border: "1px solid #3f5045",
    background: "#203027"
  },
  empty: { color: "#c7d0ca" },
  pitchWrap: {
    position: "relative" as const,
    height: "100%",
    maxWidth: "100%",
    display: "flex",
    justifyContent: "center"
  },
  pitch: { height: "100%", maxWidth: "100%", display: "block" },
  goalOverlay: {
    position: "absolute" as const,
    top: "20px",
    left: "50%",
    transform: "translateX(-50%)",
    minWidth: "320px",
    maxWidth: "calc(100% - 32px)",
    padding: "14px 18px",
    textAlign: "center" as const,
    background: "#f5f7f5",
    color: "#111",
    border: "3px solid #f4c542",
    fontSize: "20px",
    fontWeight: 700,
    boxShadow: "0 8px 18px rgba(0, 0, 0, 0.35)"
  },
  moving: { transition: "cx 0.3s linear, cy 0.3s linear, x 0.3s linear, y 0.3s linear" },
  controls: { marginTop: "12px", display: "flex", alignItems: "center", gap: "12px" },
  button: { height: "34px", minWidth: "72px" },
  slider: { flex: 1 },
  select: { height: "34px" },
  sidePanel: { borderLeft: "1px solid #3f5045", padding: "18px", overflowY: "auto" as const },
  panelSection: { marginBottom: "24px" },
  panelTitle: { margin: "0 0 10px", fontSize: "18px" },
  statsGrid: { display: "grid", gridTemplateColumns: "1fr auto auto 1fr", gap: "8px 12px" },
  muted: { color: "#aeb8b1" },
  eventList: { listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "8px" },
  eventItem: { padding: "8px", background: "#23352a", borderLeft: "3px solid #d8ded9" },
  eventDetail: { color: "#aeb8b1" }
};
