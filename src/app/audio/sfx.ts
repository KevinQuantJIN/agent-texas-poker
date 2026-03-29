/**
 * ASMR-style procedural SFX engine — warm but CLEARLY AUDIBLE.
 *
 * Warm timbre (pink noise, low-pass, soft attacks, reverb) but
 * gain levels high enough that you actually hear every action.
 * Think: close-mic'd poker table ASMR, not sounds from next room.
 */

let audioCtx: AudioContext | null = null;

export function getCtx(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  return audioCtx;
}

export async function ensureResumed(): Promise<void> {
  const ctx = getCtx();
  if (ctx.state === 'suspended') {
    await ctx.resume();
  }
}

// ── Master chain ──────────────────────────────────────────────
let masterGain: GainNode | null = null;

function getMaster(): GainNode {
  const ctx = getCtx();
  if (!masterGain) {
    masterGain = ctx.createGain();
    masterGain.gain.value = 1.0;

    // Warmth filter — tames harshness but doesn't kill volume
    const warmth = ctx.createBiquadFilter();
    warmth.type = 'lowpass';
    warmth.frequency.value = 5000;
    warmth.Q.value = 0.4;

    masterGain.connect(warmth);
    warmth.connect(ctx.destination);
  }
  return masterGain;
}

export function setVolume(v: number) {
  getMaster().gain.value = Math.max(0, Math.min(1, v));
}

export function getVolume(): number {
  return getMaster().gain.value;
}

// ── Pink noise — warm but LOUDER (0.25 scaling vs 0.11) ──────
function pinkNoise(ctx: AudioContext, duration: number): AudioBuffer {
  const size = Math.floor(ctx.sampleRate * duration);
  const buf = ctx.createBuffer(1, size, ctx.sampleRate);
  const data = buf.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < size; i++) {
    const w = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + w * 0.0555179;
    b1 = 0.99332 * b1 + w * 0.0750759;
    b2 = 0.96900 * b2 + w * 0.1538520;
    b3 = 0.86650 * b3 + w * 0.3104856;
    b4 = 0.55000 * b4 + w * 0.5329522;
    b5 = -0.7616 * b5 - w * 0.0168980;
    data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.25;
    b6 = w * 0.115926;
  }
  return buf;
}

// ── Stereo pan ────────────────────────────────────────────────
function pan(ctx: AudioContext, spread = 0.3): StereoPannerNode {
  const p = ctx.createStereoPanner();
  p.pan.value = (Math.random() - 0.5) * spread;
  return p;
}

// ── Room reverb (short, warm) ─────────────────────────────────
let roomReverb: ConvolverNode | null = null;
let reverbSend: GainNode | null = null;

function getReverb(): GainNode {
  const ctx = getCtx();
  if (!reverbSend) {
    const duration = 1.0;
    const len = Math.floor(ctx.sampleRate * duration);
    const impulse = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = impulse.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        const t = i / len;
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 2.5) * (1 - t * 0.6);
      }
    }
    roomReverb = ctx.createConvolver();
    roomReverb.buffer = impulse;

    reverbSend = ctx.createGain();
    reverbSend.gain.value = 0.25;

    reverbSend.connect(roomReverb);
    roomReverb.connect(getMaster());
  }
  return reverbSend;
}

function toDryWet(node: AudioNode) {
  node.connect(getMaster());
  node.connect(getReverb());
}

// ═══════════════════════════════════════════════════════════════
// CARD FLIP — papery "fwip" with body
// ═══════════════════════════════════════════════════════════════
export function playCardFlip() {
  const ctx = getCtx();
  const now = ctx.currentTime;

  // Papery noise — wider bandwidth, higher gain
  const src = ctx.createBufferSource();
  src.buffer = pinkNoise(ctx, 0.25);
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 1800;
  bp.Q.value = 0.5;
  const g1 = ctx.createGain();
  g1.gain.setValueAtTime(0, now);
  g1.gain.linearRampToValueAtTime(0.45, now + 0.006);
  g1.gain.exponentialRampToValueAtTime(0.12, now + 0.04);
  g1.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
  const p = pan(ctx);
  src.connect(bp).connect(g1).connect(p);
  toDryWet(p);
  src.start(now);
  src.stop(now + 0.25);

  // Felt thump
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(250, now);
  osc.frequency.exponentialRampToValueAtTime(120, now + 0.04);
  const g2 = ctx.createGain();
  g2.gain.setValueAtTime(0, now);
  g2.gain.linearRampToValueAtTime(0.25, now + 0.004);
  g2.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
  osc.connect(g2);
  toDryWet(g2);
  osc.start(now);
  osc.stop(now + 0.12);
}

// ═══════════════════════════════════════════════════════════════
// CARD DEAL — slide on felt
// ═══════════════════════════════════════════════════════════════
export function playCardDeal() {
  const ctx = getCtx();
  const now = ctx.currentTime;

  // Sliding noise
  const src = ctx.createBufferSource();
  src.buffer = pinkNoise(ctx, 0.35);
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 1500;
  bp.Q.value = 0.7;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(2500, now);
  lp.frequency.exponentialRampToValueAtTime(800, now + 0.25);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, now);
  g.gain.linearRampToValueAtTime(0.35, now + 0.01);
  g.gain.linearRampToValueAtTime(0.25, now + 0.1);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
  const p = pan(ctx);
  src.connect(bp).connect(lp).connect(g).connect(p);
  toDryWet(p);
  src.start(now);
  src.stop(now + 0.35);

  // Weight thump
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(180, now);
  osc.frequency.exponentialRampToValueAtTime(90, now + 0.08);
  const g2 = ctx.createGain();
  g2.gain.setValueAtTime(0, now);
  g2.gain.linearRampToValueAtTime(0.15, now + 0.008);
  g2.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
  osc.connect(g2);
  toDryWet(g2);
  osc.start(now);
  osc.stop(now + 0.15);
}

// ═══════════════════════════════════════════════════════════════
// CHIP CLINK — clay clack, warm but present
// ═══════════════════════════════════════════════════════════════
export function playChipClink() {
  const ctx = getCtx();
  const now = ctx.currentTime;

  const freqs = [950, 1200, 800];
  freqs.forEach((freq, i) => {
    const t = now + i * 0.012;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.65, t + 0.18);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.22, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    const p = pan(ctx, 0.25);
    osc.connect(lp).connect(g).connect(p);
    toDryWet(p);
    osc.start(t);
    osc.stop(t + 0.25);
  });

  // Felt contact
  const src = ctx.createBufferSource();
  src.buffer = pinkNoise(ctx, 0.1);
  const bp = ctx.createBiquadFilter();
  bp.type = 'lowpass';
  bp.frequency.value = 1200;
  const gn = ctx.createGain();
  gn.gain.setValueAtTime(0, now);
  gn.gain.linearRampToValueAtTime(0.18, now + 0.005);
  gn.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
  src.connect(bp).connect(gn);
  toDryWet(gn);
  src.start(now);
  src.stop(now + 0.1);
}

// ═══════════════════════════════════════════════════════════════
// CHECK — confident tap, clearly audible
// ═══════════════════════════════════════════════════════════════
export function playCheck() {
  const ctx = getCtx();
  const now = ctx.currentTime;

  // Warm knock
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(400, now);
  osc.frequency.exponentialRampToValueAtTime(200, now + 0.05);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 900;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, now);
  g.gain.linearRampToValueAtTime(0.35, now + 0.004);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
  osc.connect(lp).connect(g);
  toDryWet(g);
  osc.start(now);
  osc.stop(now + 0.18);

  // Felt texture
  const src = ctx.createBufferSource();
  src.buffer = pinkNoise(ctx, 0.06);
  const bp = ctx.createBiquadFilter();
  bp.type = 'lowpass';
  bp.frequency.value = 1500;
  const g2 = ctx.createGain();
  g2.gain.setValueAtTime(0, now);
  g2.gain.linearRampToValueAtTime(0.15, now + 0.003);
  g2.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
  src.connect(bp).connect(g2);
  toDryWet(g2);
  src.start(now);
  src.stop(now + 0.06);
}

// ═══════════════════════════════════════════════════════════════
// FOLD — cards placed down, soft but you hear it
// ═══════════════════════════════════════════════════════════════
export function playFold() {
  const ctx = getCtx();
  const now = ctx.currentTime;

  // Card placement
  const src = ctx.createBufferSource();
  src.buffer = pinkNoise(ctx, 0.4);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(2000, now);
  lp.frequency.exponentialRampToValueAtTime(500, now + 0.25);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, now);
  g.gain.linearRampToValueAtTime(0.25, now + 0.015);
  g.gain.linearRampToValueAtTime(0.18, now + 0.08);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
  const p = pan(ctx);
  src.connect(lp).connect(g).connect(p);
  toDryWet(p);
  src.start(now);
  src.stop(now + 0.4);

  // Low thump — cards hitting felt
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(140, now);
  osc.frequency.exponentialRampToValueAtTime(70, now + 0.08);
  const g2 = ctx.createGain();
  g2.gain.setValueAtTime(0, now);
  g2.gain.linearRampToValueAtTime(0.2, now + 0.008);
  g2.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
  osc.connect(g2);
  toDryWet(g2);
  osc.start(now);
  osc.stop(now + 0.18);
}

// ═══════════════════════════════════════════════════════════════
// CALL — chip toss with landing
// ═══════════════════════════════════════════════════════════════
export function playCall() {
  const ctx = getCtx();
  const now = ctx.currentTime;

  // Descending arc
  const osc = ctx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(700, now);
  osc.frequency.exponentialRampToValueAtTime(400, now + 0.1);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 1400;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, now);
  g.gain.linearRampToValueAtTime(0.28, now + 0.008);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
  const p = pan(ctx, 0.2);
  osc.connect(lp).connect(g).connect(p);
  toDryWet(p);
  osc.start(now);
  osc.stop(now + 0.25);

  // Landing thud
  const src = ctx.createBufferSource();
  src.buffer = pinkNoise(ctx, 0.12);
  const bp = ctx.createBiquadFilter();
  bp.type = 'lowpass';
  bp.frequency.value = 1000;
  const gn = ctx.createGain();
  gn.gain.setValueAtTime(0, now + 0.05);
  gn.gain.linearRampToValueAtTime(0.18, now + 0.058);
  gn.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
  src.connect(bp).connect(gn);
  toDryWet(gn);
  src.start(now);
  src.stop(now + 0.15);
}

// ═══════════════════════════════════════════════════════════════
// RAISE — warm ascending chime, present and assertive
// ═══════════════════════════════════════════════════════════════
export function playRaise() {
  const ctx = getCtx();
  const now = ctx.currentTime;

  // Rising tone
  const osc = ctx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(350, now);
  osc.frequency.exponentialRampToValueAtTime(580, now + 0.12);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 1800;
  lp.Q.value = 0.5;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, now);
  g.gain.linearRampToValueAtTime(0.35, now + 0.015);
  g.gain.linearRampToValueAtTime(0.28, now + 0.1);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
  const p = pan(ctx, 0.15);
  osc.connect(lp).connect(g).connect(p);
  toDryWet(p);
  osc.start(now);
  osc.stop(now + 0.4);

  // Harmonic fifth
  const osc2 = ctx.createOscillator();
  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(525, now);
  osc2.frequency.exponentialRampToValueAtTime(870, now + 0.12);
  const g2 = ctx.createGain();
  g2.gain.setValueAtTime(0, now);
  g2.gain.linearRampToValueAtTime(0.18, now + 0.02);
  g2.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
  osc2.connect(g2);
  toDryWet(g2);
  osc2.start(now);
  osc2.stop(now + 0.35);

  // Subtle body
  const osc3 = ctx.createOscillator();
  osc3.type = 'sine';
  osc3.frequency.setValueAtTime(175, now);
  osc3.frequency.exponentialRampToValueAtTime(290, now + 0.12);
  const g3 = ctx.createGain();
  g3.gain.setValueAtTime(0, now);
  g3.gain.linearRampToValueAtTime(0.12, now + 0.02);
  g3.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
  osc3.connect(g3);
  toDryWet(g3);
  osc3.start(now);
  osc3.stop(now + 0.25);
}

// ═══════════════════════════════════════════════════════════════
// SCORE TICK
// ═══════════════════════════════════════════════════════════════
export function playScoreTick(pitch = 1.0) {
  const ctx = getCtx();
  const now = ctx.currentTime;

  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = 550 * pitch;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 1600 * pitch;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, now);
  g.gain.linearRampToValueAtTime(0.25, now + 0.004);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
  osc.connect(lp).connect(g);
  toDryWet(g);
  osc.start(now);
  osc.stop(now + 0.15);
}

// ═══════════════════════════════════════════════════════════════
// WIN FANFARE — warm and clear
// ═══════════════════════════════════════════════════════════════
export function playWinFanfare() {
  const ctx = getCtx();
  const now = ctx.currentTime;

  const notes = [262, 330, 392, 523];
  notes.forEach((freq, i) => {
    const t = now + i * 0.12;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = freq * 2.5;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.3, t + 0.02);
    g.gain.linearRampToValueAtTime(0.25, t + 0.25);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
    osc.connect(lp).connect(g);
    toDryWet(g);
    osc.start(t);
    osc.stop(t + 0.7);

    // Octave shimmer
    const osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.value = freq * 2;
    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(0, t + 0.01);
    g2.gain.linearRampToValueAtTime(0.1, t + 0.04);
    g2.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    osc2.connect(g2);
    toDryWet(g2);
    osc2.start(t);
    osc2.stop(t + 0.5);
  });

  // Held chord
  const ct = now + notes.length * 0.12 + 0.08;
  [262, 330, 392, 523].forEach((freq) => {
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1600;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, ct);
    g.gain.linearRampToValueAtTime(0.15, ct + 0.06);
    g.gain.linearRampToValueAtTime(0.12, ct + 0.6);
    g.gain.exponentialRampToValueAtTime(0.001, ct + 1.5);
    osc.connect(lp).connect(g);
    toDryWet(g);
    osc.start(ct);
    osc.stop(ct + 1.5);
  });
}

// ═══════════════════════════════════════════════════════════════
// NEW HAND — shuffle you can actually hear
// ═══════════════════════════════════════════════════════════════
export function playNewHand() {
  const ctx = getCtx();
  const now = ctx.currentTime;

  // Riffle shuffle
  const src = ctx.createBufferSource();
  src.buffer = pinkNoise(ctx, 1.2);
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 1200;
  bp.Q.value = 0.5;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 2500;

  // Riffle LFO
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 12;
  const lfoG = ctx.createGain();
  lfoG.gain.value = 0.5;
  const modG = ctx.createGain();
  modG.gain.value = 0.5;
  lfo.connect(lfoG).connect(modG.gain);

  const g = ctx.createGain();
  g.gain.setValueAtTime(0, now);
  g.gain.linearRampToValueAtTime(0.3, now + 0.04);
  g.gain.linearRampToValueAtTime(0.3, now + 0.5);
  g.gain.linearRampToValueAtTime(0.2, now + 0.7);
  g.gain.exponentialRampToValueAtTime(0.001, now + 1.0);

  src.connect(bp).connect(lp).connect(modG).connect(g);
  toDryWet(g);
  lfo.start(now);
  src.start(now);
  src.stop(now + 1.1);
  lfo.stop(now + 1.1);

  // Table thud
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = 110;
  const tg = ctx.createGain();
  tg.gain.setValueAtTime(0, now + 0.75);
  tg.gain.linearRampToValueAtTime(0.2, now + 0.77);
  tg.gain.exponentialRampToValueAtTime(0.001, now + 0.92);
  osc.connect(tg);
  toDryWet(tg);
  osc.start(now + 0.75);
  osc.stop(now + 0.95);
}

// ═══════════════════════════════════════════════════════════════
// AMBIENT ROOM TONE
// ═══════════════════════════════════════════════════════════════
export function startAmbience(): () => void {
  const ctx = getCtx();
  const master = getMaster();

  // Brown noise room tone
  const size = ctx.sampleRate * 4;
  const buf = ctx.createBuffer(1, size, ctx.sampleRate);
  const data = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < size; i++) {
    const w = Math.random() * 2 - 1;
    data[i] = (last + 0.02 * w) / 1.02;
    last = data[i];
    data[i] *= 3.5;
  }

  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 500;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, ctx.currentTime);
  g.gain.linearRampToValueAtTime(0.04, ctx.currentTime + 2);
  src.connect(lp).connect(g).connect(master);
  src.start();

  // Vinyl crackle
  const crackleSize = ctx.sampleRate * 4;
  const crackleBuf = ctx.createBuffer(1, crackleSize, ctx.sampleRate);
  const crackleData = crackleBuf.getChannelData(0);
  for (let i = 0; i < crackleSize; i++) {
    crackleData[i] = Math.random() < 0.02 ? (Math.random() - 0.5) * 0.4 : 0;
  }
  const crackleSrc = ctx.createBufferSource();
  crackleSrc.buffer = crackleBuf;
  crackleSrc.loop = true;
  const crackleFilt = ctx.createBiquadFilter();
  crackleFilt.type = 'bandpass';
  crackleFilt.frequency.value = 2200;
  crackleFilt.Q.value = 0.3;
  const crackleG = ctx.createGain();
  crackleG.gain.setValueAtTime(0, ctx.currentTime);
  crackleG.gain.linearRampToValueAtTime(0.025, ctx.currentTime + 3);
  crackleSrc.connect(crackleFilt).connect(crackleG).connect(master);
  crackleSrc.start();

  return () => {
    const t = ctx.currentTime;
    g.gain.linearRampToValueAtTime(0, t + 1);
    crackleG.gain.linearRampToValueAtTime(0, t + 1);
    setTimeout(() => { src.stop(); crackleSrc.stop(); }, 1200);
  };
}

// ═══════════════════════════════════════════════════════════════
// INTENSITY-SCALED SFX — the money sounds different
//
// intensity: 0 = min bet, 1 = all-in / huge bet
// These REPLACE the basic playRaise/playCall for big moments
// ═══════════════════════════════════════════════════════════════

/**
 * Big raise — scales with intensity.
 * Low intensity: normal raise.
 * High intensity: deeper, wider, more harmonics, longer tail, multi-chip cascade.
 */
export function playRaiseScaled(intensity: number) {
  const ctx = getCtx();
  const now = ctx.currentTime;
  const I = Math.max(0, Math.min(1, intensity));

  // Base rising tone — gets lower and wider with intensity
  const baseFreq = 350 - I * 100; // 350 → 250
  const targetFreq = 580 + I * 200; // 580 → 780
  const osc = ctx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(baseFreq, now);
  osc.frequency.exponentialRampToValueAtTime(targetFreq, now + 0.12 + I * 0.08);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 1800 + I * 1200;
  lp.Q.value = 0.5 + I * 0.3;
  const g = ctx.createGain();
  const vol = 0.35 + I * 0.2;
  g.gain.setValueAtTime(0, now);
  g.gain.linearRampToValueAtTime(vol, now + 0.012);
  g.gain.linearRampToValueAtTime(vol * 0.8, now + 0.1 + I * 0.1);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.35 + I * 0.3);
  const p = pan(ctx, 0.15);
  osc.connect(lp).connect(g).connect(p);
  toDryWet(p);
  osc.start(now);
  osc.stop(now + 0.7);

  // Fifth harmony — louder with intensity
  const osc2 = ctx.createOscillator();
  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(baseFreq * 1.5, now);
  osc2.frequency.exponentialRampToValueAtTime(targetFreq * 1.5, now + 0.12 + I * 0.08);
  const g2 = ctx.createGain();
  g2.gain.setValueAtTime(0, now);
  g2.gain.linearRampToValueAtTime(0.12 + I * 0.15, now + 0.02);
  g2.gain.exponentialRampToValueAtTime(0.001, now + 0.3 + I * 0.2);
  osc2.connect(g2);
  toDryWet(g2);
  osc2.start(now);
  osc2.stop(now + 0.6);

  // Sub bass — only appears at higher intensity
  if (I > 0.3) {
    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(baseFreq / 2, now);
    sub.frequency.exponentialRampToValueAtTime(targetFreq / 2, now + 0.15);
    const sg = ctx.createGain();
    sg.gain.setValueAtTime(0, now);
    sg.gain.linearRampToValueAtTime(I * 0.25, now + 0.02);
    sg.gain.exponentialRampToValueAtTime(0.001, now + 0.3 + I * 0.2);
    sub.connect(sg);
    toDryWet(sg);
    sub.start(now);
    sub.stop(now + 0.6);
  }

  // Chip cascade — more chips at higher intensity
  const chipCount = Math.floor(1 + I * 4); // 1-5 chips
  for (let i = 0; i < chipCount; i++) {
    const delay = 0.08 + i * (0.06 + Math.random() * 0.04);
    setTimeout(() => playChipClink(), delay * 1000);
  }
}

/**
 * Big call — scales with intensity.
 * Low: normal call. High: heavy commitment, weighty, multiple chips landing.
 */
export function playCallScaled(intensity: number) {
  const ctx = getCtx();
  const now = ctx.currentTime;
  const I = Math.max(0, Math.min(1, intensity));

  // Descending arc — deeper and longer with intensity
  const osc = ctx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(700 + I * 100, now);
  osc.frequency.exponentialRampToValueAtTime(300 - I * 100, now + 0.1 + I * 0.1);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 1400 + I * 600;
  const g = ctx.createGain();
  const vol = 0.28 + I * 0.2;
  g.gain.setValueAtTime(0, now);
  g.gain.linearRampToValueAtTime(vol, now + 0.008);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.2 + I * 0.2);
  const p = pan(ctx, 0.2);
  osc.connect(lp).connect(g).connect(p);
  toDryWet(p);
  osc.start(now);
  osc.stop(now + 0.5);

  // Landing thud — heavier with intensity
  const src = ctx.createBufferSource();
  src.buffer = pinkNoise(ctx, 0.15 + I * 0.1);
  const bp = ctx.createBiquadFilter();
  bp.type = 'lowpass';
  bp.frequency.value = 1000 + I * 500;
  const gn = ctx.createGain();
  gn.gain.setValueAtTime(0, now + 0.04);
  gn.gain.linearRampToValueAtTime(0.18 + I * 0.15, now + 0.05);
  gn.gain.exponentialRampToValueAtTime(0.001, now + 0.15 + I * 0.1);
  src.connect(bp).connect(gn);
  toDryWet(gn);
  src.start(now);
  src.stop(now + 0.3);

  // Sub weight — big calls have gravity
  if (I > 0.3) {
    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(90, now);
    sub.frequency.exponentialRampToValueAtTime(50, now + 0.12);
    const sg = ctx.createGain();
    sg.gain.setValueAtTime(0, now);
    sg.gain.linearRampToValueAtTime(I * 0.2, now + 0.01);
    sg.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    sub.connect(sg);
    toDryWet(sg);
    sub.start(now);
    sub.stop(now + 0.25);
  }

  // Chip pile — more chips at higher intensity
  const chipCount = Math.floor(1 + I * 3);
  for (let i = 0; i < chipCount; i++) {
    const delay = 0.06 + i * (0.05 + Math.random() * 0.04);
    setTimeout(() => playChipClink(), delay * 1000);
  }
}

/**
 * ALL-IN — the biggest sound in the game.
 * Deep sub impact, rising sweep, dramatic chip avalanche, sustained ring.
 */
export function playAllIn() {
  const ctx = getCtx();
  const now = ctx.currentTime;

  // ── Impact: deep sub hit ──
  const sub = ctx.createOscillator();
  sub.type = 'sine';
  sub.frequency.setValueAtTime(60, now);
  sub.frequency.exponentialRampToValueAtTime(30, now + 0.3);
  const subG = ctx.createGain();
  subG.gain.setValueAtTime(0, now);
  subG.gain.linearRampToValueAtTime(0.5, now + 0.01);
  subG.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
  sub.connect(subG);
  toDryWet(subG);
  sub.start(now);
  sub.stop(now + 0.5);

  // ── Rising sweep: filtered noise rushing upward ──
  const sweep = ctx.createBufferSource();
  sweep.buffer = pinkNoise(ctx, 0.8);
  const sweepBp = ctx.createBiquadFilter();
  sweepBp.type = 'bandpass';
  sweepBp.frequency.setValueAtTime(400, now);
  sweepBp.frequency.exponentialRampToValueAtTime(3000, now + 0.5);
  sweepBp.Q.value = 1.5;
  const sweepG = ctx.createGain();
  sweepG.gain.setValueAtTime(0, now);
  sweepG.gain.linearRampToValueAtTime(0.35, now + 0.05);
  sweepG.gain.linearRampToValueAtTime(0.4, now + 0.4);
  sweepG.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
  sweep.connect(sweepBp).connect(sweepG);
  toDryWet(sweepG);
  sweep.start(now);
  sweep.stop(now + 0.8);

  // ── Power chord: sustained dramatic tone ──
  const chordNotes = [110, 165, 220, 330]; // A2, E3, A3, E4 — open fifths
  chordNotes.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    osc.type = i < 2 ? 'sawtooth' : 'triangle';
    osc.frequency.value = freq;
    osc.detune.value = (Math.random() - 0.5) * 8;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(500, now + 0.1);
    lp.frequency.linearRampToValueAtTime(2000, now + 0.5);
    lp.frequency.exponentialRampToValueAtTime(600, now + 1.5);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, now + 0.05);
    g.gain.linearRampToValueAtTime(0.12, now + 0.15);
    g.gain.linearRampToValueAtTime(0.1, now + 0.8);
    g.gain.exponentialRampToValueAtTime(0.001, now + 2.0);
    osc.connect(lp).connect(g);
    toDryWet(g);
    osc.start(now);
    osc.stop(now + 2.0);
  });

  // ── Chip avalanche: rapid cascade of chips being pushed ──
  for (let i = 0; i < 8; i++) {
    const delay = 0.15 + i * 0.07 + Math.random() * 0.05;
    setTimeout(() => playChipClink(), delay * 1000);
  }

  // ── Final "all chips in" slide noise ──
  const slide = ctx.createBufferSource();
  slide.buffer = pinkNoise(ctx, 0.6);
  const slideLp = ctx.createBiquadFilter();
  slideLp.type = 'lowpass';
  slideLp.frequency.setValueAtTime(2000, now + 0.3);
  slideLp.frequency.exponentialRampToValueAtTime(500, now + 0.8);
  const slideG = ctx.createGain();
  slideG.gain.setValueAtTime(0, now + 0.3);
  slideG.gain.linearRampToValueAtTime(0.25, now + 0.35);
  slideG.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
  slide.connect(slideLp).connect(slideG);
  toDryWet(slideG);
  slide.start(now + 0.3);
  slide.stop(now + 0.9);
}
