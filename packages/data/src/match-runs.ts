import { randomUUID } from "node:crypto";

import { getDb, type SqliteDatabase } from "./db";
import type {
  CreateMatchRunInput,
  MatchRun,
  MatchRunPage,
  MatchRunSummary
} from "./types";

interface MatchRunRow {
  id: string;
  created_at: string;
  batch_id: string | null;
  seed: number;
  home_club_id: MatchRun["home_club_id"];
  away_club_id: MatchRun["away_club_id"];
  home_tactics: string;
  away_tactics: string;
  summary: string;
  artefact_filename: string;
}

export function createMatchRunId(): string {
  return randomUUID();
}

export function createMatchRuns(inputs: CreateMatchRunInput[], db = getDb()): MatchRun[] {
  const insert = db.prepare(
    `
      INSERT INTO match_runs (
        id, created_at, batch_id, seed, home_club_id, away_club_id,
        home_tactics, away_tactics, summary, artefact_filename
      )
      VALUES (
        @id, @createdAt, @batchId, @seed, @homeClubId, @awayClubId,
        @homeTactics, @awayTactics, @summary, @artefactFilename
      )
    `
  );

  const transaction = db.transaction((rows: CreateMatchRunInput[]) => {
    for (const row of rows) {
      insert.run({
        id: row.id,
        createdAt: row.created_at,
        batchId: row.batch_id ?? null,
        seed: row.seed,
        homeClubId: row.home_club_id,
        awayClubId: row.away_club_id,
        homeTactics: JSON.stringify(row.home_tactics),
        awayTactics: JSON.stringify(row.away_tactics),
        summary: JSON.stringify(row.summary),
        artefactFilename: row.artefact_filename
      });
    }
  });

  transaction(inputs);
  return inputs.map((input) => ({ ...input, batch_id: input.batch_id ?? null }));
}

export function listMatchRuns(
  options: { page?: number; limit?: number } = {},
  db = getDb()
): MatchRunPage {
  const page = sanitisePositiveInteger(options.page, 1);
  const limit = Math.min(sanitisePositiveInteger(options.limit, 50), 100);
  const offset = (page - 1) * limit;
  const total =
    db.prepare<[], { count: number }>("SELECT COUNT(*) AS count FROM match_runs").get()?.count ?? 0;
  const rows = db
    .prepare<[number, number], MatchRunRow>(
      `
        SELECT *
        FROM match_runs
        ORDER BY created_at DESC, id DESC
        LIMIT ? OFFSET ?
      `
    )
    .all(limit, offset);

  return {
    runs: rows.map(mapRunRow),
    total,
    page,
    limit,
    hasMore: offset + rows.length < total
  };
}

export function getMatchRun(id: string, db = getDb()): MatchRun | null {
  const row =
    db.prepare<[string], MatchRunRow>("SELECT * FROM match_runs WHERE id = ?").get(id) ?? null;
  return row ? mapRunRow(row) : null;
}

export function listMatchRunsByBatch(batchId: string, db = getDb()): MatchRun[] {
  return db
    .prepare<[string], MatchRunRow>(
      `
        SELECT *
        FROM match_runs
        WHERE batch_id = ?
        ORDER BY seed ASC, created_at ASC
      `
    )
    .all(batchId)
    .map(mapRunRow);
}

export function deleteMatchRun(id: string, db = getDb()): MatchRun | null {
  const existing = getMatchRun(id, db);
  if (!existing) {
    return null;
  }

  db.prepare<[string]>("DELETE FROM match_runs WHERE id = ?").run(id);
  return existing;
}

function mapRunRow(row: MatchRunRow): MatchRun {
  return {
    id: row.id,
    created_at: row.created_at,
    batch_id: row.batch_id,
    seed: row.seed,
    home_club_id: row.home_club_id,
    away_club_id: row.away_club_id,
    home_tactics: parseJson(row.home_tactics),
    away_tactics: parseJson(row.away_tactics),
    summary: parseJson(row.summary) as MatchRunSummary,
    artefact_filename: row.artefact_filename
  };
}

function parseJson(value: string): unknown {
  return JSON.parse(value) as unknown;
}

function sanitisePositiveInteger(value: number | undefined, fallback: number): number {
  return Number.isInteger(value) && value !== undefined && value > 0 ? value : fallback;
}
