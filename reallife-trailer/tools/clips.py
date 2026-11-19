"""Step 2: generate one photoreal video clip per storyboard shot with Google Veo (Gemini API).

Reference images in refs/ are attached to the shots that feature that character or the car.
Writes clips/raw/<shot>.mp4 (skips shots that already exist; use --force to redo).
Usage: python3 tools/clips.py [--only 02_walk] [--force] [--check]
  --check   verify the key can reach the Veo model, without generating (no cost).
"""
import argparse, base64, time
from common import ROOT, board, call, key, setting

def check(k, model):
    call("GET", f"models/{model}", k)
    print(f"OK: this key can see {model}.")

def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--only", action="append"); ap.add_argument("--force", action="store_true"); ap.add_argument("--check", action="store_true")
    a = ap.parse_args()
    b = board(); k = key("VEO_API_KEY", "GEMINI_API_KEY"); model = setting("VEO_MODEL", "veo-3.1-generate-preview")
    check(k, model)
    if a.check: return
    out = ROOT / "clips/raw"; out.mkdir(parents=True, exist_ok=True)
    for s in b["shots"]:
        if a.only and s["id"] not in a.only: continue
        dest = out / f"{s['id']}.mp4"
        if dest.exists() and not a.force: print("exists:", dest.name); continue
        subjects = " ".join(b["characters"][r] for r in s["refs"])
        prompt = f"{s['prompt']} {subjects} {b['style']}"
        inst = {"prompt": prompt}
        refs = [ROOT / "refs" / f"{r}.png" for r in s["refs"] if (ROOT / "refs" / f"{r}.png").exists()]
        if refs:
            inst["referenceImages"] = [{"image": {"bytesBase64Encoded": base64.b64encode(p.read_bytes()).decode(), "mimeType": "image/png"}, "referenceType": "asset"} for p in refs[:3]]
        params = {"aspectRatio": "16:9", "negativePrompt": b["negative"], "resolution": setting("VEO_RESOLUTION", "1080p"),
                  "durationSeconds": 8 if s["len"] > 4 else 4 if not refs else 8}
        op = call("POST", f"models/{model}:predictLongRunning", k, {"instances": [inst], "parameters": params}, timeout=300)
        name = op["name"]; print(f"{s['id']}: generating ({name})", flush=True)
        while True:
            time.sleep(15)
            op = call("GET", name, k)
            if op.get("done"): break
        if "error" in op: raise SystemExit(f"{s['id']}: {op['error']}")
        samples = op["response"]["generateVideoResponse"].get("generatedSamples") or []
        if not samples: raise SystemExit(f"{s['id']}: no video returned (possibly blocked by safety filters): {str(op)[:400]}")
        uri = samples[0]["video"]["uri"]
        dest.write_bytes(call("GET", uri + ("&" if "?" in uri else "?") + "alt=media", k, timeout=600, raw=True))
        print(f"{s['id']}: saved {dest.name}", flush=True)

if __name__ == "__main__":
    main()
