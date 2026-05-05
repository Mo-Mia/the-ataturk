import type { FastifyInstance } from "fastify";

/**
 * Register the service health-check route.
 *
 * @param app Fastify instance receiving the route registration.
 * @returns Nothing; route is registered for later HTTP handling.
 */
export function registerHealthRoute(app: FastifyInstance): void {
  /** GET `/api/health`: return process health and server timestamp. */
  app.get("/api/health", () => ({
    status: "ok",
    timestamp: new Date().toISOString()
  }));
}
