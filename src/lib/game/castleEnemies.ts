import * as THREE from 'three'
import { Enemy, type EnemyOpts } from './enemy'
import {
  createGargoyle, animGargoyleDormant, animGargoylePerch, animGargoyleRun,
  animGargoyleUnfurl, animGargoyleLunge, animGargoyleDead, type GargoyleRig,
  createCantor, animCantorFloat, animCantorGlide, animCantorChant, animCantorCast,
  animCantorDead, type CantorRig,
  createAshHound, animHoundIdle, animHoundRun, animHoundLunge, animHoundDead, type HoundRig,
} from './castleMobs'
import type { Game } from './game'
import type { Player } from './player'

/* ==================================================================
   THE SERVANTS OF MANORLOTH — enemy classes for the castle zone.
   Each subclass swaps the base humanoid for its own hand-built rig
   (castleMobs.ts) inside its constructor, then choreographs the
   shared state machine through the Enemy hook surface:
   idle → chase → windup → strike → recover.
   ================================================================== */

/* ==================================================================
   THE STONE GARGOYLE — stands as a statue until the walker is close,
   then unfurls with a stone-screech and fights as a fast skittering
   pouncer: coil → burst-dash → claws. Its ember eyes light the wake. */
export class GargoyleEnemy extends Enemy {
  private rig: GargoyleRig
  private dormant = true

  constructor(scene: THREE.Scene, spawn: THREE.Vector3) {
    super(scene, 'zombie', spawn, {
      hp: 115, dmg: 26, speed: 3.7, aggro: 10.5, atkRange: 2.15,
      windup: 0.46, recover: 0.55, souls: 95, scale: 1.25,
      name: 'گارگویل مانولث',
    } satisfies EnemyOpts)
    // swap the placeholder body for the true stone rig
    scene.remove(this.h.group)
    this.h = createGargoyle(1.25)
    this.rig = this.h.group.userData.gargoyle as GargoyleRig
    scene.add(this.h.group)
    this.syncModel()
  }

  get lootKind(): string {
    return 'gargoyle'
  }

  reset() {
    super.reset()
    this.dormant = true
    for (const e of this.rig.eyes) e.visible = false
    for (const c of this.rig.cracks) c.visible = false
  }

  /** the statue's watch — wakes with a one-shot unfurl when approached */
  update(dt: number, player: Player, game: Game) {
    if (this.dormant && !this.dead) {
      this.animT += dt
      animGargoyleDormant(this.h)
      this.syncModel()
      const dist = Math.hypot(player.pos.x - this.pos.x, player.pos.z - this.pos.z)
      if (dist < this.opts.aggro && this.gateSeals(game, player.pos.x, player.pos.z) === false) {
        this.dormant = false
        this.state = 'roar'
        this.stateT = 0
        game.sfx.hiss()
        game.spawnBurst(
          this.pos.clone().add(new THREE.Vector3(0, 1.0, 0)),
          0xff7a1e, 12, 1.8, 0.7, 0.14
        )
      }
      return
    }
    super.update(dt, player, game)
  }

  protected roarDur() {
    return 1.35
  }
  protected roarAnim(p: number) {
    animGargoyleUnfurl(this.h, p)
  }
  protected idleAnim(t: number) {
    animGargoylePerch(this.h, t)
  }
  protected strollAnim(t: number, _f = 1) {
    animGargoyleRun(this.h, t * 0.42) // patrols skitter slowly
  }
  protected moveAnim(t: number, _f = 1) {
    animGargoyleRun(this.h, t)
  }
  protected attackCooldown() {
    return 1.5 + Math.random() * 1.1
  }
  protected wantsAttack(dist: number, angDiff: number) {
    return dist <= this.opts.atkRange && Math.abs(angDiff) < 1.2
  }
  protected wantsToClose(dist: number) {
    return dist > 1.5
  }
  protected windupAnim(p: number) {
    animGargoyleLunge(this.h, p * 0.34) // the coil
  }
  protected strikeDur() {
    return 0.52
  }
  protected strikeImpactP() {
    return 0.42
  }
  protected strikeAnim(p: number) {
    animGargoyleLunge(this.h, 0.34 + p * 0.38) // the burst
  }
  /** the burst-dash — claws carried forward on the leap */
  protected strikeMove(dt: number, p: number, _player: Player, _game: Game) {
    if (p > 0.05 && p < 0.62) {
      const ux = Math.sin(this.yaw)
      const uz = Math.cos(this.yaw)
      this.slide(ux * 3.4 * dt, uz * 3.4 * dt)
    }
  }
  protected recoverAnim(p: number) {
    animGargoyleLunge(this.h, 0.72 + p * 0.28) // the landing
  }
  protected deathDur() {
    return 1.15
  }
  protected deathFxAt() {
    return 0.35
  }
  protected spawnDeathFx(game: Game, _p: number) {
    game.spawnBurst(this.pos.clone().add(new THREE.Vector3(0, 0.6, 0)), 0x8a8f9a, 16, 2.2, 0.8, 0.2)
    game.sfx.stomp()
  }
  protected deathAnim(p: number) {
    animGargoyleDead(this.h, p)
  }
}

/* ==================================================================
   THE REQUIEM CANTOR — a floating singer that holds its distance and
   swings its censer: the whirling chant, then the released note (an
   ember bolt). Its halo of candles gutter when it falls. */
export class CantorEnemy extends Enemy {
  private rig: CantorRig
  private trailT = 0

  constructor(scene: THREE.Scene, spawn: THREE.Vector3) {
    super(scene, 'zombie', spawn, {
      hp: 85, dmg: 19, speed: 2.5, aggro: 15, atkRange: 2.0,
      windup: 0.95, recover: 0.6, souls: 110, scale: 1.0,
      name: 'مرثیه‌خوان مانولث',
    } satisfies EnemyOpts)
    scene.remove(this.h.group)
    this.h = createCantor(1.0)
    this.rig = this.h.group.userData.cantor as CantorRig
    scene.add(this.h.group)
    this.syncModel()
  }

  get lootKind(): string {
    return 'cantor'
  }

  protected attackCooldown() {
    return 2.1 + Math.random() * 1.2
  }
  protected wantsAttack(dist: number, _angDiff: number) {
    return dist <= 12.5
  }
  protected wantsToClose(dist: number) {
    return dist > 11
  }
  /** hovering drift — holds the 6..11m singing band like the blazes do */
  protected chaseMove(dt: number, dx: number, dz: number, dist: number, angleToPlayer: number) {
    this.yaw = angleToPlayer
    const ux = dx / (dist || 1)
    const uz = dz / (dist || 1)
    if (dist < 6) {
      this.slide(-ux * this.speed() * 0.7 * dt, -uz * this.speed() * 0.7 * dt)
    } else if (dist > 11) {
      this.slide(ux * this.speed() * dt, uz * this.speed() * dt)
    } else {
      const sway = Math.sin(this.animT * 1.3) * 0.5
      this.slide(-uz * sway * dt, ux * sway * dt)
    }
    animCantorGlide(this.h, this.animT)
  }
  protected idleAnim(t: number) {
    animCantorFloat(this.h, t)
  }
  protected strollAnim(t: number, _f = 1) {
    animCantorFloat(this.h, t)
  }
  protected windupAnim(p: number) {
    animCantorChant(this.h, p)
  }
  protected strikeDur() {
    return 0.6
  }
  protected strikeImpactP() {
    return 0.34
  }
  protected strikeAnim(p: number) {
    animCantorCast(this.h, p)
  }
  /** the note leaves the cage — an ember bolt at the impact beat */
  protected doStrike(player: Player, game: Game, _dist: number, _angleToPlayer: number) {
    const from = this.pos.clone().add(new THREE.Vector3(0, 1.55, 0))
    const to = player.pos.clone().add(new THREE.Vector3(0, 0.95, 0))
    game.spawnFireball(from, to, Math.round(this.opts.dmg * (0.9 + Math.random() * 0.25)))
    game.sfx.cast()
  }
  protected recoverAnim(p: number) {
    animCantorCast(this.h, 0.4 + p * 0.6)
  }
  /** the float — the hem hangs above the floor, the body never lands.
      underground-aware: in the crypt the plateau's surfaceAt points at
      the cathedral floor ABOVE the ceiling, so the hover height comes
      from supportAt around the cantor's own altitude instead. */
  protected syncModel() {
    this.h.group.position.copy(this.pos)
    this.h.group.rotation.y = this.yaw
    if (this.world) {
      const ground = this.world.supportAt(this.pos.x, this.pos.z, this.pos.y)
      this.pos.y = ground
      this.h.group.position.y = ground + 1.02 + Math.sin(this.animT * 2.1) * 0.09
    }
  }
  /** wax-scented cinders drift off the vestments while it sings */
  update(dt: number, player: Player, game: Game) {
    super.update(dt, player, game)
    if (this.alive && !this.dead && this.state !== 'idle') {
      this.trailT -= dt
      if (this.trailT <= 0) {
        this.trailT = 0.22
        game.spawnBurst(
          this.pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.4, 0.4, (Math.random() - 0.5) * 0.4)),
          0xffd23d, 1, 0.4, 0.45, 0.07
        )
      }
    }
  }
  protected deathDur() {
    return 1.3
  }
  protected deathFxAt() {
    return 0.5
  }
  protected spawnDeathFx(game: Game, _p: number) {
    game.spawnBurst(this.pos.clone().add(new THREE.Vector3(0, 0.9, 0)), 0xffd23d, 14, 1.8, 0.7, 0.13)
    game.sfx.ember()
  }
  protected deathAnim(p: number) {
    animCantorDead(this.h, p)
  }
}

/* ==================================================================
   THE ASH HOUND — pack hunter of the castle yard. Fastest body in
   either world: sprints the processional path, coils, and bursts
   into a snapping lunge. Where it runs, the ember seams on its ribs
   shed real cinders. */
export class HoundEnemy extends Enemy {
  private rig: HoundRig
  private trailT = 0

  constructor(scene: THREE.Scene, spawn: THREE.Vector3) {
    super(scene, 'zombie', spawn, {
      hp: 74, dmg: 21, speed: 4.25, aggro: 13, atkRange: 2.2,
      windup: 0.4, recover: 0.45, souls: 65, scale: 0.95,
      name: 'سگ خاکستر',
    } satisfies EnemyOpts)
    scene.remove(this.h.group)
    this.h = createAshHound(0.95)
    this.rig = this.h.group.userData.hound as HoundRig
    scene.add(this.h.group)
    this.syncModel()
  }

  get lootKind(): string {
    return 'hound'
  }

  protected attackCooldown() {
    return 1.25 + Math.random() * 0.9
  }
  protected idleAnim(t: number) {
    animHoundIdle(this.h, t)
  }
  protected strollAnim(t: number, _f = 1) {
    animHoundRun(this.h, t * 0.4) // the slow circle around the post
  }
  protected moveAnim(t: number, _f = 1) {
    animHoundRun(this.h, t)
  }
  protected windupAnim(p: number) {
    animHoundLunge(this.h, p * 0.3) // the coil
  }
  protected strikeDur() {
    return 0.55
  }
  protected strikeImpactP() {
    return 0.45
  }
  protected strikeAnim(p: number) {
    animHoundLunge(this.h, 0.3 + p * 0.4) // the burst
  }
  /** the pounce dash — the whole body is the weapon */
  protected strikeMove(dt: number, p: number, _player: Player, _game: Game) {
    if (p > 0.08 && p < 0.6) {
      const ux = Math.sin(this.yaw)
      const uz = Math.cos(this.yaw)
      this.slide(ux * 5.2 * dt, uz * 5.2 * dt)
    }
  }
  protected recoverAnim(p: number) {
    animHoundLunge(this.h, 0.7 + p * 0.3) // the land
  }
  /** running hounds shed cinders — the trail tells you where the pack went */
  update(dt: number, player: Player, game: Game) {
    super.update(dt, player, game)
    if (this.alive && this.state === 'chase' && !this.dead) {
      this.trailT -= dt
      if (this.trailT <= 0) {
        this.trailT = 0.16
        game.spawnBurst(
          this.pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.3, 0.35, (Math.random() - 0.5) * 0.3)),
          0xff7a1e, 1, 0.35, 0.4, 0.08
        )
      }
    }
  }
  protected deathDur() {
    return 1.0
  }
  protected deathFxAt() {
    return 0.4
  }
  protected spawnDeathFx(game: Game, _p: number) {
    game.spawnBurst(this.pos.clone().add(new THREE.Vector3(0, 0.5, 0)), 0xff7a1e, 10, 1.5, 0.6, 0.12)
  }
  protected deathAnim(p: number) {
    animHoundDead(this.h, p)
  }
}
