import {
  DataNotFoundError,
  DataValidationError,
  PLAYER_PROFILE_TIERS,
  activateProfileVersion,
  createProfileVersion,
  getActiveProfileVersion,
  getPlayer,
  getPlayerProfile,
  getPlayerProfileHistory,
  getProfileVersion,
  listProfileExtractionCandidates,
  listProfileVersions,
  markPlayerProfileExtractionFailed,
  updatePlayerProfile,
  type CreatePlayerProfileVersionInput,
  type PlayerProfile,
  type PlayerProfileChanges,
  type PlayerProfileHistory,
  type PlayerProfileTier,
  type PlayerProfileVersion,
  type PlayerProfileVersionSummary
} from "@the-ataturk/data";
import {
  PROFILE_EXTRACTION_GENERATED_BY,
  ProfileExtractionError,
  extractPlayerProfile,
  type ProfileExtractionInput,
  type ProfileExtractionResult
} from "@the-ataturk/data/llm/gemini";
import type { FastifyInstance, FastifyReply } from "fastify";
import { readFileSync } from "node:fs";

interface ProfileVersionParams {
  id: string;
}

interface PlayerParams {
  playerId: string;
}

interface ProfileQuery {
  version?: string;
}

interface ProfileHistoryQuery {
  version?: string;
  limit?: string;
}

interface ErrorReply {
  error: string;
}

interface ExtractionSummary {
  total: number;
  succeeded: number;
  failed: number;
  failed_player_ids: string[];
  aborted?: boolean;
  abort_reason?: string;
}

interface ExtractionProgressEvent {
  player_id: string;
  player_name: string;
  status: "started" | "succeeded" | "failed";
  error?: string;
}

const PROFILE_VERSION_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const RESEARCH_DOCUMENT_PATH = new URL(
  "../../../../data/research/2004-05-cl-reference.md",
  import.meta.url
);
const PROFILE_EXTRACTION_RETRY_DELAY_MS = process.env.NODE_ENV === "test" ? 0 : 5_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyFields(body: Record<string, unknown>, allowedFields: readonly string[]): boolean {
  return Object.keys(body).every((field) => allowedFields.includes(field));
}

function isPlayerProfileTier(value: unknown): value is PlayerProfileTier {
  return PLAYER_PROFILE_TIERS.includes(value as PlayerProfileTier);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string" && item.length > 0);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Request failed";
}

function parseCreateProfileVersionInput(
  body: unknown
): CreatePlayerProfileVersionInput | ErrorReply {
  if (!isRecord(body)) {
    return { error: "Request body must be an object" };
  }

  if (!hasOnlyFields(body, ["id", "name", "description", "parent_version_id"])) {
    return { error: "Request body contains unrecognised fields" };
  }

  if (typeof body.id !== "string" || !PROFILE_VERSION_ID_PATTERN.test(body.id)) {
    return { error: "Profile version id must be a lowercase slug" };
  }

  if (typeof body.name !== "string" || body.name.trim().length === 0) {
    return { error: "Profile version name is required" };
  }

  if (
    body.description !== undefined &&
    body.description !== null &&
    typeof body.description !== "string"
  ) {
    return { error: "Profile version description must be text" };
  }

  if (
    body.parent_version_id !== undefined &&
    body.parent_version_id !== null &&
    typeof body.parent_version_id !== "string"
  ) {
    return { error: "Parent profile version id must be text" };
  }

  return {
    id: body.id,
    name: body.name,
    description: body.description ?? null,
    parent_version_id: body.parent_version_id ?? null
  };
}

function parseProfileChanges(value: unknown): PlayerProfileChanges | ErrorReply {
  if (!isRecord(value)) {
    return { error: "Profile changes must be an object" };
  }

  const changes: PlayerProfileChanges = {};

  for (const [fieldName, fieldValue] of Object.entries(value)) {
    if (fieldName === "tier") {
      if (!isPlayerProfileTier(fieldValue)) {
        return { error: "Profile tier must be one of S, A, B, C, or D" };
      }

      changes.tier = fieldValue;
      continue;
    }

    if (fieldName === "role_2004_05" || fieldName === "qualitative_descriptor") {
      if (fieldValue !== null && typeof fieldValue !== "string") {
        return { error: `Profile field '${fieldName}' must be text` };
      }

      changes[fieldName] = fieldValue;
      continue;
    }

    return { error: `Unknown profile field '${fieldName}'` };
  }

  if (Object.keys(changes).length === 0) {
    return { error: "At least one profile change is required" };
  }

  return changes;
}

function parsePatchProfileBody(
  body: unknown
): { profile_version: string; changes: PlayerProfileChanges; changed_by?: string } | ErrorReply {
  if (!isRecord(body)) {
    return { error: "Request body must be an object" };
  }

  if (!hasOnlyFields(body, ["profile_version", "changes", "changed_by"])) {
    return { error: "Request body contains unrecognised fields" };
  }

  if (typeof body.profile_version !== "string" || body.profile_version.length === 0) {
    return { error: "profile_version is required" };
  }

  if (body.changed_by !== undefined && typeof body.changed_by !== "string") {
    return { error: "changed_by must be text" };
  }

  const changes = parseProfileChanges(body.changes);
  if ("error" in changes) {
    return changes;
  }

  const parsed = {
    profile_version: body.profile_version,
    changes
  };

  return body.changed_by === undefined ? parsed : { ...parsed, changed_by: body.changed_by };
}

function parseExtractionBody(
  body: unknown
): { profile_version: string; player_ids?: string[] } | ErrorReply {
  if (!isRecord(body)) {
    return { error: "Request body must be an object" };
  }

  if (!hasOnlyFields(body, ["profile_version", "player_ids"])) {
    return { error: "Request body contains unrecognised fields" };
  }

  if (typeof body.profile_version !== "string" || body.profile_version.length === 0) {
    return { error: "profile_version is required" };
  }

  if (body.player_ids === undefined) {
    return { profile_version: body.profile_version };
  }

  if (!isStringArray(body.player_ids)) {
    return { error: "player_ids must be an array of player ids" };
  }

  return { profile_version: body.profile_version, player_ids: body.player_ids };
}

function resolveProfileVersion(version: string | undefined): PlayerProfileVersion | null {
  if (version) {
    return getProfileVersion(version);
  }

  return getActiveProfileVersion();
}

function ageAtFinal(dateOfBirth: string | null): number | undefined {
  if (!dateOfBirth) {
    return undefined;
  }

  const birthDate = new Date(`${dateOfBirth}T00:00:00.000Z`);
  const finalDate = new Date("2005-05-25T00:00:00.000Z");
  const age = finalDate.getUTCFullYear() - birthDate.getUTCFullYear();
  const hadBirthday =
    finalDate.getUTCMonth() > birthDate.getUTCMonth() ||
    (finalDate.getUTCMonth() === birthDate.getUTCMonth() &&
      finalDate.getUTCDate() >= birthDate.getUTCDate());

  return hadBirthday ? age : age - 1;
}

function sendSseEvent(reply: FastifyReply, eventName: string, data: unknown): void {
  reply.raw.write(`event: ${eventName}\n`);
  reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function extractWithRetry(input: ProfileExtractionInput): Promise<ProfileExtractionResult> {
  try {
    return await extractPlayerProfile(input);
  } catch (error) {
    if (!(error instanceof ProfileExtractionError) || !error.transient) {
      throw error;
    }

    await sleep(PROFILE_EXTRACTION_RETRY_DELAY_MS);
    return await extractPlayerProfile(input);
  }
}

function profileExtractionLogDetails(error: unknown): Record<string, unknown> {
  if (error instanceof ProfileExtractionError) {
    return {
      message: error.message,
      status: error.status,
      transient: error.transient,
      cause: error.cause instanceof Error ? error.cause.message : error.cause
    };
  }

  if (error instanceof Error) {
    return {
      message: error.message,
      name: error.name
    };
  }

  return { error };
}

export function registerProfileAdminRoutes(app: FastifyInstance): void {
  app.get<{ Reply: PlayerProfileVersionSummary[] }>("/api/profile-versions", () =>
    listProfileVersions()
  );

  app.post<{ Body: unknown; Reply: PlayerProfileVersion | ErrorReply }>(
    "/api/profile-versions",
    (request, reply) => {
      const input = parseCreateProfileVersionInput(request.body);

      if ("error" in input) {
        reply.code(400);
        return input;
      }

      try {
        return createProfileVersion(input);
      } catch (error) {
        if (error instanceof DataValidationError) {
          reply.code(400);
          return { error: error.message };
        }

        throw error;
      }
    }
  );

  app.post<{ Params: ProfileVersionParams; Reply: PlayerProfileVersion | ErrorReply }>(
    "/api/profile-versions/:id/activate",
    (request, reply) => {
      try {
        return activateProfileVersion(request.params.id);
      } catch (error) {
        if (error instanceof DataNotFoundError) {
          reply.code(404);
          return { error: error.message };
        }

        throw error;
      }
    }
  );

  app.get<{
    Params: PlayerParams;
    Querystring: ProfileQuery;
    Reply: PlayerProfile | ErrorReply;
  }>("/api/players/:playerId/profile", (request, reply) => {
    const player = getPlayer(request.params.playerId);
    const profileVersion = resolveProfileVersion(request.query.version);

    if (!player) {
      reply.code(404);
      return { error: `Player '${request.params.playerId}' does not exist` };
    }

    if (!profileVersion) {
      reply.code(404);
      return { error: "Profile version does not exist" };
    }

    const profile = getPlayerProfile(player.id, profileVersion.id);

    if (!profile) {
      reply.code(404);
      return {
        error: `Profile for player '${player.id}' in '${profileVersion.id}' does not exist`
      };
    }

    return profile;
  });

  app.patch<{ Params: PlayerParams; Body: unknown; Reply: PlayerProfile | ErrorReply }>(
    "/api/players/:playerId/profile",
    (request, reply) => {
      const input = parsePatchProfileBody(request.body);

      if ("error" in input) {
        reply.code(400);
        return input;
      }

      try {
        const updateInput = {
          playerId: request.params.playerId,
          profileVersion: input.profile_version,
          changes: input.changes
        };

        return updatePlayerProfile(
          input.changed_by === undefined
            ? updateInput
            : { ...updateInput, changedBy: input.changed_by }
        );
      } catch (error) {
        if (error instanceof DataValidationError) {
          reply.code(400);
          return { error: error.message };
        }

        if (error instanceof DataNotFoundError) {
          reply.code(404);
          return { error: error.message };
        }

        throw error;
      }
    }
  );

  app.get<{
    Params: PlayerParams;
    Querystring: ProfileHistoryQuery;
    Reply: PlayerProfileHistory[] | ErrorReply;
  }>("/api/players/:playerId/profile-history", (request, reply) => {
    const player = getPlayer(request.params.playerId);

    if (!player) {
      reply.code(404);
      return { error: `Player '${request.params.playerId}' does not exist` };
    }

    const limit = request.query.limit === undefined ? 50 : Number.parseInt(request.query.limit, 10);

    if (!Number.isInteger(limit) || limit < 1) {
      reply.code(400);
      return { error: "History limit must be a positive integer" };
    }

    try {
      return getPlayerProfileHistory(player.id, request.query.version, limit);
    } catch (error) {
      reply.code(error instanceof DataValidationError ? 400 : 500);
      return { error: errorMessage(error) };
    }
  });

  app.post<{ Body: unknown }>("/api/profile-extraction/run", async (request, reply) => {
    const input = parseExtractionBody(request.body);

    if ("error" in input) {
      reply.code(400).send(input);
      return;
    }

    reply.hijack();
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive"
    });
    let clientDisconnected = false;

    const summary: ExtractionSummary = {
      total: 0,
      succeeded: 0,
      failed: 0,
      failed_player_ids: []
    };

    reply.raw.on("close", () => {
      if (!reply.raw.writableEnded) {
        clientDisconnected = true;
      }
    });

    try {
      const researchDocument = readFileSync(RESEARCH_DOCUMENT_PATH, "utf8");
      const candidates = listProfileExtractionCandidates(input.profile_version, input.player_ids);

      summary.total = candidates.length;

      for (const [index, candidate] of candidates.entries()) {
        if (clientDisconnected) {
          app.log.info(`Profile extraction aborted by client at ${index} of ${summary.total}`);
          break;
        }

        sendSseEvent(reply, "player", {
          player_id: candidate.player.id,
          player_name: candidate.player.name,
          status: "started"
        } satisfies ExtractionProgressEvent);

        try {
          const generatedAt = new Date().toISOString();
          const extractionInput: ProfileExtractionInput = {
            researchDocument,
            playerName: candidate.player.name,
            position: candidate.player.position_primary
          };
          const age = ageAtFinal(candidate.player.date_of_birth);

          if (age !== undefined) {
            extractionInput.ageAtMatch = age;
          }

          const extracted = await extractWithRetry(extractionInput);

          updatePlayerProfile({
            playerId: candidate.player.id,
            profileVersion: candidate.profile.profile_version,
            changes: extracted,
            changedBy: PROFILE_EXTRACTION_GENERATED_BY,
            generatedBy: PROFILE_EXTRACTION_GENERATED_BY,
            generatedAt,
            changedAt: generatedAt,
            markEdited: false
          });

          summary.succeeded += 1;
          sendSseEvent(reply, "player", {
            player_id: candidate.player.id,
            player_name: candidate.player.name,
            status: "succeeded"
          } satisfies ExtractionProgressEvent);
        } catch (error) {
          app.log.error(
            { error: profileExtractionLogDetails(error), playerId: candidate.player.id },
            "Profile extraction failed"
          );

          if (error instanceof ProfileExtractionError && error.transient) {
            summary.failed += 1;
            summary.failed_player_ids.push(candidate.player.id);
            summary.aborted = true;
            summary.abort_reason = `Transient Gemini failure for ${candidate.player.id}; batch paused for retry later.`;
            sendSseEvent(reply, "player", {
              player_id: candidate.player.id,
              player_name: candidate.player.name,
              status: "failed",
              error: errorMessage(error)
            } satisfies ExtractionProgressEvent);
            break;
          }

          markPlayerProfileExtractionFailed(candidate.player.id, candidate.profile.profile_version);
          summary.failed += 1;
          summary.failed_player_ids.push(candidate.player.id);
          sendSseEvent(reply, "player", {
            player_id: candidate.player.id,
            player_name: candidate.player.name,
            status: "failed",
            error: errorMessage(error)
          } satisfies ExtractionProgressEvent);
        }
      }

      sendSseEvent(reply, "summary", summary);
    } catch (error) {
      app.log.error({ error }, "Profile extraction run failed");
      sendSseEvent(reply, "error", { error: errorMessage(error) });
    } finally {
      reply.raw.end();
    }
  });
}
