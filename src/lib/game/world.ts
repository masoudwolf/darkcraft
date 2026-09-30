import * as THREE from 'three'
import { blockMaterials, mulberry32 } from './textures'

export const WORLD_HALF = 30 // blocks range from -30..29
export const BONFIRE = { x: 0, z: 14 }
export const BOSS_CENTER = { x: 0, z: -18 }
export const GATE_Z = -10
export const BOSS_ARENA = { minX: -8, maxX: 8, minZ: -23.5, maxZ: GATE_Z + 0.2 }

interface Vec3Lite { x: number; y: number; z: number }

export class World {
  group = new THREE.Group()
  mats = blockMaterials()
  private heights = new Int8Array(WORLD_HALF * 2 * WORLD_HALF * 2)
  private clouds: { mesh: THREE.Mesh; speed: number }[] = []
  private rng = mulberry32(1337)
  fogGate: THREE.Mesh | null = null

  constructor() {
    this.genHeightmap()
    this.buildTerrain()
    this.buildWalls()
    this.buildTrees()
    this.buildRuins()
    this.buildBonfireBase()
    this.buildBossArena()
    this.buildFogGate()
    this.buildSky()
  }

  /* ---------- heightmap ---------- */
  private idx(x: number, z: number) {
    const bx = Math.min(WORLD_HALF * 2 - 1, Math.max(0, x + WORLD_HALF))
    const bz = Math.min(WORLD_HALF * 2 - 1, Math.max(0, z + WORLD_HALF))
    return bz * WORLD_HALF * 2 + bx
  }

  private genHeightmap() {
    const r = mulberry32(2024)
    // gentle noise offsets
    const o1 = r() * 10, o2 = r() * 10, o3 = r() * 10
    for (let z = -WORLD_HALF; z < WORLD_HALF; z++) {
      for (let x = -WORLD_HALF; x < WORLD_HALF; x++) {
        let h =
          2 +
          Math.sin(x * 0.13 + o1) * Math.cos(z * 0.11 + o2) * 1.7 +
          Math.sin(x * 0.29 + o2) * Math.sin(z * 0.23 + o3) * 0.9 +
          Math.sin((x + z) * 0.055 + o1) * 1.1
        h = Math.round(h)
        // flatten bonfire area
        const dB = Math.hypot(x - BONFIRE.x, z - BONFIRE.z)
        if (dB < 7) h = Math.round(lerp(2, h, smoothstep(3.5, 7, dB)))
        // flatten boss arena
        const dA = Math.hypot(x - BOSS_CENTER.x, z - BOSS_CENTER.z)
        if (dA < 9.5) h = Math.round(lerp(2, h, smoothstep(6, 9.5, dA)))
        this.heights[this.idx(x, z)] = Math.max(0, Math.min(6, h))
      }
    }
  }

  getH(x: number, z: number): number {
    return this.heights[this.idx(Math.round(x), Math.round(z))]
  }

  /** walking surface y (top face of the top block) */
  surfaceAt(x: number, z: number): number {
    return this.getH(x, z) + 1
  }

  /* ---------- terrain ---------- */
  private put(list: Vec3Lite[], x: number, y: number, z: number) {
    list.push({ x, y, z })
  }

  private buildInstanced(mat: THREE.Material | THREE.Material[], transforms: Vec3Lite[]) {
    if (transforms.length === 0) return
    const geo = new THREE.BoxGeometry(1, 1, 1)
    const mesh = new THREE.InstancedMesh(geo, mat, transforms.length)
    const d = new THREE.Object3D()
    for (let i = 0; i < transforms.length; i++) {
      d.position.set(transforms[i].x, transforms[i].y, transforms[i].z)
      d.updateMatrix()
      mesh.setMatrixAt(i, d.matrix)
    }
    mesh.instanceMatrix.needsUpdate = true
    mesh.castShadow = true
    mesh.receiveShadow = true
    mesh.frustumCulled = true
    this.group.add(mesh)
  }

  /** build one InstancedMesh per (chunk, material) so frustum culling works */
  private buildChunked(batch: Map<string, Record<string, Vec3Lite[]>>) {
    for (const mats of batch.values()) {
      for (const [matKey, list] of Object.entries(mats)) {
        const mat = this.mats[matKey]
        if (mat && list.length > 0) this.buildInstanced(mat, list)
      }
    }
  }

  private chunkKey(x: number, z: number) {
    const cs = 8
    return `${Math.floor(x / cs)}_${Math.floor(z / cs)}`
  }

  private buildTerrain() {
    // hidden-block culling: only render lower layers whose side face is exposed
    const exposed = (x: number, z: number, y: number) => {
      const n: [number, number][] = [[x + 1, z], [x - 1, z], [x, z + 1], [x, z - 1]]
      for (const [nx, nz] of n) {
        if (nx < -WORLD_HALF || nx >= WORLD_HALF || nz < -WORLD_HALF || nz >= WORLD_HALF) return true
        if (this.heights[this.idx(nx, nz)] < y) return true
      }
      return false
    }
    const batch = new Map<string, Record<string, Vec3Lite[]>>()
    const put2 = (x: number, y: number, z: number, matKey: string) => {
      const k = this.chunkKey(x, z)
      if (!batch.has(k)) batch.set(k, {})
      const mats = batch.get(k)!
      if (!mats[matKey]) mats[matKey] = []
      mats[matKey].push({ x, y, z })
    }
    for (let z = -WORLD_HALF; z < WORLD_HALF; z++) {
      for (let x = -WORLD_HALF; x < WORLD_HALF; x++) {
        const h = this.heights[this.idx(x, z)]
        const dA = Math.hypot(x - BOSS_CENTER.x, z - BOSS_CENTER.z)
        const isPath = Math.abs(x) <= 1 && z > GATE_Z && z < BONFIRE.z + 1
        if (dA < 8.5) {
          put2(x, h + 0.5, z, 'stonebrick')
        } else if (isPath) {
          put2(x, h + 0.5, z, 'dirt')
        } else {
          put2(x, h + 0.5, z, 'grass')
        }
        if (h - 1 >= -1 && exposed(x, z, h - 1)) put2(x, h - 0.5, z, 'dirt')
        if (h - 2 >= -1 && exposed(x, z, h - 2)) put2(x, h - 1.5, z, 'dirt')
        if (h - 3 >= -3 && exposed(x, z, h - 3)) put2(x, h - 2.5, z, 'stone')
      }
    }
    this.buildChunked(batch)
  }

  private buildWalls() {
    const cobble: Vec3Lite[] = []
    const edge = (x: number, z: number) => {
      const h = this.heights[this.idx(x, z)]
      const top = 5 + Math.floor(this.rng() * 2)
      for (let y = 1; y <= top; y++) this.put(cobble, x, h + y - 0.5 + 1, z)
    }
    for (let i = -WORLD_HALF; i < WORLD_HALF; i++) {
      edge(i, -WORLD_HALF)
      edge(i, WORLD_HALF - 1)
      edge(-WORLD_HALF, i)
      edge(WORLD_HALF - 1, i)
    }
    this.buildInstanced(this.mats.cobble, cobble)
  }

  private buildTrees() {
    const log: Vec3Lite[] = [], leaves: Vec3Lite[] = []
    const spots: [number, number][] = [
      [-20, -2], [18, 5], [-15, 12], [21, -13], [-21, -16], [14, 21], [-9, 21], [24, 15],
    ]
    for (const [tx, tz] of spots) {
      const h = this.heights[this.idx(tx, tz)]
      const trunkH = 4 + Math.floor(this.rng() * 2)
      for (let y = 1; y <= trunkH; y++) this.put(log, tx, h + y - 0.5 + 1, tz)
      const topY = h + trunkH + 1
      for (let dy = 0; dy < 2; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          for (let dz = -1; dz <= 1; dz++) {
            if (dx === 0 && dz === 0 && dy === 0) continue
            if (Math.abs(dx) === 1 && Math.abs(dz) === 1 && this.rng() < 0.35) continue
            this.put(leaves, tx + dx, topY + dy + 0.5, tz + dz)
          }
        }
      }
      this.put(leaves, tx, topY + 2.5, tz)
    }
    this.buildInstanced(this.mats.log, log)
    this.buildInstanced(this.mats.leaves, leaves)
  }

  private buildRuins() {
    const cobble: Vec3Lite[] = []
    const pillar = (x: number, z: number, hgt: number) => {
      const h = this.heights[this.idx(x, z)]
      for (let y = 1; y <= hgt; y++) this.put(cobble, x, h + y - 0.5 + 1, z)
    }
    pillar(9, 6, 3); pillar(10, 6, 2); pillar(9, 7, 2)
    pillar(-10, 2, 3); pillar(-10, 3, 1)
    pillar(12, -6, 2); pillar(13, -7, 3)
    pillar(-14, -8, 2); pillar(-13, -8, 3)
    // fallen blocks
    for (let i = 0; i < 14; i++) {
      const x = Math.floor(this.rng() * 40) - 20
      const z = Math.floor(this.rng() * 30) - 12
      const h = this.heights[this.idx(x, z)]
      if (Math.hypot(x - BONFIRE.x, z - BONFIRE.z) < 5) continue
      if (Math.abs(x) <= 2) continue
      this.put(cobble, x, h + 0.5 + 1, z)
    }
    this.buildInstanced(this.mats.cobble, cobble)
  }

  private buildBonfireBase() {
    const cobble: Vec3Lite[] = []
    const coal: Vec3Lite[] = []
    const h = this.heights[this.idx(BONFIRE.x, BONFIRE.z)]
    // flat stone ring
    for (let a = 0; a < 8; a++) {
      const ang = (a / 8) * Math.PI * 2
      const x = Math.round(BONFIRE.x + Math.cos(ang) * 1.7)
      const z = Math.round(BONFIRE.z + Math.sin(ang) * 1.7)
      this.put(cobble, x, h + 0.5, z)
    }
    this.put(coal, BONFIRE.x, h + 0.5, BONFIRE.z)
    this.buildInstanced(this.mats.cobble, cobble)
    this.buildInstanced(this.mats.coal, coal)
  }

  private buildBossArena() {
    const deco: Vec3Lite[] = []
    const glow: Vec3Lite[] = []
    const h = this.heights[this.idx(BOSS_CENTER.x, BOSS_CENTER.z)]
    const pillar = (x: number, z: number) => {
      for (let y = 1; y <= 4; y++) this.put(deco, x, h + y - 0.5 + 1, z)
      this.put(glow, x, h + 4.5 + 1, z)
    }
    pillar(-8, -24); pillar(8, -24); pillar(-8, -12); pillar(8, -12)
    // gate posts
    pillar(-3, GATE_Z); pillar(3, GATE_Z)
    this.buildInstanced(this.mats.stonebrick, deco)
    this.buildInstanced(this.mats.glow, glow)
  }

  private buildFogGate() {
    const h = this.heights[this.idx(0, GATE_Z)]
    const geo = new THREE.PlaneGeometry(5.6, 4.4)
    const mesh = new THREE.Mesh(geo, this.mats.fog)
    mesh.position.set(0, h + 3.2, GATE_Z)
    this.group.add(mesh)
    this.fogGate = mesh
  }

  /* ---------- sky ---------- */
  private buildSky() {
    // square minecraft moon
    const moon = new THREE.Mesh(
      new THREE.BoxGeometry(4, 4, 0.4),
      new THREE.MeshBasicMaterial({ color: 0xf2f0e4 })
    )
    moon.position.set(22, 34, -50)
    moon.lookAt(0, 0, 0)
    this.group.add(moon)

    // stars
    const starCount = 260
    const pos = new Float32Array(starCount * 3)
    const r = mulberry32(99)
    for (let i = 0; i < starCount; i++) {
      const theta = r() * Math.PI * 2
      const phi = Math.acos(r() * 0.85)
      const rad = 110
      pos[i * 3] = rad * Math.sin(phi) * Math.cos(theta)
      pos[i * 3 + 1] = rad * Math.cos(phi) + 8
      pos[i * 3 + 2] = rad * Math.sin(phi) * Math.sin(theta)
    }
    const starGeo = new THREE.BufferGeometry()
    starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    const stars = new THREE.Points(
      starGeo,
      new THREE.PointsMaterial({ color: 0xdfe6ef, size: 0.8, sizeAttenuation: true, fog: false })
    )
    this.group.add(stars)

    // blocky clouds
    const cloudMat = new THREE.MeshLambertMaterial({
      color: 0xffffff, transparent: true, opacity: 0.55,
    })
    for (let i = 0; i < 12; i++) {
      const w = 6 + r() * 8
      const d = 4 + r() * 5
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, 0.7, d), cloudMat)
      mesh.position.set(r() * 90 - 45, 20 + r() * 5, r() * 90 - 45)
      this.clouds.push({ mesh, speed: 0.4 + r() * 0.7 })
      this.group.add(mesh)
    }
  }

  update(dt: number) {
    for (const c of this.clouds) {
      c.mesh.position.x += c.speed * dt
      if (c.mesh.position.x > 50) c.mesh.position.x = -50
    }
    if (this.fogGate) {
      const mat = this.fogGate.material as THREE.MeshBasicMaterial
      if (mat.map) {
        mat.map.offset.x = (mat.map.offset.x + dt * 0.06) % 1
        mat.map.offset.y = (mat.map.offset.y + dt * 0.045) % 1
      }
    }
  }

  setFogGateVisible(v: boolean) {
    if (this.fogGate) this.fogGate.visible = v
  }
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

function smoothstep(e0: number, e1: number, x: number) {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)))
  return t * t * (3 - 2 * t)
}
