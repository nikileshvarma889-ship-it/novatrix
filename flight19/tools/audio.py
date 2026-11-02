"""Flight 19 soundtrack: dialogue processing, sound design, horror score, stems, master mix, timeline.

Reads script/script.json + public/audio/voices.json (from tools/voice.py).
Writes:
  out/audio/dialogue.wav, out/audio/sfx.wav, out/audio/music.wav  (stems, 48 kHz stereo)
  out/audio/voices/<line>.wav                                      (each processed voice line)
  public/audio/mix.wav                                              (master, -14 LUFS, -1 dBTP)
  src/timeline.json                                                 (scene + line timing for the visuals)
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
TOTAL = float(script["duration"])
N = int(TOTAL * SR)
rng = np.random.default_rng(1945)
t = np.arange(N) / SR

# ------------------------------------------------------------------ clean dry voices (pauses tightened, narrator tempo fit)
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

def tempo(x, f):
    if abs(f - 1) < 0.005: return x
    tmp_in, tmp_out = ROOT / "out/_t_in.wav", ROOT / "out/_t_out.wav"
    sf.write(tmp_in, x, SR)
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(tmp_in), "-af", f"atempo={f:.4f}", str(tmp_out)], check=True)
    y, _ = sf.read(tmp_out)
    return y

def load_raw(key):
    x, sr = sf.read(ROOT / "public" / voices[key]["file"])
    if x.ndim > 1: x = x.mean(axis=1)
    if sr != SR: x = resample_poly(x, SR, sr)
    return x / (np.abs(x).max() + 1e-9) * 0.7

dry = {}
for sc in script["scenes"]:
    for n, l in enumerate(sc["lines"]):
        if l.get("skip"): continue
        k = f"{sc['id']}_{n}"
        dry[k] = squeeze_pauses(load_raw(k), 0.38 if l["who"] == "NARRATOR" else 0.5 if l["who"] != "GHOST" else 0.9)

LEAD, GAP, RADIO_GAP, TAIL = 0.5, 0.25, 0.35, 0.35
def layout():
    out = []
    for sc in script["scenes"]:
        cur, lines = LEAD, []
        for n, l in enumerate(sc["lines"]):
            if l.get("skip"): continue
            k = f"{sc['id']}_{n}"
            radio = script["voices"][l["who"]]["radio"]
            if lines:
                cur += RADIO_GAP if radio else GAP
            if sc["id"] == "s5" and l["who"] == "GHOST":
                cur += 1.8                                          # the sixth aircraft emerges + caption beat first
            lines.append({"key": k, "who": l["who"], "text": l["text"], "start": round(cur, 3), "dur": round(len(dry[k]) / SR, 3), "radio": radio, "fiction": bool(l.get("fiction")), "label": script["voices"][l["who"]].get("label", "")})
            cur += len(dry[k]) / SR
        extra = {"s5": 0.5, "s7": 3.5}.get(sc["id"], 0)            # reveal beat caption / title card
        out.append({"id": sc["id"], "name": sc["name"], "dur": max(sc["min"], cur + TAIL + extra), "lines": lines, "caption": sc.get("caption", []), "end": sc.get("end", []), "toll": sc.get("toll", []), "beat": sc.get("beat", [])})
    return out

for k, x in list(dry.items()):                               # radio calls: a touch quicker, as real transmissions
    if voices[k]["who"] in ("TAYLOR", "COX", "TOWER"): dry[k] = tempo(x, 1.08)
scenes = layout()
need = sum(s["dur"] for s in scenes)
if need > TOTAL - 0.5:
    narr = sum(len(dry[l["key"]]) / SR for s in scenes for l in s["lines"] if l["who"] == "NARRATOR")
    f = min(1.42, narr / max(1.0, narr - (need - TOTAL) - 1.5))
    print(f"narration needs {need:.1f}s for {TOTAL}s: narrator tempo x{f:.3f}")
    for k in list(dry):
        if voices[k]["who"] == "NARRATOR": dry[k] = tempo(dry[k], f)
    scenes = layout()
if sum(s["dur"] for s in scenes) > TOTAL:
    TOTAL = round(sum(s["dur"] for s in scenes) + 0.05, 2)
    N = int(TOTAL * SR); t = np.arange(N) / SR
    print(f"film length set to {TOTAL}s to fit the dialogue")
spare = TOTAL - sum(s["dur"] for s in scenes)
for _s in scenes: print("  ", _s["id"], round(_s["dur"],2), [(l["who"], round(l["start"],1), round(l["dur"],1)) for l in _s["lines"]])
assert spare > -6, f"script too long by {-spare:.1f}s"
weights = {"s1": 3, "s2": 2, "s5": 2, "s6": 1, "s7": 1, "s3": 0.5, "s4": 0.5}
wsum = sum(weights.values())
for s in scenes:
    s["dur"] = round(s["dur"] + spare * weights[s["id"]] / wsum, 3)
drift = TOTAL - sum(s["dur"] for s in scenes)
scenes[-1]["dur"] = round(scenes[-1]["dur"] + drift, 3)
start = 0.0
for s in scenes:
    s["start"] = round(start, 3)
    start += s["dur"]
S = {s["id"]: s for s in scenes}
# scene-internal beats shared with the visuals
S["s3"]["cut"] = round(S["s3"]["lines"][1]["start"] - 0.25, 3)
S["s4"]["lightning"] = [1.8, round(S["s4"]["dur"] * 0.62, 2)]
S["s5"]["ghostAt"] = round(S["s5"]["lines"][0]["start"] + S["s5"]["lines"][0]["dur"] * 0.55, 3)   # the sixth drifts in during Taylor's call
S["s5"]["scopeAt"] = round(S["s5"]["lines"][1]["start"] - 0.45, 3)
S["s5"]["beatAt"] = round(S["s5"]["lines"][0]["start"] + S["s5"]["lines"][0]["dur"] + 0.2, 3)
S["s5"]["lightning"] = [1.6, round(S["s5"]["ghostAt"] + 0.9, 2), round(S["s5"]["scopeAt"] - 0.7, 2)]
l6 = S["s6"]["lines"]
S["s6"]["cuts"] = [round(l6[1]["start"] - 0.3, 3), round(l6[1]["start"] + l6[1]["dur"] * 0.52, 3)]
S["s6"]["lightning"] = [1.5, round(S["s6"]["cuts"][0] * 0.7, 2)]
S["s6"]["tollAt"] = round(l6[2]["start"] - 1.3, 3)
S["s7"]["wake"] = 1.6

# ------------------------------------------------------------------ dsp helpers
def lp(x, f, o=2): return sosfilt(butter(o, f, "low", fs=SR, output="sos"), x)
def hp(x, f, o=2): return sosfilt(butter(o, f, "high", fs=SR, output="sos"), x)
def bp(x, lo, hi, o=2): return sosfilt(butter(o, [lo, hi], "band", fs=SR, output="sos"), x)
def noise(n): return rng.standard_normal(n)
def put(buf, x, at):
    i0 = int(at * SR)
    if i0 >= len(buf): return
    x = x[: len(buf) - i0]
    buf[i0:i0 + len(x)] += x
def env_ad(n, a, d):
    e = np.ones(n); na, nd = min(n, int(a * SR)), min(n, int(d * SR))
    if na: e[:na] = np.linspace(0, 1, na)
    if nd: e[-nd:] *= np.linspace(1, 0, nd)
    return e
def ir(seconds, decay, bright=4000):
    n = int(seconds * SR)
    return lp(noise(n), bright) * np.exp(-np.arange(n) / SR * decay) * 0.08
ROOM_IR = ir(0.9, 7.0, 5000)
HALL_IR = ir(2.8, 2.2, 3000)

def load(key):
    return dry[key]

def narrator(x):
    x = hp(x, 60) + 0.25 * lp(x, 220)                      # chest / proximity
    x = np.tanh(x * 1.6) / 1.6                              # gentle compression
    return x + 0.12 * fftconvolve(x, ROOM_IR)[: len(x)]

def radio(x, seed):
    r = np.random.default_rng(seed)
    n = len(x)
    y = bp(x, 320, 2900, 3)
    y = np.tanh(y * 4.5) / 2.2                              # valve / overmodulation
    fade = 0.75 + 0.25 * np.sin(2 * np.pi * (0.35 + r.random() * 0.4) * np.arange(n) / SR + r.random() * 6)   # HF fading
    drop = np.ones(n)
    for _ in range(int(n / SR * 0.6)):                      # brief signal dropouts
        i = r.integers(0, n); w = int(r.uniform(0.04, 0.12) * SR); drop[i:i + w] *= 0.25
    y = y * fade * lp(drop, 30)
    st = bp(r.standard_normal(n), 400, 5200) * 0.06 + (r.random(n) > 0.9993) * r.standard_normal(n) * 0.5   # hiss + crackle
    whine = 0.012 * np.sin(2 * np.pi * 1180 * np.arange(n) / SR + 3 * np.sin(2 * np.pi * 0.3 * np.arange(n) / SR))  # heterodyne
    y = y + st + whine
    click = np.zeros(int(0.05 * SR)); click[:200] = r.standard_normal(200) * 0.6
    sq = bp(r.standard_normal(int(0.18 * SR)), 800, 6000) * np.linspace(0.3, 0, int(0.18 * SR))
    return np.concatenate([click, sq, y, sq[::-1] * 0.6, click * 0.6])

def ghost(x, seed):
    x = resample_poly(x, 100, 88)                           # pitch down ~2 semitones, slower
    rev = fftconvolve(x[::-1], HALL_IR)[::-1][-len(x) - int(1.2 * SR):]   # reverse reverb swell before each word
    y = np.concatenate([np.zeros(max(0, len(rev) - len(x))), x]) + rev * 1.6
    y = radio(y, seed)
    y = y + 0.35 * fftconvolve(y, HALL_IR)[: len(y)]
    return y * 1.15

# ------------------------------------------------------------------ dialogue
dlg = np.zeros(N)
vdir = ROOT / "out/audio/voices"; vdir.mkdir(parents=True, exist_ok=True)
for s in scenes:
    for k, l in enumerate(s["lines"]):
        x = load(l["key"])
        if l["who"] == "GHOST":
            y = ghost(x, k + 77); lead = 1.2 + 0.23
        elif l["radio"]:
            y = radio(x, hash(l["key"]) % 1000); lead = 0.23
        else:
            y = narrator(x) * 0.95; lead = 0.0
        sf.write(vdir / f"{l['key']}_{l['who'].lower()}.wav", y / (np.abs(y).max() + 1e-9) * 0.9, SR, subtype="PCM_24")
        put(dlg, y, s["start"] + l["start"] - lead)

# ------------------------------------------------------------------ sound design
sfx = np.zeros(N)

def engine(n, rpm_hz=24.0, mix_noise=0.35, seed=0):
    """Radial engine drone: firing-rate harmonics (14 cylinders) + prop beat + rumble."""
    r = np.random.default_rng(seed)
    tt = np.arange(n) / SR
    wob = 1 + 0.01 * np.sin(2 * np.pi * 0.23 * tt + r.random() * 6)
    f0 = rpm_hz * 7 / 2 * wob                               # firing frequency
    y = sum((0.5 / h) * np.sin(2 * np.pi * np.cumsum(f0 * h) / SR + r.random() * 6) for h in range(1, 9))
    y = y * (1 + 0.25 * np.sin(2 * np.pi * np.cumsum(rpm_hz * 3 * wob) / SR))   # 3-blade prop beat
    y = lp(y, 900) + mix_noise * lp(bp(r.standard_normal(n), 60, 2500), 1200)
    return y / (np.abs(y).max() + 1e-9)

def thunder(at, dist=1.0):
    n = int(5 * SR); tt = np.arange(n) / SR
    crack = bp(noise(n), 200, 4000) * np.exp(-tt * 9) * (0.4 / dist)
    roll = lp(noise(n), 160) * np.exp(-tt * 0.9) * (1 - np.exp(-tt * 6)) * 1.4
    put(sfx, (crack + roll) * 0.5, at)

def rain(n, amt=1.0):
    return (hp(noise(n), 1500) * 0.03 + (np.random.default_rng(3).random(n) > 0.997) * noise(n) * 0.08) * amt

def room_tone(n, hum=True):
    tt = np.arange(n) / SR
    y = lp(noise(n), 300) * 0.02
    if hum: y += 0.012 * np.sin(2 * np.pi * 60 * tt) + 0.006 * np.sin(2 * np.pi * 120 * tt) + 0.003 * np.sin(2 * np.pi * 180 * tt)
    return y

for s in scenes:
    a, d = s["start"], s["dur"]; n = int(d * SR)
    if s["id"] == "s1":
        # takeoff: engines roar past the camera (Doppler-ish swell), wind, distant birds of the airfield
        e = engine(n, 30, 0.5, 1)
        tt = np.arange(n) / SR
        swell = np.clip((tt - 0.5) / 2.5, 0, 1) * np.clip(1 - (tt - d * 0.52) / (d * 0.48), 0.25, 1)
        put(sfx, e * swell * 0.55 * env_ad(n, 0.6, 0.6), a)
        put(sfx, hp(noise(n), 200) * 0.03 * env_ad(n, 1, 1), a)
        put(sfx, lp(noise(int(2.2 * SR)), 900) * np.linspace(0, 0.6, int(2.2 * SR)) * np.linspace(1, 0, int(2.2 * SR)) ** 0.5, a + 3.2)   # fly-by whoosh
    elif s["id"] in ("s2",):
        put(sfx, engine(n, 27, 0.4, 2) * 0.32 * env_ad(n, 0.5, 0.5), a)
        put(sfx, lp(noise(n), 400) * 0.06 * env_ad(n, 1, 1), a)                       # wind
    elif s["id"] == "s3":
        cut = s["cut"]; n1 = int(cut * SR)
        put(sfx, lp(engine(n1, 26, 0.6, 3), 500) * 0.45 * env_ad(n1, 0.2, 0.1), a)      # cockpit: muffled, loud
        put(sfx, lp(noise(n1), 120) * 0.25 * env_ad(n1, 0.2, 0.1), a)                   # airframe rumble
        put(sfx, engine(n - n1, 27, 0.4, 4) * 0.3 * env_ad(n - n1, 0.1, 0.6), a + cut)
    elif s["id"] in ("s4",):
        put(sfx, room_tone(n) + rain(n, 1.0), a)
        for lt in s["lightning"]: thunder(a + lt + 1.4, 1.5)
        put(sfx, bp(noise(n), 2000, 6000) * 0.012, a)                                    # scope/tube whine
    elif s["id"] == "s5":
        ga, sa = s["ghostAt"], s["scopeAt"]; n1 = int(sa * SR)
        put(sfx, engine(n1, 27, 0.5, 5) * 0.32 * env_ad(n1, 0.3, 0.2), a)
        put(sfx, lp(noise(n1), 300) * 0.14 * env_ad(n1, 0.5, 0.2) + rain(n1, 1.4), a)
        # the ghost engine: same drone, detuned and slowed — wrong
        ng = n1 - int(ga * SR)
        if ng > 0: put(sfx, lp(engine(ng, 21, 0.2, 9), 400) * 0.35 * env_ad(ng, 2.0, 0.3), a + ga)
        for lt in s["lightning"]: thunder(a + lt + 0.9, 1.0)
        put(sfx, room_tone(n - n1) + rain(n - n1, 0.8), a + sa)
    elif s["id"] == "s6":
        c1, c2 = s["cuts"]; n1 = int(c1 * SR)
        put(sfx, engine(n1, 24, 0.5, 6) * 0.34 * env_ad(n1, 0.3, 0.4) + rain(n1, 1.6), a)
        for lt in s["lightning"]: thunder(a + lt + 1.1, 1.2)
        n2 = int((c2 - c1) * SR); tt = np.arange(n2) / SR
        put(sfx, lp(noise(n2), 500) * 0.05 + hp(noise(n2), 3000) * 0.006, a + c1)       # sea + deck wind
        boom = lp(noise(int(6 * SR)), 120) * np.exp(-np.arange(int(6 * SR)) / SR * 0.7) * 1.2
        put(sfx, boom, a + c1 + 1.0 + 1.8)                                               # flash first, sound arrives later
        crackle = (np.random.default_rng(7).random(n2) > 0.999) * noise(n2) * 0.25 * np.clip((tt - 2.8) / 1, 0, 1)
        put(sfx, crackle, a + c1)
        n3 = n - int(c2 * SR)
        put(sfx, room_tone(n3, False) * 1.5 + bp(noise(n3), 1500, 2500) * 0.004, a + c2)
        ping = np.sin(2 * np.pi * 1300 * np.arange(int(0.25 * SR)) / SR) * np.exp(-np.arange(int(0.25 * SR)) / SR * 12) * 0.08
        for k in range(4): put(sfx, ping, a + c2 + 0.3 + k * 1.0)                         # sweep pings; then nothing
    elif s["id"] == "s7":
        tt = np.arange(n) / SR
        put(sfx, lp(noise(n), 250) * 0.05 * (0.6 + 0.4 * np.sin(2 * np.pi * 0.11 * tt)) + room_tone(n, False), a)   # wind through the broken window
        w = s["wake"]
        click = np.zeros(int(0.1 * SR)); click[:300] = noise(300) * 0.9
        put(sfx, click, a + w)
        nst = int((d - w) * SR)
        st = bp(noise(nst), 300, 6000) * 0.07 * np.clip(np.arange(nst) / SR / 1.0, 0, 1) * (0.7 + 0.3 * np.sin(2 * np.pi * 0.7 * np.arange(nst) / SR))
        put(sfx, st * env_ad(nst, 0.05, 2.5), a + w)
        put(sfx, 0.015 * np.sin(2 * np.pi * 60 * np.arange(nst) / SR) * env_ad(nst, 0.3, 2.5), a + w)

# ------------------------------------------------------------------ horror score
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
    i0 = int(at * SR); y = y[: N - i0]
    mus[i0:i0 + len(y), 0] += y * (1 - pan); mus[i0:i0 + len(y), 1] += y * pan

def braam(at, amp=0.45):
    n = int(5 * SR); tt = np.arange(n) / SR
    y = sum(np.sin(2 * np.pi * NOTE(m) * tt) * (1 / (i + 1)) for i, m in enumerate([25, 37, 44, 49]))
    y = np.tanh(y * 2.5) * np.exp(-tt * 0.7) * np.clip(tt / 0.04, 0, 1) * amp
    y = lp(y, 700)
    put(mus[:, 0], y, at); put(mus[:, 1], y, at)

def riser(end, length=2.5, amp=0.12):
    n = int(length * SR); tt = np.arange(n) / SR
    f = 200 + 2800 * (tt / length) ** 2
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.3 + bp(noise(n), 500, 7000)
    y *= (tt / length) ** 2 * amp
    put(mus[:, 0], y, end - length); put(mus[:, 1], y, end - length)

def heartbeat(at, dur, bpm=58, amp=0.35):
    k = 0
    while k * 60 / bpm < dur:
        for off, g in ((0, 1), (0.28, 0.7)):
            n = int(0.25 * SR); tt = np.arange(n) / SR
            b = np.sin(2 * np.pi * 48 * tt) * np.exp(-tt * 22) * amp * g
            put(mus[:, 0], b, at + k * 60 / bpm + off); put(mus[:, 1], b, at + k * 60 / bpm + off)
        k += 1

# low drone through the whole film (C# minor colour), rising unease
drone = (np.sin(2 * np.pi * NOTE(25) * t) * 0.5 + np.sin(2 * np.pi * NOTE(32) * t * 1.002) * 0.25) * np.interp(t, [0, 10, 40, 75, 86, 90], [0.0, 0.25, 0.4, 0.55, 0.4, 0])
mus[:, 0] += drone; mus[:, 1] += drone
st = {s["id"]: s["start"] for s in scenes}
pad([NOTE(49), NOTE(56), NOTE(61)], st["s1"] + 1.0, S["s1"]["dur"], 0.06, 3.0, 2.0, 0, 1200)       # cautious, almost hopeful
pad([NOTE(49), NOTE(52), NOTE(56)], st["s2"], S["s2"]["dur"], 0.08, 2.0)                          # minor turn
pad([NOTE(48), NOTE(49), NOTE(55)], st["s3"], S["s3"]["dur"], 0.07, 2.0, 2.0, 6.0, 1500)          # cluster, tremolo strings
pad([NOTE(37), NOTE(43), NOTE(44)], st["s4"], S["s4"]["dur"], 0.09, 1.5, 2.0, 4.0)
riser(st["s5"] + S["s5"]["ghostAt"] + 0.4, 3.0)
braam(st["s5"] + S["s5"]["ghostAt"] + 0.4, 0.5)
heartbeat(st["s5"] + 0.5, S["s5"]["dur"] - 1.0)
pad([NOTE(36), NOTE(37), NOTE(42), NOTE(48)], st["s5"], S["s5"]["dur"], 0.08, 1.0, 2.0, 7.0, 1800)
pad([NOTE(37), NOTE(40), NOTE(44)], st["s6"], S["s6"]["dur"], 0.08, 2.0)
braam(st["s6"] + S["s6"]["cuts"][0] + 1.0, 0.35)
riser(st["s7"], 2.0, 0.08)
pad([NOTE(73), NOTE(74)], st["s7"] + S["s7"]["wake"], S["s7"]["dur"] - 2.5, 0.025, 3.0, 2.0, 0, 4000)   # high glassy beating
braam(st["s7"] + S["s7"]["lines"][0]["start"] + S["s7"]["lines"][0]["dur"] + 0.4, 0.55)               # title hit

# ------------------------------------------------------------------ mix
level = np.convolve(np.abs(dlg), np.ones(int(0.2 * SR)) / int(0.2 * SR), mode="same")
duck = 1 - 0.6 * np.clip(level / (np.percentile(level[level > 1e-4], 90) + 1e-9), 0, 1) if (level > 1e-4).any() else np.ones(N)
duck = np.convolve(duck, np.ones(int(0.15 * SR)) / int(0.15 * SR), mode="same")
sfx_st = np.stack([sfx, np.roll(sfx, int(0.011 * SR))], axis=1)
dlg_st = np.stack([dlg, dlg], axis=1)
out = ROOT / "out/audio"; out.mkdir(parents=True, exist_ok=True)
for name, x in (("dialogue", dlg_st), ("sfx", sfx_st), ("music", mus)):
    sf.write(out / f"{name}.wav", x / (np.abs(x).max() + 1e-9) * 0.9, SR, subtype="PCM_24")
mix = dlg_st * 1.0 + sfx_st * 0.85 * duck[:, None] + mus * 0.9 * duck[:, None]
mix /= np.abs(mix).max() + 1e-9
fade = np.clip((TOTAL - t) / 1.2, 0, 1)[:, None] * np.clip(t / 0.3, 0, 1)[:, None]
sf.write(out / "mix-raw.wav", mix * fade * 0.9, SR, subtype="PCM_24")
(ROOT / "public/audio").mkdir(parents=True, exist_ok=True)
subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(out / "mix-raw.wav"), "-af", "loudnorm=I=-14:TP=-1.0:LRA=14", "-ar", str(SR), str(ROOT / "public/audio/mix.wav")], check=True)

(ROOT / "src/timeline.json").write_text(json.dumps({"fps": 30, "duration": TOTAL, "title": script["title"], "scenes": scenes}, indent=2))
for s in scenes:
    print(f"{s['id']} {s['name']:<22} {s['start']:6.2f}s  +{s['dur']:5.2f}s  lines at " + ", ".join(f"{l['start']:.1f}" for l in s["lines"]))
