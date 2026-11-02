import {
  CROWN_RADIUS_FULL,
  CROWN_RADIUS_MIN,
  CROWN_SHRINK_TICKS,
  LAVA_EVERY_TICKS,
  MAX_LAVA_STAGE,
  ROUND_TICKS,
  TERRACES,
} from "./constants.js";

export function terraceForLevel(level) {
  return TERRACES[Math.max(0, Math.min(TERRACES.length - 1, level))];
}

/** Highest terrace whose outer rim contains this radius. */
export function levelFromRadius(radius) {
  for (let i = TERRACES.length - 1; i >= 0; i--) {
    if (radius <= TERRACES[i].outer + 1e-4) return i;
  }
  return 0;
}

/**
 * How many lowest terraces are flooded.
 * Stage 0: everything is safe. Stage 1 floods level 0, and so on.
 * The summit (level 4) is never flooded.
 */
export function lavaStage(ticksLeft) {
  const elapsed = Math.max(0, ROUND_TICKS - ticksLeft);
  return Math.min(MAX_LAVA_STAGE, Math.floor(elapsed / LAVA_EVERY_TICKS));
}

/** Crown zone radius. Full size until the final 30 seconds, then it shrinks. */
export function crownRadius(ticksLeft) {
  if (ticksLeft >= CROWN_SHRINK_TICKS) return CROWN_RADIUS_FULL;
  const t = Math.max(0, ticksLeft) / CROWN_SHRINK_TICKS;
  return CROWN_RADIUS_MIN + (CROWN_RADIUS_FULL - CROWN_RADIUS_MIN) * t;
}

export function inCrown(x, y, ticksLeft) {
  return Math.hypot(x, y) <= crownRadius(ticksLeft) + 1e-6;
}

export function formatClock(ticksLeft) {
  const total = Math.max(0, Math.ceil(ticksLeft / 60));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/** Pull a point back inside a terrace annulus. Does not change levels. */
export function clampToTerrace(x, y, level) {
  const terrace = terraceForLevel(level);
  let radius = Math.hypot(x, y);
  const angle = radius < 1e-6 ? 0 : Math.atan2(y, x);
  if (radius > terrace.outer) radius = terrace.outer;
  if (radius < terrace.inner) radius = terrace.inner;
  return {
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius,
  };
}

export function spawnPoint(index, level = 0) {
  const terrace = terraceForLevel(level);
  const radius = (terrace.inner + terrace.outer) / 2;
  const angle = -Math.PI / 2 + index * (Math.PI / 2);
  return {
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius,
    level,
  };
}
