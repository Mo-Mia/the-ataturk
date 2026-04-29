import { closeDb, migrate, seed } from "@the-ataturk/data";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export interface TestDatabase {
  path: string;
  cleanup(): void;
}

export function createServerTestDatabase(prefix: string): TestDatabase {
  const dir = mkdtempSync(join(tmpdir(), `the-ataturk-server-${prefix}-`));
  const path = join(dir, "test.sqlite");
  const previousDatabaseUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL = path;

  migrate({ databasePath: path });
  seed({ databasePath: path });

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
