import * as THREE from 'three'
import { Engine } from './engine'
import { World, BONFIRE, GATE_Z, BOSS_CENTER, WORLD_HALF, ASH_WALL_X, GATE2, BOSS2_CENTER, PYRO_ITEM, LAVA_POOLS } from './world'
import { Player } from './player'
import { Enemy, BossEnemy, CreeperEnemy, SkeletonEnemy, WitherSkeletonEnemy, BlazeEnemy, BossFlameEnemy } from './enemy'
import { createSword } from './models'
import { Sfx } from './sfx'
import type { PlayerStrikeDef } from './player'

/* ================= HUD STATE ================= */

export type Phase = 'menu' | 'playing' | 'dead' | 'rest'

export interface HudState {
  phase: Phase
  hp: number
  maxHp: number
  st: number
  maxSt: number
  souls: number
  level: number
  estus: number
  maxEstus: number
  vit: number
  end: number
  str: number
  nextCost: number
  bossName: string | null
  bossHp: number
  bossMax: number
  prompt: string | null
  banner: 'died' | 'bossfell' | 'bossfell2' | null
  blocking: boolean
  pyro: number
  maxPyro: number
  pyroUnlocked: boolean
}

export interface SaveData {
  souls: number
  level: number
  vit: number
  end: number
  str: number
  estusUp?: boolean
  pyro?: boolean
  ember?: boolean
}

const SAVE_KEY = 'minesouls_v1'

/* ================= PARTICLES / EFFECTS ================= */

class Burst {
  points: THREE.Points
  private vel: Float32Array
  private t = 0
  private life: number

  constructor(scene: THREE.Scene, pos: THREE.Vector3, color: number, count = 14, speed = 3, life = 0.7, size = 0.14) {
    this.life = life
    const positions = new Float32Array(count * 3)
    this.vel = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      positions[i * 3] = pos.x
      positions[i * 3 + 1] = pos.y
      positions[i * 3 + 2] = pos.z
      const a = Math.random() * Math.PI * 2
      const s = speed * (0.4 + Math.random() * 0.6)
      this.vel[i * 3] = Math.cos(a) * s
      this.vel[i * 3 + 1] = 1.5 + Math.random() * 2.5
      this.vel[i * 3 + 2] = Math.sin(a) * s
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    const mat = new THREE.PointsMaterial({
      color, size, transparent: true, opacity: 1, depthWrite: false,
    })
    this.points = new THREE.Points(geo, mat)
    scene.add(this.points)
  }

  update(dt: number, scene: THREE.Scene): boolean {
    this.t += dt
    const pos = this.points.geometry.getAttribute('position') as THREE.BufferAttribute
    for (let i = 0; i < pos.count; i++) {
      pos.setXYZ(
        i,
        pos.getX(i) + this.vel[i * 3] * dt,
        pos.getY(i) + this.vel[i * 3 + 1] * dt,
        pos.getZ(i) + this.vel[i * 3 + 2] * dt
      )
      this.vel[i * 3 + 1] -= 5 * dt
    }
    pos.needsUpdate = true
    const mat = this.points.material as THREE.PointsMaterial
    mat.opacity = Math.max(0, 1 - this.t / this.life)
    if (this.t >= this.life) {
      scene.remove(this.points)
      this.points.geometry.dispose()
      mat.dispose()
      return false
    }
    return true
  }
}

class FloatText {
  sprite: THREE.Sprite
  t = 0

  constructor(text: string, color: string, pos: THREE.Vector3) {
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 96
    const ctx = canvas.getContext('2d')!
    ctx.font = 'bold 54px monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.lineWidth = 10
    ctx.strokeStyle = 'rgba(0,0,0,0.9)'
    ctx.strokeText(text, 128, 48)
    ctx.fillStyle = color
    ctx.fillText(text, 128, 48)
    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false })
    this.sprite = new THREE.Sprite(mat)
    this.sprite.scale.set(2.4, 0.9, 1)
    this.sprite.position.copy(pos)
  }

  update(dt: number, scene: THREE.Scene): boolean {
    this.t += dt
    this.sprite.position.y += dt * 1.4
    const mat = this.sprite.material as THREE.SpriteMaterial
    mat.opacity = Math.max(0, 1 - this.t / 1.1)
    if (this.t >= 1.1) {
      scene.remove(this.sprite)
      mat.map?.dispose()
      mat.dispose()
      return false
    }
    return true
  }
}

interface SoulOrb {
  mesh: THREE.Mesh
  t: number
  amount: number
  from: THREE.Vector3
}

/* Expanding ground ring from boss slams/stomps — chips the player when
   the wavefront passes under their feet (rolls/blocks still work). */
class Shockwave {
  private mesh: THREE.Mesh
  private t = 0
  private hit = false
  private dur: number

  constructor(
    private game: Game,
    private pos: THREE.Vector3,
    private maxR: number,
    private dmg: number,
    color = 0xd8c090
  ) {
    this.dur = 0.42 + maxR * 0.035
    const geo = new THREE.RingGeometry(0.82, 1, 36)
    this.mesh = new THREE.Mesh(
      geo,
      new THREE.MeshBasicMaterial({
        color, transparent: true, opacity: 0.9,
        side: THREE.DoubleSide, depthWrite: false,
      })
    )
    this.mesh.rotation.x = -Math.PI / 2
    this.mesh.position.set(pos.x, pos.y + 0.14, pos.z)
    game.engine.scene.add(this.mesh)
  }

  update(dt: number): boolean {
    this.t += dt / this.dur
    const prevR = 0.5 + Math.max(0, this.t - dt / this.dur) * this.maxR
    const r = 0.5 + this.t * this.maxR
    this.mesh.scale.setScalar(r)
    const m = this.mesh.material as THREE.MeshBasicMaterial
    m.opacity = Math.max(0, 0.9 * (1 - this.t))
    if (!this.hit && this.t > 0.04) {
      const p = this.game.player
      const d = Math.hypot(p.pos.x - this.pos.x, p.pos.z - this.pos.z)
      if (d >= prevR - 0.5 && d <= r + 0.5) {
        this.hit = true
        if (p.takeDamage(this.dmg, this.pos.x, this.pos.z, this.game)) this.game.onPlayerHit(this.dmg)
      }
    }
    if (this.t >= 1) {
      this.game.engine.scene.remove(this.mesh)
      ;(this.mesh.material as THREE.MeshBasicMaterial).dispose()
      this.mesh.geometry.dispose()
      return false
    }
    return true
  }
}

/* Skeleton arrows — flat blocky projectile, blockable from the front,
   fully dodgeable with roll i-frames, sticks into the ground briefly. */
class Arrow {
  private mesh: THREE.Group
  private vel = new THREE.Vector3()
  private t = 0
  private stuck = false
  private stuckT = 0

  constructor(
    private game: Game,
    private pos: THREE.Vector3,
    target: THREE.Vector3,
    private dmg: number
  ) {
    const g = new THREE.Group()
    const lam = (c: number) => new THREE.MeshLambertMaterial({ color: c })
    const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.6), lam(0x9a7a4a))
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.14), lam(0xb8bec8))
    tip.position.z = 0.34
    const fl1 = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.17, 0.13), lam(0xe8e4d8))
    fl1.position.z = -0.25
    const fl2 = fl1.clone()
    fl2.rotation.z = Math.PI / 2
    g.add(shaft, tip, fl1, fl2)
    g.position.copy(pos)
    game.engine.scene.add(g)
    this.mesh = g
    // flat-ish shot with a loft so it arcs gently over small bumps
    this.vel.subVectors(target, pos)
    const dist = this.vel.length()
    this.vel.normalize().multiplyScalar(15.5)
    this.vel.y += dist * 0.42
  }

  update(dt: number): boolean {
    if (this.stuck) {
      this.stuckT += dt
      return this.stuckT < 1.3
    }
    this.t += dt
    this.vel.y -= 6.5 * dt
    this.pos.addScaledVector(this.vel, dt)
    this.mesh.position.copy(this.pos)
    this.mesh.lookAt(this.pos.x + this.vel.x, this.pos.y + this.vel.y, this.pos.z + this.vel.z)

    // the great ash wall stops arrows outside the gate corridor
    if (Math.abs(this.pos.x - ASH_WALL_X) < 0.4 && !(this.pos.z > 15.9 && this.pos.z < 20.1)) {
      this.stuck = true
      return true
    }

    // ground impact — stick in with a dust puff
    const ground = this.game.world.surfaceAt(this.pos.x, this.pos.z)
    if (this.pos.y <= ground + 0.06) {
      this.stuck = true
      this.game.spawnBurst(this.pos.clone(), 0x9a8b70, 5, 1.5, 0.4, 0.1)
      return true
    }
    if (this.t > 3.2 || Math.abs(this.pos.x) > 29 || Math.abs(this.pos.z) > 29) return false

    // player hit — torso capsule approx
    const p = this.game.player
    const hy = Math.max(p.pos.y + 0.25, Math.min(p.pos.y + 1.85, this.pos.y))
    const d2 =
      (this.pos.x - p.pos.x) ** 2 + (this.pos.z - p.pos.z) ** 2 + (this.pos.y - hy) ** 2
    if (d2 < 0.55 * 0.55) {
      const vl = Math.hypot(this.vel.x, this.vel.z) || 1
      const fromX = this.pos.x - (this.vel.x / vl) * 1.5
      const fromZ = this.pos.z - (this.vel.z / vl) * 1.5
      const wasBlocking = p.state === 'block'
      if (p.takeDamage(this.dmg, fromX, fromZ, this.game)) {
        this.game.onPlayerHit(this.dmg)
        this.game.sfx.arrowHit()
      } else if (wasBlocking) {
        this.game.onArrowBlocked()
      }
      if (p.state !== 'block') this.stuck = true
      return true
    }
    return true
  }

  dispose(scene: THREE.Scene) {
    scene.remove(this.mesh)
    this.mesh.traverse((o) => {
      const m = o as THREE.Mesh
      if (m.geometry) m.geometry.dispose()
    })
  }
}

/* Fireballs — pyromancy bolts. Friendly ones (the player's) explode on the
   first enemy they graze with splash damage; hostile ones are blockable and
   roll-dodgeable like arrows. Both burn out on the ground or the ash wall. */
class Fireball {
  private mesh: THREE.Group
  private vel = new THREE.Vector3()
  private t = 0
  private trailT = 0
  private done = false

  constructor(
    private game: Game,
    private pos: THREE.Vector3,
    target: THREE.Vector3,
    private dmg: number,
    private friendly: boolean
  ) {
    const g = new THREE.Group()
    const core = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.24, 0.24),
      new THREE.MeshBasicMaterial({ color: 0xffd23d })
    )
    const mid = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 0.4, 0.4),
      new THREE.MeshBasicMaterial({ color: 0xff8a1e, transparent: true, opacity: 0.5, depthWrite: false })
    )
    const out = new THREE.Mesh(
      new THREE.BoxGeometry(0.62, 0.62, 0.62),
      new THREE.MeshBasicMaterial({ color: 0xff5a10, transparent: true, opacity: 0.22, depthWrite: false })
    )
    g.add(out, mid, core)
    g.position.copy(pos)
    game.engine.scene.add(g)
    this.mesh = g
    this.vel.subVectors(target, pos)
    const dist = this.vel.length()
    this.vel.normalize().multiplyScalar(14)
    // a gentle loft so bolts crest the blocky terrain instead of
    // detonating on the first hill between caster and target
    this.vel.y += Math.max(0, target.y - pos.y) * 0.5 + dist * 0.1
    if (!friendly) this.vel.y += 0.6
  }

  update(dt: number): boolean {
    if (this.done) return false
    this.t += dt
    this.vel.y -= 4.5 * dt // light gravity so the loft arcs over and comes down
    this.pos.addScaledVector(this.vel, dt)
    this.mesh.position.copy(this.pos)
    this.mesh.rotation.y += dt * 9
    this.trailT -= dt
    if (this.trailT <= 0) {
      this.trailT = 0.05
      this.game.spawnBurst(this.pos.clone(), 0xff8a2a, 1, 0.3, 0.35, 0.09)
    }

    // the great ash wall burns them out outside the corridor
    if (Math.abs(this.pos.x - ASH_WALL_X) < 0.45 && !(this.pos.z > 15.9 && this.pos.z < 20.1)) {
      this.explode(null)
      return false
    }

    const ground = this.game.world.surfaceAt(this.pos.x, this.pos.z) + 0.18
    if (this.pos.y <= ground || this.t > 3) {
      this.explode(null)
      return false
    }

    if (this.friendly) {
      for (const e of this.game.allEnemies) {
        if (!e.alive) continue
        const dx = e.pos.x - this.pos.x
        const dz = e.pos.z - this.pos.z
        const reach = e.isBoss ? 1.5 : 0.85
        const topY = e.isBoss ? 4.4 : 2.6
        if (dx * dx + dz * dz < reach * reach && this.pos.y < e.pos.y + topY) {
          this.explode(e)
          return false
        }
      }
    } else {
      const p = this.game.player
      const hy = Math.max(p.pos.y + 0.2, Math.min(p.pos.y + 1.9, this.pos.y))
      const d2 =
        (this.pos.x - p.pos.x) ** 2 + (this.pos.z - p.pos.z) ** 2 + (this.pos.y - hy) ** 2
      if (d2 < 0.6 * 0.6) {
        const vl = Math.hypot(this.vel.x, this.vel.z) || 1
        const wasBlocking = p.state === 'block'
        if (p.takeDamage(this.dmg, this.pos.x - (this.vel.x / vl) * 1.2, this.pos.z - (this.vel.z / vl) * 1.2, this.game)) {
          this.game.onPlayerHit(this.dmg)
        } else if (wasBlocking) {
          this.game.onArrowBlocked()
        }
        this.explode(null)
        return false
      }
    }
    return true
  }

  private explode(primary: Enemy | null) {
    this.done = true
    this.game.onFireballBoom(this.pos, this.friendly)
    if (this.friendly) {
      if (primary) primary.takeDamage(this.dmg, this.game, this.pos.x, this.pos.z)
      for (const e of this.game.allEnemies) {
        if (!e.alive || e === primary) continue
        const d = Math.hypot(e.pos.x - this.pos.x, e.pos.z - this.pos.z)
        if (d < 2.2) e.takeDamage(Math.max(1, Math.round(this.dmg * 0.45)), this.game, this.pos.x, this.pos.z)
      }
    }
  }

  dispose(scene: THREE.Scene) {
    scene.remove(this.mesh)
    this.mesh.traverse((o) => {
      const m = o as THREE.Mesh
      if (m.geometry) m.geometry.dispose()
    })
  }
}

/* ================= GAME ================= */

export class Game {
  engine: Engine
  world: World
  player: Player
  sfx = new Sfx()
  enemies: Enemy[] = []
  boss: BossEnemy
  boss2: BossFlameEnemy
  phase: Phase = 'menu'
  onState?: (s: HudState) => void

  private spawns: THREE.Vector3[] = []
  private camYaw = Math.PI
  private camPitch = 0.42
  private camDist = 5.4
  private camDistTarget = 5.4
  private camPos = new THREE.Vector3()
  private camTarget = new THREE.Vector3()
  private shake = 0
  private hitstop = 0
  private hurtFlash = 0
  private deadT = 0
  private bannerT = 0
  private banner: 'died' | 'bossfell' | 'bossfell2' | null = null
  private prompt: string | null = null
  private fogPassT = 0
  private fogPass2T = 0
  private bossActive = false
  private bossFell = false
  private boss2Active = false
  private boss2Fell = false
  private lockLastMove = 0

  private bursts: Burst[] = []
  private texts: FloatText[] = []
  private orbs: SoulOrb[] = []
  private waves: Shockwave[] = []
  private arrows: Arrow[] = []
  private fireballs: Fireball[] = []
  private lavaPools: { mesh: THREE.Mesh; x: number; z: number; t: number }[] = []
  private lavaTick = 0
  private bloodstain: { mesh: THREE.Group; amount: number } | null = null
  private boomLights: { light: THREE.PointLight; t: number }[] = []
  private estusShard: { mesh: THREE.Group; light: THREE.PointLight } | null = null
  private estusUp = false
  private pyroItem: { mesh: THREE.Group; light: THREE.PointLight } | null = null
  private emberItem: { mesh: THREE.Group; light: THREE.PointLight } | null = null
  private pyroUnlocked = false
  private emberTaken = false
  private castFailT = -9
  private tmpColor = new THREE.Color()

  private reticle: HTMLDivElement
  private vignette: HTMLDivElement
  private mapCanvas: HTMLCanvasElement
  private mapCtx: CanvasRenderingContext2D
  private mapTerrain: HTMLCanvasElement
  private bonfireLight: THREE.PointLight
  private bonfireFlame: THREE.Points
  private flameSeeds: Float32Array
  private time = 0
  private sun: THREE.DirectionalLight
  private shadowTimer = 0

  private lastHudJson = ''

  constructor(private container: HTMLElement) {
    this.engine = new Engine(container)
    this.engine.onFrame = (dt) => this.loop(dt)
    ;(window as unknown as { __minesouls?: Game }).__minesouls = this

    // scene setup
    const scene = this.engine.scene
    scene.background = new THREE.Color(0x101720)
    scene.fog = new THREE.Fog(0x101720, 26, 78)

    const hemi = new THREE.HemisphereLight(0x38445c, 0x2a1c10, 0.75)
    scene.add(hemi)
    const sun = new THREE.DirectionalLight(0xffd9a0, 1.25)
    sun.position.set(28, 46, 18)
    sun.castShadow = true
    sun.shadow.mapSize.set(1024, 1024)
    sun.shadow.autoUpdate = false
    sun.shadow.needsUpdate = true
    this.sun = sun
    sun.shadow.camera.left = -42
    sun.shadow.camera.right = 42
    sun.shadow.camera.top = 42
    sun.shadow.camera.bottom = -42
    sun.shadow.camera.far = 130
    sun.shadow.bias = -0.0005
    scene.add(sun)

    this.world = new World()
    scene.add(this.world.group)

    // bonfire decor: stuck sword + light + flame particles
    const bY = this.world.surfaceAt(BONFIRE.x, BONFIRE.z)
    const fireSword = createSword(1.5)
    fireSword.position.set(BONFIRE.x, bY + 0.1, BONFIRE.z)
    fireSword.rotation.z = 0.16
    fireSword.rotation.x = 0.1
    scene.add(fireSword)

    this.bonfireLight = new THREE.PointLight(0xff8033, 3, 16, 1.6)
    this.bonfireLight.position.set(BONFIRE.x, bY + 1.4, BONFIRE.z)
    scene.add(this.bonfireLight)

    const flameCount = 30
    const flamePos = new Float32Array(flameCount * 3)
    const flameCol = new Float32Array(flameCount * 3)
    this.flameSeeds = new Float32Array(flameCount)
    for (let i = 0; i < flameCount; i++) {
      this.flameSeeds[i] = Math.random()
      flameCol[i * 3] = 1
      flameCol[i * 3 + 1] = 0.45 + Math.random() * 0.4
      flameCol[i * 3 + 2] = 0.1
    }
    const flameGeo = new THREE.BufferGeometry()
    flameGeo.setAttribute('position', new THREE.BufferAttribute(flamePos, 3))
    flameGeo.setAttribute('color', new THREE.BufferAttribute(flameCol, 3))
    this.bonfireFlame = new THREE.Points(
      flameGeo,
      new THREE.PointsMaterial({
        size: 0.16, vertexColors: true, transparent: true, opacity: 0.95,
        depthWrite: false, blending: THREE.AdditiveBlending,
      })
    )
    scene.add(this.bonfireFlame)

    // player
    this.player = new Player(scene)
    const spawn = new THREE.Vector3(BONFIRE.x + 2.5, 0, BONFIRE.z + 2)
    spawn.y = this.world.surfaceAt(spawn.x, spawn.z)
    this.player.reset(spawn, Math.PI * 0.85)

    // enemies
    const spawnPts: [number, number][] = [
      [6, 8], [-7, 5], [4, -2], [-5, -7], [11, -3], [-12, -1],
    ]
    for (const [x, z] of spawnPts) {
      const p = new THREE.Vector3(x, 0, z)
      p.y = this.world.surfaceAt(x, z)
      this.spawns.push(p)
      const e = new Enemy(scene, 'zombie', p, {
        hp: 82, dmg: 21, speed: 2.75, aggro: 12.5, atkRange: 2.05,
        windup: 0.62, recover: 0.85, souls: 35, scale: 0.98,
      })
      e.world = this.world
      this.enemies.push(e)
    }

    // creepers — fast, fuse up and explode; keep your distance or block!
    const creeperPts: [number, number][] = [
      [7, -6], [-14, -9], [9, 12],
    ]
    for (const [x, z] of creeperPts) {
      const p = new THREE.Vector3(x, 0, z)
      p.y = this.world.surfaceAt(x, z)
      const c = new CreeperEnemy(scene, p)
      c.world = this.world
      this.enemies.push(c)
    }

    // skeleton archers — hold mid-range and pepper you with arrows;
    // rush them to force a panicky smack, or block/roll the volleys
    const skelPts: [number, number][] = [
      [16, 4], [-17, -4], [7, 16],
    ]
    for (const [x, z] of skelPts) {
      const p = new THREE.Vector3(x, 0, z)
      p.y = this.world.surfaceAt(x, z)
      const s = new SkeletonEnemy(scene, p)
      s.world = this.world
      this.enemies.push(s)
    }

    // wither skeletons — the Ash Wastes guards; their heavy grey blades
    // chew through shields, so roll instead of block
    const witherPts: [number, number][] = [
      [16, 10], [16, 27], [27, 9],
    ]
    for (const [x, z] of witherPts) {
      const p = new THREE.Vector3(x, 0, z)
      p.y = this.world.surfaceAt(x, z)
      const w = new WitherSkeletonEnemy(scene, p)
      w.world = this.world
      this.enemies.push(w)
    }

    // blazes — floating sentries spitting fireballs
    const blazePts: [number, number][] = [
      [20, 2], [13, 26],
    ]
    for (const [x, z] of blazePts) {
      const p = new THREE.Vector3(x, 0, z)
      p.y = this.world.surfaceAt(x, z)
      const b = new BlazeEnemy(scene, p)
      b.world = this.world
      this.enemies.push(b)
    }

    // boss 1 — the ancient zombie knight beyond the north fog
    const bossSpawn = new THREE.Vector3(BOSS_CENTER.x, 0, BOSS_CENTER.z)
    bossSpawn.y = this.world.surfaceAt(BOSS_CENTER.x, BOSS_CENTER.z)
    this.boss = new BossEnemy(scene, bossSpawn)
    this.boss.world = this.world

    // boss 2 — the Flame King of the Ash Wastes, behind the east fog
    const boss2Spawn = new THREE.Vector3(BOSS2_CENTER.x, 0, BOSS2_CENTER.z)
    boss2Spawn.y = this.world.surfaceAt(BOSS2_CENTER.x, BOSS2_CENTER.z)
    this.boss2 = new BossFlameEnemy(scene, boss2Spawn)
    this.boss2.world = this.world

    // the pyromancy flame, waiting in the wastes' entrance ruins
    this.buildPyroItem()

    // DOM overlays (reticle + hurt vignette)
    this.reticle = document.createElement('div')
    this.reticle.style.cssText =
      'position:absolute;width:14px;height:14px;border:2px solid rgba(255,90,90,0.95);transform:translate(-50%,-50%) rotate(45deg);display:none;pointer-events:none;box-shadow:0 0 6px rgba(255,60,60,0.8);z-index:5'
    container.appendChild(this.reticle)

    this.vignette = document.createElement('div')
    this.vignette.style.cssText =
      'position:absolute;inset:0;pointer-events:none;opacity:0;z-index:4;background:radial-gradient(ellipse at center, rgba(255,0,0,0) 45%, rgba(180,0,0,0.55) 100%)'
    container.appendChild(this.vignette)

    this.buildMinimap(container)

    this.engine.start()
  }

  get allEnemies(): Enemy[] {
    const list = [...this.enemies]
    if (!this.bossFell) list.push(this.boss)
    if (!this.boss2Fell) list.push(this.boss2)
    return list
  }

  /** whichever lord is currently fighting — drives the HUD boss bar */
  private get activeBoss(): Enemy | null {
    if (this.bossActive && !this.bossFell) return this.boss
    if (this.boss2Active && !this.boss2Fell) return this.boss2
    return null
  }

  /* ================= PUBLIC API (for React) ================= */

  startGame() {
    this.sfx.resume()
    this.loadSave()
    this.player.fullRestore()
    this.phase = 'playing'
    if (!this.engine.input.isTouch) this.engine.input.requestLock()
    this.emit(true)
  }

  hasSave(): boolean {
    try {
      return !!localStorage.getItem(SAVE_KEY)
    } catch {
      return false
    }
  }

  clearSave() {
    try {
      localStorage.removeItem(SAVE_KEY)
    } catch { /* ignore */ }
  }

  nextCost(): number {
    return 80 * this.player.level
  }

  rest() {
    if (this.phase !== 'playing') return
    this.phase = 'rest'
    this.player.fullRestore()
    for (const e of this.enemies) e.reset()
    if (!this.bossFell) this.boss.reset()
    if (!this.boss2Fell) this.boss2.reset()
    this.bossActive = false
    this.boss2Active = false
    this.bossActiveBarrier = false
    this.boss2Barrier = false
    this.world.setFogGatesVisible(!this.bossFell, !this.boss2Fell)
    this.save()
    this.sfx.bonfire()
    // free the cursor! pointer lock retargets every click to the canvas,
    // which made the rest menu (level-up / arise) unclickable on desktop
    this.engine.input.releaseLock()
    this.emit(true)
  }

  leaveRest() {
    if (this.phase !== 'rest') return
    this.phase = 'playing'
    if (!this.engine.input.isTouch) this.engine.input.requestLock()
    this.emit(true)
  }

  levelUp(stat: 'vit' | 'end' | 'str') {
    if (this.phase !== 'rest') return
    const cost = this.nextCost()
    if (this.player.souls < cost) return
    this.player.souls -= cost
    this.player.applyLevel(stat)
    // resting heals — a fresh level-up tops up the new maximum too
    this.player.hp = this.player.maxHp
    this.player.stamina = this.player.maxStamina
    this.save()
    this.sfx.levelUp()
    this.emit(true)
  }

  interact() {
    if (this.phase !== 'playing') return
    // bloodstain
    if (this.bloodstain && this.bloodstain.mesh.position.distanceTo(this.player.pos) < 1.7) {
      this.player.souls += this.bloodstain.amount
      this.spawnBurst(this.bloodstain.mesh.position, 0x59ff6a, 22, 3.5)
      this.spawnText(`+${this.bloodstain.amount}`, '#59ff6a', this.player.pos.clone().add(new THREE.Vector3(0, 2.2, 0)))
      this.engine.scene.remove(this.bloodstain.mesh)
      this.bloodstain = null
      this.sfx.souls()
      this.emit(true)
      return
    }
    // estus shard dropped by the first boss
    if (this.estusShard) {
      const sp = this.estusShard.mesh.position
      if (Math.hypot(this.player.pos.x - sp.x, this.player.pos.z - sp.z) < 1.9) {
        this.collectEstusShard()
        return
      }
    }
    // the pyromancy flame loot
    if (this.pyroItem) {
      const sp = this.pyroItem.mesh.position
      if (Math.hypot(this.player.pos.x - sp.x, this.player.pos.z - sp.z) < 1.9) {
        this.collectPyroItem()
        return
      }
    }
    // the Great Ember dropped by the Flame King
    if (this.emberItem) {
      const sp = this.emberItem.mesh.position
      if (Math.hypot(this.player.pos.x - sp.x, this.player.pos.z - sp.z) < 1.9) {
        this.collectEmber()
        return
      }
    }
    // bonfire
    const bPos = new THREE.Vector3(BONFIRE.x, this.world.surfaceAt(BONFIRE.x, BONFIRE.z), BONFIRE.z)
    if (bPos.distanceTo(this.player.pos) < 2.6) {
      this.rest()
      return
    }
    // fog gate 1 — the zombie knight
    if (!this.bossActive && !this.bossFell && this.player.pos.z < GATE_Z + 3.2 && this.player.pos.z > GATE_Z - 1) {
      this.fogPassT = 0.75
      this.sfx.bossRoar()
      return
    }
    // fog gate 2 — the Flame King
    if (!this.boss2Active && !this.boss2Fell &&
      this.player.pos.x > GATE2.x - 2.4 && this.player.pos.x < GATE2.x + 2.0 &&
      this.player.pos.z > 16.2 && this.player.pos.z < 19.8
    ) {
      this.fogPass2T = 0.75
      this.sfx.bossRoar()
    }
  }

  toggleLock() {
    if (this.player.lockedTarget) {
      this.player.lockedTarget = null
      return
    }
    const camF = new THREE.Vector3(-Math.sin(this.camYaw), 0, -Math.cos(this.camYaw))
    let best: Enemy | null = null
    let bestScore = Infinity
    for (const e of this.allEnemies) {
      if (!e.alive || (e.isBoss && !this.bossActive)) continue
      const to = e.pos.clone().sub(this.player.pos)
      const d = to.length()
      if (d > 15) continue
      to.normalize()
      const dot = to.dot(camF)
      if (dot < 0.1) continue
      const score = d * (2 - dot)
      if (score < bestScore) {
        bestScore = score
        best = e
      }
    }
    if (best) {
      this.player.lockedTarget = { pos: best.pos, alive: true, isBoss: best.isBoss }
    }
  }

  /* touch API */
  setTouchMove(x: number, y: number) {
    this.engine.input.touchMove.x = x
    this.engine.input.touchMove.y = y
  }
  touchPress(name: string) {
    this.sfx.resume()
    this.engine.input.press(name)
  }
  touchHold(name: string, down: boolean) {
    this.engine.input.setHeld(name, down)
  }
  touchLook(dx: number, dy: number) {
    this.engine.input.touchLookDX += dx
    this.engine.input.touchLookDY += dy
  }

  dispose() {
    this.engine.dispose()
    if (this.reticle.parentElement) this.reticle.parentElement.removeChild(this.reticle)
    if (this.vignette.parentElement) this.vignette.parentElement.removeChild(this.vignette)
    if (this.mapCanvas?.parentElement) this.mapCanvas.parentElement.removeChild(this.mapCanvas)
  }

  /* ================= INTERNAL ================= */

  private save() {
    try {
      const data: SaveData = {
        souls: this.player.souls,
        level: this.player.level,
        vit: this.player.vit,
        end: this.player.end,
        str: this.player.str,
        estusUp: this.estusUp,
        pyro: this.pyroUnlocked,
        ember: this.emberTaken,
      }
      localStorage.setItem(SAVE_KEY, JSON.stringify(data))
    } catch { /* ignore */ }
  }

  private loadSave() {
    try {
      const raw = localStorage.getItem(SAVE_KEY)
      if (!raw) return
      const d = JSON.parse(raw) as SaveData
      // re-apply levels from scratch for consistency
      const target = { vit: d.vit ?? 0, end: d.end ?? 0, str: d.str ?? 0 }
      this.player.vit = 0
      this.player.end = 0
      this.player.str = 0
      this.player.maxHp = 95
      this.player.maxStamina = 95
      for (let i = 0; i < target.vit; i++) this.player.applyLevel('vit')
      for (let i = 0; i < target.end; i++) this.player.applyLevel('end')
      for (let i = 0; i < target.str; i++) this.player.applyLevel('str')
      this.player.level = 1 + target.vit + target.end + target.str
      this.player.souls = d.souls ?? 0
      // permanent estus-shard upgrade
      this.estusUp = !!d.estusUp
      this.player.maxEstus = this.estusUp ? 4 : 3
      // pyromancy flags
      this.pyroUnlocked = !!d.pyro
      this.emberTaken = !!d.ember
      this.player.pyroUnlocked = this.pyroUnlocked
      this.player.maxPyro = 4 + (this.emberTaken ? 2 : 0)
      this.player.pyro = this.player.maxPyro
      if (this.pyroUnlocked) this.removePyroItem()
    } catch { /* ignore */ }
  }

  private playerStrike(def: PlayerStrikeDef) {
    const fwd = new THREE.Vector3(Math.sin(this.player.yaw), 0, Math.cos(this.player.yaw))
    let hits = 0
    for (const e of this.allEnemies) {
      if (!e.alive) continue
      // melee geometry is horizontal — blocky terrain height steps must not
      // inflate the distance or the arc vector
      const to = e.pos.clone().sub(this.player.pos)
      to.y = 0
      const d = to.length()
      if (d > def.range + (e.isBoss ? 1.2 : 0.3)) continue
      // point-blank auto-hit: when the target is this close the direction
      // vector degenerates (enemy hugging the player), so the arc check
      // would randomly fail and make hugging enemies unhittable
      if (d > 0.9 + (e.isBoss ? 1.2 : 0)) {
        to.normalize()
        if (to.dot(fwd) < Math.cos(def.arc)) continue
      }
      const dmg = Math.max(1, Math.round(def.dmg * (0.92 + Math.random() * 0.16)))
      e.takeDamage(dmg, this, this.player.pos.x, this.player.pos.z)
      hits++
    }
    if (hits > 0) {
      this.hitstop = def.heavy ? 0.09 : 0.06
      if (def.heavy) {
        this.sfx.heavy()
        this.shake = Math.max(this.shake, 0.18)
      } else {
        this.sfx.hit()
      }
      // spark burst at first victim
      const victim = this.allEnemies.find((e) => e.alive && e.pos.distanceTo(this.player.pos) < def.range + 1.4)
      if (victim) this.spawnBurst(victim.pos.clone().add(new THREE.Vector3(0, 1.3, 0)), 0xffe08a, 8, 2.2, 0.4)
    }
  }

  onPlayerHit(dmg: number) {
    this.hurtFlash = Math.min(1, 0.4 + dmg / 90)
    this.shake = Math.max(this.shake, 0.32)
    this.sfx.hurt()
    this.emit(true)
  }

  onPlayerBlock(dmg: number) {
    this.shake = Math.max(this.shake, 0.12)
    this.sfx.block()
    const fwd = new THREE.Vector3(Math.sin(this.player.yaw), 0, Math.cos(this.player.yaw))
    const at = this.player.pos
      .clone()
      .add(fwd.multiplyScalar(0.75))
      .add(new THREE.Vector3(0, 1.15, 0))
    this.spawnBurst(at, 0xffe9a0, 10, 2.6, 0.35, 0.1)
    this.emit(true)
  }

  onGuardBreak(chip: number) {
    this.sfx.guardBreak()
    this.shake = Math.max(this.shake, 0.3)
    this.hurtFlash = Math.min(1, 0.35 + chip / 90)
    this.spawnText('شکستن دفاع!', '#ff7a5c', this.player.pos.clone().add(new THREE.Vector3(0, 2.2, 0)))
    this.emit(true)
  }

  onCreeperBoom(pos: THREE.Vector3) {
    this.shake = Math.max(this.shake, 0.5)
    this.sfx.boom()
    const at = pos.clone().add(new THREE.Vector3(0, 1, 0))
    this.spawnBurst(at, 0xffb347, 30, 6, 0.5, 0.22)
    this.spawnBurst(at, 0x9fd89f, 20, 3.6, 0.85, 0.3)
    const light = new THREE.PointLight(0xffa040, 7, 13, 1.8)
    light.position.copy(pos).add(new THREE.Vector3(0, 1.2, 0))
    this.engine.scene.add(light)
    this.boomLights.push({ light, t: 0 })
  }

  /** skeleton archers call this at the moment of release */
  spawnArrow(from: THREE.Vector3, target: THREE.Vector3, dmg: number) {
    this.arrows.push(new Arrow(this, from, target, dmg))
    this.sfx.arrowShoot()
  }

  onArrowBlocked() {
    this.sfx.arrowBlock()
    this.shake = Math.max(this.shake, 0.08)
    const fwd = new THREE.Vector3(Math.sin(this.player.yaw), 0, Math.cos(this.player.yaw))
    const at = this.player.pos
      .clone()
      .add(fwd.multiplyScalar(0.75))
      .add(new THREE.Vector3(0, 1.15, 0))
    this.spawnBurst(at, 0xffe9a0, 6, 2.2, 0.3, 0.09)
    this.emit(true)
  }

  onPlayerHeal(heal: number) {
    this.sfx.heal()
    this.spawnBurst(this.player.pos.clone().add(new THREE.Vector3(0, 1.4, 0)), 0xffc44d, 14, 2)
    this.spawnText(`+${heal}`, '#ffc44d', this.player.pos.clone().add(new THREE.Vector3(0, 2.2, 0)))
    this.emit(true)
  }

  onEnemyKilled(e: Enemy) {
    // soul orb flies to player
    const orb = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.28, 0.28),
      new THREE.MeshBasicMaterial({ color: 0x59ff6a })
    )
    orb.position.copy(e.pos).add(new THREE.Vector3(0, 1.2, 0))
    this.engine.scene.add(orb)
    this.orbs.push({ mesh: orb, t: 0, amount: e.soulsValue(), from: orb.position.clone() })
    if (e === this.boss) this.onBossKilled()
    else if (e === this.boss2) this.onBoss2Killed()
    this.emit(true)
  }

  private onBossKilled() {
    this.bossFell = true
    this.bossActive = false
    this.bossActiveBarrier = false
    this.world.setFogGatesVisible(false, !this.boss2Fell)
    this.banner = 'bossfell'
    this.bannerT = 0
    if (this.player.lockedTarget) this.player.lockedTarget = null
    this.sfx.victory()
    this.spawnEstusShard()
    this.save()
  }

  /** the Flame King falls — the Great Ember is his legacy */
  private onBoss2Killed() {
    this.boss2Fell = true
    this.boss2Active = false
    this.boss2Barrier = false
    this.world.setFogGatesVisible(!this.bossFell, false)
    this.banner = 'bossfell2'
    this.bannerT = 0
    if (this.player.lockedTarget) this.player.lockedTarget = null
    this.sfx.victory()
    this.spawnEmber()
    this.save()
  }

  /** the boss drops a glowing estus shard — permanent +1 flask capacity */
  private spawnEstusShard() {
    if (this.estusUp || this.estusShard) return
    const g = new THREE.Group()
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 0.42, 0.3),
      new THREE.MeshLambertMaterial({ color: 0xd98a1f, transparent: true, opacity: 0.92 })
    )
    const glow = new THREE.Mesh(
      new THREE.BoxGeometry(0.46, 0.58, 0.46),
      new THREE.MeshBasicMaterial({ color: 0xffb63d, transparent: true, opacity: 0.28 })
    )
    const cork = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.12, 0.14),
      new THREE.MeshLambertMaterial({ color: 0x6e4f30 })
    )
    cork.position.y = 0.27
    g.add(glow, body, cork)
    const bx = this.boss.pos.x
    const bz = this.boss.pos.z
    const y = this.world.surfaceAt(bx, bz) + 0.75
    g.position.set(bx, y, bz)
    this.engine.scene.add(g)
    const light = new THREE.PointLight(0xffb040, 2.4, 6.5, 1.8)
    light.position.set(bx, y + 0.5, bz)
    this.engine.scene.add(light)
    this.estusShard = { mesh: g, light }
  }

  private collectEstusShard() {
    if (!this.estusShard) return
    this.engine.scene.remove(this.estusShard.mesh)
    this.engine.scene.remove(this.estusShard.light)
    this.estusShard = null
    this.estusUp = true
    this.player.maxEstus++
    this.player.estus = this.player.maxEstus
    this.sfx.shard()
    this.spawnBurst(this.player.pos.clone().add(new THREE.Vector3(0, 1.2, 0)), 0xffb63d, 20, 2.6)
    this.spawnText('تکه‌ی استوس! ظرفیت شربت +۱', '#ffc44d', this.player.pos.clone().add(new THREE.Vector3(0, 2.6, 0)))
    this.save()
    this.emit(true)
  }

  onBossPhase2() {
    this.sfx.phaseRoar()
    this.shake = Math.max(this.shake, 0.5)
    const c = this.boss.pos.clone().add(new THREE.Vector3(0, 2.4, 0))
    this.spawnBurst(c, 0xff5533, 34, 4.5)
    this.spawnBurst(this.boss.pos.clone().add(new THREE.Vector3(0, 0.4, 0)), 0xff8844, 20, 3, 0.7, 0.2)
  }

  onBossIntro(pos: THREE.Vector3) {
    this.sfx.bossRoar()
    this.shake = Math.max(this.shake, 0.42)
    this.spawnBurst(pos.clone().add(new THREE.Vector3(0, 2.6, 0)), 0xb04a2a, 24, 3.4)
  }

  onBossSlam(pos: THREE.Vector3) {
    this.shake = Math.max(this.shake, 0.5)
    this.sfx.heavy()
    this.spawnBurst(pos.clone().add(new THREE.Vector3(0, 0.5, 0)), 0xb0a080, 24, 4.5, 0.6, 0.22)
    this.spawnBurst(pos.clone().add(new THREE.Vector3(0, 0.25, 0)), 0x8a7a5c, 14, 2.4, 0.8, 0.28)
    this.waves.push(new Shockwave(this, pos.clone(), 4.8, 14))
  }

  onBossStomp(pos: THREE.Vector3) {
    this.shake = Math.max(this.shake, 0.45)
    this.sfx.stomp()
    this.spawnBurst(pos.clone().add(new THREE.Vector3(0, 0.3, 0)), 0xb0a080, 26, 5, 0.55, 0.24)
    this.waves.push(new Shockwave(this, pos.clone(), 4.0, 16, 0xc9b48a))
  }

  onBossStagger(pos: THREE.Vector3) {
    this.sfx.stagger()
    this.shake = Math.max(this.shake, 0.32)
    this.spawnBurst(pos.clone().add(new THREE.Vector3(0, 2.2, 0)), 0xffe08a, 18, 3, 0.5)
    this.spawnText('تعادلش شکست!', '#ffd54a', pos.clone().add(new THREE.Vector3(0, 4.4, 0)))
    this.emit(true)
  }

  /* ================= BOSS 2 / PYROMANCY EVENTS ================= */

  onBoss2Intro(pos: THREE.Vector3) {
    this.sfx.bossRoar()
    this.shake = Math.max(this.shake, 0.42)
    this.spawnBurst(pos.clone().add(new THREE.Vector3(0, 3, 0)), 0xff7a2a, 26, 3.6)
  }

  onBoss2Phase2() {
    this.sfx.phaseRoar()
    this.shake = Math.max(this.shake, 0.5)
    const c = this.boss2.pos.clone().add(new THREE.Vector3(0, 2.6, 0))
    this.spawnBurst(c, 0xff6a1a, 34, 4.5)
    this.spawnBurst(this.boss2.pos.clone().add(new THREE.Vector3(0, 0.4, 0)), 0xffa044, 20, 3, 0.7, 0.2)
  }

  onBoss2Slam(pos: THREE.Vector3) {
    this.shake = Math.max(this.shake, 0.5)
    this.sfx.heavy()
    this.spawnBurst(pos.clone().add(new THREE.Vector3(0, 0.5, 0)), 0xff8a3a, 24, 4.5, 0.6, 0.22)
    this.spawnBurst(pos.clone().add(new THREE.Vector3(0, 0.25, 0)), 0xc25a1a, 14, 2.4, 0.8, 0.28)
    this.waves.push(new Shockwave(this, pos.clone(), 4.6, 14, 0xff9a4a))
    // the floor stays molten for a while — keep moving!
    this.spawnLavaPool(pos.x, pos.z)
  }

  /** a temporary molten patch left by the Flame King's slam */
  private spawnLavaPool(x: number, z: number) {
    const base = this.world.mats.lava as THREE.MeshBasicMaterial
    const mat = base.clone()
    mat.transparent = true
    const m = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 4.4), mat)
    m.rotation.x = -Math.PI / 2
    m.position.set(x, this.world.surfaceAt(x, z) + 0.04, z)
    this.engine.scene.add(m)
    this.lavaPools.push({ mesh: m, x, z, t: 0 })
  }

  /** any enemy (Blaze, Flame King) calls this at the release moment */
  spawnFireball(from: THREE.Vector3, target: THREE.Vector3, dmg: number) {
    this.fireballs.push(new Fireball(this, from, target, dmg, false))
  }

  /** the player's pyromancy shot — aims at the locked target when there is one */
  spawnPlayerFireball(p: Player) {
    const from = p.pos.clone().add(new THREE.Vector3(0, 1.35, 0))
    let dir: THREE.Vector3
    let targetPoint: THREE.Vector3
    if (p.lockedTarget && p.lockedTarget.alive) {
      targetPoint = p.lockedTarget.pos.clone()
      dir = targetPoint.clone().sub(from)
      dir.y = 0
      if (dir.lengthSq() < 0.01) {
        dir.set(Math.sin(p.yaw), 0, Math.cos(p.yaw))
        targetPoint = from.clone().addScaledVector(dir, 12)
      }
    } else {
      dir = new THREE.Vector3(Math.sin(p.yaw), 0, Math.cos(p.yaw))
      targetPoint = from.clone().addScaledVector(dir, 12)
    }
    dir.normalize()
    // land the bolt at chest height above the target's ground —
    // without this, flat shots detonate on any terrain bump
    targetPoint.y = this.world.surfaceAt(targetPoint.x, targetPoint.z) + 1.0
    const to = targetPoint
    const dmg = Math.round(42 * (1 + p.str * 0.08))
    this.fireballs.push(new Fireball(this, from, to, dmg, true))
    this.sfx.fireShoot()
    this.spawnBurst(from.clone().addScaledVector(dir, 0.5), 0xffb347, 6, 1.6, 0.3, 0.1)
  }

  onFireballBoom(pos: THREE.Vector3, friendly: boolean) {
    this.sfx.fireBoom()
    this.shake = Math.max(this.shake, friendly ? 0.14 : 0.2)
    const at = pos.clone()
    this.spawnBurst(at, 0xffd23d, 16, 3.4, 0.45, 0.16)
    this.spawnBurst(at, 0xff6a1a, 12, 2.4, 0.6, 0.2)
    const light = new THREE.PointLight(0xff8a30, 5, 10, 1.8)
    light.position.copy(at)
    this.engine.scene.add(light)
    this.boomLights.push({ light, t: 0 })
  }

  /** feedback when the player presses R without pyromancy or charges */
  onCastFail(unlocked: boolean, hasCharge: boolean) {
    if (this.time - this.castFailT < 1.6) return
    this.castFailT = this.time
    if (!unlocked) {
      this.spawnText('هنوز جادو نیاموخته‌ای — در خاکسترگاه بیاب!', '#ff9a5c', this.player.pos.clone().add(new THREE.Vector3(0, 2.4, 0)))
    } else if (!hasCharge) {
      this.spawnText('شارژ جادو خالی است — در آتش کمپ بازپر کن', '#ff9a5c', this.player.pos.clone().add(new THREE.Vector3(0, 2.4, 0)))
    }
    this.emit(true)
  }

  /** the pyromancy flame loot — a staff-head of living embers */
  private buildPyroItem() {
    const g = new THREE.Group()
    const stick = new THREE.Mesh(
      new THREE.BoxGeometry(0.09, 0.7, 0.09),
      new THREE.MeshLambertMaterial({ color: 0x4a3620 })
    )
    stick.position.y = 0.1
    const orb = new THREE.Mesh(
      new THREE.BoxGeometry(0.26, 0.26, 0.26),
      new THREE.MeshBasicMaterial({ color: 0xffb347 })
    )
    orb.position.y = 0.62
    const glow = new THREE.Mesh(
      new THREE.BoxGeometry(0.46, 0.46, 0.46),
      new THREE.MeshBasicMaterial({ color: 0xff7a1e, transparent: true, opacity: 0.3 })
    )
    glow.position.y = 0.62
    g.add(stick, glow, orb)
    const y = this.world.surfaceAt(PYRO_ITEM.x, PYRO_ITEM.z) + 0.5
    g.position.set(PYRO_ITEM.x, y, PYRO_ITEM.z)
    this.engine.scene.add(g)
    const light = new THREE.PointLight(0xff8a2a, 2.2, 7, 1.8)
    light.position.set(PYRO_ITEM.x, y + 0.6, PYRO_ITEM.z)
    this.engine.scene.add(light)
    this.pyroItem = { mesh: g, light }
  }

  private removePyroItem() {
    if (!this.pyroItem) return
    this.engine.scene.remove(this.pyroItem.mesh)
    this.engine.scene.remove(this.pyroItem.light)
    this.pyroItem = null
  }

  private collectPyroItem() {
    if (!this.pyroItem) return
    this.removePyroItem()
    this.pyroUnlocked = true
    this.player.pyroUnlocked = true
    this.player.pyro = this.player.maxPyro
    this.sfx.shard()
    this.spawnBurst(this.player.pos.clone().add(new THREE.Vector3(0, 1.2, 0)), 0xff8a2a, 20, 2.6)
    this.spawnText('شعله‌ی پیرمانسی! با R شعله پرتاب کن', '#ffb347', this.player.pos.clone().add(new THREE.Vector3(0, 2.6, 0)))
    this.save()
    this.emit(true)
  }

  /** the Great Ember — the Flame King's dropped legacy (+2 spell charges) */
  private spawnEmber() {
    if (this.emberTaken || this.emberItem) return
    const g = new THREE.Group()
    const core = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 0.32, 0.32),
      new THREE.MeshBasicMaterial({ color: 0xff5a10 })
    )
    const glow = new THREE.Mesh(
      new THREE.BoxGeometry(0.56, 0.56, 0.56),
      new THREE.MeshBasicMaterial({ color: 0xff8a2a, transparent: true, opacity: 0.3 })
    )
    g.add(glow, core)
    const bx = this.boss2.pos.x
    const bz = this.boss2.pos.z
    const y = this.world.surfaceAt(bx, bz) + 0.75
    g.position.set(bx, y, bz)
    this.engine.scene.add(g)
    const light = new THREE.PointLight(0xff5a20, 2.6, 7, 1.8)
    light.position.set(bx, y + 0.5, bz)
    this.engine.scene.add(light)
    this.emberItem = { mesh: g, light }
  }

  private collectEmber() {
    if (!this.emberItem) return
    this.engine.scene.remove(this.emberItem.mesh)
    this.engine.scene.remove(this.emberItem.light)
    this.emberItem = null
    this.emberTaken = true
    this.player.pyroUnlocked = true
    this.pyroUnlocked = true
    this.player.maxPyro += 2
    this.player.pyro = this.player.maxPyro
    this.sfx.ember()
    this.spawnBurst(this.player.pos.clone().add(new THREE.Vector3(0, 1.2, 0)), 0xff5a20, 22, 2.8)
    this.spawnText('اخگر بزرگ! ظرفیت جادو +۲', '#ff7a3a', this.player.pos.clone().add(new THREE.Vector3(0, 2.6, 0)))
    this.save()
    this.emit(true)
  }

  spawnDamageText(dmg: number, pos: THREE.Vector3, height: number) {
    this.spawnText(`${dmg}`, '#ffffff', pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.6, height, (Math.random() - 0.5) * 0.6)))
  }

  spawnText(text: string, color: string, pos: THREE.Vector3) {
    this.texts.push(new FloatText(text, color, pos))
    this.engine.scene.add(this.texts[this.texts.length - 1].sprite)
  }

  spawnBurst(pos: THREE.Vector3, color: number, count = 14, speed = 3, life = 0.7, size = 0.14) {
    this.bursts.push(new Burst(this.engine.scene, pos, color, count, speed, life, size))
  }

  /* ================= MINIMAP ================= */

  private buildMinimap(container: HTMLElement) {
    const c = document.createElement('canvas')
    c.width = c.height = 132
    c.style.cssText =
      'position:absolute;top:12px;right:12px;width:132px;height:132px;border:2px solid rgba(0,0,0,0.92);' +
      'box-shadow:3px 3px 0 rgba(0,0,0,0.45);image-rendering:pixelated;z-index:6;background:#141c10;pointer-events:none'
    c.style.display = 'none'
    container.appendChild(c)
    this.mapCanvas = c
    this.mapCtx = c.getContext('2d')!

    // pre-render the blocky terrain once (1px per block)
    const t = document.createElement('canvas')
    t.width = t.height = 60
    const tc = t.getContext('2d')!
    for (let z = -WORLD_HALF; z < WORLD_HALF; z++) {
      for (let x = -WORLD_HALF; x < WORLD_HALF; x++) {
        const h = this.world.getH(x, z)
        const dA = Math.hypot(x - BOSS_CENTER.x, z - BOSS_CENTER.z)
        const dA2 = Math.hypot(x - BOSS2_CENTER.x, z - BOSS2_CENTER.z)
        const isPath = Math.abs(x) <= 1 && z > GATE_Z && z < BONFIRE.z + 1
        const isPath2 = z >= 17 && z <= 19 && x >= ASH_WALL_X
        const lavaCell = LAVA_POOLS.some((p) => x >= p.x0 && x <= p.x1 && z >= p.z0 && z <= p.z1)
        if (x === ASH_WALL_X) tc.fillStyle = '#4a4a4a'
        else if (lavaCell) tc.fillStyle = '#ff7a1f'
        else if (dA < 8.5 || dA2 < 8.5) tc.fillStyle = '#828282'
        else if (isPath) tc.fillStyle = '#8a6440'
        else if (isPath2) tc.fillStyle = '#7a6a5a'
        else if (x >= ASH_WALL_X) tc.fillStyle = `rgb(${86 + h * 5},${40 + h * 3},${34 + h * 2})`
        else tc.fillStyle = `rgb(${52 + h * 7},${98 + h * 13},${36 + h * 5})`
        tc.fillRect(x + WORLD_HALF, z + WORLD_HALF, 1, 1)
      }
    }
    this.mapTerrain = t
  }

  private drawMinimap() {
    const c = this.mapCanvas
    if (this.phase === 'menu') {
      c.style.display = 'none'
      return
    }
    c.style.display = 'block'
    const ctx = this.mapCtx
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(this.mapTerrain, 0, 0, 132, 132)
    const S = 132 / (WORLD_HALF * 2)
    const px = (x: number) => (x + WORLD_HALF) * S
    const pz = (z: number) => (z + WORLD_HALF) * S

    // bonfire — warm beacon
    ctx.fillStyle = '#ffb347'
    ctx.fillRect(px(BONFIRE.x) - 2, pz(BONFIRE.z) - 2, 4, 4)
    ctx.fillStyle = '#ffe08a'
    ctx.fillRect(px(BONFIRE.x) - 1, pz(BONFIRE.z) - 1, 2, 2)

    // boss 1 — dark crimson square until it falls
    if (!this.bossFell) {
      ctx.fillStyle = this.bossActive ? '#d43737' : '#8a2020'
      ctx.fillRect(px(this.boss.pos.x) - 2.5, pz(this.boss.pos.z) - 2.5, 5, 5)
    }

    // boss 2 — molten orange square until it falls
    if (!this.boss2Fell) {
      ctx.fillStyle = this.boss2Active ? '#ff6a1f' : '#a03a10'
      ctx.fillRect(px(this.boss2.pos.x) - 2.5, pz(this.boss2.pos.z) - 2.5, 5, 5)
    }

    // enemies — color-coded by breed
    for (const e of this.enemies) {
      if (!e.alive) continue
      ctx.fillStyle =
        e instanceof CreeperEnemy ? '#59d959'
        : e instanceof SkeletonEnemy ? '#ece8dc'
        : e instanceof WitherSkeletonEnemy ? '#8a8a96'
        : e instanceof BlazeEnemy ? '#ffb347'
        : '#d43737'
      ctx.fillRect(px(e.pos.x) - 1.5, pz(e.pos.z) - 1.5, 3, 3)
    }

    // bloodstain — blinking emerald
    if (this.bloodstain) {
      ctx.fillStyle = Math.sin(this.time * 6) > 0 ? '#59ff6a' : '#2fbf4a'
      const bp = this.bloodstain.mesh.position
      ctx.fillRect(px(bp.x) - 1.5, pz(bp.z) - 1.5, 3, 3)
    }

    // estus shard — amber sparkle
    if (this.estusShard) {
      const sp = this.estusShard.mesh.position
      ctx.fillStyle = Math.sin(this.time * 8) > 0 ? '#ffc44d' : '#ffdf8a'
      ctx.fillRect(px(sp.x) - 1.5, pz(sp.z) - 1.5, 3, 3)
    }

    // pyromancy flame loot — pulsing ember
    if (this.pyroItem) {
      const sp = this.pyroItem.mesh.position
      ctx.fillStyle = Math.sin(this.time * 9) > 0 ? '#ff8a2a' : '#ffb347'
      ctx.fillRect(px(sp.x) - 1.5, pz(sp.z) - 1.5, 3, 3)
    }

    // great ember — hot red sparkle
    if (this.emberItem) {
      const sp = this.emberItem.mesh.position
      ctx.fillStyle = Math.sin(this.time * 9) > 0 ? '#ff5a20' : '#ff8a3a'
      ctx.fillRect(px(sp.x) - 1.5, pz(sp.z) - 1.5, 3, 3)
    }

    // player — white block + facing notch
    const ppx = px(this.player.pos.x)
    const ppz = pz(this.player.pos.z)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(ppx - 2, ppz - 2, 4, 4)
    const fx = Math.sin(this.player.yaw)
    const fz = Math.cos(this.player.yaw)
    ctx.fillStyle = '#59ff6a'
    ctx.fillRect(ppx + fx * 4.5 - 1, ppz + fz * 4.5 - 1, 2, 2)
  }

  private spawnBloodstain() {
    if (this.bloodstain) {
      this.engine.scene.remove(this.bloodstain.mesh)
      this.bloodstain = null
    }
    const amount = this.player.souls
    if (amount <= 0) return
    const g = new THREE.Group()
    const core = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 0.4, 0.4),
      new THREE.MeshBasicMaterial({ color: 0x59ff6a, transparent: true, opacity: 0.9 })
    )
    const glow = new THREE.Mesh(
      new THREE.BoxGeometry(0.62, 0.62, 0.62),
      new THREE.MeshBasicMaterial({ color: 0x2fbf4a, transparent: true, opacity: 0.35 })
    )
    g.add(core, glow)
    g.position.set(this.player.pos.x, this.world.surfaceAt(this.player.pos.x, this.player.pos.z) + 0.45, this.player.pos.z)
    this.engine.scene.add(g)
    this.bloodstain = { mesh: g, amount }
    this.player.souls = 0
  }

  private bossActiveBarrier = false
  private boss2Barrier = false

  private respawn() {
    const p = new THREE.Vector3(BONFIRE.x + 2.5, 0, BONFIRE.z + 2)
    p.y = this.world.surfaceAt(p.x, p.z)
    this.player.reset(p, Math.PI * 0.85)
    this.player.fullRestore()
    for (const e of this.enemies) e.reset()
    if (!this.bossFell || !this.boss2Fell) {
      this.world.setFogGatesVisible(!this.bossFell, !this.boss2Fell)
    }
    if (!this.bossFell) this.boss.reset()
    if (!this.boss2Fell) this.boss2.reset()
    this.bossActive = false
    this.bossActiveBarrier = false
    this.boss2Active = false
    this.boss2Barrier = false
    for (const o of this.orbs) this.engine.scene.remove(o.mesh)
    this.orbs = []
    this.fogPassT = 0
    this.fogPass2T = 0
    this.phase = 'playing'
    this.banner = null
    this.hurtFlash = 0
    this.emit(true)
  }

  private clampPlayer() {
    const p = this.player.pos
    const lim = 28.4
    p.x = Math.max(-lim, Math.min(lim, p.x))
    p.z = Math.max(-lim, Math.min(lim, p.z))
    // fog gate 1 blocks entry before trigger
    if (!this.bossActive && !this.bossFell && this.fogPassT <= 0 && !this.player.busy) {
      if (p.z < GATE_Z + 0.9) p.z = GATE_Z + 0.9
    }
    // fog gate 2 corridor blocks entry before trigger
    if (!this.boss2Active && !this.boss2Fell && this.fogPass2T <= 0 && !this.player.busy) {
      if (p.x > GATE2.x + 0.9) p.x = GATE2.x + 0.9
    }
    // the great ash wall is solid — only the gate corridor pierces it
    if (Math.abs(p.x - ASH_WALL_X) < 0.55 && !(p.z > 16.1 && p.z < 19.9)) {
      p.x = p.x < ASH_WALL_X ? ASH_WALL_X - 0.55 : ASH_WALL_X + 0.55
    }
    // arena barriers while fighting
    if (this.bossActiveBarrier && !this.bossFell) {
      p.x = Math.max(BOSS_CENTER.x - 7.6, Math.min(BOSS_CENTER.x + 7.6, p.x))
      p.z = Math.max(-23.2, Math.min(GATE_Z - 0.6, p.z))
    }
    if (this.boss2Barrier && !this.boss2Fell) {
      p.x = Math.max(BOSS2_CENTER.x - 7.2, Math.min(BOSS2_CENTER.x + 7.2, p.x))
      p.z = Math.max(BOSS2_CENTER.z - 7.2, Math.min(BOSS2_CENTER.z + 7.2, p.z))
    }
  }

  private detectPrompt(): string | null {
    if (this.bloodstain && this.bloodstain.mesh.position.distanceTo(this.player.pos) < 1.7) {
      return 'بازیابی سول‌ها'
    }
    if (this.estusShard) {
      const sp = this.estusShard.mesh.position
      if (Math.hypot(this.player.pos.x - sp.x, this.player.pos.z - sp.z) < 1.9) {
        return 'برداشتن تکه‌ی استوس'
      }
    }
    if (this.pyroItem) {
      const sp = this.pyroItem.mesh.position
      if (Math.hypot(this.player.pos.x - sp.x, this.player.pos.z - sp.z) < 1.9) {
        return 'برداشتن شعله‌ی پیرمانسی'
      }
    }
    if (this.emberItem) {
      const sp = this.emberItem.mesh.position
      if (Math.hypot(this.player.pos.x - sp.x, this.player.pos.z - sp.z) < 1.9) {
        return 'برداشتن اخگر بزرگ'
      }
    }
    const bPos = new THREE.Vector3(BONFIRE.x, this.world.surfaceAt(BONFIRE.x, BONFIRE.z), BONFIRE.z)
    if (bPos.distanceTo(this.player.pos) < 2.6) return 'استراحت در آتش کمپ'
    if (!this.bossActive && !this.bossFell && this.player.pos.z < GATE_Z + 3.2 && this.player.pos.z > GATE_Z - 1) {
      return 'عبور از دیوار مه'
    }
    if (
      !this.boss2Active && !this.boss2Fell &&
      this.player.pos.x > GATE2.x - 2.4 && this.player.pos.x < GATE2.x + 2.0 &&
      this.player.pos.z > 16.2 && this.player.pos.z < 19.8
    ) {
      return 'عبور از دیوار مه دوم'
    }
    return null
  }

  private loop(rawDt: number) {
    // periodic shadow map refresh (big perf win)
    this.shadowTimer += rawDt
    if (this.shadowTimer > 0.15) {
      this.shadowTimer = 0
      this.sun.shadow.needsUpdate = true
    }

    // hitstop slow-mo
    let dt = rawDt
    if (this.hitstop > 0) {
      this.hitstop -= rawDt
      dt = rawDt * 0.08
    }
    this.time += dt

    const input = this.engine.input

    if (this.phase === 'menu') {
      // slow orbit around bonfire
      this.camYaw += dt * 0.12
      this.world.update(dt)
      this.updateBonfire(dt)
      this.player.h.group.position.copy(this.player.pos)
      this.player.h.group.rotation.y = this.player.yaw
      this.updateCameraMenu(dt)
      this.drawMinimap()
      this.emit(false)
      return
    }

    if (this.phase === 'dead') {
      this.deadT += rawDt
      this.player.update({ input, camYaw: this.camYaw, dt, world: this.world, game: this })
      this.world.update(dt)
      this.updateBonfire(dt)
      this.updateEffects(dt)
      if (this.deadT > 2.9) {
        this.deadT = 0
        this.respawn()
      }
      this.updateCameraFollow(dt, true)
      this.drawMinimap()
      this.emit(false)
      return
    }

    if (this.phase === 'rest') {
      // Escape also leaves the bonfire menu
      if (input.consume('Escape')) {
        this.leaveRest()
        return
      }
      this.world.update(dt)
      this.updateBonfire(dt)
      this.updateEffects(dt)
      this.updateCameraFollow(dt, false)
      this.drawMinimap()
      this.emit(false)
      return
    }

    /* ---- playing ---- */

    // camera input
    const { dx, dy } = input.takeMouse()
    if (dx !== 0 || dy !== 0) this.lockLastMove = 0
    else this.lockLastMove += dt
    const sens = 0.0031
    this.camYaw -= dx * sens
    this.camPitch += dy * sens
    this.camPitch = Math.max(-0.45, Math.min(1.15, this.camPitch))
    const wheel = input.takeWheel()
    if (wheel !== 0) this.camDistTarget = Math.max(3.4, Math.min(8.5, this.camDistTarget + wheel * 0.004))
    this.camDist += (this.camDistTarget - this.camDist) * Math.min(1, 8 * dt)

    // global keys
    if (input.consume('KeyQ')) this.toggleLock()
    if (input.consume('KeyF')) this.interact()
    if (input.consume('Escape')) {
      this.player.lockedTarget = null
      input.releaseLock()
    }

    // fog pass 1 animation — north gate
    if (this.fogPassT > 0) {
      this.fogPassT -= dt
      this.player.pos.z -= 5.5 * dt
      // swing the camera around to face the boss arena cinematically
      let dYaw = -this.camYaw
      while (dYaw > Math.PI) dYaw -= Math.PI * 2
      while (dYaw < -Math.PI) dYaw += Math.PI * 2
      this.camYaw += dYaw * Math.min(1, 5 * dt)
      this.camPitch += (0.32 - this.camPitch) * Math.min(1, 4 * dt)
      if (this.fogPassT <= 0) {
        this.bossActive = true
        this.bossActiveBarrier = true
        this.boss.active = true
        this.sfx.bossRoar()
        this.shake = Math.max(this.shake, 0.4)
      }
    }

    // fog pass 2 animation — east gate into the Flame King's arena
    if (this.fogPass2T > 0) {
      this.fogPass2T -= dt
      this.player.pos.x += 5.5 * dt
      let dY2 = -Math.PI / 2 - this.camYaw
      while (dY2 > Math.PI) dY2 -= Math.PI * 2
      while (dY2 < -Math.PI) dY2 += Math.PI * 2
      this.camYaw += dY2 * Math.min(1, 5 * dt)
      this.camPitch += (0.32 - this.camPitch) * Math.min(1, 4 * dt)
      if (this.fogPass2T <= 0) {
        this.boss2Active = true
        this.boss2Barrier = true
        this.boss2.active = true
        this.sfx.bossRoar()
        this.shake = Math.max(this.shake, 0.4)
      }
    }

    // ash-wastes ambience — the sky reddens east of the great wall
    const inAsh = this.player.pos.x > ASH_WALL_X - 0.6
    const fog = this.engine.scene.fog as THREE.Fog
    const bg = this.engine.scene.background as THREE.Color
    fog.color.lerp(this.tmpColor.set(inAsh ? 0x261016 : 0x101720), Math.min(1, 2.5 * dt))
    bg.lerp(this.tmpColor.set(inAsh ? 0x1c0c10 : 0x101720), Math.min(1, 2.5 * dt))

    // lava burns whoever stands in it
    this.lavaTick -= dt
    if (this.lavaTick <= 0 && this.player.alive && this.fogPassT <= 0 && this.fogPass2T <= 0) {
      const px = Math.round(this.player.pos.x)
      const pz = Math.round(this.player.pos.z)
      let inLava = LAVA_POOLS.some((p) => px >= p.x0 && px <= p.x1 && pz >= p.z0 && pz <= p.z1)
      if (!inLava) {
        inLava = this.lavaPools.some(
          (lp) => Math.hypot(this.player.pos.x - lp.x, this.player.pos.z - lp.z) < 2.2
        )
      }
      if (inLava) {
        this.lavaTick = 0.55
        const dmg = 8
        if (
          this.player.takeDamage(
            dmg,
            this.player.pos.x + (Math.random() - 0.5),
            this.player.pos.z + (Math.random() - 0.5),
            this
          )
        ) {
          this.onPlayerHit(dmg)
          this.spawnBurst(this.player.pos.clone().add(new THREE.Vector3(0, 0.4, 0)), 0xff7a1e, 8, 1.8, 0.4, 0.12)
        }
      }
    }

    // lock-on validity + soft camera pull
    if (this.player.lockedTarget) {
      const lt = this.player.lockedTarget
      const e = this.allEnemies.find((en) => en.pos === lt.pos)
      if (!e || e.dead) {
        this.player.lockedTarget = null
      } else if (e.pos.distanceTo(this.player.pos) > 17) {
        this.player.lockedTarget = null
      } else if (this.lockLastMove > 0.8) {
        const desired = e.yaw + Math.PI
        let d = desired - this.camYaw
        while (d > Math.PI) d -= Math.PI * 2
        while (d < -Math.PI) d += Math.PI * 2
        this.camYaw += d * Math.min(1, 2.2 * dt)
      }
    }

    this.clampPlayer()
    this.player.update({ input, camYaw: this.camYaw, dt, world: this.world, game: this })

    // death transition
    if (this.player.state === 'dead') {
      this.phase = 'dead'
      this.deadT = 0
      this.spawnBloodstain()
      this.player.lockedTarget = null
      input.releaseLock()
      this.sfx.death()
      this.emit(true)
      return
    }

    for (const e of this.enemies) e.update(dt, this.player, this)
    if (!this.bossFell) this.boss.update(dt, this.player, this)
    if (!this.boss2Fell) this.boss2.update(dt, this.player, this)

    this.world.update(dt)
    this.updateBonfire(dt)
    this.updateEffects(dt)
    this.updateOrbs(dt)

    // prompt
    this.prompt = this.fogPassT > 0 || this.fogPass2T > 0 ? null : this.detectPrompt()
    if (this.prompt && input.isTouch && input.consume('TouchInteract')) this.interact()

    // banner timer
    if (this.banner) {
      this.bannerT += rawDt
      if ((this.banner === 'bossfell' || this.banner === 'bossfell2') && this.bannerT > 3.6) {
        this.banner = null
        this.emit(true)
      }
    }

    // hurt vignette decay
    this.hurtFlash = Math.max(0, this.hurtFlash - rawDt * 1.6)
    const lowHp = this.player.hp / this.player.maxHp < 0.25 && this.player.alive
    const vig = Math.max(this.hurtFlash, lowHp ? 0.22 + Math.sin(this.time * 5) * 0.08 : 0)
    this.vignette.style.opacity = String(vig)

    this.updateCameraFollow(dt, false)
    this.updateReticle()
    this.drawMinimap()
    this.emit(false)
  }

  private updateBonfire(dt: number) {
    this.bonfireLight.intensity = 2.6 + Math.sin(this.time * 13) * 0.35 + Math.random() * 0.3
    const pos = this.bonfireFlame.geometry.getAttribute('position') as THREE.BufferAttribute
    const bY = this.world.surfaceAt(BONFIRE.x, BONFIRE.z)
    for (let i = 0; i < pos.count; i++) {
      const seed = this.flameSeeds[i]
      const cycle = (this.time * (0.8 + seed * 0.7) + seed * 3) % 1
      const ang = seed * Math.PI * 2 + this.time * (0.5 + seed)
      const r = 0.28 * (1 - cycle)
      pos.setXYZ(
        i,
        BONFIRE.x + Math.cos(ang) * r,
        bY + 0.15 + cycle * 1.7,
        BONFIRE.z + Math.sin(ang) * r
      )
    }
    pos.needsUpdate = true
    void dt
  }

  private updateEffects(dt: number) {
    this.bursts = this.bursts.filter((b) => b.update(dt, this.engine.scene))
    this.texts = this.texts.filter((t) => t.update(dt, this.engine.scene))
    // boss slam/stomp shockwave rings
    this.waves = this.waves.filter((w) => w.update(dt))
    // skeleton arrows
    this.arrows = this.arrows.filter((a) => {
      const alive = a.update(dt)
      if (!alive) a.dispose(this.engine.scene)
      return alive
    })
    // fireballs — pyromancy & flame foes
    this.fireballs = this.fireballs.filter((f) => {
      const alive = f.update(dt)
      if (!alive) f.dispose(this.engine.scene)
      return alive
    })
    // temporary molten patches from the Flame King's slams
    this.lavaPools = this.lavaPools.filter((lp) => {
      lp.t += dt
      const mat = lp.mesh.material as THREE.MeshBasicMaterial
      mat.opacity = Math.max(0, 1 - Math.max(0, lp.t - 3) / 1.5)
      if (lp.t >= 4.5) {
        this.engine.scene.remove(lp.mesh)
        lp.mesh.geometry.dispose()
        mat.dispose()
        return false
      }
      return true
    })
    // creeper explosion flash lights
    this.boomLights = this.boomLights.filter((b) => {
      b.t += dt
      b.light.intensity = Math.max(0, 7 * (1 - b.t / 0.4))
      if (b.t >= 0.4) {
        this.engine.scene.remove(b.light)
        b.light.dispose()
        return false
      }
      return true
    })
    // bloodstain bob
    if (this.bloodstain) {
      this.bloodstain.mesh.rotation.y += dt * 1.5
      this.bloodstain.mesh.position.y += Math.sin(this.time * 3) * dt * 0.12
    }
    // estus shard bob + spin
    if (this.estusShard) {
      this.estusShard.mesh.rotation.y += dt * 1.6
      this.estusShard.mesh.position.y += Math.sin(this.time * 2.4) * dt * 0.16
      this.estusShard.light.intensity = 2 + Math.sin(this.time * 4.2) * 0.5
    }
    // pyromancy flame loot bob + spin
    if (this.pyroItem) {
      this.pyroItem.mesh.rotation.y += dt * 1.8
      this.pyroItem.mesh.position.y += Math.sin(this.time * 2.6) * dt * 0.14
      this.pyroItem.light.intensity = 2 + Math.sin(this.time * 5) * 0.5
    }
    // great ember bob + spin
    if (this.emberItem) {
      this.emberItem.mesh.rotation.y += dt * 2
      this.emberItem.mesh.position.y += Math.sin(this.time * 2.8) * dt * 0.16
      this.emberItem.light.intensity = 2.4 + Math.sin(this.time * 5.5) * 0.6
    }
  }

  private updateOrbs(dt: number) {
    this.orbs = this.orbs.filter((o) => {
      o.t += dt / 0.7
      const target = this.player.pos.clone().add(new THREE.Vector3(0, 1.1, 0))
      o.mesh.position.lerpVectors(o.from, target, Math.min(1, o.t))
      o.mesh.rotation.y += dt * 6
      if (o.t >= 1) {
        this.engine.scene.remove(o.mesh)
        this.player.souls += o.amount
        this.sfx.souls()
        this.spawnBurst(target, 0x59ff6a, 10, 2)
        return false
      }
      return true
    })
  }

  private updateCameraMenu(dt: number) {
    const bY = this.world.surfaceAt(BONFIRE.x, BONFIRE.z)
    this.camTarget.set(BONFIRE.x, bY + 1.2, BONFIRE.z)
    const d = 6.2
    this.camPos.set(
      this.camTarget.x + Math.sin(this.camYaw) * d,
      this.camTarget.y + 2.2,
      this.camTarget.z + Math.cos(this.camYaw) * d
    )
    this.engine.camera.position.lerp(this.camPos, Math.min(1, 3 * dt))
    this.engine.camera.lookAt(this.camTarget)
  }

  private updateCameraFollow(dt: number, dead: boolean) {
    const p = this.player
    this.camTarget.set(p.pos.x, p.pos.y + 1.5, p.pos.z)
    const dist = dead ? this.camDist + 2.5 : this.camDist
    const cp = Math.max(0.12, this.camPitch)
    let cx = this.camTarget.x + Math.sin(this.camYaw) * Math.cos(cp) * dist
    let cz = this.camTarget.z + Math.cos(this.camYaw) * Math.cos(cp) * dist
    let cy = this.camTarget.y + Math.sin(cp) * dist
    // keep above ground
    const ground = this.world.surfaceAt(cx, cz) + 0.45
    if (cy < ground) cy = ground
    this.camPos.set(cx, cy, cz)
    this.engine.camera.position.lerp(this.camPos, Math.min(1, 11 * dt))
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt * 1.8)
      const s = this.shake * 0.25
      this.engine.camera.position.x += (Math.random() - 0.5) * s
      this.engine.camera.position.y += (Math.random() - 0.5) * s
    }
    this.engine.camera.lookAt(this.camTarget)
  }

  private updateReticle() {
    const lt = this.player.lockedTarget
    if (!lt || !lt.alive || this.phase !== 'playing') {
      this.reticle.style.display = 'none'
      return
    }
    const v = lt.pos.clone().add(new THREE.Vector3(0, lt.isBoss ? 3.6 : 1.7, 0))
    v.project(this.engine.camera)
    if (v.z > 1) {
      this.reticle.style.display = 'none'
      return
    }
    const w = this.container.clientWidth
    const h = this.container.clientHeight
    this.reticle.style.display = 'block'
    this.reticle.style.left = `${(v.x * 0.5 + 0.5) * w}px`
    this.reticle.style.top = `${(-v.y * 0.5 + 0.5) * h}px`
  }

  private emit(force: boolean) {
    if (!this.onState) return
    const p = this.player
    const ab = this.activeBoss
    const s: HudState = {
      phase: this.phase,
      hp: Math.max(0, Math.round(p.hp)),
      maxHp: p.maxHp,
      st: Math.round(p.stamina),
      maxSt: p.maxStamina,
      souls: Math.floor(p.souls),
      level: p.level,
      estus: p.estus,
      maxEstus: p.maxEstus,
      vit: p.vit,
      end: p.end,
      str: p.str,
      nextCost: this.nextCost(),
      bossName: ab ? ab.name : null,
      bossHp: ab ? Math.max(0, Math.round(ab.hp)) : 0,
      bossMax: ab ? ab.maxHp : 0,
      prompt: this.phase === 'playing' ? this.prompt : null,
      banner: this.phase === 'dead' ? 'died' : this.banner,
      blocking: p.state === 'block',
      pyro: p.pyro,
      maxPyro: p.maxPyro,
      pyroUnlocked: p.pyroUnlocked,
    }
    const json = JSON.stringify(s)
    if (force || json !== this.lastHudJson) {
      this.lastHudJson = json
      this.onState(s)
    }
  }
}

/* small helper re-export for player strike definition */
export type { PlayerStrikeDef }
