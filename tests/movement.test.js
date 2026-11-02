import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PLAYER_RADIUS, TERRACES } from "../src/core/constants.js";
import { placePlayer, step } from "../src/core/game.js";
import { humans, press, zeros } from "./helpers.js";

describe("movement and collision", () => {
  it("walks inward and stops on the terrace lip", () => {
    const state = humans();
    const terrace = TERRACES[0];
    const start = (terrace.inner + terrace.outer) / 2;
    placePlayer(state, 0, start, 0, 0);
    for (let i = 0; i < 80; i++) step(state, press(null, 0, { moveX: -1 }));
    const player = state.players[0];
    assert.equal(player.level, 0);
    assert.equal(player.x, terrace.inner);
    assert.ok(Math.abs(player.y) < 1e-6);
  });

  it("does not let a player walk up a terrace", () => {
    const state = humans();
    placePlayer(state, 0, TERRACES[0].inner, 0, 0);
    step(state, press(null, 0, { moveX: -1 }));
    assert.equal(state.players[0].level, 0);
    assert.equal(state.players[0].x, TERRACES[0].inner);
  });

  it("separates overlapping players without dropping them a terrace", () => {
    const state = humans();
    const x = (TERRACES[0].inner + TERRACES[0].outer) / 2;
    placePlayer(state, 0, x, 0, 0);
    placePlayer(state, 1, x, 0, 0);
    step(state, zeros());
    const a = state.players[0];
    const b = state.players[1];
    const distance = Math.hypot(a.x - b.x, a.y - b.y);
    assert.ok(distance >= PLAYER_RADIUS * 2 - 0.05);
    assert.equal(a.level, 0);
    assert.equal(b.level, 0);
    for (const player of [a, b]) {
      const radius = Math.hypot(player.x, player.y);
      assert.ok(radius >= TERRACES[0].inner - 0.01);
      assert.ok(radius <= TERRACES[0].outer + 0.01);
    }
  });

  it("holds still during the pre-round countdown", () => {
    const state = humans(3, { countdownTicks: 90 });
    const clock = state.ticksLeft;
    placePlayer(state, 0, 280, 0, 0);
    step(state, press(null, 0, { moveX: -1, action: true, secondary: true }));
    assert.equal(state.players[0].x, 280);
    assert.equal(state.countdownTicks, 89);
    assert.equal(state.ticksLeft, clock);
    assert.equal(state.phase, "playing");
  });
});
