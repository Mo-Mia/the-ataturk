import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { closeDb } from "../src/db";
import { migrate } from "../src/migrate";
import { seed } from "../src/seed";

export interface TestDatabase {
  path: string;
  cleanup(): void;
}

export function createTestDatabase(prefix: string): TestDatabase {
  const dir = mkdtempSync(join(tmpdir(), `the-ataturk-${prefix}-`));
  const path = join(dir, "test.sqlite");
  const previousDatabaseUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL = path;

  return {
    path,
    cleanup() {
      closeDb();
      if (previousDatabaseUrl === undefined) {
        delete process.env.DATABASE_URL;
      } else {
        process.env.DATABASE_URL = previousDatabaseUrl;
      }
      rmSync(dir, { recursive: true, force: true });
    }
  };
}

export function createMigratedSeededDatabase(prefix: string): TestDatabase {
  const testDatabase = createTestDatabase(prefix);
  migrate({ databasePath: testDatabase.path });
  seed({ databasePath: testDatabase.path });
  return testDatabase;
}
