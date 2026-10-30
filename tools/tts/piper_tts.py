"""Synthesizes narration with a Piper neural TTS voice (ONNX, CPU-only).

Called by tools/ai-voiceover.mjs. Reads a JSON job list on stdin:
  {"model": ".../voice.onnx", "speaker": 198, "length_scale": 1.08,
   "pause": 0.45, "jobs": [{"out": ".../scene.wav", "lines": ["...", "..."]}]}
Each line is synthesized separately and joined with `pause` seconds of
silence so the video engine can align subtitles to the pauses.
"""
import json
import sys
import wave

import numpy as np
from piper import PiperVoice
from piper.config import SynthesisConfig

job = json.load(sys.stdin)
voice = PiperVoice.load(job["model"])
cfg = SynthesisConfig(
    speaker_id=job.get("speaker"),
    length_scale=float(job.get("length_scale", 1.0)),
    noise_scale=0.6,
    noise_w_scale=0.7,
)
sr = voice.config.sample_rate
gap = np.zeros(int(sr * float(job.get("pause", 0.45))), dtype=np.float32)

for item in job["jobs"]:
    parts = []
    for line in item["lines"]:
        chunks = list(voice.synthesize(line, syn_config=cfg))
        if not chunks:
            continue
        if parts:
            parts.append(gap)
        parts.extend(c.audio_float_array for c in chunks)
    audio = np.concatenate(parts) if parts else gap
    pcm = (np.clip(audio, -1, 1) * 32767).astype(np.int16)
    with wave.open(item["out"], "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes(pcm.tobytes())
    print(f"wrote {item['out']}", file=sys.stderr)
