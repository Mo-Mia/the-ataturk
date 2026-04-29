import {
  listClubs,
  listSquadWithActiveAttributes,
  type Club,
  type PlayerOrigin,
  type SquadPlayerWithAttributes
} from "@the-ataturk/data";
import type { FastifyInstance } from "fastify";

interface SquadParams {
  id: string;
}

interface SquadQuery {
  origin?: PlayerOrigin;
}

function isPlayerOrigin(value: unknown): value is PlayerOrigin {
  return value === "real" || value === "user_created";
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
}
