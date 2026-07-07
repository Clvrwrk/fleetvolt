// Pure array-chunking helper — batches ingest rows under the Convex mutation
// 1s cap + 5MiB arg limit (P12-03). The FAF zone-061 aggregate is ~105k rows;
// chunked at 500/call it flows through internalMutation batches comfortably.
//
// Pure module — no Convex server import — so it is unit-testable with plain
//   node --import tsx --test.
export function chunk<T>(arr: readonly T[], size = 500): T[][] {
  if (size <= 0) throw new Error("chunk size must be > 0");
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}
