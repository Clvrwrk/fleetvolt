// Build road-traced freight corridors on the active Convex deployment.
//
//   node scripts/build_freight_corridors.mjs
//
// Requires GOOGLE_MAPS_API_KEY (or NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) available
// to the Convex action — set via `npx convex env set` or pass through locally.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(__dirname, "..");
const WEB = resolve(REPO, "apps/web");
const ENV_LOCAL = resolve(WEB, ".env.local");

function loadLocalKey() {
  if (!existsSync(ENV_LOCAL)) return null;
  const text = readFileSync(ENV_LOCAL, "utf8");
  const m = text.match(/^NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=(.+)$/m);
  return m ? m[1].trim() : null;
}

const key = process.env.GOOGLE_MAPS_API_KEY || loadLocalKey();
const env = {
  ...process.env,
  ...(key
    ? {
        GOOGLE_MAPS_API_KEY: key,
        NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: key,
      }
    : {}),
};

console.log("Running faf/buildCorridors:run …");
execFileSync("npx", ["convex", "run", "faf/buildCorridors:run", "{}"], {
  cwd: WEB,
  stdio: "inherit",
  env,
});
console.log("Done.");
