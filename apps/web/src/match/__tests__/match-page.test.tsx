import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MatchPage } from "../MatchPage";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function streamFromText(text: string): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(text));
      controller.close();
    }
  });
}

describe("MatchPage", () => {
  it("starts the match stream when kickoff is clicked", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        streamFromText(
          [
            "event: tick",
            `data: ${JSON.stringify({
              iteration: 0,
              matchClock: { half: 2, minute: 45, seconds: 0 },
              score: {
                home: { club_id: "liverpool", name: "Liverpool", goals: 0 },
                away: { club_id: "ac-milan", name: "AC Milan", goals: 3 }
              },
              events: [],
              matchDetails: {
                kickOffTeam: { teamID: "liverpool", name: "Liverpool", players: [] },
                secondTeam: { teamID: "ac-milan", name: "AC Milan", players: [] },
                kickOffTeamStatistics: {},
                secondTeamStatistics: {}
              }
            })}`,
            "",
            "event: final",
            `data: ${JSON.stringify({
              iterations: 450,
              finalClock: { half: 2, minute: 90, seconds: 0 },
              finalScore: { home: 1, away: 3 }
            })}`,
            ""
          ].join("\n")
        )
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<MatchPage />);

    fireEvent.click(screen.getByRole("button", { name: "Kick off" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith("/api/match/run", expect.any(Object))
    );
    await waitFor(() => expect(screen.queryByText("Liverpool 1-3 AC Milan")).not.toBeNull());
  });
});
