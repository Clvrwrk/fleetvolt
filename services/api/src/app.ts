import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import type { paths } from "@fleetvolt/shared-types";
import { registerSimulationRoutes, type SimulationsDeps } from "./simulations.js";

export type StackMetaResponse =
  paths["/v1/meta/stack"]["get"]["responses"]["200"]["content"]["application/json"];

export async function buildApp(options?: {
  logger?: boolean;
  simulationsDeps?: SimulationsDeps;
}): Promise<FastifyInstance> {
  const app = Fastify({ logger: options?.logger ?? true });

  await app.register(cors, {
    origin: [
      "http://localhost:3000",
      "http://127.0.0.1:3000",
      "http://web:3000",
    ],
  });

  app.get("/health", async () => ({ status: "ok" }));

  app.get("/v1/meta/stack", async (request, reply) => {
    const simulatorUrl = process.env.SIMULATOR_URL ?? "http://localhost:8000";
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(`${simulatorUrl}/v1/meta/stack`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) {
        const message = await response.text();
        return reply.status(response.status).send({
          error: "simulator_error",
          message,
        });
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeout);
      request.log.error({ err: error }, "simulator unreachable");
      return reply.status(503).send({
        error: "simulator_unreachable",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.get("/v1/spatial/nhfn/stats", async (request, reply) => {
    const simulatorUrl = process.env.SIMULATOR_URL ?? "http://localhost:8000";
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(`${simulatorUrl}/v1/spatial/nhfn/stats`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) {
        const message = await response.text();
        return reply.status(response.status).send({
          error: "simulator_error",
          message,
        });
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeout);
      request.log.error({ err: error }, "simulator unreachable");
      return reply.status(503).send({
        error: "simulator_unreachable",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.get("/v1/trucks", async (request, reply) => {
    const simulatorUrl = process.env.SIMULATOR_URL ?? "http://localhost:8000";
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(`${simulatorUrl}/v1/trucks`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) {
        const message = await response.text();
        return reply.status(response.status).send({
          error: "simulator_error",
          message,
        });
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeout);
      request.log.error({ err: error }, "simulator unreachable");
      return reply.status(503).send({
        error: "simulator_unreachable",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  async function proxySimulatorGet(
    request: {
      log: { error: (obj: object, msg: string) => void };
      url?: string;
    },
    reply: { status: (code: number) => { send: (body: unknown) => unknown } },
    path: string,
    timeoutMs = 5000,
  ) {
    const simulatorUrl = process.env.SIMULATOR_URL ?? "http://localhost:8000";
    const query = request.url?.split("?")[1];
    const url = query
      ? `${simulatorUrl}${path}?${query}`
      : `${simulatorUrl}${path}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);

      if (!response.ok) {
        const message = await response.text();
        return reply.status(response.status).send({
          error: "simulator_error",
          message,
        });
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeout);
      request.log.error({ err: error }, "simulator unreachable");
      return reply.status(503).send({
        error: "simulator_unreachable",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async function proxySimulatorPost(
    request: {
      log: { error: (obj: object, msg: string) => void };
      body: unknown;
    },
    reply: { status: (code: number) => { send: (body: unknown) => unknown } },
    path: string,
    timeoutMs = 15000,
  ) {
    const simulatorUrl = process.env.SIMULATOR_URL ?? "http://localhost:8000";
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${simulatorUrl}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request.body),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) {
        const message = await response.text();
        return reply.status(response.status).send({
          error: "simulator_error",
          message,
        });
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeout);
      request.log.error({ err: error }, "simulator unreachable");
      return reply.status(503).send({
        error: "simulator_unreachable",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  app.get("/v1/chargers/near", async (request, reply) => {
    return proxySimulatorGet(request, reply, "/v1/chargers/near");
  });

  app.get("/v1/data/freshness", async (request, reply) => {
    return proxySimulatorGet(request, reply, "/v1/data/freshness");
  });

  app.post("/v1/simulate", async (request, reply) => {
    return proxySimulatorPost(request, reply, "/v1/simulate");
  });

  app.get("/v1/corridors", async (request, reply) => {
    return proxySimulatorGet(request, reply, "/v1/corridors");
  });

  app.get("/v1/routing/route", async (request, reply) => {
    return proxySimulatorGet(request, reply, "/v1/routing/route");
  });

  app.get("/v1/physics/validation", async (request, reply) => {
    return proxySimulatorGet(request, reply, "/v1/physics/validation", 15000);
  });

  registerSimulationRoutes(app, options?.simulationsDeps);

  return app;
}
