// Kota Seja — procedural WebAudio sound.
// No audio files: every effect is synthesised from oscillators and noise,
// and the music is a West-Coast hip-hop/funk radio groove (kick, snare,
// hats, funk bass riff, synth stabs — all original, see scheduleStep).
// Round 6 (2026-11-19): the old sunset arpeggio became Radio Kota Seja
// with a MUSIK toggle (HUD button, touch button, N key); it starts on
// the player's first gesture, per the autoplay rules.
// Round 7 (2026-11-19): ONE station became THREE — Seja FM (the
// round-6 funk groove, unchanged), Seja Pop (faster, brighter) and
// Seja Malam (slow and mellow). All three are 100% procedural and
// 100% original; the scheduler reads its tables from
// CONFIG.radioStations, so a station is data, not a second copy of
// the player. N / STASIUN cycles 1 → 2 → 3 → off → 1.
import { CONFIG } from './config.js';
export function createAudio() {
  const audio = {
    ctx: null, master: null, musicGain: null, muted: false,
    musicTimer: null, nextNoteTime: 0, step: 0, started: false,
  };

  function ensure() {
    if (audio.ctx) return audio.ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    audio.ctx = new AC();
    audio.master = audio.ctx.createGain();
    audio.master.gain.value = 0.5;
    audio.master.connect(audio.ctx.destination);
    audio.musicGain = audio.ctx.createGain();
    audio.musicGain.gain.value = 0.16;
    audio.musicGain.connect(audio.master);
    return audio.ctx;
  }

  function noiseBuffer(ctx) {
    const len = ctx.sampleRate * 0.5;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  function blip(freq, dur, type, vol, slideTo) {
    const ctx = ensure();
    if (!ctx || audio.muted) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g);
    g.connect(audio.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function noise(dur, vol, filterFreq) {
    const ctx = ensure();
    if (!ctx || audio.muted) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(ctx);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(audio.master);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  audio.unlock = () => {
    const ctx = ensure();
    if (ctx && ctx.state === 'suspended') ctx.resume();
  };

  audio.shot = (weapon) => {
    if (weapon === 'shotgun') { noise(0.28, 0.5, 900); blip(120, 0.18, 'square', 0.3, 40); }
    else if (weapon === 'smg') { noise(0.09, 0.28, 2400); blip(220, 0.07, 'square', 0.16, 90); }
    else if (weapon === 'fists') { noise(0.06, 0.2, 700); }
    else { noise(0.14, 0.4, 1800); blip(180, 0.1, 'square', 0.22, 60); }
  };
  audio.reload = () => { blip(500, 0.06, 'square', 0.12); setTimeout(() => blip(700, 0.06, 'square', 0.12), 120); };
  audio.crash = (hard) => { noise(hard ? 0.5 : 0.25, hard ? 0.5 : 0.25, 500); blip(70, 0.3, 'sawtooth', 0.25, 35); };
  audio.pickup = () => { blip(660, 0.09, 'sine', 0.25); setTimeout(() => blip(990, 0.12, 'sine', 0.25), 90); };
  audio.mission = () => {
    [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => blip(f, 0.18, 'triangle', 0.25), i * 110));
  };
  audio.siren = () => { blip(750, 0.4, 'sine', 0.08, 950); };
  audio.click = () => blip(800, 0.05, 'square', 0.1);
  // Round 7 — HORN (packet 6): a two-tone car horn, two detuned
  // sawtooths (the classic "beep-beep" interval), short and loud
  // enough to hear over the radio. The world makes the pedestrians
  // ahead step aside while it sounds (see honkHorn in world.js).
  audio.horn = () => {
    const ctx = ensure();
    if (!ctx || audio.muted) return;
    const t = ctx.currentTime;
    for (const f of CONFIG.horn.freqs) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.value = f;
      g.gain.setValueAtTime(CONFIG.horn.vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + CONFIG.horn.dur);
      osc.connect(g);
      g.connect(audio.master);
      osc.start(t);
      osc.stop(t + CONFIG.horn.dur + 0.02);
    }
  };
  // Round 5: a distinct UI tap for the touch buttons (SENJATA / MISI /
  // MOBIL / PETA / JEDA) — every tap answers with a sound, even when
  // the action itself only shows a message.
  audio.ui = () => blip(880, 0.06, 'sine', 0.16);
  // Round 5: a low engine hum that follows the car's speed — the
  // cheapest speed sensation there is. One persistent oscillator, its
  // pitch and gain driven by main.js every frame; silent on foot.
  let engineOsc = null, engineGain = null;
  audio.engine = (level) => {
    const ctx = ensure();
    if (!ctx || audio.muted) { level = 0; }
    if (!ctx) return;
    if (level <= 0) {
      if (engineGain) engineGain.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
      return;
    }
    if (!engineOsc) {
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 420;
      engineOsc.connect(filter);
      filter.connect(engineGain);
      engineGain.connect(audio.master);
      engineOsc.start();
    }
    engineOsc.frequency.setTargetAtTime(58 + level * 150, ctx.currentTime, 0.08);
    engineGain.gain.setTargetAtTime(0.045 + level * 0.05, ctx.currentTime, 0.1);
  };
  audio.toggleMute = () => {
    audio.muted = !audio.muted;
    if (audio.master) audio.master.gain.value = audio.muted ? 0 : 0.5;
    return audio.muted;
  };

  // Round 7 — RADIO, THREE STATIONS: the scheduler below is the
  // same engine round 6 built (kick / snare / hats, funk bass, synth
  // stabs, pentatonic lead — all original, no samples, no licensed
  // music), but every table now comes from the current station in
  // CONFIG.radioStations: Seja FM keeps the round-6 92 BPM Am–F–C–G
  // groove byte-for-byte, Seja Pop runs 118 BPM with a brighter
  // chord set, Seja Malam is a 68 BPM night groove with a sparse
  // beat. STASIUN / N cycles 1 → 2 → 3 → off → 1 (cycleStation);
  // toggleMusic still just flips the current station on/off.
  // Default: station 1 (Seja FM) ON after the first gesture
  // (autoplay rules: the AudioContext is created/resumed on
  // pointerdown/keydown, see main.js).
  audio.musicOn = true;
  audio.station = 0;
  audio.stationName = () => CONFIG.radioStations[audio.station].name;
  audio.isMusicOn = () => audio.musicOn;
  audio.toggleMusic = () => {
    audio.musicOn = !audio.musicOn;
    if (audio.musicGain && audio.ctx) {
      audio.musicGain.gain.setTargetAtTime(audio.musicOn ? 0.16 : 0, audio.ctx.currentTime, 0.05);
    }
    return audio.musicOn;
  };
  // Switch to station i (0-based) and restart its pattern from step
  // 0, so the new groove starts clean instead of mid-bar.
  audio.setStation = (i) => {
    const n = CONFIG.radioStations.length;
    audio.station = ((i % n) + n) % n;
    audio.step = 0;
    if (audio.ctx) audio.nextNoteTime = audio.ctx.currentTime + 0.05;
    return audio.stationName();
  };
  // STASIUN / N: next station while on, off after the last one, and
  // back to station 1 when off. Returns the live state for the HUD.
  audio.cycleStation = () => {
    if (audio.musicOn && audio.station < CONFIG.radioStations.length - 1) {
      audio.setStation(audio.station + 1);
    } else if (audio.musicOn) {
      audio.musicOn = false;
      if (audio.musicGain && audio.ctx) audio.musicGain.gain.setTargetAtTime(0, audio.ctx.currentTime, 0.05);
    } else {
      audio.musicOn = true;
      audio.setStation(0);
      if (audio.musicGain && audio.ctx) audio.musicGain.gain.setTargetAtTime(0.16, audio.ctx.currentTime, 0.05);
    }
    return { name: audio.stationName(), on: audio.musicOn, station: audio.station };
  };
  function tone(freq, t, dur, type, vol, dest, slideTo) {
    const ctx = audio.ctx;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(20, freq), t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g);
    g.connect(dest || audio.musicGain);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }
  function hat(t, vol) {
    const ctx = audio.ctx;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(ctx);
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 7000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    src.connect(filter);
    filter.connect(g);
    g.connect(audio.musicGain);
    src.start(t);
    src.stop(t + 0.06);
  }
  function scheduleStep() {
    const ctx = ensure();
    if (!ctx) return;
    // Round 7: the station table drives the step — same engine, three
    // grooves. 16 steps per bar, 4 bars per loop, at the station's BPM.
    const st = CONFIG.radioStations[audio.station];
    const stepDur = 60 / st.bpm / 4;
    const stepInBar = audio.step % 16;
    const bar = Math.floor(audio.step / 16) % 4;
    const root = st.roots[bar];
    const t = audio.nextNoteTime;
    // Bar-start pad: a warm root drone under the groove.
    if (stepInBar === 0 && st.pad) tone(root / 2, t, 2.4, 'sine', 0.4, audio.musicGain);
    // Drums: punchy kick, backbeat snare, hats on every step.
    if (st.kick.includes(stepInBar)) tone(120, t, 0.16, 'sine', 0.9, audio.musicGain, 42);
    if (st.snare.includes(stepInBar)) {
      tone(190, t, 0.12, 'triangle', 0.5, audio.musicGain);
      hat(t, 0.25);
    }
    hat(t, stepInBar % 2 === 1 ? 0.22 : 0.1);
    // Funk bass: short sawtooth notes, lowpassed so they thump.
    if (stepInBar in st.bass) {
      const f = root * Math.pow(2, st.bass[stepInBar] / 12);
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      const flt = ctx.createBiquadFilter();
      osc.type = 'sawtooth';
      osc.frequency.value = f;
      flt.type = 'lowpass';
      flt.frequency.value = 520;
      g.gain.setValueAtTime(0.55, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
      osc.connect(flt);
      flt.connect(g);
      g.connect(audio.musicGain);
      osc.start(t);
      osc.stop(t + 0.24);
    }
    // Synth stabs: a minor triad on the offbeats, short and bright.
    if (st.stabs.includes(stepInBar)) {
      for (const mult of [2, 2.378, 2.996]) {
        tone(root * mult, t, 0.14, 'triangle', 0.16, audio.musicGain);
      }
    }
    // Sparse lead pluck on the station's lead steps, pentatonic.
    if (st.leadSteps.includes(stepInBar)) {
      tone(st.lead[(bar * 3 + stepInBar) % st.lead.length], t, 0.3, 'square', 0.1, audio.musicGain);
    }
    audio.step++;
    audio.nextNoteTime += stepDur;
  }

  audio.startMusic = () => {
    const ctx = ensure();
    if (!ctx || audio.started) return;
    audio.started = true;
    audio.nextNoteTime = ctx.currentTime + 0.1;
    audio.musicTimer = setInterval(() => {
      if (audio.muted || !audio.musicOn) {
        audio.nextNoteTime = Math.max(audio.nextNoteTime, ctx.currentTime + 0.05);
        return;
      }
      while (audio.nextNoteTime < ctx.currentTime + 0.3) scheduleStep();
    }, 90);
  };
  audio.stopMusic = () => {
    if (audio.musicTimer) clearInterval(audio.musicTimer);
    audio.musicTimer = null;
    audio.started = false;
  };
  return audio;
}

// Round 7 complete (2026-11-19): 3 procedural radio stations
// (Seja FM / Seja Pop / Seja Malam, cycle 1→2→3→off→1), two-tone
// horn, station state kept in sync with world.settings by main.js.
