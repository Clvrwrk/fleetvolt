import Fastify from "fastify";
import cors from "@fastify/cors";
import type { paths } from "@fleetvolt/shared-types";

export type StackMetaResponse =
  paths["/v1/meta/stack"]["get"]["responses"]["200"]["content"]["application/json"];

const app = Fastify({ logger: true });

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
  request: { log: { error: (obj: object, msg: string) => void } },
  reply: { status: (code: number) => { send: (body: unknown) => unknown } },
  path: string,
) {
  const simulatorUrl = process.env.SIMULATOR_URL ?? "http://localhost:8000";
  const query = (request as { url?: string }).url?.split("?")[1];
  const url = query ? `${simulatorUrl}${path}?${query}` : `${simulatorUrl}${path}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

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

app.get("/v1/chargers/near", async (request, reply) => {
  return proxySimulatorGet(request, reply, "/v1/chargers/near");
});

app.get("/v1/data/freshness", async (request, reply) => {
  return proxySimulatorGet(request, reply, "/v1/data/freshness");
});

const port = Number(process.env.PORT ?? 4000);
const host = "0.0.0.0";

await app.listen({ port, host });
