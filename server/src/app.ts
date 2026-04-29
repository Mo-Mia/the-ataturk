import Fastify from "fastify";

import { registerDataRoutes } from "./routes/data";
import { registerHealthRoute } from "./routes/health";
import { registerSmokeMatchRoute } from "./routes/smoke-match";

export function buildApp() {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? "info"
    }
  });

  registerDataRoutes(app);
  registerHealthRoute(app);
  registerSmokeMatchRoute(app);

  return app;
}
