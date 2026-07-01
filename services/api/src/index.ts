import { fileURLToPath } from "node:url";
import { buildApp } from "./app.js";

const isMain =
  process.argv[1] !== undefined &&
  fileURLToPath(import.meta.url) === process.argv[1];

if (isMain) {
  const app = await buildApp();
  const port = Number(process.env.PORT ?? 4000);
  const host = "0.0.0.0";

  await app.listen({ port, host });
}

export { buildApp } from "./app.js";
