import * as THREE from 'three'
import { blockMaterials, mulberry32, createFogMaterial } from './textures'

export const WORLD_HALF = 30 // blocks range from -30..29
export const BONFIRE = { x: 0, z: 14 }
/** the grey merchant pitches his stall behind the bonfire — south side,
    inside the safe ring and far from every patrol route */
export const MERCHANT = { x: -2.7, z: 18.4 }
export const BOSS_CENTER = { x: 0, z: -18 }
export const GATE_Z = -10
export const BOSS_ARENA = { minX: -8, maxX: 8, minZ: -23.5, maxZ: GATE_Z + 0.2 }

/* ---- the Ash Wastes: a scorched land east of the great wall ---- */
export const ASH_WALL_X = 11 // wall column; only the fog-gate corridor pierces it
export const GATE2 = { x: ASH_WALL_X, z: 18 }
export const BOSS2_CENTER = { x: 21, z: 18 }
export const PYRO_ITEM = { x: 13.5, z: 21.5 }
export const LAVA_POOLS: { x0: number; z0: number; x1: number; z1: number }[] = [
  { x0: 15, z0: 2, x1: 17, z1: 3 },
  { x0: 25, z0: 26, x1: 26, z1: 27 },
  { x0: 24, z0: 6, x1: 25, z1: 7 },
]

interface Vec3Lite { x: number; y: number; z: number }

export class World {
  group = new THREE.Group()
  mats = blockMaterials()
  private heights = new Int8Array(WORLD_HALF * 2 * WORLD_HALF * 2)
  private clouds: { mesh: THREE.Mesh; speed: number }[] = []
  private rng = mulberry32(1337)
  /** every fog curtain plane: which gate, its own clock, and drift speed */
  private fogLayers: { mesh: THREE.Mesh; gate: 1 | 2; t: number; sx: number; sy: number }[] = []

  constructor() {
    this.genHeightmap()
    this.buildTerrain()
    this.buildWalls()
    this.buildAshWall()
    this.buildTrees()
    this.buildDeadTrees()
    this.buildShrine()
    this.buildVillage()
    this.buildGraveyard()
    this.buildArcherRise()
    this.buildTempleApproach()
    this.buildAshDecor()
    this.buildRuins()
    this.buildBonfireBase()
    this.buildMerchantSpot()
    this.buildBossArena()
    this.buildBoss2Arena()
    this.buildFogGate()
    this.buildGate2()
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
        // flatten boss arena
        const dA = Math.hypot(x - BOSS_CENTER.x, z - BOSS_CENTER.z)
        if (dA < 9.5) h = Math.round(lerp(2, h, smoothstep(6, 9.5, dA)))
        // flatten the Flame King's arena + its approach corridor
        const dA2 = Math.hypot(x - BOSS2_CENTER.x, z - BOSS2_CENTER.z)
        if (dA2 < 9.5) h = Math.round(lerp(2, h, smoothstep(6, 9.5, dA2)))
        const dG = Math.abs(z - GATE2.z)
        if (x >= ASH_WALL_X - 1 && x <= ASH_WALL_X + 3 && dG < 3) {
          h = Math.round(lerp(2, h, smoothstep(1.5, 3, dG)))
        }
        /* ---- designed districts: every land keeps its own floor ---- */
        // the Forgotten Village — two terraces west of the shrine path
        h = this.plate(x, z, -25, -15, 2, 11, 2, 2.4, h)   // lower terrace
        h = this.plate(x, z, -25, -15, -6, 0, 3, 2.4, h)   // upper terrace
        // the Graveyard — a quiet plateau south-west of the shrine
        // (south of the fog-gate seal, so it is reachable from the start)
        h = this.plate(x, z, -22, -13, 17, 25, 3, 2.2, h)
        // the Watcher's Rise — a palisaded shelf south-east
        h = this.plate(x, z, 4, 10, 18, 24, 4, 2.4, h)
        // flatten bonfire area LAST so the hub stays clean
        const dB = Math.hypot(x - BONFIRE.x, z - BONFIRE.z)
        if (dB < 7) h = Math.round(lerp(2, h, smoothstep(3.5, 7, dB)))
        // flatten the merchant's shop corner behind the bonfire
        const dM = Math.hypot(x - MERCHANT.x, z - MERCHANT.z)
        if (dM < 3.2) h = 2
        else if (dM < 4.6) h = Math.round(lerp(2, h, smoothstep(3.2, 4.6, dM)))
        this.heights[this.idx(x, z)] = Math.max(0, Math.min(6, h))
      }
    }
    // lava pools sit in shallow craters
    for (const p of LAVA_POOLS) {
      for (let x = p.x0 - 1; x <= p.x1 + 1; x++) {
        for (let z = p.z0 - 1; z <= p.z1 + 1; z++) {
          if (x >= p.x0 && x <= p.x1 && z >= p.z0 && z <= p.z1) {
            this.heights[this.idx(x, z)] = 2
          }
        }
      }
    }
  }

  /** raise a rectangular district to `target` with a soft `feather` skirt */
  private plate(
    x: number, z: number, x0: number, x1: number, z0: number, z1: number,
    target: number, feather: number, h: number
  ): number {
    const dx = Math.max(x0 - x, x - x1, 0)
    const dz = Math.max(z0 - z, z - z1, 0)
    const d = Math.hypot(dx, dz)
    if (d <= 0) return target
    if (d >= feather) return h
    return lerp(target, h, smoothstep(0, feather, d))
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
        const dA2 = Math.hypot(x - BOSS2_CENTER.x, z - BOSS2_CENTER.z)
        const dHB = Math.hypot(x - BONFIRE.x, z - BONFIRE.z)
        const isPath = Math.abs(x) <= 1 && z > GATE_Z && z < BONFIRE.z + 1
        const isPath2 = z >= 17 && z <= 19 && x >= ASH_WALL_X
        const isPathV = z >= 8 && z <= 10 && x >= -14 && x <= -1   // village branch
        const isPathG = x >= -14 && x <= -2 && z >= 16 && z <= 17 // graveyard branch (south-west)
        const isPathA = x >= 1 && x <= 5 && z >= 17 && z <= 18      // watcher's rise branch
        const lavaCell = LAVA_POOLS.some((p) => x >= p.x0 && x <= p.x1 && z >= p.z0 && z <= p.z1)
        // the Cinder Shrine floor: cracked tiles with mossy seams
        const shrineTile = dHB < 6.0 && ((x * 7 + z * 5) % 11) !== 0
        const shrineRim = dHB >= 6.0 && dHB < 6.9
        if (lavaCell) {
          put2(x, h + 0.51, z, 'lava')
        } else if (dA < 8.5 || dA2 < 8.5) {
          put2(x, h + 0.5, z, 'stonebrick')
        } else if (shrineTile) {
          put2(x, h + 0.5, z, 'stonebrick')
        } else if (shrineRim) {
          put2(x, h + 0.5, z, 'mossy')
        } else if (isPath || isPathV || isPathG || isPathA) {
          put2(x, h + 0.5, z, 'dirt')
        } else if (isPath2) {
          put2(x, h + 0.5, z, 'stonebrick')
        } else if (x >= ASH_WALL_X) {
          put2(x, h + 0.5, z, 'nether')
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

  /** the great wall between the green hollow and the Ash Wastes —
      only a narrow corridor at the fog gate pierces it */
  private buildAshWall() {
    const cobble: Vec3Lite[] = []
    const stone: Vec3Lite[] = []
    for (let z = -WORLD_HALF; z < WORLD_HALF; z++) {
      if (z >= 16 && z <= 20) continue // gate opening
      const h = this.heights[this.idx(ASH_WALL_X, z)]
      const top = 4 + Math.floor(this.rng() * 2)
      for (let y = 1; y <= top; y++) this.put(cobble, ASH_WALL_X, h + y - 0.5 + 1, z)
      if (z % 3 === 0) this.put(stone, ASH_WALL_X, h + top + 0.5 + 1, z) // battlement caps
    }
    this.buildInstanced(this.mats.cobble, cobble)
    this.buildInstanced(this.mats.stone, stone)
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
      [-20, -2], [-15, 12], [-21, -16], [-9, 21],
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

  /** burnt, leafless trunks scattered through the Ash Wastes */
  private buildDeadTrees() {
    const log: Vec3Lite[] = []
    const spots: [number, number][] = [
      [16, 13], [26, 2], [19, 27], [25, 21], [15, 26], [22, -6],
    ]
    for (const [tx, tz] of spots) {
      const h = this.heights[this.idx(tx, tz)]
      const trunkH = 3 + Math.floor(this.rng() * 2)
      for (let y = 1; y <= trunkH; y++) this.put(log, tx, h + y - 0.5 + 1, tz)
      // one or two bare branches
      this.put(log, tx + 1, h + trunkH - 0.5 + 1, tz)
      if (this.rng() < 0.6) this.put(log, tx - 1, h + trunkH - 1 - 0.5 + 1, tz)
    }
    this.buildInstanced(this.mats.log, log)
  }

  /* ================= STORY ARCHITECTURE =================
     every district is a designed set, not noise: the shrine
     reads as a ruined temple, the village as an abandoned
     build-site, the graveyard as someone's unfinished work */

  /** the Cinder Shrine — a broken colonnade ring around the last bonfire,
      with kneeling statues flanking the north exit */
  private buildShrine() {
    const stonebrick: Vec3Lite[] = []
    const glow: Vec3Lite[] = []
    const stone: Vec3Lite[] = []
    const mossy: Vec3Lite[] = []
    // colonnade: 10 pillars on a r=6.6 ring (the shop corner stays open)
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2
      const px = Math.round(BONFIRE.x + Math.cos(a) * 6.6)
      const pz = Math.round(BONFIRE.z + Math.sin(a) * 6.6)
      if (Math.hypot(px - MERCHANT.x, pz - MERCHANT.z) < 4.4) continue
      const h = this.heights[this.idx(px, pz)]
      const tall = 2 + Math.floor(this.rng() * 3) // broken tops vary
      for (let y = 1; y <= tall; y++) this.put(stonebrick, px, h + y - 0.5 + 1, pz)
      if (i % 3 === 0) this.put(glow, px, h + tall + 0.5 + 1, pz) // lantern caps
      this.put(mossy, px + (this.rng() < 0.5 ? 1 : -1), h + 1.5, pz) // sunken slab
    }
    // two kneeling statues flank the north exit toward the fog gate
    const statue = (sx: number, sz: number) => {
      const h = this.heights[this.idx(sx, sz)]
      this.put(mossy, sx, h + 1.5, sz)       // plinth
      this.put(stonebrick, sx, h + 2.5, sz)  // torso
      this.put(stone, sx, h + 3.5, sz)       // bowed head
    }
    statue(-2, 8)
    statue(2, 8)
    this.buildInstanced(this.mats.stonebrick, stonebrick)
    this.buildInstanced(this.mats.glow, glow)
    this.buildInstanced(this.mats.stone, stone)
    this.buildInstanced(this.mats.mossy, mossy)
  }

  /** the Forgotten Village — hollow builders kept building until they didn't */
  private buildVillage() {
    const cobble: Vec3Lite[] = []
    const plank: Vec3Lite[] = []
    const log: Vec3Lite[] = []
    const coal: Vec3Lite[] = []
    const leaves: Vec3Lite[] = []

    /** a ruined house: plank floor, crumbling cobble walls around a door
        hole, a broken half-roof. `ruin` 0..1 = how much of the top is gone */
    const house = (
      x0: number, z0: number, w: number, d: number,
      doorX: number, doorZ: number, ruin: number
    ) => {
      const cx = x0 + (w >> 1), cz = z0 + (d >> 1)
      const h = this.heights[this.idx(cx, cz)]
      // interior plank floor (raised one step, minecraft-style)
      for (let x = x0 + 1; x < x0 + w - 1; x++)
        for (let z = z0 + 1; z < z0 + d - 1; z++) this.put(plank, x, h + 1.5, z)
      this.put(plank, doorX, h + 1.5, doorZ) // threshold
      const hasRoof = this.rng() < 0.8
      const wallTop = hasRoof ? 2 : this.rng() < 0.5 ? 3 : 2
      // north/south walls
      for (let x = x0; x < x0 + w; x++) {
        for (const z of [z0, z0 + d - 1]) {
          if (x === doorX && z === doorZ) continue
          for (let y = 1; y <= wallTop; y++) {
            if (y === 2 && x !== doorX && this.rng() < 0.16) continue // window hole
            if (y === wallTop && this.rng() < ruin) continue         // crumbled
            this.put(cobble, x, h + y - 0.5 + 1, z)
          }
        }
      }
      // west/east walls
      for (let z = z0 + 1; z < z0 + d - 1; z++) {
        for (const x of [x0, x0 + w - 1]) {
          if (x === doorX && z === doorZ) continue
          for (let y = 1; y <= wallTop; y++) {
            if (y === 2 && this.rng() < 0.16) continue
            if (y === wallTop && this.rng() < ruin) continue
            this.put(cobble, x, h + y - 0.5 + 1, z)
          }
        }
      }
      // half-collapsed roof along one long edge
      if (hasRoof) {
        const rz = z0 + (this.rng() < 0.5 ? 0 : d - 1)
        const rx0 = x0 + Math.floor(this.rng() * 2)
        const rx1 = x0 + w - 1 - Math.floor(this.rng() * 2)
        for (let x = rx0; x <= rx1; x++) this.put(plank, x, h + 3.5, rz)
      }
    }

    // lower terrace (h=2): two cottages, a barn, the square
    house(-24, 3, 4, 4, -21, 6, 0.45)   // westmost cottage
    house(-18, 3, 4, 4, -15, 5, 0.35)   // corner cottage
    house(-24, 8, 4, 3, -21, 8, 0.65)   // collapsed barn
    // upper terrace (h=3): two homes facing the drop
    house(-24, -5, 4, 4, -21, -2, 0.5)
    house(-18, -6, 4, 4, -15, -3, 0.55)

    // the well at the square — the bucket rope rotted years ago
    const wx = -19, wz = 9
    const hw = this.heights[this.idx(wx, wz)]
    for (const [dx, dz] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [-1, 1], [1, -1], [1, 1]] as [number, number][])
      this.put(cobble, wx + dx, hw + 1.5, wz + dz)
    this.put(coal, wx, hw + 1.2, wz) // the dark, still water
    this.put(log, wx - 1, hw + 2.5, wz - 1)
    this.put(log, wx + 1, hw + 2.5, wz - 1)
    for (let x = wx - 1; x <= wx + 1; x++) this.put(plank, x, hw + 3.6, wz - 1)

    // fence along the terrace's south lip + an extinguished lantern post
    for (let x = -24; x <= -16; x += 2) this.put(log, x, this.heights[this.idx(x, 11)] + 1.5, 11)
    this.put(log, -20, this.heights[this.idx(-20, 11)] + 1.5, 11)
    this.put(log, -20, this.heights[this.idx(-20, 11)] + 2.5, 11)
    this.put(coal, -20, this.heights[this.idx(-20, 11)] + 3.5, 11) // lantern gone out

    // a toppled cart by the road
    this.put(log, -13, this.heights[this.idx(-13, 4)] + 1.5, 4)
    this.put(log, -12, this.heights[this.idx(-12, 4)] + 1.5, 4)
    this.put(cobble, -14, this.heights[this.idx(-14, 4)] + 1.5, 4) // wheel
    this.put(cobble, -11, this.heights[this.idx(-11, 4)] + 1.5, 4) // wheel

    // overgrown hedges swallowing the paths
    const bush: [number, number][] = [[-25, 6], [-15, 10], [-16, 1], [-25, -3], [-14, 12]]
    for (const [bx, bz] of bush) this.put(leaves, bx, this.heights[this.idx(bx, bz)] + 1.5, bz)

    this.buildInstanced(this.mats.cobble, cobble)
    this.buildInstanced(this.mats.plank, plank)
    this.buildInstanced(this.mats.log, log)
    this.buildInstanced(this.mats.coal, coal)
    this.buildInstanced(this.mats.leaves, leaves)
  }

  /** the Graveyard — rows someone kept digging until the stone ran out;
      it rests south-west of the shrine, where the last builder buried his brother */
  private buildGraveyard() {
    const cobble: Vec3Lite[] = []
    const stonebrick: Vec3Lite[] = []
    const stone: Vec3Lite[] = []
    const mossy: Vec3Lite[] = []
    const log: Vec3Lite[] = []

    // low enclosure wall; stone posts at the corners; gate gap faces the path
    for (let x = -22; x <= -13; x++) {
      for (const z of [17, 25]) this.put(cobble, x, this.heights[this.idx(x, z)] + 1.5, z)
    }
    for (let z = 17; z <= 25; z++) {
      if (z >= 19 && z <= 20) continue // the gate
      this.put(cobble, -13, this.heights[this.idx(-13, z)] + 1.5, z)
      this.put(cobble, -22, this.heights[this.idx(-22, z)] + 1.5, z)
    }
    for (const [cx, cz] of [[-22, 17], [-13, 17], [-22, 25], [-13, 25]] as [number, number][]) {
      this.put(stonebrick, cx, this.heights[this.idx(cx, cz)] + 1.5, cz)
      this.put(stonebrick, cx, this.heights[this.idx(cx, cz)] + 2.5, cz)
    }

    // two rows of graves; some headstones missing, some slabs sunken
    let gi = 0
    for (const gz of [19, 22]) {
      for (const gx of [-20, -18, -16, -14]) {
        const h = this.heights[this.idx(gx, gz)]
        this.put(gi % 3 === 0 ? mossy : stone, gx, h + 1.5, gz)
        if (gi % 4 !== 1) this.put(stonebrick, gx, h + 2.5, gz) // missing sometimes
        gi++
      }
    }
    // the mourner — a statue that kept vigil here
    const sx = -17, sz = 21
    const hs = this.heights[this.idx(sx, sz)]
    this.put(mossy, sx, hs + 1.5, sz)
    this.put(stonebrick, sx, hs + 2.5, sz)
    this.put(stone, sx, hs + 3.5, sz)

    // two bare trees leaning over the fence
    for (const [tx, tz] of [[-21, 18], [-14, 24]] as [number, number][]) {
      const h = this.heights[this.idx(tx, tz)]
      const th = 3 + Math.floor(this.rng() * 2)
      for (let y = 1; y <= th; y++) this.put(log, tx, h + y - 0.5 + 1, tz)
      this.put(log, tx + 1, h + th - 0.5 + 1, tz)
    }

    this.buildInstanced(this.mats.cobble, cobble)
    this.buildInstanced(this.mats.stonebrick, stonebrick)
    this.buildInstanced(this.mats.stone, stone)
    this.buildInstanced(this.mats.mossy, mossy)
    this.buildInstanced(this.mats.log, log)
  }

  /** the Watcher's Rise — a palisaded shelf where the last archer keeps an oath */
  private buildArcherRise() {
    const log: Vec3Lite[] = []
    const plank: Vec3Lite[] = []
    const stone: Vec3Lite[] = []
    const glow: Vec3Lite[] = []

    // palisade along the north lip; a walking gap (x=6..7) and one arrow slit (x=9)
    for (let x = 4; x <= 10; x++) {
      if (x === 6 || x === 7) continue
      const h = this.heights[this.idx(x, 18)]
      this.put(log, x, h + 1.5, 18)
      if (x !== 9) this.put(log, x, h + 2.5, 18) // the slit leaves the bottom open
    }

    // the watchtower: four legs, a plank platform, a lantern that still burns
    const tw = this.heights[this.idx(9, 22)]
    for (const [lx, lz] of [[8, 21], [10, 21], [8, 23], [10, 23]] as [number, number][]) {
      for (let y = 1; y <= 3; y++) this.put(log, lx, tw + y - 0.5 + 1, lz)
    }
    for (let x = 8; x <= 10; x++) for (let z = 21; z <= 23; z++) this.put(plank, x, tw + 4.5, z)
    for (const [rx, rz] of [[8, 21], [10, 21], [8, 23], [10, 23]] as [number, number][]) {
      this.put(log, rx, tw + 5.5, rz)
    }
    this.put(glow, 9, tw + 5.6, 22) // the oath-fire, kept lit

    // a practice dummy near the palisade, studded with old arrows
    const dh = this.heights[this.idx(5, 20)]
    this.put(log, 5, dh + 1.5, 20)
    this.put(log, 5, dh + 2.5, 20)
    this.put(stone, 5, dh + 3.4, 20)

    this.buildInstanced(this.mats.log, log)
    this.buildInstanced(this.mats.plank, plank)
    this.buildInstanced(this.mats.stone, stone)
    this.buildInstanced(this.mats.glow, glow)
  }

  /** the Temple Approach — a broken avenue of columns leading to the knight */
  private buildTempleApproach() {
    const stonebrick: Vec3Lite[] = []
    const cobble: Vec3Lite[] = []
    const glow: Vec3Lite[] = []

    // two rows of broken columns, heights decay as they near the gate
    const cols: [number, number, number][] = [
      [-4, -3, 3], [4, -3, 2], [-4, -5, 1], [4, -5, 3], [-4, -7, 2], [4, -7, 1],
    ]
    for (const [cx, cz, hgt] of cols) {
      const h = this.heights[this.idx(cx, cz)]
      for (let y = 1; y <= hgt; y++) this.put(stonebrick, cx, h + y - 0.5 + 1, cz)
      if (hgt >= 3) this.put(glow, cx, h + hgt + 0.5 + 1, cz) // two still burn
    }
    // fallen drums scattered in the grass
    for (const [fx, fz] of [[6, -4], [-6, -6], [5, -8], [-6, -3]] as [number, number][]) {
      this.put(cobble, fx, this.heights[this.idx(fx, fz)] + 1.5, fz)
    }
    // braziers flanking the path before the fog gate
    for (const bx of [-2, 2]) {
      const h = this.heights[this.idx(bx, -9)]
      this.put(stonebrick, bx, h + 1.5, -9)
      this.put(stonebrick, bx, h + 2.5, -9)
      this.put(glow, bx, h + 3.5, -9)
    }
    this.buildInstanced(this.mats.stonebrick, stonebrick)
    this.buildInstanced(this.mats.cobble, cobble)
    this.buildInstanced(this.mats.glow, glow)
  }

  /** the Ash Wastes' ruins — collapsed forge stacks breathing embers */
  private buildAshDecor() {
    const cobble: Vec3Lite[] = []
    const glow: Vec3Lite[] = []
    const coal: Vec3Lite[] = []
    const stack = (x0: number, z0: number, hs: number[]) => {
      let i = 0
      for (let dx = 0; dx < 2; dx++) {
        for (let dz = 0; dz < 2; dz++) {
          const hgt = hs[i++ % hs.length]
          const h = this.heights[this.idx(x0 + dx, z0 + dz)]
          for (let y = 1; y <= hgt; y++) this.put(cobble, x0 + dx, h + y - 0.5 + 1, z0 + dz)
          if (hgt >= 3) this.put(glow, x0 + dx, h + hgt + 0.5 + 1, z0 + dz)
        }
      }
    }
    stack(19, 7, [3, 2, 2, 1])
    stack(25, 25, [2, 2, 1, 0])
    for (const [cx, cz] of [[14, 12], [22, 7], [27, 17], [22, 29], [15, 22], [26, 12]] as [number, number][]) {
      this.put(coal, cx, this.heights[this.idx(cx, cz)] + 1.5, cz)
    }
    this.buildInstanced(this.mats.cobble, cobble)
    this.buildInstanced(this.mats.glow, glow)
    this.buildInstanced(this.mats.coal, coal)
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
    // fallen blocks — never inside the designed districts
    const inDistrict = (x: number, z: number) =>
      (x >= -25 && x <= -13 && z >= -6 && z <= 12) || // village + road
      (x >= -22 && x <= -12 && z >= 16 && z <= 25) || // graveyard
      (x >= 3 && x <= 11 && z >= 17 && z <= 25) || // watcher's rise
      (Math.abs(x) <= 3 && z >= -10 && z <= 12) // shrine + temple avenue
    for (let i = 0; i < 14; i++) {
      const x = Math.floor(this.rng() * 40) - 20
      const z = Math.floor(this.rng() * 30) - 12
      const h = this.heights[this.idx(x, z)]
      if (inDistrict(x, z)) continue
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

  /** the merchant's shop corner behind the bonfire — paved plaza, wall
      stones framing it, lantern posts and stacked wares for atmosphere */
  private buildMerchantSpot() {
    const plaza: Vec3Lite[] = []
    const frame: Vec3Lite[] = []
    const h = this.heights[this.idx(MERCHANT.x, MERCHANT.z)]
    // paved floor: a 5x4 stone patch under the whole stall area
    for (let x = Math.floor(MERCHANT.x) - 2; x <= Math.floor(MERCHANT.x) + 2; x++) {
      for (let z = Math.floor(MERCHANT.z) - 2; z <= Math.floor(MERCHANT.z) + 2; z++) {
        if (Math.abs(x - MERCHANT.x) > 2.4 || Math.abs(z - MERCHANT.z) > 2.2) continue
        this.put(plaza, x, h + 0.5, z)
      }
    }
    // low stone-brick rim framing the shop corner's west + south edges
    const rim: [number, number][] = []
    for (let z = 17; z <= 20; z++) rim.push([-6, z])
    for (let x = -5; x <= -1; x++) rim.push([x, 21])
    for (const [x, z] of rim) this.put(frame, x, this.getH(x, z) + 1.5, z)
    this.buildInstanced(this.mats.cobble, plaza)
    this.buildInstanced(this.mats.stonebrick, frame)
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

  /** the Flame King's arena — scorched pillars around a flat stone floor */
  private buildBoss2Arena() {
    const deco: Vec3Lite[] = []
    const glow: Vec3Lite[] = []
    const h = this.heights[this.idx(BOSS2_CENTER.x, BOSS2_CENTER.z)]
    const pillar = (x: number, z: number) => {
      for (let y = 1; y <= 4; y++) this.put(deco, x, h + y - 0.5 + 1, z)
      this.put(glow, x, h + 4.5 + 1, z)
    }
    pillar(14, 11); pillar(28, 11); pillar(14, 25); pillar(28, 25)
    // gate posts on the corridor
    pillar(ASH_WALL_X, 15); pillar(ASH_WALL_X, 21)
    this.buildInstanced(this.mats.stonebrick, deco)
    this.buildInstanced(this.mats.glow, glow)
  }

  private buildFogGate() {
    const h = this.heights[this.idx(0, GATE_Z)]
    /* three live-GPU smoke curtains, slightly offset in depth so the
       parallax makes the fog feel like a volume instead of a poster.
       Each has its own seed, scale and drift → they never sync up. */
    const addLayer = (
      w: number, hh: number, z: number, gate: 1 | 2,
      seed: number, scale: [number, number], drift: [number, number], opacity: number
    ) => {
      const mat = createFogMaterial({ seed, scale, drift, opacity })
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, hh), mat)
      mesh.position.set(0, h + 2.85, z)
      this.group.add(mesh)
      this.fogLayers.push({ mesh, gate, t: seed * 7, sx: drift[0], sy: drift[1] })
    }
    const S = 6.0, W = 6.4 // main wall / wider echo curtains
    addLayer(S, 4.7, GATE_Z, 1, 0.0, [2.6, 2.0], [0.05, -0.032], 0.97)
    addLayer(W, 5.0, GATE_Z + 0.12, 1, 3.7, [3.4, 2.6], [-0.026, 0.041], 0.55)
    addLayer(W, 5.0, GATE_Z - 0.12, 1, 8.1, [4.2, 3.1], [0.034, -0.028], 0.5)
  }

  /** second fog wall — faces east/west across the corridor in the great wall */
  private buildGate2() {
    const h = this.heights[this.idx(GATE2.x, GATE2.z)]
    const addLayer = (
      w: number, hh: number, x: number, gate: 1 | 2,
      seed: number, scale: [number, number], drift: [number, number], opacity: number
    ) => {
      const mat = createFogMaterial({ seed, scale, drift, opacity })
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, hh), mat)
      mesh.position.set(x, h + 2.85, GATE2.z)
      mesh.rotation.y = Math.PI / 2
      this.group.add(mesh)
      this.fogLayers.push({ mesh, gate, t: seed * 9, sx: drift[0], sy: drift[1] })
    }
    const S = 5.6, W = 6.0
    addLayer(S, 4.7, GATE2.x, 2, 1.9, [2.6, 2.0], [0.05, -0.032], 0.97)
    addLayer(W, 5.0, GATE2.x - 0.12, 2, 5.3, [3.4, 2.6], [-0.026, 0.041], 0.55)
    addLayer(W, 5.0, GATE2.x + 0.12, 2, 9.6, [4.2, 3.1], [0.034, -0.028], 0.5)
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
    for (const l of this.fogLayers) {
      // GPU fog: each curtain keeps its own clock; the drift is baked
      // into the shader as a uniform, so we only advance time here
      l.t += dt
      const mat = l.mesh.material as THREE.ShaderMaterial
      mat.uniforms.uTime.value = l.t
    }
  }

  setFogGatesVisible(g1: boolean, g2: boolean) {
    for (const l of this.fogLayers) {
      l.mesh.visible = l.gate === 1 ? g1 : g2
    }
  }
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

function smoothstep(e0: number, e1: number, x: number) {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)))
  return t * t * (3 - 2 * t)
}
