import { PLAYER_COLORS } from "../core/constants.js";
import { lavaStage, formatClock } from "../core/geometry.js";
import { botInput } from "../core/bots.js";
import {
  BIND_FIELDS,
  assignBinding,
  buildFrameInputs,
  keyLabel,
  readGamepad,
  sanitizeBindings,
} from "../core/inputmap.js";
import { advance, createGame, snapshot, step } from "../core/game.js";
import { createAudio } from "./audio.js";
import { createKeyboard } from "./input.js";
import { renderArena } from "./render.js";

const SETTINGS_KEY = "calderacrown-settings";
const BINDINGS_KEY = "calderacrown-bindings";
const STEP_MS = 1000 / 60;

const screen = document.querySelector("#screen");
const hud = document.querySelector("#hud");
const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
const probe = document.querySelector("#probe");
const live = document.querySelector("#live");
const keys = createKeyboard();
const audio = createAudio();

const ZERO = { moveX: 0, moveY: 0, action: false, secondary: false };

let mode = "title";
let settingsBack = "title";
let controlsBack = "title";
let sim = null;
let bindings = loadBindings();
let settings = loadSettings();
let slots = [0, 1, 2, 3].map(() => ({ joined: false, bot: true }));
let menuIndex = 0;
let remapIndex = 0;
let last = 0;
let acc = 0;
let bannerUntil = 0;
let lastLava = 0;
let lavaText = "";
let lavaUntil = 0;
let goUntil = 0;
let padPrev = [null, null, null, null];
let pads = [null, null, null, null];

audio.setVolume(settings.volume);
audio.setMuted(settings.muted);

function loadSettings() {
  const fallback = { volume: 0.7, muted: false, roundsToWin: 2 };
  try {
    const raw = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "null");
    if (!raw || typeof raw !== "object") return fallback;
    const rounds = Number(raw.roundsToWin);
    return {
      volume: Math.max(0, Math.min(1, Number(raw.volume ?? fallback.volume))),
      muted: !!raw.muted,
      roundsToWin: [1, 2, 3].includes(rounds) ? rounds : 2,
    };
  } catch {
    return fallback;
  }
}

function saveSettings() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    /* private mode */
  }
}

function loadBindings() {
  try {
    return sanitizeBindings(JSON.parse(localStorage.getItem(BINDINGS_KEY) || "null"));
  } catch {
    return sanitizeBindings(null);
  }
}

function saveBindings() {
  try {
    localStorage.setItem(BINDINGS_KEY, JSON.stringify(bindings));
  } catch {
    /* private mode */
  }
}

function pollPads() {
  const source = typeof navigator.getGamepads === "function" ? navigator.getGamepads() : [];
  return [0, 1, 2, 3].map((index) => readGamepad(source && source[index]));
}

function edgePads(next) {
  const edges = next.map((pad, index) => {
    const prev = padPrev[index] || {};
    const now = pad || {};
    return {
      action: !!(now.action && !prev.action),
      secondary: !!(now.secondary && !prev.secondary),
      pause: !!(now.pause && !prev.pause),
      connected: !!(pad && pad.connected),
    };
  });
  padPrev = next.map((pad) => (pad ? { action: pad.action, secondary: pad.secondary, pause: pad.pause } : null));
  return edges;
}

function participants() {
  return slots.filter((slot) => slot.joined || slot.bot).length;
}

function slotStatus(slot) {
  if (slot.joined) return "Ready";
  if (slot.bot) return "Bot";
  return "Off";
}

function renderTitle() {
  screen.innerHTML = `
    <div class="panel title">
      <div class="hero" role="img" aria-label="Caldera Crown"></div>
      <div class="title-copy">
        <h1>Caldera <span>Crown</span></h1>
        <p class="tag">Hold the rim. Outlast the lava.</p>
        <p class="prompt">Press Start / Enter</p>
        <div class="row">
          <button class="primary" data-action="start">Start</button>
          <button data-action="settings">Settings</button>
          <button data-action="controls">Controls</button>
        </div>
        <p class="fine">Four rivals, one summit. Empty slots are bots, so you can play alone.</p>
      </div>
    </div>`;
}

function renderJoin() {
  const cards = slots.map((slot, index) => {
    const binding = bindings[index];
    const status = slotStatus(slot);
    return `
      <button class="slot ${slot.joined ? "on" : ""}" data-action="join" data-slot="${index}" style="--player:${PLAYER_COLORS[index]}">
        <span class="kicker">P${index + 1}</span>
        <strong>${status}</strong>
        <em>${keyLabel(binding.action)} joins · ${index + 1} toggles bot</em>
        <em>${keyLabel(binding.up)} ${keyLabel(binding.left)} ${keyLabel(binding.down)} ${keyLabel(binding.right)} move · ${keyLabel(binding.secondary)} hop</em>
      </button>`;
  }).join("");
  const ready = participants() > 0;
  screen.innerHTML = `
    <div class="panel">
      <div class="title-copy" style="text-align:left">
        <p class="kicker">Choose who erupts</p>
        <h1 style="font-family:var(--serif);font-size:2.4rem;margin:0">Take a slot</h1>
      </div>
      <div class="slots">${cards}</div>
      <div class="row">
        <button class="primary" data-action="begin" ${ready ? "" : "disabled"}>Begin match</button>
        <button data-action="title">Back</button>
      </div>
      <p class="fine">Enter starts. A connected gamepad takes over that seat.</p>
    </div>`;
}

function renderSettings() {
  const rows = [
    ["volume", `Volume ${Math.round(settings.volume * 100)}%`],
    ["rounds", `First to ${settings.roundsToWin}`],
    ["mute", settings.muted ? "Sound off" : "Sound on"],
    ["controls", "Remap controls"],
    ["back", "Back"],
  ];
  screen.innerHTML = `
    <div class="sheet">
      <p class="kicker">Settings</p>
      <h2>The mountain's terms</h2>
      <p class="fine" style="text-align:left">First to ${settings.roundsToWin} ${settings.roundsToWin === 2 ? "is a best of 3." : "wins the match."}</p>
      <div class="menu">
        ${rows.map(([id, label], index) => `<button data-action="setting" data-id="${id}" class="${index === menuIndex ? "selected" : ""}">${label}</button>`).join("")}
      </div>
    </div>`;
}

function renderControls() {
  const capturing = keys.isCapturing();
  const groups = [0, 1, 2, 3].map((player) => {
    const rows = BIND_FIELDS.map((field, offset) => {
      const index = player * 6 + offset;
      const selected = index === remapIndex;
      const waiting = capturing && selected;
      return `<button class="bind ${selected ? "selected" : ""}" data-action="bind" data-index="${index}">
        <span>P${player + 1} ${field}</span>
        <small>${waiting ? "Press a key…" : keyLabel(bindings[player][field])}</small>
      </button>`;
    }).join("");
    return `<p class="group-label">P${player + 1}</p>${rows}`;
  }).join("");
  screen.innerHTML = `
    <div class="sheet">
      <p class="kicker">Controls</p>
      <h2>Bind the heat</h2>
      <p class="fine" style="text-align:left">Enter rebinds the highlighted row. Esc ${capturing ? "cancels" : "goes back"}. Escape, Enter, and M stay reserved.</p>
      <div class="bind-list">${groups}</div>
      <button data-action="back">Back</button>
    </div>`;
  document.querySelector(".bind.selected")?.scrollIntoView({ block: "nearest" });
}

function renderPause() {
  const items = ["Resume", "Settings", "Quit to title"];
  screen.innerHTML = `
    <div class="overlay">
      <div class="card">
        <p class="kicker">Paused · seed ${sim ? sim.seed : ""}</p>
        <h2>The lava waits</h2>
        <div class="menu">
          ${items.map((label, index) => `<button data-action="pause" data-id="${index}" class="${index === menuIndex ? "selected" : ""}">${label}</button>`).join("")}
        </div>
      </div>
    </div>`;
}

function showRoundBanner() {
  const winner = sim.players[sim.roundWinnerId];
  const name = winner ? winner.name : "Nobody";
  screen.innerHTML = `
    <div class="overlay">
      <div class="card">
        <p class="kicker">Round ${sim.round}</p>
        <h2>${name} takes the rim</h2>
        <p>${winner ? `${winner.roundWins} round win${winner.roundWins === 1 ? "" : "s"}` : ""} · first to ${sim.roundsToWin}</p>
        <button class="primary" data-action="skip-round">Continue</button>
      </div>
    </div>`;
}

function showMatch() {
  const ranked = sim.players
    .filter((player) => player.enabled)
    .slice()
    .sort((a, b) => b.roundWins - a.roundWins || b.score - a.score || a.id - b.id);
  const rows = ranked.map((player) => `
    <li style="--player:${PLAYER_COLORS[player.id]}">
      <span>${player.name}${player.id === sim.matchWinnerId ? ' <span class="champ">champion</span>' : ""}</span>
      <span>${player.roundWins} wins · ${player.score} pts</span>
    </li>`).join("");
  screen.innerHTML = `
    <div class="overlay">
      <div class="card">
        <p class="kicker">Match over</p>
        <h2>${sim.players[sim.matchWinnerId]?.name || "Nobody"} wears the crown</h2>
        <ol class="standings">${rows}</ol>
        <div class="row">
          <button class="primary" data-action="rematch">Rematch</button>
          <button data-action="title">Title</button>
        </div>
      </div>
    </div>`;
}

function buildScores() {
  document.querySelector("#hud-scores").innerHTML = PLAYER_COLORS.map((color, index) => `
    <li data-player="${index}" style="--player:${color}">
      <span class="who">P${index + 1}<svg class="pad" hidden viewBox="0 0 24 16" aria-label="Gamepad connected"><rect x="1.2" y="3" width="21.6" height="10" rx="4" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="8" cy="8" r="1.4" fill="currentColor"/><circle cx="16.5" cy="8" r="1.4" fill="currentColor"/></svg></span>
      <b class="pts">0</b>
      <small class="wins"></small>
    </li>`).join("");
}

function updateHud() {
  if (!sim) return;
  document.querySelector("#hud-round").textContent = String(sim.round);
  document.querySelector("#hud-time").textContent = formatClock(sim.ticksLeft);
  sim.players.forEach((player, index) => {
    const row = document.querySelector(`#hud-scores [data-player="${index}"]`);
    if (!row) return;
    row.classList.toggle("out", !player.enabled);
    row.classList.toggle("bot", player.enabled && player.isBot);
    row.querySelector(".pts").textContent = player.enabled ? String(player.score) : "–";
    row.querySelector(".wins").textContent = player.enabled ? "●".repeat(player.roundWins) : "";
    const icon = row.querySelector(".pad");
    if (icon) icon.hidden = !(pads[index] && pads[index].connected);
  });
  const stage = lavaStage(sim.ticksLeft);
  document.querySelectorAll("#hud-lava i").forEach((pip, index) => {
    pip.classList.toggle("hot", index < stage);
  });
  if (mode === "play" && sim.tick > 0 && sim.tick % 60 === 0) {
    const bits = sim.players.filter((player) => player.enabled).map((player) => `${player.name} ${player.score}`);
    live.textContent = `Round ${sim.round}, ${formatClock(sim.ticksLeft)}. ${bits.join(", ")}.`;
  }
}

function renderWorld(now) {
  const size = canvas.clientWidth || 760;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const pixels = Math.max(1, Math.round(size * dpr));
  if (canvas.width !== pixels) {
    canvas.width = pixels;
    canvas.height = pixels;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  renderArena(ctx, { state: sim, size, now, goUntil, lavaText, lavaUntil });
}

function updateProbe() {
  const snap = sim ? snapshot(sim) : null;
  probe.dataset.mode = mode;
  probe.dataset.phase = snap ? snap.phase : "";
  probe.dataset.scores = snap ? snap.scores.join(",") : "";
  probe.dataset.levels = snap ? snap.levels.join(",") : "";
  probe.dataset.ticks = snap ? String(snap.ticksLeft) : "";
  probe.dataset.round = snap ? String(snap.round) : "";
  probe.dataset.bots = snap ? snap.bots.map((bot) => (bot ? "1" : "0")).join("") : "";
  probe.dataset.enabled = snap ? snap.enabled.map((on) => (on ? "1" : "0")).join("") : "";
  probe.dataset.countdown = snap ? String(snap.countdownTicks) : "";
}

function consumeEvents(now) {
  for (const event of sim.events) {
    if (event.type === "shove" && event.hit) audio.hit();
    else if (event.type === "hop" || event.type === "dodge") audio.hop();
    else if (event.type === "ko") audio.ko();
    else if (event.type === "bomb") audio.bomb();
    else if (event.type === "score") audio.score();
    else if (event.type === "countdown") {
      audio.countdown(event.n);
      if (event.n === 0) goUntil = now + 500;
    } else if (event.type === "round") audio.round();
    else if (event.type === "match") audio.match();
  }
  if (sim.phase === "round_end" && !bannerUntil) {
    bannerUntil = now + 2400;
    showRoundBanner();
    return;
  }
  if (sim.phase !== "playing" || sim.countdownTicks > 0) return;
  const stage = lavaStage(sim.ticksLeft);
  if (stage > lastLava && sim.tick > 1) {
    lavaText = "Lava rises";
    lavaUntil = now + 1200;
  }
  lastLava = stage;
}

function collectInputs() {
  const frame = buildFrameInputs(keys.down, bindings, pads);
  return sim.players.map((player, index) => {
    if (!player.enabled) return { ...ZERO };
    const padOwned = pads[index] && pads[index].connected;
    if (player.isBot && !padOwned) return botInput(sim, index);
    return frame[index];
  });
}

function finishRound(force, edges, padEdges, now) {
  if (!sim || sim.phase !== "round_end") return;
  const skip = force
    || edges.includes("Enter")
    || edges.includes("Escape")
    || padEdges.some((pad) => pad.action || pad.pause);
  if (!skip && now < bannerUntil) return;
  bannerUntil = 0;
  screen.innerHTML = "";
  sim.events = [];
  advance(sim);
  consumeEvents(now);
  if (sim.phase === "match_end") {
    mode = "match";
    showMatch();
  }
}

function beginMatch() {
  if (participants() < 1) return;
  const players = slots.map((slot, id) => ({
    id,
    enabled: !!(slot.joined || slot.bot),
    isBot: !slot.joined && !!slot.bot,
    name: `P${id + 1}`,
  }));
  sim = createGame({
    seed: (Date.now() >>> 0) || 1,
    roundsToWin: settings.roundsToWin,
    countdownTicks: 3 * 60,
    players,
  });
  mode = "play";
  bannerUntil = 0;
  lastLava = 0;
  lavaText = "";
  acc = 0;
  buildScores();
  screen.innerHTML = "";
  hud.hidden = false;
  audio.startTheme();
}

function openTitle() {
  mode = "title";
  sim = null;
  hud.hidden = true;
  renderTitle();
}

function armCapture(index) {
  remapIndex = index;
  keys.capture((code) => {
    if (code !== "Escape") {
      const player = Math.floor(remapIndex / BIND_FIELDS.length);
      const field = BIND_FIELDS[remapIndex % BIND_FIELDS.length];
      if (assignBinding(bindings, player, field, code)) saveBindings();
    }
    renderControls();
  });
  renderControls();
}

function nudgeSetting(dir) {
  const id = ["volume", "rounds", "mute", "controls", "back"][menuIndex];
  if (id === "volume") {
    settings.volume = Math.max(0, Math.min(1, Math.round((settings.volume + dir * 0.1) * 10) / 10));
    audio.setVolume(settings.volume);
    saveSettings();
    renderSettings();
  } else if (id === "rounds") {
    settings.roundsToWin = Math.max(1, Math.min(3, settings.roundsToWin + dir));
    saveSettings();
    renderSettings();
  }
}

function activateSetting() {
  const id = ["volume", "rounds", "mute", "controls", "back"][menuIndex];
  if (id === "mute") {
    settings.muted = audio.toggleMuted();
    saveSettings();
    renderSettings();
  } else if (id === "controls") {
    controlsBack = "settings";
    mode = "controls";
    remapIndex = 0;
    renderControls();
  } else if (id === "back") {
    onAction("back");
  } else {
    nudgeSetting(1);
  }
}

function activatePause() {
  if (menuIndex === 0) {
    mode = "play";
    screen.innerHTML = "";
    acc = 0;
  } else if (menuIndex === 1) {
    settingsBack = "pause";
    mode = "settings";
    menuIndex = 0;
    renderSettings();
  } else {
    openTitle();
  }
}

function onAction(action, data = {}) {
  audio.unlock();
  if (action === "start") {
    mode = "join";
    audio.startTheme();
    renderJoin();
  } else if (action === "title") {
    openTitle();
  } else if (action === "settings") {
    settingsBack = mode === "pause" ? "pause" : "title";
    mode = "settings";
    menuIndex = 0;
    renderSettings();
  } else if (action === "controls") {
    controlsBack = mode === "settings" ? "settings" : "title";
    mode = "controls";
    remapIndex = 0;
    renderControls();
  } else if (action === "back") {
    if (mode === "controls") mode = controlsBack;
    else if (mode === "settings") mode = settingsBack;
    else mode = "title";
    menuIndex = 0;
    if (mode === "title") renderTitle();
    else if (mode === "settings") renderSettings();
    else if (mode === "pause") renderPause();
    else if (mode === "join") renderJoin();
    else screen.innerHTML = "";
  } else if (action === "join") {
    const index = Number(data.slot);
    if (slots[index].joined) {
      slots[index].joined = false;
      slots[index].bot = true;
    } else {
      slots[index].joined = true;
    }
    renderJoin();
  } else if (action === "cycle") {
    const index = Number(data.slot);
    if (!slots[index].joined) slots[index].bot = !slots[index].bot;
    renderJoin();
  } else if (action === "begin" || action === "rematch") {
    beginMatch();
  } else if (action === "skip-round") {
    finishRound(true, [], [], performance.now());
  } else if (action === "setting") {
    menuIndex = ["volume", "rounds", "mute", "controls", "back"].indexOf(data.id);
    activateSetting();
  } else if (action === "pause") {
    menuIndex = Number(data.id);
    activatePause();
  } else if (action === "bind") {
    armCapture(Number(data.index));
  }
}

function handleMenu(edges, padEdges) {
  if (keys.isCapturing()) return;
  if (mode === "title") {
    if (edges.includes("Enter") || edges.includes("Space") || padEdges.some((pad) => pad.pause || pad.action)) onAction("start");
    else if (edges.includes("KeyS")) onAction("settings");
    else if (edges.includes("KeyC")) onAction("controls");
    return;
  }
  if (mode === "join") {
    if (edges.includes("Enter") || padEdges.some((pad) => pad.pause)) onAction("begin");
    else if (edges.includes("Escape")) onAction("title");
    padEdges.forEach((pad, index) => {
      if (pad.action) onAction("join", { slot: String(index) });
    });
    edges.forEach((code) => {
      const byAction = bindings.findIndex((binding) => binding.action === code);
      if (byAction >= 0) onAction("join", { slot: String(byAction) });
      const digit = ["Digit1", "Digit2", "Digit3", "Digit4"].indexOf(code);
      if (digit >= 0 && byAction < 0) onAction("cycle", { slot: String(digit) });
    });
    return;
  }
  if (mode === "settings") {
    if (edges.includes("Escape")) onAction("back");
    else if (edges.includes("ArrowUp")) {
      menuIndex = (menuIndex + 4) % 5;
      renderSettings();
    } else if (edges.includes("ArrowDown")) {
      menuIndex = (menuIndex + 1) % 5;
      renderSettings();
    } else if (edges.includes("ArrowLeft")) nudgeSetting(-1);
    else if (edges.includes("ArrowRight")) nudgeSetting(1);
    else if (edges.includes("Enter") || padEdges.some((pad) => pad.action || pad.pause)) activateSetting();
    return;
  }
  if (mode === "controls") {
    if (edges.includes("Escape")) onAction("back");
    else if (edges.includes("ArrowUp")) {
      remapIndex = (remapIndex + 23) % 24;
      renderControls();
    } else if (edges.includes("ArrowDown")) {
      remapIndex = (remapIndex + 1) % 24;
      renderControls();
    } else if (edges.includes("Enter")) armCapture(remapIndex);
    return;
  }
  if (mode === "pause") {
    if (edges.includes("Escape") || padEdges.some((pad) => pad.pause)) {
      menuIndex = 0;
      activatePause();
      return;
    }
    if (edges.includes("ArrowUp")) {
      menuIndex = (menuIndex + 2) % 3;
      renderPause();
    } else if (edges.includes("ArrowDown")) {
      menuIndex = (menuIndex + 1) % 3;
      renderPause();
    } else if (edges.includes("Enter") || padEdges.some((pad) => pad.action)) activatePause();
    return;
  }
  if (mode === "match") {
    if (edges.includes("Enter") || padEdges.some((pad) => pad.pause || pad.action)) onAction("rematch");
    else if (edges.includes("Escape")) onAction("title");
  }
}

function handlePlayKeys(edges, padEdges) {
  if (edges.includes("KeyM")) {
    settings.muted = audio.toggleMuted();
    saveSettings();
  }
  if (sim.phase !== "playing") return;
  if (edges.includes("Escape") || padEdges.some((pad) => pad.pause)) {
    mode = "pause";
    menuIndex = 0;
    acc = 0;
    renderPause();
  }
}

function frame(now) {
  if (!last) last = now;
  const edges = keys.edges();
  pads = pollPads();
  const padEdges = edgePads(pads);

  if (mode === "play" && sim) {
    handlePlayKeys(edges, padEdges);
    if (mode === "play" && sim.phase === "playing") {
      acc += Math.min(100, now - last);
      let guard = 0;
      while (acc >= STEP_MS && guard < 5 && mode === "play" && sim.phase === "playing") {
        acc -= STEP_MS;
        guard += 1;
        step(sim, collectInputs());
        consumeEvents(now);
      }
    } else {
      acc = 0;
    }
    finishRound(false, edges, padEdges, now);
  } else {
    acc = 0;
    handleMenu(edges, padEdges);
  }
  last = now;

  const arenaOn = sim && mode !== "title" && mode !== "join";
  if (arenaOn) {
    hud.hidden = false;
    renderWorld(now);
    updateHud();
  }
  updateProbe();
  requestAnimationFrame(frame);
}

screen.addEventListener("click", (event) => {
  const target = event.target.closest("[data-action]");
  if (!target || !screen.contains(target)) return;
  onAction(target.dataset.action, target.dataset);
});

window.addEventListener("pointerdown", () => audio.unlock());
window.addEventListener("gamepadconnected", (event) => {
  live.textContent = `Gamepad ${event.gamepad.index + 1} connected.`;
});
window.addEventListener("gamepaddisconnected", (event) => {
  live.textContent = `Gamepad ${event.gamepad.index + 1} disconnected.`;
});
window.addEventListener("error", (event) => {
  probe.dataset.error = event.message || "error";
});

window.__CALDERA__ = {
  get mode() {
    return mode;
  },
  snapshot() {
    return { mode, sim: sim ? snapshot(sim) : null };
  },
};

renderTitle();
requestAnimationFrame(frame);
