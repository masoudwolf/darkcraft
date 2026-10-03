import * as THREE from 'three'
import {
  createHumanoid, animIdle, animWalk, animAttack, animRoll, animDrink, animHit, animDead, animBlock, animBlockWalk, animCast, animBowDraw, animBowShoot, bowDrawAmount, setBowDraw, setNocked,
  resetPose, setOpacity, setFlash, type Humanoid,
} from './models'
import type { Input } from './engine'
import type { GameWorld } from './worldContract'
import type { Game } from './game'
import type { DmgType, RollTier } from './items'

export type PlayerState = 'idle' | 'run' | 'roll' | 'attack' | 'heavy' | 'drink' | 'hit' | 'dead' | 'block' | 'cast' | 'aim'

const ROLL_DUR = 0.48
// i-frames must comfortably cover a react-to-swing dodge AND an anticipatory
// late-windup roll: boss slam impact lands ~0.33s after the strike begins
const ROLL_IFRAME = 0.42
const STAMINA_COST_ROLL = 22
const STAMINA_COST_LIGHT = 18
const STAMINA_COST_HEAVY = 32
const STAMINA_COST_CAST = 20
const CAST_DUR = 0.65
const STAMINA_REGEN = 30
const WALK_SPEED = 3.6
const SPRINT_SPEED = 6.1

interface AttackDef {
  dur: number
  impact: number
  dmg: number
  range: number
  arc: number
  cost: number
  variant: 'light0' | 'light1' | 'light2' | 'heavy'
  heavy: boolean
  knock: number
}

export type PlayerStrikeDef = AttackDef

export interface PlayerCtx {
  input: Input
  camYaw: number
  dt: number
  world: GameWorld
  game: Game
}

/** everything the equipped gear tells the body how to move and fight —
    recomputed by Game.refreshLoadout() on every equip change (DS-style:
    weapon power/speed, shield soak, armor soak, equip-burden tiers) */
export interface Loadout {
  weaponMult: number
  weaponSpd: number
  block: number
  def: number
  fire: number
  blast: number
  walkMult: number
  sprintMult: number
  rollMult: number
  rollCostMult: number
  canRoll: boolean
  tier: RollTier
  load: number
  maxLoad: number
  aiming: boolean // the active left-hand item is a bow
  stamRegenMul: number // charms whisper here — rings & amulets
  soulsMul: number
}

export const DEFAULT_LOADOUT: Loadout = {
  weaponMult: 1, weaponSpd: 1, block: 0.85,
  def: 0, fire: 0, blast: 0,
  walkMult: 1, sprintMult: 1, rollMult: 1, rollCostMult: 1, canRoll: true,
  tier: 'fast', load: 5.5, maxLoad: 35, aiming: false,
  stamRegenMul: 1, soulsMul: 1,
}

export class Player {
  h: Humanoid
  pos = new THREE.Vector3(0, 3, 18)
  yaw = Math.PI
  vy = 0
  state: PlayerState = 'idle'
  stateT = 0

  maxHp = 95
  hp = 95
  maxStamina = 95
  stamina = 95
  souls = 0
  estus = 3
  maxEstus = 3
  level = 1
  vit = 0
  end = 0
  str = 0
  /** shop-bought weapon sharpening — flat damage multiplier bonus */
  gearDmg = 0

  /** equipped-gear consequences — set by Game.refreshLoadout() */
  loadout: Loadout = { ...DEFAULT_LOADOUT }
  /** bow draw while aiming (0..1); LMB fires once it has nocked enough */
  aimT = 0
  aimRelease = 0
  private aimDrawPrev = 0

  combo = 0
  queued = false
  didImpact = false
  invuln = 0
  staminaDelay = 0
  sprinting = false
  lockedTarget: { pos: THREE.Vector3; alive: boolean; isBoss: boolean } | null = null
  animT = 0
  deathT = 0
  healedThisDrink = false
  hitDur = 0.34

  // pyromancy — charges refill at the bonfire
  pyro = 4
  maxPyro = 4
  pyroUnlocked = false
  private castFired = false

  private rollDir = new THREE.Vector3(0, 0, -1)
  private kbDir = new THREE.Vector3()
  private attackDef: AttackDef | null = null

  constructor(scene: THREE.Scene) {
    this.h = createHumanoid('player', 0.95, { sword: true, shield: true })
    scene.add(this.h.group)
  }

  get damageMult() {
    return (1 + this.str * 0.08 + this.gearDmg) * this.loadout.weaponMult
  }

  get alive() {
    return this.state !== 'dead'
  }

  get busy() {
    return this.state !== 'idle' && this.state !== 'run'
  }

  reset(at: THREE.Vector3, yaw: number) {
    this.pos.copy(at)
    this.yaw = yaw
    this.vy = 0
    this.state = 'idle'
    this.stateT = 0
    this.combo = 0
    this.queued = false
    this.invuln = 1
    this.animT = 0
    this.deathT = 0
    this.castFired = false
    this.lockedTarget = null
    setOpacity(this.h, 1)
    setFlash(this.h, 0)
    resetPose(this.h)
    this.h.group.rotation.set(0, yaw, 0)
    this.h.group.visible = true
  }

  fullRestore() {
    this.hp = this.maxHp
    this.stamina = this.maxStamina
    this.estus = this.maxEstus
    this.pyro = this.maxPyro
  }

  applyLevel(stat: 'vit' | 'end' | 'str') {
    if (stat === 'vit') {
      this.vit++
      this.maxHp += 16
    } else if (stat === 'end') {
      this.end++
      this.maxStamina += 9
    } else {
      this.str++
    }
    this.level++
  }

  startAttack(def: AttackDef) {
    this.state = def.heavy ? 'heavy' : 'attack'
    this.stateT = 0
    this.attackDef = def
    this.queued = false
    this.didImpact = false
    this.stamina = Math.max(0, this.stamina - def.cost)
    this.staminaDelay = 0.55
  }

  startRoll(dirX: number, dirZ: number) {
    if (!this.loadout.canRoll) return // overburdened waddlers cannot roll
    this.state = 'roll'
    this.stateT = 0
    const len = Math.hypot(dirX, dirZ)
    if (len > 0.01) {
      this.rollDir.set(dirX / len, 0, dirZ / len)
      this.yaw = Math.atan2(this.rollDir.x, this.rollDir.z)
    } else {
      this.rollDir.set(Math.sin(this.yaw), 0, Math.cos(this.yaw))
    }
    this.stamina = Math.max(0, this.stamina - STAMINA_COST_ROLL * this.loadout.rollCostMult)
    this.staminaDelay = 0.55
    this.invuln = ROLL_IFRAME
  }

  startCast() {
    this.state = 'cast'
    this.stateT = 0
    this.castFired = false
    this.pyro--
    this.stamina = Math.max(0, this.stamina - STAMINA_COST_CAST)
    this.staminaDelay = 0.6
  }

  takeDamage(dmg: number, fromX: number, fromZ: number, game?: Game, guardHeavy = false, dmgType: DmgType = 'phys'): boolean {
    if (this.invuln > 0 || this.state === 'dead') return false
    // ---- armor soaks the blow before anything else (DS defenses) ----
    const armor = dmgType === 'fire' ? this.loadout.fire : dmgType === 'blast' ? this.loadout.blast : this.loadout.def
    if (armor > 0) dmg = Math.max(1, Math.round(dmg * (1 - armor)))
    const dx = this.pos.x - fromX
    const dz = this.pos.z - fromZ
    const l = Math.hypot(dx, dz) || 1
    // ---- shield block: hits landing on the shield's front arc ----
    if (this.state === 'block' && this.stamina > 0) {
      const fx = Math.sin(this.yaw)
      const fz = Math.cos(this.yaw)
      const aX = -dx / l // direction the attack comes from
      const aZ = -dz / l
      const dot = aX * fx + aZ * fz
      if (dot > 0.3) {
        // heavy grey blades (wither skeletons) chew through guards:
        // blocking still works but stamina shatters fast
        const soak = this.loadout.block
        const chip = Math.max(1, Math.round(dmg * (1 - soak) * (guardHeavy ? 2 : 1)))
        const cost = dmg * (guardHeavy ? 1.6 : 0.9)
        this.kbDir.set(aX, 0, aZ)
        if (this.stamina >= cost) {
          this.stamina -= cost
          this.staminaDelay = 0.7
          // even a clean guard bleeds a little — blocking is a tool,
          // not a wall (chip was computed but never applied before)
          this.hp -= chip
          this.pos.x += aX * 0.3
          this.pos.z += aZ * 0.3
          game?.onPlayerBlock(dmg)
          if (this.hp <= 0) {
            this.hp = 0
            this.die()
          }
        } else {
          // guard broken!
          this.stamina = 0
          this.staminaDelay = 1.1
          this.hp -= chip
          this.invuln = 0.45
          this.hitDur = 0.85
          this.state = 'hit'
          this.stateT = 0
          game?.onGuardBreak(chip)
          if (this.hp <= 0) {
            this.hp = 0
            this.die()
          }
        }
        return false
      }
    }
    // ---- normal hit ----
    this.hp -= dmg
    this.invuln = 0.45
    this.hitDur = 0.34
    this.kbDir.set(dx / l, 0, dz / l)
    if (this.hp <= 0) {
      this.hp = 0
      this.die()
    } else {
      this.state = 'hit'
      this.stateT = 0
    }
    return true
  }

  private die() {
    this.state = 'dead'
    this.stateT = 0
    this.deathT = 0
  }

  update(ctx: PlayerCtx) {
    const { input, camYaw, dt, world, game } = ctx
    this.invuln = Math.max(0, this.invuln - dt)
    this.animT += dt
    const wantBlock =
      (input.isHeld('RMB') || input.isHeld('Block')) && this.stamina > 0

    if (this.state === 'dead') {
      this.deathT += dt
      this.stateT += dt
      animDead(this.h, this.stateT / 1.1)
      if (this.deathT > 1.4) {
        const fade = Math.max(0, 1 - (this.deathT - 1.4) / 1.2)
        setOpacity(this.h, fade)
        if (fade <= 0) this.h.group.visible = false
      }
      this.resolveGround(world, dt, true)
      return
    }

    // ---- state machine ----
    const ax = input.axis()
    const moving = Math.hypot(ax.x, ax.z) > 0.01

    if (this.state === 'roll') {
      this.stateT += dt
      const p = this.stateT / ROLL_DUR
      // burden tiers shorten the somersault too
      const sp = 8.8 * this.loadout.rollMult * (1 - 0.5 * p)
      this.slide(world, this.rollDir.x * sp * dt, this.rollDir.z * sp * dt)
      animRoll(this.h, Math.min(1, p))
      if (p >= 1) {
        this.state = 'idle'
        this.stateT = 0
        resetPose(this.h)
      }
    } else if (this.state === 'attack' || this.state === 'heavy') {
      const def = this.attackDef!
      this.stateT += dt
      const p = this.stateT / def.dur
      if (!this.didImpact && p >= def.impact) {
        this.didImpact = true
        game.playerStrike(def)
      }
      animAttack(this.h, Math.min(1, p), def.variant)
      // small lunge
      if (p < 0.35) {
        const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw)
        this.slide(world, fx * 2.1 * dt, fz * 2.1 * dt)
      }
      if (def.variant !== 'heavy' && this.stamina >= STAMINA_COST_LIGHT) {
        if (input.consume('LMB') && p > 0.32 && p < 0.9) this.queued = true
      }
      if (p >= 1) {
        if (this.queued && this.combo < 2 && this.stamina >= STAMINA_COST_LIGHT) {
          this.combo++
          this.startAttack(this.lightDef(this.combo))
        } else {
          this.state = 'idle'
          this.combo = 0
          resetPose(this.h)
        }
      }
    } else if (this.state === 'drink') {
      this.stateT += dt
      const p = this.stateT / 1.15
      animDrink(this.h, p)
      if (!this.healedThisDrink && p >= 0.62) {
        this.healedThisDrink = true
        const heal = Math.round(this.maxHp * 0.55)
        this.hp = Math.min(this.maxHp, this.hp + heal)
        game.onPlayerHeal(heal)
      }
      if (p >= 1) {
        this.state = 'idle'
        this.healedThisDrink = false
        resetPose(this.h)
      }
    } else if (this.state === 'cast') {
      // ---- pyromancy: gather, release, recover ----
      this.stateT += dt
      const p = this.stateT / CAST_DUR
      animCast(this.h, Math.min(1, p))
      if (!this.castFired && p >= 0.6) {
        this.castFired = true
        game.spawnPlayerFireball(this)
      }
      if (p >= 1) {
        this.state = 'idle'
        this.stateT = 0
        resetPose(this.h)
      }
    } else if (this.state === 'hit') {
      this.stateT += dt
      this.slide(world, this.kbDir.x * 4.5 * (1 - this.stateT / this.hitDur) * dt, this.kbDir.z * 4.5 * (1 - this.stateT / this.hitDur) * dt)
      animHit(this.h, Math.min(1, this.stateT / this.hitDur))
      if (this.stateT >= this.hitDur) {
        this.state = 'idle'
        resetPose(this.h)
      }
    } else if (this.state === 'aim') {
      // ---- bow: nock, draw, release — rolls out just like guarding ----
      if (!this.loadout.aiming) {
        // the bow left the left hand mid-aim — fall back to guarding
        this.state = 'block'
        this.stateT = 0
        this.aimT = 0
      } else {
      this.stateT += dt
      let marching = 0 // how far the legs march while creeping
      if (this.aimRelease > 0) {
        this.aimRelease -= dt
        animBowShoot(this.h, Math.min(1, 1 - this.aimRelease / 0.22))
      } else {
        this.aimT = Math.min(0.55, this.aimT + dt)
        const draw = this.aimT / 0.55
        animBowDraw(this.h, bowDrawAmount(draw))
        // the bow itself bends with the draw and carries a nocked arrow —
        // synced every frame so string, arrow and arms move as one
        if (game.playerBow) {
          setNocked(game.playerBow, true)
          setBowDraw(game.playerBow, bowDrawAmount(draw))
        }
      }
      if (game.playerBow && this.aimRelease > 0) setNocked(game.playerBow, false)
      // aiming gait — a slow careful creep; standing, the body squares up
      // to the camera so the arrow truly flies where the player looks
      if (moving) {
        const fwdX = -Math.sin(camYaw), fwdZ = -Math.cos(camYaw)
        const rgtX = -fwdZ, rgtZ = fwdX
        const mx = rgtX * ax.x + fwdX * ax.z
        const mz = rgtZ * ax.x + fwdZ * ax.z
        this.slide(world, mx * WALK_SPEED * 0.42 * this.loadout.walkMult * dt, mz * WALK_SPEED * 0.42 * this.loadout.walkMult * dt)
        this.targetYaw = Math.atan2(mx, mz)
        // the stance keeps the upper body drawn while the legs march underneath
        marching = 1
        this.animT += dt * 7.5
      } else {
        this.targetYaw = Math.atan2(-Math.sin(camYaw), -Math.cos(camYaw))
      }
      if (marching) {
        const swing = Math.sin(this.animT) * 0.5
        this.h.legL.rotation.x += swing
        this.h.legR.rotation.x -= swing
      }
      // loose the arrow!
      if (this.aimRelease <= 0 && this.aimT / 0.55 >= 0.35 && input.consume('LMB')) {
        game.firePlayerArrow(this, this.aimT / 0.55)
        this.aimRelease = 0.22
        this.aimT = 0 // re-nock
      }
      if (input.consume('Space') && this.stamina >= STAMINA_COST_ROLL) {
        game.sfx.roll()
        this.aimT = 0
        if (game.playerBow) setBowDraw(game.playerBow, 0)
        if (moving) {
          const fwdX = -Math.sin(camYaw), fwdZ = -Math.cos(camYaw)
          const rgtX = -fwdZ, rgtZ = fwdX
          this.startRoll(rgtX * ax.x + fwdX * ax.z, rgtZ * ax.x + fwdZ * ax.z)
        } else {
          this.startRoll(0, 0)
        }
      } else if (!wantBlock) {
        this.state = 'idle'
        this.stateT = 0
        this.aimT = 0
        if (game.playerBow) {
          setBowDraw(game.playerBow, 0)
          setNocked(game.playerBow, false)
        }
        resetPose(this.h)
      }
      }
    } else if (this.state === 'block') {
      // ---- guarding: slow shuffle, no actions, roll still allowed ----
      this.stateT += dt
      if (moving) {
        const fwdX = -Math.sin(camYaw), fwdZ = -Math.cos(camYaw)
        const rgtX = -fwdZ, rgtZ = fwdX
        const mx = rgtX * ax.x + fwdX * ax.z
        const mz = rgtZ * ax.x + fwdZ * ax.z
        this.slide(world, mx * WALK_SPEED * 0.42 * dt, mz * WALK_SPEED * 0.42 * dt)
        this.targetYaw = Math.atan2(mx, mz)
        // guarding on the move: legs march, shield stays up
        animBlockWalk(this.h, this.animT)
      } else {
        // standing guard: anchor the shield to the camera's forward — the
        // block arc then reliably covers whatever the player is looking at
        // (stale last-move yaw made hits sneak "through" the shield)
        this.targetYaw = Math.atan2(-Math.sin(camYaw), -Math.cos(camYaw))
        animBlock(this.h, this.animT)
      }
      // stale attack input is discarded while guarding
      input.consume('LMB')
      input.consume('HEAVY')
      if (input.consume('Space') && this.stamina >= STAMINA_COST_ROLL) {
        game.sfx.roll()
        if (moving) {
          const fwdX = -Math.sin(camYaw), fwdZ = -Math.cos(camYaw)
          const rgtX = -fwdZ, rgtZ = fwdX
          this.startRoll(rgtX * ax.x + fwdX * ax.z, rgtZ * ax.x + fwdZ * ax.z)
        } else {
          this.startRoll(0, 0)
        }
      } else if (!wantBlock) {
        this.state = 'idle'
        this.stateT = 0
        resetPose(this.h)
      }
    } else {
      // idle / run
      if (wantBlock) {
        // a bow in the active left hand aims instead of guarding
        this.state = this.loadout.aiming ? 'aim' : 'block'
        this.stateT = 0
      } else {
      this.sprinting =
        moving && this.loadout.sprintMult > 0 &&
        (input.keys.has('ShiftLeft') || input.keys.has('ShiftRight')) && this.stamina > 1
      // equip-burden: heavy gear drags the stride (DS movement tiers)
      const speed =
        (this.sprinting ? SPRINT_SPEED * this.loadout.sprintMult : WALK_SPEED * this.loadout.walkMult)
      if (moving) {
        const fwdX = -Math.sin(camYaw), fwdZ = -Math.cos(camYaw)
        const rgtX = -fwdZ, rgtZ = fwdX
        const mx = rgtX * ax.x + fwdX * ax.z
        const mz = rgtZ * ax.x + fwdZ * ax.z
        this.slide(world, mx * speed * dt, mz * speed * dt)
        this.targetYaw = Math.atan2(mx, mz)
        this.state = 'run'
        if (this.sprinting) {
          this.stamina -= 13 * dt
          this.staminaDelay = Math.max(this.staminaDelay, 0.25)
        }
      } else {
        this.state = 'idle'
      }

      // idle / run animation
      if (this.state === 'run') {
        animWalk(this.h, this.animT, this.sprinting ? 1.3 : 1)
      } else {
        animIdle(this.h, this.animT)
      }

      // actions
      if (input.consume('Space') && this.stamina >= STAMINA_COST_ROLL) {
        game.sfx.roll()
        if (moving) {
          const fwdX = -Math.sin(camYaw), fwdZ = -Math.cos(camYaw)
          const rgtX = -fwdZ, rgtZ = fwdX
          this.startRoll(rgtX * ax.x + fwdX * ax.z, rgtZ * ax.x + fwdZ * ax.z)
        } else {
          this.startRoll(0, 0)
        }
      } else {
        // heavy attack: Shift+LMB or touch HEAVY button; light: LMB
        let heavy = false
        let light = false
        if (input.consume('HEAVY')) heavy = true
        else if (
          (input.keys.has('ShiftLeft') || input.keys.has('ShiftRight')) &&
          input.consume('LMB')
        )
          heavy = true
        else light = input.consume('LMB')
        if (heavy && this.stamina >= STAMINA_COST_HEAVY) {
          this.combo = 0
          this.startAttack(this.heavyDef())
          game.sfx.swing()
        } else if (light && this.stamina >= STAMINA_COST_LIGHT) {
          this.combo = 0
          this.startAttack(this.lightDef(0))
          game.sfx.swing()
        } else if (input.consume('KeyE') && this.estus > 0) {
          this.estus--
          this.state = 'drink'
          this.stateT = 0
          this.healedThisDrink = false
        } else if (input.consume('KeyR') || input.consume('Cast')) {
          // pyromancy — R (or the touch ember button)
          if (this.pyroUnlocked && this.pyro > 0 && this.stamina >= STAMINA_COST_CAST) {
            game.sfx.cast()
            this.startCast()
          } else {
            game.onCastFail(this.pyroUnlocked, this.pyro > 0)
          }
        }
      }
      }
    }

    // ---- facing ----
    if (this.state !== 'roll') {
      let target = this.targetYaw
      if (this.lockedTarget && this.lockedTarget.alive) {
        target = Math.atan2(
          this.lockedTarget.pos.x - this.pos.x,
          this.lockedTarget.pos.z - this.pos.z
        )
      }
      let d = target - this.yaw
      while (d > Math.PI) d -= Math.PI * 2
      while (d < -Math.PI) d += Math.PI * 2
      this.yaw += d * Math.min(1, 14 * dt)
    }

    // ---- cape sway — cloth answers every stride ----
    if (this.h.capePivot) {
      const target =
        this.state === 'run'
          ? 0.34 + Math.sin(this.animT * 9) * 0.1 + (this.sprinting ? 0.14 : 0)
          : this.state === 'roll' ? 1.2
          : this.state === 'attack' || this.state === 'heavy' ? 0.2
          : 0.08 + Math.sin(this.animT * 1.8) * 0.03
      const cape = this.h.capePivot
      cape.rotation.x += (target - cape.rotation.x) * Math.min(1, 8 * dt)
    }

    // ---- stamina regen ----
    this.staminaDelay -= dt
    if (this.staminaDelay <= 0) {
      if (!this.busy) {
        this.stamina = Math.min(this.maxStamina, this.stamina + STAMINA_REGEN * this.loadout.stamRegenMul * dt)
      } else if (this.state === 'block') {
        // slow regen while guarding
        this.stamina = Math.min(this.maxStamina, this.stamina + STAMINA_REGEN * this.loadout.stamRegenMul * 0.35 * dt)
      }
    }

    this.resolveGround(world, dt, false)

    // ---- apply to model ----
    this.h.group.position.copy(this.pos)
    this.h.group.rotation.y = this.yaw
  }

  private targetYaw = Math.PI

  private lightDef(combo: number): AttackDef {
    const m = this.damageMult
    const s = 1 / Math.max(0.4, this.loadout.weaponSpd)
    if (combo === 0) return { dur: 0.52 * s, impact: 0.32, dmg: Math.round(30 * m), range: 2.4, arc: 1.15, cost: STAMINA_COST_LIGHT, variant: 'light0', heavy: false, knock: 2 }
    if (combo === 1) return { dur: 0.5 * s, impact: 0.3, dmg: Math.round(32 * m), range: 2.4, arc: 1.15, cost: STAMINA_COST_LIGHT, variant: 'light1', heavy: false, knock: 2 }
    return { dur: 0.74 * s, impact: 0.42, dmg: Math.round(42 * m), range: 2.7, arc: Math.PI, cost: STAMINA_COST_LIGHT, variant: 'light2', heavy: false, knock: 3.5 }
  }

  private heavyDef(): AttackDef {
    const m = this.damageMult
    const s = 1 / Math.max(0.4, this.loadout.weaponSpd)
    return { dur: 0.95 * s, impact: 0.5, dmg: Math.round(58 * m), range: 2.9, arc: 1.4, cost: STAMINA_COST_HEAVY, variant: 'heavy', heavy: true, knock: 5 }
  }

  /** would a stance with feet at `sup` in this column cram the body into
      an overhead built block (low roof, eave, lintel)? */
  private headBumped(world: GameWorld, x: number, z: number, sup: number): boolean {
    const bx = Math.round(x)
    const bz = Math.round(z)
    const y0 = Math.floor(sup + 1.06)
    const y1 = Math.floor(sup + 1.55)
    for (let y = y0; y <= y1; y++) if (world.solidStruct(bx, y, bz)) return true
    return false
  }

  /** axis-separated blocky collision — walls stop the body, one-block
      steps auto-climb, cliffs are walls but drops are always allowed;
      steps that would lift the body INTO an overhead block (eaves, low
      roofs) are refused, so nothing ever stands wedged inside masonry;
      a blocked move whose landing is a real DROP (a doorway over a
      raised floor) retries the head check at the lower support — the
      body falls as it crosses the threshold, so a lintel can never
      seal the player inside a room they walked into */
  private slide(world: GameWorld, dx: number, dz: number) {
    const r = 0.28
    if (dx !== 0) {
      const nx = this.pos.x + dx
      const edge = nx + Math.sign(dx) * r
      if (
        !world.wallAt(edge, this.pos.z - r, this.pos.y) &&
        !world.wallAt(edge, this.pos.z + r, this.pos.y)
      ) {
        const sup = world.supportAt(nx, this.pos.z, this.pos.y)
        if (sup <= this.pos.y + 0.5 || !this.headBumped(world, nx, this.pos.z, sup))
          this.pos.x = nx
      } else {
        // threshold drop: re-judge head room at the landing height
        const sup = world.supportAt(nx, this.pos.z, this.pos.y)
        if (
          sup <= this.pos.y - 0.5 &&
          !world.wallAt(edge, this.pos.z - r, sup) &&
          !world.wallAt(edge, this.pos.z + r, sup)
        )
          this.pos.x = nx
      }
    }
    if (dz !== 0) {
      const nz = this.pos.z + dz
      const edge = nz + Math.sign(dz) * r
      if (
        !world.wallAt(this.pos.x - r, edge, this.pos.y) &&
        !world.wallAt(this.pos.x + r, edge, this.pos.y)
      ) {
        const sup = world.supportAt(this.pos.x, nz, this.pos.y)
        if (sup <= this.pos.y + 0.5 || !this.headBumped(world, this.pos.x, nz, sup))
          this.pos.z = nz
      } else {
        // threshold drop: re-judge head room at the landing height
        const sup = world.supportAt(this.pos.x, nz, this.pos.y)
        if (
          sup <= this.pos.y - 0.5 &&
          !world.wallAt(this.pos.x - r, edge, sup) &&
          !world.wallAt(this.pos.x + r, edge, sup)
        )
          this.pos.z = nz
      }
    }
  }

  private resolveGround(world: GameWorld, dt: number, sinking: boolean) {
    const ground = world.supportAt(this.pos.x, this.pos.z, this.pos.y)
    if (this.pos.y > ground + 0.02) {
      this.vy -= 24 * dt
      this.pos.y = Math.max(ground, this.pos.y + this.vy * dt)
      if (this.pos.y <= ground) this.vy = 0
    } else if (this.pos.y < ground) {
      this.pos.y = Math.min(ground, this.pos.y + 11 * dt)
      this.vy = 0
    } else {
      this.vy = 0
    }
    void sinking
  }
}
