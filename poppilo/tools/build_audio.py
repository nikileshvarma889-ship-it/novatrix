"""Builds POPPILO's soundtrack from src/song.json — all sound is generated here.

  * Music: original arrangement (ukulele-style plucks, bass, glockenspiel,
    kick, claps, shaker) synthesised with NumPy.
  * Vocals: each word is spoken by a Piper neural voice (LibriTTS, CC BY 4.0),
    then re-pitched onto the melody, stretched to the rhythm and given a
    brighter, younger formant with the WORLD vocoder.
  * SFX: footsteps, boings, claps, pops, sparkles, whooshes, "yay".

Outputs public/audio/song.wav and public/audio/lipsync.json (per-frame mouth
openness + who is singing), which the animation reads.

Usage:  POPPILO_PIPER_MODEL=/path/en-us-libritts-high.onnx \
        /path/to/venv/bin/python tools/build_audio.py
"""
import json
import os
import subprocess
import sys
import warnings

import numpy as np
import pyworld as pw
import soundfile as sf
from scipy.signal import butter, fftconvolve, resample_poly, sosfilt

warnings.filterwarnings("ignore")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SONG = json.load(open(os.path.join(ROOT, "src/song.json")))
OUT = os.path.join(ROOT, "public/audio")
SR = 44100
FPS = 30
BEAT = 60 / SONG["bpm"]
BAR = BEAT * 4
LEN = SONG["lengthSeconds"]
N = int(LEN * SR)
rng = np.random.default_rng(7)

NOTE = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}


def hz(name):
    return 440.0 * 2 ** ((NOTE[name[0]] + (1 if "#" in name else 0) + 12 * (int(name[-1]) + 1) - 69) / 12)


CHORDS = {"C": ["C3", "E3", "G3", "C4"], "F": ["F2", "A3", "C4", "F4"], "G": ["G2", "B3", "D4", "G4"], "Am": ["A2", "C4", "E4", "A4"]}


def track():
    return np.zeros(N + SR * 3, dtype=np.float64)


def place(buf, x, t, gain=1.0):
    i = int(t * SR)
    buf[i : i + len(x)] += x[: max(0, len(buf) - i)] * gain


def env(n, a=0.005, d=0.3):
    t = np.arange(n) / SR
    return np.minimum(1, t / a) * np.exp(-t / d)


def bandpass(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo, hi], btype="band", fs=SR, output="sos"), x)


def lowpass(x, f):
    return sosfilt(butter(2, f, btype="low", fs=SR, output="sos"), x)


def highpass(x, f):
    return sosfilt(butter(2, f, btype="high", fs=SR, output="sos"), x)


# ---------- instruments ----------
_plucks = {}


def pluck(f, dur=1.2, bright=0.5):
    """Karplus-Strong string — a soft ukulele-like pluck (cached per note)."""
    key = (round(f, 2), dur)
    if key not in _plucks:
        _plucks[key] = _pluck(f, dur, bright)
    return _plucks[key]


def _pluck(f, dur, bright):
    n = int(dur * SR)
    p = int(SR / f)
    buf = rng.uniform(-1, 1, p) * bright + rng.uniform(-1, 1, p) * (1 - bright) * 0.3
    out = np.zeros(n)
    for i in range(n):
        out[i] = buf[i % p]
        buf[i % p] = 0.5 * (buf[i % p] + buf[(i + 1) % p]) * 0.996
    return lowpass(out, 5000) * env(n, 0.002, 0.9)


def glock(f, dur=1.0):
    t = np.arange(int(dur * SR)) / SR
    x = np.sin(2 * np.pi * f * t) + 0.25 * np.sin(2 * np.pi * f * 2.76 * t) * np.exp(-t * 6) + 0.1 * np.sin(2 * np.pi * f * 5.4 * t) * np.exp(-t * 12)
    return x * env(len(t), 0.002, 0.55)


def bass(f, dur):
    t = np.arange(int(dur * SR)) / SR
    x = np.sin(2 * np.pi * f * t) + 0.3 * np.sin(4 * np.pi * f * t)
    return x * env(len(t), 0.01, 0.35)


def kick():
    t = np.arange(int(0.3 * SR)) / SR
    f = 50 + 110 * np.exp(-t * 30)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 12)


def clap():
    n = int(0.25 * SR)
    x = np.zeros(n)
    for k, off in enumerate([0, 0.011, 0.022]):
        i = int(off * SR)
        b = rng.uniform(-1, 1, n - i) * np.exp(-np.arange(n - i) / SR * (60 if k < 2 else 18))
        x[i:] += b
    return bandpass(x, 900, 3200) * 0.9


def shaker():
    n = int(0.06 * SR)
    return highpass(rng.uniform(-1, 1, n), 6000) * env(n, 0.004, 0.02)


# ---------- sound effects ----------
def sfx(name):
    t = lambda d: np.arange(int(d * SR)) / SR
    if name == "boing":
        tt = t(0.45)
        f = 180 + 420 * (1 - np.exp(-tt * 9)) + 30 * np.sin(2 * np.pi * 14 * tt)
        return 0.5 * np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 5)
    if name == "pop":
        tt = t(0.12)
        f = 900 * np.exp(-tt * 25) + 300
        return 0.6 * np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 40)
    if name == "sparkle":
        out = np.zeros(int(1.2 * SR))
        for k, n in enumerate(["C6", "E6", "G6", "C7", "E7"]):
            g = glock(hz(n), 0.8) * 0.35
            i = int(k * 0.06 * SR)
            out[i : i + len(g)] += g[: len(out) - i]
        return out
    if name == "whoosh":
        n = int(0.7 * SR)
        x = rng.uniform(-1, 1, n)
        sweep = np.linspace(400, 2400, n)
        y = np.zeros(n)
        for i in range(0, n, 2048):  # crude moving band
            y[i : i + 2048] = bandpass(x[i : i + 2048], sweep[i] * 0.7, sweep[i] * 1.3)
        return y * np.sin(np.linspace(0, np.pi, n)) ** 2 * 0.5
    if name == "step":
        n = int(0.08 * SR)
        return lowpass(rng.uniform(-1, 1, n), 700) * env(n, 0.003, 0.025) * 0.6
    if name == "clap":
        return clap()
    raise ValueError(name)


# ---------- singing voice ----------
voice = None


def speak(text, speaker):
    global voice
    from piper import PiperVoice
    from piper.config import SynthesisConfig

    if voice is None:
        voice = PiperVoice.load(os.environ["POPPILO_PIPER_MODEL"])
    ch = list(voice.synthesize(text, syn_config=SynthesisConfig(speaker_id=speaker, length_scale=1.0)))
    x = np.concatenate([c.audio_float_array for c in ch]).astype(np.float64)
    sr = ch[0].sample_rate
    # trim leading/trailing silence
    e = np.convolve(np.abs(x), np.ones(200) / 200, "same")
    idx = np.where(e > 0.02)[0]
    return (x[idx[0] : idx[-1]] if len(idx) else x), sr


def sing(text, notes, speaker, formant):
    """Speak `text`, then fit it onto `notes` [(name, beats), ...]."""
    x, sr = speak(text, speaker)
    fp = 5.0
    f0, tt = pw.harvest(x, sr, f0_floor=80, f0_ceil=600, frame_period=fp)
    sp = pw.cheaptrick(x, f0, tt, sr)
    ap = pw.d4c(x, f0, tt, sr)
    total = sum(b for _, b in notes) * BEAT
    sung = total * 0.9  # leave a breath before the next word
    n_out = max(4, int(sung * 1000 / fp))
    # Time-stretch: hold the voiced core longer than consonant edges.
    voiced = f0 > 0
    w = np.where(voiced, 3.0, 1.0)
    cum = np.concatenate([[0], np.cumsum(w)])
    cum /= cum[-1]
    pos = np.interp(np.linspace(0, 1, n_out), cum, np.arange(len(cum)))
    k = np.clip(np.round(pos).astype(int), 0, len(f0) - 1)
    f0n, spn, apn = f0[k].copy(), sp[k].copy(), ap[k].copy()
    # Melody: syllables share the word by beat length.
    bounds = np.cumsum([b for _, b in notes]) / sum(b for _, b in notes)
    seg = np.searchsorted(bounds, np.linspace(0, 1, n_out, endpoint=False), side="right")
    target = np.array([hz(notes[min(s, len(notes) - 1)][0]) for s in seg])
    # gentle portamento + vibrato on held notes
    target = np.convolve(np.log(target), np.ones(9) / 9, "same")
    target[:4] = target[4]
    target[-4:] = target[-5]
    t = np.arange(n_out) * fp / 1000
    vib = 0.018 * np.sin(2 * np.pi * 5.5 * t) * np.clip((t - 0.25) / 0.2, 0, 1)
    f0n = np.where(f0n > 0, np.exp(target + vib), 0.0)
    # brighter, younger timbre: stretch the spectral envelope upward
    bins = spn.shape[1]
    fx = np.arange(bins)
    spn = np.array([np.interp(fx / formant, fx, row) for row in spn])
    y = pw.synthesize(f0n, np.ascontiguousarray(spn), np.ascontiguousarray(apn), sr, fp)
    y = resample_poly(y, SR, sr)
    fade = min(len(y) // 4, int(0.02 * SR))
    y[:fade] *= np.linspace(0, 1, fade)
    y[-fade:] *= np.linspace(1, 0, fade)
    return y / (np.max(np.abs(y)) + 1e-9) * 0.8


def reverb(x, seconds=1.1, wet=0.2):
    n = int(seconds * SR)
    ir = rng.uniform(-1, 1, n) * np.exp(-np.arange(n) / SR * 5)
    ir = lowpass(ir, 6000)
    y = fftconvolve(x, ir)[: len(x)]
    return x + wet * y / (np.max(np.abs(y)) + 1e-9) * np.max(np.abs(x))


def main():
    music, drums, vox, fx = track(), track(), track(), track()
    chords = SONG["chords"]
    lines = SONG["lines"]
    sung_bars = {b for l in lines for b in (l["bar"], l["bar"] + 1)}

    # --- band ---
    for bar, name in enumerate(chords):
        t0 = bar * BAR
        last = bar == len(chords) - 1
        tones = [hz(n) for n in CHORDS[name]]
        strums = [0, 1.5, 2, 3] if not last else [0]
        for b in strums:
            for k, f in enumerate(tones[1:]):
                place(music, pluck(f, 1.6 if last else 1.0), t0 + b * BEAT + k * 0.012, 0.18)
        place(music, bass(tones[0], 3.0 if last else 0.9), t0, 0.5)
        if not last:
            place(music, bass(tones[0] * (1.5 if bar % 2 else 1), 0.9), t0 + 2 * BEAT, 0.45)
        intro = bar == 0
        for b in range(4):
            if last and b > 0:
                break
            if b in (0, 2):
                place(drums, kick(), t0 + b * BEAT, 0.55 if not intro else 0.35)
            if b in (1, 3) and not intro:
                place(drums, clap(), t0 + b * BEAT, 0.28)
            for h in (0, 0.5):
                if not intro:
                    place(drums, shaker(), t0 + (b + h) * BEAT, 0.12 if h else 0.08)

    # --- glockenspiel: hooks in intro/dance break, soft doubling under vocals ---
    for hook in SONG["hooks"]:
        t = hook["bar"] * BAR
        for n, b in hook["notes"]:
            place(music, glock(hz(n), 1.2), t, 0.22)
            t += b * BEAT
    for l in lines:
        t = l["bar"] * BAR
        for word in l["notes"]:
            for n, b in word[1:]:
                place(music, glock(hz(n) * 2, 0.8), t, 0.06)
                t += b * BEAT

    # --- vocals ---
    cfg = SONG["singerVoice"]
    syllables = []
    for li, l in enumerate(lines):
        t = l["bar"] * BAR
        for word in l["notes"]:
            text, notes = word[0], [tuple(n) for n in word[1:]]
            y = sing(text, notes, cfg["speaker"], cfg["formantShift"])
            place(vox, y, t, 0.9)
            # light double for a friendly "kids singing together" feel
            if len(l["singers"]) > 1:
                y2 = resample_poly(y, 1000, 1004)
                place(vox, y2, t + 0.018, 0.35)
            for n, b in notes:
                syllables.append({"line": li, "t": round(t, 3), "dur": round(b * BEAT, 3)})
                t += b * BEAT
        print(f"  sang: {l['text']}", file=sys.stderr)

    # --- sound effects ---
    for e in SONG["sfx"]:
        if e["id"] == "yay":
            y = sing("yay", [("G5", 1.5)], cfg["speaker"], cfg["formantShift"])
            place(fx, y, e["t"], 0.6 * e.get("gain", 1))
        else:
            place(fx, sfx(e["id"]), e["t"], 0.8 * e.get("gain", 1))

    vox_wet = reverb(highpass(vox, 120), 1.0, 0.18)
    mix = reverb(music, 1.3, 0.25) * 0.62 + drums * 0.65 + vox_wet * 1.35 + fx * 0.7
    mix = mix[:N]
    fade = int(1.5 * SR)
    mix[-fade:] *= np.linspace(1, 0, fade)
    mix /= np.max(np.abs(mix)) + 1e-9
    os.makedirs(OUT, exist_ok=True)
    if os.environ.get("POPPILO_STEMS"):  # separate tracks for checking the mix
        for name, x in (("vocals", vox_wet), ("music", music), ("drums", drums), ("fx", fx)):
            sf.write(os.path.join(OUT, f".stem-{name}.wav"), x[:N].astype(np.float32), SR)
    raw = os.path.join(OUT, ".song-raw.wav")
    sf.write(raw, np.stack([mix, mix], 1) * 0.9, SR)
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", raw, "-af", "loudnorm=I=-14:TP=-1.5:LRA=9", "-ar", "48000", os.path.join(OUT, "song.wav")], check=True)
    os.remove(raw)

    # --- lip-sync data: mouth openness per video frame + who sings ---
    v = vox[:N]
    hop = SR // FPS
    frames = int(LEN * FPS)
    rms = np.array([np.sqrt(np.mean(v[i * hop : (i + 1) * hop] ** 2)) for i in range(frames)])
    mouth = np.clip(rms / (np.percentile(rms[rms > 1e-4], 95) + 1e-9), 0, 1)
    singers = [[] for _ in range(frames)]
    for l in lines:
        a, b = int(l["bar"] * BAR * FPS), int((l["bar"] + 2) * BAR * FPS)
        for i in range(a, min(b, frames)):
            singers[i] = l["singers"]
    yay = [int(e["t"] * FPS) for e in SONG["sfx"] if e["id"] == "yay"]
    json.dump(
        {"fps": FPS, "mouth": [round(float(m), 3) for m in mouth], "singers": singers, "yay": yay, "syllables": syllables,
         "lines": [{"text": l["text"], "start": l["bar"] * BAR, "end": (l["bar"] + 2) * BAR, "singers": l["singers"]} for l in lines]},
        open(os.path.join(OUT, "lipsync.json"), "w"),
    )
    print(f"wrote public/audio/song.wav ({LEN}s) and lipsync.json ({frames} frames)", file=sys.stderr)


if __name__ == "__main__":
    main()
