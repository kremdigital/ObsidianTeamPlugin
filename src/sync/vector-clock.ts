/**
 * Vector clock — `nodeId → counter` map. Each node bumps its own counter on
 * every locally generated operation; clocks merge by taking the per-node max.
 *
 * Two clocks are considered:
 *   - **equal**       — same set of keys with identical counters,
 *   - **a < b**       — every counter in `a` is `<= b` and at least one is `<`,
 *   - **a > b**       — symmetric to the above,
 *   - **concurrent**  — neither dominates (used to detect potential conflicts
 *                       on the binary-file side; CRDT text merges still win).
 */

export type VectorClock = Record<string, number>;

export type CompareResult = -1 | 0 | 1 | 'concurrent';

/**
 * Per-node max merge. Result has every key from either input; missing keys
 * are treated as 0.
 */
export function merge(a: VectorClock, b: VectorClock): VectorClock {
  const out: VectorClock = { ...a };
  for (const [node, counter] of Object.entries(b)) {
    const existing = out[node] ?? 0;
    if (counter > existing) out[node] = counter;
  }
  return out;
}

/**
 * Compare two clocks. Missing keys are treated as 0, so an empty clock is
 * `<` any non-empty clock.
 */
export function compare(a: VectorClock, b: VectorClock): CompareResult {
  let aDominates = false;
  let bDominates = false;
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    const av = a[key] ?? 0;
    const bv = b[key] ?? 0;
    if (av > bv) aDominates = true;
    else if (av < bv) bDominates = true;
    if (aDominates && bDominates) return 'concurrent';
  }
  if (aDominates) return 1;
  if (bDominates) return -1;
  return 0;
}

/**
 * Return a new clock with `nodeId`'s counter bumped by 1. The original clock
 * is not mutated — call sites typically replace the binding's stored clock
 * with the result.
 */
export function increment(vc: VectorClock, nodeId: string): VectorClock {
  return { ...vc, [nodeId]: (vc[nodeId] ?? 0) + 1 };
}
