import { BOMB_RADIUS, MAX_LEVEL, SHOVE_RANGE } from "./constants.js";
const ZERO = { moveX: 0, moveY: 0, action: false, secondary: false };

function nearestOther(state, player) {
  let best = null;
  for (const other of state.players) {
    if (other === player || !other.enabled || !other.alive) continue;
    const distance = Math.hypot(other.x - player.x, other.y - player.y);
    if (!best || distance < best.distance) {
      best = { player: other, distance };
    }
  }
  return best;
}

function nearestBomb(state, player) {
  let best = null;
  for (const bomb of state.bombs) {
    const distance = Math.hypot(bomb.x - player.x, bomb.y - player.y);
    const threat = (bomb.radius ?? BOMB_RADIUS) + 26;
    if (distance < threat && (!best || distance < best.distance)) {
      best = { bomb, distance };
    }
  }
  return best;
}

/**
 * Simple free-for-all AI.
 * Climb toward the summit, stand in the crown, and shove anyone sharing it.
 * Step aside when a lava bomb is about to land.
 */
export function botInput(state, playerIndex) {
  const player = state.players[playerIndex];
  if (!player || !player.enabled || !player.isBot || !player.alive) return { ...ZERO };
  if (player.stunTicks > 0 || player.reactionTicks > 0) return { ...ZERO };

  const threat = nearestBomb(state, player);
  if (threat) {
    let dx = player.x - threat.bomb.x;
    let dy = player.y - threat.bomb.y;
    const mag = Math.hypot(dx, dy) || 1;
    return {
      moveX: dx / mag,
      moveY: dy / mag,
      action: false,
      secondary: player.level >= MAX_LEVEL,
    };
  }

  if (player.level < MAX_LEVEL) {
    const radius = Math.hypot(player.x, player.y) || 1;
    const neighbor = nearestOther(state, player);
    return {
      moveX: -player.x / radius,
      moveY: -player.y / radius,
      action: !!(neighbor && neighbor.distance < SHOVE_RANGE),
      secondary: true,
    };
  }

  const radius = Math.hypot(player.x, player.y);
  let moveX = 0;
  let moveY = 0;
  if (radius > 6) {
    moveX = -player.x / radius;
    moveY = -player.y / radius;
  }
  const neighbor = nearestOther(state, player);
  return {
    moveX,
    moveY,
    action: !!(neighbor && neighbor.distance < SHOVE_RANGE + 6),
    secondary: false,
  };
}
