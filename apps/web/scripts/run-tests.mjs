import { readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const mode = process.argv[2] ?? "unit";
const liveTests = new Set([
  "convex/chargers/ingest.test.ts",
  "convex/flagship.test.ts",
  "convex/highways/queries.test.ts",
  "convex/report.test.ts",
]);

function collectTests(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return collectTests(path);
    return entry.name.endsWith(".test.ts") ? [relative(root, path)] : [];
  });
}

const candidates = [
  ...collectTests(join(root, "src", "lib")),
  ...collectTests(join(root, "src", "stores")),
  ...collectTests(join(root, "convex")),
].sort();

const tests = candidates.filter((path) =>
  mode === "live" ? liveTests.has(path) : !liveTests.has(path),
);

if (mode !== "unit" && mode !== "live") {
  console.error(`Unknown test mode: ${mode}. Expected unit or live.`);
  process.exit(2);
}

const result = spawnSync(
  process.execPath,
  ["--import", "tsx", "--test", ...tests],
  { cwd: root, stdio: "inherit" },
);

process.exit(result.status ?? 1);
