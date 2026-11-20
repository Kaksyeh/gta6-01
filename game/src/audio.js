// SOLMAR — audio.js: every sound is synthesized with WebAudio — no audio files.
// Engine hum, sirens, gunshots, crashes, pickups, UI clicks and a small procedural
// music loop (bass + pads + hats on an Am–F–C–G walk). The context is created on the
// first user gesture (main.js calls unlock()), and M mutes everything.

export function createAudio() {
  let ctx = null;
  let master = null;
  let musicGain = null;
  let engineOsc = null;
  let engineOsc2 = null;
  let engineFilter = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let noiseBuf = null;
  let muted = false;
  let musicTimer = null;
  let musicStep = 0;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.9;
      master.connect(ctx.destination);
      musicGain = ctx.createGain();
      musicGain.gain.value = 0.1;
      musicGain.connect(master);
      // Shared white-noise buffer for shots, crashes and skids.
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      // Engine: two detuned saws through a lowpass.
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 60;
      engineOsc2 = ctx.createOscillator();
      engineOsc2.type = 'square';
      engineOsc2.frequency.value = 30;
      engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 500;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineFilter);
      engineOsc2.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      engineOsc2.start();
      // Siren: a square wave whose frequency wails between two tones.
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'triangle';
      sirenOsc.frequency.value = 750;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      return true;
    } catch {
      ctx = null;
      return false;
    }
  }

  function blip(freq, dur, type, vol, slideTo) {
    if (!ctx || muted) return;
    const o = ctx.createOscillator();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, ctx.currentTime);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.connect(g);
    g.connect(master);
    o.start();
    o.stop(ctx.currentTime + dur + 0.02);
  }

  function noise(dur, vol, filterFreq, type) {
    if (!ctx || muted) return;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = type || 'lowpass';
    f.frequency.value = filterFreq || 1200;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    src.connect(f);
    f.connect(g);
    g.connect(master);
    src.start();
    src.stop(ctx.currentTime + dur + 0.02);
  }

  // Am F C G, one bar each, bass + pad + hat, stepped every 0.25 s.
  const CHORDS = [
    [110, 130.81, 164.81], // Am
    [87.31, 130.81, 174.61], // F
    [130.81, 164.81, 196.0], // C
    [98.0, 123.47, 146.83], // G
  ];
  function musicTick() {
    if (!ctx || muted) return;
    const bar = Math.floor(musicStep / 16) % 4;
    const beat = musicStep % 16;
    const chord = CHORDS[bar];
    if (beat === 0) {
      for (const f of chord) {
        const o = ctx.createOscillator();
        o.type = 'triangle';
        o.frequency.value = f;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, ctx.currentTime);
        g.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 0.4);
        g.gain.setValueAtTime(0.5, ctx.currentTime + 3.4);
        g.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 3.9);
        o.connect(g);
        g.connect(musicGain);
        o.start();
        o.stop(ctx.currentTime + 4);
      }
    }
    if (beat % 4 === 0) blip(chord[0] / 2, 0.5, 'sine', 0.5);
    if (beat % 2 === 1) noise(0.05, 0.08, 6000, 'highpass');
    musicStep++;
  }

  return {
    unlock() {
      if (ensure() && ctx.state === 'suspended') ctx.resume();
      if (ctx && !musicTimer) {
        musicTimer = setInterval(musicTick, 250);
      }
    },
    get muted() {
      return muted;
    },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.9;
      return muted;
    },
    // speed01: 0..1 of the car's top speed; on: player is driving.
    engine(speed01, on) {
      if (!ctx) return;
      const target = on ? 0.05 + speed01 * 0.06 : 0;
      engineGain.gain.setTargetAtTime(muted ? 0 : target, ctx.currentTime, 0.1);
      const f = 55 + speed01 * 130;
      engineOsc.frequency.setTargetAtTime(f, ctx.currentTime, 0.08);
      engineOsc2.frequency.setTargetAtTime(f / 2, ctx.currentTime, 0.08);
      engineFilter.frequency.setTargetAtTime(400 + speed01 * 1400, ctx.currentTime, 0.1);
    },
    // distance01: 0 = a police car is on top of the player, 1 = far away.
    siren(distance01, active) {
      if (!ctx) return;
      const target = active ? 0.05 * (1 - distance01) : 0;
      sirenGain.gain.setTargetAtTime(muted ? 0 : target, ctx.currentTime, 0.2);
      if (sirenOsc) {
        const t = ctx.currentTime;
        sirenOsc.frequency.cancelScheduledValues(t);
        sirenOsc.frequency.setValueAtTime(750, t);
        sirenOsc.frequency.linearRampToValueAtTime(980, t + 0.45);
        sirenOsc.frequency.linearRampToValueAtTime(750, t + 0.9);
      }
    },
    shot() {
      noise(0.12, 0.5, 2500);
      blip(160, 0.08, 'square', 0.25, 60);
    },
    enemyShot() {
      noise(0.1, 0.25, 2000);
    },
    punch() {
      noise(0.08, 0.4, 500);
      blip(90, 0.08, 'sine', 0.4, 50);
    },
    crash(intensity) {
      noise(0.25, 0.25 + intensity * 0.45, 900);
      blip(70, 0.2, 'sine', 0.4, 35);
    },
    explosion() {
      noise(0.7, 0.8, 500);
      blip(50, 0.6, 'sine', 0.7, 28);
    },
    pickup() {
      blip(660, 0.09, 'sine', 0.3);
      setTimeout(() => blip(990, 0.12, 'sine', 0.3), 90);
    },
    uiClick() {
      blip(520, 0.05, 'square', 0.15);
    },
    missionDone() {
      [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => blip(f, 0.22, 'triangle', 0.35), i * 110));
    },
    missionFail() {
      [392, 330, 262].forEach((f, i) => setTimeout(() => blip(f, 0.25, 'triangle', 0.3), i * 140));
    },
    horn() {
      blip(370, 0.25, 'square', 0.2);
      blip(466, 0.25, 'square', 0.15);
    },
  };
}
