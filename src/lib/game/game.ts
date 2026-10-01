import * as THREE from 'three'
import { Engine } from './engine'
import { World, BONFIRE, GATE_Z, BOSS_CENTER, WORLD_HALF, ASH_WALL_X, GATE2, BOSS2_CENTER, PYRO_ITEM, LAVA_POOLS, MERCHANT } from './world'
import { Player } from './player'
import { Enemy, BossEnemy, CreeperEnemy, SkeletonEnemy, WitherSkeletonEnemy, BlazeEnemy, BossFlameEnemy } from './enemy'
import { createSword, createShield, createMerchant, animMerchantIdle, animMerchantGreet, type Humanoid, createBow, setBowDraw, setNocked, applyPlayerArmor, setPlayerSword, setPlayerShield, setPlayerBow, createArmorDrop, createArrowBundle, type SwordStyle } from './models'
import { Sfx } from './sfx'
import type { PlayerStrikeDef } from './player'
import {
  ITEMS, ALL_SLOTS, SLOT_LABEL, equipLoad, maxLoadFor, rollTier, TIER_INFO, armorTotals,
  rollLoot, bossLoot, defaultEquip,
  type ItemId, type EquipSlot, type EquippedMap, type ItemDef, type DmgType, type LootRoll,
} from './items'

/* ================= HUD STATE ================= */

export type Phase = 'menu' | 'playing' | 'dead' | 'rest' | 'paused' | 'shop' | 'inventory'

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
  banner: 'died' | 'bossfell' | 'bossfell2' | null
  blocking: boolean
  pyro: number
  maxPyro: number
  pyroUnlocked: boolean
  /** shop snapshot — null unless the shop panel is open */
  shop: ShopHud | null
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
  ammo?: boolean
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

    // the great ash wall stops arrows outside the gate corridor
    if (Math.abs(this.pos.x - ASH_WALL_X) < 0.4 && !(this.pos.z > 15.9 && this.pos.z < 20.1)) {
      this.stuck = true
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
    if (this.t > 3.2 || Math.abs(this.pos.x) > 29 || Math.abs(this.pos.z) > 29) return false

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
   roll-dodgeable like arrows. Both burn out on the ground or the ash wall. */
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

    // the great ash wall burns them out outside the corridor
    if (Math.abs(this.pos.x - ASH_WALL_X) < 0.45 && !(this.pos.z > 15.9 && this.pos.z < 20.1)) {
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
   bobbing item with a Dark-Souls loot beam. Walk close and press F. */
class LootDrop {
  group = new THREE.Group()
  light: THREE.PointLight
  private t = Math.random() * 10
  private baseY: number
  private sparkT = 0

  constructor(
    private game: Game,
    public id: ItemId,
    public n: number,
    pos: THREE.Vector3,
    quiet = false
  ) {
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
      const b = createBow()
      b.rotation.z = 0.5
      inner.add(b)
    } else {
      const slot = def.slot as 'head' | 'chest' | 'hands' | 'legs' | 'cape'
      inner.add(createArmorDrop(slot, def.tint ?? 0x9a8b70, def.tint2))
    }
    inner.castShadow = true
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
  world: World
  player: Player
  sfx = new Sfx()
  enemies: Enemy[] = []
  boss: BossEnemy
  boss2: BossFlameEnemy
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
  private banner: 'died' | 'bossfell' | 'bossfell2' | null = null
  private prompt: string | null = null
  private fogPassT = 0
  private fogPass2T = 0
  private bossActive = false
  /** gate state — read by enemies so closed fog seals both sides */
  bossFell = false
  private boss2Active = false
  boss2Fell = false
  private lockLastMove = 0

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
  private pyroItem: { mesh: THREE.Group; light: THREE.PointLight } | null = null
  private emberItem: { mesh: THREE.Group; light: THREE.PointLight } | null = null
  private pyroUnlocked = false
  private emberTaken = false
  private castFailT = -9
  private tmpColor = new THREE.Color()

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

    // scene setup
    const scene = this.engine.scene
    scene.background = new THREE.Color(0x101720)
    scene.fog = new THREE.Fog(0x101720, 26, 78)

    const hemi = new THREE.HemisphereLight(0x38445c, 0x2a1c10, 0.75)
    scene.add(hemi)
    const sun = new THREE.DirectionalLight(0xffd9a0, 1.25)
    sun.position.set(28, 46, 18)
    sun.castShadow = true
    sun.shadow.mapSize.set(1024, 1024)
    sun.shadow.autoUpdate = false
    sun.shadow.needsUpdate = true
    this.sun = sun
    sun.shadow.camera.left = -42
    sun.shadow.camera.right = 42
    sun.shadow.camera.top = 42
    sun.shadow.camera.bottom = -42
    sun.shadow.camera.far = 130
    sun.shadow.bias = -0.0005
    scene.add(sun)

    this.world = new World()
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
    // stall pitched right in front of him — counter toward the bonfire
    const fwdX = Math.sin(mYaw)
    const fwdZ = Math.cos(mYaw)
    const stall = new THREE.Group()
    const lam = (c: number) => new THREE.MeshLambertMaterial({ color: c })
    const post = (x: number, z: number, hgt: number) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.18, hgt, 0.18), lam(0x5c4328))
      m.position.set(x, hgt / 2, z)
      m.castShadow = true
      return m
    }
    const awning = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.14, 1.5), lam(0x7a3f34))
    awning.position.set(0, 2.15, 0)
    awning.castShadow = true
    const awningTrim = new THREE.Mesh(new THREE.BoxGeometry(2.14, 0.1, 0.14), lam(0xc9a44a))
    awningTrim.position.set(0, 2.05, 0.7)
    const table = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.5, 0.8), lam(0x6e4f30))
    table.position.set(0, 0.42, 0.2)
    table.castShadow = true
    const crate = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.45, 0.45), lam(0x8a6a3c))
    crate.position.set(-0.5, 0.9, 0.2)
    crate.rotation.y = 0.4
    crate.castShadow = true
    const jar = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.3, 0.22), lam(0x9fd89f))
    jar.position.set(0.45, 0.82, 0.2)
    const lampGlass = new THREE.Mesh(
      new THREE.BoxGeometry(0.26, 0.34, 0.26),
      new THREE.MeshBasicMaterial({ color: 0xffcf6a })
    )
    lampGlass.position.set(0.55, 2.05, 0.55)
    const lampTop = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.1, 0.34), lam(0x3a2c1a))
    lampTop.position.set(0.55, 2.26, 0.55)
    stall.add(
      post(-0.9, 0.8, 2.1), post(0.9, 0.8, 2.1), post(-0.9, -0.5, 2.3), post(0.55, -0.5, 2.2),
      awning, awningTrim, table, crate, jar, lampGlass, lampTop
    )
    // wares: two barrels + a goods sack beside the counter
    const barrel = (x: number, z: number, s: number) => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.5 * s, 0.68 * s, 0.5 * s), lam(0x77522e))
      b.position.set(x, 0.34 * s, z)
      b.rotation.y = x * 1.7
      b.castShadow = true
      const band = new THREE.Mesh(new THREE.BoxGeometry(0.54 * s, 0.08, 0.54 * s), lam(0x3d3d3d))
      band.position.set(x, 0.34 * s, z)
      band.rotation.y = b.rotation.y
      stall.add(b, band)
    }
    barrel(-1.42, 0.05, 1)
    barrel(-1.38, -0.62, 0.8)
    const sack = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.34, 0.42), lam(0xb09858))
    sack.position.set(1.45, 0.17, -0.35)
    sack.rotation.y = 0.9
    sack.castShadow = true
    stall.add(sack)
    // a worn rug in front of the counter where customers stand
    const rug = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 0.05, 1.05),
      lam(0x8a3b30)
    )
    rug.position.set(0.1, 0.035, 1.45)
    rug.receiveShadow = true
    stall.add(rug)
    stall.position.set(MERCHANT.x + fwdX * 1.25, mY, MERCHANT.z + fwdZ * 1.25)
    stall.rotation.y = mYaw
    scene.add(stall)
    // lantern rides on the stall frame so it always tracks the counter
    this.merchantLamp = new THREE.PointLight(0xffb050, 1.6, 7, 1.7)
    this.merchantLamp.position.set(0.55, 2.1, 0.55)
    stall.add(this.merchantLamp)

    // player
    this.player = new Player(scene)
    const spawn = new THREE.Vector3(BONFIRE.x + 2.5, 0, BONFIRE.z + 2)
    spawn.y = this.world.surfaceAt(spawn.x, spawn.z)
    this.player.reset(spawn, Math.PI * 0.85)

    // enemies
    const spawnPts: [number, number][] = [
      [6, 8], [-7, 5], [4, -2], [-5, -7], [11, -3], [-12, -1],
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

    // creepers — fast, fuse up and explode; keep your distance or block!
    const creeperPts: [number, number][] = [
      [7, -6], [-14, -9], [9, 12],
    ]
    for (const [x, z] of creeperPts) {
      const p = new THREE.Vector3(x, 0, z)
      p.y = this.world.surfaceAt(x, z)
      const c = new CreeperEnemy(scene, p)
      c.world = this.world
      c.game = this
      this.enemies.push(c)
    }

    // skeleton archers — hold mid-range and pepper you with arrows;
    // rush them to force a panicky smack, or block/roll the volleys
    // (kept well away from the bonfire hub so the shop corner stays quiet)
    const skelPts: [number, number][] = [
      [16, 4], [-17, -4], [9, 3],
    ]
    for (const [x, z] of skelPts) {
      const p = new THREE.Vector3(x, 0, z)
      p.y = this.world.surfaceAt(x, z)
      const s = new SkeletonEnemy(scene, p)
      s.world = this.world
      s.game = this
      this.enemies.push(s)
    }

    // wither skeletons — the Ash Wastes guards; their heavy grey blades
    // chew through shields, so roll instead of block
    const witherPts: [number, number][] = [
      [16, 10], [16, 27], [27, 9],
    ]
    for (const [x, z] of witherPts) {
      const p = new THREE.Vector3(x, 0, z)
      p.y = this.world.surfaceAt(x, z)
      const w = new WitherSkeletonEnemy(scene, p)
      w.world = this.world
      w.game = this
      this.enemies.push(w)
    }

    // blazes — floating sentries spitting fireballs
    const blazePts: [number, number][] = [
      [20, 2], [13, 26],
    ]
    for (const [x, z] of blazePts) {
      const p = new THREE.Vector3(x, 0, z)
      p.y = this.world.surfaceAt(x, z)
      const b = new BlazeEnemy(scene, p)
      b.world = this.world
      b.game = this
      this.enemies.push(b)
    }

    // boss 1 — the ancient zombie knight beyond the north fog
    const bossSpawn = new THREE.Vector3(BOSS_CENTER.x, 0, BOSS_CENTER.z)
    bossSpawn.y = this.world.surfaceAt(BOSS_CENTER.x, BOSS_CENTER.z)
    this.boss = new BossEnemy(scene, bossSpawn)
    this.boss.world = this.world
    this.boss.game = this

    // boss 2 — the Flame King of the Ash Wastes, behind the east fog
    const boss2Spawn = new THREE.Vector3(BOSS2_CENTER.x, 0, BOSS2_CENTER.z)
    boss2Spawn.y = this.world.surfaceAt(BOSS2_CENTER.x, BOSS2_CENTER.z)
    this.boss2 = new BossFlameEnemy(scene, boss2Spawn)
    this.boss2.world = this.world
    this.boss2.game = this

    // the pyromancy flame, waiting in the wastes' entrance ruins
    this.buildPyroItem()

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
    return list
  }

  /** whichever lord is currently fighting — drives the HUD boss bar */
  private get activeBoss(): Enemy | null {
    if (this.bossActive && !this.bossFell) return this.boss
    if (this.boss2Active && !this.boss2Fell) return this.boss2
    return null
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
    this.bossActive = false
    this.boss2Active = false
    this.bossActiveBarrier = false
    this.boss2Barrier = false
    this.world.setFogGatesVisible(!this.bossFell, !this.boss2Fell)
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
    this.player.loadout = {
      weaponMult: rh?.dmg ? rh.dmg / 30 : 1,
      weaponSpd: rh?.spd ?? 1,
      block: lh?.block ?? 0,
      def: armor.def,
      fire: armor.fire,
      blast: armor.blast,
      walkMult: info.walk,
      sprintMult: info.sprint,
      rollMult: info.roll,
      rollCostMult: info.rollCost,
      canRoll: tier !== 'over',
      tier,
      load,
      maxLoad: max,
      aiming: lh?.cat === 'bow',
    }
    this.refreshEquipmentVisuals()
  }

  private refreshEquipmentVisuals() {
    const h = this.player.h
    // right-hand sword style follows the active blade
    const rhId = this.eq[this.rhActive === 1 ? 'rh1' : 'rh2']
    const rh = rhId ? ITEMS[rhId] : null
    setPlayerSword(h, (rh?.style ?? 'iron') as SwordStyle, rh?.scale ?? 1)
    h.sword!.visible = rh?.cat === 'sword'
    // left hand: shield OR bow, whichever is active
    const lhId = this.eq[this.lhActive === 1 ? 'lh1' : 'lh2']
    const lh = lhId ? ITEMS[lhId] : null
    if (lh?.cat === 'bow') {
      if (!this.playerBow) this.playerBow = createBow()
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
    // armor overlays + cape
    const piece = (s: 'head' | 'chest' | 'hands' | 'legs' | 'cape') => {
      const id = this.eq[s]
      const it = id ? ITEMS[id] : null
      return it && it.def !== undefined ? { tint: it.tint ?? 0x888888, tint2: it.tint2 } : null
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
    // must own it — in the bag, or already worn somewhere (move semantics)
    const worn = ALL_SLOTS.some((s) => this.eq[s] === id)
    if (this.countOf(id) <= 0 && !worn) return
    let slot: EquipSlot
    if (def.slot === 'rh') {
      slot = !this.eq.rh1 ? 'rh1' : !this.eq.rh2 ? 'rh2' : this.rhActive === 1 ? 'rh1' : 'rh2'
    } else if (def.slot === 'lh') {
      slot = !this.eq.lh1 ? 'lh1' : !this.eq.lh2 ? 'lh2' : this.lhActive === 1 ? 'lh1' : 'lh2'
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

  /** build the React-side snapshot of slots + bag */
  private invHud(): InvHud {
    const view = (id: ItemId | null | undefined, slot?: EquipSlot): InvItemView | null => {
      if (!id || !ITEMS[id]) return null
      const it = ITEMS[id]
      return {
        id: it.id, name: it.name, icon: it.icon, cat: it.cat,
        weight: it.weight, n: slot ? 1 : Math.max(1, this.countOf(id)),
        equipped: slot ? this.eq[slot] === id : ALL_SLOTS.some((s) => this.eq[s] === id),
        tier: it.tier, desc: it.desc, ammo: !!it.ammo,
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
    return {
      slots, rhActive: this.rhActive, lhActive: this.lhActive, bag,
      load: Math.round(load * 10) / 10, maxLoad: max,
      tier, tierColor: info.color, tierLabel: info.label,
      def: Math.round(armor.def * 100), fire: Math.round(armor.fire * 100), blast: Math.round(armor.blast * 100),
      souls: Math.floor(this.player.souls),
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
    // the grey merchant
    if (Math.hypot(this.player.pos.x - MERCHANT.x, this.player.pos.z - MERCHANT.z) < 2.7) {
      this.openShop()
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
    // fog gate 1 — the zombie knight
    if (!this.bossActive && !this.bossFell && this.player.pos.z < GATE_Z + 3.2 && this.player.pos.z > GATE_Z - 1) {
      this.fogPassT = 0.75
      this.sfx.bossRoar()
      return
    }
    // fog gate 2 — the Flame King
    if (!this.boss2Active && !this.boss2Fell &&
      this.player.pos.x > GATE2.x - 2.4 && this.player.pos.x < GATE2.x + 2.0 &&
      this.player.pos.z > 16.2 && this.player.pos.z < 19.8
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
      }
      localStorage.setItem(SAVE_KEY, JSON.stringify(data))
    } catch { /* ignore */ }
  }

  private loadSave() {
    try {
      const raw = localStorage.getItem(SAVE_KEY)
      if (!raw) return
      const d = JSON.parse(raw) as SaveData
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
      this.refreshLoadout()
    } catch { /* ignore */ }
  }

  private playerStrike(def: PlayerStrikeDef) {
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
    // soul orb flies to player
    const orb = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.28, 0.28),
      new THREE.MeshBasicMaterial({ color: 0x59ff6a })
    )
    orb.position.copy(e.pos).add(new THREE.Vector3(0, 1.2, 0))
    this.engine.scene.add(orb)
    this.orbs.push({ mesh: orb, t: 0, amount: e.soulsValue(), from: orb.position.clone() })
    // their gear may hit the ground — a little inheritance from the dead
    // (lords skip the common table — their signature rig is guaranteed)
    const drops = e.isBoss ? [] : rollLoot(e.lootKind)
    if (drops.length > 0) this.spawnLoot(drops, e.pos)
    if (e === this.boss) this.onBossKilled()
    else if (e === this.boss2) this.onBoss2Killed()
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
    this.save()
  }

  /** the Flame King falls — the Great Ember is his legacy */
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
    this.save()
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

    // pre-render the blocky terrain once (1px per block)
    const t = document.createElement('canvas')
    t.width = t.height = 60
    const tc = t.getContext('2d')!
    for (let z = -WORLD_HALF; z < WORLD_HALF; z++) {
      for (let x = -WORLD_HALF; x < WORLD_HALF; x++) {
        const h = this.world.getH(x, z)
        const dA = Math.hypot(x - BOSS_CENTER.x, z - BOSS_CENTER.z)
        const dA2 = Math.hypot(x - BOSS2_CENTER.x, z - BOSS2_CENTER.z)
        const isPath = Math.abs(x) <= 1 && z > GATE_Z && z < BONFIRE.z + 1
        const isPath2 = z >= 17 && z <= 19 && x >= ASH_WALL_X
        const lavaCell = LAVA_POOLS.some((p) => x >= p.x0 && x <= p.x1 && z >= p.z0 && z <= p.z1)
        if (x === ASH_WALL_X) tc.fillStyle = '#4a4a4a'
        else if (lavaCell) tc.fillStyle = '#ff7a1f'
        else if (dA < 8.5 || dA2 < 8.5) tc.fillStyle = '#828282'
        else if (isPath) tc.fillStyle = '#8a6440'
        else if (isPath2) tc.fillStyle = '#7a6a5a'
        else if (x >= ASH_WALL_X) tc.fillStyle = `rgb(${86 + h * 5},${40 + h * 3},${34 + h * 2})`
        else tc.fillStyle = `rgb(${52 + h * 7},${98 + h * 13},${36 + h * 5})`
        tc.fillRect(x + WORLD_HALF, z + WORLD_HALF, 1, 1)
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
    const S = 132 / (WORLD_HALF * 2)
    const px = (x: number) => (x + WORLD_HALF) * S
    const pz = (z: number) => (z + WORLD_HALF) * S

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
    this.bossActive = false
    this.bossActiveBarrier = false
    this.boss2Active = false
    this.boss2Barrier = false
    for (const o of this.orbs) this.engine.scene.remove(o.mesh)
    this.orbs = []
    this.fogPassT = 0
    this.fogPass2T = 0
    // death released the pointer lock — never read that as "player pressed ESC"
    this.wasLocked = false
    this.phase = 'playing'
    this.banner = null
    this.hurtFlash = 0
    this.emit(true)
  }

  private clampPlayer() {
    const p = this.player.pos
    const lim = 28.4
    p.x = Math.max(-lim, Math.min(lim, p.x))
    p.z = Math.max(-lim, Math.min(lim, p.z))
    // fog gate 1 blocks entry before trigger — the WHOLE north side is
    // sealed, no slipping around the mist's soft edges
    if (!this.bossActive && !this.bossFell && this.fogPassT <= 0 && !this.player.busy) {
      if (p.z < GATE_Z + 0.55) p.z = GATE_Z + 0.55
    }
    // fog gate 2 corridor blocks entry before trigger
    if (!this.boss2Active && !this.boss2Fell && this.fogPass2T <= 0 && !this.player.busy) {
      if (p.x > GATE2.x + 0.9) p.x = GATE2.x + 0.9
    }
    // the great ash wall is solid — only the gate corridor pierces it
    if (Math.abs(p.x - ASH_WALL_X) < 0.55 && !(p.z > 16.1 && p.z < 19.9)) {
      p.x = p.x < ASH_WALL_X ? ASH_WALL_X - 0.55 : ASH_WALL_X + 0.55
    }
    // arena barriers while fighting — held just short of the fog so the
    // player can never stand inside the mist
    if (this.bossActiveBarrier && !this.bossFell) {
      p.x = Math.max(BOSS_CENTER.x - 7.6, Math.min(BOSS_CENTER.x + 7.6, p.x))
      p.z = Math.max(-23.2, Math.min(GATE_Z - 0.8, p.z))
    }
    if (this.boss2Barrier && !this.boss2Fell) {
      p.x = Math.max(BOSS2_CENTER.x - 7.2, Math.min(BOSS2_CENTER.x + 7.2, p.x))
      p.z = Math.max(BOSS2_CENTER.z - 7.2, Math.min(BOSS2_CENTER.z + 7.2, p.z))
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
    if (!this.bossActive && !this.bossFell && this.player.pos.z < GATE_Z + 3.2 && this.player.pos.z > GATE_Z - 1) {
      return 'عبور از دیوار مه'
    }
    if (
      !this.boss2Active && !this.boss2Fell &&
      this.player.pos.x > GATE2.x - 2.4 && this.player.pos.x < GATE2.x + 2.0 &&
      this.player.pos.z > 16.2 && this.player.pos.z < 19.8
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

    if (this.phase === 'inventory') {
      // Escape / I / Tab closes the satchel
      if (input.consume('Escape') || input.consume('KeyI') || input.consume('Tab')) {
        this.closeInventory()
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
        this.bossActive = true
        this.bossActiveBarrier = true
        this.boss.active = true
        this.sfx.bossRoar()
        this.shake = Math.max(this.shake, 0.4)
      }
    }

    // fog pass 2 animation — east gate into the Flame King's arena
    if (this.fogPass2T > 0) {
      this.fogPass2T -= dt
      this.player.pos.x += 5.5 * dt
      let dY2 = -Math.PI / 2 - this.camYaw
      while (dY2 > Math.PI) dY2 -= Math.PI * 2
      while (dY2 < -Math.PI) dY2 += Math.PI * 2
      this.camYaw += dY2 * Math.min(1, 5 * dt)
      this.camPitch += (0.32 - this.camPitch) * Math.min(1, 4 * dt)
      if (this.fogPass2T <= 0) {
        this.boss2Active = true
        this.boss2Barrier = true
        this.boss2.active = true
        this.sfx.bossRoar()
        this.shake = Math.max(this.shake, 0.4)
      }
    }

    // ash-wastes ambience — the sky reddens east of the great wall
    const inAsh = this.player.pos.x > ASH_WALL_X - 0.6
    const fog = this.engine.scene.fog as THREE.Fog
    const bg = this.engine.scene.background as THREE.Color
    fog.color.lerp(this.tmpColor.set(inAsh ? 0x261016 : 0x101720), Math.min(1, 2.5 * dt))
    bg.lerp(this.tmpColor.set(inAsh ? 0x1c0c10 : 0x101720), Math.min(1, 2.5 * dt))

    // lava burns whoever stands in it
    this.lavaTick -= dt
    if (this.lavaTick <= 0 && this.player.alive && this.fogPassT <= 0 && this.fogPass2T <= 0) {
      const px = Math.round(this.player.pos.x)
      const pz = Math.round(this.player.pos.z)
      let inLava = LAVA_POOLS.some((p) => px >= p.x0 && px <= p.x1 && pz >= p.z0 && pz <= p.z1)
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

    this.world.update(dt)
    this.updateBonfire(dt)
    this.updateLoot(dt)
    this.updateEffects(dt)
    this.updateOrbs(dt)

    // prompt
    this.prompt = this.fogPassT > 0 || this.fogPass2T > 0 ? null : this.detectPrompt()
    if (this.prompt && input.isTouch && input.consume('TouchInteract')) this.interact()

    // banner timer
    if (this.banner) {
      this.bannerT += rawDt
      if ((this.banner === 'bossfell' || this.banner === 'bossfell2') && this.bannerT > 3.6) {
        this.banner = null
        this.emit(true)
      }
    }

    // hurt vignette decay
    this.hurtFlash = Math.max(0, this.hurtFlash - rawDt * 1.6)
    const lowHp = this.player.hp / this.player.maxHp < 0.25 && this.player.alive
    const vig = Math.max(this.hurtFlash, lowHp ? 0.22 + Math.sin(this.time * 5) * 0.08 : 0)
    this.vignette.style.opacity = String(vig)

    this.updateMerchant(dt)
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

  /** loot drops bob & spin; the toast countdown rides the same clock */
  private updateLoot(dt: number) {
    for (const l of this.loots) l.update(dt)
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
    let cx = this.camTarget.x + Math.sin(this.camYaw) * Math.cos(cp) * dist
    let cz = this.camTarget.z + Math.cos(this.camYaw) * Math.cos(cp) * dist
    let cy = this.camTarget.y + Math.sin(cp) * dist
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
            }
          : null,
      inv: this.phase === 'inventory' ? this.invHud() : null,
      toast: this.toastMsg,
      arrows: this.countOf('arrow_fire') > 0 ? this.countOf('arrow_fire') : this.countOf('arrow_wood'),
      bowEquipped: this.player.loadout.aiming,
      aiming: this.player.state === 'aim' && this.player.aimRelease <= 0,
      draw: Math.min(1, this.player.aimT / 0.55),
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
