import type { Fc25SquadPlayer } from "../lib/api";

interface SquadListProps {
  title: string;
  squad: Fc25SquadPlayer[];
  selectedPlayerId?: string;
  onSelectPlayer?: (playerId: string) => void;
}

export function SquadList({ title, squad, selectedPlayerId, onSelectPlayer }: SquadListProps) {
  return (
    <section className="squad-list" aria-label={title}>
      <header className="squad-list__header">
        <h2>{title}</h2>
        <span>{squad.length} players</span>
      </header>
      <ol className="squad-list__rows">
        {squad.map((player, index) => (
          <li
            key={player.id}
            className={player.id === selectedPlayerId ? "is-selected" : undefined}
          >
            <button
              type="button"
              onClick={() => onSelectPlayer?.(player.id)}
              aria-label={`Select ${player.name}`}
            >
              <span className="squad-list__number">
                {player.squadNumber ?? String(index + 1).padStart(2, "0")}
              </span>
              <span className="squad-list__name">{player.name}</span>
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
