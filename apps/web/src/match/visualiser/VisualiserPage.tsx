import { useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import type { MatchSnapshot, MatchTick, SemanticEvent, TeamId } from "@the-ataturk/match-engine";
import {
  HeatmapDiagnostics,
  HeatmapPitch,
  RelativePlayerHeatmaps,
  ShapeDiagnostics,
  buildRelativePlayerHeatmap,
  type HeatmapFilter,
  type HeatmapSubject
} from "./components/HeatmapPanel";
import { PITCH_LENGTH, PITCH_WIDTH, PitchMarkings } from "./components/PitchMarkings";
import { StatsPanel, statsForReplay, type ReplayStats } from "./components/StatsPanel";

const SPEEDS = [1, 4, 16, "instant"] as const;
type ReplaySpeed = (typeof SPEEDS)[number];
type ViewMode = "replay" | "heatmap";
type InspectorTab = "stats" | "shape" | "heatmap" | "player";

interface ArtifactFile {
  filename: string;
  sizeBytes: number;
  modifiedAt: string;
}

export function VisualiserPage() {
  const [snapshot, setSnapshot] = useState<MatchSnapshot | null>(null);
  const [tickIndex, setTickIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<ReplaySpeed>(4);
  const [viewMode, setViewMode] = useState<ViewMode>("replay");
  const [heatmapFilter, setHeatmapFilter] = useState<HeatmapFilter>("all");
  const [heatmapSubject, setHeatmapSubject] = useState<HeatmapSubject>("ball");
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>("");
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>("stats");
  const [artifacts, setArtifacts] = useState<ArtifactFile[]>([]);
  const [selectedArtifact, setSelectedArtifact] = useState("");
  const [artifactLoading, setArtifactLoading] = useState(false);
  const [artifactError, setArtifactError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<number | null>(null);

  const currentTick = snapshot?.ticks[tickIndex] ?? null;
  const stats = useMemo(
    () => (snapshot && currentTick ? statsForReplay(snapshot.ticks.slice(0, tickIndex + 1)) : null),
    [currentTick, snapshot, tickIndex]
  );
  const playerOptions = useMemo(() => (snapshot ? rosterOptions(snapshot) : []), [snapshot]);

  useEffect(() => {
    void loadArtifacts();
  }, []);

  useEffect(() => {
    const artifact = new URLSearchParams(window.location.search).get("artifact");
    if (artifact) {
      void handleArtifact(artifact);
    }
  }, []);

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
      loadSnapshot(parsed);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Snapshot could not be loaded");
      setSnapshot(null);
    }
  }

  async function loadArtifacts(): Promise<void> {
    try {
      const response = await fetch("/api/visualiser/artifacts");
      if (!response.ok) {
        throw new Error(`Artifact list failed with ${response.status}`);
      }
      const body = (await response.json()) as { files?: ArtifactFile[] };
      setArtifacts(Array.isArray(body.files) ? body.files : []);
      setArtifactError(null);
    } catch (loadError) {
      setArtifacts([]);
      setArtifactError(
        loadError instanceof Error ? loadError.message : "Artifact list could not be loaded"
      );
    }
  }

  async function handleArtifact(filename: string): Promise<void> {
    setSelectedArtifact(filename);
    if (!filename) {
      return;
    }

    setArtifactLoading(true);
    setArtifactError(null);
    try {
      const response = await fetch(`/api/visualiser/artifacts/${encodeURIComponent(filename)}`);
      if (!response.ok) {
        throw new Error(`Artifact load failed with ${response.status}`);
      }
      const parsed = (await response.json()) as MatchSnapshot;
      validateSnapshot(parsed);
      loadSnapshot(parsed);
    } catch (loadError) {
      setArtifactError(loadError instanceof Error ? loadError.message : "Artifact could not load");
    } finally {
      setArtifactLoading(false);
    }
  }

  function loadSnapshot(parsed: MatchSnapshot): void {
    setSnapshot(parsed);
    setTickIndex(0);
    setPlaying(false);
    setError(null);
    const firstPlayer = firstRosterPlayerId(parsed);
    setSelectedPlayerId(firstPlayer);
  }

  const events = snapshot ? eventsUntil(snapshot.ticks, tickIndex) : [];
  const recentGoal =
    snapshot && currentTick ? recentGoalEvent(snapshot.ticks, tickIndex, currentTick) : null;

  return (
    <main style={styles.page}>
      <header style={styles.topBar}>
        <div style={styles.brandBlock}>
          <div>
            <p style={styles.eyebrow}>Match visualiser</p>
            <h1 style={styles.title}>
              {snapshot && currentTick
                ? `${snapshot.meta.homeTeam.shortName} ${currentTick.score.home}-${currentTick.score.away} ${snapshot.meta.awayTeam.shortName}`
                : "Load snapshot"}
            </h1>
            <p style={styles.clock}>{currentTick ? formatClock(currentTick) : "45:00"}</p>
          </div>
          <div style={styles.sourceControls}>
            <select
              aria-label="Snapshot artifact"
              value={selectedArtifact}
              disabled={artifactLoading}
              onChange={(event) => void handleArtifact(event.currentTarget.value)}
              style={styles.select}
            >
              <option value="">{artifactLoading ? "Loading..." : "Select artifact"}</option>
              {artifacts.map((artifact) => (
                <option key={artifact.filename} value={artifact.filename}>
                  {artifact.filename}
                </option>
              ))}
            </select>
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
          </div>
        </div>

        <div style={styles.toolbarControls}>
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
          <div style={styles.segmentedControl} aria-label="Visualiser view mode">
            <button
              type="button"
              onClick={() => {
                setViewMode("replay");
                setInspectorTab("stats");
              }}
              style={viewMode === "replay" ? styles.segmentedButtonActive : styles.segmentedButton}
            >
              Replay
            </button>
            <button
              type="button"
              onClick={() => {
                setViewMode("heatmap");
                setInspectorTab("heatmap");
              }}
              style={viewMode === "heatmap" ? styles.segmentedButtonActive : styles.segmentedButton}
            >
              Heatmap
            </button>
          </div>
          <select
            aria-label="Heatmap subject"
            value={heatmapSubject}
            disabled={!snapshot || viewMode !== "heatmap"}
            onChange={(event) => setHeatmapSubject(parseHeatmapSubject(event.currentTarget.value))}
            style={styles.select}
          >
            <option value="ball">Ball</option>
            <option value="home_players">
              {snapshot?.meta.homeTeam.shortName ?? "Home"} players
            </option>
            <option value="away_players">
              {snapshot?.meta.awayTeam.shortName ?? "Away"} players
            </option>
            <option value="all_players">All players</option>
            <option value="player_relative">Player relative</option>
          </select>
          <select
            aria-label="Heatmap possession filter"
            value={heatmapFilter}
            disabled={!snapshot || viewMode !== "heatmap" || heatmapSubject !== "ball"}
            onChange={(event) => setHeatmapFilter(parseHeatmapFilter(event.currentTarget.value))}
            style={styles.select}
          >
            <option value="all">All possession</option>
            <option value="home">{snapshot?.meta.homeTeam.shortName ?? "Home"}</option>
            <option value="away">{snapshot?.meta.awayTeam.shortName ?? "Away"}</option>
          </select>
          <select
            aria-label="Heatmap player"
            value={selectedPlayerId}
            disabled={!snapshot || viewMode !== "heatmap" || heatmapSubject !== "player_relative"}
            onChange={(event) => setSelectedPlayerId(event.currentTarget.value)}
            style={styles.select}
          >
            {playerOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </header>

      {error || artifactError ? <div style={styles.errorBar}>{error ?? artifactError}</div> : null}

      <section style={styles.workbench} aria-label="Snapshot replay visualiser">
        <div
          style={styles.stage}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            void handleFile(event.dataTransfer.files[0]);
          }}
        >
          {snapshot && currentTick ? (
            <div style={styles.pitchWrap}>
              {viewMode === "replay" ? (
                <Pitch snapshot={snapshot} tick={currentTick} />
              ) : heatmapSubject === "player_relative" ? (
                <RelativePlayerHeatmaps snapshot={snapshot} playerId={selectedPlayerId} />
              ) : (
                <HeatmapPitch snapshot={snapshot} filter={heatmapFilter} subject={heatmapSubject} />
              )}
              {viewMode === "replay" && recentGoal ? (
                <GoalOverlay
                  snapshot={snapshot}
                  event={recentGoal.event}
                  score={recentGoal.score}
                />
              ) : null}
            </div>
          ) : (
            <p style={styles.empty}>Select an artifact or drop a MatchSnapshot JSON file here.</p>
          )}
        </div>

        <aside style={styles.inspector} aria-label="Visualiser inspector">
          <div style={styles.inspectorTabs} aria-label="Inspector tabs">
            {(["stats", "shape", "heatmap", "player"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setInspectorTab(tab)}
                style={inspectorTab === tab ? styles.inspectorTabActive : styles.inspectorTab}
              >
                {tab[0]!.toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
          <InspectorPanel
            tab={inspectorTab}
            snapshot={snapshot}
            tick={currentTick}
            stats={stats}
            filter={heatmapFilter}
            subject={heatmapSubject}
            selectedPlayerId={selectedPlayerId}
          />
        </aside>
      </section>

      <section style={styles.eventDock} aria-label="Event log">
        <div style={styles.eventHeader}>
          <h2 style={styles.panelTitle}>Events</h2>
          <span style={styles.muted}>{events.length} events</span>
        </div>
        {snapshot ? (
          <EventLog snapshot={snapshot} events={events} />
        ) : (
          <p style={styles.muted}>No events.</p>
        )}
      </section>
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
      <PitchMarkings />

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
  return (
    <div style={styles.goalOverlay} role="status" aria-live="polite">
      <strong>GOAL!</strong> {snapshot.meta.homeTeam.shortName} {score.home}-{score.away}{" "}
      {snapshot.meta.awayTeam.shortName}
      {" | "}
      {teamName(snapshot, event.team)} scored by{" "}
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

function InspectorPanel({
  tab,
  snapshot,
  tick,
  stats,
  filter,
  subject,
  selectedPlayerId
}: {
  tab: InspectorTab;
  snapshot: MatchSnapshot | null;
  tick: MatchTick | null;
  stats: ReplayStats | null;
  filter: HeatmapFilter;
  subject: HeatmapSubject;
  selectedPlayerId: string;
}) {
  if (!snapshot || !tick) {
    return <p style={styles.muted}>No snapshot loaded.</p>;
  }

  if (tab === "stats") {
    return stats ? (
      <StatsPanel snapshot={snapshot} tick={tick} stats={stats} />
    ) : (
      <p style={styles.muted}>No statistics.</p>
    );
  }

  if (tab === "shape") {
    return <ShapeDiagnostics snapshot={snapshot} tick={tick} />;
  }

  if (tab === "player") {
    return <PlayerDiagnostics snapshot={snapshot} tick={tick} playerId={selectedPlayerId} />;
  }

  if (subject === "player_relative") {
    return <PlayerDiagnostics snapshot={snapshot} tick={tick} playerId={selectedPlayerId} />;
  }

  return <HeatmapDiagnostics snapshot={snapshot} tick={tick} filter={filter} subject={subject} />;
}

function PlayerDiagnostics({
  snapshot,
  tick,
  playerId
}: {
  snapshot: MatchSnapshot;
  tick: MatchTick;
  playerId: string;
}) {
  const rosterPlayer = rosterPlayerById(snapshot, playerId);
  const tickPlayer = tick.players.find((player) => player.id === playerId);
  const relative = buildRelativePlayerHeatmap(snapshot, playerId);

  if (!rosterPlayer || !tickPlayer) {
    return <p style={styles.muted}>Player heatmap unavailable.</p>;
  }

  return (
    <div style={styles.playerPanel}>
      <div style={styles.diagnosticGrid}>
        <span>Player</span>
        <strong>{rosterPlayer.shortName}</strong>
        <span>Position</span>
        <strong>{rosterPlayer.position}</strong>
        <span>On pitch</span>
        <strong>{tickPlayer.onPitch ? "yes" : "no"}</strong>
        <span>Current x/y</span>
        <strong>
          {Math.round(tickPlayer.position[0])} / {Math.round(tickPlayer.position[1])}
        </strong>
        <span>In possession samples</span>
        <strong>{relative.inPossession.samples}</strong>
        <span>Out of possession samples</span>
        <strong>{relative.outOfPossession.samples}</strong>
      </div>
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

function rosterPlayerById(snapshot: MatchSnapshot, playerId: string) {
  return (
    snapshot.meta.rosters.home.find((player) => player.id === playerId) ??
    snapshot.meta.rosters.away.find((player) => player.id === playerId) ??
    null
  );
}

function rosterOptions(snapshot: MatchSnapshot): Array<{ id: string; label: string }> {
  return [
    ...snapshot.meta.rosters.home.map((player) => ({
      id: player.id,
      label: `${snapshot.meta.homeTeam.shortName} ${player.shortName}`
    })),
    ...snapshot.meta.rosters.away.map((player) => ({
      id: player.id,
      label: `${snapshot.meta.awayTeam.shortName} ${player.shortName}`
    }))
  ];
}

function firstRosterPlayerId(snapshot: MatchSnapshot): string {
  return snapshot.meta.rosters.home[0]?.id ?? snapshot.meta.rosters.away[0]?.id ?? "";
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

function parseHeatmapFilter(value: string): HeatmapFilter {
  if (value === "home" || value === "away") {
    return value;
  }
  return "all";
}

function parseHeatmapSubject(value: string): HeatmapSubject {
  if (
    value === "ball" ||
    value === "home_players" ||
    value === "away_players" ||
    value === "all_players" ||
    value === "player_relative"
  ) {
    return value;
  }
  return "ball";
}

function clearReplayInterval(ref: MutableRefObject<number | null>): void {
  if (ref.current !== null) {
    window.clearInterval(ref.current);
    ref.current = null;
  }
}

const styles = {
  page: {
    width: "100vw",
    maxWidth: "none",
    height: "100vh",
    display: "grid",
    gridTemplateRows: "auto minmax(0, 1fr) 230px",
    margin: 0,
    padding: 0,
    background: "#17201b",
    color: "#f5f7f5",
    fontFamily: "Arial, sans-serif",
    overflow: "hidden"
  },
  topBar: {
    display: "grid",
    gridTemplateColumns: "minmax(280px, 420px) minmax(0, 1fr)",
    gap: "18px",
    alignItems: "center",
    padding: "12px 16px",
    borderBottom: "1px solid #3f5045",
    background: "#111c16"
  },
  brandBlock: { display: "flex", alignItems: "center", gap: "16px", minWidth: 0 },
  sourceControls: { display: "flex", gap: "8px", alignItems: "center", minWidth: 0 },
  eyebrow: { margin: 0, color: "#aeb8b1", fontSize: "13px", textTransform: "uppercase" as const },
  title: { margin: "2px 0", fontSize: "26px", lineHeight: 1.05 },
  clock: { margin: 0, color: "#d8ded9", fontVariantNumeric: "tabular-nums" as const },
  fileButton: {
    position: "relative" as const,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "64px",
    height: "36px",
    border: "1px solid #d8ded9",
    background: "#17201b",
    color: "#f5f7f5",
    cursor: "pointer"
  },
  fileInput: { position: "absolute" as const, inset: 0, opacity: 0, cursor: "pointer" },
  errorBar: {
    padding: "8px 16px",
    borderBottom: "1px solid #774539",
    background: "#3a1d17",
    color: "#ffb4a8"
  },
  toolbarControls: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: "10px",
    minWidth: 0,
    flexWrap: "wrap" as const
  },
  workbench: {
    display: "flex",
    minHeight: 0,
    padding: "12px 16px",
    gap: "14px",
    overflow: "hidden"
  },
  stage: {
    flex: "1 1 auto",
    minWidth: 0,
    minHeight: 0,
    display: "flex",
    alignItems: "stretch",
    justifyContent: "center",
    border: "1px solid #3f5045",
    background: "#203027",
    overflow: "hidden"
  },
  empty: { color: "#c7d0ca" },
  pitchWrap: {
    position: "relative" as const,
    width: "100%",
    height: "100%",
    minHeight: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden"
  },
  pitch: {
    height: "100%",
    width: "auto",
    maxHeight: "100%",
    maxWidth: "100%",
    aspectRatio: `${PITCH_WIDTH} / ${PITCH_LENGTH}`,
    display: "block",
    flex: "0 0 auto"
  },
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
  button: { height: "34px", minWidth: "72px" },
  slider: { width: "min(300px, 24vw)" },
  select: { height: "34px", minWidth: "130px", background: "#f5f7f5", color: "#17201b" },
  segmentedControl: { display: "inline-flex", border: "1px solid #d8ded9" },
  segmentedButton: {
    height: "34px",
    padding: "0 12px",
    border: 0,
    background: "transparent",
    color: "#f5f7f5",
    cursor: "pointer"
  },
  segmentedButtonActive: {
    height: "34px",
    padding: "0 12px",
    border: 0,
    background: "#d8ded9",
    color: "#17201b",
    cursor: "pointer"
  },
  inspector: {
    flex: "0 0 430px",
    minHeight: 0,
    border: "1px solid #3f5045",
    background: "#132019",
    overflowY: "auto" as const
  },
  inspectorTabs: {
    position: "sticky" as const,
    top: 0,
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    background: "#111c16",
    borderBottom: "1px solid #3f5045",
    zIndex: 1
  },
  inspectorTab: {
    minWidth: 0,
    height: "36px",
    border: 0,
    borderRight: "1px solid #3f5045",
    background: "transparent",
    color: "#f5f7f5",
    cursor: "pointer"
  },
  inspectorTabActive: {
    minWidth: 0,
    height: "36px",
    border: 0,
    borderRight: "1px solid #3f5045",
    background: "#d8ded9",
    color: "#17201b",
    cursor: "pointer"
  },
  playerPanel: { padding: "14px" },
  eventDock: {
    minHeight: 0,
    borderTop: "1px solid #3f5045",
    padding: "10px 16px 14px",
    background: "#111c16",
    overflow: "hidden"
  },
  eventHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "8px"
  },
  panelSection: { marginBottom: "24px" },
  panelTitle: { margin: "0 0 10px", fontSize: "18px" },
  subPanelTitle: { margin: "12px 0 8px", fontSize: "14px", color: "#d8ded9" },
  statsPanel: {
    padding: "12px 14px 18px",
    display: "grid",
    gap: "10px"
  },
  scoreStrip: {
    display: "grid",
    gridTemplateColumns: "1fr auto 1fr",
    gap: "4px 12px",
    alignItems: "center",
    padding: "10px",
    background: "#203027",
    textAlign: "center" as const,
    fontVariantNumeric: "tabular-nums" as const
  },
  statsSection: {
    borderTop: "1px solid #3f5045",
    paddingTop: "2px"
  },
  statsTable: {
    display: "grid",
    gridTemplateColumns: "minmax(120px, 1fr) minmax(66px, auto) minmax(66px, auto)",
    gap: "6px 10px",
    alignItems: "baseline",
    fontVariantNumeric: "tabular-nums" as const
  },
  diagnosticGrid: { display: "grid", gridTemplateColumns: "1fr auto", gap: "8px 12px" },
  shapeDiagnostics: { padding: "14px", marginBottom: "14px" },
  momentumText: { margin: "0 0 12px", color: "#f5f7f5", fontVariantNumeric: "tabular-nums" },
  muted: { color: "#aeb8b1" },
  eventList: {
    listStyle: "none",
    padding: 0,
    margin: 0,
    display: "grid",
    gridAutoFlow: "column",
    gridAutoColumns: "minmax(260px, 360px)",
    gap: "8px",
    overflowX: "auto" as const,
    overflowY: "hidden" as const,
    maxHeight: "170px"
  },
  eventItem: { padding: "8px", background: "#23352a", borderLeft: "3px solid #d8ded9" },
  eventDetail: { color: "#aeb8b1" },
  relativeHeatmapWrap: {
    width: "100%",
    height: "100%",
    display: "flex",
    flexDirection: "column" as const,
    padding: "18px",
    gap: "12px"
  },
  relativeHeatmapHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px"
  },
  relativeHeatmapGrid: {
    minHeight: 0,
    flex: 1,
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "14px"
  },
  relativeHeatmapPanel: {
    minHeight: 0,
    display: "flex",
    flexDirection: "column" as const,
    gap: "8px"
  },
  relativeHeatmapTitle: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center"
  },
  relativeHeatmapSvg: { minHeight: 0, width: "100%", height: "100%" }
};
