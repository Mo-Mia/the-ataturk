import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageSrcDir = dirname(fileURLToPath(import.meta.url));

export const REPO_ROOT = resolve(packageSrcDir, "../../..");
export const DEFAULT_DATABASE_PATH = resolve(REPO_ROOT, "data/the-ataturk.sqlite");
export const MIGRATIONS_DIR = resolve(REPO_ROOT, "packages/data/migrations");
export const SEEDS_DIR = resolve(REPO_ROOT, "data/seeds");

export function resolveRepoPath(path: string): string {
  if (path.startsWith("file:")) {
    return fileURLToPath(path);
  }

  return isAbsolute(path) ? path : resolve(REPO_ROOT, path);
}
