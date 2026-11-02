import {
  BOMB_FUSE,
  BOMB_MAX_TICKS,
  BOMB_MIN_TICKS,
  BOMB_RADIUS,
  BOT_REACTION_BASE,
  BOT_REACTION_STEP,
  DODGE_DISTANCE,
  DROP_STUN_TICKS,
  HOP_COOLDOWN,
  INVULN_TICKS,
  LAVA_PENALTY,
  MAX_BOMBS,
  MAX_LEVEL,
  MOVE_SPEED,
  PLAYER_NAMES,
  PLAYER_RADIUS,
  POINTS_TO_WIN,
  RESPAWN_TICKS,
  ROUND_TICKS,
  SHOVE_COOLDOWN,
  SHOVE_IMPULSE,
  SHOVE_RANGE,
  STUN_TICKS,
  TERRACES,
  TICK_RATE,
  ZERO_INPUT,
  DEFAULT_ROUNDS_TO_WIN,
} from "./constants.js";
import {
  clampToTerrace,
  crownRadius,
  formatClock,
  inCrown,
  lavaStage,
  levelFromRadius,
  spawnPoint,
  terraceForLevel,
} from "./geometry.js";
import { nextRng, rngInt } from "./rng.js";

export { crownRadius, formatClock, inCrown, lavaStage, levelFromRadius };

function freshPlayer(config, index) {
  const enabled = config?.enabled !== false;
  const isBot = !!config?.isBot && enabled;
  const spot = spawnPoint(index, 0);
  return {
    id: index,
    name: config?.name || PLAYER_NAMES[index],
    enabled,
    isBot,
    x: spot.x,
    y: spot.y,
    level: spot.level,
    facing: Math.atan2(-spot.y, -spot.x),
    alive: enabled,
    score: 0,
    roundWins: 0,
    shoveCd: 0,
    hopCd: 0,
    stunTicks: 0,
    respawnTicks: 0,
    invulnTicks: 0,
    reactionTicks: isBot ? BOT_REACTION_BASE + index * BOT_REACTION_STEP : 0,
    crownTicksTotal: 0,
    hitThisTick: false,
  };
}

export function createGame(options = {}) {
  const seed = (options.seed ?? 1) >>> 0 || 1;
  const slots = Array.isArray(options.players) ? options.players : null;
  const state = {
    seed,
    rng: seed,
    phase: "playing",
    round: 1,
    roundsToWin: options.roundsToWin ?? DEFAULT_ROUNDS_TO_WIN,
    ticksLeft: ROUND_TICKS,
    countdownTicks: options.countdownTicks ?? 0,
    countdownFull: options.countdownTicks ?? 0,
    tick: 0,
    players: [0, 1, 2, 3].map((index) => {
      const config = slots ? slots.find((slot) => slot.id === index) || slots[index] : { isBot: true, enabled: true };
      return freshPlayer(config && config.id === undefined ? { ...config, id: index } : config, index);
    }),
    bombs: [],
    bombCooldownTicks: 0,
    crownTicks: 0,
    crownHolder: -1,
    roundWinnerId: -1,
    matchWinnerId: -1,
    events: [],
  };
  state.bombCooldownTicks = rngInt(state, BOMB_MIN_TICKS, BOMB_MAX_TICKS);
  return state;
}

export function blankInputs() {
  return [0, 1, 2, 3].map(() => ({ ...ZERO_INPUT }));
}

/** Test and debug helper. Snaps a player to a point and clears transient timers. */
export function placePlayer(state, id, x, y, level) {
  const player = state.players[id];
  player.x = x;
  player.y = y;
  player.level = level ?? levelFromRadius(Math.hypot(x, y));
  player.alive = true;
  player.enabled = true;
  player.stunTicks = 0;
  player.invulnTicks = 0;
  player.respawnTicks = 0;
  player.reactionTicks = 0;
  player.shoveCd = 0;
  player.hopCd = 0;
  player.hitThisTick = false;
  return player;
}

function eliminate(state, player) {
  if (!player.alive) return;
  player.alive = false;
  player.respawnTicks = RESPAWN_TICKS;
  player.stunTicks = 0;
  player.score = Math.max(0, player.score - LAVA_PENALTY);
  state.events.push({ type: "ko", playerId: player.id });
}

function respawnSpot(state, player) {
  const stage = lavaStage(state.ticksLeft);
  const level = Math.min(MAX_LEVEL, Math.max(stage, 0));
  const terrace = terraceForLevel(level);
  const radius = Math.max(8, terrace.outer - 12);
  for (let attempt = 0; attempt < 8; attempt++) {
    const angle = player.id * (Math.PI / 2) + attempt * (Math.PI / 4);
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    const blocked = state.players.some((other) => {
      if (other === player || !other.alive || !other.enabled) return false;
      return Math.hypot(other.x - x, other.y - y) < PLAYER_RADIUS * 2;
    });
    if (!blocked) return { x, y, level };
  }
  return { x: radius, y: 0, level };
}

function doRespawn(state, player) {
  const spot = respawnSpot(state, player);
  player.x = spot.x;
  player.y = spot.y;
  player.level = spot.level;
  player.alive = true;
  player.invulnTicks = INVULN_TICKS;
  player.facing = Math.atan2(-player.y, -player.x);
  player.reactionTicks = 0;
  state.events.push({ type: "respawn", playerId: player.id });
}

/**
 * Move by (dx, dy). Voluntary moves clamp to the current terrace.
 * Forced moves (shove) drop one terrace when they cross the outer rim,
 * or eliminate the player if they are shoved off the volcano entirely.
 */
function applyDisplacement(player, dx, dy, forced) {
  const nextX = player.x + dx;
  const nextY = player.y + dy;
  const terrace = terraceForLevel(player.level);
  const radius = Math.hypot(nextX, nextY);
  const angle = radius < 1e-6 ? player.facing : Math.atan2(nextY, nextX);

  if (radius > terrace.outer) {
    if (forced) {
      if (player.level <= 0) {
        player.x = Math.cos(angle) * (terrace.outer + 24);
        player.y = Math.sin(angle) * (terrace.outer + 24);
        return "off";
      }
      player.level -= 1;
      const lower = terraceForLevel(player.level);
      const landing = Math.min(lower.outer - 4, lower.inner + 10);
      player.x = Math.cos(angle) * landing;
      player.y = Math.sin(angle) * landing;
      return "drop";
    }
    player.x = Math.cos(angle) * terrace.outer;
    player.y = Math.sin(angle) * terrace.outer;
    return "clamp";
  }

  if (terrace.inner > 0 && radius < terrace.inner) {
    player.x = Math.cos(angle) * terrace.inner;
    player.y = Math.sin(angle) * terrace.inner;
    return "clamp";
  }

  player.x = nextX;
  player.y = nextY;
  return "ok";
}

function findShoveTarget(state, player) {
  let best = null;
  let bestDistance = SHOVE_RANGE;
  for (const other of state.players) {
    if (other === player || !other.enabled || !other.alive || other.invulnTicks > 0) continue;
    const distance = Math.hypot(other.x - player.x, other.y - player.y);
    if (distance > 0.001 && distance < bestDistance) {
      best = other;
      bestDistance = distance;
    }
  }
  return best;
}

function applyPlayerInput(state, player, input) {
  const moveX = input?.moveX ?? 0;
  const moveY = input?.moveY ?? 0;
  const magnitude = Math.hypot(moveX, moveY);
  if (magnitude > 0.01) {
    const nx = moveX / Math.max(1, magnitude);
    const ny = moveY / Math.max(1, magnitude);
    player.facing = Math.atan2(ny, nx);
    applyDisplacement(player, nx * (MOVE_SPEED / TICK_RATE), ny * (MOVE_SPEED / TICK_RATE), false);
  }

  if (input?.secondary && player.hopCd <= 0) {
    player.hopCd = HOP_COOLDOWN;
    if (player.level < MAX_LEVEL) {
      player.level += 1;
      const terrace = terraceForLevel(player.level);
      const radius = Math.hypot(player.x, player.y);
      const angle = radius < 1 ? player.facing : Math.atan2(player.y, player.x);
      const landing = terrace.inner === 0 ? Math.min(18, terrace.outer * 0.45) : (terrace.inner + terrace.outer) / 2;
      player.x = Math.cos(angle) * landing;
      player.y = Math.sin(angle) * landing;
      state.events.push({ type: "hop", playerId: player.id });
    } else {
      let dx = moveX;
      let dy = moveY;
      let dash = Math.hypot(dx, dy);
      if (dash < 0.2) {
        dx = Math.cos(player.facing);
        dy = Math.sin(player.facing);
        dash = 1;
      }
      applyDisplacement(player, (dx / dash) * DODGE_DISTANCE, (dy / dash) * DODGE_DISTANCE, false);
      state.events.push({ type: "dodge", playerId: player.id });
    }
  }

  if (input?.action && player.shoveCd <= 0) {
    player.shoveCd = SHOVE_COOLDOWN;
    const target = findShoveTarget(state, player);
    state.events.push({ type: "shove", playerId: player.id, hit: !!target });
    if (target) {
      const angle = Math.atan2(target.y - player.y, target.x - player.x);
      const result = applyDisplacement(
        target,
        Math.cos(angle) * SHOVE_IMPULSE,
        Math.sin(angle) * SHOVE_IMPULSE,
        true,
      );
      target.hitThisTick = true;
      target.facing = angle;
      if (result === "off") eliminate(state, target);
      else if (result === "drop") {
        target.stunTicks = Math.max(target.stunTicks, DROP_STUN_TICKS);
        state.events.push({ type: "drop", playerId: target.id });
      }
    }
  }
}

function separate(state) {
  const alive = state.players.filter((player) => player.enabled && player.alive);
  for (let iteration = 0; iteration < 4; iteration++) {
    for (let i = 0; i < alive.length; i++) {
      for (let j = i + 1; j < alive.length; j++) {
        const a = alive[i];
        const b = alive[j];
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let distance = Math.hypot(dx, dy);
        const minDistance = PLAYER_RADIUS * 2;
        if (distance < 1e-6) {
          const angle = (a.id + 1) * 0.9;
          dx = Math.cos(angle);
          dy = Math.sin(angle);
          distance = 1;
        }
        if (distance >= minDistance) continue;
        const push = (minDistance - distance) / 2;
        const nx = dx / distance;
        const ny = dy / distance;
        a.x -= nx * push;
        a.y -= ny * push;
        b.x += nx * push;
        b.y += ny * push;
        const clampedA = clampToTerrace(a.x, a.y, a.level);
        const clampedB = clampToTerrace(b.x, b.y, b.level);
        a.x = clampedA.x;
        a.y = clampedA.y;
        b.x = clampedB.x;
        b.y = clampedB.y;
      }
    }
  }
}

function spawnBomb(state) {
  const stage = lavaStage(state.ticksLeft);
  const level = rngInt(state, stage, MAX_LEVEL);
  const terrace = TERRACES[level];
  const angle = nextRng(state) * Math.PI * 2;
  const span = Math.max(1, terrace.outer - terrace.inner);
  const radius = terrace.inner + nextRng(state) * span;
  return {
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius,
    fuseTicks: BOMB_FUSE,
    radius: BOMB_RADIUS,
  };
}

function updateBombs(state) {
  for (const bomb of state.bombs) bomb.fuseTicks -= 1;
  const exploded = state.bombs.filter((bomb) => bomb.fuseTicks <= 0);
  state.bombs = state.bombs.filter((bomb) => bomb.fuseTicks > 0);
  for (const bomb of exploded) {
    state.events.push({ type: "bomb", x: bomb.x, y: bomb.y });
    for (const player of state.players) {
      if (!player.enabled || !player.alive || player.invulnTicks > 0) continue;
      const reach = bomb.radius + PLAYER_RADIUS;
      if (Math.hypot(player.x - bomb.x, player.y - bomb.y) <= reach) {
        player.stunTicks = STUN_TICKS;
        state.events.push({ type: "stun", playerId: player.id });
      }
    }
  }
  if (state.bombCooldownTicks > 0) {
    state.bombCooldownTicks -= 1;
  } else if (state.bombs.length < MAX_BOMBS) {
    state.bombs.push(spawnBomb(state));
    state.bombCooldownTicks = rngInt(state, BOMB_MIN_TICKS, BOMB_MAX_TICKS);
  }
}

function scoreCrown(state) {
  const holders = state.players.filter(
    (player) => player.enabled && player.alive && inCrown(player.x, player.y, state.ticksLeft),
  );
  if (holders.length !== 1) {
    state.crownHolder = -1;
    state.crownTicks = 0;
    return;
  }
  const holder = holders[0];
  if (state.crownHolder !== holder.id) {
    state.crownHolder = holder.id;
    state.crownTicks = 0;
  }
  state.crownTicks += 1;
  holder.crownTicksTotal += 1;
  if (state.crownTicks >= TICK_RATE) {
    state.crownTicks -= TICK_RATE;
    holder.score += 1;
    state.events.push({ type: "score", playerId: holder.id });
  }
}

function enabledPlayers(state) {
  return state.players.filter((player) => player.enabled);
}

function pickWinner(state) {
  return enabledPlayers(state)
    .slice()
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.crownTicksTotal !== a.crownTicksTotal) return b.crownTicksTotal - a.crownTicksTotal;
      return a.id - b.id;
    })[0];
}

function maybeEndRound(state) {
  const timeUp = state.ticksLeft <= 0;
  const scoreWin = state.players.some((player) => player.enabled && player.score >= POINTS_TO_WIN);
  if (!timeUp && !scoreWin) return;
  const winner = pickWinner(state);
  if (!winner) return;
  winner.roundWins += 1;
  state.roundWinnerId = winner.id;
  state.phase = "round_end";
  state.events.push({ type: "round", playerId: winner.id });
}

function resetForRound(state) {
  state.phase = "playing";
  state.ticksLeft = ROUND_TICKS;
  state.countdownTicks = state.countdownFull;
  state.bombs = [];
  state.bombCooldownTicks = rngInt(state, BOMB_MIN_TICKS, BOMB_MAX_TICKS);
  state.crownTicks = 0;
  state.crownHolder = -1;
  state.roundWinnerId = -1;
  state.tick = 0;
  for (const player of state.players) {
    const spot = spawnPoint(player.id, 0);
    player.x = spot.x;
    player.y = spot.y;
    player.level = 0;
    player.facing = Math.atan2(-spot.y, -spot.x);
    player.alive = player.enabled;
    player.score = 0;
    player.shoveCd = 0;
    player.hopCd = 0;
    player.stunTicks = 0;
    player.respawnTicks = 0;
    player.invulnTicks = 0;
    player.crownTicksTotal = 0;
    player.hitThisTick = false;
    player.reactionTicks = player.isBot ? BOT_REACTION_BASE + player.id * BOT_REACTION_STEP : 0;
  }
}

/** Leave a round-end banner and either open the next round or the match result. */
export function advance(state) {
  if (state.phase !== "round_end") return state;
  const champion = state.players.find((player) => player.enabled && player.roundWins >= state.roundsToWin);
  if (champion) {
    state.phase = "match_end";
    state.matchWinnerId = champion.id;
    state.events.push({ type: "match", playerId: champion.id });
    return state;
  }
  state.round += 1;
  resetForRound(state);
  return state;
}

export function step(state, inputs = []) {
  state.events = [];
  if (state.phase !== "playing") return state;
  state.tick += 1;

  if (state.countdownTicks > 0) {
    const previous = Math.ceil(state.countdownTicks / TICK_RATE);
    state.countdownTicks -= 1;
    const next = Math.ceil(state.countdownTicks / TICK_RATE);
    if (next !== previous) state.events.push({ type: "countdown", n: next });
    return state;
  }

  for (const player of state.players) {
    player.hitThisTick = false;
    if (player.shoveCd > 0) player.shoveCd -= 1;
    if (player.hopCd > 0) player.hopCd -= 1;
    if (player.stunTicks > 0) player.stunTicks -= 1;
    if (player.invulnTicks > 0) player.invulnTicks -= 1;
    if (player.reactionTicks > 0) player.reactionTicks -= 1;
    if (player.enabled && !player.alive) {
      player.respawnTicks -= 1;
      if (player.respawnTicks <= 0) doRespawn(state, player);
    }
  }

  if (state.ticksLeft > 0) state.ticksLeft -= 1;

  updateBombs(state);

  const stage = lavaStage(state.ticksLeft);
  for (const player of state.players) {
    if (!player.enabled || !player.alive) continue;
    if (player.hitThisTick || player.stunTicks > 0 || player.reactionTicks > 0) continue;
    applyPlayerInput(state, player, inputs[player.id] || ZERO_INPUT);
  }

  for (const player of state.players) {
    if (!player.enabled || !player.alive || player.invulnTicks > 0) continue;
    const offRim = Math.hypot(player.x, player.y) > TERRACES[0].outer + 0.5;
    if (player.level < stage || offRim) eliminate(state, player);
  }

  separate(state);
  scoreCrown(state);
  maybeEndRound(state);
  return state;
}

export function snapshot(state) {
  return {
    phase: state.phase,
    round: state.round,
    ticksLeft: state.ticksLeft,
    clock: formatClock(state.ticksLeft),
    lavaStage: lavaStage(state.ticksLeft),
    crownRadius: crownRadius(state.ticksLeft),
    scores: state.players.map((player) => player.score),
    roundWins: state.players.map((player) => player.roundWins),
    levels: state.players.map((player) => (player.enabled ? player.level : -1)),
    alive: state.players.map((player) => player.enabled && player.alive),
    positions: state.players.map((player) => [
      Math.round(player.x * 10) / 10,
      Math.round(player.y * 10) / 10,
    ]),
    bots: state.players.map((player) => player.isBot),
    enabled: state.players.map((player) => player.enabled),
    roundWinnerId: state.roundWinnerId,
    matchWinnerId: state.matchWinnerId,
    seed: state.seed,
    tick: state.tick,
    countdownTicks: state.countdownTicks,
  };
}
