import { Fragment, type CSSProperties } from "react";
import type { MatchSnapshot, MatchTick, SemanticEvent, TeamId } from "@the-ataturk/match-engine";

const PITCH_WIDTH = 680;
const PITCH_LENGTH = 1050;

interface ShotStats {
  total: number;
  on: number;
  off: number;
  blocked: number;
}

interface PassStats {
  notable: number;
  complete: number;
  incomplete: number;
  progressive: number;
  key: number;
  crosses: number;
  cutbacks: number;
}

interface CarryStats {
  total: number;
  progressive: number;
  wide: number;
}

interface RestartStats {
  corners: number;
  freeKicks: number;
  throwIns: number;
  goalKicks: number;
}

interface ReplayTeamStats {
  shots: ShotStats;
  saves: number;
  fouls: number;
  yellowCards: number;
  redCards: number;
  cards: number;
  passes: PassStats;
  carries: CarryStats;
  restarts: RestartStats;
  possessionChanges: number;
}

export interface ReplayStats {
  home: ReplayTeamStats;
  away: ReplayTeamStats;
  possession: { home: number; away: number };
  possessionTicks: { home: number; away: number };
  territory: {
    homeAttackingThird: number;
    awayAttackingThird: number;
    centralLane: number;
    leftFlank: number;
    rightFlank: number;
  };
  momentumPeak: { home: number; away: number };
}

export function StatsPanel({
  snapshot,
  tick,
  stats
}: {
  snapshot: MatchSnapshot;
  tick: MatchTick;
  stats: ReplayStats;
}) {
  const home = snapshot.meta.homeTeam.shortName;
  const away = snapshot.meta.awayTeam.shortName;
  const secondHalfGoals = {
    home: Math.max(0, tick.score.home - snapshot.meta.preMatchScore.home),
    away: Math.max(0, tick.score.away - snapshot.meta.preMatchScore.away)
  };
  const streakTeam = tick.possessionStreak?.teamId
    ? teamName(snapshot, tick.possessionStreak.teamId)
    : "none";

  return (
    <div style={styles.statsPanel}>
      <div style={styles.scoreStrip}>
        <strong>{home}</strong>
        <strong>
          {tick.score.home}-{tick.score.away}
        </strong>
        <strong>{away}</strong>
        <span>Second half goals</span>
        <span>
          {secondHalfGoals.home}-{secondHalfGoals.away}
        </span>
      </div>

      <StatsSection
        title="Possession"
        rows={[
          ["Share", `${stats.possession.home}%`, `${stats.possession.away}%`],
          ["Ticks", String(stats.possessionTicks.home), String(stats.possessionTicks.away)],
          ["Current streak", streakTeam, `${tick.possessionStreak?.ticks ?? 0} ticks`]
        ]}
        home={home}
        away={away}
      />

      <StatsSection
        title="Shooting"
        rows={[
          ["Shots", String(stats.home.shots.total), String(stats.away.shots.total)],
          ["On / off / blocked", shotBreakdown(stats.home.shots), shotBreakdown(stats.away.shots)],
          ["Shot accuracy", shotAccuracy(stats.home.shots), shotAccuracy(stats.away.shots)],
          ["Saves", String(stats.home.saves), String(stats.away.saves)]
        ]}
        home={home}
        away={away}
      />

      <StatsSection
        title="Passing and carries"
        rows={[
          ["Notable passes", passCompletion(stats.home.passes), passCompletion(stats.away.passes)],
          ["Progressive / key", passThreat(stats.home.passes), passThreat(stats.away.passes)],
          ["Crosses / cutbacks", passDelivery(stats.home.passes), passDelivery(stats.away.passes)],
          ["Carries", carrySummary(stats.home.carries), carrySummary(stats.away.carries)]
        ]}
        home={home}
        away={away}
      />

      <StatsSection
        title="Discipline"
        rows={[
          ["Fouls", String(stats.home.fouls), String(stats.away.fouls)],
          ["Yellows", String(stats.home.yellowCards), String(stats.away.yellowCards)],
          ["Reds", String(stats.home.redCards), String(stats.away.redCards)],
          ["Card events", String(stats.home.cards), String(stats.away.cards)]
        ]}
        home={home}
        away={away}
      />

      <StatsSection
        title="Restarts and turnovers"
        rows={[
          [
            "Possession changes",
            String(stats.home.possessionChanges),
            String(stats.away.possessionChanges)
          ],
          ["Corners", String(stats.home.restarts.corners), String(stats.away.restarts.corners)],
          [
            "Free kicks",
            String(stats.home.restarts.freeKicks),
            String(stats.away.restarts.freeKicks)
          ],
          [
            "Throws / goal kicks",
            restartSummary(stats.home.restarts),
            restartSummary(stats.away.restarts)
          ]
        ]}
        home={home}
        away={away}
      />

      <StatsSection
        title="Territory and momentum"
        rows={[
          [
            "Attacking third",
            `${stats.territory.homeAttackingThird}%`,
            `${stats.territory.awayAttackingThird}%`
          ],
          ["Central / wide", laneSummary(stats.territory), ""],
          ["Momentum now", momentumValue(tick, "home"), momentumValue(tick, "away")],
          ["Peak momentum", String(stats.momentumPeak.home), String(stats.momentumPeak.away)]
        ]}
        home={home}
        away={away}
      />
    </div>
  );
}

function StatsSection({
  title,
  rows,
  home,
  away
}: {
  title: string;
  rows: Array<[label: string, homeValue: string, awayValue: string]>;
  home: string;
  away: string;
}) {
  return (
    <section style={styles.statsSection}>
      <h3 style={styles.subPanelTitle}>{title}</h3>
      <div style={styles.statsTable}>
        <strong>Metric</strong>
        <strong>{home}</strong>
        <strong>{away}</strong>
        {rows.map(([label, homeValue, awayValue]) => (
          <Fragment key={`${title}-${label}`}>
            <span>{label}</span>
            <span>{homeValue}</span>
            <span>{awayValue}</span>
          </Fragment>
        ))}
      </div>
    </section>
  );
}

export function statsForReplay(ticks: MatchTick[]): ReplayStats {
  const stats: ReplayStats = {
    home: emptyReplayTeamStats(),
    away: emptyReplayTeamStats(),
    possession: { home: 50, away: 50 },
    possessionTicks: { home: 0, away: 0 },
    territory: {
      homeAttackingThird: 0,
      awayAttackingThird: 0,
      centralLane: 0,
      leftFlank: 0,
      rightFlank: 0
    },
    momentumPeak: { home: 0, away: 0 }
  };
  let ballSamples = 0;
  let homeAttackingThirdSamples = 0;
  let awayAttackingThirdSamples = 0;
  let centralLaneSamples = 0;
  let leftFlankSamples = 0;
  let rightFlankSamples = 0;

  for (const tick of ticks) {
    if (tick.possession.teamId) {
      stats.possessionTicks[tick.possession.teamId] += 1;
    }

    ballSamples += 1;
    const [ballX, ballY] = tick.ball.position;
    if (ballX >= PITCH_WIDTH / 3 && ballX <= (PITCH_WIDTH * 2) / 3) {
      centralLaneSamples += 1;
    } else if (ballX < PITCH_WIDTH / 3) {
      leftFlankSamples += 1;
    } else {
      rightFlankSamples += 1;
    }

    if (tick.possession.teamId === "home" && ballY >= (PITCH_LENGTH * 2) / 3) {
      homeAttackingThirdSamples += 1;
    } else if (tick.possession.teamId === "away" && ballY <= PITCH_LENGTH / 3) {
      awayAttackingThirdSamples += 1;
    }

    if (tick.attackMomentum) {
      stats.momentumPeak.home = Math.max(
        stats.momentumPeak.home,
        Math.round(tick.attackMomentum.home)
      );
      stats.momentumPeak.away = Math.max(
        stats.momentumPeak.away,
        Math.round(tick.attackMomentum.away)
      );
    }

    for (const event of tick.events) {
      if (event.type === "shot") {
        recordShot(stats[event.team].shots, event);
      } else if (event.type === "save") {
        stats[event.team].saves += 1;
      } else if (event.type === "foul") {
        stats[event.team].fouls += 1;
      } else if (event.type === "yellow") {
        stats[event.team].yellowCards += 1;
        stats[event.team].cards += 1;
      } else if (event.type === "red") {
        stats[event.team].redCards += 1;
        stats[event.team].cards += 1;
      } else if (event.type === "pass") {
        recordPass(stats[event.team].passes, event);
      } else if (event.type === "carry") {
        recordCarry(stats[event.team].carries, event);
      } else if (event.type === "corner") {
        stats[event.team].restarts.corners += 1;
      } else if (event.type === "free_kick") {
        stats[event.team].restarts.freeKicks += 1;
      } else if (event.type === "throw_in") {
        stats[event.team].restarts.throwIns += 1;
      } else if (event.type === "goal_kick") {
        stats[event.team].restarts.goalKicks += 1;
      } else if (event.type === "possession_change") {
        stats[event.team].possessionChanges += 1;
      }
    }
  }

  const possessionTicks = stats.possessionTicks.home + stats.possessionTicks.away;
  if (possessionTicks > 0) {
    stats.possession.home = Math.round((stats.possessionTicks.home / possessionTicks) * 100);
    stats.possession.away = 100 - stats.possession.home;
  }

  stats.territory.homeAttackingThird = percentage(
    homeAttackingThirdSamples,
    stats.possessionTicks.home
  );
  stats.territory.awayAttackingThird = percentage(
    awayAttackingThirdSamples,
    stats.possessionTicks.away
  );
  stats.territory.centralLane = percentage(centralLaneSamples, ballSamples);
  stats.territory.leftFlank = percentage(leftFlankSamples, ballSamples);
  stats.territory.rightFlank = percentage(rightFlankSamples, ballSamples);

  return stats;
}

function emptyReplayTeamStats(): ReplayTeamStats {
  return {
    shots: { total: 0, on: 0, off: 0, blocked: 0 },
    saves: 0,
    fouls: 0,
    yellowCards: 0,
    redCards: 0,
    cards: 0,
    passes: {
      notable: 0,
      complete: 0,
      incomplete: 0,
      progressive: 0,
      key: 0,
      crosses: 0,
      cutbacks: 0
    },
    carries: { total: 0, progressive: 0, wide: 0 },
    restarts: { corners: 0, freeKicks: 0, throwIns: 0, goalKicks: 0 },
    possessionChanges: 0
  };
}

function recordShot(stats: ShotStats, event: SemanticEvent): void {
  stats.total += 1;
  if (event.detail?.blocked === true || event.detail?.outcome === "blocked") {
    stats.blocked += 1;
  } else if (event.detail?.onTarget === true) {
    stats.on += 1;
  } else {
    stats.off += 1;
  }
}

function recordPass(stats: PassStats, event: SemanticEvent): void {
  stats.notable += 1;
  if (event.detail?.complete === false) {
    stats.incomplete += 1;
  } else {
    stats.complete += 1;
  }
  if (event.detail?.progressive === true) {
    stats.progressive += 1;
  }
  if (event.detail?.keyPass === true) {
    stats.key += 1;
  }
  if (event.detail?.passType === "cross") {
    stats.crosses += 1;
  }
  if (event.detail?.passType === "cutback") {
    stats.cutbacks += 1;
  }
}

function recordCarry(stats: CarryStats, event: SemanticEvent): void {
  stats.total += 1;
  if (event.detail?.progressive === true) {
    stats.progressive += 1;
  }
  if (event.detail?.flank === "left" || event.detail?.flank === "right") {
    stats.wide += 1;
  }
}

function shotBreakdown(shots: ShotStats): string {
  return `${shots.on} / ${shots.off} / ${shots.blocked}`;
}

function shotAccuracy(shots: ShotStats): string {
  return shots.total > 0 ? `${Math.round((shots.on / shots.total) * 100)}%` : "-";
}

function passCompletion(passes: PassStats): string {
  return `${passes.complete}/${passes.notable} (${passes.incomplete} inc)`;
}

function passThreat(passes: PassStats): string {
  return `${passes.progressive} / ${passes.key}`;
}

function passDelivery(passes: PassStats): string {
  return `${passes.crosses} / ${passes.cutbacks}`;
}

function carrySummary(carries: CarryStats): string {
  return `${carries.total} (${carries.progressive} prog, ${carries.wide} wide)`;
}

function restartSummary(restarts: RestartStats): string {
  return `${restarts.throwIns} / ${restarts.goalKicks}`;
}

function laneSummary(territory: ReplayStats["territory"]): string {
  return `${territory.centralLane}% / ${territory.leftFlank + territory.rightFlank}%`;
}

function momentumValue(tick: MatchTick, team: TeamId): string {
  return tick.attackMomentum ? String(Math.round(tick.attackMomentum[team])) : "-";
}

function teamName(snapshot: MatchSnapshot, team: TeamId): string {
  return team === "home" ? snapshot.meta.homeTeam.shortName : snapshot.meta.awayTeam.shortName;
}

function percentage(value: number, total: number): number {
  return total > 0 ? Math.round((value / total) * 100) : 0;
}

const styles = {
  statsPanel: {
    display: "grid",
    gap: "12px"
  },
  scoreStrip: {
    display: "grid",
    gridTemplateColumns: "1fr auto 1fr",
    gap: "6px 10px",
    alignItems: "center",
    borderBottom: "1px solid #284131",
    paddingBottom: "10px"
  },
  statsSection: {
    borderTop: "1px solid #203427",
    paddingTop: "10px"
  },
  subPanelTitle: {
    margin: "0 0 8px",
    fontSize: "13px",
    color: "#e8efe9"
  },
  statsTable: {
    display: "grid",
    gridTemplateColumns: "1.4fr 0.8fr 0.8fr",
    gap: "6px 8px",
    alignItems: "baseline",
    fontSize: "12px"
  }
} satisfies Record<string, CSSProperties>;
