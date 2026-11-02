import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { TICK_RATE } from "../src/core/constants.js";
import { botInput } from "../src/core/bots.js";
import { snapshot, step } from "../src/core/game.js";
import { bots, zeros } from "./helpers.js";

function simulate(seed, ticks) {
  const state = bots(seed);
  for (let i = 0; i < ticks; i++) {
    const inputs = state.players.map((player, index) =>
      player.isBot ? botInput(state, index) : { moveX: 0, moveY: 0, action: false, secondary: false },
    );
    step(state, inputs);
  }
  return state;
}

describe("bots", () => {
  it("holds bot reactions through the pre-round countdown", () => {
    const state = bots(3);
    state.countdownTicks = 180;
    state.countdownFull = 180;
    const before = state.players.map((player) => player.reactionTicks);
    for (let i = 0; i < 180; i++) step(state, zeros());
    assert.deepEqual(state.players.map((player) => player.reactionTicks), before);
    assert.equal(state.countdownTicks, 0);
    assert.equal(state.players[0].level, 0);
  });

  it("climbs, contests the crown, and scores inside a solo match", () => {
    const state = simulate(42, 12 * TICK_RATE);
    assert.ok(state.players.some((player) => player.level === 4));
    assert.ok(state.players.some((player) => player.score > 0));
    for (const player of state.players) {
      assert.ok(Number.isFinite(player.x) && Number.isFinite(player.y));
      assert.ok(player.score >= 0);
    }
  });

  it("is deterministic for a seed and changes with the seed", () => {
    const left = simulate(7, 8 * TICK_RATE);
    const right = simulate(7, 8 * TICK_RATE);
    const other = simulate(8, 8 * TICK_RATE);
    assert.deepEqual(snapshot(left), snapshot(right));
    assert.equal(left.rng, right.rng);
    assert.notEqual(left.rng, other.rng);
  });
});
