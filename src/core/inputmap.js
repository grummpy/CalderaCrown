/** KeyboardEvent.code bindings for the four local players. */
export const DEFAULT_BINDINGS = [
  { up: "KeyW", down: "KeyS", left: "KeyA", right: "KeyD", action: "KeyF", secondary: "KeyG" },
  { up: "ArrowUp", down: "ArrowDown", left: "ArrowLeft", right: "ArrowRight", action: "Slash", secondary: "Period" },
  { up: "KeyI", down: "KeyK", left: "KeyJ", right: "KeyL", action: "Semicolon", secondary: "Quote" },
  { up: "Numpad8", down: "Numpad5", left: "Numpad4", right: "Numpad6", action: "Numpad0", secondary: "NumpadEnter" },
];

export const BIND_FIELDS = ["up", "down", "left", "right", "action", "secondary"];

/** Menu keys that cannot be stolen by a remap. */
export const RESERVED_CODES = new Set(["Escape", "Enter", "KeyM"]);

const LABELS = {
  ArrowUp: "↑",
  ArrowDown: "↓",
  ArrowLeft: "←",
  ArrowRight: "→",
  Slash: "/",
  Period: ".",
  Semicolon: ";",
  Quote: "'",
  NumpadEnter: "Num Enter",
  Space: "Space",
  ShiftLeft: "L Shift",
  ShiftRight: "R Shift",
};

const STICK_DEADZONE = 0.28;

export function keyLabel(code) {
  if (!code) return "—";
  if (LABELS[code]) return LABELS[code];
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  if (code.startsWith("Numpad")) return `Num ${code.slice(6)}`;
  return code;
}

export function cloneBindings(bindings = DEFAULT_BINDINGS) {
  return bindings.map((row) => ({ ...row }));
}

export function sanitizeBindings(raw) {
  const fresh = cloneBindings();
  if (!Array.isArray(raw) || raw.length !== 4) return fresh;
  return fresh.map((base, index) => {
    const row = raw[index];
    if (!row || typeof row !== "object") return base;
    for (const field of BIND_FIELDS) {
      const value = row[field];
      if (typeof value === "string" && value.length > 0 && value.length < 32) {
        base[field] = value;
      }
    }
    return base;
  });
}

/**
 * Assign a code. Reserved codes are rejected.
 * A code already used by the same player swaps with the previous binding
 * so a slot is never left empty.
 */
export function assignBinding(bindings, playerIndex, field, code) {
  if (RESERVED_CODES.has(code)) return false;
  if (!BIND_FIELDS.includes(field)) return false;
  const row = bindings[playerIndex];
  if (!row) return false;
  for (const other of BIND_FIELDS) {
    if (other !== field && row[other] === code) {
      row[other] = row[field];
    }
  }
  row[field] = code;
  return true;
}

function axis(pressed, negative, positive) {
  return (pressed.has(positive) ? 1 : 0) - (pressed.has(negative) ? 1 : 0);
}

/** `pressed` is a Set of KeyboardEvent.code values. */
export function keyboardPlayerInput(pressed, binding) {
  let moveX = axis(pressed, binding.left, binding.right);
  let moveY = axis(pressed, binding.up, binding.down);
  if (moveX !== 0 && moveY !== 0) {
    moveX *= Math.SQRT1_2;
    moveY *= Math.SQRT1_2;
  }
  return {
    moveX,
    moveY,
    action: pressed.has(binding.action),
    secondary: pressed.has(binding.secondary),
    pause: false,
  };
}

function buttonPressed(pad, index) {
  const button = pad.buttons && pad.buttons[index];
  return !!(button && button.pressed);
}

/**
 * Read a browser Gamepad (or a lookalike).
 * Left stick or D-pad moves, button 0 is action (A), button 1 is secondary (B),
 * button 9 is Start (pause). D-pad wins over the stick when held.
 * Returns null when the pad is missing or disconnected.
 */
export function readGamepad(pad) {
  if (!pad || !pad.connected) return null;
  let moveX = 0;
  let moveY = 0;
  if (buttonPressed(pad, 14)) moveX -= 1;
  if (buttonPressed(pad, 15)) moveX += 1;
  if (buttonPressed(pad, 12)) moveY -= 1;
  if (buttonPressed(pad, 13)) moveY += 1;
  const dpad = moveX !== 0 || moveY !== 0;
  if (!dpad) {
    const ax = Number(pad.axes?.[0] ?? 0);
    const ay = Number(pad.axes?.[1] ?? 0);
    moveX = Math.abs(ax) < STICK_DEADZONE ? 0 : ax;
    moveY = Math.abs(ay) < STICK_DEADZONE ? 0 : ay;
    const mag = Math.hypot(moveX, moveY);
    if (mag > 1) {
      moveX /= mag;
      moveY /= mag;
    }
  } else if (moveX !== 0 && moveY !== 0) {
    moveX *= Math.SQRT1_2;
    moveY *= Math.SQRT1_2;
  }
  return {
    connected: true,
    moveX,
    moveY,
    action: buttonPressed(pad, 0),
    secondary: buttonPressed(pad, 1),
    pause: buttonPressed(pad, 9),
  };
}

/** A connected pad replaces that player's keyboard for as long as it is plugged in. */
export function combineInput(keyInput, padInput) {
  if (padInput && padInput.connected) {
    return {
      moveX: padInput.moveX,
      moveY: padInput.moveY,
      action: !!padInput.action,
      secondary: !!padInput.secondary,
      pause: !!padInput.pause,
      fromPad: true,
    };
  }
  return {
    moveX: keyInput?.moveX ?? 0,
    moveY: keyInput?.moveY ?? 0,
    action: !!keyInput?.action,
    secondary: !!keyInput?.secondary,
    pause: false,
    fromPad: false,
  };
}

export function buildFrameInputs(pressed, bindings, pads) {
  return [0, 1, 2, 3].map((index) => {
    const keyInput = keyboardPlayerInput(pressed, bindings[index]);
    const pad = pads && pads[index] ? pads[index] : null;
    return combineInput(keyInput, pad && pad.connected === false ? null : pad);
  });
}
