import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { VerificationPanel } from "../VerificationPanel";
import type { VerifySquadResponse } from "../../lib/api";

const result: VerifySquadResponse = {
  cacheStatus: "miss",
  apiQuotaRemaining: { minute: 9, day: 99 },
  verification: {
    missingPlayers: [
      {
        suggestionId: "sug-1",
        type: "player_addition",
        livePlayer: {
          id: 1,
          name: "New Forward",
          position: "Forward",
          nationality: "England"
        },
        proposed: {
          name: "New Forward",
          position: "ST",
          nationality: "England",
          age: 26
        }
      }
    ],
    suggestions: [
      {
        suggestionId: "sug-low",
        type: "player_update",
        playerId: "salah",
        changes: {
          nationality: "Egypt"
        }
      }
    ],
    attributeWarnings: []
  }
};

afterEach(cleanup);

describe("VerificationPanel", () => {
  it("toggles acceptance and inspects suggestions", () => {
    const onToggle = vi.fn();
    const onInspect = vi.fn();
    render(
      <VerificationPanel
        result={result}
        acceptedIds={new Set()}
        inspectedSuggestionId={null}
        reviewMode={false}
        onToggle={onToggle}
        onToggleMany={vi.fn()}
        onInspect={onInspect}
        onApplyRisk={vi.fn()}
        renderEditor={() => <p>Editor</p>}
      />
    );

    fireEvent.click(screen.getByLabelText(/Update salah/));
    fireEvent.click(screen.getAllByRole("button", { name: "Inspect" })[0]!);

    expect(onToggle).toHaveBeenCalledWith("sug-low");
    expect(onInspect).toHaveBeenCalledWith(result.verification.suggestions[0]);
  });

  it("selects and clears all suggestions in a section", () => {
    const onToggleMany = vi.fn();
    render(
      <VerificationPanel
        result={result}
        acceptedIds={new Set()}
        inspectedSuggestionId={null}
        reviewMode={false}
        onToggle={vi.fn()}
        onToggleMany={onToggleMany}
        onInspect={vi.fn()}
        onApplyRisk={vi.fn()}
        renderEditor={() => <p>Editor</p>}
      />
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Select all" })[0]!);
    expect(onToggleMany).toHaveBeenCalledWith(["sug-low"], true);

    cleanup();
    render(
      <VerificationPanel
        result={result}
        acceptedIds={new Set(["sug-low"])}
        inspectedSuggestionId={null}
        reviewMode={false}
        onToggle={vi.fn()}
        onToggleMany={onToggleMany}
        onInspect={vi.fn()}
        onApplyRisk={vi.fn()}
        renderEditor={() => <p>Editor</p>}
      />
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Clear" })[0]!);
    expect(onToggleMany).toHaveBeenCalledWith(["sug-low"], false);
  });

  it("keeps medium and high apply controls review-only", () => {
    const onApplyRisk = vi.fn();
    render(
      <VerificationPanel
        result={result}
        acceptedIds={new Set(["sug-low"])}
        inspectedSuggestionId={null}
        reviewMode={false}
        onToggle={vi.fn()}
        onToggleMany={vi.fn()}
        onInspect={vi.fn()}
        onApplyRisk={onApplyRisk}
        renderEditor={() => <p>Editor</p>}
      />
    );

    expect(
      document.querySelector<HTMLButtonElement>(
        '[data-uat="squad-manager-apply-button"][data-risk-level="low"]'
      )?.disabled
    ).toBe(false);
    expect(
      document.querySelector<HTMLButtonElement>(
        '[data-uat="squad-manager-apply-button"][data-risk-level="high"]'
      )?.disabled
    ).toBe(true);
  });

  it("renders the inspected editor inline", () => {
    render(
      <VerificationPanel
        result={result}
        acceptedIds={new Set()}
        inspectedSuggestionId="sug-1"
        reviewMode={false}
        onToggle={vi.fn()}
        onToggleMany={vi.fn()}
        onInspect={vi.fn()}
        onApplyRisk={vi.fn()}
        renderEditor={(suggestion) => <p>Editing {suggestion.suggestionId}</p>}
      />
    );

    expect(screen.getByText("Editing sug-1")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Close" })).not.toBeNull();
  });
});
