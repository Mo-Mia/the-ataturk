import Fastify from "fastify";

import { registerProfileAdminRoutes } from "./routes/admin/profiles";
import { registerDataRoutes } from "./routes/data";
import { registerHealthRoute } from "./routes/health";
import { registerSmokeMatchRoute } from "./routes/smoke-match";

export function buildApp() {
  const app = Fastify({
    requestTimeout: 600_000,
    logger: {
      level: process.env.LOG_LEVEL ?? "info"
    }
  });

  registerDataRoutes(app);
  registerProfileAdminRoutes(app);
  registerHealthRoute(app);
  registerSmokeMatchRoute(app);

  return app;
}
