/**
 * Mulberry32. `state.rng` is a uint32 updated in place so a whole match
 * stays deterministic and serializable from a single number.
 */
export function nextRng(state) {
  let s = state.rng >>> 0;
  s = (s + 0x6d2b79f5) >>> 0;
  let t = Math.imul(s ^ (s >>> 15), 1 | s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  state.rng = s >>> 0;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Inclusive integer range. */
export function rngInt(state, min, max) {
  const span = max - min + 1;
  return min + Math.floor(nextRng(state) * span);
}
