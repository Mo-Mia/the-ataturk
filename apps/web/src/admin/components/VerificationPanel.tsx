import type { SquadManagerSuggestion, VerifySquadResponse } from "../lib/api";

interface VerificationPanelProps {
  result: VerifySquadResponse | null;
  acceptedIds: Set<string>;
  onToggle: (suggestionId: string) => void;
  onInspect: (suggestion: SquadManagerSuggestion) => void;
}

const SECTIONS = [
  ["Missing players", "missingPlayers"],
  ["Suggestions", "suggestions"],
  ["Attribute warnings", "attributeWarnings"]
] as const;

export function VerificationPanel({
  result,
  acceptedIds,
  onToggle,
  onInspect
}: VerificationPanelProps) {
  if (!result) {
    return (
      <section className="verification-panel">
        <h2>Verification</h2>
        <p className="squad-manager-muted">No verification run yet.</p>
      </section>
    );
  }

  return (
    <section className="verification-panel">
      <header className="verification-panel__header">
        <h2>Verification</h2>
        <p>
          Cache {result.cacheStatus}; quota {result.apiQuotaRemaining.minute}/min ·{" "}
          {result.apiQuotaRemaining.day}/day
        </p>
      </header>
      {SECTIONS.map(([title, key]) => (
        <details key={key} open>
          <summary>
            {title} ({result.verification[key].length})
          </summary>
          <div className="verification-items">
            {result.verification[key].map((suggestion) => (
              <article key={suggestion.suggestionId} className="verification-item">
                <label>
                  <input
                    type="checkbox"
                    checked={acceptedIds.has(suggestion.suggestionId)}
                    onChange={() => onToggle(suggestion.suggestionId)}
                  />
                  <span>{labelForSuggestion(suggestion)}</span>
                </label>
                <button type="button" onClick={() => onInspect(suggestion)}>
                  Inspect
                </button>
                {suggestion.rationale ? <p>{suggestion.rationale}</p> : null}
              </article>
            ))}
            {result.verification[key].length === 0 ? (
              <p className="squad-manager-muted">No items.</p>
            ) : null}
          </div>
        </details>
      ))}
    </section>
  );
}

function labelForSuggestion(suggestion: SquadManagerSuggestion): string {
  if (suggestion.type === "player_addition") {
    return `Add ${suggestion.proposed.name}`;
  }
  if (suggestion.type === "player_removal") {
    return `Move ${suggestion.playerId} to reserve`;
  }
  return `Update ${suggestion.playerId}`;
}
