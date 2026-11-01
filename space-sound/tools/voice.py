"""Telugu narration with Google Gemini text-to-speech, one clip per line.

Each clip is trimmed, loudness-matched and checked by transcribing it back with Gemini;
a clip that doesn't match the script is generated again. Output:
  public/audio/lines/NN.wav  and  public/audio/lines.json  (durations + text)
Needs GEMINI_API_KEY. Usage: python3 tools/voice.py [--model M] [--voice V]
"""
import argparse, base64, json, os, re, subprocess, sys, time, unicodedata, urllib.error, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public/audio/lines"
API = "https://generativelanguage.googleapis.com/v1beta/models"

LINES = [
    ("ఒక్కసారి ఊహించుకోండి!", "with a hushed, gripping sense of wonder, like the opening of a documentary"),
    ("మీరు అంతరిక్షంలో ఉన్నారు... మీ పక్కనే ఒక భారీ పేలుడు జరిగినా మీకు శబ్దం వినిపించదు!", "slowly and dramatically, with a short pause after ఉన్నారు, rising tension"),
    ("అవును! ఇది నిజం!", "with calm, confident emphasis"),
    ("ఎందుకంటే శబ్దం ప్రయాణించడానికి గాలి లేదా మరొక పదార్థం అవసరం.", "clearly, like a science teacher explaining"),
    ("కానీ అంతరిక్షంలో దాదాపు శూన్య వాతావరణం ఉంటుంది.", "clearly and thoughtfully"),
    ("అందుకే అక్కడ శబ్దం మన చెవులకు చేరదు!", "with a satisfying, conclusive tone"),
    ("ఇలాంటి అద్భుతమైన విషయాలు తెలుసుకోవడానికి మన పేజీని ఫాలో అవ్వండి!", "warm and inviting"),
]


def post(model: str, body: dict, timeout=180):
    req = urllib.request.Request(f"{API}/{model}:generateContent", data=json.dumps(body).encode(),
                                 headers={"content-type": "application/json", "x-goog-api-key": os.environ["GEMINI_API_KEY"]})
    for attempt in range(6):
        try:
            return json.load(urllib.request.urlopen(req, timeout=timeout))
        except urllib.error.HTTPError as e:
            if e.code in (429, 500, 503, 504) and attempt < 5:
                time.sleep(4 * (attempt + 1)); continue
            raise RuntimeError(f"{model}: HTTP {e.code} {e.read()[:300]!r}")
        except (urllib.error.URLError, TimeoutError):
            if attempt < 5:
                time.sleep(4 * (attempt + 1)); continue
            raise


def synth(model: str, voice: str, text: str, style: str, dest: Path):
    prompt = (f"You are a deep-voiced, natural male Telugu documentary narrator. Speak in fluent, native Telugu, "
              f"{style}. Read exactly this text and nothing else:\n{text}")
    for attempt in range(6):
        d = post(model, {"contents": [{"parts": [{"text": prompt}]}],
                         "generationConfig": {"responseModalities": ["AUDIO"],
                                              "speechConfig": {"voiceConfig": {"prebuiltVoiceConfig": {"voiceName": voice}}}}})
        c = (d.get("candidates") or [{}])[0]
        parts = c.get("content", {}).get("parts", [])
        part = next((p["inlineData"] for p in parts if "inlineData" in p), None)
        if part:
            break
        print(f"   no audio returned (finishReason={c.get('finishReason')}), retrying")
        time.sleep(3)
    else:
        raise RuntimeError("Gemini returned no audio for: " + text)
    raw = base64.b64decode(part["data"])
    tmp = dest.with_suffix(".raw")
    tmp.write_bytes(raw)
    src = ["-i", str(tmp)] if "wav" in part["mimeType"] else ["-f", "s16le", "-ar", re.search(r"rate=(\d+)", part["mimeType"]).group(1), "-ac", "1", "-i", str(tmp)]
    # trim leading/trailing silence, gentle de-ess/EQ for a fuller documentary tone, 48 kHz
    flt = ("silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.05,"
           "areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.08,areverse,"
           "highpass=f=70,equalizer=f=140:t=q:w=1:g=2.5,equalizer=f=6500:t=q:w=2:g=-2,"
           "loudnorm=I=-16:TP=-1.5:LRA=7,aresample=48000")
    subprocess.run(["ffmpeg", "-y", "-v", "error", *src, "-af", flt, "-ac", "1", str(dest)], check=True)
    tmp.unlink()


def transcribe(wav: Path) -> str:
    body = {"contents": [{"parts": [{"inline_data": {"mime_type": "audio/wav", "data": base64.b64encode(wav.read_bytes()).decode()}},
                                    {"text": "Transcribe this Telugu speech exactly, in Telugu script only. Output only the transcript."}]}]}
    for m in ("gemini-flash-latest", "gemini-flash-lite-latest", "gemini-3.5-flash"):
        try:
            d = post(m, body)
            return "".join(p.get("text", "") for p in d["candidates"][0]["content"]["parts"] if not p.get("thought"))
        except Exception as e:
            last = e
    raise last


def norm(s: str) -> str:
    s = unicodedata.normalize("NFC", s)
    return re.sub(r"[^ఀ-౿]", "", s)


def similarity(a: str, b: str) -> float:
    a, b = norm(a), norm(b)
    if not a or not b:
        return 0.0
    # character-level Levenshtein ratio
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return 1 - prev[-1] / max(len(a), len(b))


def duration(p: Path) -> float:
    return float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(p)]).strip())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", default="gemini-2.5-flash-preview-tts")
    ap.add_argument("--voice", default="Charon")
    ap.add_argument("--only", type=int, nargs="*")
    a = ap.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    meta_path = ROOT / "public/audio/lines.json"
    meta = json.loads(meta_path.read_text()) if meta_path.exists() else {}
    for i, (text, style) in enumerate(LINES):
        if a.only and i not in a.only:
            continue
        dest = OUT / f"{i:02d}.wav"
        best = None
        for attempt in range(4):
            synth(a.model, a.voice, text, style, dest)
            heard = transcribe(dest)
            score = similarity(text, heard)
            print(f"line {i}: try {attempt + 1} match {score:.2f} ({duration(dest):.2f}s) heard: {heard.strip()[:80]}")
            if best is None or score > best[0]:
                best = (score, dest.read_bytes(), heard)
            if score >= 0.85:
                break
        dest.write_bytes(best[1])
        meta[str(i)] = {"text": text, "file": f"audio/lines/{i:02d}.wav", "duration": round(duration(dest), 3),
                        "match": round(best[0], 3), "heard": best[2].strip(), "model": a.model, "voice": a.voice}
    meta_path.write_text(json.dumps(meta, ensure_ascii=False, indent=2))
    print(f"total voice: {sum(v['duration'] for v in meta.values()):.1f}s")


if __name__ == "__main__":
    main()
