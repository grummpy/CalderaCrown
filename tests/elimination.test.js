import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  LAVA_EVERY_TICKS,
  LAVA_PENALTY,
  RESPAWN_TICKS,
  ROUND_TICKS,
  SHOVE_RANGE,
  TERRACES,
} from "../src/core/constants.js";
import { lavaStage } from "../src/core/geometry.js";
import { placePlayer, step } from "../src/core/game.js";
import { humans, press, zeros } from "./helpers.js";

describe("elimination and lava", () => {
  it("floods terraces on a 20 second cadence and never the summit", () => {
    assert.equal(lavaStage(ROUND_TICKS), 0);
    assert.equal(lavaStage(ROUND_TICKS - LAVA_EVERY_TICKS), 1);
    assert.equal(lavaStage(ROUND_TICKS - LAVA_EVERY_TICKS * 4), 4);
    assert.equal(lavaStage(0), 4);
  });

  it("respawns a player who touches lava, after 3 seconds, on a safe terrace", () => {
    const state = humans();
    state.ticksLeft = ROUND_TICKS - LAVA_EVERY_TICKS;
    placePlayer(state, 0, 280, 0, 0);
    state.players[0].score = 10;
    step(state, zeros());
    const player = state.players[0];
    assert.equal(player.alive, false);
    assert.equal(player.respawnTicks, RESPAWN_TICKS);
    assert.equal(player.score, 10 - LAVA_PENALTY);
    assert.ok(state.events.some((event) => event.type === "ko" && event.playerId === 0));

    for (let i = 0; i < RESPAWN_TICKS - 1; i++) step(state, zeros());
    assert.equal(state.players[0].alive, false);
    step(state, zeros());
    assert.equal(state.players[0].alive, true);
    assert.ok(state.players[0].level >= lavaStage(state.ticksLeft));
    const terrace = TERRACES[state.players[0].level];
    const radius = Math.hypot(state.players[0].x, state.players[0].y);
    assert.ok(radius <= terrace.outer + 0.01);
    assert.ok(radius >= terrace.inner - 0.01);
  });

  it("does not drop a score below zero", () => {
    const state = humans();
    state.ticksLeft = ROUND_TICKS - LAVA_EVERY_TICKS;
    placePlayer(state, 0, 280, 0, 0);
    state.players[0].score = 2;
    step(state, zeros());
    assert.equal(state.players[0].score, 0);
  });

  it("respects post-respawn invulnerability", () => {
    const state = humans();
    state.ticksLeft = ROUND_TICKS - LAVA_EVERY_TICKS;
    placePlayer(state, 0, 280, 0, 0);
    state.players[0].invulnTicks = 8;
    step(state, zeros());
    assert.equal(state.players[0].alive, true);
    assert.equal(state.players[0].score, 0);
  });

  it("eliminates a player shoved off the outer rim", () => {
    const state = humans();
    const victimX = TERRACES[0].outer - 4;
    placePlayer(state, 1, victimX, 0, 0);
    placePlayer(state, 0, victimX - (SHOVE_RANGE - 16), 0, 0);
    state.players[1].score = 9;
    step(state, press(null, 0, { action: true }));
    assert.equal(state.players[1].alive, false);
    assert.equal(state.players[1].score, 9 - LAVA_PENALTY);
    assert.equal(state.players[1].respawnTicks, RESPAWN_TICKS);
  });
});
