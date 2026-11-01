"""Voices scene narration with a local Piper model. Reads JSON on stdin:
{"model": "...onnx", "speaker": 198, "pace": 1.1, "jobs": [{"out": "x.wav", "text": "..."}]}"""
import json, sys, wave
import numpy as np
from piper import PiperVoice
from piper.config import SynthesisConfig

job = json.load(sys.stdin)
voice = PiperVoice.load(job["model"])
cfg = SynthesisConfig(speaker_id=job.get("speaker"), length_scale=float(job.get("pace", 1.1)))
for item in job["jobs"]:
    chunks = list(voice.synthesize(item["text"], syn_config=cfg))
    audio = np.concatenate([c.audio_float_array for c in chunks]) if chunks else np.zeros(2205, dtype=np.float32)
    with wave.open(item["out"], "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(voice.config.sample_rate)
        w.writeframes((np.clip(audio, -1, 1) * 32767).astype(np.int16).tobytes())
