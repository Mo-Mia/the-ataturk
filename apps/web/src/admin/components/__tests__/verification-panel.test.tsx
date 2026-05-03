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
    suggestions: [],
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
        onToggle={onToggle}
        onInspect={onInspect}
      />
    );

    fireEvent.click(screen.getByLabelText(/Add New Forward/));
    fireEvent.click(screen.getByRole("button", { name: "Inspect" }));

    expect(onToggle).toHaveBeenCalledWith("sug-1");
    expect(onInspect).toHaveBeenCalledWith(result.verification.missingPlayers[0]);
  });
});
