import * as THREE from 'three'
import { makeTex, fillNoise, type Rng } from './textures'
import type { Humanoid } from './models'

function px(ctx: CanvasRenderingContext2D, x: number, y: number, c: string, w = 1, h = 1) {
  ctx.fillStyle = c
  ctx.fillRect(x, y, w, h)
}

/* ==================================================================
   THE NIGHT ROC — «رُخِ شب»
   The last servant of the old gods: a mountain-sized bird of gothic
   fantasy that carries the ash-walker over the cloud sea to
   Manorloth. Persian myth names the Roc (رُخ) that carried Sindbad —
   here it serves the same fate: one rider, one last flight.

   Design laws (every box has a reason):
   - body: keeled chest (flight muscle), tapering hips, feathered
     rump — the falcon silhouette at mountain scale
   - neck: two pivots so the head can scan AND strike forward
   - head: brow ridge + backward-swept crest (gothic crown), hooked
     golden beak with a working jaw, ember eyes (unlit)
   - wings: 3 chained segments per side (shoulder → wrist → tip) so
     flaps flex like a real wing; trailing feather rows + long pale
     primaries; ember seams burn along the leading edge (fantasy)
   - tail: nine true rectrices — pale quill, dark vane, bone-pale
     tip — overlapping into one continuous rounded fan
   - legs: feathered thighs, bare golden shins, three taloned toes
     + a rear claw — the grab rig the cinematic carries riders with
   ================================================== */

export interface RocRig {
  neck: THREE.Group
  headG: THREE.Group
  jaw: THREE.Group
  crest: THREE.Group
  tail: THREE.Group
  wingIn: [THREE.Group, THREE.Group] // left, right (beyond armL/armR shoulder)
  wingMid: [THREE.Group, THREE.Group]
  wingTip: [THREE.Group, THREE.Group]
  legL: THREE.Group // shin pivot inside legL/legR (Humanoid)
  legR: THREE.Group
  shoulderL: THREE.Group
  shoulderR: THREE.Group
  /** the exact talon grip points — the cinematic hangs the rider on these */
  grabL: THREE.Object3D
  grabR: THREE.Object3D
}

const F = {
  dark: 0x232b38, // slate-blue feather base
  dark2: 0x1a2029,
  pale: 0xc9c2ac, // bone-pale tips / underside
  gold: 0xb8862a, // beak + talons — the gods' furniture
  ember: 0xff7a1e, // the seams that never cooled
}

function featherTex(dark: [number, number, number], tip: string, seed: number) {
  const paint = (c: CanvasRenderingContext2D, r: Rng, s: number) => {
    fillNoise(c, r, s, dark, 10)
    // shaft
    for (let y = 0; y < s; y++) px(c, 7, y, 'rgba(255,255,255,0.06)')
    // pale tip band — the Night Roc's signature
    for (let x = 0; x < s; x++) {
      const d = 2 + Math.floor(r() * 2)
      for (let y = 0; y < d; y++) px(c, x, y, tip)
    }
    // barb splits
    for (let i = 0; i < 8; i++) px(c, Math.floor(r() * s), 4 + Math.floor(r() * 10), 'rgba(0,0,0,0.25)', 1, 2)
  }
  return makeTex(16, seed, paint)
}

function beakTex() {
  return makeTex(16, 81, (c, r, s) => {
    fillNoise(c, r, s, [184, 134, 42], 12)
    for (let i = 0; i < s; i++) px(c, i, 0, 'rgb(232,190,92)')
    for (let i = 0; i < s; i += 4) for (let j = 0; j < s; j++) px(c, i, j, 'rgb(146,102,26)')
    for (let i = 0; i < 6; i++) px(c, Math.floor(r() * s), Math.floor(r() * s), 'rgb(222,178,74)', 2, 1)
  })
}

function scaleTex() {
  return makeTex(16, 82, (c, r, s) => {
    fillNoise(c, r, s, [168, 124, 44], 10)
    for (let y = 0; y < s; y += 4)
      for (let x = 0; x < s; x += 4) {
        px(c, x, y + 3, 'rgb(110,78,24)', 4, 1)
        px(c, x + 3, y, 'rgb(110,78,24)', 1, 4)
      }
  })
}

/** build the Night Roc — Humanoid-compatible so it lives in the
    bestiary viewer exactly like every other creature */
export function createRoc(scale = 2.1): Humanoid {
  const group = new THREE.Group()
  const root = new THREE.Group()
  group.add(root)
  const spin = new THREE.Group()
  spin.position.y = 1.7
  const spinInner = new THREE.Group()
  spinInner.position.y = -1.7
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

  // feather paints
  const back = mat(featherTex([35, 43, 56], 'rgb(150,146,128)', 84)) // mantle
  const breast = mat(featherTex([46, 52, 64], 'rgb(201,194,172)', 85)) // paler chest
  const flight = mat(featherTex([26, 32, 42], 'rgb(216,210,190)', 86)) // long feathers
  const under = mat(featherTex([58, 64, 76], 'rgb(201,194,172)', 87))
  const beak = mat(beakTex())
  const scaleM = mat(scaleTex())
  const dark = solid(F.dark2)
  const darkSoft = solid(0x2a3240)

  const mk = (
    parent: THREE.Object3D,
    w: number,
    h: number,
    d: number,
    m: THREE.Material | THREE.Material[],
    x: number,
    y: number,
    z: number
  ) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m)
    mesh.position.set(x, y, z)
    mesh.castShadow = true
    parent.add(mesh)
    return mesh
  }

  /* ---------- torso: keeled chest + hips ---------- */
  const torso = mk(spinInner, 1.0, 1.05, 1.7, breast, 0, 1.85, 0.15)
  mk(spinInner, 0.92, 0.95, 0.95, back, 0, 1.95, -0.85) // mantle over the back
  mk(spinInner, 0.7, 0.8, 0.8, back, 0, 1.8, -1.6) // hips
  mk(spinInner, 0.6, 0.55, 0.5, under, 0, 1.45, -2.1) // feathered rump
  // the keel — a raptor's flight-muscle breastbone
  mk(spinInner, 0.62, 0.5, 1.2, breast, 0, 1.55, 0.72)
  // ember seam splitting the chest — the fire that carried the gods' forge
  const seam = mk(spinInner, 0.1, 0.62, 0.05, glow(F.ember), 0, 1.95, 1.02)
  seam.rotation.x = -0.12
  // shoulder feather epaulettes
  for (const sx of [-1, 1] as const) mk(spinInner, 0.34, 0.3, 0.5, back, sx * 0.56, 2.2, 0.2)

  /* ---------- neck (2 pivots) + head ---------- */
  const neck = new THREE.Group()
  neck.position.set(0, 2.25, 0.85)
  spinInner.add(neck)
  mk(neck, 0.52, 0.75, 0.5, breast, 0, 0.3, 0.05) // neck column
  mk(neck, 0.44, 0.3, 0.44, back, 0, 0.62, -0.02) // nape band

  const headG = new THREE.Group()
  headG.position.set(0, 0.72, 0.18)
  neck.add(headG)
  mk(headG, 0.56, 0.5, 0.66, back, 0, 0.12, 0.06) // skull
  // angry brow — the gothic scowl, shading the lateral eyes
  for (const sx of [-1, 1] as const) {
    const brow = mk(headG, 0.26, 0.1, 0.22, dark, sx * 0.16, 0.33, 0.22)
    brow.rotation.x = 0.35
  }
  /* eyes of the Night Roc — a raptor has exactly ONE eye per side,
     seated on the skull flank BEHIND the beak root, under the brow.
     Amber iris + round black pupil on a dark bony socket plate that
     stands proud of the skull. (The old build had two extra glowing
     dots on the beak bridge — they read as an eye glued to the nose;
     they are gone, and the white core is gone with them.) */
  const eyeMat = glow(0xffb03a)
  const pupilMat = solid(0x17120b)
  for (const sx of [-1, 1] as const) {
    // bony socket plate — proud of the skull flank, angled to the beak
    const socket = mk(headG, 0.06, 0.24, 0.3, dark, sx * 0.3, 0.2, 0.12)
    socket.rotation.y = -sx * 0.42
    // amber iris on the plate
    const iris = mk(headG, 0.05, 0.17, 0.18, eyeMat, sx * 0.34, 0.2, 0.15)
    iris.rotation.y = -sx * 0.42
    // round black pupil — the raptor stare
    const pupil = mk(headG, 0.055, 0.08, 0.08, pupilMat, sx * 0.375, 0.2, 0.165)
    pupil.rotation.y = -sx * 0.42
  }
  // hooked golden beak — upper mandible + working lower jaw
  mk(headG, 0.3, 0.2, 0.42, beak, 0, 0.14, 0.52)
  const hook = mk(headG, 0.22, 0.14, 0.18, beak, 0, 0.08, 0.76)
  hook.rotation.x = 0.5
  const jaw = new THREE.Group()
  jaw.position.set(0, 0.04, 0.3)
  headG.add(jaw)
  mk(jaw, 0.24, 0.09, 0.4, beak, 0, -0.03, 0.2)
  // crest — three swept-back crown feathers (the gothic spire crown)
  const crest = new THREE.Group()
  crest.position.set(0, 0.3, -0.18)
  headG.add(crest)
  const crestSpine: [number, number, number][] = [
    [0, 0.34, -0.1],
    [0.16, 0.26, -0.14],
    [-0.16, 0.26, -0.14],
  ]
  for (const [cx, cy, cz] of crestSpine) {
    const f = mk(crest, 0.1, 0.46, 0.1, flight, cx, cy, cz)
    f.rotation.x = -0.7
    const tip = mk(crest, 0.08, 0.14, 0.08, glow(F.ember), cx, cy + 0.16, cz - 0.06)
    tip.rotation.x = -0.7
  }

  /* ---------- wings — 3 chained segments per side ---------- */
  const wingIn: [THREE.Group, THREE.Group] = [new THREE.Group(), new THREE.Group()]
  const wingMid: [THREE.Group, THREE.Group] = [new THREE.Group(), new THREE.Group()]
  const wingTip: [THREE.Group, THREE.Group] = [new THREE.Group(), new THREE.Group()]
  const armL = new THREE.Group() // shoulder pivot, +X side
  const armR = new THREE.Group() // shoulder pivot, -X side
  armL.position.set(0.52, 2.32, 0.25)
  armR.position.set(-0.52, 2.32, 0.25)
  spinInner.add(armL, armR)
  for (const [i, sx] of [
    [0, 1],
    [1, -1],
  ] as const) {
    const shoulder = sx === 1 ? armL : armR
    const inner = wingIn[i]
    inner.position.set(sx * 0.1, 0, 0)
    shoulder.add(inner)
    // inner arm — heavy secondaries
    mk(inner, 1.45, 0.14, 0.95, back, sx * 0.72, 0, 0)
    // trailing feather row (pale tips read the wing edge)
    for (let f = 0; f < 3; f++) {
      const fe = mk(inner, 0.42, 0.06, 0.55, flight, sx * (0.3 + f * 0.48), -0.05, 0.62)
      fe.rotation.y = sx * 0.12
    }
    // ember seam along the leading edge
    mk(inner, 1.3, 0.05, 0.06, glow(F.ember), sx * 0.7, 0.08, -0.44)

    const mid = wingMid[i]
    mid.position.set(sx * 1.44, 0, 0)
    inner.add(mid)
    mk(mid, 1.3, 0.12, 0.72, back, sx * 0.64, 0, 0.02)
    for (let f = 0; f < 3; f++) {
      const fe = mk(mid, 0.4, 0.055, 0.5, flight, sx * (0.24 + f * 0.42), -0.045, 0.42)
      fe.rotation.y = sx * 0.18
    }
    mk(mid, 1.1, 0.045, 0.05, glow(F.ember), sx * 0.6, 0.07, -0.33)

    const tip = wingTip[i]
    tip.position.set(sx * 1.28, 0, 0)
    mid.add(tip)
    mk(tip, 1.15, 0.1, 0.46, back, sx * 0.56, 0, 0.04)
    // long primaries — the swept fingers of the falcon
    for (let f = 0; f < 2; f++) {
      const p = mk(tip, 1.05, 0.05, 0.3, flight, sx * (0.5 + f * 0.28), -0.04 + f * 0.02, 0.3 + f * 0.14)
      p.rotation.y = sx * (0.34 + f * 0.18)
      p.rotation.z = -sx * 0.06
    }
    // pale primary tips
    mk(tip, 0.14, 0.06, 0.3, under, sx * 1.02, -0.04, 0.52)
    mk(tip, 0.14, 0.06, 0.28, under, sx * 0.78, -0.02, 0.66)
    mk(tip, 1.0, 0.04, 0.05, glow(F.ember), sx * 0.5, 0.06, -0.2)
  }

  /* ---------- tail — true rectrices, built like a real bird's ----------
     Every feather GROWS from one root at the rump: a narrow pale
     quill that opens into a wide dark vane capped by a bone-pale
     band that wraps the tip. Nine of them overlap into ONE continuous
     rounded fan (no air gaps — the old separated slats read as a
     broken comb): central pair longest, outers step down, and each
     outer feather tucks UNDER the inner one the way real rectrices
     layer. A covert row covers the quill roots from above. */
  const tail = new THREE.Group()
  tail.position.set(0, 1.95, -1.8)
  spinInner.add(tail)
  // the uropygium — the feathered tail-bone mound the fan grows from
  mk(tail, 0.42, 0.3, 0.44, under, 0, 0, 0.12)
  for (let f = -4; f <= 4; f++) {
    const a = f * 0.152 // ±36.5° — a true raptor fan
    const len = 1.85 - Math.abs(f) * 0.125 // rounded outline 1.85 → 1.35
    const quillLen = len * 0.4
    const vaneLen = len * 0.66
    const y = -Math.abs(f) * 0.016 // outers layer under the central pair
    // quill — the narrow pale shaft every real feather has
    let r = 0.12 + quillLen / 2
    mk(tail, 0.13, 0.05, quillLen, under, Math.sin(a) * r, y, -Math.cos(a) * r).rotation.y = a
    // vane — the wide web of the feather (0.08 overlap onto the quill)
    r = 0.12 + quillLen - 0.08 + vaneLen / 2
    mk(tail, 0.4, 0.055, vaneLen, flight, Math.sin(a) * r, y, -Math.cos(a) * r).rotation.y = a
    // bone-pale tip band — slightly proud of the vane so it wraps it
    r += vaneLen / 2 - 0.09
    mk(tail, 0.42, 0.068, 0.24, under, Math.sin(a) * r, y, -Math.cos(a) * r).rotation.y = a
  }
  // covert row — short feathers covering the quill roots from above
  for (let f = -2; f <= 2; f++) {
    const a = f * 0.19
    const cl = 0.64 - Math.abs(f) * 0.07
    const r = 0.18 + cl / 2
    mk(tail, 0.3, 0.06, cl, under, Math.sin(a) * r, 0.05, -Math.cos(a) * r).rotation.y = a
  }

  /* ---------- legs: feathered thigh, golden shin, talons ----------
     Pivot sits deep under the HIPS (z −0.85), not the chest — a
     bird's legs hang from its hips; the old forward mount made the
     Roc look like a man wading. The thigh's slight ahead-lean keeps
     the feet under the center of mass in perched poses. */
  const legL = new THREE.Group()
  const legR = new THREE.Group()
  legL.position.set(0.3, 1.5, -0.85)
  legR.position.set(-0.3, 1.5, -0.85)
  spinInner.add(legL, legR)
  const legs: [THREE.Group, number][] = [
    [legL, 1],
    [legR, -1],
  ]
  const grabL = new THREE.Object3D()
  const grabR = new THREE.Object3D()
  for (const [leg, sx] of legs) {
    leg.rotation.x = 0.28 // femur angled ahead so the feet meet under the body
    mk(leg, 0.34, 0.55, 0.4, under, 0, -0.28, 0.02) // feathered thigh ("trousers")
    const shin = new THREE.Group()
    shin.position.set(0, -0.55, 0.05)
    leg.add(shin)
    mk(shin, 0.17, 0.5, 0.17, scaleM, 0, -0.2, 0) // bare scaly shin
    // three fanned talons + the rear claw
    for (const [tz, tzz] of [[0.1, 0], [-0.05, 0.12], [-0.05, -0.12]] as const) {
      mk(shin, 0.09, 0.1, 0.34, scaleM, sx * 0.02, -0.47, tzz + 0.1)
      const claw = mk(shin, 0.06, 0.06, 0.14, dark, sx * 0.02, -0.5, tzz + 0.28)
      claw.rotation.x = -0.35
    }
    const rear = mk(shin, 0.08, 0.09, 0.16, scaleM, 0, -0.44, -0.14)
    rear.rotation.x = 0.5
    // the invisible grip point the cinematic hangs riders from
    ;(sx === 1 ? grabL : grabR).position.set(0, -0.52, 0.14)
    shin.add(sx === 1 ? grabL : grabR)
  }

  group.scale.setScalar(scale)

  const rig: RocRig = {
    neck,
    headG,
    jaw,
    crest,
    tail,
    wingIn,
    wingMid,
    wingTip,
    legL: (legL.children[1] as THREE.Group) ?? legL,
    legR: (legR.children[1] as THREE.Group) ?? legR,
    shoulderL: armL,
    shoulderR: armR,
    grabL,
    grabR,
  }
  group.userData.roc = rig

  // Humanoid-compatible: wing pivots ride on armL/armR, head/body exist,
  // legs keep the shared naming so the viewer and flash helpers work.
  const headMesh = headG.children[0] as THREE.Mesh
  const bodyMesh = torso
  return {
    group,
    root,
    spin,
    head: headMesh,
    body: bodyMesh,
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

/* ================= POSE HELPERS ================= */

/** neutral perched pose — every animation builds from here */
function resetRoc(h: Humanoid) {
  const r = h.group.userData.roc as RocRig
  h.root.rotation.set(0, 0, 0)
  h.root.position.set(0, 0, 0)
  h.spin.rotation.set(0, 0, 0)
  h.armL.rotation.set(0, 0, 0)
  h.armR.rotation.set(0, 0, 0)
  r.neck.rotation.set(0, 0, 0)
  r.headG.rotation.set(0, 0, 0)
  r.jaw.rotation.set(0, 0, 0)
  r.crest.rotation.set(0, 0, 0)
  r.tail.rotation.set(0, 0, 0)
  for (const side of [0, 1] as const) {
    r.wingIn[side].rotation.set(0, 0, 0)
    r.wingMid[side].rotation.set(0, 0, 0)
    r.wingTip[side].rotation.set(0, 0, 0)
  }
  h.legL.rotation.set(0.26, 0, 0) // the femur's ahead-lean is the rest state
  h.legR.rotation.set(0.26, 0, 0)
  r.legL.rotation.set(-0.06, 0, 0) // near-flat foot — toes barely curl
  r.legR.rotation.set(-0.06, 0, 0)
  return r
}

/** tuck both wings against the body (perch) — sweep back over the flanks */
function foldWings(r: RocRig, k: number) {
  r.shoulderL.rotation.y = 1.32 * k
  r.shoulderR.rotation.y = -1.32 * k
  r.shoulderL.rotation.z = -0.22 * k
  r.shoulderR.rotation.z = 0.22 * k
  for (const side of [0, 1] as const) {
    const sx = side === 0 ? 1 : -1
    r.wingIn[side].rotation.y = sx * 1.25 * k
    r.wingMid[side].rotation.y = sx * 1.18 * k
    r.wingTip[side].rotation.y = sx * 1.05 * k
    r.wingTip[side].rotation.z = -sx * 0.3 * k
  }
}

/* ================= ANIMATIONS ================= */

/** perched on a crag: breathing, slow scanning, tail sway — folded */
export function animRocPerch(h: Humanoid, t: number) {
  const r = resetRoc(h)
  const b = Math.sin(t * 1.5)
  foldWings(r, 1)
  h.root.position.y = b * 0.02
  h.armL.rotation.z = -0.18 + b * 0.02
  h.armR.rotation.z = 0.18 - b * 0.02
  r.neck.rotation.y = Math.sin(t * 0.5) * 0.42
  r.neck.rotation.x = 0.08 + Math.sin(t * 0.83) * 0.06
  r.headG.rotation.y = Math.sin(t * 0.31 + 1.2) * 0.3
  r.tail.rotation.x = 0.18 + Math.sin(t * 0.9) * 0.05
  // the perch crouch: femur ahead, shin back — the two cancel so the
  // WHOLE SOLE rests flat on the stone (the old −0.42 shin pitched the
  // toes 24° up, and the bird floated a full unit above its platform)
  h.legL.rotation.x = 0.26
  h.legR.rotation.x = 0.26
  r.legL.rotation.x = -0.32
  r.legR.rotation.x = -0.32
}

/** the great wingbeat — three segments flex in phase, body rises */
export function animRocFlap(h: Humanoid, t: number) {
  const r = resetRoc(h)
  const f = t * 5.2
  const s = Math.sin(f)
  const c = Math.cos(f)
  r.shoulderL.rotation.z = 0.5 + s * 0.55
  r.shoulderR.rotation.z = -0.5 - s * 0.55
  for (const side of [0, 1] as const) {
    const sx = side === 0 ? 1 : -1
    r.wingIn[side].rotation.y = sx * (-0.12 - Math.max(0, s) * 0.3)
    r.wingMid[side].rotation.z = sx * (s * 0.42)
    r.wingTip[side].rotation.z = sx * (s * 0.6 - Math.max(0, -s) * 0.25)
    r.wingTip[side].rotation.y = sx * -0.1
  }
  h.root.position.y = Math.max(0, c) * 0.14
  h.root.rotation.x = -0.06 + s * 0.05
  r.neck.rotation.x = 0.14
  r.tail.rotation.x = 0.12 + s * 0.12
  r.jaw.rotation.x = Math.max(0, s - 0.6) * 0.9
  // legs trail behind in flight, talons slightly flexed
  h.legL.rotation.x = -0.55
  h.legR.rotation.x = -0.55
  r.legL.rotation.x = 0.25
  r.legR.rotation.x = 0.25
}

/** riding the wind: wings spread in a shallow V, the wind does the work */
export function animRocGlide(h: Humanoid, t: number) {
  const r = resetRoc(h)
  const w = Math.sin(t * 1.7) * 0.045
  r.shoulderL.rotation.z = 0.32 + w
  r.shoulderR.rotation.z = -0.32 - w
  for (const side of [0, 1] as const) {
    const sx = side === 0 ? 1 : -1
    r.wingMid[side].rotation.z = sx * (-0.1 + w * 0.6)
    r.wingTip[side].rotation.z = sx * (-0.16 - w)
    r.wingTip[side].rotation.y = sx * -0.14
  }
  h.root.rotation.x = -0.05 + Math.sin(t * 0.9) * 0.02
  r.tail.rotation.x = 0.05
  r.tail.rotation.y = Math.sin(t * 0.6) * 0.08
  r.neck.rotation.x = 0.22
  r.headG.rotation.y = Math.sin(t * 0.45) * 0.12
  h.legL.rotation.x = -0.85
  h.legR.rotation.x = -0.85
  r.legL.rotation.x = 0.35 // talons half-open, ready to strike
  r.legR.rotation.x = 0.35
  r.jaw.rotation.x = 0.12
}

/** the grab — dive, brake, talons reach (cinematic one-shot, dur ≈ 2.2) */
export function animRocGrab(h: Humanoid, p: number) {
  const r = resetRoc(h)
  if (p < 0.42) {
    // the dive — wings swept, body knifed down
    const q = p / 0.42
    r.shoulderL.rotation.y = 0.9 * q
    r.shoulderR.rotation.y = -0.9 * q
    r.shoulderL.rotation.z = 0.12
    r.shoulderR.rotation.z = -0.12
    h.root.rotation.x = -0.85 * q
    r.tail.rotation.x = -0.3 * q
    r.neck.rotation.x = -0.5 * q
    h.legL.rotation.x = -0.2
    h.legR.rotation.x = -0.2
  } else if (p < 0.68) {
    // the brake — one huge flare, talons swing forward and open wide
    const q = (p - 0.42) / 0.26
    r.shoulderL.rotation.y = lerpN(0.9, 0.15, q)
    r.shoulderR.rotation.y = -lerpN(0.9, 0.15, q)
    r.shoulderL.rotation.z = lerpN(0.12, 1.0, q)
    r.shoulderR.rotation.z = -lerpN(0.12, 1.0, q)
    h.root.rotation.x = lerpN(-0.85, 0.35, q)
    r.tail.rotation.x = lerpN(-0.3, 0.55, q)
    h.legL.rotation.x = lerpN(-0.35, 1.0, q)
    h.legR.rotation.x = lerpN(-0.35, 1.0, q)
    r.legL.rotation.x = lerpN(0.35, -0.45, q) // shins extend — claws gape
    r.legR.rotation.x = lerpN(0.35, -0.45, q)
    r.jaw.rotation.x = 0.5 * Math.sin(q * Math.PI)
  } else {
    // the clutch — wings close around, claws flex shut on the prey
    const q = (p - 0.68) / 0.32
    r.shoulderL.rotation.z = lerpN(1.0, 0.55, q)
    r.shoulderR.rotation.z = -lerpN(1.0, 0.55, q)
    h.root.rotation.x = lerpN(0.35, 0.1, q)
    h.legL.rotation.x = lerpN(1.0, 0.62, q)
    h.legR.rotation.x = lerpN(1.0, 0.62, q)
    r.legL.rotation.x = lerpN(-0.45, 0.55, q) // the shin curl closes the fist
    r.legR.rotation.x = lerpN(-0.45, 0.55, q)
    r.tail.rotation.x = 0.3
    r.jaw.rotation.x = 0.3 * (1 - q)
  }
}

/** carrying a rider: slow heavy beats, legs tucked, head forward */
export function animRocCarry(h: Humanoid, t: number) {
  const r = resetRoc(h)
  const f = t * 3.1
  const s = Math.sin(f)
  r.shoulderL.rotation.z = 0.3 + s * 0.45
  r.shoulderR.rotation.z = -0.3 - s * 0.45
  for (const side of [0, 1] as const) {
    const sx = side === 0 ? 1 : -1
    r.wingMid[side].rotation.z = sx * (s * 0.34)
    r.wingTip[side].rotation.z = sx * (s * 0.5)
    r.wingTip[side].rotation.y = sx * -0.12
  }
  h.root.rotation.x = 0.1
  h.root.position.y = Math.max(0, Math.cos(f)) * 0.06
  r.neck.rotation.x = 0.3
  r.tail.rotation.x = -0.15 + s * 0.08
  h.legL.rotation.x = -0.4
  h.legR.rotation.x = -0.4
  r.legL.rotation.x = 0.5 + s * 0.06 // the grip flexes with each beat
  r.legR.rotation.x = 0.5 + s * 0.06
  h.armL.rotation.z = -0.1
  h.armR.rotation.z = 0.1
}

/** the sky-rending screech — head up, jaw wide, wings tremble */
export function animRocScreech(h: Humanoid, p: number) {
  const r = resetRoc(h)
  const rise = p < 0.3 ? p / 0.3 : 1
  const fall = p > 0.78 ? 1 - (p - 0.78) / 0.22 : 1
  const k = rise * fall
  r.neck.rotation.x = -0.75 * k
  r.jaw.rotation.x = Math.min(0.85, k * 1.2)
  r.shoulderL.rotation.z = 0.55 * k + Math.sin(p * 44) * 0.05 * k
  r.shoulderR.rotation.z = -0.55 * k - Math.sin(p * 44) * 0.05 * k
  h.root.rotation.x = -0.12 * k
  r.tail.rotation.x = 0.1
  h.legL.rotation.x = 0.12
  h.legR.rotation.x = 0.12
}

const lerpN = (a: number, b: number, t: number) => a + (b - a) * Math.max(0, Math.min(1, t))
