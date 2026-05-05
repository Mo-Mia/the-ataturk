import type { ReactNode } from "react";

import type { SquadManagerSuggestion, VerifySquadResponse } from "../lib/api";

export type SuggestionRiskLevel = "low" | "medium" | "high";

interface VerificationPanelProps {
  result: VerifySquadResponse | null;
  acceptedIds: Set<string>;
  inspectedSuggestionId: string | null;
  reviewMode: boolean;
  onToggle: (suggestionId: string) => void;
  onToggleMany: (suggestionIds: string[], shouldAccept: boolean) => void;
  onInspect: (suggestion: SquadManagerSuggestion | null) => void;
  onApplyRisk: (riskLevel: SuggestionRiskLevel) => void;
  renderEditor: (suggestion: SquadManagerSuggestion) => ReactNode;
}

const SECTIONS = [
  ["Low risk", "low", "Metadata-only updates that can be applied this sprint."],
  ["Medium risk", "medium", "Position changes remain review-only this sprint."],
  ["High risk", "high", "Additions and removals remain review-only this sprint."]
] as const;

export function VerificationPanel({
  result,
  acceptedIds,
  inspectedSuggestionId,
  reviewMode,
  onToggle,
  onToggleMany,
  onInspect,
  onApplyRisk,
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
      {SECTIONS.map(([title, riskLevel, description]) => {
        const suggestions = suggestionsForRisk(result, riskLevel);
        const suggestionIds = suggestions.map((suggestion) => suggestion.suggestionId);
        const selectable = riskLevel === "low";
        const allAccepted =
          suggestionIds.length > 0 &&
          suggestionIds.every((suggestionId) => acceptedIds.has(suggestionId));
        const selectedCount = suggestionIds.filter((suggestionId) =>
          acceptedIds.has(suggestionId)
        ).length;
        const applyEnabled = selectable && selectedCount > 0 && !reviewMode;

        return (
          <details key={riskLevel} open>
            <summary>
              {title} ({suggestions.length})
            </summary>
            <p className="verification-panel__risk-note">{description}</p>
            {suggestions.length > 0 ? (
              <div className="verification-panel__section-actions">
                <button
                  type="button"
                  onClick={() => onToggleMany(suggestionIds, true)}
                  disabled={!selectable || allAccepted}
                >
                  Select all
                </button>
                <button
                  type="button"
                  onClick={() => onToggleMany(suggestionIds, false)}
                  disabled={
                    !selectable ||
                    !suggestionIds.some((suggestionId) => acceptedIds.has(suggestionId))
                  }
                >
                  Clear
                </button>
                <button
                  type="button"
                  data-uat="squad-manager-apply-button"
                  data-risk-level={riskLevel}
                  data-review-mode={reviewMode ? "on" : "off"}
                  data-apply-available={applyEnabled ? "true" : "false"}
                  title={
                    riskLevel === "low"
                      ? reviewMode
                        ? "Turn review mode off to apply low-risk suggestions."
                        : "Apply selected low-risk suggestions."
                      : "Review-only this sprint."
                  }
                  onClick={() => onApplyRisk(riskLevel)}
                  disabled={!applyEnabled}
                >
                  Apply {riskLevel}
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
                        disabled={!selectable}
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

export function classifySuggestionRisk(suggestion: SquadManagerSuggestion): SuggestionRiskLevel {
  if (suggestion.type === "player_addition" || suggestion.type === "player_removal") {
    return "high";
  }
  if (suggestion.changes.position !== undefined) {
    return "medium";
  }
  return "low";
}

function suggestionsForRisk(
  result: VerifySquadResponse,
  riskLevel: SuggestionRiskLevel
): SquadManagerSuggestion[] {
  return [
    ...result.verification.missingPlayers,
    ...result.verification.suggestions,
    ...result.verification.attributeWarnings
  ].filter((suggestion) => classifySuggestionRisk(suggestion) === riskLevel);
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
