import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BIND_FIELDS,
  DEFAULT_BINDINGS,
  assignBinding,
  buildFrameInputs,
  keyboardPlayerInput,
  keyLabel,
  readGamepad,
  sanitizeBindings,
} from "../src/core/inputmap.js";

function pad({ axes = [0, 0], pressed = [], connected = true } = {}) {
  return {
    connected,
    axes,
    buttons: Array.from({ length: 16 }, (_, index) => ({ pressed: pressed.includes(index) })),
  };
}

describe("input mapping", () => {
  it("maps each player's default keyboard cluster", () => {
    const pressed = new Set(["KeyW", "KeyD", "KeyF", "ArrowLeft", "Slash", "KeyJ", "Semicolon", "Numpad8", "Numpad0"]);
    const inputs = buildFrameInputs(pressed, DEFAULT_BINDINGS, []);
    assert.ok(Math.abs(inputs[0].moveX - Math.SQRT1_2) < 1e-9);
    assert.ok(Math.abs(inputs[0].moveY + Math.SQRT1_2) < 1e-9);
    assert.equal(inputs[0].action, true);
    assert.equal(inputs[0].secondary, false);

    assert.equal(inputs[1].moveX, -1);
    assert.equal(inputs[1].moveY, 0);
    assert.equal(inputs[1].action, true);
    assert.equal(inputs[1].secondary, false);

    assert.equal(inputs[2].moveX, -1);
    assert.equal(inputs[2].action, true);
    assert.equal(inputs[2].secondary, false);

    assert.equal(inputs[3].moveY, -1);
    assert.equal(inputs[3].action, true);
    assert.equal(inputs[3].secondary, false);
  });

  it("reads the secondary keys and numpad enter", () => {
    const p2 = keyboardPlayerInput(new Set(["ArrowDown", "Period"]), DEFAULT_BINDINGS[1]);
    assert.equal(p2.moveY, 1);
    assert.equal(p2.secondary, true);
    const p3 = keyboardPlayerInput(new Set(["Quote"]), DEFAULT_BINDINGS[2]);
    assert.equal(p3.secondary, true);
    const p4 = keyboardPlayerInput(new Set(["NumpadEnter", "Numpad6", "Numpad4"]), DEFAULT_BINDINGS[3]);
    assert.equal(p4.moveX, 0);
    assert.equal(p4.secondary, true);
  });

  it("reads a mocked gamepad: stick, deadzone, d-pad, A, B, and Start", () => {
    const idle = readGamepad(pad({ axes: [0.1, -0.2] }));
    assert.equal(idle.moveX, 0);
    assert.equal(idle.moveY, 0);

    const stick = readGamepad(pad({ axes: [0.6, -0.8] }));
    assert.ok(stick.moveX > 0);
    assert.ok(stick.moveY < 0);
    assert.ok(Math.hypot(stick.moveX, stick.moveY) <= 1 + 1e-9);

    const dpad = readGamepad(pad({ axes: [1, 1], pressed: [12, 15, 0, 1, 9] }));
    assert.ok(dpad.moveY < 0);
    assert.ok(dpad.moveX > 0);
    assert.equal(dpad.action, true);
    assert.equal(dpad.secondary, true);
    assert.equal(dpad.pause, true);

    assert.equal(readGamepad(pad({ connected: false })), null);
    assert.equal(readGamepad(null), null);
  });

  it("lets a connected pad override that player only", () => {
    const pressed = new Set(["KeyW", "ArrowUp"]);
    const pads = [
      readGamepad(pad({ axes: [1, 0], pressed: [0] })),
      null,
      null,
      null,
    ];
    const inputs = buildFrameInputs(pressed, DEFAULT_BINDINGS, pads);
    assert.equal(inputs[0].fromPad, true);
    assert.ok(inputs[0].moveX > 0);
    assert.equal(inputs[0].moveY, 0);
    assert.equal(inputs[0].action, true);
    assert.equal(inputs[1].fromPad, false);
    assert.equal(inputs[1].moveY, -1);

    const disconnected = buildFrameInputs(pressed, DEFAULT_BINDINGS, [
      readGamepad(pad({ connected: false, axes: [1, 0] })),
    ]);
    assert.equal(disconnected[0].fromPad, false);
    assert.ok(disconnected[0].moveY < 0);
  });

  it("sanitizes saved bindings and swaps duplicates on the same player", () => {
    assert.deepEqual(sanitizeBindings(null), DEFAULT_BINDINGS);
    const custom = sanitizeBindings([
      { ...DEFAULT_BINDINGS[0], action: "KeyQ" },
      "nope",
      null,
      { up: 12, down: "KeyZ" },
    ]);
    assert.equal(custom[0].action, "KeyQ");
    assert.equal(custom[1].up, "ArrowUp");
    assert.equal(custom[3].down, "KeyZ");
    assert.equal(custom[3].up, "Numpad8");

    const bindings = sanitizeBindings(DEFAULT_BINDINGS);
    assert.equal(assignBinding(bindings, 0, "action", "Escape"), false);
    assert.equal(assignBinding(bindings, 0, "action", "KeyG"), true);
    assert.equal(bindings[0].action, "KeyG");
    assert.equal(bindings[0].secondary, "KeyF");
    assert.equal(keyLabel("Slash"), "/");
    assert.equal(keyLabel("Numpad8"), "Num 8");
    assert.equal(keyLabel("KeyA"), "A");
    assert.equal(BIND_FIELDS.length, 6);
  });
});
