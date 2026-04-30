import { describe, expect, it } from "vitest";

import { simulateMatchStream } from "../../src";
import { createTestConfig } from "../helpers";

describe("simulateMatchStream", () => {
  it("yields ticks from the stream", async () => {
    const ticks = [];

    for await (const tick of simulateMatchStream(createTestConfig(8))) {
      ticks.push(tick);
      if (ticks.length === 3) {
        break;
      }
    }

    expect(ticks.map((tick) => tick.iteration)).toEqual([1, 2, 3]);
  });

  it("honours an abort signal", async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(async () => {
      for await (const tick of simulateMatchStream(createTestConfig(8), {
        signal: controller.signal
      })) {
        void tick;
      }
    }).rejects.toThrow("aborted");
  });
});
