"""Step 1: photoreal reference images for the two characters and the car (Gemini image model).

Writes refs/<name>.png. These are fed to every video shot that features that subject, to keep faces,
clothes and the car identical across scenes. Usage: python3 tools/refs.py [--only marco]
"""
import argparse, base64
from common import ROOT, board, call, key, setting

PROMPTS = {
    "marco": "Photorealistic full-length cinematic portrait photograph of {d}. He stands outside an art-deco beach hotel at golden hour. Shot on a cinema camera, 50mm lens, natural skin texture, realistic lighting, neutral pose, face clearly visible, head to toe in frame.",
    "elena": "Photorealistic waist-up cinematic portrait photograph of {d}. She stands on a palm-lined Miami-style street at golden hour. Shot on a cinema camera, 50mm lens, natural skin texture, face clearly visible.",
    "car":   "Photorealistic three-quarter front view photograph of {d}, parked on a palm-lined beachfront boulevard at golden hour, realistic reflections, automotive advertising photography, no logos.",
}

def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--only", action="append"); a = ap.parse_args()
    b = board(); k = key("GEMINI_API_KEY"); model = setting("IMAGE_MODEL", "gemini-3-pro-image-preview")
    (ROOT / "refs").mkdir(exist_ok=True)
    for name, p in PROMPTS.items():
        if a.only and name not in a.only: continue
        prompt = p.format(d=b["characters"][name]) + " Fictional person/design, not resembling any real celebrity. No text, no watermark."
        d = call("POST", f"models/{model}:generateContent", k, {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"responseModalities": ["IMAGE"], "imageConfig": {"aspectRatio": "3:4" if name != "car" else "16:9"}}}, timeout=300)
        parts = d.get("candidates", [{}])[0].get("content", {}).get("parts", [])
        img = next((x["inlineData"] for x in parts if "inlineData" in x), None)
        if not img: raise SystemExit(f"{name}: no image returned: {str(d)[:300]}")
        (ROOT / "refs" / f"{name}.png").write_bytes(base64.b64decode(img["data"]))
        print("wrote refs/%s.png" % name, flush=True)

if __name__ == "__main__":
    main()
