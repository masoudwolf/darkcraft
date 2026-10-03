# Sound Credits

All sound effects in this game are **generated in-house** by
`tools/gen_sounds.py` — a procedural DSP synthesis pipeline written
specifically for DarkCraft (Minecraft × Dark Souls style):

- impacts: sub-sine thumps + filtered brown-noise smacks
- metal: modal inharmonic partial synthesis (bells, clangs, tings)
- whooshes: Chamberlin state-variable filter sweeps over noise
- monster roars: detuned saw stacks with AM growl, tube-style drive, sub octave
- chimes/fanfares: modal bell arpeggios with a small Schroeder reverb
- fire: brown-noise beds + randomized crackle pops

No third-party samples, no downloaded assets, no TTS vocals.
Every file is reproducible from source: `python3 tools/gen_sounds.py`
