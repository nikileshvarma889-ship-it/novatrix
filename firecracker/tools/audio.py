"""Inside a Firecracker: narration processing, sound design, score, stems, master mix, timeline.

Reads script/script.json + public/audio/voices.json (from tools/voice.py).
Writes:
  out/audio/dialogue.wav, out/audio/sfx.wav, out/audio/music.wav   (stems, 48 kHz stereo)
  out/audio/voices/<line>.wav                                        (each processed narration line)
  public/audio/mix.wav                                               (master, -14 LUFS, -1 dBTP)
  src/timeline.json                                                  (scene / line / event timing for the visuals)
"""
import json, subprocess
from pathlib import Path
import numpy as np
import soundfile as sf
from scipy.signal import butter, sosfilt, fftconvolve, resample_poly

ROOT = Path(__file__).resolve().parent.parent
SR = 48000
script = json.loads((ROOT / "script/script.json").read_text())
voices = json.loads((ROOT / "public/audio/voices.json").read_text())
TARGET = float(script["duration"])
rng = np.random.default_rng(1337)

# ------------------------------------------------------------------ dsp helpers
def lp(x, f, o=2): return sosfilt(butter(o, f, "low", fs=SR, output="sos"), x)
def hp(x, f, o=2): return sosfilt(butter(o, f, "high", fs=SR, output="sos"), x)
def bp(x, lo, hi, o=2): return sosfilt(butter(o, [lo, hi], "band", fs=SR, output="sos"), x)
def noise(n): return rng.standard_normal(n)
def env_ad(n, a, d):
    e = np.ones(n); na, nd = min(n, int(a * SR)), min(n, int(d * SR))
    if na: e[:na] = np.linspace(0, 1, na)
    if nd: e[-nd:] *= np.linspace(1, 0, nd)
    return e
def ir(seconds, decay, bright=4000):
    n = int(seconds * SR)
    return lp(noise(n), bright) * np.exp(-np.arange(n) / SR * decay) * 0.08
ROOM_IR = ir(0.5, 10.0, 5000)
BIG_IR = ir(4.0, 1.3, 3000)          # open night air / slow-motion tail

def ff(x, af):
    a, b = ROOT / "out/_f_in.wav", ROOT / "out/_f_out.wav"
    sf.write(a, x, SR, subtype="FLOAT")
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(a), "-af", af, "-ar", str(SR), str(b)], check=True)
    y, _ = sf.read(b)
    return y if y.ndim == 1 else y.mean(axis=1)

def squeeze_pauses(x, max_pause):
    hop = int(0.01 * SR)
    rms = np.sqrt(np.convolve(x ** 2, np.ones(hop * 3) / (hop * 3), mode="same"))
    quiet = rms < rms.max() * 0.08
    keep = np.ones(len(x), bool)
    i = 0
    while i < len(x):
        if quiet[i]:
            j = i
            while j < len(x) and quiet[j]: j += 1
            if (j - i) / SR > max_pause:
                cut = (j - i) - int(max_pause * SR)
                keep[i + (j - i - cut) // 2: i + (j - i - cut) // 2 + cut] = False
            i = j
        else:
            i += 1
    return x[keep]

def load_raw(key):
    x, sr = sf.read(ROOT / "public" / voices[key]["file"])
    if x.ndim > 1: x = x.mean(axis=1)
    if sr != SR: x = resample_poly(x, SR, sr)
    return x / (np.abs(x).max() + 1e-9) * 0.7

PITCH = 2 ** (-0.8 / 12)
def narr_dry(x, tempo):
    return ff(x, f"asetrate={int(SR * PITCH)},aresample={SR},atempo={tempo / PITCH:.4f}")

raw = {f"{sc['id']}_{n}": squeeze_pauses(load_raw(f"{sc['id']}_{n}"), 0.32) for sc in script["scenes"] for n, _ in enumerate(sc["lines"])}

LEAD = {"s1": 0.9, "s2": 0.5, "s3": 0.5, "s4a": 0.5, "s4b": 0.4, "s5": 1.2}
TAIL = {"s1": 0.5, "s2": 0.6, "s3": 0.6, "s4a": 0.4, "s4b": 0.6, "s5": 2.8}
GAP = {"s2": 0.5, "s3": 1.6, "s5": 0.7}    # s3: room for the slow-motion bang between the two sentences

def layout(dry):
    out = []
    for sc in script["scenes"]:
        L = [{"key": f"{sc['id']}_{n}", "who": l["who"], "text": l["text"], "sub": l.get("sub", l["text"]), "radio": False, "fiction": False, "label": "",
              "dur": round(len(dry[f"{sc['id']}_{n}"]) / SR, 3)} for n, l in enumerate(sc["lines"])]
        cur = LEAD[sc["id"]]
        for i, l in enumerate(L):
            if i: cur += GAP.get(sc["id"], 0.4)
            l["start"] = round(cur, 3); cur += l["dur"]
        out.append({"id": sc["id"], "name": sc["name"], "lines": L, "caption": [], "end": [], "dur": round(max(sc["min"], cur + TAIL[sc["id"]]), 3)})
    return out

tempo = 1.04
dry = {k: narr_dry(x, tempo) for k, x in raw.items()}; scenes = layout(dry)
need = sum(s["dur"] for s in scenes)
if need > TARGET:
    narr = sum(l["dur"] for s in scenes for l in s["lines"])
    tempo = min(1.18, tempo * narr / max(1.0, narr - (need - TARGET)))
    print(f"needs {need:.1f}s: narrator tempo -> x{tempo:.3f}")
    dry = {k: narr_dry(x, tempo) for k, x in raw.items()}; scenes = layout(dry)
TOTAL = round(sum(s["dur"] for s in scenes), 2)
N = int(TOTAL * SR); t = np.arange(N) / SR
start = 0.0
for s in scenes:
    s["start"] = round(start, 3); start += s["dur"]
S = {s["id"]: s for s in scenes}

# ------------------------------------------------------------------ events shared with the visuals (scene-relative seconds)
s2, s3, s4a, s4b, s5 = S["s2"], S["s3"], S["s4a"], S["s4b"], S["s5"]
ev = {
    "s1": {"fuseGlint": 0.0},
    "s2": {"fuseStart": 0.6, "fuseEnd": round(s2["lines"][0]["start"] + s2["lines"][0]["dur"] * 0.55, 3)},
    "s3": {"rupture": round(s3["lines"][0]["start"] + s3["lines"][0]["dur"] * 0.88, 3)},
    "s4a": {"ignite": 0.35, "lift": 1.1},
    "s4b": {"ignite": 0.2},
    "s5": {"bursts": [], "card": round(s5["lines"][1]["start"] - 0.4, 3)},
}
# night-sky shells: (time, x, y, hue, size)
cols = [0.02, 0.58, 0.12, 0.85, 0.33, 0.95, 0.5]
bt = [0.25, 1.0, 1.7, 2.3, 3.0, 3.6, 4.3, 5.0, 5.6]
ev["s5"]["bursts"] = [[round(b, 2), round(float(rng.uniform(-60, 60)), 1), round(float(rng.uniform(150, 230)), 1), cols[i % len(cols)], round(float(rng.uniform(0.8, 1.25)), 2)] for i, b in enumerate(bt) if b < ev["s5"]["card"] - 0.2]
for s in scenes: s["ev"] = ev[s["id"]]

def put(buf, x, at):
    i0 = int(at * SR)
    if i0 >= len(buf) or i0 + len(x) <= 0: return
    if i0 < 0: x, i0 = x[-i0:], 0
    x = x[: len(buf) - i0]
    buf[i0:i0 + len(x)] += x

# ------------------------------------------------------------------ narration
def narrator(x):
    x = hp(x, 55) + 0.3 * lp(x, 180)
    x = np.tanh(x * 1.7) / 1.7
    return x + 0.06 * fftconvolve(x, ROOM_IR)[: len(x)]

dlg = np.zeros(N)
vdir = ROOT / "out/audio/voices"; vdir.mkdir(parents=True, exist_ok=True)
for s in scenes:
    for l in s["lines"]:
        y = narrator(dry[l["key"]]) * 0.95
        sf.write(vdir / f"{l['key']}.wav", y / (np.abs(y).max() + 1e-9) * 0.9, SR, subtype="PCM_24")
        put(dlg, y, s["start"] + l["start"])

# ------------------------------------------------------------------ sound design
sfx = np.zeros((N, 2))
def put2(x, at, pan=0.5):
    put(sfx[:, 0], x * (1 - pan) * 2 ** 0.5 * 0.7, at); put(sfx[:, 1], x * pan * 2 ** 0.5 * 0.7, at)
def crackle(n, rate=60, amp=0.3, seed=1):
    r = np.random.default_rng(seed)
    y = np.zeros(n)
    for i in r.integers(0, n, int(rate * n / SR)):
        m = int(r.uniform(0.002, 0.012) * SR); seg = r.standard_normal(m) * np.exp(-np.arange(m) / SR * r.uniform(300, 900)) * r.uniform(0.3, 1)
        y[i:i + m] += seg[: n - i]
    return hp(y, 1200) * amp
def fuse(length, amp=1.0, seed=2):
    n = int(length * SR); tt = np.arange(n) / SR
    hiss = bp(noise(n), 2500, 9000) * 0.07 * (0.8 + 0.2 * np.sin(2 * np.pi * 7.3 * tt))
    return (hiss + crackle(n, 45, 0.22, seed)) * env_ad(n, 0.05, 0.08) * amp
def thump(amp=1.0, f0=55, length=1.5):
    n = int(length * SR); tt = np.arange(n) / SR
    return (np.sin(2 * np.pi * np.cumsum(f0 * (1 + 2 * np.exp(-tt * 18))) / SR) * np.exp(-tt * 4) + lp(noise(n), 200) * np.exp(-tt * 9)) * amp
def slow_bang(amp=1.0):
    """The rupture, heard 'in slow motion': reversed suck-in, deep pitched-down blast, rolling tail, ringing."""
    n = int(6 * SR); tt = np.arange(n) / SR
    body = lp(noise(n), 500) * np.exp(-tt * 1.4) * 1.6 + np.sin(2 * np.pi * np.cumsum(38 + 60 * np.exp(-tt * 3)) / SR) * np.exp(-tt * 1.1) * 1.2
    crack = hp(noise(int(0.25 * SR)), 1500) * np.exp(-np.arange(int(0.25 * SR)) / SR * 14) * 0.9
    body[: len(crack)] += crack
    tail = fftconvolve(body * 0.4, BIG_IR)[:n]
    ring = np.sin(2 * np.pi * 3200 * tt) * np.exp(-tt * 0.9) * 0.012 * np.clip(tt / 0.5, 0, 1)   # ears ringing
    y = np.tanh((body + tail) * 1.4) * 0.8 + ring
    nr = int(0.9 * SR); trr = np.arange(nr) / SR
    pre = (bp(noise(nr), 300, 4000) * (trr / 0.9) ** 3 * 0.35)
    return np.concatenate([pre, y]) * amp, 0.9
def rocket_whoosh(length, amp=1.0):
    n = int(length * SR); tt = np.arange(n) / SR
    roar = lp(noise(n), 2500) * 0.5 + bp(noise(n), 3000, 9000) * 0.15
    whistle = np.sin(2 * np.pi * np.cumsum(1700 + 900 * np.clip(tt / length, 0, 1)) / SR) * 0.05
    e = np.clip(tt / 0.15, 0, 1) * np.exp(-np.clip(tt - 1.2, 0, None) * 0.55)          # recedes as it climbs
    return (roar + whistle + crackle(n, 80, 0.15, 5)) * e * amp
def spinner(length, amp=1.0):
    n = int(length * SR); tt = np.arange(n) / SR
    rot = 3 + 9 * np.clip(tt / 1.5, 0, 1)                                                   # spins up to 12 rev/s
    ph = np.cumsum(rot) / SR
    am = 0.55 + 0.45 * np.sin(2 * np.pi * ph * 2)
    whirr = bp(noise(n), 900, 7000) * 0.35 * am
    whistle = np.sin(2 * np.pi * np.cumsum(900 + 1400 * np.clip(tt / 1.8, 0, 1) + 60 * np.sin(2 * np.pi * ph)) / SR) * 0.05
    return (whirr + whistle + crackle(n, 120, 0.2, 7)) * env_ad(n, 0.1, 0.8) * amp
def shell(amp=1.0, dist=1.0, seed=3):
    n = int(4 * SR); tt = np.arange(n) / SR
    boom = lp(noise(n), 300) * np.exp(-tt * 3.5) * 1.3 + np.sin(2 * np.pi * 48 * tt) * np.exp(-tt * 5)
    y = boom + crackle(n, 140, 0.25, seed) * np.exp(-np.clip(tt - 0.4, 0, None) * 1.5) * np.clip((tt - 0.35) / 0.1, 0, 1)
    y = lp(y, 6000 / dist)
    echo = np.zeros(n + int(0.6 * SR)); echo[:n] += y; echo[int(0.6 * SR):] += y * 0.3
    return echo * amp

def sparkle_bed(n, amp=0.05, seed=11):
    return crackle(n, 18, amp * 3, seed) + bp(noise(n), 4000, 12000) * amp * 0.1

for s in scenes:
    a, d, e = s["start"], s["dur"], s["ev"]; n = int(d * SR)
    if s["id"] == "s1":
        put2(sparkle_bed(n, 0.05) * env_ad(n, 1.0, 0.3), a, 0.6)
        put2(thump(0.35, 45, 2.0), a + 0.05)
    elif s["id"] == "s2":
        put2(fuse(e["fuseEnd"] - e["fuseStart"] + 0.2, 0.9), a + e["fuseStart"])
        nr = int((d - e["fuseEnd"]) * SR); tr = np.arange(nr) / SR
        rumble = lp(noise(nr), 160) * (tr / (nr / SR)) ** 1.5 * 0.5 + bp(noise(nr), 800, 4000) * (tr / (nr / SR)) ** 2 * 0.08
        put2(rumble + crackle(nr, 90, 0.18, 4) * (tr / (nr / SR)), a + e["fuseEnd"])
        put2(thump(0.4, 70, 0.6), a + e["fuseEnd"])
    elif s["id"] == "s3":
        nb = int(e["rupture"] * SR); tb = np.arange(nb) / SR
        put2(lp(noise(nb), 120) * (tb / max(tb[-1], 1e-3)) ** 2 * 0.6, a)                  # pressure swelling (slowed)
        y, pre = slow_bang(1.2)
        put2(y, a + e["rupture"] - pre)
        nd = int((d - e["rupture"] - 0.5) * SR)
        put2(crackle(nd, 30, 0.2, 9) * np.exp(-np.arange(nd) / SR * 0.7), a + e["rupture"] + 0.5, 0.65)   # falling debris
    elif s["id"] == "s4a":
        put2(fuse(e["ignite"] + 0.1, 0.5, 6), a)
        put2(rocket_whoosh(d - e["ignite"], 1.0), a + e["ignite"])
    elif s["id"] == "s4b":
        put2(spinner(d - e["ignite"], 0.9), a + e["ignite"])
    elif s["id"] == "s5":
        for k, (bt_, x, y_, hue, size) in enumerate(e["bursts"]):
            pan = 0.5 + x / 160
            put2(bp(noise(int(0.7 * SR)), 1500, 5000) * np.linspace(0, 0.06, int(0.7 * SR)), a + bt_ - 0.7, pan)   # shell rising
            put2(shell(0.55 * size, 1.0 + (k % 3) * 0.4, 20 + k), a + bt_, pan)
        put2(sparkle_bed(n, 0.03, 12) * env_ad(n, 0.5, 2.5), a, 0.4)

# ------------------------------------------------------------------ score: wonder, tension into the bang, lift for the fireworks
mus = np.zeros((N, 2))
NOTE = lambda m: 440 * 2 ** ((m - 69) / 12)
def pad(notes, at, dur, amp=0.1, attack=2.0, release=2.5, bright=1200):
    n = int((dur + release) * SR); tt = np.arange(n) / SR
    y = np.zeros(n)
    for m in notes:
        f = NOTE(m)
        for dv in (-0.005, 0, 0.006):
            y += 2 * ((f * (1 + dv) * tt + rng.random()) % 1) - 1
    y = lp(y / (len(notes) * 3), bright)
    y *= np.clip(tt / attack, 0, 1) * np.clip((dur + release - tt) / release, 0, 1) * amp
    pan = rng.random() * 0.4 + 0.3
    i0 = int(at * SR); y = y[: max(0, N - i0)]
    mus[i0:i0 + len(y), 0] += y * (1 - pan); mus[i0:i0 + len(y), 1] += y * pan
def pluck(m, at, amp=0.08, pan=0.5):
    n = int(1.2 * SR); tt = np.arange(n) / SR
    f = NOTE(m)
    y = (np.sin(2 * np.pi * f * tt) + 0.35 * np.sin(4 * np.pi * f * tt) + 0.12 * np.sin(6 * np.pi * f * tt)) * np.exp(-tt * 4.5) * amp
    put(mus[:, 0], y * (1 - pan), at); put(mus[:, 1], y * pan, at)
def hit(at, amp=0.5):
    n = int(5 * SR); tt = np.arange(n) / SR
    y = sum(np.sin(2 * np.pi * NOTE(m) * tt) / (i + 1) for i, m in enumerate([26, 38, 45, 50]))
    y = lp(np.tanh(y * 2.2) * np.exp(-tt * 0.8) * np.clip(tt / 0.03, 0, 1) * amp, 900)
    put(mus[:, 0], y, at); put(mus[:, 1], y, at)
def riser(end, length=2.5, amp=0.1):
    n = int(length * SR); tt = np.arange(n) / SR
    y = (np.sin(2 * np.pi * np.cumsum(200 + 2600 * (tt / length) ** 2) / SR) * 0.3 + bp(noise(n), 500, 7000)) * (tt / length) ** 2 * amp
    put(mus[:, 0], y, end - length); put(mus[:, 1], y, end - length)

st = {s["id"]: s["start"] for s in scenes}
rup = st["s3"] + S["s3"]["ev"]["rupture"]
# D minor / D major colour: mystery -> tension -> release
pad([50, 57, 62, 65], 0, st["s2"] + 1, 0.07, 2.5, 2.0, 1400)
pad([50, 57, 63, 65], st["s2"], S["s2"]["dur"] + 1, 0.07, 1.5, 1.5, 1600)
pulse_bpm = 96
k = 0
while (tk := st["s2"] + k * 60 / pulse_bpm) < rup - 0.9:                      # clock-like pulse that tightens toward the bang
    prog = (tk - st["s2"]) / (rup - st["s2"])
    pluck([62, 69, 65, 69][k % 4], tk, 0.05 + 0.05 * prog, 0.35 + 0.3 * (k % 2))
    k += 1 + (0 if prog < 0.6 else 1) * 0
riser(rup - 0.9, 3.0, 0.1)
mus[int((rup - 0.9) * SR):int((rup - 0.05) * SR)] *= np.linspace(1, 0, int((rup - 0.05) * SR) - int((rup - 0.9) * SR))[:, None]   # hold breath
hit(rup, 0.55)
pad([38, 45, 50], rup + 0.3, st["s4a"] - rup + 0.5, 0.05, 2.0, 1.5, 700)
pad([50, 57, 62, 66], st["s4a"], S["s4a"]["dur"] + S["s4b"]["dur"], 0.06, 1.0, 2.0, 1800)
for j in range(int((S["s4a"]["dur"] + S["s4b"]["dur"]) * 2)):                  # driving eighth-note motion for the flight
    pluck([62, 66, 69, 74, 69, 66][j % 6], st["s4a"] + j * 0.5, 0.045, 0.3 + 0.4 * (j % 2))
pad([50, 57, 62, 66, 69], st["s5"], S["s5"]["dur"] - 1.5, 0.08, 1.5, 2.5, 2400)   # big warm finish
pad([74, 78, 81], st["s5"] + 1.0, S["s5"]["dur"] - 2.5, 0.025, 2.0, 2.5, 5000)
hit(st["s5"] + S["s5"]["ev"]["card"], 0.3)

# ------------------------------------------------------------------ mix
level = np.convolve(np.abs(dlg), np.ones(int(0.2 * SR)) / int(0.2 * SR), mode="same")
duck = 1 - 0.5 * np.clip(level / (np.percentile(level[level > 1e-4], 90) + 1e-9), 0, 1)
duck = np.convolve(duck, np.ones(int(0.15 * SR)) / int(0.15 * SR), mode="same")
dlg_st = np.stack([dlg, dlg], axis=1)
out = ROOT / "out/audio"; out.mkdir(parents=True, exist_ok=True)
for name, x in (("dialogue", dlg_st), ("sfx", sfx), ("music", mus)):
    sf.write(out / f"{name}.wav", x / (np.abs(x).max() + 1e-9) * 0.9, SR, subtype="PCM_24")
mix = dlg_st * 1.0 + sfx * 0.75 * duck[:, None] + mus * 0.8 * duck[:, None]
mix = np.tanh(mix / (np.abs(mix).max() + 1e-9) * 1.6) / np.tanh(1.6)
fade = np.clip((TOTAL - t) / 1.0, 0, 1)[:, None] * np.clip(t / 0.15, 0, 1)[:, None]
sf.write(out / "mix-raw.wav", mix * fade * 0.9, SR, subtype="PCM_24")
(ROOT / "public/audio").mkdir(parents=True, exist_ok=True)
subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(out / "mix-raw.wav"), "-af", "loudnorm=I=-14:TP=-1.0:LRA=14", "-ar", str(SR), str(ROOT / "public/audio/mix.wav")], check=True)
for p in (ROOT / "out/_f_in.wav", ROOT / "out/_f_out.wav"): p.unlink(missing_ok=True)

(ROOT / "src/timeline.json").write_text(json.dumps({"fps": 30, "duration": TOTAL, "title": script["title"], "scenes": scenes}, indent=2, ensure_ascii=False))
print(f"total {TOTAL}s (narrator tempo x{tempo:.3f})")
for s in scenes:
    print(f"{s['id']} {s['name']:<18} {s['start']:6.2f}s  +{s['dur']:5.2f}s  lines at " + ", ".join(f"{l['start']:.1f}+{l['dur']:.1f}" for l in s["lines"]) + f"  ev {s['ev']}")
