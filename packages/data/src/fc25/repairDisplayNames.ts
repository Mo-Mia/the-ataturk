import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { getDb, getDatabasePath, type SqliteDatabase } from "../db";
import { migrate } from "../migrate";
import { resolveRepoPath } from "../paths";
import type { Fc25DatasetVersion } from "../types";
import { displayNameForFc25Player } from "./displayNames";
import { getActiveFc25DatasetVersion } from "./importer";
import { parseFc25PlayersCsv, type Fc25CsvFormat } from "./parser";

export interface RepairFc25DisplayNamesOptions {
  databasePath?: string;
  datasetVersionId?: string;
  format?: Fc25CsvFormat;
}

export interface RepairFc25DisplayNamesResult {
  databasePath: string;
  datasetVersionId: string;
  sourceFile: string;
  parsedRows: number;
  matchedPlayers: number;
  updatedPlayers: number;
}

interface DatasetVersionRow extends Omit<Fc25DatasetVersion, "is_active"> {
  is_active: number;
}

export function repairFc25DisplayNames(
  options: RepairFc25DisplayNamesOptions = {}
): RepairFc25DisplayNamesResult {
  migrate(options.databasePath ? { databasePath: options.databasePath } : {});
  const db = getDb(options.databasePath);
  const datasetVersion = resolveDatasetVersion(db, options.datasetVersionId);
  const sourceFile = resolveRepoPath(datasetVersion.source_file);
  const parsedRows = parseFc25PlayersCsv(readFileSync(sourceFile, "utf8"), {
    format: options.format ?? "auto"
  });
  const rowsById = new Map(parsedRows.map((row) => [row.fc25PlayerId, row]));
  const playerIds = db
    .prepare<[string], { id: string }>(
      "SELECT id FROM fc25_players WHERE dataset_version_id = ? ORDER BY id"
    )
    .all(datasetVersion.id);
  const update = db.prepare<{
    datasetVersionId: string;
    id: string;
    sourceName: string;
    sourceShortName: string | null;
    displayName: string;
  }>(
    `
      UPDATE fc25_players
      SET source_name = @sourceName,
          source_short_name = @sourceShortName,
          display_name = @displayName
      WHERE dataset_version_id = @datasetVersionId
        AND id = @id
        AND (
          source_name IS NOT @sourceName
          OR source_short_name IS NOT @sourceShortName
          OR display_name IS NOT @displayName
        )
    `
  );

  let matchedPlayers = 0;
  let updatedPlayers = 0;
  const runRepair = db.transaction(() => {
    for (const player of playerIds) {
      const row = rowsById.get(player.id);
      if (!row) {
        continue;
      }
      matchedPlayers += 1;
      const result = update.run({
        datasetVersionId: datasetVersion.id,
        id: row.fc25PlayerId,
        sourceName: row.name,
        sourceShortName: row.sourceShortName,
        displayName: displayNameForFc25Player({
          id: row.fc25PlayerId,
          sourceName: row.name,
          sourceShortName: row.sourceShortName
        })
      });
      updatedPlayers += result.changes;
    }
  });

  runRepair();

  return {
    databasePath: getDatabasePath(options.databasePath),
    datasetVersionId: datasetVersion.id,
    sourceFile,
    parsedRows: parsedRows.length,
    matchedPlayers,
    updatedPlayers
  };
}

export function parseRepairFc25DisplayNamesCliArgs(args: string[]): RepairFc25DisplayNamesOptions {
  const options: RepairFc25DisplayNamesOptions = {};

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]!;
    const next = args[index + 1];

    switch (arg) {
      case "--":
        break;
      case "--database":
        options.databasePath = requireCliValue(arg, next);
        index += 1;
        break;
      case "--version-id":
        options.datasetVersionId = requireCliValue(arg, next);
        index += 1;
        break;
      case "--format":
        options.format = parseCliFormat(requireCliValue(arg, next));
        index += 1;
        break;
      default:
        throw new Error(`Unknown FC25 display-name repair option '${arg}'`);
    }
  }

  return options;
}

function resolveDatasetVersion(
  db: SqliteDatabase,
  datasetVersionId: string | undefined
): Fc25DatasetVersion {
  if (!datasetVersionId) {
    const activeVersion = getActiveFc25DatasetVersion(db);
    if (!activeVersion) {
      throw new Error("No active FC dataset version is available");
    }
    return activeVersion;
  }

  const row =
    db
      .prepare<[string], DatasetVersionRow>(
        "SELECT * FROM fc25_dataset_versions WHERE id = ? LIMIT 1"
      )
      .get(datasetVersionId) ?? null;
  if (!row) {
    throw new Error(`FC dataset version '${datasetVersionId}' does not exist`);
  }
  return { ...row, is_active: row.is_active === 1 };
}

function requireCliValue(option: string, value: string | undefined): string {
  if (!value || value.startsWith("--")) {
    throw new Error(`Missing value for ${option}`);
  }
  return value;
}

function parseCliFormat(value: string): Fc25CsvFormat {
  if (value === "fc25" || value === "fc26" || value === "auto") {
    return value;
  }
  throw new Error(`Invalid --format '${value}'; expected fc25, fc26, or auto`);
}

function isCliEntrypoint(): boolean {
  return process.argv[1] === fileURLToPath(import.meta.url);
}

if (isCliEntrypoint()) {
  try {
    const result = repairFc25DisplayNames(
      parseRepairFc25DisplayNamesCliArgs(process.argv.slice(2))
    );
    console.log(
      `Repaired FC display names for ${result.datasetVersionId}: ${result.updatedPlayers} updated, ${result.matchedPlayers} matched from ${result.sourceFile}`
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
