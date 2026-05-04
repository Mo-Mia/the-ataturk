import { afterEach, describe, expect, it } from "vitest";

import {
  Fc25LineupSelectionError,
  getDb,
  importFc25Dataset,
  listFc25Clubs,
  loadFc25Squad,
  selectLineup,
  selectStartingXI,
  type SupportedFormation
} from "../../src";
import { createTestDatabase, type TestDatabase } from "../test-db";

const FIXTURE_PATH = "data/fc-25/fixtures/male_players_top5pl.csv";
const FORMATIONS: SupportedFormation[] = ["4-4-2", "4-3-1-2", "4-3-3", "4-2-3-1"];

let testDatabase: TestDatabase | undefined;

afterEach(() => {
  testDatabase?.cleanup();
  testDatabase = undefined;
});

describe("selectStartingXI", () => {
  it("selects deterministic Liverpool XIs for all supported formations", () => {
    const squad = loadLiverpoolSquad();

    expect(shortLineup(selectStartingXI(squad, "4-4-2"))).toEqual([
      "GK:Alisson",
      "RB:Alexander-Arnold",
      "CB:Dijk",
      "CB:Konaté",
      "LB:Robertson",
      "RM:Salah",
      "CM:Allister",
      "CM:Jones",
      "LM:Díaz",
      "ST:Jota",
      "ST:Gakpo"
    ]);
    expect(shortLineup(selectStartingXI(squad, "4-3-1-2"))).toEqual([
      "GK:Alisson",
      "RB:Alexander-Arnold",
      "CB:Dijk",
      "CB:Konaté",
      "LB:Robertson",
      "CM:Allister",
      "DM:Endo",
      "CM:Jones",
      "AM:Szoboszlai",
      "ST:Jota",
      "ST:Gakpo"
    ]);
    expect(shortLineup(selectStartingXI(squad, "4-3-3"))).toEqual([
      "GK:Alisson",
      "LB:Robertson",
      "CB:Dijk",
      "CB:Konaté",
      "RB:Alexander-Arnold",
      "DM:Endo",
      "CM:Allister",
      "CM:Jones",
      "LW:Díaz",
      "ST:Jota",
      "RW:Salah"
    ]);
    expect(shortLineup(selectStartingXI(squad, "4-2-3-1"))).toEqual([
      "GK:Alisson",
      "LB:Robertson",
      "CB:Dijk",
      "CB:Konaté",
      "RB:Alexander-Arnold",
      "DM:Endo",
      "DM:Morton",
      "LW:Díaz",
      "AM:Szoboszlai",
      "RW:Salah",
      "ST:Jota"
    ]);
  });

  it("selects valid XIs for every imported club and supported formation", () => {
    const db = importFixture();

    for (const clubId of listFc25Clubs("fc25-xi-test", db).map((club) => club.id)) {
      const squad = loadFc25Squad(clubId, "fc25-xi-test", { include: "all", db }).players;
      for (const formation of FORMATIONS) {
        const xi = selectStartingXI(squad, formation);
        expect(xi).toHaveLength(11);
        expect(new Set(xi.map((player) => player.id)).size).toBe(11);
      }
    }
  });

  it("falls back to a defensive central midfielder when no specialist DM is available", () => {
    const squad = loadLiverpoolSquad().map((player) =>
      player.sourcePosition === "DM"
        ? {
            ...player,
            sourcePosition: "CM" as const,
            alternativePositions: player.alternativePositions.filter((position) => position !== "DM")
          }
        : player
    );

    const xi = selectStartingXI(squad, "4-3-1-2");

    expect(xi.find((player) => player.position === "DM")?.shortName).toBe("Gravenberch");
  });

  it("throws a typed error when the squad cannot field a goalkeeper", () => {
    const squad = loadLiverpoolSquad().filter((player) => player.sourcePosition !== "GK");

    expect(() => selectStartingXI(squad, "4-4-2")).toThrow(Fc25LineupSelectionError);
  });

  it("is deterministic for the same squad and formation", () => {
    const squad = loadLiverpoolSquad();

    expect(selectStartingXI(squad, "4-2-3-1")).toEqual(selectStartingXI(squad, "4-2-3-1"));
  });

  it("accepts a manual XI and creates deterministic bench metadata", () => {
    const squad = loadLiverpoolSquad();
    const autoXi = selectStartingXI(squad, "4-3-3");
    const manualIds = autoXi.map((player) => player.id);

    const lineup = selectLineup(squad, "4-3-3", manualIds);

    expect(lineup.mode).toBe("manual");
    expect(lineup.xi).toHaveLength(11);
    expect(lineup.bench).toHaveLength(7);
    expect(new Set([...lineup.xi, ...lineup.bench].map((player) => player.id)).size).toBe(18);
    expect(lineup.assignments.map((assignment) => assignment.role)).toEqual([
      "GK",
      "LB",
      "CB",
      "CB",
      "RB",
      "DM",
      "CM",
      "CM",
      "LW",
      "ST",
      "RW"
    ]);
  });

  it("warns but permits manual out-of-position outfield selections", () => {
    const baseSquad = loadLiverpoolSquad();
    const manualIds = selectStartingXI(baseSquad, "4-3-3").map((player) => player.id);
    const squad = baseSquad.map((player) =>
      player.sourcePosition === "GK"
        ? player
        : { ...player, sourcePosition: "ST" as const, alternativePositions: [] }
    );

    const lineup = selectLineup(squad, "4-3-3", manualIds);

    expect(lineup.warnings.some((warning) => warning.code === "out_of_position")).toBe(true);
  });

  it("rejects invalid manual XIs", () => {
    const squad = loadLiverpoolSquad();
    const autoIds = selectStartingXI(squad, "4-4-2").map((player) => player.id);
    const noGoalkeeper = autoIds.filter(
      (playerId) => squad.find((player) => player.id === playerId)?.sourcePosition !== "GK"
    );

    expect(() => selectLineup(squad, "4-4-2", autoIds.slice(0, 10))).toThrow(
      Fc25LineupSelectionError
    );
    expect(() => selectLineup(squad, "4-4-2", [...autoIds.slice(0, 10), autoIds[0]!])).toThrow(
      Fc25LineupSelectionError
    );
    expect(() => selectLineup(squad, "4-4-2", [...noGoalkeeper, "missing-player"])).toThrow(
      Fc25LineupSelectionError
    );
  });
});

function loadLiverpoolSquad() {
  const db = importFixture();
  return loadFc25Squad("liverpool", "fc25-xi-test", { include: "all", db }).players;
}

function shortLineup(players: ReturnType<typeof selectStartingXI>): string[] {
  return players.map((player) => `${player.position}:${player.shortName}`);
}

function importFixture() {
  testDatabase = createTestDatabase(`fc25-xi-${Math.random().toString(36).slice(2)}`);
  importFc25Dataset({
    databasePath: testDatabase.path,
    csvPath: FIXTURE_PATH,
    datasetVersionId: "fc25-xi-test"
  });
  return getDb(testDatabase.path);
}
