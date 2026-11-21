// Synthesized sound: every effect and the music are built with the
// WebAudio API, so the game ships no audio files. Everything is guarded:
// if audio cannot start, the game plays on silently.
export function createAudio() {
  const audio = {
    ctx: null,
    master: null,
    musicGain: null,
    musicTimer: 0,
    musicStep: 0,
    enabled: true,
  };

  audio.ensure = () => {
    if (audio.ctx) {
      if (audio.ctx.state === 'suspended') audio.ctx.resume().catch(() => {});
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      audio.ctx = new AC();
      audio.master = audio.ctx.createGain();
      audio.master.gain.value = 0.5;
      audio.master.connect(audio.ctx.destination);
      audio.musicGain = audio.ctx.createGain();
      audio.musicGain.gain.value = 0.16;
      audio.musicGain.connect(audio.master);
    } catch {
      audio.ctx = null;
    }
  };

  function tone(freq, dur, type, vol, when, slideTo) {
    if (!audio.ctx || !audio.master) return;
    try {
      const t0 = audio.ctx.currentTime + (when || 0);
      const osc = audio.ctx.createOscillator();
      const g = audio.ctx.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, t0);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
      g.gain.setValueAtTime(vol || 0.2, t0);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      osc.connect(g);
      g.connect(audio.master);
      osc.start(t0);
      osc.stop(t0 + dur + 0.05);
    } catch {
      // Sound is never worth crashing the game over.
    }
  }

  function noise(dur, vol, filterFreq) {
    if (!audio.ctx || !audio.master) return;
    try {
      const t0 = audio.ctx.currentTime;
      const len = Math.max(1, Math.floor(audio.ctx.sampleRate * dur));
      const buf = audio.ctx.createBuffer(1, len, audio.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = audio.ctx.createBufferSource();
      src.buffer = buf;
      const filter = audio.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = filterFreq || 1200;
      const g = audio.ctx.createGain();
      g.gain.value = vol || 0.3;
      src.connect(filter);
      filter.connect(g);
      g.connect(audio.master);
      src.start(t0);
    } catch {
      // Ignore audio failures.
    }
  }

  audio.shot = () => {
    noise(0.12, 0.5, 2800);
    tone(220, 0.08, 'square', 0.12, 0, 60);
  };
  audio.enemyShot = () => {
    noise(0.1, 0.22, 1800);
    tone(160, 0.08, 'square', 0.07, 0, 50);
  };
  audio.punch = () => {
    noise(0.09, 0.4, 500);
    tone(90, 0.1, 'sine', 0.3, 0, 45);
  };
  audio.crash = () => {
    noise(0.25, 0.5, 700);
    tone(70, 0.25, 'sawtooth', 0.2, 0, 30);
  };
  audio.explosion = () => {
    noise(0.6, 0.7, 400);
    tone(50, 0.5, 'sawtooth', 0.3, 0, 25);
  };
  audio.pickup = () => {
    tone(660, 0.1, 'sine', 0.2);
    tone(880, 0.14, 'sine', 0.2, 0.09);
  };
  audio.missionDone = () => {
    [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.22, 'triangle', 0.22, i * 0.11));
  };
  audio.wasted = () => {
    [392, 330, 262, 196].forEach((f, i) => tone(f, 0.3, 'sawtooth', 0.14, i * 0.16));
  };
  audio.siren = () => {
    tone(750, 0.35, 'sine', 0.06, 0, 950);
    tone(950, 0.35, 'sine', 0.06, 0.35, 750);
  };
  audio.click = () => tone(440, 0.05, 'square', 0.1);

  // Called on the first key press or click: browsers only allow sound
  // after a gesture, so the context is created and resumed here.
  audio.unlock = () => {
    audio.ensure();
  };
  audio.toggleMute = () => {
    audio.enabled = !audio.enabled;
  };

  // A laid-back sun-soaked bass line with a sparse melody on top.
  const bassLine = [55, 0, 55, 65.4, 55, 0, 49, 55, 55, 0, 55, 65.4, 82.4, 0, 73.4, 65.4];
  const melody = [220, 0, 262, 0, 330, 0, 262, 0, 294, 0, 330, 0, 392, 330, 294, 0];
  audio.updateMusic = (dt) => {
    if (!audio.ctx || !audio.enabled) return;
    audio.musicTimer -= dt;
    if (audio.musicTimer > 0) return;
    audio.musicTimer = 0.24;
    const i = audio.musicStep % 16;
    const bass = bassLine[i];
    const mel = melody[i];
    if (bass) {
      try {
        const t0 = audio.ctx.currentTime;
        const osc = audio.ctx.createOscillator();
        const g = audio.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = bass;
        g.gain.setValueAtTime(0.5, t0);
        g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.24);
        osc.connect(g);
        g.connect(audio.musicGain);
        osc.start(t0);
        osc.stop(t0 + 0.26);
      } catch {
        // Ignore.
      }
    }
    if (mel) tone(mel, 0.2, 'sine', 0.05);
    audio.musicStep++;
  };

  return audio;
}
