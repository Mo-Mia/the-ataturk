import type { FastifyInstance } from "fastify";

export function registerHealthRoute(app: FastifyInstance): void {
  app.get("/api/health", () => ({
    status: "ok",
    timestamp: new Date().toISOString()
  }));
}
