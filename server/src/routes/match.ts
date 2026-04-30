import { listFixtures } from "@the-ataturk/data";
import type { FastifyInstance, FastifyReply } from "fastify";
import { playIteration } from "@the-ataturk/engine";
import { withEngineConsoleMuted } from "@the-ataturk/engine/internal/silence";
import type { MatchSnapshot, MatchTick as CustomMatchTick } from "@the-ataturk/match-engine";

import { FAST_FORWARD_ITERATION_DELAY_MS, ITERATIONS_PER_HALF } from "../config";
import { buildHalfTimeMatchState } from "../match/half-time-state";
import { iterateMatch, toFinalMatchSummary, type MatchTick } from "../match/orchestrator";

interface MatchRunBody {
  fixture_id?: string;
  dataset_version?: string;
}

interface MatchRunQuery {
  speed?: string;
}

interface ErrorReply {
  error: string;
}

const DEFAULT_FIXTURE_ID = "final-2005";
const DEFAULT_DATASET_VERSION = "v2-llm-derived-final";

export function registerMatchRoute(app: FastifyInstance): void {
  app.get("/api/match/snapshot/fse", async (request, reply) => {
    try {
      const matchDetails = await buildHalfTimeMatchState("liverpool", "ac-milan", DEFAULT_DATASET_VERSION);
      const ticks: CustomMatchTick[] = [];
      let current = matchDetails;

      for (let iteration = 1; iteration <= ITERATIONS_PER_HALF; iteration++) {
        const mins = 45 + Math.floor((iteration * 3) / 60);
        const secs = (iteration * 3) % 60;
        
        ticks.push({
          iteration,
          matchClock: { half: 2, minute: mins, seconds: secs },
          ball: {
            position: [current.ball.position[0], current.ball.position[1], current.ball.position[2] ?? 0],
            inFlight: false,
            carrierPlayerId: current.ball.withPlayer ? String(current.ball.Player) : null
          },
          players: [
            ...current.kickOffTeam.players.map(p => ({
              id: String(p.playerID),
              teamId: "home" as const,
              position: [p.currentPOS[0], p.currentPOS[1]] as [number, number],
              hasBall: p.hasBall,
              onPitch: !p.injured && p.stats.cards.red === 0
            })),
            ...current.secondTeam.players.map(p => ({
              id: String(p.playerID),
              teamId: "away" as const,
              position: [p.currentPOS[0], p.currentPOS[1]] as [number, number],
              hasBall: p.hasBall,
              onPitch: !p.injured && p.stats.cards.red === 0
            }))
          ],
          score: {
            home: Number(current.kickOffTeamStatistics.goals),
            away: Number(current.secondTeamStatistics.goals)
          },
          possession: {
            teamId: current.ball.withPlayer ? (String(current.ball.withTeam) === String(current.kickOffTeam.teamID) ? "home" : "away") : null,
            zone: "mid"
          },
          events: []
        });

        current = await withEngineConsoleMuted(() => playIteration(current));
      }

      const snap: MatchSnapshot = {
        meta: {
          homeTeam: { id: "home", name: "Liverpool", shortName: "LIV" },
          awayTeam: { id: "away", name: "Milan", shortName: "MIL" },
          seed: 1, duration: "second_half", preMatchScore: { home: 0, away: 3 }, generatedAt: new Date().toISOString(), targets: { shotsTarget: [0,0], goalsTarget: [0,0], foulsTarget: [0,0], cardsTarget: [0,0] }
        },
        ticks,
        finalSummary: {
          finalScore: { home: Number(current.kickOffTeamStatistics.goals), away: Number(current.secondTeamStatistics.goals) },
          statistics: { home: {} as any, away: {} as any }
        }
      };

      reply.send(snap);
    } catch (e) {
      app.log.error(e);
      reply.code(500).send({ error: "FSE adapter failed" });
    }
  });

  app.post<{ Body: unknown; Querystring: MatchRunQuery }>(
    "/api/match/run",
    async (request, reply) => {
      const body = parseMatchRunBody(request.body);

      if ("error" in body) {
        reply.code(400).send(body);
        return;
      }

      const fixture = listFixtures().find(
        (candidate) => candidate.id === (body.fixture_id ?? DEFAULT_FIXTURE_ID)
      );
      if (!fixture) {
        reply.code(404).send({ error: "Fixture does not exist" });
        return;
      }

      if (fixture.home_club_id !== "liverpool" || fixture.away_club_id !== "ac-milan") {
        reply.code(400).send({ error: "Only the Liverpool v AC Milan final is supported" });
        return;
      }

      reply.hijack();
      reply.raw.writeHead(200, {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive"
      });

      const abortController = new AbortController();
      let latestIteration = 0;
      let completed = false;

      reply.raw.on("close", () => {
        if (!completed) {
          abortController.abort();
          app.log.info(`match aborted at iteration ${latestIteration}`);
        }
      });

      try {
        const matchDetails = await buildHalfTimeMatchState(
          fixture.home_club_id,
          fixture.away_club_id,
          body.dataset_version ?? DEFAULT_DATASET_VERSION
        );
        let latestTick: MatchTick | null = null;

        const iterationDelayMs = delayForSpeed(request.query.speed);
        const iterateOptions =
          iterationDelayMs === undefined
            ? { signal: abortController.signal }
            : { iterationDelayMs, signal: abortController.signal };

        for await (const tick of iterateMatch(matchDetails, iterateOptions)) {
          latestIteration = tick.iteration;
          latestTick = tick;
          sendSseEvent(reply, "tick", tick);
        }

        if (!abortController.signal.aborted && latestTick) {
          sendSseEvent(reply, "final", toFinalMatchSummary(latestTick));
        }
      } catch (error) {
        if (!abortController.signal.aborted) {
          app.log.error({ error }, "Match run failed");
          sendSseEvent(reply, "error", { error: errorMessage(error) });
        }
      } finally {
        completed = true;
        reply.raw.end();
      }
    }
  );
}

function parseMatchRunBody(body: unknown): MatchRunBody | ErrorReply {
  if (body === undefined || body === null) {
    return {};
  }

  if (!isRecord(body)) {
    return { error: "Request body must be an object" };
  }

  if (!hasOnlyFields(body, ["fixture_id", "dataset_version"])) {
    return { error: "Request body contains unrecognised fields" };
  }

  if (body.fixture_id !== undefined && typeof body.fixture_id !== "string") {
    return { error: "fixture_id must be text" };
  }

  if (body.dataset_version !== undefined && typeof body.dataset_version !== "string") {
    return { error: "dataset_version must be text" };
  }

  return {
    ...(body.fixture_id === undefined ? {} : { fixture_id: body.fixture_id }),
    ...(body.dataset_version === undefined ? {} : { dataset_version: body.dataset_version })
  };
}

function delayForSpeed(speed: string | undefined): number | undefined {
  if (process.env.NODE_ENV === "test") {
    return 0;
  }

  return speed === "fast" ? FAST_FORWARD_ITERATION_DELAY_MS : undefined;
}

function sendSseEvent(reply: FastifyReply, eventName: string, data: unknown): void {
  reply.raw.write(`event: ${eventName}\n`);
  reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Match run failed";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyFields(body: Record<string, unknown>, allowedFields: readonly string[]): boolean {
  return Object.keys(body).every((field) => allowedFields.includes(field));
}
