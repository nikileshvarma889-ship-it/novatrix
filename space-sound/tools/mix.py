"""Builds the 40 s soundtrack: original cinematic score + sound design + Telugu narration.

Writes public/audio/mix.wav (48 kHz stereo, -14 LUFS) and src/timeline.json (when each line and scene starts).
Run after tools/voice.py. Needs numpy + scipy + soundfile.
"""
import json, subprocess
from pathlib import Path
import numpy as np
import soundfile as sf
from scipy.signal import butter, sosfilt

ROOT = Path(__file__).resolve().parent.parent
SR = 48000
DUR = 40.0
N = int(SR * DUR)
rng = np.random.default_rng(7)
t = np.arange(N) / SR

# ---------- narration placement ----------
lines = json.loads((ROOT / "public/audio/lines.json").read_text())
order = [lines[str(i)] for i in range(len(lines))]
gaps = [0.8, 0.9, 0.8, 0.95, 1.0, 1.0, 1.35]          # silence before each line
starts, cur = [], 0.0
for g, l in zip(gaps, order):
    cur += g
    starts.append(round(cur, 3))
    cur += l["duration"]
assert cur < DUR - 2.5, f"narration too long: {cur:.1f}s"
EXPLOSION = 1.4                                         # detonation (silent!) during the hook
# scene cuts (seconds)
scenes = {
    "hook": 0.0,
    "orbit": 7.2,
    "visor": round(starts[2] - 0.35, 3),
    "air": round(starts[3] - 0.4, 3),
    "vacuum": round(starts[4] - 0.45, 3),
    "noreach": round(starts[5] - 0.45, 3),
    "earth": round(starts[6] - 0.9, 3),
}


def lp(x, f, order=2):
    return sosfilt(butter(order, f, "low", fs=SR, output="sos"), x)


def hp(x, f, order=2):
    return sosfilt(butter(order, f, "high", fs=SR, output="sos"), x)


def bp(x, lo, hi):
    return sosfilt(butter(2, [lo, hi], "band", fs=SR, output="sos"), x)


def env(points):
    """Piecewise-linear envelope from (time, gain) points."""
    ts, gs = zip(*points)
    return np.interp(t, ts, gs)


def note(freq, start, length, attack=1.5, release=2.5, voices=3, detune=0.004, bright=1800):
    """Soft string/pad note: detuned saws, filtered, with slow attack/release."""
    out = np.zeros(N)
    i0, i1 = int(start * SR), min(N, int((start + length + release) * SR))
    tt = np.arange(i1 - i0) / SR
    for v in range(voices):
        f = freq * (1 + detune * (v - (voices - 1) / 2))
        ph = rng.random()
        saw = 2 * ((f * tt + ph) % 1) - 1
        out[i0:i1] += saw / voices
    a = np.clip(tt / attack, 0, 1) * np.clip((length + release - tt) / release, 0, 1)
    out[i0:i1] *= a ** 1.5
    return lp(out, bright)


# ---------- score: D minor, deep and slow; resolves to D major for the Earth reveal ----------
NOTE = lambda n: 440 * 2 ** ((n - 69) / 12)
music_l = np.zeros(N)
music_r = np.zeros(N)
sub = 0.5 * np.sin(2 * np.pi * NOTE(26) * t) + 0.25 * np.sin(2 * np.pi * NOTE(38) * t)       # D0 / D1 drone
sub *= env([(0, 0), (0.6, 0.5), (EXPLOSION, 0.5), (EXPLOSION + 0.05, 0.0), (3.6, 0.0), (6, 0.45), (DUR - 2, 0.5), (DUR, 0)])
chords = [  # (start, length, midi notes)
    (3.2, 7.0, [50, 57, 62, 65]),          # Dm
    (10.2, 6.2, [46, 53, 58, 62, 65]),     # Bbmaj7-ish
    (16.4, 6.0, [43, 50, 55, 58, 62]),     # Gm
    (22.4, 4.8, [45, 52, 57, 61, 64]),     # A (tension)
    (27.2, 4.4, [41, 48, 53, 57, 62]),     # F/D colour
    (31.6, 8.4, [50, 57, 62, 66, 69, 74]), # D major — Earth reveal
]
for k, (st, ln, ns) in enumerate(chords):
    for j, n in enumerate(ns):
        x = note(NOTE(n), st, ln, attack=2.0 if k < 5 else 2.8, release=3.0, bright=1400 + 300 * (k == 5))
        pan = (j / max(1, len(ns) - 1)) * 0.8 + 0.1
        music_l += x * (1 - pan) * 0.32
        music_r += x * pan * 0.32
# gold "sparkle" bells (soft sine plucks) over the explanation and the reveal
for k in range(18):
    st = 16.6 + k * 1.3 + rng.random() * 0.4
    if st > DUR - 1.5:
        break
    f = NOTE([74, 76, 77, 81, 79, 74][k % 6] + (12 if st > 31.6 else 0))
    i0 = int(st * SR); ln = int(2.2 * SR); tt = np.arange(min(ln, N - i0)) / SR
    b = (np.sin(2 * np.pi * f * tt) + 0.3 * np.sin(2 * np.pi * f * 2.01 * tt)) * np.exp(-tt * 2.6) * 0.05
    pan = rng.random()
    music_l[i0:i0 + len(tt)] += b * (1 - pan); music_r[i0:i0 + len(tt)] += b * pan
# soft low pulses (heartbeat of the score) during the science
for k in range(14):
    st = 17.0 + k * 1.05
    if st > scenes["earth"] - 0.4:
        break
    i0 = int(st * SR); tt = np.arange(int(0.6 * SR)) / SR
    p = np.sin(2 * np.pi * (55 * np.exp(-tt * 3) + 38) * tt) * np.exp(-tt * 7) * 0.22
    music_l[i0:i0 + len(tt)] += p; music_r[i0:i0 + len(tt)] += p
# riser into the Earth reveal + gentle impact
r0, r1 = scenes["earth"] - 2.4, scenes["earth"]
noise = rng.standard_normal(N)
rise = bp(noise, 300, 6000) * np.clip((t - r0) / (r1 - r0), 0, 1) ** 2 * ((t < r1 + 0.05)) * 0.12
music_l += rise; music_r += rise
i0 = int(r1 * SR); tt = np.arange(int(3.5 * SR)) / SR
boom = (np.sin(2 * np.pi * (60 * np.exp(-tt * 1.5) + 32) * tt) * np.exp(-tt * 1.4) * 0.5 + lp(rng.standard_normal(len(tt)), 400) * np.exp(-tt * 3) * 0.15)
music_l[i0:i0 + len(tt)] += boom; music_r[i0:i0 + len(tt)] += boom
music_l += sub; music_r += sub
# simple reverb-ish width: short delays
def widen(x, d1, d2, g=0.22):
    y = x.copy(); a, b = int(d1 * SR), int(d2 * SR)
    y[a:] += g * x[:-a]; y[b:] += g * 0.7 * x[:-b]
    return y
music_l, music_r = widen(music_l, 0.031, 0.083), widen(music_r, 0.047, 0.101)
# the silence of space: the score drops out at the detonation and returns with the narration
silence = env([(0, 1), (EXPLOSION - 0.02, 1), (EXPLOSION + 0.04, 0.0), (3.3, 0.0), (5.0, 1), (DUR - 1.6, 1), (DUR, 0)])
music_l *= silence; music_r *= silence

# ---------- sound design ----------
fx = np.zeros(N)
# radio beep at the very start (inside the helmet)
for st in (0.25, 0.42):
    i0 = int(st * SR); tt = np.arange(int(0.09 * SR)) / SR
    fx[i0:i0 + len(tt)] += np.sin(2 * np.pi * 2400 * tt) * np.minimum(1, tt * 200) * np.minimum(1, (0.09 - tt) * 200) * 0.05
# breathing inside the helmet (the only thing an astronaut hears): hook and the "no reach" scene
def breath(st, inhale=True):
    ln = 1.25 if inhale else 1.5
    i0 = int(st * SR); n = int(ln * SR); tt = np.arange(n) / SR
    shape = np.sin(np.pi * tt / ln) ** 2
    b = bp(rng.standard_normal(n), 500 if inhale else 350, 2600 if inhale else 1800) * shape * (0.07 if inhale else 0.055)
    fx[i0:i0 + n] += b[: max(0, min(n, N - i0))]
for st in np.arange(0.6, scenes["visor"] - 0.5, 3.4):
    breath(st, True); breath(st + 1.45, False)
for st in np.arange(scenes["noreach"] + 0.2, scenes["earth"] - 0.6, 3.4):
    breath(st, True); breath(st + 1.45, False)
# soft whooshes on cuts
for name, st in scenes.items():
    if st < 0.5:
        continue
    i0 = int((st - 0.45) * SR); n = int(0.9 * SR); tt = np.arange(n) / SR
    sweep = bp(rng.standard_normal(n), 200, 3000) * np.sin(np.pi * tt / 0.9) ** 3 * 0.045
    fx[i0:i0 + n] += sweep
# in the air demo a real sound wave exists: a soft low tone pulse that stops dead in the vacuum scene
i0, i1 = int(scenes["air"] * SR), int(scenes["vacuum"] * SR)
tt = np.arange(i1 - i0) / SR
fx[i0:i1] += np.sin(2 * np.pi * 110 * tt) * (0.5 + 0.5 * np.sin(2 * np.pi * 1.6 * tt)) * np.clip(tt / 0.8, 0, 1) * np.clip((len(tt) / SR - tt) / 0.15, 0, 1) * 0.035

# ---------- narration ----------
vo = np.zeros(N)
for st, l in zip(starts, order):
    x, sr = sf.read(ROOT / "public" / l["file"])
    assert sr == SR
    if x.ndim > 1:
        x = x.mean(axis=1)
    i0 = int(st * SR)
    vo[i0:i0 + len(x)] += x[: N - i0]
# warmth: a touch of low-mid, small room
vo = vo + 0.08 * np.concatenate([np.zeros(int(0.018 * SR)), vo[: -int(0.018 * SR)]])

# ducking: music sits ~9 dB under the voice
level = np.convolve(np.abs(vo), np.ones(int(0.25 * SR)) / int(0.25 * SR), mode="same")
duck = 1 - 0.65 * np.clip(level / (level.max() * 0.25 + 1e-9), 0, 1)
duck = np.convolve(duck, np.ones(int(0.12 * SR)) / int(0.12 * SR), mode="same")
L = music_l * 0.55 * duck + fx + vo
R = music_r * 0.55 * duck + fx + vo
mix = np.stack([L, R], axis=1)
mix /= max(1e-9, np.abs(mix).max()) / 0.9
raw = ROOT / "out/mix-raw.wav"
raw.parent.mkdir(exist_ok=True)
sf.write(raw, mix, SR, subtype="PCM_24")
subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(raw), "-af", "loudnorm=I=-14:TP=-1.0:LRA=11", "-ar", str(SR), str(ROOT / "public/audio/mix.wav")], check=True)

def pauses(path):
    """Mid-points (s) of gaps >= 90 ms in a narration clip: where subtitle chunks should change."""
    x, sr = sf.read(path)
    if x.ndim > 1:
        x = x.mean(axis=1)
    hop = int(0.01 * sr)
    rms = np.sqrt(np.convolve(x ** 2, np.ones(hop * 3) / (hop * 3), mode="same")[::hop])
    quiet = rms < rms.max() * 0.06
    out, run = [], 0
    for i, q in enumerate(quiet):
        if q:
            run += 1
        else:
            if run >= 9:
                out.append(round((i - run / 2) * 0.01, 3))
            run = 0
    return [p for p in out if 0.15 < p < len(x) / sr - 0.15]


timeline = {"fps": 30, "duration": DUR, "explosion": EXPLOSION, "scenes": scenes,
            "lines": [{"text": l["text"], "start": s, "duration": l["duration"], "pauses": pauses(ROOT / "public" / l["file"])} for s, l in zip(starts, order)]}
(ROOT / "src/timeline.json").write_text(json.dumps(timeline, ensure_ascii=False, indent=2))
print("lines start at:", starts)
print("scenes:", scenes)
