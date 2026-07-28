/**
 * Synthesized soundscape.
 *
 * Every sound is generated live with the Web Audio API — there are no audio
 * files to load. A low wind bed runs continuously; birds layer in by day and
 * crickets by night; footsteps, doors and the gate are one-shot cues triggered
 * by gameplay. Following the audio-feedback playbook: the context is created and
 * resumed only from a user gesture, a master mute is always available, one-shot
 * nodes are released on their own `ended` event, and nothing plays on the
 * ambient landing hero (no gesture, no sound).
 */

import type { TimeOfDayId } from '../timeOfDay';

const NIGHTLY = new Set<TimeOfDayId>(['evening', 'night']);

export class Soundscape {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private muted = false;
  private started = false;
  private nightly = false;
  private ambientTimer = 0;
  private nextEvent = 1.5;
  private stepCooldown = 0;

  /** Create/resume the context from a user gesture and start the ambient bed. */
  resume(): void {
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 1;
      this.master.connect(this.ctx.destination);
      this.noiseBuffer = this.makeNoise(2);
      this.startWind();
    }
    void this.ctx.resume();
    this.started = true;
  }

  get isMuted(): boolean {
    return this.muted;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(muted ? 0 : 1, this.ctx.currentTime, 0.05);
    }
  }

  setTime(id: TimeOfDayId): void {
    this.nightly = NIGHTLY.has(id);
  }

  /** Drive random ambient events (birds / crickets). Call every frame. */
  update(dt: number): void {
    if (!this.started || !this.ctx || this.muted) return;
    if (this.stepCooldown > 0) this.stepCooldown -= dt;
    this.ambientTimer += dt;
    if (this.ambientTimer >= this.nextEvent) {
      this.ambientTimer = 0;
      this.nextEvent = this.nightly ? 0.9 + Math.random() * 1.4 : 2 + Math.random() * 4;
      if (this.nightly) this.cricket();
      else this.bird();
    }
  }

  /** A footstep, rate-limited so it can be called from the movement loop. */
  footstep(): void {
    if (!this.canPlay() || this.stepCooldown > 0) return;
    this.stepCooldown = 0.28;
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 520 + Math.random() * 120;
    filter.Q.value = 0.8;
    const gain = ctx.createGain();
    const t = ctx.currentTime;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.18, t + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    src.connect(filter).connect(gain).connect(this.master!);
    src.start(t);
    src.stop(t + 0.14);
    this.release(src, gain);
  }

  door(): void {
    if (!this.canPlay()) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(60, t + 0.5);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 500;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.12, t + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
    osc.connect(filter).connect(gain).connect(this.master!);
    osc.start(t);
    osc.stop(t + 0.6);
    this.release(osc, gain);
  }

  gate(): void {
    if (!this.canPlay()) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    for (const [i, f] of [320, 470, 610].entries()) {
      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.value = f;
      const gain = ctx.createGain();
      const start = t + i * 0.015;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.05, start + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.25);
      osc.connect(gain).connect(this.master!);
      osc.start(start);
      osc.stop(start + 0.3);
      this.release(osc, gain);
    }
  }

  click(): void {
    if (!this.canPlay()) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 1250;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.06, t + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    osc.connect(gain).connect(this.master!);
    osc.start(t);
    osc.stop(t + 0.06);
    this.release(osc, gain);
  }

  dispose(): void {
    if (this.ctx) void this.ctx.close();
    this.ctx = null;
    this.master = null;
    this.started = false;
  }

  // --- internals ---------------------------------------------------------

  private canPlay(): boolean {
    return this.started && this.ctx !== null && this.master !== null && !this.muted;
  }

  private makeNoise(seconds: number): AudioBuffer {
    const ctx = this.ctx!;
    const length = Math.floor(ctx.sampleRate * seconds);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < length; i += 1) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02; // brown-ish
      data[i] = last * 3.5;
    }
    return buffer;
  }

  private startWind(): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 380;
    const gain = ctx.createGain();
    gain.gain.value = 0.05;
    // Slow breathing on the wind level.
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.08;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.02;
    lfo.connect(lfoGain).connect(gain.gain);
    src.connect(filter).connect(gain).connect(this.master!);
    src.start();
    lfo.start();
  }

  private bird(): void {
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const notes = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < notes; i += 1) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      const base = 2200 + Math.random() * 1400;
      const start = t + i * (0.06 + Math.random() * 0.05);
      osc.frequency.setValueAtTime(base, start);
      osc.frequency.exponentialRampToValueAtTime(base * 1.3, start + 0.05);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.03, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.09);
      osc.connect(gain).connect(this.master!);
      osc.start(start);
      osc.stop(start + 0.1);
      this.release(osc, gain);
    }
  }

  private cricket(): void {
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const trills = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < trills; i += 1) {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = 4200 + Math.random() * 300;
      const gain = ctx.createGain();
      const start = t + i * 0.05;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.02, start + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.03);
      osc.connect(gain).connect(this.master!);
      osc.start(start);
      osc.stop(start + 0.04);
      this.release(osc, gain);
    }
  }

  private release(node: AudioScheduledSourceNode, gain: GainNode): void {
    node.addEventListener('ended', () => {
      node.disconnect();
      gain.disconnect();
    });
  }
}
