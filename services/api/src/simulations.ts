import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { pool } from "./db.js";
import {
  CHARGER_VERSION,
  PHYSICS_VERSION,
  computeInputsHash,
} from "./inputs_hash.js";

type SimulateRequest = Record<string, unknown>;

interface SimulationRunRow extends Record<string, unknown> {
  id: string;
  status: string;
  outputs?: unknown;
  error?: unknown;
  duration_ms?: number | null;
}

export interface DbPool {
  query(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: Record<string, unknown>[] }>;
}

export interface SimulationsDeps {
  pool: DbPool;
  fetchFn: typeof fetch;
  simulatorUrl: string;
}

const defaultDeps: SimulationsDeps = {
  pool,
  fetchFn: fetch,
  simulatorUrl: process.env.SIMULATOR_URL ?? "http://localhost:8000",
};

export function createSimulationsHandlers(deps: SimulationsDeps = defaultDeps) {
  async function postSimulation(
    request: FastifyRequest<{ Body: SimulateRequest }>,
    reply: FastifyReply,
  ) {
    const body = request.body;
    const hash = computeInputsHash(body, PHYSICS_VERSION, CHARGER_VERSION);

    const cached = await deps.pool.query(
      `SELECT id, status, outputs FROM simulation_runs
       WHERE inputs_hash = $1 AND status = 'COMPLETE'
       ORDER BY created_at DESC LIMIT 1`,
      [hash],
    );

    if (cached.rows[0]) {
      const row = cached.rows[0] as SimulationRunRow;
      return {
        job_id: row.id,
        status: "COMPLETE",
        outputs: row.outputs,
      };
    }

    const inserted = await deps.pool.query(
      `INSERT INTO simulation_runs (
         inputs, inputs_hash, status, physics_version, charger_version
       )
       VALUES ($1, $2, 'PENDING', $3, $4)
       RETURNING id`,
      [body, hash, PHYSICS_VERSION, CHARGER_VERSION],
    );

    const jobId = (inserted.rows[0] as { id: string }).id;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);

    try {
      const response = await deps.fetchFn(
        `${deps.simulatorUrl}/v1/internal/jobs/${jobId}/enqueue`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ inputs: body }),
          signal: controller.signal,
        },
      );
      clearTimeout(timeout);

      if (!response.ok) {
        const message = await response.text();
        await deps.pool.query(
          `UPDATE simulation_runs
           SET status = 'FAILED', error = $2::jsonb
           WHERE id = $1`,
          [
            jobId,
            JSON.stringify({
              code: "enqueue_failed",
              message,
              stage: "enqueue",
            }),
          ],
        );
        return reply.status(response.status).send({
          error: "simulator_error",
          message,
        });
      }
    } catch (error) {
      clearTimeout(timeout);
      request.log.error({ err: error }, "simulator unreachable");
      await deps.pool.query(
        `UPDATE simulation_runs
         SET status = 'FAILED', error = $2::jsonb
         WHERE id = $1`,
        [
          jobId,
          JSON.stringify({
            code: "simulator_unreachable",
            message: error instanceof Error ? error.message : String(error),
            stage: "enqueue",
          }),
        ],
      );
      return reply.status(503).send({
        error: "simulator_unreachable",
        message: error instanceof Error ? error.message : String(error),
      });
    }

    return { job_id: jobId, status: "PENDING" };
  }

  async function getSimulation(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ) {
    const { id } = request.params;

    const result = await deps.pool.query(
      `SELECT id, status, outputs, error, duration_ms
       FROM simulation_runs
       WHERE id = $1`,
      [id],
    );

    if (!result.rows[0]) {
      return reply.status(404).send({
        error: "not_found",
        message: "Simulation run not found",
      });
    }

    const row = result.rows[0] as SimulationRunRow;
    const payload: Record<string, unknown> = {
      job_id: row.id,
      status: row.status,
    };

    if (row.status === "COMPLETE" && row.outputs !== undefined) {
      payload.outputs = row.outputs;
    }
    if (row.status === "FAILED" && row.error !== undefined) {
      payload.error = row.error;
    }
    if (row.duration_ms != null) {
      payload.duration_ms = row.duration_ms;
    }

    return payload;
  }

  return { postSimulation, getSimulation };
}

export function registerSimulationRoutes(
  app: FastifyInstance,
  deps?: SimulationsDeps,
) {
  const { postSimulation, getSimulation } = createSimulationsHandlers(deps);

  app.post("/v1/simulations", postSimulation);
  app.get("/v1/simulations/:id", getSimulation);
}
