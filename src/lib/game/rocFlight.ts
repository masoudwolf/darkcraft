import * as THREE from 'three'
import { createRoc, animRocPerch, animRocFlap, animRocGlide, animRocGrab, animRocCarry, type RocRig } from './roc'
import { resetPose, type Humanoid } from './models'
import type { Game } from './game'

/* ==================================================================
   THE ROC'S JOURNEY — in-game flight director.

   When the third lord falls and the ember has answered, the Night
   Roc comes. This class owns EVERYTHING of that journey: the roc's
   path (wall-clock keyframes, clearance-checked against both
   worlds), the rider welded to the actual talons, the director's
   camera, the cloud-sea fog wipe that swaps the world mid-flight,
   the captions and the sound beats.

   It runs as the game cinematic's "actor" hook (cineRoarStep), so
   the engine's cinematic system keeps handling letterbox, skip and
   the world freeze — the director only stages the shot.
   ================================================================== */

export type RocTrack = 'toCastle' | 'toVale'

interface PathKey {
  t: number
  x: number
  y: number
  z: number
}

/** where the rider stands on each deck (feet position) — both sit on
    the talon-reach line of the hovering roc (its claws hang ~1.95
    behind the group origin), so the grab meets the rider exactly */
const VALE_STAND = new THREE.Vector3(52, 10, -41.2)
const CASTLE_STAND = new THREE.Vector3(0, 14, 53.9)
/* where the roc perches while idle — placed so the TALONS land exactly
   on the deck's claw-groove cells (vale grooves: x 51..52, z -38/-40;
   castle grooves: x -1.2..0, z 55.5/56.9). Both face west: head over
   the abyss, tail ending at the deck's far edge — and the castle one
   stays clear of Manorloth's bonfire at (2.5, 56). perch() then sinks
   the group until the lowest claw TOUCHES the deck (no float). */
const VALE_PERCH = { x: 50, y: 10, z: -39, yaw: -Math.PI / 2 }
const CASTLE_PERCH = { x: -2.5, y: 14, z: 56.2, yaw: -Math.PI / 2 }

const ROC_DUR: Record<RocTrack, number> = { toCastle: 35.2, toVale: 23.6 }

/* ---- the flight to Manorloth ----
   Vale half: the dive onto the ancient landing stage, the scoop,
   the climb north-east over the fortress. Castle half reuses the
   preview's clearance-audited arc (gate spires y≈40, bell tower
   y≈48, lantern finial y≈53 — every waypoint clears them). The
   world swap happens at full white-out, 15.6s in. */
const TO_CASTLE: PathKey[] = [
  { t: 0.0, x: 34, y: 36, z: -54 }, // out of the southern mist
  { t: 2.6, x: 44, y: 26, z: -50 },
  { t: 3.8, x: 50, y: 18, z: -46 }, // the brake begins
  { t: 4.8, x: 52, y: 16.2, z: -42.5 }, // flaring over the deck edge
  { t: 5.6, x: 52, y: 15.5, z: -39.6 }, // the hover — talons reach
  { t: 6.4, x: 52, y: 15.6, z: -39.2 }, // clutch sealed
  { t: 8.0, x: 55, y: 22, z: -35 }, // climbing away east
  { t: 9.6, x: 54, y: 30, z: -20 },
  { t: 11.4, x: 48, y: 40, z: -2 }, // over the fortress
  { t: 13.2, x: 40, y: 48, z: 14 },
  { t: 14.8, x: 33, y: 54, z: 26 }, // into the cloud veil
  { t: 16.2, x: 30, y: 57, z: 30 },
  /* ---- the world changes inside the white ---- */
  { t: 17.8, x: -30, y: 62, z: -104 }, // emerging far south of Manorloth
  { t: 19.6, x: -24, y: 58, z: -76 },
  { t: 21.6, x: -8, y: 55, z: -44 },
  { t: 23.6, x: 22, y: 52, z: -22 },
  { t: 25.4, x: 28, y: 44, z: 8 }, // along the east flank
  { t: 27.0, x: 26, y: 38, z: 34 }, // banking toward the bridge axis
  { t: 28.6, x: 14, y: 28, z: 46 },
  { t: 29.8, x: 0, y: 20.5, z: 54.2 }, // the descent over the deck
  { t: 31.0, x: 0, y: 15.9, z: 55.6 }, // low — the rider is set down
  { t: 32.8, x: 12, y: 20, z: 63 }, // the flare away
  { t: 34.4, x: 26, y: 26, z: 76 }, // fading into the mist
]

/* ---- the flight back to the Vale ---- */
const TO_VALE: PathKey[] = [
  { t: 0.0, x: -2.5, y: 16.4, z: 56.2 }, // flaring up from the perch
  { t: 1.2, x: -1, y: 19.2, z: 56.0 },
  { t: 2.2, x: 0, y: 19.5, z: 55.4 }, // the hover above the deck
  { t: 3.0, x: 0, y: 16.2, z: 55.8 }, // the dip — talons reach
  { t: 3.8, x: 0, y: 16.3, z: 55.6 }, // clutch sealed
  { t: 5.4, x: -14, y: 24, z: 48 }, // climbing west
  { t: 7.2, x: -24, y: 36, z: 30 },
  { t: 8.8, x: -20, y: 46, z: 4 },
  { t: 10.2, x: -12, y: 54, z: -22 },
  { t: 11.6, x: -6, y: 60, z: -50 }, // into the white
  /* ---- the world changes inside the white ---- */
  { t: 13.0, x: 24, y: 54, z: -55 }, // emerging over the ash
  { t: 14.4, x: 36, y: 46, z: -55 },
  { t: 15.8, x: 45, y: 34, z: -54 },
  { t: 17.0, x: 50, y: 24, z: -47 },
  { t: 18.0, x: 52, y: 17.5, z: -43 }, // braking toward the old stage
  { t: 19.0, x: 52, y: 15.5, z: -39.6 }, // the hover
  { t: 19.8, x: 52, y: 15.1, z: -39.2 }, // low — the rider steps onto ash
  { t: 21.4, x: 45, y: 18, z: -47 }, // the flare away
  { t: 22.8, x: 34, y: 25, z: -55 },
]

/** beat table per track — grab/scoop/dismount windows + fog + swap */
const BEATS = {
  toCastle: {
    grabT0: 4.6, grabT1: 6.2, scoop0: 5.5, scoop1: 6.15,
    dismount0: 29.9, dismount1: 30.7, flapAt: 31.2,
    wipe0: 14.6, wipe1: 16.0, swapAt: 15.6, open0: 17.2, open1: 19.2,
  },
  toVale: {
    grabT0: 2.4, grabT1: 4.0, scoop0: 3.1, scoop1: 3.75,
    dismount0: 18.9, dismount1: 19.7, flapAt: 19.8,
    wipe0: 10.4, wipe1: 11.8, swapAt: 11.4, open0: 12.6, open1: 14.6,
  },
}

/** caption rails (t0, t1, text) per track */
const CAPTIONS: Record<RocTrack, [number, number, string][]> = {
  toCastle: [
    [0.4, 4.0, 'سکوی فرود رُخ — جای پنجه‌ها هنوز در سنگ است'],
    [4.6, 7.8, 'رُخِ شب، آخرین خدمتکارِ خدایانِ کهن — سه لرد افتادند و بدهیِ آسمان ادا شد'],
    [10.5, 15.8, 'از درّه بالا می‌روی — به آن‌سویِ ابرها، جایی که جز آسمان راهی نیست'],
    [21.0, 26.0, 'و ابرها شکافته شدند...'],
    [29.6, 34.8, 'قلعهٔ مانولث — سرایِ خدایانِ گم‌شده، بر فرازِ دریای ابر'],
  ],
  toVale: [
    [0.3, 3.6, 'رُخِ شب تو را به درّهٔ اخگر بازمی‌گرداند'],
    [13.2, 17.6, 'درّهٔ اخگر — خانهٔ آتش‌های کوچک و راه‌های خاکستری'],
  ],
}

/** cloud white-out palette vs each world's settled palette */
const CLOUD_FOG = new THREE.Color(0x8f98ab)
const CLOUD_BG = new THREE.Color(0x87909f)
const VALE_FOG = new THREE.Color(0x261016) // the ash-wastes tint the player leaves from
const VALE_BG = new THREE.Color(0x1c0c10)
const CASTLE_FOG = new THREE.Color(0x161f33)
const CASTLE_BG = new THREE.Color(0x101720)
const VALE_FOG_RANGE: [number, number] = [46, 175]
const CASTLE_FOG_RANGE: [number, number] = [40, 240]

/** smooth interpolation along a keyframe track */
function pathPos(keys: PathKey[], t: number, out: THREE.Vector3) {
  let i = 0
  while (i < keys.length - 2 && t > keys[i + 1].t) i++
  const a = keys[i]
  const b = keys[i + 1]
  const span = Math.max(0.001, b.t - a.t)
  let p = Math.min(1, Math.max(0, (t - a.t) / span))
  p = p * p * (3 - 2 * p) // smoothstep
  out.set(a.x + (b.x - a.x) * p, a.y + (b.y - a.y) * p, a.z + (b.z - a.z) * p)
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v))
const lerp = (a: number, b: number, t: number) => a + (b - a) * clamp01(t)

export class RocFlight {
  private h: Humanoid
  private rig: RocRig
  private mode: 'hidden' | 'perch' | 'flight' = 'hidden'
  private track: RocTrack = 'toCastle'
  private t = 0
  private idleT = 0
  private swapped = false
  private parked: 'vale' | 'castle' | null = null
  private captionIdx = -1
  private screeched = { dive: false, emerge: false, part: false }
  private gust = 0
  // damped director camera
  private camPosS = new THREE.Vector3()
  private camLookS = new THREE.Vector3()
  // scratch
  private tmpA = new THREE.Vector3()
  private tmpB = new THREE.Vector3()
  private tmpC = new THREE.Vector3()
  private gL = new THREE.Vector3()
  private gR = new THREE.Vector3()
  private grabMid = new THREE.Vector3()
  private perchV = new THREE.Vector3()

  constructor(private game: Game) {
    this.h = createRoc(2.1)
    this.rig = this.h.group.userData.roc as RocRig
    this.h.group.visible = false
    game.engine.scene.add(this.h.group)
  }

  get flying() {
    return this.mode === 'flight'
  }

  /** the perched roc's settled world position — the travel prompt orbits this */
  get perchPos(): THREE.Vector3 | null {
    if (this.mode !== 'perch' || !this.parked) return null
    return this.perchV.copy(this.h.group.position)
  }

  /** which side the roc is parked on (null = not in the world yet) */
  get parkedAt(): 'vale' | 'castle' | null {
    return this.mode === 'perch' ? this.parked : null
  }

  /** park the roc on a platform's perch stone — then sink it until the
      lowest talon TOUCHES the deck: no floating, no sinking, the claws
      rest on the very stone the grooves were burned into */
  perch(where: 'vale' | 'castle') {
    this.mode = 'perch'
    this.parked = where
    this.idleT = 0
    const p = where === 'vale' ? VALE_PERCH : CASTLE_PERCH
    this.h.group.visible = true
    this.h.group.position.set(p.x, p.y, p.z)
    this.h.group.rotation.set(0, p.yaw, 0)
    animRocPerch(this.h, 0)
    this.h.group.updateMatrixWorld(true)
    const box = new THREE.Box3().setFromObject(this.h.legL)
    box.union(new THREE.Box3().setFromObject(this.h.legR))
    this.h.group.position.y += p.y - box.min.y
  }

  hide() {
    this.mode = 'hidden'
    this.parked = null
    this.h.group.visible = false
  }

  /** open the journey — the game wraps this in a cinematic */
  begin(track: RocTrack) {
    this.mode = 'flight'
    this.track = track
    this.t = 0
    this.swapped = false
    this.captionIdx = -1
    this.screeched = { dive: false, emerge: false, part: false }
    this.gust = 0
    const rider = this.game.player.h.group
    rider.visible = true
    // first shot — snap the director camera to its opening frame
    this.directorShot(0, this.tmpA, this.tmpB, 0.016)
    this.camPosS.copy(this.tmpA)
    this.camLookS.copy(this.tmpB)
    this.h.group.visible = true
  }

  /** the game calls this as the cinematic actor — the director stages the shot */
  step(dt: number) {
    if (this.mode !== 'flight') return
    this.t += dt
    const t = this.t
    const b = BEATS[this.track]
    const keys = this.track === 'toCastle' ? TO_CASTLE : TO_VALE
    const roc = this.h.group
    const player = this.game.player

    /* ---- the roc along its path ---- */
    pathPos(keys, t, this.tmpA)
    roc.position.copy(this.tmpA)
    pathPos(keys, Math.min(ROC_DUR[this.track], t + 0.25), this.tmpB)
    const dx = this.tmpB.x - this.tmpA.x
    const dz = this.tmpB.z - this.tmpA.z
    if (Math.abs(dx) + Math.abs(dz) > 0.001) roc.rotation.y = Math.atan2(dx, dz)
    roc.rotation.x = 0
    roc.rotation.z = 0.16 + Math.sin(t * 0.7) * 0.05 // the carry bank

    /* ---- animation beats ---- */
    this.idleT += dt
    if (t < b.grabT0) {
      animRocGlide(this.h, this.idleT)
      if (this.track === 'toVale' && t < 1.2) animRocFlap(this.h, this.idleT) // the take-off flare
    } else if (t < b.grabT1) {
      animRocGrab(this.h, (t - b.grabT0) / (b.grabT1 - b.grabT0))
    } else if (t >= b.dismount0 && t < b.flapAt) {
      // talons open, shins extend — the rider is set down like a coin on stone
      animRocGrab(this.h, 0.5 + Math.sin((t - b.dismount0) * 5) * 0.04)
    } else if (t >= b.flapAt) {
      animRocFlap(this.h, this.idleT)
    } else {
      animRocCarry(this.h, this.idleT)
    }

    /* ---- THE RIDER — welded to the true talons ----
       His raised hands sit inside the talon curl every frame; the
       bank and the wingbeat swing him alive. (Offsets are scaled by
       the rider's own scale — the game hero is 0.95, the viewer's
       dummy was 1.) */
    this.rig.grabL.getWorldPosition(this.gL)
    this.rig.grabR.getWorldPosition(this.gR)
    this.grabMid.addVectors(this.gL, this.gR).multiplyScalar(0.5)
    const rs = player.h.group.scale.x
    const yaw = roc.rotation.y
    const hang = this.tmpB.set(
      this.grabMid.x - Math.sin(yaw) * 0.32 * rs,
      this.grabMid.y - 1.88 * rs,
      this.grabMid.z - Math.cos(yaw) * 0.32 * rs
    )
    // where he waits is where he was picked up; where he lands is the OTHER deck
    const waitStand = this.track === 'toCastle' ? VALE_STAND : CASTLE_STAND
    const landStand = this.track === 'toCastle' ? CASTLE_STAND : VALE_STAND
    const waitYaw = this.track === 'toCastle' ? Math.PI : 0
    const landYaw = this.track === 'toCastle' ? Math.PI : -Math.PI / 2
    if (t < b.scoop0) {
      // waiting on the deck — face the dive, shield arm against the wind
      player.h.group.position.copy(waitStand)
      player.pos.copy(waitStand)
      player.h.group.rotation.set(0, waitYaw, 0)
      resetPose(player.h)
      player.h.armL.rotation.x = 0.3
      player.h.armR.rotation.x = -0.4
      player.h.head.rotation.x = -0.55
    } else if (t < b.scoop1) {
      // the scoop — plucked off the deck as the claws shut
      const p = (t - b.scoop0) / (b.scoop1 - b.scoop0)
      const e = 1 - (1 - p) * (1 - p)
      player.h.group.position.lerpVectors(waitStand, hang, e)
      player.pos.copy(player.h.group.position)
      player.h.group.rotation.set(0, lerp(waitYaw, yaw, e), 0)
      resetPose(player.h)
      player.h.armL.rotation.x = lerp(0.3, Math.PI * 0.82, e)
      player.h.armR.rotation.x = lerp(-0.4, Math.PI * 0.82, e)
      player.h.armL.rotation.z = lerp(0, -0.26, e)
      player.h.armR.rotation.z = lerp(0, 0.26, e)
      player.h.legL.rotation.x = lerp(0, 0.3, e)
      player.h.legR.rotation.x = lerp(0, 0.22, e)
      player.h.head.rotation.x = lerp(-0.55, 0.15, e)
    } else if (t < b.dismount0) {
      // carried — dangling from the true grip points
      player.h.group.position.copy(hang)
      player.pos.copy(hang)
      player.h.group.rotation.set(0, yaw, Math.sin(t * 2.1) * 0.055)
      resetPose(player.h)
      player.h.armL.rotation.x = Math.PI * 0.82
      player.h.armR.rotation.x = Math.PI * 0.82
      player.h.armL.rotation.z = -0.26
      player.h.armR.rotation.z = 0.26
      player.h.legL.rotation.x = 0.3
      player.h.legR.rotation.x = 0.22
      player.h.head.rotation.x = 0.15
    } else {
      // set down — from the hang to the stone of the OTHER world, then he stands alone
      const p = clamp01((t - b.dismount0) / (b.dismount1 - b.dismount0))
      const e = p * p * (3 - 2 * p)
      player.h.group.position.lerpVectors(hang, landStand, e)
      player.pos.copy(player.h.group.position)
      player.h.group.rotation.set(0, landYaw, 0)
      resetPose(player.h)
      player.h.armL.rotation.x = lerp(Math.PI * 0.82, 0, e)
      player.h.armR.rotation.x = lerp(Math.PI * 0.82, -0.2, e)
      player.h.armL.rotation.z = lerp(-0.26, 0, e)
      player.h.armR.rotation.z = lerp(0.26, 0, e)
      player.h.legL.rotation.x = lerp(0.3, 0, e)
      player.h.legR.rotation.x = lerp(0.22, 0, e)
      player.h.head.rotation.x = 0
    }

    /* ---- the world changes inside the cloud white-out ---- */
    if (!this.swapped && t >= b.swapAt) {
      this.swapped = true
      this.game.applyZone(this.track === 'toCastle' ? 'castle' : 'vale')
    }

    /* ---- fog: the cloud sea swallows the lens, then gives it back ---- */
    const fog = this.game.engine.scene.fog as THREE.Fog
    const bg = this.game.engine.scene.background as THREE.Color
    const k = Math.min(1, 3 * dt)
    if (t >= b.wipe0 && t < b.swapAt + 0.4) {
      const w = clamp01((t - b.wipe0) / (b.wipe1 - b.wipe0))
      fog.near = lerp(fog.near, 2, k)
      fog.far = lerp(fog.far, 34, k)
      fog.color.lerp(CLOUD_FOG, k)
      bg.lerp(CLOUD_BG, k)
      void w
    } else if (t >= b.swapAt + 0.4 && t < b.open1) {
      const target = this.track === 'toCastle' ? CASTLE_FOG : VALE_FOG
      const targetBg = this.track === 'toCastle' ? CASTLE_BG : VALE_BG
      const range = this.track === 'toCastle' ? CASTLE_FOG_RANGE : VALE_FOG_RANGE
      fog.near = lerp(fog.near, range[0], k)
      fog.far = lerp(fog.far, range[1], k)
      fog.color.lerp(target, k)
      bg.lerp(targetBg, k)
    }

    /* ---- sound beats: the screeches + the wing gusts ---- */
    const sfx = this.game.sfx
    if (!this.screeched.dive && t > b.grabT0 - 2.2) {
      this.screeched.dive = true
      sfx.bossRoar()
    }
    if (!this.screeched.emerge && t > b.swapAt + 1.2) {
      this.screeched.emerge = true
      sfx.bossRoar()
    }
    if (!this.screeched.part && t > b.flapAt) {
      this.screeched.part = true
      sfx.bossRoar()
    }
    this.gust -= dt
    if (this.gust <= 0 && t > 6 && t < b.dismount0) {
      this.gust = 2.6 + Math.random() * 1.4
      sfx.dash()
    }

    /* ---- captions ---- */
    const cap = CAPTIONS[this.track]
    let ci = -1
    for (let i = 0; i < cap.length; i++) if (t >= cap[i][0] && t <= cap[i][1]) ci = i
    if (ci !== this.captionIdx) {
      this.captionIdx = ci
      this.game.setCaption(ci >= 0 ? cap[ci][2] : null)
    }

    /* ---- the director's camera ---- */
    this.directorShot(t, this.tmpA, this.tmpB, dt)
    this.game.engine.camera.position.copy(this.camPosS)
    this.game.engine.camera.lookAt(this.camLookS)
  }

  /** beat-framed camera targets, damped — chase during flight, framed shots at the decks */
  private directorShot(t: number, outPos: THREE.Vector3, outLook: THREE.Vector3, dt: number) {
    const b = BEATS[this.track]
    const roc = this.h.group
    const chase = (back: number, up: number) => {
      const yaw = roc.rotation.y
      outPos.set(
        roc.position.x - Math.sin(yaw) * back,
        roc.position.y + up,
        roc.position.z - Math.cos(yaw) * back
      )
      outLook.set(
        roc.position.x + Math.sin(yaw) * 3,
        roc.position.y - 0.5,
        roc.position.z + Math.cos(yaw) * 3
      )
    }
    if (this.track === 'toCastle') {
      if (t < 2.0) {
        outPos.set(45.5, 11.5, -39.5)
        outLook.set(52, 10.8, -40.8)
      } else if (t < 4.4) {
        outPos.set(47.5, 13.5, -45)
        outLook.copy(roc.position).add(this.tmpC.set(0, -0.5, 0))
      } else if (t < 6.4) {
        outPos.set(56.5, 15.5, -44.5)
        outLook.set(52, 13.8, -39.5)
      } else if (t < 29.0) {
        chase(t < 17.5 ? 10.5 : 11, t < 17.5 ? 2.8 : 3.0)
      } else if (t < 31.6) {
        outPos.set(8, 18.5, 64)
        outLook.set(0, 16, 55.5)
      } else {
        outPos.set(13, 20, 69)
        outLook.set(2, 24, 36)
      }
    } else {
      if (t < 2.4) {
        outPos.set(6, 17.5, 62.5)
        outLook.set(-2.5, 15.5, 56.2)
      } else if (t < 4.2) {
        outPos.set(5, 18.5, 61.5)
        outLook.copy(roc.position)
      } else if (t < 17.6) {
        chase(10.5, 2.8)
      } else if (t < 20.2) {
        outPos.set(58.5, 13.5, -46.5)
        outLook.set(52, 11.5, -39)
      } else {
        outPos.set(63, 15, -52)
        outLook.set(36, 12, -45)
      }
    }
    const snap = t === 0
    const k = snap ? 1 : Math.min(1, 3.2 * dt)
    this.camPosS.lerp(outPos, k)
    this.camLookS.lerp(outLook, k)
    outPos.copy(this.camPosS)
    outLook.copy(this.camLookS)
  }

  /** per-frame during normal play — the perched roc breathes on its stone */
  idleTick(dt: number) {
    if (this.mode !== 'perch') return
    this.idleT += dt
    animRocPerch(this.h, this.idleT)
  }

  /** idempotent landing — runs on natural end AND on skip */
  finish() {
    if (this.mode !== 'flight') return
    this.mode = 'perch'
    const toCastle = this.track === 'toCastle'
    // make sure the world matches the journey's end (skip can land early)
    this.game.applyZone(toCastle ? 'castle' : 'vale')
    const stand = toCastle ? CASTLE_STAND : VALE_STAND
    const yaw = toCastle ? Math.PI : -Math.PI / 2
    this.game.player.reset(stand.clone(), yaw)
    // settle the fog to the arrived world's palette
    const fog = this.game.engine.scene.fog as THREE.Fog
    const bg = this.game.engine.scene.background as THREE.Color
    fog.near = toCastle ? CASTLE_FOG_RANGE[0] : VALE_FOG_RANGE[0]
    fog.far = toCastle ? CASTLE_FOG_RANGE[1] : VALE_FOG_RANGE[1]
    fog.color.copy(toCastle ? CASTLE_FOG : VALE_FOG)
    bg.copy(toCastle ? CASTLE_BG : VALE_BG)
    this.game.setCaption(null)
    // the roc settles on the perch of the world you arrived in
    this.perch(toCastle ? 'castle' : 'vale')
  }
}
