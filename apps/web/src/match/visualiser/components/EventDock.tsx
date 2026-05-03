import type { MatchSnapshot, SemanticEvent, TeamId } from "@the-ataturk/match-engine";

export function EventDock({
  snapshot,
  events,
  title = "Events"
}: {
  snapshot: MatchSnapshot | null;
  events: SemanticEvent[];
  title?: string;
}) {
  return (
    <section style={styles.eventDock} aria-label={title}>
      <div style={styles.eventHeader}>
        <h2 style={styles.panelTitle}>{title}</h2>
        <span style={styles.muted}>{events.length} events</span>
      </div>
      {snapshot ? (
        <EventLog snapshot={snapshot} events={events} />
      ) : (
        <p style={styles.muted}>No events.</p>
      )}
    </section>
  );
}

export function EventLog({
  snapshot,
  events
}: {
  snapshot: MatchSnapshot;
  events: SemanticEvent[];
}) {
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

export function formatEventDetail(snapshot: MatchSnapshot, event: SemanticEvent): string {
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

  if (event.type === "chance_created") {
    const parts = [
      detailString(event.detail.source, ""),
      event.detail.convertedToShot === true ? "shot taken" : "no shot",
      pressureText(event.detail.pressure),
      detailString(event.detail.distanceBand, "")
    ].filter(Boolean);
    return parts.length > 0 ? `(${parts.join(", ")})` : "";
  }

  if (event.type === "corner_taken") {
    return `(${detailString(event.detail.deliveryType, "delivery")})`;
  }

  if (event.type === "free_kick_taken") {
    return `(${detailString(event.detail.kickType, "taken")})`;
  }

  if (event.type === "penalty_taken") {
    return "(taken)";
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

  if (event.type === "half_time") {
    const score = event.detail.score;
    const possession = event.detail.possession;
    const parts = [
      score ? detailScore(score) : "",
      possessionText(possession),
      "second-half kick-off pending"
    ].filter(Boolean);
    return parts.length > 0 ? `(${parts.join(", ")})` : "";
  }

  return "";
}

function eventLabel(event: SemanticEvent): string {
  if (event.type === "full_time") {
    return "Full time";
  }
  if (event.type === "half_time") {
    return "Half time";
  }
  return event.type.replaceAll("_", " ");
}

function isGoalEvent(event: SemanticEvent): boolean {
  return event.type === "goal_scored" || event.type === "goal";
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
    case "kickoff_second_half":
      return `${winner} takes the second-half kick-off${suffix}`;
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

function possessionText(value: unknown): string {
  if (
    typeof value === "object" &&
    value !== null &&
    "home" in value &&
    "away" in value &&
    typeof value.home === "number" &&
    typeof value.away === "number"
  ) {
    return `possession ${value.home}/${value.away}`;
  }

  return "";
}

function playerName(snapshot: MatchSnapshot, team: TeamId, playerId: string): string {
  return (
    snapshot.meta.rosters[team].find((player) => player.id === playerId)?.shortName ?? playerId
  );
}

function playerNameById(snapshot: MatchSnapshot, playerId: string): string {
  return (
    snapshot.meta.rosters.home.find((player) => player.id === playerId)?.shortName ??
    snapshot.meta.rosters.away.find((player) => player.id === playerId)?.shortName ??
    playerId
  );
}

function teamName(snapshot: MatchSnapshot, team: TeamId): string {
  return team === "home" ? snapshot.meta.homeTeam.shortName : snapshot.meta.awayTeam.shortName;
}

const styles = {
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
  panelTitle: { margin: "0 0 10px", fontSize: "18px" },
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
  eventDetail: { color: "#aeb8b1" }
};
