import { PLAYER_COLORS, TERRACES } from "../core/constants.js";
import { crownRadius, lavaStage } from "../core/geometry.js";

const WORLD = 760;
const ROCK = ["#2a1612", "#3c221b", "#4e2d22", "#624033", "#7a5340"];
const ROCK_EDGE = ["#4a2c24", "#6a4034", "#8a5644", "#a66d52", "#c48962"];

const CRACKS = TERRACES.map((terrace, level) => {
  let seed = 1009 + level * 97;
  const next = () => {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const lines = [];
  for (let i = 0; i < 8; i++) {
    const angle = next() * Math.PI * 2;
    lines.push({
      angle,
      span: 0.18 + next() * 0.45,
      radius: terrace.inner + Math.max(8, terrace.outer - terrace.inner) * (0.25 + next() * 0.6),
    });
  }
  return lines;
});

function ring(ctx, outer, inner) {
  ctx.beginPath();
  ctx.arc(0, 0, outer, 0, Math.PI * 2);
  if (inner > 0) ctx.arc(0, 0, inner, 0, Math.PI * 2, true);
  ctx.fill("evenodd");
}

function drawMoat(ctx, now) {
  const glow = ctx.createRadialGradient(0, 0, 250, 0, 0, 390);
  const pulse = 0.55 + Math.sin(now / 280) * 0.08;
  glow.addColorStop(0, `rgba(255, 90, 16, ${pulse})`);
  glow.addColorStop(0.45, "rgba(180, 30, 8, 0.85)");
  glow.addColorStop(1, "rgba(40, 8, 4, 0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, 390, 0, Math.PI * 2);
  ctx.fill();
}

function drawTerrace(ctx, level, flooded, now) {
  const terrace = TERRACES[level];
  const inner = terrace.inner;
  const outer = terrace.outer;
  if (flooded) {
    const shift = Math.sin(now / 400 + level) * 8;
    const grad = ctx.createRadialGradient(shift, shift, inner, 0, 0, outer);
    grad.addColorStop(0, "#ffb000");
    grad.addColorStop(0.45, "#ff5a12");
    grad.addColorStop(1, "#c81e08");
    ctx.fillStyle = grad;
    ring(ctx, outer, inner);
    ctx.save();
    ctx.strokeStyle = "rgba(255, 220, 140, 0.35)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, (inner + outer) / 2, now / 800, now / 800 + 1.4);
    ctx.stroke();
    ctx.restore();
    return;
  }
  ctx.fillStyle = ROCK[level];
  ring(ctx, outer, inner);
  ctx.strokeStyle = "rgba(0, 0, 0, 0.35)";
  ctx.lineWidth = 8;
  if (inner > 0) {
    ctx.beginPath();
    ctx.arc(0, 0, inner + 3, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.strokeStyle = ROCK_EDGE[level];
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, outer - 1.5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = "rgba(255, 214, 180, 0.18)";
  ctx.lineWidth = 1.4;
  for (const crack of CRACKS[level]) {
    ctx.beginPath();
    ctx.arc(0, 0, crack.radius, crack.angle, crack.angle + crack.span);
    ctx.stroke();
  }
}

function drawCrown(ctx, state, now) {
  const radius = crownRadius(state.ticksLeft);
  const pulse = 0.75 + Math.sin(now / 180) * 0.25;
  ctx.save();
  ctx.fillStyle = `rgba(255, 196, 60, ${0.22 + pulse * 0.12})`;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = `rgba(255, 220, 110, ${0.7 + pulse * 0.3})`;
  ctx.lineWidth = 3.5;
  ctx.setLineDash([7, 6]);
  ctx.lineDashOffset = -now / 40;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawBomb(ctx, bomb, now) {
  const life = bomb.fuseTicks / 60;
  const blink = Math.sin(now / (40 + life * 40)) > 0;
  ctx.save();
  ctx.strokeStyle = blink ? "rgba(255, 70, 20, 0.95)" : "rgba(255, 190, 60, 0.7)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(bomb.x, bomb.y, bomb.radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "rgba(255, 120, 20, 0.28)";
  ctx.beginPath();
  ctx.arc(bomb.x, bomb.y, 5 + (1 - life) * 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawShape(ctx, id) {
  ctx.beginPath();
  if (id === 1) {
    ctx.moveTo(0, -15);
    ctx.lineTo(15, 0);
    ctx.lineTo(0, 15);
    ctx.lineTo(-15, 0);
  } else if (id === 2) {
    ctx.moveTo(0, -16);
    ctx.lineTo(15, 12);
    ctx.lineTo(-15, 12);
  } else if (id === 3) {
    ctx.rect(-13, -13, 26, 26);
  } else {
    ctx.arc(0, 0, 15, 0, Math.PI * 2);
  }
  ctx.fill();
  ctx.stroke();
}

function leaderId(state) {
  let best = null;
  for (const player of state.players) {
    if (!player.enabled) continue;
    if (!best || player.score > best.score) best = player;
  }
  return best && best.score > 0 ? best.id : -1;
}

function drawPlayer(ctx, state, player, now) {
  ctx.save();
  ctx.translate(player.x, player.y);
  if (player.invulnTicks > 0 && Math.floor(now / 90) % 2 === 0) ctx.globalAlpha = 0.4;
  ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
  ctx.beginPath();
  ctx.ellipse(2, 8, 14, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = PLAYER_COLORS[player.id];
  ctx.strokeStyle = "#1a0c09";
  ctx.lineWidth = 3;
  drawShape(ctx, player.id);
  ctx.strokeStyle = "#fff4e4";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(Math.cos(player.facing) * 22, Math.sin(player.facing) * 22);
  ctx.stroke();
  if (player.id === leaderId(state)) {
    ctx.fillStyle = "#f0c14a";
    ctx.beginPath();
    ctx.moveTo(-10, -16);
    ctx.lineTo(-6, -24);
    ctx.lineTo(-2, -16);
    ctx.lineTo(2, -25);
    ctx.lineTo(6, -16);
    ctx.lineTo(10, -24);
    ctx.lineTo(10, -14);
    ctx.lineTo(-10, -14);
    ctx.fill();
  }
  ctx.fillStyle = "#fff6ea";
  ctx.font = "700 13px Georgia, Palatino, serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(player.id + 1), 0, 1);
  if (player.stunTicks > 0) {
    ctx.fillStyle = "#ffe08a";
    const spin = now / 120;
    for (let i = 0; i < 3; i++) {
      const angle = spin + (i * Math.PI * 2) / 3;
      ctx.fillRect(Math.cos(angle) * 22 - 2, Math.sin(angle) * 22 - 2, 4, 4);
    }
  }
  ctx.restore();
}

function drawAsh(ctx, now) {
  ctx.fillStyle = "rgba(255, 186, 120, 0.28)";
  for (let i = 0; i < 26; i++) {
    const dir = i % 2 === 0 ? 1 : -1;
    const angle = now * 0.00012 * dir + i * 0.7;
    const radius = 40 + ((i * 53) % 330);
    ctx.beginPath();
    ctx.arc(Math.cos(angle) * radius, Math.sin(angle) * radius, 1.4 + (i % 3), 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawCallout(ctx, text) {
  ctx.save();
  ctx.fillStyle = "rgba(12, 6, 4, 0.72)";
  ctx.fillRect(-150, -168, 300, 42);
  ctx.fillStyle = "#ffb15a";
  ctx.font = "700 20px Georgia, Palatino, serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 0, -147);
  ctx.restore();
}

export function renderArena(ctx, view) {
  const { state, size, now, goUntil = 0, lavaText = "", lavaUntil = 0 } = view;
  ctx.clearRect(0, 0, size, size);
  const bg = ctx.createRadialGradient(size / 2, size / 2, 20, size / 2, size / 2, size * 0.7);
  bg.addColorStop(0, "#3a1812");
  bg.addColorStop(0.55, "#160c09");
  bg.addColorStop(1, "#090504");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, size, size);
  if (!state) return;

  const scale = size / WORLD;
  ctx.save();
  ctx.translate(size / 2, size / 2);
  ctx.scale(scale, scale);
  drawMoat(ctx, now);
  const stage = lavaStage(state.ticksLeft);
  for (let level = 0; level < TERRACES.length; level++) {
    drawTerrace(ctx, level, level < stage, now);
  }
  drawCrown(ctx, state, now);
  for (const bomb of state.bombs) drawBomb(ctx, bomb, now);
  for (const player of state.players) {
    if (player.enabled && player.alive) drawPlayer(ctx, state, player, now);
  }
  drawAsh(ctx, now);
  if (state.countdownTicks > 0) {
    const n = Math.ceil(state.countdownTicks / 60);
    ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
    ctx.beginPath();
    ctx.arc(0, 0, 58, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff4e6";
    ctx.font = "700 78px Georgia, Palatino, serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(n), 0, 4);
  } else if (now < goUntil) {
    drawCallout(ctx, "GO");
  }
  if (lavaText && now < lavaUntil) drawCallout(ctx, lavaText);
  ctx.restore();
}
