import type { FastifyInstance } from "fastify";

import { runSmokeMatch } from "../match/run-smoke-match";

export function registerSmokeMatchRoute(app: FastifyInstance): void {
  app.post("/api/smoke-test/match", async () => runSmokeMatch());
}
