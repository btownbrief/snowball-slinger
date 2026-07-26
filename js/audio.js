// SNOWBALL SLINGER — procedural Web Audio sound effects. No external assets.
// Same engine shape as the rest of the Btown Games fleet.

const LS_MUTE = 'snowball-slinger.muted';

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = localStorage.getItem(LS_MUTE) === '1';
    this._noiseBuf = null;
  }

  // Must be called from a user gesture at least once.
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.9;
      this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate;
      this._noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this._noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  setMuted(m) {
    this.muted = m;
    localStorage.setItem(LS_MUTE, m ? '1' : '0');
    if (this.master) {
      this.master.gain.cancelScheduledValues(this.ctx.currentTime);
      this.master.gain.value = m ? 0 : 0.9;
    }
  }

  get t() { return this.ctx.currentTime; }
  ready() { return !!this.ctx && !this.muted; }

  _noise(dur, { type = 'lowpass', freq = 1000, q = 1, gain = 0.5, sweepTo = null, attack = 0.002, delay = 0 } = {}) {
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuf;
    src.loop = true;
    const start = this.t + delay;
    const f = this.ctx.createBiquadFilter();
    f.type = type; f.frequency.setValueAtTime(freq, start); f.Q.value = q;
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, start + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(gain, start + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(start, Math.random());
    src.stop(start + dur + 0.05);
  }

  _tone(freq, dur, { type = 'sine', gain = 0.3, slideTo = null, attack = 0.003, delay = 0 } = {}) {
    const o = this.ctx.createOscillator();
    o.type = type;
    const start = this.t + delay;
    o.frequency.setValueAtTime(freq, start);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), start + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(gain, start + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    o.connect(g).connect(this.master);
    o.start(start);
    o.stop(start + dur + 0.05);
  }

  // Pulling the band back: rubbery creak.
  stretch() {
    if (!this.ready()) return;
    this._tone(140, 0.22, { type: 'sawtooth', gain: 0.05, slideTo: 210 });
    this._noise(0.18, { type: 'bandpass', freq: 500, q: 3, gain: 0.05, sweepTo: 800 });
  }

  // Release: elastic twang + airy whoosh, pitched by shot power (0..1).
  fling(power = 1) {
    if (!this.ready()) return;
    this._tone(180 + 120 * power, 0.12, { type: 'triangle', gain: 0.22, slideTo: 60 });
    this._noise(0.28, { type: 'bandpass', freq: 900, q: 0.8, gain: 0.2, sweepTo: 2800 + 1200 * power });
  }

  // Snow block crumbling: soft crunchy thump.
  crunch() {
    if (!this.ready()) return;
    const v = 0.9 + Math.random() * 0.2;
    this._noise(0.22, { type: 'lowpass', freq: 1400 * v, gain: 0.4, sweepTo: 250 });
    this._tone(120 * v, 0.14, { type: 'sine', gain: 0.2, slideTo: 55 });
  }

  // Ice shattering: bright glassy snap.
  shatter() {
    if (!this.ready()) return;
    this._noise(0.3, { type: 'highpass', freq: 2400, gain: 0.3, sweepTo: 5200, q: 1.5 });
    for (let i = 0; i < 3; i++) {
      this._tone(1900 + Math.random() * 1600, 0.1, { type: 'sine', gain: 0.08, delay: i * 0.035, slideTo: 900 });
    }
  }

  // Wood knock: hollow thunk.
  thunk() {
    if (!this.ready()) return;
    this._tone(170, 0.12, { type: 'square', gain: 0.2, slideTo: 75 });
    this._noise(0.08, { type: 'lowpass', freq: 900, gain: 0.26 });
  }

  // Slushball detonating: big wet splat.
  splat() {
    if (!this.ready()) return;
    this._noise(0.4, { type: 'lowpass', freq: 1800, gain: 0.5, sweepTo: 220 });
    this._tone(190, 0.3, { type: 'sine', gain: 0.22, slideTo: 50 });
    for (let i = 0; i < 4; i++) {
      this._tone(600 + Math.random() * 700, 0.06, { type: 'sine', gain: 0.05, delay: 0.1 + i * 0.05, slideTo: 300 });
    }
  }

  // The satisfied squirrel-thud: springy cartoon boing + squeak.
  bonk() {
    if (!this.ready()) return;
    const v = 0.92 + Math.random() * 0.16;
    this._tone(240 * v, 0.28, { type: 'triangle', gain: 0.24, slideTo: 640 * v });
    this._tone(1300 * v, 0.12, { type: 'sine', gain: 0.1, delay: 0.1, slideTo: 1900 * v });
    this._noise(0.06, { type: 'lowpass', freq: 700, gain: 0.24 });
  }

  // Candy reclaimed: little chime.
  sparkle() {
    if (!this.ready()) return;
    this._tone(1567, 0.14, { type: 'sine', gain: 0.08, attack: 0.001 });
    this._tone(2093, 0.22, { type: 'sine', gain: 0.07, delay: 0.06, attack: 0.001 });
  }

  // Level cleared: maple fanfare.
  fanfare(stars = 3) {
    if (!this.ready()) return;
    const notes = [523.25, 659.25, 783.99, 1046.5].slice(0, 1 + stars);
    notes.forEach((f, i) => this._tone(f, 0.3, { type: 'triangle', gain: 0.13, delay: i * 0.1 }));
    this._noise(0.5, { type: 'highpass', freq: 5000, gain: 0.05, delay: 0.3 });
  }

  // Out of snowballs: sad slide.
  lose() {
    if (!this.ready()) return;
    this._tone(392, 0.5, { type: 'triangle', gain: 0.11, slideTo: 180, delay: 0.05 });
  }

  // UI select blip.
  blip() {
    if (!this.ready()) return;
    this._tone(660, 0.08, { type: 'square', gain: 0.07, slideTo: 990 });
  }
}

export const sound = new SoundEngine();
