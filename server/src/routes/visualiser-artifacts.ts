import { mkdir, readdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import { basename } from "node:path";
import { fileURLToPath } from "node:url";

import type { FastifyInstance } from "fastify";

interface ArtifactParams {
  filename: string;
}

interface ArtifactFile {
  filename: string;
  sizeBytes: number;
  modifiedAt: string;
}

const ARTIFACTS_DIR = fileURLToPath(
  new URL("../../../packages/match-engine/artifacts/", import.meta.url)
);
const JSON_ARTIFACT_PATTERN = /^[A-Za-z0-9._-]+\.json$/;

/**
 * Write a JSON visualiser artefact under the managed artefact directory.
 *
 * @param filename Safe basename ending in `.json`.
 * @param content JSON content to write.
 * @returns The written filename.
 * @throws Error when the filename is unsafe.
 */
export async function writeVisualiserArtifact(filename: string, content: string): Promise<string> {
  if (!isSafeArtifactFilename(filename)) {
    throw new Error(`Invalid artifact filename '${filename}'`);
  }

  await mkdir(ARTIFACTS_DIR, { recursive: true });
  await writeFile(new URL(filename, `file://${ARTIFACTS_DIR}/`), content, "utf8");
  return filename;
}

/**
 * Check whether a managed visualiser artefact exists.
 *
 * @param filename Safe basename ending in `.json`.
 * @returns True when the artefact exists and is a file.
 */
export async function visualiserArtifactExists(filename: string): Promise<boolean> {
  if (!isSafeArtifactFilename(filename)) {
    return false;
  }

  try {
    const details = await stat(new URL(filename, `file://${ARTIFACTS_DIR}/`));
    return details.isFile();
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

/**
 * Delete a managed visualiser artefact if it exists.
 *
 * @param filename Safe basename ending in `.json`.
 * @returns Nothing.
 * @throws Error when the filename is unsafe.
 */
export async function deleteVisualiserArtifact(filename: string): Promise<void> {
  if (!isSafeArtifactFilename(filename)) {
    throw new Error(`Invalid artifact filename '${filename}'`);
  }

  try {
    await unlink(new URL(filename, `file://${ARTIFACTS_DIR}/`));
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return;
    }
    throw error;
  }
}

/**
 * Register visualiser artefact listing and retrieval routes.
 *
 * @param app Fastify instance receiving the route registrations.
 * @returns Nothing; routes are registered for later HTTP handling.
 */
export function registerVisualiserArtifactRoutes(app: FastifyInstance): void {
  /** GET `/api/visualiser/artifacts`: list JSON visualiser artefacts newest-first. */
  app.get("/api/visualiser/artifacts", async () => {
    await mkdir(ARTIFACTS_DIR, { recursive: true });
    const entries = await readdir(ARTIFACTS_DIR, { withFileTypes: true });
    const files: ArtifactFile[] = [];

    for (const entry of entries) {
      if (!entry.isFile() || !isSafeArtifactFilename(entry.name)) {
        continue;
      }

      const details = await stat(new URL(entry.name, `file://${ARTIFACTS_DIR}/`));
      files.push({
        filename: entry.name,
        sizeBytes: details.size,
        modifiedAt: details.mtime.toISOString()
      });
    }

    files.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
    return { files };
  });

  /** GET `/api/visualiser/artifacts/:filename`: return one JSON visualiser artefact. */
  app.get<{ Params: ArtifactParams }>(
    "/api/visualiser/artifacts/:filename",
    async (request, reply) => {
      const { filename } = request.params;

      if (!isSafeArtifactFilename(filename)) {
        return reply.code(400).send({ error: "Invalid artifact filename" });
      }

      try {
        const content = await readFile(new URL(filename, `file://${ARTIFACTS_DIR}/`), "utf8");
        return reply.type("application/json").send(content);
      } catch (error) {
        if (error instanceof Error && "code" in error && error.code === "ENOENT") {
          return reply.code(404).send({ error: "Artifact not found" });
        }
        throw error;
      }
    }
  );
}

function isSafeArtifactFilename(filename: string): boolean {
  return basename(filename) === filename && JSON_ARTIFACT_PATTERN.test(filename);
}
