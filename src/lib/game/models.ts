import * as THREE from 'three'
import { characterMaterials, type CharKind } from './textures'

/* Minecraft-style blocky humanoid built from boxes.
   Proportions follow the classic 8px/12px model (1px = 1/16 unit). */

/** height of the somersault pivot above the feet (≈ body center) */
const SPIN_PIVOT = 0.9

export interface Humanoid {
  group: THREE.Group // yaw applied here
  root: THREE.Group // anim offsets (hop, lean)
  spin: THREE.Group // roll pivot at body center (somersaults)
  head: THREE.Mesh
  body: THREE.Mesh
  armL: THREE.Group
  armR: THREE.Group
  legL: THREE.Group
  legR: THREE.Group
  materials: THREE.MeshLambertMaterial[]
  sword: THREE.Group | null
}

export function createSword(scale = 1, rusty = false): THREE.Group {
  const g = new THREE.Group()
  const mat = (c: number) => new THREE.MeshLambertMaterial({ color: c })
  const bladeC = rusty ? 0x9aa39a : 0xcdd4de
  const mk = (w: number, h: number, d: number, m: THREE.Material, y: number) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m)
    mesh.position.y = y
    mesh.castShadow = true
    g.add(mesh)
    return mesh
  }
  mk(0.07, 0.2, 0.07, mat(0x6e4f30), 0) // handle
  mk(0.26, 0.06, 0.09, mat(0x4a3620), 0.13) // guard
  mk(0.11, 0.62, 0.06, mat(bladeC), 0.47) // blade
  mk(0.07, 0.12, 0.05, mat(bladeC), 0.82) // tip
  g.scale.setScalar(scale)
  return g
}

export function createShield(): THREE.Group {
  const g = new THREE.Group()
  const wood = new THREE.MeshLambertMaterial({ color: 0x8a6437 })
  const woodDark = new THREE.MeshLambertMaterial({ color: 0x6b4d2a })
  const iron = new THREE.MeshLambertMaterial({ color: 0x9aa0a8 })
  // iron back plate — slightly larger than the face so it reads as a rim
  const rim = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.58, 0.48), iron)
  rim.position.x = -0.026
  // wooden face (large faces point ±X)
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.52, 0.42), wood)
  body.position.x = 0.012
  body.castShadow = true
  // plank seam
  const seam = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.03, 0.42), woodDark)
  seam.position.x = 0.012
  // iron boss emblem on the outer face
  const boss = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.2, 0.18), iron)
  boss.position.x = 0.056
  g.add(rim, body, seam, boss)
  return g
}

export function createHumanoid(
  kind: CharKind,
  scale = 1,
  opts: { sword?: boolean; shield?: boolean; swordScale?: number } = {}
): Humanoid {
  const mats = characterMaterials(kind)
  const group = new THREE.Group()
  const root = new THREE.Group()
  group.add(root)

  // spin pivot — lets the roll animation somersault around the body's
  // center instead of cartwheeling around the feet (which looked like
  // a carousel and clipped through the ground)
  const spin = new THREE.Group()
  spin.position.y = SPIN_PIVOT
  const spinInner = new THREE.Group()
  spinInner.position.y = -SPIN_PIVOT
  spin.add(spinInner)
  root.add(spin)

  const mkMesh = (w: number, h: number, d: number, mat: THREE.Material | THREE.Material[], x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)
    m.position.set(x, y, z)
    m.castShadow = true
    return m
  }

  const isCreeper = kind === 'creeper'

  // legs pivot at hip
  const legL = new THREE.Group()
  const legR = new THREE.Group()
  // body
  let body: THREE.Mesh
  // head
  let head: THREE.Mesh

  if (isCreeper) {
    // four stubby legs (front pair animated, back pair static)
    legL.position.set(0.13, 0.42, 0.12)
    legL.add(mkMesh(0.22, 0.42, 0.22, mats.leg, 0, -0.21, 0))
    legR.position.set(-0.13, 0.42, 0.12)
    legR.add(mkMesh(0.22, 0.42, 0.22, mats.leg, 0, -0.21, 0))
    spinInner.add(
      mkMesh(0.22, 0.42, 0.22, mats.leg, 0.13, 0.21, -0.12),
      mkMesh(0.22, 0.42, 0.22, mats.leg, -0.13, 0.21, -0.12)
    )
    body = mkMesh(0.46, 0.92, 0.32, mats.body, 0, 0.86, 0)
    head = mkMesh(0.56, 0.56, 0.56, mats.head, 0, 1.6, 0)
  } else {
    legL.position.set(0.125, 0.75, 0)
    legL.add(mkMesh(0.25, 0.75, 0.25, mats.leg, 0, -0.375, 0))
    legR.position.set(-0.125, 0.75, 0)
    legR.add(mkMesh(0.25, 0.75, 0.25, mats.leg, 0, -0.375, 0))
    body = mkMesh(0.5, 0.75, 0.25, mats.body, 0, 1.125, 0)
    head = mkMesh(0.5, 0.5, 0.5, mats.head, 0, 1.75, 0)
  }

  // arms pivot at shoulder (creeper has none — kept as invisible pivots
  // so shared animation code keeps working)
  const armL = new THREE.Group()
  armL.position.set(0.375, 1.375, 0)
  const armR = new THREE.Group()
  armR.position.set(-0.375, 1.375, 0)
  if (!isCreeper) {
    armL.add(mkMesh(0.25, 0.75, 0.25, mats.arm, 0, -0.3125, 0))
    armR.add(mkMesh(0.25, 0.75, 0.25, mats.arm, 0, -0.3125, 0))
  }

  spinInner.add(legL, legR, body, armL, armR, head)

  let sword: THREE.Group | null = null
  if (opts.sword) {
    sword = createSword(opts.swordScale ?? 1, kind === 'boss')
    sword.position.set(0, -0.72, 0.06)
    // blade points forward (+Z), tip slightly down — 105° from the forearm.
    // (was -75° which made the blade point behind the character)
    sword.rotation.x = Math.PI / 2 + Math.PI / 12
    armR.add(sword)
  }
  if (opts.shield) {
    const sh = createShield()
    // strapped to the OUTER side of the left forearm, angled toward the front
    sh.position.set(0.175, -0.42, 0.02)
    sh.rotation.y = -0.45
    armL.add(sh)
  }

  group.scale.setScalar(scale)
  return { group, root, spin, head, body, armL, armR, legL, legR, materials: mats.all, sword }
}

/* ================= ANIMATIONS ================= */

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t

export function resetPose(h: Humanoid) {
  h.root.rotation.set(0, 0, 0)
  h.root.position.set(0, 0, 0)
  h.spin.rotation.set(0, 0, 0)
  h.armL.rotation.set(0, 0, 0.06)
  h.armR.rotation.set(0, 0, -0.06)
  h.legL.rotation.set(0, 0, 0)
  h.legR.rotation.set(0, 0, 0)
  h.head.rotation.set(0, 0, 0)
}

export function animIdle(h: Humanoid, t: number) {
  resetPose(h)
  h.armL.rotation.x = Math.sin(t * 1.6) * 0.05
  h.armR.rotation.x = -Math.sin(t * 1.6) * 0.05
  h.head.rotation.y = Math.sin(t * 0.6) * 0.14
  h.head.rotation.x = Math.sin(t * 0.9) * 0.05
}

export function animWalk(h: Humanoid, t: number, f = 1) {
  resetPose(h)
  const s = Math.sin(t * 11)
  h.legL.rotation.x = s * 0.7 * f
  h.legR.rotation.x = -s * 0.7 * f
  h.armL.rotation.x = -s * 0.65 * f
  h.armR.rotation.x = s * 0.65 * f
  h.root.position.y = Math.abs(Math.cos(t * 11)) * 0.04 * f
}

export function animAttack(h: Humanoid, p: number, variant: 'light0' | 'light1' | 'light2' | 'heavy') {
  resetPose(h)
  if (variant === 'light0') {
    const a = h.armR
    if (p < 0.3) a.rotation.x = lerp(0, -2.7, p / 0.3)
    else if (p < 0.55) a.rotation.x = lerp(-2.7, 0.9, (p - 0.3) / 0.25)
    else a.rotation.x = lerp(0.9, 0, (p - 0.55) / 0.45)
    a.rotation.z = -0.15 - Math.sin(p * Math.PI) * 0.5
    h.root.rotation.y = Math.sin(p * Math.PI) * 0.35
  } else if (variant === 'light1') {
    const a = h.armL
    if (p < 0.28) a.rotation.x = lerp(0, -2.7, p / 0.28)
    else if (p < 0.52) a.rotation.x = lerp(-2.7, 0.9, (p - 0.28) / 0.24)
    else a.rotation.x = lerp(0.9, 0, (p - 0.52) / 0.48)
    a.rotation.z = 0.15 + Math.sin(p * Math.PI) * 0.5
    h.root.rotation.y = -Math.sin(p * Math.PI) * 0.35
  } else if (variant === 'light2') {
    // spin attack
    h.root.rotation.y = p * Math.PI * 2
    h.armR.rotation.x = -1.6 - Math.sin(p * Math.PI) * 0.8
    h.armL.rotation.x = -1.6 - Math.sin(p * Math.PI) * 0.8
    h.armR.rotation.z = -1.1
    h.armL.rotation.z = 1.1
    h.root.position.y = Math.sin(p * Math.PI) * 0.22
  } else {
    // heavy overhead slam
    if (p < 0.42) {
      const q = p / 0.42
      h.armR.rotation.x = lerp(0, -3.0, q)
      h.armL.rotation.x = lerp(0, -3.0, q * 0.8)
      h.root.rotation.x = -0.15 * q
    } else if (p < 0.58) {
      const q = (p - 0.42) / 0.16
      h.armR.rotation.x = lerp(-3.0, 0.7, q)
      h.armL.rotation.x = lerp(-2.4, 0.5, q)
      h.root.rotation.x = lerp(-0.15, 0.35, q)
      h.root.position.y = -0.1 * Math.sin(q * Math.PI)
    } else {
      const q = (p - 0.58) / 0.42
      h.armR.rotation.x = lerp(0.7, 0, q)
      h.armL.rotation.x = lerp(0.5, 0, q)
      h.root.rotation.x = lerp(0.35, 0, q)
    }
  }
}

/** Forward somersault: spins around the body's center (not the feet),
    tucks the limbs, and follows a small hop arc so the body never
    dips below the ground. */
export function animRoll(h: Humanoid, p: number) {
  resetPose(h)
  const q = p * p * (3 - 2 * p) // smoothstep — accelerates into the flip
  const tuck = Math.sin(p * Math.PI)
  h.spin.rotation.x = q * Math.PI * 2
  h.root.position.y = tuck * 0.42
  h.armL.rotation.x = h.armR.rotation.x = -1.7 * tuck
  h.legL.rotation.x = h.legR.rotation.x = -1.9 * tuck
  h.head.rotation.x = -1.1 * tuck
}

/** shield raised in front, subtle brace tremble */
export function animBlock(h: Humanoid, t: number) {
  resetPose(h)
  const br = Math.sin(t * 9) * 0.02
  h.armL.rotation.x = -1.62 + br
  h.armL.rotation.y = -0.5
  h.armL.rotation.z = 0.35
  h.armR.rotation.x = -0.5
  h.armR.rotation.z = -0.3
  h.root.rotation.y = -0.16
  h.head.rotation.x = 0.06
}

export function animDrink(h: Humanoid, p: number) {
  resetPose(h)
  if (p < 0.35) h.armR.rotation.x = lerp(0, -2.5, p / 0.35)
  else if (p < 0.7) h.armR.rotation.x = -2.5
  else h.armR.rotation.x = lerp(-2.5, 0, (p - 0.7) / 0.3)
  h.head.rotation.x = p < 0.7 ? -0.3 : 0
}

export function animHit(h: Humanoid, p: number) {
  resetPose(h)
  const s = Math.sin(p * Math.PI)
  h.root.rotation.x = -0.4 * s
  h.armL.rotation.x = -0.6 * s
  h.armR.rotation.x = -0.6 * s
}

export function animDead(h: Humanoid, p: number) {
  resetPose(h)
  const q = Math.min(1, p)
  h.root.rotation.x = -1.5 * easeOut(q)
  h.root.position.y = -0.55 * easeOut(q)
  h.armL.rotation.z = 0.6 * q
  h.armR.rotation.z = -0.6 * q
}

function easeOut(t: number) {
  return 1 - Math.pow(1 - t, 3)
}

/** zombie-style arms-out walk */
export function animZombieWalk(h: Humanoid, t: number, f = 1) {
  resetPose(h)
  const s = Math.sin(t * 9)
  h.legL.rotation.x = s * 0.6 * f
  h.legR.rotation.x = -s * 0.6 * f
  h.armL.rotation.x = -1.35 + Math.sin(t * 5) * 0.1
  h.armR.rotation.x = -1.35 + Math.cos(t * 5) * 0.1
  h.head.rotation.z = Math.sin(t * 3) * 0.08
}

/* ================= BOSS ANIMATIONS ================= */

/** boss intro / phase-2 roar: arch back, spread arms, head skyward */
export function animRoar(h: Humanoid, p: number) {
  resetPose(h)
  // rise fast (0..0.25), hold, settle at the very end
  const up = p < 0.25 ? p / 0.25 : 1
  const settle = p > 0.8 ? 1 - (p - 0.8) / 0.2 : 1
  const k = up * settle
  const tremble = Math.sin(p * 46) * 0.03 * up * (1 - settle * 0.6)
  h.root.rotation.x = -0.32 * k + tremble
  h.root.position.y = 0.09 * k
  h.armL.rotation.x = -0.55 * k
  h.armR.rotation.x = -0.55 * k
  h.armL.rotation.z = 1.25 * k
  h.armR.rotation.z = -1.25 * k
  h.head.rotation.x = -0.6 * k
  h.head.rotation.z = Math.sin(p * 30) * 0.05 * up
}

/** two-handed overhead slam: hold high with tremble, violent downswing,
    ground-impact crouch, slow recovery */
export function animSlam(h: Humanoid, p: number) {
  resetPose(h)
  if (p < 0.38) {
    // held overhead, quivering with force
    const tr = Math.sin(p * 42) * 0.035
    h.armR.rotation.x = -3.0 + tr
    h.armL.rotation.x = -2.7 - tr
    h.root.rotation.x = -0.18
  } else if (p < 0.62) {
    // the downswing — fast and brutal
    const q = (p - 0.38) / 0.24
    const e = 1 - Math.pow(1 - q, 3)
    h.armR.rotation.x = lerp(-3.0, 0.95, e)
    h.armL.rotation.x = lerp(-2.7, 0.75, e)
    h.root.rotation.x = lerp(-0.18, 0.42, e)
    if (q > 0.55) h.root.position.y = -0.14 * ((q - 0.55) / 0.45)
  } else {
    // buried in the ground, dragging back up
    const q = (p - 0.62) / 0.38
    h.armR.rotation.x = lerp(0.95, 0.4, q)
    h.armL.rotation.x = lerp(0.75, 0.32, q)
    h.root.rotation.x = lerp(0.42, 0.12, q)
    h.root.position.y = -0.14 * (1 - q)
  }
}

/** horizontal greatsword sweep with the RIGHT (sword) arm — windup holds
    it behind, then a flat arc across the body */
export function animSweep(h: Humanoid, p: number) {
  resetPose(h)
  const a = h.armR
  if (p < 0.4) {
    // blade drawn back flat
    const q = p / 0.4
    a.rotation.x = lerp(-2.4, -1.4, q)
    a.rotation.z = lerp(-0.9, -0.5, q)
    h.root.rotation.y = lerp(0.6, 0.5, q)
  } else {
    // whoosh across — body unwinds past center
    const q = Math.min(1, (p - 0.4) / 0.5)
    const e = 1 - Math.pow(1 - q, 2)
    a.rotation.x = -1.4 + 0.25 * e
    a.rotation.z = lerp(-0.5, 1.1, e)
    h.root.rotation.y = lerp(0.5, -1.4, e)
    // settle back
    const s = Math.max(0, (p - 0.9) / 0.1)
    h.root.rotation.y = lerp(-1.4, -1.1, s)
    a.rotation.z = lerp(1.1, 0.85, s)
  }
}

/** shoulder-forward charge: deep lean, sword couched ahead, legs pumping */
export function animCharge(h: Humanoid, p: number) {
  resetPose(h)
  const s = Math.sin(p * 30)
  const c = Math.cos(p * 30)
  h.root.rotation.x = 0.38
  h.armR.rotation.x = -1.75 // sword arm couched, blade pointing forward
  h.armR.rotation.z = -0.12
  h.armL.rotation.x = 0.7 + s * 0.55
  h.legL.rotation.x = s * 0.95
  h.legR.rotation.x = -s * 0.95
  h.head.rotation.x = -0.2
  h.root.position.y = Math.abs(c) * 0.06
}

/** raise leg high (windup handled by caller), then stomp: knee slam,
    body drop, balance arms flung out */
export function animStomp(h: Humanoid, p: number) {
  resetPose(h)
  if (p < 0.3) {
    // leg still high, quivering
    h.legR.rotation.x = -1.35 + Math.sin(p * 40) * 0.05
    h.armL.rotation.x = -0.8
    h.armR.rotation.x = -0.8
    h.armL.rotation.z = 0.5
    h.armR.rotation.z = -0.5
  } else if (p < 0.55) {
    // the stomp
    const q = (p - 0.3) / 0.25
    const e = 1 - Math.pow(1 - q, 3)
    h.legR.rotation.x = lerp(-1.35, 0.55, e)
    h.root.position.y = -0.12 * e
    h.root.rotation.x = 0.22 * e
    h.armL.rotation.x = lerp(-0.8, 0.4, e)
    h.armR.rotation.x = lerp(-0.8, 0.4, e)
  } else {
    // recover
    const q = (p - 0.55) / 0.45
    h.legR.rotation.x = lerp(0.55, 0, q)
    h.root.position.y = -0.12 * (1 - q)
    h.root.rotation.x = 0.22 * (1 - q)
    h.armL.rotation.x = lerp(0.4, 0, q)
    h.armR.rotation.x = lerp(0.4, 0, q)
  }
}

/** posture broken: heavy slump forward, wobbling, wide open for a punish */
export function animStagger(h: Humanoid, p: number) {
  resetPose(h)
  const slump = Math.min(1, p * 3.5) * (1 - Math.max(0, (p - 0.7) / 0.3) * 0.5)
  const wobble = Math.sin(p * 13) * 0.09 * (1 - p)
  h.root.rotation.x = 0.52 * slump
  h.root.rotation.z = wobble
  h.head.rotation.x = 0.55 * slump
  h.head.rotation.z = wobble * 1.4
  h.armL.rotation.x = 0.65 * slump
  h.armR.rotation.x = 0.6 * slump
  h.armL.rotation.z = 0.35 * slump
  h.armR.rotation.z = -0.35 * slump
  h.root.position.y = -0.1 * slump
}

/** boss death: reels back howling, sinks to its knees, collapses forward */
export function animBossDead(h: Humanoid, p: number) {
  resetPose(h)
  if (p < 0.3) {
    // reel back
    const q = p / 0.3
    h.root.rotation.x = -0.4 * q
    h.head.rotation.x = -0.5 * q
    h.armL.rotation.z = 1.0 * q
    h.armR.rotation.z = -1.0 * q
    h.armL.rotation.x = -0.4 * q
    h.armR.rotation.x = -0.4 * q
  } else if (p < 0.72) {
    // sink to the knees, sword arm droops
    const q = (p - 0.3) / 0.42
    h.root.rotation.x = lerp(-0.4, 0.28, q)
    h.root.position.y = -0.55 * easeOut(q)
    h.legL.rotation.x = -1.45 * q
    h.legR.rotation.x = -1.45 * q
    h.armL.rotation.z = lerp(1.0, 0.25, q)
    h.armR.rotation.z = lerp(-1.0, -0.2, q)
    h.armL.rotation.x = lerp(-0.4, 0.45, q)
    h.armR.rotation.x = lerp(-0.4, 0.45, q)
    h.head.rotation.x = lerp(-0.5, 0.3, q)
  } else {
    // fall forward, face down
    const q = (p - 0.72) / 0.28
    const e = easeOut(q)
    h.root.rotation.x = lerp(0.28, 1.45, e)
    h.root.position.y = lerp(-0.55, -0.78, e)
    h.legL.rotation.x = -1.45
    h.legR.rotation.x = -1.45
    h.armL.rotation.z = 0.25
    h.armR.rotation.z = -0.2
    h.armL.rotation.x = lerp(0.45, 0.9, e)
    h.armR.rotation.x = lerp(0.45, 0.9, e)
  }
}

export function setOpacity(h: Humanoid, opacity: number) {
  for (const m of h.materials) {
    m.transparent = opacity < 1
    m.opacity = opacity
    m.needsUpdate = false
  }
}

export function setFlash(h: Humanoid, amount: number) {
  for (const m of h.materials) {
    m.emissive.setRGB(amount, amount * 0.08, amount * 0.08)
  }
}

/** white flash (creeper fuse) */
export function setFlashWhite(h: Humanoid, amount: number) {
  for (const m of h.materials) {
    m.emissive.setRGB(amount, amount, amount)
  }
}

export function disposeHumanoid(h: Humanoid) {
  h.group.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (mesh.geometry) mesh.geometry.dispose()
  })
  for (const m of h.materials) m.dispose()
}
