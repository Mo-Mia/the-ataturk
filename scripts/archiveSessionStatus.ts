import { mkdir, readdir, rename } from "node:fs/promises";
import path from "node:path";

interface ArchiveOptions {
  days: number;
  beforeDate: string | null;
}

const REPO_ROOT = path.resolve(import.meta.dirname, "..");
const DOCS_DIR = path.join(REPO_ROOT, "docs");
const ARCHIVE_DIR = path.join(DOCS_DIR, "archive/session_status");
const SESSION_STATUS_PATTERN =
  /^SESSION_STATUS_(\d{4})-(\d{2})-(\d{2})(?:_(\d{2})(\d{2})_SAST)?\.md$/;

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const candidates = await listEligibleSessionStatusFiles(options);

  await mkdir(ARCHIVE_DIR, { recursive: true });

  for (const fileName of candidates) {
    await rename(path.join(DOCS_DIR, fileName), path.join(ARCHIVE_DIR, fileName));
    console.log(`Archived ${fileName}`);
  }

  console.log(`${candidates.length} files archived`);
}

function parseArgs(args: string[]): ArchiveOptions {
  const options: ArchiveOptions = {
    days: 7,
    beforeDate: null
  };

  for (const arg of args) {
    if (arg === "--") {
      continue;
    }
    if (arg.startsWith("--days=")) {
      const days = Number(arg.slice("--days=".length));
      if (!Number.isInteger(days) || days < 1) {
        throw new Error("--days must be a positive integer");
      }
      options.days = days;
    } else if (arg.startsWith("--before-date=")) {
      const beforeDate = arg.slice("--before-date=".length);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(beforeDate)) {
        throw new Error("--before-date must use YYYY-MM-DD");
      }
      options.beforeDate = beforeDate;
    } else {
      throw new Error(`Unknown option '${arg}'`);
    }
  }

  return options;
}

async function listEligibleSessionStatusFiles(options: ArchiveOptions): Promise<string[]> {
  const files = await readdir(DOCS_DIR);
  const threshold = options.beforeDate
    ? dateOnlyToComparable(options.beforeDate)
    : dateOnlyToComparable(daysAgoSast(options.days));

  return files
    .filter((fileName) => SESSION_STATUS_PATTERN.test(fileName))
    .filter((fileName) => {
      const fileDate = sessionStatusDate(fileName);
      return fileDate !== null && fileDate < threshold;
    })
    .sort();
}

function sessionStatusDate(fileName: string): string | null {
  const match = SESSION_STATUS_PATTERN.exec(fileName);
  if (!match) {
    return null;
  }
  return `${match[1]}-${match[2]}-${match[3]}`;
}

function daysAgoSast(days: number): string {
  const now = new Date();
  const threshold = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Johannesburg",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  })
    .formatToParts(threshold)
    .reduce<Record<string, string>>((accumulator, part) => {
      accumulator[part.type] = part.value;
      return accumulator;
    }, {});

  return `${parts.year}-${parts.month}-${parts.day}`;
}

function dateOnlyToComparable(value: string): string {
  return value;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
