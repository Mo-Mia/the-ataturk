import type { ReactNode } from "react";

import type { SquadManagerSuggestion, VerifySquadResponse } from "../lib/api";

interface VerificationPanelProps {
  result: VerifySquadResponse | null;
  acceptedIds: Set<string>;
  inspectedSuggestionId: string | null;
  onToggle: (suggestionId: string) => void;
  onToggleMany: (suggestionIds: string[], shouldAccept: boolean) => void;
  onInspect: (suggestion: SquadManagerSuggestion | null) => void;
  renderEditor: (suggestion: SquadManagerSuggestion) => ReactNode;
}

const SECTIONS = [
  ["Missing players", "missingPlayers"],
  ["Suggestions", "suggestions"],
  ["Attribute warnings", "attributeWarnings"]
] as const;

export function VerificationPanel({
  result,
  acceptedIds,
  inspectedSuggestionId,
  onToggle,
  onToggleMany,
  onInspect,
  renderEditor
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
      {SECTIONS.map(([title, key]) => {
        const suggestions = result.verification[key];
        const suggestionIds = suggestions.map((suggestion) => suggestion.suggestionId);
        const allAccepted =
          suggestionIds.length > 0 &&
          suggestionIds.every((suggestionId) => acceptedIds.has(suggestionId));

        return (
          <details key={key} open>
            <summary>
              {title} ({suggestions.length})
            </summary>
            {suggestions.length > 0 ? (
              <div className="verification-panel__section-actions">
                <button
                  type="button"
                  onClick={() => onToggleMany(suggestionIds, true)}
                  disabled={allAccepted}
                >
                  Select all
                </button>
                <button
                  type="button"
                  onClick={() => onToggleMany(suggestionIds, false)}
                  disabled={!suggestionIds.some((suggestionId) => acceptedIds.has(suggestionId))}
                >
                  Clear
                </button>
              </div>
            ) : null}
            <div className="verification-items">
              {suggestions.map((suggestion) => {
                const isInspected = inspectedSuggestionId === suggestion.suggestionId;
                return (
                  <article key={suggestion.suggestionId} className="verification-item">
                    <label>
                      <input
                        type="checkbox"
                        checked={acceptedIds.has(suggestion.suggestionId)}
                        onChange={() => onToggle(suggestion.suggestionId)}
                      />
                      <span>{labelForSuggestion(suggestion)}</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => onInspect(isInspected ? null : suggestion)}
                    >
                      {isInspected ? "Close" : "Inspect"}
                    </button>
                    {suggestion.rationale ? <p>{suggestion.rationale}</p> : null}
                    {isInspected ? (
                      <div className="verification-item__editor">{renderEditor(suggestion)}</div>
                    ) : null}
                  </article>
                );
              })}
              {suggestions.length === 0 ? <p className="squad-manager-muted">No items.</p> : null}
            </div>
          </details>
        );
      })}
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
