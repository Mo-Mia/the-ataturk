import {
  DataNotFoundError,
  DataValidationError,
  getActiveProfileVersion,
  getDatasetVersion,
  getProfileVersion,
  listAttributeDerivationCandidates,
  listPlayerProfileDerivationBlockers,
  markPlayerAttributeDerivationFailed,
  updatePlayerAttributes,
  type PlayerAttributeDerivationCandidate,
  type PlayerProfileVersion
} from "@the-ataturk/data";
import { validateAttributesAgainstPosition } from "@the-ataturk/data/llm/attribute-validation";
import {
  AttributeDerivationError,
  DERIVATION_GENERATED_BY,
  derivePlayerAttributes,
  type AttributeDerivationInput,
  type AttributeDerivationResult
} from "@the-ataturk/data/llm/gemini";
import type { FastifyInstance, FastifyReply } from "fastify";
import { readFileSync } from "node:fs";

interface DerivationBody {
  dataset_version: string;
  profile_version?: string;
  player_ids?: string[];
}

interface DerivationQuery {
  dataset_version?: string;
  profile_version?: string;
}

interface ErrorReply {
  error: string;
}

interface DerivationPreflight {
  ready: boolean;
  candidate_count: number;
  errors?: string[];
  blocking_player_ids?: string[];
}

interface DerivationSummary {
  total: number;
  succeeded: number;
  failed: number;
  failed_player_ids: string[];
  aborted?: boolean;
  abort_reason?: string;
}

interface DerivationProgressEvent {
  player_id: string;
  player_name: string;
  status: "started" | "succeeded" | "failed";
  error?: string;
}

const RUBRIC_DOCUMENT_PATH = new URL("../../../../docs/prompt_rubric_draft.md", import.meta.url);
const ATTRIBUTE_DERIVATION_RETRY_DELAY_MS = process.env.NODE_ENV === "test" ? 0 : 5_000;
const TRANSIENT_CIRCUIT_BREAKER_LIMIT = 5;

export function registerAttributeAdminRoutes(app: FastifyInstance): void {
  app.get<{ Querystring: DerivationQuery; Reply: DerivationPreflight }>(
    "/api/attribute-derivation/preflight",
    (request) => runPreflight(request.query)
  );

  app.post<{ Body: unknown }>("/api/attribute-derivation/run", async (request, reply) => {
    const input = parseDerivationBody(request.body);

    if ("error" in input) {
      reply.code(400).send(input);
      return;
    }

    const preflight = runPreflight(input);
    if (!preflight.ready) {
      reply.code(400).send({
        error: preflight.errors?.join("; ") ?? "Attribute derivation preflight failed"
      });
      return;
    }

    reply.hijack();
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive"
    });

    let clientDisconnected = false;
    let consecutiveTransientFailures = 0;
    const summary: DerivationSummary = {
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
      const rubricDocument = readRubricDocument();
      const profileVersion = resolveProfileVersion(input.profile_version);
      if (!profileVersion) {
        throw new DataNotFoundError("Profile version does not exist");
      }

      const candidates = listAttributeDerivationCandidates(
        input.dataset_version,
        profileVersion.id,
        input.player_ids
      );

      summary.total = candidates.length;

      for (const [index, candidate] of candidates.entries()) {
        if (clientDisconnected) {
          app.log.info(`Attribute derivation aborted by client at ${index} of ${summary.total}`);
          summary.aborted = true;
          summary.abort_reason = `Client disconnected at ${index} of ${summary.total}.`;
          break;
        }

        sendSseEvent(reply, "player", {
          player_id: candidate.player.id,
          player_name: candidate.player.name,
          status: "started"
        } satisfies DerivationProgressEvent);

        try {
          const generatedAt = new Date().toISOString();
          const derived = await deriveValidatedWithRetry(
            buildDerivationInput(candidate, rubricDocument)
          );

          updatePlayerAttributes({
            playerId: candidate.player.id,
            datasetVersion: input.dataset_version,
            changes: derived,
            changedBy: DERIVATION_GENERATED_BY,
            changedAt: generatedAt,
            generatedBy: DERIVATION_GENERATED_BY,
            generatedAt
          });

          consecutiveTransientFailures = 0;
          summary.succeeded += 1;
          sendSseEvent(reply, "player", {
            player_id: candidate.player.id,
            player_name: candidate.player.name,
            status: "succeeded"
          } satisfies DerivationProgressEvent);
        } catch (error) {
          app.log.error(
            { error: attributeDerivationLogDetails(error), playerId: candidate.player.id },
            "Attribute derivation failed"
          );

          markPlayerAttributeDerivationFailed(candidate.player.id, input.dataset_version);
          summary.failed += 1;
          summary.failed_player_ids.push(candidate.player.id);
          sendSseEvent(reply, "player", {
            player_id: candidate.player.id,
            player_name: candidate.player.name,
            status: "failed",
            error: errorMessage(error)
          } satisfies DerivationProgressEvent);

          if (error instanceof AttributeDerivationError && error.transient) {
            consecutiveTransientFailures += 1;

            if (consecutiveTransientFailures >= TRANSIENT_CIRCUIT_BREAKER_LIMIT) {
              summary.aborted = true;
              summary.abort_reason =
                "Attribute derivation stopped after 5 consecutive transient Gemini failures; likely rate-limiting.";
              break;
            }
          } else {
            consecutiveTransientFailures = 0;
          }
        }
      }

      sendSseEvent(reply, "summary", summary);
    } catch (error) {
      app.log.error({ error }, "Attribute derivation run failed");
      sendSseEvent(reply, "error", { error: errorMessage(error) });
    } finally {
      reply.raw.end();
    }
  });
}

function runPreflight(query: DerivationQuery): DerivationPreflight {
  const errors: string[] = [];
  const blockingPlayerIds = new Set<string>();

  if (!query.dataset_version) {
    errors.push("dataset_version is required");
  } else if (query.dataset_version === "v0-stub") {
    errors.push("Refusing to derive attributes into v0-stub");
  } else if (!getDatasetVersion(query.dataset_version)) {
    errors.push(`Dataset version '${query.dataset_version}' does not exist`);
  }

  const profileVersion = resolveProfileVersion(query.profile_version);
  if (!profileVersion) {
    errors.push("Profile version does not exist");
  }

  try {
    readRubricDocument();
  } catch (error) {
    errors.push(errorMessage(error));
  }

  let candidateCount = 0;

  if (query.dataset_version && query.dataset_version !== "v0-stub" && profileVersion) {
    try {
      const blockers = listPlayerProfileDerivationBlockers(profileVersion.id);
      for (const blocker of blockers) {
        errors.push(`${blocker.player_id}: ${blocker.reason}`);
        blockingPlayerIds.add(blocker.player_id);
      }

      candidateCount = listAttributeDerivationCandidates(
        query.dataset_version,
        profileVersion.id
      ).length;
    } catch (error) {
      errors.push(errorMessage(error));
    }
  }

  return {
    ready: errors.length === 0,
    candidate_count: candidateCount,
    ...(errors.length > 0 ? { errors } : {}),
    ...(blockingPlayerIds.size > 0 ? { blocking_player_ids: Array.from(blockingPlayerIds) } : {})
  };
}

function parseDerivationBody(body: unknown): DerivationBody | ErrorReply {
  if (!isRecord(body)) {
    return { error: "Request body must be an object" };
  }

  if (!hasOnlyFields(body, ["dataset_version", "profile_version", "player_ids"])) {
    return { error: "Request body contains unrecognised fields" };
  }

  if (typeof body.dataset_version !== "string" || body.dataset_version.length === 0) {
    return { error: "dataset_version is required" };
  }

  if (body.profile_version !== undefined && typeof body.profile_version !== "string") {
    return { error: "profile_version must be text" };
  }

  if (body.player_ids !== undefined && !isStringArray(body.player_ids)) {
    return { error: "player_ids must be an array of player ids" };
  }

  return {
    dataset_version: body.dataset_version,
    ...(body.profile_version === undefined ? {} : { profile_version: body.profile_version }),
    ...(body.player_ids === undefined ? {} : { player_ids: body.player_ids })
  };
}

function resolveProfileVersion(version: string | undefined): PlayerProfileVersion | null {
  if (version) {
    return getProfileVersion(version);
  }

  return getActiveProfileVersion();
}

function readRubricDocument(): string {
  const rubricDocument = readFileSync(RUBRIC_DOCUMENT_PATH, "utf8");

  if (rubricDocument.trim().length === 0) {
    throw new DataValidationError("Attribute derivation rubric is empty");
  }

  return rubricDocument;
}

function buildDerivationInput(
  candidate: PlayerAttributeDerivationCandidate,
  rubricDocument: string
): AttributeDerivationInput {
  if (!candidate.profile.role_2004_05 || !candidate.profile.qualitative_descriptor) {
    throw new DataValidationError(
      `Player '${candidate.player.id}' does not have a complete profile`
    );
  }

  return {
    rubricDocument,
    playerName: candidate.player.name,
    position: candidate.player.position_primary,
    ageAtMatch: ageAtFinal(candidate.player.date_of_birth),
    tier: candidate.profile.tier,
    role_2004_05: candidate.profile.role_2004_05,
    qualitative_descriptor: candidate.profile.qualitative_descriptor
  };
}

async function deriveValidatedWithRetry(
  input: AttributeDerivationInput
): Promise<AttributeDerivationResult> {
  let lastValidationReasons: string[] = [];

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const derived = await derivePlayerAttributes(
        lastValidationReasons.length === 0
          ? input
          : { ...input, validationFeedback: lastValidationReasons }
      );
      const validation = validateAttributesAgainstPosition(derived, input.position, input.tier);

      if (validation.ok) {
        return derived;
      }

      lastValidationReasons = validation.reasons;
    } catch (error) {
      if (!(error instanceof AttributeDerivationError) || !error.transient || attempt === 1) {
        throw error;
      }

      await sleep(ATTRIBUTE_DERIVATION_RETRY_DELAY_MS);
    }
  }

  throw new AttributeDerivationError(
    `Derived attributes failed validation: ${lastValidationReasons.join("; ")}`
  );
}

function ageAtFinal(dateOfBirth: string | null): number {
  if (!dateOfBirth) {
    return 25;
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

function attributeDerivationLogDetails(error: unknown): Record<string, unknown> {
  if (error instanceof AttributeDerivationError) {
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyFields(body: Record<string, unknown>, allowedFields: readonly string[]): boolean {
  return Object.keys(body).every((field) => allowedFields.includes(field));
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string" && item.length > 0);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Request failed";
}
