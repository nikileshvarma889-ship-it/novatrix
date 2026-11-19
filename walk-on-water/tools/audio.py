"""Soundtrack for "Jesus Walked on Water": narration chain, storm sound design, emotional score, mix, timeline.
Reads script/script.json + public/audio/voices.json. Writes public/audio/mix.wav (-14 LUFS) and src/timeline.json."""
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
rng = np.random.default_rng(33)
def lp(x, f, o=2): return sosfilt(butter(o, f, "low", fs=SR, output="sos"), x)
def hp(x, f, o=2): return sosfilt(butter(o, f, "high", fs=SR, output="sos"), x)
def bp(x, lo, hi, o=2): return sosfilt(butter(o, [lo, hi], "band", fs=SR, output="sos"), x)
def noise(n): return rng.standard_normal(n)
def env(n, a, d):
    e = np.ones(n); na, nd = min(n, int(a * SR)), min(n, int(d * SR))
    if na: e[:na] = np.linspace(0, 1, na)
    if nd: e[-nd:] *= np.linspace(1, 0, nd)
    return e
HALL = lp(noise(int(3.5 * SR)), 3000) * np.exp(-np.arange(int(3.5 * SR)) / SR * 1.5) * 0.06
ROOMIR = lp(noise(int(0.6 * SR)), 5000) * np.exp(-np.arange(int(0.6 * SR)) / SR * 9) * 0.08
def ff(x, af):
    a, b = ROOT / "out/_f_in.wav", ROOT / "out/_f_out.wav"
    sf.write(a, x, SR, subtype="FLOAT"); subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(a), "-af", af, "-ar", str(SR), str(b)], check=True)
    y, _ = sf.read(b); return y if y.ndim == 1 else y.mean(axis=1)
def squeeze(x, mx):
    hop = int(0.01 * SR); rms = np.sqrt(np.convolve(x ** 2, np.ones(hop * 3) / (hop * 3), mode="same")); q = rms < rms.max() * 0.08
    keep = np.ones(len(x), bool); i = 0
    while i < len(x):
        if q[i]:
            j = i
            while j < len(x) and q[j]: j += 1
            if (j - i) / SR > mx: c = (j - i) - int(mx * SR); keep[i + (j - i - c) // 2: i + (j - i - c) // 2 + c] = False
            i = j
        else: i += 1
    return x[keep]
def load(k):
    x, sr = sf.read(ROOT / "public" / voices[k]["file"]); x = x.mean(axis=1) if x.ndim > 1 else x
    if sr != SR: x = resample_poly(x, SR, sr)
    return x / (np.abs(x).max() + 1e-9) * 0.7
PITCH = 2 ** (-1.0 / 12)
raw = {f"{sc['id']}_{n}": squeeze(load(f"{sc['id']}_{n}"), 0.4) for sc in script["scenes"] for n, _ in enumerate(sc["lines"])}
def dry_at(tempo): return {k: ff(x, f"asetrate={int(SR * PITCH)},aresample={SR},atempo={tempo / PITCH:.4f}") for k, x in raw.items()}
LEAD = {"s1": 0.8, "s2": 0.3, "s3": 0.4, "s4": 0.3, "s5": 0.3, "s6": 0.4}
TAIL = {"s1": 0.3, "s2": 0.3, "s3": 0.6, "s4": 0.3, "s5": 0.5, "s6": 1.4}
def layout(dry):
    out = []
    for sc in script["scenes"]:
        L = [{"key": f"{sc['id']}_{n}", "who": l["who"], "text": l["text"], "sub": l["text"], "radio": False, "fiction": False, "label": "", "dur": round(len(dry[f"{sc['id']}_{n}"]) / SR, 3)} for n, l in enumerate(sc["lines"])]
        cur = LEAD[sc["id"]]
        for i, l in enumerate(L):
            if i: cur += 0.4
            l["start"] = round(cur, 3); cur += l["dur"]
        out.append({"id": sc["id"], "name": sc["name"], "lines": L, "dur": round(max(sc["min"], cur + TAIL[sc["id"]]), 3)})
    return out
tempo = 1.0; dry = dry_at(tempo); scenes = layout(dry); need = sum(s["dur"] for s in scenes)
if need > TARGET + 0.5:
    narr = sum(l["dur"] for s in scenes for l in s["lines"])
    tempo = min(1.15, narr / max(1.0, narr - (need - TARGET)))
    print(f"needs {need:.1f}s -> tempo x{tempo:.3f}"); dry = dry_at(tempo); scenes = layout(dry)
TOTAL = round(sum(s["dur"] for s in scenes), 2); N = int(TOTAL * SR); t = np.arange(N) / SR
start = 0.0
for s in scenes: s["start"] = round(start, 3); start += s["dur"]
S = {s["id"]: s for s in scenes}; st = {k: v["start"] for k, v in S.items()}
def frac(sid, f): l = S[sid]["lines"][0]; return round(l["start"] + l["dur"] * f, 2)
# beats the picture follows (scene-local)
S["s1"]["bolts"] = [0.3, round(S["s1"]["lines"][1]["start"], 2), round(S["s1"]["dur"] - 1.0, 2)]
S["s2"]["bolts"] = [round(frac("s2", 0.3), 2)]
S["s3"]["speakAt"] = frac("s3", 0.0)
S["s3"]["bolts"] = [0.25]
S["s4"]["stepAt"] = 0.3; S["s4"]["windAt"] = frac("s4", 0.58); S["s4"]["sinkAt"] = frac("s4", 0.82)
S["s4"]["bolts"] = [round(frac("s4", 0.6), 2)]
S["s5"]["grabAt"] = frac("s5", 0.7)
def put(buf, x, at):
    i = int(at * SR)
    if i >= len(buf) or i + len(x) <= 0: return
    if i < 0: x, i = x[-i:], 0
    x = x[: len(buf) - i]; buf[i:i + len(x)] += x
# ---------------------------------------------------------------- narration
def narr(x):
    x = hp(x, 45) + 0.4 * lp(x, 180); x = np.tanh(x * 1.5) / 1.5
    return x + 0.05 * fftconvolve(x, HALL)[: len(x)]
dlg = np.zeros(N)
for s in scenes:
    for l in s["lines"]: put(dlg, narr(dry[l["key"]]), s["start"] + l["start"])
# ---------------------------------------------------------------- storm sound design
sfx = np.zeros((N, 2))
def put2(x, at, pan=0.5): put(sfx[:, 0], x * (1 - pan) * 1.4, at); put(sfx[:, 1], x * pan * 1.4, at)
storm_amt = np.interp(t, [0, 1, st["s5"] + S["s5"]["grabAt"], st["s6"] + 1.5, TOTAL], [0.4, 1, 1, 0.15, 0.08])
def windbed(n, seed):
    r = np.random.default_rng(seed); tt = np.arange(n) / SR
    gust = 0.6 + 0.4 * np.sin(2 * np.pi * 0.13 * tt + seed) * np.sin(2 * np.pi * 0.31 * tt)
    howl = bp(r.standard_normal(n), 350, 900) * (0.5 + 0.5 * np.sin(2 * np.pi * 0.2 * tt + seed)) * 0.25
    return (lp(r.standard_normal(n), 600) * 0.6 + howl) * gust
def sea(n, seed):
    r = np.random.default_rng(seed); tt = np.arange(n) / SR
    swell = np.clip(np.sin(2 * np.pi * tt / 3.7 + seed), 0, 1) ** 2
    return lp(r.standard_normal(n), 1200) * (0.3 + swell) * 0.5 + bp(r.standard_normal(n), 2500, 8000) * swell ** 3 * 0.15
def rain(n, seed):
    r = np.random.default_rng(seed); return bp(r.standard_normal(n), 2000, 10000) * 0.12 + (r.random(n) > 0.997) * r.standard_normal(n) * 0.12
for ch, seed in ((0, 1), (1, 2)):
    sfx[:, ch] += (windbed(N, seed) * 0.5 + sea(N, seed + 4) * 0.6 + rain(N, seed + 8) * 0.5) * storm_amt
def thunder(amp=0.8, close=True):
    n = int(5 * SR); tt = np.arange(n) / SR
    crack = bp(noise(n), 800, 6000) * np.exp(-tt * 14) * (1.2 if close else 0.2)
    rumble = lp(noise(n), 160) * (0.6 + 0.4 * np.sin(2 * np.pi * 1.1 * tt)) * np.exp(-tt * 0.7) * 2.2
    return (crack + rumble) * np.clip(tt / 0.01, 0, 1) * amp
def crash(amp=0.5):
    n = int(2.2 * SR); tt = np.arange(n) / SR
    return (lp(noise(n), 1800) * np.exp(-tt * 2.2) + bp(noise(n), 3000, 9000) * np.exp(-tt * 4) * 0.4) * env(n, 0.04, 0.5) * amp
def creak(amp=0.15, seed=0):
    r = np.random.default_rng(seed); n = int(0.9 * SR); tt = np.arange(n) / SR
    f = 140 + 60 * np.sin(2 * np.pi * 1.2 * tt + seed)
    pulses = (np.sin(2 * np.pi * np.cumsum(f) / SR) > 0.97).astype(float)
    return bp(pulses + r.standard_normal(n) * 0.05, 300, 2500) * env(n, 0.1, 0.3) * amp
def splash(amp=0.35):
    n = int(1.2 * SR); tt = np.arange(n) / SR
    return bp(noise(n), 400, 6000) * np.exp(-tt * 4) * env(n, 0.01, 0.4) * amp
def whoosh(len_=1.2, amp=0.25):
    n = int(len_ * SR); tt = np.arange(n) / SR; return bp(noise(n), 300, 3000) * np.sin(np.pi * tt / len_) ** 2 * amp
for sid in ("s1", "s2", "s3", "s4"):
    for b in S[sid].get("bolts", []): put2(thunder(0.7 if sid != "s2" else 0.5), st[sid] + b + 0.05, 0.4 + 0.2 * rng.random())
for k in range(6): put2(crash(0.45), st["s1"] + 0.8 + k * 2.1, 0.3 + 0.4 * (k % 2))
for k in range(10): put2(creak(0.18, k), st["s1"] + 0.5 + k * 1.6, 0.5)
for k in range(4): put2(crash(0.35), st["s3"] + 0.4 + k * 1.8, 0.4 + 0.2 * (k % 2))
put2(splash(0.3), st["s4"] + S["s4"]["stepAt"] + 0.6, 0.6)
put2(whoosh(1.6, 0.45), st["s4"] + S["s4"]["windAt"] - 0.3, 0.5)
put2(splash(0.55), st["s4"] + S["s4"]["sinkAt"], 0.5); put2(splash(0.4), st["s4"] + S["s4"]["sinkAt"] + 0.5, 0.45)
put2(splash(0.45), st["s5"] + S["s5"]["grabAt"], 0.5)
# ---------------------------------------------------------------- score: D minor, strings, low drums, choir swell, resolves to D major
mus = np.zeros((N, 2))
NOTE = lambda m: 440 * 2 ** ((m - 69) / 12)
def strings(notes, at, dur, amp=0.06, bright=1600, attack=1.5, release=2.0):
    n = int((dur + release) * SR); tt = np.arange(n) / SR
    y = sum(sum(2 * ((NOTE(m) * (1 + dv) * tt + rng.random()) % 1) - 1 for dv in (-0.005, 0, 0.005)) * (1 + 0.004 * np.sin(2 * np.pi * 5.2 * tt)) for m in notes) / (3 * len(notes))
    y = lp(y, bright) * np.clip(tt / attack, 0, 1) * np.clip((dur + release - tt) / release, 0, 1) * amp
    y = y + fftconvolve(y, HALL)[:n] * 0.6
    put(mus[:, 0], y, at); put(mus[:, 1], y, at)
def choir(notes, at, dur, amp=0.05, vowel=(700, 1150), attack=2.0, release=2.5):
    n = int((dur + release) * SR); tt = np.arange(n) / SR
    src = sum(sum(2 * ((NOTE(m) * (1 + dv) * tt + rng.random()) % 1) - 1 for dv in (-0.007, -0.002, 0.003, 0.008)) for m in notes)
    y = bp(src, vowel[0] * 0.75, vowel[0] * 1.3) + 0.6 * bp(src, vowel[1] * 0.8, vowel[1] * 1.25)
    y = y / (np.abs(y).max() + 1e-9) * np.clip(tt / attack, 0, 1) * np.clip((dur + release - tt) / release, 0, 1) * amp
    y = y + fftconvolve(y, HALL)[:n] * 0.9
    put(mus[:, 0], y, at); put(mus[:, 1], y, at)
def drum(at, amp=0.4):
    n = int(1.5 * SR); tt = np.arange(n) / SR
    y = np.sin(2 * np.pi * (55 + 40 * np.exp(-tt * 20)) * tt) * np.exp(-tt * 3.5) + lp(noise(n), 200) * np.exp(-tt * 8) * 0.5
    y = y + fftconvolve(y, HALL)[:n] * 0.5
    put(mus[:, 0], y * amp, at); put(mus[:, 1], y * amp, at)
def riser(end, length=2.5, amp=0.06):
    n = int(length * SR); tt = np.arange(n) / SR; y = bp(noise(n), 300, 6000) * (tt / length) ** 2.5 * amp
    put(mus[:, 0], y, end - length); put(mus[:, 1], y, end - length)
grabT = st["s5"] + S["s5"]["grabAt"]
strings([38, 45, 50], 0, st["s2"] + 0.5, 0.05, 900)                         # Dm, low, ominous
strings([38, 45, 50, 53], st["s2"], st["s3"] - st["s2"] + 0.5, 0.06, 1200)
choir([62, 65, 69], st["s2"] + 0.8, st["s3"] - st["s2"], 0.035)             # the figure: a hushed choir
strings([34, 41, 46, 50], st["s3"], st["s4"] - st["s3"] + 0.3, 0.06, 1200)   # Bb
strings([36, 43, 48, 52], st["s4"], S["s4"]["sinkAt"], 0.065, 1500)         # C
strings([33, 40, 45, 49], st["s4"] + S["s4"]["sinkAt"], grabT - st["s4"] - S["s4"]["sinkAt"], 0.07, 1300)   # A (tension)
for k in range(int((grabT - st["s1"] - 1) / 1.45)): drum(st["s1"] + 1 + k * 1.45, 0.25 + 0.2 * (k * 1.45 / grabT))
riser(grabT, 3.0, 0.06)
strings([38, 45, 50, 54, 57], grabT, TOTAL - grabT, 0.08, 2400, 0.4, 2.0)   # D major: resolution
choir([62, 66, 69, 74], grabT, TOTAL - grabT, 0.06, (650, 1080), 0.8, 2.0)
drum(grabT, 0.7)
# ---------------------------------------------------------------- mix
lvl = np.convolve(np.abs(dlg), np.ones(int(0.2 * SR)) / int(0.2 * SR), mode="same")
duck = 1 - 0.5 * np.clip(lvl / (np.percentile(lvl[lvl > 1e-4], 90) + 1e-9), 0, 1); duck = np.convolve(duck, np.ones(int(0.15 * SR)) / int(0.15 * SR), mode="same")
mix = np.stack([dlg, dlg], 1) / (np.abs(dlg).max() + 1e-9) * 0.8 + sfx / (np.abs(sfx).max() + 1e-9) * 0.45 * duck[:, None] + mus / (np.abs(mus).max() + 1e-9) * 0.55 * duck[:, None]
mix /= np.abs(mix).max() + 1e-9
fade = np.clip((TOTAL - t) / 1.5, 0, 1)[:, None] * np.clip(t / 0.3, 0, 1)[:, None]
out = ROOT / "out/audio"; out.mkdir(parents=True, exist_ok=True)
sf.write(out / "mix-raw.wav", mix * fade * 0.9, SR, subtype="PCM_24")
subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(out / "mix-raw.wav"), "-af", "loudnorm=I=-14:TP=-1.0:LRA=12", "-ar", str(SR), str(ROOT / "public/audio/mix.wav")], check=True)
for p in (ROOT / "out/_f_in.wav", ROOT / "out/_f_out.wav"): p.unlink(missing_ok=True)
(ROOT / "src/timeline.json").write_text(json.dumps({"fps": 30, "duration": TOTAL, "title": script["title"], "scenes": scenes}, indent=2, ensure_ascii=False))
print(f"total {TOTAL}s tempo x{tempo:.3f}")
for s in scenes: print(s["id"], f"{s['start']:.2f}+{s['dur']:.2f}", [(l['start'], l['dur']) for l in s['lines']], {k: v for k, v in s.items() if k.endswith('At') or k == 'bolts'})
