import * as THREE from 'three'
import { blockMaterials, mulberry32, createFogMaterial } from './textures'

/* ==================================================================
   WORLD V2 — the map, rebuilt the Dark Souls way.
   Not a scatter of props: a designed, interconnected vertical world.
   Every district is a set piece; every landmark is visible from the
   last one; every road loops back through a shortcut.

   ┌────────────────────────────────────────────────────────────┐
   │  PARISH HILL (NW)            boss bridge ruin   WATCHTOWER │
   │  ╔church + bell tower╗  ┌──░░░░░░░░┐            ▲          │
   │  ╚══╦═ graveyard ═════╝  │ boss plaza│       TOWN          │
   │     ║ steps              └──┬───────┘   (Undead Burg,       │
   │     ║                    fog gate    two ascending streets) │
   │  RAVINE ▓▓▓            gatehouse ── AQUEDUCT ──┐            │
   │  ▓water + broken bridge▓                       │            │
   │   └── shortcut stairs ──┐                      │            │
   │                         ▼  EMBER SHRINE (hub)  │            │
   │                    ╔═══ bonfire + temple ═══╗  │            │
   │                    ╚═══════════╦════════════╝  │            │
   │      (west cliff)              └── stairs ── ASH WASTES      │
   │                                   cinder fortress → CALDERA  │
   │                                   (island in a lava lake)    │
   └────────────────────────────────────────────────────────────┘
   ================================================================== */

export const V2_HALF = 60 // blocks range -60..59

export const V2_BONFIRE = { x: 0, z: 34 }
export const V2_MERCHANT = { x: -3.5, z: 38.5 }
export const V2_SPAWN = { x: 2.5, z: 37.5 }
export const V2_BOSS1_CENTER = { x: 0, z: -24.5 }
export const V2_BOSS1_GATE_Z = -21
export const V2_BOSS2_CENTER = { x: 40, z: -8 }
export const V2_WASTES_GATE = { x: 24, z: 26 }

/* ---- surface codes (what the top block is made of) ---- */
const S_GRASS = 0
const S_DIRT = 1
const S_COBBLE = 2
const S_BRICK = 3
const S_MOSSY = 4
const S_NETHER = 5
const S_LAVA = 6
const S_WATER = 7
const S_STONE = 8

interface Vec3Lite { x: number; y: number; z: number }

/* ---- the carve list: hand-laid roads & stairs (x0,z0 → x1,z1, halfWidth, h0→h1) ---- */
const RAMPS: { x0: number; z0: number; x1: number; z1: number; w: number; h0: number; h1: number }[] = [
  // hub → ash wastes (east stairs down the cliff)
  { x0: 11, z0: 33, x1: 16, z1: 31, w: 2.6, h0: 12, h1: 8 },
  { x0: 16, z0: 31, x1: 24, z1: 29, w: 2.6, h0: 8, h1: 6 },
  // ash wastes road north to the caldera
  { x0: 24, z0: 29, x1: 33, z1: 20, w: 3, h0: 6, h1: 6 },
  { x0: 33, z0: 20, x1: 38, z1: 6, w: 3, h0: 6, h1: 6 },
  { x0: 38, z0: 6, x1: 40, z1: 4, w: 2.8, h0: 6, h1: 6 },
  // boss plaza → parish hill (west steps)
  { x0: -9, z0: -24, x1: -17, z1: -27, w: 3, h0: 24, h1: 22 },
  // ravine shortcut stairs → town alley (the loop home)
  { x0: -14, z0: -1, x1: -10, z1: -1, w: 2.6, h0: 2, h1: 8 },
  { x0: -10, z0: -1, x1: -10, z1: -6, w: 2.6, h0: 8, h1: 17 },
  { x0: -10, z0: -6, x1: -8, z1: -6, w: 2.6, h0: 17, h1: 19 },
  // ravine south stairs → hub base
  { x0: -16, z0: 13, x1: -13, z1: 18, w: 2.6, h0: 2, h1: 7 },
  { x0: -13, z0: 18, x1: -7, z1: 23, w: 2.6, h0: 7, h1: 12 },
  { x0: -7, z0: 23, x1: -3, z1: 27, w: 2.6, h0: 12, h1: 12 },
]

/** the town climbs: z=8 → h16 … z=-22 → h24 (one block per ~3.75) */
function townFloor(z: number) {
  return Math.min(24, Math.max(16, 16 + Math.round(((8 - z) * 8) / 30)))
}

export interface RegionCamV2 { x: number; z: number; y: number; dist: number; theta: number; phi: number }
export interface RegionV2 {
  id: string
  name: string
  sub: string
  dot: string
  desc: string
  design: string
  cam: RegionCamV2
}

export const REGIONS_V2: RegionV2[] = [
  {
    id: 'overview',
    name: 'نمای کل جهان',
    sub: 'همه‌ی مناطق از بالا — به برج ناقوس نگاه کن',
    dot: '#9db2cc',
    desc: 'دنیا دیگر پراکنده نیست: از آتشگاه، آبراه بالا می‌رود به برج‌شهر؛ بالای شهر، پلازای باس روی لبه‌ی پرتگاه است؛ پلِ ویران به سوی کلیسا می‌رود که برج ناقوسش از هر نقطه‌ی نقشه پیدا است؛ شرق، خاکسترگاه و کوره‌ی پادشاه شعله است؛ و درهٔ ویران با پلِ شکسته‌اش پایین همه‌چیز خوابیده — پله‌های میان‌بُرش دوباره تو را به شهر می‌رسانند.',
    design: 'اصل دارک سولز: جهان حلقه‌ای است — هر مسیر بالاخره به جایی که از آن آمدی برمی‌گردد.',
    cam: { x: -2, z: 0, y: 14, dist: 112, theta: 0.45, phi: 0.98 },
  },
  {
    id: 'shrine',
    name: 'آتشگاه — معبد اخگر',
    sub: 'هاب بازی، به سبک Firelink Shrine',
    dot: '#ffb347',
    desc: 'صفحه‌ی بلند معبد بر لبه‌ی پرتگاه نشسته: ستون‌های شکسته دور آتش کمپ چرخیده‌اند، دو مجسمه‌ی تعظیم‌کننده راه شمال را نشان می‌دهند و شبیه‌خانه‌ی نیم‌فروریخته هنوز پنجره‌اش روشن است. بازرگان چادرش را آن‌جا زده — تنها موجودی که هنوز منتظر چیزی است.',
    design: 'مثل Firelink: هاب مرتفع است و بازیکن از این‌جا «کل جهانِ پایین» را می‌بیند — آبراه، دره و دودِ خاکسترگاه.',
    cam: { x: 0, z: 34, y: 15, dist: 30, theta: 0.15, phi: 0.72 },
  },
  {
    id: 'aqueduct',
    name: 'آبراه بزرگ',
    sub: 'راهِ آغاز سفر — بالای دره',
    dot: '#c8c4b8',
    desc: 'تاق‌های سنگی آبراه از شبیه‌خانه جدا می‌شوند و با چندین بلوک ارتفاع روی دره‌ی خشک به دروازه‌ی شهر می‌رسند. زیر یکی از تاق‌ها آثار یک اردوگاه قدیمی مانده: آتشِ سرد، چرخِ گاری، و هیچ‌کس.',
    design: 'مثل آکواداکتِ شروع دارک سولز: بازیکن روی پلِ باریک بالا می‌رود و هم‌زمان عمق دنیا را زیر پایش می‌بیند.',
    cam: { x: 0, z: 15, y: 16, dist: 27, theta: 0.08, phi: 0.6 },
  },
  {
    id: 'town',
    name: 'برج‌شهر مردگان',
    sub: 'شهر عمودی، به سبک Undead Burg',
    dot: '#96945a',
    desc: 'شهر روی شیب ساخته شده: خیابان اصلی و کوچه‌ی پشتی هر دو بالا می‌روند و پلکانی به هم وصل‌اند. یازده خانه با سقف شیروانی واقعی، بالکن، دودکش و پنجره‌های روشن؛ چاه، گاری واژگون، بشکه‌ها و قفس‌های آویزان از دروازه. برجِ دیدبانیِ مارپیچ وسط شهر، نگین محله است.',
    design: 'مثل Undead Burg: ارتفاع = هویت. هر خانه خط آسمان را می‌شکند و کوچه‌ها برای کمین تنگ شده‌اند.',
    cam: { x: 1, z: -9, y: 21, dist: 34, theta: 0.12, phi: 0.55 },
  },
  {
    id: 'boss1',
    name: 'پلازای شوالیه + پل ویران',
    sub: 'آرنای باس اول — روی لبه‌ی جهان',
    dot: '#d43737',
    desc: 'بالای شهر، دروازه‌ی مه باز می‌شود به میدانی سنگی که سه طرفش پرتگاه است. شوالیه‌ی کهن همین‌جا می‌ایستد. پلِ عظیم از پلازا به سوی کلیسا ادامه دارد اما نیمه‌راه فرو ریخته — تاق‌هایش هنوز روی هیچ، تا ته دره پایین رفته‌اند.',
    design: 'مثل پل گارگویل‌ها: آرنا = لحظه‌ی اوجِ نما. جنگ روی لبه‌ی پرتگاه، با پل شکسته به‌عنوان روایتِ بی‌کلام («راه کلیسا همین بود»).',
    cam: { x: 0, z: -30, y: 26, dist: 27, theta: 0.3, phi: 0.52 },
  },
  {
    id: 'parish',
    name: 'کلیسای ناقوس + گورستان',
    sub: 'لندمارک اصلی — به سبک Undead Parish',
    dot: '#ece8dc',
    desc: 'روی تپه‌ی شمال‌غرب، کلیسای سیاه با پنجره‌های ماه‌گرفته و پنجره‌ی گل‌سرخ ایستاده؛ برج ناقوسش ۱۶ بلوک از تپه بلندتر است و زنگ طلایش از آتشگاه هم پیدا است. دور کلیسا گورستان است: قبرها، مجسمه‌ی عزادار و یک سردابِ باز.',
    design: 'برج ناقوس = لنگرِ دیداری نقشه؛ مثل دارک سولز، بازیکن همیشه می‌داند «باید به آن‌جا برسم».',
    cam: { x: -30, z: -30, y: 28, dist: 42, theta: 0.9, phi: 0.58 },
  },
  {
    id: 'ravine',
    name: 'درهٔ ویران',
    sub: 'پایینِ همه‌چیز — پل شکسته و آبِ ساکت',
    dot: '#4a7694',
    desc: 'گودالِ آبی که همه‌ی راه‌ها از کنارش رد می‌شوند و هیچ‌کس پایین نمی‌رود. تاق‌های پلِ قدیمی وسط آب مانده، سرِ مجسمه‌ای افتاده و خزه گرفته. پله‌های میان‌بُر از دیواره بالا می‌روند: یکی به کوچه‌ی شهر، یکی به پای آتشگاه.',
    design: 'مثل Valley of Drakes: عمقِ جهان + حلقه‌ی میان‌بُر. افتادنِ پل = روایتِ بی‌کلام («زمانی این‌جا شاهراه بود»).',
    cam: { x: -18, z: 2, y: 8, dist: 34, theta: 0.55, phi: 0.95 },
  },
  {
    id: 'wastes',
    name: 'خاکسترگاه',
    sub: 'سرزمین سوخته و دژِ ویران',
    dot: '#ff6a1f',
    desc: 'شرق، زمین سوخته و نفس می‌کشد: گودال‌های گدازه، دودکش‌های فرو ریخته و دژی که پادشاه شعله جا گذاشت. دروازه‌ی سوخته‌ی جنوب، راهِ پله‌های آتشگاه را می‌بندد و جاده‌ای سنگی به سوی شمال و دریاچه‌ی آتش می‌رود.',
    design: 'مثل Sen\'s Fortress: گذرِ تنگِ خطرناک قبل از باس دوم — با دیوارهای دندانه‌دار و ویرانیِ عمدی.',
    cam: { x: 34, z: 12, y: 10, dist: 42, theta: -0.55, phi: 0.68 },
  },
  {
    id: 'caldera',
    name: 'کورهٔ پادشاه شعله',
    sub: 'آرنای باس دوم — جزیره در دریاچهٔ گدازه',
    dot: '#ffd23d',
    desc: 'دریاچه‌ی گدازه یک جزیره‌ی سنگی را دور زده: دیوارِ بلند، هشت کوزه‌ی آتش، و پلی که از جنوب می‌آید و در شکاف دیوار تمام می‌شود. پادشاه شعله وسط این کوره می‌جنگد — این‌جا سقوط وجود ندارد؛ دور تا دور، سقوط یعنی گدازه.',
    design: 'آرنا = شخصیتِ باس: آتشِ محصور در سنگ. مثل آرنای اورنشتاین و اسماف، فضا خودش داستان را می‌گوید.',
    cam: { x: 40, z: -8, y: 12, dist: 38, theta: 0.25, phi: 0.68 },
  },
]

/* ================================================================== */

export class WorldV2 {
  group = new THREE.Group()
  mats = blockMaterials()
  private heights = new Int8Array(V2_HALF * 2 * V2_HALF * 2)
  private surf = new Uint8Array(V2_HALF * 2 * V2_HALF * 2)
  private clouds: { mesh: THREE.Mesh; speed: number }[] = []
  private rng = mulberry32(2077)
  private fogLayers: { mesh: THREE.Mesh; gate: 1 | 2; t: number }[] = []
  private L: Record<string, Vec3Lite[]> = {}

  constructor() {
    this.genHeightmap()
    this.buildTerrain()
    this.buildHubShrine()
    this.buildAqueduct()
    this.buildTownGate()
    this.buildTown()
    this.buildWatchtower()
    this.buildTopPlaza()
    this.buildBossBridge()
    this.buildParish()
    this.buildGraveyard()
    this.buildRavine()
    this.buildAshWastes()
    this.buildCaldera()
    this.buildFogGates()
    this.buildSky()
  }

  /* ================= heightmap ================= */

  private idx(x: number, z: number) {
    const bx = Math.min(V2_HALF * 2 - 1, Math.max(0, x + V2_HALF))
    const bz = Math.min(V2_HALF * 2 - 1, Math.max(0, z + V2_HALF))
    return bz * V2_HALF * 2 + bx
  }

  getH(x: number, z: number): number {
    return this.heights[this.idx(Math.round(x), Math.round(z))]
  }

  /** surface material code at a column (QA/probe) */
  surfAt(x: number, z: number): number {
    return this.surf[this.idx(Math.round(x), Math.round(z))]
  }

  /** walking surface y (top face of the top block) */
  surfaceAt(x: number, z: number): number {
    return this.getH(x, z) + 1
  }

  private genHeightmap() {
    const r = mulberry32(777)
    const o1 = r() * 10, o2 = r() * 10, o3 = r() * 10

    for (let z = -V2_HALF; z < V2_HALF; z++) {
      for (let x = -V2_HALF; x < V2_HALF; x++) {
        // rolling meadow base
        let h =
          3 +
          Math.sin(x * 0.09 + o1) * Math.cos(z * 0.08 + o2) * 1.6 +
          Math.sin(x * 0.21 + o2) * Math.sin(z * 0.17 + o3) * 0.9 +
          Math.sin((x + z) * 0.05 + o1) * 0.9
        h = Math.round(h)

        /* ---- the dry gorge the aqueduct crosses ---- */
        if (z >= 8 && z <= 25 && x >= -5 && x <= 5) h = 4

        /* ---- EMBER SHRINE plateau (elevated hub) ---- */
        h = this.plateEllipse(h, x, z, 0, 34, 13, 11, 12, 3.2)

        /* ---- TOWN: the ascending band ---- */
        if (z >= -22 && z <= 8) {
          const d = Math.max(-12 - x, x - 14, 0)
          if (d <= 0) h = townFloor(z)
          else if (d < 3) h = Math.round(lerp(townFloor(z), h, smoothstep(0, 3, d)))
        }

        /* ---- gate square before the town gate (skip the aqueduct lane) ---- */
        if (x >= -2 && x <= 7 && z >= 9 && z <= 10 && !(x >= -1 && x <= 1)) {
          h = 16
        }

        /* ---- BOSS PLAZA apron ---- */
        h = this.plateRect(h, x, z, -8, 8, -27, -22, 24, 2.6)

        /* ---- PARISH HILL ---- */
        h = this.plateEllipse(h, x, z, -30, -30, 14, 14, 22, 3.5)

        /* ---- ASH WASTES ---- */
        if (x >= 21) {
          const burn = 5 + Math.round(Math.sin(x * 0.31 + o2) * Math.cos(z * 0.23 + o3) * 1.2)
          h = Math.round(lerp(burn, h, smoothstep(19, 23, x)))
        }

        /* ---- CALDERA: island in a lava lake ---- */
        const ed2 = Math.hypot(x - 40, z + 8)
        if (ed2 <= 7.2) h = 8 // arena floor
        else if (ed2 <= 9.2) h = 12 // the wall ring
        else if (ed2 <= 14) h = 6 // lava basin
        else if (ed2 <= 15.5) h = 8 // outer rim ridge
        /* wall breach where the bridge lands (south) */
        if (ed2 <= 9.2 && ed2 > 7.2 && x >= 39 && x <= 41 && z >= -2 && z <= 1) h = 8

        /* ---- RAVINE (the drowned low road) ---- */
        h = this.plateRect(h, x, z, -30, -10, -14, 14, 2, 2.6)

        /* ---- carved roads & stairs (last: they cut through everything) ---- */
        for (const rp of RAMPS) {
          const dx = rp.x1 - rp.x0
          const dz = rp.z1 - rp.z0
          const len2 = dx * dx + dz * dz
          let t = ((x - rp.x0) * dx + (z - rp.z0) * dz) / len2
          t = Math.max(0, Math.min(1, t))
          const px = rp.x0 + dx * t
          const pz = rp.z0 + dz * t
          const d = Math.hypot(x - px, z - pz)
          if (d <= rp.w) {
            h = Math.round(lerp(rp.h0, rp.h1, t))
          } else if (d < rp.w + 1.6) {
            const target = lerp(rp.h0, rp.h1, t)
            h = Math.round(lerp(target, h, smoothstep(rp.w, rp.w + 1.6, d)))
          }
        }

        /* ---- world rim: low ridges so the edge never shows the void ---- */
        const edge = Math.min(x + V2_HALF, V2_HALF - 1 - x, z + V2_HALF, V2_HALF - 1 - z)
        if (edge < 3) h = Math.max(h, 7 - edge)

        this.heights[this.idx(x, z)] = Math.max(0, Math.min(36, h))
      }
    }

    /* ---- surface codes ---- */
    for (let z = -V2_HALF; z < V2_HALF; z++) {
      for (let x = -V2_HALF; x < V2_HALF; x++) {
        const h = this.heights[this.idx(x, z)]
        let s = S_GRASS
        const dBon = Math.hypot(x - V2_BONFIRE.x, z - V2_BONFIRE.z)
        const dPar = Math.hypot(x + 30, z + 30)
        const dCal = Math.hypot(x - 40, z + 8)
        const inTown = z >= -22 && z <= 10 && x >= -12 && x <= 14
        const inPlaza = x >= -8 && x <= 8 && z >= -27 && z <= -22
        const onRamp = RAMPS.some((rp) => {
          const dx = rp.x1 - rp.x0, dz = rp.z1 - rp.z0
          const len2 = dx * dx + dz * dz
          let t = ((x - rp.x0) * dx + (z - rp.z0) * dz) / len2
          t = Math.max(0, Math.min(1, t))
          const d = Math.hypot(x - (rp.x0 + dx * t), z - (rp.z0 + dz * t))
          return d <= rp.w + 0.6
        })
        const inRavine = x >= -30 && x <= -10 && z >= -14 && z <= 14
        const inWastes = x >= 23

        if (dCal <= 7.4) s = S_BRICK // caldera floor
        else if (dCal <= 14 && h === 6) s = S_LAVA // lava lake
        else if (inWastes) s = onRamp ? S_STONE : S_NETHER
        else if (inRavine) {
          s = x >= -22 && x <= -17 && z >= -12 && z <= 12 && h <= 2 ? S_WATER : S_STONE
        } else if (inPlaza || (z >= 9 && z <= 25 && x >= -5 && x <= 5)) s = S_BRICK // plaza + gorge tiles
        else if (dBon < 11) s = (x * 7 + z * 5) % 11 === 0 ? S_MOSSY : S_BRICK // shrine cracked tiles
        else if (dPar < 9) s = S_BRICK // church plaza
        else if (dPar < 14) s = S_MOSSY // hill slope
        else if (inTown) {
          const mainStreet = x >= 1 && x <= 5
          const alley = x >= -8 && x <= -5 && z >= -14 && z <= 2
          const crossLane = z >= -2 && z <= 0 && x >= -8 && x <= 5
          const gateSq = z >= 5 && z <= 10 && x >= -2 && x <= 7
          s = mainStreet || alley || crossLane || gateSq ? S_COBBLE : S_GRASS
        } else if (onRamp) s = S_DIRT
        this.surf[this.idx(x, z)] = s
      }
    }
    /* waste lava pools sit as sunken cells */
    for (const p of [[26, 10, 28, 12], [46, 14, 48, 15]] as const) {
      for (let x = p[0]; x <= p[2]; x++)
        for (let z = p[1]; z <= p[3]; z++) {
          this.heights[this.idx(x, z)] = 5
          this.surf[this.idx(x, z)] = S_LAVA
        }
    }
  }

  /** rectangular district: `target` inside, feathered skirt outside */
  private plateRect(
    h: number, x: number, z: number,
    x0: number, x1: number, z0: number, z1: number,
    target: number, feather: number
  ): number {
    const dx = Math.max(x0 - x, x - x1, 0)
    const dz = Math.max(z0 - z, z - z1, 0)
    const d = Math.hypot(dx, dz)
    if (d <= 0) return target
    if (d >= feather) return h
    return lerp(target, h, smoothstep(0, feather, d))
  }

  /** elliptical district (the hub plateau, the parish hill) */
  private plateEllipse(
    h: number, x: number, z: number,
    cx: number, cz: number, rx: number, rz: number,
    target: number, feather: number
  ): number {
    const ed = Math.hypot((x - cx) / rx, (z - cz) / rz)
    const f = feather / Math.min(rx, rz)
    if (ed <= 1) return target
    if (ed >= 1 + f) return h
    return lerp(target, h, smoothstep(1, 1 + f, ed))
  }

  /* ================= terrain ================= */

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

  private chunkKey(x: number, z: number) {
    const cs = 16
    return `${Math.floor(x / cs)}_${Math.floor(z / cs)}`
  }

  private buildTerrain() {
    const exposed = (x: number, z: number, y: number) => {
      const n: [number, number][] = [[x + 1, z], [x - 1, z], [x, z + 1], [x, z - 1]]
      for (const [nx, nz] of n) {
        if (nx < -V2_HALF || nx >= V2_HALF || nz < -V2_HALF || nz >= V2_HALF) return true
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
    const surfMat = ['grass', 'dirt', 'cobble', 'stonebrick', 'mossy', 'nether', 'lava', 'water', 'stone']
    for (let z = -V2_HALF; z < V2_HALF; z++) {
      for (let x = -V2_HALF; x < V2_HALF; x++) {
        const h = this.heights[this.idx(x, z)]
        const s = this.surf[this.idx(x, z)]
        put2(x, h + 0.5, z, surfMat[s])
        if (s === S_WATER || s === S_LAVA) put2(x, h - 0.5, z, 'stone') // bed under fluids
        if (h - 1 >= 0 && exposed(x, z, h - 1))
          put2(x, h - 0.5, z, s === S_BRICK ? 'stonebrick' : h >= 8 ? 'stone' : 'dirt')
        if (h - 2 >= 0 && exposed(x, z, h - 2)) put2(x, h - 1.5, z, h >= 8 ? 'stone' : 'dirt')
        if (h - 3 >= 0 && exposed(x, z, h - 3)) put2(x, h - 2.5, z, 'stone')
      }
    }
    for (const mats of batch.values())
      for (const [matKey, list] of Object.entries(mats)) {
        const mat = this.mats[matKey]
        if (mat && list.length > 0) this.buildInstanced(mat, list)
      }
  }

  /* ================= structure helpers ================= */

  /** one block; y = BOTTOM of the block */
  private b(mat: string, x: number, y: number, z: number) {
    if (!this.L[mat]) this.L[mat] = []
    this.L[mat].push({ x, y: y + 0.5, z })
  }
  /** filled box (inclusive bounds), y = bottoms */
  private fill(mat: string, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number) {
    for (let x = x0; x <= x1; x++)
      for (let y = y0; y <= y1; y++)
        for (let z = z0; z <= z1; z++) this.b(mat, x, y, z)
  }
  private col(mat: string, x: number, z: number, y0: number, y1: number) {
    for (let y = y0; y <= y1; y++) this.b(mat, x, y, z)
  }
  /** battlement caps: every other block along an x line */
  private crenelX(mat: string, x0: number, x1: number, y: number, z: number) {
    for (let x = x0; x <= x1; x += 2) this.b(mat, x, y, z)
  }
  /** battlement caps: every other block along a z line */
  private crenelZ(mat: string, z0: number, z1: number, y: number, x: number) {
    for (let z = z0; z <= z1; z += 2) this.b(mat, x, y, z)
  }

  private flush() {
    for (const [matKey, list] of Object.entries(this.L)) {
      const mat = this.mats[matKey]
      if (mat && list.length > 0) this.buildInstanced(mat, list)
    }
    this.L = {}
  }

  /* ================= EMBER SHRINE (the hub) ================= */

  private buildHubShrine() {
    const y0 = 13 // surface of the plateau

    /* the broken colonnade ring around the bonfire */
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2
      const px = Math.round(Math.cos(a) * 7)
      const pz = 34 + Math.round(Math.sin(a) * 6.4)
      if (Math.hypot(px - V2_MERCHANT.x, pz - V2_MERCHANT.z) < 4.6) continue
      if (Math.abs(px) <= 3 && pz < 31) continue // north opening toward the facade
      const tall = [3, 5, 4, 2, 5, 3, 4, 2][i % 8]
      this.col('stonebrick', px, pz, y0, y0 + tall - 1)
      if (tall >= 4 && i % 3 === 0) this.b('glow', px, y0 + tall, pz) // lantern caps
      if (tall < 3) this.b('cobble', px + 1, y0, pz + 1) // a fallen drum
    }

    /* the temple facade the aqueduct docks into — two towers + arched window */
    for (const tx of [-4, 3]) {
      this.fill('stonebrick', tx, tx + 1, y0, y0 + 5, 27, 29)
      this.fill('darkstone', tx, tx + 1, y0 + 6, y0 + 6, 27, 29)
      this.crenelX('stone', tx, tx + 1, y0 + 7, 27)
      this.crenelX('stone', tx, tx + 1, y0 + 7, 29)
      this.b('glow', tx < 0 ? tx : tx + 1, y0 + 4, 26) // wall lamps on both mouths
    }
    // wall between the towers with a tall arched window + rose band
    this.fill('stonebrick', -1, 2, y0, y0 + 3, 28, 28)
    this.fill('glass', -1, 2, y0 + 4, y0 + 5, 28, 28)
    this.fill('darkstone', -1, 2, y0 + 6, y0 + 6, 28, 28)
    this.fill('rose', 0, 1, y0 + 5, y0 + 5, 27, 27)

    /* two kneeling statues flank the north path */
    const statue = (sx: number, sz: number) => {
      this.b('mossy', sx, y0, sz)
      this.b('stonebrick', sx, y0 + 1, sz)
      this.b('stone', sx, y0 + 2, sz)
      this.b('stone', sx, y0 + 2, sz + 1) // bowed head forward
    }
    statue(-3, 30)
    statue(3, 30)

    /* the bonfire: coal bed + a blocky coiled sword */
    this.fill('coal', -1, 1, y0, y0, 33, 35)
    this.col('stone', 0, 34, y0 + 1, y0 + 2)
    this.b('plank', 0, y0 + 2, 33)
    this.b('plank', 0, y0 + 2, 35)

    /* the merchant's canopy stall — his corner of the world */
    const mx = -4, mz = 38
    this.fill('plank', mx, mx + 3, y0, y0, mz, mz + 1) // counter deck
    this.fill('plank', mx, mx + 3, y0 + 1, y0 + 1, mz - 1, mz - 1) // counter front toward the fire
    for (const [px, pz] of [[mx, mz], [mx + 3, mz], [mx, mz - 1], [mx + 3, mz - 1]] as const)
      this.col('log', px, pz, y0, y0 + 2)
    this.fill('plank', mx - 1, mx + 4, y0 + 3, y0 + 3, mz - 2, mz) // canopy
    this.b('glow', mx - 1, y0 + 2, mz - 1) // his lantern
    this.b('log', mx + 4, y0, mz + 1) // barrel
    this.b('log', mx + 4, y0 + 1, mz + 1)
    this.b('plank', mx - 1, y0, mz) // crate

    /* scattered faith: sunken slabs + moss */
    for (const [sx, sz] of [[-6, 31], [6, 36], [-5, 37], [5, 30], [0, 40]] as const) {
      this.b(this.rng() < 0.5 ? 'mossy' : 'cobble', sx, y0, sz)
    }
    this.flush()
  }

  /* ================= THE AQUEDUCT ================= */

  private buildAqueduct() {
    // deck bottom runs 13 (hub) → 17 (gate); walk surface = bottom+1
    for (let z = 9; z <= 25; z++) {
      const yd = 13 + Math.round(((25 - z) * 4) / 16)
      this.fill('stonebrick', -1, 1, yd, yd, z, z)
      // side rails with gaps
      if (z % 2 === 0) {
        this.b('cobble', -1, yd + 1, z)
        this.b('cobble', 1, yd + 1, z)
      }
      // arch supports every 3 blocks, down to the gorge floor
      if ((z - 9) % 3 === 0) {
        for (const lx of [-1, 1]) this.col('stonebrick', lx, z, 5, yd - 1)
        if (yd - 2 > 5) {
          this.fill('stonebrick', -1, 1, yd - 2, yd - 2, z, z) // lintel
          this.b('stonebrick', 0, yd - 3, z) // arch keystone
        }
      }
    }
    /* weathering: moss + rubble on the gorge floor (surface 5) */
    for (const [rx, rz] of [[-2, 18], [2, 15], [0, 21], [-3, 20]] as const) this.b('mossy', rx, 5, rz)
    this.b('cobble', -2, 5, 14)
    this.b('stone', 3, 5, 19)
    /* an old camp under the arch: cold fire ring + a wheel */
    this.b('coal', 2, 5, 12)
    this.b('log', 3, 5, 13)
    this.b('cobble', 1, 5, 13)
    this.flush()
  }

  /* ================= TOWN GATE ================= */

  private buildTownGate() {
    const g = 17 // gate square surface
    /* twin towers (z 6..8; z=8 row sits on band floor 16) */
    for (const tx of [0, 4]) {
      this.fill('cobble', tx, tx + 2, g, g + 4, 6, 8)
      this.fill('darkstone', tx, tx + 2, g + 5, g + 5, 6, 8)
      this.crenelX('stone', tx, tx + 2, g + 6, 6)
      this.crenelX('stone', tx, tx + 2, g + 6, 8)
      this.b('glow', tx + 1, g + 3, 9) // lamp faces the square
    }
    /* arch lintel over the street gap + half-raised portcullis */
    this.fill('cobble', 3, 3, g + 4, g + 5, 6, 8)
    this.col('plank', 3, 7, g, g + 1)
    this.b('plank', 2, g + 1, 7)
    this.b('plank', 4, g + 1, 7)
    /* the hanging cage — the gate's old justice */
    this.col('log', 3, 7, g + 2, g + 3)
    this.fill('coal', 3, 3, g, g + 1, 7, 7)
    /* wall stubs flanking the gate */
    this.fill('cobble', -2, -1, g, g + 2, 6, 7)
    this.fill('cobble', 7, 8, g, g + 2, 6, 7)
    /* the overturned cart before the gate (on the square, h16) */
    this.fill('log', 5, 7, 17, 17, 9, 9)
    this.b('cobble', 4, 17, 9)
    this.b('cobble', 8, 17, 9)
    this.b('plank', 6, 18, 9)
    /* welcome lamp on the square */
    this.col('log', 7, 11, 17, 19)
    this.b('glow', 7, 20, 11)
    this.flush()
  }

  /* ================= THE TOWN (Undead Burg) ================= */

  /**
   * a real burg house: cobble walls with timber framing, glass windows
   * (one lit), gable roof with eaves, chimney. `ruin` 0..1 breaks it.
   */
  private house(
    x0: number, z0: number, w: number, d: number,
    door: 'E' | 'W' | 'N' | 'S',
    opts: { ruin?: number; lit?: boolean; roofX?: boolean; balcony?: boolean } = {}
  ) {
    const ruin = opts.ruin ?? 0
    const x1 = x0 + w - 1
    const z1 = z0 + d - 1
    const cx = x0 + (w >> 1)
    const cz = z0 + (d >> 1)
    const y0 = this.surfaceAt(cx, cz)
    const wallH = 5

    /* perimeter walls with window holes + timber bands */
    for (let x = x0; x <= x1; x++) {
      for (let z = z0; z <= z1; z++) {
        const onX = x === x0 || x === x1
        const onZ = z === z0 || z === z1
        if (!onX && !onZ) continue
        for (let y = y0; y < y0 + wallH; y++) {
          const rel = y - y0
          const doorHole =
            (door === 'S' && z === z1 && x === cx && rel < 2) ||
            (door === 'N' && z === z0 && x === cx && rel < 2) ||
            (door === 'E' && x === x1 && z === cz && rel < 2) ||
            (door === 'W' && x === x0 && z === cz && rel < 2)
          if (doorHole) continue
          const winRow = rel === 2 || rel === 4
          const winCol =
            (onZ && !onX && (x - x0) % 2 === (rel === 2 ? 0 : 1)) ||
            (onX && !onZ && (z - z0) % 2 === (rel === 4 ? 0 : 1))
          if (winRow && winCol) {
            this.b('glass', x, y, z)
            continue
          }
          if ((rel === 4 || rel === wallH - 1) && this.rng() < ruin) continue
          if (rel === wallH - 1 && this.rng() < ruin * 0.7) continue
          this.b(rel === 1 || rel === 3 ? 'plank' : 'cobble', x, y, z)
        }
      }
    }
    /* 2nd-story plank floor (glimpsed through the glass) */
    if (this.rng() < 0.8) {
      for (let x = x0 + 1; x <= x1 - 1; x++)
        for (let z = z0 + 1; z <= z1 - 1; z++) if ((x + z) % 3 !== 0) this.b('plank', x, y0 + wallH - 2, z)
    }

    /* street-side overhang balcony + brackets */
    if (opts.balcony) {
      const by = y0 + wallH - 2
      if (door === 'E') {
        this.fill('plank', x1 + 1, x1 + 1, by, by, z0 + 1, z1 - 1)
        this.b('log', x1 + 1, by - 1, z0 + 1)
        this.b('log', x1 + 1, by - 1, z1 - 1)
        this.fill('plank', x1 + 1, x1 + 1, by + 1, by + 1, z0 + 2, z1 - 2)
      } else if (door === 'W') {
        this.fill('plank', x0 - 1, x0 - 1, by, by, z0 + 1, z1 - 1)
        this.b('log', x0 - 1, by - 1, z0 + 1)
        this.b('log', x0 - 1, by - 1, z1 - 1)
        this.fill('plank', x0 - 1, x0 - 1, by + 1, by + 1, z0 + 2, z1 - 2)
      }
    }

    /* the door + threshold step */
    const dstep: [number, number] =
      door === 'S' ? [cx, z1 + 1] : door === 'N' ? [cx, z0 - 1] : door === 'E' ? [x1 + 1, cz] : [x0 - 1, cz]
    this.b('stone', dstep[0], y0, dstep[1])
    const doorAt: [number, number, number] =
      door === 'S' ? [cx, y0, z1] : door === 'N' ? [cx, y0, z0] : door === 'E' ? [x1, y0, cz] : [x0, y0, cz]
    this.b('plank', doorAt[0], doorAt[1], doorAt[2])

    /* one lit window per house — the town is dead but not dark */
    if (opts.lit) {
      const lx = door === 'E' ? x1 : door === 'W' ? x0 : cx
      const lz = door === 'S' ? z1 : door === 'N' ? z0 : cz
      this.b('glow', lx, y0 + 2, lz)
    }

    /* stepped gable roof with 1-block eaves */
    const alongX = opts.roofX ?? w >= d
    const steps = alongX ? Math.ceil((z1 - z0 + 3) / 2) : Math.ceil((x1 - x0 + 3) / 2)
    for (let i = 0; i < steps; i++) {
      if (i > 0 && this.rng() < ruin * 0.8) break // collapsed mid-roof
      const y = y0 + wallH + i
      if (alongX) {
        const za = z0 - 1 + i
        const zb = z1 + 1 - i
        if (za > zb) break
        for (let x = x0 - 1; x <= x1 + 1; x++) {
          this.b('roof', x, y, za)
          if (zb !== za) this.b('roof', x, y, zb)
        }
      } else {
        const xa = x0 - 1 + i
        const xb = x1 + 1 - i
        if (xa > xb) break
        for (let z = z0 - 1; z <= z1 + 1; z++) {
          this.b('roof', xa, y, z)
          if (xb !== xa) this.b('roof', xb, y, z)
        }
      }
    }
    /* chimney on the ridge end */
    this.col('cobble', x0 + 1, alongX ? z0 : z1, y0 + wallH + 1, y0 + wallH + 2)
    if (this.rng() < 0.5) this.b('coal', x0 + 1, y0 + wallH + 3, alongX ? z0 : z1)
  }

  private buildTown() {
    /* eleven houses climbing the slope — the burg builds into the hill */
    this.house(-1, 0, 5, 5, 'E', { lit: true, roofX: false })
    this.house(6, 1, 5, 5, 'W', { ruin: 0.25, roofX: true })
    this.house(-8, 3, 4, 4, 'E', { lit: true, roofX: false })
    this.house(6, -6, 5, 5, 'W', { lit: true, roofX: false, balcony: true })
    this.house(-1, -7, 5, 5, 'E', { ruin: 0.5, roofX: true })
    this.house(-8, -13, 4, 5, 'E', { ruin: 0.2, roofX: false })
    this.house(6, -13, 6, 5, 'W', { lit: true, roofX: true, balcony: true })
    this.house(-2, -15, 4, 5, 'E', { ruin: 0.35, roofX: false })
    this.house(7, -19, 5, 5, 'W', { ruin: 0.65, roofX: true })
    this.house(-3, -21, 5, 5, 'E', { lit: true, ruin: 0.15, roofX: false })
    this.house(4, -22, 5, 4, 'W', { ruin: 0.4, roofX: true })

    /* street props */
    const prop = (mat: string, x: number, z: number) => this.b(mat, x, this.surfaceAt(x, z), z)
    prop('log', 0, 1); prop('log', 0, 2)
    prop('plank', 6, 8); prop('plank', 7, 8)
    prop('log', -6, 4); prop('log', -6, 5)
    prop('plank', 11, -8)
    prop('log', -4, -12); prop('log', -4, -13)
    prop('plank', 12, -18); prop('plank', 12, -19); prop('log', 12, -20)
    /* alley barricade: posts + slats */
    const by = this.surfaceAt(-4, 1)
    this.col('log', -4, 1, by, by + 1)
    this.col('log', -4, -1, by, by + 1)
    this.fill('plank', -4, -4, by + 1, by + 1, 0, 0)
    this.fill('plank', -4, -4, by, by, -2, -2)
    /* the well of the upper square */
    const wy = this.surfaceAt(9, -15)
    for (const [dx, dz] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [-1, 1], [1, -1], [1, 1]] as const)
      this.b('cobble', 9 + dx, wy, -15 + dz)
    this.b('coal', 9, wy, -15)
    this.col('log', 8, -16, wy, wy + 1)
    this.col('log', 10, -16, wy, wy + 1)
    this.fill('roof', 8, 10, wy + 2, wy + 2, -17, -16)
    /* lampposts along the two streets */
    for (const [lx, lz] of [[1, -4], [5, -11], [-7, -9], [2, -18]] as const) {
      const y = this.surfaceAt(lx, lz)
      this.col('log', lx, lz, y, y + 2)
      this.b('glow', lx, y + 3, lz)
    }
    /* the rooftop bridge — a plank crossing between two upper floors */
    const bb = this.surfaceAt(0, -13) + 4
    this.fill('plank', 2, 5, bb, bb, -11, -11)
    this.b('plank', 2, bb + 1, -11)
    this.b('plank', 5, bb + 1, -11)
    this.col('log', 2, -11, bb - 2, bb - 1)
    this.col('log', 5, -11, bb - 2, bb - 1)
    this.flush()
  }

  /* ================= WATCHTOWER (mid-town spiral) ================= */

  private buildWatchtower() {
    const cx = 11, cz = -6
    const y0 = this.surfaceAt(cx, cz)
    this.fill('stonebrick', cx - 1, cx + 2, y0, y0 + 8, cz - 1, cz + 2)
    this.fill('darkstone', cx - 1, cx + 2, y0 + 9, y0 + 9, cz - 1, cz + 2)
    this.crenelX('stone', cx - 1, cx + 2, y0 + 10, cz - 1)
    this.crenelX('stone', cx - 1, cx + 2, y0 + 10, cz + 2)
    this.crenelZ('stone', cz, cz + 2, y0 + 10, cx - 1)
    this.crenelZ('stone', cz, cz + 2, y0 + 10, cx + 2)
    /* lit watch window facing the street */
    this.b('glow', cx - 2, y0 + 7, cz)
    /* external spiral stairs winding up the south + east faces */
    const seq: [number, number][] = [
      [-2, 4], [-1, 4], [0, 4], [1, 4], [2, 4], [2, 3], [2, 2], [2, 1], [2, 0],
    ]
    let sy = y0
    for (const [dx, dz] of seq) {
      this.b('cobble', cx + dx, sy, cz + dz)
      sy++
    }
    /* brazier on top */
    this.b('coal', cx, y0 + 10, cz)
    this.b('glow', cx, y0 + 11, cz)
    this.flush()
  }

  /* ================= TOP PLAZA + FOG GATE (boss 1 arena) ================= */

  private buildTopPlaza() {
    const y0 = 25 // plaza surface
    /* broken colonnade along the east and west lips */
    for (const row of [-8, 8]) {
      for (let z = -27; z <= -22; z += 2) {
        if (z === -24 && row === -8) continue // the west approach stair lands here
        const tall = z % 4 === 1 ? 4 : 2
        this.col('stonebrick', row, z, y0, y0 + tall - 1)
        if (tall >= 4) this.b('glow', row, y0 + tall, z)
      }
    }
    /* fallen column drums + rubble */
    for (const [fx, fz] of [[-5, -23], [4, -26], [-6, -26], [5, -22]] as const) {
      this.b('cobble', fx, y0, fz)
      this.b(this.rng() < 0.5 ? 'mossy' : 'cobble', fx + 1, y0, fz)
    }
    /* two cold braziers flanking the arena */
    for (const bx of [-3, 3]) {
      this.col('stonebrick', bx, -23, y0, y0 + 1)
      this.b('coal', bx, y0 + 2, -23)
    }
    /* the fog-gate frame: two dark pillars + lintel with pale runes */
    for (const px of [1, 5]) {
      this.fill('darkstone', px, px, y0, y0 + 3, V2_BOSS1_GATE_Z, V2_BOSS1_GATE_Z)
      this.b('glow', px, y0 + 4, V2_BOSS1_GATE_Z)
    }
    this.fill('darkstone', 1, 5, y0 + 4, y0 + 4, V2_BOSS1_GATE_Z, V2_BOSS1_GATE_Z)
    /* moss creeping over the cracked floor */
    for (const [cx2, cz2] of [[-2, -25], [2, -23], [0, -27], [-4, -22]] as const) this.b('mossy', cx2, y0, cz2)
    this.flush()
  }

  /* ================= THE GREAT BROKEN BRIDGE ================= */

  private buildBossBridge() {
    /* deck runs north from the plaza over open air, then crumbles */
    for (let z = -40; z <= -28; z++) {
      const yd = 24 // deck bottom → walk 25
      if (z === -33) continue // the breach — the fall
      this.fill('stonebrick', -2, 2, yd, yd, z, z)
      if (z % 2 === 0) {
        this.b('cobble', -2, yd + 1, z)
        this.b('cobble', 2, yd + 1, z)
      }
      /* mighty legs down to the valley floor + arch keystone */
      if ((z + 28) % 4 === 0) {
        const ground = this.getH(0, z)
        for (const lx of [-2, 2]) this.col('stonebrick', lx, z, ground + 1, yd - 1)
        this.fill('stonebrick', -2, 2, yd - 2, yd - 2, z, z)
        this.b('stonebrick', 0, yd - 3, z)
      }
    }
    /* the crumbled north end: a stub + rubble down the slope */
    this.fill('stonebrick', -1, 1, 24, 24, -41, -41)
    this.b('cobble', -2, this.surfaceAt(-2, -41), -41)
    this.b('stone', 2, this.surfaceAt(2, -40), -40)
    this.b('cobble', 0, this.surfaceAt(0, -42), -42)
    /* moss claiming the old stone */
    for (const [mx, mz] of [[-1, -30], [1, -36], [0, -31]] as const) this.b('mossy', mx, 25, mz)
    this.flush()
  }

  /* ================= THE PARISH (church + bell tower) ================= */

  private buildParish() {
    const y0 = 23 // hill plaza surface
    /* ---- the nave: x -38..-27, z -36..-28, walls to 30 ---- */
    const wallTop = y0 + 7 // 30
    for (let x = -38; x <= -27; x++) {
      for (const z of [-36, -28]) {
        for (let y = y0; y <= wallTop; y++) {
          const rel = y - y0
          if (rel >= 2 && rel <= 4 && (x + 38) % 3 !== 0 && x !== -38 && x !== -27) {
            this.b(rel === 4 ? 'cobble' : 'glass', x, y, z) // tall windows
            continue
          }
          this.b('darkstone', x, y, z)
        }
      }
    }
    for (let z = -35; z <= -29; z++) {
      for (const x of [-38, -27]) {
        for (let y = y0; y <= wallTop; y++) {
          const rel = y - y0
          // the great west rose window + the east window
          if (x === -38 && rel >= 4 && rel <= 6 && z >= -33 && z <= -31) {
            this.b(rel === 5 ? 'rose' : 'glass', x, y, z)
            continue
          }
          if (x === -27 && rel >= 2 && rel <= 4 && z >= -33 && z <= -31) {
            this.b('glass', x, y, z)
            continue
          }
          this.b('darkstone', x, y, z)
        }
      }
    }
    /* buttresses along north + south walls */
    for (let x = -37; x <= -28; x += 3) {
      for (const bz of [-37, -27]) {
        this.col('darkstone', x, bz, y0, y0 + 4)
        this.b('cobble', x, y0 + 5, bz)
      }
    }
    /* the steep nave roof, ridge along x */
    for (let i = 0; i <= 4; i++) {
      const y = wallTop + 1 + i
      const za = -36 + i
      const zb = -28 - i
      for (let x = -39; x <= -26; x++) {
        this.b('roof', x, y, za)
        if (zb !== za) this.b('roof', x, y, zb)
      }
    }
    /* gable triangles at both ends */
    for (let i = 0; i <= 3; i++) {
      const y = wallTop + 1 + i
      for (let z = -35 + i; z <= -29 - i; z++) {
        this.b('darkstone', -38, y, z)
        this.b('darkstone', -27, y, z)
      }
    }
    this.b('gold', -32, wallTop + 6, -32) // the ridge cross
    /* entrance: south door arch + step */
    this.fill('darkstone', -34, -32, y0, y0 + 3, -28, -28)
    this.fill('plank', -34, -33, y0, y0 + 1, -28, -28) // the doors, forever open
    this.b('stone', -33, y0, -27)
    /* interior: raised floor, pews, altar, candles */
    for (let x = -37; x <= -28; x++)
      for (let z = -35; z <= -29; z++) this.b('stonebrick', x, y0, z)
    for (const px of [-36, -34, -32, -30]) {
      this.fill('plank', px, px, y0 + 1, y0 + 1, -34, -31) // pew rows
      this.b('plank', px, y0 + 2, -34)
      this.b('plank', px, y0 + 2, -31)
    }
    this.fill('stonebrick', -37, -37, y0 + 1, y0 + 2, -34, -30) // altar dais
    this.b('glow', -37, y0 + 3, -33)
    this.b('glow', -37, y0 + 3, -31)
    this.b('mossy', -37, y0 + 3, -32) // the old saint, moss-eaten

    /* ---- the bell tower (the landmark of the whole map) ---- */
    const tx0 = -26, tx1 = -22, tz0 = -40, tz1 = -36
    for (let y = y0; y <= y0 + 12; y++) {
      const bellRow = y >= y0 + 9 && y <= y0 + 11
      for (let x = tx0; x <= tx1; x++) {
        for (const z of [tz0, tz1]) {
          if (bellRow && x > tx0 && x < tx1) continue // the openings
          this.b(y >= y0 + 8 ? 'darkstone' : 'stonebrick', x, y, z)
        }
      }
      for (let z = tz0 + 1; z <= tz1 - 1; z++) {
        for (const x of [tx0, tx1]) {
          if (bellRow && z > tz0 && z < tz1) continue
          this.b(y >= y0 + 8 ? 'darkstone' : 'stonebrick', x, y, z)
        }
      }
    }
    /* the bell: gold, hanging where the whole map can see it */
    this.fill('gold', -25, -23, y0 + 9, y0 + 10, -39, -37)
    this.b('glow', -24, y0 + 8, -38) // the belfry lamp
    /* the spire */
    this.fill('darkstone', tx0, tx1, y0 + 13, y0 + 13, tz0, tz1)
    this.fill('darkstone', tx0 + 1, tx1 - 1, y0 + 14, y0 + 14, tz0 + 1, tz1 - 1)
    this.b('darkstone', -24, y0 + 15, -38)
    this.b('gold', -24, y0 + 16, -38) // the finial
    /* tower door from the nave corner */
    this.fill('plank', -26, -25, y0, y0 + 1, -36, -36)
    this.flush()
  }

  /* ================= GRAVEYARD (around the parish) ================= */

  private buildGraveyard() {
    /* enclosure wall on the south slope of the hill; gate faces east */
    for (let x = -38; x <= -24; x++) {
      for (const z of [-26, -18]) this.b('cobble', x, this.surfaceAt(x, z), z)
    }
    for (let z = -25; z <= -19; z++) {
      if (z === -22) continue // the gate
      this.b('cobble', -38, this.surfaceAt(-38, z), z)
      this.b('cobble', -24, this.surfaceAt(-24, z), z)
    }
    for (const [px, pz] of [[-38, -26], [-24, -26], [-38, -18], [-24, -18]] as const) {
      this.col('stonebrick', px, pz, this.surfaceAt(px, pz), this.surfaceAt(px, pz) + 1)
    }
    /* two rows of graves; some sunken, some marked with crosses */
    let gi = 0
    for (const gz of [-24, -21]) {
      for (const gx of [-36, -33, -30, -27]) {
        const gy = this.surfaceAt(gx, gz)
        this.b(gi % 3 === 0 ? 'mossy' : 'stone', gx, gy, gz)
        if (gi % 4 === 2) {
          this.b('stone', gx, gy + 1, gz)
          this.b('stone', gx - 1, gy + 2, gz)
          this.b('stone', gx + 1, gy + 2, gz)
          this.b('stone', gx, gy + 2, gz)
        } else if (gi % 4 !== 1) {
          this.b('stonebrick', gx, gy + 1, gz)
        }
        gi++
      }
    }
    /* the mourner statue */
    const my = this.surfaceAt(-31, -23)
    this.b('mossy', -31, my, -23)
    this.b('stonebrick', -31, my + 1, -23)
    this.b('stone', -31, my + 2, -23)
    this.b('stone', -31, my + 2, -22)
    /* an open crypt — someone broke in long ago */
    const cy = this.surfaceAt(-36, -20)
    this.fill('darkstone', -37, -35, cy, cy + 1, -21, -19)
    this.fill('coal', -36, -36, cy, cy, -20, -20)
    this.b('darkstone', -36, cy + 2, -20) // a half-lifted lid
    /* dead trees leaning over the fence */
    for (const [tx, tz] of [[-37, -19], [-25, -25]] as const) {
      const ty = this.surfaceAt(tx, tz)
      const th = 3 + Math.floor(this.rng() * 2)
      this.col('log', tx, tz, ty, ty + th - 1)
      this.b('log', tx + 1, ty + th - 1, tz)
    }
    this.flush()
  }

  /* ================= THE RAVINE (the drowned road) ================= */

  private buildRavine() {
    /* broken bridge stumps — the old crossing, mid-water */
    for (const [bx, bz] of [[-26, -1], [-26, 2], [-13, 0], [-13, 3]] as const) {
      this.col('cobble', bx, bz, 3, 6)
    }
    this.b('cobble', -25, 6, -1)
    this.b('stone', -14, 6, 1)
    this.b('cobble', -24, 5, 2)
    this.b('cobble', -15, 5, 2)
    /* the toppled statue head in the water, moss-eaten */
    this.b('mossy', -20, 3, 5)
    this.b('mossy', -19, 3, 5)
    /* reeds and a drowned tree */
    for (const [rx, rz] of [[-23, -6], [-17, 8], [-24, 10], [-16, -9]] as const) this.b('leaves', rx, 3, rz)
    this.col('log', -21, -4, 3, 5)
    this.b('log', -22, 5, -4)
    /* a hermit's cold camp on the east bank */
    this.b('coal', -11, 3, 7)
    this.b('log', -12, 3, 8)
    this.b('cobble', -10, 3, 8)
    this.b('plank', -11, 3, 6)
    this.flush()
  }

  /* ================= THE ASH WASTES ================= */

  private buildAshWastes() {
    /* the cinder gatehouse on the hub road */
    const gy = this.surfaceAt(24, 26)
    this.fill('darkstone', 22, 23, gy, gy + 4, 25, 27)
    this.fill('darkstone', 25, 26, gy, gy + 2, 25, 27) // the half-collapsed twin
    this.b('darkstone', 26, gy + 1, 24)
    this.b('cobble', 27, gy, 23)
    this.b('darkstone', 27, gy + 1, 22)
    this.b('glow', 22, gy + 3, 24) // one lamp still burns

    /* the broken fortress: jagged walls around a dead yard */
    const fy = this.surfaceAt(34, 12)
    for (let x = 30; x <= 42; x++) {
      if (x === 36) continue // gate gap
      const hh = x % 3 === 0 ? 4 : x % 3 === 1 ? 3 : 2
      this.col('darkstone', x, 8, fy, fy + hh - 1)
      this.col('darkstone', x, 16, fy, fy + hh - 1)
    }
    for (let z = 9; z <= 15; z++) {
      const hh = z % 3 === 0 ? 4 : 2
      this.col('darkstone', 30, z, fy, fy + hh - 1)
      this.col('darkstone', 42, z, fy, fy + hh - 1)
    }
    /* the collapsed corner tower + its rubble skirt */
    this.fill('darkstone', 40, 42, fy, fy + 3, 14, 16)
    for (let i = 0; i < 6; i++) {
      this.b('darkstone', 43 + (i % 2), fy + Math.floor(i / 3), 13 + (i % 3))
      this.b('cobble', 44, fy + (i % 2), 14 + (i % 2))
    }
    /* ember vents breathing inside the yard */
    for (const [ex, ez] of [[33, 11], [38, 13], [36, 10]] as const) {
      this.b('coal', ex, fy, ez)
      this.b('glow', ex, fy + 1, ez)
    }
    /* debris */
    this.b('coal', 32, fy, 14)
    this.b('stone', 39, fy, 9)
    this.b('plank', 31, fy, 10)
    /* cinder trees */
    for (const [tx, tz] of [[27, 2], [45, 20], [50, 8], [29, 18]] as const) {
      const ty = this.surfaceAt(tx, tz)
      this.col('log', tx, tz, ty, ty + 2)
      this.b('coal', tx + 1, ty + 2, tz)
    }
    this.flush()
  }

  /* ================= THE CALDERA (boss 2 arena) ================= */

  private buildCaldera() {
    /* eight fire basins on the wall ring */
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.39
      const px = Math.round(40 + Math.cos(a) * 8)
      const pz = Math.round(-8 + Math.sin(a) * 8)
      if (px >= 39 && px <= 41 && pz >= -2 && pz <= 1) continue // the breach
      this.col('darkstone', px, pz, 9, 11)
      this.b('glow', px, 12, pz)
    }
    /* the arena floor: cracked bricks + coal scars */
    for (let x = 34; x <= 46; x++) {
      for (let z = -14; z <= -2; z++) {
        const d = Math.hypot(x - 40, z + 8)
        if (d > 7.2) continue
        if ((x * 5 + z * 3) % 9 === 0) this.b('mossy', x, 9, z)
        else if ((x + z) % 7 === 0) this.b('coal', x, 9, z)
      }
    }
    /* the dais of the Flame King at the north end */
    this.fill('darkstone', 39, 41, 9, 10, -13, -12)
    this.b('glow', 40, 11, -12)
    /* the approach bridge over the lava */
    for (let z = 1; z <= 5; z++) {
      this.fill('stonebrick', 39, 41, 8, 8, z, z)
      if (z % 2 === 1) {
        this.b('cobble', 39, 9, z)
        this.b('cobble', 41, 9, z)
      }
      if (z === 2) for (const lx of [39, 41]) this.col('stonebrick', lx, z, 6, 7)
    }
    this.b('stonebrick', 40, 7, 6) // the step up from the wastes road
    /* the broken cart that never made it back */
    this.fill('log', 39, 41, 9, 9, 4, 4)
    this.b('cobble', 38, 9, 4)
    this.b('plank', 40, 10, 4)
    this.flush()
  }

  /* ================= fog gates ================= */

  private buildFogGates() {
    const addLayer = (
      w: number, hh: number, x: number, z: number, gate: 1 | 2, y: number,
      seed: number, scale: [number, number], drift: [number, number], opacity: number
    ) => {
      const mat = createFogMaterial({ seed, scale, drift, opacity })
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, hh), mat)
      mesh.position.set(x, y, z)
      this.group.add(mesh)
      this.fogLayers.push({ mesh, gate, t: seed * 7 })
    }
    /* boss 1 — the gate at the top of the town */
    addLayer(5.6, 4.7, 3, V2_BOSS1_GATE_Z, 1, 25.8, 0.0, [2.6, 2.0], [0.05, -0.032], 0.97)
    addLayer(6.2, 5.0, 3, V2_BOSS1_GATE_Z + 0.12, 1, 25.8, 3.7, [3.4, 2.6], [-0.026, 0.041], 0.55)
    /* boss 2 — the caldera breach */
    addLayer(4.6, 4.4, 40, 0, 2, 11.2, 1.9, [2.6, 2.0], [0.05, -0.032], 0.97)
    addLayer(5.4, 4.8, 40, 0.12, 2, 11.2, 5.3, [3.4, 2.6], [-0.026, 0.041], 0.55)
  }

  setFogGatesVisible(g1: boolean, g2: boolean) {
    for (const l of this.fogLayers) l.mesh.visible = l.gate === 1 ? g1 : g2
  }

  /* ================= sky ================= */

  private buildSky() {
    /* the moon rises behind the parish — the bell tower cuts its light */
    const moon = new THREE.Mesh(
      new THREE.BoxGeometry(5, 5, 0.4),
      new THREE.MeshBasicMaterial({ color: 0xf2f0e4 })
    )
    moon.position.set(-38, 46, -62)
    moon.lookAt(0, 0, 0)
    this.group.add(moon)

    const starCount = 320
    const pos = new Float32Array(starCount * 3)
    const r = mulberry32(99)
    for (let i = 0; i < starCount; i++) {
      const theta = r() * Math.PI * 2
      const phi = Math.acos(r() * 0.85)
      const rad = 130
      pos[i * 3] = rad * Math.sin(phi) * Math.cos(theta)
      pos[i * 3 + 1] = rad * Math.cos(phi) + 10
      pos[i * 3 + 2] = rad * Math.sin(phi) * Math.sin(theta)
    }
    const starGeo = new THREE.BufferGeometry()
    starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    const stars = new THREE.Points(
      starGeo,
      new THREE.PointsMaterial({ color: 0xdfe6ef, size: 0.8, sizeAttenuation: true, fog: false })
    )
    this.group.add(stars)

    const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.4 })
    for (let i = 0; i < 14; i++) {
      const w = 6 + r() * 10
      const d = 4 + r() * 6
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, 0.8, d), cloudMat)
      mesh.position.set(r() * 130 - 65, 42 + r() * 10, r() * 130 - 65)
      this.clouds.push({ mesh, speed: 0.4 + r() * 0.7 })
      this.group.add(mesh)
    }
  }

  update(dt: number) {
    for (const c of this.clouds) {
      c.mesh.position.x += c.speed * dt
      if (c.mesh.position.x > 70) c.mesh.position.x = -70
    }
    for (const l of this.fogLayers) {
      l.t += dt
      const mat = l.mesh.material as THREE.ShaderMaterial
      mat.uniforms.uTime.value = l.t
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
