const SCROLL_CODES = new Set([
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Space",
  "Slash",
  "Numpad8",
  "Numpad5",
  "Numpad4",
  "Numpad6",
  "Numpad0",
  "NumpadEnter",
]);

/** Keyboard state for the page. Taps are queued so a short press is never missed between frames. */
export function createKeyboard() {
  const down = new Set();
  const queued = [];
  let onCapture = null;

  const onDown = (event) => {
    if (event.repeat) return;
    if (SCROLL_CODES.has(event.code)) event.preventDefault();
    if (onCapture) {
      event.preventDefault();
      const capture = onCapture;
      onCapture = null;
      capture(event.code);
      return;
    }
    down.add(event.code);
    queued.push(event.code);
  };

  const onUp = (event) => {
    down.delete(event.code);
  };

  window.addEventListener("keydown", onDown);
  window.addEventListener("keyup", onUp);
  window.addEventListener("blur", () => {
    down.clear();
    queued.length = 0;
  });

  return {
    down,
    edges() {
      return queued.splice(0, queued.length);
    },
    capture(fn) {
      onCapture = fn;
    },
    cancelCapture() {
      onCapture = null;
    },
    isCapturing() {
      return !!onCapture;
    },
  };
}
