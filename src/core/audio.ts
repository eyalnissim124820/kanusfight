import type { SfxName } from '../game/types';

/**
 * Tiny synthesized sound engine (WebAudio). No audio files are needed; every effect is
 * generated from oscillators and noise. Replace `play` with sample playback later if you want.
 */
export class Audio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private musicTimer: number | null = null;
  private musicStep = 0;
  private nextNoteTime = 0;
  muted = false;
  musicOn = true;

  /** Must be called from a user gesture (browser autoplay rules). */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
    const len = this.ctx.sampleRate;
    this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
  }

  private tone(type: OscillatorType, f0: number, f1: number, dur: number, vol: number, when = 0) {
    const c = this.ctx!, t = c.currentTime + when;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master!);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private burst(dur: number, vol: number, filter: BiquadFilterType, f0: number, f1: number, when = 0) {
    const c = this.ctx!, t = c.currentTime + when;
    const s = c.createBufferSource(), g = c.createGain(), fl = c.createBiquadFilter();
    s.buffer = this.noise;
    fl.type = filter;
    fl.frequency.setValueAtTime(f0, t);
    fl.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(fl).connect(g).connect(this.master!);
    s.start(t, Math.random() * 0.5);
    s.stop(t + dur + 0.02);
  }

  play(name: SfxName) {
    if (!this.ctx || this.muted) return;
    switch (name) {
      case 'whoosh': this.burst(0.12, 0.25, 'bandpass', 900, 2400); break;
      case 'whooshHeavy': this.burst(0.2, 0.35, 'bandpass', 500, 1800); break;
      case 'hitLight': this.burst(0.08, 0.6, 'lowpass', 2500, 400); this.tone('square', 220, 90, 0.07, 0.15); break;
      case 'hitHeavy': this.burst(0.16, 0.8, 'lowpass', 1800, 200); this.tone('sine', 140, 40, 0.2, 0.6); break;
      case 'block': this.tone('square', 900, 600, 0.05, 0.12); this.burst(0.05, 0.3, 'highpass', 3000, 2000); break;
      case 'projectile': this.tone('sawtooth', 200, 900, 0.3, 0.18); this.burst(0.3, 0.2, 'bandpass', 600, 3000); break;
      case 'teleport': this.tone('sine', 1200, 200, 0.35, 0.2); this.tone('triangle', 300, 1500, 0.35, 0.12); break;
      case 'land': this.burst(0.06, 0.25, 'lowpass', 600, 100); break;
      case 'thud': this.burst(0.25, 0.7, 'lowpass', 800, 60); this.tone('sine', 90, 30, 0.3, 0.6); break;
      case 'quake': this.burst(0.6, 0.9, 'lowpass', 400, 40); this.tone('sine', 60, 25, 0.6, 0.8); break;
      case 'throw': this.burst(0.3, 0.4, 'bandpass', 400, 1200); break;
      case 'select': this.tone('square', 660, 660, 0.05, 0.1); break;
      case 'confirm': this.tone('square', 440, 880, 0.15, 0.15); this.tone('square', 660, 1320, 0.15, 0.1, 0.08); break;
      case 'shatter':
        for (let i = 0; i < 6; i++) this.burst(0.25, 0.5, 'highpass', 4000 - i * 400, 800, i * 0.05);
        this.tone('sine', 120, 30, 0.6, 0.6);
        break;
      case 'vaporize': this.burst(1.2, 0.5, 'bandpass', 300, 4000); this.tone('sine', 400, 60, 1.2, 0.3); break;
      case 'bell': this.tone('triangle', 520, 515, 1.2, 0.35); this.tone('sine', 1040, 1030, 0.9, 0.15); break;
    }
  }

  // ---- background music: a small procedural loop ----
  startMusic() {
    if (!this.ctx || this.musicTimer !== null || !this.musicOn) return;
    this.musicStep = 0;
    this.nextNoteTime = this.ctx.currentTime + 0.1;
    this.musicTimer = window.setInterval(() => this.scheduleMusic(), 50);
  }

  stopMusic() {
    if (this.musicTimer !== null) window.clearInterval(this.musicTimer);
    this.musicTimer = null;
  }

  toggleMusic() {
    this.musicOn = !this.musicOn;
    if (!this.musicOn) this.stopMusic();
    else this.startMusic();
  }

  private scheduleMusic() {
    const c = this.ctx;
    if (!c || this.muted) { if (c) this.nextNoteTime = c.currentTime + 0.1; return; }
    const stepDur = 60 / 132 / 4; // 16th notes at 132 bpm
    // A minor riff (scale degrees in semitones from A2)
    const bass = [0, 0, 12, 0, 3, 0, 12, 0, 5, 5, 17, 5, 3, 3, 15, 2];
    const prog = [0, 0, -4, -2]; // chord shift per bar
    while (this.nextNoteTime < c.currentTime + 0.2) {
      const s = this.musicStep % 16, bar = Math.floor(this.musicStep / 16) % 4;
      const when = this.nextNoteTime - c.currentTime;
      const semi = bass[s] + prog[bar];
      const f = 110 * Math.pow(2, semi / 12);
      this.tone('sawtooth', f, f * 0.98, stepDur * 0.9, 0.05, when);
      if (s % 4 === 0) this.tone('sine', 120, 40, 0.15, 0.35, when); // kick
      if (s % 8 === 4) this.burst(0.12, 0.18, 'highpass', 1500, 800, when); // snare
      if (s % 2 === 1) this.burst(0.03, 0.05, 'highpass', 7000, 6000, when); // hat
      this.nextNoteTime += stepDur;
      this.musicStep++;
    }
  }
}
