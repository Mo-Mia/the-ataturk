import { config as loadEnv } from "dotenv";
import { fileURLToPath } from "node:url";

import { buildApp } from "./app";
import { getPort } from "./config";

loadEnv({
  path: fileURLToPath(new URL("../../.env", import.meta.url))
});

const app = buildApp();
const port = getPort();

try {
  await app.listen({ host: "127.0.0.1", port });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
