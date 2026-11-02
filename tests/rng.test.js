import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { nextRng, rngInt } from "../src/core/rng.js";

describe("seeded rng", () => {
  it("repeats the same sequence for the same seed", () => {
    const a = { rng: 20261101 };
    const b = { rng: 20261101 };
    const seqA = Array.from({ length: 8 }, () => nextRng(a));
    const seqB = Array.from({ length: 8 }, () => nextRng(b));
    assert.deepEqual(seqA, seqB);
    assert.equal(a.rng, b.rng);
  });

  it("diverges for a different seed", () => {
    const a = { rng: 1 };
    const b = { rng: 2 };
    assert.notEqual(nextRng(a), nextRng(b));
  });

  it("stays inside the unit interval and produces integers in range", () => {
    const state = { rng: 99 };
    for (let i = 0; i < 100; i++) {
      const value = nextRng(state);
      assert.ok(value >= 0 && value < 1);
      const n = rngInt({ rng: state.rng }, 3, 7);
      assert.ok(n >= 3 && n <= 7);
    }
  });
});
