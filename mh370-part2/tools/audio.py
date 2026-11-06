"""MH370 Part 2 soundtrack: dialogue processing, sound design, score, stems, master mix, timeline.

Reads script/script.json + public/audio/voices.json (from tools/voice.py).
Writes:
  out/audio/dialogue.wav, out/audio/sfx.wav, out/audio/music.wav   (stems, 48 kHz stereo)
  out/audio/voices/<line>_<who>.wav                                 (each processed voice line)
  public/audio/mix.wav                                               (master, -14 LUFS, -1 dBTP)
  src/timeline.json                                                  (scene / line / beat timing for the visuals)
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
rng = np.random.default_rng(370)

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
ROOM_IR = ir(0.6, 9.0, 5000)
HALL_IR = ir(3.2, 1.8, 2600)

def ff(x, af):
    """Run an ffmpeg audio filter over a mono float signal."""
    a, b = ROOT / "out/_f_in.wav", ROOT / "out/_f_out.wav"
    sf.write(a, x, SR, subtype="FLOAT")
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(a), "-af", af, "-ar", str(SR), str(b)], check=True)
    y, _ = sf.read(b)
    return y if y.ndim == 1 else y.mean(axis=1)

def squeeze_pauses(x, max_pause):
    hop = int(0.01 * SR)
    rms = np.sqrt(np.convolve(x ** 2, np.ones(hop * 3) / (hop * 3), mode="same"))
    quiet = rms < rms.max() * 0.04
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

# ------------------------------------------------------------------ dry voices: narrator one semitone deeper, pauses tightened
PITCH = 2 ** (-1.2 / 12)
def narr_dry(x, tempo):
    return ff(x, f"asetrate={int(SR * PITCH)},aresample={SR},atempo={tempo / PITCH:.4f}")

raw = {}
for sc in script["scenes"]:
    for n, l in enumerate(sc["lines"]):
        k = f"{sc['id']}_{n}"
        raw[k] = squeeze_pauses(load_raw(k), 0.3 if l["who"] == "NARRATOR" else 0.4 if l["who"] != "GHOST" else 0.6)

def build_dry(tempo):
    d = {}
    for k, x in raw.items():
        who = voices[k]["who"]
        d[k] = narr_dry(x, tempo) if who == "NARRATOR" else ff(x, "atempo=1.05") if who == "CTRL" else x
    return d

LEAD = {"s1": 1.0, "s2": 0.6, "s3": 0.8, "s4": 0.6, "s5": 0}
TAIL = {"s1": 0.5, "s2": 0.7, "s3": 0.7, "s4": 2.2, "s5": 0}

def gap(sc, prev, cur):
    if cur["who"] == "GHOST": return 0.8 if sc == "s3" else 0.6          # static swells before the voice
    if prev["who"] == "GHOST": return 0.6                                  # silence after it
    if cur["text"].startswith("Still unknown"): return 0.7
    if cur["text"].startswith("But on the radar"): return 0.8
    if cur["who"] == "CTRL": return 0.35
    return 0.32

def layout(dry):
    out = []
    for sc in script["scenes"]:
        L = [{"key": f"{sc['id']}_{n}", "who": l["who"], "text": l["text"], "sub": l.get("sub", l["text"]), "radio": script["voices"][l["who"]]["radio"],
              "fiction": l["who"] in ("GHOST", "CTRL", "CTRL_W"), "label": script["voices"][l["who"]].get("label", ""), "dur": round(len(dry[f"{sc['id']}_{n}"]) / SR, 3)} for n, l in enumerate(sc["lines"])]
        s = {"id": sc["id"], "name": sc["name"], "lines": L, "caption": sc.get("caption", []), "end": sc.get("end", [])}
        cur = LEAD[sc["id"]]
        for i, l in enumerate(L):
            if i: cur += gap(sc["id"], L[i - 1], l)
            l["start"] = round(cur, 3); cur += l["dur"]
        s["dur"] = round(max(sc["min"], cur + TAIL[sc["id"]]), 3)
        if sc["id"] == "s1": s["cut"] = round(L[1]["start"] - 0.3, 3)
        out.append(s)
    return out

tempo = 1.08
dry = build_dry(tempo); scenes = layout(dry)
need = sum(s["dur"] for s in scenes)
if need > TARGET + 2:
    narr = sum(l["dur"] for s in scenes for l in s["lines"] if l["who"] == "NARRATOR")
    tempo = min(1.2, tempo * narr / max(1.0, narr - (need - TARGET - 2)))
    print(f"needs {need:.1f}s: narrator tempo -> x{tempo:.3f}")
    dry = build_dry(tempo); scenes = layout(dry)
TOTAL = round(sum(s["dur"] for s in scenes), 2)
N = int(TOTAL * SR); t = np.arange(N) / SR
start = 0.0
for s in scenes:
    s["start"] = round(start, 3); start += s["dur"]
S = {s["id"]: s for s in scenes}
A = lambda sid, k: S[sid]["start"] + S[sid][k]
def put(buf, x, at):
    i0 = int(at * SR)
    if i0 >= len(buf) or i0 + len(x) <= 0: return
    if i0 < 0: x, i0 = x[-i0:], 0
    x = x[: len(buf) - i0]
    buf[i0:i0 + len(x)] += x

# ------------------------------------------------------------------ voice chains
def narrator(x):
    x = hp(x, 55) + 0.35 * lp(x, 180)                      # chest / proximity
    x = np.tanh(x * 1.8) / 1.8
    return x + 0.08 * fftconvolve(x, ROOM_IR)[: len(x)]

def vhf(x, seed, hiss=0.025):
    """Modern VHF airband: band-limited, compressed, light hiss, squelch tail."""
    r = np.random.default_rng(seed)
    n = len(x)
    y = bp(x, 300, 3200, 3)
    y = np.tanh(y * 3.2) / 2.0
    y = y + bp(r.standard_normal(n), 500, 5000) * hiss
    on = bp(r.standard_normal(int(0.06 * SR)), 1000, 6000) * np.linspace(0.25, 0, int(0.06 * SR))
    tail = bp(r.standard_normal(int(0.22 * SR)), 600, 7000) * np.linspace(0.3, 0, int(0.22 * SR)) ** 1.5
    return np.concatenate([on, y, tail])

def ghost(x, seed):
    """The last call: same voice, far away, failing, in a huge empty space."""
    r = np.random.default_rng(seed)
    x = resample_poly(x, 100, 94)                           # a little lower and slower
    y = vhf(x, seed, 0.06)
    drop = np.ones(len(y))
    for _ in range(int(len(y) / SR * 1.2)):
        i = r.integers(0, len(y)); w = int(r.uniform(0.04, 0.16) * SR); drop[i:i + w] *= 0.15
    y = y * lp(drop, 25)
    rev = fftconvolve(y, HALL_IR)
    y = np.concatenate([y, np.zeros(len(rev) - len(y))]) * 0.85 + rev * 0.9
    echo = np.zeros(len(y) + int(1.6 * SR)); echo[: len(y)] += y
    echo[int(0.8 * SR): int(0.8 * SR) + len(y)] += y * 0.28        # the call repeats, fading, into nothing
    echo[int(1.6 * SR): int(1.6 * SR) + len(y)] += y * 0.1
    return echo

def room_voice(x):
    x = hp(x, 90)
    return x + 0.22 * fftconvolve(x, ROOM_IR)[: len(x)]

dlg = np.zeros(N)
vdir = ROOT / "out/audio/voices"; vdir.mkdir(parents=True, exist_ok=True)
for s in scenes:
    for k, l in enumerate(s["lines"]):
        x = dry[l["key"]]
        if l["who"] == "GHOST": y, lead = ghost(x, 9 + k), 0.06
        elif l["who"] in ("CTRL", "CTRL_W"): y, lead = room_voice(x) * (1.0 if l["who"] == "CTRL" else 0.8), 0.0
        else: y, lead = narrator(x) * 0.95, 0.0
        sf.write(vdir / f"{l['key']}_{l['who'].lower()}.wav", y / (np.abs(y).max() + 1e-9) * 0.9, SR, subtype="PCM_24")
        put(dlg, y, s["start"] + l["start"] - lead)

# ------------------------------------------------------------------ sound design
sfx = np.zeros((N, 2))
def put2(x, at, pan=0.5):
    put(sfx[:, 0], x * (1 - pan) * 2 ** 0.5 * 0.7, at); put(sfx[:, 1], x * pan * 2 ** 0.5 * 0.7, at)

def room(n, hum=0.008):
    tt = np.arange(n) / SR
    return lp(noise(n), 400) * 0.03 + hum * (np.sin(2 * np.pi * 50 * tt) + 0.5 * np.sin(2 * np.pi * 100 * tt))

def static(n, amt=0.06, seed=5):
    r = np.random.default_rng(seed)
    return (bp(r.standard_normal(n), 300, 6000) * amt + (r.random(n) > 0.9992) * r.standard_normal(n) * amt * 4)

def boom(length=6, amp=1.0):
    n = int(length * SR); tt = np.arange(n) / SR
    y = lp(noise(n), 90) * np.exp(-tt * 0.8) * 2.2 + np.sin(2 * np.pi * (42 - 14 * tt / length) * tt) * np.exp(-tt * 1.0) * 0.8
    return y * np.clip(tt / 0.01, 0, 1) * amp

def tick(f=1500, l=0.06, amp=0.05):
    n = int(l * SR); tt = np.arange(n) / SR
    return np.sin(2 * np.pi * f * tt) * np.exp(-tt * 60) * amp

def ping(f=1250, amp=0.07):
    n = int(0.9 * SR); tt = np.arange(n) / SR
    return np.sin(2 * np.pi * f * tt) * np.exp(-tt * 6) * amp + np.sin(2 * np.pi * f * 2.01 * tt) * np.exp(-tt * 9) * amp * 0.3

def horn(length=3.0, amp=0.25):
    n = int(length * SR); tt = np.arange(n) / SR
    y = sum(np.sin(2 * np.pi * f * tt) / (i + 1) for i, f in enumerate((92, 184, 276, 368)))
    return lp(np.tanh(y * 1.5), 900) * env_ad(n, 0.25, 1.0) * amp

def heartbeat(at, dur, bpm=62, amp=0.35):
    k = 0
    while k * 60 / bpm < dur:
        for off, g in ((0, 1), (0.28, 0.65)):
            n = int(0.25 * SR); tt = np.arange(n) / SR
            put2(np.sin(2 * np.pi * 48 * tt) * np.exp(-tt * 20) * amp * g, at + k * 60 / bpm + off)
        k += 1

for s in scenes:
    a, d = s["start"], s["dur"]; n = int(d * SR); tt = np.arange(n) / SR
    Ls = s["lines"]
    if s["id"] == "s1":
        waves = lp(noise(n), 350) * (0.14 + 0.08 * np.sin(2 * np.pi * 0.12 * tt) ** 2) + hp(lp(noise(n), 2500), 600) * 0.025 * (0.5 + 0.5 * np.sin(2 * np.pi * 0.08 * tt))
        diesel = lp(noise(n), 70) * (0.6 + 0.4 * np.sin(2 * np.pi * 7.5 * tt)) * 0.18
        put2((waves + diesel + lp(noise(n), 160) * 0.05) * env_ad(n, 0.4, 0.3), a)
        put2(horn(3.2, 0.22), a + 2.2, 0.4)
    elif s["id"] == "s2":
        put2(room(n, 0.004) * 0.6, a)
        a0 = Ls[0]["start"] + 0.6
        for k in range(10): put2(tick(1800 + 60 * k, 0.05, 0.03), a + a0 + k * 0.28, 0.3 + 0.04 * k)
        put2(boom(5, 0.7), a + Ls[2]["start"] - 0.05)
    elif s["id"] == "s3":
        rt = room(n) * 0.9
        fr = next(l for l in Ls if "froze" in l["text"])
        i0 = int(fr["start"] * SR); i1 = min(n, int((fr["start"] + fr["dur"] + 0.9) * SR))
        rt[i0:i1] *= np.linspace(0.05, 0.05, i1 - i0)                     # the room goes dead quiet
        put2(rt, a)
        for k in range(int(Ls[0]["start"] / 0.9) + 6): put2(tick(900, 0.05, 0.02), a + 0.4 + k * 0.9, 0.7)   # wall clock
        act = Ls[0]["start"] + Ls[0]["dur"] * 0.62                        # "a radio suddenly activated"
        put2(static(int(0.6 * SR), 0.12, 2) * env_ad(int(0.6 * SR), 0.01, 0.4), a + act)
        for l in Ls:
            if l["who"] == "GHOST":
                pre = 1.4; nn = int((pre + l["dur"] + 0.8) * SR)
                st = static(nn, 0.07, int(l["start"] * 10)) * env_ad(nn, pre, 0.6)
                put2(st, a + l["start"] - pre, 0.55)
        heartbeat(a + fr["start"], d - fr["start"] - 0.5, 66, 0.3)
    elif s["id"] == "s4":
        put2(room(n, 0.006) * 0.8, a)
        appear = Ls[0]["start"] + Ls[0]["dur"] * 0.55
        for k in range(6): put2(tick(880 if k % 2 == 0 else 660, 0.14, 0.06), a + appear + k * 0.45, 0.5)   # alert
        g = Ls[4]; ng = int((g["dur"] + 1.2) * SR)
        put2(static(ng, 0.08, 31) * env_ad(ng, 0.6, 0.4), a + g["start"] - 0.6)
        gone = Ls[5]["start"] + 0.55
        put2(boom(6, 0.9), a + gone)
        k = 0
        while gone + 0.3 + k * 0.45 < d - 0.4:
            put2(ping(1250 if k % 3 else 1100, 0.05), a + gone + 0.3 + k * 0.45, 0.5); k += 1
    elif s["id"] == "s5":
        put2(boom(5, 1.0), a + 0.05)

# ------------------------------------------------------------------ score
mus = np.zeros((N, 2))
NOTE = lambda m: 440 * 2 ** ((m - 69) / 12)

def pad(freqs, at, dur, amp=0.1, attack=2.5, release=3.0, trem=0.0, bright=900):
    n = int((dur + release) * SR); tt = np.arange(n) / SR
    y = np.zeros(n)
    for f in freqs:
        for dv in (-0.006, 0, 0.007):
            y += 2 * ((f * (1 + dv) * tt + rng.random()) % 1) - 1
    y = lp(y / (len(freqs) * 3), bright)
    e = np.clip(tt / attack, 0, 1) * np.clip((dur + release - tt) / release, 0, 1)
    if trem: e *= 0.6 + 0.4 * np.sin(2 * np.pi * trem * tt)
    y *= e * amp
    pan = rng.random() * 0.5 + 0.25
    i0 = int(at * SR); y = y[: max(0, N - i0)]
    mus[i0:i0 + len(y), 0] += y * (1 - pan); mus[i0:i0 + len(y), 1] += y * pan

def braam(at, amp=0.45):
    n = int(5 * SR); tt = np.arange(n) / SR
    y = sum(np.sin(2 * np.pi * NOTE(m) * tt) * (1 / (i + 1)) for i, m in enumerate([26, 38, 45, 50]))
    y = lp(np.tanh(y * 2.5) * np.exp(-tt * 0.7) * np.clip(tt / 0.04, 0, 1) * amp, 700)
    put(mus[:, 0], y, at); put(mus[:, 1], y, at)

def riser(end, length=2.5, amp=0.12):
    n = int(length * SR); tt = np.arange(n) / SR
    f = 200 + 2800 * (tt / length) ** 2
    y = (np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.3 + bp(noise(n), 500, 7000)) * (tt / length) ** 2 * amp
    put(mus[:, 0], y, end - length); put(mus[:, 1], y, end - length)

st = {s["id"]: s["start"] for s in scenes}
s4g = st["s4"] + S["s4"]["lines"][5]["start"] + 0.55
drone = (np.sin(2 * np.pi * NOTE(26) * t) * 0.5 + np.sin(2 * np.pi * NOTE(33) * t * 1.002) * 0.25) * np.interp(t, [0, 5, st["s3"], s4g, TOTAL - 4.5, TOTAL], [0.0, 0.25, 0.35, 0.55, 0.3, 0])
mus[:, 0] += drone; mus[:, 1] += drone
pad([NOTE(50), NOTE(53), NOTE(57)], st["s1"] + 0.3, S["s1"]["dur"] + S["s2"]["dur"] - 1, 0.06, 3.0, 2.0, 0, 1100)    # grief
pad([NOTE(49), NOTE(50), NOTE(56)], st["s3"], S["s3"]["dur"], 0.06, 2.0, 1.5, 5.0, 1500)                         # unease, tremolo
pad([NOTE(38), NOTE(44), NOTE(45)], st["s4"], S["s4"]["dur"], 0.08, 1.5, 1.0, 4.0)
pad([NOTE(74), NOTE(75)], st["s4"] + S["s4"]["lines"][4]["start"] - 1, 4, 0.02, 1.5, 1.5, 0, 4000)                 # glassy beating under "don't leave us"
riser(st["s3"] + S["s3"]["lines"][2]["start"], 2.0, 0.08)
braam(s4g, 0.55)
braam(st["s5"] + 0.05, 0.5)
riser(st["s5"] + 1.9, 1.8, 0.07)

# ------------------------------------------------------------------ mix
level = np.convolve(np.abs(dlg), np.ones(int(0.2 * SR)) / int(0.2 * SR), mode="same")
duck = 1 - 0.55 * np.clip(level / (np.percentile(level[level > 1e-4], 90) + 1e-9), 0, 1)
duck = np.convolve(duck, np.ones(int(0.15 * SR)) / int(0.15 * SR), mode="same")
dlg_st = np.stack([dlg, dlg], axis=1)
out = ROOT / "out/audio"; out.mkdir(parents=True, exist_ok=True)
for name, x in (("dialogue", dlg_st), ("sfx", sfx), ("music", mus)):
    sf.write(out / f"{name}.wav", x / (np.abs(x).max() + 1e-9) * 0.9, SR, subtype="PCM_24")
mix = dlg_st * 1.0 + sfx * 0.8 * duck[:, None] + mus * 0.85 * duck[:, None]
mix /= np.abs(mix).max() + 1e-9
fade = np.clip((TOTAL - t) / 1.0, 0, 1)[:, None] * np.clip(t / 0.2, 0, 1)[:, None]
sf.write(out / "mix-raw.wav", mix * fade * 0.9, SR, subtype="PCM_24")
(ROOT / "public/audio").mkdir(parents=True, exist_ok=True)
subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(out / "mix-raw.wav"), "-af", "loudnorm=I=-14:TP=-1.0:LRA=14", "-ar", str(SR), str(ROOT / "public/audio/mix.wav")], check=True)
for p in (ROOT / "out/_f_in.wav", ROOT / "out/_f_out.wav"): p.unlink(missing_ok=True)

(ROOT / "src/timeline.json").write_text(json.dumps({"fps": 30, "duration": TOTAL, "title": script["title"], "part": script["part"], "next": script["next"], "cta": script["cta"], "scenes": scenes}, indent=2, ensure_ascii=False))
print(f"total {TOTAL}s (narrator tempo x{tempo:.3f})")
for s in scenes:
    print(f"{s['id']} {s['name']:<22} {s['start']:6.2f}s  +{s['dur']:5.2f}s  lines at " + ", ".join(f"{l['start']:.1f}+{l['dur']:.1f}" for l in s["lines"]))
