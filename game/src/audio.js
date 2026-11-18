// Procedural WebAudio sound for Solano City: no audio files, everything
// is synthesised — gunshots, impacts, pickups, a two-tone siren, and a
// looping bass-and-hat groove. Silent until the player first interacts,
// and safe when no AudioContext exists at all.

export function createAudio() {
  let ctx = null;
  let muted = false;
  let musicId = null;
  let musicStep = 0;
  let engineNodes = null;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      return ctx;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = AC ? new AC() : null;
    } catch {
      ctx = null;
    }
    return ctx;
  }

  function tone(freq, dur, type, vol, slideTo = 0) {
    const c = ensure();
    if (!c || muted) return;
    const t = c.currentTime;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo > 0) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain).connect(c.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function noise(dur, vol, lowpass = 1200) {
    const c = ensure();
    if (!c || muted) return;
    const t = c.currentTime;
    const len = Math.max(1, Math.floor(c.sampleRate * dur));
    const buffer = c.createBuffer(1, len, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource();
    src.buffer = buffer;
    const filter = c.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpass;
    const gain = c.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter).connect(gain).connect(c.destination);
    src.start(t);
  }

  // A minor-key bassline with a hat on the off-beats, stepped on a timer.
  const BASS = [55, 0, 55, 65.41, 0, 55, 49, 58.27];
  function musicTick() {
    const c = ctx;
    if (!c || muted) return;
    const step = musicStep % 8;
    musicStep += 1;
    const bass = BASS[step];
    if (bass > 0) tone(bass, 0.22, 'sawtooth', 0.055);
    if (step % 2 === 1) noise(0.03, 0.03, 6000);
    if (step === 0 || step === 4) tone(220, 0.1, 'triangle', 0.03);
  }

  return {
    unlock() {
      ensure();
    },
    setMuted(m) {
      muted = m;
      if (engineNodes) engineNodes.gain.gain.value = 0;
    },
    get muted() {
      return muted;
    },
    shoot() {
      noise(0.09, 0.22, 2400);
      tone(180, 0.08, 'square', 0.1, 60);
    },
    hit() {
      tone(320, 0.07, 'triangle', 0.12, 180);
    },
    crash() {
      noise(0.25, 0.25, 700);
      tone(90, 0.2, 'sawtooth', 0.12, 45);
    },
    pickup() {
      tone(660, 0.09, 'sine', 0.12);
      setTimeout(() => tone(990, 0.12, 'sine', 0.12), 90);
    },
    complete() {
      [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.22, 'triangle', 0.12), i * 110));
    },
    failed() {
      [392, 330, 262].forEach((f, i) => setTimeout(() => tone(f, 0.25, 'sawtooth', 0.08), i * 140));
    },
    busted() {
      tone(440, 0.5, 'sawtooth', 0.1, 220);
      tone(554, 0.5, 'sawtooth', 0.08, 277);
    },
    wasted() {
      [330, 262, 196, 131].forEach((f, i) => setTimeout(() => tone(f, 0.3, 'triangle', 0.1), i * 160));
    },
    siren() {
      tone(750, 0.35, 'sine', 0.05, 950);
      setTimeout(() => tone(950, 0.35, 'sine', 0.05, 750), 350);
    },
    startMusic() {
      if (musicId !== null) return;
      ensure();
      musicId = setInterval(musicTick, 210);
    },
    stopMusic() {
      if (musicId !== null) {
        clearInterval(musicId);
        musicId = null;
      }
    },
    // A low engine hum whose pitch follows the car's speed.
    engine(speed) {
      const c = ctx;
      if (!c || muted) {
        if (engineNodes) engineNodes.gain.gain.value = 0;
        return;
      }
      if (!engineNodes) {
        const osc = c.createOscillator();
        const gain = c.createGain();
        osc.type = 'sawtooth';
        osc.frequency.value = 50;
        gain.gain.value = 0;
        osc.connect(gain).connect(c.destination);
        osc.start();
        engineNodes = { osc, gain };
      }
      const target = speed > 20 ? 0.02 + Math.min(0.05, speed / 7000) : 0;
      engineNodes.gain.gain.setTargetAtTime(target, c.currentTime, 0.1);
      engineNodes.osc.frequency.setTargetAtTime(48 + speed * 0.16, c.currentTime, 0.1);
    },
  };
}
