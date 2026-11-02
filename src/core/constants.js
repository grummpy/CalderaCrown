/** Fixed 60 Hz simulation. One call to step() is one tick. */
export const TICK_RATE = 60;

export const ROUND_SECONDS = 120;
export const ROUND_TICKS = ROUND_SECONDS * TICK_RATE;
export const LAVA_EVERY_SECONDS = 20;
export const LAVA_EVERY_TICKS = LAVA_EVERY_SECONDS * TICK_RATE;
export const POINTS_TO_WIN = 60;
export const DEFAULT_ROUNDS_TO_WIN = 2;
export const RESPAWN_TICKS = 3 * TICK_RATE;
export const LAVA_PENALTY = 3;
export const CROWN_SHRINK_SECONDS = 30;
export const CROWN_SHRINK_TICKS = CROWN_SHRINK_SECONDS * TICK_RATE;

export const PLAYER_RADIUS = 16;
export const MOVE_SPEED = 170;
export const SHOVE_RANGE = 58;
export const SHOVE_IMPULSE = 96;
export const SHOVE_COOLDOWN = 26;
export const HOP_COOLDOWN = 20;
export const STUN_TICKS = 72;
export const INVULN_TICKS = 45;
export const DROP_STUN_TICKS = 18;
export const BOMB_FUSE = 60;
export const BOMB_RADIUS = 40;
export const BOMB_MIN_TICKS = 5 * TICK_RATE;
export const BOMB_MAX_TICKS = 8 * TICK_RATE;
export const MAX_BOMBS = 2;
export const DODGE_DISTANCE = 48;

/** Bots pause before they start climbing so a solo match still produces a crown window. */
export const BOT_REACTION_BASE = 36;
export const BOT_REACTION_STEP = 110;

/**
 * Concentric terraces. Level 0 is the outer, lowest ring.
 * Level 4 is the summit. Distance from the origin is the radius.
 */
export const TERRACES = [
  { level: 0, inner: 250, outer: 322 },
  { level: 1, inner: 186, outer: 250 },
  { level: 2, inner: 126, outer: 186 },
  { level: 3, inner: 70, outer: 126 },
  { level: 4, inner: 0, outer: 70 },
];

export const MAX_LEVEL = TERRACES.length - 1;
/** Lava can swallow every terrace below the summit. */
export const MAX_LAVA_STAGE = MAX_LEVEL;

export const CROWN_RADIUS_FULL = 70;
export const CROWN_RADIUS_MIN = 24;

export const PLAYER_COLORS = ["#e23b2f", "#3aa0ff", "#3dbe6a", "#e2b434"];
export const PLAYER_NAMES = ["P1", "P2", "P3", "P4"];

export const ZERO_INPUT = Object.freeze({
  moveX: 0,
  moveY: 0,
  action: false,
  secondary: false,
});
