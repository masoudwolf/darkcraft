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
  legsBack: [THREE.Group, THREE.Group] | null // creeper hind legs
  materials: THREE.MeshLambertMaterial[]
  extras: THREE.Material[] // unlit glow materials (eyes, lava veins) — never flashed/faded
  sword: THREE.Group | null
}

export type SwordStyle = 'iron' | 'rust' | 'stone' | 'obsidian'

export function createSword(scale = 1, style: SwordStyle = 'iron'): THREE.Group {
  const g = new THREE.Group()
  const lam = (c: number) => new THREE.MeshLambertMaterial({ color: c })
  const glow = (c: number) => new THREE.MeshBasicMaterial({ color: c })
  const bladeC = style === 'rust' ? 0x9aa39a : style === 'stone' ? 0x9a9fa4 : style === 'obsidian' ? 0x2a2226 : 0xcdd4de
  const guardC = style === 'stone' ? 0x6a6458 : style === 'obsidian' ? 0x171114 : 0x4a3620
  const mk = (w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z = 0) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m)
    mesh.position.set(x, y, z)
    mesh.castShadow = true
    g.add(mesh)
    return mesh
  }
  mk(0.07, 0.2, 0.07, lam(0x6e4f30), 0, 0) // handle
  mk(0.26, 0.06, 0.09, lam(guardC), 0, 0.13) // guard
  mk(0.11, 0.62, 0.06, lam(bladeC), 0, 0.47) // blade
  mk(0.07, 0.12, 0.05, lam(bladeC), 0, 0.82) // tip
  if (style === 'obsidian') {
    // a molten edge burning along the whole blade
    mk(0.13, 0.6, 0.02, glow(0xff7a1e), 0, 0.47, 0.035)
    mk(0.13, 0.6, 0.02, glow(0xff7a1e), 0, 0.47, -0.035)
    mk(0.09, 0.11, 0.03, glow(0xffc23d), 0, 0.82, 0)
    mk(0.11, 0.1, 0.065, lam(0x3a3034), 0, 0.2) // scorched collar
  }
  if (style === 'rust') {
    // a battered relic — nicked edges and a blood-dark fuller
    mk(0.045, 0.62, 0.065, lam(0x6a7268), 0, 0.47)
    mk(0.11, 0.06, 0.062, lam(0x7d6a52), 0, 0.3)
    mk(0.11, 0.05, 0.062, lam(0x7d6a52), 0, 0.66)
  }
  if (style === 'stone') {
    mk(0.13, 0.1, 0.07, lam(0x6a6458), 0, 0.24) // chunky stone collar
  }
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

/** Minecraft-style blocky bow. Limb axis runs along local X so that when
    the holding arm points forward (rotation.x ≈ -90°) the bow stands upright. */
export function createBow(): THREE.Group {
  const g = new THREE.Group()
  const mat = (c: number) => new THREE.MeshLambertMaterial({ color: c })
  const wood = 0x7a5a34
  const woodDark = 0x5a4022
  const mk = (w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z: number, rz = 0) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m)
    mesh.position.set(x, y, z)
    mesh.rotation.z = rz
    mesh.castShadow = true
    g.add(mesh)
    return mesh
  }
  mk(0.09, 0.11, 0.09, mat(woodDark), 0, 0, 0.02) // grip
  mk(0.3, 0.06, 0.06, mat(wood), 0.21, 0.02, 0.02, 0.32) // upper limb
  mk(0.3, 0.06, 0.06, mat(wood), -0.21, 0.02, 0.02, -0.32) // lower limb
  mk(0.72, 0.016, 0.016, mat(0xd8d4c8), 0, 0.03, -0.1) // string
  g.scale.setScalar(1.05)
  return g
}

/** the Blaze's orbiting smoke rods — attached to the body root, spun in code.
    Each rod carries a white-hot tip so the orbit reads as a fire wheel. */
export function createBlazeRods(): { group: THREE.Group; extras: THREE.Material[] } {
  const g = new THREE.Group()
  const extras: THREE.Material[] = []
  const hot = new THREE.MeshLambertMaterial({ color: 0xc47a1e })
  const dark = new THREE.MeshLambertMaterial({ color: 0x8a5414 })
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2
    const rod = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.62, 0.14), i % 2 ? hot : dark)
    rod.position.set(Math.cos(a) * 0.33, 0.95, Math.sin(a) * 0.33)
    rod.castShadow = true
    const tipMat = new THREE.MeshBasicMaterial({ color: i % 2 ? 0xffd873 : 0xff9a2e })
    extras.push(tipMat)
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.09, 0.16), tipMat)
    tip.position.set(Math.cos(a) * 0.33, 1.29, Math.sin(a) * 0.33)
    g.add(rod, tip)
  }
  return { group: g, extras }
}

/** tiny unlit cubes mounted just in front of the face — burning eyes that
    read at any distance and give each horror its signature stare */
function addGlowEyes(
  head: THREE.Mesh,
  extras: THREE.Material[],
  color: number,
  dx = 0.115,
  y = 0.02
) {
  const mat = new THREE.MeshBasicMaterial({ color })
  extras.push(mat)
  for (const sx of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.03), mat)
    eye.position.set(sx * dx, y, 0.262)
    head.add(eye)
  }
}

/** iron pauldron pair — bolted to the torso over the shoulder joints so
    the arms swing underneath the armor like a true knight's */
function addPauldrons(
  torso: THREE.Group,
  extras: THREE.Material[],
  size: number,
  color: number,
  rimColor: number,
  y = 1.44,
  lavaRim = false
) {
  const plate = new THREE.MeshLambertMaterial({ color })
  const rim = new THREE.MeshLambertMaterial({ color: rimColor })
  for (const sx of [-1, 1]) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(size, size * 0.55, size), plate)
    p.position.set(sx * (0.375 + size * 0.06), y, 0)
    p.castShadow = true
    const band = new THREE.Mesh(new THREE.BoxGeometry(size * 1.06, size * 0.14, size * 1.06), rim)
    band.position.set(sx * (0.375 + size * 0.06), y - size * 0.3, 0)
    if (lavaRim) {
      const molten = new THREE.MeshBasicMaterial({ color: 0xff8a2e })
      extras.push(molten)
      const crack = new THREE.Mesh(new THREE.BoxGeometry(size * 0.9, 0.045, 0.1), molten)
      crack.position.set(sx * (0.375 + size * 0.06), y + size * 0.3, 0)
      torso.add(crack)
    }
    torso.add(p, band)
  }
}

export function createHumanoid(
  kind: CharKind,
  scale = 1,
  opts: { sword?: boolean; shield?: boolean; swordScale?: number; swordStyle?: SwordStyle } = {}
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

  const extras: THREE.Material[] = []
  const mkMesh = (w: number, h: number, d: number, mat: THREE.Material | THREE.Material[], x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)
    m.position.set(x, y, z)
    m.castShadow = true
    return m
  }

  const isCreeper = kind === 'creeper'
  // bone-thin limbs for the skeletons — THE silhouette that reads "skeleton"
  const thin = kind === 'skeleton' || kind === 'wither'
  const limb = thin ? 0.14 : 0.25

  // legs pivot at hip
  const legL = new THREE.Group()
  const legR = new THREE.Group()
  // creeper hind legs (real pivots so the quadruped gait can move them)
  let legsBack: [THREE.Group, THREE.Group] | null = null
  // body
  let body: THREE.Mesh
  // head
  let head: THREE.Mesh

  if (isCreeper) {
    // four stubby legs — the FRONT pair hangs on legL/legR, the back pair
    // on legsBack, so animCreeperWalk can trot a proper diagonal gait
    legL.position.set(0.13, 0.42, 0.14)
    legL.add(mkMesh(0.22, 0.42, 0.22, mats.leg, 0, -0.21, 0))
    legR.position.set(-0.13, 0.42, 0.14)
    legR.add(mkMesh(0.22, 0.42, 0.22, mats.leg, 0, -0.21, 0))
    const legBL = new THREE.Group()
    legBL.position.set(0.13, 0.42, -0.14)
    legBL.add(mkMesh(0.22, 0.42, 0.22, mats.leg, 0, -0.21, 0))
    const legBR = new THREE.Group()
    legBR.position.set(-0.13, 0.42, -0.14)
    legBR.add(mkMesh(0.22, 0.42, 0.22, mats.leg, 0, -0.21, 0))
    legsBack = [legBL, legBR]
    spinInner.add(legBL, legBR)
    body = mkMesh(0.46, 0.92, 0.32, mats.body, 0, 0.86, 0)
    head = mkMesh(0.56, 0.56, 0.56, mats.head, 0, 1.6, 0)
  } else if (thin) {
    legL.position.set(0.09, 0.75, 0)
    legL.add(mkMesh(limb, 0.75, limb, mats.leg, 0, -0.375, 0))
    legR.position.set(-0.09, 0.75, 0)
    legR.add(mkMesh(limb, 0.75, limb, mats.leg, 0, -0.375, 0))
    body = mkMesh(0.4, 0.75, 0.18, mats.body, 0, 1.125, 0)
    head = mkMesh(0.5, 0.5, 0.5, mats.head, 0, 1.75, 0)
    // bony pelvis bridging the spine to the legs
    const pelvis = mkMesh(0.42, 0.16, 0.2, mats.body, 0, 0.8, 0)
    spinInner.add(pelvis)
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
  const armR = new THREE.Group()
  if (!isCreeper) {
    if (thin) {
      // shoulders tighter over the narrow skeletal chest
      const halfSpan = 0.2 + limb / 2
      armL.position.set(halfSpan, 1.375, 0)
      armR.position.set(-halfSpan, 1.375, 0)
    } else {
      armL.position.set(0.375, 1.375, 0)
      armR.position.set(-0.375, 1.375, 0)
    }
    armL.add(mkMesh(limb, 0.75, limb, mats.arm, 0, -0.3125, 0))
    armR.add(mkMesh(limb, 0.75, limb, mats.arm, 0, -0.3125, 0))
  }

  spinInner.add(legL, legR, body, armL, armR, head)

  const swordStyle: SwordStyle = opts.swordStyle ?? (kind === 'boss' ? 'rust' : kind === 'wither' ? 'stone' : 'iron')
  let sword: THREE.Group | null = null
  if (opts.sword) {
    sword = createSword(opts.swordScale ?? 1, swordStyle)
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

  /* ---------- per-kind model dressing ---------- */
  if (kind === 'boss') {
    // the Ancient Zombie Knight: bolted armor over a rotted body
    const steel = new THREE.MeshLambertMaterial({ color: 0x7c828c })
    const steelDark = new THREE.MeshLambertMaterial({ color: 0x565a64 })
    mats.all.push(steel, steelDark)
    // chestplate over the torso
    const chest = mkMesh(0.56, 0.36, 0.31, steel, 0, 1.26, 0)
    const chestRidge = mkMesh(0.08, 0.3, 0.33, steelDark, 0, 1.28, 0)
    // belt + tattered tabard hint
    const belt = mkMesh(0.56, 0.09, 0.29, steelDark, 0, 0.86, 0)
    // helm: iron band across the brow + a battle-scarred crimson crest
    const helmBand = mkMesh(0.54, 0.1, 0.54, steel, 0, 0.19, 0)
    helmBand.position.y = 0.19
    const crest = mkMesh(0.08, 0.13, 0.42, new THREE.MeshLambertMaterial({ color: 0x6a1d1d }), 0, 0.31, 0)
    head.add(helmBand, crest)
    spinInner.add(chest, chestRidge, belt)
    addPauldrons(spinInner, extras, 0.34, 0x7c828c, 0x565a64, 1.46)
    addGlowEyes(head, extras, 0xff2a2a)
  }

  if (kind === 'bossflame') {
    // the Flame King: obsidian battle-plate split by glowing lava veins
    const obsidian = new THREE.MeshLambertMaterial({ color: 0x241d20 })
    const obsidianDark = new THREE.MeshLambertMaterial({ color: 0x171114 })
    mats.all.push(obsidian, obsidianDark)
    const chest = mkMesh(0.58, 0.4, 0.33, obsidian, 0, 1.24, 0)
    const belt = mkMesh(0.58, 0.1, 0.31, obsidianDark, 0, 0.86, 0)
    const molten = new THREE.MeshBasicMaterial({ color: 0xff7a1e })
    extras.push(molten)
    const moltenHot = new THREE.MeshBasicMaterial({ color: 0xffc23d })
    extras.push(moltenHot)
    // lava veins splitting the chestplate
    const veinL = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.3, 0.02), molten)
    veinL.position.set(-0.12, 1.3, 0.17)
    const veinR = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.2, 0.02), molten)
    veinR.position.set(0.14, 1.34, 0.17)
    const veinC = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.12, 0.02), moltenHot)
    veinC.position.set(0, 1.28, 0.175)
    spinInner.add(chest, belt, veinL, veinR, veinC)
    addPauldrons(spinInner, extras, 0.4, 0x241d20, 0x171114, 1.48, true)
    // a crown of five unlit flame tongues, the center one hottest
    const flameMat = new THREE.MeshBasicMaterial({ color: 0xff7a1e })
    const flameHot = new THREE.MeshBasicMaterial({ color: 0xffc23d })
    extras.push(flameMat, flameHot)
    const flame = (dx: number, h: number, m: THREE.Material, w = 0.09) => {
      const f = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), m)
      f.position.set(dx, 0.25 + h / 2, 0)
      head.add(f)
    }
    flame(-0.2, 0.2, flameMat, 0.08)
    flame(-0.1, 0.26, flameHot, 0.07)
    flame(0, 0.36, flameHot)
    flame(0.1, 0.26, flameMat, 0.07)
    flame(0.2, 0.2, flameMat, 0.08)
    addGlowEyes(head, extras, 0xffd23d)
  }

  if (kind === 'wither') {
    // ember eyes smoldering inside the charcoal skull
    addGlowEyes(head, extras, 0xff7b24)
  }

  if (kind === 'blaze') {
    // a furnace mouth burning through the golden core
    const furnace = new THREE.MeshBasicMaterial({ color: 0xffdf7a })
    const furnaceHot = new THREE.MeshBasicMaterial({ color: 0xfff6d8 })
    extras.push(furnace, furnaceHot)
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.26, 0.04), furnace)
    mouth.position.set(0, 0.94, 0.17)
    const heart = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.03), furnaceHot)
    heart.position.set(0, 0.94, 0.185)
    spinInner.add(mouth, heart)
  }

  group.scale.setScalar(scale)
  return { group, root, spin, head, body, armL, armR, legL, legR, legsBack, materials: mats.all, extras, sword }
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
  if (h.legsBack) {
    h.legsBack[0].rotation.set(0, 0, 0)
    h.legsBack[1].rotation.set(0, 0, 0)
  }
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
  // the head snaps back — pain reads from the face first
  h.head.rotation.x = -0.5 * s
  h.head.rotation.z = 0.18 * s
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

/** zombie-style arms-out walk — broken-neck head tilt, lopsided arm sway,
    a slight hungry hunch. The off-arm lags behind the sword arm. */
export function animZombieWalk(h: Humanoid, t: number, f = 1) {
  resetPose(h)
  const s = Math.sin(t * 9)
  const c = Math.cos(t * 9)
  h.legL.rotation.x = s * 0.6 * f
  h.legR.rotation.x = -s * 0.6 * f
  h.armL.rotation.x = -1.35 + Math.sin(t * 5) * 0.1
  h.armR.rotation.x = -1.35 + Math.cos(t * 5) * 0.1
  h.armL.rotation.z = 0.12 + c * 0.06
  h.armR.rotation.z = -0.12 - c * 0.04
  h.head.rotation.z = Math.sin(t * 3) * 0.09 // the broken-neck sway
  h.head.rotation.x = 0.1 // staring down its next meal
  h.root.rotation.x = 0.06
  h.root.position.y = Math.abs(c) * 0.035 * f
}

/** hollow shamble-in-place: hunched, arms dangling, head rolling loose */
export function animZombieIdle(h: Humanoid, t: number) {
  resetPose(h)
  const b = Math.sin(t * 1.7)
  h.root.rotation.x = 0.13 + b * 0.02
  h.armL.rotation.x = -0.35 + b * 0.08
  h.armR.rotation.x = -0.35 - b * 0.08
  h.armL.rotation.z = 0.16
  h.armR.rotation.z = -0.16
  h.head.rotation.z = Math.sin(t * 0.8) * 0.16
  h.head.rotation.x = 0.14
  h.root.position.y = b * 0.012
}

/* ================= CREEPER (quadruped) ANIMATIONS ================= */

/** proper four-legged trot — diagonal pairs (FL+BR / FR+BL) alternate,
    the body rolls over its feet and the head bobs on its stalk */
export function animCreeperWalk(h: Humanoid, t: number, f = 1) {
  resetPose(h)
  const s = Math.sin(t * 11)
  const c = Math.cos(t * 11)
  h.legL.rotation.x = s * 0.8 * f // front-left
  h.legR.rotation.x = -s * 0.8 * f // front-right
  if (h.legsBack) {
    h.legsBack[0].rotation.x = -s * 0.8 * f // back-left (anti-phase to front-left)
    h.legsBack[1].rotation.x = s * 0.8 * f // back-right
  }
  h.root.rotation.z = c * 0.055
  h.head.rotation.x = 0.06 + c * 0.06
  h.root.position.y = Math.abs(c) * 0.045 * f
}

/** silent watcher: slow scanning head, a breathing rise of the chest */
export function animCreeperIdle(h: Humanoid, t: number) {
  resetPose(h)
  const b = Math.sin(t * 2.2)
  h.head.rotation.y = Math.sin(t * 0.55) * 0.35
  h.head.rotation.x = 0.05 + b * 0.035
  h.root.position.y = b * 0.012
  h.root.rotation.z = Math.sin(t * 1.1) * 0.015
}

/* ================= SKELETON ARCHER ANIMATIONS ================= */

/** rattle-step march with the bow carried low and ready */
export function animSkeletonWalk(h: Humanoid, t: number, f = 1) {
  resetPose(h)
  const s = Math.sin(t * 10)
  const c = Math.cos(t * 10)
  h.legL.rotation.x = s * 0.62 * f
  h.legR.rotation.x = -s * 0.62 * f
  h.armL.rotation.x = -0.5 // bow arm half-raised, ready to snap up
  h.armL.rotation.z = 0.1
  h.armR.rotation.x = s * 0.5
  h.root.rotation.y = c * 0.05
  h.head.rotation.y = Math.sin(t * 2.2) * 0.12
  h.root.position.y = Math.abs(c) * 0.04 * f
}

/** holding ground at firing range: bow up, draw hand loose, scanning */
export function animBowIdle(h: Humanoid, t: number) {
  resetPose(h)
  const w = Math.sin(t * 1.8)
  h.armL.rotation.x = -1.35 + w * 0.05
  h.armL.rotation.z = 0.08
  h.armR.rotation.x = -1.05 + Math.sin(t * 1.8 + 0.6) * 0.05
  h.armR.rotation.z = -0.25
  h.root.rotation.y = Math.sin(t * 0.9) * 0.08
  h.head.rotation.y = Math.sin(t * 0.7) * 0.18
  h.head.rotation.x = 0.03
}

/* ================= WITHER SKELETON ANIMATIONS ================= */

/** predatory, jittery stride — fast cycle, deep lean, sword arm trailing
    loose and low while the free claw reaches for you */
export function animWitherWalk(h: Humanoid, t: number, f = 1) {
  resetPose(h)
  const s = Math.sin(t * 13)
  const c = Math.cos(t * 13)
  h.legL.rotation.x = s * 0.72 * f
  h.legR.rotation.x = -s * 0.72 * f
  h.armR.rotation.x = 0.25 + c * 0.14
  h.armR.rotation.z = -0.1
  h.armL.rotation.x = -0.7 + s * 0.35
  h.armL.rotation.z = 0.28
  h.root.rotation.x = 0.15
  h.head.rotation.x = 0.1
  h.head.rotation.z = Math.sin(t * 6.5) * 0.06
  h.root.position.y = Math.abs(c) * 0.05 * f
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

/* ================= BOW (SKELETON ARCHER) ANIMATIONS ================= */

/** draw the string back: bow arm steady forward, draw arm pulls to the cheek,
    a fine tremble near full draw sells the tension */
export function animBowDraw(h: Humanoid, p: number) {
  resetPose(h)
  const e = 1 - Math.pow(1 - p, 2)
  h.armL.rotation.x = -1.5 + 0.05 * Math.sin(p * 9)
  h.armL.rotation.z = 0.08
  h.armR.rotation.x = -1.5 + 1.02 * e // pulls back toward the cheek
  h.armR.rotation.z = -0.3 * e
  h.root.rotation.y = 0.14 * e
  h.head.rotation.x = 0.04
  h.legL.rotation.x = 0.1 * e
  h.legR.rotation.x = -0.14 * e
  if (p > 0.72) {
    const tr = Math.sin(p * 52) * 0.022 * (p - 0.72) / 0.28
    h.armR.rotation.x += tr
    h.armL.rotation.x -= tr
  }
}

/** the release: draw arm snaps forward, bow arm kicks with recoil, then settles */
export function animBowShoot(h: Humanoid, p: number) {
  resetPose(h)
  if (p < 0.3) {
    const q = p / 0.3
    h.armR.rotation.x = -0.48 - 0.62 * q // spring forward
  } else {
    const q = (p - 0.3) / 0.7
    h.armR.rotation.x = -1.1 + 0.25 * q
  }
  h.armL.rotation.x = -1.5 + Math.sin(p * Math.PI) * 0.16 // recoil kick
  h.armL.rotation.z = 0.08 - Math.sin(p * Math.PI) * 0.06
  h.root.rotation.y = 0.14 - 0.14 * Math.min(1, p * 2.4)
  h.head.rotation.x = 0.04 * (1 - p)
}

/** close-range smack with the bow-holding arm — quick jab, quick recover */
export function animPoke(h: Humanoid, p: number) {
  resetPose(h)
  if (p < 0.35) {
    const q = p / 0.35
    h.armL.rotation.x = lerp(-0.3, -1.75, q)
    h.armL.rotation.z = lerp(0.06, -0.12, q)
  } else {
    const q = (p - 0.35) / 0.65
    h.armL.rotation.x = lerp(-1.75, -0.25, 1 - Math.pow(1 - q, 3))
    h.armL.rotation.z = lerp(-0.12, 0.06, q)
    h.root.rotation.x = 0.14 * Math.sin(q * Math.PI)
  }
  h.root.rotation.y = -0.2 * Math.sin(p * Math.PI)
}

/** pyromancy cast: gather both arms overhead, then shove the flame forward */
export function animCast(h: Humanoid, p: number) {
  resetPose(h)
  if (p < 0.55) {
    const q = p / 0.55
    h.armL.rotation.x = -2.4 * q
    h.armR.rotation.x = -2.4 * q
    h.armL.rotation.z = 0.3 * q
    h.armR.rotation.z = -0.3 * q
    h.root.rotation.x = -0.12 * q
  } else {
    const q = Math.min(1, (p - 0.55) / 0.2)
    h.armL.rotation.x = lerp(-2.4, -1.35, q)
    h.armR.rotation.x = lerp(-2.4, -1.35, q)
    h.armL.rotation.z = lerp(0.3, 0.12, q)
    h.armR.rotation.z = lerp(-0.3, -0.12, q)
    h.root.rotation.x = lerp(-0.12, 0.1, q)
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
  for (const m of h.extras) m.dispose()
}
