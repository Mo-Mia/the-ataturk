import type { FastifyInstance } from "fastify";

import { runSmokeMatch, type SmokeMatchResponse } from "../match/run-smoke-match";

/**
 * Register the deterministic smoke-match route.
 *
 * @param app Fastify instance receiving the route registration.
 * @returns Nothing; route is registered for later HTTP handling.
 */
export function registerSmokeMatchRoute(app: FastifyInstance): void {
  /** POST `/api/smoke-test/match`: run the server smoke-match fixture. */
  app.post<{ Reply: SmokeMatchResponse }>("/api/smoke-test/match", async () => runSmokeMatch());
}
