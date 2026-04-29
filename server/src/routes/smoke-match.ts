import type { FastifyInstance } from "fastify";

import { runSmokeMatch, type SmokeMatchResponse } from "../match/run-smoke-match";

export function registerSmokeMatchRoute(app: FastifyInstance): void {
  app.post<{ Reply: SmokeMatchResponse }>("/api/smoke-test/match", async () => runSmokeMatch());
}
