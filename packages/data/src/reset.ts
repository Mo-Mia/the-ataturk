import { rmSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { closeDb, getDatabasePath } from "./db";
import { migrate } from "./migrate";
import { seed } from "./seed";

export function resetDatabase(databasePath = getDatabasePath()): void {
  closeDb();
  rmSync(databasePath, { force: true });
  migrate({ databasePath });
  seed({ databasePath });
  closeDb();
}

function isCliEntrypoint(): boolean {
  return process.argv[1] === fileURLToPath(import.meta.url);
}

if (isCliEntrypoint()) {
  const databasePath = getDatabasePath();
  resetDatabase(databasePath);
  console.log(`Database reset at ${databasePath}`);
}
