# POPPILO — *The Little Animal Parade*

*Little stories. Big imaginations.*

A 52-second preschool 3D animation pilot: 1920×1080, 30 fps.
It's built with Remotion, React Three Fiber and Three.js, and the audio is made with Python and FFmpeg. Everything is original and generated procedurally: the 3D models, the garden, the music, the singing and the sound effects.

```bash
npm install
```

```bash
npm run studio
```

`npm run studio` opens a live preview where you can scrub the animation. To render the outputs:

```bash
npm run preview
```

```bash
npm run render
```

```bash
npm run thumbnail
```

- `preview` writes a quick half-resolution check to `out/preview.mp4`.
- `render` writes the final 1080p video to `out/the-little-animal-parade.mp4`.
- `thumbnail` writes the 1280×720 YouTube thumbnail to `out/thumbnail.png`.

No GPU is needed: WebGL runs on the CPU through SwiftShader (`remotion.config.ts`). The full render takes roughly 15–30 minutes on a 4-core machine.
If Remotion can't download its own browser, point it at one: `REMOTION_BROWSER_EXECUTABLE=/path/to/chrome-headless-shell`.

## The characters (reusable)

All three share one rig in `src/characters/Character.tsx`; `src/characters/species.tsx` defines what makes each one different.

| | Bubu the Bear | Lulu the Bunny | Toto the Lion |
|---|---|---|---|
| Fur | brown, cream muzzle | white, pink inner ears | golden, soft orange mane |
| Outfit | red t-shirt, yellow dungarees | blue dress, pink collar and bow | green t-shirt with a star, shorts |
| Eyes | brown | blue | amber |

Every character has the same set of parts and controls:
- **Body and limbs:** body, head, two arms with shoulder pivots, two legs, ears and a tail.
- **Face:** glossy eyes with highlights, eyelids (for blinking and happy squints), brows, a mouth (smile or open mouth with tongue) and cheeks.
- **Materials:** physically based, with sheen and a procedural bump texture for fur, a weave texture for fabric, and clearcoat for the eyes and nose.
- **Animation controls:** a single `Pose` object drives everything, including position, jump, squash and stretch, lean, sway, twist, head nod/turn/tilt, arm raise/forward/wave, leg swing, ear flop, blink, happy eyes, mouth openness, smile, brows and gaze.

To use a character in a new episode:

```tsx
<Character kind="lulu" pose={{ ...neutralPose(), x: 1, armR: { raise: 2.5, forward: 0, wave: t * 11 } }} />
```

## Where to change things

| To change… | Edit |
|---|---|
| Song lyrics, melody, chords, tempo, sound-effect cues | `src/song.json`, then run `npm run audio` |
| Who does what and when (walks, hops, waves, dances, claps, laughs) | `src/choreography.ts` → `poseAt()` |
| Camera shots and moves | `src/choreography.ts` → `cameraAt()` |
| The garden (trees, flowers, hills, clouds, butterflies, rainbow, lighting) | `src/world/Garden.tsx` |
| Logo, title card and tagline | `src/overlays/Overlays.tsx` |
| Character looks | `src/characters/species.tsx` |

## The soundtrack

`tools/build_audio.py` writes `public/audio/song.wav` and `public/audio/lipsync.json` from `src/song.json`:

- **Music:** an original arrangement at 120 BPM in C major (ukulele-style Karplus-Strong plucks, bass, glockenspiel, kick, claps and shaker), synthesised in NumPy. No samples and no existing melodies are used.
- **Singing:** each word is spoken by a Piper neural voice (LibriTTS speaker 114), then the WORLD vocoder re-pitches it onto the melody, stretches it to the rhythm and raises the formants for a younger, brighter tone.
- **Sound effects:** synthesised footsteps, boings, claps, pops, sparkles and whooshes, plus a sung "yay".
- **Lip-sync:** each character's mouth follows the loudness of the vocal track, frame by frame, but only while that character is singing (the `singers` list in `song.json`).

Rebuilding the audio needs a Python environment with `piper-tts`, `pyworld`, `numpy`, `scipy` and `soundfile`, plus the Piper voice:

```bash
python3 -m venv ~/poppilo-tts && ~/poppilo-tts/bin/pip install piper-tts pyworld numpy scipy soundfile "setuptools<81"
```

```bash
curl -L https://github.com/rhasspy/piper/releases/download/v0.0.2/voice-en-us-libritts-high.tar.gz | tar xz -C ~/poppilo-tts
```

```bash
POPPILO_PIPER_MODEL=~/poppilo-tts/en-us-libritts-high.onnx ~/poppilo-tts/bin/python tools/build_audio.py
```

## Credits for the YouTube description

- Singing voice is AI-generated with Piper TTS (LibriTTS "high" voice, speaker 114), which was trained on the LibriTTS corpus (CC BY 4.0, https://www.openslr.org/60/).
- Font: Fredoka (SIL Open Font License).
- Music, lyrics arrangement, characters and animation are original to POPPILO.

## Known limitations of this pilot

- **Singing voice.** It's synthesised: speech is retuned onto notes. The pitch is measured accurate, but it will sound more robotic than a human singer. For release quality, record a real child-friendly vocalist singing over `song.wav`'s melody, or license a singing-voice synthesiser.
- **Lip-sync.** It follows how loud the vocal is, not the individual sounds, so the mouth opens and closes with the singing but doesn't form specific shapes for each sound.
- **Models.** These are procedural models built from primitives, not sculpted, rigged and hand-animated studio models. A Blender or Maya pipeline would give finer silhouettes, fur and secondary motion.
