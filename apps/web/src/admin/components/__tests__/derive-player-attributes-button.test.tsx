import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DerivePlayerAttributesButton } from "../DerivePlayerAttributesButton";
import type { runAttributeDerivation } from "../../lib/api";

function renderButton(
  onFinished = vi.fn(),
  runDerivation: typeof runAttributeDerivation = vi.fn()
) {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false }
    }
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <DerivePlayerAttributesButton
        datasetVersion="v1-derived"
        onFinished={onFinished}
        playerId="steven-gerrard"
        profileVersion="v1-curated"
        runDerivation={runDerivation}
      />
    </QueryClientProvider>
  );
}

describe("DerivePlayerAttributesButton", () => {
  afterEach(() => {
    cleanup();
  });

  it("calls the derivation API and shows loading then success", async () => {
    const onFinished = vi.fn();
    const runDerivation = vi.fn<typeof runAttributeDerivation>();
    let resolveDerivation: (
      value: Awaited<ReturnType<typeof runAttributeDerivation>>
    ) => void = () => undefined;
    runDerivation.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveDerivation = resolve;
      })
    );

    renderButton(onFinished, runDerivation);

    fireEvent.click(screen.getByRole("button", { name: "Derive this player" }));

    await waitFor(() => expect(screen.queryByText("Deriving...")).not.toBeNull());
    await waitFor(() =>
      expect(runDerivation).toHaveBeenCalledWith(
        {
          dataset_version: "v1-derived",
          profile_version: "v1-curated",
          player_ids: ["steven-gerrard"]
        },
        expect.any(Function)
      )
    );
    resolveDerivation({
      total: 1,
      succeeded: 1,
      failed: 0,
      failed_player_ids: []
    });
    await waitFor(() => expect(screen.queryByText("Attributes derived.")).not.toBeNull());
    expect(onFinished).toHaveBeenCalledOnce();
  });
});
