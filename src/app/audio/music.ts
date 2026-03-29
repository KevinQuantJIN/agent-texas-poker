/**
 * Dynamic lo-fi BGM that REACTS TO THE MONEY.
 *
 * Base layer: warm lo-fi ambient (always playing)
 * Tension layer: low drone that swells with pot size
 * Dramatic stings: triggered by big moments (all-in, huge raise, showdown)
 *
 * The music breathes with the game — calm during folds,
 * building during raises, climaxing during all-ins.
 */

import { ensureResumed, getCtx as getSharedCtx } from './sfx';

// ── State ─────────────────────────────────────────────────────
let masterGain: GainNode | null = null;
let isPlaying = false;
let isMuted = false;
let volume = 0.25;
let stopHandle: (() => void) | null = null;

// Tension system — controlled from outside
let tensionGain: GainNode | null = null;
let tensionFilter: BiquadFilterNode | null = null;
let tensionLevel = 0; // 0 = calm, 1 = maximum tension

// ── Chords ────────────────────────────────────────────────────
// Calm: Am9 → Fmaj9 → Cmaj9 → Em9
const CALM_CHORDS = [
  [57, 60, 64, 67, 71],
  [53, 57, 60, 64, 67],
  [48, 52, 55, 59, 62],
  [52, 55, 59, 62, 66],
];
// Tense: Dm9 → Bbmaj7 → Gm9 → Am7(b5) — darker, unresolved
const TENSE_CHORDS = [
  [50, 53, 57, 60, 64],  // Dm9
  [46, 50, 53, 57, 60],  // Bbmaj7
  [43, 46, 50, 53, 57],  // Gm9
  [45, 48, 51, 55, 59],  // Am7b5 — tension chord
];
const CALM_BASS = [45, 41, 36, 40];
const TENSE_BASS = [38, 34, 31, 33];
const ARP_PATTERNS = [
  [0, 2, 4, 3, 1, 4, 2, 0],
  [1, 3, 0, 4, 2, 0, 3, 1],
  [0, 4, 1, 3, 0, 2, 4, 1],
  [2, 0, 3, 1, 4, 0, 2, 3],
];

function midi(n: number): number {
  return 440 * Math.pow(2, (n - 69) / 12);
}

function getMaster(): GainNode {
  const ctx = getSharedCtx();
  if (!masterGain) {
    masterGain = ctx.createGain();
    masterGain.gain.value = isMuted ? 0 : volume;
    const warmth = ctx.createBiquadFilter();
    warmth.type = 'lowpass';
    warmth.frequency.value = 2500;
    warmth.Q.value = 0.4;
    masterGain.connect(warmth);
    warmth.connect(ctx.destination);
  }
  return masterGain;
}

function createReverb(ctx: AudioContext): ConvolverNode {
  const dur = 3.0;
  const len = Math.floor(ctx.sampleRate * dur);
  const impulse = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = impulse.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      const t = i / len;
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 2.0) * (1 - t * 0.8);
    }
  }
  const conv = ctx.createConvolver();
  conv.buffer = impulse;
  return conv;
}

// ── Main loop ─────────────────────────────────────────────────
function startLoop(): () => void {
  const ctx = getSharedCtx();
  const master = getMaster();
  let stopped = false;

  // Reverb bus
  const reverb = createReverb(ctx);
  const dryG = ctx.createGain();
  dryG.gain.value = 0.5;
  const wetG = ctx.createGain();
  wetG.gain.value = 0.5;
  dryG.connect(master);
  reverb.connect(wetG);
  wetG.connect(master);
  const mix = ctx.createGain();
  mix.gain.value = 1;
  mix.connect(dryG);
  mix.connect(reverb);

  // Tape wobble
  const wobbleLfo = ctx.createOscillator();
  wobbleLfo.frequency.value = 0.4;
  const wobbleDepth = ctx.createGain();
  wobbleDepth.gain.value = 3;
  wobbleLfo.connect(wobbleDepth);
  wobbleLfo.start();

  // ── TENSION DRONE: always running, gain controlled by setTension ──
  // Low sustained notes that swell when stakes are high
  tensionGain = ctx.createGain();
  tensionGain.gain.value = 0;
  tensionFilter = ctx.createBiquadFilter();
  tensionFilter.type = 'lowpass';
  tensionFilter.frequency.value = 400;
  tensionFilter.Q.value = 0.8;

  // Drone oscillators — dark fifth (A1 + E2)
  const drone1 = ctx.createOscillator();
  drone1.type = 'sawtooth';
  drone1.frequency.value = midi(33); // A1
  const drone2 = ctx.createOscillator();
  drone2.type = 'sawtooth';
  drone2.frequency.value = midi(40); // E2
  drone2.detune.value = -5;
  const drone3 = ctx.createOscillator();
  drone3.type = 'sine';
  drone3.frequency.value = midi(33); // Sub
  const droneG1 = ctx.createGain();
  droneG1.gain.value = 0.15;
  const droneG2 = ctx.createGain();
  droneG2.gain.value = 0.1;
  const droneG3 = ctx.createGain();
  droneG3.gain.value = 0.2;

  drone1.connect(droneG1).connect(tensionFilter!);
  drone2.connect(droneG2).connect(tensionFilter!);
  drone3.connect(droneG3).connect(tensionFilter!);
  tensionFilter.connect(tensionGain!);
  tensionGain.connect(mix);
  drone1.start();
  drone2.start();
  drone3.start();

  // Tension LFO — slow tremolo that intensifies with tension
  const tensionLfo = ctx.createOscillator();
  tensionLfo.frequency.value = 0.15;
  const tensionLfoDepth = ctx.createGain();
  tensionLfoDepth.gain.value = 0.03;
  tensionLfo.connect(tensionLfoDepth).connect(tensionGain!.gain);
  tensionLfo.start();

  const BPM = 65;
  const beat = 60 / BPM;
  const bar = beat * 4;
  let chordIdx = 0;

  // Vinyl crackle
  const crackleLen = ctx.sampleRate * 6;
  const crackleBuf = ctx.createBuffer(1, crackleLen, ctx.sampleRate);
  const crackleData = crackleBuf.getChannelData(0);
  for (let i = 0; i < crackleLen; i++) {
    crackleData[i] = Math.random() < 0.015 ? (Math.random() - 0.5) * 0.2 : 0;
  }
  const crackleSrc = ctx.createBufferSource();
  crackleSrc.buffer = crackleBuf;
  crackleSrc.loop = true;
  const crackleFilt = ctx.createBiquadFilter();
  crackleFilt.type = 'bandpass';
  crackleFilt.frequency.value = 1800;
  crackleFilt.Q.value = 0.3;
  const crackleGain = ctx.createGain();
  crackleGain.gain.value = 0.008;
  crackleSrc.connect(crackleFilt).connect(crackleGain).connect(master);
  crackleSrc.start();

  function scheduleBar(startTime: number) {
    if (stopped) return;

    // Blend between calm and tense chords based on tension
    const t = tensionLevel;
    const calmChord = CALM_CHORDS[chordIdx % CALM_CHORDS.length];
    const tenseChord = TENSE_CHORDS[chordIdx % TENSE_CHORDS.length];
    const chord = t < 0.4 ? calmChord : tenseChord;
    const bassNote = t < 0.4
      ? CALM_BASS[chordIdx % CALM_BASS.length]
      : TENSE_BASS[chordIdx % TENSE_BASS.length];
    const arpPattern = ARP_PATTERNS[chordIdx % ARP_PATTERNS.length];

    // ── PAD ──
    const padG = ctx.createGain();
    const padLp = ctx.createBiquadFilter();
    padLp.type = 'lowpass';
    // Filter opens with tension (darker when calm, brighter when tense)
    padLp.frequency.value = 700 + t * 500;
    padLp.Q.value = 0.6 + t * 0.4;
    padG.connect(padLp);
    padLp.connect(mix);

    for (const note of chord) {
      for (const det of [-7, 7]) {
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.value = midi(note);
        osc.detune.value = det;
        wobbleDepth.connect(osc.detune);
        osc.connect(padG);
        osc.start(startTime);
        osc.stop(startTime + bar + 0.8);
      }
    }

    // Pad volume increases slightly with tension
    const padVol = 0.07 + t * 0.04;
    padG.gain.setValueAtTime(0, startTime);
    padG.gain.linearRampToValueAtTime(padVol, startTime + bar * 0.35);
    padG.gain.setValueAtTime(padVol, startTime + bar * 0.65);
    padG.gain.linearRampToValueAtTime(0, startTime + bar + 0.6);

    // ── BASS — hits harder with tension ──
    const bassBeats = t > 0.6 ? [0, 1, 2, 3] : [0, 2]; // More bass hits when tense
    for (const b of bassBeats) {
      const bt = startTime + b * beat;
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = midi(bassNote);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 250 + t * 150;
      const g = ctx.createGain();
      const bassVol = 0.14 + t * 0.08;
      g.gain.setValueAtTime(0, bt);
      g.gain.linearRampToValueAtTime(bassVol, bt + 0.06);
      g.gain.exponentialRampToValueAtTime(0.001, bt + beat * 1.5);
      osc.connect(lp).connect(g).connect(mix);
      osc.start(bt);
      osc.stop(bt + beat * 2);
    }

    // ── ARP — more notes when tense, sparser when calm ──
    const skipChance = Math.max(0.05, 0.35 - t * 0.3); // tense = almost no skips
    for (let i = 0; i < 8; i++) {
      if (Math.random() < skipChance) continue;
      const at = startTime + i * (beat / 2);
      const noteIdx = arpPattern[i % arpPattern.length];
      const arpNote = chord[noteIdx] + 12;

      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = midi(arpNote);
      wobbleDepth.connect(osc.detune);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 900 + t * 600;
      const g = ctx.createGain();
      const vel = 0.025 + Math.random() * 0.015 + t * 0.02;
      g.gain.setValueAtTime(0, at);
      g.gain.linearRampToValueAtTime(vel, at + 0.015);
      g.gain.exponentialRampToValueAtTime(0.001, at + beat * 0.6);
      const pan = ctx.createStereoPanner();
      pan.pan.value = (Math.random() - 0.5) * 0.4;
      osc.connect(lp).connect(g).connect(pan).connect(mix);
      osc.start(at);
      osc.stop(at + beat);
    }

    // ── SHIMMER ──
    if (chordIdx % 4 === 0) {
      const shimNote = chord[3] + 24;
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = midi(shimNote);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 1500;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, startTime);
      g.gain.linearRampToValueAtTime(0.015 + t * 0.01, startTime + bar * 0.5);
      g.gain.linearRampToValueAtTime(0, startTime + bar);
      osc.connect(lp).connect(g).connect(mix);
      osc.start(startTime);
      osc.stop(startTime + bar + 0.2);
    }

    chordIdx++;
    const next = startTime + bar;
    const delay = (next - ctx.currentTime) * 1000 - 100;
    setTimeout(() => scheduleBar(next), Math.max(0, delay));
  }

  const now = ctx.currentTime;
  master.gain.setValueAtTime(0, now);
  master.gain.linearRampToValueAtTime(isMuted ? 0 : volume, now + 3);
  scheduleBar(now + 0.1);

  return () => {
    stopped = true;
    const t = ctx.currentTime;
    master.gain.cancelScheduledValues(t);
    master.gain.setValueAtTime(master.gain.value, t);
    master.gain.linearRampToValueAtTime(0, t + 2);
    setTimeout(() => {
      crackleSrc.stop();
      wobbleLfo.stop();
      drone1.stop();
      drone2.stop();
      drone3.stop();
      tensionLfo.stop();
    }, 2200);
  };
}

// ═══════════════════════════════════════════════════════════════
// TENSION CONTROL — called from useGameAudio
// ═══════════════════════════════════════════════════════════════
export function setTension(level: number) {
  tensionLevel = Math.max(0, Math.min(1, level));
  const ctx = getSharedCtx();
  const t = ctx.currentTime;

  if (tensionGain) {
    // Drone volume: 0 when calm, up to 0.35 when max tension
    tensionGain.gain.cancelScheduledValues(t);
    tensionGain.gain.setValueAtTime(tensionGain.gain.value, t);
    tensionGain.gain.linearRampToValueAtTime(tensionLevel * 0.35, t + 0.8);
  }
  if (tensionFilter) {
    // Filter opens: 400Hz calm → 1200Hz tense
    tensionFilter.frequency.cancelScheduledValues(t);
    tensionFilter.frequency.setValueAtTime(tensionFilter.frequency.value, t);
    tensionFilter.frequency.linearRampToValueAtTime(400 + tensionLevel * 800, t + 0.8);
  }
}

// ═══════════════════════════════════════════════════════════════
// DRAMATIC STINGS — one-shot musical moments
// ═══════════════════════════════════════════════════════════════

/** All-in: dramatic low hit + rising tension chord */
export function playAllInSting() {
  const ctx = getSharedCtx();
  const now = ctx.currentTime;
  const master = getMaster();

  // Impact hit — deep, resonant
  const sub = ctx.createOscillator();
  sub.type = 'sine';
  sub.frequency.setValueAtTime(55, now); // A1
  sub.frequency.exponentialRampToValueAtTime(35, now + 0.4);
  const subG = ctx.createGain();
  subG.gain.setValueAtTime(0, now);
  subG.gain.linearRampToValueAtTime(0.4, now + 0.02);
  subG.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
  sub.connect(subG).connect(master);
  sub.start(now);
  sub.stop(now + 0.8);

  // Tension chord — rising diminished, unresolved
  const notes = [45, 48, 51, 54]; // A B# D F — diminished 7th
  notes.forEach((note, i) => {
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = midi(note);
    osc.detune.value = (Math.random() - 0.5) * 10;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(300, now);
    lp.frequency.linearRampToValueAtTime(1200, now + 1.5);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, now + 0.05);
    g.gain.linearRampToValueAtTime(0.08, now + 0.3);
    g.gain.linearRampToValueAtTime(0.1, now + 1.5);
    g.gain.exponentialRampToValueAtTime(0.001, now + 3.0);
    osc.connect(lp).connect(g).connect(master);
    osc.start(now);
    osc.stop(now + 3.0);
  });

  // Heartbeat pulse — LFO on sub, getting faster
  const heartOsc = ctx.createOscillator();
  heartOsc.type = 'sine';
  heartOsc.frequency.value = midi(33); // A1
  const heartLfo = ctx.createOscillator();
  heartLfo.frequency.setValueAtTime(1.2, now + 0.5);
  heartLfo.frequency.linearRampToValueAtTime(2.0, now + 3.0);
  const heartLfoG = ctx.createGain();
  heartLfoG.gain.value = 1;
  const heartG = ctx.createGain();
  heartG.gain.setValueAtTime(0, now + 0.5);
  heartG.gain.linearRampToValueAtTime(0.15, now + 1.0);
  heartG.gain.linearRampToValueAtTime(0.15, now + 2.5);
  heartG.gain.exponentialRampToValueAtTime(0.001, now + 3.5);
  heartLfo.connect(heartLfoG).connect(heartG.gain);
  heartOsc.connect(heartG).connect(master);
  heartOsc.start(now + 0.5);
  heartOsc.stop(now + 3.5);
  heartLfo.start(now + 0.5);
  heartLfo.stop(now + 3.5);
}

/** Big raise: ascending power — confident, weighty */
export function playBigRaiseSting() {
  const ctx = getSharedCtx();
  const now = ctx.currentTime;
  const master = getMaster();

  // Rising fifth
  const notes = [40, 47]; // E2, B2 — power fifth
  notes.forEach((note) => {
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    const baseFreq = midi(note);
    osc.frequency.setValueAtTime(baseFreq * 0.9, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.1, now + 0.4);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(600, now);
    lp.frequency.linearRampToValueAtTime(1400, now + 0.3);
    lp.frequency.exponentialRampToValueAtTime(400, now + 1.0);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.2, now + 0.04);
    g.gain.linearRampToValueAtTime(0.15, now + 0.3);
    g.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
    osc.connect(lp).connect(g).connect(master);
    osc.start(now);
    osc.stop(now + 1.2);
  });
}

/** Big call: commitment — descending weight, resolute */
export function playBigCallSting() {
  const ctx = getSharedCtx();
  const now = ctx.currentTime;
  const master = getMaster();

  // Resolute descending tone — "I'm in"
  const osc = ctx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(midi(52), now); // E3
  osc.frequency.exponentialRampToValueAtTime(midi(45), now + 0.3); // A2
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 1000;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, now);
  g.gain.linearRampToValueAtTime(0.2, now + 0.02);
  g.gain.linearRampToValueAtTime(0.15, now + 0.2);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
  osc.connect(lp).connect(g).connect(master);
  osc.start(now);
  osc.stop(now + 0.8);

  // Second voice — octave above, quieter
  const osc2 = ctx.createOscillator();
  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(midi(64), now);
  osc2.frequency.exponentialRampToValueAtTime(midi(57), now + 0.3);
  const g2 = ctx.createGain();
  g2.gain.setValueAtTime(0, now);
  g2.gain.linearRampToValueAtTime(0.08, now + 0.03);
  g2.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
  osc2.connect(g2).connect(master);
  osc2.start(now);
  osc2.stop(now + 0.6);
}

/** Showdown reveal: resolution chord — satisfying conclusion */
export function playShowdownSting() {
  const ctx = getSharedCtx();
  const now = ctx.currentTime;
  const master = getMaster();

  // Am9 resolving — warm, full, satisfying
  const chord = [45, 52, 57, 60, 64, 67, 71]; // A2 E3 A3 C4 E4 G4 B4
  chord.forEach((note, i) => {
    const osc = ctx.createOscillator();
    osc.type = i < 2 ? 'triangle' : 'sine';
    osc.frequency.value = midi(note);
    osc.detune.value = (Math.random() - 0.5) * 8;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(400, now);
    lp.frequency.linearRampToValueAtTime(1800, now + 0.5);
    lp.frequency.exponentialRampToValueAtTime(600, now + 2.0);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.06, now + 0.08);
    g.gain.linearRampToValueAtTime(0.05, now + 1.0);
    g.gain.exponentialRampToValueAtTime(0.001, now + 2.5);
    osc.connect(lp).connect(g).connect(master);
    osc.start(now);
    osc.stop(now + 2.5);
  });
}

/** Big pot won: celebration — warm major resolution */
export function playBigWinSting() {
  const ctx = getSharedCtx();
  const now = ctx.currentTime;
  const master = getMaster();

  // Ascending major arpeggio, warm and full
  const notes = [48, 52, 55, 60, 64, 67]; // C3 E3 G3 C4 E4 G4
  notes.forEach((note, i) => {
    const t = now + i * 0.06;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = midi(note);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.15, t + 0.02);
    g.gain.linearRampToValueAtTime(0.1, t + 0.4);
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.0);
    osc.connect(g).connect(master);
    osc.start(t);
    osc.stop(t + 1.0);
  });

  // Held resolution chord
  const ct = now + notes.length * 0.06 + 0.05;
  [48, 55, 60, 64, 67].forEach((note) => {
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = midi(note);
    osc.detune.value = (Math.random() - 0.5) * 6;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1400;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, ct);
    g.gain.linearRampToValueAtTime(0.08, ct + 0.08);
    g.gain.linearRampToValueAtTime(0.06, ct + 1.0);
    g.gain.exponentialRampToValueAtTime(0.001, ct + 2.5);
    osc.connect(lp).connect(g).connect(master);
    osc.start(ct);
    osc.stop(ct + 2.5);
  });
}

// ── Public API ────────────────────────────────────────────────
export function playMusic() {
  if (isPlaying) return;
  isPlaying = true;
  ensureResumed();
  stopHandle = startLoop();
}

export function stopMusic() {
  if (!isPlaying) return;
  isPlaying = false;
  stopHandle?.();
  stopHandle = null;
}

export function setMusicVolume(v: number) {
  volume = Math.max(0, Math.min(1, v));
  if (masterGain && !isMuted) {
    masterGain.gain.setValueAtTime(volume, getSharedCtx().currentTime);
  }
}

export function toggleMusicMute(): boolean {
  isMuted = !isMuted;
  if (masterGain) {
    const t = getSharedCtx().currentTime;
    masterGain.gain.cancelScheduledValues(t);
    masterGain.gain.setValueAtTime(masterGain.gain.value, t);
    masterGain.gain.linearRampToValueAtTime(isMuted ? 0 : volume, t + 0.5);
  }
  return isMuted;
}

export function hasTracks(): boolean {
  return true;
}
