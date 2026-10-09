/**
 * Procedural Web Audio Sound Engine for SALTWATER.
 * Synthesizes dynamic jungle music, ambient wildlife, and visceral physical SFX.
 * Fully offline, zero external asset downloads.
 */

export class JungleAudio {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private underwaterFilter: BiquadFilterNode | null = null;
  private ambientNoiseGain: GainNode | null = null;
  private cicadaGain: GainNode | null = null;

  private isMuted = false;
  private isRunning = false;
  private tempo = 84; // BPM
  private step = 0;
  private nextNoteTime = 0;
  private timerId: number | null = null;

  // Music state: 'calm' | 'night' | 'stalk' | 'hunt' | 'combat' | 'roll' | 'bask'
  private state: 'calm' | 'night' | 'stalk' | 'hunt' | 'combat' | 'roll' | 'bask' = 'calm';
  private underwater = false;

  // D minor pentatonic scale frequencies (D3, F3, G3, A3, C4, D4, F4, A4)
  private readonly scale = [146.83, 174.61, 196.0, 220.0, 261.63, 293.66, 349.23, 440.0];

  init() {
    if (this.ctx || typeof window === 'undefined') return;
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    try {
      this.ctx = new AudioCtx();
      const ctx = this.ctx;

      // Master output chain with underwater biquad low-pass filter
      this.masterGain = ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.85, ctx.currentTime);

      this.underwaterFilter = ctx.createBiquadFilter();
      this.underwaterFilter.type = 'lowpass';
      this.underwaterFilter.frequency.setValueAtTime(20000, ctx.currentTime);
      this.underwaterFilter.Q.setValueAtTime(1, ctx.currentTime);

      // Sub-buses
      this.musicGain = ctx.createGain();
      this.musicGain.gain.setValueAtTime(0.42, ctx.currentTime);

      this.sfxGain = ctx.createGain();
      this.sfxGain.gain.setValueAtTime(0.65, ctx.currentTime);

      this.musicGain.connect(this.underwaterFilter);
      this.sfxGain.connect(this.underwaterFilter);
      this.underwaterFilter.connect(this.masterGain);
      this.masterGain.connect(ctx.destination);

      this.setupAmbience();
      this.startMusicLoop();
    } catch (e) {
      console.warn('Web Audio initialization error:', e);
    }
  }

  resume(): Promise<void> {
    if (this.ctx && this.ctx.state === 'suspended') {
      return this.ctx.resume();
    }
    return Promise.resolve();
  }

  setMuted(muted: boolean) {
    this.isMuted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(muted ? 0 : 0.85, this.ctx.currentTime, 0.05);
    }
  }

  setUnderwater(submerged: boolean) {
    this.underwater = submerged;
    if (!this.underwaterFilter || !this.ctx) return;
    const targetFreq = submerged ? 320 : 20000;
    this.underwaterFilter.frequency.setTargetAtTime(targetFreq, this.ctx.currentTime, 0.15);
  }

  setIntensity(state: 'calm' | 'night' | 'stalk' | 'hunt' | 'combat' | 'roll' | 'bask') {
    if (this.state === state) return;
    this.state = state;
    // Adapt tempo dynamically to situation
    if (state === 'combat') this.tempo = 112;
    else if (state === 'roll') this.tempo = 104;
    else if (state === 'hunt') this.tempo = 96;
    else if (state === 'stalk') this.tempo = 72;
    else if (state === 'night') this.tempo = 68;
    else if (state === 'bask') this.tempo = 60;
    else this.tempo = 84;
  }

  // --- AMBIENCE GENERATION (River Wind + Rainforest Cicadas) ---
  private setupAmbience() {
    if (!this.ctx || !this.musicGain) return;
    const ctx = this.ctx;

    // 1. River/Wetland Brown-ish Wind Noise
    const bufSize = ctx.sampleRate * 3;
    const buffer = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < bufSize; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.025 * white) / 1.025;
      data[i] = last * 2.8;
    }
    const noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = buffer;
    noiseSrc.loop = true;

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.value = 540;

    this.ambientNoiseGain = ctx.createGain();
    this.ambientNoiseGain.gain.value = 0.14;

    noiseSrc.connect(noiseFilter);
    noiseFilter.connect(this.ambientNoiseGain);
    this.ambientNoiseGain.connect(this.musicGain);
    noiseSrc.start();

    // 2. High-frequency Rainforest Cicadas / Frogs
    const cicadaBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const cData = cicadaBuf.getChannelData(0);
    for (let i = 0; i < cData.length; i++) {
      cData[i] = (Math.random() * 2 - 1) * Math.sin(i * 0.04);
    }
    const cicadaSrc = ctx.createBufferSource();
    cicadaSrc.buffer = cicadaBuf;
    cicadaSrc.loop = true;

    const cicadaFilter = ctx.createBiquadFilter();
    cicadaFilter.type = 'bandpass';
    cicadaFilter.frequency.value = 5200;
    cicadaFilter.Q.value = 5;

    this.cicadaGain = ctx.createGain();
    this.cicadaGain.gain.value = 0.035;

    cicadaSrc.connect(cicadaFilter);
    cicadaFilter.connect(this.cicadaGain);
    this.cicadaGain.connect(this.musicGain);
    cicadaSrc.start();
  }

  // --- JUNGLE MUSIC SEQUENCER ---
  private startMusicLoop() {
    if (!this.ctx) return;
    this.isRunning = true;
    this.nextNoteTime = this.ctx.currentTime + 0.1;
    this.step = 0;

    const schedule = () => {
      if (!this.isRunning || !this.ctx) return;
      while (this.nextNoteTime < this.ctx.currentTime + 0.2) {
        this.playStep(this.step, this.nextNoteTime);
        const secondsPerBeat = 60.0 / this.tempo;
        this.nextNoteTime += 0.25 * secondsPerBeat; // 16th notes
        this.step = (this.step + 1) % 32;
      }
      this.timerId = window.setTimeout(schedule, 45);
    };
    schedule();
  }

  private playStep(step: number, time: number) {
    if (!this.ctx || !this.musicGain) return;

    const isCombat = this.state === 'combat';
    const isRoll = this.state === 'roll';
    const isHunt = this.state === 'hunt';
    const isStalk = this.state === 'stalk';
    const isNight = this.state === 'night';
    const isBask = this.state === 'bask';

    // 1. Tribal Log Drum / Deep Tom (on downbeats & dynamic accents)
    if (isCombat) {
      // Rapid battle war-drums with high urgency
      if (step % 2 === 0) this.playLogDrum(time, 95, 0.3);
      if (step === 3 || step === 7 || step === 11 || step === 15 || step === 19 || step === 23 || step === 27 || step === 31) {
        this.playLogDrum(time, 140, 0.24);
      }
      if (step === 0 || step === 16) {
        this.playWarHorn(time, 65, 0.22);
      }
    } else if (isRoll) {
      if (step % 2 === 0) this.playLogDrum(time, 85, 0.28);
      if (step % 4 === 3) this.playLogDrum(time, 130, 0.22);
    } else if (isHunt) {
      if (step % 4 === 0) this.playLogDrum(time, 90, 0.25);
      if (step === 10 || step === 26) this.playLogDrum(time, 115, 0.18);
    } else if (isStalk) {
      // Subdued tension pulse
      if (step % 8 === 0) this.playLogDrum(time, 65, 0.18);
    } else if (isNight) {
      // Rare deep nighttime river thud
      if (step === 0) this.playLogDrum(time, 60, 0.14);
      if (step === 16) this.playLogDrum(time, 75, 0.1);
    } else if (isBask) {
      // Minimal heartbeat pulse while resting
      if (step === 0) this.playLogDrum(time, 55, 0.1);
    } else {
      // Calm exploration beat
      if (step === 0 || step === 14) this.playLogDrum(time, 85, 0.18);
      if (step === 20) this.playLogDrum(time, 105, 0.14);
    }

    // 2. Bamboo / Woodblock Percussion
    if (isCombat) {
      if (step % 2 === 1) this.playWoodblock(time, 960 + (step % 4) * 80, 0.18);
    } else if (isRoll) {
      if (step % 2 === 1) this.playWoodblock(time, 920, 0.16);
    } else if (!isStalk && !isNight && !isBask && (step === 4 || step === 12 || step === 18 || step === 28)) {
      this.playWoodblock(time, 780 + (step % 3) * 120, 0.1);
    } else if (isNight && (step === 8 || step === 24)) {
      this.playWoodblock(time, 640, 0.06);
    }

    // 3. Shaker / Leaf Rustle
    if (!isStalk && (isCombat ? true : step % 2 === 0)) {
      this.playShaker(time, isCombat ? 0.09 : isRoll ? 0.08 : isNight ? 0.02 : 0.035);
    }

    // 4. Melodic Kalimba / Marimba (Dorian / Minor Pentatonic)
    if (!isRoll && !isCombat && !isStalk) {
      // Atmospheric melodic notes on selected steps
      const melodySteps = isNight ? [0, 8, 16, 24] : isBask ? [0, 4, 12, 16, 20, 28] : [0, 6, 12, 16, 22, 26];
      if (melodySteps.includes(step) && Math.random() > (isNight ? 0.4 : 0.15)) {
        const noteIdx = Math.floor(Math.random() * this.scale.length);
        const freq = this.scale[noteIdx] * (isNight ? 0.5 : 1);
        this.playKalimba(time, freq, isBask ? 0.11 : isNight ? 0.1 : 0.14);
      }
    } else if (isStalk && step === 0 && Math.random() > 0.4) {
      // Sparse low drone note in stalking mode
      this.playKalimba(time, this.scale[0] * 0.5, 0.12);
    }
  }

  // --- SYNTHESIZED INSTRUMENTS ---
  private playWarHorn(time: number, freq: number, gain: number) {
    if (!this.ctx || !this.musicGain) return;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const g = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, time);
    osc.frequency.linearRampToValueAtTime(freq * 1.1, time + 0.3);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.85, time + 0.6);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(320, time);
    filter.Q.value = 3;

    g.gain.setValueAtTime(gain, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.65);

    osc.connect(filter);
    filter.connect(g);
    g.connect(this.musicGain);
    osc.start(time);
    osc.stop(time + 0.7);
  }

  private playLogDrum(time: number, startFreq: number, gain: number) {
    if (!this.ctx || !this.musicGain) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();

    osc.frequency.setValueAtTime(startFreq * 1.5, time);
    osc.frequency.exponentialRampToValueAtTime(45, time + 0.16);

    g.gain.setValueAtTime(gain, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.18);

    osc.connect(g);
    g.connect(this.musicGain);
    osc.start(time);
    osc.stop(time + 0.2);
  }

  private playWoodblock(time: number, freq: number, gain: number) {
    if (!this.ctx || !this.musicGain) return;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const g = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, time);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(freq, time);
    filter.Q.value = 6;

    g.gain.setValueAtTime(gain, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.08);

    osc.connect(filter);
    filter.connect(g);
    g.connect(this.musicGain);
    osc.start(time);
    osc.stop(time + 0.09);
  }

  private playShaker(time: number, gain: number) {
    if (!this.ctx || !this.musicGain) return;
    const bufferSize = this.ctx.sampleRate * 0.05;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(4000, time);

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, time);
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.045);

    noise.connect(filter);
    filter.connect(g);
    g.connect(this.musicGain);
    noise.start(time);
  }

  private playKalimba(time: number, freq: number, gain: number) {
    if (!this.ctx || !this.musicGain) return;
    const osc = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const g = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, time);

    // Subtle metallic overtone
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(freq * 2.76, time);

    g.gain.setValueAtTime(gain, time);
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.65);

    osc.connect(g);
    osc2.connect(g);
    g.connect(this.musicGain);
    osc.start(time);
    osc2.start(time);
    osc.stop(time + 0.7);
    osc2.stop(time + 0.7);
  }

  // --- VISCERAL SOUND EFFECTS (SFX) ---

  /** Violent snap with bone crunch and water slap */
  playBite() {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    // 1. Jaw impact snap (sharp click)
    const snap = ctx.createOscillator();
    const snapGain = ctx.createGain();
    snap.type = 'triangle';
    snap.frequency.setValueAtTime(750, now);
    snap.frequency.exponentialRampToValueAtTime(80, now + 0.12);
    snapGain.gain.setValueAtTime(0.65, now);
    snapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    snap.connect(snapGain);
    snapGain.connect(this.sfxGain);
    snap.start(now);
    snap.stop(now + 0.15);

    // 2. Bone crunch / teeth collision noise
    const bufSize = Math.floor(ctx.sampleRate * 0.15);
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.035));
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1400, now);
    filter.Q.value = 3;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.5, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.sfxGain);
    noise.start(now);
  }

  /** Churning water vortex, foam turbulence, and heavy rotational roll thrash */
  playRollThrash() {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    // Low rotational sub rumble
    const sub = ctx.createOscillator();
    const subGain = ctx.createGain();
    sub.type = 'sawtooth';
    sub.frequency.setValueAtTime(45, now);
    sub.frequency.linearRampToValueAtTime(72, now + 0.35);
    sub.frequency.linearRampToValueAtTime(38, now + 0.7);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 180;

    subGain.gain.setValueAtTime(0.5, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.75);

    sub.connect(filter);
    filter.connect(subGain);
    subGain.connect(this.sfxGain);
    sub.start(now);
    sub.stop(now + 0.8);

    // Water thrash turbulence
    const bufSize = Math.floor(ctx.sampleRate * 0.6);
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.sin(i * 0.015);
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    const nFilter = ctx.createBiquadFilter();
    nFilter.type = 'lowpass';
    nFilter.frequency.setValueAtTime(650, now);
    nFilter.frequency.exponentialRampToValueAtTime(240, now + 0.6);

    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(0.42, now);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

    noise.connect(nFilter);
    nFilter.connect(nGain);
    nGain.connect(this.sfxGain);
    noise.start(now);
  }

  /** Wet tearing and feeding gulp */
  playFeed() {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(190, now);
    osc.frequency.exponentialRampToValueAtTime(95, now + 0.28);
    g.gain.setValueAtTime(0.4, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.32);
  }

  /** Buffalo distress roar/grunt when grabbed */
  playBuffaloGrunt() {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(115, now);
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.45);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(340, now);
    filter.Q.value = 4;

    g.gain.setValueAtTime(0.48, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

    osc.connect(filter);
    filter.connect(g);
    g.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.55);
  }

  /** Water splash when bursting, lunging, or swimming fast */
  playSplash() {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    const bufSize = Math.floor(ctx.sampleRate * 0.25);
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufSize);
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buf;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(800, now);
    filter.Q.value = 2;

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.35, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    noise.connect(filter);
    filter.connect(g);
    g.connect(this.sfxGain);
    noise.start(now);
  }

  /** Gentle sun-warmed resonant tone when basking on the riverbank */
  playBaskWarmth() {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    [220, 277.18, 329.63].forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, now + idx * 0.06);
      g.gain.setValueAtTime(0.08, now + idx * 0.06);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
      osc.connect(g);
      g.connect(this.sfxGain!);
      osc.start(now + idx * 0.06);
      osc.stop(now + 0.95);
    });
  }

  /** Infrasonic bull crocodile roar / territorial water-dance rumble */
  playCrocRoar() {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    // Sub-bass chest rumble (42Hz -> 58Hz -> 38Hz)
    const subOsc = ctx.createOscillator();
    const subGain = ctx.createGain();
    subOsc.type = 'sawtooth';
    subOsc.frequency.setValueAtTime(42, now);
    subOsc.frequency.linearRampToValueAtTime(58, now + 0.35);
    subOsc.frequency.exponentialRampToValueAtTime(36, now + 1.1);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(120, now);
    filter.Q.setValueAtTime(4, now);

    subGain.gain.setValueAtTime(0.01, now);
    subGain.gain.linearRampToValueAtTime(0.65, now + 0.25);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

    subOsc.connect(filter);
    filter.connect(subGain);
    subGain.connect(this.sfxGain);
    subOsc.start(now);
    subOsc.stop(now + 1.25);

    // Threatening hiss / water displacement noise
    const bufSize = Math.floor(ctx.sampleRate * 0.8);
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * 0.4;
    const hiss = ctx.createBufferSource();
    hiss.buffer = buf;
    const hFilter = ctx.createBiquadFilter();
    hFilter.type = 'bandpass';
    hFilter.frequency.setValueAtTime(420, now);
    hFilter.Q.setValueAtTime(2.5, now);
    const hGain = ctx.createGain();
    hGain.gain.setValueAtTime(0.01, now);
    hGain.gain.linearRampToValueAtTime(0.3, now + 0.2);
    hGain.gain.exponentialRampToValueAtTime(0.001, now + 0.85);
    hiss.connect(hFilter);
    hFilter.connect(hGain);
    hGain.connect(this.sfxGain);
    hiss.start(now);
  }

  /** Deep hippo territorial bellow */
  playHippoGrunt() {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(85, now);
    osc.frequency.linearRampToValueAtTime(62, now + 0.4);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(220, now);

    g.gain.setValueAtTime(0.55, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.65);

    osc.connect(filter);
    filter.connect(g);
    g.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.7);
  }

  /** Shark sudden water whip / tail thrash */
  playSharkThrash() {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    const bufSize = Math.floor(ctx.sampleRate * 0.35);
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * Math.cos((i / bufSize) * Math.PI * 0.5);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(550, now);
    filter.frequency.exponentialRampToValueAtTime(180, now + 0.35);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.48, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    src.connect(filter);
    filter.connect(g);
    g.connect(this.sfxGain);
    src.start(now);
  }

  /** High delicate chirps from teeth-cleaning Egyptian plover */
  playPloverChirp() {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    [1950, 2350].forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, now + idx * 0.08);
      osc.frequency.exponentialRampToValueAtTime(f * 1.15, now + idx * 0.08 + 0.04);
      g.gain.setValueAtTime(0.12, now + idx * 0.08);
      g.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.06);
      osc.connect(g);
      g.connect(this.sfxGain!);
      osc.start(now + idx * 0.08);
      osc.stop(now + idx * 0.08 + 0.07);
    });
  }

  /** Explosive bite lunge rush */
  playBiteLunge() {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(90, now);
    osc.frequency.exponentialRampToValueAtTime(35, now + 0.22);
    g.gain.setValueAtTime(0.5, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.26);
  }

  /** Powerful tail whip whoosh and heavy water slap */
  playTailWhip() {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    // Sub-bass tail impulse
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(120, now);
    osc.frequency.exponentialRampToValueAtTime(32, now + 0.28);
    g.gain.setValueAtTime(0.65, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.33);

    // Lateral displacement swoosh & slap
    const bufSize = Math.floor(ctx.sampleRate * 0.26);
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * Math.sin((i / bufSize) * Math.PI);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800, now);
    filter.frequency.exponentialRampToValueAtTime(220, now + 0.26);
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.55, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);
    src.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.sfxGain);
    src.start(now);
  }

  /** Resounding jaw snap clash between fighting crocodiles */
  playJawClash() {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    // High transient jaw snap
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(1400, now);
    osc.frequency.exponentialRampToValueAtTime(140, now + 0.12);
    g.gain.setValueAtTime(0.7, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.15);

    // Deep chest resonance thump
    const sub = ctx.createOscillator();
    const subGain = ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(95, now);
    sub.frequency.exponentialRampToValueAtTime(28, now + 0.35);
    subGain.gain.setValueAtTime(0.8, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
    sub.connect(subGain);
    subGain.connect(this.sfxGain);
    sub.start(now);
    sub.stop(now + 0.4);
  }

  /** Agitated, distressed thrashing and bleat from caught prey */
  playPreyStruggle() {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.linearRampToValueAtTime(195, now + 0.1);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.35);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(480, now);
    filter.Q.value = 3;

    g.gain.setValueAtTime(0.42, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.36);

    osc.connect(filter);
    filter.connect(g);
    g.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.38);
  }

  /** Alarmed monkey chattering shrieks */
  playMonkeyChatter() {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    [720, 980, 840].forEach((freq, idx) => {
      const t = now + idx * 0.08;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.35, t + 0.035);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.9, t + 0.065);
      g.gain.setValueAtTime(0.24, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
      osc.connect(g);
      g.connect(this.sfxGain!);
      osc.start(t);
      osc.stop(t + 0.075);
    });
  }

  /** Menacing giant snake hiss & lunge rattle */
  playSnakeHiss() {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    const bufSize = Math.floor(ctx.sampleRate * 0.45);
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.2));
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buf;

    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(3200, now);
    filter.frequency.linearRampToValueAtTime(1800, now + 0.25);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.42, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.42);

    noise.connect(filter);
    filter.connect(g);
    g.connect(this.sfxGain);
    noise.start(now);
  }

  /** Crushing impact when an aggressive rival strikes the player */
  playRivalStrike() {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    // Heavy blunt impact thump
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(110, now);
    osc.frequency.exponentialRampToValueAtTime(25, now + 0.28);
    g.gain.setValueAtTime(0.85, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.34);

    // Bone / body crunch
    this.playBite();
  }

  dispose() {
    this.isRunning = false;
    if (this.timerId !== null) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
    this.ctx?.close().catch(() => {});
    this.ctx = null;
  }
}
