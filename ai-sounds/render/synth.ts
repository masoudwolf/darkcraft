/* DarkCraft AI sound design — DSP synthesis primitives.
   A modular synth toolkit used by the AI sound-designer pipeline to render
   every game sound: modal metal, noise whooshes, membrane drums, FM bells,
   granular fire, freeverb, waveshapers, TTS vocal processing. */

import fs from 'fs'

export const SR = 44100

/* ---------- seeded rng ---------- */
export function mulberry32(seed: number) {
  let a = seed >>> 0
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/* ---------- track ---------- */
export class Track {
  data: Float32Array
  constructor(seconds: number) {
    this.data = new Float32Array(Math.max(1, Math.ceil(seconds * SR)))
  }
  get length() {
    return this.data.length
  }
  get dur() {
    return this.data.length / SR
  }
  /** add a mono signal starting at time t (seconds), with gain */
  add(t: number, sig: Float32Array, gain = 1) {
    const off = Math.round(t * SR)
    const n = Math.min(sig.length, this.data.length - off)
    for (let i = 0; i < n; i++) this.data[off + i] += sig[i] * gain
  }
  /** overwrite-free additive one-pole style: multiply-accumulate everywhere */
  mulAcc(sig: Float32Array, gain = 1) {
    const n = Math.min(sig.length, this.data.length)
    for (let i = 0; i < n; i++) this.data[i] += sig[i] * gain
  }
  static from(sig: Float32Array) {
    const t = new Track(0)
    t.data = sig
    return t
  }
}

/* ---------- envelopes ---------- */
/** exponential decay curve value at normalized time p (0..1) */
export function expEnv(p: number, tau: number): number {
  return Math.exp(-p / tau)
}
/** build a signal = env(t) * src(t) for dur seconds */
export function envelop(
  dur: number,
  f: (t: number, p: number) => number
): Float32Array {
  const n = Math.ceil(dur * SR)
  const out = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const t = i / SR
    out[i] = f(t, t / dur)
  }
  return out
}

/* ---------- noise ---------- */
export function noise(dur: number, rnd: () => number): Float32Array {
  const n = Math.ceil(dur * SR)
  const out = new Float32Array(n)
  for (let i = 0; i < n; i++) out[i] = rnd() * 2 - 1
  return out
}
/** brown-ish noise (integrated white) */
export function brownNoise(dur: number, rnd: () => number): Float32Array {
  const n = Math.ceil(dur * SR)
  const out = new Float32Array(n)
  let last = 0
  for (let i = 0; i < n; i++) {
    last = (last + 0.02 * (rnd() * 2 - 1)) / 1.02
    out[i] = last * 3.5
  }
  return out
}

/* ---------- biquad (RBJ cookbook, per-sample mutable cutoff) ---------- */
export class Biquad {
  b0 = 1; b1 = 0; b2 = 0; a1 = 0; a2 = 0
  private x1 = 0; x2 = 0; y1 = 0; y2 = 0
  set(type: 'lowpass' | 'highpass' | 'bandpass' | 'notch' | 'peaking', freq: number, Q = 0.707, dbGain = 0) {
    freq = Math.max(20, Math.min(SR * 0.49, freq))
    const w0 = 2 * Math.PI * freq / SR
    const cw = Math.cos(w0), sw = Math.sin(w0)
    const A = Math.pow(10, dbGain / 40)
    let alpha: number, a0: number
    switch (type) {
      case 'lowpass': alpha = sw / (2 * Q); a0 = 1 + alpha
        this.b0 = (1 - cw) / 2; this.b1 = 1 - cw; this.b2 = (1 - cw) / 2
        this.a1 = -2 * cw; this.a2 = 1 - alpha; break
      case 'highpass': alpha = sw / (2 * Q); a0 = 1 + alpha
        this.b0 = (1 + cw) / 2; this.b1 = -(1 + cw); this.b2 = (1 + cw) / 2
        this.a1 = -2 * cw; this.a2 = 1 - alpha; break
      case 'bandpass': alpha = sw / (2 * Q); a0 = 1 + alpha
        this.b0 = alpha; this.b1 = 0; this.b2 = -alpha
        this.a1 = -2 * cw; this.a2 = 1 - alpha; break
      case 'notch': alpha = sw / (2 * Q); a0 = 1 + alpha
        this.b0 = 1; this.b1 = -2 * cw; this.b2 = 1
        this.a1 = -2 * cw; this.a2 = 1 - alpha; break
      case 'peaking': {
        alpha = sw / (2 * Q); a0 = 1 + alpha / A
        this.b0 = 1 + alpha * A; this.b1 = -2 * cw; this.b2 = 1 - alpha * A
        this.a1 = -2 * cw; this.a2 = 1 - alpha / A; break
      }
    }
    this.b0 /= a0; this.b1 /= a0; this.b2 /= a0
    this.a1 /= a0; this.a2 /= a0
  }
  process(x: number): number {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2
    this.x2 = this.x1; this.x1 = x; this.y2 = this.y1; this.y1 = y
    return y
  }
  reset() { this.x1 = this.x2 = this.y1 = this.y2 = 0 }
}

/** filter a whole signal (static cutoff) */
export function filter(sig: Float32Array, type: Parameters<Biquad['set']>[0], freq: number, Q = 0.707, dbGain = 0): Float32Array {
  const f = new Biquad()
  f.set(type, freq, Q, dbGain)
  const out = new Float32Array(sig.length)
  for (let i = 0; i < sig.length; i++) out[i] = f.process(sig[i])
  return out
}
/** bandpass with center freq sweeping f0→f1 across the signal */
export function sweepFilter(sig: Float32Array, f0: number, f1: number, Q = 2): Float32Array {
  const f = new Biquad()
  const out = new Float32Array(sig.length)
  for (let i = 0; i < sig.length; i++) {
    const p = i / sig.length
    const freq = f0 * Math.pow(f1 / f0, p) // exponential sweep
    f.set('bandpass', freq, Q)
    out[i] = f.process(sig[i])
  }
  return out
}

/* ---------- oscillators ---------- */
/** sine with frequency sweep f0→f1 (exponential) */
export function sineSweep(dur: number, f0: number, f1: number, phase0 = 0): Float32Array {
  const n = Math.ceil(dur * SR)
  const out = new Float32Array(n)
  let ph = phase0
  for (let i = 0; i < n; i++) {
    const p = i / n
    const f = f0 * Math.pow(f1 / f0, p)
    ph += 2 * Math.PI * f / SR
    out[i] = Math.sin(ph)
  }
  return out
}
export function sine(dur: number, f: number, phase0 = 0): Float32Array {
  const n = Math.ceil(dur * SR)
  const out = new Float32Array(n)
  let ph = phase0
  for (let i = 0; i < n; i++) { ph += 2 * Math.PI * f / SR; out[i] = Math.sin(ph) }
  return out
}
/** saw (polyblep-lite — just naive, fine after filtering) */
export function saw(dur: number, f: number): Float32Array {
  const n = Math.ceil(dur * SR)
  const out = new Float32Array(n)
  let ph = 0
  for (let i = 0; i < n; i++) { ph += f / SR; if (ph >= 1) ph -= 1; out[i] = ph * 2 - 1 }
  return out
}

/* ---------- modal synthesis (metal, glass, wood bodies) ---------- */
export interface Mode {
  /** ratio to base freq */
  r: number
  /** decay time seconds */
  tau: number
  /** amplitude 0..1 */
  a: number
}
/**
 * Inharmonic modal strike — the backbone of convincing metal/wood/glass.
 * strike: optional broadband exciter mixed into the first 20ms.
 */
export function modalStrike(
  dur: number,
  baseFreq: number,
  modes: Mode[],
  opts: { strike?: number; strikeTone?: number; rnd: () => number; detune?: number } 
): Float32Array {
  const n = Math.ceil(dur * SR)
  const out = new Float32Array(n)
  const det = opts.detune ?? 1
  for (const m of modes) {
    const f = baseFreq * m.r * det * (1 + (opts.rnd() - 0.5) * 0.004)
    if (f > SR * 0.45) continue
    const w = 2 * Math.PI * f / SR
    const ph = opts.rnd() * Math.PI * 2
    const k = Math.max(1 / (m.tau * SR), 1e-7) // per-sample decay factor
    const decay = Math.exp(-k)
    let amp = m.a
    for (let i = 0; i < n; i++) {
      out[i] += amp * Math.sin(ph + i * w)
      amp *= decay
      if (amp < 1e-5) break
    }
  }
  // strike transient
  if (opts.strike) {
    const st = Math.min(0.03, dur * 0.2)
    const sn = Math.ceil(st * SR)
    let lp = 0
    const tone = opts.strikeTone ?? 0.5
    for (let i = 0; i < sn; i++) {
      const w = opts.rnd() * 2 - 1
      lp = lp + tone * (w - lp)
      out[i] += (w - lp) * opts.strike * (1 - i / sn)
    }
  }
  return out
}

/* ---------- Karplus-Strong pluck (piano/harp-ish, wood) ---------- */
export function karplus(dur: number, freq: number, bright = 0.5, rnd: () => number = Math.random): Float32Array {
  const N = Math.max(2, Math.round(SR / freq))
  const n = Math.ceil(dur * SR)
  const out = new Float32Array(n)
  const buf = new Float32Array(N)
  for (let i = 0; i < N; i++) buf[i] = rnd() * 2 - 1
  let idx = 0
  const damp = 0.5 * (1 - bright) + 0.499 // 0.499..~0.999
  for (let i = 0; i < n; i++) {
    const cur = buf[idx]
    const nxt = buf[(idx + 1) % N]
    out[i] = cur
    buf[idx] = damp * 0.5 * (cur + nxt)
    idx = (idx + 1) % N
  }
  return out
}

/* ---------- FM bell / chime ---------- */
export function fmBell(dur: number, f: number, ratio: number, index: number, indexDecay: number): Float32Array {
  const n = Math.ceil(dur * SR)
  const out = new Float32Array(n)
  let phC = 0, phM = 0
  for (let i = 0; i < n; i++) {
    const t = i / SR
    const idx = index * Math.exp(-t / indexDecay)
    phM += 2 * Math.PI * f * ratio / SR
    phC += 2 * Math.PI * f / SR
    out[i] = Math.sin(phC + idx * Math.sin(phM)) * Math.exp(-t / (dur * 0.4))
  }
  return out
}

/* ---------- membrane drum (taiko/tom) ---------- */
export function membrane(dur: number, f0: number, f1: number, slap: number, rnd: () => number): Float32Array {
  const body = sineSweep(dur, f0, f1)
  const n = body.length
  const out = new Float32Array(n)
  const nz = noise(0.02, rnd)
  for (let i = 0; i < n; i++) {
    const t = i / SR
    const env = Math.exp(-t / (dur * 0.25))
    out[i] = body[i] * env
    if (i < nz.length) out[i] += nz[i] * slap * Math.exp(-t / 0.008)
  }
  return out
}

/* ---------- waveshaper distortion ---------- */
export function distort(sig: Float32Array, drive: number): Float32Array {
  const out = new Float32Array(sig.length)
  for (let i = 0; i < sig.length; i++) out[i] = Math.tanh(sig[i] * drive) / Math.tanh(drive)
  return out
}

/* ---------- simple pitch-down by resampling (changes duration too — good for monsters) ---------- */
export function pitchShift(sig: Float32Array, ratio: number): Float32Array {
  // ratio 0.5 = one octave down, double length
  const n = Math.floor(sig.length / ratio)
  const out = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const src = i * ratio
    const i0 = Math.floor(src)
    const frac = src - i0
    const a = sig[Math.min(i0, sig.length - 1)]
    const b = sig[Math.min(i0 + 1, sig.length - 1)]
    out[i] = a + (b - a) * frac
  }
  return out
}

/* ---------- freeverb-ish reverb ---------- */
export function reverb(sig: Float32Array, roomSize = 0.72, damp = 0.4, wet = 0.3): Float32Array {
  const combTunings = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617]
  const apTunings = [556, 441, 341, 225]
  const stereoSpread = 23
  const fb = 0.7 + roomSize * 0.28
  const damp1 = damp * 0.4, damp2 = 1 - damp1
  const combs: { buf: Float32Array; idx: number; store: number }[] = combTunings.map(t => ({
    buf: new Float32Array(t + stereoSpread), idx: 0, store: 0,
  }))
  const aps: { buf: Float32Array; idx: number }[] = apTunings.map(t => ({
    buf: new Float32Array(t + stereoSpread), idx: 0,
  }))
  const out = new Float32Array(sig.length)
  for (let i = 0; i < sig.length; i++) {
    const x = sig[i]
    let acc = 0
    for (const c of combs) {
      const y = c.buf[c.idx]
      c.store = y * damp2 + x * damp1
      c.buf[c.idx] = c.store * fb + x * 0.015
      if (++c.idx >= c.buf.length) c.idx = 0
      acc += y
    }
    acc /= combs.length
    for (const a of aps) {
      const bufOut = a.buf[a.idx]
      const y = -acc + bufOut
      a.buf[a.idx] = acc + bufOut * 0.5
      if (++a.idx >= a.buf.length) a.idx = 0
      acc = y
    }
    out[i] = x + acc * wet * 1.6
  }
  return out
}

/* ---------- utility shaping ---------- */
export function normalize(sig: Float32Array, peak = 0.92): Float32Array {
  let max = 1e-9
  for (let i = 0; i < sig.length; i++) max = Math.max(max, Math.abs(sig[i]))
  const g = peak / max
  const out = new Float32Array(sig.length)
  for (let i = 0; i < sig.length; i++) out[i] = sig[i] * g
  return out
}
export function fadeIn(sig: Float32Array, secs: number): Float32Array {
  const n = Math.min(sig.length, Math.ceil(secs * SR))
  for (let i = 0; i < n; i++) sig[i] *= i / n
  return sig
}
export function fadeOut(sig: Float32Array, secs: number): Float32Array {
  const n = Math.min(sig.length, Math.ceil(secs * SR))
  const off = sig.length - n
  for (let i = 0; i < n; i++) sig[off + i] *= 1 - i / n
  return sig
}
/** seamless loop: crossfade the tail into the head */
export function makeLoop(sig: Float32Array, xfadeSecs = 1.0): Float32Array {
  const X = Math.floor(xfadeSecs * SR)
  const L = sig.length - X
  if (L < SR) return sig
  const out = new Float32Array(L)
  for (let i = 0; i < L; i++) out[i] = sig[i]
  for (let i = 0; i < X; i++) {
    const a = i / X
    out[i] = sig[i] * a + sig[L + i] * (1 - a)
  }
  return out
}
/** simple one-pole lowpass for whole signal */
export function lowpass(sig: Float32Array, freq: number): Float32Array {
  const f = new Biquad()
  f.set('lowpass', freq, 0.707)
  const out = new Float32Array(sig.length)
  for (let i = 0; i < sig.length; i++) out[i] = f.process(sig[i])
  return out
}
export function highpass(sig: Float32Array, freq: number): Float32Array {
  const f = new Biquad()
  f.set('highpass', freq, 0.707)
  const out = new Float32Array(sig.length)
  for (let i = 0; i < sig.length; i++) out[i] = f.process(sig[i])
  return out
}
export function bandpass(sig: Float32Array, freq: number, Q = 1): Float32Array {
  const f = new Biquad()
  f.set('bandpass', freq, Q)
  const out = new Float32Array(sig.length)
  for (let i = 0; i < sig.length; i++) out[i] = f.process(sig[i])
  return out
}
/** fade envelope applied multiplicatively: attack a secs, release r secs */
export function ar(sig: Float32Array, a = 0.005, r = 0.02): Float32Array {
  const na = Math.min(sig.length, Math.ceil(a * SR))
  const nr = Math.min(sig.length, Math.ceil(r * SR))
  const off = sig.length - nr
  for (let i = 0; i < na; i++) sig[i] *= i / na
  for (let i = 0; i < nr; i++) sig[off + i] *= 1 - i / nr
  return sig
}

/* ---------- wav io ---------- */
export function writeWav(path: string, sig: Float32Array) {
  const n = sig.length
  const buf = Buffer.alloc(44 + n * 2)
  buf.write('RIFF', 0)
  buf.writeUInt32LE(36 + n * 2, 4)
  buf.write('WAVE', 8)
  buf.write('fmt ', 12)
  buf.writeUInt32LE(16, 16)
  buf.writeUInt16LE(1, 20) // PCM
  buf.writeUInt16LE(1, 22) // mono
  buf.writeUInt32LE(SR, 24)
  buf.writeUInt32LE(SR * 2, 28)
  buf.writeUInt16LE(2, 32)
  buf.writeUInt16LE(16, 34)
  buf.write('data', 36)
  buf.writeUInt32LE(n * 2, 40)
  for (let i = 0; i < n; i++) {
    const v = Math.max(-1, Math.min(1, sig[i]))
    buf.writeInt16LE(Math.round(v * 32767), 44 + i * 2)
  }
  fs.writeFileSync(path, buf)
}
/** read a 16-bit PCM wav (mono or first channel), resampled to SR */
export function readWav(path: string): Float32Array {
  const buf = fs.readFileSync(path)
  // find data chunk
  let pos = 12
  let dataOff = 0, dataLen = 0
  let fmt: { ch: number; rate: number; bits: number } = { ch: 1, rate: 44100, bits: 16 }
  while (pos + 8 <= buf.length) {
    const id = buf.toString('ascii', pos, pos + 4)
    const size = buf.readUInt32LE(pos + 4)
    if (id === 'fmt ') {
      fmt.ch = buf.readUInt16LE(pos + 10)
      fmt.rate = buf.readUInt32LE(pos + 12)
      fmt.bits = buf.readUInt16LE(pos + 22)
    } else if (id === 'data') {
      dataOff = pos + 8
      dataLen = Math.min(size, buf.length - dataOff)
      break
    }
    pos += 8 + size + (size % 2)
  }
  if (!dataOff) throw new Error('no data chunk in ' + path)
  const ch = fmt.ch
  const bytesPer = fmt.bits / 8
  const frames = Math.floor(dataLen / (bytesPer * ch))
  const src = new Float32Array(frames)
  for (let i = 0; i < frames; i++) {
    const o = dataOff + i * bytesPer * ch
    src[i] = fmt.bits === 16 ? buf.readInt16LE(o) / 32768 : buf.readUInt8(o) / 128 - 0.5
  }
  // resample to SR (linear)
  if (fmt.rate === SR) return src
  const ratio = SR / fmt.rate
  const n = Math.floor(frames * ratio)
  const out = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const s = i / ratio
    const i0 = Math.floor(s)
    const fr = s - i0
    const a = src[Math.min(i0, frames - 1)]
    const b = src[Math.min(i0 + 1, frames - 1)]
    out[i] = a + (b - a) * fr
  }
  return out
}
