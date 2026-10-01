/* DarkCraft AI sound-design renderer.
   Renders EVERY game sound from AI-designed synthesis recipes + neural-TTS
   vocal takes processed into monster voices. Output: WAV files that get
   converted to OGG into /public/sounds. */

import * as S from './synth'
import fs from 'fs'
import path from 'path'

const OUT = path.join(__dirname, '..', 'out')
const TTS_RAW = path.join(__dirname, '..', 'tts_raw')

/* ---------- helpers ---------- */
function trimSilence(sig: Float32Array, thresh = 0.012, padSec = 0.04): Float32Array {
  let a = 0, b = sig.length - 1
  while (a < sig.length && Math.abs(sig[a]) < thresh) a++
  while (b > a && Math.abs(sig[b]) < thresh) b--
  if (a >= b) return sig
  const pad = Math.floor(padSec * S.SR)
  a = Math.max(0, a - pad); b = Math.min(sig.length - 1, b + pad)
  return sig.slice(a, b + 1)
}
function reverse(sig: Float32Array): Float32Array {
  const out = new Float32Array(sig.length)
  for (let i = 0; i < sig.length; i++) out[i] = sig[sig.length - 1 - i]
  return out
}
/** whoosh: noise through a hump env + sweeping bandpass */
function whoosh(dur: number, f0: number, f1: number, Q: number, peakPos: number, rnd: () => number): Float32Array {
  const nz = S.noise(dur, rnd)
  const swept = S.sweepFilter(nz, f0, f1, Q)
  const n = swept.length
  const out = new Float32Array(n)
  const pk = Math.floor(n * peakPos)
  for (let i = 0; i < n; i++) {
    const env = i < pk ? Math.pow(i / pk, 2.2) : Math.pow(1 - (i - pk) / (n - pk), 1.8)
    out[i] = swept[i] * env * 3.2
  }
  return S.ar(out, 0.01, 0.05)
}
/** granular fire crackle generator */
function crackle(dur: number, density: number, rnd: () => number, lo = 1500, hi = 5200): Float32Array {
  const out = new Float32Array(Math.ceil(dur * S.SR))
  const count = Math.floor(dur * density)
  for (let i = 0; i < count; i++) {
    const t = rnd() * (dur - 0.02)
    const len = Math.floor((0.002 + rnd() * 0.006) * S.SR)
    const off = Math.floor(t * S.SR)
    const f = lo + rnd() * (hi - lo)
    const tau = 0.004 + rnd() * 0.01
    const amp = 0.25 + rnd() * 0.75
    for (let j = 0; j < len && off + j < out.length; j++) {
      out[off + j] += (rnd() * 2 - 1) * Math.exp(-j / (tau * S.SR)) * amp
    }
  }
  // soften
  let lp = 0
  for (let i = 0; i < out.length; i++) { lp += 0.35 * (out[i] - lp); out[i] = lp * 2.6 }
  return out
}
const METAL_MODES: S.Mode[] = [
  { r: 1, tau: 0.75, a: 1 }, { r: 2.32, tau: 0.52, a: 0.72 }, { r: 3.01, tau: 0.4, a: 0.5 },
  { r: 4.27, tau: 0.3, a: 0.36 }, { r: 5.38, tau: 0.22, a: 0.26 }, { r: 6.81, tau: 0.16, a: 0.18 },
  { r: 9.2, tau: 0.1, a: 0.1 },
]
const STEEL_MODES: S.Mode[] = [
  { r: 1, tau: 1.1, a: 1 }, { r: 2.41, tau: 0.8, a: 0.6 }, { r: 3.86, tau: 0.55, a: 0.4 },
  { r: 5.12, tau: 0.4, a: 0.3 }, { r: 7.05, tau: 0.28, a: 0.2 }, { r: 9.7, tau: 0.18, a: 0.12 },
]

/* ---------- TTS vocal processing ---------- */
function loadTake(name: string): Float32Array | null {
  const p = path.join(TTS_RAW, name + '.wav')
  if (!fs.existsSync(p)) return null
  try {
    return trimSilence(S.readWav(p))
  } catch {
    return null
  }
}

interface RoarOpts {
  pitch: number      // resample ratio (<1 deeper)
  drive: number
  sub: number        // sub-octave layer gain
  rev: number        // reverb wet
  hi?: number        // highpass before reverb
  lo?: number        // lowpass
  growl?: number     // amplitude modulation rate (growl texture)
  maxDur?: number    // cap in seconds (smooth fadeout) — default 4.5
}
/** cap a signal to maxDur seconds with a smooth exponential tail */
function capDuration(sig: Float32Array, maxDur: number): Float32Array {
  const maxN = Math.floor(maxDur * S.SR)
  if (sig.length <= maxN) return sig
  const out = sig.slice(0, maxN)
  const fadeN = Math.floor(0.5 * S.SR)
  for (let i = 0; i < fadeN; i++) {
    out[maxN - 1 - i] *= i / fadeN
  }
  return out
}
function processRoar(takeName: string, o: RoarOpts, seed: number): Float32Array | null {
  const take = loadTake(takeName)
  if (!take) return null
  const rnd = S.mulberry32(seed)
  let sig = S.pitchShift(take, o.pitch)
  sig = S.distort(sig, o.drive)
  if (o.growl) {
    const n = sig.length
    const lfoFreq = o.growl
    for (let i = 0; i < n; i++) {
      const lfo = 0.72 + 0.28 * Math.sin(2 * Math.PI * lfoFreq * i / S.SR + rnd() * 0.001)
      sig[i] *= lfo
    }
  }
  // sub-octave layer for chest depth
  if (o.sub > 0) {
    const sub = S.pitchShift(sig, 0.5)
    const subLp = S.lowpass(sub, 260)
    for (let i = 0; i < sig.length; i++) sig[i] += (subLp[i] || 0) * o.sub
  }
  if (o.hi) sig = S.highpass(sig, o.hi)
  if (o.lo) sig = S.lowpass(sig, o.lo)
  sig = S.reverb(sig, 0.62, 0.35, o.rev)
  sig = S.ar(sig, 0.015, 0.12)
  sig = capDuration(sig, o.maxDur ?? 4.5)
  return S.normalize(sig, 0.9)
}

/* ---------- render targets ---------- */
interface Out {
  sfx(name: string, sig: Float32Array): void
  music(name: string, sig: Float32Array): void
  amb(name: string, sig: Float32Array): void
}
function makeOut(): Out {
  for (const d of ['sfx', 'music', 'amb']) fs.mkdirSync(path.join(OUT, d), { recursive: true })
  return {
    sfx: (n, s) => S.writeWav(path.join(OUT, 'sfx', n + '.wav'), s),
    music: (n, s) => S.writeWav(path.join(OUT, 'music', n + '.wav'), s),
    amb: (n, s) => S.writeWav(path.join(OUT, 'amb', n + '.wav'), s),
  }
}

function renderAll(out: Out) {
  /* ================= COMBAT ================= */

  // sword swings — airy whoosh with tonal core
  for (let i = 0; i < 5; i++) {
    const rnd = S.mulberry32(1000 + i)
    const dur = 0.3 + i * 0.025
    let w = whoosh(dur, 260 + i * 40, 1150 + i * 160, 1.1, 0.38 + i * 0.03, rnd)
    // add a faint tonal whistle on some variants
    if (i % 2 === 1) {
      const tone = S.sineSweep(dur, 700 + i * 90, 340, 0)
      for (let j = 0; j < tone.length; j++) w[j] += tone[j] * 0.06 * Math.exp(-Math.pow((j / tone.length - 0.4) * 4, 2))
    }
    out.sfx('swing_' + (i + 1), S.normalize(w, 0.85))
  }

  // light swishes — quick, high
  for (let i = 0; i < 4; i++) {
    const rnd = S.mulberry32(1100 + i)
    const w = whoosh(0.17 + i * 0.02, 650 + i * 130, 2400 + i * 300, 1.6, 0.42, rnd)
    out.sfx('swish_' + (i + 1), S.normalize(w, 0.8))
  }

  // metal clashes — bright modal strikes
  for (let i = 0; i < 4; i++) {
    const rnd = S.mulberry32(1200 + i)
    const base = 1500 + i * 190
    let c = S.modalStrike(0.85 + i * 0.1, base, STEEL_MODES.map(m => ({ ...m, tau: m.tau * (0.85 + i * 0.12) })), { strike: 0.8, strikeTone: 0.6, rnd })
    c = S.reverb(c, 0.4, 0.4, 0.14)
    out.sfx('clash_' + (i + 1), S.normalize(c, 0.88))
  }

  // low thumps — impacts
  for (let i = 0; i < 4; i++) {
    const rnd = S.mulberry32(1300 + i)
    const dur = 0.42
    const body = S.sineSweep(dur, 135 - i * 12, 44 + i * 3)
    const nz = S.lowpass(S.noise(0.06, rnd), 900)
    const t = new S.Track(dur)
    for (let j = 0; j < body.length; j++) {
      const env = Math.exp(-j / S.SR / (dur * 0.22))
      t.data[j] += body[j] * env * 0.9
      if (j < nz.length) t.data[j] += nz[j] * (1 - j / nz.length) * 0.5
    }
    out.sfx('thump_' + (i + 1), S.normalize(t.data, 0.9))
  }

  // dull armor metal
  for (let i = 0; i < 3; i++) {
    const rnd = S.mulberry32(1400 + i)
    let m = S.modalStrike(0.4, 680 + i * 160, [
      { r: 1, tau: 0.22, a: 1 }, { r: 1.83, tau: 0.16, a: 0.55 }, { r: 2.76, tau: 0.12, a: 0.3 }, { r: 3.9, tau: 0.08, a: 0.16 },
    ], { strike: 1.1, strikeTone: 0.35, rnd })
    m = S.lowpass(m, 3800)
    out.sfx('metal_' + (i + 1), S.normalize(m, 0.85))
  }

  // chains
  for (let i = 0; i < 2; i++) {
    const rnd = S.mulberry32(1500 + i * 7)
    const dur = 0.55
    const t = new S.Track(dur)
    const dings = 11 + i * 4
    for (let d = 0; d < dings; d++) {
      const tt = (d / dings) * 0.24 + rnd() * 0.02
      const f = 2100 + rnd() * 1900
      const ping = S.modalStrike(0.2, f, [
        { r: 1, tau: 0.09, a: 1 }, { r: 2.7, tau: 0.05, a: 0.4 },
      ], { strike: 0.9, strikeTone: 0.7, rnd })
      t.add(tt, ping, 0.5 + rnd() * 0.5)
    }
    out.sfx('chain_' + (i + 1), S.normalize(t.data, 0.8))
  }

  // long metal ring
  {
    const rnd = S.mulberry32(1600)
    let r = S.modalStrike(2.4, 1180, STEEL_MODES.map(m => ({ ...m, tau: m.tau * 1.9 })), { strike: 0.55, strikeTone: 0.8, rnd })
    r = S.reverb(r, 0.5, 0.35, 0.2)
    out.sfx('metalring', S.normalize(r, 0.8))
  }

  // hurt grunts (TTS + light processing)
  for (let i = 0; i < 2; i++) {
    const take = ['hurt_a', 'hurt_b', 'hurt_c'][i]
    const sig = processRoar(take, { pitch: 0.92 + i * 0.05, drive: 1.6, sub: 0.12, rev: 0.16, lo: 4200 }, 1700 + i)
    if (sig) out.sfx('hurt_' + (i + 1), sig)
  }

  // shade deaths — ghostly reversed wails
  for (let i = 0; i < 3; i++) {
    const take = ['shade_a', 'shade_b', 'shade_c'][i]
    const raw = loadTake(take)
    if (!raw) continue
    let sig = S.pitchShift(reverse(raw), 1.25)
    sig = S.highpass(sig, 260)
    sig = S.reverb(sig, 0.78, 0.3, 0.55)
    sig = S.ar(sig, 0.25, 0.5)
    out.sfx('shade_' + (i + 1), S.normalize(sig, 0.82))
  }

  // skeleton bones rattle
  for (let i = 0; i < 5; i++) {
    const rnd = S.mulberry32(1800 + i * 3)
    const dur = 0.5
    const t = new S.Track(dur)
    const clicks = 9 + Math.floor(rnd() * 6)
    for (let c = 0; c < clicks; c++) {
      const tt = rnd() * 0.3
      const f = 1900 + rnd() * 2600
      const cl = S.modalStrike(0.12, f, [
        { r: 1, tau: 0.045, a: 1 }, { r: 1.9, tau: 0.03, a: 0.5 }, { r: 3.1, tau: 0.02, a: 0.25 },
      ], { strike: 1.2, strikeTone: 0.85, rnd })
      t.add(tt, cl, 0.45 + rnd() * 0.55)
    }
    out.sfx('bones_' + (i + 1), S.normalize(t.data, 0.78))
  }

  // wood knocks
  for (let i = 0; i < 3; i++) {
    const rnd = S.mulberry32(1900 + i)
    const f = 460 + i * 70
    let kp = S.karplus(0.16, f, 0.32, rnd)
    const t = new S.Track(0.34)
    t.add(0, kp, 1)
    const body = S.sineSweep(0.1, 185 + i * 15, 120)
    for (let j = 0; j < body.length; j++) t.data[j] += body[j] * Math.exp(-j / S.SR / 0.03) * 0.8
    const thock = S.lowpass(S.noise(0.012, rnd), 2400)
    for (let j = 0; j < thock.length; j++) t.data[j] += thock[j] * (1 - j / thock.length) * 0.7
    out.sfx('wood_' + (i + 1), S.normalize(t.data, 0.85))
  }

  /* ================= MONSTERS (TTS voices, heavily processed) ================= */

  const roars: [string, RoarOpts][] = [
    ['roar_a', { pitch: 0.52, drive: 3.2, sub: 0.5, rev: 0.28, growl: 26, maxDur: 3.6 }],
    ['roar_b', { pitch: 0.58, drive: 3.6, sub: 0.45, rev: 0.26, growl: 31, maxDur: 3.4 }],
    ['roar_c', { pitch: 0.48, drive: 4.0, sub: 0.55, rev: 0.3, growl: 22, maxDur: 3.2 }],
    ['roar_d', { pitch: 0.62, drive: 3.0, sub: 0.4, rev: 0.24, growl: 35, maxDur: 3.5 }],
    ['roar_e', { pitch: 0.55, drive: 3.4, sub: 0.5, rev: 0.28, growl: 28, maxDur: 3.3 }],
    ['roar_f', { pitch: 0.5, drive: 3.8, sub: 0.52, rev: 0.3, growl: 24, maxDur: 3.8 }],
  ]
  roars.forEach(([take, o], i) => {
    const sig = processRoar(take, o, 2000 + i)
    if (sig) out.sfx('roar_' + (i + 1), sig)
  })

  const deeps: [string, RoarOpts][] = [
    ['deep_a', { pitch: 0.46, drive: 4.2, sub: 0.65, rev: 0.34, growl: 15, lo: 2400, maxDur: 4.0 }],
    ['deep_b', { pitch: 0.42, drive: 4.6, sub: 0.7, rev: 0.36, growl: 13, lo: 2200, maxDur: 4.2 }],
    ['deep_c', { pitch: 0.5, drive: 4.0, sub: 0.6, rev: 0.32, growl: 17, lo: 2600, maxDur: 3.8 }],
    ['deep_d', { pitch: 0.44, drive: 4.4, sub: 0.68, rev: 0.34, growl: 14, lo: 2300, maxDur: 4.2 }],
    ['deep_e', { pitch: 0.48, drive: 4.3, sub: 0.66, rev: 0.35, growl: 16, lo: 2500, maxDur: 4.0 }],
  ]
  deeps.forEach(([take, o], i) => {
    const sig = processRoar(take, o, 2100 + i)
    if (sig) out.sfx('roar_deep_' + (i + 1), sig)
  })

  {
    const sig = processRoar('boss_a', { pitch: 0.5, drive: 5.0, sub: 0.75, rev: 0.4, growl: 20, lo: 3000, maxDur: 4.0 }, 2200)
    if (sig) out.sfx('roar_boss', sig)
  }

  const mons: [string, RoarOpts][] = [
    ['mon_a', { pitch: 0.72, drive: 2.8, sub: 0.3, rev: 0.2, growl: 42, maxDur: 2.2 }],
    ['mon_b', { pitch: 0.68, drive: 3.0, sub: 0.32, rev: 0.2, growl: 47, maxDur: 2.2 }],
    ['mon_c', { pitch: 0.78, drive: 2.6, sub: 0.28, rev: 0.18, growl: 50, maxDur: 2.0 }],
    ['mon_d', { pitch: 0.7, drive: 2.9, sub: 0.3, rev: 0.2, growl: 44, maxDur: 2.2 }],
  ]
  mons.forEach(([take, o], i) => {
    const sig = processRoar(take, o, 2300 + i)
    if (sig) out.sfx('monster_' + (i + 1), sig)
  })

  {
    const a = processRoar('giant_a', { pitch: 0.4, drive: 4.5, sub: 0.8, rev: 0.4, growl: 9, lo: 1600, maxDur: 4.2 }, 2400)
    if (a) out.sfx('giant_1', a)
    const b = processRoar('giant_b', { pitch: 0.37, drive: 4.8, sub: 0.85, rev: 0.42, growl: 8, lo: 1400, maxDur: 4.4 }, 2401)
    if (b) out.sfx('giant_2', b)
  }

  /* ================= ITEMS / UI ================= */

  // soul gems — crystalline plinks
  const gemPitches = [1560, 1840, 2140, 2520]
  gemPitches.forEach((f, i) => {
    const rnd = S.mulberry32(3000 + i)
    const bell = S.fmBell(0.7, f, 3.53, 2.2, 0.09)
    const t = new S.Track(0.75)
    t.add(0, bell, 0.9)
    // sparkle overtone
    const spark = S.fmBell(0.3, f * 1.98, 4.1, 1.4, 0.05)
    t.add(0.03, spark, 0.3)
    const air = S.highpass(S.noise(0.1, rnd), 6000)
    for (let j = 0; j < air.length; j++) t.data[j] += air[j] * (1 - j / air.length) * 0.1
    const g = S.reverb(t.data, 0.45, 0.4, 0.22)
    out.sfx('gem_' + (i + 1), S.normalize(g, 0.8))
  })

  // coins
  for (let i = 0; i < 3; i++) {
    const rnd = S.mulberry32(3100 + i)
    const t = new S.Track(0.42)
    const d1 = S.modalStrike(0.24, 3400 + i * 350, [
      { r: 1, tau: 0.14, a: 1 }, { r: 2.66, tau: 0.09, a: 0.5 }, { r: 4.1, tau: 0.06, a: 0.28 },
    ], { strike: 0.7, strikeTone: 0.9, rnd })
    t.add(0, d1, 1)
    const d2 = S.modalStrike(0.2, 4100 + i * 380, [
      { r: 1, tau: 0.12, a: 1 }, { r: 2.9, tau: 0.07, a: 0.45 },
    ], { strike: 0.6, strikeTone: 0.9, rnd })
    t.add(0.05 + rnd() * 0.02, d2, 0.75)
    out.sfx('coin_' + (i + 1), S.normalize(t.data, 0.78))
  }

  // potion drink
  {
    const rnd = S.mulberry32(3200)
    const t = new S.Track(0.8)
    for (let g = 0; g < 3; g++) {
      const gulp = S.sineSweep(0.13, 340 - g * 60, 110)
      for (let j = 0; j < gulp.length; j++) t.data[Math.floor(g * 0.16 * S.SR) + j] += gulp[j] * Math.exp(-j / S.SR / 0.05) * 0.9
    }
    // glass clink at start
    const clink = S.modalStrike(0.2, 2800, [
      { r: 1, tau: 0.1, a: 1 }, { r: 2.4, tau: 0.06, a: 0.4 },
    ], { strike: 0.8, strikeTone: 0.85, rnd })
    t.add(0, clink, 0.4)
    out.sfx('potion', S.normalize(t.data, 0.82))
  }

  // bubble blips
  {
    const rnd = S.mulberry32(3300)
    const t = new S.Track(0.45)
    for (let b = 0; b < 5; b++) {
      const tt = b * 0.07 + rnd() * 0.02
      const blip = S.sineSweep(0.05, 380 + rnd() * 320, 700 + rnd() * 300)
      for (let j = 0; j < blip.length && Math.floor(tt * S.SR) + j < t.data.length; j++) {
        t.data[Math.floor(tt * S.SR) + j] += blip[j] * Math.exp(-j / S.SR / 0.02) * 0.85
      }
    }
    out.sfx('bubble', S.normalize(t.data, 0.75))
  }

  // spell casts — rising shimmer
  for (let i = 0; i < 2; i++) {
    const rnd = S.mulberry32(3400 + i)
    const dur = 0.95 + i * 0.2
    const t = new S.Track(dur)
    const partials = 7 + i * 3
    for (let p = 0; p < partials; p++) {
      const f0 = 500 + p * 120 + rnd() * 80
      const f1 = f0 * (2.1 + rnd() * 0.8)
      const gl = S.sineSweep(dur * 0.7, f0, f1)
      const start = rnd() * 0.12
      for (let j = 0; j < gl.length; j++) {
        const idx = Math.floor(start * S.SR) + j
        if (idx < t.data.length) t.data[idx] += gl[j] * 0.12 * Math.exp(-j / gl.length * 2)
      }
    }
    const air = S.sweepFilter(S.noise(dur, rnd), 600, 4200, 1.4)
    for (let j = 0; j < air.length; j++) t.data[j] += air[j] * Math.sin((j / air.length) * Math.PI) * 0.5
    const ping = S.fmBell(0.5, 1300 + i * 300, 3.2, 2.0, 0.08)
    t.add(dur * 0.62, ping, 0.5)
    const g = S.reverb(t.data, 0.5, 0.35, 0.25)
    out.sfx('spell_' + (i + 1), S.normalize(g, 0.8))
  }

  // fire whooshes
  const fireSpecs: [number, number, number][] = [[1700, 260, 0.55], [1500, 210, 0.7], [2000, 320, 0.5], [1400, 180, 0.85]]
  fireSpecs.forEach(([f0, f1, dur], i) => {
    const rnd = S.mulberry32(3500 + i)
    const nz = S.brownNoise(dur, rnd)
    const swept = S.sweepFilter(nz, f0, f1, 0.9)
    for (let j = 0; j < swept.length; j++) swept[j] *= Math.sin((j / swept.length) * Math.PI) * 2.6
    const cr = crackle(dur, 26, rnd, 2000, 6000)
    for (let j = 0; j < cr.length; j++) swept[j] += cr[j] * 0.16 * Math.sin((j / cr.length) * Math.PI)
    out.sfx(i < 2 ? 'fire_' + (i + 1) : 'fire_' + (i + 2), S.normalize(swept, 0.85))
  })

  // big fire explosions
  for (let i = 0; i < 2; i++) {
    const rnd = S.mulberry32(3600 + i)
    const dur = 1.7
    const t = new S.Track(dur)
    const boom = S.sineSweep(0.6, 120 - i * 18, 38)
    for (let j = 0; j < boom.length; j++) t.data[j] += boom[j] * Math.exp(-j / S.SR / 0.16) * 1.1
    const rumble = S.lowpass(S.brownNoise(dur, rnd), 320)
    for (let j = 0; j < rumble.length; j++) t.data[j] += rumble[j] * Math.exp(-j / S.SR / 0.5) * 0.8
    const cr = crackle(dur, 40, rnd, 1400, 5600)
    for (let j = 0; j < cr.length; j++) t.data[j] += cr[j] * 0.35 * Math.min(1, j / S.SR / 0.08) * Math.exp(-j / S.SR / 0.7)
    out.sfx('firebig_' + (i + 1), S.normalize(t.data, 0.9))
  }

  // interface clicks — 6 distinct UI sounds
  {
    const rnd = S.mulberry32(3700)
    // 1: woody tick
    let t1 = new S.Track(0.14)
    t1.add(0, S.karplus(0.09, 720, 0.25, rnd), 0.9)
    out.sfx('interface_1', S.normalize(t1.data, 0.72))
    // 2: soft thock
    let t2 = new S.Track(0.16)
    const th = S.sineSweep(0.09, 240, 150)
    for (let j = 0; j < th.length; j++) t2.data[j] += th[j] * Math.exp(-j / S.SR / 0.025) * 0.95
    out.sfx('interface_2', S.normalize(t2.data, 0.7))
    // 3: metallic tick
    let t3 = new S.Track(0.2)
    t3.add(0, S.modalStrike(0.16, 2400, [
      { r: 1, tau: 0.09, a: 1 }, { r: 2.8, tau: 0.05, a: 0.35 },
    ], { strike: 0.8, strikeTone: 0.9, rnd }), 0.85)
    out.sfx('interface_3', S.normalize(t3.data, 0.66))
    // 4: parchment flick
    const pap = S.bandpass(S.noise(0.09, rnd), 1100, 0.8)
    S.ar(pap, 0.006, 0.04)
    out.sfx('interface_4', S.normalize(pap, 0.62))
    // 5: deep confirm
    let t5 = new S.Track(0.3)
    const conf = S.sineSweep(0.22, 420, 310)
    for (let j = 0; j < conf.length; j++) t5.data[j] += conf[j] * Math.exp(-j / S.SR / 0.08) * 0.9
    t5.add(0, S.sine(0.22, 630), 0.25)
    out.sfx('interface_5', S.normalize(t5.data, 0.72))
    // 6: tiny chime
    const t6 = new S.Track(0.3)
    t6.add(0, S.fmBell(0.28, 1900, 3.0, 1.6, 0.05), 0.85)
    out.sfx('interface_6', S.normalize(t6.data, 0.64))
  }

  // unsheathe — steel drawn
  {
    const rnd = S.mulberry32(3800)
    const dur = 0.5
    const shing = S.sweepFilter(S.noise(dur, rnd), 1400, 5600, 2.2)
    for (let j = 0; j < shing.length; j++) {
      const p = j / shing.length
      shing[j] *= Math.min(1, p * 6) * Math.pow(1 - p, 0.6) * 2.4
    }
    const ring = S.modalStrike(dur, 3300, [{ r: 1, tau: 0.3, a: 1 }, { r: 1.5, tau: 0.2, a: 0.4 }], { rnd })
    const t = new S.Track(dur)
    for (let j = 0; j < shing.length; j++) t.data[j] += shing[j] + ring[j] * 0.35 * (j / shing.length)
    out.sfx('unsheathe', S.normalize(t.data, 0.8))
  }

  // bonfire lit — whoosh up + crackle settle
  {
    const rnd = S.mulberry32(3900)
    const dur = 1.7
    const t = new S.Track(dur)
    const rush = S.sweepFilter(S.brownNoise(0.7, rnd), 300, 1600, 0.8)
    for (let j = 0; j < rush.length; j++) rush[j] *= Math.pow(j / rush.length, 1.6) * 2.2
    for (let j = 0; j < rush.length; j++) t.data[j] += rush[j]
    const cr = crackle(dur, 55, rnd, 1200, 5800)
    for (let j = 0; j < cr.length; j++) {
      const p = j / cr.length
      t.data[j] += cr[j] * 0.5 * Math.min(1, p * 5) * (0.6 + 0.4 * Math.exp(-p * 1.4))
    }
    const low = S.lowpass(S.brownNoise(dur, rnd), 240)
    for (let j = 0; j < low.length; j++) t.data[j] += low[j] * Math.min(1, j / S.SR / 0.3) * 0.9
    out.sfx('bonfire_lit', S.normalize(t.data, 0.88))
  }

  /* ================= FOOTSTEPS ================= */

  const stepSet = (prefix: string, kind: 'cloth' | 'leather' | 'metal', count: number, baseSeed: number) => {
    for (let i = 0; i < count; i++) {
      const rnd = S.mulberry32(baseSeed + i)
      const t = new S.Track(0.22)
      if (kind === 'cloth') {
        const puff = S.lowpass(S.noise(0.09, rnd), 520)
        for (let j = 0; j < puff.length; j++) t.data[j] += puff[j] * Math.sin((j / puff.length) * Math.PI) * 1.4
        const tap = S.sineSweep(0.05, 95, 70)
        for (let j = 0; j < tap.length; j++) t.data[j] += tap[j] * Math.exp(-j / S.SR / 0.014) * 0.5
      } else if (kind === 'leather') {
        const scuff = S.bandpass(S.noise(0.08, rnd), 950 + rnd() * 200, 1.1)
        for (let j = 0; j < scuff.length; j++) t.data[j] += scuff[j] * Math.sin((j / scuff.length) * Math.PI) * 1.5
        const tap = S.sineSweep(0.045, 130, 85)
        for (let j = 0; j < tap.length; j++) t.data[j] += tap[j] * Math.exp(-j / S.SR / 0.011) * 0.85
        const slap = S.highpass(S.noise(0.014, rnd), 2800)
        for (let j = 0; j < slap.length; j++) t.data[j] += slap[j] * (1 - j / slap.length) * 0.3
      } else {
        const clank = S.modalStrike(0.14, 1450 + rnd() * 420, [
          { r: 1, tau: 0.07, a: 1 }, { r: 2.4, tau: 0.045, a: 0.45 }, { r: 4.1, tau: 0.03, a: 0.2 },
        ], { strike: 1.1, strikeTone: 0.75, rnd })
        t.add(0, clank, 0.55)
        const tap = S.sineSweep(0.05, 120, 72)
        for (let j = 0; j < tap.length; j++) t.data[j] += tap[j] * Math.exp(-j / S.SR / 0.012) * 1.0
      }
      out.sfx(prefix + (i + 1), S.normalize(t.data, 0.72))
    }
  }
  stepSet('step_cloth_', 'cloth', 4, 4000)
  stepSet('step_leather_', 'leather', 4, 4100)
  stepSet('step_metal_', 'metal', 4, 4200)
}

/* ================= MUSIC ================= */

function renderMusic(out: Out) {
  const NOTE = (semi: number) => 440 * Math.pow(2, semi / 12) // A4 ref
  // D minor: D=2, E=3, F=4... use midi-ish semitones relative to A4=0
  const D3 = -19, D2 = -31, A2 = -26, F3 = -16, E3 = -17

  /** piano-ish additive voice */
  function piano(freq: number, dur: number, bright = 0.5): Float32Array {
    const partials = [1, 2.001, 3.004, 4.012, 5.02]
    const gains = [1, 0.4 * bright + 0.2, 0.22 * bright, 0.12, 0.06]
    const n = Math.ceil(dur * S.SR)
    const out = new Float32Array(n)
    const rnd = Math.random
    for (let p = 0; p < partials.length; p++) {
      const f = freq * partials[p]
      if (f > S.SR * 0.45) break
      const tau = dur * (0.35 / (1 + p * 0.7))
      const w = 2 * Math.PI * f / S.SR
      const ph = rnd() * Math.PI * 2
      for (let i = 0; i < n; i++) {
        out[i] += Math.sin(ph + i * w) * gains[p] * Math.exp(-i / S.SR / tau)
      }
    }
    // hammer
    const hn = Math.floor(0.008 * S.SR)
    for (let i = 0; i < hn; i++) out[i] += (rnd() * 2 - 1) * (1 - i / hn) * 0.3
    return out
  }

  /* ---- explore: somber minecraft × dark souls piano over warm drone ---- */
  {
    const bpm = 60, beat = 60 / bpm, bar = beat * 4, bars = 8
    const dur = bar * bars + 2
    const t = new S.Track(dur)
    // chords (D3-based semitone offsets): Dm, Bb, F, C, Dm, Bb, Gm, A
    const chords = [
      [D3, D3 + 3, D3 + 7, D3 + 12],        // Dm
      [D3 - 4, D3 + 1, D3 + 6, D3 + 10],    // Bb
      [D3 - 3, D3 + 2, D3 + 5, D3 + 9],     // F (A C F)
      [D3 - 7, D3, D3 + 3, D3 + 7],         // C
      [D3, D3 + 3, D3 + 7, D3 + 12],        // Dm
      [D3 - 4, D3 + 1, D3 + 6, D3 + 10],    // Bb
      [D3 - 2, D3 + 2, D3 + 5, D3 + 10],    // Gm
      [D3 - 4, D3 + 3, D3 + 7, D3 + 11],    // A (A C# E)
    ]
    const melody: [number, number][] = [
      [D3 + 14, 0], [D3 + 17, bar * 1.5], [D3 + 19, bar * 2], [D3 + 16, bar * 3],
      [D3 + 14, bar * 4], [D3 + 12, bar * 5.5], [D3 + 10, bar * 6], [D3 + 11, bar * 7],
    ]
    const rnd = S.mulberry32(5000)
    for (let b = 0; b < bars; b++) {
      const ch = chords[b]
      const bt = b * bar
      // broken chord pattern: root, fifth, octave, third+octave
      const pat = [0, 2, 3, 1, 2, 3, 2, 1]
      for (let s = 0; s < pat.length; s++) {
        const noteIdx = pat[s]
        const f = NOTE(ch[noteIdx])
        const tt = bt + s * beat * 0.5
        t.add(tt, piano(f, 1.6, 0.55), 0.24)
      }
      // bass note
      t.add(bt, piano(NOTE(ch[0] - 12), 2.4, 0.3), 0.2)
    }
    // melody line
    for (const [semi, tt] of melody) {
      t.add(tt, piano(NOTE(semi), 2.2, 0.65), 0.2)
    }
    // warm pad: detuned saws → lowpass
    for (const [semi, tt] of melody.map(([s, x]) => [s - 12, x] as [number, number])) {
      const f = NOTE(semi)
      const padDur = 2.8
      const n = Math.floor(padDur * S.SR)
      const pad = new Float32Array(n)
      for (const det of [0.997, 1.004]) {
        let ph = 0
        for (let i = 0; i < n; i++) {
          ph += f * det / S.SR
          if (ph >= 1) ph -= 1
          pad[i] += (ph * 2 - 1) * 0.5
        }
      }
      const padLp = S.lowpass(pad, 640)
      for (let i = 0; i < n; i++) {
        const env = Math.min(1, i / (0.5 * S.SR)) * Math.min(1, (n - i) / (0.6 * S.SR))
        const idx = Math.floor(tt * S.SR) + i
        if (idx < t.data.length) t.data[idx] += padLp[i] * env * 0.055
      }
    }
    // sub drone D2
    const drone = S.sine(dur, NOTE(D2))
    const drone2 = S.sine(dur, NOTE(D2) * 1.003)
    for (let i = 0; i < t.data.length; i++) t.data[i] += (drone[i] + drone2[i]) * 0.5 * 0.07
    const wet = S.reverb(t.data, 0.68, 0.4, 0.3)
    out.music('explore', S.makeLoop(S.normalize(wet, 0.85), 1.5))
  }

  /* ---- dread: dark drone cluster + sparse notes ---- */
  {
    const dur = 30
    const t = new S.Track(dur)
    const rnd = S.mulberry32(5100)
    // dissonant drone cluster D2, Eb2, A1
    const cluster = [NOTE(D2), NOTE(D2 + 1), NOTE(D2 - 7)]
    for (const [ci, f] of cluster.entries()) {
      const lfoRate = 0.07 + ci * 0.05
      const sawS = S.saw(dur, f)
      const lp = S.lowpass(sawS, 220 + ci * 80)
      for (let i = 0; i < t.data.length; i++) {
        const lfo = 0.7 + 0.3 * Math.sin(2 * Math.PI * lfoRate * i / S.SR + ci * 2.1)
        t.data[i] += lp[i] * lfo * (0.05 + ci * 0.012)
      }
    }
    // sparse low piano notes
    const notes: [number, number][] = [
      [D2 - 12, 3], [D2 - 5, 9], [D2 - 1, 14.5], [D2 - 12, 21], [D2 - 8, 26]
    ]
    for (const [semi, tt] of notes) {
      t.add(tt, piano(NOTE(semi), 3.2, 0.25), 0.3)
    }
    // wind sweeps
    const windN = S.bandpass(S.brownNoise(dur, rnd), 380, 0.5)
    for (let i = 0; i < windN.length; i++) {
      const lfo = 0.5 + 0.5 * Math.sin(2 * Math.PI * 0.05 * i / S.SR + 1)
      t.data[i] += windN[i] * lfo * 0.35
    }
    // distant metallic groan
    const groan = S.modalStrike(4, 82, [
      { r: 1, tau: 2.4, a: 1 }, { r: 1.51, tau: 1.8, a: 0.6 }, { r: 2.33, tau: 1.2, a: 0.3 },
    ], { rnd })
    t.add(11, groan, 0.16)
    const wet = S.reverb(t.data, 0.78, 0.45, 0.32)
    out.music('dread', S.makeLoop(S.normalize(wet, 0.8), 2))
  }

  /* ---- boss: taiko + ostinato + brass stabs ---- */
  {
    const bpm = 132, beat = 60 / bpm, bar = beat * 4, bars = 8
    const dur = bar * bars + 1.5
    const t = new S.Track(dur)
    const rnd = S.mulberry32(5200)
    const eighth = beat / 2
    // ostinato D2 eighth notes
    for (let e = 0; e < bars * 8; e++) {
      const tt = e * eighth
      const accent = e % 8 === 0 ? 1.25 : e % 2 === 0 ? 1 : 0.8
      const sawS = S.saw(0.22, NOTE(D2) * (e % 16 === 14 ? 1.335 : 1)) // occasional Eb color
      const lp = S.lowpass(sawS, 820)
      for (let i = 0; i < lp.length; i++) {
        const idx = Math.floor(tt * S.SR) + i
        if (idx < t.data.length) t.data[idx] += lp[i] * Math.exp(-i / S.SR / 0.09) * 0.16 * accent
      }
    }
    // taiko pattern
    for (let b = 0; b < bars; b++) {
      const pat = [1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0.6, 0.6]
      for (let s = 0; s < pat.length; s++) {
        const v = pat[s]
        if (!v) continue
        const tt = b * bar + s * eighth
        const m = S.membrane(0.4, 92 - (s === 0 ? 8 : 0), 42, v > 0.9 ? 0.5 : 0.3, rnd)
        t.add(tt, m, 0.6 * v)
      }
    }
    // brass-ish stabs each bar
    for (let b = 0; b < bars; b++) {
      const chSemi = b % 4 === 3 ? [D2 + 8, D2 + 11, D2 + 15] : [D2 + 7, D2 + 10, D2 + 14] // C then A color
      const tt = b * bar
      const stabDur = 0.7
      const n = Math.floor(stabDur * S.SR)
      const stab = new Float32Array(n)
      for (const semi of chSemi) {
        for (const det of [0.996, 1.005]) {
          let ph = 0
          const f = NOTE(semi)
          for (let i = 0; i < n; i++) {
            ph += f * det / S.SR
            if (ph >= 1) ph -= 1
            stab[i] += (ph * 2 - 1) * 0.33
          }
        }
      }
      const stabLp = S.lowpass(stab, 1300)
      for (let i = 0; i < n; i++) {
        const env = Math.min(1, i / (0.09 * S.SR)) * Math.exp(-i / S.SR / 0.3)
        const idx = Math.floor(tt * S.SR) + i
        if (idx < t.data.length) t.data[idx] += stabLp[i] * env * 0.11
      }
    }
    // crash accents every 2 bars
    for (let b = 0; b < bars; b += 2) {
      const tt = b * bar
      const cr = S.highpass(S.noise(0.8, rnd), 3800)
      for (let i = 0; i < cr.length; i++) {
        const idx = Math.floor(tt * S.SR) + i
        if (idx < t.data.length) t.data[idx] += cr[i] * Math.exp(-i / S.SR / 0.18) * 0.1
      }
    }
    const wet = S.reverb(t.data, 0.5, 0.35, 0.2)
    out.music('boss', S.makeLoop(S.normalize(wet, 0.88), 0.8))
  }
}

/* ================= AMBIENCE ================= */

function renderAmbience(out: Out) {
  // wind loop
  {
    const rnd = S.mulberry32(6000)
    const dur = 16
    const n = Math.ceil(dur * S.SR)
    const out1 = new Float32Array(n)
    const base = S.brownNoise(dur, rnd)
    const f = new S.Biquad()
    for (let i = 0; i < n; i++) {
      const t = i / S.SR
      const center = 420 + 260 * Math.sin(2 * Math.PI * 0.06 * t) + 120 * Math.sin(2 * Math.PI * 0.17 * t + 1.3)
      f.set('bandpass', center, 0.55)
      const gust = 0.6 + 0.4 * Math.sin(2 * Math.PI * 0.045 * t + 0.7)
      out1[i] = f.process(base[i]) * gust * 2.4
    }
    out.amb('wind_loop', S.makeLoop(S.normalize(out1, 0.7), 1.5))
  }

  // fire loop
  {
    const rnd = S.mulberry32(6100)
    const dur = 14
    const n = Math.ceil(dur * S.SR)
    const out1 = new Float32Array(n)
    const cr = crackle(dur, 34, rnd, 1100, 5200)
    const rumble = S.lowpass(S.brownNoise(dur, rnd), 200)
    const roarN = S.bandpass(S.brownNoise(dur, rnd), 500, 0.6)
    for (let i = 0; i < n; i++) {
      const t = i / S.SR
      const flicker = 0.8 + 0.2 * Math.sin(2 * Math.PI * 0.5 * t) * Math.sin(2 * Math.PI * 0.13 * t)
      out1[i] = cr[i] * 0.5 * flicker + rumble[i] * 0.7 + roarN[i] * 0.3
    }
    out.amb('fire_loop', S.makeLoop(S.normalize(out1, 0.72), 1.2))
  }

  // dungeon loop — deep drone + drips
  {
    const rnd = S.mulberry32(6200)
    const dur = 16
    const t = new S.Track(dur)
    const drone1 = S.sine(dur, 55)
    const drone2 = S.sine(dur, 55 * 1.501) // slightly inharmonic fifth
    const drone3 = S.saw(dur, 36.7)
    const drone3Lp = S.lowpass(drone3, 120)
    for (let i = 0; i < t.data.length; i++) {
      const lfo = 0.85 + 0.15 * Math.sin(2 * Math.PI * 0.08 * i / S.SR)
      t.data[i] += (drone1[i] * 0.4 + drone2[i] * 0.14 + drone3Lp[i] * 0.3) * lfo
    }
    // air hiss
    const hiss = S.bandpass(S.brownNoise(dur, rnd), 900, 0.4)
    for (let i = 0; i < t.data.length; i++) t.data[i] += hiss[i] * 0.2
    // drips with reverb
    for (let d = 0; d < 4; d++) {
      const tt = 1.5 + d * 3.4 + rnd() * 1.2
      const f0 = 800 + rnd() * 700
      const drip = S.sineSweep(0.09, f0, f0 * 0.45)
      for (let j = 0; j < drip.length; j++) drip[j] *= Math.exp(-j / S.SR / 0.022)
      const wet = S.reverb(drip, 0.8, 0.4, 0.6)
      t.add(tt, wet, 0.5)
    }
    out.amb('dungeon_loop', S.makeLoop(S.normalize(t.data, 0.62), 1.5))
  }
}

/* ================= main ================= */
function main() {
  const out = makeOut()
  console.log('rendering sfx...')
  renderAll(out)
  console.log('rendering music...')
  renderMusic(out)
  console.log('rendering ambience...')
  renderAmbience(out)
  console.log('done.')
}
main()
