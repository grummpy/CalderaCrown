const THEME = [110, 130.81, 146.83, 164.81, 196, 164.81, 146.83, 130.81, 98, 130.81, 146.83, 174.61];

export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = false;
  let volume = 0.7;
  let failed = false;
  let themeTimer = null;
  let themeStep = 0;
  let started = false;

  function context() {
    if (failed) return null;
    try {
      if (!ctx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) {
          failed = true;
          return null;
        }
        ctx = new AudioCtx();
        master = ctx.createGain();
        master.gain.value = muted ? 0 : volume;
        master.connect(ctx.destination);
      }
      return ctx;
    } catch {
      failed = true;
      return null;
    }
  }

  function env(duration, peak) {
    const gain = ctx.createGain();
    gain.connect(master);
    const t = ctx.currentTime;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    return gain;
  }

  function tone(freq, duration, type, peak) {
    const audio = context();
    if (!audio || muted) return;
    const osc = audio.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audio.currentTime);
    osc.connect(env(duration, peak));
    osc.start();
    osc.stop(audio.currentTime + duration + 0.03);
  }

  function noise(duration, peak, freq = 900) {
    const audio = context();
    if (!audio || muted) return;
    const length = Math.max(1, Math.floor(audio.sampleRate * duration));
    const buffer = audio.createBuffer(1, length, audio.sampleRate);
    const data = buffer.getChannelData(0);
    let seed = (Math.floor(audio.currentTime * 1000) + length) >>> 0 || 1;
    for (let i = 0; i < length; i++) {
      seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
      data[i] = (seed / 4294967296) * 2 - 1;
    }
    const source = audio.createBufferSource();
    source.buffer = buffer;
    const filter = audio.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = freq;
    source.connect(filter);
    filter.connect(env(duration, peak));
    source.start();
  }

  function scheduleTheme() {
    const audio = context();
    if (!audio) return;
    if (!muted) {
      const freq = THEME[themeStep % THEME.length];
      themeStep += 1;
      tone(freq, 0.18, "triangle", 0.045);
      tone(freq / 2, 0.22, "sine", 0.03);
      if (themeStep % 4 === 0) noise(0.05, 0.02, 240);
    }
    themeTimer = window.setTimeout(scheduleTheme, 240);
  }

  return {
    get muted() {
      return muted;
    },
    unlock() {
      const audio = context();
      if (audio && audio.state === "suspended") audio.resume();
    },
    setVolume(value) {
      volume = Math.max(0, Math.min(1, value));
      if (master && !muted) master.gain.value = volume;
    },
    setMuted(value) {
      muted = !!value;
      if (master) master.gain.value = muted ? 0 : volume;
      if (!muted && started && !themeTimer) scheduleTheme();
    },
    toggleMuted() {
      this.setMuted(!muted);
      return muted;
    },
    startTheme() {
      started = true;
      this.unlock();
      if (themeTimer) return;
      themeStep = 0;
      scheduleTheme();
    },
    stopTheme() {
      started = false;
      if (themeTimer) window.clearTimeout(themeTimer);
      themeTimer = null;
    },
    hit() {
      tone(160, 0.09, "square", 0.08);
      noise(0.08, 0.07, 500);
    },
    hop() {
      tone(440, 0.07, "square", 0.05);
      tone(660, 0.08, "square", 0.04);
    },
    ko() {
      tone(220, 0.22, "sawtooth", 0.08);
      tone(90, 0.32, "square", 0.07);
    },
    bomb() {
      noise(0.28, 0.12, 280);
      tone(70, 0.3, "sawtooth", 0.08);
    },
    score() {
      tone(880, 0.07, "square", 0.045);
    },
    countdown(n) {
      tone(n === 0 ? 698 : 440, 0.12, "square", 0.07);
    },
    round() {
      [523, 659, 784, 1046].forEach((freq, index) => {
        window.setTimeout(() => tone(freq, 0.18, "triangle", 0.07), index * 110);
      });
    },
    match() {
      [392, 523, 659, 784, 1046].forEach((freq, index) => {
        window.setTimeout(() => tone(freq, 0.22, "triangle", 0.08), index * 130);
      });
    },
  };
}
