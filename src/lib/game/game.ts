import * as THREE from 'three'
import { Engine } from './engine'
import {
  WorldV3,
  V3_BONFIRE as BONFIRE,
  V3_MERCHANT as MERCHANT,
  V3_BOSS1_CENTER as BOSS_CENTER,
  V3_BOSS1_GATE as GATE1,
  V3_BOSS1_ARENA as ARENA1,
  V3_GATE2 as GATE2,
  V3_BOSS2_CENTER as BOSS2_CENTER,
  V3_PYRO_ITEM as PYRO_ITEM,
  V3_LAVA_POOLS as LAVA_POOLS,
  V3_COAL_CENTER as COAL_CENTER,
  V3_COAL_ARENA as COAL_ARENA,
  V3_PIT_RUBBLE as PIT_RUBBLE,
  V3_HALF,
  V3_SURF_NAMES,
} from './worldV3'
import { blockMaterials } from './textures'
import { LORE_STONES, MERCHANT_LINES } from './lore'
import { Player } from './player'
import { Enemy, BossEnemy, CreeperEnemy, SkeletonEnemy, WitherSkeletonEnemy, BlazeEnemy, BossFlameEnemy, CoalLordEnemy, setNgMult } from './enemy'
import { createSword, createShield, createMerchant, createSmith, animMerchantIdle, animMerchantGreet, animSmithIdle, type Humanoid, createBow, setBowDraw, setNocked, applyPlayerArmor, setPlayerSword, setPlayerShield, setPlayerBow, createArmorDrop, createArrowBundle, createChest, createKeyProp, createRingProp, type SwordStyle } from './models'
import { Sfx } from './sfx'
import type { PlayerStrikeDef } from './player'
import {
  ITEMS, ALL_SLOTS, SLOT_LABEL, equipLoad, maxLoadFor, rollTier, TIER_INFO, armorTotals, charmTotals,
  rollLoot, bossLoot, defaultEquip, sellValueOf, upgradeCost, upgradeMult, MAX_UPGRADE, SMITH_LINES,
  type ItemId, type EquipSlot, type EquippedMap, type ItemDef, type DmgType, type LootRoll,
  type UpgradeCost,
} from './items'

/* ================= HUD STATE ================= */

export type Phase = 'menu' | 'playing' | 'dead' | 'rest' | 'paused' | 'shop' | 'smith' | 'inventory' | 'lore' | 'ending'
export interface HudState {
  phase: Phase
  hp: number
  maxHp: number
  st: number
  maxSt: number
  souls: number
  level: number
  estus: number
  maxEstus: number
  vit: number
  end: number
  str: number
  nextCost: number
  bossName: string | null
  bossHp: number
  bossMax: number
  prompt: string | null
  banner: 'died' | 'bossfell' | 'bossfell2' | 'coalfell' | null
  blocking: boolean
  pyro: number
  maxPyro: number
  pyroUnlocked: boolean
  /** shop snapshot — null unless the shop panel is open */
  shop: ShopHud | null
  /** the forge-keeper's panel — null unless the forge is open */
  smith: SmithHud | null
  /** the ending choice stands open — kindle, or let it fade */
  ending: boolean
  /** NG+ cycle count (0 = first life) */
  ngPlus: number
  /** an ending has been chosen — the road of re-awakening is open */
  ended: boolean
  /** a memorial stone is being read */
  lore: LoreHud | null
  /** memories recovered so far / total stones standing in the Vale */
  loreCount: number
  loreTotal: number
  /** equipment/inventory snapshot — null unless the panel is open */
  inv: InvHud | null
  /** transient pickup/switch toast */
  toast: string | null
  /** arrows remaining for the equipped quiver */
  arrows: number
  /** a bow is in the active left hand (show the quiver chip) */
  bowEquipped: boolean
  /** the player is currently drawing the bow (crosshair visible) */
  aiming: boolean
  /** draw power 0..1 while aiming */
  draw: number
  /** a cinematic is playing — letterbox + boss/title cards + captions */
  cine: { title: string | null; sub: string | null; caption: string | null } | null
  /** a location title card (first entry into a region / champion intro) */
  card: { title: string; sub: string; key: number } | null
}

export interface InvHud {
  slots: { slot: EquipSlot; label: string; item: InvItemView | null }[]
  rhActive: 1 | 2
  lhActive: 1 | 2
  bag: InvItemView[]
  load: number
  maxLoad: number
  tier: string
  tierColor: string
  tierLabel: string
  def: number
  fire: number
  blast: number
  souls: number
  /** standing close enough to the merchant to trade */
  nearMerchant: boolean
  /** the worn charms' whispers, one line per active passive */
  charmLines: string[]
}

export interface InvItemView {
  id: string
  name: string
  icon: string
  cat: string
  weight: number
  n: number
  equipped: boolean
  tier: string
  desc: string
  /** what the grey merchant pays for one unit */
  sell: number
  ammo?: boolean
  key?: boolean
  dmg?: number
  spd?: number
  block?: number
  bowDmg?: number
  def?: number
  fire?: number
  blast?: number
}

export interface ShopHud {
  souls: number
  estusLv: number
  whetLv: number
  coalLv: number
  pyroUnlocked: boolean
  /** the merchant's idle line — he trades to remember what he sold */
  line: string
  /** what the merchant will buy off you right now */
  sellables: { id: ItemId; name: string; icon: string; n: number; equipped: boolean; sell: number; tier: string }[]
}

/** the forge-keeper's panel — blades, embers, and the price of glory */
export interface SmithHud {
  souls: number
  /** materials in the bag */
  iron: number
  ember: number
  /** the smith's idle line */
  line: string
  /** every blade in the bag, with its forge-grade and next cost */
  blades: {
    id: ItemId
    name: string
    icon: string
    lv: number
    dmg: number
    equipped: boolean
    cost: UpgradeCost | null
    affordable: boolean
  }[]
}

/** a memorial stone being read (phase 'lore') */
export interface LoreHud {
  id: string
  title: string
  text: string[]
  /** first reading — the memory is being saved */
  first: boolean
}

/* ================= SHOP ECONOMY ================= */

export interface ShopItemDef {
  id: 'estus' | 'whet' | 'coal'
  name: string
  desc: string
  icon: string
  max: number
  /** price for buying the (level+1)-th one */
  price: (level: number) => number
}

export const SHOP_ITEMS: ShopItemDef[] = [
  {
    id: 'estus',
    name: 'شربت‌سنگ',
    desc: 'ظرفیت شربت استوس +۱ (بازگردایی کامل)',
    icon: '🧪',
    max: 3,
    price: (lv) => 900 + lv * 550,
  },
  {
    id: 'whet',
    name: 'سنگ تیزکن',
    desc: 'تیغه‌ی بازی +۸٪ آسیب — همیشگی',
    icon: '🗡️',
    max: 5,
    price: (lv) => 650 + lv * 350,
  },
  {
    id: 'coal',
    name: 'زغال جادویی',
    desc: 'ظرفیت جادو +۱ شارژ (نیاز به پیرمانسی)',
    icon: '🜂',
    max: 4,
    price: (lv) => 500 + lv * 300,
  },
]

export interface SaveData {
  souls: number
  level: number
  vit: number
  end: number
  str: number
  estusUp?: boolean
  pyro?: boolean
  ember?: boolean
  shopEstus?: number
  shopWhet?: number
  shopCoal?: number
  inv?: { id: ItemId; n: number }[]
  eq?: EquippedMap
  rhA?: 1 | 2
  lhA?: 1 | 2
  /** memorial stones already read */
  lore?: string[]
  /** one-time cinematics already seen (intro shot, post-boss beat, regions) */
  cine?: { intro?: boolean; beat1?: boolean; regions?: string[] }
  /** forge-grades per blade id — the smith remembers his work */
  upgrades?: Record<string, number>
  /** how many NG+ cycles this ash has walked */
  ngPlus?: number
  /** the ending this ember chose: 'lit' kindled the Coal, 'fade' let it sleep */
  ending?: 'lit' | 'fade'
}

const SAVE_KEY = 'minesouls_v1'
const SETTINGS_KEY = 'minesouls_settings_v1'

export interface GameSettings {
  sens: number // mouse sensitivity multiplier (0.3..2.2)
  volume: number // master volume (0..1)
  invertY: boolean
  shadows: boolean
}

export const DEFAULT_SETTINGS: GameSettings = {
  sens: 1,
  volume: 0.8,
  invertY: false,
  shadows: true,
}

/* ================= CINEMATICS ================= */

function easeInOut(t: number) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
}

interface CineKey {
  /** seconds this shot lasts */
  dur: number
  /** camera position at the end of the shot */
  pos: THREE.Vector3
  /** look-at point at the end of the shot */
  look: THREE.Vector3
  /** fired once when the shot begins (roar, sfx, particles...) */
  onStart?: () => void
}

/** the named regions of the Vale — first entry earns its title card */
const REGIONS = [
  { id: 'fortress', name: 'دژِ ذغال', sub: 'تختِ پادشاهِ شعله', x0: 22, x1: 54, z0: -26, z1: -2 },
  { id: 'parish', name: 'فلاتِ کلیسا', sub: 'زنگی که دیگر برای کسی نمی‌خواند', x0: -44, x1: -8, z0: -40, z1: -2 },
  { id: 'wastes', name: 'خاکسترگاه', sub: 'سرزمینِ سوختهٔ شرق', x0: 20, x1: 56, z0: -2, z1: 38 },
  { id: 'village', name: 'دهکدهٔ فراموش‌شده', sub: 'خانه‌هایی که خالی ماندند', x0: -52, x1: -12, z0: 2, z1: 28 },
  { id: 'shrine', name: 'زیارتگاهِ نخستین', sub: 'آتشگاهِ آغاز و پایان', x0: -12, x1: 12, z0: 18, z1: 40 },
  { id: 'pit', name: 'گودالِ گداخته', sub: 'بسترِ ذغالِ نخستین', x0: 20, x1: 55, z0: -55, z1: -38 },
]

/** the forge-keeper — he never left the house the fire took */
const SMITH = { x: -42, z: 30.6 }


/* ================= PARTICLES / EFFECTS ================= */

class Burst {
  points: THREE.Points
  private vel: Float32Array
  private t = 0
  private life: number

  constructor(scene: THREE.Scene, pos: THREE.Vector3, color: number, count = 14, speed = 3, life = 0.7, size = 0.14) {
    this.life = life
    const positions = new Float32Array(count * 3)
    this.vel = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      positions[i * 3] = pos.x
      positions[i * 3 + 1] = pos.y
      positions[i * 3 + 2] = pos.z
      const a = Math.random() * Math.PI * 2
      const s = speed * (0.4 + Math.random() * 0.6)
      this.vel[i * 3] = Math.cos(a) * s
      this.vel[i * 3 + 1] = 1.5 + Math.random() * 2.5
      this.vel[i * 3 + 2] = Math.sin(a) * s
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    const mat = new THREE.PointsMaterial({
      color, size, transparent: true, opacity: 1, depthWrite: false,
    })
    this.points = new THREE.Points(geo, mat)
    scene.add(this.points)
  }

  update(dt: number, scene: THREE.Scene): boolean {
    this.t += dt
    const pos = this.points.geometry.getAttribute('position') as THREE.BufferAttribute
    for (let i = 0; i < pos.count; i++) {
      pos.setXYZ(
        i,
        pos.getX(i) + this.vel[i * 3] * dt,
        pos.getY(i) + this.vel[i * 3 + 1] * dt,
        pos.getZ(i) + this.vel[i * 3 + 2] * dt
      )
      this.vel[i * 3 + 1] -= 5 * dt
    }
    pos.needsUpdate = true
    const mat = this.points.material as THREE.PointsMaterial
    mat.opacity = Math.max(0, 1 - this.t / this.life)
    if (this.t >= this.life) {
      scene.remove(this.points)
      this.points.geometry.dispose()
      mat.dispose()
      return false
    }
    return true
  }
}

class FloatText {
  sprite: THREE.Sprite
  t = 0

  constructor(text: string, color: string, pos: THREE.Vector3) {
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 96
    const ctx = canvas.getContext('2d')!
    ctx.font = 'bold 54px monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.lineWidth = 10
    ctx.strokeStyle = 'rgba(0,0,0,0.9)'
    ctx.strokeText(text, 128, 48)
    ctx.fillStyle = color
    ctx.fillText(text, 128, 48)
    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false })
    this.sprite = new THREE.Sprite(mat)
    this.sprite.scale.set(2.4, 0.9, 1)
    this.sprite.position.copy(pos)
  }

  update(dt: number, scene: THREE.Scene): boolean {
    this.t += dt
    this.sprite.position.y += dt * 1.4
    const mat = this.sprite.material as THREE.SpriteMaterial
    mat.opacity = Math.max(0, 1 - this.t / 1.1)
    if (this.t >= 1.1) {
      scene.remove(this.sprite)
      mat.map?.dispose()
      mat.dispose()
      return false
    }
    return true
  }
}

interface SoulOrb {
  mesh: THREE.Mesh
  t: number
  amount: number
  from: THREE.Vector3
}

/* Expanding ground ring from boss slams/stomps — chips the player when
   the wavefront passes under their feet (rolls/blocks still work). */
class Shockwave {
  private mesh: THREE.Mesh
  private t = 0
  private hit = false
  private dur: number

  constructor(
    private game: Game,
    private pos: THREE.Vector3,
    private maxR: number,
    private dmg: number,
    color = 0xd8c090
  ) {
    this.dur = 0.42 + maxR * 0.035
    const geo = new THREE.RingGeometry(0.82, 1, 36)
    this.mesh = new THREE.Mesh(
      geo,
      new THREE.MeshBasicMaterial({
        color, transparent: true, opacity: 0.9,
        side: THREE.DoubleSide, depthWrite: false,
      })
    )
    this.mesh.rotation.x = -Math.PI / 2
    this.mesh.position.set(pos.x, pos.y + 0.14, pos.z)
    game.engine.scene.add(this.mesh)
  }

  update(dt: number): boolean {
    this.t += dt / this.dur
    const prevR = 0.5 + Math.max(0, this.t - dt / this.dur) * this.maxR
    const r = 0.5 + this.t * this.maxR
    this.mesh.scale.setScalar(r)
    const m = this.mesh.material as THREE.MeshBasicMaterial
    m.opacity = Math.max(0, 0.9 * (1 - this.t))
    if (!this.hit && this.t > 0.04) {
      const p = this.game.player
      const d = Math.hypot(p.pos.x - this.pos.x, p.pos.z - this.pos.z)
      if (d >= prevR - 0.5 && d <= r + 0.5) {
        this.hit = true
        if (p.takeDamage(this.dmg, this.pos.x, this.pos.z, this.game)) this.game.onPlayerHit(this.dmg)
      }
    }
    if (this.t >= 1) {
      this.game.engine.scene.remove(this.mesh)
      ;(this.mesh.material as THREE.MeshBasicMaterial).dispose()
      this.mesh.geometry.dispose()
      return false
    }
    return true
  }
}

/* The grand finale when a lord falls. Two flavours:
   - 'collapse': the knight's blocky body erupts into voxels that scatter,
     tumble and bounce to rest while green soul-wisps stream skyward.
   - 'inferno': the Flame King combusts — white-hot core flash, a rising
     pillar of fire, embers whirling upward like a fire whirl, and smoke. */
class BossDeathFX {
  private t = 0
  private life: number
  private cubes: {
    mesh: THREE.Mesh
    vx: number
    vy: number
    vz: number
    sx: number
    sy: number
    sz: number
    size: number
    restY: number
    ember: { ang: number; radius: number; angSpd: number; vy: number } | null
  }[] = []
  private wisps: THREE.Points | null = null
  private wispVel: Float32Array = new Float32Array(0)
  private wispAng: number[] = []
  private smoke: THREE.Points | null = null
  private smokeVel: Float32Array = new Float32Array(0)
  private pillars: {
    mesh: THREE.Mesh
    t: number
    life: number
    base: number
    expand: number
    op: number
    rise: number
  }[] = []
  private ring: THREE.Mesh | null = null
  private core: THREE.Mesh | null = null
  private light: THREE.PointLight | null = null
  private light0 = 0
  private emberMats: THREE.MeshLambertMaterial[] = []
  private geos: THREE.BufferGeometry[] = []
  private mats: THREE.Material[] = []

  constructor(
    private game: Game,
    private pos: THREE.Vector3,
    private mode: 'collapse' | 'inferno',
    body: Humanoid
  ) {
    const scene = game.engine.scene
    const gy = game.world.surfaceAt(pos.x, pos.z)
    this.pos.y = gy
    this.life = mode === 'collapse' ? 2.7 : 3.0

    // palette sampled from the fallen lord's own materials
    const palette: THREE.Color[] = []
    body.group.traverse((o) => {
      const mesh = o as THREE.Mesh
      const mat = mesh.material as THREE.MeshLambertMaterial | undefined
      if (mat && mat.color && !palette.some((c) => c.equals(mat.color))) {
        palette.push(mat.color.clone())
      }
    })
    if (palette.length === 0) palette.push(new THREE.Color(0x4a7a3a))

    const boxGeo = new THREE.BoxGeometry(1, 1, 1)
    this.geos.push(boxGeo)
    const count = mode === 'collapse' ? 64 : 66
    const bs = mode === 'collapse' ? 2.25 : 2.35 // body scale of the fallen lord

    for (let i = 0; i < count; i++) {
      const baseCol = palette[i % palette.length]
      const mat = new THREE.MeshLambertMaterial()
      this.mats.push(mat)
      if (mode === 'inferno') {
        const fire = [0xfff3b0, 0xffd25e, 0xff8a2a, 0xff5a1e, 0xffb05e]
        mat.color.set(fire[i % fire.length]).lerp(baseCol, 0.25)
        mat.emissive.copy(mat.color)
        mat.emissiveIntensity = 0.9
        this.emberMats.push(mat)
      } else {
        mat.color.copy(baseCol).multiplyScalar(0.85 + Math.random() * 0.3)
      }
      const mesh = new THREE.Mesh(boxGeo, mat)
      const size =
        (mode === 'collapse' ? 0.16 + Math.random() * 0.2 : 0.1 + Math.random() * 0.17) *
        (0.8 + bs * 0.28)
      mesh.scale.setScalar(size)
      const a = Math.random() * Math.PI * 2
      const rr = Math.random() * 0.55 * bs
      const startX = this.pos.x + Math.cos(a) * rr
      const startZ = this.pos.z + Math.sin(a) * rr
      let ember: typeof this.cubes[number]['ember'] = null
      let vx = 0
      let vy = 0
      let vz = 0
      if (mode === 'collapse') {
        // burst outward from the body, tumble, bounce on the arena floor
        const sp = 2.0 + Math.random() * 3.2
        const a2 = Math.random() * Math.PI * 2
        vx = Math.cos(a2) * sp
        vz = Math.sin(a2) * sp
        vy = 2.4 + Math.random() * 3.8
      } else {
        // ember of the fire whirl — spirals upward with accelerating heat
        ember = {
          ang: Math.random() * Math.PI * 2,
          radius: 0.35 + Math.random() * 1.25,
          angSpd: (Math.random() < 0.5 ? -1 : 1) * (1.6 + Math.random() * 2.6),
          vy: 1.7 + Math.random() * 2.6,
        }
      }
      mesh.position.set(
        startX,
        gy + 0.2 + Math.random() * 1.7 * bs,
        startZ
      )
      mesh.rotation.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI
      )
      scene.add(mesh)
      this.cubes.push({
        mesh,
        vx,
        vy,
        vz,
        sx: (Math.random() - 0.5) * 14,
        sy: (Math.random() - 0.5) * 14,
        sz: (Math.random() - 0.5) * 14,
        size,
        restY: gy + size / 2,
        ember,
      })
    }

    if (mode === 'collapse') {
      // green soul-wisps streaming out of the remains (Minecraft XP style)
      const n = 36
      const posArr = new Float32Array(n * 3)
      this.wispVel = new Float32Array(n * 3)
      for (let i = 0; i < n; i++) {
        posArr[i * 3] = this.pos.x + (Math.random() - 0.5) * 1.7
        posArr[i * 3 + 1] = gy + 0.3 + Math.random() * 2.2
        posArr[i * 3 + 2] = this.pos.z + (Math.random() - 0.5) * 1.7
        const ang = Math.random() * Math.PI * 2
        this.wispAng.push(ang)
        this.wispVel[i * 3] = Math.cos(ang) * (0.2 + Math.random() * 0.45)
        this.wispVel[i * 3 + 1] = 0.9 + Math.random() * 1.6
        this.wispVel[i * 3 + 2] = Math.sin(ang) * (0.2 + Math.random() * 0.45)
      }
      const wispGeo = new THREE.BufferGeometry()
      wispGeo.setAttribute('position', new THREE.BufferAttribute(posArr, 3))
      const wispMat = new THREE.PointsMaterial({
        color: 0x8cff70,
        size: 0.2,
        transparent: true,
        opacity: 0.95,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
      this.wisps = new THREE.Points(wispGeo, wispMat)
      this.geos.push(wispGeo)
      this.mats.push(wispMat)
      scene.add(this.wisps)

      // expanding pale-soul ring on the ground
      const ringGeo = new THREE.RingGeometry(0.82, 1, 40)
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0xa4ff96,
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
      this.ring = new THREE.Mesh(ringGeo, ringMat)
      this.ring.rotation.x = -Math.PI / 2
      this.ring.position.set(this.pos.x, gy + 0.12, this.pos.z)
      this.geos.push(ringGeo)
      this.mats.push(ringMat)
      scene.add(this.ring)

      this.light = new THREE.PointLight(0x9fffa8, 5.5, 17, 1.8)
      this.light.position.set(this.pos.x, gy + 1.5, this.pos.z)
      this.light0 = 5.5
      scene.add(this.light)
    } else {
      // rising pillar of fire — two nested additive shells
      const mkPillar = (rTop: number, rBot: number, h: number, col: number, op: number, base: number, expand: number, life: number, rise: number) => {
        const geo = new THREE.CylinderGeometry(rTop, rBot, h, 12, 1, true)
        const mat = new THREE.MeshBasicMaterial({
          color: col,
          transparent: true,
          opacity: op,
          side: THREE.DoubleSide,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        })
        const m = new THREE.Mesh(geo, mat)
        m.position.set(this.pos.x, gy + h / 2 - 0.2, this.pos.z)
        m.scale.set(base, 1, base)
        scene.add(m)
        this.pillars.push({ mesh: m, t: 0, life, base, expand, op, rise })
        this.geos.push(geo)
        this.mats.push(mat)
      }
      mkPillar(0.5, 0.85, 5.4, 0xfff0a8, 0.9, 0.25, 1.75, 1.05, 0.6)
      mkPillar(0.95, 1.55, 4.6, 0xff7a1e, 0.62, 0.25, 1.95, 1.2, 0.45)
      // scorch mark that lingers on the arena floor
      mkPillar(1, 1, 0.06, 0x140a06, 0.55, 0.6, 1.9, 2.6, 0)

      // white-hot core flash
      const coreGeo = new THREE.SphereGeometry(0.55, 10, 8)
      const coreMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.95,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
      this.core = new THREE.Mesh(coreGeo, coreMat)
      this.core.position.set(this.pos.x, gy + 1.2, this.pos.z)
      this.geos.push(coreGeo)
      this.mats.push(coreMat)
      scene.add(this.core)

      // drifting smoke after the blast
      const n = 30
      const posArr = new Float32Array(n * 3)
      this.smokeVel = new Float32Array(n * 3)
      for (let i = 0; i < n; i++) {
        posArr[i * 3] = this.pos.x + (Math.random() - 0.5) * 1.8
        posArr[i * 3 + 1] = gy + 0.4 + Math.random() * 2.2
        posArr[i * 3 + 2] = this.pos.z + (Math.random() - 0.5) * 1.8
        const a = Math.random() * Math.PI * 2
        this.smokeVel[i * 3] = Math.cos(a) * (0.15 + Math.random() * 0.35)
        this.smokeVel[i * 3 + 1] = 0.5 + Math.random() * 0.8
        this.smokeVel[i * 3 + 2] = Math.sin(a) * (0.15 + Math.random() * 0.35)
      }
      const smokeGeo = new THREE.BufferGeometry()
      smokeGeo.setAttribute('position', new THREE.BufferAttribute(posArr, 3))
      const smokeMat = new THREE.PointsMaterial({
        color: 0x4a4245,
        size: 0.5,
        transparent: true,
        opacity: 0.4,
        depthWrite: false,
      })
      this.smoke = new THREE.Points(smokeGeo, smokeMat)
      this.geos.push(smokeGeo)
      this.mats.push(smokeMat)
      scene.add(this.smoke)

      this.light = new THREE.PointLight(0xff9040, 9.5, 21, 1.6)
      this.light.position.set(this.pos.x, gy + 1.6, this.pos.z)
      this.light0 = 9.5
      scene.add(this.light)
    }
  }

  update(dt: number): boolean {
    this.t += dt
    const k = this.t / this.life
    const scene = this.game.engine.scene

    // voxels
    for (const c of this.cubes) {
      if (c.ember) {
        c.ember.ang += c.ember.angSpd * dt
        c.ember.radius *= 1 - 0.24 * dt
        c.ember.vy += 1.15 * dt
        c.mesh.position.set(
          this.pos.x + Math.cos(c.ember.ang) * c.ember.radius,
          c.mesh.position.y + c.ember.vy * dt,
          this.pos.z + Math.sin(c.ember.ang) * c.ember.radius
        )
      } else {
        c.vy -= 11.5 * dt
        c.mesh.position.x += c.vx * dt
        c.mesh.position.y += c.vy * dt
        c.mesh.position.z += c.vz * dt
        if (c.mesh.position.y < c.restY && c.vy < 0) {
          c.mesh.position.y = c.restY
          if (Math.abs(c.vy) > 1.1) {
            // bounce with energy loss
            c.vy = -c.vy * 0.36
            c.vx *= 0.55
            c.vz *= 0.55
            c.sx *= 0.5
            c.sy *= 0.5
            c.sz *= 0.5
          } else {
            // settle and grind to a halt
            c.vy = 0
            c.vx *= 0.8
            c.vz *= 0.8
          }
        }
      }
      c.mesh.rotation.x += c.sx * dt
      c.mesh.rotation.y += c.sy * dt
      c.mesh.rotation.z += c.sz * dt
      if (k > 0.62) {
        const fade = Math.max(0.001, 1 - (k - 0.62) / 0.38)
        c.mesh.scale.setScalar(c.size * fade)
      }
    }

    // embers flicker like real fire
    for (const m of this.emberMats) {
      m.emissiveIntensity = 0.6 + Math.random() * 0.55
    }

    if (this.wisps) {
      const posAttr = this.wisps.geometry.getAttribute('position') as THREE.BufferAttribute
      for (let i = 0; i < posAttr.count; i++) {
        this.wispAng[i] += dt * (1.2 + (i % 5) * 0.22)
        posAttr.setXYZ(
          i,
          posAttr.getX(i) + (Math.cos(this.wispAng[i]) * 0.3 + this.wispVel[i * 3]) * dt,
          posAttr.getY(i) + this.wispVel[i * 3 + 1] * dt,
          posAttr.getZ(i) + (Math.sin(this.wispAng[i]) * 0.3 + this.wispVel[i * 3 + 2]) * dt
        )
      }
      posAttr.needsUpdate = true
      ;(this.wisps.material as THREE.PointsMaterial).opacity = Math.max(0, 0.95 * (1 - k * 1.15))
    }

    if (this.smoke) {
      const posAttr = this.smoke.geometry.getAttribute('position') as THREE.BufferAttribute
      for (let i = 0; i < posAttr.count; i++) {
        posAttr.setXYZ(
          i,
          posAttr.getX(i) + this.smokeVel[i * 3] * dt,
          posAttr.getY(i) + this.smokeVel[i * 3 + 1] * dt,
          posAttr.getZ(i) + this.smokeVel[i * 3 + 2] * dt
        )
      }
      posAttr.needsUpdate = true
      ;(this.smoke.material as THREE.PointsMaterial).opacity =
        0.4 * Math.min(1, this.t / 0.4) * Math.max(0, 1 - k)
    }

    // fire pillar / scorch discs
    this.pillars = this.pillars.filter((p) => {
      p.t += dt
      const e = 1 - Math.pow(1 - Math.min(1, p.t / 0.5), 3)
      p.mesh.scale.set(p.base + p.expand * e, 1 + 0.12 * e, p.base + p.expand * e)
      ;(p.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(
        0,
        p.op * (1 - p.t / p.life)
      )
      p.mesh.position.y += p.rise * dt
      if (p.t >= p.life) {
        scene.remove(p.mesh)
        return false
      }
      return true
    })

    if (this.core) {
      const ck = Math.min(1, this.t / 0.38)
      this.core.scale.setScalar(1 + ck * 3.4)
      ;(this.core.material as THREE.MeshBasicMaterial).opacity = 0.78 * (1 - ck)
      if (ck >= 1) {
        scene.remove(this.core)
        this.core = null
      }
    }

    if (this.ring) {
      const rk = Math.min(1, this.t / 0.75)
      const e = 1 - Math.pow(1 - rk, 3)
      this.ring.scale.setScalar(0.6 + e * 4.0)
      ;(this.ring.material as THREE.MeshBasicMaterial).opacity = 0.85 * (1 - rk)
      if (rk >= 1) {
        scene.remove(this.ring)
        this.ring = null
      }
    }

    if (this.light) {
      this.light.intensity = Math.max(0, this.light0 * (1 - this.t / 1.15))
      if (this.t >= 1.15) {
        scene.remove(this.light)
        this.light = null
      }
    }

    if (this.t >= this.life) {
      for (const c of this.cubes) scene.remove(c.mesh)
      if (this.wisps) scene.remove(this.wisps)
      if (this.smoke) scene.remove(this.smoke)
      for (const g of this.geos) g.dispose()
      for (const m of this.mats) m.dispose()
      return false
    }
    return true
  }
}


/* A loosed arrow — real ballistic arc, fletching spin, a faint trail,
   proper impact FX, and missed shots stick in the ground long enough to
   be recovered (a chance, like Dark Souls' tinier pickings). */
class Arrow {
  private mesh: THREE.Group
  private vel = new THREE.Vector3()
  private t = 0
  private stuck = false
  private stuckT = 0
  private trailT = 0
  private spin = (Math.random() * 2 - 1) * 14
  /** ground-stuck arrows linger so the player can walk over and reclaim */
  private static STICK_LIFE = 7

  constructor(
    private game: Game,
    private pos: THREE.Vector3,
    target: THREE.Vector3,
    private dmg: number,
    private fromPlayer = false,
    private fire = false,
    power = 1
  ) {
    const g = new THREE.Group()
    const lam = (c: number) => new THREE.MeshLambertMaterial({ color: c })
    const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.6), lam(fire ? 0x6a4020 : 0x9a7a4a))
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.14), lam(fire ? 0xff8a3a : 0xb8bec8))
    tip.position.z = 0.34
    const fl1 = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.17, 0.13), lam(fire ? 0xffc23d : 0xe8e4d8))
    fl1.position.z = -0.25
    const fl2 = fl1.clone()
    fl2.rotation.z = Math.PI / 2
    g.add(shaft, tip, fl1, fl2)
    if (fire) {
      // a burning head glow so fire arrows read at night
      const glow = new THREE.Mesh(
        new THREE.BoxGeometry(0.16, 0.16, 0.16),
        new THREE.MeshBasicMaterial({ color: 0xff7a1e, transparent: true, opacity: 0.4, depthWrite: false })
      )
      glow.position.z = 0.34
      g.add(glow)
    }
    g.position.copy(pos)
    game.engine.scene.add(g)
    this.mesh = g
    if (fromPlayer) {
      // TRUE ballistic solve — the arrow lands where the crosshair points.
      // Flight time scales with distance so far shots arc higher.
      const dx = target.x - pos.x, dy = target.y - pos.y, dz = target.z - pos.z
      const dh = Math.hypot(dx, dz)
      const T = 0.3 + dh / 26
      const eff = 0.7 + power * 0.3 // a rushed release falls short & stings less
      this.vel.set((dx / T) * eff, dy / T + 0.5 * 6.5 * T, (dz / T) * eff)
    } else {
      // enemy shots: flat-ish with a loft so they crest small bumps
      this.vel.subVectors(target, pos)
      const dist = this.vel.length()
      this.vel.normalize().multiplyScalar(15.5)
      this.vel.y += dist * 0.42
    }
  }

  update(dt: number): boolean {
    if (this.stuck) {
      this.stuckT += dt
      return this.stuckT < Arrow.STICK_LIFE
    }
    this.t += dt
    this.vel.y -= 6.5 * dt
    this.pos.addScaledVector(this.vel, dt)
    this.mesh.position.copy(this.pos)
    this.mesh.lookAt(this.pos.x + this.vel.x, this.pos.y + this.vel.y, this.pos.z + this.vel.z)
    // fletching roll — arrows spin gently around their flight axis
    this.mesh.rotateZ(this.spin * dt)

    // trail — a whisper for wood, embers for fire
    this.trailT -= dt
    if (this.trailT <= 0) {
      this.trailT = 0.045
      this.game.spawnBurst(
        this.pos.clone(),
        this.fireTrail(),
        1, this.fire ? 0.5 : 0.28, this.fire ? 0.5 : 0.25, 0.06
      )
    }

    // built stone stops arrows — they bite into the masonry and stick
    if (this.game.world.solidStruct(Math.round(this.pos.x), Math.round(this.pos.y), Math.round(this.pos.z))) {
      this.stuck = true
      this.game.spawnBurst(this.pos.clone(), 0x9a8b70, 4, 1.4, 0.35, 0.1)
      if (this.fire) this.game.spawnBurst(this.pos.clone(), 0xff8a3a, 6, 1.7, 0.5, 0.12)
      return true
    }

    // ground impact — stick in at an angle, puff dust, maybe leave a reclaim
    const ground = this.game.world.surfaceAt(this.pos.x, this.pos.z)
    if (this.pos.y <= ground + 0.06) {
      this.stuck = true
      this.pos.y = ground + 0.1
      this.mesh.position.copy(this.pos)
      // nose-down settle: keep the flight direction but tip the tail up
      this.mesh.rotateX(-0.5)
      this.game.spawnBurst(this.pos.clone(), 0x9a8b70, 5, 1.5, 0.4, 0.1)
      if (this.fire) {
        // embers scatter where the burning head bit the dirt
        this.game.spawnBurst(this.pos.clone(), 0xff8a3a, 7, 1.8, 0.6, 0.12)
      }
      this.game.recoverArrow(this)
      return true
    }
    if (this.t > 3.2 || Math.abs(this.pos.x) > V3_HALF - 1 || Math.abs(this.pos.z) > V3_HALF - 1) return false

    /* ---- player-fired arrows hunt MOBS ---- */
    if (this.fromPlayer) {
      for (const e of this.game.allEnemies) {
        if (!e.alive) continue
        const isBoss = e.isBoss
        const rad = isBoss ? 1.5 : 0.75
        const top = e.pos.y + (isBoss ? 4.2 : 2.0)
        const hy = Math.max(e.pos.y + 0.3, Math.min(top, this.pos.y))
        const d2 =
          (this.pos.x - e.pos.x) ** 2 + (this.pos.z - e.pos.z) ** 2 + (this.pos.y - hy) ** 2
        if (d2 < rad * rad) {
          const vl = Math.hypot(this.vel.x, this.vel.z) || 1
          e.takeDamage(Math.max(1, Math.round(this.dmg * (0.92 + Math.random() * 0.16))), this.game,
            this.pos.x - (this.vel.x / vl) * 1.5, this.pos.z - (this.vel.z / vl) * 1.5)
          this.game.sfx.arrowHit()
          if (this.fire) {
            // burning impact — flame + embers
            this.game.spawnBurst(this.pos.clone(), 0xffd23d, 10, 2.4, 0.55, 0.12)
            this.game.spawnBurst(this.pos.clone(), 0xff5a10, 8, 2.0, 0.7, 0.14)
          } else {
            this.game.spawnBurst(this.pos.clone(), 0xffe9a0, 8, 2.2, 0.4, 0.1)
          }
          this.stuck = true
          return true
        }
      }
      return true
    }

    // player hit — torso capsule approx
    const p = this.game.player
    const hy = Math.max(p.pos.y + 0.25, Math.min(p.pos.y + 1.85, this.pos.y))
    const d2 =
      (this.pos.x - p.pos.x) ** 2 + (this.pos.z - p.pos.z) ** 2 + (this.pos.y - hy) ** 2
    if (d2 < 0.55 * 0.55) {
      const vl = Math.hypot(this.vel.x, this.vel.z) || 1
      const fromX = this.pos.x - (this.vel.x / vl) * 1.5
      const fromZ = this.pos.z - (this.vel.z / vl) * 1.5
      const wasBlocking = p.state === 'block'
      if (p.takeDamage(this.dmg, fromX, fromZ, this.game)) {
        this.game.onPlayerHit(this.dmg)
        this.game.sfx.arrowHit()
      } else if (wasBlocking) {
        this.game.onArrowBlocked()
      }
      if (p.state !== 'block') this.stuck = true
      return true
    }
    return true
  }

  private fireTrail() {
    return this.fire ? (Math.random() < 0.5 ? 0xffd23d : 0xff8a3a) : 0xd8e8ff
  }

  /** true when the arrow is from the player (reclaimable) */
  get reclaimable() {
    return this.fromPlayer
  }

  /** where the arrow currently sits (for the reclaim drop) */
  get groundPos(): THREE.Vector3 {
    return this.pos.clone()
  }

  /** what the player reclaims when they pick this one back up */
  get ammoId(): ItemId {
    if (!this.fromPlayer) return 'arrow_wood'
    return this.fire ? 'arrow_fire' : 'arrow_wood'
  }

  dispose(scene: THREE.Scene) {
    scene.remove(this.mesh)
    this.mesh.traverse((o) => {
      const m = o as THREE.Mesh
      if (m.geometry) m.geometry.dispose()
    })
  }
}

/* Fireballs — pyromancy bolts. Friendly ones (the player's) explode on the
   first enemy they graze with splash damage; hostile ones are blockable and
   roll-dodgeable like arrows. Both burn out on the ground or the masonry. */
class Fireball {
  private mesh: THREE.Group
  private vel = new THREE.Vector3()
  private t = 0
  private trailT = 0
  private done = false

  constructor(
    private game: Game,
    private pos: THREE.Vector3,
    target: THREE.Vector3,
    private dmg: number,
    private friendly: boolean
  ) {
    const g = new THREE.Group()
    const core = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.24, 0.24),
      new THREE.MeshBasicMaterial({ color: 0xffd23d })
    )
    const mid = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 0.4, 0.4),
      new THREE.MeshBasicMaterial({ color: 0xff8a1e, transparent: true, opacity: 0.5, depthWrite: false })
    )
    const out = new THREE.Mesh(
      new THREE.BoxGeometry(0.62, 0.62, 0.62),
      new THREE.MeshBasicMaterial({ color: 0xff5a10, transparent: true, opacity: 0.22, depthWrite: false })
    )
    g.add(out, mid, core)
    g.position.copy(pos)
    game.engine.scene.add(g)
    this.mesh = g
    this.vel.subVectors(target, pos)
    const dist = this.vel.length()
    this.vel.normalize().multiplyScalar(14)
    // a gentle loft so bolts crest the blocky terrain instead of
    // detonating on the first hill between caster and target
    this.vel.y += Math.max(0, target.y - pos.y) * 0.5 + dist * 0.1
    if (!friendly) this.vel.y += 0.6
  }

  update(dt: number): boolean {
    if (this.done) return false
    this.t += dt
    this.vel.y -= 4.5 * dt // light gravity so the loft arcs over and comes down
    this.pos.addScaledVector(this.vel, dt)
    this.mesh.position.copy(this.pos)
    this.mesh.rotation.y += dt * 9
    this.trailT -= dt
    if (this.trailT <= 0) {
      this.trailT = 0.05
      this.game.spawnBurst(this.pos.clone(), 0xff8a2a, 1, 0.3, 0.35, 0.09)
    }

    // masonry burns them out mid-flight
    if (this.game.world.solidStruct(Math.round(this.pos.x), Math.round(this.pos.y), Math.round(this.pos.z))) {
      this.explode(null)
      return false
    }

    const ground = this.game.world.surfaceAt(this.pos.x, this.pos.z) + 0.18
    if (this.pos.y <= ground || this.t > 3) {
      this.explode(null)
      return false
    }

    if (this.friendly) {
      for (const e of this.game.allEnemies) {
        if (!e.alive) continue
        const dx = e.pos.x - this.pos.x
        const dz = e.pos.z - this.pos.z
        const reach = e.isBoss ? 1.5 : 0.85
        const topY = e.isBoss ? 4.4 : 2.6
        if (dx * dx + dz * dz < reach * reach && this.pos.y < e.pos.y + topY) {
          this.explode(e)
          return false
        }
      }
    } else {
      const p = this.game.player
      const hy = Math.max(p.pos.y + 0.2, Math.min(p.pos.y + 1.9, this.pos.y))
      const d2 =
        (this.pos.x - p.pos.x) ** 2 + (this.pos.z - p.pos.z) ** 2 + (this.pos.y - hy) ** 2
      if (d2 < 0.6 * 0.6) {
        const vl = Math.hypot(this.vel.x, this.vel.z) || 1
        const wasBlocking = p.state === 'block'
        if (p.takeDamage(this.dmg, this.pos.x - (this.vel.x / vl) * 1.2, this.pos.z - (this.vel.z / vl) * 1.2, this.game, false, 'fire')) {
          this.game.onPlayerHit(this.dmg)
        } else if (wasBlocking) {
          this.game.onArrowBlocked()
        }
        this.explode(null)
        return false
      }
    }
    return true
  }

  private explode(primary: Enemy | null) {
    this.done = true
    this.game.onFireballBoom(this.pos, this.friendly)
    if (this.friendly) {
      if (primary) primary.takeDamage(this.dmg, this.game, this.pos.x, this.pos.z)
      for (const e of this.game.allEnemies) {
        if (!e.alive || e === primary) continue
        const d = Math.hypot(e.pos.x - this.pos.x, e.pos.z - this.pos.z)
        if (d < 2.2) e.takeDamage(Math.max(1, Math.round(this.dmg * 0.45)), this.game, this.pos.x, this.pos.z)
      }
    }
  }

  dispose(scene: THREE.Scene) {
    scene.remove(this.mesh)
    this.mesh.traverse((o) => {
      const m = o as THREE.Mesh
      if (m.geometry) m.geometry.dispose()
    })
  }
}

/* ================= LOOT DROPS ================= */

/* A fallen foe's gear, lying in the world the Minecraft way: a spinning,
   bobbing item with a Dark-Souls loot beam. Walk close and press F.
   Gear the PLAYER drops is different: the world does not keep your litter,
   so it blinks a warning and crumbles to dust after 20 seconds. */
class LootDrop {
  group = new THREE.Group()
  light: THREE.PointLight
  private inner: THREE.Group
  private t = Math.random() * 10
  private baseY: number
  private sparkT = 0
  /** seconds until self-destruction — null = a foe's drop, kept forever */
  private decay: number | null
  /** set once the decay timer runs out — the game loop disposes it */
  expired = false

  constructor(
    private game: Game,
    public id: ItemId,
    public n: number,
    pos: THREE.Vector3,
    quiet = false,
    decay: number | null = null
  ) {
    this.decay = decay
    const def = ITEMS[id]
    const y = game.world.surfaceAt(pos.x, pos.z)
    this.baseY = y + 0.5

    /* ---- the item itself — a real miniature, not a placeholder ---- */
    const inner = new THREE.Group()
    if (def.ammo) {
      const bundle = createArrowBundle(n, id === 'arrow_fire')
      inner.add(bundle)
    } else if (def.cat === 'sword') {
      const s = createSword(0.85, def.style ?? 'iron')
      s.rotation.z = 0.85
      s.rotation.x = 0.22
      inner.add(s)
    } else if (def.cat === 'shield') {
      const sh = createShield(def.id === 'iron_shield' ? 'iron' : 'wood')
      sh.rotation.y = Math.PI / 2
      sh.rotation.x = -0.18
      inner.add(sh)
    } else if (def.cat === 'bow') {
      const b = createBow(def.id === 'bone_bow' ? 'bone' : 'wood')
      b.rotation.z = 0.5
      inner.add(b)
    } else {
      const slot = def.slot as 'head' | 'chest' | 'hands' | 'legs' | 'cape'
      inner.add(createArmorDrop(slot, def.tint ?? 0x9a8b70, def.tint2, def.id))
    }
    inner.castShadow = true
    this.inner = inner
    this.group.add(inner)

    /* ---- the loot beam (Dark-Souls beacon, blocky style) ---- */
    const beamColor = def.tier === 'boss' ? 0xffb347 : def.tier === 'rare' ? 0x59ff6a : 0xd8e8ff
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, quiet ? 0.16 : 0.2, quiet ? 1.7 : 3.4, 6, 1, true),
      new THREE.MeshBasicMaterial({
        color: beamColor, transparent: true, opacity: quiet ? 0.13 : 0.24,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
      })
    )
    beam.position.y = quiet ? 0.85 : 1.7
    this.group.add(beam)

    this.group.position.set(pos.x, this.baseY, pos.z)
    game.engine.scene.add(this.group)
    this.light = new THREE.PointLight(beamColor, quiet ? 0.5 : 1.1, quiet ? 2.6 : 4.5, 1.6)
    this.light.position.y = 0.4
    this.group.add(this.light)
  }

  update(dt: number) {
    this.t += dt
    this.group.rotation.y += dt * 1.4
    this.group.position.y = this.baseY + Math.sin(this.t * 2.2) * 0.09
    this.light.intensity = (this.light.distance > 3 ? 0.9 : 0.35) + Math.sin(this.t * 3.1) * 0.25
    /* ---- player-dropped litter: blink, then crumble ---- */
    if (this.decay !== null) {
      this.decay -= dt
      if (this.decay <= 0) {
        this.expired = true
        this.game.spawnBurst(this.group.position.clone().add(new THREE.Vector3(0, 0.25, 0)), 0x9a8b70, 14, 2.2, 0.5, 0.22)
        return
      }
      if (this.decay < 5) {
        // a warning blink that quickens as the end nears
        const on = Math.sin(this.t * (7 + (5 - this.decay) * 5)) > -0.25
        this.inner.visible = on
        if (!on) this.light.intensity = 0.12
      }
    }
    // rare & boss gear occasionally sheds a drifting spark — attention bait
    const def = ITEMS[this.id]
    if (def && (def.tier === 'boss' || def.tier === 'rare')) {
      this.sparkT -= dt
      if (this.sparkT <= 0) {
        this.sparkT = def.tier === 'boss' ? 0.5 : 1.1
        this.game.spawnBurst(
          this.group.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.3, 0.2, (Math.random() - 0.5) * 0.3)),
          def.tier === 'boss' ? 0xffd23d : 0x8affa0, 2, 1.2, 0.55, 0.07
        )
      }
    }
  }

  dispose(scene: THREE.Scene) {
    scene.remove(this.group)
    this.group.traverse((o) => {
      const m = o as THREE.Mesh
      if (m.geometry) m.geometry.dispose()
    })
  }
}

/* ================= GAME ================= */

export class Game {
  engine: Engine
  world: WorldV3
  player: Player
  sfx = new Sfx()
  enemies: Enemy[] = []
  boss: BossEnemy
  boss2: BossFlameEnemy
  boss3: CoalLordEnemy
  phase: Phase = 'menu'
  onState?: (s: HudState) => void

  private spawns: THREE.Vector3[] = []
  private camYaw = Math.PI
  private camPitch = 0.42
  private camDist = 5.4
  private camDistTarget = 5.4
  private camPos = new THREE.Vector3()
  private camTarget = new THREE.Vector3()
  private shake = 0
  private hitstop = 0
  private hurtFlash = 0
  private deadT = 0
  private bannerT = 0
  private banner: 'died' | 'bossfell' | 'bossfell2' | 'coalfell' | null = null
  private prompt: string | null = null
  /** the ending choice awaiting an answer + its countdown */
  private endingPending = 0
  private fogPassT = 0
  private fogPass2T = 0
  private bossActive = false
  /** gate state — read by enemies so closed fog seals both sides */
  bossFell = false
  private boss2Active = false
  boss2Fell = false
  /** the third lord — the First Coal in his pit */
  private boss3Active = false
  boss3Fell = false
  private boss3Barrier = false
  /** NG+ cycle this world was born into (0 = first life) */
  private ng = 0
  /** an ending was chosen on any cycle */
  private ended = false
  private lockLastMove = 0

  /* ---- cinematics ---- */
  private cine: {
    keys: CineKey[]
    i: number
    t: number
    fromPos: THREE.Vector3
    fromLook: THREE.Vector3
    title: string | null
    sub: string | null
    caption: string | null
    /** the roaring boss the shot is about (roar pose driven manually) */
    actor: { cineRoarStep(dt: number): void } | null
    onEnd: () => void
  } | null = null
  private cineBlendT = 0
  private cineEndPos = new THREE.Vector3()
  private cineEndLook = new THREE.Vector3()
  /** one-time story beats / region reveals (persisted) */
  private cineSeen: { intro?: boolean; beat1?: boolean; regions?: string[] } = {}
  private lastRegion: string | null = null
  private beat1Pending = 0
  private card: { title: string; sub: string; key: number } | null = null
  private cardT = 0
  private cardKey = 0

  private bursts: Burst[] = []
  private texts: FloatText[] = []
  private orbs: SoulOrb[] = []
  private waves: Shockwave[] = []
  private arrows: Arrow[] = []
  private fireballs: Fireball[] = []
  private deathFx: BossDeathFX[] = []
  private lavaPools: { mesh: THREE.Mesh; x: number; z: number; t: number }[] = []
  private lavaTick = 0
  private bloodstain: { mesh: THREE.Group; amount: number } | null = null
  private boomLights: { light: THREE.PointLight; t: number }[] = []
  private estusShard: { mesh: THREE.Group; light: THREE.PointLight } | null = null
  private estusUp = false
  /** the bonfire-hub NPC + his shop upgrades (persisted) */
  private merchant!: Humanoid
  private merchantYaw = Math.PI * 0.75
  private merchantLamp!: THREE.PointLight
  private merchantGreetT = 0
  private merchantGreetCd = 0
  private shopLv = { estus: 0, whet: 0, coal: 0 }
  /** the forge-keeper + the blades he has re-tempered (persisted) */
  private smith!: Humanoid
  private upgrades: Record<string, number> = {}
  private pyroItem: { mesh: THREE.Group; light: THREE.PointLight } | null = null
  private emberItem: { mesh: THREE.Group; light: THREE.PointLight } | null = null
  private pyroUnlocked = false
  private emberTaken = false
  private castFailT = -9
  private tmpColor = new THREE.Color()

  /* ---- the Vale's secrets: chests, keys, illusion walls (category 2) ---- */
  /** a chest of the Vale — some locked, some not; all of them honest wood */
  private chests: {
    group: THREE.Group
    lid: THREE.Group
    x: number
    z: number
    y: number
    locked: boolean
    key?: ItemId
    loot: LootRoll[]
    opened: boolean
    openT: number
  }[] = []
  /** keys and stray charms that wait in the world, turning slowly */
  private pickups: { id: ItemId; mesh: THREE.Group; light: THREE.PointLight | null; x: number; z: number }[] = []
  /** illusion walls — blocks that are not blocks; the shimmer betrays them */
  private illusions: {
    group: THREE.Group
    cells: [number, number, number][]
    x: number
    z: number
    mats: THREE.MeshLambertMaterial[]
    broken: boolean
    fade: number
    phase: number
  }[] = []
  /** the HP the worn charms lend — tracked so unequipping takes it back */
  private charmHp = 0

  /* ---- the story: memorial stones of the Vale ---- */
  private loreStones: { id: string; title: string; group: THREE.Group; light: THREE.PointLight; seen: boolean; justRead: boolean }[] = []
  private loreOpenId: string | null = null

  /* ---- Dark-Souls inventory & equipment ---- */
  /** the bag owns EVERYTHING (DS rule: equipping marks, it never destroys) */
  inv: { id: ItemId; n: number }[] = [{ id: 'worn_sword', n: 1 }, { id: 'wooden_shield', n: 1 }]
  eq: EquippedMap = defaultEquip()
  rhActive: 1 | 2 = 1
  lhActive: 1 | 2 = 1
  private loots: LootDrop[] = []
  private toastMsg: string | null = null
  private toastT = 0
  playerBow: THREE.Group | null = null

  private reticle: HTMLDivElement
  private vignette: HTMLDivElement
  private mapCanvas: HTMLCanvasElement
  private mapCtx: CanvasRenderingContext2D
  private mapTerrain: HTMLCanvasElement
  private bonfireLight: THREE.PointLight
  private bonfireFlame: THREE.Points
  private flameSeeds: Float32Array
  private time = 0
  private sun: THREE.DirectionalLight
  private shadowTimer = 0
  /** render freeze — the 3D viewer owns the screen */
  frozen = false
  private wasLocked = false
  settings: GameSettings = { ...DEFAULT_SETTINGS }

  private lastHudJson = ''

  constructor(private container: HTMLElement) {
    this.engine = new Engine(container)
    this.engine.onFrame = (dt) => this.loop(dt)
    ;(window as unknown as { __minesouls?: Game }).__minesouls = this
    this.loadSettings()

    // NG+ cycle — read before any enemy exists so every body hardens
    try {
      const raw = localStorage.getItem(SAVE_KEY)
      if (raw) {
        const sd = JSON.parse(raw) as SaveData
        this.ng = Math.max(0, Math.floor(sd.ngPlus ?? 0))
        this.ended = !!sd.ending
      }
    } catch { /* ignore */ }
    setNgMult(1 + this.ng * 0.45)

    // scene setup — dusk atmosphere: bright enough to read every region,
    // warm enough to keep the Dark Souls mood (V2's midnight hid the map)
    const scene = this.engine.scene
    scene.background = new THREE.Color(0x2b3242)
    scene.fog = new THREE.Fog(0x2b3242, 46, 175)

    const hemi = new THREE.HemisphereLight(0xa8b2ce, 0x64513a, 1.4)
    scene.add(hemi)
    const sun = new THREE.DirectionalLight(0xffcf96, 1.55)
    sun.position.set(-52, 58, 22)
    sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    sun.shadow.autoUpdate = false
    sun.shadow.needsUpdate = true
    this.sun = sun
    sun.shadow.camera.left = -78
    sun.shadow.camera.right = 78
    sun.shadow.camera.top = 78
    sun.shadow.camera.bottom = -78
    sun.shadow.camera.far = 280
    sun.shadow.bias = -0.0005
    scene.add(sun)

    this.world = new WorldV3()
    scene.add(this.world.group)

    // bonfire decor: stuck sword + light + flame particles
    const bY = this.world.surfaceAt(BONFIRE.x, BONFIRE.z)
    const fireSword = createSword(1.5)
    fireSword.position.set(BONFIRE.x, bY + 0.1, BONFIRE.z)
    fireSword.rotation.z = 0.16
    fireSword.rotation.x = 0.1
    scene.add(fireSword)

    this.bonfireLight = new THREE.PointLight(0xff8033, 3, 16, 1.6)
    this.bonfireLight.position.set(BONFIRE.x, bY + 1.4, BONFIRE.z)
    scene.add(this.bonfireLight)

    const flameCount = 30
    const flamePos = new Float32Array(flameCount * 3)
    const flameCol = new Float32Array(flameCount * 3)
    this.flameSeeds = new Float32Array(flameCount)
    for (let i = 0; i < flameCount; i++) {
      this.flameSeeds[i] = Math.random()
      flameCol[i * 3] = 1
      flameCol[i * 3 + 1] = 0.45 + Math.random() * 0.4
      flameCol[i * 3 + 2] = 0.1
    }
    const flameGeo = new THREE.BufferGeometry()
    flameGeo.setAttribute('position', new THREE.BufferAttribute(flamePos, 3))
    flameGeo.setAttribute('color', new THREE.BufferAttribute(flameCol, 3))
    this.bonfireFlame = new THREE.Points(
      flameGeo,
      new THREE.PointsMaterial({
        size: 0.16, vertexColors: true, transparent: true, opacity: 0.95,
        depthWrite: false, blending: THREE.AdditiveBlending,
      })
    )
    scene.add(this.bonfireFlame)

    /* ---- the grey merchant: NPC + stall pitched behind the bonfire ---- */
    this.merchant = createMerchant()
    const mY = this.world.surfaceAt(MERCHANT.x, MERCHANT.z)
    // home yaw — he faces the bonfire hub and watches approaching players
    const mYaw = Math.atan2(BONFIRE.x - MERCHANT.x, BONFIRE.z - MERCHANT.z)
    this.merchantYaw = mYaw
    this.merchant.group.position.set(MERCHANT.x, mY, MERCHANT.z)
    this.merchant.group.rotation.y = mYaw
    scene.add(this.merchant.group)

    /* ---- the forge-keeper: the smith of the burned homestead ---- */
    this.smith = createSmith()
    const sY = this.topSurfaceAt(SMITH.x, SMITH.z)
    this.smith.group.position.set(SMITH.x, sY, SMITH.z)
    this.smith.group.rotation.y = Math.PI * 0.92 // faces the road, watching for customers
    scene.add(this.smith.group)

    /* ---- the Vale's secrets: chests, keys, walls that are not walls ---- */
    this.buildSecrets(scene)
    /* ---- the grey merchant's market stall — a proper travelling
       shop: striped awning, stocked back-shelf, counter wares, a
       hanging coin-sign, crates, barrels and a crimson banner ---- */
    const fwdX = Math.sin(mYaw)
    const fwdZ = Math.cos(mYaw)
    const wm = blockMaterials()
    const stall = new THREE.Group()
    const lam = (c: number) => new THREE.MeshLambertMaterial({ color: c })
    const flat = (c: number) => new THREE.MeshBasicMaterial({ color: c })
    const part = (
      w: number, h: number, d: number,
      x: number, y: number, z: number,
      m: THREE.Material | THREE.Material[],
      ry = 0
    ) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m)
      mesh.position.set(x, y, z)
      if (ry) mesh.rotation.y = ry
      mesh.castShadow = true
      mesh.receiveShadow = true
      stall.add(mesh)
      return mesh
    }
    const woodDark = lam(0x4a3320)
    const wood = lam(0x6b4a2c)
    const plankLite = lam(0x9a7448)
    const cream = lam(0xe6d9bd)
    const roseM = lam(0xa8444e)
    // deck + counter
    part(2.7, 0.14, 2.0, 0, 0.07, 0, woodDark)
    part(2.35, 0.78, 0.14, 0, 0.53, 0.64, wood)
    part(2.35, 0.5, 0.1, 0, 0.28, 0.7, woodDark)
    part(2.55, 0.1, 0.8, 0, 0.96, 0.58, plankLite)
    part(0.12, 0.95, 1.9, -1.3, 0.6, -0.05, woodDark)
    part(0.12, 0.95, 1.9, 1.3, 0.6, -0.05, woodDark)
    // frame posts + beams
    part(0.16, 2.75, 0.16, -1.25, 1.37, -0.9, woodDark)
    part(0.16, 2.75, 0.16, 1.25, 1.37, -0.9, woodDark)
    part(0.16, 2.35, 0.16, -1.25, 1.17, 0.85, woodDark)
    part(0.16, 2.35, 0.16, 1.25, 1.17, 0.85, woodDark)
    part(2.7, 0.12, 0.16, 0, 2.68, -0.9, woodDark)
    part(2.7, 0.12, 0.16, 0, 2.28, 0.85, woodDark)
    // striped awning — the merchant's colours, fringed at the front
    for (let i = 0; i < 5; i++) {
      const sx = -0.96 + i * 0.48
      const stripe = part(0.48, 0.09, 2.15, sx, 2.52, 0.02, i % 2 ? cream : roseM)
      stripe.rotation.x = 0.24
      part(0.48, 0.2, 0.06, sx, 2.18, 1.06, i % 2 ? cream : roseM)
    }
    // hanging sign — the gold coin on a board
    part(0.05, 0.3, 0.05, -0.22, 2.12, 1.02, woodDark)
    part(0.05, 0.3, 0.05, 0.22, 2.12, 1.02, woodDark)
    part(0.9, 0.55, 0.06, 0, 1.85, 1.02, plankLite)
    part(0.3, 0.3, 0.08, 0, 1.86, 1.06, flat(0xe8c25a))
    // the low back shelf — he stands behind it, wares on display
    part(2.2, 0.85, 0.42, 0, 0.42, -0.72, wood)
    part(2.2, 0.07, 0.46, 0, 0.88, -0.72, woodDark)
    const bookCols = [0x8a3230, 0x39607a, 0xc2a050, 0x4e7a52]
    for (let i = 0; i < 4; i++) part(0.16, 0.3, 0.26, -0.85 + i * 0.19, 1.06, -0.72, lam(bookCols[i]))
    part(0.22, 0.28, 0.22, 0.62, 1.05, -0.72, flat(0x9fd89f))
    part(0.22, 0.28, 0.22, 0.88, 1.05, -0.72, flat(0xd8b44a))
    // counter wares: a coin stack, potions, bread, a displayed dagger
    for (let i = 0; i < 3; i++) part(0.17, 0.05, 0.17, 0.8, 1.03 + i * 0.055, 0.5, flat(0xe8c25a))
    part(0.18, 0.26, 0.18, -0.6, 1.12, 0.45, flat(0xd85a5a))
    part(0.18, 0.26, 0.18, -0.35, 1.12, 0.5, flat(0x6ad87a))
    part(0.26, 0.13, 0.16, 0.15, 1.08, 0.45, plankLite, 0.35)
    part(0.26, 0.13, 0.16, 0.4, 1.08, 0.52, plankLite, 0.1)
    const blade = part(0.07, 0.62, 0.14, -0.05, 1.28, 0.55, flat(0xb9c2cf))
    blade.rotation.y = 0.9
    blade.rotation.z = 0.06
    part(0.16, 0.05, 0.2, -0.05, 1.1, 0.55, flat(0xe8c25a), 0.9)
    // lantern on the front-right post
    const lampGlass = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.34, 0.26), flat(0xffcf6a))
    lampGlass.position.set(1.08, 2.05, 0.72)
    const lampTop = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.1, 0.36), woodDark)
    lampTop.position.set(1.08, 2.27, 0.72)
    stall.add(lampGlass, lampTop)
    // side props: crates, barrels, hay, a sack, a banner pole
    const crateM = wm.crate as THREE.Material
    const hayM = wm.hay as THREE.Material
    const woolM = wm.woolred as THREE.Material
    part(0.54, 0.54, 0.54, -1.8, 0.27, 0.35, crateM, 0.35)
    part(0.5, 0.5, 0.5, -1.75, 0.79, 0.3, crateM, -0.25)
    part(0.56, 0.72, 0.56, 1.8, 0.36, 0.25, lam(0x77522e))
    part(0.6, 0.08, 0.6, 1.8, 0.4, 0.25, lam(0x3d3d3d))
    part(0.6, 0.08, 0.6, 1.8, 0.2, 0.25, lam(0x3d3d3d))
    part(0.46, 0.6, 0.46, 1.72, 0.23, -0.5, lam(0x77522e), 0.5)
    part(0.72, 0.46, 0.72, -1.85, 0.23, -0.55, hayM)
    part(0.44, 0.36, 0.44, 1.05, 0.18, 1.15, lam(0xb09858), 0.9)
    part(0.09, 2.9, 0.09, 1.45, 1.45, 0.98, woodDark)
    part(0.06, 0.85, 0.52, 1.43, 2.25, 0.66, woolM)
    // the worn customer rug
    const rug = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.05, 1.15), lam(0x8a3b30))
    rug.position.set(0, 0.035, 1.45)
    rug.receiveShadow = true
    stall.add(rug)
    stall.position.set(MERCHANT.x + fwdX * 1.0, mY, MERCHANT.z + fwdZ * 1.0)
    stall.rotation.y = mYaw
    scene.add(stall)
    // lantern rides on the stall frame so it always tracks the counter
    this.merchantLamp = new THREE.PointLight(0xffb050, 1.6, 7, 1.7)
    this.merchantLamp.position.set(1.08, 2.1, 0.72)
    stall.add(this.merchantLamp)

    // player
    this.player = new Player(scene)
    const spawn = new THREE.Vector3(BONFIRE.x + 2.5, 0, BONFIRE.z + 2)
    spawn.y = this.world.surfaceAt(spawn.x, spawn.z)
    this.player.reset(spawn, Math.PI * 0.85)

    // enemies
    // the hollows — placed like a director, not a dice roll: they haunt
    // their own village street, door to door, the way they lived
    const spawnPts: [number, number][] = [
      [-41, 20],  // by the well square's west corner, still sweeping ash
      [-35, 17],  // across the square, facing its old neighbour
      [-38, 14],  // the well, circling the water it can't drink
      [-43, 17],  // the gap between the two west houses
      [-33, 25],  // the village's south fence gap
      [-38, 9],   // the street's north end, back to the parish ramp
    ]
    for (const [x, z] of spawnPts) {
      const p = new THREE.Vector3(x, 0, z)
      p.y = this.world.surfaceAt(x, z)
      this.spawns.push(p)
      const e = new Enemy(scene, 'zombie', p, {
        hp: 82, dmg: 21, speed: 2.75, aggro: 12.5, atkRange: 2.05,
        windup: 0.62, recover: 0.85, souls: 35, scale: 0.98,
      })
      e.world = this.world
      e.game = this
      this.enemies.push(e)
    }

    // creepers — failed vessels of ember, coiled in the world's veins
    const creeperPts: [number, number][] = [
      [-45, 18],  // behind the west houses, where the field wall bends
      [-30, 25],  // by the south fence, east of House B
      [-40, 9],   // the lane below the woodshed
    ]
    for (const [x, z] of creeperPts) {
      const p = new THREE.Vector3(x, 0, z)
      p.y = this.world.surfaceAt(x, z)
      const c = new CreeperEnemy(scene, p)
      c.world = this.world
      c.game = this
      this.enemies.push(c)
    }

    // skeleton archers — oath-keepers at their old posts: the parish
    // arrival, the graveyard gate, and the fortress yard
    const skelPts: [number, number][] = [
      [-39, -3],  // the parish ramp, covering the climb with the long sight
      [-21, -21], // outside the graveyard gate (short sight — the boss yard stays fair)
      [44, 14],   // the east wastes, by the second lava pool
    ]
    for (const [x, z] of skelPts) {
      const p = new THREE.Vector3(x, 0, z)
      p.y = this.world.surfaceAt(x, z)
      const s = new SkeletonEnemy(scene, p, x === -21 && z === -21 ? 9 : 13.5)
      s.world = this.world
      s.game = this
      this.enemies.push(s)
    }

    // wither skeletons — the Ash Wastes guards; their heavy grey blades
    // chew through shields, so roll instead of block
    const witherPts: [number, number][] = [
      [28, 18],  // the wastes road, by the first lava pool's rim
      [34, -3],  // the fortress gate apron
      [26, 10],  // the ash flats west of the road
    ]
    for (const [x, z] of witherPts) {
      const p = new THREE.Vector3(x, 0, z)
      p.y = this.world.surfaceAt(x, z)
      const w = new WitherSkeletonEnemy(scene, p)
      w.world = this.world
      w.game = this
      this.enemies.push(w)
    }

    // blazes — floating sentries spitting fireballs over the wastes
    const blazePts: [number, number][] = [
      [26, 8],   // over the ash flats by the wayside shrine
      [48, -2],  // over the far ash, watching the fortress' east wall
    ]
    for (const [x, z] of blazePts) {
      const p = new THREE.Vector3(x, 0, z)
      p.y = this.world.surfaceAt(x, z)
      const b = new BlazeEnemy(scene, p)
      b.world = this.world
      b.game = this
      this.enemies.push(b)
    }

    // ---- champions — the mini-lords of the Vale ----
    // the Watchers' Captain holds the head of the shortcut stair: a withered
    // giant in charred plate, carrying the tally-blade of his lost watch
    const capPos = new THREE.Vector3(-16, 0, -11)
    capPos.y = this.world.surfaceAt(capPos.x, capPos.z)
    const captain = new WitherSkeletonEnemy(scene, capPos, {
      hp: 420, dmg: 30, speed: 3.2, aggro: 10.5, atkRange: 2.6, windup: 0.62, recover: 0.7,
      souls: 700, scale: 1.38, champion: true, name: 'سردارِ نگهبانان',
    })
    captain.world = this.world
    captain.game = this
    captain.champLoot = 'captain_blade'
    this.enemies.push(captain)

    // the Grave Warden walks the candlelit graveyard — a bone champion whose
    // oath is older than the graves he tends; his shield still carries a flame
    const gwPos = new THREE.Vector3(-24, 0, -27)
    gwPos.y = this.world.surfaceAt(gwPos.x, gwPos.z)
    const warden = new SkeletonEnemy(scene, gwPos, 9, {
      hp: 300, dmg: 22, speed: 2.6, aggro: 9, atkRange: 2.2, windup: 0.8, recover: 0.6,
      souls: 550, scale: 1.32, champion: true, name: 'نگهبانِ گورها',
    })
    warden.world = this.world
    warden.game = this
    warden.champLoot = 'warden_shield'
    this.enemies.push(warden)

    // boss 1 — the ancient zombie knight beyond the town's fog
    const bossSpawn = new THREE.Vector3(BOSS_CENTER.x, 0, BOSS_CENTER.z)
    bossSpawn.y = this.world.surfaceAt(BOSS_CENTER.x, BOSS_CENTER.z)
    this.boss = new BossEnemy(scene, bossSpawn)
    this.boss.world = this.world
    this.boss.game = this
    // boss 2 — the Flame King of the caldera, behind the breach fog
    const boss2Spawn = new THREE.Vector3(BOSS2_CENTER.x, 0, BOSS2_CENTER.z)
    boss2Spawn.y = this.world.surfaceAt(BOSS2_CENTER.x, BOSS2_CENTER.z)
    this.boss2 = new BossFlameEnemy(scene, boss2Spawn)
    this.boss2.world = this.world
    this.boss2.game = this
    // boss 3 — the First Coal, asleep in his pit until the Vale cracks
    const boss3Spawn = new THREE.Vector3(COAL_CENTER.x, 0, COAL_CENTER.z)
    boss3Spawn.y = this.world.surfaceAt(COAL_CENTER.x, COAL_CENTER.z)
    this.boss3 = new CoalLordEnemy(scene, boss3Spawn)
    this.boss3.world = this.world
    this.boss3.game = this
    // the pit guards — wither sentries + a blaze over the lava lung
    const pitPts: [number, number][] = [
      [29, -43], [40, -44],
    ]
    for (const [x, z] of pitPts) {
      const p = new THREE.Vector3(x, 0, z)
      p.y = this.world.surfaceAt(x, z)
      const w = new WitherSkeletonEnemy(scene, p)
      w.world = this.world
      w.game = this
      this.enemies.push(w)
    }
    const pitBlaze = new THREE.Vector3(34, 0, -49)
    pitBlaze.y = this.world.surfaceAt(34, -49)
    const pb = new BlazeEnemy(scene, pitBlaze)
    pb.world = this.world
    pb.game = this
    this.enemies.push(pb)

    // NG+ cycles harden every common body (the lords temper themselves)
    if (this.ng > 0) {
      const m = 1 + this.ng * 0.45
      for (const e of this.enemies) e.harden(m)
    }

    // the pyromancy flame, waiting in the wastes' entrance ruins
    this.buildPyroItem()

    // the memorial stones — the world tells its own story
    this.buildLoreStones()
    this.restoreLoreSeen()

    // DOM overlays (reticle + hurt vignette)
    this.reticle = document.createElement('div')
    this.reticle.style.cssText =
      'position:absolute;width:14px;height:14px;border:2px solid rgba(255,90,90,0.95);transform:translate(-50%,-50%) rotate(45deg);display:none;pointer-events:none;box-shadow:0 0 6px rgba(255,60,60,0.8);z-index:5'
    container.appendChild(this.reticle)

    this.vignette = document.createElement('div')
    this.vignette.style.cssText =
      'position:absolute;inset:0;pointer-events:none;opacity:0;z-index:4;background:radial-gradient(ellipse at center, rgba(255,0,0,0) 45%, rgba(180,0,0,0.55) 100%)'
    container.appendChild(this.vignette)

    this.buildMinimap(container)

    this.engine.start()
  }

  get allEnemies(): Enemy[] {
    const list = [...this.enemies]
    if (!this.bossFell) list.push(this.boss)
    if (!this.boss2Fell) list.push(this.boss2)
    if (!this.boss3Fell) list.push(this.boss3)
    return list
  }

  /** whichever lord is currently fighting — drives the HUD boss bar */
  private get activeBoss(): Enemy | null {
    if (this.bossActive && !this.bossFell) return this.boss
    if (this.boss2Active && !this.boss2Fell) return this.boss2
    if (this.boss3Active && !this.boss3Fell) return this.boss3
    return null
  }

  /** walking surface INCLUDING built blocks (crates, floors, anvils) */
  private topSurfaceAt(x: number, z: number): number {
    let y = this.world.surfaceAt(x, z)
    for (let i = 0; i < 4; i++) {
      if (this.world.solidStruct(Math.round(x), Math.round(y), Math.round(z))) y++
      else break
    }
    return y
  }

  /* ================= PUBLIC API (for React) ================= */

  startGame() {
    this.sfx.resume()
    this.loadSave()
    this.player.fullRestore()
    this.refreshLoadout()
    this.phase = 'playing'
    if (!this.engine.input.isTouch) this.engine.input.requestLock()
    this.emit(true)
    // first light — the establishing shot of the Vale (once per save)
    if (!this.cineSeen.intro) {
      this.cineSeen.intro = true
      this.startIntroCinematic()
    }
  }

  /* ---------- pause / menus / settings ---------- */

  pause() {
    if (this.phase !== 'playing') return
    this.phase = 'paused'
    this.wasLocked = false
    this.engine.input.releaseLock()
    this.emit(true)
  }

  resume() {
    if (this.phase !== 'paused') return
    this.phase = 'playing'
    if (!this.engine.input.isTouch) this.engine.input.requestLock()
    this.emit(true)
  }

  /** quit the fight and return to the title screen (world softly resets) */
  exitToMenu() {
    if (this.phase === 'menu') return
    this.engine.input.releaseLock()
    this.respawn()
    this.phase = 'menu'
    this.engine.input.releaseLock()
    // an ended story keeps the NG+ door open in the menu
    this.ended = true
    this.emit(true)
  }

  applySettings(patch: Partial<GameSettings>) {
    this.settings = { ...this.settings, ...patch }
    this.sfx.setVolume(this.settings.volume)
    this.sun.castShadow = this.settings.shadows
    this.sun.shadow.needsUpdate = true
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings))
    } catch { /* ignore */ }
    this.emit(false)
  }

  private loadSettings() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY)
      if (raw) this.settings = { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<GameSettings>) }
    } catch { /* ignore */ }
    // deferred apply — sun/sfx exist after construction
    queueMicrotask(() => {
      this.sfx.setVolume(this.settings.volume)
      this.sun.castShadow = this.settings.shadows
    })
  }

  hasSave(): boolean {
    try {
      return !!localStorage.getItem(SAVE_KEY)
    } catch {
      return false
    }
  }

  clearSave() {
    try {
      localStorage.removeItem(SAVE_KEY)
    } catch { /* ignore */ }
  }

  nextCost(): number {
    return 80 * this.player.level
  }

  rest() {
    if (this.phase !== 'playing') return
    this.phase = 'rest'
    this.player.fullRestore()
    for (const e of this.enemies) e.reset()
    if (!this.bossFell) this.boss.reset()
    if (!this.boss2Fell) this.boss2.reset()
    if (!this.boss3Fell) this.boss3.reset()
    this.bossActive = false
    this.boss2Active = false
    this.boss3Active = false
    this.bossActiveBarrier = false
    this.boss2Barrier = false
    this.boss3Barrier = false
    this.world.setFogGatesVisible(!this.bossFell, !this.boss2Fell)
    this.world.setPitOpen(this.boss2Fell) // the rockfall obeys the Flame King's fate
    this.save()
    this.sfx.bonfire()
    // free the cursor! pointer lock retargets every click to the canvas,
    // which made the rest menu (level-up / arise) unclickable on desktop
    this.engine.input.releaseLock()
    this.emit(true)
  }

  leaveRest() {
    if (this.phase !== 'rest') return
    this.phase = 'playing'
    if (!this.engine.input.isTouch) this.engine.input.requestLock()
    this.wasLocked = false
    this.emit(true)
  }

  /* ================= SHOP ================= */

  openShop() {
    if (this.phase !== 'playing') return
    this.phase = 'shop'
    this.engine.input.releaseLock()
    this.wasLocked = false
    this.sfx.souls()
    this.emit(true)
  }

  /* ================= LORE STONES ================= */

  /** carve the memorial stones into the world — ghost-green runes,
      brighter and taller-lit until they have been read once */
  private buildLoreStones() {
    const scene = this.engine.scene
    const cobbleMat = this.world.mats.cobble as THREE.Material
    const brickMat = this.world.mats.stonebrick as THREE.Material
    const glowMat = this.world.mats.glow as THREE.Material
    for (const def of LORE_STONES) {
      const y = this.world.surfaceAt(def.x, def.z)
      const g = new THREE.Group()
      g.position.set(def.x, 0, def.z)
      g.rotation.y = def.yaw
      // buried footing + standing slab + the glowing rune strip
      const base = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.55, 0.75), cobbleMat)
      base.position.y = y + 0.18
      base.castShadow = true
      base.receiveShadow = true
      const slab = new THREE.Mesh(new THREE.BoxGeometry(0.78, 1.65, 0.26), brickMat)
      slab.position.y = y + 1.22
      slab.rotation.z = (Math.sin(def.x * 13.7 + def.z * 7.1) * 0.05)
      slab.castShadow = true
      slab.receiveShadow = true
      const rune = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.95, 0.06), glowMat)
      rune.position.set(0, y + 1.28, 0.15)
      g.add(base, slab, rune)
      const light = new THREE.PointLight(0x9fe8b8, 1.35, 5.5, 1.9)
      light.position.set(0, y + 1.9, 0)
      g.add(light)
      scene.add(g)
      this.loreStones.push({ id: def.id, title: def.title, group: g, light, seen: false, justRead: false })
    }
  }

  loreCount(): number {
    return this.loreStones.filter((s) => s.seen).length
  }

  /** read the save on boot so the title screen can show the true memory count */
  private restoreLoreSeen() {
    try {
      const raw = localStorage.getItem(SAVE_KEY)
      if (!raw) return
      const d = JSON.parse(raw) as SaveData
      const readLore = Array.isArray(d.lore) ? d.lore : []
      for (const st of this.loreStones) {
        if (readLore.includes(st.id)) {
          st.seen = true
          st.light.intensity = 0.5
        }
      }
    } catch { /* ignore */ }
  }

  get loreTotal(): number {
    return this.loreStones.length
  }

  openLore(id: string) {
    if (this.phase !== 'playing') return
    const st = this.loreStones.find((s) => s.id === id)
    if (!st) return
    st.justRead = !st.seen
    if (!st.seen) {
      st.seen = true
      st.light.intensity = 0.5
      this.save()
    }
    this.loreOpenId = id
    this.phase = 'lore'
    this.engine.input.releaseLock()
    this.wasLocked = false
    this.sfx.souls()
    this.emit(true)
  }

  closeLore() {
    if (this.phase !== 'lore') return
    this.loreOpenId = null
    for (const s of this.loreStones) s.justRead = false
    this.phase = 'playing'
    if (!this.engine.input.isTouch) this.engine.input.requestLock()
    this.wasLocked = false
    this.emit(true)
  }

  closeShop() {
    if (this.phase !== 'shop') return
    this.phase = 'playing'
    if (!this.engine.input.isTouch) this.engine.input.requestLock()
    this.wasLocked = false
    this.emit(true)
  }

  /** buy one level of a shop item — validates souls, applies, persists */
  buyShopItem(id: 'estus' | 'whet' | 'coal') {
    if (this.phase !== 'shop') return
    const def = SHOP_ITEMS.find((i) => i.id === id)
    if (!def) return
    const lv = this.shopLv[id]
    if (lv >= def.max) return
    if (id === 'coal' && !this.pyroUnlocked) return
    const cost = def.price(lv)
    if (this.player.souls < cost) return
    this.player.souls -= cost
    this.shopLv[id] = lv + 1
    if (id === 'estus') {
      this.player.maxEstus = Math.min(6, this.player.maxEstus + 1)
      this.player.estus = this.player.maxEstus
    } else if (id === 'whet') {
      this.player.gearDmg = this.shopLv.whet * 0.08
    } else {
      this.player.maxPyro = Math.min(8, this.player.maxPyro + 1)
      this.player.pyro = this.player.maxPyro
    }
    this.sfx.levelUp()
    this.spawnText(
      `${def.name} خریداری شد!`,
      '#8fd97a',
      this.player.pos.clone().add(new THREE.Vector3(0, 2.4, 0))
    )
    this.save()
    this.emit(true)
  }

  /* ================= THE FORGE — weapon upgrades ================= */

  openSmith() {
    if (this.phase !== 'playing') return
    this.phase = 'smith'
    this.engine.input.releaseLock()
    this.wasLocked = false
    this.sfx.souls()
    this.emit(true)
  }

  closeSmith() {
    if (this.phase !== 'smith') return
    this.phase = 'playing'
    if (!this.engine.input.isTouch) this.engine.input.requestLock()
    this.wasLocked = false
    this.emit(true)
  }

  /** the smith re-tempers one blade in the bag — souls + iron + ember-iron */
  upgradeWeapon(id: ItemId) {
    if (this.phase !== 'smith') return
    const it = ITEMS[id]
    if (!it || it.cat !== 'sword') return
    const lv = this.upgrades[id] ?? 0
    const cost = upgradeCost(lv)
    if (!cost) return
    if (this.countOf(id) <= 0) return
    if (this.player.souls < cost.souls) return
    if (this.countOf('iron_chunk') < cost.iron) return
    if (this.countOf('ember_iron') < cost.ember) return
    this.player.souls -= cost.souls
    if (cost.iron > 0) this.removeItem('iron_chunk', cost.iron)
    if (cost.ember > 0) this.removeItem('ember_iron', cost.ember)
    this.upgrades[id] = lv + 1
    this.refreshLoadout()
    this.sfx.heavy()
    this.sfx.levelUp()
    // sparks fly at the anvil — the smith's yard answers the hammer
    const anvil = new THREE.Vector3(SMITH.x + 1, this.topSurfaceAt(SMITH.x + 1, SMITH.z + 1.4) + 0.6, SMITH.z + 1.4)
    this.spawnBurst(anvil, 0xffc23d, 16, 2.6, 0.5, 0.1)
    this.spawnBurst(anvil, 0xff8a2a, 10, 1.8, 0.6, 0.14)
    this.showToast(`${it.name} → +${lv + 1}`)
    this.save()
    this.emit(true)
  }

  /** the forge-keeper's panel snapshot */
  private smithHud(): SmithHud {
    const blades = this.inv
      .filter((e) => ITEMS[e.id]?.cat === 'sword')
      .map((e) => {
        const lv = this.upgrades[e.id] ?? 0
        const cost = upgradeCost(lv)
        const affordable =
          !!cost &&
          this.player.souls >= cost.souls &&
          this.countOf('iron_chunk') >= cost.iron &&
          this.countOf('ember_iron') >= cost.ember
        return {
          id: e.id,
          name: ITEMS[e.id].name,
          icon: ITEMS[e.id].icon,
          lv,
          dmg: Math.round((ITEMS[e.id].dmg ?? 0) * upgradeMult(lv)),
          equipped: ALL_SLOTS.some((s) => this.eq[s] === e.id),
          cost,
          affordable,
        }
      })
    return {
      souls: Math.floor(this.player.souls),
      iron: this.countOf('iron_chunk'),
      ember: this.countOf('ember_iron'),
      line: SMITH_LINES[Math.floor(this.time / 11) % SMITH_LINES.length],
      blades,
    }
  }

  levelUp(stat: 'vit' | 'end' | 'str') {
    if (this.phase !== 'rest') return
    const cost = this.nextCost()
    if (this.player.souls < cost) return
    this.player.souls -= cost
    this.player.applyLevel(stat)
    // resting heals — a fresh level-up tops up the new maximum too
    this.player.hp = this.player.maxHp
    this.player.stamina = this.player.maxStamina
    this.refreshLoadout()
    this.save()
    this.sfx.levelUp()
    this.emit(true)
  }

  /* ================= INVENTORY & EQUIPMENT (Dark-Souls style) ================= */

  openInventory() {
    if (this.phase !== 'playing') return
    this.phase = 'inventory'
    this.engine.input.releaseLock()
    this.wasLocked = false
    this.sfx.souls()
    this.emit(true)
  }

  closeInventory() {
    if (this.phase !== 'inventory') return
    this.phase = 'playing'
    if (!this.engine.input.isTouch) this.engine.input.requestLock()
    this.wasLocked = false
    this.emit(true)
  }

  countOf(id: ItemId): number {
    return this.inv.find((s) => s.id === id)?.n ?? 0
  }

  /* ================= THE VALE'S SECRETS — chests, keys, illusions ================= */

  /** every secret of category 2, placed once at world build:
      five chests (two locked), two keys waiting in the world, one
      stray ring on the Old Circle, and three illusion walls. */
  private buildSecrets(scene: THREE.Scene) {
    const top = (x: number, z: number) => this.world.surfaceAt(x, z)

    /* ---- the chests ---- */
    const addChest = (
      x: number, z: number, locked: boolean, key: ItemId | undefined, loot: LootRoll[], rotY = 0
    ) => {
      const { group, lid } = createChest(locked)
      const y = top(x, z)
      group.position.set(x, y, z)
      group.rotation.y = rotY
      scene.add(group)
      this.chests.push({ group, lid, x, z, y, locked, key, loot, opened: false, openT: 0 })
    }
    // the burned homestead — tucked behind the forge wall, a starter secret
    addChest(-40.5, 33.5, false, undefined, [{ id: 'ring_ember_knight', n: 1 }], Math.PI * 0.15)
    // the crypt — ON the tomb slab, under lock: the grey dead keep the grey tithe
    addChest(-31.5, -35.5, true, 'key_crypt', [{ id: 'amulet_souls', n: 1 }, { id: 'ember_iron', n: 1 }], Math.PI)
    // the watchtower ruin — the beacon-keeper's pay, under lock
    addChest(10.5, 3.5, true, 'key_tower', [{ id: 'ring_ashwalker', n: 1 }, { id: 'arrow_fire', n: 6 }], Math.PI * 0.7)
    // the church sacristy — behind the shimmering west wall
    addChest(-42.5, -29.5, false, undefined, [{ id: 'amulet_vigil', n: 1 }], Math.PI * 0.5)
    // the warden's closet — behind the barracks' shimmering north wall
    addChest(44, -24.5, false, undefined, [{ id: 'amulet_iron_skin', n: 1 }, { id: 'iron_chunk', n: 2 }], Math.PI * 0.85)
    // the maker's seam — behind the pit's shimmering rim, the last secret
    addChest(23.5, -45.5, false, undefined, [{ id: 'ring_first_maker', n: 1 }], Math.PI * 0.5)

    /* ---- the keys & the stray charm, waiting in the open ---- */
    const addPickup = (id: ItemId, x: number, z: number, lightColor: number | null) => {
      const isRing = ITEMS[id]?.cat === 'charm'
      const mesh = isRing ? createRingProp() : createKeyProp(id === 'key_tower')
      const y = top(x, z) + 0.55
      mesh.position.set(x, y, z)
      scene.add(mesh)
      let light: THREE.PointLight | null = null
      if (lightColor !== null) {
        light = new THREE.PointLight(lightColor, 1.6, 5.5, 1.8)
        light.position.set(x, y + 0.4, z)
        scene.add(light)
      }
      this.pickups.push({ id, mesh, light, x, z })
    }
    // the crypt key — the graveyard keeps it beside its mourner
    addPickup('key_crypt', -24.5, -27.5, 0xffe2a0)
    // the tower key — the hermit's cold fire keeps it warm
    addPickup('key_tower', 30.6, 21.4, 0xffe2a0)
    // the clinging ring — the Old Circle's ember points to it
    addPickup('ring_cling', 3.4, 48.6, 0xffc86a)

    /* ---- the illusion walls ---- */
    const addIllusion = (
      cells: [number, number, number][], matKey: string, tint: number
    ) => {
      const group = new THREE.Group()
      const base = this.world.mats[matKey] as THREE.MeshLambertMaterial | undefined
      const mats: THREE.MeshLambertMaterial[] = []
      for (const [x, y, z] of cells) {
        const m = new THREE.MeshLambertMaterial({
          color: (base ? base.color.clone() : new THREE.Color(tint)) as THREE.Color,
          map: base?.map ?? null,
        })
        m.userData.illusion = true
        mats.push(m)
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), m)
        mesh.position.set(x, y + 0.5, z)
        mesh.castShadow = true
        mesh.receiveShadow = true
        group.add(mesh)
        this.world.markSolid(x, y, z, true)
      }
      scene.add(group)
      this.illusions.push({
        group, cells,
        x: cells.reduce((a, c) => a + c[0], 0) / cells.length,
        z: cells.reduce((a, c) => a + c[2], 0) / cells.length,
        mats, broken: false, fade: 1, phase: Math.random() * Math.PI * 2,
      })
    }
    // the church sacristy — west wall of the parish church
    addIllusion([[-41, 13, -30], [-41, 14, -30], [-41, 13, -29], [-41, 14, -29]], 'stonebrick', 0x9a9484)
    // the warden's closet — the barracks' north wall of the fortress
    addIllusion([[43, 10, -22], [44, 10, -22]], 'cobble', 0x8a8578)
    // the maker's seam — the pit's west rim mouth
    addIllusion([[24, 2, -46], [24, 3, -46], [24, 2, -45], [24, 3, -45]], 'darkstone', 0x3a3438)
  }

  /** the secret tick — shimmer, bobbing keys, swinging lids */
  private updateSecrets(dt: number) {
    // illusion walls breathe — a faint warm shimmer betrays the spell
    for (const il of this.illusions) {
      if (il.broken) {
        if (il.fade <= 0) continue
        il.fade = Math.max(0, il.fade - dt / 0.6)
        for (const m of il.mats) {
          m.transparent = true
          m.opacity = il.fade
        }
        if (il.fade <= 0) il.group.visible = false
        continue
      }
      const pulse = 0.16 + Math.sin(this.time * 1.7 + il.phase) * 0.12
      for (const m of il.mats) m.emissiveIntensity = pulse
      for (const m of il.mats) m.emissive.setRGB(0.28, 0.2, 0.12)
    }
    // the lids swing when they open
    for (const c of this.chests) {
      if (!c.opened || c.openT >= 1) continue
      c.openT = Math.min(1, c.openT + dt / 0.45)
      c.lid.rotation.x = -1.85 * (1 - Math.pow(1 - c.openT, 3))
    }
    // keys and stray charms turn in place, dreaming of a hand
    for (const p of this.pickups) {
      p.mesh.rotation.y += dt * 1.4
      p.mesh.position.y = this.world.surfaceAt(p.x, p.z) + 0.55 + Math.sin(this.time * 2.1 + p.x) * 0.09
    }
  }

  /** the prompt + interaction for chests, keys, illusions — called by detectPrompt/interact */
  private nearestSecret(): { prompt: string; act: () => void } | null {
    const px = this.player.pos.x
    const pz = this.player.pos.z
    let bestD = Infinity
    let bestPrompt = ''
    let bestAct: (() => void) | null = null
    const consider = (d: number, prompt: string, act: () => void) => {
      if (d < 2.0 && d < bestD) {
        bestD = d
        bestPrompt = prompt
        bestAct = act
      }
    }
    // unopened chests
    for (const c of this.chests) {
      if (c.opened) continue
      const d = Math.hypot(px - c.x, pz - c.z)
      const name = c.locked && c.key ? ITEMS[c.key]?.name : null
      const canUnlock = !c.locked || (c.key && this.countOf(c.key) > 0)
      consider(
        d,
        canUnlock ? 'باز کردن صندوق' : `صندوقِ قفل‌شده — ${name} لازم است`,
        () => this.openChest(c)
      )
    }
    // illusion walls — the shimmer wants a hand
    for (const il of this.illusions) {
      if (il.broken) continue
      const d = Math.hypot(px - il.x, pz - il.z)
      consider(d, 'دیوارِ مشکوک — افسون را بشکن', () => this.breakIllusion(il))
    }
    // world pickups — keys and stray charms
    for (const p of this.pickups) {
      const d = Math.hypot(px - p.x, pz - p.z)
      consider(d, `برداشتن ${ITEMS[p.id]?.name ?? 'گمشده'}`, () => this.collectPickup(p))
    }
    return bestAct ? { prompt: bestPrompt, act: bestAct } : null
  }

  /** a chest opens: the lock answers or refuses, the loot pops out */
  private openChest(c: (typeof this.chests)[number]) {
    if (c.locked) {
      if (!c.key || this.countOf(c.key) <= 0) {
        this.showToast('قفل است — کلیدش را پیدا کن')
        this.sfx.hiss()
        return
      }
      this.removeItem(c.key, 1)
      this.showToast(`${ITEMS[c.key].name} مصرف شد`)
    }
    c.opened = true
    c.openT = 0
    this.sfx.reveal()
    const at = new THREE.Vector3(c.x, c.y + 0.5, c.z)
    this.spawnBurst(at, 0xffd76a, 24, 3, 1.1, 0.16)
    this.spawnLoot(c.loot, at)
  }

  /** an illusion wall dissolves — the Vale exhales */
  private breakIllusion(il: (typeof this.illusions)[number]) {
    if (il.broken) return
    il.broken = true
    for (const [x, y, z] of il.cells) this.world.markSolid(x, y, z, false)
    this.sfx.cast()
    this.sfx.hiss()
    const mid = new THREE.Vector3(il.x, il.group.children[0].position.y, il.z)
    this.spawnBurst(mid, 0xcfc4ae, 30, 3.6, 1.0, 0.2)
    this.spawnBurst(mid, 0x8fd97a, 12, 2.4, 0.8, 0.14)
    this.showToast('افسون فرو ریخت — راز درّه آشکار شد')
    this.emit(true)
  }

  /** a key or stray charm joins the bag */
  private collectPickup(p: (typeof this.pickups)[number]) {
    const idx = this.pickups.indexOf(p)
    if (idx < 0) return
    this.pickups.splice(idx, 1)
    this.engine.scene.remove(p.mesh)
    if (p.light) this.engine.scene.remove(p.light)
    this.addItem(p.id, 1)
    this.sfx.shard()
    const it = ITEMS[p.id]
    this.spawnText(it?.name ?? '', '#ffd54a', p.mesh.position.clone().add(new THREE.Vector3(0, 0.8, 0)))
    this.spawnBurst(p.mesh.position, 0xffd76a, 16, 2.4)
    this.save()
    this.emit(true)
  }

  /** forge-heat: +3 glows cherry-red, +5 burns like the pit itself */
  private applySwordHeat(sword: THREE.Group | null, lv: number) {
    if (!sword || lv <= 0) return
    const heat = Math.min(1, lv / 5)
    sword.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (!(mesh instanceof THREE.Mesh)) return
      const m = mesh.material as THREE.MeshLambertMaterial
      if (!m || Array.isArray(m) || !(m as THREE.MeshLambertMaterial).isMeshLambertMaterial) return
      // only the metal parts heat up — keep grips/wraps dark (they're brown/dark)
      const c = m.color
      const lum = c.r * 0.4 + c.g * 0.5 + c.b * 0.55
      if (lum < 0.32) return
      if (!m.userData.heatBase) {
        m.userData.heatBase = { r: c.r, g: c.g, b: c.b }
      }
      const base = m.userData.heatBase as { r: number; g: number; b: number }
      // lerp the blade toward ember-red, then white-hot at +5
      const t = lv >= 5 ? 0.85 : 0.35 + heat * 0.35
      c.setRGB(
        base.r + (1 - base.r) * t,
        base.g + (0.32 - base.g) * t * 0.9,
        base.b + (0.12 - base.b) * t * 0.8
      )
      if (lv >= 5) {
        m.emissive = new THREE.Color(0x5a1e08)
      }
    })
  }

  private addItem(id: ItemId, n = 1) {
    const slot = this.inv.find((s) => s.id === id)
    if (slot) slot.n += n
    else this.inv.push({ id, n })
  }

  private removeItem(id: ItemId, n = 1): boolean {
    const i = this.inv.findIndex((s) => s.id === id)
    if (i < 0 || this.inv[i].n < n) return false
    this.inv[i].n -= n
    if (this.inv[i].n <= 0) this.inv.splice(i, 1)
    return true
  }

  /** spawn a loot drop at (near) a position, with a tiny scatter for multi-drops */
  private spawnLoot(rolls: LootRoll[], pos: THREE.Vector3) {
    let k = 0
    for (const r of rolls) {
      if (!ITEMS[r.id]) continue
      const off = k === 0 ? new THREE.Vector3(0, 0, 0) : new THREE.Vector3(Math.cos(k * 2.4) * 0.9, 0, Math.sin(k * 2.4) * 0.9)
      this.loots.push(new LootDrop(this, r.id, r.n, pos.clone().add(off)))
      k++
    }
    if (k > 0) this.save()
  }

  /** recompute everything the equipped gear does to the body + its looks */
  refreshLoadout() {
    const rhId = this.eq[this.rhActive === 1 ? 'rh1' : 'rh2']
    const lhId = this.eq[this.lhActive === 1 ? 'lh1' : 'lh2']
    const rh = rhId ? ITEMS[rhId] : null
    const lh = lhId ? ITEMS[lhId] : null
    const load = equipLoad(this.eq)
    const max = maxLoadFor(this.player.level)
    const tier = rollTier(load, max)
    const info = TIER_INFO[tier]
    const armor = armorTotals(this.eq)
    // the charms whisper — rings & amulets tilt every number a little
    const charm = charmTotals(this.eq)
    // the forge lives in the blade: a re-tempered edge cuts deeper
    const forgeMult = upgradeMult(this.upgrades[rhId ?? ''] ?? 0)
    this.player.loadout = {
      weaponMult: (rh?.dmg ? rh.dmg / 30 : 1) * forgeMult * charm.dmgMul,
      weaponSpd: rh?.spd ?? 1,
      block: lh?.block ?? 0,
      def: Math.min(0.75, armor.def + charm.soak),
      fire: Math.min(0.8, armor.fire + charm.soak),
      blast: Math.min(0.8, armor.blast + charm.soak),
      walkMult: info.walk * charm.walkMul,
      sprintMult: info.sprint * charm.walkMul,
      rollMult: info.roll,
      rollCostMult: info.rollCost,
      canRoll: tier !== 'over',
      tier,
      load,
      maxLoad: max,
      aiming: lh?.cat === 'bow',
      stamRegenMul: charm.stamRegen,
      soulsMul: charm.soulsMul,
    }
    // the vigil's lent breath: max HP follows the worn charms
    const newCharmHp = charm.hp
    if (newCharmHp !== this.charmHp) {
      this.player.maxHp = Math.max(30, this.player.maxHp - this.charmHp + newCharmHp)
      this.player.hp = Math.min(this.player.hp, this.player.maxHp)
      this.charmHp = newCharmHp
    }
    this.refreshEquipmentVisuals()
  }

  private refreshEquipmentVisuals() {
    const h = this.player.h
    // right-hand sword style follows the active blade
    const rhId = this.eq[this.rhActive === 1 ? 'rh1' : 'rh2']
    const rh = rhId ? ITEMS[rhId] : null
    setPlayerSword(h, (rh?.style ?? 'iron') as SwordStyle, rh?.scale ?? 1)
    this.applySwordHeat(h.sword, this.upgrades[rhId ?? ''] ?? 0)
    h.sword!.visible = rh?.cat === 'sword'
    // left hand: shield OR bow, whichever is active
    const lhId = this.eq[this.lhActive === 1 ? 'lh1' : 'lh2']
    const lh = lhId ? ITEMS[lhId] : null
    if (lh?.cat === 'bow') {
      if (!this.playerBow) this.playerBow = createBow(lh.id === 'bone_bow' ? 'bone' : 'wood')
      setNocked(this.playerBow, false)
      setBowDraw(this.playerBow, 0)
      setPlayerBow(h, this.playerBow)
      if (h.shield) h.shield.visible = false
    } else {
      setPlayerBow(h, null)
      this.playerBow = null
      if (lh?.cat === 'shield') {
        setPlayerShield(h, lh.id === 'iron_shield' ? 'iron' : 'wood')
        h.shield!.visible = true
      } else if (h.shield) {
        h.shield.visible = false
      }
    }
    // armor overlays + cape — ids ride along to pick texture family + regalia
    const piece = (s: 'head' | 'chest' | 'hands' | 'legs' | 'cape') => {
      const id = this.eq[s]
      const it = id ? ITEMS[id] : null
      return it && it.def !== undefined
        ? { id: it.id, tint: it.tint ?? 0x888888, tint2: it.tint2 }
        : null
    }
    applyPlayerArmor(h, {
      head: piece('head'),
      chest: piece('chest'),
      hands: piece('hands'),
      legs: piece('legs'),
      cape: piece('cape'),
    })
  }

  /** equip a bag item into its canonical slot (RH/LH → first empty, else
      the active hand — DS-style swap: the displaced piece stays owned) */
  equipItem(id: ItemId) {
    const def = ITEMS[id]
    if (!def) return
    // arrows are ammo — they ride in the quiver, never in a hand
    if (def.ammo) {
      this.showToast(`${def.name} مهمات است — با کمان شلیک می‌شود`)
      return
    }
    // materials belong to the forge, not the body — keys wait for their door
    if (def.cat === 'material') {
      this.showToast(def.key ? `${def.name} — درِ خودش را پیدا کن` : `${def.name} — کوره‌بان این را می‌خواهد، نه سنت`)
      return
    }
    // must own it — in the bag, or already worn somewhere (move semantics)
    const worn = ALL_SLOTS.some((s) => this.eq[s] === id)
    if (this.countOf(id) <= 0 && !worn) return
    let slot: EquipSlot
    if (def.slot === 'rh') {
      slot = !this.eq.rh1 ? 'rh1' : !this.eq.rh2 ? 'rh2' : this.rhActive === 1 ? 'rh1' : 'rh2'
    } else if (def.slot === 'lh') {
      slot = !this.eq.lh1 ? 'lh1' : !this.eq.lh2 ? 'lh2' : this.lhActive === 1 ? 'lh1' : 'lh2'
    } else if (def.slot === 'charm') {
      // two quiet slots — the older charm is displaced, never destroyed
      slot = !this.eq.charm1 ? 'charm1' : !this.eq.charm2 ? 'charm2' : 'charm1'
    } else {
      slot = def.slot
    }
    // an item lives in exactly one slot — clear its previous post first
    for (const s of ALL_SLOTS) if (this.eq[s] === id && s !== slot) this.eq[s] = null
    this.eq[slot] = id
    this.sfx.shard()
    this.showToast(`${def.name} تجهیز شد`)
    this.refreshLoadout()
    this.save()
    this.emit(true)
  }

  unequipSlot(slot: EquipSlot) {
    const id = this.eq[slot]
    if (!id) return
    const def = ITEMS[id]
    // never go unarmed — the unkindled always keeps one blade ready
    if (def.slot === 'rh') {
      const other: ItemId | null | undefined = slot === 'rh1' ? this.eq.rh2 : this.eq.rh1
      if (!other || !ITEMS[other] || ITEMS[other].slot !== 'rh') {
        this.showToast('نمی‌توانی بی‌سلاح بمانی')
        return
      }
    }
    this.eq[slot] = null
    this.sfx.levelUp()
    this.showToast(`${def.name} برداشته شد`)
    this.refreshLoadout()
    this.save()
    this.emit(true)
  }

  /** Digit1 — swap which right-hand weapon is live */
  switchRight() {
    this.rhActive = this.rhActive === 1 ? 2 : 1
    const id = this.eq[this.rhActive === 1 ? 'rh1' : 'rh2']
    this.showToast(id ? `${ITEMS[id].name} به دست گرفتید` : 'دست راست خالی')
    this.refreshLoadout()
    this.emit(true)
  }

  /** Digit2 — swap the left hand (shield ⇄ bow) */
  switchLeft() {
    this.lhActive = this.lhActive === 1 ? 2 : 1
    const id = this.eq[this.lhActive === 1 ? 'lh1' : 'lh2']
    this.showToast(id ? `${ITEMS[id].name} آماده شد` : 'دست چپ خالی')
    this.refreshLoadout()
    this.emit(true)
  }

  private showToast(msg: string) {
    this.toastMsg = msg
    this.toastT = 2.4
  }

  /** arrows the equipped bow would use — prefers the fire quiver when present */
  private arrowState(): { id: ItemId; n: number } | null {
    const fire = this.countOf('arrow_fire')
    const wood = this.countOf('arrow_wood')
    if (fire > 0) return { id: 'arrow_fire', n: fire }
    if (wood > 0) return { id: 'arrow_wood', n: wood }
    return null
  }

  /** the archer moment — called by the player's aim state on release.
      draw (0..1) gates the shot AND scales its speed & damage, so a
      rushed snap barely stings while a full anchor bites. */
  firePlayerArrow(p: Player, draw: number) {
    const lhId = this.eq[this.lhActive === 1 ? 'lh1' : 'lh2']
    const bow = lhId ? ITEMS[lhId] : null
    if (!bow || bow.cat !== 'bow' || bow.ammo) return
    const ammo = this.arrowState()
    if (!ammo) {
      this.showToast('تیر تمام شد!')
      return
    }
    this.removeItem(ammo.id, 1)
    const arrowDef = ITEMS[ammo.id]
    const from = p.pos.clone().add(new THREE.Vector3(Math.sin(p.yaw) * 0.4, 1.45, Math.cos(p.yaw) * 0.4))
    // aim along the camera's true ray (yaw + pitch) — the crosshair IS the target
    const cp = this.camPitch
    const aim = new THREE.Vector3(
      -Math.sin(this.camYaw) * Math.cos(cp),
      -Math.sin(cp),
      -Math.cos(this.camYaw) * Math.cos(cp)
    )
    const target = p.pos.clone().add(new THREE.Vector3(0, 1.45, 0)).add(aim.multiplyScalar(14))
    const base = (bow.bowDmg ?? 20) + (arrowDef.bowDmg ?? 0)
    const dmg = Math.max(1, Math.round(base * (0.55 + 0.45 * draw)))
    this.arrows.push(new Arrow(this, from, target, dmg, true, ammo.id === 'arrow_fire', draw))
    this.sfx.arrowShoot()
    // the bow string snaps on the model too
    if (this.playerBow) {
      setBowDraw(this.playerBow, 0)
      setNocked(this.playerBow, false)
    }
    this.emit(true)
  }

  /** a missed arrow sticks in the dirt — walk over and reclaim it (a
      chance: some shafts snap, Dark-Souls style). Spawns a quiet loot
      drop without the tall beacon so it reads as litter, not treasure. */
  recoverArrow(a: Arrow) {
    if (!a.reclaimable) return
    const chance = a.ammoId === 'arrow_fire' ? 0.5 : 0.65
    if (Math.random() > chance) return
    this.loots.push(new LootDrop(this, a.ammoId, 1, a.groundPos, true))
  }

  /** DS-style item-attained banner, fired on pickup */
  private collectLoot(l: LootDrop) {
    const def = ITEMS[l.id]
    if (!def) return
    this.addItem(l.id, l.n)
    l.dispose(this.engine.scene)
    this.loots = this.loots.filter((x) => x !== l)
    this.sfx.shard()
    this.showToast(`به دست آمد: ${def.name}${l.n > 1 ? ` ×${l.n}` : ''}`)
    this.spawnBurst(l.group.position.clone(), 0xffe9a0, 14, 2.6, 0.5)
    this.save()
    this.emit(true)
  }

  /** debug/QA helper — drop a specific item in front of the player */
  debugLoot(id: ItemId, n = 1) {
    if (!ITEMS[id]) return
    const pos = this.player.pos.clone().add(new THREE.Vector3(Math.sin(this.player.yaw) * 2, 0, Math.cos(this.player.yaw) * 2))
    this.loots.push(new LootDrop(this, id, n, pos))
    this.emit(true)
  }

  /** remove one unit from the bag, taking the equipped last copy off first —
      and never leave the unkindled unarmed (the DS rule for the right hand).
      Shared by drop & sell. Returns false (with a toast) when refused. */
  private takeFromBag(id: ItemId): boolean {
    const def = ITEMS[id]
    if (!def) return false
    const wornSlot = ALL_SLOTS.find((s) => this.eq[s] === id)
    const bagCount = this.countOf(id)
    if (bagCount <= 0) {
      this.showToast('در کوله‌ات نیست')
      return false
    }
    // dropping/selling the very copy you are wearing → take it off first
    if (wornSlot && bagCount <= 1) {
      if (def.slot === 'rh') {
        const other = ALL_SLOTS.some(
          (s) => s !== wornSlot && this.eq[s] && ITEMS[this.eq[s]!].slot === 'rh'
        )
        if (!other) {
          this.showToast('نمی‌توانی بی‌سلاح بمانی')
          return false
        }
      }
      this.eq[wornSlot] = null
      // if the active hand just emptied, it grabs the sibling weapon —
      // the unkindled is never caught holding air
      const side: 'rh' | 'lh' | null = wornSlot.startsWith('rh') ? 'rh' : wornSlot.startsWith('lh') ? 'lh' : null
      if (side) {
        const sib = (wornSlot === `${side}1` ? `${side}2` : `${side}1`) as EquipSlot
        const active = side === 'rh' ? this.rhActive : this.lhActive
        if (wornSlot === (active === 1 ? `${side}1` : `${side}2`) && this.eq[sib]) {
          if (side === 'rh') this.rhActive = this.rhActive === 1 ? 2 : 1
          else this.lhActive = this.lhActive === 1 ? 2 : 1
        }
      }
      this.refreshLoadout()
    }
    return this.removeItem(id, 1)
  }

  /** drop one unit from the bag onto the ground ahead. Player-dropped
      goods crumble to dust after 20 seconds if nobody claims them —
      the world does not keep your litter. */
  dropItem(id: ItemId) {
    const def = ITEMS[id]
    if (!def || this.phase !== 'inventory') return
    if (!this.takeFromBag(id)) return
    const pos = this.player.pos
      .clone()
      .add(new THREE.Vector3(Math.sin(this.player.yaw) * 1.4, 0, Math.cos(this.player.yaw) * 1.4))
    this.loots.push(new LootDrop(this, id, 1, pos, false, 20))
    this.sfx.roll()
    this.showToast(`${def.name} افتاد — اگر برنداری، تا ۲۰ ثانیه دیگر در خاک فرو می‌رود`)
    this.save()
    this.emit(true)
  }

  /** sell one unit to the grey merchant — only standing beside his stall.
      Equipped last copies come off first; the right hand never goes bare. */
  sellItem(id: ItemId) {
    const def = ITEMS[id]
    if (!def) return
    if (this.phase !== 'inventory' && this.phase !== 'shop') return
    if (Math.hypot(this.player.pos.x - MERCHANT.x, this.player.pos.z - MERCHANT.z) >= 3.4) {
      this.showToast('برای فروش باید کنار بازرگان بایستی')
      return
    }
    if (!this.takeFromBag(id)) return
    const v = sellValueOf(id)
    this.player.souls += v
    this.spawnText(`+${v}`, '#8fd97a', this.player.pos.clone().add(new THREE.Vector3(0, 2.2, 0)))
    this.sfx.souls()
    this.showToast(`${def.name} فروخته شد — +${v} سول`)
    this.save()
    this.emit(true)
  }

  /** build the React-side snapshot of slots + bag */
  private invHud(): InvHud {
    const view = (id: ItemId | null | undefined, slot?: EquipSlot): InvItemView | null => {
      if (!id || !ITEMS[id]) return null
      const it = ITEMS[id]
      return {
        id: it.id, name: it.name, icon: it.icon, cat: it.cat,
        weight: it.weight, n: slot ? 1 : Math.max(1, this.countOf(id)),
        equipped: slot ? this.eq[slot] === id : ALL_SLOTS.some((s) => this.eq[s] === id),
        tier: it.tier, desc: it.desc, ammo: !!it.ammo, key: !!it.key, sell: sellValueOf(it.id),
        dmg: it.dmg, spd: it.spd, block: it.block, bowDmg: it.bowDmg,
        def: it.def, fire: it.fire, blast: it.blast,
      }
    }
    const slots = ALL_SLOTS.map((s) => ({ slot: s, label: SLOT_LABEL[s], item: view(this.eq[s] ?? null, s) }))
    const equippedIds = new Set(ALL_SLOTS.map((s) => this.eq[s]).filter(Boolean) as ItemId[])
    const bag = this.inv
      .filter((e) => ITEMS[e.id])
      .map((e) => ({ ...view(e.id)!, n: e.n, equipped: equippedIds.has(e.id) }))
    const load = equipLoad(this.eq)
    const max = maxLoadFor(this.player.level)
    const tier = rollTier(load, max)
    const info = TIER_INFO[tier]
    const armor = armorTotals(this.eq)
    const charm = charmTotals(this.eq)
    const charmLines: string[] = []
    if (charm.dmgMul !== 1) charmLines.push(`آسیب +${Math.round((charm.dmgMul - 1) * 100)}٪`)
    if (charm.soulsMul !== 1) charmLines.push(`روح +${Math.round((charm.soulsMul - 1) * 100)}٪`)
    if (charm.walkMul !== 1) charmLines.push(`سرعت +${Math.round((charm.walkMul - 1) * 100)}٪`)
    if (charm.stamRegen !== 1) charmLines.push(`ریجن استقامت +${Math.round((charm.stamRegen - 1) * 100)}٪`)
    if (charm.hp > 0) charmLines.push(`جان بیشینه +${charm.hp}`)
    if (charm.soak > 0) charmLines.push(`کاهش آسیب ورودی +${Math.round(charm.soak * 100)}٪`)
    return {
      slots, rhActive: this.rhActive, lhActive: this.lhActive, bag,
      load: Math.round(load * 10) / 10, maxLoad: max,
      tier, tierColor: info.color, tierLabel: info.label,
      def: Math.round(armor.def * 100), fire: Math.round(armor.fire * 100), blast: Math.round(armor.blast * 100),
      souls: Math.floor(this.player.souls),
      nearMerchant: Math.hypot(this.player.pos.x - MERCHANT.x, this.player.pos.z - MERCHANT.z) < 3.4,
      charmLines,
    }
  }

  /** the F key — world interactions */
  interact() {
    if (this.phase !== 'playing') return
    // fallen foes' gear — the nearest loot drop first
    let bestLoot: LootDrop | null = null
    let bestD = 1.9
    for (const l of this.loots) {
      const d = Math.hypot(this.player.pos.x - l.group.position.x, this.player.pos.z - l.group.position.z)
      if (d < bestD) {
        bestD = d
        bestLoot = l
      }
    }
    if (bestLoot) {
      this.collectLoot(bestLoot)
      return
    }
    // the Vale's secrets — chests, shimmering walls, waiting keys
    const secret = this.nearestSecret()
    if (secret) {
      secret.act()
      return
    }
    // a memorial stone — read the Vale's memory
    for (const s of this.loreStones) {
      if (Math.hypot(this.player.pos.x - s.group.position.x, this.player.pos.z - s.group.position.z) < 2.1) {
        this.openLore(s.id)
        return
      }
    }
    // the grey merchant
    if (Math.hypot(this.player.pos.x - MERCHANT.x, this.player.pos.z - MERCHANT.z) < 2.7) {
      this.openShop()
      return
    }
    // the forge-keeper
    if (Math.hypot(this.player.pos.x - SMITH.x, this.player.pos.z - SMITH.z) < 2.7) {
      this.openSmith()
      return
    }
    // bloodstain
    if (this.bloodstain && this.bloodstain.mesh.position.distanceTo(this.player.pos) < 1.7) {
      this.player.souls += this.bloodstain.amount
      this.spawnBurst(this.bloodstain.mesh.position, 0x59ff6a, 22, 3.5)
      this.spawnText(`+${this.bloodstain.amount}`, '#59ff6a', this.player.pos.clone().add(new THREE.Vector3(0, 2.2, 0)))
      this.engine.scene.remove(this.bloodstain.mesh)
      this.bloodstain = null
      this.sfx.souls()
      this.emit(true)
      return
    }
    // estus shard dropped by the first boss
    if (this.estusShard) {
      const sp = this.estusShard.mesh.position
      if (Math.hypot(this.player.pos.x - sp.x, this.player.pos.z - sp.z) < 1.9) {
        this.collectEstusShard()
        return
      }
    }
    // the pyromancy flame loot
    if (this.pyroItem) {
      const sp = this.pyroItem.mesh.position
      if (Math.hypot(this.player.pos.x - sp.x, this.player.pos.z - sp.z) < 1.9) {
        this.collectPyroItem()
        return
      }
    }
    // the Great Ember dropped by the Flame King
    if (this.emberItem) {
      const sp = this.emberItem.mesh.position
      if (Math.hypot(this.player.pos.x - sp.x, this.player.pos.z - sp.z) < 1.9) {
        this.collectEmber()
        return
      }
    }
    // bonfire
    const bPos = new THREE.Vector3(BONFIRE.x, this.world.surfaceAt(BONFIRE.x, BONFIRE.z), BONFIRE.z)
    if (bPos.distanceTo(this.player.pos) < 2.6) {
      this.rest()
      return
    }
    // fog gate 1 — the zombie knight (the parish forecourt gate)
    if (!this.bossActive && !this.bossFell && this.player.pos.z < GATE1.z + 3.2 && this.player.pos.z > GATE1.z - 0.4 &&
      this.player.pos.x > GATE1.lane0 && this.player.pos.x < GATE1.lane1
    ) {
      this.fogPassT = 0.75
      this.sfx.bossRoar()
      return
    }
    // fog gate 2 — the Flame King (the fortress gatehouse)
    if (!this.boss2Active && !this.boss2Fell &&
      Math.abs(this.player.pos.x - GATE2.x) < 2.0 &&
      this.player.pos.z < GATE2.z + 3.2 && this.player.pos.z > GATE2.z - 0.4
    ) {
      this.fogPass2T = 0.75
      this.sfx.bossRoar()
    }
  }

  toggleLock() {
    if (this.player.lockedTarget) {
      this.player.lockedTarget = null
      return
    }
    const camF = new THREE.Vector3(-Math.sin(this.camYaw), 0, -Math.cos(this.camYaw))
    let best: Enemy | null = null
    let bestScore = Infinity
    for (const e of this.allEnemies) {
      if (!e.alive || (e.isBoss && !this.bossActive)) continue
      const to = e.pos.clone().sub(this.player.pos)
      const d = to.length()
      if (d > 15) continue
      to.normalize()
      const dot = to.dot(camF)
      if (dot < 0.1) continue
      const score = d * (2 - dot)
      if (score < bestScore) {
        bestScore = score
        best = e
      }
    }
    if (best) {
      this.player.lockedTarget = { pos: best.pos, alive: true, isBoss: best.isBoss }
    }
  }

  /* touch API */
  setTouchMove(x: number, y: number) {
    this.engine.input.touchMove.x = x
    this.engine.input.touchMove.y = y
  }
  touchPress(name: string) {
    this.sfx.resume()
    this.engine.input.press(name)
  }
  touchHold(name: string, down: boolean) {
    this.engine.input.setHeld(name, down)
  }
  touchLook(dx: number, dy: number) {
    this.engine.input.touchLookDX += dx
    this.engine.input.touchLookDY += dy
  }

  dispose() {
    this.engine.dispose()
    if (this.reticle.parentElement) this.reticle.parentElement.removeChild(this.reticle)
    if (this.vignette.parentElement) this.vignette.parentElement.removeChild(this.vignette)
    if (this.mapCanvas?.parentElement) this.mapCanvas.parentElement.removeChild(this.mapCanvas)
  }

  /* ================= INTERNAL ================= */

  private save() {
    try {
      const data: SaveData = {
        souls: this.player.souls,
        level: this.player.level,
        vit: this.player.vit,
        end: this.player.end,
        str: this.player.str,
        estusUp: this.estusUp,
        pyro: this.pyroUnlocked,
        ember: this.emberTaken,
        shopEstus: this.shopLv.estus,
        shopWhet: this.shopLv.whet,
        shopCoal: this.shopLv.coal,
        inv: this.inv,
        eq: this.eq,
        rhA: this.rhActive,
        lhA: this.lhActive,
        lore: this.loreStones.filter((s) => s.seen).map((s) => s.id),
        cine: this.cineSeen,
        upgrades: this.upgrades,
        ngPlus: this.ng,
      }
      localStorage.setItem(SAVE_KEY, JSON.stringify(data))
    } catch { /* ignore */ }
  }

  private loadSave() {
    try {
      const raw = localStorage.getItem(SAVE_KEY)
      if (!raw) return
      const d = JSON.parse(raw) as SaveData
      // one-time cinematics already watched
      this.cineSeen = d.cine ?? {}
      // re-apply levels from scratch for consistency
      const target = { vit: d.vit ?? 0, end: d.end ?? 0, str: d.str ?? 0 }
      this.player.vit = 0
      this.player.end = 0
      this.player.str = 0
      this.player.maxHp = 95
      this.player.maxStamina = 95
      for (let i = 0; i < target.vit; i++) this.player.applyLevel('vit')
      for (let i = 0; i < target.end; i++) this.player.applyLevel('end')
      for (let i = 0; i < target.str; i++) this.player.applyLevel('str')
      this.player.level = 1 + target.vit + target.end + target.str
      this.player.souls = d.souls ?? 0
      // permanent estus-shard upgrade
      this.estusUp = !!d.estusUp
      this.player.maxEstus = this.estusUp ? 4 : 3
      // pyromancy flags
      this.pyroUnlocked = !!d.pyro
      this.emberTaken = !!d.ember
      this.player.pyroUnlocked = this.pyroUnlocked
      this.player.maxPyro = 4 + (this.emberTaken ? 2 : 0)
      this.player.pyro = this.player.maxPyro
      if (this.pyroUnlocked) this.removePyroItem()
      // shop upgrades
      this.shopLv.estus = Math.max(0, Math.min(3, d.shopEstus ?? 0))
      this.shopLv.whet = Math.max(0, Math.min(5, d.shopWhet ?? 0))
      this.shopLv.coal = Math.max(0, Math.min(4, d.shopCoal ?? 0))
      if (this.shopLv.estus > 0) this.player.maxEstus += this.shopLv.estus
      this.player.gearDmg = this.shopLv.whet * 0.08
      if (this.shopLv.coal > 0 && this.pyroUnlocked) {
        this.player.maxPyro = Math.min(8, this.player.maxPyro + this.shopLv.coal)
        this.player.pyro = this.player.maxPyro
      }
      // ---- inventory & equipment ----
      const savedInv = Array.isArray(d.inv)
        ? d.inv.filter((e) => e && ITEMS[e.id] && e.n > 0)
        : null
      this.inv = savedInv ?? [{ id: 'worn_sword', n: 1 }, { id: 'wooden_shield', n: 1 }]
      this.eq = { ...defaultEquip(), ...(d.eq ?? {}) }
      for (const s of ALL_SLOTS) {
        const id = this.eq[s]
        if (id && !ITEMS[id]) this.eq[s] = null
      }
      // an item occupies at most one slot — drop stale duplicates
      const seen = new Set<ItemId>()
      for (const s of ALL_SLOTS) {
        const id = this.eq[s]
        if (id) {
          if (seen.has(id)) this.eq[s] = null
          else seen.add(id)
        }
      }
      // ammo never lives in a slot (older saves could hold an arrow there)
      for (const s of ALL_SLOTS) {
        const id = this.eq[s]
        if (id && ITEMS[id]?.ammo) this.eq[s] = null
      }
      // every equipped piece must exist in the bag too (DS: nothing is lost)
      for (const s of ALL_SLOTS) {
        const id = this.eq[s]
        if (id && this.countOf(id) <= 0) this.addItem(id, 1)
      }
      this.rhActive = d.rhA === 2 ? 2 : 1
      this.lhActive = d.lhA === 2 ? 2 : 1
      // ---- the smith's ledger — forge-grades survive the cycle ----
      this.upgrades = {}
      if (d.upgrades && typeof d.upgrades === 'object') {
        for (const [k, v] of Object.entries(d.upgrades)) {
          if (ITEMS[k]?.cat === 'sword') this.upgrades[k] = Math.max(0, Math.min(MAX_UPGRADE, Math.floor(v as number)))
        }
      }
      // ---- memorial stones already read ----
      const readLore = Array.isArray(d.lore) ? d.lore : []
      for (const st of this.loreStones) {
        if (readLore.includes(st.id)) {
          st.seen = true
          st.light.intensity = 0.5
        }
      }
      this.refreshLoadout()
    } catch { /* ignore */ }
  }

  /** the player's blade connects — arc, damage, knockback, sfx
      (called from Player on the strike beat; PlayerStrikeDef lives in player.ts) */
  playerStrike(def: PlayerStrikeDef) {
    const fwd = new THREE.Vector3(Math.sin(this.player.yaw), 0, Math.cos(this.player.yaw))
    let hits = 0
    for (const e of this.allEnemies) {
      if (!e.alive) continue
      // melee geometry is horizontal — blocky terrain height steps must not
      // inflate the distance or the arc vector
      const to = e.pos.clone().sub(this.player.pos)
      to.y = 0
      const d = to.length()
      if (d > def.range + (e.isBoss ? 1.2 : 0.3)) continue
      // point-blank auto-hit: when the target is this close the direction
      // vector degenerates (enemy hugging the player), so the arc check
      // would randomly fail and make hugging enemies unhittable
      if (d > 0.9 + (e.isBoss ? 1.2 : 0)) {
        to.normalize()
        if (to.dot(fwd) < Math.cos(def.arc)) continue
      }
      const dmg = Math.max(1, Math.round(def.dmg * (0.92 + Math.random() * 0.16)))
      e.takeDamage(dmg, this, this.player.pos.x, this.player.pos.z)
      hits++
    }
    if (hits > 0) {
      this.hitstop = def.heavy ? 0.09 : 0.06
      if (def.heavy) {
        this.sfx.heavy()
        this.shake = Math.max(this.shake, 0.18)
      } else {
        this.sfx.hit()
      }
      // spark burst at first victim
      const victim = this.allEnemies.find((e) => e.alive && e.pos.distanceTo(this.player.pos) < def.range + 1.4)
      if (victim) this.spawnBurst(victim.pos.clone().add(new THREE.Vector3(0, 1.3, 0)), 0xffe08a, 8, 2.2, 0.4)
    }
  }

  onPlayerHit(dmg: number) {
    this.hurtFlash = Math.min(1, 0.4 + dmg / 90)
    this.shake = Math.max(this.shake, 0.32)
    this.sfx.hurt()
    this.emit(true)
  }

  onPlayerBlock(dmg: number) {
    this.shake = Math.max(this.shake, 0.12)
    this.sfx.block()
    const fwd = new THREE.Vector3(Math.sin(this.player.yaw), 0, Math.cos(this.player.yaw))
    const at = this.player.pos
      .clone()
      .add(fwd.multiplyScalar(0.75))
      .add(new THREE.Vector3(0, 1.15, 0))
    this.spawnBurst(at, 0xffe9a0, 10, 2.6, 0.35, 0.1)
    this.emit(true)
  }

  onGuardBreak(chip: number) {
    this.sfx.guardBreak()
    this.shake = Math.max(this.shake, 0.3)
    this.hurtFlash = Math.min(1, 0.35 + chip / 90)
    this.spawnText('شکستن دفاع!', '#ff7a5c', this.player.pos.clone().add(new THREE.Vector3(0, 2.2, 0)))
    this.emit(true)
  }

  onCreeperBoom(pos: THREE.Vector3) {
    this.shake = Math.max(this.shake, 0.5)
    this.sfx.boom()
    const at = pos.clone().add(new THREE.Vector3(0, 1, 0))
    this.spawnBurst(at, 0xffb347, 30, 6, 0.5, 0.22)
    this.spawnBurst(at, 0x9fd89f, 20, 3.6, 0.85, 0.3)
    const light = new THREE.PointLight(0xffa040, 7, 13, 1.8)
    light.position.copy(pos).add(new THREE.Vector3(0, 1.2, 0))
    this.engine.scene.add(light)
    this.boomLights.push({ light, t: 0 })
  }

  /** skeleton archers call this at the moment of release */
  spawnArrow(from: THREE.Vector3, target: THREE.Vector3, dmg: number) {
    this.arrows.push(new Arrow(this, from, target, dmg))
    this.sfx.arrowShoot()
  }

  onArrowBlocked() {
    this.sfx.arrowBlock()
    this.shake = Math.max(this.shake, 0.08)
    const fwd = new THREE.Vector3(Math.sin(this.player.yaw), 0, Math.cos(this.player.yaw))
    const at = this.player.pos
      .clone()
      .add(fwd.multiplyScalar(0.75))
      .add(new THREE.Vector3(0, 1.15, 0))
    this.spawnBurst(at, 0xffe9a0, 6, 2.2, 0.3, 0.09)
    this.emit(true)
  }

  onPlayerHeal(heal: number) {
    this.sfx.heal()
    this.spawnBurst(this.player.pos.clone().add(new THREE.Vector3(0, 1.4, 0)), 0xffc44d, 14, 2)
    this.spawnText(`+${heal}`, '#ffc44d', this.player.pos.clone().add(new THREE.Vector3(0, 2.2, 0)))
    this.emit(true)
  }

  onEnemyKilled(e: Enemy) {
    // soul orb flies to player — worn charms sweeten the tithe
    const orb = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.28, 0.28),
      new THREE.MeshBasicMaterial({ color: 0x59ff6a })
    )
    orb.position.copy(e.pos).add(new THREE.Vector3(0, 1.2, 0))
    this.engine.scene.add(orb)
    const soulGain = Math.round(e.soulsValue() * this.player.loadout.soulsMul)
    this.orbs.push({ mesh: orb, t: 0, amount: soulGain, from: orb.position.clone() })
    // their gear may hit the ground — a little inheritance from the dead
    // (lords skip the common table — their signature rig is guaranteed)
    const drops = e.isBoss ? [] : rollLoot(e.lootKind)
    // champions always drop their guarded relic + a vein of ember-iron
    if (e.champion && e.champLoot) {
      drops.push({ id: e.champLoot as ItemId, n: 1 })
      drops.push({ id: 'ember_iron', n: 1 })
      this.spawnText('غنیمتِ بزرگ!', '#ffd54a', e.pos.clone().add(new THREE.Vector3(0, 3.2, 0)))
    }
    if (drops.length > 0) this.spawnLoot(drops, e.pos)
    if (e === this.boss) this.onBossKilled()
    else if (e === this.boss2) this.onBoss2Killed()
    else if (e === this.boss3) this.onBoss3Killed()
    this.emit(true)
  }

  private onBossKilled() {
    this.bossFell = true
    this.bossActive = false
    this.bossActiveBarrier = false
    this.world.setFogGatesVisible(false, !this.boss2Fell)
    this.banner = 'bossfell'
    this.bannerT = 0
    if (this.player.lockedTarget) this.player.lockedTarget = null
    this.sfx.victory()
    // the lord's inheritance: his great blade + a piece of his armor
    this.spawnLoot(bossLoot(1), this.boss.pos)
    this.spawnEstusShard()
    // once the ash settles, the camera finds the fortress (once per save)
    if (!this.cineSeen.beat1) {
      this.cineSeen.beat1 = true
      this.beat1Pending = 4.2
    }
    this.save()
  }

  /** the Flame King falls — the Great Ember is his legacy, and his death
      cracks the earth north of the fortress: the pit stair opens */
  private onBoss2Killed() {
    this.boss2Fell = true
    this.boss2Active = false
    this.boss2Barrier = false
    this.world.setFogGatesVisible(!this.bossFell, false)
    this.banner = 'bossfell2'
    this.bannerT = 0
    if (this.player.lockedTarget) this.player.lockedTarget = null
    this.sfx.victory()
    // the Flame King's own obsidian rig: blade + crown/plate/cape
    this.spawnLoot(bossLoot(2), this.boss2.pos)
    this.spawnEmber()
    // the Vale cracks open — the way to the First Coal lies bare
    this.world.setPitOpen(true)
    this.spawnText('زمین می‌لرزد... ریزشِ سنگِ شمال فرو می‌ریزد!', '#ff8a3a', this.player.pos.clone().add(new THREE.Vector3(0, 2.6, 0)))
    this.shake = Math.max(this.shake, 0.7)
    this.save()
  }

  /** the First Coal falls — the Vale holds its breath, then the choice */
  private onBoss3Killed() {
    this.boss3Fell = true
    this.boss3Active = false
    this.boss3Barrier = false
    this.banner = 'coalfell'
    this.bannerT = 0
    if (this.player.lockedTarget) this.player.lockedTarget = null
    this.sfx.victory()
    this.spawnLoot(bossLoot(3), this.boss3.pos)
    // when the ash settles, the bed of the First Coal calls — choose
    this.endingPending = 4.0
    this.save()
  }

  /* ================= THE ENDING — kindle, or let it fade ================= */

  /** after the Coal's banner fades, the choice appears */
  private maybeOpenEnding(dt: number) {
    if (this.endingPending <= 0) return
    this.endingPending -= dt
    if (this.endingPending <= 0) {
      this.endingPending = 0
      this.phase = 'ending'
      this.engine.input.releaseLock()
      this.wasLocked = false
      this.sfx.reveal()
      this.emit(true)
    }
  }

  /** the ember answers: two endings, one world */
  chooseEnding(kind: 'lit' | 'fade') {
    if (this.phase !== 'ending') return
    this.phase = 'playing'
    const bed = new THREE.Vector3(34.5, this.world.surfaceAt(34.5, -44.2) + 0.6, -44.2)
    if (kind === 'lit') {
      this.startCinematic(
        [
          {
            dur: 2.6,
            pos: bed.clone().add(new THREE.Vector3(5.2, 3.4, 5.6)),
            look: bed.clone(),
            onStart: () => {
              this.sfx.reveal()
              this.setCaption('اخگر را در دلِ ذغالِ نخستین فرو بردی...')
              this.spawnBurst(bed, 0xffc23d, 40, 5, 1.2, 0.2)
              this.shake = Math.max(this.shake, 0.6)
            },
          },
          {
            dur: 3.0,
            pos: bed.clone().add(new THREE.Vector3(-3.6, 6.4, 3.0)),
            look: bed.clone().add(new THREE.Vector3(0, 1.6, 0)),
            onStart: () => {
              this.setCaption('آتشِ نخستین باز گرفت. گدازه بالا آمد، و درّه — بعد از هزار سال — نفس کشید.')
              this.spawnBurst(bed, 0xfff0c0, 60, 6.5, 1.4, 0.24)
              this.sfx.inferno()
              this.shake = Math.max(this.shake, 0.9)
            },
          },
          {
            dur: 2.4,
            pos: bed.clone().add(new THREE.Vector3(0.4, 11.5, 8.5)),
            look: new THREE.Vector3(0, 10, 20),
            onStart: () => this.setCaption('و در نورِ تازه، خانه‌های دهکده یک بار دیگر شکل گرفتند.'),
          },
        ],
        { title: 'پایانِ افروختن', sub: 'آتش باز برگشت — و تو، نخستین اخگرِ دوباره', onEnd: () => this.exitToMenu() }
      )
    } else {
      this.startCinematic(
        [
          {
            dur: 2.6,
            pos: bed.clone().add(new THREE.Vector3(5.2, 3.4, 5.6)),
            look: bed.clone(),
            onStart: () => {
              this.sfx.reveal()
              this.setCaption('اخگر را زمین گذاشتی و پشت کردی...')
            },
          },
          {
            dur: 3.0,
            pos: bed.clone().add(new THREE.Vector3(-4.2, 5.6, 3.4)),
            look: bed.clone().add(new THREE.Vector3(0, 1.0, 0)),
            onStart: () => {
              this.setCaption('شعله کوچک شد، کوچک‌تر... تا فقط گدازه‌ای آبی در تاریکی بماند.')
              this.spawnBurst(bed, 0x6a8aff, 30, 3, 1.2, 0.18)
            },
          },
          {
            dur: 2.4,
            pos: bed.clone().add(new THREE.Vector3(0.4, 11.5, 8.5)),
            look: new THREE.Vector3(0, 10, 20),
            onStart: () => this.setCaption('شبِ سازندگان فرا رسید — اما هر شب، سهمِ خودش از سپیده را دارد.'),
          },
        ],
        { title: 'پایانِ خاموشی', sub: 'عصرِ تاریک — و اخگری که راهش را جدا کرد', onEnd: () => this.exitToMenu() }
      )
    }
    // the ending itself is written into the save — the choice stands forever
    try {
      const raw = localStorage.getItem(SAVE_KEY)
      const d: SaveData = raw ? JSON.parse(raw) : {}
      d.ending = kind
      localStorage.setItem(SAVE_KEY, JSON.stringify(d))
    } catch { /* ignore */ }
    this.emit(true)
  }

  /** wake the ash again — the world restarts harder, the character remains */
  startNgPlus() {
    try {
      const raw = localStorage.getItem(SAVE_KEY)
      const d: SaveData = raw ? JSON.parse(raw) : {}
      d.ngPlus = (d.ngPlus ?? 0) + 1
      localStorage.setItem(SAVE_KEY, JSON.stringify(d))
    } catch { /* ignore */ }
    window.location.reload()
  }

  /** the boss drops a glowing estus shard — permanent +1 flask capacity */
  private spawnEstusShard() {
    if (this.estusUp || this.estusShard) return
    const g = new THREE.Group()
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 0.42, 0.3),
      new THREE.MeshLambertMaterial({ color: 0xd98a1f, transparent: true, opacity: 0.92 })
    )
    const glow = new THREE.Mesh(
      new THREE.BoxGeometry(0.46, 0.58, 0.46),
      new THREE.MeshBasicMaterial({ color: 0xffb63d, transparent: true, opacity: 0.28 })
    )
    const cork = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.12, 0.14),
      new THREE.MeshLambertMaterial({ color: 0x6e4f30 })
    )
    cork.position.y = 0.27
    g.add(glow, body, cork)
    const bx = this.boss.pos.x
    const bz = this.boss.pos.z
    const y = this.world.surfaceAt(bx, bz) + 0.75
    g.position.set(bx, y, bz)
    this.engine.scene.add(g)
    const light = new THREE.PointLight(0xffb040, 2.4, 6.5, 1.8)
    light.position.set(bx, y + 0.5, bz)
    this.engine.scene.add(light)
    this.estusShard = { mesh: g, light }
  }

  private collectEstusShard() {
    if (!this.estusShard) return
    this.engine.scene.remove(this.estusShard.mesh)
    this.engine.scene.remove(this.estusShard.light)
    this.estusShard = null
    this.estusUp = true
    this.player.maxEstus++
    this.player.estus = this.player.maxEstus
    this.sfx.shard()
    this.spawnBurst(this.player.pos.clone().add(new THREE.Vector3(0, 1.2, 0)), 0xffb63d, 20, 2.6)
    this.spawnText('تکه‌ی استوس! ظرفیت شربت +۱', '#ffc44d', this.player.pos.clone().add(new THREE.Vector3(0, 2.6, 0)))
    this.save()
    this.emit(true)
  }

  onBossPhase2() {
    this.sfx.phaseRoar()
    this.shake = Math.max(this.shake, 0.5)
    const c = this.boss.pos.clone().add(new THREE.Vector3(0, 2.4, 0))
    this.spawnBurst(c, 0xff5533, 34, 4.5)
    this.spawnBurst(this.boss.pos.clone().add(new THREE.Vector3(0, 0.4, 0)), 0xff8844, 20, 3, 0.7, 0.2)
  }

  onBossIntro(pos: THREE.Vector3) {
    this.sfx.bossRoar()
    this.shake = Math.max(this.shake, 0.42)
    this.spawnBurst(pos.clone().add(new THREE.Vector3(0, 2.6, 0)), 0xb04a2a, 24, 3.4)
  }

  onBossSlam(pos: THREE.Vector3) {
    this.shake = Math.max(this.shake, 0.5)
    this.sfx.heavy()
    this.spawnBurst(pos.clone().add(new THREE.Vector3(0, 0.5, 0)), 0xb0a080, 24, 4.5, 0.6, 0.22)
    this.spawnBurst(pos.clone().add(new THREE.Vector3(0, 0.25, 0)), 0x8a7a5c, 14, 2.4, 0.8, 0.28)
    this.waves.push(new Shockwave(this, pos.clone(), 4.8, 14))
  }

  onBossStomp(pos: THREE.Vector3) {
    this.shake = Math.max(this.shake, 0.45)
    this.sfx.stomp()
    this.spawnBurst(pos.clone().add(new THREE.Vector3(0, 0.3, 0)), 0xb0a080, 26, 5, 0.55, 0.24)
    this.waves.push(new Shockwave(this, pos.clone(), 4.0, 16, 0xc9b48a))
  }

  onBossStagger(pos: THREE.Vector3) {
    this.sfx.stagger()
    this.shake = Math.max(this.shake, 0.32)
    this.spawnBurst(pos.clone().add(new THREE.Vector3(0, 2.2, 0)), 0xffe08a, 18, 3, 0.5)
    this.spawnText('تعادلش شکست!', '#ffd54a', pos.clone().add(new THREE.Vector3(0, 4.4, 0)))
    this.emit(true)
  }

  /** world-events (boss stagger beats, knee slams) can jolt the camera too */
  bumpShake(v: number) {
    this.shake = Math.max(this.shake, v)
  }

  /* ================= BOSS 2 / PYROMANCY EVENTS ================= */

  onBoss2Intro(pos: THREE.Vector3) {
    this.sfx.bossRoar()
    this.shake = Math.max(this.shake, 0.42)
    this.spawnBurst(pos.clone().add(new THREE.Vector3(0, 3, 0)), 0xff7a2a, 26, 3.6)
  }

  /* ================= CINEMATIC DIRECTOR ================= */

  /** begin a cinematic — the player freezes, the director owns the camera */
  private startCinematic(
    keys: CineKey[],
    opts: {
      title?: string
      sub?: string
      actor?: { cineRoarStep(dt: number): void } | null
      onEnd?: () => void
    } = {}
  ) {
    this.cine = {
      keys,
      i: 0,
      t: 0,
      fromPos: this.engine.camera.position.clone(),
      fromLook: this.camTarget.clone(),
      title: opts.title ?? null,
      sub: opts.sub ?? null,
      caption: null,
      actor: opts.actor ?? null,
      onEnd: opts.onEnd ?? (() => {}),
    }
    this.player.lockedTarget = null
    this.emit(true)
  }

  /** any click/tap/space skips the shot — end events still run */
  skipCinematic() {
    this.endCinematic()
  }

  private endCinematic() {
    const c = this.cine
    if (!c) return
    // capture the camera's current pose for a smooth hand-back
    this.cineEndPos.copy(this.engine.camera.position)
    const dir = new THREE.Vector3()
    this.engine.camera.getWorldDirection(dir)
    this.cineEndLook.copy(this.engine.camera.position).addScaledVector(dir, 10)
    this.cine = null
    this.cineBlendT = 0.7
    // resync pointer-lock state so skipping never auto-pauses
    this.wasLocked = this.engine.input.pointerLocked && !this.engine.input.isTouch
    c.onEnd()
    this.emit(true)
  }

  /** one frame of cinematic — camera keyframes + frozen world (except the roar) */
  private updateCinematic(dt: number, input: Engine['input']) {
    const c = this.cine!
    if (
      input.consume('LMB') ||
      input.consume('Space') ||
      input.consume('Enter') ||
      input.consume('KeyF')
    ) {
      this.endCinematic()
      return
    }
    input.takeMouse() // swallow look input during the shot
    const key = c.keys[c.i]
    if (key.onStart) {
      const fn = key.onStart
      key.onStart = undefined
      fn()
    }
    c.t += dt
    const k = easeInOut(Math.min(1, c.t / key.dur))
    this.engine.camera.position.lerpVectors(c.fromPos, key.pos, k)
    const look = new THREE.Vector3().lerpVectors(c.fromLook, key.look, k)
    this.engine.camera.lookAt(look)
    if (c.actor) c.actor.cineRoarStep(dt)
    if (c.t >= key.dur) {
      c.fromPos.copy(key.pos)
      c.fromLook.copy(key.look)
      c.i++
      c.t = 0
      if (c.i >= c.keys.length) {
        this.endCinematic()
        return
      }
    }
    // the world breathes around the shot
    this.world.update(dt)
    this.updateBonfire(dt)
    this.updateMerchant(dt)
    this.updateEffects(dt)
    this.updateLoot(dt)
    this.drawMinimap()
    this.emit(false)
  }

  private setCaption(text: string) {
    if (!this.cine) return
    this.cine.caption = text
    this.emit(true)
  }

  /** keep a cinematic camera point out of walls / above ground */
  private cineSafe(p: THREE.Vector3, toward: THREE.Vector3) {
    for (let i = 0; i < 10; i++) {
      const blocked =
        this.world.solidStruct(Math.round(p.x), Math.round(p.y - 0.4), Math.round(p.z)) ||
        this.world.surfaceAt(p.x, p.z) + 0.5 > p.y
      if (!blocked) return p
      p.lerp(toward, 0.15)
      const ground = this.world.surfaceAt(p.x, p.z) + 0.5
      if (p.y < ground) p.y = ground
    }
    return p
  }

  /** the fog gate closes behind — the lord's intro, shot properly */
  private startBossIntro(which: 1 | 2) {
    const boss = which === 1 ? this.boss : this.boss2
    const gate =
      which === 1
        ? new THREE.Vector3((GATE1.lane0 + GATE1.lane1) / 2, 0, GATE1.z)
        : new THREE.Vector3(GATE2.x, 0, GATE2.z)
    gate.y = this.world.surfaceAt(gate.x, gate.z)
    const bp = boss.pos.clone()
    const toBoss = bp.clone().sub(gate)
    toBoss.y = 0
    if (toBoss.lengthSq() < 0.01) toBoss.set(0, 0, -1)
    toBoss.normalize()
    const side = new THREE.Vector3(-toBoss.z, 0, toBoss.x)
    const chest = bp.clone().add(new THREE.Vector3(0, which === 1 ? 2.5 : 2.9, 0))

    // front-right of the lord → arc across his front → rise to the wide shot
    const k1 = bp.clone().addScaledVector(toBoss, 5.4).addScaledVector(side, 7.0)
    k1.y = bp.y + 3.5
    const k2 = bp.clone().addScaledVector(toBoss, 5.4).addScaledVector(side, -7.0)
    k2.y = bp.y + 3.7
    const k3 = gate.clone().addScaledVector(toBoss, 5.0)
    k3.y = gate.y + 6.4
    this.cineSafe(k1, gate)
    this.cineSafe(k2, gate)
    this.cineSafe(k3, gate)

    this.startCinematic(
      [
        {
          dur: 1.7,
          pos: k1,
          look: chest,
          onStart: () => (which === 1 ? this.onBossIntro(bp) : this.onBoss2Intro(bp)),
        },
        { dur: 2.3, pos: k2, look: chest },
        { dur: 1.5, pos: k3, look: chest.clone().add(new THREE.Vector3(0, 0.6, 0)) },
      ],
      {
        title: boss.name,
        sub: which === 1 ? 'نگهبانِ دروازهٔ کلیسا' : 'خداوندگارِ خاکسترگاه',
        actor: boss,
        onEnd: () => {
          boss.finishIntro()
          if (which === 1) {
            this.bossActive = true
            this.bossActiveBarrier = true
            this.boss.active = true
          } else {
            this.boss2Active = true
            this.boss2Barrier = true
            this.boss2.active = true
          }
          this.save()
        },
      }
    )
  }

  /** opening establishing shot — the Vale, the tower, the fortress (once) */
  private startIntroCinematic() {
    const bY = this.world.surfaceAt(BONFIRE.x, BONFIRE.z)
    const p = this.player.pos
    this.startCinematic(
      [
        {
          dur: 2.1,
          pos: new THREE.Vector3(1.6, bY + 3.6, 27.2),
          look: new THREE.Vector3(BONFIRE.x, bY + 1.0, BONFIRE.z),
          onStart: () => {
            this.sfx.reveal()
            this.setCaption('این‌جا «درّهٔ زغال» است — خانهٔ آخرین آتشِ جهان')
          },
        },
        {
          dur: 2.7,
          pos: new THREE.Vector3(6.5, bY + 7.2, 21.0),
          look: new THREE.Vector3(-28, 17, -22),
          onStart: () => this.setCaption('زنگِ ناقوس، پادشاهِ خاکستر را بیدار کرده است...'),
        },
        {
          dur: 2.7,
          pos: new THREE.Vector3(-3.5, bY + 6.4, 24.0),
          look: new THREE.Vector3(34, 13, -10),
          onStart: () => this.setCaption('اما تا اخگری باقی است، راه بازمی‌گردد — افروز، و جلو برو'),
        },
        {
          dur: 1.5,
          pos: new THREE.Vector3(p.x, p.y + 2.6, p.z + 5.6),
          look: new THREE.Vector3(p.x, p.y + 1.5, p.z),
        },
      ],
      { title: 'ماین سولز', sub: 'درّهٔ زغال' }
    )
  }

  /** after the first lord falls — the camera finds the fortress (once) */
  private startBeat1Cinematic() {
    const c = this.boss.pos.clone()
    this.startCinematic(
      [
        {
          dur: 1.9,
          pos: c.clone().add(new THREE.Vector3(3.2, 3.0, 4.2)),
          look: c.clone().add(new THREE.Vector3(0, 1.2, 0)),
          onStart: () => {
            this.sfx.reveal()
            this.setCaption('از آن‌سوی خاکسترگاه... پادشاهِ شعله خبردار می‌شود')
          },
        },
        {
          dur: 2.4,
          pos: c.clone().add(new THREE.Vector3(0.5, 9.5, -7.0)),
          look: new THREE.Vector3(34, 13, -10),
        },
      ],
      {}
    )
  }

  /* ---- region title cards ---- */

  private showCard(title: string, sub: string) {
    this.cardKey++
    this.card = { title, sub, key: this.cardKey }
    this.cardT = 3.4
    this.sfx.reveal()
    this.emit(true)
  }

  private updateRegionCard(dt: number) {
    if (this.cardT > 0) {
      this.cardT -= dt
      if (this.cardT <= 0) {
        this.card = null
        this.emit(true)
      }
    }
    const p = this.player.pos
    const r = REGIONS.find((x) => p.x >= x.x0 && p.x <= x.x1 && p.z >= x.z0 && p.z <= x.z1)
    if (r && r.id !== this.lastRegion) {
      this.lastRegion = r.id
      if (!this.cine && !this.cineSeen.regions?.includes(r.id)) {
        this.cineSeen.regions = [...(this.cineSeen.regions ?? []), r.id]
        this.showCard(r.name, r.sub)
      }
    }
  }

  /** a champion notices the unkindled — title card + far roar (once) */
  onChampionIntro(e: Enemy) {
    this.sfx.championSting()
    this.shake = Math.max(this.shake, 0.28)
    this.showCard(e.name, 'نگهبانِ بزرگِ درّه')
    this.spawnText(
      'یک بزرگ سترگ بیدار می‌شود!',
      '#ffb54a',
      e.pos.clone().add(new THREE.Vector3(0, 3.6, 0))
    )
  }

  onBoss2Phase2() {
    this.sfx.phaseRoar()
    this.shake = Math.max(this.shake, 0.5)
    const c = this.boss2.pos.clone().add(new THREE.Vector3(0, 2.6, 0))
    this.spawnBurst(c, 0xff6a1a, 34, 4.5)
    this.spawnBurst(this.boss2.pos.clone().add(new THREE.Vector3(0, 0.4, 0)), 0xffa044, 20, 3, 0.7, 0.2)
  }

  onBoss2Slam(pos: THREE.Vector3) {
    this.shake = Math.max(this.shake, 0.5)
    this.sfx.heavy()
    this.spawnBurst(pos.clone().add(new THREE.Vector3(0, 0.5, 0)), 0xff8a3a, 24, 4.5, 0.6, 0.22)
    this.spawnBurst(pos.clone().add(new THREE.Vector3(0, 0.25, 0)), 0xc25a1a, 14, 2.4, 0.8, 0.28)
    this.waves.push(new Shockwave(this, pos.clone(), 4.6, 14, 0xff9a4a))
    // the floor stays molten for a while — keep moving!
    this.spawnLavaPool(pos.x, pos.z)
  }

  /* ---- the First Coal's callbacks ---- */

  onBoss3Intro(pos: THREE.Vector3) {
    this.sfx.bossRoar()
    this.shake = Math.max(this.shake, 0.5)
    this.spawnBurst(pos.clone().add(new THREE.Vector3(0, 2.8, 0)), 0xff7a1e, 30, 4)
    this.spawnBurst(pos.clone().add(new THREE.Vector3(0, 0.4, 0)), 0xffc23d, 18, 2.6, 0.8, 0.2)
  }

  onBoss3Phase2() {
    this.sfx.phaseRoar()
    this.sfx.inferno()
    this.shake = Math.max(this.shake, 0.6)
    const c = this.boss3.pos.clone().add(new THREE.Vector3(0, 2.8, 0))
    this.spawnBurst(c, 0xff7a1e, 40, 5)
    this.spawnBurst(this.boss3.pos.clone().add(new THREE.Vector3(0, 0.4, 0)), 0xffc23d, 24, 3.4, 0.8, 0.22)
  }

  onBoss3Slam(pos: THREE.Vector3) {
    this.shake = Math.max(this.shake, 0.55)
    this.sfx.heavy()
    this.spawnBurst(pos.clone().add(new THREE.Vector3(0, 0.5, 0)), 0xb0a080, 26, 4.8, 0.6, 0.24)
    this.spawnBurst(pos.clone().add(new THREE.Vector3(0, 0.25, 0)), 0xff8a3a, 16, 2.6, 0.7, 0.26)
    this.waves.push(new Shockwave(this, pos.clone(), 5.2, 15))
  }

  /** the nova — the bedrock cracks in a burning ring */
  onBoss3Nova(pos: THREE.Vector3) {
    this.sfx.inferno()
    this.shake = Math.max(this.shake, 0.7)
    this.spawnBurst(pos.clone().add(new THREE.Vector3(0, 0.4, 0)), 0xff7a1e, 40, 6, 0.9, 0.24)
    this.spawnBurst(pos.clone().add(new THREE.Vector3(0, 1.0, 0)), 0xffc23d, 24, 4.2, 0.7, 0.2)
    this.waves.push(new Shockwave(this, pos.clone(), 6.6, 17, 0xffa044))
  }

  /** the pit's lord wakes when the unkindled descends into his bed */
  private startBoss3Intro() {
    const boss = this.boss3
    const bp = boss.pos.clone()
    const bed = new THREE.Vector3(34.5, this.world.surfaceAt(34.5, -44.2), -44.2)
    const chest = bp.clone().add(new THREE.Vector3(0, 3.0, 0))
    const toBoss = bp.clone().sub(bed)
    toBoss.y = 0
    if (toBoss.lengthSq() < 0.01) toBoss.set(0, 0, -1)
    toBoss.normalize()
    const side = new THREE.Vector3(-toBoss.z, 0, toBoss.x)
    // low across the lava → arc across his front → rise to the wide pit
    const k1 = bed.clone().add(new THREE.Vector3(2.4, 1.2, 2.0))
    const k2 = bp.clone().addScaledVector(toBoss, 6.0).addScaledVector(side, -7.0)
    k2.y = bp.y + 3.6
    const k3 = bed.clone().add(new THREE.Vector3(0.5, 9.5, 9.5))
    this.cineSafe(k1, chest)
    this.cineSafe(k2, chest)
    this.cineSafe(k3, chest)
    this.startCinematic(
      [
        {
          dur: 1.9,
          pos: k1,
          look: chest,
          onStart: () => {
            this.onBoss3Intro(bp)
            this.setCaption('از دلِ بسترِ سرد... سازنده‌ای خالی برمی‌خیزد')
          },
        },
        { dur: 2.3, pos: k2, look: chest },
        {
          dur: 1.7,
          pos: k3,
          look: chest.clone().add(new THREE.Vector3(0, 0.6, 0)),
          onStart: () => this.setCaption('او هنوز می‌سازد؛ چیزی که ساخته را نمی‌بیند. نامش، ذغالِ نخستین است.'),
        },
      ],
      {
        title: boss.name,
        sub: 'آخرینِ سازندگان',
        actor: boss,
        onEnd: () => {
          boss.finishIntro()
          this.boss3Active = true
          this.boss3Barrier = true
          boss.active = true
          this.save()
        },
      }
    )
  }

  /** a temporary molten patch left by the Flame King's slam */
  private spawnLavaPool(x: number, z: number) {
    const base = this.world.mats.lava as THREE.MeshBasicMaterial
    const mat = base.clone()
    mat.transparent = true
    const m = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 4.4), mat)
    m.rotation.x = -Math.PI / 2
    m.position.set(x, this.world.surfaceAt(x, z) + 0.04, z)
    this.engine.scene.add(m)
    this.lavaPools.push({ mesh: m, x, z, t: 0 })
  }

  /* ================= BOSS DEATH FINALES ================= */

  /** the ancient knight bursts into tumbling voxels while his souls stream skyward */
  onBossCollapse(pos: THREE.Vector3, body: Humanoid) {
    this.deathFx.push(new BossDeathFX(this, pos.clone(), 'collapse', body))
    this.sfx.soulCollapse()
    this.hitstop = 0.22
    this.shake = Math.max(this.shake, 0.55)
  }

  /** the Flame King combusts — white-hot flash, a pillar of fire and an ember whirl */
  onBossInferno(pos: THREE.Vector3, body: Humanoid) {
    this.deathFx.push(new BossDeathFX(this, pos.clone(), 'inferno', body))
    this.sfx.inferno()
    this.hitstop = 0.26
    this.shake = Math.max(this.shake, 0.72)
  }

  /** any enemy (Blaze, Flame King) calls this at the release moment */
  spawnFireball(from: THREE.Vector3, target: THREE.Vector3, dmg: number) {
    this.fireballs.push(new Fireball(this, from, target, dmg, false))
  }

  /** the player's pyromancy shot — aims at the locked target when there is one */
  spawnPlayerFireball(p: Player) {
    const from = p.pos.clone().add(new THREE.Vector3(0, 1.35, 0))
    let dir: THREE.Vector3
    let targetPoint: THREE.Vector3
    if (p.lockedTarget && p.lockedTarget.alive) {
      targetPoint = p.lockedTarget.pos.clone()
      dir = targetPoint.clone().sub(from)
      dir.y = 0
      if (dir.lengthSq() < 0.01) {
        dir.set(Math.sin(p.yaw), 0, Math.cos(p.yaw))
        targetPoint = from.clone().addScaledVector(dir, 12)
      }
    } else {
      dir = new THREE.Vector3(Math.sin(p.yaw), 0, Math.cos(p.yaw))
      targetPoint = from.clone().addScaledVector(dir, 12)
    }
    dir.normalize()
    // land the bolt at chest height above the target's ground —
    // without this, flat shots detonate on any terrain bump
    targetPoint.y = this.world.surfaceAt(targetPoint.x, targetPoint.z) + 1.0
    const to = targetPoint
    const dmg = Math.round(42 * (1 + p.str * 0.08))
    this.fireballs.push(new Fireball(this, from, to, dmg, true))
    this.sfx.fireShoot()
    this.spawnBurst(from.clone().addScaledVector(dir, 0.5), 0xffb347, 6, 1.6, 0.3, 0.1)
  }

  onFireballBoom(pos: THREE.Vector3, friendly: boolean) {
    this.sfx.fireBoom()
    this.shake = Math.max(this.shake, friendly ? 0.14 : 0.2)
    const at = pos.clone()
    this.spawnBurst(at, 0xffd23d, 16, 3.4, 0.45, 0.16)
    this.spawnBurst(at, 0xff6a1a, 12, 2.4, 0.6, 0.2)
    const light = new THREE.PointLight(0xff8a30, 5, 10, 1.8)
    light.position.copy(at)
    this.engine.scene.add(light)
    this.boomLights.push({ light, t: 0 })
  }

  /** feedback when the player presses R without pyromancy or charges */
  onCastFail(unlocked: boolean, hasCharge: boolean) {
    if (this.time - this.castFailT < 1.6) return
    this.castFailT = this.time
    if (!unlocked) {
      this.spawnText('هنوز جادو نیاموخته‌ای — در خاکسترگاه بیاب!', '#ff9a5c', this.player.pos.clone().add(new THREE.Vector3(0, 2.4, 0)))
    } else if (!hasCharge) {
      this.spawnText('شارژ جادو خالی است — در آتش کمپ بازپر کن', '#ff9a5c', this.player.pos.clone().add(new THREE.Vector3(0, 2.4, 0)))
    }
    this.emit(true)
  }

  /** the pyromancy flame loot — a staff-head of living embers */
  private buildPyroItem() {
    const g = new THREE.Group()
    const stick = new THREE.Mesh(
      new THREE.BoxGeometry(0.09, 0.7, 0.09),
      new THREE.MeshLambertMaterial({ color: 0x4a3620 })
    )
    stick.position.y = 0.1
    const orb = new THREE.Mesh(
      new THREE.BoxGeometry(0.26, 0.26, 0.26),
      new THREE.MeshBasicMaterial({ color: 0xffb347 })
    )
    orb.position.y = 0.62
    const glow = new THREE.Mesh(
      new THREE.BoxGeometry(0.46, 0.46, 0.46),
      new THREE.MeshBasicMaterial({ color: 0xff7a1e, transparent: true, opacity: 0.3 })
    )
    glow.position.y = 0.62
    g.add(stick, glow, orb)
    const y = this.world.surfaceAt(PYRO_ITEM.x, PYRO_ITEM.z) + 0.5
    g.position.set(PYRO_ITEM.x, y, PYRO_ITEM.z)
    this.engine.scene.add(g)
    const light = new THREE.PointLight(0xff8a2a, 2.2, 7, 1.8)
    light.position.set(PYRO_ITEM.x, y + 0.6, PYRO_ITEM.z)
    this.engine.scene.add(light)
    this.pyroItem = { mesh: g, light }
  }

  private removePyroItem() {
    if (!this.pyroItem) return
    this.engine.scene.remove(this.pyroItem.mesh)
    this.engine.scene.remove(this.pyroItem.light)
    this.pyroItem = null
  }

  private collectPyroItem() {
    if (!this.pyroItem) return
    this.removePyroItem()
    this.pyroUnlocked = true
    this.player.pyroUnlocked = true
    this.player.pyro = this.player.maxPyro
    this.sfx.shard()
    this.spawnBurst(this.player.pos.clone().add(new THREE.Vector3(0, 1.2, 0)), 0xff8a2a, 20, 2.6)
    this.spawnText('شعله‌ی پیرمانسی! با R شعله پرتاب کن', '#ffb347', this.player.pos.clone().add(new THREE.Vector3(0, 2.6, 0)))
    this.save()
    this.emit(true)
  }

  /** the Great Ember — the Flame King's dropped legacy (+2 spell charges) */
  private spawnEmber() {
    if (this.emberTaken || this.emberItem) return
    const g = new THREE.Group()
    const core = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 0.32, 0.32),
      new THREE.MeshBasicMaterial({ color: 0xff5a10 })
    )
    const glow = new THREE.Mesh(
      new THREE.BoxGeometry(0.56, 0.56, 0.56),
      new THREE.MeshBasicMaterial({ color: 0xff8a2a, transparent: true, opacity: 0.3 })
    )
    g.add(glow, core)
    const bx = this.boss2.pos.x
    const bz = this.boss2.pos.z
    const y = this.world.surfaceAt(bx, bz) + 0.75
    g.position.set(bx, y, bz)
    this.engine.scene.add(g)
    const light = new THREE.PointLight(0xff5a20, 2.6, 7, 1.8)
    light.position.set(bx, y + 0.5, bz)
    this.engine.scene.add(light)
    this.emberItem = { mesh: g, light }
  }

  private collectEmber() {
    if (!this.emberItem) return
    this.engine.scene.remove(this.emberItem.mesh)
    this.engine.scene.remove(this.emberItem.light)
    this.emberItem = null
    this.emberTaken = true
    this.player.pyroUnlocked = true
    this.pyroUnlocked = true
    this.player.maxPyro += 2
    this.player.pyro = this.player.maxPyro
    this.sfx.ember()
    this.spawnBurst(this.player.pos.clone().add(new THREE.Vector3(0, 1.2, 0)), 0xff5a20, 22, 2.8)
    this.spawnText('اخگر بزرگ! ظرفیت جادو +۲', '#ff7a3a', this.player.pos.clone().add(new THREE.Vector3(0, 2.6, 0)))
    this.save()
    this.emit(true)
  }

  spawnDamageText(dmg: number, pos: THREE.Vector3, height: number) {
    this.spawnText(`${dmg}`, '#ffffff', pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.6, height, (Math.random() - 0.5) * 0.6)))
  }

  spawnText(text: string, color: string, pos: THREE.Vector3) {
    this.texts.push(new FloatText(text, color, pos))
    this.engine.scene.add(this.texts[this.texts.length - 1].sprite)
  }

  spawnBurst(pos: THREE.Vector3, color: number, count = 14, speed = 3, life = 0.7, size = 0.14) {
    this.bursts.push(new Burst(this.engine.scene, pos, color, count, speed, life, size))
  }

  /* ================= MINIMAP ================= */

  private buildMinimap(container: HTMLElement) {
    const c = document.createElement('canvas')
    c.width = c.height = 132
    c.style.cssText =
      'position:absolute;top:12px;right:12px;width:132px;height:132px;border:2px solid rgba(0,0,0,0.92);' +
      'box-shadow:3px 3px 0 rgba(0,0,0,0.45);image-rendering:pixelated;z-index:6;background:#141c10;pointer-events:none'
    c.style.display = 'none'
    container.appendChild(c)
    this.mapCanvas = c
    this.mapCtx = c.getContext('2d')!

    // pre-render the blocky terrain once (1px per block, V2 world)
    const t = document.createElement('canvas')
    const H = V3_HALF * 2
    t.width = t.height = H
    const tc = t.getContext('2d')!
    for (let z = -V3_HALF; z < V3_HALF; z++) {
      for (let x = -V3_HALF; x < V3_HALF; x++) {
        const h = this.world.getH(x, z)
        const s = V3_SURF_NAMES[this.world.surfAt(x, z)]
        if (s === 'lava') tc.fillStyle = '#ff7a1f'
        else if (s === 'water') tc.fillStyle = '#3f6a8a'
        else if (s === 'nether') tc.fillStyle = `rgb(${74 + h * 4},${30 + h * 2},${24 + h * 2})`
        else if (s === 'stonebrick' || s === 'stone') tc.fillStyle = `rgb(${88 + h},${88 + h},${82 + h})`
        else if (s === 'mossy') tc.fillStyle = `rgb(${64 + h * 2},${86 + h * 3},${58 + h * 2})`
        else if (s === 'cobble') tc.fillStyle = `rgb(${110 + h * 2},${106 + h * 2},${96 + h * 2})`
        else if (s === 'dirt') tc.fillStyle = `rgb(${100 + h * 4},${72 + h * 3},${44 + h * 2})`
        else tc.fillStyle = `rgb(${40 + h * 5},${78 + h * 9},${28 + h * 4})`
        tc.fillRect(x + V3_HALF, z + V3_HALF, 1, 1)
      }
    }
    this.mapTerrain = t
  }

  private drawMinimap() {
    const c = this.mapCanvas
    if (this.phase === 'menu') {
      c.style.display = 'none'
      return
    }
    c.style.display = 'block'
    const ctx = this.mapCtx
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(this.mapTerrain, 0, 0, 132, 132)
    const S = 132 / (V3_HALF * 2)
    const px = (x: number) => (x + V3_HALF) * S
    const pz = (z: number) => (z + V3_HALF) * S

    // bonfire — warm beacon
    ctx.fillStyle = '#ffb347'
    ctx.fillRect(px(BONFIRE.x) - 2, pz(BONFIRE.z) - 2, 4, 4)
    ctx.fillStyle = '#ffe08a'
    ctx.fillRect(px(BONFIRE.x) - 1, pz(BONFIRE.z) - 1, 2, 2)

    // boss 1 — dark crimson square until it falls
    if (!this.bossFell) {
      ctx.fillStyle = this.bossActive ? '#d43737' : '#8a2020'
      ctx.fillRect(px(this.boss.pos.x) - 2.5, pz(this.boss.pos.z) - 2.5, 5, 5)
    }

    // boss 2 — molten orange square until it falls
    if (!this.boss2Fell) {
      ctx.fillStyle = this.boss2Active ? '#ff6a1f' : '#a03a10'
      ctx.fillRect(px(this.boss2.pos.x) - 2.5, pz(this.boss2.pos.z) - 2.5, 5, 5)
    }

    // memorial stones — unread ones burn bright, read ones dim gold
    for (const s of this.loreStones) {
      ctx.fillStyle = s.seen ? '#c9a44a' : '#a5ffc8'
      ctx.fillRect(px(s.group.position.x) - 1.5, pz(s.group.position.z) - 1.5, 3, 3)
    }

    // enemies — color-coded by breed
    for (const e of this.enemies) {
      if (!e.alive) continue
      ctx.fillStyle =
        e instanceof CreeperEnemy ? '#59d959'
        : e instanceof SkeletonEnemy ? '#ece8dc'
        : e instanceof WitherSkeletonEnemy ? '#8a8a96'
        : e instanceof BlazeEnemy ? '#ffb347'
        : '#d43737'
      ctx.fillRect(px(e.pos.x) - 1.5, pz(e.pos.z) - 1.5, 3, 3)
    }

    // bloodstain — blinking emerald
    if (this.bloodstain) {
      ctx.fillStyle = Math.sin(this.time * 6) > 0 ? '#59ff6a' : '#2fbf4a'
      const bp = this.bloodstain.mesh.position
      ctx.fillRect(px(bp.x) - 1.5, pz(bp.z) - 1.5, 3, 3)
    }

    // estus shard — amber sparkle
    if (this.estusShard) {
      const sp = this.estusShard.mesh.position
      ctx.fillStyle = Math.sin(this.time * 8) > 0 ? '#ffc44d' : '#ffdf8a'
      ctx.fillRect(px(sp.x) - 1.5, pz(sp.z) - 1.5, 3, 3)
    }

    // pyromancy flame loot — pulsing ember
    if (this.pyroItem) {
      const sp = this.pyroItem.mesh.position
      ctx.fillStyle = Math.sin(this.time * 9) > 0 ? '#ff8a2a' : '#ffb347'
      ctx.fillRect(px(sp.x) - 1.5, pz(sp.z) - 1.5, 3, 3)
    }

    // great ember — hot red sparkle
    if (this.emberItem) {
      const sp = this.emberItem.mesh.position
      ctx.fillStyle = Math.sin(this.time * 9) > 0 ? '#ff5a20' : '#ff8a3a'
      ctx.fillRect(px(sp.x) - 1.5, pz(sp.z) - 1.5, 3, 3)
    }

    // merchant — gold coin marker at his stall behind the bonfire
    ctx.fillStyle = Math.sin(this.time * 4) > 0 ? '#ffd75a' : '#c9a44a'
    ctx.fillRect(px(MERCHANT.x) - 2, pz(MERCHANT.z) - 2, 4, 4)
    ctx.fillStyle = '#7a5a18'
    ctx.fillRect(px(MERCHANT.x) - 1, pz(MERCHANT.z) - 1, 2, 2)

    // player — white block + facing notch
    const ppx = px(this.player.pos.x)
    const ppz = pz(this.player.pos.z)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(ppx - 2, ppz - 2, 4, 4)
    const fx = Math.sin(this.player.yaw)
    const fz = Math.cos(this.player.yaw)
    ctx.fillStyle = '#59ff6a'
    ctx.fillRect(ppx + fx * 4.5 - 1, ppz + fz * 4.5 - 1, 2, 2)
  }

  private spawnBloodstain() {
    if (this.bloodstain) {
      this.engine.scene.remove(this.bloodstain.mesh)
      this.bloodstain = null
    }
    const amount = this.player.souls
    if (amount <= 0) return
    const g = new THREE.Group()
    const core = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 0.4, 0.4),
      new THREE.MeshBasicMaterial({ color: 0x59ff6a, transparent: true, opacity: 0.9 })
    )
    const glow = new THREE.Mesh(
      new THREE.BoxGeometry(0.62, 0.62, 0.62),
      new THREE.MeshBasicMaterial({ color: 0x2fbf4a, transparent: true, opacity: 0.35 })
    )
    g.add(core, glow)
    g.position.set(this.player.pos.x, this.world.surfaceAt(this.player.pos.x, this.player.pos.z) + 0.45, this.player.pos.z)
    this.engine.scene.add(g)
    this.bloodstain = { mesh: g, amount }
    this.player.souls = 0
  }

  private bossActiveBarrier = false
  private boss2Barrier = false

  private respawn() {
    // never let a cut-scene survive a death
    this.cine = null
    this.cineBlendT = 0
    this.beat1Pending = 0
    const p = new THREE.Vector3(BONFIRE.x + 2.5, 0, BONFIRE.z + 2)
    p.y = this.world.surfaceAt(p.x, p.z)
    this.player.reset(p, Math.PI * 0.85)
    this.player.fullRestore()
    for (const e of this.enemies) e.reset()
    if (!this.bossFell || !this.boss2Fell) {
      this.world.setFogGatesVisible(!this.bossFell, !this.boss2Fell)
    }
    if (!this.bossFell) this.boss.reset()
    if (!this.boss2Fell) this.boss2.reset()
    if (!this.boss3Fell) this.boss3.reset()
    this.bossActive = false
    this.bossActiveBarrier = false
    this.boss2Active = false
    this.boss2Barrier = false
    this.boss3Active = false
    this.boss3Barrier = false
    this.world.setPitOpen(this.boss2Fell)
    for (const o of this.orbs) this.engine.scene.remove(o.mesh)
    this.orbs = []
    this.fogPassT = 0
    this.fogPass2T = 0
    // dying while the Coal's bed called — the choice waits for a fresh breath, not the old countdown
    if (this.endingPending > 0) this.endingPending = 1.4
    // death released the pointer lock — never read that as "player pressed ESC"
    this.wasLocked = false
    this.phase = 'playing'
    this.banner = null
    this.hurtFlash = 0
    this.emit(true)
  }

  private clampPlayer() {
    const p = this.player.pos
    const lim = V3_HALF - 1.6
    p.x = Math.max(-lim, Math.min(lim, p.x))
    p.z = Math.max(-lim, Math.min(lim, p.z))
    // fog gate 1 blocks the whole gate span before the trigger — the
    // arena is sealed, no slipping around the mist's soft edges
    if (!this.bossActive && !this.bossFell && this.fogPassT <= 0 && !this.player.busy) {
      if (p.z < GATE1.z + 0.55 && p.x > GATE1.x0 && p.x < GATE1.x1) p.z = GATE1.z + 0.55
    }
    // fog gate 2 seals the gatehouse mouth
    if (!this.boss2Active && !this.boss2Fell && this.fogPass2T <= 0 && !this.player.busy) {
      if (p.z < GATE2.z + 0.55 && Math.abs(p.x - GATE2.x) < 3.4) p.z = GATE2.z + 0.55
    }
    // arena barriers while fighting — held just short of the fog so the
    // player can never stand inside the mist
    if (this.bossActiveBarrier && !this.bossFell) {
      p.x = Math.max(ARENA1.x0, Math.min(ARENA1.x1, p.x))
      p.z = Math.max(ARENA1.z0, Math.min(ARENA1.z1, p.z))
    }
    if (this.boss2Barrier && !this.boss2Fell) {
      p.x = Math.max(BOSS2_CENTER.x - 7.2, Math.min(BOSS2_CENTER.x + 7.2, p.x))
      p.z = Math.max(BOSS2_CENTER.z - 7.2, Math.min(BOSS2_CENTER.z + 7.2, p.z))
    }
    // the rockfall seals the pit stair until the Flame King falls
    if (!this.boss2Fell && this.fogPass2T <= 0 && !this.player.busy) {
      if (p.z < PIT_RUBBLE.z1 + 0.55 && p.x > PIT_RUBBLE.x0 - 0.6 && p.x < PIT_RUBBLE.x1 + 0.6) {
        p.z = PIT_RUBBLE.z1 + 0.55
      }
    }
    // the Coal's arena seals behind his intro — the pit fights for him
    if (this.boss3Barrier && !this.boss3Fell) {
      p.x = Math.max(COAL_ARENA.x0, Math.min(COAL_ARENA.x1, p.x))
      p.z = Math.max(COAL_ARENA.z0, Math.min(COAL_ARENA.z1, p.z))
    }
  }

  private detectPrompt(): string | null {
    // nearest loot drop — the item's own name invites the pickup
    let bestLoot: LootDrop | null = null
    let bestD = 1.9
    for (const l of this.loots) {
      const d = Math.hypot(this.player.pos.x - l.group.position.x, this.player.pos.z - l.group.position.z)
      if (d < bestD) {
        bestD = d
        bestLoot = l
      }
    }
    if (bestLoot) {
      const def = ITEMS[bestLoot.id]
      const qty = bestLoot.n > 1 ? ` ×${bestLoot.n}` : ''
      return def ? `برداشتن ${def.name}${qty}` : 'برداشتن غنیمت'
    }
    // the Vale's secrets — chests, shimmering walls, waiting keys
    const secret = this.nearestSecret()
    if (secret) return secret.prompt
    // memorial stones — seen ones invite a re-reading
    for (const s of this.loreStones) {
      if (Math.hypot(this.player.pos.x - s.group.position.x, this.player.pos.z - s.group.position.z) < 2.1) {
        return (s.seen ? 'خواندن دوباره سنگ‌یاد — ' : 'خواندن سنگ‌یاد — ') + s.title
      }
    }
    if (this.bloodstain && this.bloodstain.mesh.position.distanceTo(this.player.pos) < 1.7) {
      return 'بازیابی سول‌ها'
    }
    if (this.estusShard) {
      const sp = this.estusShard.mesh.position
      if (Math.hypot(this.player.pos.x - sp.x, this.player.pos.z - sp.z) < 1.9) {
        return 'برداشتن تکه‌ی استوس'
      }
    }
    if (this.pyroItem) {
      const sp = this.pyroItem.mesh.position
      if (Math.hypot(this.player.pos.x - sp.x, this.player.pos.z - sp.z) < 1.9) {
        return 'برداشتن شعله‌ی پیرمانسی'
      }
    }
    if (this.emberItem) {
      const sp = this.emberItem.mesh.position
      if (Math.hypot(this.player.pos.x - sp.x, this.player.pos.z - sp.z) < 1.9) {
        return 'برداشتن اخگر بزرگ'
      }
    }
    const bPos = new THREE.Vector3(BONFIRE.x, this.world.surfaceAt(BONFIRE.x, BONFIRE.z), BONFIRE.z)
    if (bPos.distanceTo(this.player.pos) < 2.6) return 'استراحت در آتش کمپ'
    if (Math.hypot(this.player.pos.x - MERCHANT.x, this.player.pos.z - MERCHANT.z) < 2.7) {
      return 'گفتگو با بازرگان'
    }
    if (Math.hypot(this.player.pos.x - SMITH.x, this.player.pos.z - SMITH.z) < 2.7) {
      return 'گفتگو با کوره‌بان — ارتقای سلاح'
    }
    // the rockfall sealing the pit stair
    if (!this.boss2Fell &&
      this.player.pos.x > PIT_RUBBLE.x0 - 1.5 && this.player.pos.x < PIT_RUBBLE.x1 + 1.5 &&
      this.player.pos.z > PIT_RUBBLE.z0 - 1.5 && this.player.pos.z < PIT_RUBBLE.z1 + 1.5
    ) {
      return 'ریزش سنگ — راهِ پایین بسته است (پادشاهِ شعله هنوز زنده است)'
    }
    if (!this.bossActive && !this.bossFell && this.player.pos.z < GATE1.z + 3.2 && this.player.pos.z > GATE1.z - 0.4 &&
      this.player.pos.x > GATE1.lane0 && this.player.pos.x < GATE1.lane1
    ) {
      return 'عبور از دیوار مه'
    }
    if (
      !this.boss2Active && !this.boss2Fell &&
      Math.abs(this.player.pos.x - GATE2.x) < 2.0 &&
      this.player.pos.z < GATE2.z + 3.2 && this.player.pos.z > GATE2.z - 0.4
    ) {
      return 'عبور از دیوار مه دوم'
    }
    return null
  }

  private loop(rawDt: number) {
    if (this.frozen) return
    // periodic shadow map refresh (big perf win)
    this.shadowTimer += rawDt
    if (this.shadowTimer > 0.15) {
      this.shadowTimer = 0
      this.sun.shadow.needsUpdate = true
    }

    // hitstop slow-mo
    let dt = rawDt
    if (this.hitstop > 0) {
      this.hitstop -= rawDt
      dt = rawDt * 0.08
    }
    this.time += dt

    const input = this.engine.input

    if (this.phase === 'menu') {
      // slow orbit around bonfire
      this.camYaw += dt * 0.12
      this.world.update(dt)
      this.updateBonfire(dt)
      this.updateMerchant(dt)
      this.player.h.group.position.copy(this.player.pos)
      this.player.h.group.rotation.y = this.player.yaw
      this.updateCameraMenu(dt)
      this.drawMinimap()
      this.emit(false)
      return
    }

    if (this.phase === 'dead') {
      this.deadT += rawDt
      this.player.update({ input, camYaw: this.camYaw, dt, world: this.world, game: this })
      this.world.update(dt)
      this.updateBonfire(dt)
      this.updateMerchant(dt)
      this.updateEffects(dt)
      if (this.deadT > 2.9) {
        this.deadT = 0
        this.respawn()
      }
      this.updateCameraFollow(dt, true)
      this.drawMinimap()
      this.emit(false)
      return
    }

    if (this.phase === 'rest') {
      // Escape also leaves the bonfire menu
      if (input.consume('Escape')) {
        this.leaveRest()
        return
      }
      this.world.update(dt)
      this.updateBonfire(dt)
      this.updateMerchant(dt)
      this.updateEffects(dt)
      this.updateCameraFollow(dt, false)
      this.drawMinimap()
      this.emit(false)
      return
    }

    if (this.phase === 'shop') {
      // Escape closes the stall
      if (input.consume('Escape')) {
        this.closeShop()
        return
      }
      this.world.update(dt)
      this.updateBonfire(dt)
      this.updateMerchant(dt)
      this.updateEffects(dt)
      this.updateLoot(dt)
      this.updateCameraFollow(dt, false)
      this.drawMinimap()
      this.emit(false)
      return
    }

    if (this.phase === 'smith') {
      // Escape leaves the forge
      if (input.consume('Escape')) {
        this.closeSmith()
        return
      }
      this.world.update(dt)
      this.updateBonfire(dt)
      this.updateMerchant(dt)
      this.updateSmith(dt)
      this.updateSecrets(dt)
      this.updateEffects(dt)
      this.updateLoot(dt)
      this.updateCameraFollow(dt, false)
      this.drawMinimap()
      this.emit(false)
      return
    }

    if (this.phase === 'ending') {
      // the world holds its breath while the choice stands
      this.world.update(dt)
      this.updateBonfire(dt)
      this.updateMerchant(dt)
      this.updateSmith(dt)
      this.updateEffects(dt)
      this.updateCameraFollow(dt, false)
      this.drawMinimap()
      this.emit(false)
      return
    }

    if (this.phase === 'inventory') {
      // Escape / I / Tab closes the satchel
      if (input.consume('Escape') || input.consume('KeyI') || input.consume('Tab')) {
        this.closeInventory()
        return
      }
      this.world.update(dt)
      this.updateBonfire(dt)
      this.updateMerchant(dt)
      this.updateSecrets(dt)
      this.updateEffects(dt)
      this.updateLoot(dt)
      this.updateCameraFollow(dt, false)
      this.drawMinimap()
      this.emit(false)
      return
    }

    if (this.phase === 'lore') {
      // Escape closes the stone
      if (input.consume('Escape')) {
        this.closeLore()
        return
      }
      this.world.update(dt)
      this.updateBonfire(dt)
      this.updateMerchant(dt)
      this.updateEffects(dt)
      this.updateCameraFollow(dt, false)
      this.drawMinimap()
      this.emit(false)
      return
    }

    if (this.phase === 'paused') {
      // Escape / P returns to the fight
      if (input.consume('Escape') || input.consume('KeyP')) {
        this.resume()
        return
      }
      this.world.update(dt)
      this.updateBonfire(dt)
      this.updateMerchant(dt)
      this.updateEffects(dt)
      this.updateCameraFollow(dt, false)
      this.drawMinimap()
      this.emit(false)
      return
    }

    /* ---- playing ---- */

    /* ---- cinematic override — the director owns the camera ---- */
    if (this.cine) {
      this.updateCinematic(dt, input)
      return
    }

    // deferred story beat after the first lord falls
    if (this.beat1Pending > 0) {
      this.beat1Pending -= dt
      if (this.beat1Pending <= 0) this.startBeat1Cinematic()
    }
    // first-entry region title cards
    this.updateRegionCard(dt)

    // camera input
    const { dx, dy } = input.takeMouse()
    if (dx !== 0 || dy !== 0) this.lockLastMove = 0
    else this.lockLastMove += dt
    const sens = 0.0031 * this.settings.sens
    this.camYaw -= dx * sens
    this.camPitch += dy * sens * (this.settings.invertY ? -1 : 1)
    this.camPitch = Math.max(-0.45, Math.min(1.15, this.camPitch))
    const wheel = input.takeWheel()
    if (wheel !== 0) this.camDistTarget = Math.max(3.4, Math.min(8.5, this.camDistTarget + wheel * 0.004))
    this.camDist += (this.camDistTarget - this.camDist) * Math.min(1, 8 * dt)

    // global keys
    if (input.consume('KeyQ')) this.toggleLock()
    if (input.consume('KeyF')) this.interact()
    // equipment: I/Tab opens the satchel, 1/2 swap hands
    if (input.consume('KeyI') || input.consume('Tab')) {
      this.openInventory()
      return
    }
    if (input.consume('Digit1')) this.switchRight()
    if (input.consume('Digit2')) this.switchLeft()
    // ESC opens the pause menu (pointer-lock keys fall through to the game)
    if (input.consume('Escape')) {
      this.player.lockedTarget = null
      this.pause()
      this.emit(true)
      return
    }
    // losing the pointer lock (browser ate the ESC) also pauses
    if (this.wasLocked && !input.pointerLocked && !input.isTouch) {
      this.pause()
      this.wasLocked = false
      this.emit(true)
      return
    }
    this.wasLocked = input.pointerLocked && !input.isTouch

    // fog pass 1 animation — north gate
    if (this.fogPassT > 0) {
      this.fogPassT -= dt
      this.player.pos.z -= 5.5 * dt
      // swing the camera around to face the boss arena cinematically
      let dYaw = -this.camYaw
      while (dYaw > Math.PI) dYaw -= Math.PI * 2
      while (dYaw < -Math.PI) dYaw += Math.PI * 2
      this.camYaw += dYaw * Math.min(1, 5 * dt)
      this.camPitch += (0.32 - this.camPitch) * Math.min(1, 4 * dt)
      if (this.fogPassT <= 0) {
        this.startBossIntro(1)
      }
    }

    // fog pass 2 animation — the breach into the Flame King's caldera
    if (this.fogPass2T > 0) {
      this.fogPass2T -= dt
      this.player.pos.z -= 5.5 * dt
      let dY2 = -this.camYaw
      while (dY2 > Math.PI) dY2 -= Math.PI * 2
      while (dY2 < -Math.PI) dY2 += Math.PI * 2
      this.camYaw += dY2 * Math.min(1, 5 * dt)
      this.camPitch += (0.32 - this.camPitch) * Math.min(1, 4 * dt)
      if (this.fogPass2T <= 0) {
        this.startBossIntro(2)
      }
    }

    // ash-wastes ambience — the sky reddens over the burned east
    const inAsh = this.player.pos.x > 20.5
    const fog = this.engine.scene.fog as THREE.Fog
    const bg = this.engine.scene.background as THREE.Color
    fog.color.lerp(this.tmpColor.set(inAsh ? 0x261016 : 0x101720), Math.min(1, 2.5 * dt))
    bg.lerp(this.tmpColor.set(inAsh ? 0x1c0c10 : 0x101720), Math.min(1, 2.5 * dt))

    // lava burns whoever stands in it
    this.lavaTick -= dt
    if (this.lavaTick <= 0 && this.player.alive && this.fogPassT <= 0 && this.fogPass2T <= 0) {
      const px = Math.round(this.player.pos.x)
      const pz = Math.round(this.player.pos.z)
      let inLava = this.world.isLava(px, pz)
      if (!inLava) {
        inLava = this.lavaPools.some(
          (lp) => Math.hypot(this.player.pos.x - lp.x, this.player.pos.z - lp.z) < 2.2
        )
      }
      if (inLava) {
        this.lavaTick = 0.55
        const dmg = 8
        if (
          this.player.takeDamage(
            dmg,
            this.player.pos.x + (Math.random() - 0.5),
            this.player.pos.z + (Math.random() - 0.5),
            this,
            false,
            'fire'
          )
        ) {
          this.onPlayerHit(dmg)
          this.spawnBurst(this.player.pos.clone().add(new THREE.Vector3(0, 0.4, 0)), 0xff7a1e, 8, 1.8, 0.4, 0.12)
        }
      }
    }

    // lock-on validity + soft camera pull
    if (this.player.lockedTarget) {
      const lt = this.player.lockedTarget
      const e = this.allEnemies.find((en) => en.pos === lt.pos)
      if (!e || e.dead) {
        this.player.lockedTarget = null
      } else if (e.pos.distanceTo(this.player.pos) > 17) {
        this.player.lockedTarget = null
      } else if (this.lockLastMove > 0.8) {
        const desired = e.yaw + Math.PI
        let d = desired - this.camYaw
        while (d > Math.PI) d -= Math.PI * 2
        while (d < -Math.PI) d += Math.PI * 2
        this.camYaw += d * Math.min(1, 2.2 * dt)
      }
    }

    this.clampPlayer()
    this.player.update({ input, camYaw: this.camYaw, dt, world: this.world, game: this })

    // death transition
    if (this.player.state === 'dead') {
      this.phase = 'dead'
      this.deadT = 0
      this.spawnBloodstain()
      this.player.lockedTarget = null
      input.releaseLock()
      this.sfx.death()
      this.emit(true)
      return
    }

    for (const e of this.enemies) e.update(dt, this.player, this)
    // fallen lords keep updating so their cinematic death animation + FX can play out
    this.boss.update(dt, this.player, this)
    this.boss2.update(dt, this.player, this)
    this.boss3.update(dt, this.player, this)

    this.world.update(dt)
    this.updateBonfire(dt)
    this.updateSecrets(dt)
    this.updateLoot(dt)
    this.updateEffects(dt)
    this.updateOrbs(dt)

    // the ending choice waits for the banner to fade
    this.maybeOpenEnding(dt)

    // prompt
    this.prompt = this.fogPassT > 0 || this.fogPass2T > 0 ? null : this.detectPrompt()
    if (this.prompt && input.isTouch && input.consume('TouchInteract')) this.interact()

    // banner timer
    if (this.banner) {
      this.bannerT += rawDt
      if ((this.banner === 'bossfell' || this.banner === 'bossfell2' || this.banner === 'coalfell') && this.bannerT > 3.6) {
        this.banner = null
        this.emit(true)
      }
    }

    // the Coal wakes when the unkindled steps onto his bed
    if (!this.boss3Active && !this.boss3Fell && !this.cine && this.boss2Fell) {
      const pp = this.player.pos
      const inPit =
        pp.x > 25 && pp.x < 44.5 && pp.z < -40.5 && pp.z > -53 &&
        pp.y < 6 // down at the floor, not on the rim
      if (inPit) this.startBoss3Intro()
    }

    // hurt vignette decay
    this.hurtFlash = Math.max(0, this.hurtFlash - rawDt * 1.6)
    const lowHp = this.player.hp / this.player.maxHp < 0.25 && this.player.alive
    const vig = Math.max(this.hurtFlash, lowHp ? 0.22 + Math.sin(this.time * 5) * 0.08 : 0)
    this.vignette.style.opacity = String(vig)

    this.updateMerchant(dt)
    this.updateSmith(dt)
    this.updateCameraFollow(dt, false)
    this.updateReticle()
    this.drawMinimap()
    this.emit(false)
  }

  private updateBonfire(dt: number) {
    this.bonfireLight.intensity = 2.6 + Math.sin(this.time * 13) * 0.35 + Math.random() * 0.3
    const pos = this.bonfireFlame.geometry.getAttribute('position') as THREE.BufferAttribute
    const bY = this.world.surfaceAt(BONFIRE.x, BONFIRE.z)
    for (let i = 0; i < pos.count; i++) {
      const seed = this.flameSeeds[i]
      const cycle = (this.time * (0.8 + seed * 0.7) + seed * 3) % 1
      const ang = seed * Math.PI * 2 + this.time * (0.5 + seed)
      const r = 0.28 * (1 - cycle)
      pos.setXYZ(
        i,
        BONFIRE.x + Math.cos(ang) * r,
        bY + 0.15 + cycle * 1.7,
        BONFIRE.z + Math.sin(ang) * r
      )
    }
    pos.needsUpdate = true
    void dt
  }

  /** the grey merchant: idle sway, greets nearby unkindled, lamp flicker */
  private updateMerchant(dt: number) {
    this.merchantGreetT = Math.max(0, this.merchantGreetT - dt)
    this.merchantGreetCd = Math.max(0, this.merchantGreetCd - dt)
    const dx = this.player.pos.x - MERCHANT.x
    const dz = this.player.pos.z - MERCHANT.z
    const near = Math.hypot(dx, dz)
    if (near < 4.5 && this.merchantGreetCd <= 0 && this.phase === 'playing') {
      this.merchantGreetT = 1.3
      this.merchantGreetCd = 11
    }
    // face the player when they are close, otherwise face the bonfire
    if (near < 6) {
      const target = Math.atan2(dx, dz)
      let d = target - this.merchant.group.rotation.y
      while (d > Math.PI) d -= Math.PI * 2
      while (d < -Math.PI) d += Math.PI * 2
      this.merchant.group.rotation.y += d * Math.min(1, 3 * dt)
    } else {
      this.merchant.group.rotation.y +=
        (this.merchantYaw - this.merchant.group.rotation.y) * Math.min(1, dt)
    }
    if (this.merchantGreetT > 0) {
      animMerchantGreet(this.merchant, 1 - this.merchantGreetT / 1.3)
    } else {
      animMerchantIdle(this.merchant, this.time)
    }
    // lantern flicker
    this.merchantLamp.intensity = 1.5 + Math.sin(this.time * 11) * 0.2 + Math.random() * 0.12
  }

  /** the forge-keeper — he turns to his customers and leans on his hammer */
  private updateSmith(dt: number) {
    const dx = this.player.pos.x - SMITH.x
    const dz = this.player.pos.z - SMITH.z
    const near = Math.hypot(dx, dz)
    const homeYaw = Math.PI * 0.92
    if (near < 5) {
      const target = Math.atan2(dx, dz)
      let d = target - this.smith.group.rotation.y
      while (d > Math.PI) d -= Math.PI * 2
      while (d < -Math.PI) d += Math.PI * 2
      this.smith.group.rotation.y += d * Math.min(1, 2.6 * dt)
    } else {
      this.smith.group.rotation.y += (homeYaw - this.smith.group.rotation.y) * Math.min(1, dt)
    }
    animSmithIdle(this.smith, this.time)
  }

  /** loot drops bob & spin; player-dropped litter crumbles when expired */
  private updateLoot(dt: number) {
    for (const l of this.loots) {
      l.update(dt)
      if (l.expired) l.dispose(this.engine.scene)
    }
    this.loots = this.loots.filter((l) => !l.expired)
    if (this.toastT > 0) {
      this.toastT -= dt
      if (this.toastT <= 0) {
        this.toastMsg = null
        this.emit(true)
      }
    }
  }

  private updateEffects(dt: number) {
    this.bursts = this.bursts.filter((b) => b.update(dt, this.engine.scene))
    this.texts = this.texts.filter((t) => t.update(dt, this.engine.scene))
    // boss slam/stomp shockwave rings
    this.waves = this.waves.filter((w) => w.update(dt))
    // skeleton arrows (and the player's own loosed arrows)
    this.arrows = this.arrows.filter((a) => {
      const alive = a.update(dt)
      if (!alive) a.dispose(this.engine.scene)
      return alive
    })
    // fireballs — pyromancy & flame foes
    this.fireballs = this.fireballs.filter((f) => {
      const alive = f.update(dt)
      if (!alive) f.dispose(this.engine.scene)
      return alive
    })
    // the grand finale when a lord falls (voxel collapse / inferno)
    this.deathFx = this.deathFx.filter((f) => f.update(dt))
    // temporary molten patches from the Flame King's slams
    this.lavaPools = this.lavaPools.filter((lp) => {
      lp.t += dt
      const mat = lp.mesh.material as THREE.MeshBasicMaterial
      mat.opacity = Math.max(0, 1 - Math.max(0, lp.t - 3) / 1.5)
      if (lp.t >= 4.5) {
        this.engine.scene.remove(lp.mesh)
        lp.mesh.geometry.dispose()
        mat.dispose()
        return false
      }
      return true
    })
    // creeper explosion flash lights
    this.boomLights = this.boomLights.filter((b) => {
      b.t += dt
      b.light.intensity = Math.max(0, 7 * (1 - b.t / 0.4))
      if (b.t >= 0.4) {
        this.engine.scene.remove(b.light)
        b.light.dispose()
        return false
      }
      return true
    })
    // bloodstain bob
    if (this.bloodstain) {
      this.bloodstain.mesh.rotation.y += dt * 1.5
      this.bloodstain.mesh.position.y += Math.sin(this.time * 3) * dt * 0.12
    }
    // estus shard bob + spin
    if (this.estusShard) {
      this.estusShard.mesh.rotation.y += dt * 1.6
      this.estusShard.mesh.position.y += Math.sin(this.time * 2.4) * dt * 0.16
      this.estusShard.light.intensity = 2 + Math.sin(this.time * 4.2) * 0.5
    }
    // pyromancy flame loot bob + spin
    if (this.pyroItem) {
      this.pyroItem.mesh.rotation.y += dt * 1.8
      this.pyroItem.mesh.position.y += Math.sin(this.time * 2.6) * dt * 0.14
      this.pyroItem.light.intensity = 2 + Math.sin(this.time * 5) * 0.5
    }
    // great ember bob + spin
    if (this.emberItem) {
      this.emberItem.mesh.rotation.y += dt * 2
      this.emberItem.mesh.position.y += Math.sin(this.time * 2.8) * dt * 0.16
      this.emberItem.light.intensity = 2.4 + Math.sin(this.time * 5.5) * 0.6
    }
  }

  private updateOrbs(dt: number) {
    this.orbs = this.orbs.filter((o) => {
      o.t += dt / 0.7
      const target = this.player.pos.clone().add(new THREE.Vector3(0, 1.1, 0))
      o.mesh.position.lerpVectors(o.from, target, Math.min(1, o.t))
      o.mesh.rotation.y += dt * 6
      if (o.t >= 1) {
        this.engine.scene.remove(o.mesh)
        this.player.souls += o.amount
        this.sfx.souls()
        this.spawnBurst(target, 0x59ff6a, 10, 2)
        return false
      }
      return true
    })
  }

  private updateCameraMenu(dt: number) {
    const bY = this.world.surfaceAt(BONFIRE.x, BONFIRE.z)
    this.camTarget.set(BONFIRE.x, bY + 1.2, BONFIRE.z)
    const d = 6.2
    this.camPos.set(
      this.camTarget.x + Math.sin(this.camYaw) * d,
      this.camTarget.y + 2.2,
      this.camTarget.z + Math.cos(this.camYaw) * d
    )
    this.engine.camera.position.lerp(this.camPos, Math.min(1, 3 * dt))
    this.engine.camera.lookAt(this.camTarget)
  }

  private updateCameraFollow(dt: number, dead: boolean) {
    const p = this.player
    this.camTarget.set(p.pos.x, p.pos.y + 1.5, p.pos.z)
    const dist = dead ? this.camDist + 2.5 : this.camDist
    const cp = Math.max(0.12, this.camPitch)
    // cast from the target toward the desired camera spot; when a rooftop
    // or wall stands between, pull the camera in close instead of clipping
    const dirX = Math.sin(this.camYaw) * Math.cos(cp)
    const dirZ = Math.cos(this.camYaw) * Math.cos(cp)
    const dirY = Math.sin(cp)
    let d = dist
    const csteps = 10
    for (let i = 1; i <= csteps; i++) {
      const t = (dist * i) / csteps
      const sx = this.camTarget.x + dirX * t
      const sz = this.camTarget.z + dirZ * t
      const sy = this.camTarget.y + dirY * t
      const blocked =
        this.world.solidStruct(Math.round(sx), Math.round(sy - 0.4), Math.round(sz)) ||
        this.world.surfaceAt(sx, sz) + 0.45 > sy
      if (blocked) {
        d = Math.max(1.15, t - dist / csteps)
        break
      }
    }
    const cx = this.camTarget.x + dirX * d
    const cz = this.camTarget.z + dirZ * d
    let cy = this.camTarget.y + dirY * d
    // keep above ground
    const ground = this.world.surfaceAt(cx, cz) + 0.45
    if (cy < ground) cy = ground
    this.camPos.set(cx, cy, cz)
    this.engine.camera.position.lerp(this.camPos, Math.min(1, 11 * dt))
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt * 1.8)
      const s = this.shake * 0.25
      this.engine.camera.position.x += (Math.random() - 0.5) * s
      this.engine.camera.position.y += (Math.random() - 0.5) * s
    }
    this.engine.camera.lookAt(this.camTarget)
    // smooth hand-back — blend the director's last pose into the follow cam
    if (this.cineBlendT > 0) {
      this.cineBlendT = Math.max(0, this.cineBlendT - dt)
      const bk = 1 - this.cineBlendT / 0.7
      const be = bk * bk * (3 - 2 * bk)
      const bp2 = this.cineEndPos.clone().lerp(this.engine.camera.position, be)
      const btgt = this.cineEndLook.clone().lerp(this.camTarget, be)
      this.engine.camera.position.copy(bp2)
      this.engine.camera.lookAt(btgt)
    }
  }

  private updateReticle() {
    const lt = this.player.lockedTarget
    if (!lt || !lt.alive || this.phase !== 'playing') {
      this.reticle.style.display = 'none'
      return
    }
    const v = lt.pos.clone().add(new THREE.Vector3(0, lt.isBoss ? 3.6 : 1.7, 0))
    v.project(this.engine.camera)
    if (v.z > 1) {
      this.reticle.style.display = 'none'
      return
    }
    const w = this.container.clientWidth
    const h = this.container.clientHeight
    this.reticle.style.display = 'block'
    this.reticle.style.left = `${(v.x * 0.5 + 0.5) * w}px`
    this.reticle.style.top = `${(-v.y * 0.5 + 0.5) * h}px`
  }

  private emit(force: boolean) {
    if (!this.onState) return
    const p = this.player
    const ab = this.activeBoss
    const s: HudState = {
      phase: this.phase,
      hp: Math.max(0, Math.round(p.hp)),
      maxHp: p.maxHp,
      st: Math.round(p.stamina),
      maxSt: p.maxStamina,
      souls: Math.floor(p.souls),
      level: p.level,
      estus: p.estus,
      maxEstus: p.maxEstus,
      vit: p.vit,
      end: p.end,
      str: p.str,
      nextCost: this.nextCost(),
      bossName: ab ? ab.name : null,
      bossHp: ab ? Math.max(0, Math.round(ab.hp)) : 0,
      bossMax: ab ? ab.maxHp : 0,
      prompt: this.phase === 'playing' ? this.prompt : null,
      banner: this.phase === 'dead' ? 'died' : this.banner,
      blocking: p.state === 'block',
      pyro: p.pyro,
      maxPyro: p.maxPyro,
      pyroUnlocked: p.pyroUnlocked,
      shop:
        this.phase === 'shop'
          ? {
              souls: Math.floor(p.souls),
              estusLv: this.shopLv.estus,
              whetLv: this.shopLv.whet,
              coalLv: this.shopLv.coal,
              pyroUnlocked: this.pyroUnlocked,
              line: MERCHANT_LINES[Math.floor(this.time / 9) % MERCHANT_LINES.length],
              sellables: this.inv
                .filter((e) => ITEMS[e.id])
                .map((e) => ({
                  id: e.id,
                  name: ITEMS[e.id].name,
                  icon: ITEMS[e.id].icon,
                  n: e.n,
                  equipped: ALL_SLOTS.some((s) => this.eq[s] === e.id),
                  sell: sellValueOf(e.id),
                  tier: ITEMS[e.id].tier,
                })),
            }
          : null,
      smith: this.phase === 'smith' ? this.smithHud() : null,
      ending: this.phase === 'ending',
      ngPlus: this.ng,
      ended: this.ended,
      inv: this.phase === 'inventory' ? this.invHud() : null,
      lore:
        this.phase === 'lore' && this.loreOpenId
          ? (() => {
              const def = LORE_STONES.find((d) => d.id === this.loreOpenId)
              const st = this.loreStones.find((x) => x.id === this.loreOpenId)
              if (!def || !st) return null
              return { id: def.id, title: def.title, text: def.text, first: st.justRead ?? false }
            })()
          : null,
      loreCount: this.loreCount(),
      loreTotal: this.loreTotal,
      toast: this.toastMsg,
      arrows: this.countOf('arrow_fire') > 0 ? this.countOf('arrow_fire') : this.countOf('arrow_wood'),
      bowEquipped: this.player.loadout.aiming,
      aiming: this.player.state === 'aim' && this.player.aimRelease <= 0,
      draw: Math.min(1, this.player.aimT / 0.55),
      cine: this.cine
        ? { title: this.cine.title, sub: this.cine.sub, caption: this.cine.caption }
        : null,
      card: this.card,
    }
    const json = JSON.stringify(s)
    if (force || json !== this.lastHudJson) {
      this.lastHudJson = json
      this.onState(s)
    }
  }
}

/* small helper re-export for player strike definition */
export type { PlayerStrikeDef }
