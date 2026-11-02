"""Voices every scripted line with Google Gemini text-to-speech (one voice per speaker).

Each clip is trimmed and checked by transcribing it back; mismatches are regenerated.
Output: public/audio/voices/<scene>_<n>.wav and public/audio/voices.json. Needs GEMINI_API_KEY.
Usage: python3 tools/voice.py [--scene s3] [--model M]
"""

import argparse, base64, json, os, re, subprocess, sys, time, unicodedata, urllib.error, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public/audio/lines"
API = "https://generativelanguage.googleapis.com/v1beta/models"

def post(model: str, body: dict, timeout=90):
    req = urllib.request.Request(f"{API}/{model}:generateContent", data=json.dumps(body).encode(),
                                 headers={"content-type": "application/json", "x-goog-api-key": os.environ["GEMINI_API_KEY"]})
    for attempt in range(4):
        try:
            return json.load(urllib.request.urlopen(req, timeout=timeout))
        except urllib.error.HTTPError as e:
            if e.code in (429, 500, 503, 504) and attempt < 5:
                time.sleep(4 * (attempt + 1)); continue
            raise RuntimeError(f"{model}: HTTP {e.code} {e.read()[:300]!r}")
        except (urllib.error.URLError, TimeoutError, ConnectionError) as e:
            last = e
            time.sleep(4 * (attempt + 1)); continue
    raise RuntimeError(f"{model}: no response after retries")


def synth(model: str, voice: str, text: str, style: str, dest: Path):
    prompt = f"Speak as {style}. Read exactly this text and nothing else:\n{text}"
    for attempt in range(6):
        d = post(model, {"contents": [{"parts": [{"text": prompt}]}],
                         "generationConfig": {"responseModalities": ["AUDIO"],
                                              "speechConfig": {"voiceConfig": {"prebuiltVoiceConfig": {"voiceName": voice}}}}})
        c = ((d or {}).get("candidates") or [{}])[0]
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
           "areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.1,areverse,"
           "loudnorm=I=-18:TP=-2:LRA=9,aresample=48000")
    subprocess.run(["ffmpeg", "-y", "-v", "error", *src, "-af", flt, "-ac", "1", str(dest)], check=True)
    tmp.unlink()


def transcribe(wav: Path) -> str:
    body = {"contents": [{"parts": [{"inline_data": {"mime_type": "audio/wav", "data": base64.b64encode(wav.read_bytes()).decode()}},
                                    {"text": "Transcribe this English speech exactly. Write every number as words (for example nineteen forty-five, not 1945). Output only the transcript."}]}]}
    for m in ("gemini-flash-lite-latest", "gemini-flash-latest"):
        try:
            d = post(m, body, timeout=60)
            return "".join(p.get("text", "") for p in d["candidates"][0]["content"]["parts"] if not p.get("thought"))
        except Exception as e:
            last = e
    raise last


def norm(s: str) -> str:
    s = unicodedata.normalize("NFC", s)
    return re.sub(r"[^a-z0-9]", "", s.lower())


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
    ap.add_argument("--scene", action="append", help="only these scene ids (repeatable)")
    a = ap.parse_args()
    script = json.loads((ROOT / "script/script.json").read_text())
    out = ROOT / "public/audio/voices"
    out.mkdir(parents=True, exist_ok=True)
    meta_path = ROOT / "public/audio/voices.json"
    meta = json.loads(meta_path.read_text()) if meta_path.exists() else {}
    for sc in script["scenes"]:
        if a.scene and sc["id"] not in a.scene:
            continue
        for n, line in enumerate(sc["lines"]):
            v = script["voices"][line["who"]]
            key = f"{sc['id']}_{n}"
            dest = out / f"{key}.wav"
            best = None
            for attempt in range(6):
                try:
                    synth(a.model, v["voice"], line["text"], v["style"], dest)
                    heard = transcribe(dest)
                except Exception as e:
                    print(f"{key}: attempt {attempt + 1} failed ({e}); retrying", flush=True)
                    time.sleep(6)
                    continue
                score = similarity(line["text"], heard)
                print(f"{key} {line['who']}: try {attempt + 1} match {score:.2f} ({duration(dest):.2f}s)", flush=True)
                if best is None or score > best[0]:
                    best = (score, dest.read_bytes(), heard)
                if score >= 0.9:
                    break
            if best is None:
                raise SystemExit(f"{key}: Gemini kept failing; run again later with --scene {sc['id']}")
            dest.write_bytes(best[1])
            meta[key] = {"who": line["who"], "text": line["text"], "file": f"audio/voices/{key}.wav", "duration": round(duration(dest), 3), "match": round(best[0], 3), "voice": v["voice"]}
            meta_path.write_text(json.dumps(meta, indent=2))
    print("done", flush=True)


if __name__ == "__main__":
    main()
