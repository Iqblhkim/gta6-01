// Kota Seja — procedural WebAudio sound.
// No audio files: every effect is synthesised from oscillators and noise,
// and the music is a small sunset loop (warm bass, a minor-key arpeggio
// and a soft pad) scheduled on a look-ahead timer.
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
  audio.toggleMute = () => {
    audio.muted = !audio.muted;
    if (audio.master) audio.master.gain.value = audio.muted ? 0 : 0.5;
    return audio.muted;
  };

  // Music: A minor sunset loop — Am, F, C, G roots under a pentatonic arp.
  const ROOTS = [110, 87.31, 130.81, 98];
  const ARP = [220, 261.63, 329.63, 440, 329.63, 261.63];
  function scheduleStep() {
    const ctx = ensure();
    if (!ctx) return;
    const bar = Math.floor(audio.step / 8) % 4;
    const root = ROOTS[bar];
    if (audio.step % 8 === 0) {
      const t = audio.nextNoteTime;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = root / 2;
      g.gain.setValueAtTime(0.5, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 1.8);
      osc.connect(g); g.connect(audio.musicGain);
      osc.start(t); osc.stop(t + 1.9);
    }
    const note = ARP[audio.step % ARP.length];
    const t = audio.nextNoteTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = note;
    g.gain.setValueAtTime(0.35, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
    osc.connect(g); g.connect(audio.musicGain);
    osc.start(t); osc.stop(t + 0.35);
    audio.step++;
    audio.nextNoteTime += 0.24;
  }

  audio.startMusic = () => {
    const ctx = ensure();
    if (!ctx || audio.started) return;
    audio.started = true;
    audio.nextNoteTime = ctx.currentTime + 0.1;
    audio.musicTimer = setInterval(() => {
      if (audio.muted) { audio.nextNoteTime = Math.max(audio.nextNoteTime, ctx.currentTime + 0.05); return; }
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
