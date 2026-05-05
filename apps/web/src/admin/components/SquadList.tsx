import type { Fc25SquadPlayer } from "../lib/api";

interface SquadListProps {
  title: string;
  squad: Fc25SquadPlayer[];
  selectedPlayerId?: string;
  onSelectPlayer?: (playerId: string) => void;
}

export function SquadList({ title, squad, selectedPlayerId, onSelectPlayer }: SquadListProps) {
  return (
    <section className="squad-list" aria-label={title} data-uat="squad-manager-squad-list">
      <header className="squad-list__header">
        <h2>{title}</h2>
        <span>{squad.length} players</span>
      </header>
      <ol className="squad-list__rows">
        {squad.map((player, index) => (
          <li
            key={player.id}
            className={player.id === selectedPlayerId ? "is-selected" : undefined}
            data-uat="squad-manager-player"
            data-player-id={player.id}
            data-display-name={displayName(player)}
            data-source-name={player.sourceName}
            data-source-short-name={player.sourceShortName ?? ""}
          >
            <button
              type="button"
              onClick={() => onSelectPlayer?.(player.id)}
              aria-label={`Select ${displayName(player)}`}
              title={player.sourceName}
            >
              <span className="squad-list__number">
                {player.squadNumber ?? String(index + 1).padStart(2, "0")}
              </span>
              <span className="squad-list__name">{displayName(player)}</span>
              <span className="squad-list__meta">
                {player.position} · OVR {player.overall}
              </span>
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}

function displayName(player: Fc25SquadPlayer): string {
  return player.displayName ?? player.shortName ?? player.name;
}
