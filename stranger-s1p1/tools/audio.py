"""Stranger Things S1 recap (fan edit) soundtrack: narration chain, sound design, dark synth score, mix, timeline.

Reads script/script.json + public/audio/voices.json. Writes out/audio/{dialogue,sfx,music}.wav stems,
public/audio/mix.wav (-14 LUFS) and src/timeline.json.
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
rng = np.random.default_rng(1983)

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
    n = int(seconds * SR); return lp(noise(n), bright) * np.exp(-np.arange(n) / SR * decay) * 0.08
ROOM_IR = ir(0.5, 10.0, 5000)
HALL_IR = ir(3.0, 1.9, 2600)

def ff(x, af):
    a, b = ROOT / "out/_f_in.wav", ROOT / "out/_f_out.wav"
    sf.write(a, x, SR, subtype="FLOAT")
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(a), "-af", af, "-ar", str(SR), str(b)], check=True)
    y, _ = sf.read(b); return y if y.ndim == 1 else y.mean(axis=1)

def squeeze_pauses(x, max_pause):
    hop = int(0.01 * SR)
    rms = np.sqrt(np.convolve(x ** 2, np.ones(hop * 3) / (hop * 3), mode="same"))
    quiet = rms < rms.max() * 0.08
    keep = np.ones(len(x), bool); i = 0
    while i < len(x):
        if quiet[i]:
            j = i
            while j < len(x) and quiet[j]: j += 1
            if (j - i) / SR > max_pause:
                cut = (j - i) - int(max_pause * SR); keep[i + (j - i - cut) // 2: i + (j - i - cut) // 2 + cut] = False
            i = j
        else: i += 1
    return x[keep]

def load_raw(key):
    x, sr = sf.read(ROOT / "public" / voices[key]["file"])
    if x.ndim > 1: x = x.mean(axis=1)
    if sr != SR: x = resample_poly(x, SR, sr)
    return x / (np.abs(x).max() + 1e-9) * 0.7

PITCH = 2 ** (-1.5 / 12)            # a touch deeper than the raw voice
raw = {f"{sc['id']}_{n}": squeeze_pauses(load_raw(f"{sc['id']}_{n}"), 0.2) for sc in script["scenes"] for n, _ in enumerate(sc["lines"])}
def build_dry(tempo): return {k: ff(x, f"asetrate={int(SR * PITCH)},aresample={SR},atempo={tempo / PITCH:.4f}") for k, x in raw.items()}

LEAD = {"s1": 1.2, "s2": 0.3, "s3": 0.3, "s4": 0.4, "s5": 0.3, "s6": 0.6, "s7": 0}
TAIL = {"s1": 0.3, "s2": 0.4, "s3": 1.9, "s4": 0.3, "s5": 0.3, "s6": 1.8, "s7": 0}
GAP = {"s3": [0, 0.3, 0.35], "s6": [0, 0.6, 0.45, 0.55]}

def layout(dry):
    out = []
    for sc in script["scenes"]:
        L = [{"key": f"{sc['id']}_{n}", "who": l["who"], "text": l["text"], "sub": l.get("sub", l["text"]), "radio": False, "fiction": False, "label": "",
              "dur": round(len(dry[f"{sc['id']}_{n}"]) / SR, 3)} for n, l in enumerate(sc["lines"])]
        cur = LEAD[sc["id"]]
        for i, l in enumerate(L):
            if i: cur += GAP.get(sc["id"], [0, 0.3, 0.3, 0.3])[i]
            l["start"] = round(cur, 3); cur += l["dur"]
        out.append({"id": sc["id"], "name": sc["name"], "lines": L, "dur": round(max(sc["min"], cur + TAIL[sc["id"]]), 3)})
    return out

tempo = 1.06
dry = build_dry(tempo); scenes = layout(dry)
need = sum(s["dur"] for s in scenes)
if need > TARGET + 1:
    narr = sum(l["dur"] for s in scenes for l in s["lines"])
    tempo = min(1.24, tempo * narr / max(1.0, narr - (need - TARGET - 1)))
    print(f"needs {need:.1f}s: narrator tempo -> x{tempo:.3f}")
    dry = build_dry(tempo); scenes = layout(dry)
TOTAL = round(sum(s["dur"] for s in scenes), 2)
N = int(TOTAL * SR); t = np.arange(N) / SR
start = 0.0
for s in scenes: s["start"] = round(start, 3); start += s["dur"]
S = {s["id"]: s for s in scenes}
st = {s["id"]: s["start"] for s in scenes}
def put(buf, x, at):
    i0 = int(at * SR)
    if i0 >= len(buf) or i0 + len(x) <= 0: return
    if i0 < 0: x, i0 = x[-i0:], 0
    x = x[: len(buf) - i0]; buf[i0:i0 + len(x)] += x

# ------------------------------------------------------------------ beats the picture cuts to (scene-local seconds)
def line_end(sid, i): l = S[sid]["lines"][i]; return l["start"] + l["dur"]
beats = {
    "s1": {"doorsAt": round(line_end("s1", 1) - 1.2, 2)},
    "s2": {"rollAt": round(S["s2"]["lines"][0]["start"] + S["s2"]["lines"][0]["dur"] * 0.55, 2)},
    "s3": {"seeAt": round(S["s3"]["lines"][2]["start"] - 0.3, 2), "crashAt": round(S["s3"]["lines"][2]["start"] + S["s3"]["lines"][2]["dur"] * 0.62, 2)},
    "s6": {"girlAt": round(S["s6"]["lines"][1]["start"] - 1.0, 2)},
}
beats["s3"]["shedAt"] = round(beats["s3"]["crashAt"] + 2.3, 2)
for sid, b in beats.items(): S[sid].update(b)

# ------------------------------------------------------------------ narration
def narrator(x):
    x = hp(x, 50) + 0.4 * lp(x, 170)
    x = np.tanh(x * 1.7) / 1.7
    return x + 0.07 * fftconvolve(x, ROOM_IR)[: len(x)]
dlg = np.zeros(N)
for s in scenes:
    for l in s["lines"]:
        put(dlg, narrator(dry[l["key"]]) * 0.95, s["start"] + l["start"])

# ------------------------------------------------------------------ sound design
sfx = np.zeros((N, 2))
def put2(x, at, pan=0.5):
    put(sfx[:, 0], x * (1 - pan) * 2 ** 0.5 * 0.7, at); put(sfx[:, 1], x * pan * 2 ** 0.5 * 0.7, at)
def hum(n, f=60, amt=0.01):
    tt = np.arange(n) / SR
    return amt * (np.sin(2 * np.pi * f * tt) + 0.4 * np.sin(2 * np.pi * 2 * f * tt) + 0.25 * np.sin(2 * np.pi * 3 * f * tt)) + lp(noise(n), 300) * 0.015
def buzz_flicker(n, seed, amt=0.05):
    """Fluorescent tube stutter: gated buzz with clicks."""
    r = np.random.default_rng(seed); tt = np.arange(n) / SR
    g = (r.random(int(n / SR * 18) + 2) > 0.45).astype(float); gate = np.repeat(g, int(SR / 18) + 1)[:n]
    y = np.sign(np.sin(2 * np.pi * 120 * tt)) * 0.3 * lp(gate, 80) + bp(noise(n), 2000, 6000) * 0.2 * np.abs(np.diff(gate, prepend=0))
    return y * amt
def click(amp=0.4):
    n = int(0.03 * SR); return noise(n) * np.exp(-np.arange(n) / SR * 300) * amp
def boom(length=5, amp=1.0, f0=40):
    n = int(length * SR); tt = np.arange(n) / SR
    y = lp(noise(n), 90) * np.exp(-tt * 0.9) * 2.0 + np.sin(2 * np.pi * (f0 - 12 * tt / length) * tt) * np.exp(-tt * 1.1) * 0.9
    return y * np.clip(tt / 0.01, 0, 1) * amp
def growl(length=2.0, amp=0.3, seed=1):
    """The shadow's non-human sound: low rasp + clicking, pitch-wobbled noise."""
    r = np.random.default_rng(seed); n = int(length * SR); tt = np.arange(n) / SR
    am = 0.5 + 0.5 * np.sin(2 * np.pi * (11 + 4 * np.sin(2 * np.pi * 0.7 * tt)) * tt)
    y = bp(r.standard_normal(n), 90, 700) * am * 1.6 + np.sin(2 * np.pi * 55 * tt + 3 * np.sin(2 * np.pi * 7 * tt)) * 0.4
    cl = np.zeros(n)
    for k in range(int(length * 9)): i = int(r.uniform(0, n - 600)); cl[i:i + 600] += bp(r.standard_normal(600), 1500, 5000) * np.exp(-np.arange(600) / 80) * 0.6
    return np.tanh((y + cl) * 1.5) * env_ad(n, 0.3, 0.6) * amp
def ding(amp=0.18):
    n = int(2.0 * SR); tt = np.arange(n) / SR
    return (np.sin(2 * np.pi * 1318 * tt) + 0.6 * np.sin(2 * np.pi * 1046 * tt) * (tt > 0.35)) * np.exp(-tt * 2.5) * amp
def doors(length=1.4, amp=0.25):
    n = int(length * SR); tt = np.arange(n) / SR
    return (lp(noise(n), 900) * 0.6 + np.sin(2 * np.pi * 70 * tt) * 0.3) * env_ad(n, 0.1, 0.4) * amp
def alarm(n, amp=0.05):
    tt = np.arange(n) / SR
    return np.sign(np.sin(2 * np.pi * 740 * tt)) * (np.sin(2 * np.pi * 1.6 * tt) > 0) * amp * 0.4
def die_hit(amp=0.3):
    n = int(0.12 * SR); tt = np.arange(n) / SR
    return (bp(noise(n), 1800, 7000) * 0.7 + np.sin(2 * np.pi * 2600 * tt) * 0.4) * np.exp(-tt * 70) * amp
def crickets(n, amt=0.02):
    tt = np.arange(n) / SR
    return np.sin(2 * np.pi * 4300 * tt) * (np.sin(2 * np.pi * 28 * tt) > 0.3) * (np.sin(2 * np.pi * 0.9 * tt) > -0.2) * amt
def wind(n, amt=1.0):
    tt = np.arange(n) / SR
    return lp(noise(n), 400) * 0.1 * (0.7 + 0.3 * np.sin(2 * np.pi * 0.15 * tt)) * amt
def bike(n, amt=0.05):
    tt = np.arange(n) / SR
    tick = (np.sin(2 * np.pi * 9 * tt) > 0.97).astype(float)
    return (bp(noise(n), 200, 1200) * 0.4 + bp(noise(n), 3000, 7000) * tick * 2.5) * amt
def skid(length=0.9, amp=0.3):
    n = int(length * SR); tt = np.arange(n) / SR
    return bp(noise(n), 900, 3500) * (0.6 + 0.4 * np.sin(2 * np.pi * 40 * tt)) * env_ad(n, 0.05, 0.3) * amp
def crash(amp=0.5):
    n = int(1.2 * SR); tt = np.arange(n) / SR
    return (lp(noise(n), 2500) * np.exp(-tt * 9) * 1.2 + bp(noise(n), 3000, 8000) * np.exp(-tt * 14) * 0.6 + np.sin(2 * np.pi * 80 * tt) * np.exp(-tt * 12)) * amp
def spokes(length, amp=0.04):
    n = int(length * SR); tt = np.arange(n) / SR
    rate = 9 * np.exp(-tt * 0.3)
    tick = (np.sin(2 * np.pi * np.cumsum(rate) / SR) > 0.9).astype(float)
    return bp(noise(n), 2500, 7000) * tick * amp
def rain(n, amt=1.0):
    return (bp(noise(n), 1500, 9000) * 0.06 + lp(noise(n), 600) * 0.04 + (rng.random(n) > 0.9985) * noise(n) * 0.08) * amt
def thunder(amp=0.6):
    n = int(5 * SR); tt = np.arange(n) / SR
    return lp(noise(n), 220) * np.exp(-tt * 0.7) * (0.6 + 0.4 * np.sin(2 * np.pi * 1.3 * tt)) * np.clip(tt / 0.05, 0, 1) * 2.2 * amp
def phone_ring(length=4.0, amp=0.12):
    n = int(length * SR); tt = np.arange(n) / SR
    bell = (np.sin(2 * np.pi * 440 * tt) + np.sin(2 * np.pi * 480 * tt)) * (np.sin(2 * np.pi * 20 * tt) > 0) * ((tt % 3) < 1.2)
    return bell * amp
def siren(n, amt=0.03):
    tt = np.arange(n) / SR
    f = 850 + 350 * np.sin(2 * np.pi * 0.35 * tt)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * amt
def radio_chatter(n, amt=0.03, seed=4):
    r = np.random.default_rng(seed)
    g = np.repeat((r.random(int(n / SR * 4) + 2) > 0.5).astype(float), int(SR / 4) + 1)[:n]
    return bp(r.standard_normal(n), 400, 2800) * lp(g, 20) * amt

for s in scenes:
    a, d, sid = s["start"], s["dur"], s["id"]; n = int(d * SR); tt = np.arange(n) / SR
    if sid == "s1":
        put2(hum(n, 60, 0.012), a)
        put2(buzz_flicker(n, 3, 0.05) * np.clip(tt / (S["s1"]["doorsAt"] - 1), 0, 1), a, 0.4)
        put2(alarm(int((d - S["s1"]["doorsAt"] + 2) * SR)), a + S["s1"]["doorsAt"] - 2, 0.6)
        put2(growl(1.8, 0.28, 2), a + 3.0, 0.62)
        put2(ding(), a + S["s1"]["doorsAt"] - 0.1); put2(doors(), a + S["s1"]["doorsAt"])
    elif sid == "s2":
        put2(hum(n, 60, 0.006), a)
        r = S["s2"]["rollAt"]
        for k, (dt, g) in enumerate(((0, 1), (0.45, 0.6), (0.8, 0.35), (1.05, 0.2), (1.25, 0.1))): put2(die_hit(0.35 * g), a + r + dt, 0.45 + 0.05 * k)
    elif sid == "s3":
        see, cr, shed = S["s3"]["seeAt"], S["s3"]["crashAt"], S["s3"]["shedAt"]
        ride = int(cr * SR)
        put2(crickets(n) * np.clip(1 - (tt - see) / 1.0, 0, 1), a, 0.3)
        put2(wind(n, 0.8), a)
        put2(bike(ride) * env_ad(ride, 0.5, 0.05), a)
        put2(growl(2.2, 0.35, 5), a + see + 0.2, 0.55)
        put2(skid(), a + cr - 0.5); put2(crash(0.55), a + cr)
        put2(spokes(shed - cr - 0.2), a + cr + 0.2, 0.6)
        nn = int((d - shed) * SR); put2(buzz_flicker(nn, 8, 0.06), a + shed, 0.5)
        put2(growl(1.6, 0.4, 7), a + shed + 1.0, 0.7)
        put2(boom(4, 0.6, 36), a + d - 1.2)
    elif sid == "s4":
        put2(phone_ring(min(4.0, d - 1), 0.1), a + 0.3, 0.6)
        put2(hum(n, 60, 0.006), a)
        put2(buzz_flicker(n, 21, 0.03), a, 0.7)
    elif sid == "s5":
        put2(wind(n, 1.0), a); put2(siren(n) * env_ad(n, 1.0, 1.5), a, 0.65); put2(radio_chatter(n), a, 0.35)
    elif sid == "s6":
        g = S["s6"]["girlAt"]
        put2(rain(n) * env_ad(n, 0.4, 1.8), a)
        put2(thunder(0.5), a + g + 2.0, 0.4); put2(thunder(0.4), a + d - 3.0, 0.6)
        put2(boom(5, 0.8, 34), a + g)
    elif sid == "s7":
        put2(boom(5, 0.9, 32), a + 0.15)

# ------------------------------------------------------------------ score: dark analog-synth arpeggio, pads, bass, risers
mus = np.zeros((N, 2))
NOTE = lambda m: 440 * 2 ** ((m - 69) / 12)
def saw(f, n, det=(0,)):
    tt = np.arange(n) / SR
    return sum(2 * ((f * (1 + dv) * tt + rng.random()) % 1) - 1 for dv in det) / len(det)
def add(y, at, pan=0.5):
    put(mus[:, 0], y * (1 - pan) * 1.4, at); put(mus[:, 1], y * pan * 1.4, at)
def arp(at, dur, notes, step=0.125, amp=0.06, cut=(600, 2400)):
    """Analog 16th-note arpeggio with a slowly opening filter."""
    k, tpos = 0, 0.0
    while tpos < dur:
        m = notes[k % len(notes)]; n = int(step * 0.95 * SR); tt = np.arange(n) / SR
        y = saw(NOTE(m), n, (-0.004, 0.004)) * np.exp(-tt * 9)
        fc = cut[0] + (cut[1] - cut[0]) * (tpos / dur)
        y = lp(y, fc, 2) * amp
        pan = 0.35 + 0.3 * (k % 2)
        add(y, at + tpos, pan)
        k += 1; tpos += step
def pad(notes, at, dur, amp=0.05, attack=2.0, release=2.5, bright=1000):
    n = int((dur + release) * SR); tt = np.arange(n) / SR
    y = sum(saw(NOTE(m), n, (-0.006, 0, 0.007)) for m in notes) / len(notes)
    y = lp(y, bright) * np.clip(tt / attack, 0, 1) * np.clip((dur + release - tt) / release, 0, 1) * amp
    add(y, at, 0.45); add(fftconvolve(y, HALL_IR)[:n] * 0.5, at, 0.55)
def bass(at, dur, m, amp=0.12):
    n = int(dur * SR); tt = np.arange(n) / SR
    y = lp(saw(NOTE(m), n, (-0.003, 0.003)), 220) + np.sin(2 * np.pi * NOTE(m) * tt) * 0.5
    add(y * env_ad(n, 0.4, 0.8) * amp, at)
def riser(end, length=2.5, amp=0.1):
    n = int(length * SR); tt = np.arange(n) / SR
    f = 200 + 2600 * (tt / length) ** 2
    y = (np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.3 + bp(noise(n), 500, 7000)) * (tt / length) ** 2 * amp
    add(y, end - length)
def hit(at, amp=0.5):
    n = int(5 * SR); tt = np.arange(n) / SR
    y = sum(np.sin(2 * np.pi * NOTE(m) * tt) / (i + 1) for i, m in enumerate([24, 36, 43, 48]))
    add(lp(np.tanh(y * 2.4) * np.exp(-tt * 0.7) * np.clip(tt / 0.03, 0, 1) * amp, 650), at)

# key: C minor. The arpeggio carries the tension; it drops out at the crash and the rain reveal.
ARP_A = [48, 52, 55, 59, 60, 59, 55, 52]          # Cmaj7 shape: the famous-feeling 80s colour (original pattern)
ARP_B = [48, 51, 55, 58, 60, 58, 55, 51]          # Cm7
crashT = st["s3"] + S["s3"]["crashAt"]
girlT = st["s6"] + S["s6"]["girlAt"]
pad([36, 43, 48], 0, st["s2"], 0.045, 3.0, 2.0, 800)
arp(1.2, crashT - 1.2, ARP_A, 0.125, 0.05, (500, 2600))
bass(st["s2"], st["s3"] - st["s2"], 36, 0.1); bass(st["s3"], crashT - st["s3"], 32, 0.11)
riser(crashT, 3.0, 0.1); hit(crashT, 0.55)
pad([32, 39, 44], crashT + 0.5, st["s4"] - crashT, 0.04, 1.0, 2.0, 700)
arp(st["s4"], st["s6"] - st["s4"], ARP_B, 0.25, 0.04, (500, 1400))
pad([36, 39, 43], st["s4"], st["s6"] - st["s4"], 0.04, 2.0, 1.5, 900)
bass(st["s5"], S["s5"]["dur"], 31, 0.1)
pad([44, 48, 51, 55], st["s6"], girlT - st["s6"] + 1, 0.035, 2.0, 1.5, 1100)
riser(girlT, 2.5, 0.08); hit(girlT, 0.45)
pad([48, 55, 60, 64], girlT + 0.5, st["s7"] - girlT, 0.05, 3.0, 2.5, 1500)        # wonder / mystery
arp(girlT + 3.5, st["s7"] - girlT - 3.5, ARP_A, 0.125, 0.04, (400, 2200))
riser(st["s7"] + 0.15, 2.0, 0.09); hit(st["s7"] + 0.15, 0.6)
pad([36, 43, 51], st["s7"] + 0.2, S["s7"]["dur"] - 1.2, 0.05, 0.5, 2.0, 700)
drone = np.sin(2 * np.pi * NOTE(24) * t) * 0.25 * np.interp(t, [0, 3, crashT, crashT + 0.1, TOTAL - 1, TOTAL], [0, 0.6, 0.8, 0.4, 0.5, 0])
mus[:, 0] += drone; mus[:, 1] += drone

# ------------------------------------------------------------------ mix
level = np.convolve(np.abs(dlg), np.ones(int(0.2 * SR)) / int(0.2 * SR), mode="same")
duck = 1 - 0.5 * np.clip(level / (np.percentile(level[level > 1e-4], 90) + 1e-9), 0, 1)
duck = np.convolve(duck, np.ones(int(0.15 * SR)) / int(0.15 * SR), mode="same")
dlg_st = np.stack([dlg, dlg], axis=1)
out = ROOT / "out/audio"; out.mkdir(parents=True, exist_ok=True)
for name, x in (("dialogue", dlg_st), ("sfx", sfx), ("music", mus)):
    sf.write(out / f"{name}.wav", x / (np.abs(x).max() + 1e-9) * 0.9, SR, subtype="PCM_24")
mix = dlg_st * 1.0 / (np.abs(dlg).max() + 1e-9) * 0.8 + sfx / (np.abs(sfx).max() + 1e-9) * 0.5 * duck[:, None] + mus / (np.abs(mus).max() + 1e-9) * 0.5 * duck[:, None]
mix /= np.abs(mix).max() + 1e-9
fade = np.clip((TOTAL - t) / 1.0, 0, 1)[:, None] * np.clip(t / 0.2, 0, 1)[:, None]
sf.write(out / "mix-raw.wav", mix * fade * 0.9, SR, subtype="PCM_24")
subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(out / "mix-raw.wav"), "-af", "loudnorm=I=-14:TP=-1.0:LRA=14", "-ar", str(SR), str(ROOT / "public/audio/mix.wav")], check=True)
for p in (ROOT / "out/_f_in.wav", ROOT / "out/_f_out.wav"): p.unlink(missing_ok=True)

(ROOT / "src/timeline.json").write_text(json.dumps({"fps": 30, "duration": TOTAL, "title": script["title"], "series": script["series"], "scenes": scenes}, indent=2, ensure_ascii=False))
print(f"total {TOTAL}s (narrator tempo x{tempo:.3f})")
for s in scenes:
    print(f"{s['id']} {s['name']:<22} {s['start']:6.2f}s  +{s['dur']:5.2f}s  lines at " + ", ".join(f"{l['start']:.1f}+{l['dur']:.1f}" for l in s["lines"]), {k: v for k, v in s.items() if k.endswith("At")})
