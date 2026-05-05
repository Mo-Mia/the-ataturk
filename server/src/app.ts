import Fastify from "fastify";

import { registerAiRoutes } from "./routes/ai";
import { registerAttributeAdminRoutes } from "./routes/admin/attributes";
import { registerProfileAdminRoutes } from "./routes/admin/profiles";
import { registerSquadManagerAdminRoutes } from "./routes/admin/squad-manager";
import { registerDataRoutes } from "./routes/data";
import { registerHealthRoute } from "./routes/health";
import { registerMatchEngineRoutes } from "./routes/match-engine";
import { registerMatchRoute } from "./routes/match";
import { registerSmokeMatchRoute } from "./routes/smoke-match";
import { registerVisualiserArtifactRoutes } from "./routes/visualiser-artifacts";

/**
 * Build the Fastify HTTP application and register all public API routes.
 *
 * @returns Configured Fastify instance ready to listen or be injected in tests.
 */
export function buildApp() {
  const app = Fastify({
    requestTimeout: 600_000,
    logger: {
      level: process.env.LOG_LEVEL ?? "info"
    }
  });

  registerDataRoutes(app);
  registerAiRoutes(app);
  registerAttributeAdminRoutes(app);
  registerProfileAdminRoutes(app);
  registerSquadManagerAdminRoutes(app);
  registerHealthRoute(app);
  registerSmokeMatchRoute(app);
  registerMatchEngineRoutes(app);
  registerMatchRoute(app);
  registerVisualiserArtifactRoutes(app);

  return app;
}
