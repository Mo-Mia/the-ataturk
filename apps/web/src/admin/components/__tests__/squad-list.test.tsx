import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SquadList } from "../SquadList";
import type { Fc25SquadPlayer } from "../../lib/api";

const squad: Fc25SquadPlayer[] = [
  {
    id: "salah",
    name: "Mohamed Salah",
    shortName: "M. Salah",
    displayName: "Mohamed Salah",
    sourceName: "Mohamed Salah Hamed Ghalyمحمد صلاح",
    sourceShortName: "M. Salah",
    squadNumber: 11,
    position: "RW",
    age: 33,
    overall: 89,
    sourcePosition: "RW",
    alternativePositions: ["RM"]
  }
];

afterEach(cleanup);

describe("SquadList", () => {
  it("renders squad rows and selects a player", () => {
    const onSelect = vi.fn();
    render(<SquadList title="Home squad" squad={squad} onSelectPlayer={onSelect} />);

    expect(screen.getByText("Mohamed Salah")).not.toBeNull();
    fireEvent.click(screen.getByLabelText("Select Mohamed Salah"));

    expect(onSelect).toHaveBeenCalledWith("salah");
  });
});
