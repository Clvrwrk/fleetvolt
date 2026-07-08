import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

/**
 * DEPRECATED — Phase 13-04
 *
 * The async job pipeline (POST /v1/simulations → Celery → poll
 * GET /v1/simulations/:id) has been replaced by the Convex simulate action
 * (apps/web/convex/physics/simulate.ts). The web client now calls
 * api.physics.simulate.simulate directly — no Fastify proxy needed.
 *
 * These routes are kept for rollback safety but are no longer registered
 * in app.ts. They return 410 Gone if called directly.
 */

const DEPRECATION_MESSAGE =
  "Simulations now run via Convex action — call api.physics.simulate.simulate from the web client.";

/**
 * @deprecated Since Phase 13-04 — kept for type compat with app.ts options.
 */
export interface SimulationsDeps {
  pool: unknown;
  fetchFn: typeof fetch;
  simulatorUrl: string;
}

export function registerSimulationRoutes(
  app: FastifyInstance,
  _deps?: unknown,
) {
  app.post("/v1/simulations", async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply
      .status(410)
      .header("Deprecation", "true")
      .header("Link", "</v1/simulations>; rel=\"deprecation\"")
      .send({
        error: "deprecated",
        message: DEPRECATION_MESSAGE,
      });
  });

  app.get("/v1/simulations/:id", async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply
      .status(410)
      .header("Deprecation", "true")
      .send({
        error: "deprecated",
        message: DEPRECATION_MESSAGE,
      });
  });
}
