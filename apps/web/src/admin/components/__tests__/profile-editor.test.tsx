import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ProfileEditor } from "../ProfileEditor";
import type { PlayerProfile, updatePlayerProfile } from "../../lib/api";

const profile: PlayerProfile = {
  id: "sami-hyypia:v0-empty",
  player_id: "sami-hyypia",
  profile_version: "v0-empty",
  tier: "C",
  role_2004_05: null,
  qualitative_descriptor: null,
  generated_by: "human",
  generated_at: "2026-04-29T00:00:00.000Z",
  edited: false,
  created_at: "2026-04-29T00:00:00.000Z",
  updated_at: "2026-04-29T00:00:00.000Z"
};

function renderEditor(onSaved = vi.fn(), saveProfile: typeof updatePlayerProfile = vi.fn()) {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false }
    }
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ProfileEditor profile={profile} onSaved={onSaved} saveProfile={saveProfile} />
    </QueryClientProvider>
  );
}

describe("ProfileEditor", () => {
  afterEach(() => {
    cleanup();
  });

  it("saves a changed tier and shows saving then saved states", async () => {
    const onSaved = vi.fn();
    const saveProfile = vi.fn<typeof updatePlayerProfile>();
    let resolveSave: (value: PlayerProfile) => void = () => undefined;
    saveProfile.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveSave = resolve;
      })
    );

    renderEditor(onSaved, saveProfile);

    const tierInput = screen.getByLabelText("Tier");
    fireEvent.change(tierInput, { target: { value: "A" } });
    fireEvent.blur(tierInput);

    await waitFor(() =>
      expect(saveProfile).toHaveBeenCalledWith("sami-hyypia", {
        profile_version: "v0-empty",
        changes: { tier: "A" }
      })
    );
    await waitFor(() => expect(screen.queryByText("Status: saving")).not.toBeNull());

    resolveSave({ ...profile, tier: "A", edited: true });

    await waitFor(() => expect(screen.queryByText("Status: saved")).not.toBeNull());
    expect(onSaved).toHaveBeenCalledWith({ ...profile, tier: "A", edited: true });
  });

  it("displays a server error on save rejection", async () => {
    const saveProfile = vi.fn<typeof updatePlayerProfile>();
    saveProfile.mockRejectedValueOnce(new Error("Rejected by server"));

    renderEditor(vi.fn(), saveProfile);

    const roleInput = screen.getByLabelText("Role 2004/05");
    fireEvent.change(roleInput, { target: { value: "First-choice centre-back." } });
    fireEvent.blur(roleInput);

    await waitFor(() => expect(screen.queryByText("Rejected by server")).not.toBeNull());
  });
});
