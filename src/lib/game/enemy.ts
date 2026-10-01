import * as THREE from 'three'
import {
  createHumanoid, createBow, createBlazeRods, animIdle, animWalk, animZombieWalk, animAttack, animHit, animDead,
  animRoar, animSlam, animSweep, animCharge, animStomp, animStagger, animBossDead,
  animBowDraw, animBowShoot, animPoke, lerp,
  resetPose, setOpacity, setFlash, setFlashWhite, type Humanoid,
} from './models'
import { ASH_WALL_X, BONFIRE, type World } from './world'
import type { Game } from './game'
import type { Player } from './player'

export type EnemyState =
  | 'idle' | 'chase' | 'return' | 'windup' | 'strike' | 'recover'
  | 'hitstun' | 'roar' | 'stagger' | 'dead'

export interface EnemyOpts {
  hp: number
  dmg: number
  speed: number
  aggro: number
  atkRange: number
  windup: number
  recover: number
  souls: number
  scale: number
  isBoss?: boolean
  name?: string
}

export class Enemy {
  h: Humanoid
  pos = new THREE.Vector3()
  home = new THREE.Vector3()
  yaw = 0
  hp: number
  maxHp: number
  state: EnemyState = 'idle'
  stateT = 0
  cd = 0
  animT = Math.random() * 10
  dead = false
  deathT = 0
  flash = 0
  isBoss: boolean
  name: string
  active = true

  protected opts: EnemyOpts
  private wanderT = 0
  private wanderTarget = new THREE.Vector3()
  private strikeDone = false
  private stunDur = 0.38
  world?: World

  constructor(scene: THREE.Scene, kind: 'zombie' | 'boss' | 'creeper' | 'skeleton' | 'wither' | 'blaze' | 'bossflame', spawn: THREE.Vector3, opts: EnemyOpts) {
    this.opts = opts
    this.hp = opts.hp
    this.maxHp = opts.hp
    this.isBoss = !!opts.isBoss
    this.name = opts.name ?? 'Hollow'
    this.h = createHumanoid(kind, opts.scale, {
      sword: kind === 'zombie' || kind === 'boss' || kind === 'wither',
      swordScale: kind === 'boss' ? 1.9 : 1,
    })
    this.pos.copy(spawn)
    this.home.copy(spawn)
    scene.add(this.h.group)
    this.syncModel()
  }

  get alive() {
    return !this.dead
  }

  soulsValue() {
    return this.opts.souls
  }

  reset() {
    this.pos.copy(this.home)
    this.hp = this.maxHp
    this.state = 'idle'
    this.stateT = 0
    this.cd = 0
    this.dead = false
    this.deathT = 0
    this.flash = 0
    this.strikeDone = false
    setOpacity(this.h, 1)
    setFlash(this.h, 0)
    resetPose(this.h)
    this.h.group.visible = true
    this.syncModel()
  }

  takeDamage(dmg: number, game: Game, fromX: number, fromZ: number) {
    if (this.dead) return
    this.hp -= dmg
    this.flash = 1
    game.spawnDamageText(dmg, this.pos, this.isBoss ? 4 : 2.2)
    if (this.hp <= 0) {
      this.hp = 0
      this.dead = true
      this.state = 'dead'
      this.stateT = 0
      game.onEnemyKilled(this)
    } else {
      const stun = this.isBoss ? 0.13 : 0.38
      this.state = 'hitstun'
      this.stateT = 0
      this.stunDur = stun
      const kb = this.isBoss ? 0.25 : 1.4
      const dx = this.pos.x - fromX
      const dz = this.pos.z - fromZ
      const l = Math.hypot(dx, dz) || 1
      this.pos.x += (dx / l) * kb * 0.12
      this.pos.z += (dz / l) * kb * 0.12
    }
  }

  update(dt: number, player: Player, game: Game) {
    this.animT += dt
    this.flash = Math.max(0, this.flash - dt * 4)
    setFlash(this.h, this.flash * 0.55)

    if (this.dead) {
      this.deathT += dt
      this.deathAnim(Math.min(1, this.stateT / this.deathDur()))
      this.stateT += dt
      const holdT = this.deathDur() + 0.2
      if (this.deathT > holdT) {
        const fade = Math.max(0, 1 - (this.deathT - holdT) / 1.1)
        setOpacity(this.h, fade)
        if (fade <= 0) this.h.group.visible = false
      }
      return
    }

    const dx = player.pos.x - this.pos.x
    const dz = player.pos.z - this.pos.z
    const dist = Math.hypot(dx, dz)
    const angleToPlayer = Math.atan2(dx, dz)
    // signed angle between current facing and the player direction
    let angDiff = angleToPlayer - this.yaw
    while (angDiff > Math.PI) angDiff -= Math.PI * 2
    while (angDiff < -Math.PI) angDiff += Math.PI * 2
    // bonfire safe zone – hollows will not pursue the unkindled who rest
    const playerSafe =
      Math.hypot(player.pos.x - BONFIRE.x, player.pos.z - BONFIRE.z) < 5.5

    this.cd = Math.max(0, this.cd - dt)

    switch (this.state) {
      case 'idle': {
        if (!this.active) {
          animIdle(this.h, this.animT)
          break
        }
        if (!playerSafe && dist < this.opts.aggro) {
          this.state = 'chase'
          break
        }
        this.wanderT -= dt
        if (this.wanderT <= 0) {
          this.wanderT = 2.5 + Math.random() * 2.5
          this.wanderTarget.set(
            this.home.x + (Math.random() - 0.5) * 6,
            0,
            this.home.z + (Math.random() - 0.5) * 6
          )
        }
        const wx = this.wanderTarget.x - this.pos.x
        const wz = this.wanderTarget.z - this.pos.z
        const wd = Math.hypot(wx, wz)
        if (wd > 0.4) {
          this.pos.x += (wx / wd) * 1.1 * dt
          this.pos.z += (wz / wd) * 1.1 * dt
          this.yaw = Math.atan2(wx, wz)
          animWalk(this.h, this.animT, 0.5)
        } else {
          animIdle(this.h, this.animT)
        }
        break
      }
      case 'chase': {
        if (playerSafe) {
          this.state = 'return'
          break
        }
        if (dist > this.opts.aggro + 7 || Math.hypot(this.home.x - this.pos.x, this.home.z - this.pos.z) > 18) {
          this.state = 'return'
          break
        }
        if (this.cd <= 0 && this.wantsAttack(dist, angDiff)) {
          this.state = 'windup'
          this.stateT = 0
          this.strikeDone = false
          this.onWindupStart(game, dist, angDiff)
          break
        }
        this.chaseMove(dt, dx, dz, dist, angleToPlayer)
        break
      }
      case 'return': {
        const hx = this.home.x - this.pos.x
        const hz = this.home.z - this.pos.z
        const hd = Math.hypot(hx, hz)
        if (hd < 0.6) {
          this.state = 'idle'
          this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.5)
          break
        }
        this.yaw = Math.atan2(hx, hz)
        this.pos.x += (hx / hd) * this.opts.speed * 0.8 * dt
        this.pos.z += (hz / hd) * this.opts.speed * 0.8 * dt
        animWalk(this.h, this.animT, 0.8)
        break
      }
      case 'windup': {
        if (this.windupShouldCancel(dist)) {
          this.state = 'chase'
          break
        }
        this.yaw = angleToPlayer
        this.stateT += dt
        const w = this.windupDur()
        const p = Math.min(1, this.stateT / w)
        this.windupAnim(p)
        if (this.stateT >= w) {
          this.state = 'strike'
          this.stateT = 0
          this.strikeDone = false
          this.onStrikeStart(player, game)
        }
        break
      }
      case 'strike': {
        this.stateT += dt
        const dur = this.strikeDur()
        const p = Math.min(1, this.stateT / dur)
        this.strikeAnim(p)
        this.strikeMove(dt, p, player, game)
        if (!this.strikeDone && p >= this.strikeImpactP()) {
          this.strikeDone = true
          this.doStrike(player, game, dist, angleToPlayer)
        }
        if (p >= 1) {
          this.state = 'recover'
          this.stateT = 0
        }
        break
      }
      case 'recover': {
        this.stateT += dt
        const p = this.stateT / this.opts.recover
        this.recoverAnim(p)
        if (p >= 1) {
          this.state = 'chase'
          this.cd = this.attackCooldown()
        }
        break
      }
      case 'roar': {
        // cinematic, uninterruptible (handled per-subclass in takeDamage)
        this.stateT += dt
        const p = Math.min(1, this.stateT / this.roarDur())
        this.roarAnim(p)
        if (p >= 1) {
          this.state = 'chase'
          this.stateT = 0
          this.cd = 0.5
        }
        break
      }
      case 'stagger': {
        // posture broken — wide-open punish window
        this.stateT += dt
        const p = Math.min(1, this.stateT / this.staggerDur())
        this.staggerAnim(p)
        if (p >= 1) {
          this.state = 'chase'
          this.stateT = 0
          this.cd = 0.6
        }
        break
      }
      case 'hitstun': {
        this.stateT += dt
        const p = Math.min(1, this.stateT / this.stunDur)
        animHit(this.h, p)
        if (p >= 1) this.state = 'chase'
        break
      }
    }

    // separation from other enemies
    for (const other of game.allEnemies) {
      if (other === this || other.dead) continue
      const ox = this.pos.x - other.pos.x
      const oz = this.pos.z - other.pos.z
      const od = Math.hypot(ox, oz)
      if (od < 1.1 && od > 0.001) {
        const push = (1.1 - od) * 0.5
        this.pos.x += (ox / od) * push
        this.pos.z += (oz / od) * push
      }
    }

    // personal-space separation from the PLAYER — without this, enemies
    // walk inside the player's body: block arcs degenerate (dot ≈ 0),
    // strike cones whiff at point-blank, and the camera clips through them
    const pr = this.isBoss ? 1.5 : 0.72
    const pdx = this.pos.x - player.pos.x
    const pdz = this.pos.z - player.pos.z
    const pd = Math.hypot(pdx, pdz)
    if (pd < pr && pd > 0.001) {
      const push = (pr - pd) * 0.6
      this.pos.x += (pdx / pd) * push
      this.pos.z += (pdz / pd) * push
    }

    this.clamp()
    this.syncModel()
  }

  protected speed() {
    return this.opts.speed
  }

  /* ---- virtual hooks (overridden by special enemy classes) ---- */

  /** decide whether to start an attack from the current chase position */
  protected wantsAttack(dist: number, _angDiff: number): boolean {
    return dist <= this.opts.atkRange
  }

  /** movement + facing during chase — overridden by ranged enemies (kiting) */
  protected chaseMove(dt: number, dx: number, dz: number, dist: number, angleToPlayer: number) {
    this.yaw = angleToPlayer
    this.pos.x += (dx / (dist || 1)) * this.speed() * dt
    this.pos.z += (dz / (dist || 1)) * this.speed() * dt
    animZombieWalk(this.h, this.animT, this.isBoss ? 1.25 : 1)
  }

  protected attackCooldown() {
    return 1.1 + Math.random() * 0.8
  }

  protected windupDur() {
    return this.opts.windup
  }

  protected strikeDur() {
    return this.isBoss ? 0.32 : 0.22
  }

  /** normalized progress (0..1) inside the strike at which damage lands */
  protected strikeImpactP() {
    return 0.4
  }

  protected onWindupStart(_game: Game | undefined, _dist: number, _angDiff: number) {}

  /** return true to abort the windup (e.g. creeper defusing) */
  protected windupShouldCancel(_dist: number): boolean {
    return false
  }

  protected onStrikeStart(_player: Player, _game: Game) {}

  /** movement during the strike state (e.g. charge dash) */
  protected strikeMove(_dt: number, _p: number, _player: Player, _game: Game) {}

  protected windupAnim(p: number) {
    resetPose(this.h)
    this.h.armR.rotation.x = -2.8 * p
    this.h.armR.rotation.z = -0.4 * p
    this.h.root.rotation.y = 0.35 * p
  }

  protected strikeAnim(p: number) {
    animAttack(this.h, p, 'light0')
  }

  protected recoverAnim(p: number) {
    resetPose(this.h)
    this.h.armR.rotation.x = 0.9 * (1 - p)
  }

  protected roarDur() {
    return 0.001
  }

  protected roarAnim(_p: number) {}

  protected staggerDur() {
    return 0.001
  }

  protected staggerAnim(_p: number) {}

  protected deathDur() {
    return 0.9
  }

  protected deathAnim(p: number) {
    animDead(this.h, p)
  }

  protected doStrike(player: Player, game: Game, dist: number, angleToPlayer: number) {
    const reach = this.opts.atkRange + 0.6
    let angDiff = angleToPlayer - this.yaw
    while (angDiff > Math.PI) angDiff -= Math.PI * 2
    while (angDiff < -Math.PI) angDiff += Math.PI * 2
    if (dist < reach && Math.abs(angDiff) < 1.15) {
      const dmg = Math.round(this.opts.dmg * (0.9 + Math.random() * 0.2))
      if (player.takeDamage(dmg, this.pos.x, this.pos.z, game)) game.onPlayerHit(dmg)
    }
  }

  protected clamp() {
    const lim = 28.4
    this.pos.x = Math.max(-lim, Math.min(lim, this.pos.x))
    this.pos.z = Math.max(-lim, Math.min(lim, this.pos.z))
    // the great ash wall is solid — only the fog-gate corridor pierces it
    if (Math.abs(this.pos.x - ASH_WALL_X) < 0.6 && !(this.pos.z > 15.8 && this.pos.z < 20.2)) {
      this.pos.x = this.pos.x < ASH_WALL_X ? ASH_WALL_X - 0.6 : ASH_WALL_X + 0.6
    }
  }

  protected syncModel() {
    this.h.group.position.copy(this.pos)
    this.h.group.rotation.y = this.yaw
    if (this.world) {
      this.h.group.position.y = this.world.surfaceAt(this.pos.x, this.pos.z)
    }
  }
}

/* ================= BOSS ================= */

type BossMove = 'slam' | 'sweep' | 'charge' | 'stomp'

export class BossEnemy extends Enemy {
  private pick: BossMove = 'slam'
  private followUp: BossMove | null = null // queued phase-2 combo
  private poise = 0
  private maxPoise = 150
  private phase2Done = false
  private introDone = false
  private dashDir = new THREE.Vector3(0, 0, 1)
  private chargeHit = false
  private dustT = 0

  constructor(scene: THREE.Scene, spawn: THREE.Vector3) {
    super(scene, 'boss', spawn, {
      hp: 680,
      dmg: 38,
      speed: 3.1,
      aggro: 60,
      atkRange: 3.3,
      windup: 0.85,
      recover: 0.95,
      souls: 3000,
      scale: 2.25,
      isBoss: true,
      name: 'شوالیه‌ی زامبی کهن',
    })
    this.active = false
  }

  phase2() {
    return this.hp < this.maxHp * 0.5
  }

  reset() {
    super.reset()
    this.active = false
    this.pick = 'slam'
    this.followUp = null
    this.poise = 0
    this.phase2Done = false
    this.introDone = false
    this.chargeHit = false
    setFlash(this.h, 0)
  }

  update(dt: number, player: Player, game: Game) {
    // ---- intro roar on first activation ----
    if (this.active && !this.introDone && !this.dead) {
      this.introDone = true
      this.state = 'roar'
      this.stateT = 0
      game.onBossIntro(this.pos)
    }
    // ---- phase-2 awakening (uninterruptible cinematic) ----
    if (!this.phase2Done && !this.dead && this.hp > 0 && this.hp < this.maxHp * 0.5) {
      this.phase2Done = true
      this.state = 'roar'
      this.stateT = 0
      game.onBossPhase2()
    }
    super.update(dt, player, game)
    // ---- phase-2 smoldering red aura ----
    if (this.phase2Done && !this.dead) {
      const pulse = 0.16 + Math.sin(this.animT * 5.5) * 0.07
      setFlash(this.h, this.flash * 0.55 + pulse)
    }
  }

  /** poise/stagger works in every phase — sustained aggression is always
      rewarded with a posture break; roar windows keep the cinematic */
  takeDamage(dmg: number, game: Game, fromX: number, fromZ: number) {
    const wasRoar = this.state === 'roar'
    const roarT = this.stateT
    const wasStaggered = this.state === 'stagger'
    super.takeDamage(dmg, game, fromX, fromZ)
    if (this.dead) return
    if (wasRoar) {
      // cinematic window — damage lands (so attacks feel responsive and
      // show numbers) but the roar is never interrupted or re-staggered
      this.state = 'roar'
      this.stateT = roarT
      return
    }
    if (wasStaggered) {
      // keep soaking hits without re-staggering, stay slumped
      this.state = 'stagger'
      return
    }
    this.poise += dmg
    if (this.poise >= this.maxPoise) {
      this.poise = 0
      this.state = 'stagger'
      this.stateT = 0
      game.onBossStagger(this.pos)
    }
  }

  protected speed() {
    return this.opts.speed * (this.phase2() ? 1.35 : 1)
  }

  protected attackCooldown() {
    if (this.phase2() && this.followUp) return 0.14 // chained combo
    return this.phase2() ? 0.35 + Math.random() * 0.3 : 0.8 + Math.random() * 0.4
  }

  /** context-aware attack selection — fixes the "always beeline" weakness */
  protected wantsAttack(dist: number, angDiff: number): boolean {
    if (dist > 7.5) return true // long-range charge (anti-kite)
    if (this.phase2() && dist > 5.6) return true // faster gap-closer when enraged
    if (dist <= 3.6) return true
    return Math.abs(angDiff) > 1.5 && dist < 4.6
  }

  protected windupDur() {
    const base =
      this.pick === 'slam' ? 0.85 : this.pick === 'sweep' ? 0.55 : this.pick === 'charge' ? 0.7 : 0.62
    return this.phase2() ? base * 0.72 : base
  }

  protected strikeDur() {
    switch (this.pick) {
      case 'slam': return 0.58
      case 'sweep': return 0.36
      case 'charge': return 0.55
      case 'stomp': return 0.5
    }
  }

  protected strikeImpactP() {
    if (this.pick === 'slam') return 0.56
    if (this.pick === 'sweep') return 0.45
    if (this.pick === 'stomp') return 0.5
    return 2 // charge damage is contact-based during the dash
  }

  /* ---- pick the move + queue phase-2 combo chains ---- */
  protected onWindupStart(_game: Game | undefined, dist: number, angDiff: number) {
    const chained = this.followUp
    this.followUp = null
    if (dist > 7.5) {
      this.pick = 'charge'
    } else if (chained && dist < 5.2) {
      this.pick = chained
    } else if (dist < 2.2) {
      // point-blank hug — the knee answers faster than the greatsword
      this.pick = Math.random() < 0.65 ? 'stomp' : 'slam'
    } else {
      this.pick = Math.random() < 0.52 ? 'slam' : 'sweep'
    }
    if (this.phase2()) {
      if (this.pick === 'slam' && Math.random() < 0.5) this.followUp = 'sweep'
      else if (this.pick === 'sweep' && Math.random() < 0.42) this.followUp = 'slam'
    }
  }

  protected onStrikeStart(player: Player, game: Game) {
    if (this.pick === 'charge') {
      const dx = player.pos.x - this.pos.x
      const dz = player.pos.z - this.pos.z
      const l = Math.hypot(dx, dz) || 1
      this.dashDir.set(dx / l, 0, dz / l)
      this.chargeHit = false
      game.sfx.dash()
    }
  }

  /* ---- windup poses (telegraphs) ---- */
  protected windupAnim(p: number) {
    resetPose(this.h)
    if (this.pick === 'slam') {
      // both arms overhead, chest open
      this.h.armR.rotation.x = -3.0 * p
      this.h.armL.rotation.x = -2.7 * p
      this.h.root.rotation.x = -0.18 * p
    } else if (this.pick === 'sweep') {
      // sword arm drawn back flat
      this.h.armR.rotation.x = -2.4 * p
      this.h.armR.rotation.z = -0.9 * p
      this.h.root.rotation.y = 0.6 * p
    } else if (this.pick === 'charge') {
      // crouches low, scraping the ground — get out of the lane!
      this.h.root.position.y = -0.22 * p
      this.h.root.rotation.x = 0.42 * p
      this.h.armR.rotation.x = -0.9 * p
      this.h.armL.rotation.x = 1.1 * p
      this.h.legL.rotation.x = 0.7 * p
      this.h.legR.rotation.x = -0.55 * p
      this.h.head.rotation.x = -0.3 * p
    } else {
      // stomp windup: knee rises, arms spread for balance
      this.h.legR.rotation.x = -1.35 * p
      this.h.armL.rotation.x = -0.8 * p
      this.h.armR.rotation.x = -0.8 * p
      this.h.armL.rotation.z = 0.5 * p
      this.h.armR.rotation.z = -0.5 * p
      this.h.root.position.y = 0.1 * p
    }
  }

  protected strikeAnim(p: number) {
    switch (this.pick) {
      case 'slam': animSlam(this.h, p); break
      case 'sweep': animSweep(this.h, p); break
      case 'charge': animCharge(this.h, p); break
      case 'stomp': animStomp(this.h, p); break
    }
  }

  /** charge dash: forward movement + dust + contact damage */
  protected strikeMove(dt: number, p: number, player: Player, game: Game) {
    if (this.pick !== 'charge') return
    const sp = 15.5 * (1 - 0.35 * p)
    this.pos.x += this.dashDir.x * sp * dt
    this.pos.z += this.dashDir.z * sp * dt
    // dust trail
    this.dustT -= dt
    if (this.dustT <= 0) {
      this.dustT = 0.06
      game.spawnBurst(
        this.pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.8, 0.25, (Math.random() - 0.5) * 0.8)),
        0x9a8b70, 4, 1.6, 0.45, 0.16
      )
    }
    // contact hit once per dash
    if (!this.chargeHit) {
      const d = Math.hypot(player.pos.x - this.pos.x, player.pos.z - this.pos.z)
      if (d < 1.8) {
        this.chargeHit = true
        const dmg = Math.round(this.opts.dmg * 0.8 * (0.9 + Math.random() * 0.2))
        if (player.takeDamage(dmg, this.pos.x, this.pos.z, game)) game.onPlayerHit(dmg)
        game.spawnBurst(this.pos.clone().add(new THREE.Vector3(0, 1.6, 0)), 0xffd27a, 12, 3, 0.4)
      }
    }
  }

  protected recoverAnim(p: number) {
    resetPose(this.h)
    if (this.pick === 'slam') {
      this.h.armR.rotation.x = 0.55 * (1 - p)
      this.h.armL.rotation.x = 0.45 * (1 - p)
      this.h.root.rotation.x = 0.25 * (1 - p)
    } else if (this.pick === 'sweep') {
      this.h.armR.rotation.x = -0.6 * (1 - p)
      this.h.armR.rotation.z = 0.85 * (1 - p)
      this.h.root.rotation.y = -1.1 * (1 - p)
    } else if (this.pick === 'charge') {
      this.h.root.rotation.x = 0.35 * (1 - p)
      this.h.armR.rotation.x = -1.7 * (1 - p)
    } else {
      this.h.legR.rotation.x = 0.5 * (1 - p)
      this.h.root.rotation.x = 0.2 * (1 - p)
    }
  }

  /* ---- roar (intro + phase 2) ---- */
  protected roarDur() {
    return 2.1
  }

  protected roarAnim(p: number) {
    animRoar(this.h, p)
  }

  protected staggerDur() {
    return 1.9
  }

  protected staggerAnim(p: number) {
    animStagger(this.h, p)
  }

  /* ---- cinematic death ---- */
  protected deathDur() {
    return 1.7
  }

  protected deathAnim(p: number) {
    animBossDead(this.h, p)
  }

  protected doStrike(player: Player, game: Game, dist: number, angleToPlayer: number) {
    if (this.pick === 'slam') {
      // AOE impact around the boss + travelling shockwave ring
      if (dist < 4.2) {
        const dmg = Math.round(this.opts.dmg * 1.15 * (0.9 + Math.random() * 0.2))
        if (player.takeDamage(dmg, this.pos.x, this.pos.z, game)) game.onPlayerHit(dmg)
      }
      game.onBossSlam(this.pos)
    } else if (this.pick === 'stomp') {
      // 360° nova — punishes hugging and rear attackers
      if (dist < 3.6) {
        const dmg = Math.round(this.opts.dmg * 0.95 * (0.9 + Math.random() * 0.2))
        if (player.takeDamage(dmg, this.pos.x, this.pos.z, game)) game.onPlayerHit(dmg)
      }
      game.onBossStomp(this.pos)
    } else if (this.pick === 'sweep') {
      const reach = this.opts.atkRange + 1.1
      let angDiff = angleToPlayer - this.yaw
      while (angDiff > Math.PI) angDiff -= Math.PI * 2
      while (angDiff < -Math.PI) angDiff += Math.PI * 2
      if (dist < reach && Math.abs(angDiff) < 2.2) {
        const dmg = Math.round(this.opts.dmg * 0.85 * (0.9 + Math.random() * 0.2))
        if (player.takeDamage(dmg, this.pos.x, this.pos.z, game)) game.onPlayerHit(dmg)
      }
    }
    // charge damage is handled contact-style in strikeMove
  }
}

/* ================= CREEPER ================= */

export class CreeperEnemy extends Enemy {
  constructor(scene: THREE.Scene, spawn: THREE.Vector3) {
    super(scene, 'creeper', spawn, {
      hp: 48,
      dmg: 36,
      speed: 3.5,
      aggro: 12,
      atkRange: 2.1,
      windup: 1.05,
      recover: 0.4,
      souls: 30,
      scale: 0.92,
      name: 'خزنده‌ی سی‌سوخته',
    })
  }

  reset() {
    super.reset()
    this.h.group.scale.setScalar(this.opts.scale)
  }

  protected onWindupStart(game?: Game, _dist?: number, _angDiff?: number) {
    game?.sfx.hiss()
  }

  protected windupShouldCancel(dist: number): boolean {
    return dist > 4.3
  }

  protected windupAnim(p: number) {
    resetPose(this.h)
    // inflating + white fuse flash, trembling faster near detonation
    const s = this.opts.scale * (1 + 0.3 * p * p + Math.sin(p * 34) * 0.05 * p)
    this.h.group.scale.setScalar(s)
    this.h.legL.rotation.x = 0.45 * p
    this.h.legR.rotation.x = -0.45 * p
    setFlashWhite(this.h, p * 0.5 + Math.max(0, Math.sin(p * 26)) * 0.3 * p)
  }

  protected strikeAnim(p: number) {
    resetPose(this.h)
    this.h.group.scale.setScalar(this.opts.scale * (1.3 + 0.15 * p))
    setFlashWhite(this.h, 0.7 + p * 0.3)
  }

  protected doStrike(player: Player, game: Game, dist: number, _angleToPlayer: number) {
    // explosion — blockable from the front, leaves a crater of particles
    if (dist < 3.4) {
      const dmg = Math.round(this.opts.dmg * (0.9 + Math.random() * 0.2))
      if (player.takeDamage(dmg, this.pos.x, this.pos.z, game)) game.onPlayerHit(dmg)
    }
    game.onCreeperBoom(this.pos)
    // self-destruct
    this.hp = 0
    this.dead = true
    this.state = 'dead'
    this.stateT = 0
    this.h.group.visible = false
    game.onEnemyKilled(this)
  }
}

/* ================= SKELETON ARCHER ================= */

/** Ranged enemy — keeps its distance, draws and looses arrows.
    Rush it to force a panicky melee smack, or block/roll the arrows. */
export class SkeletonEnemy extends Enemy {
  private mode: 'shoot' | 'poke' = 'shoot'
  private bow: THREE.Group

  constructor(scene: THREE.Scene, spawn: THREE.Vector3) {
    super(scene, 'skeleton', spawn, {
      hp: 55,
      dmg: 15,
      speed: 2.9,
      aggro: 13.5,
      atkRange: 2.0,
      windup: 0.95,
      recover: 0.55,
      souls: 45,
      scale: 0.97,
      name: 'تیرانداز استخوانی',
    })
    // bow strapped into the LEFT hand (limb axis = local X → upright when aiming)
    this.bow = createBow()
    this.bow.position.set(0, -0.68, 0.05)
    this.bow.rotation.y = Math.PI / 2
    this.h.armL.add(this.bow)
  }

  reset() {
    super.reset()
    this.mode = 'shoot'
    resetPose(this.h)
  }

  protected attackCooldown() {
    return this.mode === 'shoot' ? 1.7 + Math.random() * 1.3 : 1.2 + Math.random() * 0.6
  }

  /** close poke or a volley — depends on how much room the player gives */
  protected wantsAttack(dist: number, _angDiff: number): boolean {
    if (dist < 2.1) return true
    return dist <= 12.5
  }

  protected onWindupStart(_game: Game | undefined, dist: number, _angDiff: number) {
    this.mode = dist < 2.6 ? 'poke' : 'shoot'
  }

  protected windupDur() {
    return this.mode === 'shoot' ? 0.95 : 0.42
  }

  protected strikeDur() {
    return this.mode === 'shoot' ? 0.3 : 0.26
  }

  protected strikeImpactP() {
    return this.mode === 'shoot' ? 0.22 : 0.4
  }

  /* ---- kiting AI: hold the 6..11m band, backpedal when crowded ---- */
  protected chaseMove(dt: number, dx: number, dz: number, dist: number, angleToPlayer: number) {
    this.yaw = angleToPlayer
    const ux = dx / (dist || 1)
    const uz = dz / (dist || 1)
    if (dist < 5.6) {
      // backpedal away, still facing the player (bone-rattling hurry)
      this.pos.x -= ux * this.speed() * 0.85 * dt
      this.pos.z -= uz * this.speed() * 0.85 * dt
      animWalk(this.h, this.animT, 1.15)
    } else if (dist > 11.5) {
      // close the gap to firing range
      this.pos.x += ux * this.speed() * dt
      this.pos.z += uz * this.speed() * dt
      animWalk(this.h, this.animT, 1)
    } else {
      // hold ground + a lazy side-strafe so it never feels frozen
      const sway = Math.sin(this.animT * 1.7) * 0.55
      this.pos.x += -uz * sway * dt
      this.pos.z += ux * sway * dt
      animIdle(this.h, this.animT)
    }
  }

  /* ---- telegraphs ---- */
  protected windupAnim(p: number) {
    resetPose(this.h)
    if (this.mode === 'shoot') {
      animBowDraw(this.h, p)
    } else {
      // panicked raised fist before the poke
      this.h.armR.rotation.x = -2.3 * p
      this.h.armR.rotation.z = -0.3 * p
      this.h.root.rotation.y = -0.25 * p
    }
  }

  protected strikeAnim(p: number) {
    if (this.mode === 'shoot') animBowShoot(this.h, p)
    else animPoke(this.h, p)
  }

  protected onStrikeStart(player: Player, game: Game) {
    if (this.mode === 'shoot') {
      game.spawnArrow(
        this.pos.clone().add(new THREE.Vector3(0, 1.5, 0)),
        player.pos.clone().add(new THREE.Vector3(0, 0.95, 0)),
        Math.round(this.opts.dmg * (0.9 + Math.random() * 0.25))
      )
    }
  }

  protected doStrike(player: Player, game: Game, dist: number, angleToPlayer: number) {
    if (this.mode === 'poke') {
      const reach = this.opts.atkRange + 0.5
      let angDiff = angleToPlayer - this.yaw
      while (angDiff > Math.PI) angDiff -= Math.PI * 2
      while (angDiff < -Math.PI) angDiff += Math.PI * 2
      if (dist < reach && Math.abs(angDiff) < 1.1) {
        const dmg = Math.round(this.opts.dmg * 0.9 * (0.9 + Math.random() * 0.2))
        if (player.takeDamage(dmg, this.pos.x, this.pos.z, game)) game.onPlayerHit(dmg)
      }
    }
    // arrow damage is handled by the projectile itself
  }

  protected recoverAnim(p: number) {
    resetPose(this.h)
    if (this.mode === 'shoot') {
      this.h.armL.rotation.x = -1.5 + 1.5 * p
      this.h.armR.rotation.x = -0.85 * (1 - p)
    } else {
      this.h.armL.rotation.x = -0.25 * (1 - p)
    }
  }

  /* ---- rattle apart when it dies ---- */
  protected deathDur() {
    return 0.85
  }

  protected deathAnim(p: number) {
    animDead(this.h, p)
    // bones clatter sideways as it collapses
    this.h.head.rotation.z = 0.4 * p
    this.h.armL.rotation.z = 0.6 * p
    this.h.armR.rotation.z = -0.75 * p
    this.h.legL.rotation.x = 0.5 * p
    this.h.legR.rotation.x = -0.35 * p
  }
}

/* ================= WITHER SKELETON ================= */

/** Fast charcoal swordsman of the Ash Wastes. Its heavy grey blade chews
    through guards — blocking works, but stamina shatters fast. Roll instead. */
export class WitherSkeletonEnemy extends Enemy {
  constructor(scene: THREE.Scene, spawn: THREE.Vector3) {
    super(scene, 'wither', spawn, {
      hp: 95,
      dmg: 24,
      speed: 3.4,
      aggro: 13,
      atkRange: 2.25,
      windup: 0.5,
      recover: 0.65,
      souls: 70,
      scale: 1.0,
      name: 'شمشیرزن ویسری',
    })
  }

  protected attackCooldown() {
    return 0.7 + Math.random() * 0.7
  }

  protected windupAnim(p: number) {
    resetPose(this.h)
    this.h.armR.rotation.x = -2.9 * p
    this.h.armR.rotation.z = -0.3 * p
    this.h.root.rotation.y = 0.4 * p
    this.h.legL.rotation.x = 0.25 * p
  }

  protected strikeAnim(p: number) {
    animAttack(this.h, p, 'light0')
  }

  protected strikeDur() {
    return 0.24
  }

  /** heavy guard-draining swing */
  protected doStrike(player: Player, game: Game, dist: number, angleToPlayer: number) {
    const reach = this.opts.atkRange + 0.6
    let angDiff = angleToPlayer - this.yaw
    while (angDiff > Math.PI) angDiff -= Math.PI * 2
    while (angDiff < -Math.PI) angDiff += Math.PI * 2
    if (dist < reach && Math.abs(angDiff) < 1.15) {
      const dmg = Math.round(this.opts.dmg * (0.9 + Math.random() * 0.2))
      if (player.takeDamage(dmg, this.pos.x, this.pos.z, game, true)) game.onPlayerHit(dmg)
    }
  }

  protected deathAnim(p: number) {
    animDead(this.h, p)
    this.h.head.rotation.z = 0.5 * p
    this.h.armR.rotation.z = -0.8 * p
  }
}

/* ================= BLAZE ================= */

/** Floating molten sentry — hovers over the ash, keeps its distance and
    spits fireballs. Rush it, block the bolts, or snipe it with pyromancy. */
export class BlazeEnemy extends Enemy {
  private rods: THREE.Group
  private trailT = 0

  constructor(scene: THREE.Scene, spawn: THREE.Vector3) {
    super(scene, 'blaze', spawn, {
      hp: 70,
      dmg: 16,
      speed: 2.7,
      aggro: 14,
      atkRange: 2.0,
      windup: 0.85,
      recover: 0.5,
      souls: 60,
      scale: 0.95,
      name: 'شعله‌ی سرگردان',
    })
    // floating core — limbs are hidden, smoke rods orbit instead
    this.h.armL.visible = false
    this.h.armR.visible = false
    this.h.legL.visible = false
    this.h.legR.visible = false
    this.rods = createBlazeRods()
    this.h.root.add(this.rods)
  }

  reset() {
    super.reset()
    this.rods.rotation.set(0, 0, 0)
    this.rods.position.y = 0
    setFlashWhite(this.h, 0)
  }

  update(dt: number, player: Player, game: Game) {
    super.update(dt, player, game)
    this.rods.rotation.y += dt * (this.state === 'windup' ? 9 : 2.4)
    if (this.alive && this.state !== 'idle') {
      this.trailT -= dt
      if (this.trailT <= 0) {
        this.trailT = 0.14
        game.spawnBurst(
          this.pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.3, 1.1, (Math.random() - 0.5) * 0.3)),
          0xff9a2a, 1, 0.5, 0.5, 0.09
        )
      }
    }
  }

  /** hover above the ground with a lazy bob */
  protected syncModel() {
    this.h.group.position.copy(this.pos)
    this.h.group.rotation.y = this.yaw
    if (this.world) {
      this.h.group.position.y =
        this.world.surfaceAt(this.pos.x, this.pos.z) + 1.02 + Math.sin(this.animT * 2.3) * 0.12
    }
  }

  protected attackCooldown() {
    return 1.9 + Math.random() * 1.3
  }

  protected wantsAttack(dist: number, _angDiff: number): boolean {
    return dist <= 13
  }

  /** hovering drift — holds the 6.5..11.5m firing band */
  protected chaseMove(dt: number, dx: number, dz: number, dist: number, angleToPlayer: number) {
    this.yaw = angleToPlayer
    const ux = dx / (dist || 1)
    const uz = dz / (dist || 1)
    if (dist < 6.5) {
      this.pos.x -= ux * this.speed() * 0.7 * dt
      this.pos.z -= uz * this.speed() * 0.7 * dt
    } else if (dist > 11.5) {
      this.pos.x += ux * this.speed() * dt
      this.pos.z += uz * this.speed() * dt
    } else {
      const sway = Math.sin(this.animT * 1.4) * 0.5
      this.pos.x += -uz * sway * dt
      this.pos.z += ux * sway * dt
    }
    this.h.root.rotation.x = 0.1
  }

  protected windupAnim(p: number) {
    resetPose(this.h)
    this.h.head.rotation.x = -0.3 * p
    setFlashWhite(this.h, p * 0.55) // heating up
  }

  protected strikeAnim(p: number) {
    resetPose(this.h)
    this.h.head.rotation.x = 0.15 * Math.sin(p * Math.PI)
  }

  /** the fireball is released at the impact moment */
  protected doStrike(player: Player, game: Game, _dist: number, _angleToPlayer: number) {
    const from = this.pos.clone().add(new THREE.Vector3(0, 1.35, 0))
    const to = player.pos.clone().add(new THREE.Vector3(0, 0.95, 0))
    game.spawnFireball(from, to, Math.round(this.opts.dmg * (0.9 + Math.random() * 0.25)))
    game.sfx.fireShoot()
  }

  protected recoverAnim(p: number) {
    resetPose(this.h)
    this.h.head.rotation.x = 0.1 * (1 - p)
  }

  protected deathAnim(p: number) {
    animDead(this.h, p)
    this.rods.rotation.y += 0.25 * p
    this.rods.position.y = -0.5 * p
  }
}

/* ================= BOSS 2: THE FLAME KING ================= */

type FlameMove = 'volley' | 'sweep' | 'slam' | 'dash'

export class BossFlameEnemy extends Enemy {
  private pick: FlameMove = 'volley'
  private followUp: FlameMove | null = null // queued phase-2 combo
  private poise = 0
  private maxPoise = 170
  private phase2Done = false
  private introDone = false
  private dashDir = new THREE.Vector3(0, 0, 1)
  private chargeHit = false
  private dustT = 0

  constructor(scene: THREE.Scene, spawn: THREE.Vector3) {
    super(scene, 'bossflame', spawn, {
      hp: 850,
      dmg: 34,
      speed: 3.2,
      aggro: 60,
      atkRange: 3.0,
      windup: 0.8,
      recover: 0.9,
      souls: 4500,
      scale: 2.35,
      isBoss: true,
      name: 'پادشاه شعله',
    })
    this.active = false
  }

  phase2() {
    return this.hp < this.maxHp * 0.5
  }

  reset() {
    super.reset()
    this.active = false
    this.pick = 'volley'
    this.followUp = null
    this.poise = 0
    this.phase2Done = false
    this.introDone = false
    this.chargeHit = false
    setFlash(this.h, 0)
  }

  update(dt: number, player: Player, game: Game) {
    // ---- intro roar on first activation ----
    if (this.active && !this.introDone && !this.dead) {
      this.introDone = true
      this.state = 'roar'
      this.stateT = 0
      game.onBoss2Intro(this.pos)
    }
    // ---- phase-2 awakening ----
    if (!this.phase2Done && !this.dead && this.hp > 0 && this.hp < this.maxHp * 0.5) {
      this.phase2Done = true
      this.state = 'roar'
      this.stateT = 0
      game.onBoss2Phase2()
    }
    super.update(dt, player, game)
    // ---- phase-2 smoldering aura ----
    if (this.phase2Done && !this.dead) {
      const pulse = 0.14 + Math.sin(this.animT * 6) * 0.07
      setFlash(this.h, this.flash * 0.55 + pulse)
    }
  }

  /** poise/stagger — same rules as the first lord */
  takeDamage(dmg: number, game: Game, fromX: number, fromZ: number) {
    const wasRoar = this.state === 'roar'
    const roarT = this.stateT
    const wasStaggered = this.state === 'stagger'
    super.takeDamage(dmg, game, fromX, fromZ)
    if (this.dead) return
    if (wasRoar) {
      this.state = 'roar'
      this.stateT = roarT
      return
    }
    if (wasStaggered) {
      this.state = 'stagger'
      return
    }
    this.poise += dmg
    if (this.poise >= this.maxPoise) {
      this.poise = 0
      this.state = 'stagger'
      this.stateT = 0
      game.onBossStagger(this.pos)
    }
  }

  protected speed() {
    return this.opts.speed * (this.phase2() ? 1.28 : 1)
  }

  protected attackCooldown() {
    if (this.phase2() && this.followUp) return 0.15
    return this.phase2() ? 0.4 + Math.random() * 0.3 : 0.9 + Math.random() * 0.5
  }

  protected wantsAttack(dist: number, angDiff: number): boolean {
    if (dist > 6.5) return true // anti-kite: volley or dash
    if (this.phase2() && dist > 5.2) return true
    if (dist <= 3.4) return true
    return Math.abs(angDiff) > 1.5 && dist < 4.8
  }

  protected windupDur() {
    const base =
      this.pick === 'volley' ? 0.85 : this.pick === 'sweep' ? 0.6 : this.pick === 'slam' ? 0.9 : 0.65
    return this.phase2() ? base * 0.75 : base
  }

  protected strikeDur() {
    switch (this.pick) {
      case 'volley': return 0.42
      case 'sweep': return 0.4
      case 'slam': return 0.6
      case 'dash': return 0.55
    }
  }

  protected strikeImpactP() {
    if (this.pick === 'volley') return 0.5
    if (this.pick === 'sweep') return 0.45
    if (this.pick === 'slam') return 0.55
    return 2 // dash damage is contact-based
  }

  protected onWindupStart(_game: Game | undefined, dist: number, _angDiff: number) {
    const chained = this.followUp
    this.followUp = null
    if (dist > 6.5) {
      this.pick = Math.random() < 0.55 ? 'volley' : 'dash'
    } else if (chained && dist < 5.0) {
      this.pick = chained
    } else if (dist < 2.4) {
      this.pick = Math.random() < 0.6 ? 'slam' : 'sweep'
    } else {
      this.pick = Math.random() < 0.5 ? 'sweep' : 'slam'
    }
    if (this.phase2()) {
      if (this.pick === 'sweep' && Math.random() < 0.35) this.followUp = 'volley'
      else if (this.pick === 'volley' && Math.random() < 0.3) this.followUp = 'dash'
    }
  }

  protected onStrikeStart(player: Player, game: Game) {
    if (this.pick === 'dash') {
      const dx = player.pos.x - this.pos.x
      const dz = player.pos.z - this.pos.z
      const l = Math.hypot(dx, dz) || 1
      this.dashDir.set(dx / l, 0, dz / l)
      this.chargeHit = false
      game.sfx.dash()
    }
  }

  protected windupAnim(p: number) {
    resetPose(this.h)
    if (this.pick === 'volley') {
      // both arms raised, gathering embers
      this.h.armR.rotation.x = -2.9 * p
      this.h.armL.rotation.x = -2.9 * p
      this.h.head.rotation.x = -0.35 * p
      setFlashWhite(this.h, p * 0.35)
    } else if (this.pick === 'sweep') {
      this.h.armR.rotation.x = -2.3 * p
      this.h.armR.rotation.z = -0.85 * p
      this.h.root.rotation.y = 0.55 * p
    } else if (this.pick === 'slam') {
      this.h.armR.rotation.x = -3.0 * p
      this.h.armL.rotation.x = -2.8 * p
      this.h.root.rotation.x = -0.16 * p
    } else {
      // flame dash crouch
      this.h.root.position.y = -0.2 * p
      this.h.root.rotation.x = 0.4 * p
      this.h.armR.rotation.x = -1.0 * p
      this.h.legL.rotation.x = 0.65 * p
      this.h.legR.rotation.x = -0.5 * p
      setFlashWhite(this.h, p * 0.3)
    }
  }

  protected strikeAnim(p: number) {
    switch (this.pick) {
      case 'volley':
        resetPose(this.h)
        this.h.armR.rotation.x = lerp(-2.9, -1.2, Math.min(1, p * 2.5))
        this.h.armL.rotation.x = lerp(-2.9, -1.2, Math.min(1, p * 2.5))
        break
      case 'sweep': animSweep(this.h, p); break
      case 'slam': animSlam(this.h, p); break
      case 'dash': animCharge(this.h, p); break
    }
  }

  protected strikeMove(dt: number, p: number, player: Player, game: Game) {
    if (this.pick !== 'dash') return
    const sp = 13.5 * (1 - 0.35 * p)
    this.pos.x += this.dashDir.x * sp * dt
    this.pos.z += this.dashDir.z * sp * dt
    this.dustT -= dt
    if (this.dustT <= 0) {
      this.dustT = 0.06
      game.spawnBurst(
        this.pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.8, 0.9, (Math.random() - 0.5) * 0.8)),
        0xff8a2a, 4, 1.8, 0.45, 0.16
      )
    }
    if (!this.chargeHit) {
      const d = Math.hypot(player.pos.x - this.pos.x, player.pos.z - this.pos.z)
      if (d < 1.9) {
        this.chargeHit = true
        const dmg = Math.round(this.opts.dmg * 0.8 * (0.9 + Math.random() * 0.2))
        if (player.takeDamage(dmg, this.pos.x, this.pos.z, game)) game.onPlayerHit(dmg)
        game.spawnBurst(this.pos.clone().add(new THREE.Vector3(0, 1.8, 0)), 0xffd27a, 12, 3, 0.4)
      }
    }
  }

  protected recoverAnim(p: number) {
    resetPose(this.h)
    if (this.pick === 'slam') {
      this.h.armR.rotation.x = 0.5 * (1 - p)
      this.h.armL.rotation.x = 0.45 * (1 - p)
      this.h.root.rotation.x = 0.22 * (1 - p)
    } else if (this.pick === 'sweep') {
      this.h.armR.rotation.x = -0.55 * (1 - p)
      this.h.armR.rotation.z = 0.8 * (1 - p)
      this.h.root.rotation.y = -1.05 * (1 - p)
    } else if (this.pick === 'dash') {
      this.h.root.rotation.x = 0.32 * (1 - p)
      this.h.armR.rotation.x = -1.5 * (1 - p)
    } else {
      this.h.armR.rotation.x = -1.1 * (1 - p)
      this.h.armL.rotation.x = -1.1 * (1 - p)
    }
  }

  protected roarDur() { return 1.9 }
  protected roarAnim(p: number) { animRoar(this.h, p) }
  protected staggerDur() { return 1.8 }
  protected staggerAnim(p: number) { animStagger(this.h, p) }
  protected deathDur() { return 1.7 }
  protected deathAnim(p: number) { animBossDead(this.h, p) }

  protected doStrike(player: Player, game: Game, dist: number, angleToPlayer: number) {
    if (this.pick === 'volley') {
      // fan of fireballs from both hands
      const from = this.pos.clone().add(new THREE.Vector3(0, 2.6, 0))
      const to = player.pos.clone().add(new THREE.Vector3(0, 0.95, 0))
      const dir = to.clone().sub(from)
      dir.y = 0
      const dl = dir.length() || 1
      dir.divideScalar(dl)
      const n = this.phase2() ? 5 : 3
      const spread = 0.24
      for (let i = 0; i < n; i++) {
        const a = (i - (n - 1) / 2) * spread
        const ca = Math.cos(a)
        const sa = Math.sin(a)
        const rd = new THREE.Vector3(ca * dir.x + sa * dir.z, 0, -sa * dir.x + ca * dir.z)
        const target = from.clone().addScaledVector(rd, Math.max(6, dl))
        game.spawnFireball(from.clone(), target, Math.round(this.opts.dmg * 0.5))
      }
      game.sfx.fireShoot()
    } else if (this.pick === 'slam') {
      // AOE impact + a burning lava pool left behind
      if (dist < 4.3) {
        const dmg = Math.round(this.opts.dmg * 1.1 * (0.9 + Math.random() * 0.2))
        if (player.takeDamage(dmg, this.pos.x, this.pos.z, game)) game.onPlayerHit(dmg)
      }
      game.onBoss2Slam(this.pos)
    } else if (this.pick === 'sweep') {
      const reach = this.opts.atkRange + 1.0
      let angDiff = angleToPlayer - this.yaw
      while (angDiff > Math.PI) angDiff -= Math.PI * 2
      while (angDiff < -Math.PI) angDiff += Math.PI * 2
      if (dist < reach && Math.abs(angDiff) < 2.15) {
        const dmg = Math.round(this.opts.dmg * 0.88 * (0.9 + Math.random() * 0.2))
        if (player.takeDamage(dmg, this.pos.x, this.pos.z, game)) game.onPlayerHit(dmg)
      }
    }
    // dash damage is contact-based in strikeMove
  }
}
