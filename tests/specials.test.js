import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BOMB_FUSE,
  CROWN_RADIUS_FULL,
  CROWN_RADIUS_MIN,
  CROWN_SHRINK_TICKS,
  MAX_LEVEL,
  ROUND_TICKS,
  TICK_RATE,
  SHOVE_COOLDOWN,
  SHOVE_RANGE,
  STUN_TICKS,
  TERRACES,
} from "../src/core/constants.js";
import { crownRadius } from "../src/core/geometry.js";
import { placePlayer, step } from "../src/core/game.js";
import { humans, press, zeros } from "./helpers.js";

describe("shove, hop, lava bombs, and the shrinking crown", () => {
  it("hops to the next terrace and dodges without leaving the summit", () => {
    const state = humans();
    placePlayer(state, 0, TERRACES[0].inner, 0, 0);
    step(state, press(null, 0, { secondary: true }));
    const player = state.players[0];
    const mid = (TERRACES[1].inner + TERRACES[1].outer) / 2;
    assert.equal(player.level, 1);
    assert.ok(Math.abs(player.x - mid) < 1e-6);
    assert.ok(Math.abs(player.y) < 1e-6);

    placePlayer(state, 0, 0, 0, MAX_LEVEL);
    step(state, press(null, 0, { secondary: true, moveX: 1 }));
    assert.equal(state.players[0].level, MAX_LEVEL);
    assert.ok(state.players[0].x > 40);
    assert.ok(state.players[0].x <= TERRACES[MAX_LEVEL].outer);
  });

  it("shoves the nearest rival onto the terrace below", () => {
    const state = humans();
    const victimX = TERRACES[2].outer - 6;
    placePlayer(state, 1, victimX, 0, 2);
    placePlayer(state, 0, victimX - (SHOVE_RANGE - 18), 0, 2);
    step(state, press(null, 0, { action: true }));
    const victim = state.players[1];
    assert.equal(victim.level, 1);
    assert.equal(victim.alive, true);
    assert.ok(victim.x > victimX);
    const terrace = TERRACES[1];
    const radius = Math.hypot(victim.x, victim.y);
    assert.ok(radius >= terrace.inner - 0.01 && radius <= terrace.outer + 0.01);
    assert.ok(victim.stunTicks > 0);

    const before = victim.x;
    step(state, press(null, 0, { action: true }));
    assert.equal(state.players[0].shoveCd, SHOVE_COOLDOWN - 1);
    assert.equal(victim.x, before);
  });

  it("stuns players on a telegraphed lava bomb and misses everyone else", () => {
    const state = humans();
    placePlayer(state, 0, 0, 0, 4);
    placePlayer(state, 1, 300, 0, 0);
    state.bombs.push({ x: 0, y: 0, fuseTicks: 1, radius: 40 });
    step(state, zeros());
    assert.equal(state.players[0].stunTicks, STUN_TICKS);
    assert.equal(state.players[1].stunTicks, 0);
    assert.equal(state.bombs.length, 0);
    assert.ok(state.events.some((event) => event.type === "bomb"));
    assert.ok(BOMB_FUSE > 1);
  });

  it("shrinks the crown through the final 30 seconds", () => {
    assert.equal(crownRadius(ROUND_TICKS), CROWN_RADIUS_FULL);
    assert.equal(crownRadius(CROWN_SHRINK_TICKS), CROWN_RADIUS_FULL);
    assert.ok(Math.abs(crownRadius(0) - CROWN_RADIUS_MIN) < 1e-9);
    const mid = crownRadius(CROWN_SHRINK_TICKS / 2);
    assert.ok(mid < CROWN_RADIUS_FULL && mid > CROWN_RADIUS_MIN);

    const state = humans();
    placePlayer(state, 0, 50, 0, 4);
    state.bombCooldownTicks = 1_000_000;
    state.ticksLeft = CROWN_SHRINK_TICKS + TICK_RATE;
    for (let i = 0; i < 60; i++) step(state, zeros());
    assert.equal(state.players[0].score, 1);

    state.players[0].score = 0;
    state.crownTicks = 0;
    state.crownHolder = -1;
    state.ticksLeft = 30;
    placePlayer(state, 0, 50, 0, 4);
    state.bombCooldownTicks = 1_000_000;
    for (let i = 0; i < 120; i++) step(state, zeros());
    assert.equal(state.players[0].score, 0);
  });
});
