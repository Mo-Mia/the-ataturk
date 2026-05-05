import {
  FC25_CLUB_IDS,
  getFc25DatasetVersion,
  type Fc25ClubId,
  type SquadManagerSuggestion
} from "@the-ataturk/data";
import type { FastifyInstance } from "fastify";

import {
  SquadManagerApplyConflictError,
  activateFc25DatasetVersionForSquadManager,
  applyLowRiskSquadManagerSuggestions
} from "../../squad-manager/apply";

interface ErrorReply {
  error: string;
}

interface ActivateParams {
  id: string;
}

interface ApplyBody {
  clubId: Fc25ClubId;
  datasetVersionId: string;
  riskLevel: "low";
  suggestions: SquadManagerSuggestion[];
  verifyFresh?: boolean;
}

export function registerSquadManagerAdminRoutes(app: FastifyInstance): void {
  app.post<{ Body: unknown }>(
    "/api/admin/squad-manager/apply",
    (request, reply) => {
      const parsed = parseApplyBody(request.body);
      if ("error" in parsed) {
        reply.code(400).send(parsed);
        return;
      }

      try {
        reply.send(
          applyLowRiskSquadManagerSuggestions({
            ...parsed,
            actor: "squad-manager-ui"
          })
        );
      } catch (error) {
        reply.code(error instanceof SquadManagerApplyConflictError ? 409 : 400).send({
          error: errorMessage(error)
        });
      }
    }
  );

  app.post<{ Params: ActivateParams }>(
    "/api/admin/squad-manager/dataset-versions/:id/activate",
    (request, reply) => {
      try {
        reply.send(activateFc25DatasetVersionForSquadManager(request.params.id));
      } catch (error) {
        reply.code(404).send({ error: errorMessage(error) });
      }
    }
  );
}

function parseApplyBody(body: unknown): ApplyBody | ErrorReply {
  if (!isRecord(body)) {
    return { error: "Request body must be an object" };
  }
  if (!hasOnlyFields(body, ["clubId", "datasetVersionId", "riskLevel", "suggestions", "verifyFresh"])) {
    return { error: "Request body contains unrecognised fields" };
  }
  if (!isFc25ClubId(body.clubId)) {
    return { error: "clubId must be a supported FC25 club id" };
  }
  if (typeof body.datasetVersionId !== "string" || !getFc25DatasetVersion(body.datasetVersionId)) {
    return { error: "datasetVersionId must be an existing FC25 dataset version id" };
  }
  if (body.riskLevel !== "low") {
    return { error: "riskLevel must be 'low'" };
  }
  if (!Array.isArray(body.suggestions)) {
    return { error: "suggestions must be an array" };
  }
  if (body.verifyFresh !== undefined && typeof body.verifyFresh !== "boolean") {
    return { error: "verifyFresh must be boolean" };
  }

  const parsed = {
    clubId: body.clubId,
    datasetVersionId: body.datasetVersionId,
    riskLevel: "low" as const,
    suggestions: body.suggestions as SquadManagerSuggestion[]
  };

  return body.verifyFresh === undefined ? parsed : { ...parsed, verifyFresh: body.verifyFresh };
}

function hasOnlyFields(body: Record<string, unknown>, allowedFields: readonly string[]): boolean {
  return Object.keys(body).every((field) => allowedFields.includes(field));
}

function isFc25ClubId(value: unknown): value is Fc25ClubId {
  return FC25_CLUB_IDS.includes(value as Fc25ClubId);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Request failed";
}
