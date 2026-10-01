/* DarkCraft audio engine — real sampled sounds (CC0), layered composites,
   positional panning, crossfading music and zone ambience.
   All sample files live under /public/sounds (see public/sounds/CREDITS.md). */

type VecLike = { x: number; z: number }

interface PlayOpts {
  vol?: number
  rate?: number
  delay?: number
  /** lowpass cutoff in Hz */
  lowpass?: number
  /** world position — attenuates + pans relative to the listener */
  at?: VecLike | null
}

interface LoadedTrack {
  gain: GainNode
  src: AudioBufferSourceNode | null
}

export class Sfx {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private sfxBus: GainNode | null = null
  private musicBus: GainNode | null = null
  private ambBus: GainNode | null = null
  private muted = false
  private volume = 0.8

  /** decoded pools — key → one or more variations */
  private buffers = new Map<string, AudioBuffer[]>()
  private loadStarted = false
  private loadDone = false
  private loadFailed = false

  /** listener state (player position + camera yaw), fed from the game loop */
  private lx = 0
  private lz = 0
  private lyaw = 0

  /* ---- music ---- */
  private musicCurrent: string | null = null
  private musicTracks = new Map<string, LoadedTrack>()
  private ducked = false

  /* ---- ambience loops ---- */
  private ambWind: LoadedTrack | null = null
  private ambFire: LoadedTrack | null = null
  private ambDungeon: LoadedTrack | null = null

  /* ============ plumbing ============ */

  setVolume(v: number) {
    this.volume = Math.max(0, Math.min(1, v))
    this.muted = this.volume <= 0.001
    if (this.master) this.master.gain.value = this.volume
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
        this.master.gain.value = this.volume
        this.master.connect(this.ctx.destination)

        this.sfxBus = this.ctx.createGain()
        this.sfxBus.gain.value = 0.9
        this.sfxBus.connect(this.master)

        this.musicBus = this.ctx.createGain()
        this.musicBus.gain.value = this.ducked ? 0.22 : 0.8
        this.musicBus.connect(this.master)

        this.ambBus = this.ctx.createGain()
        this.ambBus.gain.value = 0.9
        this.ambBus.connect(this.master)
      }
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {})
      return this.ctx
    } catch {
      return null
    }
  }

  resume() {
    const ctx = this.ensure()
    if (ctx && !this.loadStarted) this.startLoad()
  }

  /** called every frame by the game — keeps positional audio honest */
  setListener(x: number, z: number, yaw: number) {
    this.lx = x
    this.lz = z
    this.lyaw = yaw
  }

  /** menus/pauses duck the music instead of killing it */
  duck(on: boolean) {
    this.ducked = on
    if (this.musicBus && this.ctx) {
      this.musicBus.gain.setTargetAtTime(on ? 0.2 : 0.8, this.ctx.currentTime, 0.25)
    }
  }

  /* ============ loading ============ */

  private static FILES: string[] = [
    // combat
    'swing_1','swing_2','swing_3','swing_4','swing_5',
    'clash_1','clash_2','clash_3','clash_4',
    'swish_1','swish_2','swish_3','swish_4',
    'thump_1','thump_2','thump_3','thump_4',
    'metal_1','metal_2','metal_3','chain_1','chain_2','metalring',
    'hurt_1','hurt_2','shade_1','shade_2','shade_3',
    'bones_1','bones_2','bones_3','bones_4','bones_5',
    'wood_1','wood_2','wood_3',
    // monsters
    'roar_1','roar_2','roar_3','roar_4','roar_5','roar_6',
    'roar_deep_1','roar_deep_2','roar_deep_3','roar_deep_4','roar_deep_5',
    'roar_boss','monster_1','monster_2','monster_3','monster_4','giant_1','giant_2',
    // items / ui
    'gem_1','gem_2','gem_3','gem_4','coin_1','coin_2','coin_3',
    'potion','bubble','spell_1','spell_2',
    'fire_1','fire_2','fire_4','fire_5','firebig_1','firebig_2',
    'interface_1','interface_2','interface_3','interface_4','interface_5','interface_6',
    'unsheathe','bonfire_lit',
    // footsteps
    'step_cloth_1','step_cloth_2','step_cloth_3','step_cloth_4',
    'step_leather_1','step_leather_2','step_leather_3','step_leather_4',
    'step_metal_1','step_metal_2','step_metal_3','step_metal_4',
  ]

  private async startLoad() {
    this.loadStarted = true
    const ctx = this.ensure()
    if (!ctx) {
      this.loadStarted = false
      return
    }
    try {
      const names = Sfx.FILES
      const results = await Promise.allSettled(
        names.map(async (n) => {
          const res = await fetch(`/sounds/sfx/${n}.ogg`)
          if (!res.ok) throw new Error(n)
          const buf = await ctx.decodeAudioData(await res.arrayBuffer())
          return { n, buf }
        })
      )
      for (const r of results) {
        if (r.status === 'fulfilled') {
          const arr = this.buffers.get(r.value.n)
          if (arr) arr.push(r.value.buf)
          else this.buffers.set(r.value.n, [r.value.buf])
        }
      }
      // music + ambience
      await this.loadLoop('music', 'explore', '/sounds/music/explore.ogg')
      await this.loadLoop('music', 'dread', '/sounds/music/dread.ogg')
      await this.loadLoop('music', 'boss', '/sounds/music/boss.ogg')
      this.ambWind = await this.loadLoop('amb', 'wind', '/sounds/amb/wind_loop.ogg')
      this.ambFire = await this.loadLoop('amb', 'fire', '/sounds/amb/fire_loop.ogg')
      this.ambDungeon = await this.loadLoop('amb', 'dungeon', '/sounds/amb/dungeon_loop.ogg')
      // the wind loop doubles as the one-shot hiss source (creeper fuse)
      const windBuf = this.loopBufs.get('wind')
      if (windBuf) this.buffers.set('wind', [windBuf])
      this.loadDone = true
      // menu may already be waiting for the soundtrack
      if (this.musicCurrent) this.swapMusic(this.musicCurrent)
    } catch {
      this.loadFailed = true
    }
  }

  private async loadLoop(
    bus: 'music' | 'amb',
    key: string,
    url: string
  ): Promise<LoadedTrack | null> {
    const ctx = this.ctx
    if (!ctx) return null
    try {
      const res = await fetch(url)
      if (!res.ok) return null
      const buf = await ctx.decodeAudioData(await res.arrayBuffer())
      const gain = ctx.createGain()
      gain.gain.value = 0
      gain.connect(bus === 'music' ? this.musicBus! : this.ambBus!)
      this.loopBufs.set(key, buf)
      const track: LoadedTrack = { gain, src: null }
      if (bus === 'music') this.musicTracks.set(key, track)
      return track
    } catch {
      return null
    }
  }

  private loopBufs = new Map<string, AudioBuffer>()

  /* ============ one-shot engine ============ */

  /** deterministic-ish rng for variation */
  private pick<T>(a: T[]): T {
    return a[(Math.random() * a.length) | 0]
  }

  private buf(name: string): AudioBuffer | null {
    const arr = this.buffers.get(name)
    if (!arr || arr.length === 0) return null
    return this.pick(arr)
  }

  private computeAt(at: VecLike): { vol: number; pan: number } {
    const dx = at.x - this.lx
    const dz = at.z - this.lz
    const d = Math.hypot(dx, dz)
    // distance falloff — half volume at ~14 blocks
    const vol = Math.max(0.04, Math.pow(0.5, d / 14))
    // stereo pan: project the direction onto the camera-right vector
    const fx = -Math.sin(this.lyaw)
    const fz = -Math.cos(this.lyaw)
    const rx = -fz
    const rz = fx
    const len = Math.max(0.001, d)
    const pan = Math.max(-1, Math.min(1, ((dx / len) * rx + (dz / len) * rz) * 0.85))
    return { vol, pan }
  }

  private play(name: string, opts: PlayOpts = {}) {
    if (!this.loadDone || this.muted) return
    const ctx = this.ensure()
    if (!ctx || !this.sfxBus) return
    const buffer = this.buf(name)
    if (!buffer) return

    let vol = opts.vol ?? 1
    let pan = 0
    if (opts.at) {
      const { vol: av, pan: ap } = this.computeAt(opts.at)
      vol *= av
      pan = ap
    }
    if (vol <= 0.005) return

    try {
      const t0 = ctx.currentTime + (opts.delay ?? 0)
      const src = ctx.createBufferSource()
      src.buffer = buffer
      src.playbackRate.value = opts.rate ?? 1
      const g = ctx.createGain()
      g.gain.value = vol
      let head: AudioNode = src
      if (opts.lowpass) {
        const f = ctx.createBiquadFilter()
        f.type = 'lowpass'
        f.frequency.value = opts.lowpass
        src.connect(f)
        head = f
      }
      head.connect(g)
      if (pan !== 0 && ctx.createStereoPanner) {
        const p = ctx.createStereoPanner()
        p.pan.value = pan
        g.connect(p)
        p.connect(this.sfxBus)
      } else {
        g.connect(this.sfxBus)
      }
      src.start(t0)
    } catch {
      /* ignore */
    }
  }

  /** random rate within a range */
  private jitter(base: number, spread: number): number {
    return base + (Math.random() * 2 - 1) * spread
  }

  /* ============ game sound API ============ */

  swing() {
    this.play(this.pick(['swing_1', 'swing_2', 'swing_3', 'swing_4', 'swing_5']), {
      vol: 0.8,
      rate: this.jitter(1.0, 0.09),
    })
  }

  hit(at?: VecLike) {
    this.play(this.pick(['clash_1', 'clash_2', 'clash_3', 'clash_4']), {
      vol: 0.85,
      rate: this.jitter(0.9, 0.08),
      at,
    })
    this.play(this.pick(['thump_1', 'thump_2', 'thump_3']), {
      vol: 0.75,
      rate: this.jitter(0.55, 0.05),
      at,
    })
  }

  heavy(at?: VecLike) {
    this.play(this.pick(['thump_1', 'thump_2', 'thump_3', 'thump_4']), {
      vol: 1,
      rate: this.jitter(0.5, 0.05),
      at,
    })
    this.play(this.pick(['clash_1', 'clash_2', 'clash_3']), {
      vol: 0.65,
      rate: this.jitter(0.68, 0.06),
      at,
      delay: 0.01,
    })
    this.play(this.pick(['swish_1', 'swish_4']), { vol: 0.3, rate: 0.8, at })
  }

  block(at?: VecLike) {
    this.play(this.pick(['clash_1', 'clash_2', 'clash_3', 'clash_4']), {
      vol: 0.8,
      rate: this.jitter(1.25, 0.1),
      at,
    })
  }

  guardBreak() {
    this.play(this.pick(['metal_1', 'metal_2', 'metal_3']), { vol: 0.9, rate: this.jitter(0.85, 0.06) })
    this.play(this.pick(['thump_1', 'thump_2']), { vol: 0.7, rate: 0.6, delay: 0.02 })
    this.play(this.pick(['clash_1', 'clash_2']), { vol: 0.4, rate: 1.4, delay: 0.04 })
  }

  hurt(at?: VecLike) {
    this.play(this.pick(['hurt_1', 'hurt_2']), {
      vol: 0.85,
      rate: this.jitter(0.9, 0.12),
      at,
    })
  }

  roll() {
    this.play(this.pick(['swish_1', 'swish_2', 'swish_3']), {
      vol: 0.55,
      rate: this.jitter(1.1, 0.12),
    })
  }

  death() {
    this.play(this.pick(['shade_1', 'shade_2', 'shade_3']), { vol: 0.85, rate: 0.7 })
    this.play(this.pick(['thump_1', 'thump_2', 'thump_3']), { vol: 0.9, rate: 0.45, delay: 0.06 })
  }

  heal() {
    this.play('potion', { vol: 0.9, rate: this.jitter(1.0, 0.05) })
    this.play('bubble', { vol: 0.55, rate: this.jitter(1.1, 0.1), delay: 0.25 })
  }

  souls() {
    this.play(this.pick(['gem_1', 'gem_2', 'gem_3', 'gem_4']), {
      vol: 0.55,
      rate: this.jitter(1.05, 0.15),
    })
  }

  levelUp() {
    this.play('spell_1', { vol: 0.8, rate: 1.0 })
    this.play('gem_1', { vol: 0.6, rate: 1.2, delay: 0.12 })
    this.play('gem_3', { vol: 0.6, rate: 1.35, delay: 0.24 })
    this.play('metalring', { vol: 0.35, rate: 1.0, delay: 0.05 })
  }

  shard() {
    this.play(this.pick(['gem_2', 'gem_3', 'gem_4']), { vol: 0.75, rate: this.jitter(1.3, 0.08) })
    this.play('potion', { vol: 0.45, rate: 1.2, delay: 0.06 })
  }

  bonfire() {
    this.play('bonfire_lit', { vol: 0.95 })
  }

  bossRoar(at?: VecLike) {
    this.play(
      this.pick([
        'roar_1','roar_2','roar_3','roar_4','roar_5','roar_6',
        'roar_boss','monster_1','monster_2','monster_3','monster_4',
        'giant_1','giant_2',
      ]),
      { vol: 1, rate: this.jitter(1.0, 0.08), at }
    )
  }

  phaseRoar(at?: VecLike) {
    this.play(this.pick(['roar_deep_1', 'roar_deep_2', 'roar_deep_3', 'roar_deep_4', 'roar_deep_5']), {
      vol: 1,
      rate: this.jitter(0.95, 0.06),
      at,
    })
    this.play(this.pick(['monster_1', 'monster_4']), { vol: 0.5, rate: 0.8, delay: 0.06, at })
  }

  victory() {
    this.play('interface_5', { vol: 0.6 })
    this.play('gem_1', { vol: 0.6, rate: 1.0, delay: 0.05 })
    this.play('gem_2', { vol: 0.6, rate: 1.26, delay: 0.19 })
    this.play('gem_3', { vol: 0.6, rate: 1.5, delay: 0.33 })
    this.play('gem_4', { vol: 0.7, rate: 2.0, delay: 0.47 })
    this.play('metalring', { vol: 0.45, rate: 0.9, delay: 0.6 })
  }

  stomp(at?: VecLike) {
    this.play(this.pick(['thump_1', 'thump_2', 'thump_4']), {
      vol: 1,
      rate: this.jitter(0.5, 0.05),
      at,
    })
    this.play('swish_2', { vol: 0.3, rate: 0.7, at })
  }

  stagger(at?: VecLike) {
    this.play(this.pick(['metal_1', 'metal_2', 'metal_3']), {
      vol: 0.9,
      rate: this.jitter(0.8, 0.05),
      at,
    })
    this.play(this.pick(['chain_1', 'chain_2']), { vol: 0.55, rate: 1.0, delay: 0.05, at })
  }

  dash(at?: VecLike) {
    this.play(this.pick(['swish_1', 'swish_3', 'swish_4']), {
      vol: 0.75,
      rate: this.jitter(0.9, 0.08),
      at,
    })
  }

  hiss(at?: VecLike) {
    // creeper fuse — a long airy hiss (the wind loop pitched up, filtered)
    this.play('wind', { vol: 0.8, rate: 2.3, lowpass: 3400, at })
  }

  boom(at?: VecLike) {
    this.play(this.pick(['thump_1', 'thump_2', 'thump_3']), {
      vol: 1,
      rate: this.jitter(0.45, 0.04),
      at,
    })
    this.play(this.pick(['firebig_1', 'firebig_2']), {
      vol: 0.85,
      rate: this.jitter(0.9, 0.06),
      at,
      delay: 0.02,
    })
  }

  arrowShoot(at?: VecLike) {
    this.play(this.pick(['swish_1', 'swish_2']), {
      vol: 0.6,
      rate: this.jitter(1.55, 0.12),
      at,
    })
  }

  arrowHit(at?: VecLike) {
    this.play(this.pick(['wood_1', 'wood_2', 'wood_3']), {
      vol: 0.85,
      rate: this.jitter(1.05, 0.1),
      at,
    })
    this.play('thump_2', { vol: 0.35, rate: 0.8, at })
  }

  arrowBlock(at?: VecLike) {
    this.play(this.pick(['clash_1', 'clash_3']), {
      vol: 0.7,
      rate: this.jitter(1.5, 0.08),
      at,
    })
  }

  fireShoot(at?: VecLike) {
    this.play(this.pick(['fire_1', 'fire_2', 'fire_4', 'fire_5']), {
      vol: 0.8,
      rate: this.jitter(1.0, 0.09),
      at,
    })
  }

  fireBoom(at?: VecLike) {
    this.play(this.pick(['firebig_1', 'firebig_2']), {
      vol: 0.95,
      rate: this.jitter(0.9, 0.07),
      at,
    })
    this.play(this.pick(['thump_1', 'thump_2']), {
      vol: 0.75,
      rate: this.jitter(0.55, 0.05),
      at,
      delay: 0.03,
    })
  }

  cast() {
    this.play(this.pick(['spell_1', 'spell_2']), { vol: 0.7, rate: this.jitter(1.1, 0.06) })
    this.play('swish_2', { vol: 0.3, rate: 1.4 })
  }

  ember() {
    this.play(this.pick(['gem_1', 'gem_2']), { vol: 0.8, rate: 0.9 })
    this.play('spell_2', { vol: 0.6, rate: 0.85, delay: 0.05 })
  }

  soulCollapse(at?: VecLike) {
    this.play(this.pick(['shade_1', 'shade_2', 'shade_3']), { vol: 0.8, rate: 0.6, at })
    this.play('thump_1', { vol: 1, rate: 0.42, delay: 0.04, at })
    // souls streaming upward — a rising cascade
    for (let i = 0; i < 5; i++) {
      this.play(this.pick(['gem_1', 'gem_2', 'gem_3', 'gem_4']), {
        vol: 0.5,
        rate: 1.1 + i * 0.12,
        delay: 0.35 + i * 0.13,
        at,
      })
    }
  }

  inferno(at?: VecLike) {
    this.play('firebig_1', { vol: 1, rate: 0.7, at })
    this.play('firebig_2', { vol: 0.8, rate: 0.95, delay: 0.14, at })
    this.play('thump_1', { vol: 0.9, rate: 0.4, delay: 0.05, at })
    this.play(this.pick(['roar_deep_2', 'roar_deep_4']), { vol: 0.5, rate: 0.8, delay: 0.18, at })
    for (let i = 0; i < 4; i++) {
      this.play(this.pick(['fire_1', 'fire_2', 'fire_4', 'fire_5']), {
        vol: 0.4,
        rate: 1.3 + i * 0.15,
        delay: 0.5 + i * 0.16,
        at,
      })
    }
  }

  /* ---- new capabilities ---- */

  /** player footsteps — mat: grass/soft ground, stone, or metal */
  footstep(mat: 'soft' | 'stone' | 'metal', sprint: boolean) {
    const pool =
      mat === 'soft'
        ? ['step_cloth_1', 'step_cloth_2', 'step_cloth_3', 'step_cloth_4']
        : mat === 'metal'
          ? ['step_metal_1', 'step_metal_2', 'step_metal_3', 'step_metal_4']
          : ['step_leather_1', 'step_leather_2', 'step_leather_3', 'step_leather_4']
    this.play(this.pick(pool), {
      vol: sprint ? 0.5 : 0.36,
      rate: this.jitter(sprint ? 1.05 : 1.0, 0.08),
    })
  }

  /** skeleton rattle — used when bones enemies move/turn */
  bones(at?: VecLike) {
    this.play(this.pick(['bones_1', 'bones_2', 'bones_3', 'bones_4', 'bones_5']), {
      vol: 0.7,
      rate: this.jitter(1.0, 0.15),
      at,
    })
  }

  /** weapon drawn / equipped */
  unsheathe() {
    this.play('unsheathe', { vol: 0.7, rate: this.jitter(1.0, 0.06) })
  }

  /** coin jingle — merchant transactions */
  coin() {
    this.play(this.pick(['coin_1', 'coin_2', 'coin_3']), {
      vol: 0.7,
      rate: this.jitter(1.0, 0.1),
    })
  }

  /** menu/UI click */
  click() {
    this.play(this.pick(['interface_1', 'interface_2', 'interface_3', 'interface_4', 'interface_6']), {
      vol: 0.4,
      rate: this.jitter(1.0, 0.05),
    })
  }

  /* ============ music ============ */

  /** switch the soundtrack — crossfades between explore / dread / boss / off */
  setMusic(mode: 'explore' | 'dread' | 'boss' | 'off') {
    if (this.musicCurrent === mode) return
    this.musicCurrent = mode
    if (!this.loadDone) return // swapMusic runs when loading finishes
    this.swapMusic(mode)
  }

  private swapMusic(mode: string) {
    const ctx = this.ctx
    if (!ctx || !this.musicBus) return
    const t = ctx.currentTime
    const VOLS: Record<string, number> = { explore: 0.42, dread: 0.5, boss: 0.72 }
    for (const [key, track] of this.musicTracks) {
      const target = key === mode ? (VOLS[key] ?? 0.5) : 0
      track.gain.gain.setTargetAtTime(target, t, key === mode ? 0.8 : 0.45)
      if (key === mode && !track.src && this.loopBufs.has(key)) {
        const src = ctx.createBufferSource()
        src.buffer = this.loopBufs.get(key)!
        src.loop = true
        src.connect(track.gain)
        src.start(t)
        track.src = src
      }
      if (target === 0 && track.src) {
        const old = track.src
        track.src = null
        window.setTimeout(() => {
          try {
            old.stop()
          } catch {
            /* already stopped */
          }
        }, 2500)
      }
    }
  }

  /* ============ ambience ============ */

  /** per-frame ambience mix — wind, bonfire crackle, dungeon air */
  setAmbience(wind: number, fire: number, dungeon: number) {
    if (!this.ctx) return
    const t = this.ctx.currentTime
    this.ambWind?.gain.gain.setTargetAtTime(wind, t, 0.6)
    this.ambFire?.gain.gain.setTargetAtTime(fire, t, 0.4)
    this.ambDungeon?.gain.gain.setTargetAtTime(dungeon, t, 0.6)
  }

  /** true once every sample is decoded — the HUD may show a tiny loader */
  get ready(): boolean {
    return this.loadDone
  }

  get failed(): boolean {
    return this.loadFailed
  }
}
