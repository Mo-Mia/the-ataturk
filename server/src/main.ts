import { buildApp } from "./app";
import { getPort } from "./config";

const app = buildApp();
const port = getPort();

try {
  await app.listen({ host: "127.0.0.1", port });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
