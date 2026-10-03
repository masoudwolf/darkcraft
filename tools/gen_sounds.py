#!/usr/bin/env python3
"""
DarkCraft — in-house SFX generation (v2, "instantly recognizable" pass).

Design rules learned from user feedback (the previous AI batch was unclear):
  * every effect follows a CLASSIC, archetypal sound-design formula so the
    player instantly knows what happened:
      swing       -> pure airy whoosh (no tone)
      hit         -> thump + smack transient
      block       -> bright metallic ting (inharmonic partials)
      roar        -> growling pitch-fall (sub + AM growl + breath)
      levelUp     -> ascending solemn bell arpeggio
      hiss        -> rising fuse noise, abrupt cut
      boom        -> sub drop + noise blast + crack
  * short, punchy, correct register (low thumps for impacts, high for UI)
  * no extreme processing, no TTS vocals, subtle reverb only where it helps

Output: public/sounds/sfx/<method>.ogg  (one file per Sfx method)
"""

import os
import subprocess
import wave

import numpy as np
from scipy import signal

SR = 44100
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public", "sounds", "sfx")
rng = np.random.default_rng(20260404)


# ----------------------------------------------------------------------------
# primitives
# ----------------------------------------------------------------------------

def tt(dur):
    return np.arange(int(round(dur * SR))) / SR


def sine_sweep(f0, f1, dur, curve="exp"):
    """phase-accumulated sine with pitch sweep (click-free)"""
    t = tt(dur)
    if curve == "exp":
        f = f0 * (f1 / f0) ** (t / max(dur, 1e-6))
    else:  # linear
        f = f0 + (f1 - f0) * (t / dur)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph)


def poly_sweep(f0, f1, dur, wave_="saw", contour=None):
    """phase-accumulated saw/square/triangle with optional contour multiplier"""
    t = tt(dur)
    base = f0 * (f1 / f0) ** (t / max(dur, 1e-6))
    if contour is not None:
        base = base * contour[: len(t)]
    ph = np.cumsum(base) / SR
    ph = ph - np.floor(ph)
    if wave_ == "saw":
        y = 2 * ph - 1
    elif wave_ == "square":
        y = np.where(ph < 0.5, 1.0, -1.0)
    else:  # triangle
        y = 2 * np.abs(2 * ph - 1) - 1
    # soften squares/triangles a touch (less buzzy, more game-like)
    if wave_ in ("square", "triangle"):
        y = signal.sosfilt(signal.butter(2, 2400, "lowpass", fs=SR, output="sos"), y)
    return y


def noise(dur):
    return rng.standard_normal(int(round(dur * SR)))


def brown(dur):
    x = np.cumsum(rng.standard_normal(int(round(dur * SR))))
    x -= np.linspace(x[0], x[-1], len(x))  # remove drift
    return x / (np.max(np.abs(x)) + 1e-9)


def env_ad(dur, a, tau):
    """attack + exponential decay"""
    t = tt(dur)
    att = np.minimum(t / max(a, 1e-4), 1.0)
    dec = np.exp(-np.maximum(t - a, 0) / tau)
    return att * dec


def env_bell(dur, p=1.3):
    t = tt(dur)
    return np.sin(np.pi * t / dur) ** p


def env_rise(dur, p=1.4):
    t = tt(dur)
    return (t / dur) ** p


def lp(x, fc, order=2):
    return signal.sosfiltfilt(signal.butter(order, fc, "lowpass", fs=SR, output="sos"), x)


def hp(x, fc, order=2):
    return signal.sosfiltfilt(signal.butter(order, fc, "highpass", fs=SR, output="sos"), x)


def bp(x, lo, hi, order=2):
    return signal.sosfiltfilt(
        signal.butter(order, [lo, hi], "bandpass", fs=SR, output="sos"), x
    )


def sweep_f(f0, f1, dur, curve="exp"):
    t = tt(dur)
    if curve == "exp":
        return f0 * (f1 / f0) ** (t / max(dur, 1e-6))
    return f0 + (f1 - f0) * (t / dur)


def svf(x, f0_arr, damping=0.6, band="band"):
    """Chamberlin state-variable filter with per-sample cutoff (sweeps).
    band in {'low','band','high'} — click-free swept filtering."""
    f = 2 * np.sin(np.pi * np.asarray(f0_arr) / SR)
    low = 0.0
    b = 0.0
    y = np.empty(len(x))
    for i in range(len(x)):
        fi = f[i]
        high = x[i] - low - damping * b
        b += fi * high
        low += fi * b
        if band == "band":
            y[i] = b
        elif band == "low":
            y[i] = low
        else:
            y[i] = high
    return y


def drive(x, k):
    return np.tanh(k * x) / np.tanh(k)


def am(x, fm, depth):
    t = tt(len(x) / SR)
    return x * (1 - depth + depth * (0.5 + 0.5 * np.sin(2 * np.pi * fm * t)))


def bell(f, dur, tau, partials=(1, 2.76, 5.4), amps=(1, 0.4, 0.18)):
    """simple modal bell — sine + inharmonic partials, each decaying"""
    n = int(round(dur * SR))
    t = tt(dur)
    out = np.zeros(n)
    for p, a in zip(partials, amps):
        det = 1 + rng.uniform(-0.001, 0.001)
        out += (
            a
            * np.sin(2 * np.pi * f * p * det * t + rng.uniform(0, 6.28))
            * np.exp(-t / (tau / p**0.7))
        )
    return out


def _comb(x, D, g):
    """feedback comb filter, vectorized over D-sized chunks (y[n] = x[n] + g*y[n-D])"""
    xp = np.pad(x, (0, D))
    buf = np.zeros_like(xp, dtype=np.float64)
    buf[:D] = xp[:D]
    for k in range(D, len(xp), D):
        end = min(k + D, len(xp))
        m = end - k
        buf[k:end] = xp[k:end] + g * buf[k - m : k]
    return buf[: len(x)]


def _allpass(x, D, g):
    """allpass filter, chunked (y[n] = -g*x[n] + x[n-D] + g*y[n-D])"""
    xp = np.pad(x, (D, 0))[: len(x)]
    buf = np.zeros_like(x, dtype=np.float64)
    for k in range(0, len(x), D):
        end = min(k + D, len(x))
        m = end - k
        prev = buf[k - m : k] if k > 0 else np.zeros(m)
        buf[k:end] = -g * x[k:end] + xp[k:end] + g * prev
    return buf


def reverb(x, wet, rt=1.0):
    """small Schroeder reverb (4 combs + 2 allpasses)"""
    if wet <= 0:
        return x
    out = np.zeros_like(x, dtype=np.float64)
    for D, g0 in ((1116, 0.80), (1277, 0.78), (1422, 0.82), (1557, 0.84)):
        g = min(0.97, g0 ** (1.0 / max(rt / 0.9, 0.25)))
        out += _comb(x, D, g)
    out /= 4.0
    for D, g in ((556, 0.5), (441, 0.5)):
        out = _allpass(out, D, g)
    return x * (1 - wet) + out * wet * 2.2


def pops(dur, count, t0=0.0, t1=None, f_lo=1400, f_hi=5200, a_lo=0.15, a_hi=0.6):
    """random crackle pops (fire / debris)"""
    n = int(round(dur * SR))
    out = np.zeros(n)
    t1 = dur - 0.02 if t1 is None else t1
    for _ in range(count):
        at = rng.uniform(t0, t1)
        d = rng.uniform(0.002, 0.006)
        seg = noise(d)
        lo = rng.uniform(f_lo, f_hi * 0.5)
        hi = rng.uniform(f_hi * 0.6, f_hi)
        seg = bp(seg, lo, min(hi, 9000), 2)
        a = rng.uniform(a_lo, a_hi)
        s = int(at * SR)
        e = min(n, s + len(seg))
        if e > s:
            out[s:e] += seg[: e - s] * a * np.exp(-tt(d)[: e - s] / 0.003)
    return out


def metal_ting(f, dur, tau, amp=1.0):
    return amp * bell(f, dur, tau, partials=(1, 1.51, 2.26, 3.01), amps=(1, 0.55, 0.3, 0.18))


def place(base, seg, at):
    """mix seg into base at time `at` (seconds)"""
    s = int(round(at * SR))
    e = min(len(base), s + len(seg))
    if e > s:
        base[s:e] += seg[: e - s]
    return base


def contour(dur, pts):
    """piecewise-linear pitch contour from [(t, mult), ...]"""
    t = tt(dur)
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    return np.interp(t, xs, ys)


# ----------------------------------------------------------------------------
# render helpers
# ----------------------------------------------------------------------------

def finalize(x, peak, fin=0.003, fout=0.03):
    x = x / (np.max(np.abs(x)) + 1e-9) * peak
    fi, fo = int(fin * SR), int(fout * SR)
    if fi > 0:
        x[:fi] *= np.linspace(0, 1, fi)
    if fo > 0:
        x[-fo:] *= np.linspace(1, 0, fo)
    return x


RENDERED = {}


def save(name, x, peak):
    x = finalize(np.asarray(x, dtype=np.float64), peak)
    RENDERED[name] = peak
    os.makedirs(OUT, exist_ok=True)
    wav = os.path.join(OUT, name + ".wav")
    ogg = os.path.join(OUT, name + ".ogg")
    pcm = (np.clip(x, -1, 1) * 32767).astype(np.int16)
    with wave.open(wav, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", "-i", wav, "-c:a", "libvorbis", "-q:a", "4", ogg],
        check=True,
    )
    os.remove(wav)
    rms = float(np.sqrt(np.mean(x**2)))
    print(f"  {name:14s} {len(x)/SR:5.2f}s peak={peak:.2f} rms={rms:.3f}")


# ----------------------------------------------------------------------------
# 30 sounds — one per Sfx method, each an archetypal formula
# ----------------------------------------------------------------------------

def s_swing():
    """pure airy whoosh — band noise, center sweeps up then settles"""
    d = 0.20
    f = sweep_f(500, 2600, d * 0.62)
    f = np.concatenate([f, sweep_f(2600, 800, d * 0.38)])
    n = noise(d)
    y = svf(n, f, damping=0.5, band="band") * env_bell(d, 1.3)
    y += svf(n, f * 2.1, damping=0.4, band="band") * env_bell(d, 1.5) * 0.25
    save("swing", lp(y, 9000), 0.60)


def s_heavy():
    """bigger, weightier whoosh with a low growl underneath"""
    d = 0.34
    f = sweep_f(240, 1050, d * 0.6)
    f = np.concatenate([f, sweep_f(1050, 330, d * 0.4)])
    n = noise(d)
    y = svf(n, f, damping=0.65, band="band") * env_bell(d, 1.1)
    y += brown(d) * env_bell(d, 1.0) * 0.25
    w = poly_sweep(92, 54, d, "saw") * env_bell(d, 1.0) * 0.22
    y += lp(w, 260)
    save("heavy", lp(y, 8000), 0.80)


def s_hit():
    """punchy whack — sub thump + smack + tick transient"""
    d = 0.17
    y = np.zeros(int(d * SR))
    y = place(y, sine_sweep(168, 52, 0.11) * env_ad(0.11, 0.002, 0.036), 0)
    y = place(y, lp(brown(0.075), 760) * env_ad(0.075, 0.001, 0.018) * 0.9, 0)
    y = place(y, hp(noise(0.014), 2400) * env_ad(0.014, 0.001, 0.004) * 0.4, 0)
    save("hit", drive(y, 1.6), 0.86)


def s_block():
    """shield/metal clang — bright inharmonic partials with beating detune"""
    d = 0.32
    y = np.zeros(int(d * SR))
    for f, a, tau in ((1187, 1.0, 0.095), (1789, 0.68, 0.068), (2693, 0.42, 0.05), (3617, 0.28, 0.036)):
        y += a * bell(f, d, tau, partials=(1, 1.004), amps=(1, 0.6))
    y = place(y, hp(noise(0.005), 1500) * 0.5, 0)
    save("block", y, 0.72)


def s_guard_break():
    """armor guard shatters — metal groan down + rattle"""
    d = 0.42
    y = np.zeros(int(d * SR))
    g = poly_sweep(330, 82, 0.30, "saw")
    g = lp(g, 1100) * env_ad(0.30, 0.004, 0.10)
    y = place(y, am(g, 13, 0.5) * 0.85, 0)
    y = place(y, lp(brown(0.05), 900) * env_ad(0.05, 0.001, 0.012) * 0.6, 0)
    y = place(y, sine_sweep(130, 60, 0.06) * env_ad(0.06, 0.002, 0.02) * 0.6, 0)
    for at in (0.06, 0.13, 0.21):
        y = place(y, metal_ting(rng.uniform(1900, 3400), 0.06, 0.02, 0.28), at)
    y = place(y, bp(noise(0.12), 700, 1800) * env_ad(0.12, 0.002, 0.04) * 0.4, 0.02)
    save("guard_break", reverb(y, 0.10, 0.8), 0.80)


def s_hurt():
    """player hurt — dull grunt-register blip + thump"""
    d = 0.22
    y = np.zeros(int(d * SR))
    g = poly_sweep(168, 95, 0.16, "saw")
    g = lp(g, 850) * env_ad(0.16, 0.008, 0.055)
    y[: len(g)] += am(g, 27, 0.35)
    y = place(y, sine_sweep(132, 70, 0.07) * env_ad(0.07, 0.002, 0.024) * 0.55, 0)
    y = place(y, bp(noise(0.12), 500, 1200) * env_ad(0.12, 0.004, 0.045) * 0.3, 0)
    save("hurt", y, 0.76)


def s_death():
    """player death — low somber fall with a dark choir shade"""
    d = 1.05
    y = np.zeros(int(d * SR))
    body = poly_sweep(205, 44, 0.85, "saw")
    body = lp(body, 480) * env_ad(0.85, 0.01, 0.34)
    y[: len(body)] += body
    sub = sine_sweep(58, 28, 0.9) * env_ad(0.9, 0.01, 0.38) * 0.8
    y[: len(sub)] += sub
    choir = (np.sin(2 * np.pi * 138.5 * tt(d)) + np.sin(2 * np.pi * 207.5 * tt(d))) * env_ad(d, 0.05, 0.42) * 0.16
    y += lp(choir, 600)
    y = place(y, bp(noise(0.5), 300, 900) * env_ad(0.5, 0.01, 0.2) * 0.24, 0)
    save("death", reverb(y, 0.24, 1.1), 0.80)


def s_roll():
    """dodge roll — two soft armor-cloth swishes + small thud"""
    d = 0.24
    y = np.zeros(int(d * SR))
    y = place(y, lp(noise(0.07), 700) * env_bell(0.07, 1.2) * 0.5, 0)
    y = place(y, lp(noise(0.09), 880) * env_bell(0.09, 1.2) * 0.68, 0.06)
    y = place(y, sine_sweep(120, 62, 0.07) * env_ad(0.07, 0.002, 0.022) * 0.5, 0.10)
    save("roll", y, 0.50)


def s_heal():
    """estus heal — warm rising 3-note chime"""
    d = 0.52
    y = np.zeros(int(d * SR))
    for f, at, tau, a in ((523.25, 0.0, 0.18, 0.8), (659.25, 0.09, 0.17, 0.76), (880.0, 0.18, 0.24, 0.82)):
        seg = (np.sin(2 * np.pi * f * tt(0.34)) + 0.32 * np.sin(2 * np.pi * 2 * f * tt(0.34))) * env_ad(0.34, 0.012, tau) * a
        y = place(y, seg, at)
    y += hp(noise(d), 4200) * env_rise(d, 1.5) * 0.05
    save("heal", reverb(y, 0.16, 0.9), 0.50)


def s_souls():
    """soul absorb — ethereal upward slide + sparkle"""
    d = 0.40
    y = np.zeros(int(d * SR))
    tri = sine_sweep(920, 1420, 0.14) + 0.3 * sine_sweep(2760, 4260, 0.14)
    y = place(y, tri * env_ad(0.14, 0.008, 0.07) * 0.7, 0)
    y = place(y, bell(2760, 0.10, 0.05) * 0.25, 0.06)
    y = place(y, bell(3690, 0.10, 0.05) * 0.2, 0.12)
    y += hp(noise(d), 3000) * env_rise(d, 1.6) * 0.14
    save("souls", reverb(y, 0.14, 0.9), 0.50)


def s_level_up():
    """level up — solemn ascending bell arpeggio (C5 E5 G5 C6)"""
    d = 1.55
    y = np.zeros(int(d * SR))
    for f, at in ((523.25, 0.0), (659.25, 0.11), (783.99, 0.22), (1046.5, 0.33)):
        y = place(y, bell(f, 0.9, 0.5) * 0.8, at)
    save("level_up", reverb(y, 0.30, 1.2), 0.55)


def s_victory():
    """boss defeated — five-note fanfare with reverb tail"""
    d = 1.95
    y = np.zeros(int(d * SR))
    for f, at in ((392.0, 0.0), (523.25, 0.13), (659.25, 0.26), (783.99, 0.39), (1046.5, 0.52)):
        y = place(y, bell(f, 1.1, 0.55) * 0.75, at)
    y += lp(noise(d), 400) * env_ad(d, 0.02, 0.6) * 0.06
    save("victory", reverb(y, 0.32, 1.3), 0.55)


def s_bonfire():
    """bonfire ignites — whoosh up + warm hum + crackle burst"""
    d = 0.85
    y = np.zeros(int(d * SR))
    w = svf(noise(0.35), sweep_f(350, 1500, 0.35), damping=0.7, band="low") * env_bell(0.35, 1.2)
    y = place(y, w * 0.55, 0)
    y += np.sin(2 * np.pi * 108 * tt(d)) * env_ad(d, 0.2, 0.5) * 0.28
    y += np.sin(2 * np.pi * 216 * tt(d)) * env_ad(d, 0.25, 0.4) * 0.1
    y += lp(brown(d), 500) * env_ad(d, 0.1, 0.4) * 0.3
    y += pops(d, 15, 0.05, 0.8, 1500, 5200, 0.15, 0.5)
    save("bonfire", reverb(y, 0.12, 0.9), 0.55)


def _roar_core(d, base_f, end_mult, growl_f, am_f, drive_k, breath_lo, breath_hi, breath_a):
    cont = contour(
        d,
        [(0.0, 0.8), (0.12, 1.0), (d * 0.55, 0.97), (d * 0.95, end_mult), (d, end_mult * 0.97)],
    )
    sub = poly_sweep(base_f, base_f * 0.5, d, "saw", contour=cont)
    sub = lp(sub, 320) * env_ad(d, 0.06, d * 0.42)
    gr = poly_sweep(base_f * 1.5, base_f * 0.72, d, "saw", contour=cont)
    gr = am(gr, am_f, 0.7)
    gr = bp(gr, growl_f * 0.55, growl_f * 7)
    gr = drive(gr, drive_k) * env_ad(d, 0.05, d * 0.4)
    br = bp(noise(d), breath_lo, breath_hi) * env_ad(d, 0.07, d * 0.42) * breath_a
    return sub, gr, br


def s_boss_roar():
    """boss roar — growling pitch-fall (archetypal monster roar)"""
    d = 1.20
    sub, gr, br = _roar_core(d, 92, 0.62, 138, 21, 2.2, 350, 1500, 0.45)
    y = sub + gr * 0.85 + br
    save("boss_roar", reverb(drive(y, 1.4), 0.32, 1.3), 0.95)


def s_phase_roar():
    """phase-2 awakening — deeper, longer, extra growl layer"""
    d = 1.55
    sub, gr, br = _roar_core(d, 68, 0.50, 96, 17, 2.6, 260, 1200, 0.5)
    cont = contour(d, [(0.0, 0.82), (0.15, 1.0), (d * 0.6, 0.95), (d, 0.55)])
    hi = poly_sweep(204, 96, d, "saw", contour=cont)
    hi = am(hi, 33, 0.6)
    hi = bp(hi, 300, 1600) * env_ad(d, 0.08, d * 0.38) * 0.3
    y = sub + gr * 0.9 + br + hi
    y = place(y, sine_sweep(52, 24, 0.5) * env_ad(0.5, 0.004, 0.16) * 0.6, d - 0.5)
    save("phase_roar", reverb(drive(y, 1.5), 0.38, 1.6), 0.95)


def s_hiss():
    """creeper fuse — rising sharp noise, abrupt cut"""
    d = 0.95
    n = noise(d)
    y = svf(n, sweep_f(1400, 5800, d), damping=0.32, band="band")
    y = am(y, 15, 0.22) * env_rise(d, 1.35)
    y += pops(d, 6, 0.1, 0.85, 2500, 7000, 0.08, 0.2)
    save("hiss", y, 0.66)


def s_boom():
    """creeper explosion — sub drop + noise blast + crack (archetype)"""
    d = 0.75
    y = sine_sweep(80, 24, 0.6) * env_ad(0.6, 0.002, 0.22)
    blast = svf(brown(0.45), sweep_f(2600, 90, 0.45), damping=0.7, band="low")
    y[: len(blast)] += blast * env_ad(0.45, 0.002, 0.13) * 0.95
    y = place(y, hp(noise(0.01), 900) * 0.6, 0)
    save("boom", drive(y, 1.8), 0.95)


def s_arrow_shoot():
    """bow release — string twang + airy thwip"""
    d = 0.22
    y = np.zeros(int(d * SR))
    tw = poly_sweep(640, 250, 0.07, "square")
    tw = lp(tw, 2400) * env_ad(0.07, 0.002, 0.025)
    y = place(y, tw * 0.5, 0)
    air = svf(noise(0.16), sweep_f(3200, 900, 0.16), damping=0.5, band="band") * env_bell(0.16, 1.4)
    y = place(y, air * 0.5, 0.02)
    save("arrow_shoot", y, 0.52)


def s_arrow_hit():
    """arrow lands — dull thock into wood/flesh"""
    d = 0.13
    y = np.zeros(int(d * SR))
    y = place(y, lp(brown(0.06), 900) * env_ad(0.06, 0.001, 0.015) * 0.85, 0)
    y = place(y, poly_sweep(195, 92, 0.07, "square") * env_ad(0.07, 0.002, 0.028) * 0.45, 0)
    y = place(y, np.sin(2 * np.pi * 880 * tt(0.02)) * env_ad(0.02, 0.001, 0.008) * 0.3, 0)
    save("arrow_hit", y, 0.75)


def s_arrow_block():
    """arrow deflected — bright short ting"""
    d = 0.22
    y = np.zeros(int(d * SR))
    for f, a, tau in ((1523, 1.0, 0.09), (2285, 0.6, 0.06), (3427, 0.35, 0.045)):
        y += a * bell(f, d, tau, partials=(1, 1.006), amps=(1, 0.5))
    y = place(y, hp(noise(0.004), 2000) * 0.4, 0)
    save("arrow_block", y, 0.60)


def s_shard():
    """estus shard — warm rising chime (G4 -> C5 -> E5 -> A5)"""
    d = 0.78
    y = np.zeros(int(d * SR))
    up = sine_sweep(392, 523.25, 0.16) * env_ad(0.16, 0.01, 0.09) * 0.8
    y = place(y, up, 0)
    for f, at, tau in ((659.25, 0.15, 0.2), (880.0, 0.27, 0.28)):
        y = place(
            y,
            (np.sin(2 * np.pi * f * tt(0.4)) + 0.28 * np.sin(2 * np.pi * 3 * f * tt(0.4)))
            * env_ad(0.4, 0.01, tau)
            * 0.75,
            at,
        )
    y += np.sin(2 * np.pi * 196 * tt(d)) * env_ad(d, 0.02, 0.3) * 0.2
    save("shard", reverb(y, 0.2, 1.0), 0.50)


def s_stomp():
    """colossus stomp — sub slam + rumble + debris"""
    d = 0.55
    y = np.zeros(int(d * SR))
    y = place(y, sine_sweep(62, 22, 0.42) * env_ad(0.42, 0.002, 0.14), 0)
    y = place(y, lp(brown(0.18), 340) * env_ad(0.18, 0.002, 0.05) * 0.85, 0)
    y = place(y, lp(noise(0.006), 3000) * 0.35, 0)
    y = place(y, lp(brown(0.45), 120) * env_ad(0.45, 0.02, 0.3) * 0.3, 0.08)
    y += pops(d, 4, 0.1, 0.32, 1800, 4200, 0.08, 0.14)
    save("stomp", drive(y, 1.5), 0.95)


def s_dash():
    """charge dash — falling whoosh with low weight"""
    d = 0.36
    y = svf(noise(d), sweep_f(1350, 300, d), damping=0.6, band="band") * env_bell(d, 1.1)
    y += lp(poly_sweep(150, 72, d, "saw"), 300) * env_bell(d, 1.0) * 0.22
    save("dash", y, 0.55)


def s_stagger():
    """posture break — metal groan + clatter + sub"""
    d = 0.62
    y = np.zeros(int(d * SR))
    g = poly_sweep(225, 64, 0.5, "saw")
    g = lp(g, 850) * env_ad(0.5, 0.01, 0.28)
    y = place(y, am(g, 11, 0.4) * 0.8, 0)
    for at in (0.04, 0.09, 0.15, 0.22):
        y = place(y, metal_ting(rng.uniform(1900, 3200), 0.07, 0.025, 0.3), at)
    y = place(y, poly_sweep(92, 40, 0.3, "square") * env_ad(0.3, 0.004, 0.1) * 0.5, 0.1)
    save("stagger", reverb(y, 0.18, 0.9), 0.78)


def s_fire_shoot():
    """fireball launch — pressure hiss + flame whoomp"""
    d = 0.32
    y = svf(noise(d), sweep_f(1900, 520, d), damping=0.6, band="band") * env_bell(d, 1.3)
    y += lp(brown(d), 850) * env_ad(d, 0.01, 0.12) * 0.5
    y = place(y, poly_sweep(300, 115, 0.15, "saw") * env_ad(0.15, 0.004, 0.06) * 0.35, 0)
    save("fire_shoot", y, 0.55)


def s_fire_boom():
    """fireball detonation — thump + flame burst + crackle tail"""
    d = 0.6
    y = np.zeros(int(d * SR))
    y = place(y, sine_sweep(96, 38, 0.35) * env_ad(0.35, 0.002, 0.12), 0)
    y += lp(brown(d), 1500) * env_ad(d, 0.002, 0.12) * 0.8
    y += pops(d, 10, 0.18, 0.55, 1200, 5000, 0.1, 0.28)
    save("fire_boom", drive(y, 1.4), 0.85)


def s_cast():
    """spell gathering — rising shimmer + sparkle"""
    d = 0.38
    y = np.zeros(int(d * SR))
    tri = sine_sweep(430, 790, 0.24) + 0.25 * sine_sweep(1290, 2370, 0.24)
    y = place(y, tri * env_rise(0.24, 1.2) * 0.6, 0)
    y += hp(noise(d), 2400) * env_rise(d, 1.4) * 0.16
    y = place(y, bell(1568, 0.12, 0.05) * 0.2, 0.18)
    y = place(y, bell(2093, 0.12, 0.05) * 0.15, 0.26)
    save("cast", y, 0.46)


def s_ember():
    """the Great Ember — dark warm chord with slow chorus"""
    d = 0.9
    y = np.zeros(int(d * SR))
    for f, at, tau, a in ((330.0, 0.0, 0.42, 0.75), (554.37, 0.14, 0.36, 0.7), (166.0, 0.05, 0.5, 0.6)):
        for det in (0.9965, 1.0035):
            seg = (
                np.sin(2 * np.pi * f * det * tt(d)) + 0.35 * np.sin(2 * np.pi * 2 * f * det * tt(d))
            ) * env_ad(d, 0.015, tau) * a * 0.5
            y = place(y, seg, at)
    save("ember", reverb(y, 0.22, 1.1), 0.55)


def s_soul_collapse():
    """knight bursts into voxels — impact + ascending soul shimmer"""
    d = 1.6
    y2 = np.zeros(int(d * SR))
    imp = sine_sweep(76, 26, 0.5) * env_ad(0.5, 0.002, 0.15) * 0.95
    y2[: len(imp)] += imp
    brk = lp(brown(0.35), 700) * env_ad(0.35, 0.002, 0.08) * 0.8
    y2[: len(brk)] += brk
    for i, f in enumerate((523.25, 659.25, 783.99, 1046.5, 1318.5)):
        y2 = place(y2, bell(f, 0.5, 0.3) * 0.3, 0.18 + i * 0.1)
    y2 += bp(noise(d), 2600, 5200) * env_rise(d, 1.3) * 0.2
    save("soul_collapse", reverb(y2, 0.25, 1.2), 0.85)


def s_inferno():
    """Flame King combusts — massive whoosh + deep boom + crackle fade"""
    d = 2.1
    y = np.zeros(int(d * SR))
    w = svf(brown(1.0), sweep_f(1700, 170, 1.0), damping=0.7, band="low") * env_ad(1.0, 0.01, 0.3)
    y = place(y, w * 0.85, 0)
    y = place(y, sine_sweep(66, 21, 0.9) * env_ad(0.9, 0.002, 0.25), 0)
    y = place(y, hp(noise(0.012), 800) * 0.5, 0)
    g = lp(poly_sweep(122, 55, 0.7, "saw"), 500)
    y = place(y, am(g, 9, 0.5) * env_ad(0.7, 0.02, 0.3) * 0.3, 0.05)
    for _ in range(20):
        at = rng.uniform(0.5, 1.95)
        a = 0.28 * (1 - (at - 0.5) / 1.5) + 0.04
        seg = pops(0.1, 1, 0, 0.08, 1400, 5500, a, a)
        y = place(y, seg, at)
    save("inferno", reverb(drive(y, 1.5), 0.25, 1.4), 0.95)


# ----------------------------------------------------------------------------

def main():
    print("Rendering DarkCraft SFX set (30 archetypal effects) ...")
    s_swing()
    s_heavy()
    s_hit()
    s_block()
    s_guard_break()
    s_hurt()
    s_death()
    s_roll()
    s_heal()
    s_souls()
    s_level_up()
    s_victory()
    s_bonfire()
    s_boss_roar()
    s_phase_roar()
    s_hiss()
    s_boom()
    s_arrow_shoot()
    s_arrow_hit()
    s_arrow_block()
    s_shard()
    s_stomp()
    s_dash()
    s_stagger()
    s_fire_shoot()
    s_fire_boom()
    s_cast()
    s_ember()
    s_soul_collapse()
    s_inferno()
    total = sum(os.path.getsize(os.path.join(OUT, n + ".ogg")) for n in RENDERED)
    print(f"OK — {len(RENDERED)} files, total {total/1024:.0f} KB -> {os.path.abspath(OUT)}")


if __name__ == "__main__":
    main()
