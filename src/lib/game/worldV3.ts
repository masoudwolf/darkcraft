import * as THREE from 'three'
import { blockMaterials, mulberry32, createFogMaterial } from './textures'

/* ==================================================================
   WORLD V4 — V3's clarity, grown into a living world.

   The V3 laws still hold: wide roads, low heights, one silhouette per
   region, lantern-marked destinations. On top of them V4 adds the
   layer that was missing — DENSITY and DISCOVERY:

   1. THE LOOP. A mossy stair (the Watchers' Stair) falls from the
      parish plateau's east flank to the meadow and returns to the
      shrine's north arch — the Dark-Souls circle: hub → village →
      parish → shortcut → hub. The world is now a ring, not a fork.
   2. The meadow gained a pond with a dock; the ashes gained a ruined
      gate arch around the pyromancy flame; the fortress yard gained
      a processional walkway, barracks ruin and a well.
   3. Detail pass: candles, hay, barrels, spikes, vents, slits, a
      burned homestead, a crypt — every region earns a second look.
   4. Drifting ash motes and rising lava embers (buildAmbient) keep
      the air alive between the landmarks.

   Why V2 failed: too dark to read, too vertical to walk, the camera
   trapped against walls, and regions blurred into a jumble of blocks.

   The V3 laws:
   1. Every road is ≥4 wide, every gate ≥4 wide, every slope ≤1:2.
   2. No LOW structure hangs above a walkable path. The camera is free.
   3. Each region owns ONE bold silhouette + ONE ground colour, so you
      always know where you are and where to go next.
   4. Two roads leave the hub — west to the village, east to the ash.
      Both are lantern-marked and end at a landmark you can already see.
   5. Heights stay low (6..12 ground, landmarks ~27) — gentle, readable.

                        NORTH (z−)
   ┌──────────────────────────────────────────────────────────┐
   │  PARISH HILL (h12)                    CINDER FORTRESS    │
   │  ╔church + bell tower╗  meadow   ┌──walls──────────┐    │
   │  ║ graveyard ═ arena (boss1) ║   │ courtyard        │    │
   │  ╚══ ramp ══════╗            │  │ (boss2)  throne  │    │
   │  VILLAGE (h7)    │            │  └──gate────────────┘    │
   │  one street      │            │       ▲                  │
   │  ═well square═   │            │  ASH WASTES (h6)         │
   │        ▲         │            │  pools · hermit camp     │
   │        └── west road ── EMBER SHRINE ── east road ──┘    │
   │                          (h8 hub)                        │
   └──────────────────────────────────────────────────────────┘
                        SOUTH (z+)
   ================================================================== */

export const V3_HALF = 56 // blocks range -56..55

export const V3_BONFIRE = { x: 0, z: 30 }
export const V3_MERCHANT = { x: -4.5, z: 34.5 }
export const V3_SPAWN = { x: 3, z: 33 }
export const V3_BOSS1_CENTER = { x: -32, z: -18 }
/** boss-1 fog line, the sealed span, the walk lane and the arena box */
export const V3_BOSS1_GATE = { z: -10, x0: -40.2, x1: -23.8, lane0: -35.4, lane1: -31.6 }
export const V3_BOSS1_ARENA = { x0: -39.6, x1: -24.4, z0: -24.4, z1: -10.8 }
export const V3_BOSS2_CENTER = { x: 34, z: -14 }
/** boss-2 fog line (the fortress gatehouse) */
export const V3_GATE2 = { x: 34, z: -6.5 }
export const V3_PYRO_ITEM = { x: 32, z: 14 }
/** the First Coal's pit — the sunken caldera north of the fortress */
export const V3_COAL_CENTER = { x: 34.5, z: -47.5 }
export const V3_COAL_ARENA = { x0: 26, x1: 43, z0: -50.5, z1: -41.8 }
/** the rockfall that seals the pit stair until the Flame King falls */
export const V3_PIT_RUBBLE = { x0: 44.5, x1: 48.5, z0: -41.5, z1: -38.2 }
/** lava hazards the undead refuse to wade into */
export const V3_LAVA_POOLS: [number, number, number][] = [
  [30, 25, 2],
  [40, 28, 1.5],
  [27, 5, 1.5],
  [44, 30, 1.5],
]

/* surface codes (index into V3_SURF_NAMES) */
const S_GRASS = 0
const S_DIRT = 1
const S_COBBLE = 2
const S_BRICK = 3
const S_MOSSY = 4
const S_ASH = 5
const S_LAVA = 6
const S_WATER = 7
const S_STONE = 8

export const V3_SURF_NAMES = ['grass', 'dirt', 'cobble', 'stonebrick', 'mossy', 'nether', 'lava', 'water', 'stone']

interface Vec3Lite { x: number; y: number; z: number }

export interface RegionCamV3 { x: number; z: number; y: number; dist: number; theta: number; phi: number }
export interface RegionV3 {
  id: string
  name: string
  sub: string
  dot: string
  desc: string
  design: string
  cam: RegionCamV3
}

export const REGIONS_V3: RegionV3[] = [
  {
    id: 'overview',
    name: 'نمای کل جهان',
    sub: 'همه‌چیز از یک نگاه — دو جاده، دو لندمارک',
    dot: '#9db2cc',
    desc: 'دنیا خوانا است و حالا حلقه است: از آتشگاه، جادهٔ غربی به دهکدهٔ فراموشی می‌رود و از آن‌جا پله‌های تپه، بالا به کلیسا؛ جادهٔ شرقی از خاکسترگاه می‌گذرد و به دروازهٔ دژ ذغال می‌رسد — و پله‌های کهنهٔ «نگهبانان» از دامنهٔ شرقی تپه، پایین به چمن و طاق چهارراه برمی‌گردند. حوضِ چمنِ غرب، پناهگاهِ ساکت میان‌راه است. برجِ ناقوسِ طلایی و دیوارهای دندانه‌دار دژ از هر نقطهٔ نقشه پیدا هستند — هیچ‌وقت گم نمی‌شوی.',
    design: 'قانون تازه: هر جاده یک مقصدِ قابل‌دیدن دارد و جهان یک حلقه است — مثل Firelink، میان‌بُرها جایزهٔ کاوش‌اند، نه خطای طراحی.',
    cam: { x: 0, z: 2, y: 16, dist: 105, theta: 0.0, phi: 0.94 },
  },
  {
    id: 'shrine',
    name: 'آتشگاه — معبد اخگر',
    sub: 'هاب بازی — همه‌ی راه‌ها از این‌جا می‌گذرند',
    dot: '#ffb347',
    desc: 'صفحه‌ی سنگی معبد روی تپه‌ی چمن نشسته: حلقه‌ی ستون‌های شکسته دور آتش کمپ، شمع‌ها و جاکلیدیِ سلاح، دو مجسمه‌ی تعظیم‌کننده سرِ چهارراه را نشان می‌دهند و طاقِ سنگی بالای آن مرز آتشگاه است. ویرانه‌ی تالارِ کهنه در چمنِ غرب ایستاده و نهالِ اخگر هنوز در آن گرم است. بازرگان چادرش را جنوب زده. از این‌جا هر دو لندمارک دیده می‌شوند: برج کلیسا در شمال‌غرب، دیوار دژ در شمال‌شرق.',
    design: 'مثل Firelink: هاب مرتفع است و کل جهانِ پیرامون را نشان می‌دهد — اما بدون هیاهوی بصری؛ چند عنصر، یک پیام.',
    cam: { x: 0, z: 30, y: 12, dist: 26, theta: 0.1, phi: 0.7 },
  },
  {
    id: 'village',
    name: 'دهکدهٔ فراموشی',
    sub: 'یک خیابان، چهار خانهٔ مبله، مزرعه و چاه',
    dot: '#b09055',
    desc: 'دهکده دیگر هزارتوی کوچه نیست: یک خیابان شمالی-جنوبی که چهار خانهٔ بزرگ با سقف شیروانی دو طرفش ایستاده‌اند — دیوارهای گچی و سنگی، پنجره‌های شیشه‌ای، دودکش آجری، و درونِ هر خانه تخت و میز و صندوق و صندوقچه دیده می‌شود. وسط خیابان میدان چاهِ سرپوشیده است و کنارش مزرعهٔ پرچین‌شده با ردیف‌های شخم‌خورده، کپه‌های هیزم و مترسکی که هنوز سرِ پاست. گاری واژگون کنار میدان مانده — و جنوبِ پرچین، خانهٔ سوخته‌ای که دودکش آجری‌اش هنوز ایستاده و کفِ زغالی‌اش قصهٔ آتش را می‌گوید. خالی‌شدگان همان‌جا که خانه‌هایشان را ساخته بودند می‌گردند.',
    design: 'درسِ V۲: پیچ‌وخمِ کوچه‌ها حذف شد. یک خیابانِ پهن یعنی دشمن همیشه جلوی چشم است و جنگ منصفانه.',
    cam: { x: -38, z: 17, y: 11, dist: 30, theta: 0.35, phi: 0.62 },
  },
  {
    id: 'parish',
    name: 'تپهٔ کلیسا',
    sub: 'برجِ ناقوس طلایی — لنگرِ دیداری نقشه',
    dot: '#ece8dc',
    desc: 'پله‌های وسیع از دهکده به فلات سنگی می‌رسند: پیشِ رو حیاطِ شوالیه (آرنای باس اول) با دروازهٔ مه، پشتِ آن کلیسای سنگی با پنجره‌های ماه‌گرفته و برج ناقوس با زنگ طلایی، سردابِ کوچکِ چسبیده به دیوار شمالی — و شرقِ کلیسا گورستانِ محصور: دروازهٔ طاق‌دار با فانوس، مسیرِ سنگیِ آیینی تا صلیبِ یادبود، آرامگاهِ سنگیِ نگهبانِ گورها با تابوت و کوزهٔ زرین، دیوارِ اُسکنت با طاقچه‌های شمع‌روشن، قبرِ تازه‌کنده‌ای که هنوز کسی شمعش را روشن نگه داشته، و مجسمهٔ عزادار که کلیدِ سردابه پای پایش خاک می‌خورد. سرِ پله‌های نگهبانان — میان‌بُرِ چمن — از دامنهٔ شرقی پیدا است. زنگ از آتشگاه پیدا است.',
    design: 'برج = قطب‌نما. مثل Undead Parish، بازیکن از هر جای نقشه می‌داند «مقصدها آن‌جاست» — بدون هیچ نشانگر HUD.',
    cam: { x: -32, z: -20, y: 16, dist: 40, theta: 0.75, phi: 0.6 },
  },
  {
    id: 'wastes',
    name: 'خاکسترگاه',
    sub: 'دریای خاکستر بین دو جاده',
    dot: '#ff6a1f',
    desc: 'شرق، زمین سیاه می‌شود: گودال‌های گدازه با لبه‌سنگیِ هشدار و نورِ سرخِ خودشان، سنجاق‌سوخته‌های ابسیدین، درخت‌های ذغالی، دو گاری سوخته و اردوی زاهد — چادر، آتشِ سرد و شعلهٔ آتش‌افروزی که زیرِ طاقِ دروازهٔ سوخته منتظر دستِ توست. باز هم همه‌چیز روی یک صفحهٔ باز: هیچ کمینی پشتِ دیوار نیست.',
    design: 'منطقهٔ «نفس‌گیری» بین دو باس — باز و روشن، با خطرهای دیدنی (گدازه‌ها) نه خطرهای پنهان.',
    cam: { x: 30, z: 16, y: 10, dist: 36, theta: -0.5, phi: 0.66 },
  },
  {
    id: 'fortress',
    name: 'دژ ذغال',
    sub: 'آخرین بارِ پادشاه شعله — دیوار، حیاط، تخت',
    dot: '#ffd23d',
    desc: 'دیوار دندانه‌دارِ عظیم از خاکستر بلند است؛ دروازه‌اش با دو برجِ فانوس‌دار و پنجره‌های تیرباران جلوه‌گر است و مهِ دروازه حیاطِ دژ را پنهان می‌کند: راهروی آیینیِ سنگی که از دروازه تا سکوی تختِ شاه می‌رود، کوره‌های فرو ریخته، چاهِ پادگان، خرابهٔ سربازخانه در کنار دیوار شرقی و پادشاهِ شعله که وسط حیاط منتظر است. پشتِ دیوار شمالی، دریاچهٔ گدازه می‌درخشد.',
    design: 'مثل Sen\'s Fortress: دیوار بیرونی، حیاط درونی، تختِ شاه به‌عنوان نقطهٔ فرارِ چشم — هندسه‌ی سه‌لایه‌ای که یک نگاه خوانده می‌شود.',
    cam: { x: 34, z: -14, y: 14, dist: 42, theta: 0.2, phi: 0.62 },
  },
  {
    id: 'pit',
    name: 'گودال گداخته',
    sub: 'بسترِ ذغالِ نخستین — جایی که جهان آغاز شد',
    dot: '#ff4a1f',
    desc: 'شکافی که مرگِ پادشاهِ شعله در زمین گشود: پله‌های سنگی از حاشیهٔ خاکسترگاه پایین می‌رود و به دهانه‌ای گود می‌رسد — کفِ سنگِ ناتری، حلقهٔ صخرهٔ سرخ‌داغ، و در میانِ آن حوضِ گدازه‌ای که نفس می‌کشد. ستون‌های ابسیدینِ شکسته و چکشِ نیم‌مدهٔ یک سازنده، بسترِ خوابِ آخرین لرد را نشان می‌دهند. ذغالِ نخستین آن‌جاست — سازنده‌ای خالی که هنوز با چکشِ شکسته‌اش، جهان را می‌سازد و نمی‌داند.',
    design: 'آرنای نهایی: دهانهٔ بسته = دیوار طبیعی، پلهٔ واحد = تنها راه؛ قلب گدازه وسط صحنه، هم خطر است هم چراغ.',
    cam: { x: 34.5, z: -46, y: 8, dist: 30, theta: 0.1, phi: 0.72 },
  },
]

/* ================================================================== */

interface RampDef { x0: number; z0: number; x1: number; z1: number; h0: number; h1: number; w: number; shortcut?: boolean }
const RAMPS: RampDef[] = [
  // west road — shrine → the village gate (straight, lantern-lined, 8→7)
  { x0: -9, z0: 28, x1: -37, z1: 28, h0: 8, h1: 7, w: 2.6 },
  // the village street itself (flat 7)
  { x0: -38, z0: 26, x1: -38, z1: 9, h0: 7, h1: 7, w: 2.6 },
  // parish climb, leg A — village → the switchback turn (7→10)
  { x0: -38, z0: 8, x1: -40, z1: -2, h0: 7, h1: 10, w: 2.6 },
  // parish climb, leg B — the turn → the hill top (10→12)
  { x0: -40, z0: -2, x1: -36, z1: -8, h0: 10, h1: 12, w: 2.6 },
  // east road — shrine → the ash line (8→6)
  { x0: 9, z0: 28, x1: 24, z1: 20, h0: 8, h1: 6, w: 2.6 },
  // the wastes road (flat 6, brown track through black ash)
  { x0: 24, z0: 20, x1: 33, z1: 7, h0: 6, h1: 6, w: 2.6 },
  // the gate ramp — up into the fortress mouth (6→9, about 1:4)
  { x0: 33, z0: 8, x1: 34, z1: -4, h0: 6, h1: 9, w: 3 },
  // ---- THE WATCHERS' STAIR — the shortcut loop ----
  // leg S1 — off the parish plateau's east flank (12→9, ≈1:4)
  { x0: -18, z0: -14, x1: -11, z1: -2, h0: 12, h1: 9, w: 2.2, shortcut: true },
  // leg S2 — down the meadow's spine toward the shrine (9→8)
  { x0: -11, z0: -2, x1: -6, z1: 14, h0: 9, h1: 8, w: 2.2, shortcut: true },
  // leg S3 — the last steps, aimed at the crossroads arch (flat 8)
  { x0: -6, z0: 14, x1: -2, z1: 19, h0: 8, h1: 8, w: 2.2, shortcut: true },
  // ---- THE COAL STAIR — down into the Molten Pit (sealed by rockfall) ----
  { x0: 47, z0: -39.5, x1: 41, z1: -43.5, h0: 6, h1: 2, w: 2.4 },
]

export class WorldV3 {
  group = new THREE.Group()
  mats = blockMaterials()
  private heights = new Int8Array(V3_HALF * 2 * V3_HALF * 2)
  private surf = new Uint8Array(V3_HALF * 2 * V3_HALF * 2)
  /** occupancy of every BUILT block (structures) — the physics world */
  private solid = new Uint8Array(64 * V3_HALF * 2 * V3_HALF * 2)
  private rng = mulberry32(3087)
  private fogGates: { mesh: THREE.Mesh; which: 1 | 2 }[] = []
  private L: Record<string, Vec3Lite[]> = {}
  private motes: THREE.Points | null = null
  private motesBase: Float32Array | null = null
  private motesPhase: Float32Array | null = null
  private embers: THREE.Points | null = null
  private embersBase: Float32Array | null = null
  private embersPhase: Float32Array | null = null
  private t = 0

  constructor() {
    this.genHeightmap()
    this.buildTerrain()
    this.buildShrine()
    this.buildVillage()
    this.buildForge()
    this.buildParish()
    this.buildWastes()
    this.buildFortress()
    this.buildPit()
    this.buildMeadow()
    this.buildFogGates()
    this.buildSky()
    this.buildAmbient()
    this.flush()
  }

  /* ================= heightmap queries ================= */

  private idx(x: number, z: number) {
    const bx = Math.min(V3_HALF * 2 - 1, Math.max(0, x + V3_HALF))
    const bz = Math.min(V3_HALF * 2 - 1, Math.max(0, z + V3_HALF))
    return bz * V3_HALF * 2 + bx
  }

  getH(x: number, z: number): number {
    return this.heights[this.idx(Math.round(x), Math.round(z))]
  }

  /** surface material code at a column (QA/probe/minimap) */
  surfAt(x: number, z: number): number {
    return this.surf[this.idx(Math.round(x), Math.round(z))]
  }

  /** walking surface y (top face of the top block) */
  surfaceAt(x: number, z: number): number {
    return this.getH(x, z) + 1
  }

  /* ================= physics queries (blocky collision) ================= */

  private cellIdx(x: number, z: number, y: number) {
    const bx = Math.min(V3_HALF * 2 - 1, Math.max(0, x + V3_HALF))
    const bz = Math.min(V3_HALF * 2 - 1, Math.max(0, z + V3_HALF))
    const by = Math.min(63, Math.max(0, y))
    return (by * V3_HALF * 2 + bz) * V3_HALF * 2 + bx
  }

  /** is there a BUILT block in this cell? */
  solidStruct(x: number, y: number, z: number): boolean {
    return this.solid[this.cellIdx(Math.round(x), Math.round(z), Math.round(y))] === 1
  }

  /** does this column block a body whose feet are at feetY?
      (terrain cliffs count as walls; one-block steps do not) */
  wallAt(x: number, z: number, feetY: number): boolean {
    const bx = Math.round(x)
    const bz = Math.round(z)
    if (this.getH(bx, bz) + 1 > feetY + 1.06) return true // cliff step
    const y0 = Math.floor(feetY + 1.06)
    const y1 = Math.floor(feetY + 1.55)
    for (let y = y0; y <= y1; y++) if (this.solid[this.cellIdx(bx, bz, y)] === 1) return true
    return false
  }

  /** highest surface this body can stand on near fromY (auto-steps one block) */
  supportAt(x: number, z: number, fromY: number): number {
    const bx = Math.round(x)
    const bz = Math.round(z)
    const h = this.getH(bx, bz)
    let best = h + 1
    const top = Math.min(63, Math.floor(fromY + 0.06))
    for (let y = top; y > h; y--) {
      if (this.solid[this.cellIdx(bx, bz, y)] === 1) {
        best = y + 1
        break
      }
    }
    return best
  }

  /** molten ground underfoot? (the wastes pools + the moat) */
  isLava(x: number, z: number): boolean {
    return this.surf[this.idx(Math.round(x), Math.round(z))] === S_LAVA
  }

  /* ================= heightmap generation ================= */

  private genHeightmap() {
    const r = mulberry32(977)
    const o1 = r() * 10, o2 = r() * 10, o3 = r() * 10

    for (let z = -V3_HALF; z < V3_HALF; z++) {
      for (let x = -V3_HALF; x < V3_HALF; x++) {
        // gentle rolling meadow — nothing a road can't smooth
        let h =
          6 +
          Math.sin(x * 0.1 + o1) * Math.cos(z * 0.09 + o2) * 1.1 +
          Math.sin(x * 0.23 + o2) * Math.sin(z * 0.19 + o3) * 0.55
        h = Math.round(h)

        /* ---- EMBER SHRINE plateau (the hub) ---- */
        h = this.plateEllipse(h, x, z, 0, 30, 16, 14, 8, 3)

        /* ---- FORGOTTEN VILLAGE floor ---- */
        h = this.plateRect(h, x, z, -47, -29, 8, 27, 7, 3)

        /* ---- PARISH HILL (big enough to hold church + tower + yard) ---- */
        h = this.plateEllipse(h, x, z, -32, -21, 20, 18, 12, 4)

        /* ---- ASH WASTES ---- */
        if (x >= 21) {
          const burn = 6 + Math.round(Math.sin(x * 0.33 + o2) * Math.cos(z * 0.27 + o3) * 0.6)
          h = Math.round(lerp(burn, h, smoothstep(19, 25, x)))
        }

        /* ---- CINDER FORTRESS courtyard incl. the gate apron ---- */
        h = this.plateRect(h, x, z, 21, 47, -33, -3, 9, 2.5)

        /* ---- THE MOLTEN PIT — a sunken caldera north of the fortress,
           floor of chiseled netherstone at h1, ringed by a h9 cliff rim.
           The COAL STAIR ramp (cut with the roads, below) is the only way
           in or out — the pit fights for you. ---- */
        const ep = Math.hypot((x - 34.5) / 10, (z + 45.5) / 5.8)
        if (ep <= 1) h = 1
        else if (ep <= 1.45) h = Math.max(h, 9)
        else if (ep <= 2.1) h = Math.max(h, lerp(9, h, smoothstep(1.45, 2.1, ep)))
        /* the maker's seam — a hollow the first builders left in the west
           rim, sealed again by their heir's illusion (see the game's secrets) */
        if (x >= 23 && x <= 24 && z >= -46 && z <= -45) h = 1

        /* ---- the burned homestead plot, south of the village fence ---- */
        h = this.plateRect(h, x, z, -45, -40, 29, 33, 7, 2)

        /* ---- roads & ramps cut last — closest centreline wins ---- */
        let bestD = Infinity
        let bestW = 0
        let bestTarget = 0
        for (const rp of RAMPS) {
          const dx = rp.x1 - rp.x0
          const dz = rp.z1 - rp.z0
          const len2 = dx * dx + dz * dz
          let t = ((x - rp.x0) * dx + (z - rp.z0) * dz) / len2
          t = Math.max(0, Math.min(1, t))
          const px = rp.x0 + dx * t
          const pz = rp.z0 + dz * t
          const d = Math.hypot(x - px, z - pz)
          if (d < bestD) {
            bestD = d
            bestW = rp.w
            bestTarget = lerp(rp.h0, rp.h1, t)
          }
        }
        if (bestD <= bestW) h = Math.round(bestTarget)
        else if (bestD < bestW + 1.6) h = Math.round(lerp(bestTarget, h, smoothstep(bestW, bestW + 1.6, bestD)))

        /* ---- world rim: a low ridge so the edge never shows the void ---- */
        const edge = Math.min(x + V3_HALF, V3_HALF - 1 - x, z + V3_HALF, V3_HALF - 1 - z)
        if (edge < 3) h = Math.max(h, 8 - edge)

        this.heights[this.idx(x, z)] = Math.max(0, Math.min(36, h))
      }
    }

    /* ---- surface codes ---- */
    for (let z = -V3_HALF; z < V3_HALF; z++) {
      for (let x = -V3_HALF; x < V3_HALF; x++) {
        let s: number = S_GRASS
        const dBon = Math.hypot(x - V3_BONFIRE.x, z - V3_BONFIRE.z)
        const edShrine = Math.hypot(x / 16, (z - 30) / 14)
        const edHill = Math.hypot((x + 32) / 20, (z + 21) / 18)
        const inVillage = x >= -47 && x <= -29 && z >= 8 && z <= 27
        const inWastes = x >= 23
        const inFortress = x >= 21 && x <= 47 && z >= -33 && z <= -3
        let onRoad = false
        let onShortcut = false
        for (const rp of RAMPS) {
          const dx = rp.x1 - rp.x0, dz = rp.z1 - rp.z0
          const len2 = dx * dx + dz * dz
          let t = ((x - rp.x0) * dx + (z - rp.z0) * dz) / len2
          t = Math.max(0, Math.min(1, t))
          const d = Math.hypot(x - (rp.x0 + dx * t), z - (rp.z0 + dz * t))
          if (d <= rp.w + 0.4) {
            if (rp.shortcut) onShortcut = true
            else onRoad = true
          }
        }

        if (edShrine <= 1) s = (x * 7 + z * 5) % 11 === 0 ? S_MOSSY : S_BRICK // cracked shrine tiles
        else if (inFortress) s = S_COBBLE // courtyard + apron
        else if (edHill <= 1) s = S_BRICK // parish flagstones
        else if (edHill <= 1.15) s = S_MOSSY // hill skirt
        else if (inVillage) {
          const street = x >= -40 && x <= -36
          const square = x >= -41 && x <= -35 && z >= 14 && z <= 20
          s = street || square ? S_COBBLE : S_GRASS
        } else if (inWastes) s = onRoad ? S_DIRT : S_ASH
        else if (onShortcut) s = S_MOSSY // the Watchers' Stair — ancient, green
        else if (onRoad) s = S_DIRT

        // the graveyard keeps bare earth
        if (x >= -27 && x <= -18 && z >= -33 && z <= -24 && edHill <= 1.05) s = S_DIRT
        // the yard's processional walk: gate → memorial plaza, plus the
        // mausoleum door path and its stone floor; moss creeps at the edges
        const inYard = x >= -26 && x <= -19 && z >= -32 && z <= -25
        if (inYard && (x * 7 + z * 11) % 9 === 0) s = S_MOSSY
        if (x >= -23 && x <= -22 && z >= -29 && z <= -23) s = S_COBBLE
        if (x >= -25 && x <= -20 && z >= -31 && z <= -30) s = S_COBBLE
        if (x >= -26 && x <= -24 && z === -31) s = S_COBBLE
        if (x === -26 && z >= -32 && z <= -31) s = S_BRICK // the mausoleum floor
        // the bonfire hearth keeps a mossy ring
        if (dBon < 3) s = S_MOSSY
        this.surf[this.idx(x, z)] = s
      }
    }

    /* ---- the wastes' lava pools: sunken, stone-rimmed, honest ---- */
    for (const [px, pz, pr] of V3_LAVA_POOLS) {
      for (let x = px - 4; x <= px + 4; x++)
        for (let z = pz - 4; z <= pz + 4; z++) {
          const d = Math.hypot(x - px, z - pz)
          if (d <= pr) {
            this.heights[this.idx(x, z)] = 5
            this.surf[this.idx(x, z)] = S_LAVA
          } else if (d <= pr + 1) {
            this.surf[this.idx(x, z)] = S_STONE // the warning rim
          }
        }
    }
    /* ---- the moat behind the fortress' north wall (unreachable, pure glow) ---- */
    for (let x = 23; x <= 45; x++)
      for (let z = -37; z <= -32; z++) {
        this.heights[this.idx(x, z)] = 5
        this.surf[this.idx(x, z)] = S_LAVA
      }

    /* ---- the Molten Pit floor — chiseled netherstone, stone rim ---- */
    for (let x = 20; x <= 50; x++)
      for (let z = -54; z <= -38; z++) {
        const ep = Math.hypot((x - 34.5) / 10, (z + 45.5) / 5.8)
        if (ep <= 1) this.surf[this.idx(x, z)] = S_ASH // the chiseled netherstone floor
        else if (ep <= 1.8) this.surf[this.idx(x, z)] = S_STONE
      }
    /* ---- the pit's burning heart — a lava lung in the south basin ---- */
    for (let x = 31; x <= 38; x++)
      for (let z = -46; z <= -42; z++) {
        if (Math.hypot((x - 34.5) / 2.6, (z + 44.2) / 1.9) <= 1) {
          this.heights[this.idx(x, z)] = 1
          this.surf[this.idx(x, z)] = S_LAVA
        } else if (Math.hypot((x - 34.5) / 3.4, (z + 44.2) / 2.7) <= 1) {
          this.surf[this.idx(x, z)] = S_STONE // the warning rim
        }
      }
    /* the maker's seam floor — chiseled like the rest of the bed */
    for (let x = 23; x <= 24; x++)
      for (let z = -46; z <= -45; z++) this.surf[this.idx(x, z)] = S_ASH

    /* ---- the meadow pond — one calm mirror on the west lawn ----
       one block deep, ring-flattened so the step in AND out is 1 */
    for (let x = -26; x <= -14; x++)
      for (let z = 29; z <= 39; z++) {
        const d = Math.hypot((x + 20) / 3.2, (z - 34) / 2.4)
        if (d <= 1) {
          this.heights[this.idx(x, z)] = 5
          this.surf[this.idx(x, z)] = S_WATER
        } else if (d <= 1.55) {
          this.heights[this.idx(x, z)] = 6
          if (this.surf[this.idx(x, z)] === S_GRASS) this.surf[this.idx(x, z)] = S_DIRT
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

  /* ================= terrain rendering ================= */

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
        if (nx < -V3_HALF || nx >= V3_HALF || nz < -V3_HALF || nz >= V3_HALF) return true
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
    for (let z = -V3_HALF; z < V3_HALF; z++) {
      for (let x = -V3_HALF; x < V3_HALF; x++) {
        const h = this.heights[this.idx(x, z)]
        const s = this.surf[this.idx(x, z)]
        put2(x, h + 0.5, z, V3_SURF_NAMES[s])
        if (s === S_LAVA) put2(x, h - 0.5, z, 'stone') // bed under the melt
        if (s === S_WATER) put2(x, h - 0.5, z, 'dirt') // bed under the mirror
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
    this.solid[this.cellIdx(x, z, y)] = 1
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
  /** remove queued blocks (carve a door); y bounds are block bottoms */
  private clearCol(mat: string, x: number, y0: number, y1: number, z: number) {
    const list = this.L[mat]
    if (list) {
      this.L[mat] = list.filter(
        (v) => !(v.x === x && v.z === z && v.y >= y0 + 0.5 && v.y <= y1 + 0.5)
      )
    }
    for (let y = y0; y <= y1; y++) this.solid[this.cellIdx(x, z, y)] = 0
  }
  /** stepped gable roof; ridge runs along the longer axis, 1-block eaves */
  private gableRoof(mat: string, x0: number, x1: number, z0: number, z1: number, yBase: number) {
    const wideX = x1 - x0 >= z1 - z0
    if (wideX) {
      const span = Math.floor((x1 - x0) / 2)
      for (let i = 0; i <= span; i++) {
        this.fill(mat, x0 + i, x1 - i, yBase + i, yBase + i, z0 - 1, z1 + 1)
      }
    } else {
      const span = Math.floor((z1 - z0) / 2)
      for (let i = 0; i <= span; i++) {
        this.fill(mat, x0 - 1, x1 + 1, yBase + i, yBase + i, z0 + i, z1 - i)
      }
    }
  }
  /** a dead, burned tree — trunk + two broken arms */
  private deadTree(mat: string, x: number, y: number, z: number, tall = 3) {
    this.col(mat, x, z, y, y + tall - 1)
    this.b(mat, x + 1, y + tall - 1, z)
    this.b(mat, x, y + tall - 2, z - 1)
  }
  /** an oak tree — blocky canopy, Minecraft silhouette */
  private oakTree(x: number, y: number, z: number) {
    const th = 3
    this.col('log', x, z, y, y + th - 1)
    this.fill('leaves', x - 1, x + 1, y + th - 1, y + th, z - 1, z + 1)
    this.b('leaves', x, y + th + 1, z)
    this.b('leaves', x - 1, y + th, z)
    this.b('leaves', x + 1, y + th, z)
    this.b('leaves', x, y + th, z - 1)
    this.b('leaves', x, y + th, z + 1)
  }
  /** lantern post: log pole + glow head — the road's waymarks */
  private lantern(x: number, y: number, z: number, light = false) {
    this.col('log', x, z, y, y + 1)
    this.b('glow', x, y + 2, z)
    if (light) {
      const pl = new THREE.PointLight(0xffb060, 1.5, 11, 1.7)
      pl.position.set(x + 0.5, y + 3, z + 0.5)
      this.group.add(pl)
    }
  }
  private flush() {
    for (const [matKey, list] of Object.entries(this.L)) {
      const mat = this.mats[matKey]
      if (mat && list.length > 0) this.buildInstanced(mat, list)
    }
    this.L = {}
  }

  /* ================= EMBER SHRINE (the hub) ================= */

  private buildShrine() {
    const y0 = 9 // plaza surface (floor h=8)

    /* the colonnade ring around the bonfire — gaps open W/E for the roads */
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2
      const px = Math.round(Math.cos(a) * 7)
      const pz = 30 + Math.round(Math.sin(a) * 6)
      // keep the west & east road mouths and the merchant cove clear
      if (Math.abs(pz - 30) <= 2 && Math.abs(px) >= 5) continue
      if (Math.hypot(px - V3_MERCHANT.x, pz - V3_MERCHANT.z) < 4.4) continue
      const tall = [4, 3, 5, 2, 4, 3, 5, 2, 4, 3, 5, 2][i % 12]
      this.col('stonebrick', px, pz, y0, y0 + tall - 1)
      if (tall >= 4 && i % 3 === 0) this.b('glow', px, y0 + tall, pz)
      if (tall < 3) this.b('cobble', px + 1, y0, pz + 1) // a fallen drum
    }

    /* the crossroads arch north of the plaza — the world's signpost */
    this.fill('stonebrick', -3, -3, y0, y0 + 3, 20, 21)
    this.fill('stonebrick', 3, 3, y0, y0 + 3, 20, 21)
    this.fill('stonebrick', -3, 3, y0 + 4, y0 + 4, 20, 21) // lintel, 4-clear beneath
    this.b('gold', 0, y0 + 5, 20) // the sigil

    /* two bowing statues flank the crossroads */
    for (const sx of [-2, 2]) {
      this.b('mossy', sx, y0, 17)
      this.fill('darkstone', sx, sx, y0 + 1, y0 + 2, 17, 17)
      this.b('cobble', sx, y0 + 3, 17) // the bowed head
    }

    /* sitting stones on the hearth's north side (the south stays open for the spawn) */
    for (const dz of [-2] as const) {
      this.b('cobble', V3_BONFIRE.x - 3, y0, V3_BONFIRE.z + dz)
      this.b('cobble', V3_BONFIRE.x + 3, y0, V3_BONFIRE.z + dz)
    }
    this.lantern(-9, y0, 23, true)
    this.lantern(9, y0, 23, true)
    this.lantern(-9, y0, 37)
    this.lantern(9, y0, 37)

    /* mossy benches facing the fire */
    this.fill('mossy', -5, -4, y0, y0, 27, 27)
    this.fill('mossy', 4, 5, y0, y0, 27, 27)

    /* candle stubs ringed around the hearth — small fires remember */
    for (const [cx, cz] of [[-2, 28], [2, 28], [-2, 32], [2, 32]] as const) this.b('gold', cx, y0, cz)

    /* a weapon rack by the east bench — someone kept watch here
       (kept clear of the east road mouth) */
    this.b('log', 8, y0, 24)
    this.b('log', 10, y0, 24)
    this.fill('plank', 8, 10, y0 + 1, y0 + 1, 24, 24)

    /* banner poles flanking the crossroads arch — crimson cloth
       still hangs from the cross-arms */
    for (const px of [-5, 5]) {
      this.col('log', px, 19, y0, y0 + 3)
      this.b('log', px, y0 + 3, 20)     // the cross-arm
      this.b('woolred', px, y0 + 1, 20) // the cloth
      this.b('woolred', px, y0 + 2, 20)
      this.b('gold', px, y0 + 4, 19)    // the finial
    }

    /* rubble spills outside the colonnade — age without clutter */
    for (const [rx, rz] of [[-10, 24], [11, 36], [-6, 40]] as const) {
      this.b('cobble', rx, y0, rz)
      this.b('mossy', rx + 1, y0, rz)
      this.b('cobble', rx, y0, rz + 1)
    }

    /* the ruined annex on the plaza's west lawn — the shrine's old hall */
    for (let x = -13; x <= -8; x++) {
      this.col('mossy', x, 36, y0, y0 + 1)
      if (x % 2 === 0) this.b('stonebrick', x, y0 + 2, 36)
    }
    for (let z = 37; z <= 40; z++) {
      this.col('stonebrick', -13, z, y0, y0 + 1)
      this.b('mossy', -8, y0, z)
    }
    this.fill('cobble', -12, -9, y0, y0, 38, 39) // fallen roof rubble
    /* the ember sapling — a shoot of the First Coal, still warm */
    this.col('log', -10, 39, y0, y0 + 1)
    this.b('glow', -10, y0 + 2, 39)
    this.b('leaves', -9, y0 + 2, 39)
    this.b('leaves', -11, y0 + 2, 39)
    this.b('leaves', -10, y0 + 2, 38)
  }

  /* ================= FORGOTTEN VILLAGE ================= */

  private buildVillage() {
    const y0 = 8 // village surface (floor h=7)

    /** one honest home: walls you can name, glass windows, a gable
        roof, a brick chimney — and a FURNISHED interior, so a glance
        through the door says home, not rubble.
        plaster houses carry a timber-beam course under the eaves. */
    const house = (
      x0: number, x1: number, z0: number, z1: number,
      doorSide: 'E' | 'W',
      wall: 'cobble' | 'plaster',
      lit: boolean,
      bed: [number, number],
      table: [number, number],
      chest: [number, number],
      shelf: [number, number],
      barrel: [number, number]
    ) => {
      for (let x = x0; x <= x1; x++)
        for (let z = z0; z <= z1; z++) {
          const edge = x === x0 || x === x1 || z === z0 || z === z1
          if (!edge) continue
          this.col(wall, x, z, y0, y0 + 1)
        }
      // door columns — computed early so the beam course can clear them
      const dz = Math.floor((z0 + z1) / 2)
      const dx = doorSide === 'E' ? x1 : x0
      // top course: timber beams on plaster homes, stone on the rest
      // (the two door columns stay open — a lintel here would seal
      // anyone standing on the raised plank floor inside the house)
      const beam = wall === 'plaster' ? 'log' : wall
      for (let x = x0; x <= x1; x++)
        for (let z = z0; z <= z1; z++) {
          const edge = x === x0 || x === x1 || z === z0 || z === z1
          if (!edge) continue
          if (x === dx && (z === dz || z === dz + 1)) continue // over the door
          const corner = (x === x0 || x === x1) && (z === z0 || z === z1)
          this.b(corner ? 'darkstone' : beam, x, y0 + 2, z)
        }
      // door — 2 wide, 2 tall, on the street side
      this.clearCol(wall, dx, y0, y0 + 1, dz)
      this.clearCol(wall, dx, y0, y0 + 1, dz + 1)
      // street window beside the door — the life inside shows through
      this.clearCol(wall, dx, y0 + 1, y0 + 1, dz - 1)
      this.b('glass', dx, y0 + 1, dz - 1)
      // a moon-glass window on the back wall
      const bx = doorSide === 'E' ? x0 : x1
      this.clearCol(wall, bx, y0 + 1, y0 + 1, dz)
      this.b('glass', bx, y0 + 1, dz)
      // plank floor — one step up into the home
      for (let x = x0 + 1; x <= x1 - 1; x++)
        for (let z = z0 + 1; z <= z1 - 1; z++) this.b('plank', x, y0, z)
      // gable roof + a brick chimney with its charred crown
      this.gableRoof('roof', x0, x1, z0, z1, y0 + 3)
      const chx = doorSide === 'E' ? x0 + 1 : x1 - 1
      this.col('brick', chx, z0, y0 + 5, y0 + 7)
      this.b('coal', chx, y0 + 8, z0)
      /* ---- the interior ---- */
      this.b('plank', bed[0], y0 + 1, bed[1])        // the pillow end
      this.b('woolred', bed[0], y0 + 1, bed[1] - 1)  // a crimson blanket
      this.b('log', bed[0], y0 + 2, bed[1])          // the headboard
      this.b('plank', table[0], y0 + 1, table[1])    // the table
      this.b(lit ? 'glow' : 'gold', table[0], y0 + 2, table[1]) // its candle
      this.b('crate', chest[0], y0 + 1, chest[1])    // a locked chest
      this.b('shelf', shelf[0], y0 + 1, shelf[1])    // a record shelf
      this.b('log', barrel[0], y0 + 1, barrel[1])    // a rain barrel
    }

    /* four homes along the single street — doors facing x=−38 */
    house(-46, -41, 22, 26, 'E', 'cobble', false,
      [-45, 25], [-42, 23], [-44, 25], [-43, 23], [-45, 23]) // A (south-west)
    house(-46, -41, 11, 16, 'E', 'plaster', true,
      [-45, 12], [-42, 15], [-44, 15], [-44, 12], [-42, 12]) // D (north-west, still lit)
    house(-35, -30, 19, 24, 'W', 'plaster', false,
      [-31, 20], [-34, 23], [-34, 20], [-33, 20], [-31, 23]) // B (south-east)
    house(-35, -30, 10, 15, 'W', 'cobble', false,
      [-31, 14], [-34, 11], [-33, 14], [-34, 14], [-31, 11]) // C (north-east)
    // the one lit window of the village — a warm point in the dark
    const dLight = new THREE.PointLight(0xffb060, 1.1, 8, 1.8)
    dLight.position.set(-42.5, y0 + 2.2, 13.5)
    this.group.add(dLight)

    /* the last field — tilled rows, hay, a scarecrow still on duty */
    for (let x = -46; x <= -42; x++) {
      this.b('plank', x, y0, 18) // fence rails
      this.b('plank', x, y0, 21)
    }
    for (let z = 18; z <= 21; z++) {
      this.b('plank', -46, y0, z)
      if (z !== 20) this.b('plank', -42, y0, z) // the gate gap
    }
    for (const [fx, fz] of [[-46, 18], [-42, 18], [-46, 21], [-42, 21]] as const)
      this.b('log', fx, y0 + 1, fz) // corner posts
    for (let x = -45; x <= -43; x++) {
      this.b('dirt', x, y0, 19) // tilled rows
      this.b('dirt', x, y0, 20)
    }
    this.b('hay', -44, y0 + 1, 19)
    this.b('hay', -43, y0 + 1, 20)
    this.col('log', -45, 20, y0, y0 + 2) // the scarecrow's pole
    this.b('plank', -44, y0 + 2, 20)     // one arm
    this.b('gold', -45, y0 + 3, 20)      // its gourd head

    /* the well — roofed now, two dark mirrors of water */
    for (const [wx, wz] of [[-39, 16], [-37, 16], [-39, 18], [-37, 18]] as const) this.b('cobble', wx, y0, wz)
    this.b('water', -38, y0, 17)
    this.b('water', -38, y0, 18)
    this.fill('log', -39, -39, y0, y0 + 2, 17, 17)
    this.fill('log', -37, -37, y0, y0 + 2, 17, 17)
    this.fill('plank', -39, -37, y0 + 3, y0 + 3, 16, 19)
    this.b('log', -38, y0 + 2, 17) // the windlass

    /* the woodshed at the north end — open front, stacked logs */
    this.fill('log', -46, -46, y0, y0 + 1, 8, 8)
    this.fill('log', -42, -42, y0, y0 + 1, 8, 8)
    this.fill('plank', -46, -42, y0 + 2, y0 + 2, 8, 9)
    this.fill('log', -45, -43, y0, y0, 9, 9) // the stack

    /* the overturned cart by the square + crates against the east homes */
    this.fill('plank', -33, -32, y0, y0, 17, 18)
    this.b('log', -31, y0, 17)
    this.b('log', -31, y0, 18)
    this.b('plank', -34, y0 + 1, 18)
    this.b('crate', -30, y0, 11)
    this.b('crate', -30, y0 + 1, 11)

    /* low field walls close the village — with honest gaps, never mazes */
    for (let x = -46; x <= -30; x++) {
      if (x >= -40 && x <= -34) continue // the street mouth (south)
      if (Math.abs(x + 44) <= 1) continue // a gap in the south wall
      if (x >= -46 && x <= -42) continue // the woodshed stands in for the north wall
      this.b('mossy', x, y0, 27)
      this.b('mossy', x, y0, 8) // north, the street mouth stays open
    }
    for (let z = 9; z <= 26; z++) {
      if (Math.abs(z - 12) <= 1) continue // the west gate
      this.b('mossy', -47, y0, z)
      if (z < 12 || z > 13) this.b('mossy', -29, y0, z) // one east gap
    }

    /* lanterns at the square + a dead tree */
    this.lantern(-41, y0, 14, true)
    this.lantern(-35, y0, 20)
    this.deadTree('log', -31, y0, 10)

    /* hay bales beside the woodshed */
    this.b('hay', -43, y0, 10)
    this.b('hay', -44, y0, 10)

    /* a leaning notice board by the square's south lip
       (kept clear of the hollow's well-side patrol) */
    this.b('log', -41, y0, 17)
    this.b('log', -41, y0, 19)
    this.fill('plank', -41, -41, y0 + 1, y0 + 1, 17, 19)

    /* the burned homestead — the fire came through and never left:
       a chimney that outlived the house, charred wall stubs, a
       slumped roof beam, and the floor it burned down to */
    const ry0 = 8 // homestead plot (floor h=7)
    this.col('brick', -45, 31, ry0, ry0 + 3)
    this.b('coal', -45, ry0 + 4, 31)
    // north wall stubs, charred at the top
    this.b('cobble', -44, ry0, 29)
    this.b('darkstone', -44, ry0 + 1, 29)
    this.b('cobble', -43, ry0, 29)
    this.b('cobble', -42, ry0, 29)
    this.b('darkstone', -42, ry0 + 1, 29)
    // side stubs carry the one beam that fell whole
    this.col('cobble', -45, 30, ry0, ry0 + 1)
    this.col('darkstone', -45, 32, ry0, ry0 + 1)
    this.col('cobble', -40, 30, ry0, ry0 + 1)
    this.col('darkstone', -40, 32, ry0, ry0 + 1)
    this.fill('darkstone', -45, -40, ry0 + 2, ry0 + 2, 32, 32)
    // the charred floor + the rubble the fire left
    this.fill('darkstone', -43, -41, ry0, ry0, 30, 31)
    this.b('coal', -43, ry0, 32)
    this.b('cobble', -42, ry0, 32)
    this.b('mossy', -44, ry0, 31)
    this.b('cobble', -41, ry0, 29)
    this.deadTree('log', -39, this.getH(-39, 33) + 1, 33, 2)
  }

  /* ================= THE FORGE — the smith's rebuilt home ================= */

  /* the burned homestead plot (x -45..-40, z 29..33, floor h7) is where
     the fire came through and never left — and where the forge-keeper
     stayed, rebuilding his furnace from his own ashes. The old chimney
     now vents HIS furnace; the anvil sits where the table stood. */
  private buildForge() {
    const ry0 = 8
    // the furnace — a cobble box rising against the old chimney, a
    // burning mouth facing the yard, a darkstone crown venting soot
    this.fill('cobble', -44, -43, ry0, ry0 + 2, 32, 33)
    this.fill('darkstone', -44, -43, ry0 + 3, ry0 + 3, 32, 33)
    this.b('coal', -44, ry0 + 4, 32)
    this.b('coal', -43, ry0 + 4, 33)
    this.b('glow', -44, ry0 + 1, 31) // the mouth, burning
    this.b('glow', -43, ry0 + 1, 31)
    const forgeLight = new THREE.PointLight(0xff7a30, 2.2, 10, 1.7)
    forgeLight.position.set(-43.5, ry0 + 2.6, 31.2)
    this.group.add(forgeLight)
    // the anvil — log foot, darkstone body, where every blade is judged
    this.b('log', -41, ry0, 32)
    this.b('darkstone', -41, ry0 + 1, 32)
    // quench barrel + fuel + crate of blanks by the wall
    this.b('crate', -42, ry0, 33)
    this.b('coal', -40, ry0, 31)
    this.b('coal', -40, ry0, 30)
    this.fill('crate', -45, -45, ry0, ry0 + 1, 29, 29)
    // iron blanks laid out on the charred floor, waiting for the hammer
    this.b('darkstone', -42, ry0, 31)
    this.b('darkstone', -41, ry0, 30)
  }

  /* ================= THE MOLTEN PIT — the final arena ================= */

  /* a sunken caldera north of the fortress: chiseled netherstone floor
     (h1) ringed by a h9 cliff, one stair (the COAL STAIR) as the only
     way in. A lava lung burns in the south basin; broken obsidian
     spires, ember vents and a half-buried builder's hammer dress the
     bed where the First Coal waits. The stair head is sealed by a
     rockfall until the Flame King falls — then the Vale cracks open. */
  private pitRubble: THREE.Group | null = null

  private buildPit() {
    const floorY = 2 // top face of the h1 floor
    // broken obsidian spires around the arena's edge — the pit's crown
    const spires: [number, number, number][] = [
      [27, -41, 3], [42, -42, 4], [28, -50, 4], [40, -50, 3], [36, -51, 2], [31, -52, 2],
    ]
    for (const [sx, sz, h] of spires) {
      this.col('darkstone', sx, sz, floorY, floorY + h - 1)
      this.b('coal', sx, floorY + h, sz)
    }
    // ember vents — cracks in the bedrock breathing fire (lit)
    for (const [vx, vz] of [[30, -44], [39, -47], [33, -50]] as const) {
      this.b('cobble', vx, floorY - 1, vz)
      this.b('glow', vx, floorY, vz)
    }
    const ventLight1 = new THREE.PointLight(0xff6a20, 1.6, 12, 1.8)
    ventLight1.position.set(30.5, floorY + 1.4, -43.5)
    this.group.add(ventLight1)
    const ventLight2 = new THREE.PointLight(0xff6a20, 1.6, 12, 1.8)
    ventLight2.position.set(39.5, floorY + 1.4, -46.5)
    this.group.add(ventLight2)
    // the Builder's hammer — half-buried where he dropped it, leaping in
    this.fill('log', 33, 33, floorY, floorY + 2, -52, -52)
    this.fill('darkstone', 32, 35, floorY + 2, floorY + 3, -52, -52)
    this.b('coal', 31, floorY, -52)
    this.b('coal', 36, floorY, -53)
    // scattered obsidian shards + cooling coal beds
    for (const [dx, dz] of [[29, -46], [38, -43], [26, -48], [41, -49], [35, -49]] as const) {
      this.b('darkstone', dx, floorY - 1, dz)
    }

    /* the maker's seam — the hollow in the west rim (carved in the
       heightmap): darkstone walls + a low vault roof; its mouth is
       sealed by the game's illusion blocks, not by real stone */
    this.fill('darkstone', 23, 24, floorY + 2, floorY + 3, -46, -45) // the vault roof
    this.b('coal', 25, floorY, -47) // a coal seam on the floor, pointing at it
    this.b('darkstone', 26, floorY, -46) // spilled rubble by the mouth

    // the rockfall that seals the stair — pure visual; the game clamps
    // the body until the Flame King falls, then this group is hidden
    const rubble = new THREE.Group()
    const lam = (c: number) => new THREE.MeshLambertMaterial({ color: c })
    const cobble = this.mats.cobble as THREE.Material
    const coal = this.mats.coal as THREE.Material
    const stone = this.mats.stone as THREE.Material
    const seedR = mulberry32(5150)
    for (let x = 45; x <= 48; x++) {
      for (let z = -41; z <= -38; z++) {
        const n = Math.floor(seedR() * 3)
        for (let i = 0; i <= n; i++) {
          const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), i === 0 ? cobble : seedR() < 0.4 ? coal : stone)
          m.position.set(x + (seedR() - 0.5) * 0.3, 6.5 + i + 0.5 + seedR() * 0.2, z + (seedR() - 0.5) * 0.3)
          m.rotation.y = seedR() * 0.6
          m.castShadow = true
          m.receiveShadow = true
          rubble.add(m)
        }
      }
    }
    // a warning cairn on the approach — travelers marked the slide
    const cairn = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), lam(0x8a8578))
    cairn.position.set(49.5, 7.5, -38.5)
    rubble.add(cairn)
    rubble.visible = true // sealed until the Flame King falls
    this.group.add(rubble)
    this.pitRubble = rubble
  }

  /** the Flame King is dead — the Vale cracks, the rockfall rolls clear */
  setPitOpen(open: boolean) {
    if (this.pitRubble) this.pitRubble.visible = !open
  }

  /** secrets: illusion walls live in the same collision grid as stone —
      the game toggles their cells when the spell breaks */
  markSolid(x: number, y: number, z: number, on: boolean) {
    this.solid[this.cellIdx(Math.round(x), Math.round(z), Math.round(y))] = on ? 1 : 0
  }

  /* ================= PARISH HILL — church, graveyard, arena ================= */

  private buildParish() {
    const y0 = 13 // hill surface (floor h=12)
    const gz = V3_BOSS1_GATE.z

    /* ---------- the knight's arena (boss 1) ---------- */
    // south gate line at z=-10: wall segments leave a lane x −35..−32
    this.fill('stonebrick', -40, -37, y0, y0 + 3, gz, gz)
    this.fill('stonebrick', -30, -24, y0, y0 + 3, gz, gz)
    // gate pillars + lintel over the lane
    this.fill('stonebrick', -36, -36, y0, y0 + 4, gz, gz)
    this.fill('stonebrick', -31, -31, y0, y0 + 4, gz, gz)
    this.fill('darkstone', -36, -31, y0 + 5, y0 + 5, gz, gz)
    this.b('glow', -36, y0 + 4, gz - 1)
    this.b('glow', -31, y0 + 4, gz - 1)
    // side walls (2 tall) seal the arena east & west
    for (let z = gz - 1; z >= -23; z--) {
      this.fill('cobble', -40, -40, y0, y0 + 1, z, z)
      this.fill('cobble', -24, -24, y0, y0 + 1, z, z)
    }
    // broken columns along the church front
    for (const cx of [-39, -35, -29, -25]) {
      this.col('stonebrick', cx, -24, y0, y0 + 2)
      if (cx !== -35) this.b('glow', cx, y0 + 3, -24)
    }

    /* ---------- the church ---------- */
    // nave: walls x −41..−30, z −33..−25, 6 tall, door south x −37..−36
    for (let x = -41; x <= -30; x++)
      for (let z = -33; z <= -25; z++) {
        const edge = x === -41 || x === -30 || z === -33 || z === -25
        if (!edge) continue
        this.col('stonebrick', x, z, y0, y0 + 5)
      }
    this.clearCol('stonebrick', -37, y0, y0 + 2, -25)
    this.clearCol('stonebrick', -36, y0, y0 + 2, -25)
    // tall moon-glass windows on both long walls
    for (let z = -31; z >= -27; z -= 2) {
      this.clearCol('stonebrick', -41, y0 + 3, y0 + 3, z)
      this.b('glass', -41, y0 + 3, z)
      this.clearCol('stonebrick', -30, y0 + 3, y0 + 3, z)
      this.b('glass', -30, y0 + 3, z)
    }
    // darkstone buttresses frame the corners
    for (const [bx, bz] of [[-41, -33], [-41, -25], [-30, -33], [-30, -25]] as const) {
      this.b('darkstone', bx, y0, bz)
      this.b('darkstone', bx, y0 + 1, bz)
    }
    // the steep roof — south eave hangs out, north side tucks into the tower
    for (let i = 0; i <= 5; i++) {
      this.fill('darkstone', -41 + i, -30 - i, y0 + 6 + i, y0 + 6 + i, -33, -24)
    }
    // the rose window on the west gable
    this.clearCol('stonebrick', -41, y0 + 4, y0 + 4, -29)
    this.b('rose', -41, y0 + 4, -29)

    /* the bell tower — the landmark (5×5, gold bell, spire) */
    for (let x = -38; x <= -34; x++)
      for (let z = -38; z <= -34; z++) {
        const edge = x === -38 || x === -34 || z === -38 || z === -34
        if (!edge) continue
        this.col('stonebrick', x, z, y0, y0 + 9)
      }
    // belfry openings (2 wide) on all four faces
    this.clearCol('stonebrick', -36, y0 + 8, y0 + 9, -34)
    this.clearCol('stonebrick', -37, y0 + 8, y0 + 9, -34)
    this.clearCol('stonebrick', -36, y0 + 8, y0 + 9, -38)
    this.clearCol('stonebrick', -37, y0 + 8, y0 + 9, -38)
    this.clearCol('stonebrick', -34, y0 + 8, y0 + 9, -36)
    this.clearCol('stonebrick', -34, y0 + 8, y0 + 9, -37)
    this.clearCol('stonebrick', -38, y0 + 8, y0 + 9, -36)
    this.clearCol('stonebrick', -38, y0 + 8, y0 + 9, -37)
    // the gold bell, hung in the opening
    this.fill('gold', -36, -35, y0 + 8, y0 + 9, -36, -36)
    // the spire + finial
    this.fill('darkstone', -38, -34, y0 + 10, y0 + 10, -38, -34)
    this.fill('darkstone', -37, -35, y0 + 11, y0 + 11, -37, -35)
    this.b('darkstone', -36, y0 + 12, -36)
    this.b('gold', -36, y0 + 13, -36)

    /* ---------- the church interior ---------- */
    for (const bz of [-31, -29]) {
      this.fill('plank', -39, -38, y0, y0, bz, bz)
      this.fill('plank', -33, -32, y0, y0, bz, bz)
    }
    // the altar + candle + cross
    this.fill('plank', -37, -36, y0, y0, -32, -32)
    this.b('glow', -36, y0 + 1, -32)
    this.fill('gold', -36, -36, y0 + 2, y0 + 3, -32, -32)
    const altarLight = new THREE.PointLight(0xffc070, 1.2, 10, 1.8)
    altarLight.position.set(-35.5, y0 + 2.5, -31.5)
    this.group.add(altarLight)

    /* ---------- the graveyard (east of the church) — a true cemetery:
       walled, gated, with a warden's mausoleum, a columbarium wall, a
       memorial cross on its own plaza, and two dozen graves of every
       kind — the parish outlived its town and buried it here ---------- */

    /* the perimeter — stonebrick base with mossy coping, 2 tall.
       The north wall's east span becomes the columbarium (3 tall with
       urn niches); the mausoleum provides the north wall's west span. */
    // south wall, west of the gate (corner pillar at −27, collapsed run at −26)
    this.fill('stonebrick', -25, -25, y0, y0, -24, -24)
    this.fill('mossy', -25, -25, y0 + 1, y0 + 1, -24, -24)
    // south wall, east of the gate (corner pillar at −18)
    this.fill('stonebrick', -20, -19, y0, y0, -24, -24)
    this.fill('mossy', -20, -19, y0 + 1, y0 + 1, -24, -24)
    // east wall — with a ruined breach (the mortals stopped maintaining it)
    for (let z = -32; z <= -25; z++) {
      this.b('stonebrick', -18, y0, z)
      if (z === -29 || z === -28) this.b('mossy', -18, y0, z) // crumbling teeth
      else this.b('mossy', -18, y0 + 1, z)
    }
    // west wall south of the mausoleum
    for (let z = -29; z <= -25; z++) {
      this.b('stonebrick', -27, y0, z)
      this.b('mossy', -27, y0 + 1, z)
    }
    /* the south gate — pillars 3 tall, darkstone lintel over the gap */
    this.fill('stonebrick', -24, -24, y0, y0 + 2, -24, -24)
    this.fill('stonebrick', -21, -21, y0, y0 + 2, -24, -24)
    this.fill('darkstone', -24, -21, y0 + 3, y0 + 3, -24, -24)
    this.b('glow', -24, y0 + 4, -24) // lanterns crown the gate pillars
    this.b('glow', -21, y0 + 4, -24)
    /* corner pillars — lantern-capped, the yard reads from the shortcut */
    for (const [cx, cz] of [[-27, -24], [-18, -24], [-18, -33]] as const) {
      this.col('stonebrick', cx, cz, y0, y0 + 2)
      this.b('mossy', cx, y0 + 3, cz)
      this.b('glow', cx, y0 + 4, cz)
    }
    /* the leak seals — collapsed wall runs between the yard's corner
       and the arena's broken colonnade (they read as ruins, and they
       keep the knight's court sealed behind its fog gate) */
    this.b('mossy', -28, y0, -24)
    this.b('cobble', -28, y0 + 1, -24)
    this.b('cobble', -26, y0, -24)
    this.b('mossy', -26, y0 + 1, -24)

    /* ---------- the Warden's mausoleum (north-west corner) ---------- */
    // shell: 3 tall, slab roof, darkstone door frame on the east face
    // (corner cells belong to the east/west faces — no double fills)
    this.fill('stonebrick', -27, -27, y0, y0 + 2, -33, -30) // west face
    this.fill('stonebrick', -25, -25, y0, y0 + 2, -33, -30) // east face
    this.fill('stonebrick', -26, -26, y0, y0 + 2, -30, -30) // south face
    this.fill('stonebrick', -26, -26, y0, y0 + 2, -33, -33) // north face
    this.clearCol('stonebrick', -25, y0, y0 + 1, -32) // swap the jambs to darkstone
    this.clearCol('stonebrick', -25, y0, y0 + 1, -30)
    this.b('darkstone', -25, y0, -32) // the door frame
    this.b('darkstone', -25, y0 + 1, -32)
    this.b('darkstone', -25, y0, -30)
    this.b('darkstone', -25, y0 + 1, -30)
    this.clearCol('stonebrick', -25, y0, y0 + 1, -31) // the doorway
    this.fill('darkstone', -27, -25, y0 + 3, y0 + 3, -33, -30) // slab roof
    this.b('mossy', -27, y0 + 4, -33) // moss crown + a stone cross finial
    this.b('darkstone', -26, y0 + 4, -31)
    this.b('darkstone', -26, y0 + 5, -31)
    // inside: a plank bier with a gold urn, a candle niche in the wall
    this.clearCol('stonebrick', -26, y0 + 1, y0 + 1, -33) // open the niche
    this.b('plank', -26, y0, -32)
    this.b('gold', -26, y0 + 1, -32)
    this.b('glow', -26, y0 + 1, -33)
    const mausLight = new THREE.PointLight(0xffc890, 1.4, 9, 1.8)
    mausLight.position.set(-24.4, y0 + 1.8, -31)
    this.group.add(mausLight)

    /* the columbarium — the north wall's east span, 3 tall with urn
       niches glowing between the bricks */
    for (let x = -24; x <= -19; x++) {
      this.b('stonebrick', x, y0, -33)
      this.b(x === -24 || x === -22 || x === -20 ? 'glow' : 'stonebrick', x, y0 + 1, -33)
      this.b('mossy', x, y0 + 2, -33)
    }

    /* ---------- the memorial plaza (centre) ---------- */
    this.col('stonebrick', -22, -30, y0, y0) // the cross's plinth
    this.b('cobble', -22, y0 + 1, -30)
    this.b('cobble', -22, y0 + 2, -30)
    this.b('mossy', -23, y0 + 2, -30) // the arms
    this.b('mossy', -21, y0 + 2, -30)
    this.b('cobble', -22, y0 + 3, -30)
    this.b('glow', -23, y0, -31) // two candles keep the memorial
    this.b('glow', -21, y0, -31)
    const memoLight = new THREE.PointLight(0xffc890, 1.3, 10, 1.8)
    memoLight.position.set(-22.5, y0 + 2.2, -30.5)
    this.group.add(memoLight)

    /* ---------- the graves ---------- */
    // tall crosses (mossy base, cobble stem, arms at the stem's crown)
    const crossGraves: [number, number][] = [[-21, -26], [-24, -28]]
    for (const [gx, gz] of crossGraves) {
      this.b('mossy', gx, y0, gz)
      this.b('cobble', gx, y0 + 1, gz)
      this.b('cobble', gx, y0 + 2, gz)
      this.b('mossy', gx - 1, y0 + 2, gz)
      this.b('mossy', gx + 1, y0 + 2, gz)
    }
    // slab tombs — two supports carrying a stone lid (the well-off dead)
    this.b('cobble', -26, y0, -25)
    this.b('cobble', -25, y0, -25)
    this.fill('stonebrick', -26, -25, y0 + 1, y0 + 1, -25, -25)
    this.b('cobble', -19, y0, -27)
    this.b('cobble', -19, y0, -28)
    this.fill('stonebrick', -19, -19, y0 + 1, y0 + 1, -27, -28)
    // box tomb — a solid stone chest for a family's name
    this.b('cobble', -26, y0, -28)
    this.b('stonebrick', -26, y0 + 1, -28)
    // headstones — the common dead, each a little different
    this.b('cobble', -19, y0, -25); this.b('mossy', -19, y0 + 1, -25)
    this.b('mossy', -25, y0, -26); this.b('cobble', -25, y0 + 1, -26)
    this.b('mossy', -19, y0, -26); this.b('cobble', -19, y0 + 1, -26)
    this.b('cobble', -21, y0, -25); this.b('mossy', -21, y0 + 1, -25)
    this.b('cobble', -24, y0, -29); this.b('mossy', -24, y0 + 1, -29)
    this.b('mossy', -25, y0, -28); this.b('cobble', -25, y0 + 1, -28)
    // urn grave — a lit pedestal; whoever it holds is still tended
    this.b('cobble', -26, y0, -26)
    this.b('mossy', -26, y0 + 1, -26)
    this.b('glow', -26, y0 + 2, -26)
    // broken stone — time has toppling work left to do here
    this.b('mossy', -26, y0, -29)
    this.b('cobble', -25, y0, -29)
    this.b('mossy', -19, y0, -30)
    this.b('cobble', -19, y0, -29)
    // the fresh grave — bare mounds, a head post, one candle someone lit
    this.b('dirt', -21, y0, -29)
    this.b('dirt', -20, y0, -29)
    this.b('log', -21, y0 + 1, -29)
    this.b('glow', -20, y0, -28)
    // pauper stones along the north-east, under the columbarium
    this.b('mossy', -23, y0, -32); this.b('cobble', -23, y0 + 1, -32)
    this.b('mossy', -22, y0, -32)
    this.b('cobble', -21, y0, -32); this.b('mossy', -21, y0 + 1, -32)
    // rubble pile tucked between the mausoleum and the columbarium
    this.b('mossy', -24, y0, -32)
    this.b('cobble', -24, y0 + 1, -32)

    /* the mourner — she weeps where the crypt key waits beside her */
    this.b('mossy', -26, y0, -27)
    this.fill('darkstone', -26, -26, y0 + 1, y0 + 2, -27, -27)
    this.b('cobble', -26, y0 + 3, -27)
    this.b('glow', -25, y0, -27) // a candle at her feet

    /* dead trees — one inside the yard, one framing the gate outside */
    this.col('log', -19, -31, y0, y0 + 2)
    this.b('log', -18, y0 + 2, -31)
    this.b('log', -19, y0 + 1, -30)
    this.col('log', -20, -22, y0, y0 + 2)
    this.b('log', -19, y0 + 2, -22)
    this.b('log', -20, y0 + 1, -23)

    /* a lantern leans by the graveyard gate */
    this.lantern(-25, y0, -23)

    /* crimson banners flank the church door — the parish still dresses
       for a congregation that stopped coming */
    for (const bp of [-38, -34]) {
      this.b('woolred', bp, y0 + 1, -24)
      this.b('woolred', bp, y0 + 2, -24)
    }

    /* the crypt — a low stone box against the church's north wall */
    for (let x = -33; x <= -30; x++)
      for (let z = -36; z <= -34; z++) {
        const edge = x === -33 || x === -30 || z === -36 || z === -34
        if (!edge) continue
        this.col('stonebrick', x, z, y0, y0 + 2)
      }
    // the east door — 3 tall, so someone standing on the raised tomb
    // slab inside still has head room to walk out (no sealed coffins)
    this.clearCol('stonebrick', -30, y0, y0 + 2, -35)
    this.fill('stonebrick', -33, -30, y0 + 3, y0 + 3, -36, -34) // slab roof
    this.fill('plank', -32, -31, y0, y0, -35, -35) // the tomb slab

    /* the church's west vault — a sealed sacristy hidden behind a wall
       that shimmers. The wall cells (x −41, z −30/−29, 2 high) are the
       game's illusion; the vault itself is real stonework. */
    this.clearCol('stonebrick', -41, y0, y0 + 1, -30) // the illusion mouth
    this.clearCol('stonebrick', -41, y0, y0 + 1, -29)
    this.col('mossy', -44, -30, y0, y0 + 2) // the sacristy shell
    this.col('mossy', -44, -29, y0, y0 + 2)
    this.fill('mossy', -44, -42, y0, y0 + 2, -31, -31)
    this.fill('mossy', -44, -42, y0, y0 + 2, -28, -28)
    this.fill('stonebrick', -44, -42, y0 + 3, y0 + 3, -31, -28) // its roof
    this.b('plank', -43, y0, -30) // a shelf the priests left
    this.b('glow', -43, y0 + 2, -29) // a candle that still waits
  }

  /* ================= ASH WASTES ================= */

  private buildWastes() {
    const y0 = 7 // ash surface (floor h=6)

    /* dead trees + coal scatter — all kept off the road's width */
    for (const [tx, tz, tt] of [[36, 18, 3], [45, 10, 4], [28, 30, 3], [48, 22, 3], [43, 4, 2]] as const) {
      this.deadTree('log', tx, y0, tz, tt)
    }
    for (const [cx, cz] of [[33, 24], [42, 16], [28, 23], [47, 8], [38, 31], [27, 7], [50, 18], [35, 28]] as const) {
      this.b('coal', cx, y0, cz)
    }

    /* two burned wagons */
    this.fill('plank', 37, 38, y0, y0, 12, 13)
    this.b('log', 36, y0, 12)
    this.b('log', 36, y0, 13)
    this.b('plank', 38, y0 + 1, 14)
    this.fill('plank', 44, 45, y0, y0, 26, 27)
    this.b('log', 46, y0, 26)
    this.b('log', 46, y0, 27)

    /* the hermit camp — tent, cold fire, a stool (the pyro flame waits
       nearby). Sits south of the road's east shoulder, never on it. */
    this.fill('plank', 31, 31, y0, y0, 15, 17)
    this.fill('plank', 33, 33, y0, y0, 15, 17)
    this.fill('plank', 32, 32, y0 + 1, y0 + 1, 15, 17)
    for (const [fx, fz] of [[31, 20], [33, 20], [31, 22], [33, 22]] as const) this.b('cobble', fx, y0, fz)
    this.b('coal', 32, y0, 21)
    this.b('log', 31, y0, 19) // the stool

    /* the ruined gate arch, east of the pyromancy flame — its west
       side has already fallen toward the road */
    this.col('darkstone', 35, 12, y0, y0 + 3)
    this.col('darkstone', 35, 15, y0, y0 + 2)
    this.b('darkstone', 35, y0 + 4, 13) // the surviving lintel stubs
    this.b('darkstone', 35, y0 + 4, 14)
    this.b('cobble', 34, y0, 16) // crumbled shoulders
    this.b('cobble', 36, y0, 17)
    this.b('cobble', 35, y0, 10)

    /* obsidian spikes — the ground remembers the burning */
    for (const [sx, sz, sh] of [[40, 4, 3], [42, 12, 4], [47, 24, 3], [26, 28, 2], [50, 5, 3]] as const) {
      this.col('darkstone', sx, sz, y0, y0 + sh - 1)
      if (sh >= 3) this.b('coal', sx + 1, y0, sz)
    }

    /* ember vents — cracks that still breathe heat */
    for (const [vx, vz] of [[34, 22], [45, 8], [30, 3], [48, 14], [27, 22]] as const) {
      this.b('coal', vx, y0, vz)
      this.b('glow', vx, y0 + 1, vz)
    }

    /* a toppled obsidian monolith — even the stone knelt here */
    this.fill('darkstone', 39, 40, y0, y0, 20, 20)
    this.b('darkstone', 41, y0, 21)

    /* lava light — low suns for the molten pools */
    for (const [lx, lz] of V3_LAVA_POOLS) {
      const pl = new THREE.PointLight(0xff5a20, 1.7, 13, 1.6)
      pl.position.set(lx + 0.5, 8.2, lz + 0.5)
      this.group.add(pl)
    }
  }

  /* ================= CINDER FORTRESS ================= */

  private buildFortress() {
    const y0 = 10 // courtyard surface (floor h=9)

    /* curtain walls — the gatehouse gap sits at x 31..36 on the south face */
    for (let x = 24; x <= 44; x++) {
      if (x >= 29 && x <= 38) continue // gatehouse towers + opening
      this.fill('cobble', x, x, y0, y0 + 4, -7, -7)
      if (x % 2 === 0) this.b('cobble', x, y0 + 5, -7)
    }
    for (let x = 24; x <= 44; x++) {
      this.fill('cobble', x, x, y0, y0 + 4, -31, -31)
      if (x % 2 === 0) this.b('cobble', x, y0 + 5, -31)
    }
    for (let z = -28; z <= -11; z++) {
      this.fill('cobble', 21, 21, y0, y0 + 4, z, z)
      this.fill('cobble', 47, 47, y0, y0 + 4, z, z)
      if (z % 2 === 0) {
        this.b('cobble', 21, y0 + 5, z)
        this.b('cobble', 47, y0 + 5, z)
      }
    }

    /* the gatehouse — two lantern towers + the arch over a 6-wide mouth */
    this.fill('cobble', 29, 30, y0, y0 + 7, -8, -6)
    this.fill('cobble', 37, 38, y0, y0 + 7, -8, -6)
    this.fill('glow', 29, 30, y0 + 8, y0 + 8, -8, -6)
    this.fill('glow', 37, 38, y0 + 8, y0 + 8, -8, -6)
    this.fill('darkstone', 31, 36, y0 + 5, y0 + 5, -7, -7) // the arch
    const gateLight = new THREE.PointLight(0xffa050, 1.7, 13, 1.7)
    gateLight.position.set(34.5, y0 + 8, -4.5)
    this.group.add(gateLight)

    /* corner towers with braziers */
    for (const [tx0, tx1, tz0, tz1] of [[21, 23, -33, -31], [45, 47, -33, -31], [21, 23, -10, -8], [45, 47, -10, -8]] as const) {
      this.fill('cobble', tx0, tx1, y0, y0 + 6, tz0, tz1)
      this.b('glow', Math.floor((tx0 + tx1) / 2), y0 + 7, Math.floor((tz0 + tz1) / 2))
      this.crenelX('cobble', tx0, tx1, y0 + 7, tz0)
      this.crenelX('cobble', tx0, tx1, y0 + 7, tz1)
    }

    /* the king's court — throne platform at the north end */
    this.fill('stonebrick', 32, 37, y0, y0, -30, -26)
    this.fill('darkstone', 34, 34, y0 + 1, y0 + 2, -29, -29)
    this.fill('gold', 34, 34, y0 + 3, y0 + 3, -29, -29)
    this.b('darkstone', 33, y0 + 1, -29)
    this.b('darkstone', 35, y0 + 1, -29)

    /* broken forges on the west side */
    this.fill('cobble', 24, 25, y0, y0 + 3, -23, -22)
    this.b('coal', 24, y0 + 4, -23)
    this.fill('cobble', 24, 25, y0, y0 + 2, -27, -26)
    this.b('coal', 25, y0 + 3, -26)
    this.fill('coal', 27, 28, y0, y0, -24, -23)

    /* the great brazier (outside the fight ring) + weapon racks + a burned cart */
    this.b('cobble', 44, y0, -14)
    this.b('glow', 44, y0 + 1, -14)
    const brazier = new THREE.PointLight(0xff7830, 1.8, 13, 1.7)
    brazier.position.set(44.5, y0 + 2, -13.5)
    this.group.add(brazier)
    for (const [rx, rz] of [[24, -12], [41, -12]] as const) {
      this.b('log', rx, y0, rz)
      this.b('log', rx + 2, y0, rz)
      this.fill('plank', rx, rx + 2, y0 + 2, y0 + 2, rz, rz)
    }
    this.fill('plank', 30, 31, y0, y0, -25, -26)
    this.b('log', 29, y0, -25)
    this.b('log', 29, y0, -26)

    /* the processional walkway — forecourt (the king waits here), then
       a raised aisle climbing to the throne. It stops short of the
       boss's resting spot so nothing is ever spawned inside a block. */
    this.fill('stonebrick', 33, 35, y0, y0, -26, -16)
    for (const bz of [-12, -18, -24]) {
      this.b('cobble', 31, y0, bz)
      this.b('glow', 31, y0 + 1, bz)
      this.b('cobble', 37, y0, bz)
      this.b('glow', 37, y0 + 1, bz)
    }
    /* banner poles where the aisle begins */
    for (const px of [32, 36]) {
      this.col('log', px, -10, y0, y0 + 1)
      this.b('gold', px, y0 + 2, -10)
    }

    /* the barracks ruin against the east wall — roof burned through */
    for (let z = -22; z <= -15; z++) {
      if (z !== -19 && z !== -18) this.col('cobble', 41, z, y0, y0 + 2)
      this.col('cobble', 46, z, y0, y0 + 1)
      if (z % 2 === 0) this.col('cobble', 44, z, y0, y0)
    }
    for (let x = 42; x <= 45; x++) {
      this.col('cobble', x, -22, y0, y0 + 1)
      this.b('cobble', x, y0, -15)
    }
    this.fill('darkstone', 42, 45, y0 + 3, y0 + 3, -21, -20) // a slumped beam
    this.b('plank', 43, y0, -18) // crates inside
    this.b('plank', 44, y0, -17)
    this.b('coal', 45, y0, -16)
    this.b('darkstone', 43, y0 + 1, -19) // half-fallen bunk

    /* the warden's closet — a sealed cell off the barracks' north wall.
       The wall cells (x 43/44, z −22) are the game's illusion; this
       shell is real, and the garrison's prize still waits inside. */
    this.clearCol('cobble', 43, y0, y0 + 1, -22) // the illusion mouth
    this.clearCol('cobble', 44, y0, y0 + 1, -22)
    this.fill('cobble', 42, 44, y0, y0 + 1, -26, -26) // the cell's shell
    this.fill('cobble', 41, 41, y0, y0 + 1, -25, -24)
    this.fill('cobble', 45, 45, y0, y0 + 1, -25, -24)
    this.fill('cobble', 42, 44, y0 + 2, y0 + 2, -26, -24) // its roof
    this.b('crate', 42, y0, -25) // what the wardens locked away

    /* the garrison well west of the aisle */
    this.b('cobble', 25, y0, -17)
    this.b('cobble', 27, y0, -17)
    this.b('cobble', 25, y0, -15)
    this.b('cobble', 27, y0, -15)
    this.b('water', 26, y0, -16)
    this.col('log', 25, -16, y0, y0 + 1)
    this.col('log', 27, -16, y0, y0 + 1)
    this.fill('plank', 25, 27, y0 + 2, y0 + 2, -16, -16)

    /* a raised portcullis gnaws at the gate mouth's crown */
    for (const bx of [31, 33, 35]) {
      this.b('darkstone', bx, y0 + 3, -7)
      this.b('darkstone', bx, y0 + 4, -7)
    }

    /* arrow slits pierce the gatehouse towers */
    for (const tx of [29, 38]) {
      this.clearCol('cobble', tx, y0 + 3, y0 + 4, -8)
      this.clearCol('cobble', tx, y0 + 3, y0 + 4, -6)
    }

    /* crimson banners crown the curtain walls between the merlons */
    for (const [bx2, bz2] of [[27, -7], [41, -7], [27, -31], [41, -31]] as const)
      this.b('woolred', bx2, y0 + 5, bz2)

    /* supplies stacked by the barracks — the garrison's last crates */
    this.b('crate', 42, y0, -17)
    this.b('crate', 42, y0, -16)
    this.b('crate', 43, y0, -16)
    this.b('crate', 42, y0 + 1, -16)
    this.b('hay', 45, y0, -17)

    /* statues flank the throne dais; gold crowns the poles behind */
    for (const sx of [31, 38]) {
      this.b('darkstone', sx, y0, -26)
      this.fill('darkstone', sx, sx, y0 + 1, y0 + 2, -27, -27)
      this.b('cobble', sx, y0 + 3, -27)
    }
    for (const px of [33, 36]) {
      this.col('log', px, -30, y0 + 1, y0 + 2)
      this.b('gold', px, y0 + 3, -30)
    }
  }

  /* ================= meadow dressing ================= */

  private buildMeadow() {
    /* oaks scattered on the grass — never on a road, never near a gate,
       never inside the pond */
    const trees: [number, number][] = [
      [-16, 36], [-26, 38], [-14, 12], [12, 38], [20, 32],
      [16, 10], [-16, 2], [-24, 38], [26, 38], [-12, 22], [14, 22],
      [-20, 10], [10, 48],
    ]
    for (const [tx, tz] of trees) {
      this.oakTree(tx, this.getH(tx, tz) + 1, tz)
    }
    /* lone lanterns where the roads leave the plaza light behind */
    for (const [lx, lz] of [[-17, 31], [18, 27], [-35, 2], [38, 12]] as const) {
      this.lantern(lx, this.getH(lx, lz) + 1, lz, lz === 31 || lz === 12)
    }
    /* a wayside shrine on the east road — a mossy stone + candle */
    this.b('mossy', 20, this.getH(20, 26) + 1, 26)
    this.b('glow', 20, this.getH(20, 26) + 2, 26)
    /* another on the west road's shoulder */
    const wsx = this.getH(-24, 24) + 1
    this.b('mossy', -24, wsx, 24)
    this.b('gold', -24, wsx + 1, 24)

    /* the pond dock — one plank finger over still water */
    this.fill('plank', -16, -16, 6, 6, 33, 35)
    this.lantern(-15, this.getH(-15, 37) + 1, 37, true)
    /* reeds crowd the pond's quiet rim */
    for (const [rx, rz] of [[-24, 31], [-16, 37], [-25, 36], [-15, 32]] as const)
      this.col('leaves', rx, rz, this.getH(rx, rz) + 1, this.getH(rx, rz) + 1)

    /* ---- the Watchtower ruin — mid-meadow waymark between the
       crossroads and the fortress road; whoever kept it is gone ---- */
    const wt = this.getH(9, 2) + 1
    const wtCols: [number, number, number][] = [
      [3, 0, 3], [2, 2, 1], [0, 3, 2], [-2, 2, 4],
      [-3, 0, 1], [-2, -2, 0], [0, -3, 2], [2, -2, 1],
    ]
    for (const [dx, dz, hh] of wtCols) {
      if (hh === 0) {
        this.b('cobble', 9 + dx, wt, 2 + dz) // a fallen drum
        continue
      }
      this.col('stonebrick', 9 + dx, 2 + dz, wt, wt + hh - 1)
    }
    this.b('mossy', 9, wt, 2)
    this.b('glow', 9, wt + 1, 2) // the waystone still answers
    this.b('cobble', 8, wt, 4)
    this.b('mossy', 11, wt, 1)

    /* ---- the Old Circle — sitting stones on the southern ridge,
       older than the parish, older than the fire ---- */
    const stones: [number, number, number][] = [
      [6, 48, 2], [5, 51, 1], [2, 52, 3], [-1, 51, 1],
      [-2, 48, 2], [-1, 46, 1], [2, 45, 2], [5, 46, 1],
    ]
    for (const [sx, sz, sh] of stones) {
      const sh0 = this.getH(sx, sz) + 1
      this.col('mossy', sx, sz, sh0, sh0 + sh - 1)
    }
    this.b('glow', 2, this.getH(2, 48) + 1, 48) // the circle's ember

    /* ---- the woodcutter's camp — he never came back for his
       last load: a shelter, split logs, a stump, one crate ---- */
    const wc = this.getH(15, 44) + 1
    this.col('plank', 15, 43, wc, wc + 1) // the shelter's back
    this.col('plank', 15, 44, wc, wc + 1)
    this.col('log', 16, 43, wc, wc)
    this.col('log', 16, 44, wc, wc)
    this.fill('plank', 15, 16, wc + 2, wc + 2, 43, 44)
    const lp = this.getH(12, 41) + 1
    this.fill('log', 12, 13, lp, lp + 1, 41, 41) // the split load
    this.b('log', 12, lp, 42)
    this.col('log', 17, 41, this.getH(17, 41) + 1, this.getH(17, 41) + 1) // the stump
    this.b('crate', 14, this.getH(14, 44) + 1, 44)
    this.lantern(13, this.getH(13, 45) + 1, 45)

    /* brush and boulders — the meadow is not a lawn */
    for (const [bx, bz] of [
      [-8, 24], [6, 12], [14, 14], [-18, 18], [4, 44], [-10, 42],
      [17, 28], [-25, 2], [-30, 42], [2, -2],
    ] as const) {
      this.b('leaves', bx, this.getH(bx, bz) + 1, bz)
    }
    /* kerb stones where the roads bend — old wheels made these lines */
    for (const [kx, kz] of [[-14, 32], [-22, 32], [-13, 31], [18, 27], [23, 25]] as const)
      this.b('cobble', kx, this.getH(kx, kz) + 1, kz)

    /* the Watchers' Stair — broken gateposts crown the top, a lantern
       and a waystone wait at the bottom */
    const t1 = this.getH(-14, -14) + 1
    this.col('stonebrick', -14, -14, t1, t1 + 2)
    const t2 = this.getH(-20, -10) + 1
    this.col('stonebrick', -20, -10, t2, t2 + 2)
    this.lantern(-16, this.getH(-16, -4) + 1, -4, true)
    this.lantern(-8, this.getH(-8, 18) + 1, 18, true)
    this.b('mossy', -8, this.getH(-8, 17) + 1, 17)
    this.b('glow', -8, this.getH(-8, 17) + 2, 17)
  }

  /* ================= fog gates ================= */

  setFogGatesVisible(g1: boolean, g2: boolean) {
    for (const f of this.fogGates) f.mesh.visible = f.which === 1 ? g1 : g2
  }

  /** per-frame: the mist breathes, the ash drifts, the embers climb */
  update(dt: number) {
    for (const f of this.fogGates) {
      const mat = f.mesh.material as THREE.ShaderMaterial
      mat.uniforms.uTime.value += dt
    }
    this.t += dt
    const t = this.t
    if (this.motes && this.motesBase && this.motesPhase) {
      const p = this.motes.geometry.attributes.position.array as Float32Array
      for (let i = 0; i < this.motesPhase.length; i++) {
        const ph = this.motesPhase[i]
        p[i * 3] = this.motesBase[i * 3] + Math.sin(t * 0.35 + ph) * 1.6
        p[i * 3 + 1] = this.motesBase[i * 3 + 1] + Math.sin(t * 0.22 + ph * 1.7) * 1.1
        p[i * 3 + 2] = this.motesBase[i * 3 + 2] + Math.cos(t * 0.28 + ph) * 1.6
      }
      this.motes.geometry.attributes.position.needsUpdate = true
    }
    if (this.embers && this.embersBase && this.embersPhase) {
      const p = this.embers.geometry.attributes.position.array as Float32Array
      for (let i = 0; i < this.embersPhase.length; i++) {
        const rise = (t * (0.9 + this.embersPhase[i] * 0.5) + this.embersPhase[i] * 11) % 10
        p[i * 3] = this.embersBase[i * 3] + Math.sin(t * 1.3 + this.embersPhase[i] * 9) * 0.35
        p[i * 3 + 1] = this.embersBase[i * 3 + 1] + rise
      }
      this.embers.geometry.attributes.position.needsUpdate = true
    }
  }

  /** drifting ash + rising embers — the air itself tells the story */
  private buildAmbient() {
    /* pale ash motes over the whole vale */
    const N = 230
    const base = new Float32Array(N * 3)
    const phase = new Float32Array(N)
    const r = mulberry32(8181)
    for (let i = 0; i < N; i++) {
      base[i * 3] = -52 + r() * 104
      base[i * 3 + 1] = 8 + r() * 20
      base[i * 3 + 2] = -52 + r() * 104
      phase[i] = r() * Math.PI * 2
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(base.slice(), 3))
    this.motes = new THREE.Points(
      g,
      new THREE.PointsMaterial({ color: 0xb9c2cf, size: 0.22, transparent: true, opacity: 0.5, depthWrite: false })
    )
    this.motes.frustumCulled = false
    this.group.add(this.motes)
    this.motesBase = base
    this.motesPhase = phase

    /* ember columns above the lava pools + the moat + the pit's heart */
    const pools: [number, number][] = [
      ...V3_LAVA_POOLS.map(([x, z]) => [x, z] as [number, number]),
      [34, -34.5],
      [34.5, -44.2],
    ]
    const E = 100
    const eb = new Float32Array(E * 3)
    const ep = new Float32Array(E)
    for (let i = 0; i < E; i++) {
      const [px, pz] = pools[i % pools.length]
      eb[i * 3] = px - 2 + r() * 4
      eb[i * 3 + 1] = 6.2 + r() * 1.5
      eb[i * 3 + 2] = pz - 2 + r() * 4
      ep[i] = r() * Math.PI * 2
    }
    const eg = new THREE.BufferGeometry()
    eg.setAttribute('position', new THREE.BufferAttribute(eb.slice(), 3))
    this.embers = new THREE.Points(
      eg,
      new THREE.PointsMaterial({
        color: 0xff8a3a, size: 0.3, transparent: true, opacity: 0.9,
        blending: THREE.AdditiveBlending, depthWrite: false,
      })
    )
    this.embers.frustumCulled = false
    this.group.add(this.embers)
    this.embersBase = eb
    this.embersPhase = ep
  }

  private buildFogGates() {
    const fogMat = createFogMaterial()
    // gate 1 — the knight's forecourt
    const g1 = new THREE.Mesh(new THREE.BoxGeometry(15.2, 5.4, 0.36), fogMat)
    g1.position.set(-32, 13 + 2.7, V3_BOSS1_GATE.z)
    this.group.add(g1)
    this.fogGates.push({ mesh: g1, which: 1 })
    // gate 2 — the fortress mouth
    const g2 = new THREE.Mesh(new THREE.BoxGeometry(6.4, 5.4, 0.36), fogMat)
    g2.position.set(34, 10 + 2.7, V3_GATE2.z)
    this.group.add(g2)
    this.fogGates.push({ mesh: g2, which: 2 })
    this.setFogGatesVisible(true, true)
  }

  /* ================= sky ================= */

  private buildSky() {
    /* the dusk dome — deep blue zenith warming to ember at the horizon */
    const geo = new THREE.SphereGeometry(210, 20, 12)
    const pos = geo.attributes.position
    const colors = new Float32Array(pos.count * 3)
    const zen = new THREE.Color(0x1d2438)
    const mid = new THREE.Color(0x3a4258)
    const hor = new THREE.Color(0x8a5a3a)
    const v = new THREE.Vector3()
    for (let i = 0; i < pos.count; i++) {
      v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).normalize()
      const up = Math.max(0, v.y) // 0 at horizon → 1 at zenith
      const west = Math.max(0, -v.x) // the sunset side
      const c = up < 0.28
        ? mid.clone().lerp(hor, ((0.28 - up) / 0.28) * (0.45 + west * 0.55))
        : mid.clone().lerp(zen, Math.min(1, (up - 0.28) / 0.5))
      colors[i * 3] = c.r
      colors[i * 3 + 1] = c.g
      colors[i * 3 + 2] = c.b
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    const dome = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false }))
    this.group.add(dome)

    /* the moon — pale, high, square */
    const moon = new THREE.Mesh(
      new THREE.BoxGeometry(7, 7, 0.5),
      new THREE.MeshBasicMaterial({ color: 0xe8ecf2, fog: false })
    )
    moon.position.set(-95, 105, -110)
    moon.lookAt(0, 0, 0)
    this.group.add(moon)

    /* the halo — the moon smokes faintly behind thin cloud */
    const halo = new THREE.Mesh(
      new THREE.PlaneGeometry(15, 15),
      new THREE.MeshBasicMaterial({ color: 0xbfd0e8, transparent: true, opacity: 0.14, fog: false, depthWrite: false })
    )
    halo.position.set(-95, 105, -110)
    halo.lookAt(0, 0, 0)
    this.group.add(halo)

    /* faint early stars */
    const starN = 150
    const sp = new Float32Array(starN * 3)
    const r = mulberry32(4242)
    for (let i = 0; i < starN; i++) {
      const a = r() * Math.PI * 2
      const el = 0.25 + r() * 0.7
      const rad = 195
      sp[i * 3] = Math.cos(a) * rad * Math.cos(el)
      sp[i * 3 + 1] = Math.sin(el) * rad
      sp[i * 3 + 2] = Math.sin(a) * rad * Math.cos(el)
    }
    const sg = new THREE.BufferGeometry()
    sg.setAttribute('position', new THREE.BufferAttribute(sp, 3))
    const stars = new THREE.Points(
      sg,
      new THREE.PointsMaterial({ color: 0xcfd6e4, size: 0.9, fog: false, transparent: true, opacity: 0.75 })
    )
    this.group.add(stars)

    /* a few flat clouds drifting above the landmarks */
    const cloudMat = new THREE.MeshBasicMaterial({ color: 0x5a6478, transparent: true, opacity: 0.5, fog: false })
    for (const [cx, cy, cz, sx, sz] of [
      [-40, 46, -20, 16, 8], [20, 49, -35, 20, 9], [45, 47, 15, 14, 7],
      [-15, 50, 35, 18, 8], [5, 48, -5, 12, 6], [-50, 47, 10, 13, 7],
    ] as const) {
      const c = new THREE.Mesh(new THREE.BoxGeometry(sx, 1.2, sz), cloudMat)
      c.position.set(cx, cy, cz)
      this.group.add(c)
    }
  }
}

/* ================= math helpers ================= */

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}
function smoothstep(e0: number, e1: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)))
  return t * t * (3 - 2 * t)
}
