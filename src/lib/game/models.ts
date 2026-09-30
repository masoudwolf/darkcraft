import * as THREE from 'three'
import { characterMaterials, type CharKind } from './textures'

/* Minecraft-style blocky humanoid built from boxes.
   Proportions follow the classic 8px/12px model (1px = 1/16 unit). */

export interface Humanoid {
  group: THREE.Group // yaw applied here
  root: THREE.Group // anim offsets (roll spin, lean)
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
  const wood = new THREE.MeshLambertMaterial({ color: 0x7a5a34 })
  const iron = new THREE.MeshLambertMaterial({ color: 0x8a8f96 })
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.52, 0.42), wood)
  const rim = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.56, 0.46), iron)
  rim.position.z = -0.02
  body.add(rim.parent === body ? rim : rim)
  g.add(rim)
  g.add(body)
  body.position.z = 0.02
  body.castShadow = true
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

  const mkMesh = (w: number, h: number, d: number, mat: THREE.Material | THREE.Material[], x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)
    m.position.set(x, y, z)
    m.castShadow = true
    return m
  }

  // legs pivot at hip (y=0.75)
  const legL = new THREE.Group()
  legL.position.set(0.125, 0.75, 0)
  legL.add(mkMesh(0.25, 0.75, 0.25, mats.leg, 0, -0.375, 0))
  const legR = new THREE.Group()
  legR.position.set(-0.125, 0.75, 0)
  legR.add(mkMesh(0.25, 0.75, 0.25, mats.leg, 0, -0.375, 0))

  // body center at y=1.125
  const body = mkMesh(0.5, 0.75, 0.25, mats.body, 0, 1.125, 0)

  // arms pivot at shoulder (y=1.375)
  const armL = new THREE.Group()
  armL.position.set(0.375, 1.375, 0)
  armL.add(mkMesh(0.25, 0.75, 0.25, mats.arm, 0, -0.3125, 0))
  const armR = new THREE.Group()
  armR.position.set(-0.375, 1.375, 0)
  armR.add(mkMesh(0.25, 0.75, 0.25, mats.arm, 0, -0.3125, 0))

  // head center at y=1.75
  const head = mkMesh(0.5, 0.5, 0.5, mats.head, 0, 1.75, 0)

  root.add(legL, legR, body, armL, armR, head)

  let sword: THREE.Group | null = null
  if (opts.sword) {
    sword = createSword(opts.swordScale ?? 1, kind === 'boss')
    sword.position.set(0, -0.72, 0.05)
    sword.rotation.x = -Math.PI / 2.4
    armR.add(sword)
  }
  if (opts.shield) {
    const sh = createShield()
    sh.position.set(0, -0.45, 0.12)
    armL.add(sh)
  }

  group.scale.setScalar(scale)
  return { group, root, head, body, armL, armR, legL, legR, materials: mats.all, sword }
}

/* ================= ANIMATIONS ================= */

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t

export function resetPose(h: Humanoid) {
  h.root.rotation.set(0, 0, 0)
  h.root.position.set(0, 0, 0)
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

export function animRoll(h: Humanoid, p: number) {
  resetPose(h)
  h.root.rotation.x = p * Math.PI * 2
  h.root.position.y = Math.sin(p * Math.PI) * 0.16
  h.armL.rotation.x = h.armR.rotation.x = -1.4
  h.legL.rotation.x = h.legR.rotation.x = 1.1
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

export function disposeHumanoid(h: Humanoid) {
  h.group.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (mesh.geometry) mesh.geometry.dispose()
  })
  for (const m of h.materials) m.dispose()
}
