import * as THREE from 'three'
import { characterMaterials, gearMaterial, bladeMaterial, woodMaterial, type CharKind, type GearKind } from './textures'

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
  shield?: THREE.Group | null
  /** armor overlays + cape added by applyPlayerArmor (swappable visuals) */
  armorParts?: THREE.Object3D[]
  /** private material clones applyPlayerArmor made for this body (flash/fade-safe) */
  armorMats?: THREE.MeshLambertMaterial[]
  capePivot?: THREE.Group | null
}

export type SwordStyle = 'iron' | 'rust' | 'stone' | 'obsidian' | 'greatsword' | 'kingblade' | 'coalblade'

export function createSword(scale = 1, style: SwordStyle = 'iron'): THREE.Group {
  const g = new THREE.Group()
  const lam = (c: number) => new THREE.MeshLambertMaterial({ color: c })
  const glow = (c: number) => new THREE.MeshBasicMaterial({ color: c })
  const blade = bladeMaterial(style) // painted steel — fuller, glints, rust
  const guardC = style === 'stone' ? 0x6a6458 : style === 'obsidian' ? 0x171114 : 0x4a3620
  const mk = (w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z = 0) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m)
    mesh.position.set(x, y, z)
    mesh.castShadow = true
    g.add(mesh)
    return mesh
  }

  if (style === 'greatsword') {
    // a great-lord's blade — wrapped grip, sweeping crossguard with
    // drooping quillons, a garnet ricasso and a wide battered fuller
    mk(0.09, 0.3, 0.09, lam(0x3a2e20), 0, -0.05) // long leather grip
    mk(0.1, 0.045, 0.1, lam(0x241c14), 0, 0.05) // grip wraps
    mk(0.1, 0.045, 0.1, lam(0x241c14), 0, -0.02)
    mk(0.44, 0.07, 0.11, lam(0x4a4038), 0, 0.16) // broad crossguard
    mk(0.09, 0.12, 0.09, lam(0x4a4038), -0.25, 0.1) // drooping quillons
    mk(0.09, 0.12, 0.09, lam(0x4a4038), 0.25, 0.1)
    mk(0.09, 0.09, 0.09, lam(0x8a1d1d), 0, 0.23) // garnet at the ricasso
    mk(0.15, 0.86, 0.07, blade, 0, 0.69) // wide blade
    mk(0.05, 0.78, 0.074, lam(0x6a7268), 0, 0.67) // fuller column
    mk(0.1, 0.14, 0.06, blade, 0, 1.19) // tip
    mk(0.12, 0.08, 0.1, lam(0x4a4038), 0, -0.25) // pommel
    mk(0.06, 0.05, 0.06, lam(0x8a1d1d), 0, -0.31) // pommel gem
    g.scale.setScalar(scale)
    return g
  }

  if (style === 'kingblade') {
    // the king's obsidian falchion — gold furniture and an edge that
    // never stops burning
    mk(0.09, 0.3, 0.09, lam(0x2a1c10), 0, -0.05) // grip
    mk(0.11, 0.04, 0.11, lam(0xb8862a), 0, 0.04) // gold grip rings
    mk(0.11, 0.04, 0.11, lam(0xb8862a), 0, -0.03)
    mk(0.46, 0.07, 0.11, lam(0xb8862a), 0, 0.16) // gold crossguard
    mk(0.1, 0.09, 0.1, glow(0xffc23d), -0.26, 0.19) // hot guard tips
    mk(0.1, 0.09, 0.1, glow(0xffc23d), 0.26, 0.19)
    mk(0.14, 0.9, 0.07, blade, 0, 0.69) // blade
    mk(0.16, 0.84, 0.02, glow(0xff7a1e), 0, 0.67, 0.035) // molten edge
    mk(0.16, 0.84, 0.02, glow(0xff7a1e), 0, 0.67, -0.035)
    mk(0.1, 0.16, 0.06, blade, 0, 1.22) // tip
    mk(0.13, 0.09, 0.11, lam(0xb8862a), 0, -0.25) // gold pommel
    g.scale.setScalar(scale)
    return g
  }

  if (style === 'coalblade') {
    // the First Coal's own edge — a blade the hollowed Builder chiseled
    // from the bedrock of the pit: obsidian plates over a living ember
    // spine, gold furniture of the old kingdom, a coal-shard pommel
    mk(0.09, 0.32, 0.09, lam(0x1c161a), 0, -0.06) // charred grip
    mk(0.1, 0.045, 0.1, lam(0x3a2f36), 0, 0.03) // stone wraps
    mk(0.1, 0.045, 0.1, lam(0x3a2f36), 0, -0.05)
    mk(0.48, 0.08, 0.12, lam(0xb8862a), 0, 0.16) // gold crossguard
    mk(0.1, 0.1, 0.1, glow(0xffc23d), -0.27, 0.2) // hot guard mounts
    mk(0.1, 0.1, 0.1, glow(0xffc23d), 0.27, 0.2)
    mk(0.16, 0.94, 0.08, blade, 0, 0.72) // broad dark blade
    mk(0.06, 0.86, 0.02, glow(0xff7a1e), 0, 0.7, 0.045) // ember spine
    mk(0.06, 0.86, 0.02, glow(0xff7a1e), 0, 0.7, -0.045)
    mk(0.07, 0.7, 0.024, glow(0xffc23d), 0, 0.68, 0) // the white-hot heart
    mk(0.11, 0.16, 0.07, blade, 0, 1.26) // tip
    mk(0.13, 0.09, 0.11, lam(0x2a2428), 0, -0.27) // coal pommel
    mk(0.07, 0.05, 0.07, glow(0xff8a2a), 0, -0.33) // its burning seam
    g.scale.setScalar(scale)
    return g
  }

  mk(0.07, 0.2, 0.07, lam(0x6e4f30), 0, 0) // handle
  mk(0.26, 0.06, 0.09, lam(guardC), 0, 0.13) // guard
  mk(0.11, 0.62, 0.06, blade, 0, 0.47) // blade
  mk(0.07, 0.12, 0.05, blade, 0, 0.82) // tip
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

export function createShield(style: 'wood' | 'iron' = 'wood'): THREE.Group {
  const g = new THREE.Group()
  // painted faces — plank grain for wood, plate seams for iron
  const wood = style === 'iron' ? gearMaterial('plate', 0x7c828c, 0x565a64) : woodMaterial(0x8a6437, 0x6b4d2a)
  const woodDark = new THREE.MeshLambertMaterial({ color: style === 'iron' ? 0x565a64 : 0x6b4d2a })
  const iron = new THREE.MeshLambertMaterial({ color: style === 'iron' ? 0xcdd4de : 0x9aa0a8 })
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

/** Minecraft-style blocky recurve bow. Limb axis runs along local X so that
    when the holding arm points forward (rotation.x ≈ -90°) the bow stands
    upright; local +Y runs back toward the archer (the arrow's flight axis
    reversed), and the string rides at local z = -0.1 (the draw-hand side).
    The string is a real two-segment cord meeting at a nock node — call
    setBowDraw() to bend it and slide the nocked arrow for a proper archery
    draw/release. `style` picks the limb material: seasoned wood, or the
    pale cracked bone the skeleton archers carve theirs from. */
interface BowParts {
  nock: THREE.Group
  strUp: THREE.Mesh
  strDown: THREE.Mesh
  tipA: THREE.Vector3
  tipB: THREE.Vector3
  nockRestY: number
  arrow: THREE.Group
}

export function createBow(style: 'wood' | 'bone' = 'wood'): THREE.Group {
  const g = new THREE.Group()
  const lam = (c: number) => new THREE.MeshLambertMaterial({ color: c })
  const bone = style === 'bone'
  // limbs — painted wood grain, or cracked bone with pores
  const wood = bone ? gearMaterial('bone', 0xd8d2c2, 0xb0aa9a) : woodMaterial(0x7a5a34, 0x5a4022)
  const woodDark = bone ? gearMaterial('bone', 0xb8b2a2, 0x989284) : lam(0x5a4022)
  const wrap = lam(bone ? 0x6a6255 : 0x4a3418)
  const stringMat = lam(0xd8d4c8)
  const mk = (w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z: number, rz = 0) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m)
    mesh.position.set(x, y, z)
    mesh.rotation.z = rz
    mesh.castShadow = true
    g.add(mesh)
    return mesh
  }

  // grip with leather wraps
  mk(0.1, 0.2, 0.1, woodDark, 0, 0.03, 0.02)
  mk(0.11, 0.035, 0.11, wrap, 0, 0.09, 0.02)
  mk(0.11, 0.035, 0.11, wrap, 0, -0.02, 0.02)

  // recurve limbs — two segments per side, tips curving back toward the string
  // (segment geometry is mirrored; tip rest points are computed to match)
  for (const side of [1, -1] as const) {
    mk(0.2, 0.055, 0.055, wood, side * 0.15, 0.05, 0.02, side * 0.4)
    mk(0.17, 0.05, 0.05, woodDark, side * 0.3, 0.06, 0.02, side * -0.3)
    mk(0.05, 0.042, 0.042, wrap, side * 0.383, 0.038, 0.02) // nock tip cap
  }

  // dynamic string — two segments meeting at a moving nock node
  const nock = new THREE.Group()
  nock.position.set(0, 0.03, -0.1)
  g.add(nock)
  const strUp = new THREE.Mesh(new THREE.BoxGeometry(0.016, 1, 0.016), stringMat)
  const strDown = new THREE.Mesh(new THREE.BoxGeometry(0.016, 1, 0.016), stringMat)
  nock.add(strUp, strDown)

  // the nocked arrow — slides back with the draw, vanishes on release
  const arrow = new THREE.Group()
  const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.6, 0.026), lam(bone ? 0xd8c9a2 : 0xc9b083))
  shaft.position.y = -0.22
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.09, 0.05), lam(0xb8bcc4))
  head.position.y = -0.55
  const fl1 = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.1, 0.07), lam(0xe8e4d8))
  fl1.position.y = 0.03
  const fl2 = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.1, 0.012), lam(0xe8e4d8))
  fl2.position.y = 0.03
  arrow.add(shaft, head, fl1, fl2)
  arrow.position.set(0, 0.03, -0.1)
  arrow.visible = false
  g.add(arrow)

  const parts: BowParts = {
    nock,
    strUp,
    strDown,
    tipA: new THREE.Vector3(0.383, 0.03, -0.1),
    tipB: new THREE.Vector3(-0.383, 0.03, -0.1),
    nockRestY: 0.03,
    arrow,
  }
  g.userData.bowParts = parts
  g.scale.setScalar(1.05)
  return g
}

/** bend the bow: d = 0 (rest) .. 1 (full draw). Slides the nock back along
    the arrow axis and re-aims both string segments at the limb tips. */
export function setBowDraw(bow: THREE.Group, d: number) {
  const u = bow.userData.bowParts as BowParts | undefined
  if (!u) return
  const draw = Math.max(0, Math.min(1, d))
  const y = u.nockRestY + draw * 0.34
  u.nock.position.y = y
  u.arrow.position.y = y
  aimString(u.strUp, u.tipA, u.nock.position)
  aimString(u.strDown, u.tipB, u.nock.position)
}

/** show / hide the arrow sitting on the string */
export function setNocked(bow: THREE.Group, visible: boolean) {
  const u = bow.userData.bowParts as BowParts | undefined
  if (!u) return
  u.arrow.visible = visible
}

/** stretch a unit-height box between two points (bow-local space) */
function aimString(seg: THREE.Mesh, a: THREE.Vector3, b: THREE.Vector3) {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len = Math.hypot(dx, dy) || 0.001
  seg.scale.set(1, len, 1)
  seg.position.set((a.x + b.x) / 2 - b.x, (a.y + b.y) / 2 - b.y, 0)
  seg.rotation.z = Math.atan2(-dx, dy)
}

/** the string's pull curve — matches the timing of animBowDraw so the
    cord and the body move as one */
export function bowDrawAmount(p: number) {
  const pull = p <= 0.24 ? 0 : Math.min(1, (p - 0.24) / 0.52)
  return 1 - Math.pow(1 - pull, 2.2)
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

/* ---------- lordly dressing helpers — the bosses earn every box ---------- */

/** a slab of armor bolted onto a limb group (it swings with the arm/leg) */
function limbPlate(
  limb: THREE.Group,
  w: number,
  h: number,
  d: number,
  y: number,
  mat: THREE.Material,
  z = 0
) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)
  m.position.set(0, y, z)
  m.castShadow = true
  limb.add(m)
  return m
}

/** four fauld slabs ringed around the hips — the skirt of plate armor */
function addFaulds(parent: THREE.Object3D, mat: THREE.Material, y = 0.72) {
  const mk = (w: number, d: number, x: number, z: number, rx: number) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.26, d), mat)
    m.position.set(x, y, z)
    m.rotation.x = rx
    m.castShadow = true
    parent.add(m)
  }
  mk(0.36, 0.07, 0, 0.18, 0.1) // front kicks out slightly
  mk(0.36, 0.07, 0, -0.18, -0.1)
  mk(0.07, 0.28, 0.2, 0, 0)
  mk(0.07, 0.28, -0.2, 0, 0)
}

/** a curved horn of stacked segments rising from the head; optional
    glowing tip for the burning crowns */
function addHorn(
  head: THREE.Mesh,
  side: 1 | -1,
  segs: { w: number; h: number; x: number; y: number; rz: number }[],
  mat: THREE.Material,
  tip?: { mat: THREE.Material; s: number }
) {
  for (const sg of segs) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(sg.w, sg.h, sg.w), mat)
    m.position.set(side * sg.x, sg.y, 0)
    m.rotation.z = -side * sg.rz
    m.castShadow = true
    head.add(m)
  }
  if (tip) {
    const last = segs[segs.length - 1]
    const t = new THREE.Mesh(new THREE.BoxGeometry(tip.s, tip.s, tip.s), tip.mat)
    t.position.set(side * (last.x + 0.05), last.y + last.h * 0.35, 0)
    head.add(t)
  }
}

/** a layered, battle-torn cape hanging from a pivot behind the torso.
    `collar` bolts a band across the shoulders; `hem` glows along the
    bottom edge (the Flame King's mantle is literally on fire). */
function addCape(
  parent: THREE.Object3D,
  cloth: THREE.Material,
  collar: THREE.Material | null,
  hem: THREE.Material | null,
  w: number,
  mats: THREE.Material[]
) {
  mats.push(cloth)
  const pivot = new THREE.Group()
  pivot.position.set(0, 1.47, -0.18)
  parent.add(pivot)
  const seg = (ww: number, hh: number, y: number, z: number, rx: number) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(ww, hh, 0.03), cloth)
    m.position.set(0, y, z)
    m.rotation.x = rx
    m.castShadow = true
    pivot.add(m)
    return m
  }
  const upper = seg(w, 0.5, -0.27, -0.015, 0.1)
  if (collar) {
    const band = new THREE.Mesh(new THREE.BoxGeometry(w * 1.04, 0.06, 0.036), collar)
    band.position.set(0, 0.01, 0.004)
    upper.add(band)
  }
  if (hem) {
    const hemUp = new THREE.Mesh(new THREE.BoxGeometry(w * 0.98, 0.05, 0.034), hem)
    hemUp.position.set(0, -0.23, 0.003)
    upper.add(hemUp)
  }
  const lower = seg(w * 0.84, 0.42, -0.71, -0.05, -0.08)
  if (hem) {
    const hemLow = new THREE.Mesh(new THREE.BoxGeometry(w * 0.82, 0.05, 0.034), hem)
    hemLow.position.set(0, -0.19, 0.003)
    lower.add(hemLow)
  }
  // the hem is battle-torn — three ragged strips at uneven lengths
  const stripW = w * 0.2
  const strips: [number, number, number][] = [
    [-1, 0.13, -0.99],
    [0, 0.17, -1.0],
    [1, 0.11, -0.98],
  ]
  for (const [sx, sh, sy] of strips) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(stripW, sh, 0.03), cloth)
    s.position.set(sx * w * 0.28, sy, -0.058)
    s.rotation.z = sx * 0.08
    pivot.add(s)
  }
  return pivot
}

/** mini-lords of the Vale — curved horns, a single pauldron over the
    sword arm and a ragged half-cape mark them as greater hollows */
export function dressChampion(h: Humanoid, style: 'wither' | 'bone') {
  const hornMat = new THREE.MeshLambertMaterial({ color: style === 'wither' ? 0x35313a : 0xcfc8b4 })
  const hornDark = new THREE.MeshLambertMaterial({ color: style === 'wither' ? 0x242128 : 0xa49b86 })
  const plate = new THREE.MeshLambertMaterial({ color: style === 'wither' ? 0x3c3842 : 0x8a8478 })
  const capeMat = gearMaterial(
    'cloth',
    style === 'wither' ? 0x40363c : 0x6e6455,
    style === 'wither' ? 0x2a242b : 0x4c453a
  ).clone()
  h.materials.push(hornMat, hornDark, plate, capeMat)
  // curved horns
  for (const sx of [-1, 1] as const) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.14, 0.09), hornMat)
    b.position.set(sx * 0.24, 0.2, 0)
    b.rotation.z = -sx * 0.4
    b.castShadow = true
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.11, 0.07), hornDark)
    t.position.set(sx * 0.32, 0.32, 0)
    t.rotation.z = -sx * 0.8
    t.castShadow = true
    h.head.add(b, t)
  }
  // a single pauldron over the sword arm
  const p = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.16, 0.3), plate)
  p.position.set(0.01, -0.05, 0)
  p.castShadow = true
  const rim = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.06, 0.32), hornDark)
  rim.position.set(0.01, -0.14, 0)
  h.armR.add(p, rim)
  // a ragged half-cape hung from the torso
  const pivot = new THREE.Group()
  pivot.position.set(0, 0.35, -0.15)
  h.body.add(pivot)
  const upper = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.026), capeMat)
  upper.position.set(0, -0.22, -0.012)
  upper.rotation.x = 0.12
  upper.castShadow = true
  const lower = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.026), capeMat)
  lower.position.set(0, -0.56, -0.05)
  lower.rotation.x = -0.1
  lower.castShadow = true
  const strip = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.14, 0.026), capeMat)
  strip.position.set(0.08, -0.79, -0.07)
  strip.rotation.z = -0.1
  pivot.add(upper, lower, strip)
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

  const swordStyle: SwordStyle = opts.swordStyle ?? (kind === 'boss' ? 'greatsword' : kind === 'bossflame' ? 'kingblade' : kind === 'wither' ? 'stone' : 'iron')
  let sword: THREE.Group | null = null
  let shield: THREE.Group | null = null
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
    shield = sh
  }

  /* ---------- per-kind model dressing ---------- */
  if (kind === 'boss') {
    // THE ANCIENT ZOMBIE KNIGHT — a rotted giant in bolted-on relic
    // plate: gorget, layered pauldrons with spikes, full limb harness,
    // faulds, a torn war-cape and a broken-horned great helm.
    const steel = new THREE.MeshLambertMaterial({ color: 0x7c828c })
    const steelDark = new THREE.MeshLambertMaterial({ color: 0x565a64 })
    const steelLight = new THREE.MeshLambertMaterial({ color: 0x969eaa })
    const crestMat = new THREE.MeshLambertMaterial({ color: 0x6a1d1d })
    mats.all.push(steel, steelDark, steelLight, crestMat)
    // gorget ringing the neck + collar plate + chest + backplate
    spinInner.add(
      mkMesh(0.34, 0.12, 0.34, steelDark, 0, 1.56, 0),
      mkMesh(0.62, 0.06, 0.38, steel, 0, 1.5, 0),
      mkMesh(0.56, 0.36, 0.31, steel, 0, 1.26, 0),
      mkMesh(0.08, 0.3, 0.33, steelDark, 0, 1.28, 0),
      mkMesh(0.42, 0.32, 0.06, steelDark, 0, 1.26, -0.17),
      mkMesh(0.56, 0.09, 0.29, steelDark, 0, 0.86, 0),
      mkMesh(0.5, 0.1, 0.26, steelLight, 0, 0.79, 0)
    )
    // faulds — the dead knight's skirt of plate
    addFaulds(spinInner, steelDark, 0.72)
    // layered pauldrons + a pair of spikes bolted on each
    addPauldrons(spinInner, extras, 0.34, 0x7c828c, 0x565a64, 1.46)
    for (const sx of [-1, 1]) {
      const s1 = mkMesh(0.07, 0.18, 0.07, steelLight, sx * 0.42, 1.64, 0.09)
      s1.rotation.z = -sx * 0.3
      const s2 = mkMesh(0.06, 0.13, 0.06, steelDark, sx * 0.42, 1.62, -0.12)
      s2.rotation.x = 0.35
      spinInner.add(s1, s2)
    }
    // limb harness — every plate swings with its limb
    for (const arm of [armL, armR]) {
      limbPlate(arm, 0.29, 0.12, 0.29, -0.13, steel) // upper-arm ring
      limbPlate(arm, 0.28, 0.17, 0.28, -0.48, steelDark) // vambrace
      limbPlate(arm, 0.29, 0.1, 0.3, -0.68, steel) // gauntlet cuff
    }
    for (const leg of [legL, legR]) {
      limbPlate(leg, 0.26, 0.22, 0.26, -0.16, steel) // cuisse
      limbPlate(leg, 0.28, 0.1, 0.28, -0.37, steelLight) // knee cop
      limbPlate(leg, 0.25, 0.22, 0.25, -0.57, steelDark) // greave
      limbPlate(leg, 0.25, 0.08, 0.34, -0.71, steelDark, 0.03) // sabaton
    }
    // the torn war-cape of his order
    const capeMat = gearMaterial('cloth', 0x6a2020, 0x431414).clone()
    addCape(spinInner, capeMat, steelDark, null, 0.52, mats.all)
    // great helm: dome, brow band, a whole horn and a broken one, crest
    head.add(
      mkMesh(0.56, 0.18, 0.56, steel, 0, 0.27, 0),
      mkMesh(0.54, 0.1, 0.54, steel, 0, 0.19, 0),
      mkMesh(0.08, 0.13, 0.42, crestMat, 0, 0.42, 0)
    )
    for (const [hx, hy, hz] of [[-0.2, 0.28, 0.2], [0.2, 0.28, 0.2], [-0.2, 0.28, -0.2], [0.2, 0.28, -0.2]]) {
      head.add(mkMesh(0.05, 0.05, 0.05, steelDark, hx, hy, hz))
    }
    addHorn(head, -1, [
      { w: 0.1, h: 0.14, x: 0.28, y: 0.22, rz: 0.3 },
      { w: 0.08, h: 0.12, x: 0.37, y: 0.35, rz: 0.65 },
      { w: 0.06, h: 0.1, x: 0.43, y: 0.46, rz: 0.95 },
    ], new THREE.MeshLambertMaterial({ color: 0x8a8578 }))
    addHorn(head, 1, [{ w: 0.1, h: 0.1, x: 0.28, y: 0.22, rz: 0.3 }], new THREE.MeshLambertMaterial({ color: 0x6e6754 }))
    // burning eyes — dark socket, white-hot core
    const eyeSocket = new THREE.MeshBasicMaterial({ color: 0x8a1414 })
    const eyeCore = new THREE.MeshBasicMaterial({ color: 0xff3a2a })
    extras.push(eyeSocket, eyeCore)
    for (const sx of [-1, 1]) {
      const socket = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.08, 0.03), eyeSocket)
      socket.position.set(sx * 0.115, 0.02, 0.258)
      const core = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.034), eyeCore)
      core.position.set(sx * 0.115, 0.02, 0.262)
      head.add(socket, core)
    }
  }

  if (kind === 'bossflame') {
    // THE FLAME KING — a warlord cased in gold-trimmed obsidian, split
    // by living lava: a furnace heart, spiked pauldrons, a burning horned
    // crown and the royal mantle whose hem is literally on fire.
    const obsidian = new THREE.MeshLambertMaterial({ color: 0x241d20 })
    const obsidianDark = new THREE.MeshLambertMaterial({ color: 0x171114 })
    const obsidianLight = new THREE.MeshLambertMaterial({ color: 0x3a3034 })
    const gold = new THREE.MeshLambertMaterial({ color: 0xb8862a })
    const goldBright = new THREE.MeshLambertMaterial({ color: 0xdcaa48 })
    mats.all.push(obsidian, obsidianDark, obsidianLight, gold, goldBright)
    const molten = new THREE.MeshBasicMaterial({ color: 0xff7a1e })
    const moltenHot = new THREE.MeshBasicMaterial({ color: 0xffc23d })
    extras.push(molten, moltenHot)
    // gold collar + ember mantle tongues at the shoulders
    spinInner.add(
      mkMesh(0.6, 0.06, 0.36, gold, 0, 1.5, 0),
      mkMesh(0.58, 0.4, 0.33, obsidian, 0, 1.24, 0),
      mkMesh(0.05, 0.4, 0.335, gold, -0.275, 1.24, 0),
      mkMesh(0.05, 0.4, 0.335, gold, 0.275, 1.24, 0),
      mkMesh(0.58, 0.1, 0.31, obsidianDark, 0, 0.86, 0),
      mkMesh(0.1, 0.08, 0.02, goldBright, 0, 0.86, 0.16)
    )
    const tonguePos: [number, number, number][] = [
      [-0.26, 1.58, 0.12],
      [0.26, 1.58, 0.12],
      [-0.26, 1.58, -0.12],
      [0.26, 1.58, -0.12],
    ]
    tonguePos.forEach((p, i) => {
      const t = mkMesh(0.07, 0.14 + (i % 2) * 0.05, 0.07, i % 2 ? moltenHot : molten, p[0], p[1], p[2])
      t.rotation.z = -p[0] * 0.8
      spinInner.add(t)
    })
    // the furnace heart burning behind grate slats
    const heart = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.17, 0.05), moltenHot)
    heart.position.set(0, 1.26, 0.185)
    spinInner.add(heart)
    for (const gy of [-0.05, 0, 0.05]) {
      spinInner.add(mkMesh(0.23, 0.032, 0.02, obsidianDark, 0, 1.26 + gy, 0.205))
    }
    // lava veins splitting the chestplate
    const veinL = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.3, 0.02), molten)
    veinL.position.set(-0.12, 1.3, 0.175)
    const veinR = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.2, 0.02), molten)
    veinR.position.set(0.14, 1.34, 0.175)
    const veinC = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.12, 0.02), moltenHot)
    veinC.position.set(0, 1.14, 0.18)
    spinInner.add(veinL, veinR, veinC)
    // faulds + ember gaps glowing between the plates
    addFaulds(spinInner, obsidianDark, 0.72)
    for (const sx of [-1, 1]) {
      const gap = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.18, 0.06), molten)
      gap.position.set(sx * 0.205, 0.74, 0.06)
      spinInner.add(gap)
    }
    // spiked pauldrons with lava rim + hot tips
    addPauldrons(spinInner, extras, 0.4, 0x241d20, 0x171114, 1.48, true)
    for (const sx of [-1, 1]) {
      const s1 = mkMesh(0.06, 0.2, 0.06, obsidianLight, sx * 0.42, 1.66, 0.1)
      s1.rotation.z = -sx * 0.35
      const s2 = mkMesh(0.05, 0.15, 0.05, obsidian, sx * 0.42, 1.62, -0.14)
      s2.rotation.x = 0.4
      const tip = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.05, 0.045), moltenHot)
      tip.position.set(sx * 0.455, 1.755, 0.1)
      spinInner.add(s1, s2, tip)
    }
    // limb plates — molten veins burn along the outer face of each arm
    for (const [arm, sx] of [
      [armL, 1],
      [armR, -1],
    ] as const) {
      limbPlate(arm, 0.3, 0.14, 0.3, -0.14, obsidian)
      limbPlate(arm, 0.29, 0.18, 0.29, -0.48, obsidianDark)
      limbPlate(arm, 0.3, 0.1, 0.31, -0.68, gold)
      const vein = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.26, 0.05), molten)
      vein.position.set(sx * 0.13, -0.33, 0)
      arm.add(vein)
    }
    for (const leg of [legL, legR]) {
      limbPlate(leg, 0.27, 0.2, 0.27, -0.16, obsidian)
      limbPlate(leg, 0.29, 0.09, 0.29, -0.35, gold) // gold knee
      limbPlate(leg, 0.26, 0.24, 0.26, -0.58, obsidianDark)
      limbPlate(leg, 0.26, 0.08, 0.34, -0.71, obsidianDark, 0.03) // sabaton
      const vein = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.16, 0.04), molten)
      vein.position.set(0, -0.56, 0.145)
      leg.add(vein)
    }
    // the burning royal mantle
    const capeMat = gearMaterial('ember', 0x2a1a1e, 0x180f12).clone()
    addCape(spinInner, capeMat, gold, molten, 0.56, mats.all)
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
    // the burning horned crown — two sweeping obsidian horns
    addHorn(head, -1, [
      { w: 0.1, h: 0.16, x: 0.28, y: 0.24, rz: 0.5 },
      { w: 0.08, h: 0.14, x: 0.4, y: 0.42, rz: 0.9 },
      { w: 0.06, h: 0.12, x: 0.48, y: 0.56, rz: 1.25 },
    ], obsidianDark, { mat: moltenHot, s: 0.05 })
    addHorn(head, 1, [
      { w: 0.1, h: 0.16, x: 0.28, y: 0.24, rz: 0.5 },
      { w: 0.08, h: 0.14, x: 0.4, y: 0.42, rz: 0.9 },
      { w: 0.06, h: 0.12, x: 0.48, y: 0.56, rz: 1.25 },
    ], obsidianDark, { mat: moltenHot, s: 0.05 })
    head.add(mkMesh(0.07, 0.22, 0.07, obsidianDark, 0, 0.38, 0)) // center spike
    const ctip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.06, 0.05), moltenHot)
    ctip.position.set(0, 0.53, 0)
    head.add(ctip)
    // white-hot stare — orange halo, white core
    const eyeGlow = new THREE.MeshBasicMaterial({ color: 0xffd23d })
    const eyeCore = new THREE.MeshBasicMaterial({ color: 0xfff4c8 })
    extras.push(eyeGlow, eyeCore)
    for (const sx of [-1, 1]) {
      const socket = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.08, 0.03), eyeGlow)
      socket.position.set(sx * 0.115, 0.02, 0.258)
      const core = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.034), eyeCore)
      core.position.set(sx * 0.115, 0.02, 0.262)
      head.add(socket, core)
    }
  }

  if (kind === 'coal') {
    // THE FIRST COAL — the hollowed last Builder: a giant cased in
    // chiseled basalt slabs, split by a blazing core, dragging the
    // broken halves of his hammer behind his shoulders like a yoke.
    const basalt = new THREE.MeshLambertMaterial({ color: 0x2e2830 })
    const basaltDark = new THREE.MeshLambertMaterial({ color: 0x1e191f })
    const basaltLight = new THREE.MeshLambertMaterial({ color: 0x4a424e })
    const gold = new THREE.MeshLambertMaterial({ color: 0xb8862a })
    mats.all.push(basalt, basaltDark, basaltLight, gold)
    const ember = new THREE.MeshBasicMaterial({ color: 0xff7a1e })
    const emberHot = new THREE.MeshBasicMaterial({ color: 0xffc23d })
    const emberWhite = new THREE.MeshBasicMaterial({ color: 0xfff0c0 })
    extras.push(ember, emberHot, emberWhite)
    // massive slab collar + chest over-plates that widen the silhouette
    spinInner.add(
      mkMesh(0.64, 0.08, 0.4, basaltLight, 0, 1.52, 0),
      mkMesh(0.66, 0.42, 0.34, basalt, 0, 1.24, 0),
      mkMesh(0.1, 0.42, 0.35, basaltDark, -0.29, 1.24, 0),
      mkMesh(0.1, 0.42, 0.35, basaltDark, 0.29, 1.24, 0),
      mkMesh(0.66, 0.1, 0.31, basaltDark, 0, 0.86, 0)
    )
    // the blazing core — a fist-wide fault breathing at the chest's heart
    const coreGlow = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.22, 0.05), emberHot)
    coreGlow.position.set(0, 1.24, 0.185)
    const coreHalo = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.3, 0.03), ember)
    coreHalo.position.set(0, 1.24, 0.172)
    spinInner.add(coreGlow, coreHalo)
    for (const gy of [-0.07, 0, 0.07]) {
      spinInner.add(mkMesh(0.26, 0.034, 0.02, basaltDark, 0, 1.24 + gy, 0.215))
    }
    // burning faults splitting the chest + the chain belt of his craft
    const faultL = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.3, 0.02), ember)
    faultL.position.set(-0.14, 1.28, 0.175)
    const faultR = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.22, 0.02), ember)
    faultR.position.set(0.15, 1.3, 0.175)
    spinInner.add(faultL, faultR)
    for (const sx of [-1, 1]) {
      const link = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.36), basaltLight)
      link.position.set(sx * 0.1, 0.85, 0)
      spinInner.add(link)
    }
    // slab pauldrons — taller, blunter than the knight's spikes
    addPauldrons(spinInner, extras, 0.42, 0x2e2830, 0x1e191f, 1.5, false)
    for (const sx of [-1, 1]) {
      spinInner.add(mkMesh(0.12, 0.16, 0.12, basaltLight, sx * 0.43, 1.68, 0))
      const seam = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.1, 0.02), ember)
      seam.position.set(sx * 0.43, 1.66, 0.065)
      spinInner.add(seam)
    }
    // faulds of cracked stone with ember gaps
    addFaulds(spinInner, basaltDark, 0.74)
    for (const sx of [-1, 1]) {
      const gap = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.18, 0.06), ember)
      gap.position.set(sx * 0.215, 0.74, 0.06)
      spinInner.add(gap)
    }
    // limb plates — every arm drags a chain, every leg a broken brace
    for (const [arm, sx] of [
      [armL, 1],
      [armR, -1],
    ] as const) {
      limbPlate(arm, 0.32, 0.15, 0.32, -0.14, basalt)
      limbPlate(arm, 0.31, 0.19, 0.31, -0.48, basaltDark)
      limbPlate(arm, 0.32, 0.1, 0.33, -0.68, basaltLight)
      const chain = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.3, 0.045), basaltLight)
      chain.position.set(sx * 0.14, -0.36, 0)
      arm.add(chain)
      const seam = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.14, 0.05), ember)
      seam.position.set(sx * 0.13, -0.3, 0.001)
      arm.add(seam)
    }
    for (const leg of [legL, legR]) {
      limbPlate(leg, 0.28, 0.2, 0.28, -0.16, basalt)
      limbPlate(leg, 0.3, 0.09, 0.3, -0.35, basaltLight)
      limbPlate(leg, 0.27, 0.24, 0.27, -0.58, basaltDark)
      limbPlate(leg, 0.27, 0.08, 0.35, -0.71, basaltDark, 0.03)
      const seam = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.16, 0.04), ember)
      seam.position.set(0, -0.55, 0.15)
      leg.add(seam)
    }
    // the broken hammer-yoke — the Builder's tool, snapped in half,
    // hanging off both shoulders: the silhouette of a craft gone hollow
    const handleMat = new THREE.MeshLambertMaterial({ color: 0x5a4026 })
    mats.all.push(handleMat)
    for (const sx of [-1, 1]) {
      const handle = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.9, 0.09), handleMat)
      handle.position.set(sx * 0.34, 1.05, -0.28)
      handle.rotation.z = sx * 0.5
      handle.rotation.x = 0.12
      const headBlock = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.24, 0.24), basaltLight)
      headBlock.position.set(sx * 0.56, 1.52, -0.3)
      headBlock.rotation.z = sx * 0.5
      const hotSeam = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.05, 0.26), ember)
      hotSeam.position.set(sx * 0.56, 1.5, -0.3)
      hotSeam.rotation.z = sx * 0.5
      spinInner.add(handle, headBlock, hotSeam)
    }
    // the broken crown — stumps of pillars around a burning heart-crack
    for (const [px2, pz2, h] of [[-0.2, 0.18, 0.2], [0.2, 0.18, 0.18], [-0.19, -0.16, 0.16], [0.19, -0.16, 0.22]] as const) {
      head.add(mkMesh(0.09, h, 0.09, basaltLight, px2, 0.3 + h / 2, pz2))
    }
    const crownCrack = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.3, 0.06), emberHot)
    crownCrack.position.set(0, 0.42, 0)
    head.add(crownCrack)
    // the white-hot sight-holes burn out of the mask
    for (const sx of [-1, 1]) {
      const glow = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.07, 0.03), emberHot)
      glow.position.set(sx * 0.115, 0.02, 0.256)
      const core = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 0.034), emberWhite)
      core.position.set(sx * 0.115, 0.02, 0.262)
      head.add(glow, core)
    }
  }

  if (kind === 'smith') {
    // THE FORGE-KEEPER — a soot-black smith: leather apron face-plate,
    // a hammer holstered at the belt, tongs hanging from a shoulder loop
    const leather = new THREE.MeshLambertMaterial({ color: 0x6a4a2c })
    const leatherDark = new THREE.MeshLambertMaterial({ color: 0x4a3320 })
    mats.all.push(leather, leatherDark)
    // apron front-plate over the torso
    spinInner.add(
      mkMesh(0.44, 0.5, 0.06, leather, 0, 1.12, 0.15),
      mkMesh(0.48, 0.08, 0.07, leatherDark, 0, 1.34, 0.15),
      mkMesh(0.46, 0.1, 0.06, leatherDark, 0, 0.9, 0.15)
    )
    // tongs loop over the left shoulder
    spinInner.add(mkMesh(0.06, 0.34, 0.06, leatherDark, -0.2, 1.42, -0.05))
    const tongL = mkMesh(0.04, 0.3, 0.04, leatherDark, -0.2, 1.22, -0.1)
    tongL.rotation.x = 0.35
    spinInner.add(tongL)
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
  return { group, root, spin, head, body, armL, armR, legL, legR, legsBack, materials: mats.all, extras, sword, shield }
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

/** guard-walk: the shield stays welded in front while the legs march,
    the sword arm counter-swings low and the body rolls over each step.
    Walking while blocking finally looks alive, not frozen. */
export function animBlockWalk(h: Humanoid, t: number, f = 1) {
  resetPose(h)
  const s = Math.sin(t * 10)
  const c = Math.cos(t * 10)
  // marching legs (slightly shorter stride than a free run — you're braced)
  h.legL.rotation.x = s * 0.58 * f
  h.legR.rotation.x = -s * 0.58 * f
  // shield arm locked up, breathing with the brace tremble
  h.armL.rotation.x = -1.62 + Math.sin(t * 9) * 0.02
  h.armL.rotation.y = -0.5
  h.armL.rotation.z = 0.35
  // sword arm trails low, counter-swinging against the shield arm
  h.armR.rotation.x = -0.5 + s * 0.3 * f
  h.armR.rotation.z = -0.3 - c * 0.06
  h.root.rotation.y = -0.16
  h.root.rotation.z = c * 0.035
  h.root.position.y = Math.abs(c) * 0.035 * f
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

/** rattle-step march with the bow carried low across the body, ready to
    snap up into a shot */
export function animSkeletonWalk(h: Humanoid, t: number, f = 1) {
  resetPose(h)
  const s = Math.sin(t * 10)
  const c = Math.cos(t * 10)
  h.legL.rotation.x = s * 0.62 * f
  h.legR.rotation.x = -s * 0.62 * f
  // bow arm swings with the gait but rides high enough to clear the hips
  h.armL.rotation.x = -0.95 - s * 0.16 * f
  h.armL.rotation.z = 0.24
  h.armR.rotation.x = -0.45 + s * 0.3 * f
  h.armR.rotation.z = -0.28
  h.root.rotation.y = c * 0.06
  h.head.rotation.y = Math.sin(t * 2.1) * 0.1
  h.root.position.y = Math.abs(c) * 0.04 * f
}

/** alias kept for readability — the archer's walk IS the bow walk */
export const animBowWalk = animSkeletonWalk

/** holding ground at firing range: bow low-diagonal, draw hand loose near
    the chest, skull scanning for movement */
export function animBowIdle(h: Humanoid, t: number) {
  resetPose(h)
  const b = Math.sin(t * 1.9)
  h.armL.rotation.x = -0.78 + b * 0.045
  h.armL.rotation.z = 0.22
  h.armL.rotation.y = 0.08
  h.armR.rotation.x = -0.42 + Math.sin(t * 1.9 + 0.7) * 0.05
  h.armR.rotation.z = -0.3
  h.root.rotation.y = Math.sin(t * 0.8) * 0.06
  h.head.rotation.y = Math.sin(t * 0.6) * 0.22
  h.head.rotation.x = 0.04 + b * 0.02
  h.root.position.y = b * 0.01
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

/** posture broken — a believable Souls-style stagger told in four beats:
    1. recoil (0..0.14): the blow rocks the lord back onto his heels — head
       snaps away, arms flare out, the body lifts off the ground a moment
    2. crumple (0.14..0.36): balance is lost; he lurches forward and a knee
       slams the ground (dust beat fires from the boss class here)
    3. kneel (0.36..0.74): head hangs low, shoulders heave with wounded
       breathing, the planted sword hand keeps him from face-planting
    4. rally (0.74..1): a growl pushes him back up — shaking off the cobwebs
       with a head-wobble, squaring the shoulders for the next exchange
    `t` is absolute time so breathing stays alive while held in the kneel. */
export function animStagger(h: Humanoid, p: number, t = 0) {
  resetPose(h)
  if (p < 0.14) {
    // ---- 1. recoil ----
    const q = easeOut(p / 0.14)
    h.root.position.y = 0.1 * q
    h.root.rotation.x = -0.4 * q
    h.head.rotation.x = -0.62 * q
    h.armL.rotation.x = -1.5 * q
    h.armR.rotation.x = -1.7 * q
    h.armL.rotation.z = 0.85 * q
    h.armR.rotation.z = -0.85 * q
    h.legL.rotation.x = -0.5 * q
    h.legR.rotation.x = 0.25 * q
  } else if (p < 0.36) {
    // ---- 2. crumple: lurch down, right knee hits the ground ----
    const q = (p - 0.14) / 0.22
    const e = q * q * (3 - 2 * q)
    h.root.position.y = lerp(0.1, -0.52, e)
    h.root.rotation.x = lerp(-0.4, 0.24, e)
    h.root.rotation.z = lerp(0, 0.1, e) // lists to the kneeling side
    h.legR.rotation.x = lerp(0.25, -1.5, e) // knee folded under
    h.legL.rotation.x = lerp(-0.5, 0.5, e) // planted leg takes the weight
    h.legL.rotation.z = lerp(0, 0.12, e)
    h.armL.rotation.x = lerp(-1.5, 0.7, e)
    h.armL.rotation.z = lerp(0.85, 0.25, e)
    h.armR.rotation.x = lerp(-1.7, -1.05, e) // sword hand reaches for the floor
    h.armR.rotation.z = lerp(-0.85, -0.3, e)
    h.head.rotation.x = lerp(-0.62, 0.45, e)
  } else if (p < 0.74) {
    // ---- 3. kneel: wounded breathing, head hanging ----
    const breath = Math.sin(t * 3.4)
    h.root.position.y = -0.52 + breath * 0.02
    h.root.rotation.x = 0.24 + breath * 0.045
    h.root.rotation.z = 0.1 + Math.sin(t * 1.6) * 0.05
    h.legR.rotation.x = -1.5
    h.legL.rotation.x = 0.5
    h.legL.rotation.z = 0.12
    h.armL.rotation.x = 0.7 + breath * 0.12 // dangling arm sways with the heave
    h.armL.rotation.z = 0.25
    h.armR.rotation.x = -1.05 + Math.sin(t * 13) * 0.02 // planted, faint tremble
    h.armR.rotation.z = -0.3
    h.head.rotation.x = 0.45 + breath * 0.05
    h.head.rotation.z = Math.sin(t * 1.3) * 0.14 // consciousness pulling back
  } else {
    // ---- 4. rally: pushes off the knee, shakes the cobwebs off ----
    const q = (p - 0.74) / 0.26
    const e = easeOut(q)
    h.root.position.y = lerp(-0.52, 0, e)
    h.root.rotation.x = lerp(0.24, -0.14, Math.min(1, q * 1.4)) * (1 - Math.max(0, q - 0.7) / 0.3)
    h.root.rotation.z = lerp(0.1, 0, e)
    h.legR.rotation.x = lerp(-1.5, 0, e)
    h.legL.rotation.x = lerp(0.5, 0, e)
    h.legL.rotation.z = lerp(0.12, 0, e)
    h.armR.rotation.x = lerp(-1.05, 0, e)
    h.armR.rotation.z = lerp(-0.3, 0, e)
    h.armL.rotation.x = lerp(0.7, 0, e)
    h.armL.rotation.z = lerp(0.25, 0, e)
    h.head.rotation.x = lerp(0.45, 0, e)
    h.head.rotation.z = Math.sin(q * 9) * 0.15 * (1 - q) // the shake-off
  }
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

/** a real archery shot in three beats —
    1. reach (0..0.24): the bow arm swings up to full extension while the
       draw hand drops onto the string,
    2. pull (0.24..0.76): the cord drags back to the cheek as the whole body
       coils — yaw, braced legs, chin sinking onto the arrow line,
    3. hold (0.76..1): full draw with a rising tremble that sells the tension.
       Pair with bowDrawAmount() to bend the bow's string in sync. */
export function animBowDraw(h: Humanoid, p: number) {
  resetPose(h)
  const reach = Math.min(1, p / 0.24)
  const eReach = 1 - Math.pow(1 - reach, 2)
  const pull = p <= 0.24 ? 0 : Math.min(1, (p - 0.24) / 0.52)
  const ePull = 1 - Math.pow(1 - pull, 2.2)
  // bow arm: extends and stays glued, with a whisper of sway
  h.armL.rotation.x = lerp(-0.9, -1.62, eReach) + Math.sin(p * 20) * 0.008 * ePull
  h.armL.rotation.z = lerp(0.2, 0.06, eReach)
  // draw hand: drops to the string, then drags it home to the cheek
  if (p <= 0.24) {
    h.armR.rotation.x = lerp(-0.35, -1.5, eReach)
    h.armR.rotation.z = lerp(-0.2, -0.12, eReach)
  } else {
    h.armR.rotation.x = lerp(-1.5, -0.38, ePull)
    h.armR.rotation.z = lerp(-0.12, -0.42, ePull)
  }
  // body coils into the shot
  h.root.rotation.y = 0.2 * ePull
  h.root.rotation.x = -0.04 * ePull
  h.legL.rotation.x = 0.16 * ePull
  h.legR.rotation.x = -0.22 * ePull
  h.legL.rotation.z = 0.05 * ePull
  h.legR.rotation.z = -0.05 * ePull
  h.head.rotation.y = -0.1 * ePull
  h.head.rotation.x = 0.05 * ePull
  // full-draw tremble — the last fifth quivers with tension
  if (p > 0.8) {
    const k = (p - 0.8) / 0.2
    const tr = Math.sin(p * 95) * 0.026 * k
    h.armR.rotation.x += tr
    h.armL.rotation.x -= tr * 0.5
    h.head.rotation.z = Math.sin(p * 70) * 0.02 * k
  }
}

/** the release: the draw hand snaps BACK past the cheek (not forward —
    that's how real archery works), the bow arm kicks with recoil, then a
    disciplined follow-through hold before relaxing to the carry */
export function animBowShoot(h: Humanoid, p: number) {
  resetPose(h)
  if (p < 0.22) {
    // the snap
    const q = p / 0.22
    const e = 1 - Math.pow(1 - q, 3)
    h.armR.rotation.x = lerp(-0.38, -0.02, e)
    h.armR.rotation.z = lerp(-0.42, -0.55, e)
    h.armL.rotation.x = -1.62 + 0.09 * Math.sin(q * Math.PI) // recoil kick
    h.root.rotation.y = lerp(0.2, 0.05, e)
    h.root.rotation.x = -0.02 * Math.sin(q * Math.PI)
  } else if (p < 0.62) {
    // follow-through — the shot holds while the arrow flies
    h.armR.rotation.x = -0.02 + (p - 0.22) * 0.08
    h.armR.rotation.z = -0.5
    h.armL.rotation.x = -1.53
    h.armL.rotation.z = 0.06
    h.root.rotation.y = 0.05
    h.head.rotation.x = 0.03
  } else {
    // relax back into the carry
    const q = (p - 0.62) / 0.38
    const e = 1 - Math.pow(1 - q, 2)
    h.armR.rotation.x = lerp(0.01, -0.42, e)
    h.armR.rotation.z = lerp(-0.5, -0.3, e)
    h.armL.rotation.x = lerp(-1.53, -0.78, e)
    h.armL.rotation.z = lerp(0.06, 0.22, e)
    h.root.rotation.y = lerp(0.05, 0, e)
  }
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

/* ================= MERCHANT NPC ================= */

/** the grey merchant of the bonfire — a travelling trader with a walking
    staff, a satchel on his back and a hood against the ash-fall */
export function createMerchant(): Humanoid {
  const h = createHumanoid('merchant', 1.0)
  // walking staff in the right hand (taller than a sword, blunt tip)
  const staff = new THREE.Group()
  const lam = (c: number) => new THREE.MeshLambertMaterial({ color: c })
  const wood = lam(0x6e4f30)
  const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.09, 1.25, 0.09), wood)
  shaft.castShadow = true
  shaft.position.y = -0.45
  const knob = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 0.15), lam(0x8a6a3c))
  knob.castShadow = true
  knob.position.y = 0.2
  const strap = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.06, 0.11), lam(0x4a3620))
  strap.position.y = -0.1
  staff.add(shaft, knob, strap)
  staff.position.set(0, -0.68, 0.05)
  staff.rotation.x = 0.12
  h.armR.add(staff)
  // satchel on the back
  const pack = new THREE.Group()
  const bag = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.4, 0.16), lam(0x7a5a34))
  bag.castShadow = true
  const flap = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.14, 0.18), lam(0x4a3620))
  flap.position.set(0, 0.14, -0.01)
  pack.add(bag, flap)
  pack.position.set(0, 0.05, -0.26)
  h.body.parent!.add(pack) // attach beside the torso (body is inside spin)
  return h
}

/** the forge-keeper: a hammer holstered at the hip, bare sooty arms */
export function createSmith(): Humanoid {
  const h = createHumanoid('smith', 1.08)
  const lam = (c: number) => new THREE.MeshLambertMaterial({ color: c })
  // the smith's hammer rides in the right hand — head down, resting
  const hammer = new THREE.Group()
  const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.62, 0.07), lam(0x5a4026))
  shaft.castShadow = true
  shaft.position.y = -0.18
  const headB = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.14, 0.14), lam(0x3a3a42))
  headB.castShadow = true
  headB.position.y = -0.5
  const band = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.03, 0.16), lam(0x2a2a30))
  band.position.y = -0.44
  hammer.add(shaft, headB, band)
  hammer.position.set(0, -0.66, 0.06)
  hammer.rotation.x = 0.35
  h.armR.add(hammer)
  return h
}

/** forge idle: the smith leans on his hammer, coals breathe behind him */
export function animSmithIdle(h: Humanoid, t: number) {
  resetPose(h)
  const b = Math.sin(t * 1.4)
  h.root.position.y = b * 0.012
  h.root.rotation.z = Math.sin(t * 0.7) * 0.025
  // hammer arm rests low, weight on the heel of the hand
  h.armR.rotation.x = 0.12 + b * 0.04
  h.armR.rotation.z = -0.14
  // free arm occasionally wipes the brow
  h.armL.rotation.x = -0.1 + Math.max(0, Math.sin(t * 0.7)) * -0.5
  h.armL.rotation.z = 0.12
  h.head.rotation.y = Math.sin(t * 0.5) * 0.14
}

/** trade-post idle: weight shifts, staff taps, the hood scans for customers */
export function animMerchantIdle(h: Humanoid, t: number) {
  resetPose(h)
  const b = Math.sin(t * 1.9)
  h.root.position.y = b * 0.015
  h.root.rotation.z = Math.sin(t * 0.9) * 0.03
  h.armL.rotation.x = -0.12 + b * 0.06
  h.armL.rotation.z = 0.1
  // staff arm rests, occasionally tapping the ground
  h.armR.rotation.x = -0.08 + Math.max(0, Math.sin(t * 1.9 * 2)) * 0.05
  h.armR.rotation.z = -0.08
  h.head.rotation.y = Math.sin(t * 0.55) * 0.3
  h.head.rotation.x = 0.04
  h.legL.rotation.x = -0.03
  h.legR.rotation.x = 0.03
}

/** a welcoming wave when an unkindled one wanders close */
export function animMerchantGreet(h: Humanoid, p: number) {
  resetPose(h)
  const raise = Math.min(1, p * 3)
  const wave = Math.sin(p * Math.PI * 5) * (1 - p) * 0.55
  h.armR.rotation.x = -2.4 * raise
  h.armR.rotation.z = -0.35 - wave
  h.armL.rotation.x = -0.1
  h.armL.rotation.z = 0.1
  h.head.rotation.z = 0.08 * raise
  h.head.rotation.x = -0.06 * raise
}

/* ================= PLAYER EQUIPMENT VISUALS ================= */

export interface ArmorPieceVisual {
  /** the item's id — picks the texture family + unique ornaments */
  id?: string
  tint: number
  tint2?: number
}

export interface ArmorVisualSet {
  head?: ArmorPieceVisual | null
  chest?: ArmorPieceVisual | null
  hands?: ArmorPieceVisual | null
  legs?: ArmorPieceVisual | null
  cape?: ArmorPieceVisual | null
}

/** which painted texture family each armor item belongs to */
const GEAR_KIND: Record<string, GearKind> = {
  hollow_hood: 'leather', hollow_tunic: 'leather', hollow_wraps: 'leather', hollow_trousers: 'leather',
  bone_helm: 'bone', bone_chest: 'bone', bone_gloves: 'bone', bone_greaves: 'bone',
  wither_helm: 'dark', wither_plate: 'dark', wither_gauntlets: 'dark', wither_greaves: 'dark',
  knight_helm: 'plate', knight_chest: 'plate',
  flame_crown: 'obsidian', flame_chest: 'obsidian',
  creeper_hide: 'hide',
  tattered_cape: 'cloth', ashen_cape: 'cloth', blaze_cape: 'ember', flame_cape: 'ember',
}
const gearKindOf = (id?: string): GearKind => (id && GEAR_KIND[id]) || 'plate'

/** rebuild the player's armor overlays + cape from the equipped pieces.
    Every piece is a textured, layered blocky shell OVER the body — seams,
    rivets, cracks and weave painted per gear family, with signature
    ornaments for the boss regalia (knight plume, flame crown tongues…).
    Materials are private clones registered in h.materials so hit-flash and
    the death fade reach the armor too, and released on the next re-dress. */
export function applyPlayerArmor(h: Humanoid, v: ArmorVisualSet) {
  // release the previous dress: overlays off the body, private materials gone
  const parts: THREE.Object3D[] = []
  if (h.armorParts) {
    for (const p of h.armorParts) {
      // the bow rides through armor swaps — it is dressed by setPlayerBow
      if (p.name === 'playerBow') {
        parts.push(p)
        continue
      }
      p.parent?.remove(p)
      p.traverse((o) => {
        const m = o as THREE.Mesh
        if (m.geometry) m.geometry.dispose()
      })
    }
  }
  if (h.armorMats) {
    for (const m of h.armorMats) {
      const i = h.materials.indexOf(m)
      if (i >= 0) h.materials.splice(i, 1)
      m.dispose()
    }
  }
  const myMats: THREE.MeshLambertMaterial[] = []
  h.armorMats = myMats
  // a textured gear material, cloned for this body so flash/fade never
  // bleeds into ground drops that share the cached original
  const gmat = (t: ArmorPieceVisual, shade: 'main' | 'accent') => {
    const kind = gearKindOf(t.id)
    const m = gearMaterial(kind, shade === 'main' ? t.tint : t.tint2 ?? t.tint, shade === 'main' ? t.tint2 : t.tint).clone()
    myMats.push(m)
    h.materials.push(m)
    return m
  }
  // unlit glow ornaments (flame crown tongues, ember capes) — never flashed
  const glowMat = (c: number) => {
    const m = new THREE.MeshBasicMaterial({ color: c })
    myMats.push(m as unknown as THREE.MeshLambertMaterial)
    return m
  }
  const flatMat = (c: number) => {
    const m = new THREE.MeshLambertMaterial({ color: c })
    myMats.push(m)
    h.materials.push(m)
    return m
  }
  const mk = (
    w: number, hh: number, d: number,
    m: THREE.Material, x: number, y: number, z: number,
    parent: THREE.Object3D
  ) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, hh, d), m)
    mesh.position.set(x, y, z)
    mesh.castShadow = true
    parent.add(mesh)
    parts.push(mesh)
    return mesh
  }

  /* --- helmet: crown + brow + nose guard + cheeks + neck plate --- */
  if (v.head) {
    const t = v.head
    const m1 = gmat(t, 'main')
    const m2 = gmat(t, 'accent')
    mk(0.56, 0.16, 0.56, m1, 0, 0.2, 0, h.head)        // crown
    mk(0.56, 0.14, 0.56, m2, 0, 0.08, 0, h.head)       // brow band
    mk(0.56, 0.18, 0.1, m1, 0, 0.08, -0.23, h.head)    // back neck guard
    mk(0.08, 0.2, 0.06, m2, 0, 0.04, 0.285, h.head)    // nose guard
    mk(0.07, 0.13, 0.14, m2, 0.25, 0.02, 0.16, h.head) // cheek plate R
    mk(0.07, 0.13, 0.14, m2, -0.25, 0.02, 0.16, h.head) // cheek plate L
    mk(0.08, 0.05, 0.44, m2, 0, 0.3, 0, h.head)        // top ridge
    // signature regalia
    if (t.id === 'knight_helm') {
      // the knight's battle-scarred crimson plume
      const plume = flatMat(0x7c1f2c)
      mk(0.06, 0.11, 0.13, plume, 0, 0.37, -0.14, h.head)
      mk(0.06, 0.14, 0.13, plume, 0, 0.39, 0, h.head)
      mk(0.06, 0.1, 0.13, plume, 0, 0.36, 0.14, h.head)
    } else if (t.id === 'flame_crown') {
      // five unlit-but-burning tongues, the center one hottest
      const fm = glowMat(0xff7a1e)
      const fh = glowMat(0xffc23d)
      mk(0.08, 0.16, 0.08, fm, -0.2, 0.38, 0, h.head)
      mk(0.07, 0.22, 0.07, fh, -0.1, 0.41, 0, h.head)
      mk(0.09, 0.3, 0.09, fh, 0, 0.45, 0, h.head)
      mk(0.07, 0.22, 0.07, fm, 0.1, 0.41, 0, h.head)
      mk(0.08, 0.16, 0.08, fm, 0.2, 0.38, 0, h.head)
    } else if (t.id === 'hollow_hood') {
      // a drooping hood brim
      mk(0.62, 0.05, 0.62, m2, 0, 0.0, 0, h.head)
      mk(0.5, 0.16, 0.06, m1, 0, -0.02, -0.29, h.head)
    } else if (t.id === 'bone_helm') {
      // horn nubs of the skullcap
      mk(0.07, 0.12, 0.07, m2, 0.29, 0.3, 0, h.head)
      mk(0.07, 0.12, 0.07, m2, -0.29, 0.3, 0, h.head)
    }
  }

  /* --- cuirass: shell + ridge + buckle + back plate + fauld + pauldrons --- */
  if (v.chest) {
    const t = v.chest
    const m1 = gmat(t, 'main')
    const m2 = gmat(t, 'accent')
    const torso = h.body.parent ?? h.spin
    mk(0.58, 0.52, 0.32, m1, 0, 1.22, 0, torso)       // cuirass
    mk(0.1, 0.44, 0.34, m2, 0, 1.2, 0, torso)         // center ridge
    mk(0.58, 0.1, 0.31, m2, 0, 0.85, 0, torso)        // belt
    mk(0.12, 0.11, 0.03, m1, 0, 0.85, 0.165, torso)   // belt buckle
    mk(0.5, 0.4, 0.08, m2, 0, 1.22, -0.16, torso)     // back plate
    mk(0.54, 0.14, 0.08, m2, 0, 0.72, 0.14, torso)    // fauld, front
    mk(0.54, 0.14, 0.08, m2, 0, 0.72, -0.14, torso)   // fauld, back
    // shoulder pauldrons ride the arms so they swing with every stride
    for (const arm of [h.armL, h.armR]) {
      mk(0.34, 0.13, 0.34, m1, 0, -0.02, 0, arm)
      mk(0.36, 0.04, 0.36, m2, 0, -0.085, 0, arm)
    }
    // signature regalia
    if (t.id === 'knight_chest') {
      // gilded collar trim
      mk(0.62, 0.03, 0.34, flatMat(0xc9a44a), 0, 1.44, 0, torso)
    } else if (t.id === 'flame_chest') {
      // lava veins splitting the obsidian plate
      const fm = glowMat(0xff7a1e)
      const fh = glowMat(0xffc23d)
      mk(0.05, 0.26, 0.02, fm, -0.12, 1.26, 0.165, torso)
      mk(0.05, 0.18, 0.02, fm, 0.14, 1.3, 0.165, torso)
      mk(0.03, 0.1, 0.025, fh, 0, 1.24, 0.17, torso)
    }
  }

  /* --- gauntlets: sleeves + cuffs + straps + knuckle plates --- */
  if (v.hands) {
    const t = v.hands
    const m1 = gmat(t, 'main')
    const m2 = gmat(t, 'accent')
    for (const arm of [h.armL, h.armR]) {
      mk(0.3, 0.42, 0.3, m1, 0, -0.34, 0, arm)
      mk(0.31, 0.09, 0.31, m2, 0, -0.14, 0, arm)
      mk(0.315, 0.05, 0.315, m2, 0, -0.5, 0, arm)     // strap
      mk(0.24, 0.09, 0.1, m1, 0, -0.62, 0.09, arm)    // knuckle plate
    }
  }

  /* --- greaves: thigh + knee cop + shin + boots --- */
  if (v.legs) {
    const t = v.legs
    const m1 = gmat(t, 'main')
    const m2 = gmat(t, 'accent')
    for (const leg of [h.legL, h.legR]) {
      mk(0.3, 0.34, 0.3, m1, 0, -0.2, 0, leg)
      mk(0.31, 0.1, 0.31, m2, 0, -0.395, 0, leg)      // knee cop
      mk(0.28, 0.3, 0.28, m2, 0, -0.56, 0, leg)
      mk(0.3, 0.1, 0.34, m1, 0, -0.7, 0.03, leg)      // boot
    }
  }

  /* --- cape: clasp + layered cloth + hem, sways in code --- */
  if (v.cape) {
    const t = v.cape
    const m1 = gmat(t, 'main')
    const m2 = gmat(t, 'accent')
    const torso = h.body.parent ?? h.spin
    const pivot = new THREE.Group()
    pivot.position.set(0, 1.52, -0.145)
    const cloth = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.82, 0.05), m1)
    cloth.position.y = -0.42
    cloth.castShadow = true
    // an inner fold panel — the cloth hangs in two layers
    const fold = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.68, 0.04), m2)
    fold.position.set(0, -0.38, -0.05)
    const hem = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 0.06), m2)
    hem.position.y = -0.8
    const clasp = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.05, 0.06), m2)
    clasp.position.set(0, 0.02, 0.05)
    pivot.add(cloth, fold, hem, clasp)
    pivot.rotation.x = 0.08
    torso.add(pivot)
    parts.push(pivot)
    // smoldering capes shed embers that never go out
    if (t.id === 'blaze_cape' || t.id === 'flame_cape') {
      const em = glowMat(0xff7a1e)
      const emh = glowMat(0xffc23d)
      const spark = (x: number, y: number, m: THREE.Material) => {
        const s = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.045, 0.02), m)
        s.position.set(x, y, 0.035)
        pivot.add(s)
      }
      spark(-0.13, -0.5, em)
      spark(0.11, -0.62, emh)
      spark(0.02, -0.28, em)
    }
    h.capePivot = pivot
  } else {
    h.capePivot = null
  }

  h.armorParts = parts
}

/** swap the player's sword model for a different blade style */
export function setPlayerSword(h: Humanoid, style: SwordStyle, scale = 1) {
  if (h.sword) {
    h.sword.parent?.remove(h.sword)
    h.sword = null
  }
  const s = createSword(scale, style)
  s.position.set(0, -0.72, 0.06)
  s.rotation.x = Math.PI / 2 + Math.PI / 12
  h.armR.add(s)
  h.sword = s
}

/** swap the shield model (wood / iron face) */
export function setPlayerShield(h: Humanoid, style: 'wood' | 'iron') {
  if (h.shield) {
    h.shield.parent?.remove(h.shield)
    h.shield = null
  }
  const sh = createShield(style)
  sh.position.set(0.175, -0.42, 0.02)
  sh.rotation.y = -0.45
  h.armL.add(sh)
  h.shield = sh
}

/** the bow rides in the left hand like the skeleton archer's */
export function setPlayerBow(h: Humanoid, bow: THREE.Group | null) {
  const old = h.armorParts?.find((p) => p.name === 'playerBow')
  if (old) {
    old.parent?.remove(old)
    h.armorParts = h.armorParts?.filter((p) => p !== old)
  }
  if (bow) {
    bow.name = 'playerBow'
    bow.position.set(0, -0.68, 0.05)
    bow.rotation.y = Math.PI / 2
    h.armL.add(bow)
    if (!h.armorParts) h.armorParts = []
    h.armorParts.push(bow)
  }
}

/* ============================================================
   LOOT-DROP MODELS — tiny hand-built voxel props so every
   fallen item reads as what it is, not a tinted cube.
   ============================================================ */

/** a single voxel arrow (also reused by the ground bundle) */
export function createArrowMesh(fire = false): THREE.Group {
  const g = new THREE.Group()
  const lam = (c: number) => new THREE.MeshLambertMaterial({ color: c })
  const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.035, 0.5), lam(fire ? 0x6a4020 : 0xa8845a))
  const tip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.12), lam(fire ? 0xffb03a : 0xb8bec8))
  tip.position.z = 0.3
  const fl1 = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.12, 0.11), lam(fire ? 0xffc23d : 0xe8e4d8))
  fl1.position.z = -0.2
  const fl2 = fl1.clone()
  fl2.rotation.z = Math.PI / 2
  g.add(shaft, tip, fl1, fl2)
  if (fire) {
    const glow = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.1, 0.1),
      new THREE.MeshBasicMaterial({ color: 0xff7a1e, transparent: true, opacity: 0.55, depthWrite: false })
    )
    glow.position.z = 0.3
    g.add(glow)
  }
  return g
}

/** a fanned bundle of arrows — how ammo actually looks on the ground */
export function createArrowBundle(n: number, fire = false): THREE.Group {
  const g = new THREE.Group()
  const count = Math.max(3, Math.min(5, Math.ceil(n / 2)))
  for (let i = 0; i < count; i++) {
    const a = createArrowMesh(fire)
    // arrows lie crossed like a small faggot, tips pointing outward
    a.rotation.y = (i / count) * Math.PI * 2
    a.rotation.x = 0.12 * (i % 2 ? 1 : -1)
    a.position.y = 0.035 + (i % 2) * 0.05
    a.castShadow = true
    g.add(a)
  }
  // a binding wrap holding the bundle together
  const band = new THREE.Mesh(
    new THREE.BoxGeometry(0.16, 0.07, 0.16),
    new THREE.MeshLambertMaterial({ color: fire ? 0x7a3418 : 0x6a5a3a })
  )
  band.position.y = 0.07
  g.add(band)
  return g
}

/** real miniatures for every armor slot — textured with the same painted
    gear materials the worn pieces use, so what drops is what you wear */
export function createArmorDrop(slot: 'head' | 'chest' | 'hands' | 'legs' | 'cape', tint: number, tint2?: number, id?: string): THREE.Group {
  const g = new THREE.Group()
  const kind = gearKindOf(id)
  const m1 = gearMaterial(kind, tint, tint2)
  const m2 = gearMaterial(kind, tint2 ?? tint, tint)
  const mk = (w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z: number, rz = 0) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m)
    mesh.position.set(x, y, z)
    mesh.rotation.z = rz
    mesh.castShadow = true
    g.add(mesh)
    return mesh
  }

  if (slot === 'head') {
    // helmet: dome, brow band, nose guard, crest — sits open like on a stand
    mk(0.4, 0.14, 0.4, m1, 0, 0.2, 0)
    mk(0.34, 0.12, 0.34, m2, 0, 0.32, 0)
    mk(0.44, 0.07, 0.44, m2, 0, 0.12, 0)                 // brim
    mk(0.08, 0.16, 0.06, m2, 0, 0.08, 0.19)              // nose guard
    mk(0.06, 0.12, 0.4, m1, 0, 0.4, 0)                   // crest ridge
  } else if (slot === 'chest') {
    // cuirass: shell + shoulder flanges + ridge + belt, displayed leaning back
    mk(0.4, 0.34, 0.2, m1, 0, 0.26, 0)
    mk(0.12, 0.1, 0.22, m1, -0.24, 0.4, 0)               // shoulder L
    mk(0.12, 0.1, 0.22, m1, 0.24, 0.4, 0)                // shoulder R
    mk(0.08, 0.3, 0.22, m2, 0, 0.26, 0.01)               // center ridge
    mk(0.42, 0.08, 0.22, m2, 0, 0.08, 0)                 // belt
    mk(0.3, 0.1, 0.16, m2, 0, -0.02, 0)                  // skirt plate
    g.rotation.x = -0.16
  } else if (slot === 'hands') {
    // a pair of gauntlets laid side by side, palms down
    for (const s of [-1, 1]) {
      mk(0.16, 0.12, 0.2, m1, s * 0.13, 0.08, 0)
      mk(0.18, 0.05, 0.1, m2, s * 0.13, 0.15, 0)         // cuff
      mk(0.05, 0.04, 0.14, m2, s * 0.13, 0.03, 0.14)     // fingers hint
    }
  } else if (slot === 'legs') {
    // greaves: two shin plates with boot feet, standing at ease
    for (const s of [-1, 1]) {
      mk(0.15, 0.3, 0.15, m1, s * 0.11, 0.17, 0)
      mk(0.17, 0.06, 0.17, m2, s * 0.11, 0.34, 0)        // knee cop
      mk(0.16, 0.08, 0.26, m2, s * 0.11, 0.04, 0.04)     // boot
    }
  } else {
    // cape: folded cloth with a draped fold line and a hem band
    const cloth = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.4, 0.05), m1)
    cloth.position.set(0, 0.22, 0)
    cloth.rotation.x = 0.1
    cloth.castShadow = true
    const fold = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.07, 0.07), m2)
    fold.position.set(0, 0.24, 0.06)
    const hem = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.08, 0.06), m2)
    hem.position.set(0, 0.03, 0.02)
    g.add(cloth, fold, hem)
    g.rotation.x = -0.5 // leans back so the cloth faces the camera
  }
  return g
}
