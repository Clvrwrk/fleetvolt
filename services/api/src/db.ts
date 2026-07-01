import pg from "pg";

const connectionString =
  process.env.DATABASE_URL ??
  "postgresql://fleetvolt:fleetvolt@localhost:5432/fleetvolt";

export const pool = new pg.Pool({
  connectionString,
  max: 10,
  idleTimeoutMillis: 30_000,
});

pool.on("error", (error: Error) => {
  console.error("Unexpected pg pool error", error);
});
