"""Step 3: original soundtrack, synced to the storyboard. Writes audio/{score,sfx,mix}.wav (48 kHz stereo, -14 LUFS).

All sounds are synthesised here (no samples): city ambience, waves, wind, engine start, revs, gear shift,
tire screech, sirens, bass impacts, and an energetic original score (four-on-the-floor, synth bass, pads, riser).
"""
import json, subprocess
from pathlib import Path
import numpy as np
import soundfile as sf
from scipy.signal import butter, sosfilt

ROOT = Path(__file__).resolve().parent.parent
SR = 48000
B = json.loads((ROOT / "storyboard.json").read_text())
T = float(B["duration"]); N = int(T * SR); t = np.arange(N) / SR
rng = np.random.default_rng(6)
SH = {s["id"]: s for s in B["shots"]}
at = lambda sid, f=0.0: SH[sid]["start"] + SH[sid]["len"] * f

def lp(x, f, o=2): return sosfilt(butter(o, f, "low", fs=SR, output="sos"), x)
def hp(x, f, o=2): return sosfilt(butter(o, f, "high", fs=SR, output="sos"), x)
def bp(x, lo, hi, o=2): return sosfilt(butter(o, [lo, hi], "band", fs=SR, output="sos"), x)
def noise(n): return rng.standard_normal(n)
def env(n, a, r):
    e = np.ones(n); na, nr = min(n, int(a * SR)), min(n, int(r * SR))
    if na: e[:na] = np.linspace(0, 1, na)
    if nr: e[-nr:] *= np.linspace(1, 0, nr)
    return e
sfx = np.zeros((N, 2)); mus = np.zeros((N, 2))
def put(buf, x, start, pan=0.5):
    i = int(start * SR)
    if i >= N: return
    x = x[: N - i]
    if x.ndim == 1: buf[i:i + len(x), 0] += x * (1 - pan) * 1.4; buf[i:i + len(x), 1] += x * pan * 1.4
    else: buf[i:i + len(x)] += x

# ------------------------------------------------------------------ sound effects
def waves(n):
    tt = np.arange(n) / SR
    swell = 0.5 + 0.5 * np.sin(2 * np.pi * tt / 6.5) ** 2
    return lp(noise(n), 900) * 0.12 * swell + bp(noise(n), 2000, 7000) * 0.03 * swell ** 3
def wind(n, amt=1.0):
    tt = np.arange(n) / SR
    return lp(noise(n), 500) * 0.08 * (0.7 + 0.3 * np.sin(2 * np.pi * 0.3 * tt)) * amt
def city(n):
    tt = np.arange(n) / SR
    traffic = lp(noise(n), 300) * 0.08
    horn = np.zeros(n)
    for k in range(int(n / SR / 3)):
        i = int(rng.uniform(0, n - SR)); m = int(0.35 * SR); h = np.arange(m) / SR
        horn[i:i + m] += (np.sign(np.sin(2 * np.pi * 410 * h)) + np.sign(np.sin(2 * np.pi * 495 * h))) * 0.006 * env(m, 0.02, 0.1)
    return traffic + lp(horn, 2000)
def engine(rpm, amp=0.5, rough=0.25):
    """V8-style engine from an rpm curve (array): firing pulses + harmonics + intake noise."""
    f = rpm / 60 * 4                                     # 8 cylinders, 4-stroke: 4 firings per revolution
    ph = np.cumsum(f) / SR
    y = sum(np.sin(2 * np.pi * ph * h + h) / h for h in (0.5, 1, 1.5, 2, 3, 4))
    y = np.tanh(y * 1.4) + rough * bp(noise(len(rpm)), 80, 2500) * (np.sin(2 * np.pi * ph) > 0.6)
    return lp(y, 3500) * amp
def ramp(points, n):
    xs, ys = zip(*points); return np.interp(np.arange(n) / SR, xs, ys)
def screech(length, amp=0.3):
    n = int(length * SR); tt = np.arange(n) / SR
    f = 1800 + 400 * np.sin(2 * np.pi * 3 * tt) + 250 * noise(n).cumsum() / np.sqrt(n) * 0.02
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.5 + bp(noise(n), 1500, 6000) * 0.8
    return y * env(n, 0.05, 0.4) * amp
def siren(length, amp=0.12, pan=0.5, doppler=0.0):
    n = int(length * SR); tt = np.arange(n) / SR
    f = (900 + 450 * np.sign(np.sin(2 * np.pi * 1.6 * tt))) * (1 + doppler * (0.5 - tt / length) * 0.12)
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) + 0.3 * np.sin(4 * np.pi * np.cumsum(f) / SR)
    return lp(y, 4000) * amp * env(n, 0.3, 0.6)
def click(amp=0.4, f=3000):
    n = int(0.06 * SR); tt = np.arange(n) / SR
    return (bp(noise(n), f * 0.5, f * 2) * 0.6 + np.sin(2 * np.pi * 180 * tt)) * np.exp(-tt * 60) * amp
def impact(amp=1.0, f0=45, length=3.0):
    n = int(length * SR); tt = np.arange(n) / SR
    y = np.sin(2 * np.pi * (f0 + 30 * np.exp(-tt * 12)) * tt) * np.exp(-tt * 1.6) + lp(noise(n), 160) * np.exp(-tt * 3) * 0.8
    return np.tanh(y * 1.5) * amp
def whoosh(length=1.0, amp=0.3):
    n = int(length * SR); tt = np.arange(n) / SR
    y = noise(n); out = np.zeros(n)
    for i, fc in enumerate(np.linspace(300, 5000, 12)):
        seg = slice(i * n // 12, (i + 1) * n // 12); out[seg] = bp(y, fc * 0.7, fc * 1.3)[seg]
    return out * np.sin(np.pi * tt / length) ** 2 * amp

# Scene 1: ocean, wind, distant city
n1 = int(at("02_walk") * SR) + SR
put(sfx, waves(n1) * env(n1, 1.0, 1.0), 0, 0.4); put(sfx, wind(n1, 1.2) * env(n1, 0.5, 1.0), 0, 0.6)
put(sfx, city(n1) * 0.6 * env(n1, 2.0, 1.0), 0.5, 0.55)
# Scene 2: hotel forecourt, footsteps
n2 = int(5 * SR); put(sfx, city(n2) * env(n2, 0.3, 0.5), at("02_walk"), 0.5); put(sfx, wind(n2, 0.6), at("02_walk"), 0.4)
for k in range(6): put(sfx, click(0.18, 900) , at("02_walk") + 0.15 + k * 0.48, 0.45 + 0.1 * (k % 2))
put(sfx, whoosh(0.6, 0.15), at("03_shades") - 0.3)
# Scene 3: start button, starter, idle, blip, shift, launch
put(sfx, click(0.5, 2500), at("04_ignition", 0.25))
n3 = int((at("07_police") - at("04_ignition", 0.3) + 0.5) * SR)
s0 = at("04_ignition", 0.3)
rpm = ramp([(0, 250), (0.45, 300), (0.6, 2600), (0.95, 1100), (1.6, 950), (at("05_shift") - s0 + 0.1, 950), (at("05_shift") - s0 + 0.4, 6200),
            (at("05_shift", 0.8) - s0, 7400), (at("05_shift", 0.85) - s0, 4800), (at("06_coast") - s0, 6900), (at("06_coast", 0.7) - s0, 7800), (n3 / SR, 7000)], n3)
eng = engine(rpm, 0.45) * env(n3, 0.02, 0.5)
put(sfx, eng, s0, 0.5)
put(sfx, lp(noise(int(0.45 * SR)), 400) * 0.4 * env(int(0.45 * SR), 0.01, 0.1), s0, 0.5)    # starter crank
put(sfx, click(0.35, 1500), at("05_shift", 0.8), 0.55)                                         # paddle shift
put(sfx, impact(0.5, 50, 1.5), at("06_coast"))
# Scene 4: chase at night: engine, sirens, screech, drift slow-mo
n4 = int((at("10_highway") - at("07_police") + 0.3) * SR)
rpm4 = ramp([(0, 7200), (1.2, 6000), (2.5, 7600), (2.6, 5200), (5.5, 4800), (5.6, 7800), (n4 / SR, 7000)], n4)
put(sfx, engine(rpm4, 0.4) * env(n4, 0.05, 0.3), at("07_police"), 0.5)
put(sfx, siren(n4 / SR + 1.5, 0.11, 0.3, 1.0), at("07_police") - 0.6, 0.3); put(sfx, siren(n4 / SR, 0.08, 0.7, -1.0), at("07_police") + 0.4, 0.7)
put(sfx, screech(1.1, 0.35), at("08_drift") - 0.1, 0.6)
slow = int(2.4 * SR); put(sfx, lp(screech(2.4, 0.4), 1200) * 0.8, at("08_drift", 0.15), 0.5)  # slowed, darker tire roar
put(sfx, whoosh(0.9, 0.35), at("09_drone") - 0.2); put(sfx, whoosh(0.7, 0.25), at("10_highway") - 0.3)
# Scene 5: highway wind, distant sirens fading, interior hush, final impact
n5 = int((T - at("10_highway")) * SR)
put(sfx, wind(n5, 1.5) * env(n5, 0.2, 2.5), at("10_highway"), 0.5)
put(sfx, siren(3.0, 0.03, 0.4) , at("10_highway"), 0.4)
put(sfx, waves(n5) * 0.6 * env(n5, 1.0, 2.0), at("11_passenger"), 0.6)
put(sfx, impact(1.0, 38, 4.0), at("12_finale", 0.3))

# ------------------------------------------------------------------ score: 104 bpm, A minor, builds, drops for the slow-mo, hits for the title
BPM = 104; beat = 60 / BPM
NOTE = lambda m: 440 * 2 ** ((m - 69) / 12)
def kick():
    n = int(0.4 * SR); tt = np.arange(n) / SR
    return np.sin(2 * np.pi * (48 + 120 * np.exp(-tt * 30)) * tt) * np.exp(-tt * 9)
def snare():
    n = int(0.3 * SR); tt = np.arange(n) / SR
    return (bp(noise(n), 1500, 8000) * 0.7 + np.sin(2 * np.pi * 190 * tt) * 0.5) * np.exp(-tt * 18)
def hat():
    n = int(0.06 * SR); tt = np.arange(n) / SR
    return hp(noise(n), 7000) * np.exp(-tt * 70) * 0.5
def saw(f, n, det=(-0.004, 0.004)):
    tt = np.arange(n) / SR
    return sum(2 * ((f * (1 + d) * tt + rng.random()) % 1) - 1 for d in det) / len(det)
def pad(notes, start, length, amp=0.08, bright=1500):
    n = int(length * SR); y = sum(saw(NOTE(m), n, (-0.006, 0, 0.006)) for m in notes) / len(notes)
    put(mus, lp(y, bright) * env(n, 1.2, 1.0) * amp, start, 0.5)
def bass(note, start, length, amp=0.18):
    n = int(length * SR); y = lp(saw(NOTE(note), n), 300) + np.sin(2 * np.pi * NOTE(note) * np.arange(n) / SR) * 0.6
    put(mus, y * env(n, 0.005, 0.05) * amp, start, 0.5)
def riser(end, length, amp=0.12):
    n = int(length * SR); tt = np.arange(n) / SR
    y = (bp(noise(n), 400, 9000) + np.sin(2 * np.pi * np.cumsum(200 + 2500 * (tt / length) ** 2) / SR) * 0.3) * (tt / length) ** 2.5 * amp
    put(mus, y, end - length, 0.5)

chords = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]]   # Am F C G
roots = [45, 41, 36, 43]
bar = 4 * beat
drop = at("08_drift", 0.05); back = at("08_drift", 0.95); end_music = at("12_finale", 0.3)
k = 0; tb = 0.0
while tb < end_music:
    pad(chords[k % 4], tb, bar + 0.3, 0.05 if tb < at("06_coast") else 0.07)
    k += 1; tb += bar
nb = 0; tb = 0.0
while tb < end_music:
    in_drop = drop <= tb < back
    if tb >= at("04_ignition") and not in_drop:                    # drums enter with the engine
        put(mus, kick() * 0.9, tb)
        if nb % 2 == 1: put(mus, snare() * 0.45, tb, 0.55)
    if tb >= at("02_walk") and not in_drop:
        put(mus, hat() * 0.5, tb + beat / 2, 0.65)
        if tb >= at("06_coast"): put(mus, hat() * 0.3, tb + beat / 4, 0.35); put(mus, hat() * 0.3, tb + 3 * beat / 4, 0.35)
    if tb >= at("02_walk") and not in_drop:                         # driving eighth-note bass
        r = roots[int(tb // bar) % 4]
        for e in range(2): bass(r + (12 if (nb + e) % 4 == 3 else 0), tb + e * beat / 2, beat / 2 * 0.9, 0.16 if tb < at("06_coast") else 0.2)
    nb += 1; tb += beat
riser(at("04_ignition"), 2.0, 0.08); riser(drop, 2.5, 0.12); riser(end_music, 3.0, 0.14)
pad([45, 52, 57, 60], drop, back - drop + 0.5, 0.09, 900)            # slow-mo: a held, dark chord
put(mus, impact(0.9, 40, 3.5), back)
pad([45, 52, 57, 64], end_music, T - end_music, 0.07, 1200)

# ------------------------------------------------------------------ mix
out = ROOT / "audio"; out.mkdir(exist_ok=True)
for name, x in (("sfx", sfx), ("score", mus)):
    sf.write(out / f"{name}.wav", x / (np.abs(x).max() + 1e-9) * 0.9, SR, subtype="PCM_24")
mix = sfx / (np.abs(sfx).max() + 1e-9) * 0.75 + mus / (np.abs(mus).max() + 1e-9) * 0.65
fade = np.clip((T - t) / 2.0, 0, 1)[:, None] * np.clip(t / 0.5, 0, 1)[:, None]
sf.write(out / "mix-raw.wav", mix / (np.abs(mix).max() + 1e-9) * fade * 0.9, SR, subtype="PCM_24")
subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(out / "mix-raw.wav"), "-af", "loudnorm=I=-14:TP=-1.0:LRA=11", "-ar", str(SR), str(out / "mix.wav")], check=True)
(out / "mix-raw.wav").unlink()
print("audio/mix.wav", T, "s")
