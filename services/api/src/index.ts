import Fastify from "fastify";
import cors from "@fastify/cors";

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

const port = Number(process.env.PORT ?? 4000);
const host = "0.0.0.0";

await app.listen({ port, host });
