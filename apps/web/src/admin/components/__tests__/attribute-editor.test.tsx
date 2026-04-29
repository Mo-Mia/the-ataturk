import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AttributeEditor } from "../AttributeEditor";
import type { PlayerAttributes, updatePlayerAttributes } from "../../lib/api";

const attributes: PlayerAttributes = {
  id: "sami-hyypia:v0-stub",
  player_id: "sami-hyypia",
  dataset_version: "v0-stub",
  passing: 0,
  shooting: 0,
  tackling: 0,
  saving: 0,
  agility: 0,
  strength: 0,
  penalty_taking: 0,
  perception: 0,
  jumping: 0,
  control: 0,
  rationale: "Stub",
  generated_by: "human",
  generated_at: "2026-04-29T00:00:00.000Z",
  created_at: "2026-04-29T00:00:00.000Z",
  updated_at: "2026-04-29T00:00:00.000Z"
};

function renderEditor(onSaved = vi.fn(), saveAttributes: typeof updatePlayerAttributes = vi.fn()) {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false }
    }
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <AttributeEditor attributes={attributes} onSaved={onSaved} saveAttributes={saveAttributes} />
    </QueryClientProvider>
  );
}

describe("AttributeEditor", () => {
  afterEach(() => {
    cleanup();
  });

  it("saves a changed value and shows saving then saved states", async () => {
    const onSaved = vi.fn();
    const saveAttributes = vi.fn<typeof updatePlayerAttributes>();
    let resolveSave: (value: PlayerAttributes) => void = () => undefined;
    saveAttributes.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveSave = resolve;
      })
    );

    renderEditor(onSaved, saveAttributes);

    const tacklingInput = screen.getByLabelText("tackling");
    fireEvent.change(tacklingInput, { target: { value: "86" } });
    fireEvent.blur(tacklingInput);

    await waitFor(() =>
      expect(saveAttributes).toHaveBeenCalledWith("sami-hyypia", {
        dataset_version: "v0-stub",
        changes: { tackling: 86 }
      })
    );
    await waitFor(() => expect(screen.getAllByText("saving").length).toBeGreaterThan(0));

    resolveSave({ ...attributes, tackling: 86 });

    await waitFor(() => expect(screen.getAllByText("saved").length).toBeGreaterThan(0));
    expect(onSaved).toHaveBeenCalledWith({ ...attributes, tackling: 86 });
  });

  it("displays a server error on save rejection", async () => {
    const saveAttributes = vi.fn<typeof updatePlayerAttributes>();
    saveAttributes.mockRejectedValueOnce(new Error("Rejected by server"));

    renderEditor(vi.fn(), saveAttributes);

    const passingInput = screen.getByLabelText("passing");
    fireEvent.change(passingInput, { target: { value: "88" } });
    fireEvent.blur(passingInput);

    await waitFor(() => expect(screen.queryByText("Rejected by server")).not.toBeNull());
  });

  it("shows a client-side validation error without calling the API", () => {
    const saveAttributes = vi.fn<typeof updatePlayerAttributes>();
    renderEditor(vi.fn(), saveAttributes);

    const shootingInput = screen.getByLabelText("shooting");
    fireEvent.change(shootingInput, { target: { value: "101" } });
    fireEvent.blur(shootingInput);

    expect(screen.queryByText("Enter an integer from 0 to 100.")).not.toBeNull();
    expect(saveAttributes).not.toHaveBeenCalled();
  });
});
