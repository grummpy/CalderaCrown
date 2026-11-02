import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { POINTS_TO_WIN, ROUND_TICKS, TICK_RATE } from "../src/core/constants.js";
import { formatClock } from "../src/core/geometry.js";
import { advance, placePlayer, step } from "../src/core/game.js";
import { humans, zeros } from "./helpers.js";

describe("scoring, rounds, and match", () => {
  it("awards one point per second alone in the crown", () => {
    const state = humans();
    placePlayer(state, 0, 0, 0, 4);
    for (let i = 0; i < TICK_RATE; i++) step(state, zeros());
    assert.equal(state.players[0].score, 1);
    assert.equal(state.players[1].score, 0);
    for (let i = 0; i < TICK_RATE; i++) step(state, zeros());
    assert.equal(state.players[0].score, 2);
  });

  it("awards nothing while the crown is contested, and resets a partial hold", () => {
    const state = humans();
    placePlayer(state, 0, 0, 0, 4);
    for (let i = 0; i < 30; i++) step(state, zeros());
    assert.equal(state.players[0].score, 0);
    assert.equal(state.crownTicks, 30);

    placePlayer(state, 1, 8, 0, 4);
    step(state, zeros());
    assert.equal(state.crownTicks, 0);
    assert.equal(state.players[0].score, 0);
    assert.equal(state.players[1].score, 0);

    placePlayer(state, 1, 300, 0, 0);
    for (let i = 0; i < TICK_RATE; i++) step(state, zeros());
    assert.equal(state.players[0].score, 1);
  });

  it("ends the round when a player reaches the point target", () => {
    const state = humans();
    placePlayer(state, 0, 0, 0, 4);
    state.players[0].score = POINTS_TO_WIN - 1;
    for (let i = 0; i < TICK_RATE - 1; i++) step(state, zeros());
    assert.equal(state.phase, "playing");
    assert.equal(state.players[0].score, POINTS_TO_WIN - 1);
    step(state, zeros());
    assert.equal(state.players[0].score, POINTS_TO_WIN);
    assert.equal(state.phase, "round_end");
    assert.equal(state.roundWinnerId, 0);
    assert.equal(state.players[0].roundWins, 1);
  });

  it("ends the round on time and breaks ties by crown time, then index", () => {
    const state = humans();
    state.ticksLeft = 1;
    state.players[0].score = 5;
    state.players[1].score = 5;
    state.players[0].crownTicksTotal = 10;
    state.players[1].crownTicksTotal = 40;
    step(state, zeros());
    assert.equal(state.phase, "round_end");
    assert.equal(state.roundWinnerId, 1);

    const tied = humans();
    tied.ticksLeft = 1;
    tied.players[0].score = 3;
    tied.players[2].score = 3;
    tied.players[0].crownTicksTotal = 8;
    tied.players[2].crownTicksTotal = 8;
    step(tied, zeros());
    assert.equal(tied.roundWinnerId, 0);
  });

  it("plays first to N and then declares the match", () => {
    const state = humans(4, { roundsToWin: 2 });
    state.players[0].score = POINTS_TO_WIN;
    step(state, zeros());
    assert.equal(state.phase, "round_end");
    advance(state);
    assert.equal(state.phase, "playing");
    assert.equal(state.round, 2);
    assert.equal(state.players[0].score, 0);
    assert.equal(state.players[0].roundWins, 1);
    assert.equal(state.players[0].level, 0);

    state.players[1].score = POINTS_TO_WIN;
    step(state, zeros());
    assert.equal(state.roundWinnerId, 1);
    advance(state);
    assert.equal(state.phase, "playing");
    assert.equal(state.round, 3);

    state.players[0].score = POINTS_TO_WIN;
    step(state, zeros());
    assert.equal(state.players[0].roundWins, 2);
    advance(state);
    assert.equal(state.phase, "match_end");
    assert.equal(state.matchWinnerId, 0);
  });

  it("ignores advance unless a round has just ended", () => {
    const state = humans();
    assert.equal(advance(state).phase, "playing");
  });

  it("formats the HUD clock", () => {
    assert.equal(formatClock(ROUND_TICKS), "2:00");
    assert.equal(formatClock(ROUND_TICKS - TICK_RATE), "1:59");
    assert.equal(formatClock(TICK_RATE), "0:01");
    assert.equal(formatClock(0), "0:00");
  });
});
