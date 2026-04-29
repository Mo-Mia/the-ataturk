import Fastify from "fastify";

import { registerHealthRoute } from "./routes/health";
import { registerSmokeMatchRoute } from "./routes/smoke-match";

export function buildApp() {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? "info"
    }
  });

  registerHealthRoute(app);
  registerSmokeMatchRoute(app);

  return app;
}
