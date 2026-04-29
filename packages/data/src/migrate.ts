import Database from "better-sqlite3";
import { mkdirSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { DEFAULT_DATABASE_PATH, MIGRATIONS_DIR, resolveRepoPath } from "./paths";

export interface MigrationResult {
  databasePath: string;
  applied: string[];
  skipped: string[];
}

interface MigrationRow {
  name: string;
}

function getDatabasePath(databasePath = process.env.DATABASE_URL): string {
  const configuredPath =
    databasePath && databasePath.trim().length > 0 ? databasePath : DEFAULT_DATABASE_PATH;

  return resolveRepoPath(configuredPath);
}

function listMigrationFiles(migrationsDir = MIGRATIONS_DIR): string[] {
  return readdirSync(migrationsDir)
    .filter((fileName) => fileName.endsWith(".sql"))
    .sort();
}

export function migrate(options: { databasePath?: string; migrationsDir?: string } = {}): MigrationResult {
  const databasePath = getDatabasePath(options.databasePath);
  const migrationsDir = options.migrationsDir ?? MIGRATIONS_DIR;

  mkdirSync(dirname(databasePath), { recursive: true });

  const db = new Database(databasePath);

  try {
    db.pragma("foreign_keys = ON");
    db.exec(`
      CREATE TABLE IF NOT EXISTS _migrations (
        name TEXT PRIMARY KEY,
        applied_at TEXT NOT NULL
      )
    `);

    const appliedRows = db.prepare("SELECT name FROM _migrations").all() as MigrationRow[];
    const appliedNames = new Set(appliedRows.map((row) => row.name));
    const applied: string[] = [];
    const skipped: string[] = [];

    for (const fileName of listMigrationFiles(migrationsDir)) {
      if (appliedNames.has(fileName)) {
        skipped.push(fileName);
        continue;
      }

      const sql = readFileSync(join(migrationsDir, fileName), "utf8");
      const applyMigration = db.transaction(() => {
        db.exec(sql);
        db.prepare("INSERT INTO _migrations (name, applied_at) VALUES (?, ?)").run(
          fileName,
          new Date().toISOString()
        );
      });

      applyMigration();
      applied.push(fileName);
    }

    return { databasePath, applied, skipped };
  } finally {
    db.close();
  }
}

function isCliEntrypoint(): boolean {
  return process.argv[1] === fileURLToPath(import.meta.url);
}

if (isCliEntrypoint()) {
  const result = migrate();

  for (const fileName of result.applied) {
    console.log(`Applied migration ${fileName}`);
  }

  for (const fileName of result.skipped) {
    console.log(`Skipped migration ${fileName}`);
  }

  console.log(`Database ready at ${result.databasePath}`);
}
