/* DarkCraft SFX — pre-rendered game audio (generated in-house by
 * tools/gen_sounds.py) with the original procedural WebAudio synthesis kept
 * as a fallback, so a failed asset can never silence the game.
 *
 * The public API is byte-for-byte the original one (game.ts / enemy.ts /
 * player.ts call sites unchanged): every effect is an archetype designed to
 * be instantly recognizable — swing = airy whoosh, hit = thump+smack,
 * block = metal ting, roar = growling pitch-fall, levelUp = bell arpeggio. */

export class Sfx {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private muted = false
  private volume = 0.8

  /** method → pre-rendered asset in /sounds/sfx/ */
  private static readonly FILES: Record<string, string> = {
    swing: 'swing',
    hit: 'hit',
    hurt: 'hurt',
    roll: 'roll',
    heal: 'heal',
    souls: 'souls',
    levelUp: 'level_up',
    death: 'death',
    bonfire: 'bonfire',
    bossRoar: 'boss_roar',
    victory: 'victory',
    heavy: 'heavy',
    block: 'block',
    guardBreak: 'guard_break',
    hiss: 'hiss',
    boom: 'boom',
    phaseRoar: 'phase_roar',
    arrowShoot: 'arrow_shoot',
    arrowHit: 'arrow_hit',
    arrowBlock: 'arrow_block',
    shard: 'shard',
    stomp: 'stomp',
    dash: 'dash',
    stagger: 'stagger',
    fireShoot: 'fire_shoot',
    fireBoom: 'fire_boom',
    cast: 'cast',
    ember: 'ember',
    soulCollapse: 'soul_collapse',
    inferno: 'inferno',
  }

  private buffers = new Map<string, AudioBuffer>()
  private loadStarted = false

  /** master volume control (0 = silent) — persists across settings changes */
  setVolume(v: number) {
    this.volume = Math.max(0, Math.min(1, v))
    this.muted = this.volume <= 0.001
    if (this.master) this.master.gain.value = 0.5 * this.volume
    if (this.ctx && this.ctx.state === 'suspended' && !this.muted) {
      this.ctx.resume().catch(() => {})
    }
  }

  private ensure(): AudioContext | null {
    if (this.muted) return null
    try {
      if (!this.ctx) {
        const AC =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
        if (!AC) return null
        this.ctx = new AC()
        this.master = this.ctx.createGain()
        this.master.gain.value = 0.5 * this.volume
        this.master.connect(this.ctx.destination)
        this.loadAll()
      }
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {})
      return this.ctx
    } catch {
      return null
    }
  }

  resume() {
    this.ensure()
  }

  /** number of pre-rendered buffers successfully decoded (debug/QA hook) */
  loadedCount(): number {
    return this.buffers.size
  }

  private loadAll() {
    if (this.loadStarted || !this.ctx) return
    this.loadStarted = true
    for (const file of Object.values(Sfx.FILES)) {
      fetch(`/sounds/sfx/${file}.ogg`)
        .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
        .then((ab) => this.ctx!.decodeAudioData(ab))
        .then((buf) => {
          this.buffers.set(file, buf)
        })
        .catch(() => {
          /* asset failed — the procedural fallback covers this effect */
        })
    }
  }

  /** play a pre-rendered effect; false → caller uses the synth fallback */
  private playFile(file: string, vol = 1, jitter = 0.045): boolean {
    const ctx = this.ensure()
    if (!ctx || !this.master) return false
    const buf = this.buffers.get(file)
    if (!buf) return false
    try {
      const src = ctx.createBufferSource()
      src.buffer = buf
      if (jitter > 0) src.playbackRate.value = 1 + (Math.random() * 2 - 1) * jitter
      const g = ctx.createGain()
      g.gain.value = vol
      src.connect(g)
      g.connect(this.master)
      src.start()
      return true
    } catch {
      return false
    }
  }

  private tone(
    freq: number,
    dur: number,
    type: OscillatorType,
    vol = 0.4,
    slideTo?: number,
    delay = 0
  ) {
    const ctx = this.ensure()
    if (!ctx || !this.master) return
    try {
      const t0 = ctx.currentTime + delay
      const osc = ctx.createOscillator()
      const g = ctx.createGain()
      osc.type = type
      osc.frequency.setValueAtTime(freq, t0)
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur)
      g.gain.setValueAtTime(vol, t0)
      g.gain.exponentialRampToValueAtTime(0.001, t0 + dur)
      osc.connect(g)
      g.connect(this.master)
      osc.start(t0)
      osc.stop(t0 + dur + 0.05)
    } catch {
      /* ignore */
    }
  }

  private noise(dur: number, vol: number, filterFreq: number, slideTo?: number, delay = 0) {
    const ctx = this.ensure()
    if (!ctx || !this.master) return
    try {
      const t0 = ctx.currentTime + delay
      const len = Math.max(1, Math.floor(ctx.sampleRate * dur))
      const buf = ctx.createBuffer(1, len, ctx.sampleRate)
      const data = buf.getChannelData(0)
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
      const src = ctx.createBufferSource()
      src.buffer = buf
      const f = ctx.createBiquadFilter()
      f.type = 'lowpass'
      f.frequency.setValueAtTime(filterFreq, t0)
      if (slideTo) f.frequency.exponentialRampToValueAtTime(Math.max(40, slideTo), t0 + dur)
      const g = ctx.createGain()
      g.gain.setValueAtTime(vol, t0)
      g.gain.exponentialRampToValueAtTime(0.001, t0 + dur)
      src.connect(f)
      f.connect(g)
      g.connect(this.master)
      src.start(t0)
      src.stop(t0 + dur + 0.05)
    } catch {
      /* ignore */
    }
  }

  swing() {
    if (this.playFile('swing', 1, 0.07)) return
    this.noise(0.14, 0.22, 2600, 500)
  }
  hit() {
    if (this.playFile('hit', 1, 0.07)) return
    this.noise(0.1, 0.5, 900, 200)
    this.tone(170, 0.12, 'square', 0.22, 60)
  }
  hurt() {
    if (this.playFile('hurt', 1, 0.05)) return
    this.tone(140, 0.25, 'sawtooth', 0.3, 70)
    this.noise(0.14, 0.3, 700, 200)
  }
  roll() {
    if (this.playFile('roll', 1, 0.05)) return
    this.noise(0.18, 0.14, 650, 280)
  }
  heal() {
    if (this.playFile('heal', 1, 0.02)) return
    this.tone(520, 0.12, 'sine', 0.28)
    this.tone(660, 0.14, 'sine', 0.28, undefined, 0.09)
    this.tone(880, 0.22, 'sine', 0.22, undefined, 0.18)
  }
  souls() {
    if (this.playFile('souls', 1, 0.04)) return
    this.tone(920, 0.1, 'triangle', 0.22, 1400)
  }
  levelUp() {
    if (this.playFile('level_up', 1, 0.01)) return
    ;[523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.16, 'triangle', 0.26, undefined, i * 0.09))
  }
  death() {
    if (this.playFile('death', 1, 0.02)) return
    this.tone(110, 1.1, 'sawtooth', 0.32, 40)
    this.noise(0.7, 0.18, 420, 100)
  }
  bonfire() {
    if (this.playFile('bonfire', 1, 0.04)) return
    this.noise(0.45, 0.12, 850, 320)
    this.tone(320, 0.3, 'sine', 0.1, 480, 0.1)
  }
  bossRoar() {
    if (this.playFile('boss_roar', 1, 0.06)) return
    this.tone(85, 0.9, 'sawtooth', 0.38, 42)
    this.noise(0.7, 0.28, 520, 120)
  }
  victory() {
    if (this.playFile('victory', 1, 0.01)) return
    ;[392, 523, 659, 784, 1046].forEach((f, i) =>
      this.tone(f, 0.28, 'triangle', 0.26, undefined, i * 0.14)
    )
  }
  heavy() {
    if (this.playFile('heavy', 1, 0.06)) return
    this.noise(0.3, 0.5, 500, 120)
    this.tone(90, 0.28, 'square', 0.28, 40)
  }
  block() {
    if (this.playFile('block', 1, 0.06)) return
    this.tone(1250, 0.09, 'square', 0.16, 680)
    this.noise(0.07, 0.28, 3800, 900)
  }
  guardBreak() {
    if (this.playFile('guard_break', 1, 0.05)) return
    this.tone(320, 0.28, 'sawtooth', 0.26, 80)
    this.noise(0.22, 0.34, 1400, 180)
  }
  hiss() {
    // creeper fuse — rising filtered noise
    if (this.playFile('hiss', 1, 0.03)) return
    this.noise(0.95, 0.34, 700, 6000)
  }
  boom() {
    if (this.playFile('boom', 1, 0.04)) return
    this.noise(0.5, 0.72, 900, 80)
    this.noise(0.16, 0.42, 3200, 420)
    this.tone(72, 0.5, 'sine', 0.52, 28)
  }

  /* ---- boss ---- */

  /** deeper, longer roar for the phase-2 awakening */
  phaseRoar() {
    if (this.playFile('phase_roar', 1, 0.05)) return
    this.tone(62, 1.3, 'sawtooth', 0.42, 30)
    this.tone(124, 0.9, 'square', 0.16, 58, 0.1)
    this.noise(1.1, 0.32, 620, 90)
  }

  /* ---- skeleton archer ---- */

  /** bowstring twang + whoosh of the arrow leaving */
  arrowShoot() {
    if (this.playFile('arrow_shoot', 1, 0.05)) return
    this.tone(620, 0.07, 'square', 0.14, 240)
    this.noise(0.16, 0.2, 3400, 900, 0.02)
  }

  /** arrow thudding into something soft */
  arrowHit() {
    if (this.playFile('arrow_hit', 1, 0.07)) return
    this.noise(0.08, 0.42, 1100, 260)
    this.tone(190, 0.09, 'square', 0.16, 90)
  }

  /** arrow deflected by the shield */
  arrowBlock() {
    if (this.playFile('arrow_block', 1, 0.06)) return
    this.tone(1500, 0.07, 'square', 0.13, 900)
    this.noise(0.06, 0.24, 4200, 1400)
  }

  /** estus shard pickup — warm rising chime */
  shard() {
    if (this.playFile('shard', 1, 0.02)) return
    this.tone(392, 0.18, 'triangle', 0.24, 523)
    this.tone(659, 0.22, 'triangle', 0.22, undefined, 0.12)
    this.tone(880, 0.3, 'sine', 0.2, undefined, 0.24)
  }

  /** heavy foot/knee impact */
  stomp() {
    if (this.playFile('stomp', 1, 0.04)) return
    this.noise(0.26, 0.55, 340, 60)
    this.tone(58, 0.32, 'sine', 0.5, 26)
    this.noise(0.08, 0.2, 2600, 700)
  }

  /** charge dash whoosh */
  dash() {
    if (this.playFile('dash', 1, 0.05)) return
    this.noise(0.32, 0.3, 1100, 260)
    this.tone(140, 0.2, 'sawtooth', 0.12, 70)
  }

  /** posture break — metallic groan + impact */
  stagger() {
    if (this.playFile('stagger', 1, 0.04)) return
    this.tone(210, 0.5, 'sawtooth', 0.24, 62)
    this.noise(0.3, 0.4, 1600, 160)
    this.tone(90, 0.4, 'square', 0.3, 40, 0.12)
  }

  /* ---- pyromancy / ash wastes ---- */

  /** fireball launch — a pressure hiss + crackling whoosh */
  fireShoot() {
    if (this.playFile('fire_shoot', 1, 0.05)) return
    this.noise(0.18, 0.24, 1800, 500)
    this.tone(300, 0.16, 'sawtooth', 0.16, 120)
  }

  /** fireball detonation — deep thump + crackle */
  fireBoom() {
    if (this.playFile('fire_boom', 1, 0.05)) return
    this.noise(0.3, 0.5, 1200, 140)
    this.tone(90, 0.3, 'sine', 0.4, 40)
  }

  /** gathering a spell — rising shimmer */
  cast() {
    if (this.playFile('cast', 1, 0.04)) return
    this.tone(420, 0.18, 'triangle', 0.2, 760)
    this.noise(0.2, 0.12, 2400, 900)
  }

  /** the Great Ember — dark warm chord */
  ember() {
    if (this.playFile('ember', 1, 0.02)) return
    this.tone(330, 0.2, 'triangle', 0.24, 415)
    this.tone(554, 0.24, 'triangle', 0.22, undefined, 0.14)
    this.tone(166, 0.4, 'sine', 0.22, undefined, 0.05)
  }

  /* ---- boss death finales ---- */

  /** the knight's body bursts into voxels — deep thud + airy soul shimmer rising */
  soulCollapse() {
    if (this.playFile('soul_collapse', 1, 0.03)) return
    this.noise(0.4, 0.5, 700, 90)
    this.tone(70, 0.5, 'sine', 0.5, 30)
    ;[523, 659, 784, 1046, 1318].forEach((f, i) =>
      this.tone(f, 0.34, 'triangle', 0.12, undefined, 0.18 + i * 0.1)
    )
    this.noise(0.9, 0.1, 2600, 5200, 0.15)
  }

  /** the Flame King combusts — massive whoosh, deep boom, crackling fade */
  inferno() {
    if (this.playFile('inferno', 1, 0.03)) return
    this.noise(0.9, 0.6, 1600, 160)
    this.tone(64, 0.8, 'sine', 0.55, 24)
    this.noise(0.25, 0.4, 4200, 900, 0.02)
    this.tone(120, 0.7, 'sawtooth', 0.14, 55, 0.1)
    this.noise(1.4, 0.14, 900, 240, 0.35)
  }
}
