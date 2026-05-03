import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApplyDialog } from "../ApplyDialog";

afterEach(cleanup);

describe("ApplyDialog", () => {
  it("shows the new dataset version preview and confirms", () => {
    const onConfirm = vi.fn();
    render(
      <ApplyDialog
        open
        baseVersionId="fc25-base"
        acceptedSuggestions={[]}
        onCancel={vi.fn()}
        onConfirm={onConfirm}
      />
    );

    expect(screen.getByText(/fc25-base via squad-manager/)).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(onConfirm).toHaveBeenCalled();
  });
});
