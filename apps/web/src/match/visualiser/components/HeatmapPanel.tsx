import { useMemo } from "react";
import type { MatchSnapshot, MatchTick, TeamId } from "@the-ataturk/match-engine";

import { PITCH_LENGTH, PITCH_WIDTH, PitchLineOverlay, PitchMarkings } from "./PitchMarkings";

const HEATMAP_COLS = 12;
const HEATMAP_ROWS = 18;

export type HeatmapFilter = "all" | TeamId;
export type HeatmapSubject =
  | "ball"
  | "home_players"
  | "away_players"
  | "all_players"
  | "player_relative";

export interface HeatmapBucket {
  col: number;
  row: number;
  count: number;
}

export interface HeatmapData {
  buckets: HeatmapBucket[];
  max: number;
  diagnostics: HeatmapSummary;
}

interface HeatmapPoint {
  x: number;
  y: number;
  teamId: TeamId | null;
}

export interface HeatmapSummary {
  totalTicks: number;
  attackingThirdPct: number;
  centralLanePct: number;
  leftFlankPct: number;
  rightFlankPct: number;
  homeAvgY: number | null;
  awayAvgY: number | null;
}

export interface RelativeHeatmapData {
  buckets: HeatmapBucket[];
  max: number;
  samples: number;
}

export interface RelativePlayerHeatmapData {
  inPossession: RelativeHeatmapData;
  outOfPossession: RelativeHeatmapData;
}

export function HeatmapPitch({
  snapshot,
  filter,
  subject,
  maxOverride
}: {
  snapshot: MatchSnapshot;
  filter: HeatmapFilter;
  subject: HeatmapSubject;
  maxOverride?: number | undefined;
}) {
  const heatmap = useMemo(
    () => buildHeatmap(snapshot, filter, subject),
    [snapshot, filter, subject]
  );
  const cellWidth = PITCH_WIDTH / HEATMAP_COLS;
  const cellHeight = PITCH_LENGTH / HEATMAP_ROWS;
  const max = maxOverride ?? heatmap.max;

  return (
    <svg
      viewBox={`0 0 ${PITCH_WIDTH} ${PITCH_LENGTH}`}
      style={styles.pitch}
      role="img"
      aria-label={`${heatmapSubjectLabel(subject)} heatmap`}
      data-heatmap-max={max}
    >
      <PitchMarkings />
      {heatmap.buckets.map((bucket) => (
        <rect
          key={`${bucket.col}-${bucket.row}`}
          x={bucket.col * cellWidth}
          y={bucket.row * cellHeight}
          width={cellWidth}
          height={cellHeight}
          fill={heatColour(bucket.count, max)}
          opacity={bucket.count > 0 ? 0.74 : 0}
        />
      ))}
      <PitchLineOverlay />
    </svg>
  );
}

export function RelativePlayerHeatmaps({
  snapshot,
  playerId
}: {
  snapshot: MatchSnapshot;
  playerId: string;
}) {
  const data = useMemo(() => buildRelativePlayerHeatmap(snapshot, playerId), [snapshot, playerId]);
  const player = rosterPlayerById(snapshot, playerId);

  if (!player) {
    return <p style={styles.empty}>Player heatmap unavailable.</p>;
  }

  return (
    <div style={styles.relativeHeatmapWrap}>
      <div style={styles.relativeHeatmapHeader}>
        <strong>{player.shortName}</strong>
        <span style={styles.muted}>Relative to ball · +Y toward opposition goal</span>
      </div>
      <div style={styles.relativeHeatmapGrid}>
        <RelativeHeatmapPanel title="Team in possession" data={data.inPossession} />
        <RelativeHeatmapPanel title="Team out of possession" data={data.outOfPossession} />
      </div>
    </div>
  );
}

function RelativeHeatmapPanel({ title, data }: { title: string; data: RelativeHeatmapData }) {
  const cellWidth = 680 / HEATMAP_COLS;
  const cellHeight = 680 / HEATMAP_COLS;

  return (
    <section style={styles.relativeHeatmapPanel}>
      <div style={styles.relativeHeatmapTitle}>
        <strong>{title}</strong>
        <span style={styles.muted}>{data.samples} samples</span>
      </div>
      <svg
        viewBox="0 0 680 680"
        style={styles.relativeHeatmapSvg}
        role="img"
        aria-label={`${title} relative player heatmap`}
      >
        <rect x="0" y="0" width="680" height="680" fill="#203027" />
        <line x1="340" y1="0" x2="340" y2="680" stroke="#d8ded9" strokeWidth="2" opacity="0.45" />
        <line x1="0" y1="340" x2="680" y2="340" stroke="#d8ded9" strokeWidth="2" opacity="0.45" />
        <circle cx="340" cy="340" r="7" fill="#fff" stroke="#111" strokeWidth="2" />
        {data.buckets.map((bucket) => (
          <rect
            key={`${bucket.col}-${bucket.row}`}
            x={bucket.col * cellWidth}
            y={bucket.row * cellHeight}
            width={cellWidth}
            height={cellHeight}
            fill={heatColour(bucket.count, data.max)}
            opacity={bucket.count > 0 ? 0.76 : 0}
          />
        ))}
      </svg>
    </section>
  );
}

export function HeatmapDiagnostics({
  snapshot,
  tick,
  filter,
  subject
}: {
  snapshot: MatchSnapshot;
  tick: MatchTick;
  filter: HeatmapFilter;
  subject: HeatmapSubject;
}) {
  const heatmap = useMemo(
    () => buildHeatmap(snapshot, filter, subject),
    [snapshot, filter, subject]
  );
  const diagnostics = heatmap.diagnostics;

  if (diagnostics.totalTicks === 0) {
    return <p style={styles.muted}>No matching heatmap samples.</p>;
  }

  return (
    <>
      <MomentumDiagnostics snapshot={snapshot} tick={tick} />
      <ShapeDiagnostics snapshot={snapshot} tick={tick} />
      <div style={styles.diagnosticGrid}>
        <span>{subject === "ball" ? "Ticks" : "Samples"}</span>
        <strong>{diagnostics.totalTicks}</strong>
        <span>Attacking third</span>
        <strong>{diagnostics.attackingThirdPct}%</strong>
        <span>Central lane</span>
        <strong>{diagnostics.centralLanePct}%</strong>
        <span>Left flank</span>
        <strong>{diagnostics.leftFlankPct}%</strong>
        <span>Right flank</span>
        <strong>{diagnostics.rightFlankPct}%</strong>
        <span>{snapshot.meta.homeTeam.shortName} avg Y</span>
        <strong>{diagnostics.homeAvgY === null ? "-" : Math.round(diagnostics.homeAvgY)}</strong>
        <span>{snapshot.meta.awayTeam.shortName} avg Y</span>
        <strong>{diagnostics.awayAvgY === null ? "-" : Math.round(diagnostics.awayAvgY)}</strong>
      </div>
    </>
  );
}

export function MomentumDiagnostics({
  snapshot,
  tick
}: {
  snapshot: MatchSnapshot;
  tick: MatchTick;
}) {
  const momentum = tick.attackMomentum;
  const streak = tick.possessionStreak;

  if (!momentum) {
    return <p style={styles.muted}>Momentum: unavailable in this snapshot.</p>;
  }

  const streakTeam = streak?.teamId ? teamName(snapshot, streak.teamId) : "none";
  return (
    <p style={styles.momentumText}>
      {snapshot.meta.homeTeam.shortName} momentum: {Math.round(momentum.home)} |{" "}
      {snapshot.meta.awayTeam.shortName} momentum: {Math.round(momentum.away)} | streak:{" "}
      {streakTeam} {streak?.ticks ?? 0} ticks
    </p>
  );
}

export function ShapeDiagnostics({ snapshot, tick }: { snapshot: MatchSnapshot; tick: MatchTick }) {
  const shape = tick.diagnostics?.shape;
  if (!shape) {
    return <p style={styles.muted}>Shape diagnostics unavailable.</p>;
  }

  return (
    <div style={styles.shapeDiagnostics}>
      <h3 style={styles.subPanelTitle}>Shape</h3>
      <div style={styles.diagnosticGrid}>
        <span>{snapshot.meta.homeTeam.shortName} active</span>
        <strong>{shape.home.activePlayers}</strong>
        <span>{snapshot.meta.awayTeam.shortName} active</span>
        <strong>{shape.away.activePlayers}</strong>
        <span>{snapshot.meta.homeTeam.shortName} line</span>
        <strong>{shape.home.lineHeight.team}</strong>
        <span>{snapshot.meta.awayTeam.shortName} line</span>
        <strong>{shape.away.lineHeight.team}</strong>
        <span>{snapshot.meta.homeTeam.shortName} lines</span>
        <strong>{lineSummary(shape.home)}</strong>
        <span>{snapshot.meta.awayTeam.shortName} lines</span>
        <strong>{lineSummary(shape.away)}</strong>
        <span>{snapshot.meta.homeTeam.shortName} opp half</span>
        <strong>{shape.home.oppositionHalfPlayers}</strong>
        <span>{snapshot.meta.awayTeam.shortName} opp half</span>
        <strong>{shape.away.oppositionHalfPlayers}</strong>
        <span>{snapshot.meta.homeTeam.shortName} attacking third</span>
        <strong>{shape.home.thirds.attacking}</strong>
        <span>{snapshot.meta.awayTeam.shortName} attacking third</span>
        <strong>{shape.away.thirds.attacking}</strong>
        <span>{snapshot.meta.homeTeam.shortName} spread</span>
        <strong>{spreadSummary(shape.home)}</strong>
        <span>{snapshot.meta.awayTeam.shortName} spread</span>
        <strong>{spreadSummary(shape.away)}</strong>
        <span>{snapshot.meta.homeTeam.shortName} ball side</span>
        <strong>{shape.home.ballSidePlayers}</strong>
        <span>{snapshot.meta.awayTeam.shortName} ball side</span>
        <strong>{shape.away.ballSidePlayers}</strong>
      </div>
    </div>
  );
}

export function buildHeatmap(
  snapshot: MatchSnapshot,
  filter: HeatmapFilter,
  subject: HeatmapSubject
): HeatmapData {
  const buckets = Array.from({ length: HEATMAP_COLS * HEATMAP_ROWS }, (_, index) => ({
    col: index % HEATMAP_COLS,
    row: Math.floor(index / HEATMAP_COLS),
    count: 0
  }));
  const homeY: number[] = [];
  const awayY: number[] = [];
  let totalTicks = 0;
  let attackingThirdTicks = 0;
  let centralLaneTicks = 0;
  let leftFlankTicks = 0;
  let rightFlankTicks = 0;

  for (const tick of snapshot.ticks) {
    const team = tick.possession.teamId;
    if (subject === "ball" && filter !== "all" && team !== filter) {
      continue;
    }

    const points = heatmapPoints(tick, subject);
    if (points.length === 0) {
      continue;
    }

    for (const point of points) {
      const { x, y } = point;
      const col = Math.max(
        0,
        Math.min(HEATMAP_COLS - 1, Math.floor((x / PITCH_WIDTH) * HEATMAP_COLS))
      );
      const row = Math.max(
        0,
        Math.min(HEATMAP_ROWS - 1, Math.floor((y / PITCH_LENGTH) * HEATMAP_ROWS))
      );
      buckets[row * HEATMAP_COLS + col]!.count += 1;
      totalTicks += 1;

      if (x >= PITCH_WIDTH / 3 && x <= (PITCH_WIDTH * 2) / 3) {
        centralLaneTicks += 1;
      } else if (x < PITCH_WIDTH / 3) {
        leftFlankTicks += 1;
      } else {
        rightFlankTicks += 1;
      }

      if (point.teamId === "home") {
        homeY.push(y);
        if (y >= (PITCH_LENGTH * 2) / 3) {
          attackingThirdTicks += 1;
        }
      } else if (point.teamId === "away") {
        awayY.push(y);
        if (y <= PITCH_LENGTH / 3) {
          attackingThirdTicks += 1;
        }
      }
    }
  }

  const max = Math.max(1, ...buckets.map((bucket) => bucket.count));
  return {
    buckets,
    max,
    diagnostics: {
      totalTicks,
      attackingThirdPct: percentage(attackingThirdTicks, totalTicks),
      centralLanePct: percentage(centralLaneTicks, totalTicks),
      leftFlankPct: percentage(leftFlankTicks, totalTicks),
      rightFlankPct: percentage(rightFlankTicks, totalTicks),
      homeAvgY: average(homeY),
      awayAvgY: average(awayY)
    }
  };
}

export function buildRelativePlayerHeatmap(
  snapshot: MatchSnapshot,
  playerId: string
): RelativePlayerHeatmapData {
  const playerTeam = playerTeamById(snapshot, playerId);
  const inPossession = emptyRelativeHeatmap();
  const outOfPossession = emptyRelativeHeatmap();

  if (!playerTeam) {
    return { inPossession, outOfPossession };
  }

  for (const tick of snapshot.ticks) {
    const player = tick.players.find((candidate) => candidate.id === playerId && candidate.onPitch);
    if (!player || !tick.possession.teamId) {
      continue;
    }

    const relativeX = player.position[0] - tick.ball.position[0];
    const rawRelativeY = player.position[1] - tick.ball.position[1];
    const relativeY = playerTeam === "home" ? rawRelativeY : -rawRelativeY;
    const target = tick.possession.teamId === playerTeam ? inPossession : outOfPossession;
    addRelativeSample(target, relativeX, relativeY);
  }

  finaliseRelativeHeatmap(inPossession);
  finaliseRelativeHeatmap(outOfPossession);
  return { inPossession, outOfPossession };
}

export function heatColour(count: number, max: number): string {
  if (count <= 0) {
    return "transparent";
  }

  const intensity = count / max;
  if (intensity > 0.75) {
    return "#ffef5f";
  }
  if (intensity > 0.45) {
    return "#ff9f43";
  }
  if (intensity > 0.2) {
    return "#e84a5f";
  }
  return "#7b2ff7";
}

function heatmapPoints(tick: MatchTick, subject: HeatmapSubject): HeatmapPoint[] {
  if (subject === "ball") {
    return [{ x: tick.ball.position[0], y: tick.ball.position[1], teamId: tick.possession.teamId }];
  }

  return tick.players
    .filter((player) => {
      if (!player.onPitch) {
        return false;
      }
      if (subject === "home_players") {
        return player.teamId === "home";
      }
      if (subject === "away_players") {
        return player.teamId === "away";
      }
      return true;
    })
    .map((player) => ({ x: player.position[0], y: player.position[1], teamId: player.teamId }));
}

function heatmapSubjectLabel(subject: HeatmapSubject): string {
  switch (subject) {
    case "home_players":
      return "Home player-position";
    case "away_players":
      return "Away player-position";
    case "all_players":
      return "All player-position";
    case "player_relative":
      return "Player relative";
    case "ball":
      return "Ball-position";
  }
}

function emptyRelativeHeatmap(): RelativeHeatmapData {
  return {
    buckets: Array.from({ length: HEATMAP_COLS * HEATMAP_COLS }, (_, index) => ({
      col: index % HEATMAP_COLS,
      row: Math.floor(index / HEATMAP_COLS),
      count: 0
    })),
    max: 1,
    samples: 0
  };
}

function addRelativeSample(data: RelativeHeatmapData, relativeX: number, relativeY: number): void {
  const x = Math.max(-PITCH_WIDTH / 2, Math.min(PITCH_WIDTH / 2, relativeX));
  const y = Math.max(-PITCH_LENGTH / 2, Math.min(PITCH_LENGTH / 2, relativeY));
  const col = Math.max(
    0,
    Math.min(HEATMAP_COLS - 1, Math.floor(((x + PITCH_WIDTH / 2) / PITCH_WIDTH) * HEATMAP_COLS))
  );
  const row = Math.max(
    0,
    Math.min(HEATMAP_COLS - 1, Math.floor(((PITCH_LENGTH / 2 - y) / PITCH_LENGTH) * HEATMAP_COLS))
  );
  data.buckets[row * HEATMAP_COLS + col]!.count += 1;
  data.samples += 1;
}

function finaliseRelativeHeatmap(data: RelativeHeatmapData): void {
  data.max = Math.max(1, ...data.buckets.map((bucket) => bucket.count));
}

type ShapeDiagnosticsValue = NonNullable<MatchTick["diagnostics"]>["shape"]["home"];

function lineSummary(shape: ShapeDiagnosticsValue): string {
  return `${shape.lineHeight.defence ?? "-"} / ${shape.lineHeight.midfield ?? "-"} / ${
    shape.lineHeight.attack ?? "-"
  }`;
}

function spreadSummary(shape: ShapeDiagnosticsValue): string {
  return `${shape.spread.width}w ${shape.spread.depth}d ${shape.spread.compactness}c`;
}

function percentage(value: number, total: number): number {
  return total > 0 ? Math.round((value / total) * 100) : 0;
}

function average(values: number[]): number | null {
  return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function rosterPlayerById(snapshot: MatchSnapshot, playerId: string) {
  return (
    snapshot.meta.rosters.home.find((player) => player.id === playerId) ??
    snapshot.meta.rosters.away.find((player) => player.id === playerId) ??
    null
  );
}

function playerTeamById(snapshot: MatchSnapshot, playerId: string): TeamId | null {
  if (snapshot.meta.rosters.home.some((player) => player.id === playerId)) {
    return "home";
  }
  if (snapshot.meta.rosters.away.some((player) => player.id === playerId)) {
    return "away";
  }
  return null;
}

function teamName(snapshot: MatchSnapshot, team: TeamId): string {
  return team === "home" ? snapshot.meta.homeTeam.shortName : snapshot.meta.awayTeam.shortName;
}

const styles = {
  pitch: {
    height: "100%",
    width: "auto",
    maxHeight: "100%",
    maxWidth: "100%",
    aspectRatio: `${PITCH_WIDTH} / ${PITCH_LENGTH}`,
    display: "block",
    flex: "0 0 auto"
  },
  empty: { color: "#c7d0ca" },
  muted: { color: "#aeb8b1" },
  diagnosticGrid: { display: "grid", gridTemplateColumns: "1fr auto", gap: "8px 12px" },
  shapeDiagnostics: { padding: "14px", marginBottom: "14px" },
  subPanelTitle: { margin: "12px 0 8px", fontSize: "14px", color: "#d8ded9" },
  momentumText: { margin: "0 0 12px", color: "#f5f7f5", fontVariantNumeric: "tabular-nums" },
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
