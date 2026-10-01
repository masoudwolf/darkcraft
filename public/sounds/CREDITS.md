# Sound Credits

**All audio in DarkCraft is 100% AI-generated in-house** — no external samples, no third-party recordings.

## How it was made

Every sound was produced by the DarkCraft AI sound-design pipeline
(`ai-sounds/` in the repository):

1. **Neural TTS voices** — monster roars, growls, giant bellows, hurt grunts
   and ghostly wails start as AI neural-vocal takes, then are DSP-processed
   (pitch transposition, tube-style distortion, growl modulation, sub-octave
   layering, convolution-style reverb) into creature voices.
2. **AI-designed physical modeling synthesis** — swords, clashes, armor,
   chains, bones, wood, UI, coins, gems, fire, explosions, footsteps and every
   other effect are rendered from AI-designed recipes:
   modal synthesis (inharmonic metal partials), filtered-noise whooshes,
   Karplus-Strong strings, FM bells, membrane drums, granular fire crackle.
3. **AI-composed adaptive music** — three seamless loops (explore / dread /
   boss) written in a somber Minecraft × Dark Souls musical language and
   rendered with the same synthesis engine.
4. **Zone ambience** — wind, bonfire crackle and dungeon drone loops, all
   synthesized and loop-crossfaded for seamless playback.

## Pipeline

- Synthesis renderer: TypeScript DSP engine (44.1 kHz)
- Vocal generation: neural text-to-speech
- Encoding: ffmpeg → Ogg Vorbis
- Files live under `public/sounds/{sfx,music,amb}`.
