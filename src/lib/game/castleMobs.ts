import * as THREE from 'three'
import { makeTex, fillNoise, type Rng } from './textures'
import type { Humanoid } from './models'

/* ==================================================================
   THE MOBS OF MANORLOTH — قلعهٔ مانولث's waking stones & singers
   ==================================================================
   The castle above the cloud sea kept three kinds of servants when
   the gods still answered: GARGOYLES carved to watch the walls (and
   still doing it, long after the walls stopped caring), REQUIEM
   CANTORS who sang the gods to sleep and never learned the war was
   over, and ASH HOUNDS bred from the cinders of the first forge.
   Every box below has a reason; every animation has a beat sheet.

   House style (learned from the Roc): ONE eye per side, feet at
   model y=0, quill→vane layering for anything feathery, glow mats
   only in `extras` so hit-flash and death-fade never touch them.
   ================================================================== */

function px(ctx: CanvasRenderingContext2D, x: number, y: number, c: string, w = 1, h = 1) {
  ctx.fillStyle = c
  ctx.fillRect(x, y, w, h)
}

const lerpN = (a: number, b: number, t: number) => a + (b - a) * Math.max(0, Math.min(1, t))
const clamp01 = (v: number) => Math.max(0, Math.min(1, v))
const ease = (p: number) => p * p * (3 - 2 * p)

/* ================= shared texture painters ================= */

function graniteTex(seed: number, dark: [number, number, number]) {
  return makeTex(16, seed, (c, r, s) => {
    fillNoise(c, r, s, dark, 12)
    // masonry chips — pale worn edges
    for (let i = 0; i < 5; i++) px(c, Math.floor(r() * s), Math.floor(r() * s), 'rgba(214,220,230,0.32)', 1 + Math.floor(r() * 2), 1)
    // hairline cracks — the stone remembers stress
    for (let i = 0; i < 3; i++) {
      let x = Math.floor(r() * s)
      for (let y = 2 + Math.floor(r() * 6); y < s; y += 2) {
        px(c, x, y, 'rgba(12,14,18,0.5)', 1, 1)
        x = Math.max(0, Math.min(s - 1, x + (r() < 0.5 ? -1 : 1)))
      }
    }
  })
}

function robeTex(seed: number, base: [number, number, number]) {
  return makeTex(16, seed, (c, r, s) => {
    fillNoise(c, r, s, base, 9)
    // woven threat lines — liturgical cloth
    for (let y = 0; y < s; y += 3) px(c, 0, y, 'rgba(0,0,0,0.28)', s, 1)
    // pale gold flecks of trim thread
    for (let i = 0; i < 4; i++) px(c, Math.floor(r() * s), Math.floor(r() * s), 'rgba(206,178,110,0.5)', 1, 1)
    // soot of centuries at the hem
    for (let x = 0; x < s; x++) px(c, x, s - 1, 'rgba(8,6,8,0.5)', 1, 1)
  })
}

function furTex(seed: number, base: [number, number, number]) {
  return makeTex(16, seed, (c, r, s) => {
    fillNoise(c, r, s, base, 14)
    // pale guard hairs — the ash never fully coats them
    for (let i = 0; i < 7; i++) px(c, Math.floor(r() * s), Math.floor(r() * s), 'rgba(190,182,168,0.22)', 1, 1 + Math.floor(r() * 2))
  })
}

function boneTex(seed: number) {
  return makeTex(16, seed, (c, r, s) => {
    fillNoise(c, r, s, [186, 178, 158], 10)
    for (let i = 0; i < 4; i++) px(c, Math.floor(r() * s), Math.floor(r() * s), 'rgba(120,112,96,0.4)', 1, 1)
    for (let x = 0; x < s; x++) if (r() < 0.2) px(c, x, 0, 'rgba(234,228,210,0.5)', 1, 1)
  })
}

/* ==================================================================
   1) THE STONE GARGOYLE — «گارگویلِ مانولث»
   ==================================================================
   Carved as a waterspout, posted as a watchman. It crouches on all
   fours, wings folded like roof blades, ram horns worn smooth by
   rain. It has stood still so long that moss gave up on it. But the
   old gods packed its cracks with their leftover fire — when the
   ash-walker comes, the stone remembers its job. */

export interface GargoyleRig {
  neck: THREE.Group
  headG: THREE.Group
  jaw: THREE.Group
  eyes: THREE.Mesh[] // ember slit eyes — dark while dormant
  cracks: THREE.Mesh[] // the smoldering seams
  throat: THREE.Mesh // the forge-glow deep in the mouth
  wingL: [THREE.Group, THREE.Group, THREE.Group] // arm / mid / tip
  wingR: [THREE.Group, THREE.Group, THREE.Group]
  arms: [THREE.Group, THREE.Group] // knuckle-walking forelimbs
  legs: [THREE.Group, THREE.Group] // digitigrade hind legs
  tail: THREE.Group
}

/** build the gargoyle — Humanoid-compatible (arms=forelimbs, legs=hind) */
export function createGargoyle(scale = 1.25): Humanoid {
  const group = new THREE.Group()
  const root = new THREE.Group()
  group.add(root)
  const spin = new THREE.Group()
  spin.position.y = 0.62
  const spinInner = new THREE.Group()
  spinInner.position.y = -0.62
  spin.add(spinInner)
  root.add(spin)

  const materials: THREE.MeshLambertMaterial[] = []
  const extras: THREE.Material[] = []
  const mat = (t: THREE.CanvasTexture) => {
    const m = new THREE.MeshLambertMaterial({ map: t })
    materials.push(m)
    return m
  }
  const solid = (c: number) => {
    const m = new THREE.MeshLambertMaterial({ color: c })
    materials.push(m)
    return m
  }
  const glow = (c: number) => {
    const m = new THREE.MeshBasicMaterial({ color: c })
    extras.push(m)
    return m
  }

  const granite = mat(graniteTex(171, [128, 134, 146]))
  const graniteDark = mat(graniteTex(172, [88, 94, 106]))
  const granitePale = mat(graniteTex(173, [168, 172, 180])) // rain-washed edges
  const moss = mat(graniteTex(174, [86, 102, 78])) // centuries of green neglect
  const worn = solid(0xb9bec8)
  const dark = solid(0x2c2f38)
  const ember = glow(0xff7a1e)
  const emberDeep = glow(0xd94f12)
  const emberHeart = glow(0xffb03a)

  const mk = (parent: THREE.Object3D, w: number, h: number, d: number, m: THREE.Material | THREE.Material[], x: number, y: number, z: number) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m)
    mesh.position.set(x, y, z)
    mesh.castShadow = true
    parent.add(mesh)
    return mesh
  }

  /* ---------- torso: the hunched keel ---------- */
  const torso = mk(spinInner, 0.6, 0.46, 0.74, granite, 0, 0.78, 0.16)
  mk(spinInner, 0.52, 0.28, 0.44, graniteDark, 0, 0.96, 0.02) // shoulder hump
  for (const sx of [-1, 1] as const) {
    mk(spinInner, 0.26, 0.42, 0.54, granite, sx * 0.21, 0.74, -0.28) // haunches, high like a ready spring
    // haunch plate seams
    mk(spinInner, 0.28, 0.05, 0.1, worn, sx * 0.21, 0.9, -0.36)
    // moss where the rain never dries — shoulders and haunch crowns
    mk(spinInner, 0.2, 0.04, 0.24, moss, sx * 0.18, 1.0, 0.04)
    mk(spinInner, 0.19, 0.04, 0.3, moss, sx * 0.22, 0.93, -0.44)
  }
  // the breast keel — a carven breastplate with the rain-gutter channel
  mk(spinInner, 0.34, 0.34, 0.1, granitePale, 0, 0.76, 0.52)
  mk(spinInner, 0.1, 0.3, 0.06, graniteDark, 0, 0.74, 0.575) // the channel
  mk(spinInner, 0.04, 0.24, 0.03, emberDeep, 0, 0.72, 0.59) // fire waiting in the spout
  // belly plates — three weathered bands under the keel
  for (let i = 0; i < 3; i++) mk(spinInner, 0.4 - i * 0.05, 0.05, 0.06, graniteDark, 0, 0.56 - i * 0.055, 0.42 + i * 0.005)
  // spine ridge — five chiselled fins, tallest at the shoulders
  for (let i = 0; i < 5; i++)
    mk(spinInner, 0.06, 0.13 - Math.abs(i - 1) * 0.02, 0.09, graniteDark, 0, 1.05 - Math.abs(i - 1) * 0.015, 0.0 - i * 0.17)
  // chest rain-grooves — the waterspout heritage
  for (const gz of [0.3, 0.42]) mk(spinInner, 0.34, 0.03, 0.03, graniteDark, 0, 0.68, gz)
  // the smoldering seams — old gods' fire packed in the cracks
  const cracks: THREE.Mesh[] = [
    mk(spinInner, 0.03, 0.3, 0.02, emberDeep, 0.16, 0.76, 0.54),
    mk(spinInner, 0.03, 0.22, 0.02, emberDeep, -0.19, 0.72, -0.52),
    mk(spinInner, 0.2, 0.03, 0.02, ember, 0.12, 0.62, 0.3),
    mk(spinInner, 0.03, 0.16, 0.02, emberDeep, -0.24, 0.86, 0.1),
  ]
  cracks.push(mk(spinInner, 0.24, 0.03, 0.02, ember, 0, 0.56, -0.34))

  /* ---------- head: ram-crowned skull ---------- */
  const neck = new THREE.Group()
  neck.position.set(0, 0.92, 0.42)
  spinInner.add(neck)
  mk(neck, 0.3, 0.2, 0.26, graniteDark, 0, 0.04, 0.02) // the short stone neck
  const headG = new THREE.Group()
  headG.position.set(0, 0.16, 0.08)
  neck.add(headG)
  mk(headG, 0.42, 0.32, 0.4, granite, 0, 0.12, 0.04) // skull
  mk(headG, 0.26, 0.18, 0.3, graniteDark, 0, 0.04, 0.34) // muzzle
  mk(headG, 0.1, 0.06, 0.12, graniteDark, 0, 0.2, 0.42).rotation.x = 0.35 // the nose hook
  // the skull crest — a carved fan between the horn roots
  mk(headG, 0.08, 0.16, 0.26, granitePale, 0, 0.34, -0.04)
  mk(headG, 0.05, 0.1, 0.16, granitePale, 0, 0.44, -0.1).rotation.x = -0.3
  // brow shelf — carves the stare into shadow
  for (const sx of [-1, 1] as const) {
    mk(headG, 0.16, 0.07, 0.16, worn, sx * 0.11, 0.26, 0.18)
    // cheek guards under the eyes + nostrils drilled in the snout
    mk(headG, 0.05, 0.12, 0.14, granitePale, sx * 0.21, 0.08, 0.18)
    mk(headG, 0.035, 0.035, 0.03, dark, sx * 0.07, 0.07, 0.48)
  }
  /* ONE ember slit per side — dark sockets until it wakes */
  const eyes: THREE.Mesh[] = []
  for (const sx of [-1, 1] as const) {
    mk(headG, 0.05, 0.1, 0.12, dark, sx * 0.18, 0.18, 0.2) // socket recess
    const e = mk(headG, 0.04, 0.05, 0.09, ember, sx * 0.2, 0.18, 0.21)
    eyes.push(e)
  }
  // ram horns — three curling segments each side, worn smooth
  for (const sx of [-1, 1] as const) {
    const h1 = mk(headG, 0.09, 0.09, 0.24, worn, sx * 0.2, 0.34, -0.02)
    h1.rotation.y = -sx * 0.5
    const h2 = mk(headG, 0.08, 0.08, 0.2, worn, sx * 0.31, 0.3, -0.14)
    h2.rotation.y = -sx * 0.9
    h2.rotation.x = -0.35
    const h3 = mk(headG, 0.06, 0.06, 0.16, worn, sx * 0.33, 0.2, -0.26)
    h3.rotation.y = -sx * 1.15
    h3.rotation.x = -0.6
  }
  // torn ear fins
  for (const sx of [-1, 1] as const) mk(headG, 0.04, 0.14, 0.1, graniteDark, sx * 0.23, 0.24, -0.1).rotation.z = -sx * 0.3
  // the jaw — a working spout-gate with two fangs under it
  const jaw = new THREE.Group()
  jaw.position.set(0, 0.0, 0.16)
  headG.add(jaw)
  mk(jaw, 0.22, 0.07, 0.36, graniteDark, 0, -0.03, 0.16)
  for (const fx of [-0.07, 0.07]) mk(jaw, 0.035, 0.08, 0.035, worn, fx, 0.03, 0.3)
  mk(jaw, 0.06, 0.05, 0.06, worn, 0, -0.02, -0.02).rotation.x = 0.4 // the chin spike
  // upper fangs flanking the muzzle + the forge-glow deep in the mouth
  for (const fx of [-0.09, 0.09]) mk(headG, 0.03, 0.09, 0.03, worn, fx, -0.02, 0.4)
  const throat = mk(headG, 0.12, 0.07, 0.14, emberHeart, 0, 0.02, 0.2)
  throat.visible = true

  /* ---------- forelimbs: the knuckle-walkers ---------- */
  const armL = new THREE.Group()
  const armR = new THREE.Group()
  armL.position.set(0.3, 0.9, 0.22)
  armR.position.set(-0.3, 0.9, 0.22)
  spinInner.add(armL, armR)
  const arms: [THREE.Group, THREE.Group] = [armL, armR]
  for (const [i, arm] of arms.entries()) {
    const sx = i === 0 ? 1 : -1
    arm.rotation.x = 0.42
    mk(arm, 0.15, 0.32, 0.17, granite, 0, -0.16, 0.02) // upper arm
    mk(arm, 0.05, 0.1, 0.12, worn, sx * 0.09, -0.26, 0.02) // the elbow spike
    const fore = new THREE.Group()
    fore.position.set(0, -0.32, 0.02)
    fore.rotation.x = -0.62
    arm.add(fore)
    mk(fore, 0.12, 0.3, 0.13, graniteDark, 0, -0.14, 0) // forearm
    const fist = mk(fore, 0.15, 0.1, 0.16, graniteDark, 0, -0.31, 0.03)
    fist.rotation.x = 0.5
    mk(fore, 0.16, 0.03, 0.1, granitePale, 0, -0.26, 0.05) // the knuckle ridge
    for (const cz of [0.05, -0.03, -0.11]) {
      const claw = mk(fore, 0.04, 0.04, 0.13, dark, sx * 0.015, -0.34, cz + 0.08)
      claw.rotation.x = -0.5
    }
  }

  /* ---------- hind legs: the springs ---------- */
  const legL = new THREE.Group()
  const legR = new THREE.Group()
  legL.position.set(0.21, 0.66, -0.3)
  legR.position.set(-0.21, 0.66, -0.3)
  spinInner.add(legL, legR)
  const legs: [THREE.Group, THREE.Group] = [legL, legR]
  for (const leg of legs) {
    leg.rotation.x = -0.5 // thigh folded forward under the haunch
    mk(leg, 0.18, 0.3, 0.2, granite, 0, -0.16, 0)
    mk(leg, 0.06, 0.08, 0.12, granitePale, 0, -0.27, 0.08) // the knee cap
    const shin = new THREE.Group()
    shin.position.set(0, -0.28, 0)
    shin.rotation.x = 1.05 // shin sweeps back-down, digitigrade
    leg.add(shin)
    mk(shin, 0.11, 0.26, 0.11, graniteDark, 0, -0.12, 0)
    const foot = mk(shin, 0.15, 0.09, 0.2, graniteDark, 0, -0.28, 0.03)
    foot.rotation.x = -0.55 // sole flat on the stone
    mk(shin, 0.04, 0.05, 0.07, worn, 0, -0.2, -0.07) // the ankle spur
    for (const tz of [0.06, -0.02, -0.1]) mk(shin, 0.035, 0.035, 0.09, dark, 0, -0.3, tz + 0.13)
  }

  /* ---------- wings: roof-blades that remember flight ---------- */
  const wingL: [THREE.Group, THREE.Group, THREE.Group] = [new THREE.Group(), new THREE.Group(), new THREE.Group()]
  const wingR: [THREE.Group, THREE.Group, THREE.Group] = [new THREE.Group(), new THREE.Group(), new THREE.Group()]
  const wingRootL = new THREE.Group()
  const wingRootR = new THREE.Group()
  wingRootL.position.set(0.32, 1.0, -0.1)
  wingRootR.position.set(-0.32, 1.0, -0.1)
  spinInner.add(wingRootL, wingRootR)
  const wingPairs: [THREE.Group, [THREE.Group, THREE.Group, THREE.Group], number][] = [
    [wingRootL, wingL, 1],
    [wingRootR, wingR, -1],
  ]
  for (const [wRoot, seg, sx] of wingPairs) {
    const [arm, mid, tip] = seg
    wRoot.add(arm)
    arm.position.set(sx * 0.06, 0, 0)
    // the shoulder pauldron — a carved shield over the wing root
    mk(wRoot, 0.2, 0.16, 0.26, granitePale, sx * 0.02, 0.08, 0.04)
    // wing arm bone + leading plate
    mk(arm, 0.46, 0.09, 0.2, graniteDark, sx * 0.24, 0, -0.02)
    mk(arm, 0.42, 0.03, 0.06, worn, sx * 0.24, 0.05, -0.09)
    const midG = mid
    midG.position.set(sx * 0.47, 0, 0)
    arm.add(midG)
    mk(midG, 0.5, 0.07, 0.16, graniteDark, sx * 0.26, 0, 0)
    mk(midG, 0.44, 0.02, 0.05, worn, sx * 0.26, 0.04, -0.07)
    // membrane — thin stone cloth under the bone, ribbed like a fan
    mk(midG, 0.4, 0.015, 0.3, granite, sx * 0.24, -0.03, 0.12)
    for (const rz of [0.02, 0.12, 0.22]) mk(midG, 0.36, 0.02, 0.025, graniteDark, sx * 0.24, -0.02, rz)
    const tipG = tip
    tipG.position.set(sx * 0.5, 0, 0)
    midG.add(tipG)
    mk(tipG, 0.34, 0.06, 0.12, graniteDark, sx * 0.17, 0, 0)
    mk(tipG, 0.26, 0.015, 0.22, granite, sx * 0.14, -0.02, 0.08)
    mk(tipG, 0.2, 0.02, 0.02, graniteDark, sx * 0.13, -0.015, 0.19) // the scallop notch
    // the thumb claw at the wrist + the single great claw
    mk(tipG, 0.045, 0.045, 0.1, dark, sx * 0.05, 0.03, -0.05).rotation.x = -0.4
    const claw = mk(tipG, 0.05, 0.05, 0.14, dark, sx * 0.32, -0.01, -0.04)
    claw.rotation.x = -0.7
  }

  /* ---------- tail: two bones, twin barbs, a spade ---------- */
  const tail = new THREE.Group()
  tail.position.set(0, 0.82, -0.52)
  tail.rotation.x = 0.12
  spinInner.add(tail)
  mk(tail, 0.11, 0.11, 0.4, graniteDark, 0, 0, -0.18)
  mk(tail, 0.03, 0.05, 0.3, granitePale, 0, -0.07, -0.2) // the underside ridge
  const tailMid = new THREE.Group()
  tailMid.position.set(0, 0, -0.36)
  tail.add(tailMid)
  mk(tailMid, 0.08, 0.08, 0.26, graniteDark, 0, 0, -0.12)
  for (const sxb of [-1, 1] as const) {
    const barb = mk(tailMid, 0.1, 0.03, 0.1, worn, sxb * 0.07, 0.01, -0.2)
    barb.rotation.y = sxb * 0.5
    barb.rotation.x = 0.2
  }
  const spade = mk(tailMid, 0.15, 0.035, 0.16, worn, 0, 0, -0.32)
  spade.rotation.x = 0.25
  mk(tailMid, 0.04, 0.03, 0.05, emberDeep, 0, 0.01, -0.4) // a coal at the very tip

  group.scale.setScalar(scale)

  const rig: GargoyleRig = {
    neck,
    headG,
    jaw,
    eyes,
    cracks,
    throat,
    wingL,
    wingR,
    arms,
    legs,
    tail,
  }
  group.userData.gargoyle = rig

  const headMesh = headG.children[0] as THREE.Mesh
  return {
    group,
    root,
    spin,
    head: headMesh,
    body: torso,
    armL,
    armR,
    legL,
    legR,
    legsBack: null,
    materials,
    extras,
    sword: null,
  }
}

/* ---------------- gargoyle pose + animations ---------------- */

function resetGargoyle(h: Humanoid) {
  const r = h.group.userData.gargoyle as GargoyleRig
  h.root.rotation.set(0, 0, 0)
  h.root.position.set(0, 0, 0)
  h.spin.rotation.set(0, 0, 0)
  r.neck.rotation.set(0, 0, 0)
  r.headG.rotation.set(0, 0, 0)
  r.jaw.rotation.set(0, 0, 0)
  r.tail.rotation.set(0, 0, 0)
  for (const arm of r.arms) arm.rotation.set(0.42, 0, 0)
  for (const leg of r.legs) leg.rotation.set(-0.5, 0, 0)
  // folded wings — swept back over the flanks like roof blades
  for (const [seg, sx] of [[r.wingL, 1], [r.wingR, -1]] as const) {
    const [arm, mid, tip] = seg
    arm.rotation.set(0, sx * 1.05, sx * 0.5)
    mid.rotation.set(0, sx * 1.35, 0)
    tip.rotation.set(0, sx * 0.9, 0)
  }
  return r
}

/** the statue — the stone sleeps, the fire inside waits. Eyes dark. */
export function animGargoyleDormant(h: Humanoid) {
  const r = resetGargoyle(h)
  r.headG.rotation.x = 0.42 // chin sunk to the chest
  r.jaw.rotation.x = 0.05 // mouth sealed
  for (const e of r.eyes) e.visible = false
  for (const c of r.cracks) c.visible = false
  r.throat.visible = false // even the mouth-fire sleeps
}

/** awake on its perch — breathing stone, hunting stare, wing shiver */
export function animGargoylePerch(h: Humanoid, t: number) {
  const r = resetGargoyle(h)
  const b = Math.sin(t * 1.9)
  for (const e of r.eyes) e.visible = true
  for (const c of r.cracks) c.visible = true
  r.throat.visible = true
  r.throat.scale.setScalar(1 + Math.sin(t * 2.6) * 0.18) // the forge breathes
  h.root.position.y = b * 0.012
  r.headG.rotation.y = Math.sin(t * 0.55) * 0.5
  r.headG.rotation.x = 0.08 + Math.sin(t * 0.9) * 0.05
  r.jaw.rotation.x = 0.06 + Math.max(0, Math.sin(t * 0.23)) * 0.12 // the slow creak
  // the shiver — folded wings can't hold still anymore
  const q = Math.sin(t * 7.3) * 0.025
  r.wingL[0].rotation.z = 0.5 + q
  r.wingR[0].rotation.z = -0.5 - q
  r.tail.rotation.x = 0.1 + Math.sin(t * 1.4) * 0.12
  r.tail.rotation.y = Math.sin(t * 0.7) * 0.18
}

/** the wake-up — head snaps up, wings SNAG open, the fire finds its eyes */
export function animGargoyleUnfurl(h: Humanoid, p: number) {
  const r = resetGargoyle(h)
  for (const e of r.eyes) e.visible = p > 0.18
  for (const c of r.cracks) c.visible = p > 0.3
  r.throat.visible = p > 0.3
  if (p < 0.3) {
    // the stone inhales
    const q = p / 0.3
    r.headG.rotation.x = lerpN(0.42, -0.3, q)
    h.root.position.y = -0.02 * (1 - q)
    r.jaw.rotation.x = lerpN(0.05, 0.3, q)
  } else if (p < 0.62) {
    // the wings snag open with an overshoot, arms brace the launch
    const q = ease((p - 0.3) / 0.32)
    const over = 1 + Math.sin(q * Math.PI) * 0.22
    r.headG.rotation.x = -0.3
    r.jaw.rotation.x = 0.55 * over // the roar-gape
    for (const [seg, sx] of [[r.wingL, 1], [r.wingR, -1]] as const) {
      seg[0].rotation.set(0, sx * lerpN(1.05, -0.1, q), sx * lerpN(0.5, -0.35, q) * over)
      seg[1].rotation.set(0, sx * lerpN(1.35, -0.15, q), 0)
      seg[2].rotation.set(0, sx * lerpN(0.9, -0.1, q), 0)
    }
    h.root.position.y = 0.05 * q
  } else {
    // settle into the combat hunch
    const q = (p - 0.62) / 0.38
    r.headG.rotation.x = lerpN(-0.3, 0.05, q)
    r.jaw.rotation.x = lerpN(0.55, 0.14, q)
    for (const [seg, sx] of [[r.wingL, 1], [r.wingR, -1]] as const) {
      seg[0].rotation.set(0, sx * lerpN(-0.1, 0.45, q), sx * lerpN(-0.35, 0.25, q))
      seg[1].rotation.set(0, sx * lerpN(-0.15, 0.55, q), 0)
      seg[2].rotation.set(0, sx * lerpN(-0.1, 0.35, q), 0)
    }
    h.root.position.y = 0.05 * (1 - q)
  }
}

/** the skitter — a low crab-run, wings half-spread for balance */
export function animGargoyleRun(h: Humanoid, t: number) {
  const r = resetGargoyle(h)
  const f = t * 10.5
  const s = Math.sin(f)
  const c = Math.cos(f)
  // combat stance wings — open but angled down
  r.wingL[0].rotation.set(0, 0.45, 0.25 + s * 0.06)
  r.wingR[0].rotation.set(0, -0.45, -0.25 - s * 0.06)
  r.wingL[1].rotation.y = 0.55
  r.wingR[1].rotation.y = -0.55
  r.wingL[2].rotation.y = 0.4
  r.wingR[2].rotation.y = -0.4
  // diagonal-pair skitter
  r.arms[0].rotation.x = 0.42 + s * 0.5
  r.legs[1].rotation.x = -0.5 + s * 0.45
  r.arms[1].rotation.x = 0.42 - s * 0.5
  r.legs[0].rotation.x = -0.5 - s * 0.45
  h.root.position.y = Math.abs(c) * 0.035
  h.root.rotation.z = Math.sin(f * 0.5) * 0.07 // the low sway
  r.headG.rotation.x = -0.12
  r.headG.rotation.y = Math.sin(t * 0.8) * 0.14
  r.jaw.rotation.x = 0.2
  r.tail.rotation.y = Math.sin(f * 0.5 + 1) * 0.3
  r.tail.rotation.x = -0.05
}

/** the pounce — rear up, explode forward, claws first, jaw wide */
export function animGargoyleLunge(h: Humanoid, p: number) {
  const r = resetGargoyle(h)
  for (const e of r.eyes) e.visible = true
  for (const c of r.cracks) c.visible = true
  r.throat.visible = true
  r.throat.scale.setScalar(1 + Math.max(0, Math.sin(p * Math.PI * 2)) * 0.5) // the roar's breath
  if (p < 0.34) {
    // coil — weight back, wings rising
    const q = ease(p / 0.34)
    h.root.rotation.x = -0.28 * q
    h.root.position.y = -0.04 * q
    r.arms[0].rotation.x = lerpN(0.42, 0.9, q)
    r.arms[1].rotation.x = lerpN(0.42, 0.9, q)
    r.headG.rotation.x = lerpN(0, -0.4, q)
    r.jaw.rotation.x = 0.1
    r.wingL[0].rotation.set(0, 0.2, 0.6 * q)
    r.wingR[0].rotation.set(0, -0.2, -0.6 * q)
  } else if (p < 0.72) {
    // the burst — body flat, claws reach, wings slam down
    const q = ease((p - 0.34) / 0.38)
    h.root.rotation.x = lerpN(-0.28, 0.22, q)
    h.root.position.y = Math.sin(q * Math.PI) * 0.16 // the hop
    r.arms[0].rotation.x = lerpN(0.9, -0.7, q)
    r.arms[1].rotation.x = lerpN(0.9, -0.7, q)
    r.legs[0].rotation.x = lerpN(-0.5, -1.15, q)
    r.legs[1].rotation.x = lerpN(-0.5, -1.15, q)
    r.headG.rotation.x = lerpN(-0.4, 0.3, q)
    r.jaw.rotation.x = 0.75 // the snap
    r.wingL[0].rotation.set(0, 0.3, lerpN(0.6, -0.5, q))
    r.wingR[0].rotation.set(0, -0.3, -lerpN(0.6, -0.5, q))
    r.wingL[1].rotation.y = lerpN(0.2, 0.8, q)
    r.wingR[1].rotation.y = -lerpN(0.2, 0.8, q)
  } else {
    // the landing — claws drag stone, jaw grinds shut
    const q = (p - 0.72) / 0.28
    h.root.rotation.x = lerpN(0.22, 0, q)
    r.arms[0].rotation.x = lerpN(-0.7, 0.42, q)
    r.arms[1].rotation.x = lerpN(-0.7, 0.42, q)
    r.legs[0].rotation.x = lerpN(-1.15, -0.5, q)
    r.legs[1].rotation.x = lerpN(-1.15, -0.5, q)
    r.jaw.rotation.x = lerpN(0.75, 0.12, q)
    r.wingL[0].rotation.set(0, 0.45, lerpN(-0.5, 0.25, q))
    r.wingR[0].rotation.set(0, -0.45, -lerpN(-0.5, 0.25, q))
  }
}

/** the crumble — the watch ends, the stone kneels, the fire goes out */
export function animGargoyleDead(h: Humanoid, p: number) {
  const r = resetGargoyle(h)
  const q = ease(clamp01(p / 0.7))
  h.root.rotation.x = 0.5 * q // face-plants forward onto its arms
  h.root.position.y = -0.34 * q
  r.headG.rotation.x = lerpN(0, 0.55, q)
  r.jaw.rotation.x = lerpN(0.1, 0.5, q) // the last gape
  for (const [seg, sx] of [[r.wingL, 1], [r.wingR, -1]] as const) {
    seg[0].rotation.set(0, sx * 1.05, sx * lerpN(0.5, 0.05, q)) // wings sag flat
    seg[1].rotation.y = sx * lerpN(1.35, 0.4, q)
  }
  r.arms[0].rotation.x = lerpN(0.42, 0.2, q)
  r.arms[1].rotation.x = lerpN(0.42, 0.2, q)
  r.legs[0].rotation.x = lerpN(-0.5, -1.0, q)
  r.legs[1].rotation.x = lerpN(-0.5, -1.0, q)
  r.tail.rotation.x = lerpN(0, 0.4, q)
  // the smolder dies at the half — the castle truly loses a lamp
  const embersOn = p < 0.55
  for (const e of r.eyes) e.visible = embersOn
  for (const c of r.cracks) c.visible = p < 0.75
  r.throat.visible = p < 0.5
  if (p >= 0.75) return
}

/* ==================================================================
   2) THE REQUIEM CANTOR — «مرثیه‌خوانِ مانولث»
   ==================================================================
   It sang the evening office when the gods still slept here. The
   congregation left; the song didn't. It drifts the nave with its
   censer spinning, and where the censer passes, the candles of its
   halo lean in to listen. Its bolt is not fire — it is the last
   note of a requiem, and it does not miss. */

export interface CantorRig {
  headG: THREE.Group
  hem: THREE.Group[] // the three tattered robe strips
  mantle: THREE.Group // the shoulder cape that leans with the song
  censerSwing: THREE.Group // the pendulum pivot at the hands
  censerCore: THREE.Mesh // the ember in the cage
  halo: THREE.Group // five orbiting candles
  flames: THREE.Mesh[] // all glow flames (for the gutter-out)
  hands: THREE.Group
  beads: THREE.Group // the prayer strand hanging from the wrists
}

export function createCantor(scale = 1.0): Humanoid {
  const group = new THREE.Group()
  const root = new THREE.Group()
  group.add(root)
  const spin = new THREE.Group()
  spin.position.y = 0.9
  const spinInner = new THREE.Group()
  spinInner.position.y = -0.9
  spin.add(spinInner)
  root.add(spin)

  const materials: THREE.MeshLambertMaterial[] = []
  const extras: THREE.Material[] = []
  const mat = (t: THREE.CanvasTexture) => {
    const m = new THREE.MeshLambertMaterial({ map: t })
    materials.push(m)
    return m
  }
  const solid = (c: number) => {
    const m = new THREE.MeshLambertMaterial({ color: c })
    materials.push(m)
    return m
  }
  const glow = (c: number) => {
    const m = new THREE.MeshBasicMaterial({ color: c })
    extras.push(m)
    return m
  }

  const vestment = mat(robeTex(181, [110, 36, 50])) // faded crimson
  const vestmentDark = mat(robeTex(182, [74, 22, 34]))
  const under = mat(robeTex(183, [58, 62, 76])) // moon-lit grey-blue
  const pale = solid(0xc9c2ac)
  const gold = solid(0xceb26e)
  const voidM = solid(0x0d0a10)
  const ironM = solid(0x4a4a52)
  const flame = glow(0xffd23d)
  const emberCore = glow(0xff7a1e)

  const mk = (parent: THREE.Object3D, w: number, h: number, d: number, m: THREE.Material | THREE.Material[], x: number, y: number, z: number) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m)
    mesh.position.set(x, y, z)
    mesh.castShadow = true
    parent.add(mesh)
    return mesh
  }

  /* ---------- the vestments: three tiers of song-draped cloth ---------- */
  const torso = mk(spinInner, 0.52, 0.5, 0.38, vestment, 0, 1.06, 0)
  mk(spinInner, 0.62, 0.52, 0.46, vestmentDark, 0, 0.6, 0)
  // the stole — two pale bands down the front, gold at the tips
  for (const sx of [-1, 1] as const) {
    mk(spinInner, 0.09, 0.52, 0.04, pale, sx * 0.11, 1.0, 0.2)
    mk(spinInner, 0.1, 0.08, 0.05, gold, sx * 0.11, 0.72, 0.2)
    // the back stole — a wide drape falling from each shoulder blade
    mk(spinInner, 0.11, 0.44, 0.04, vestmentDark, sx * 0.13, 1.0, -0.21)
    mk(spinInner, 0.12, 0.07, 0.05, gold, sx * 0.13, 0.76, -0.215)
  }
  // the inner robe — the pale V that shows at the chest
  mk(spinInner, 0.16, 0.34, 0.04, under, 0, 1.14, 0.195)
  mk(spinInner, 0.05, 0.05, 0.05, gold, 0, 1.28, 0.21) // the clasp
  // the collar ring + shoulder rolls
  mk(spinInner, 0.44, 0.1, 0.32, vestmentDark, 0, 1.33, 0)
  for (const sx of [-1, 1] as const) mk(spinInner, 0.16, 0.14, 0.24, vestment, sx * 0.3, 1.26, 0)
  // the mantle — a shoulder cape of hanging cloth strips that sway with the verse
  const mantle = new THREE.Group()
  mantle.position.set(0, 1.3, 0)
  spinInner.add(mantle)
  for (const [mx, mz, len] of [
    [-0.2, 0.05, 0.34], [-0.1, -0.14, 0.3], [0.0, 0.16, 0.38], [0.1, -0.14, 0.3], [0.2, 0.05, 0.34],
  ] as const) {
    const strip = new THREE.Group()
    strip.position.set(mx, 0, mz)
    mantle.add(strip)
    mk(strip, 0.1, len, 0.05, vestmentDark, 0, -len / 2, 0)
    mk(strip, 0.11, 0.04, 0.06, gold, 0, -len + 0.02, 0) // the gilded tip
  }
  // the cincture — a rope belt with two hanging cords
  mk(spinInner, 0.5, 0.06, 0.42, pale, 0, 0.86, 0)
  for (const sx of [-1, 1] as const) {
    mk(spinInner, 0.045, 0.24, 0.045, pale, sx * 0.14, 0.72, 0.18)
    mk(spinInner, 0.05, 0.04, 0.05, gold, sx * 0.14, 0.59, 0.18) // the cord's metal end
  }

  /* ---------- the hem: three tattered strips, each with its own sway ---------- */
  const hem: THREE.Group[] = []
  for (const [hx, len] of [[-0.18, 0.42], [0.0, 0.5], [0.18, 0.36]] as const) {
    const strip = new THREE.Group()
    strip.position.set(hx, 0.38, 0)
    spinInner.add(strip)
    mk(strip, 0.17, len, 0.4, under, 0, -len / 2, 0)
    mk(strip, 0.18, 0.05, 0.42, voidM, 0, -len + 0.02, 0) // the frayed edge
    hem.push(strip)
  }

  /* ---------- the hood and the void inside ---------- */
  const headG = new THREE.Group()
  headG.position.set(0, 1.44, 0.02)
  spinInner.add(headG)
  mk(headG, 0.42, 0.4, 0.42, vestmentDark, 0, 0.14, 0)
  const point = mk(headG, 0.2, 0.26, 0.1, vestmentDark, 0, 0.42, -0.08)
  point.rotation.x = -0.45 // the hood's peak leans back like a flame
  // the gold circlet — the last mark of the office, stitched on the brow
  mk(headG, 0.44, 0.05, 0.44, gold, 0, 0.3, 0)
  // hood side flaps — cloth that never learned to stop falling
  for (const sx of [-1, 1] as const) {
    const flap = mk(headG, 0.06, 0.2, 0.16, vestmentDark, sx * 0.22, 0.04, -0.04)
    flap.rotation.z = sx * 0.14
  }
  mk(headG, 0.3, 0.26, 0.05, voidM, 0, 0.12, 0.21) // the face — no face at all
  const flames: THREE.Mesh[] = []
  for (const sx of [-1, 1] as const) {
    // candle-flame eyes: a flame above a wick of nothing
    const f = mk(headG, 0.055, 0.11, 0.04, flame, sx * 0.08, 0.14, 0.235)
    f.rotation.z = -sx * 0.08
    flames.push(f)
  }

  /* ---------- the folded hands + the prayer strand ---------- */
  const hands = new THREE.Group()
  hands.position.set(0, 1.0, 0.22)
  spinInner.add(hands)
  mk(hands, 0.09, 0.2, 0.06, pale, -0.05, 0, 0).rotation.z = 0.35
  mk(hands, 0.09, 0.2, 0.06, pale, 0.05, -0.02, 0).rotation.z = -0.35
  // the beads — a loop of dark prayer beads between the wrists
  const beads = new THREE.Group()
  beads.position.set(0, -0.1, 0.02)
  hands.add(beads)
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2
    mk(beads, 0.035, 0.035, 0.035, voidM, Math.cos(a) * 0.085, Math.sin(a) * 0.1 - 0.04, 0.03)
  }
  mk(beads, 0.045, 0.045, 0.045, gold, 0, -0.15, 0.03) // the gold guru bead

  /* ---------- the censer: three chains, a domed cage, an ember ---------- */
  const censerSwing = new THREE.Group()
  censerSwing.position.set(0.1, 0.94, 0.26) // hangs from the right hand
  spinInner.add(censerSwing)
  for (let i = 0; i < 3; i++) mk(censerSwing, 0.03, 0.08, 0.03, ironM, 0, -0.08 - i * 0.08, 0)
  const cage = new THREE.Group()
  cage.position.set(0, -0.4, 0)
  censerSwing.add(cage)
  mk(cage, 0.05, 0.05, 0.05, ironM, 0, 0.08, 0) // the ring
  for (const [cx2, cz2] of [[-0.08, -0.08], [0.08, -0.08], [-0.08, 0.08], [0.08, 0.08]] as const)
    mk(cage, 0.025, 0.16, 0.025, ironM, cx2, 0, cz2)
  mk(cage, 0.2, 0.05, 0.2, ironM, 0, -0.09, 0) // the bowl
  mk(cage, 0.13, 0.045, 0.13, ironM, 0, 0.1, 0) // the dome lid
  mk(cage, 0.04, 0.06, 0.04, ironM, 0, 0.15, 0) // the lid's cross finial
  for (const sxc of [-1, 1] as const) mk(cage, 0.02, 0.12, 0.02, ironM, sxc * 0.11, 0.02, 0) // side chains
  const core = mk(cage, 0.11, 0.08, 0.11, emberCore, 0, -0.02, 0)
  flames.push(core)

  /* ---------- the halo: five candles that lean in to listen ---------- */
  const halo = new THREE.Group()
  halo.position.set(0, 1.62, -0.1)
  spinInner.add(halo)
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2
    const high = i % 2 === 1 // two ride higher, held by invisible hands
    const candle = new THREE.Group()
    candle.position.set(Math.cos(a) * 0.4, Math.sin(a * 2) * 0.05 + (high ? 0.14 : 0), Math.sin(a) * 0.22)
    halo.add(candle)
    mk(candle, 0.06, high ? 0.1 : 0.13, 0.06, pale, 0, 0, 0)
    mk(candle, 0.07, 0.02, 0.07, gold, 0, high ? 0.055 : 0.07, 0) // the wax drip ring
    const fl = mk(candle, 0.04, 0.08, 0.04, flame, 0, 0.1, 0)
    flames.push(fl)
  }

  /* the Humanoid contract — the cantor has no limbs to speak of */
  const armL = new THREE.Group()
  const armR = new THREE.Group()
  const legL = new THREE.Group()
  const legR = new THREE.Group()
  spinInner.add(armL, armR, legL, legR)
  for (const stub of [armL, armR, legL, legR]) stub.visible = false

  group.scale.setScalar(scale)

  const rig: CantorRig = { headG, hem, mantle, censerSwing, censerCore: core, halo, flames, hands, beads }
  group.userData.cantor = rig

  return {
    group,
    root,
    spin,
    head: headG.children[0] as THREE.Mesh,
    body: torso,
    armL,
    armR,
    legL,
    legR,
    legsBack: null,
    materials,
    extras,
    sword: null,
  }
}

/* ---------------- cantor pose + animations ---------------- */

function resetCantor(h: Humanoid) {
  const r = h.group.userData.cantor as CantorRig
  h.root.rotation.set(0, 0, 0)
  h.root.position.set(0, 0, 0)
  h.spin.rotation.set(0, 0, 0)
  r.headG.rotation.set(0, 0, 0)
  r.hands.rotation.set(0, 0, 0)
  r.hands.position.set(0, 1.0, 0.22)
  r.censerSwing.rotation.set(0, 0, 0)
  for (const strip of r.hem) strip.rotation.set(0, 0, 0)
  for (const strip of r.mantle.children) strip.rotation.set(0, 0, 0)
  r.beads.rotation.set(0, 0, 0)
  return r
}

/** the drift — the office never ended, the verse repeats */
export function animCantorFloat(h: Humanoid, t: number) {
  const r = resetCantor(h)
  h.root.position.y = Math.sin(t * 1.7) * 0.07
  h.root.rotation.z = Math.sin(t * 0.9) * 0.03
  r.headG.rotation.y = Math.sin(t * 0.42) * 0.4
  r.headG.rotation.x = 0.06 + Math.sin(t * 0.8) * 0.05
  // the hem strips breathe out of phase — cloth remembering the aisle draft
  for (let i = 0; i < r.hem.length; i++) {
    const ph = t * 1.5 + i * 2.1
    r.hem[i].rotation.x = Math.sin(ph) * 0.16
    r.hem[i].rotation.z = Math.sin(ph * 0.7 + 1) * 0.1
  }
  // the mantle sway — the cape drifts against the body's roll
  for (let i = 0; i < r.mantle.children.length; i++) {
    const strip = r.mantle.children[i]
    const ph = t * 1.2 + i * 1.4
    strip.rotation.x = Math.sin(ph) * 0.12
    strip.rotation.z = Math.sin(ph * 0.6) * 0.09
  }
  // the beads tick around their loop, one prayer at a time
  r.beads.rotation.z = Math.sin(t * 0.9) * 0.16
  r.beads.rotation.x = Math.sin(t * 1.3) * 0.1
  // the censer swings its slow east-and-west arc
  r.censerSwing.rotation.x = Math.sin(t * 1.25) * 0.5
  r.censerSwing.rotation.z = Math.cos(t * 1.25) * 0.22
  // the halo's slow procession
  r.halo.rotation.y = t * 0.55
  for (const f of r.flames) {
    f.visible = true
    f.scale.y = 1 + Math.sin(t * 9 + f.id) * 0.14
  }
}

/** the glide — leaning into its own hymn */
export function animCantorGlide(h: Humanoid, t: number) {
  const r = resetCantor(h)
  h.root.rotation.x = 0.14 // leans forward into the verse
  h.root.position.y = Math.sin(t * 3.1) * 0.05
  r.headG.rotation.x = -0.1
  for (let i = 0; i < r.hem.length; i++) {
    const ph = t * 4.2 + i * 1.9
    r.hem[i].rotation.x = -0.5 + Math.sin(ph) * 0.2 // the strips stream behind
    r.hem[i].rotation.z = Math.sin(ph * 0.8) * 0.08
  }
  // the mantle streams up behind the lean
  for (let i = 0; i < r.mantle.children.length; i++) {
    const strip = r.mantle.children[i]
    strip.rotation.x = -0.55 + Math.sin(t * 3.4 + i * 1.3) * 0.14
  }
  // the beads trail the motion like a pendulum
  r.beads.rotation.x = -0.5 + Math.sin(t * 3.6) * 0.18
  r.censerSwing.rotation.x = 0.9 // the censer held close
  r.censerSwing.rotation.z = Math.sin(t * 3.4) * 0.12
  r.halo.rotation.y = t * 1.1
  for (const f of r.flames) f.scale.y = 1 + Math.sin(t * 11 + f.id) * 0.2
}

/** the chant — head back, hands rise, the censer whirls overhead */
export function animCantorChant(h: Humanoid, p: number) {
  const r = resetCantor(h)
  const rise = clamp01(p / 0.55)
  r.headG.rotation.x = -0.5 * rise // the note goes up
  r.hands.position.y = lerpN(1.0, 1.24, rise)
  r.hands.rotation.x = -0.6 * rise
  r.censerSwing.rotation.x = lerpN(0, -1.9, rise) // swings up over the head
  r.censerSwing.rotation.z = Math.sin(p * 21) * 0.3 * rise // the mad whirling
  r.censerCore.scale.setScalar(1 + rise * (0.5 + Math.sin(p * 40) * 0.2)) // the ember feeds
  h.root.rotation.z = Math.sin(p * 14) * 0.02 * rise
  // the mantle flares out with the rising voice
  for (let i = 0; i < r.mantle.children.length; i++) {
    const strip = r.mantle.children[i]
    strip.rotation.x = -0.7 * rise + Math.sin(p * 15 + i * 2) * 0.08 * rise
  }
  // the beads swing like a censer of their own
  r.beads.rotation.x = -1.2 * rise + Math.sin(p * 18) * 0.2 * rise
  for (let i = 0; i < r.hem.length; i++) {
    r.hem[i].rotation.x = Math.sin(p * 16 + i * 2) * 0.1 - 0.1
  }
  for (const f of r.flames) f.scale.y = 1 + rise * (0.4 + Math.sin(p * 30 + f.id) * 0.2)
}

/** the release — the censer sweeps down, the note leaves the cage */
export function animCantorCast(h: Humanoid, p: number) {
  const r = resetCantor(h)
  if (p < 0.4) {
    const q = ease(p / 0.4)
    r.censerSwing.rotation.x = lerpN(-1.9, 0.85, q)
    r.censerSwing.rotation.z = 0
    r.hands.position.y = lerpN(1.24, 0.98, q)
    r.headG.rotation.x = lerpN(-0.5, 0.25, q)
    h.root.rotation.x = 0.1 * q // the whole body follows the swing
  } else {
    const q = (p - 0.4) / 0.6
    r.censerSwing.rotation.x = lerpN(0.85, 0, q)
    h.root.rotation.x = 0.1 * (1 - q)
    r.headG.rotation.x = lerpN(0.25, 0, q)
    // the hem kicks out with the release of breath
    for (let i = 0; i < r.hem.length; i++) r.hem[i].rotation.x = -0.3 * Math.sin(q * Math.PI) + Math.sin(q * 9 + i * 2) * 0.1 * (1 - q)
  }
  r.censerCore.scale.setScalar(1 + Math.max(0, 0.5 - p) * 1.2)
}

/** the unraveling — the vestments remember they are only cloth */
export function animCantorDead(h: Humanoid, p: number) {
  const r = resetCantor(h)
  const q = ease(clamp01(p / 0.8))
  h.root.rotation.x = -0.35 * q // tips back, the song leaving
  h.root.position.y = -0.5 * q // sinks through its own hem
  r.headG.rotation.x = 0.4 * q // the hood bows
  for (let i = 0; i < r.hem.length; i++) {
    r.hem[i].rotation.x = 0.3 * q
    r.hem[i].rotation.z = (i - 1) * 0.35 * q // the strips fall apart
  }
  // the mantle collapses inward, strip by strip
  for (let i = 0; i < r.mantle.children.length; i++) {
    const strip = r.mantle.children[i]
    strip.rotation.x = 0.5 * q
    strip.rotation.z = (i - 2) * 0.3 * q
  }
  r.beads.rotation.x = 1.1 * q // the strand spills from the slack hands
  r.censerSwing.rotation.x = lerpN(0, 1.5, q) // the censer drops to its side
  // the candles gutter out one by one — the office ends note by note
  for (let i = 0; i < r.flames.length; i++) r.flames[i].visible = p < 0.25 + i * 0.09
}

/* ==================================================================
   3) THE ASH HOUND — «سگِ خاکستر»
   ==================================================================
   When the first forge went cold, its cinders were buried in the
   yard of the castle. They did not stay buried. What stood up had
   the shape of the castle's hunting dogs and the temper of the
   coal that would not cool. They hunt in packs, silent, and where
   they run, the ash they shed still glows. */

export interface HoundRig {
  headG: THREE.Group
  jaw: THREE.Group
  ears: [THREE.Mesh, THREE.Mesh]
  tail: [THREE.Group, THREE.Group, THREE.Group]
  cracks: THREE.Mesh[] // the ember seams between the ribs
  heart: THREE.Mesh // the coal that would not cool, glowing in the chest
  legsF: [THREE.Group, THREE.Group]
  legsB: [THREE.Group, THREE.Group]
  shinFL: THREE.Group[]
  shinBL: THREE.Group[]
}

export function createAshHound(scale = 0.95): Humanoid {
  const group = new THREE.Group()
  const root = new THREE.Group()
  group.add(root)
  const spin = new THREE.Group()
  spin.position.y = 0.6
  const spinInner = new THREE.Group()
  spinInner.position.y = -0.6
  spin.add(spinInner)
  root.add(spin)

  const materials: THREE.MeshLambertMaterial[] = []
  const extras: THREE.Material[] = []
  const mat = (t: THREE.CanvasTexture) => {
    const m = new THREE.MeshLambertMaterial({ map: t })
    materials.push(m)
    return m
  }
  const solid = (c: number) => {
    const m = new THREE.MeshLambertMaterial({ color: c })
    materials.push(m)
    return m
  }
  const glow = (c: number) => {
    const m = new THREE.MeshBasicMaterial({ color: c })
    extras.push(m)
    return m
  }

  const fur = mat(furTex(191, [42, 38, 36]))
  const furDark = mat(furTex(192, [26, 23, 22]))
  const bone = mat(boneTex(193))
  const dark = solid(0x17130f)
  const ember = glow(0xff7a1e)
  const emberEye = glow(0xffb03a)
  const emberHeart = glow(0xffb03a) // the coal's core, brighter than the seams

  const mk = (parent: THREE.Object3D, w: number, h: number, d: number, m: THREE.Material | THREE.Material[], x: number, y: number, z: number) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m)
    mesh.position.set(x, y, z)
    mesh.castShadow = true
    parent.add(mesh)
    return mesh
  }

  /* ---------- the lean runner's body ---------- */
  const torso = mk(spinInner, 0.4, 0.38, 0.52, fur, 0, 0.64, 0.24)
  mk(spinInner, 0.34, 0.3, 0.42, fur, 0, 0.54, -0.06) // the tucked waist
  mk(spinInner, 0.38, 0.4, 0.44, furDark, 0, 0.68, -0.38) // the haunch
  // scapula blades — the shoulders of a sprinter, charred plates over the fur
  for (const sx of [-1, 1] as const) {
    const scap = mk(spinInner, 0.05, 0.22, 0.24, bone, sx * 0.21, 0.72, 0.24)
    scap.rotation.x = 0.15
    mk(spinInner, 0.19, 0.04, 0.22, furDark, sx * 0.19, 0.86, 0.26) // the wither-frost stripe
  }
  // the pelvis — pale blades riding the haunch
  for (const sx of [-1, 1] as const) {
    const pelv = mk(spinInner, 0.05, 0.2, 0.2, bone, sx * 0.19, 0.78, -0.44)
    pelv.rotation.x = -0.2
  }
  // the ribcage the ash burned open — six pale slats over the ember seams
  for (let i = 0; i < 6; i++)
    mk(spinInner, 0.43, 0.035, 0.045, bone, 0, 0.4 + (i % 2) * 0.035, 0.42 - i * 0.105)
  const cracks: THREE.Mesh[] = []
  for (const cz of [0.32, 0.2, 0.06]) cracks.push(mk(spinInner, 0.03, 0.2, 0.03, ember, 0.05, 0.52, cz))
  cracks.push(mk(spinInner, 0.03, 0.16, 0.03, ember, -0.06, 0.5, 0.09))
  cracks.push(mk(spinInner, 0.03, 0.13, 0.03, emberEye, -0.07, 0.56, 0.26))
  // the heart — the first forge's coal, still refusing the dark
  const heart = mk(spinInner, 0.09, 0.09, 0.09, emberHeart, 0, 0.56, 0.18)
  // the spine ridge — five charred spikes
  for (let i = 0; i < 5; i++) mk(spinInner, 0.05, 0.1 - Math.abs(i - 2) * 0.015, 0.07, furDark, 0, 0.85, 0.34 - i * 0.19)

  /* ---------- the wolf skull on a charred neck ---------- */
  const neck = new THREE.Group()
  neck.position.set(0, 0.74, 0.5)
  neck.rotation.x = -0.5 // the low prowling carriage
  spinInner.add(neck)
  mk(neck, 0.2, 0.22, 0.2, furDark, 0, 0.06, 0.02)
  const headG = new THREE.Group()
  headG.position.set(0, 0.18, 0.1)
  neck.add(headG)
  mk(headG, 0.28, 0.26, 0.3, bone, 0, 0.06, 0.02)
  mk(headG, 0.18, 0.14, 0.28, bone, 0, 0.0, 0.26) // the muzzle
  // the skull's architecture — sagittal crest, brow bar, cheek flares
  mk(headG, 0.06, 0.09, 0.24, bone, 0, 0.21, -0.02) // the sagittal crest
  mk(headG, 0.26, 0.05, 0.08, bone, 0, 0.15, 0.12) // the brow bar
  for (const sx of [-1, 1] as const) {
    const zyg = mk(headG, 0.05, 0.05, 0.14, bone, sx * 0.16, 0.06, 0.08) // the cheek flare
    zyg.rotation.y = -sx * 0.15
    mk(headG, 0.03, 0.03, 0.03, dark, sx * 0.06, 0.03, 0.39) // the nostrils
    mk(headG, 0.035, 0.1, 0.035, bone, sx * 0.07, -0.04, 0.36) // the upper canines
  }
  const mouthGlow = mk(headG, 0.1, 0.05, 0.2, ember, 0, -0.01, 0.16) // heat between the jaws
  mouthGlow.visible = true
  const jaw = new THREE.Group()
  jaw.position.set(0, -0.05, 0.06)
  headG.add(jaw)
  mk(jaw, 0.16, 0.06, 0.3, bone, 0, -0.02, 0.16)
  for (const [tx, tz] of [[-0.05, 0.26], [0.05, 0.26], [-0.05, 0.12], [0.05, 0.12]] as const)
    mk(jaw, 0.028, 0.05, 0.028, dark, tx, 0.03, tz) // four teeth in the dark
  // amber eyes — ONE per side, deep-set under the bone brow
  for (const sx of [-1, 1] as const) {
    mk(headG, 0.04, 0.08, 0.08, dark, sx * 0.11, 0.09, 0.12)
    mk(headG, 0.035, 0.04, 0.05, emberEye, sx * 0.125, 0.09, 0.14)
  }
  // the ears — one proud, one torn in some old night
  const earR = mk(headG, 0.05, 0.13, 0.04, furDark, 0.1, 0.24, -0.02)
  earR.rotation.z = -0.25
  const earL = mk(headG, 0.05, 0.08, 0.04, furDark, -0.1, 0.2, -0.02)
  earL.rotation.z = 0.4
  const ears: [THREE.Mesh, THREE.Mesh] = [earL, earR]

  /* ---------- four legs, built for the burst ---------- */
  const mkLeg = (sx: number, px2: number, py: number, pz: number) => {
    const hip = new THREE.Group()
    hip.position.set(sx * px2, py, pz)
    spinInner.add(hip)
    mk(hip, 0.1, 0.22, 0.13, furDark, 0, -0.11, 0)
    const shin = new THREE.Group()
    shin.position.set(0, -0.22, 0)
    hip.add(shin)
    mk(shin, 0.08, 0.2, 0.08, fur, 0, -0.1, 0)
    mk(shin, 0.035, 0.05, 0.06, bone, 0, -0.14, -0.06) // the knee spur
    const paw = mk(shin, 0.1, 0.06, 0.15, furDark, 0, -0.23, 0.02)
    paw.rotation.x = 0.1
    mk(shin, 0.03, 0.05, 0.035, dark, sx * 0.055, -0.17, -0.02) // the dewclaw
    for (const cz of [0.05, -0.01]) mk(shin, 0.03, 0.03, 0.06, dark, 0, -0.26, cz + 0.05)
    return { hip, shin }
  }
  const fL = mkLeg(1, 0.14, 0.52, 0.4)
  const fR = mkLeg(-1, 0.14, 0.52, 0.4)
  const bL = mkLeg(1, 0.15, 0.62, -0.38)
  const bR = mkLeg(-1, 0.15, 0.62, -0.38)
  // hind legs stand digitigrade — thigh forward, shin back
  for (const hip of [bL.hip, bR.hip]) {
    hip.rotation.x = 0.55
    hip.children[0].scale.set(1.25, 1.1, 1.5) // the haunch thickness
  }
  for (const shin of [bL.shin, bR.shin]) shin.rotation.x = -0.85
  const legsF: [THREE.Group, THREE.Group] = [fL.hip, fR.hip]
  const legsB: [THREE.Group, THREE.Group] = [bL.hip, bR.hip]

  /* ---------- the cinder tail — four segments and a dying coal ---------- */
  const tailRoot = new THREE.Group()
  tailRoot.position.set(0, 0.76, -0.56)
  spinInner.add(tailRoot)
  const t1 = new THREE.Group()
  t1.rotation.x = 0.5
  tailRoot.add(t1)
  mk(t1, 0.09, 0.09, 0.2, furDark, 0, 0, -0.1)
  const t2 = new THREE.Group()
  t2.position.set(0, 0, -0.2)
  t2.rotation.x = 0.35
  t1.add(t2)
  mk(t2, 0.07, 0.07, 0.18, furDark, 0, 0, -0.09)
  const t3 = new THREE.Group()
  t3.position.set(0, 0, -0.18)
  t3.rotation.x = 0.35
  t2.add(t3)
  mk(t3, 0.05, 0.05, 0.14, dark, 0, 0, -0.07)
  const t4 = new THREE.Group()
  t4.position.set(0, 0, -0.14)
  t4.rotation.x = 0.3
  t3.add(t4)
  mk(t4, 0.04, 0.04, 0.1, dark, 0, 0, -0.05)
  mk(t4, 0.055, 0.055, 0.06, ember, 0, 0, -0.11) // the last cinder, bigger than before
  mk(t4, 0.028, 0.028, 0.028, emberEye, 0, 0.045, -0.1) // a spark leapfrogging the tip
  const tail: [THREE.Group, THREE.Group, THREE.Group] = [t1, t2, t3]

  group.scale.setScalar(scale)

  const rig: HoundRig = { headG, jaw, ears, tail, cracks, heart, legsF, legsB, shinFL: [fL.shin, fR.shin], shinBL: [bL.shin, bR.shin] }
  group.userData.hound = rig

  return {
    group,
    root,
    spin,
    head: headG.children[0] as THREE.Mesh,
    body: torso,
    armL: legsF[0],
    armR: legsF[1],
    legL: legsB[0],
    legR: legsB[1],
    legsBack: null,
    materials,
    extras,
    sword: null,
  }
}

/* ---------------- hound pose + animations ---------------- */

function resetHound(h: Humanoid) {
  const r = h.group.userData.hound as HoundRig
  h.root.rotation.set(0, 0, 0)
  h.root.position.set(0, 0, 0)
  h.spin.rotation.set(0, 0, 0)
  r.headG.rotation.set(0, 0, 0)
  r.jaw.rotation.set(0, 0, 0)
  r.tail[0].rotation.set(0.5, 0, 0)
  r.tail[1].rotation.set(0.35, 0, 0)
  r.tail[2].rotation.set(0.35, 0, 0)
  for (const hip of r.legsF) hip.rotation.set(0, 0, 0)
  for (const hip of r.legsB) hip.rotation.set(0.55, 0, 0)
  for (const shin of r.shinFL) shin.rotation.set(0, 0, 0)
  for (const shin of r.shinBL) shin.rotation.set(-0.85, 0, 0)
  r.heart.scale.setScalar(1)
  r.heart.visible = true
  return r
}

/** the prowl — low, silent, the seams breathing cinders */
export function animHoundIdle(h: Humanoid, t: number) {
  const r = resetHound(h)
  const b = Math.sin(t * 2.1)
  h.root.position.y = b * 0.014
  r.headG.rotation.y = Math.sin(t * 0.6) * 0.34
  r.headG.rotation.x = 0.06 + Math.sin(t * 1.1) * 0.05
  r.jaw.rotation.x = Math.max(0, Math.sin(t * 0.31)) * 0.16 // the silent growl
  r.tail[0].rotation.x = 0.5 + Math.sin(t * 1.3) * 0.1
  r.tail[0].rotation.y = Math.sin(t * 0.8) * 0.25
  r.tail[1].rotation.y = Math.sin(t * 0.8 - 0.6) * 0.3
  r.legsF[0].rotation.x = Math.sin(t * 2.1) * 0.03
  r.legsF[1].rotation.x = -Math.sin(t * 2.1) * 0.03
  r.heart.scale.setScalar(1 + Math.sin(t * 3.7) * 0.12) // the coal breathes
  for (const c of r.cracks) {
    c.visible = true
    c.scale.y = 1 + Math.sin(t * 3.4 + c.id) * 0.12 // the seams breathe
  }
}

/** the gallop — spine flexes, pairs trade, cinders shed */
export function animHoundRun(h: Humanoid, t: number) {
  const r = resetHound(h)
  const f = t * 12.5
  const s = Math.sin(f)
  const c = Math.cos(f)
  h.root.rotation.x = -0.06 + s * 0.05 // the spine's gallop wave
  h.root.position.y = Math.abs(c) * 0.06
  r.legsF[0].rotation.x = -s * 0.85
  r.legsF[1].rotation.x = -s * 0.85 - 0.2 // the lead pair, slightly staggered
  r.legsB[0].rotation.x = 0.55 + s * 0.85
  r.legsB[1].rotation.x = 0.55 + s * 0.85 - 0.2
  for (const shin of r.shinFL) shin.rotation.x = Math.max(0, s) * 0.7
  r.headG.rotation.x = -0.1 + s * 0.06 // the nose rides the wave
  r.jaw.rotation.x = 0.14
  r.tail[0].rotation.x = 0.2 // streams low behind
  r.tail[0].rotation.y = Math.sin(f * 0.5) * 0.15
  r.tail[1].rotation.y = Math.sin(f * 0.5 - 0.5) * 0.2
  r.tail[2].rotation.y = Math.sin(f * 0.5 - 1) * 0.25
  r.heart.scale.setScalar(1.15 + Math.sin(f * 0.9) * 0.15) // the gallop pumps it
  for (const c of r.cracks) c.scale.y = 1.2 + Math.sin(f * 0.7 + c.id) * 0.25
}

/** the lunge — everything the pack knows in half a second */
export function animHoundLunge(h: Humanoid, p: number) {
  const r = resetHound(h)
  if (p < 0.3) {
    // the coil — weight on the haunches, one breath of stillness
    const q = ease(p / 0.3)
    h.root.rotation.x = 0.16 * q
    h.root.position.y = -0.05 * q
    r.legsB[0].rotation.x = 0.55 + 0.5 * q
    r.legsB[1].rotation.x = 0.55 + 0.5 * q
    r.legsF[0].rotation.x = 0.3 * q
    r.legsF[1].rotation.x = 0.3 * q
    r.headG.rotation.x = 0.25 * q // the nose drops to the line
    r.jaw.rotation.x = 0.05
  } else if (p < 0.7) {
    // the burst — full stretch, jaws last, cinders trail
    const q = ease((p - 0.3) / 0.4)
    h.root.rotation.x = lerpN(0.16, -0.14, q)
    h.root.position.y = Math.sin(q * Math.PI) * 0.18
    r.legsB[0].rotation.x = lerpN(1.05, -0.7, q)
    r.legsB[1].rotation.x = lerpN(1.05, -0.7, q)
    r.legsF[0].rotation.x = lerpN(0.3, -1.05, q)
    r.legsF[1].rotation.x = lerpN(0.3, -1.05, q)
    for (const shin of r.shinFL) shin.rotation.x = lerpN(0, 0.5, q)
    r.headG.rotation.x = lerpN(0.25, -0.3, q)
    r.jaw.rotation.x = 0.85 // the snap wide open
    r.tail[0].rotation.x = -0.3
  } else {
    // the land — jaws grind shut on ash or armor
    const q = (p - 0.7) / 0.3
    h.root.rotation.x = lerpN(-0.14, 0, q)
    r.legsB[0].rotation.x = lerpN(-0.7, 0.55, q)
    r.legsB[1].rotation.x = lerpN(-0.7, 0.55, q)
    r.legsF[0].rotation.x = lerpN(-1.05, 0, q)
    r.legsF[1].rotation.x = lerpN(-1.05, 0, q)
    r.jaw.rotation.x = lerpN(0.85, 0.1, q)
  }
  for (const c of r.cracks) c.scale.y = 1.35 // burning bright at the strike
  r.heart.scale.setScalar(1.4 + Math.max(0, Math.sin(p * Math.PI)) * 0.4) // the coal blazes
}

/** the fall — rolls to its side, the pack runs on without a sound */
export function animHoundDead(h: Humanoid, p: number) {
  const r = resetHound(h)
  const q = ease(clamp01(p / 0.55))
  h.root.rotation.z = 1.35 * q // onto its side
  h.root.position.y = -0.18 * q
  r.legsF[0].rotation.x = -1.2 * q // the stiff-legged reach
  r.legsF[1].rotation.x = -0.7 * q
  r.legsB[0].rotation.x = 0.55 + 0.6 * q
  r.legsB[1].rotation.x = 0.55 + 0.2 * q
  r.headG.rotation.x = 0.3 * q
  r.jaw.rotation.x = 0.4 * q // the mouth stays open
  r.tail[0].rotation.x = lerpN(0.5, 1.2, q)
  // the seams cool from tail to chest — the last cinder goes dark
  for (let i = 0; i < r.cracks.length; i++) r.cracks[i].visible = p < 0.45 + i * 0.12
  // the heart holds out the longest — then even the coal forgets
  r.heart.visible = p < 0.8
  r.heart.scale.setScalar(Math.max(0.4, 1.2 - q * 0.8))
}
