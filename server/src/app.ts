import Fastify from "fastify";

import { registerAttributeAdminRoutes } from "./routes/admin/attributes";
import { registerProfileAdminRoutes } from "./routes/admin/profiles";
import { registerDataRoutes } from "./routes/data";
import { registerHealthRoute } from "./routes/health";
import { registerMatchRoute } from "./routes/match";
import { registerSmokeMatchRoute } from "./routes/smoke-match";

export function buildApp() {
  const app = Fastify({
    requestTimeout: 600_000,
    logger: {
      level: process.env.LOG_LEVEL ?? "info"
    }
  });

  registerDataRoutes(app);
  registerAttributeAdminRoutes(app);
  registerProfileAdminRoutes(app);
  registerHealthRoute(app);
  registerSmokeMatchRoute(app);
  registerMatchRoute(app);

  return app;
}
