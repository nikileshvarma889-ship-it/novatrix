"""MH370 Part 1 production pipeline.

  python3 tools/build.py voice [--scene s3]     generate + verify voices (Gemini TTS)
  python3 tools/build.py audio                  dialogue processing, sound design, score, stems, mix, timeline
  python3 tools/build.py preview                quick low-res render of the whole film with sound (review before export)
  python3 tools/build.py scenes [--scene s5]    render every scene (or one) to out/scenes/<id>.mp4 at 1080x1920
  python3 tools/build.py assemble               join scene files + master audio -> out/MH370_PART1_THE_LAST_TRANSMISSION.mp4
  python3 tools/build.py all                    audio -> scenes -> assemble

Regenerate one scene after a change:  python3 tools/build.py scenes --scene s5 && python3 tools/build.py assemble
Needs: GEMINI_API_KEY (voice), Python with numpy/scipy/soundfile (audio), Node + Remotion (render), FFmpeg.
"""
import argparse, json, os, subprocess, sys, time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "out"
PY = os.environ.get("AUDIO_PYTHON", sys.executable)


def run(cmd, **kw):
    print("$", " ".join(str(c) for c in cmd), flush=True)
    subprocess.run([str(c) for c in cmd], check=True, cwd=ROOT, **kw)


def timeline():
    return json.loads((ROOT / "src/timeline.json").read_text())


def render(comp, dest, scale=1.0, crf=16, muted=True):
    cmd = ["npx", "remotion", "render", comp, dest, f"--crf={crf}", "--log=error"]
    if scale != 1.0:
        cmd.append(f"--scale={scale}")
    if muted:
        cmd.append("--muted")
    t0 = time.time()
    run(cmd)
    print(f"   {comp} rendered in {(time.time() - t0) / 60:.1f} min", flush=True)


def cmd_scenes(only):
    (OUT / "scenes").mkdir(parents=True, exist_ok=True)
    for s in timeline()["scenes"]:
        if only and s["id"] not in only:
            continue
        render(f"Scene-{s['id']}", OUT / "scenes" / f"{s['id']}.mp4")


def cmd_assemble():
    tl = timeline()
    lst = OUT / "scenes/concat.txt"
    lst.write_text("".join(f"file '{s['id']}.mp4'\n" for s in tl["scenes"]))
    final = OUT / "MH370_PART1_THE_LAST_TRANSMISSION.mp4"
    run(["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", lst, "-i", ROOT / "public/audio/mix.wav",
         "-map", "0:v", "-map", "1:a", "-c:v", "libx264", "-preset", "slow", "-crf", "19", "-pix_fmt", "yuv420p", "-profile:v", "high",
         "-c:a", "aac", "-b:a", "256k", "-t", str(tl["duration"]), "-movflags", "+faststart", final])
    # a small version for phones / messaging
    run(["ffmpeg", "-y", "-v", "error", "-i", final, "-vf", "scale=720:1280", "-c:v", "libx264", "-crf", "24", "-preset", "slow",
         "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", OUT / "MH370_PART1_THE_LAST_TRANSMISSION_720p.mp4"])
    print("final:", final, flush=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("step", choices=["voice", "audio", "preview", "scenes", "assemble", "all"])
    ap.add_argument("--scene", action="append")
    a = ap.parse_args()
    if a.step == "voice":
        run([sys.executable, "-u", "tools/voice.py", *sum((["--scene", s] for s in (a.scene or [])), [])])
    if a.step in ("audio", "all"):
        run([PY, "tools/audio.py"])
    if a.step == "preview":
        render("Full", OUT / "MH370_PART1_preview.mp4", scale=0.4, crf=26, muted=False)
    if a.step in ("scenes", "all"):
        cmd_scenes(a.scene)
    if a.step in ("assemble", "all"):
        cmd_assemble()


if __name__ == "__main__":
    main()
