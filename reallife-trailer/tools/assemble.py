"""Step 4: cut the clips to the storyboard, grade, add titles and the soundtrack, export and verify.

Reads clips/raw/<shot>.mp4 (optional "in" offsets in clips/trims.json), audio/mix.wav.
Writes clips/graded/<shot>.mp4, output/SOLANA_BAY_TRAILER_4K.mp4, output/SOLANA_BAY_TRAILER_1080p.mp4, output/thumbnail.jpg.
Usage: python3 tools/assemble.py [--clips DIR]
"""
import argparse, json, subprocess
from pathlib import Path
from common import ROOT, board

FONT_B = ROOT / "fonts/Inter-Bold.otf"
FONT_S = ROOT / "fonts/Inter-SemiBold.otf"

def run(cmd):
    subprocess.run([str(c) for c in cmd], check=True)

def probe(p):
    d = json.loads(subprocess.check_output(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height,r_frame_rate,nb_frames:format=duration", "-of", "json", str(p)]))
    s = d["streams"][0]; num, den = map(int, s["r_frame_rate"].split("/"))
    return {"w": s["width"], "h": s["height"], "fps": num / den, "dur": float(d["format"]["duration"])}

# filmic grade: gentle S-curve, warm highlights / cool shadows, slight desaturation, grain, vignette
GRADE = ("curves=master='0/0.02 0.25/0.21 0.5/0.5 0.75/0.79 1/0.97',"
         "colorbalance=rs=-0.03:bs=0.04:rh=0.04:bh=-0.04,eq=saturation=0.93,"
         "noise=alls=5:allf=t,vignette=PI/5")

def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--clips", default=str(ROOT / "clips/raw")); a = ap.parse_args()
    b = board(); W, H = b["resolution"]; FPS = b["fps"]; src = Path(a.clips)
    trims = json.loads((ROOT / "clips/trims.json").read_text()) if (ROOT / "clips/trims.json").exists() else {}
    missing = [s["id"] for s in b["shots"] if not (src / f"{s['id']}.mp4").exists()]
    if missing: raise SystemExit("Missing clips (run tools/clips.py first): " + ", ".join(missing))
    g = ROOT / "clips/graded"; g.mkdir(parents=True, exist_ok=True)
    work = ROOT / "output/_work"; work.mkdir(parents=True, exist_ok=True)
    for s in b["shots"]:
        p = src / f"{s['id']}.mp4"; info = probe(p)
        start = trims.get(s["id"], max(0.0, min(0.5, info["dur"] - s["len"])))
        frames = round(s["len"] * FPS)
        vf = (f"fps={FPS},scale={W}:{H}:force_original_aspect_ratio=increase:flags=lanczos,crop={W}:{H},{GRADE},"
              f"trim=end_frame={frames},setpts=PTS-STARTPTS,format=yuv420p")
        run(["ffmpeg", "-y", "-v", "error", "-ss", f"{start:.3f}", "-i", p, "-an", "-vf", vf, "-frames:v", frames,
             "-c:v", "libx264", "-preset", "medium", "-crf", "14", g / f"{s['id']}.mp4"])
        print(f"graded {s['id']}: {frames} frames from {start:.2f}s of a {info['dur']:.1f}s {info['w']}x{info['h']} clip", flush=True)
    lst = work / "list.txt"; lst.write_text("".join(f"file '{(g / (s['id'] + '.mp4')).as_posix()}'\n" for s in b["shots"]))
    T = b["duration"]; fin = [x for x in b["shots"] if x["id"] == "12_finale"][0]["start"]
    fs = H / 2160
    def txt(text, size, y, t0, t1, font=FONT_B, color="white", spacing=0):
        fade = f"if(lt(t,{t0}+0.6),(t-{t0})/0.6,if(gt(t,{t1}-0.6),({t1}-t)/0.6,1))"
        return (f"drawtext=fontfile='{font}':text='{text}':fontsize={int(size * fs)}:fontcolor={color}:x=(w-text_w)/2:y={y}:"
                f"alpha='{fade}':enable='between(t,{t0},{t1})':shadowcolor=black@0.6:shadowx={int(4 * fs)}:shadowy={int(4 * fs)}")
    titles = ",".join([
        txt(b["opening"], 130, f"h*0.42", 1.0, 4.6),
        txt(b["title"], 230, "h*0.38", fin + 0.4, T, color="0xF4EDE2"),
        txt(b["tagline"], 92, "h*0.56", fin + 0.9, T, FONT_S, "0xE8B04A"),
        f"fade=t=out:st={T - 0.8}:d=0.8",
    ])
    final = ROOT / "output/SOLANA_BAY_TRAILER_4K.mp4"
    run(["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", lst, "-i", ROOT / "audio/mix.wav", "-vf", titles,
         "-map", "0:v", "-map", "1:a", "-r", FPS, "-c:v", "libx264", "-preset", "slow", "-crf", "16", "-pix_fmt", "yuv420p", "-profile:v", "high",
         "-c:a", "aac", "-b:a", "320k", "-t", T, "-movflags", "+faststart", final])
    run(["ffmpeg", "-y", "-v", "error", "-i", final, "-vf", "scale=1920:1080:flags=lanczos", "-c:v", "libx264", "-crf", "19", "-preset", "slow",
         "-c:a", "copy", "-movflags", "+faststart", ROOT / "output/SOLANA_BAY_TRAILER_1080p.mp4"])
    run(["ffmpeg", "-y", "-v", "error", "-ss", f"{T - 1.2}", "-i", final, "-frames:v", "1", "-vf", "scale=1920:1080", "-q:v", "2", ROOT / "output/thumbnail.jpg"])
    v = probe(final)
    ok = abs(v["dur"] - T) < 0.05 and (v["w"], v["h"]) == (W, H) and abs(v["fps"] - FPS) < 0.01
    print(f"{final.name}: {v['w']}x{v['h']} @ {v['fps']:.3f} fps, {v['dur']:.3f}s -> {'VERIFIED' if ok else 'CHECK FAILED'}")
    if not ok: raise SystemExit(1)

if __name__ == "__main__":
    main()
