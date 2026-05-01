import { describe, expect, it } from "vitest";

import { buildApp } from "../src/app";

describe("visualiser artifact routes", () => {
  it("lists JSON artifacts only", async () => {
    const app = buildApp();

    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/visualiser/artifacts"
      });
      const body = response.json<{
        files: Array<{ filename: string; sizeBytes: number; modifiedAt: string }>;
      }>();

      expect(response.statusCode).toBe(200);
      expect(body.files.length).toBeGreaterThan(0);
      expect(body.files.every((file) => file.filename.endsWith(".json"))).toBe(true);
      expect(body.files.some((file) => file.filename.endsWith(".json.gz"))).toBe(false);
      expect(body.files[0]).toMatchObject({
        filename: expect.any(String) as string,
        sizeBytes: expect.any(Number) as number,
        modifiedAt: expect.any(String) as string
      });
    } finally {
      await app.close();
    }
  });

  it("serves an artifact and rejects path traversal", async () => {
    const app = buildApp();

    try {
      const ok = await app.inject({
        method: "GET",
        url: "/api/visualiser/artifacts/forced-early-goal-v2.json"
      });

      expect(ok.statusCode).toBe(200);
      expect(ok.headers["content-type"]).toContain("application/json");
      expect(ok.json()).toMatchObject({
        meta: expect.any(Object) as object,
        ticks: expect.any(Array) as unknown[]
      });

      const rejected = await app.inject({
        method: "GET",
        url: "/api/visualiser/artifacts/%2e%2e%2fpackage.json"
      });

      expect(rejected.statusCode).toBe(400);
    } finally {
      await app.close();
    }
  });
});
