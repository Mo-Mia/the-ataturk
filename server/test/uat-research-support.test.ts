import { describe, expect, it } from "vitest";

import {
  buildAdminVerificationFixture,
  directionAssertion,
  formatSastTimestamp,
  isExpiredTempDir,
  parseUatResearchArgs
} from "../../scripts/uatResearchSupport";

describe("UAT research support", () => {
  it("parses safe default options", () => {
    expect(parseUatResearchArgs([])).toEqual({
      noAi: false,
      liveAdmin: false,
      keepTemp: false,
      batchSize: 50,
      outputDir: "docs/UAT_REPORTS"
    });
  });

  it("parses explicit no-ai fixture-run options", () => {
    expect(
      parseUatResearchArgs([
        "--no-ai",
        "--keep-temp",
        "--live-admin",
        "--batch-size=5",
        "--output-dir=/tmp/uat-output"
      ])
    ).toEqual({
      noAi: true,
      liveAdmin: true,
      keepTemp: true,
      batchSize: 5,
      outputDir: "/tmp/uat-output"
    });
  });

  it("classifies direction-only tactical assertions without magnitude thresholds", () => {
    expect(
      directionAssertion({
        metric: "total fouls",
        expected: "increase",
        baseline: 10,
        variant: 11
      })
    ).toMatchObject({
      state: "pass",
      delta: 1,
      percentChange: 10
    });

    expect(
      directionAssertion({
        metric: "total fouls",
        expected: "increase",
        baseline: 10,
        variant: 10
      })
    ).toMatchObject({
      state: "fail",
      delta: 0,
      percentChange: 0
    });
  });

  it("ships a Squad Manager fixture that covers low apply and review-only risks", () => {
    const fixture = buildAdminVerificationFixture();
    expect(
      fixture.verification.suggestions.some((item) => item.suggestionId.startsWith("uat-low"))
    ).toBe(true);
    expect(
      fixture.verification.suggestions.some(
        (item) => item.type === "player_update" && "position" in item.changes
      )
    ).toBe(true);
    expect(
      fixture.verification.missingPlayers.some((item) => item.type === "player_addition")
    ).toBe(true);
    expect(
      fixture.verification.attributeWarnings.some((item) => item.type === "player_removal")
    ).toBe(true);
  });

  it("formats SAST timestamps and expires temp dirs after the 24-hour startup TTL", () => {
    expect(formatSastTimestamp(new Date("2026-05-05T10:15:20.000Z"))).toBe("20260505-121520-SAST");
    expect(isExpiredTempDir(25 * 60 * 60 * 1000, 0, 24)).toBe(true);
    expect(isExpiredTempDir(23 * 60 * 60 * 1000, 0, 24)).toBe(false);
  });
});
