import { createGame } from "../src/core/game.js";

export function zeros() {
  return [0, 1, 2, 3].map(() => ({ moveX: 0, moveY: 0, action: false, secondary: false }));
}

export function humans(seed = 1, extra = {}) {
  const state = createGame({
    seed,
    countdownTicks: 0,
    players: [0, 1, 2, 3].map((id) => ({ id, enabled: true, isBot: false })),
    ...extra,
  });
  state.bombCooldownTicks = 1_000_000;
  return state;
}

export function bots(seed = 1) {
  return createGame({
    seed,
    countdownTicks: 0,
    players: [0, 1, 2, 3].map((id) => ({ id, enabled: true, isBot: true })),
  });
}

export function press(base, index, patch) {
  const inputs = base ? base.map((input) => ({ ...input })) : zeros();
  inputs[index] = { ...inputs[index], ...patch };
  return inputs;
}
