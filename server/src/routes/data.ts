import {
  DataNotFoundError,
  DataValidationError,
  activateDatasetVersion,
  createDatasetVersion,
  getActiveDatasetVersion,
  getDatasetVersion,
  getPlayer,
  getPlayerAttributeHistory,
  getPlayerAttributes,
  listClubs,
  listDatasetVersions,
  listSquadWithActiveAttributes,
  updatePlayerAttributes,
  type Club,
  type CreateDatasetVersionInput,
  type DatasetVersion,
  type Player,
  type PlayerAttributeChanges,
  type PlayerAttributeHistory,
  type PlayerAttributes,
  type PlayerAttributeName,
  type PlayerOrigin,
  type SquadPlayerWithAttributes
} from "@the-ataturk/data";
import { PLAYER_ATTRIBUTE_NAMES } from "@the-ataturk/data";
import type { FastifyInstance } from "fastify";

interface SquadParams {
  id: string;
}

interface SquadQuery {
  origin?: PlayerOrigin;
}

interface PlayerParams {
  playerId: string;
}

interface DatasetVersionParams {
  id: string;
}

interface AttributeQuery {
  version?: string;
}

interface AttributeHistoryQuery {
  version?: string;
  limit?: string;
}

interface ErrorReply {
  error: string;
}

const DATASET_VERSION_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function isPlayerOrigin(value: unknown): value is PlayerOrigin {
  return value === "real" || value === "user_created";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyFields(body: Record<string, unknown>, allowedFields: readonly string[]): boolean {
  return Object.keys(body).every((field) => allowedFields.includes(field));
}

function isPlayerAttributeName(value: string): value is PlayerAttributeName {
  return PLAYER_ATTRIBUTE_NAMES.includes(value as PlayerAttributeName);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Request failed";
}

function parseCreateDatasetVersionInput(body: unknown): CreateDatasetVersionInput | ErrorReply {
  if (!isRecord(body)) {
    return { error: "Request body must be an object" };
  }

  if (!hasOnlyFields(body, ["id", "name", "description", "parent_version_id"])) {
    return { error: "Request body contains unrecognised fields" };
  }

  if (typeof body.id !== "string" || !DATASET_VERSION_ID_PATTERN.test(body.id)) {
    return { error: "Dataset version id must be a lowercase slug" };
  }

  if (typeof body.name !== "string" || body.name.trim().length === 0) {
    return { error: "Dataset version name is required" };
  }

  if (
    body.description !== undefined &&
    body.description !== null &&
    typeof body.description !== "string"
  ) {
    return { error: "Dataset version description must be text" };
  }

  if (
    body.parent_version_id !== undefined &&
    body.parent_version_id !== null &&
    typeof body.parent_version_id !== "string"
  ) {
    return { error: "Parent dataset version id must be text" };
  }

  return {
    id: body.id,
    name: body.name,
    description: body.description ?? null,
    parent_version_id: body.parent_version_id ?? null
  };
}

function parseAttributeChanges(value: unknown): PlayerAttributeChanges | ErrorReply {
  if (!isRecord(value)) {
    return { error: "Attribute changes must be an object" };
  }

  const changes: PlayerAttributeChanges = {};

  for (const [attributeName, attributeValue] of Object.entries(value)) {
    if (!isPlayerAttributeName(attributeName)) {
      return { error: `Unknown attribute '${attributeName}'` };
    }

    if (
      typeof attributeValue !== "number" ||
      !Number.isInteger(attributeValue) ||
      attributeValue < 0 ||
      attributeValue > 100
    ) {
      return { error: `Attribute '${attributeName}' must be an integer from 0 to 100` };
    }

    changes[attributeName] = attributeValue;
  }

  if (Object.keys(changes).length === 0) {
    return { error: "At least one attribute change is required" };
  }

  return changes;
}

function parsePatchAttributesBody(
  body: unknown
): { dataset_version: string; changes: PlayerAttributeChanges; changed_by?: string } | ErrorReply {
  if (!isRecord(body)) {
    return { error: "Request body must be an object" };
  }

  if (!hasOnlyFields(body, ["dataset_version", "changes", "changed_by"])) {
    return { error: "Request body contains unrecognised fields" };
  }

  if (typeof body.dataset_version !== "string" || body.dataset_version.length === 0) {
    return { error: "dataset_version is required" };
  }

  if (body.changed_by !== undefined && typeof body.changed_by !== "string") {
    return { error: "changed_by must be text" };
  }

  const changes = parseAttributeChanges(body.changes);
  if ("error" in changes) {
    return changes;
  }

  const parsed = {
    dataset_version: body.dataset_version,
    changes
  };

  return body.changed_by === undefined ? parsed : { ...parsed, changed_by: body.changed_by };
}

function resolveAttributeVersion(version: string | undefined): DatasetVersion | null {
  if (version) {
    return getDatasetVersion(version);
  }

  return getActiveDatasetVersion();
}

export function registerDataRoutes(app: FastifyInstance): void {
  app.get<{ Reply: Club[] }>("/api/clubs", () => listClubs());

  app.get<{
    Params: SquadParams;
    Querystring: SquadQuery;
    Reply: SquadPlayerWithAttributes[] | { error: string };
  }>("/api/clubs/:id/squad", (request, reply) => {
    const { origin } = request.query;

    if (origin !== undefined && !isPlayerOrigin(origin)) {
      reply.code(400).send({ error: "origin must be 'real' or 'user_created'" });
      return;
    }

    return listSquadWithActiveAttributes(request.params.id, origin);
  });

  app.get<{ Reply: DatasetVersion[] }>("/api/dataset-versions", () => listDatasetVersions());

  app.post<{ Body: unknown; Reply: DatasetVersion | ErrorReply }>(
    "/api/dataset-versions",
    (request, reply) => {
      const input = parseCreateDatasetVersionInput(request.body);

      if ("error" in input) {
        reply.code(400);
        return input;
      }

      try {
        return createDatasetVersion(input);
      } catch (error) {
        if (error instanceof DataValidationError) {
          reply.code(400);
          return { error: error.message };
        }

        throw error;
      }
    }
  );

  app.post<{ Params: DatasetVersionParams; Reply: DatasetVersion | ErrorReply }>(
    "/api/dataset-versions/:id/activate",
    (request, reply) => {
      try {
        return activateDatasetVersion(request.params.id);
      } catch (error) {
        if (error instanceof DataNotFoundError) {
          reply.code(404);
          return { error: error.message };
        }

        throw error;
      }
    }
  );

  app.get<{ Params: PlayerParams; Reply: Player | ErrorReply }>(
    "/api/players/:playerId",
    (request, reply) => {
      const player = getPlayer(request.params.playerId);

      if (!player) {
        reply.code(404);
        return { error: `Player '${request.params.playerId}' does not exist` };
      }

      return player;
    }
  );

  app.get<{
    Params: PlayerParams;
    Querystring: AttributeQuery;
    Reply: PlayerAttributes | ErrorReply;
  }>("/api/players/:playerId/attributes", (request, reply) => {
    const player = getPlayer(request.params.playerId);
    const datasetVersion = resolveAttributeVersion(request.query.version);

    if (!player) {
      reply.code(404);
      return { error: `Player '${request.params.playerId}' does not exist` };
    }

    if (!datasetVersion) {
      reply.code(404);
      return { error: "Dataset version does not exist" };
    }

    const attributes = getPlayerAttributes(player.id, datasetVersion.id);

    if (!attributes) {
      reply.code(404);
      return { error: `Attributes for player '${player.id}' in '${datasetVersion.id}' do not exist` };
    }

    return attributes;
  });

  app.patch<{ Params: PlayerParams; Body: unknown; Reply: PlayerAttributes | ErrorReply }>(
    "/api/players/:playerId/attributes",
    (request, reply) => {
      const input = parsePatchAttributesBody(request.body);

      if ("error" in input) {
        reply.code(400);
        return input;
      }

      try {
        const updateInput = {
          playerId: request.params.playerId,
          datasetVersion: input.dataset_version,
          changes: input.changes
        };

        return updatePlayerAttributes(
          input.changed_by === undefined ? updateInput : { ...updateInput, changedBy: input.changed_by }
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
    Querystring: AttributeHistoryQuery;
    Reply: PlayerAttributeHistory[] | ErrorReply;
  }>("/api/players/:playerId/attribute-history", (request, reply) => {
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
      return getPlayerAttributeHistory(player.id, request.query.version, limit);
    } catch (error) {
      reply.code(error instanceof DataValidationError ? 400 : 500);
      return { error: errorMessage(error) };
    }
  });
}
