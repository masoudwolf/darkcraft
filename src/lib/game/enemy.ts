import * as THREE from 'three'
import {
  createHumanoid, animIdle, animWalk, animZombieWalk, animAttack, animHit, animDead,
  resetPose, setOpacity, setFlash, setFlashWhite, type Humanoid,
} from './models'
import { BONFIRE, type World } from './world'
import type { Game } from './game'
import type { Player } from './player'

export type EnemyState = 'idle' | 'chase' | 'return' | 'windup' | 'strike' | 'recover' | 'hitstun' | 'dead'

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

  constructor(scene: THREE.Scene, kind: 'zombie' | 'boss' | 'creeper', spawn: THREE.Vector3, opts: EnemyOpts) {
    this.opts = opts
    this.hp = opts.hp
    this.maxHp = opts.hp
    this.isBoss = !!opts.isBoss
    this.name = opts.name ?? 'Hollow'
    this.h = createHumanoid(kind, opts.scale, {
      sword: kind !== 'creeper',
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
      animDead(this.h, Math.min(1, this.stateT / 0.9))
      this.stateT += dt
      if (this.deathT > 1.1) {
        const fade = Math.max(0, 1 - (this.deathT - 1.1) / 1.1)
        setOpacity(this.h, fade)
        if (fade <= 0) this.h.group.visible = false
      }
      return
    }

    const dx = player.pos.x - this.pos.x
    const dz = player.pos.z - this.pos.z
    const dist = Math.hypot(dx, dz)
    const angleToPlayer = Math.atan2(dx, dz)
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
        if (dist <= this.opts.atkRange && this.cd <= 0) {
          this.state = 'windup'
          this.stateT = 0
          this.strikeDone = false
          this.onWindupStart(game)
          break
        }
        this.yaw = angleToPlayer
        this.pos.x += (dx / (dist || 1)) * this.speed() * dt
        this.pos.z += (dz / (dist || 1)) * this.speed() * dt
        animZombieWalk(this.h, this.animT, this.isBoss ? 1.25 : 1)
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
        }
        break
      }
      case 'strike': {
        this.stateT += dt
        const dur = this.isBoss ? 0.32 : 0.22
        const p = Math.min(1, this.stateT / dur)
        this.strikeAnim(p)
        if (!this.strikeDone && p >= 0.4) {
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
        resetPose(this.h)
        this.h.armR.rotation.x = 0.9 * (1 - p)
        if (p >= 1) {
          this.state = 'chase'
          this.cd = this.attackCooldown()
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

    this.clamp()
    this.syncModel()
  }

  protected speed() {
    return this.opts.speed
  }

  protected attackCooldown() {
    return 1.1 + Math.random() * 0.8
  }

  protected windupDur() {
    return this.opts.windup
  }

  protected onWindupStart(_game?: Game) {}

  /** return true to abort the windup (e.g. creeper defusing) */
  protected windupShouldCancel(_dist: number): boolean {
    return false
  }

  protected windupAnim(p: number) {
    resetPose(this.h)
    this.h.armR.rotation.x = -2.8 * p
    this.h.armR.rotation.z = -0.4 * p
    this.h.root.rotation.y = 0.35 * p
  }

  protected strikeAnim(p: number) {
    animAttack(this.h, p, 'light0')
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

export class BossEnemy extends Enemy {
  private pick: 'slam' | 'sweep' = 'slam'

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
  }

  protected speed() {
    return this.opts.speed * (this.phase2() ? 1.35 : 1)
  }

  protected attackCooldown() {
    return this.phase2() ? 0.35 + Math.random() * 0.3 : 0.8 + Math.random() * 0.4
  }

  protected windupDur() {
    const base = this.pick === 'slam' ? 0.85 : 0.55
    return this.phase2() ? base * 0.72 : base
  }

  protected onWindupStart() {
    this.pick = Math.random() < 0.5 ? 'slam' : 'sweep'
  }
  protected windupAnim(p: number) {
    resetPose(this.h)
    if (this.pick === 'slam') {
      // both arms overhead
      this.h.armR.rotation.x = -3.0 * p
      this.h.armL.rotation.x = -2.7 * p
      this.h.root.rotation.x = -0.18 * p
    } else {
      // sweep windup: sword arm back
      this.h.armR.rotation.x = -2.4 * p
      this.h.armR.rotation.z = -0.9 * p
      this.h.root.rotation.y = 0.6 * p
    }
  }

  protected strikeAnim(p: number) {
    if (this.pick === 'slam') {
      resetPose(this.h)
      this.h.armR.rotation.x = -3.0 + 3.9 * p
      this.h.armL.rotation.x = -2.7 + 3.4 * p
      this.h.root.rotation.x = -0.18 + 0.6 * p
      if (p > 0.55) this.h.root.position.y = -0.15
    } else {
      animAttack(this.h, p, 'light1')
      this.h.root.rotation.y = 0.6 - 1.8 * p
    }
  }

  protected doStrike(player: Player, game: Game, dist: number, angleToPlayer: number) {
    if (this.pick === 'slam') {
      // AOE around boss front
      if (dist < 4.1) {
        const dmg = Math.round(this.opts.dmg * 1.2 * (0.9 + Math.random() * 0.2))
        if (player.takeDamage(dmg, this.pos.x, this.pos.z, game)) game.onPlayerHit(dmg)
      }
      game.onBossSlam(this.pos)
    } else {
      const reach = this.opts.atkRange + 1.1
      let angDiff = angleToPlayer - this.yaw
      while (angDiff > Math.PI) angDiff -= Math.PI * 2
      while (angDiff < -Math.PI) angDiff += Math.PI * 2
      if (dist < reach && Math.abs(angDiff) < 2.2) {
        const dmg = Math.round(this.opts.dmg * 0.85 * (0.9 + Math.random() * 0.2))
        if (player.takeDamage(dmg, this.pos.x, this.pos.z, game)) game.onPlayerHit(dmg)
      }
    }
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

  protected onWindupStart(game?: Game) {
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
