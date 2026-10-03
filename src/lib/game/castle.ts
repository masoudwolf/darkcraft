import * as THREE from 'three'
import { blockMaterials, mulberry32 } from './textures'
import type { GameWorld } from './worldContract'

/* ==================================================================
   MANORLOTH — «قلعهٔ مانولث» — جهانِ دومِ دارک‌کرفت (پیش‌نمایش)

   After the First Coal fell, the Night Roc still serves one duty:
   it carries the ash-walker above the cloud sea, to the cathedral-
   castle of the old gods. This file builds that world — a SEPARATE
   zone, isolated from the Vale so the two maps never touch.

   ── GOTHIC GRAMMAR (every block has a structural reason) ──
   1. POINTED ARCH (طاق جناغی) — every gate/window steps to a peak;
      the pointed profile carries weight straight down, so walls can
      go higher — that's WHY gothic is tall.
   2. ROSE WINDOW — the west facade's circular stained-glass wheel,
      ringed in pale tracery: the theology of light at the entrance.
   3. FLYING BUTTRESS — the nave's stone skeleton outside: a pier
      standing away from the wall, an arch flying from pier to the
      clerestory, so the wall can become glass.
   4. CLERESTORY + TRIFORIUM — the tall nave wall's three bands:
      aisle windows, a dark triforium band, then the window band.
   5. CLUSTERED PIERS — 2×2 columns with gold capitals; the ribs of
      the vault "grow" out of them like a stone forest.
   6. RIBBED VAULT — diagonal pale ribs crossing at the ridge; the
      ceiling becomes a structural fan, not a flat lid.
   7. SPIRE + PINNACLES — every tower tapers in slate steps and ends
      in a gold finial; pinnacles weight the buttress piers.
   8. PORTCULLIS + MACHICOLATION + ARROW SLITS — the fortress half:
      iron grid, murder-hole crown, thin window cuts.
   9. GARGOYLES — crouched stone beasts on the ledges; they throw
      rain clear of the wall and they watch you do it.
   10. CLOISTER, CRYPT, CHAPEL, LIBRARY — the monastery organs of
      the castle; the interior is the dungeon to come.
   ================================================== */

const HALF = 64 // island grid -64..63

export interface CastleRegion {
  id: string
  name: string
  sub: string
  dot: string
  desc: string
  design: string
  cam: { x: number; z: number; y: number; dist: number; theta: number; phi: number }
  /** interior regions auto-hide the vault/roof for the dollhouse view */
  interior?: boolean
}

export const REGIONS_CASTLE: CastleRegion[] = [
  {
    id: 'overview',
    name: 'مانولث از دور',
    sub: 'قلعهٔ کاتدرالِ خدایانِ گم‌شده — روی دریای ابر',
    dot: '#8fb0d9',
    desc: 'جایی که هیچ راهی جز آسمان به آن نمی‌رسد: جزیره‌ای صخره‌ای معلق بر دریای ابر، و بر آن قلعه‌ای که بیشتر کاتدرال است تا دژ — دو برج نمای غربی با پنجرهٔ گلگون، جناغ‌های پرندهٔ نمازخانه، برج فانوسِ صلیب که از همه شمسه‌ها بلندتر است، برج ناقوس در غرب و دروازهٔ شیرها در جنوب. تنها خدمتکاری که هنوز مسیرش را می‌داند، رُخِ شب است.',
    design: 'سیلوئت سه‌طبقه مثل آنور لوندو: پلِ فرود → دیوار و دروازه → کاتدرالِ غالب. هر شمسه یک قطب‌نماست؛ از هر زاویه می‌دانی کجای قلعه‌ای.',
    cam: { x: 0, z: 18, y: 20, dist: 128, theta: 0.06, phi: 0.86 },
  },
  {
    id: 'landing',
    name: 'سکوی فرود رُخ',
    sub: 'پایانِ پرواز — آغازِ پیاده‌روی به سوی دروازه',
    dot: '#c9c2ac',
    desc: 'رخِ شب مسافرش را روی سکوی سنگی جنوبی رها می‌کند — پنجه‌هایش جای ماندگان را در خزه نگه داشته. پیشِ رو پلی سنگی بر شکافِ ابر است؛ ستون‌هایش تا ابر فرو رفته‌اند و دو مشعلِ سر پل، تنها گرمای این ارتفاع‌اند. زیر پا، دنیایِ قبلی جایی است که دیگر دیده نمی‌شود.',
    design: 'لحظهٔ «رسیدن»: سکوی کوچک + پل باریک = گام‌های آیینی ورود؛ قوس‌های زیر پل نشان می‌دهند این پل ساختهٔ دستِ خدایان کهن است، نه طبیعت.',
    cam: { x: 0, z: 58, y: 16, dist: 26, theta: 0.02, phi: 0.78 },
  },
  {
    id: 'gate',
    name: 'دروازهٔ شیرها',
    sub: 'دو برج، پرتقالِ آهنی و طاق جناغیِ یازده‌بلوکی',
    dot: '#ffb347',
    desc: 'دو برج دوقلو با شمسه‌های سنگ‌لوح، درگاه جناغی را میان خود گرفته‌اند: پرتقالِ آهنی نیمه‌برآمده، تیرکش‌های باریک، و بالای سرِ دهانه، تاجِ سوراخ‌های ریختنِ روغنِ گداخته. تیمپانومِ شیشه‌رنگ بالای درگاه، خدایانِ خوابیده را نشان می‌دهد — آخرین چیزی که یک مهاجم می‌بیند.',
    design: 'دروازه = گلوگاه سینمایی آینده: تونلِ دو‌بلوکی با سقفِ طاق، برای باس/دروازهٔ مهٔ بعدی ذخیره است؛ برج‌ها قرینه‌اند تا چشم مستقیم به درگاه برود.',
    cam: { x: 0, z: 44, y: 22, dist: 30, theta: 0.05, phi: 0.95 },
  },
  {
    id: 'court',
    name: 'حیاطِ آیینی',
    sub: 'مجسمه‌های شوالیه، کلوسترِ طاق‌دار و مسیرِ فرش‌شده',
    dot: '#b09055',
    desc: 'مسیرِ سنگِ روشن از دروازه تا پلکانِ کاتدرال می‌رود؛ دو ردیف مجسمهٔ شوالیه روی پایه‌های ستون‌دار ایستاده‌اند و پرچم‌های زرشکی هنوز بر دیرک‌ها مانده. شرقِ حیاط، کلوسترِ طاق‌دار است — راهرویی که روزی راهبانِ شب را از سرما نگاه می‌داشت. برج ناقوسِ طلایی در غرب، و دیوار حصارِ دندانه‌دار همه‌جا.',
    design: 'حیاط = نفس‌گیریِ میان دو بستهٔ سنگی؛ مجسمه‌ها به فاصلهٔ مساوی ایستاده‌اند تا ریتمِ راه‌رویِ آیینی ساخته شود — همان حسِ عبور از جلدِ کتابِ بزرگ.',
    cam: { x: 2, z: 42, y: 18, dist: 36, theta: 0.12, phi: 0.72 },
  },
  {
    id: 'facade',
    name: 'نمای غربی و پنجرهٔ گلگون',
    sub: 'درگاهِ جناغی، تیمپانوم و چرخِ شیشهٔ رنگین',
    dot: '#e8ddba',
    desc: 'نمای غربی کاتدرال، صفحهٔ داستانِ قلعه است: درگاهِ جناغیِ بزرگ با قابِ سنگِ استخوانی، دو مجسمهٔ نگهبان در پاگرده، و بالای همه — پنجرهٔ گلگون: چرخِ شیشه‌رنگِ هفت‌بلوکی با مشبکِ طلایی که ماه را به چهار رنگِ آبی و سرخ و بنفش و طلایی می‌شکند. دو برجِ نما با شمسه‌های بلند، قابِ این نقاشی‌اند.',
    design: 'گلگون = قلبِ نورِ کلیسا؛ همهٔ خطوط نما (طاقِ درگاه، نوارِ بال‌کن، لبهٔ برج‌ها) به سمتش همگرا می‌شوند — نگاه بازیکن خودش به بالا کشیده می‌شود.',
    cam: { x: 0, z: 44, y: 24, dist: 38, theta: 0.02, phi: 0.72 },
  },
  {
    id: 'nave',
    name: 'سنهٔ بزرگ',
    sub: 'درونِ کاتدرال — ستون‌ها، طاقِ جناغی و لوسترها',
    dot: '#9fb8ff',
    interior: true,
    desc: 'بیرون آمده و درونِ عظیم باز می‌شود: دو ردیف ستونِ خوشه‌ای با سرمایه‌های طلایی، بالکن‌های جناغیِ arcade، نوارِ تریفوریوم و در بالا — کلریستوریِ شیشه‌رنگ که ستون‌های نورِ رنگی روی فرشِ سرخ می‌ریزند. طاقِ جناغی با جناغ‌های سنگِ استخوانی بلندترین نقطهٔ داخلی است و دو لوسترِ آهنی از آن آویزان‌اند. ردیف‌های نیمکت، جادوی سوگوارانِ خالی‌اند.',
    design: 'فضای داخلیِ اصلیِ آینده: عرضِ ۹بلوکیِ سنه + دو راهرو = میدانِ جنگِ محصور با عمودهای پناهگاهی؛ سقفِ جداشده در نمایشگر، نمای «خانه‌عروسکی» می‌دهد.',
    cam: { x: 0, z: 5, y: 20, dist: 13, theta: 1.25, phi: 1.15 },
  },
  {
    id: 'crossing',
    name: 'صلیب و برج فانوس',
    sub: 'تقاطعِ راه‌ها — بلندترینِ بلندترها',
    dot: '#ffd23d',
    interior: true,
    desc: 'جایی که سنه و ترانسپت همدیگر را قطع می‌کنند، برج فانوس از نور لبریز است: پنجره‌های دوطبقهٔ شیشه‌رنگ از چهار سو، لوسترِ بزرگ و بالای همه شمسه‌ای که تا آسمانِ ابر فرو رفته. در پایین، ستون‌های صلیبیِ قطور، وزنِ همهٔ سنگِ آسمان را نگه داشته‌اند.',
    design: 'برجِ فانوس = منارهٔ نورِ کلیساهای گوتیک؛ در گیم‌پلی آینده، مکانِ رویدادِ سینماییِ وسطِ قلعه — مرکزِ مرکز، از هر طرف دیده می‌شود.',
    cam: { x: 0, z: -11, y: 18, dist: 9, theta: 0.5, phi: 1.0 },
  },
  {
    id: 'throne',
    name: 'محراب و تختِ خدایان',
    sub: 'اپسِ سه‌پنجره، سکوی محراب و تختِ طلاییِ سایه‌بان‌دار',
    dot: '#d43737',
    interior: true,
    desc: 'پایانِ مسیرِ فرشِ سرخ: سه پنجرهٔ بلندِ اپس — سرخ، بنفش، آبی — نورِ سه‌رنگ بر سکوی دوپله می‌ریزند. بر سکو، تختِ طلاییِ خدایانِ مانولث با سایه‌بانِ چهارستون و کوشهٔ زرشکی؛ دو برازیرِ آهنی شعله می‌گیرند و دو مجسمهٔ زانوزده هنوز التماس می‌کنند. این‌جا قرار است پایانِ دستهٔ دوم بنشیند.',
    design: 'اپسِ سه‌گانه = پردهٔ آخرِ تئاتر؛ تخت زیرِ پنجرهٔ میانی یعنی «قدرت زیر نورِ خدایان» — برای باس نهاییِ دستهٔ دو جای نگیرِ سینمایی است.',
    cam: { x: 0, z: -20, y: 19, dist: 11, theta: 0.05, phi: 1.15 },
  },
  {
    id: 'crypt',
    name: 'سردابهٔ پادشاهان',
    sub: 'تابوت‌ها، ستون‌های کوتاه و دروازهٔ آهنیِ نیمه‌گشوده',
    dot: '#8a8a96',
    interior: true,
    desc: 'پلهٔ پنهانِ راهروی شرقی، زیرِ کفِ کاتدرال می‌خزد: تالاری پنج‌بلوکه از ستون‌های دوقلو، ردیفِ تابوت‌های سنگیِ پادشاهانِ کهن، پشته‌های استخوان و طاقچه‌های شمع. وسطِ تالار، دروازهٔ آهنیِ نیمه‌گشوده — و هوای پشتش سردتر است. کسی این‌جا را دوباره نمی‌بندد.',
    design: 'سردابه = دومینوِ آینده: فضای تنگِ ۵بلوکه برای هجومِ جمعی؛ دروازهٔ آهنی، درِ یک‌راهِ دراماتیک برای «برگشت‌ناپذیری» است.',
    cam: { x: 0, z: -19, y: 9.5, dist: 9, theta: 1.57, phi: 1.3 },
  },
  {
    id: 'towers',
    name: 'شمسه‌ها و پشت‌بندهای پرنده',
    sub: 'اسکلتِ بیرونیِ کاتدرال از سمتِ شرق',
    dot: '#7fa8d9',
    desc: 'از شرق، ریاضیاتِ گوتیک لخت است: جناغ‌های پرنده هر شش بلوک، از ستونِ بیرونی به کلریستوری پرواز می‌کنند تا دیوار بتواند پنجره باشد؛ شمسهٔ برج فانوس از همه بلندتر است و گارگویل‌ها بر لبهٔ پشت‌بندها نشسته‌اند، باران را دور می‌ریزند و تو را نگاه می‌کنند. برج ناقوسِ غربی با ناقوسِ طلایی، لنگرِ دیدِ دور است.',
    design: 'نمای شرقی = درسِ فنیِ گوتیک: پشت‌بند یعنی «دیوار می‌تواند شیشه شود»؛ همین‌جا برای باسِ پشت‌بام/شمسه‌ها در آینده ذخیره است.',
    cam: { x: 10, z: -11, y: 24, dist: 55, theta: 1.35, phi: 0.85 },
  },
]

/* island plateau level — walking surface is PLATEAU+1 */
const PLATEAU = 13
/** the crypt: floor block bottom / ceiling block bottom */
export const CRYPT_FLOOR_Y = 6
const CRYPT_CEIL_Y = 12
/** the crypt stair shaft (east aisle floor opening) */
export const CRYPT_SHAFT = { x0: 9, x1: 10, z0: -7, z1: -6 }
/** Manorloth's bonfire — the stuck sword on the landing platform.
    Lives here (not in game.ts) so enemy.ts can honor it as the
    castle's safe zone without a circular import. */
export const CASTLE_FIRE = { x: 2.5, z: 56, y: 14 }

interface Vec3Lite { x: number; y: number; z: number }

export class CastleZone implements GameWorld {
  group = new THREE.Group()
  /** roof + vault — hidden for the dollhouse (interior) view */
  ceil = new THREE.Group()
  mats = blockMaterials()
  private heights = new Int8Array(HALF * 2 * HALF * 2)
  private surf = new Uint8Array(HALF * 2 * HALF * 2) // 0 stone, 1 cobble
  private solid = new Uint8Array(64 * HALF * 2 * HALF * 2)
  private L: Record<string, Vec3Lite[]> = {}
  private LC: Record<string, Vec3Lite[]> = {}
  private S: Record<string, { x: number; y: number; z: number; w: number; h: number; d: number }[]> = {}
  private t = 0
  private clouds: THREE.Mesh[] = []

  constructor() {
    this.genIsland()
    this.buildTerrain()
    this.buildCloudSea()
    this.buildBridge()
    this.buildOuterCourt()
    this.buildGatehouse()
    this.buildCathedralShell()
    this.buildFacade()
    this.buildNaveInterior()
    this.buildCrossingAndTransept()
    this.buildChoirSanctuary()
    this.buildCrypt()
    this.buildLibrary()
    this.buildBellTower()
    this.buildButtresses()
    this.buildYardDressing()
    this.sealVoids()
    this.buildSubDetails()
    this.buildSky()
    this.flush()
    this.buildSubs()
    this.group.add(this.ceil)
  }

  /* ============ grid + physics (same contract as WorldV3) ============ */
  private idx(x: number, z: number) {
    const bx = Math.min(HALF * 2 - 1, Math.max(0, x + HALF))
    const bz = Math.min(HALF * 2 - 1, Math.max(0, z + HALF))
    return bz * HALF * 2 + bx
  }
  getH(x: number, z: number) { return this.heights[this.idx(Math.round(x), Math.round(z))] }
  surfaceAt(x: number, z: number) { return this.getH(x, z) + 1 }
  private cellIdx(x: number, z: number, y: number) {
    const bx = Math.min(HALF * 2 - 1, Math.max(0, x + HALF))
    const bz = Math.min(HALF * 2 - 1, Math.max(0, z + HALF))
    const by = Math.min(63, Math.max(0, y))
    return (by * HALF * 2 + bz) * HALF * 2 + bx
  }
  solidStruct(x: number, y: number, z: number) { return this.solid[this.cellIdx(Math.round(x), Math.round(z), Math.round(y))] === 1 }
  wallAt(x: number, z: number, feetY: number) {
    const bx = Math.round(x), bz = Math.round(z)
    /* ── THE VOID SEAL ──
       Manorloth floats on the cloud sea: any column whose only "floor"
       sits below y≈4 is the abyss ring around the island (and the bare
       lanes beside the bridge where no deck was ever laid). Walking
       down there means landing on invisible ground under the castle
       with no way back — so the seal turns every such column into a
       wall. Real stone never triggers it: the lowest true floor in
       play is the island skirt at y≥4 and the crypt at y=7. */
    if (this.supportAt(bx, bz, feetY) < 4.5) return true
    const h = this.getH(bx, bz)
    /* ── underground rooms (the crypt of kings) ──
       Below the crust the plateau rule is meaningless — the "terrain
       height" is the cathedral floor ABOVE your ceiling. Down there a
       wall is simply built masonry: judge by the solid grid alone. */
    if (feetY < h - 0.5) {
      for (let y = Math.floor(feetY + 1.06); y <= Math.floor(feetY + 1.55); y++)
        if (this.solid[this.cellIdx(bx, bz, y)] === 1) return true
      return false
    }
    if (h + 1 > feetY + 1.06) return true
    for (let y = Math.floor(feetY + 1.06); y <= Math.floor(feetY + 1.55); y++)
      if (this.solid[this.cellIdx(bx, bz, y)] === 1) return true
    return false
  }
  supportAt(x: number, z: number, fromY: number) {
    const bx = Math.round(x), bz = Math.round(z)
    const h = this.getH(bx, bz)
    let best = h + 1
    const top = Math.min(63, Math.floor(fromY + 0.06))
    /* the scan stops at the terrain height — but a walker INSIDE the
       crypt stands BELOW the plateau (h=13) in a carved room whose
       floor is built block-work at y=6. For them the scan must reach
       through the crust: the topmost built block under the feet is
       the true floor. With no block found the old terrain fallback
       stands (open ground outside the buildings). */
    const bottom = top < h ? 0 : h
    for (let y = top; y > bottom; y--)
      if (this.solid[this.cellIdx(bx, bz, y)] === 1) { best = y + 1; break }
    return best
  }

  /* ---- GameWorld contract pieces the Vale has and the castle
          never needs — kept as honest stubs so the Game can treat
          both worlds through one interface ---- */
  surfAt(): number {
    return 0 // the whole island is dressed stone
  }
  isLava(): boolean {
    return false // no molten ground above the cloud sea
  }
  markSolid(x: number, y: number, z: number, on: boolean) {
    this.solid[this.cellIdx(Math.round(x), Math.round(z), Math.round(y))] = on ? 1 : 0
  }
  setFogGatesVisible() {
    /* no fog gates in Manorloth — the sky is the only gate */
  }
  setPitOpen() {
    /* no rockfall here */
  }

  /* ============ block helpers ============ */
  private b(mat: string, x: number, y: number, z: number, ceil = false) {
    const list = ceil ? this.LC : this.L
    ;(list[mat] ??= []).push({ x, y: y + 0.5, z })
    this.solid[this.cellIdx(x, z, y)] = 1
  }
  private fill(mat: string, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, ceil = false) {
    if (x1 < x0) [x0, x1] = [x1, x0]
    if (y1 < y0) [y0, y1] = [y1, y0]
    if (z1 < z0) [z0, z1] = [z1, z0]
    for (let x = x0; x <= x1; x++)
      for (let y = y0; y <= y1; y++)
        for (let z = z0; z <= z1; z++) this.b(mat, x, y, z, ceil)
  }
  private col(mat: string, x: number, z: number, y0: number, y1: number, ceil = false) {
    for (let y = y0; y <= y1; y++) this.b(mat, x, y, z, ceil)
  }
  private crenelX(mat: string, x0: number, x1: number, y: number, z: number) {
    if (x1 < x0) [x0, x1] = [x1, x0]
    for (let x = x0; x <= x1; x += 2) this.b(mat, x, y, z)
  }
  private crenelZ(mat: string, z0: number, z1: number, y: number, x: number) {
    if (z1 < z0) [z0, z1] = [z1, z0]
    for (let z = z0; z <= z1; z += 2) this.b(mat, x, y, z)
  }
  /** remove queued blocks (carve doors/windows); y bounds are block bottoms */
  private carve(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number) {
    if (x1 < x0) [x0, x1] = [x1, x0]
    if (y1 < y0) [y0, y1] = [y1, y0]
    if (z1 < z0) [z0, z1] = [z1, z0]
    for (const key of Object.keys(this.L)) {
      this.L[key] = this.L[key].filter(
        (v) => !(v.x >= x0 && v.x <= x1 && v.y >= y0 + 0.5 && v.y <= y1 + 0.5 && v.z >= z0 && v.z <= z1)
      )
    }
    for (let x = x0; x <= x1; x++)
      for (let y = y0; y <= y1; y++)
        for (let z = z0; z <= z1; z++) this.solid[this.cellIdx(x, z, y)] = 0
  }

  /* ---- SUB-VOXELS — the ⅓/⅔ detail layer ----
     Full blocks are too coarse for gothic trim, so the castle carries
     a second, finer grid: blocks ⅓ or ⅔ of a voxel, used ONLY where a
     structural/artistic reason exists (arch moldings, tracery, statue
     anatomy, claw grooves, book spines). Decor only — never solid, so
     physics and walkability stay exactly as designed. */
  /** sub-block anchored to a CELL: center = cell center + offset/3,
      size = (w,h,d)/3 — 1 = ⅓ voxel, 2 = ⅔, 3 = full */
  private sb(mat: string, x: number, y: number, z: number, w: number, h: number, d: number, ox = 0, oy = 0, oz = 0) {
    ;(this.S[mat] ??= []).push({
      x: x + 0.5 + ox / 3,
      y: y + 0.5 + oy / 3,
      z: z + 0.5 + oz / 3,
      w: w / 3,
      h: h / 3,
      d: d / 3,
    })
  }
  /** sub-block at an ABSOLUTE world center (for radial tracery etc.) */
  private sbA(mat: string, cx: number, cy: number, cz: number, w: number, h: number, d: number) {
    ;(this.S[mat] ??= []).push({ x: cx, y: cy, z: cz, w: w / 3, h: h / 3, d: d / 3 })
  }
  private buildSubs() {
    for (const [key, list] of Object.entries(this.S)) {
      const mat = this.mats[key]
      if (!mat || !list.length) continue
      const geo = new THREE.BoxGeometry(1, 1, 1)
      const mesh = new THREE.InstancedMesh(geo, mat, list.length)
      const m = new THREE.Matrix4()
      const q = new THREE.Quaternion()
      const p = new THREE.Vector3()
      const sc = new THREE.Vector3()
      for (let i = 0; i < list.length; i++) {
        const v = list[i]
        p.set(v.x, v.y, v.z)
        sc.set(v.w, v.h, v.d)
        m.compose(p, q, sc)
        mesh.setMatrixAt(i, m)
      }
      mesh.instanceMatrix.needsUpdate = true
      mesh.frustumCulled = false
      mesh.castShadow = false
      mesh.receiveShadow = true
      this.group.add(mesh)
    }
    this.S = {}
  }
  /** pointed arch band: two mirrored arcs stepping up to a peak */
  private archTop(mat: string, x0: number, x1: number, yBase: number, z: number, ceil = false) {
    let a = x0, b2 = x1, y = yBase
    while (a < b2) {
      this.b(mat, a, y, z, ceil)
      this.b(mat, b2, y, z, ceil)
      a++
      b2--
      y++
    }
    if (a === b2) this.b(mat, a, y, z, ceil)
  }
  /** tapered slate spire: inset cone of steps + glowing gold finial */
  private spire(x0: number, x1: number, z0: number, z1: number, yBase: number, steps: number) {
    if (x1 < x0) [x0, x1] = [x1, x0]
    if (z1 < z0) [z0, z1] = [z1, z0]
    for (let i = 0; i < steps; i++) {
      this.fill('slate', x0 + i, x1 - i, yBase + i, yBase + i, z0 + i, z1 - i)
      if (x0 + i >= x1 - i && z0 + i >= z1 - i) break
    }
    const cx = Math.round((x0 + x1) / 2)
    const cz = Math.round((z0 + z1) / 2)
    this.b('gold', cx, yBase + steps, cz)
    this.b('glow', cx, yBase + steps + 1, cz)
  }
  /** a crouching gargoyle — body, snout, two wings */
  private gargoyle(x: number, y: number, z: number, faceX = 1) {
    this.b('darkstone', x, y, z)
    this.b('darkstone', x, y, z + 1)
    this.b('cobble', x + faceX, y + 1, z)
    this.b('bonestone', x - faceX, y, z)
    this.b('bonestone', x - faceX, y, z + 1)
  }
  private torch(x: number, y: number, z: number, light = true) {
    this.b('cobble', x, y, z)
    this.b('glow', x, y + 1, z)
    if (light) {
      const pl = new THREE.PointLight(0xffa050, 1.6, 12, 1.8)
      pl.position.set(x + 0.5, y + 2, z + 0.5)
      this.group.add(pl)
    }
  }
  /** hanging chandelier: iron chain + ring + candle ring */
  private chandelier(x: number, yCeil: number, z: number, r = 2, lightDist = 22) {
    const y = yCeil - 4
    this.col('iron', x, z, y + 1, yCeil - 1, true)
    for (let dx = -r; dx <= r; dx++)
      for (let dz = -r; dz <= r; dz++) {
        if (Math.abs(dx) !== r && Math.abs(dz) !== r) continue
        if (Math.abs(dx) === r && Math.abs(dz) === r && r > 1) continue
        this.b('iron', x + dx, y, z + dz, true)
        if ((dx + dz) % 2 === 0) this.b('glow', x + dx, y - 1, z + dz, true)
      }
    const pl = new THREE.PointLight(0xffc070, 2.9, lightDist, 1.7)
    pl.position.set(x + 0.5, y - 0.5, z + 0.5)
    this.group.add(pl)
  }
  /** full knight statue on a pedestal */
  private knightStatue(x: number, z: number, y0: number) {
    this.fill('bonestone', x, x + 1, y0, y0 + 1, z, z + 1)
    this.fill('darkstone', x, x + 1, y0 + 2, y0 + 3, z, z + 1)
    this.b('cobble', x, y0 + 4, z)
    this.b('cobble', x + 1, y0 + 4, z + 1)
    this.b('iron', x, y0 + 2, z - 1)
    this.b('iron', x + 1, y0 + 2, z + 2)
  }
  private bannerPole(x: number, z: number, y0: number, h = 5) {
    this.col('log', x, z, y0, y0 + h - 1)
    this.b('log', x, y0 + h, z + 1)
    this.b('woolred', x, y0 + h - 2, z + 1)
    this.b('woolred', x, y0 + h - 3, z + 1)
    this.b('gold', x, y0 + h + 1, z)
  }

  /* ============ the island ============ */
  /** footprints the terrain renderer skips — the buildings own these
      floors; sealVoids() guarantees they never stay open */
  private builtAt(x: number, z: number) {
    return (
      // cathedral + transept + choir + apse footprint
      (Math.abs(x) <= 21 && z <= 21 && z >= -32) ||
      // the outer court + gatehouse block
      (Math.abs(x) <= 27 && z >= 15 && z <= 34) ||
      (Math.abs(x) <= 12 && z >= 34 && z <= 41) ||
      // bridge + landing
      (Math.abs(x) <= 6 && z >= 40 && z <= 59) ||
      // bell tower + library annex
      (x >= -32 && x <= -11 && z >= -4 && z <= 32) ||
      // the crypt stair opening in the east aisle
      (x >= CRYPT_SHAFT.x0 && x <= CRYPT_SHAFT.x1 && z >= CRYPT_SHAFT.z0 && z <= CRYPT_SHAFT.z1)
    )
  }

  private genIsland() {
    const r = mulberry32(7001)
    const o1 = r() * 10, o2 = r() * 10
    for (let z = -HALF; z < HALF; z++)
      for (let x = -HALF; x < HALF; x++) {
        const d = Math.hypot(x, z)
        const wob = Math.sin(Math.atan2(z, x) * 3 + o1) * 2.4 + Math.sin(Math.atan2(z, x) * 7 + o2) * 1.2
        let h = 0
        if (d <= 40 + wob) h = PLATEAU
        else if (d <= 50 + wob) h = Math.max(3, Math.round(PLATEAU - (d - 40 - wob) * 1.05))
        else if (d <= 55 + wob) h = Math.max(1, Math.round(6 - (d - 50 - wob) * 1.1))
        // the cloud chasm south — the bridge spans it alone
        if (x >= -8 && x <= 8 && z >= 41 && z <= 58) h = 0
        this.heights[this.idx(x, z)] = h
        this.surf[this.idx(x, z)] = d <= 41 ? 1 : 0
      }
  }

  /** terrain surface — skipping every column whose floor a building owns */
  private buildTerrain() {
    const batch: Record<string, Vec3Lite[]> = {}
    const put = (mat: string, x: number, y: number, z: number) => (batch[mat] ??= []).push({ x, y: y + 0.5, z })
    const exposed = (x: number, z: number, y: number) => {
      for (const [nx, nz] of [[x + 1, z], [x - 1, z], [x, z + 1], [x, z - 1]] as const) {
        if (nx < -HALF || nx >= HALF || nz < -HALF || nz >= HALF) return true
        if (this.heights[this.idx(nx, nz)] < y) return true
      }
      return false
    }
    const built = (x: number, z: number) => this.builtAt(x, z)
    for (let z = -HALF; z < HALF; z++)
      for (let x = -HALF; x < HALF; x++) {
        const h = this.heights[this.idx(x, z)]
        if (h <= 0) continue
        if (!built(x, z)) {
          put('stone', x, h, z)
          if (h - 1 >= 0 && exposed(x, z, h - 1)) put('stone', x, h - 1, z)
          if (h - 2 >= 0 && exposed(x, z, h - 2)) put('stone', x, h - 2, z)
          if (h - 3 >= 0 && exposed(x, z, h - 3)) put('stone', x, h - 3, z)
        } else {
          // building floors still need the exposed cliff layers below
          if (h - 1 >= 0 && exposed(x, z, h - 1)) put('stone', x, h - 1, z)
          if (h - 2 >= 0 && exposed(x, z, h - 2)) put('stone', x, h - 2, z)
        }
      }
    for (const [mat, list] of Object.entries(batch)) {
      const m = this.mats[mat]
      if (m && list.length) this.buildInstanced(this.group, m, list)
    }
  }

  /** the sea of clouds below the island */
  private buildCloudSea() {
    const r = mulberry32(9311)
    const list: Vec3Lite[] = []
    for (let i = 0; i < 700; i++) {
      const a = r() * Math.PI * 2
      const d = 14 + r() * 48
      const x = Math.round(Math.cos(a) * d)
      const z = Math.round(Math.sin(a) * d)
      const y = 2 + Math.floor(r() * 2.4)
      list.push({ x, y: y + 0.5, z })
      if (r() < 0.3) list.push({ x: x + 1, y: y + 1.5, z })
    }
    this.buildInstanced(this.group, this.mats.cloud!, list)
    // the continuous cloud floor — broad slabs lapping the island's roots
    const slabM = this.mats.cloud as THREE.Material
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2 + 0.2
      const d = 34 + ((i * 7) % 9)
      const slab = new THREE.Mesh(new THREE.BoxGeometry(30, 2.4, 22), slabM)
      slab.position.set(Math.cos(a) * d, 1.4, Math.sin(a) * d)
      slab.rotation.y = a + Math.PI / 2
      this.group.add(slab)
    }
    for (const [cx, cz, sx, sz] of [
      [0, 0, 60, 46], [0, 0, 44, 60],
    ] as const) {
      const slab = new THREE.Mesh(new THREE.BoxGeometry(sx, 2, sz), slabM)
      slab.position.set(cx, 1.6, cz)
      this.group.add(slab)
    }
    // a few flat clouds sailing the sky
    const cm = new THREE.MeshBasicMaterial({ color: 0x57617e, transparent: true, opacity: 0.45 })
    for (const [cx, cy, cz, sx, sz] of [
      [-40, 58, -30, 20, 9], [25, 62, 30, 22, 10], [50, 60, -5, 16, 8],
      [-15, 64, 45, 18, 8], [0, 66, -55, 26, 10],
    ] as const) {
      const c = new THREE.Mesh(new THREE.BoxGeometry(sx, 1.4, sz), cm)
      c.position.set(cx, cy, cz)
      this.group.add(c)
      this.clouds.push(c)
    }
  }

  /* ============ the landing platform + cloud bridge ============ */
  private buildBridge() {
    const y = PLATEAU // deck block bottom → walk on y+1
    // landing platform south of the chasm
    this.fill('bonestone', -5, 5, y, y, 54, 58)
    // piers down into the cloud
    for (const px of [-4, 0, 4]) {
      this.col('gobrick', px, 56, 0, y - 1)
      this.col('gobrick', px, 50, 0, y - 1)
    }
    // the bridge deck
    this.fill('gobrick', -2, 2, y, y, 41, 53)
    // arch ribs under the deck
    for (const z of [44, 47, 51])
      for (const px of [-2, 2]) {
        this.b('bonestone', px, y - 1, z)
        this.b('bonestone', px, y - 2, z)
        this.b('bonestone', 0, y - 3, z)
      }
    // parapets with lantern gaps
    for (const px of [-3, 3])
      for (let z = 41; z <= 58; z++) {
        if (z <= 53) this.b('bonestone', px, y + 1, z)
        if (z % 4 === 1) this.b('glow', px, y + 2, z)
      }
    // landing braziers
    this.torch(-5, y + 1, 55)
    this.torch(5, y + 1, 55)
  }

  /* ============ the gatehouse — twin towers + pointed tunnel ============ */
  private buildGatehouse() {
    const y = PLATEAU + 1 // court walking level
    const b0 = y - 1 // base block bottom
    for (const sx of [1, -1] as const) {
      const x0 = sx === 1 ? 4 : -10
      const x1 = sx === 1 ? 10 : -4
      // twin towers with a battered base (load logic)
      this.fill('gobrick', x0 - 1, x1 + 1, b0 - 1, b0, 33, 41)
      this.fill('gobrick', x0, x1, b0, y + 16, 34, 40)
      // machicolation crown
      this.fill('bonestone', x0 - 1, x1 + 1, y + 10, y + 10, 33, 41)
      this.crenelX('bonestone', x0, x1, y + 17, 33)
      this.crenelX('bonestone', x0, x1, y + 17, 41)
      this.crenelZ('bonestone', 33, 40, y + 17, x0 - 1)
      this.crenelZ('bonestone', 34, 41, y + 17, x1 + 1)
      // arrow slits
      for (const sy of [y + 4, y + 7, y + 13]) {
        this.b('darkstone', x0 - 1, sy, 37)
        this.b('darkstone', x1 + 1, sy, 37)
      }
      this.spire(x0, x1, 34, 40, y + 18, 6)
      this.gargoyle(sx === 1 ? x0 - 2 : x1 + 2, y + 11, 33, sx)
    }
    // the court gate through the curtain wall + paved approach
    this.fill('cobble', -3, 3, b0, b0, 33, 40)
    this.carve(-3, 3, y, y + 5, 33, 33)
    this.archTop('gobrick', -3, 3, y + 6, 33)
    // tunnel faces (z=36 south, z=39 north) with a 5-wide pointed mouth
    for (const z of [36, 39]) {
      this.fill('gobrick', -3, 3, b0, y + 8, z, z)
      this.carve(-2, 2, y, y + 5, z, z)
      this.archTop('gobrick', -2, 2, y + 6, z)
      if (z === 36) {
        // tympanum glass + the half-raised portcullis
        this.b('stainedv', -1, y + 8, z)
        this.b('stainedr', 0, y + 8, z)
        this.b('stainedg', 1, y + 8, z)
        this.archTop('bonestone', -3, 3, y + 9, z)
        for (const px of [-2, 0, 2]) this.col('iron', px, z, y + 4, y + 5)
        this.b('iron', -1, y + 4, z)
        this.b('iron', 1, y + 4, z)
      }
      this.crenelX('bonestone', -4, 4, y + 12, z)
    }
    // tunnel vault + inner torches
    this.fill('gobrick', -3, 3, y + 9, y + 9, 37, 38)
    this.b('bonestone', 0, y + 8, 37)
    this.b('bonestone', 0, y + 8, 38)
    this.torch(-3, y, 38, false)
    this.torch(3, y, 38, false)
  }

  /* ============ the outer court ============ */
  private buildOuterCourt() {
    const y = PLATEAU + 1
    const b0 = y - 1
    // court floor: dressed cobble (the path dresses itself later)
    for (let z = 21; z <= 32; z++)
      for (let x = -25; x <= 25; x++) {
        if (x >= -3 && x <= 3 && z >= 20) continue
        if (x <= -22 && z >= 22) continue
        if (Math.abs(x) >= 24 && z >= 31) continue
        this.b((x * 7 + z * 11) % 9 === 0 ? 'mossy' : 'cobble', x, b0, z)
      }
    // curtain wall — south + east + west (corner turrets own the corners)
    this.fill('gobrick', -23, 23, b0, y + 6, 33, 33)
    this.crenelX('bonestone', -23, 23, y + 7, 33)
    for (const sx of [-1, 1] as const) {
      const x = sx === 1 ? 26 : -26
      this.fill('gobrick', x, x, b0, y + 6, 20, 30)
      this.crenelZ('bonestone', 20, 30, y + 7, x)
      for (const cz of [17, 33]) {
        this.fill('gobrick', x - 2, x + 2, b0, y + 11, cz - 2, cz + 2)
        this.spire(x - 2, x + 2, cz - 2, cz + 2, y + 12, 4)
      }
    }
    // the west wall reaches the bell tower in two short runs
    this.fill('gobrick', -26, -26, b0, y + 6, 20, 21)
    this.fill('gobrick', -26, -26, b0, y + 6, 31, 32)
    // the processional path — pale setts with a dark border
    for (let z = 20; z <= 32; z++)
      for (let x = -3; x <= 3; x++) {
        const mat = x === -3 || x === 3 || z === 20 ? 'darkstone' : (x + z) % 2 === 0 ? 'bonestone' : 'gobrick'
        this.b(mat, x, b0, z)
      }
    // knight statues + banners + dead trees + rubble
    for (const sz of [24, 29]) {
      this.knightStatue(-7, sz, y)
      this.knightStatue(6, sz, y)
    }
    this.bannerPole(-10, 27, y)
    this.bannerPole(9, 27, y)
    this.col('log', -13, 21, y, y + 2)
    this.col('log', 12, 30, y, y + 2)
    this.b('cobble', 13, y, 29)
    this.b('mossy', -14, y, 22)
    // the east cloister — arcade walk under a slate lean-to
    this.fill('slate', 17, 19, y + 4, y + 4, 19, 32)
    for (let z = 19; z <= 32; z += 3) {
      this.fill('gobrick', 18, 19, y, y + 2, z, z + 1)
      this.b('bonestone', 18, y + 3, z)
      this.b('bonestone', 19, y + 3, z)
    }
    for (let z = 19; z <= 32; z++) {
      this.fill('gobrick', 16, 16, y, y + 2, z, z)
      if (z % 3 !== 0) this.b('bonestone', 17, y + 3, z)
    }
    // cloister keeps: bench, well head, candle stubs
    this.fill('mossy', 17, 17, y, y, 24, 26)
    this.fill('cobble', 18, 19, y, y, 27, 28)
    this.b('iron', 18, y + 1, 27)
    this.b('iron', 19, y + 1, 27)
    this.b('glow', 18, y + 1, 28)
  }

  /* ============ cathedral shell: nave + aisles + west towers ============ */
  private buildCathedralShell() {
    const y = PLATEAU + 1
    const b0 = y - 1
    const wallTop = y + 15 // clerestory crown (28)
    // nave exterior walls (x=±11, z 15..-7; the west towers own z 14..20)
    for (let z = -7; z <= 13; z++) {
      for (const sx of [-11, 11]) {
        this.col('gobrick', sx, z, b0, wallTop)
        // clerestory stained windows every 4
        if (z % 4 === 1 && z > -6 && z < 14) {
          for (let yy = y + 10; yy <= y + 13; yy++) this.b('stainedb', sx, yy, z)
          this.b('bonestone', sx, y + 9, z)
          this.b('bonestone', sx, y + 14, z)
        }
        // aisle windows (alternating ruby / violet)
        if (z % 5 === 2 && z > -5 && z < 14) {
          for (let yy = y + 2; yy <= y + 5; yy++) this.b(z % 10 === 2 ? 'stainedr' : 'stainedv', sx, yy, z)
        }
      }
    }
    // facade band + parapet (the west towers own z 14..20)
    this.fill('gobrick', -6, 6, b0, wallTop, 15, 15)
    this.fill('bonestone', -11, 11, wallTop + 1, wallTop + 1, -7, 13)

    // west twin towers 7×7 — the facade's frame
    for (const sx of [1, -1] as const) {
      const x0 = sx === 1 ? 7 : -13
      const x1 = sx === 1 ? 13 : -7
      this.fill('gobrick', x0, x1, b0, y + 19, 14, 20)
      // a tall golden slit window down the outer face — two panes, one stone band
      const wx = sx === 1 ? x0 : x1
      this.carve(wx, wx, y + 5, y + 13, 17, 17)
      for (let yy = y + 6; yy <= y + 8; yy++) this.b('stainedg', wx, yy, 17)
      this.b('gobrick', wx, y + 9, 17)
      for (let yy = y + 10; yy <= y + 12; yy++) this.b('stainedg', wx, yy, 17)
      this.spire(x0, x1, 14, 20, y + 20, 8)
      this.gargoyle(x0 + (sx === 1 ? 0 : 6), y + 20, 13, sx)
    }

    this.buildAisles()

    // nave roof — steep gable, ridge along z (removable ceiling)
    for (let i = 0; i <= 11; i++) {
      const yy = y + 17 + Math.floor(i / 1.5)
      this.fill('slate', -11 + i, 11 - i, yy, yy, -7, 13, true)
    }
    for (let z = -7; z <= 13; z += 2) this.b('bonestone', 0, y + 25, z, true)
    this.b('gold', 0, y + 25, 4, true)
    this.b('gold', 0, y + 25, -4, true)
  }

  /** clustered piers, pointed arcades, aisle roofs */
  private buildAisles() {
    const y = PLATEAU + 1
    const pierZ = [13, 8, 3, -2]
    for (const sx of [1, -1] as const) {
      const px = sx === 1 ? 5 : -6 // pier occupies px..px+1
      for (const z of pierZ) {
        this.fill('gobrick', px, px + 1, y - 1, y + 9, z, z + 1)
        this.fill('bonestone', px, px + 1, y + 10, y + 11, z, z + 1)
        this.b('gold', px, y + 12, z)
        this.b('gold', px + 1, y + 12, z + 1)
        this.fill('bonestone', px, px + 1, y + 13, y + 13, z, z + 1)
      }
      // pointed arcade arches over the open spans between piers
      for (let i = 0; i < pierZ.length - 1; i++) {
        const lo = pierZ[i + 1] + 2 // first open cell past the lower pier
        const hi = pierZ[i] - 1 // last open cell before the upper pier
        if (hi < lo) continue
        const mid = Math.floor((lo + hi) / 2)
        let step = 0
        for (let z = lo; z <= mid; z++, step++) {
          this.b('bonestone', px, y + 8 + step, z)
          this.b('bonestone', px, y + 8 + step, hi - (z - lo))
        }
        for (let s = 0; s <= step; s++) this.b('bonestone', px, y + 8 + s, mid)
      }
      // aisle roof (flat slate + parapet) — removable ceiling
      const x0 = sx === 1 ? 7 : -10
      const x1 = sx === 1 ? 10 : -7
      this.fill('slate', x0, x1, y + 8, y + 8, -7, 13, true)
      this.fill('bonestone', x0, x1, y + 9, y + 9, -7, 13, true)
    }
  }

  /* ============ the west facade: portal + rose window ============ */
  private buildFacade() {
    const y = PLATEAU + 1
    const fz = 15
    // the grand portal: 5 wide × 7 high + pointed peak
    this.carve(-2, 2, y, y + 6, fz, fz)
    this.archTop('gobrick', -2, 2, y + 7, fz)
    // bone arch band + jamb guardians
    this.archTop('bonestone', -3, 3, y + 7, fz)
    for (let yy = y; yy <= y + 6; yy++) {
      this.b('bonestone', -3, yy, fz)
      this.b('bonestone', 3, yy, fz)
    }
    this.fill('darkstone', -3, -3, y, y + 5, fz - 1, fz - 1)
    this.b('cobble', -3, y + 6, fz - 1)
    this.fill('darkstone', 3, 3, y, y + 5, fz - 1, fz - 1)
    this.b('cobble', 3, y + 6, fz - 1)
    // tympanum glass over the mouth
    this.b('stainedv', -1, y + 8, fz)
    this.b('stainedr', 0, y + 8, fz)
    this.b('stainedg', 1, y + 8, fz)

    /* ---- THE ROSE WINDOW — a wheel of glass, center (0, y+13) ---- */
    const cy = y + 13
    for (let dx = -3; dx <= 3; dx++)
      for (let dy = -3; dy <= 3; dy++) {
        const d = Math.hypot(dx, dy)
        if (d > 3.4) continue
        if (dx === 0 && dy === -3) continue // the portal arch peak owns this cell
        if (d > 2.6) { this.b('bonestone', dx, cy + dy, fz); continue }
        if (Math.abs(dx) < 0.7 || Math.abs(dy) < 0.7) { this.b('bonestone', dx, cy + dy, fz); continue }
        const glass = dy >= 1 ? 'stainedb' : dy <= -1 ? 'stainedr' : dx < 0 ? 'stainedv' : 'stainedg'
        this.b(glass, dx, cy + dy, fz)
      }
    this.b('gold', 0, cy, fz)
    // porch steps up to the portal
    this.fill('bonestone', -4, 4, y - 2, y - 2, 16, 19)
    this.fill('marble', -4, 4, y - 1, y - 1, 16, 19)
  }

  /* ============ nave interior dressing ============ */
  private buildNaveInterior() {
    const y = PLATEAU + 1
    // checker marble floor + the crimson processional carpet
    for (let z = -7; z <= 14; z++)
      for (let x = -10; x <= 10; x++) {
        if (this.solidStruct(x, y - 1, z)) continue
        if (z === 14 && Math.abs(x) >= 7) continue // the west towers own it
        if (x >= -1 && x <= 1 && z >= -6) continue // the carpet owns it
        const checker = (Math.floor((x + 10) / 2) + Math.floor((z + 7) / 2)) % 2 === 0
        this.b(checker ? 'marble' : 'marbledark', x, y - 1, z)
      }
    for (let z = -6; z <= 14; z++)
      for (let x = -1; x <= 1; x++) this.b('carpet', x, y - 1, z)
    // pew rows beside the carpet
    for (const px of [-3, 3])
      for (const pz of [-4, -1, 2, 5, 8, 11]) {
        this.fill('plank', px, px, y, y, pz, pz + 2)
        this.b('plank', px + (px > 0 ? 1 : -1), y + 1, pz + 1)
      }
    // ribbed vault — pale diagonal ribs from each pier to the ridge
    const ridge = y + 19
    for (const pz of [13, 8, 3, -2, -6]) {
      for (const sx of [1, -1] as const) {
        let x = sx * 5
        let yy = y + 14
        while (x !== 0) {
          this.b('bonestone', x, yy, pz, true)
          x -= sx
          yy += 1
        }
        this.b('bonestone', 0, ridge, pz, true)
      }
      // dark web panels sag between the rib planes
      const zm = pz - 3
      if (zm > -7) for (let x = -4; x <= 4; x++) this.b('darkstone', x, y + 13 + (5 - Math.abs(x)), zm, true)
    }
    for (let z = -6; z <= 13; z++) this.b('bonestone', 0, ridge, z, true)
    // the two great chandeliers
    this.chandelier(0, y + 18, 8)
    this.chandelier(0, y + 18, -1)
    // side altars in the aisles
    for (const sx of [-1, 1] as const) {
      this.fill('bonestone', sx * 9, sx * 9, y, y + 1, -5, -4)
      this.b('glow', sx * 9, y + 2, -4)
      this.b('glow', sx * 9, y + 2, -5)
    }
    // braziers at the nave entrance
    this.torch(-4, y, 13)
    this.torch(4, y, 13)
  }

  /* ============ crossing + transepts + lantern tower ============ */
  private buildCrossingAndTransept() {
    const y = PLATEAU + 1
    const b0 = y - 1
    const wallTop = y + 15
    // transept arm end walls (x=±20, z -8..-14) with great pointed glass
    for (let z = -14; z <= -8; z++)
      for (const sx of [-20, 20]) {
        this.col('gobrick', sx, z, b0, wallTop)
        if (z === -11 || z === -10) {
          this.carve(sx, sx, y + 4, y + 12, z, z)
          const glass = sx === 20 ? 'stainedb' : 'stainedv'
          for (let yy = y + 5; yy <= y + 11; yy++) this.b(glass, sx, yy, z)
        }
      }
    // transept north/south walls
    this.fill('gobrick', -20, 20, b0, wallTop, -8, -8)
    this.fill('gobrick', -20, 20, b0, wallTop, -14, -14)
    // carve the crossing passages + pointed arches
    for (const z of [-8, -14]) {
      this.carve(-4, 4, y, y + 9, z, z)
      this.archTop('gobrick', -4, 4, y + 10, z)
    }
    // crossing piers — four massive cluster columns
    for (const [cx, cz] of [[6, -10], [6, -13], [-7, -10], [-7, -13]] as const) {
      this.fill('gobrick', cx, cx + 1, b0, y + 13, cz, cz + 1)
      this.fill('bonestone', cx, cx + 1, y + 14, y + 14, cz, cz + 1)
      this.b('gold', cx, y + 15, cz)
    }
    // crossing floor
    for (let x = -6; x <= 6; x++)
      for (let z = -13; z <= -9; z++)
        if (!this.solidStruct(x, b0, z)) this.b((x + z) % 2 === 0 ? 'marble' : 'marbledark', x, b0, z)
    // the lantern tower — glass walls up to the spire
    for (let yy = y + 16; yy <= y + 28; yy++) {
      for (const [ax, az] of [[-5, -8], [5, -8], [-5, -14], [5, -14]] as const) this.col('gobrick', ax, az, yy, yy)
      if (yy % 3 === 1) {
        for (let x = -4; x <= 4; x++) { this.b('stainedg', x, yy, -8); this.b('stainedg', x, yy, -14) }
        for (let z = -13; z <= -9; z++) { this.b('stainedg', -5, yy, z); this.b('stainedg', 5, yy, z) }
      }
    }
    this.spire(-5, 5, -8, -14, y + 29, 9)
    // transept gable roof (removable ceiling) — ridge at z=-11
    this.fill('slate', -20, 20, y + 18, y + 18, -11, -11, true)
    this.fill('slate', -20, 20, y + 17, y + 17, -10, -12, true)
    this.fill('slate', -20, 20, y + 16, y + 16, -9, -13, true)
    this.fill('slate', -20, 20, y + 15, y + 15, -8, -14, true)
    // small rose wheels on each arm end
    for (const sx of [-20, 20])
      for (let dx = -1; dx <= 1; dx++)
        for (let dy = -1; dy <= 1; dy++)
          if (Math.hypot(dx, dy) <= 1.4) this.b('bonestone', sx, y + 16 + dy, -11 + dx)

    /* ---- EAST ARM: the moon chapel ---- */
    for (let x = 8; x <= 19; x++)
      for (let z = -13; z <= -9; z++)
        if (!this.solidStruct(x, b0, z)) this.b((x + z) % 2 === 0 ? 'marble' : 'marbledark', x, b0, z)
    this.fill('bonestone', 17, 18, y, y + 1, -12, -10)
    this.b('stainedb', 19, y + 2, -11)
    this.b('glow', 17, y + 2, -12)
    this.b('glow', 17, y + 2, -10)
    for (const z of [-13, -9]) for (const x of [11, 14]) this.fill('plank', x, x + 2, y, y, z, z)
    const cl = new THREE.PointLight(0x9fb8ff, 1.6, 14, 1.8)
    cl.position.set(15, y + 5, -11)
    this.group.add(cl)

    /* ---- WEST ARM: reliquary shrine + the crypt stair door ---- */
    for (let x = -19; x <= -8; x++)
      for (let z = -13; z <= -9; z++)
        if (!this.solidStruct(x, b0, z)) this.b((x + z) % 2 === 0 ? 'marble' : 'marbledark', x, b0, z)
    this.fill('bonestone', -18, -17, y, y + 2, -12, -10)
    this.b('gold', -17, y + 3, -11)
    this.b('glow', -18, y + 3, -12)
    this.b('glow', -18, y + 3, -10)
  }

  /* ============ choir + apse sanctuary (the throne of the gods) ============ */
  private buildChoirSanctuary() {
    const y = PLATEAU + 1
    const b0 = y - 1
    const wallTop = y + 15
    // choir floor + walls (z -15..-23)
    for (let z = -23; z <= -15; z++) {
      for (let x = -10; x <= 10; x++)
        if (!this.solidStruct(x, b0, z)) this.b((Math.floor((x + 10) / 2) + Math.floor((z + 15) / 2)) % 2 === 0 ? 'marble' : 'marbledark', x, b0, z)
      for (const sx of [-11, 11]) {
        this.col('gobrick', sx, z, b0, wallTop)
        if (z % 4 === 2 && z > -22) {
          for (let yy = y + 10; yy <= y + 13; yy++) this.b('stainedv', sx, yy, z)
          this.b('bonestone', sx, y + 9, z)
          this.b('bonestone', sx, y + 14, z)
        }
      }
    }
    this.fill('bonestone', -11, 11, wallTop + 1, wallTop + 1, -23, -15)
    // choir roof (gable, removable)
    for (let i = 0; i <= 11; i++) {
      const yy = y + 17 + Math.floor(i / 1.5)
      this.fill('slate', -11 + i, 11 - i, yy, yy, -23, -15, true)
    }
    // choir stalls facing each other across the carpet
    for (let z = -21; z <= -15; z++)
      for (let x = -1; x <= 1; x++) this.b('carpet', x, b0, z)
    for (const px of [-4, 4])
      for (let z = -21; z <= -16; z += 3) {
        this.fill('darkstone', px, px, y, y, z, z + 1)
        this.b('plank', px + (px > 0 ? -1 : 1), y + 1, z)
        this.b('plank', px + (px > 0 ? -1 : 1), y + 1, z + 1)
      }
    /* ---- the apse — a curved wall of glass (z -24..-30) ---- */
    const cz = -24
    for (let dx = -8; dx <= 8; dx++) {
      const depth = Math.floor(Math.sqrt(Math.max(0, 81 - dx * dx)) - 1)
      for (let dz = -1; dz >= -depth && cz + dz >= -30; dz--) {
        const zz = cz + dz
        if (dz === -depth || dz === -1) this.col('gobrick', dx, zz, b0, wallTop)
        else {
          const isMullion = dx % 3 === 0 || dz === -3
          if (isMullion) this.col('bonestone', dx, zz, b0, wallTop)
          else
            for (let yy = y + 3; yy <= wallTop - 2; yy++)
              this.b(yy % 5 === 4 ? 'bonestone' : dx < -1 ? 'stainedr' : dx > 1 ? 'stainedb' : 'stainedv', dx, yy, zz)
        }
        if (dz === -depth) this.b('marbledark', dx, b0, zz)
        else if (!this.solidStruct(dx, b0, zz)) this.b('marble', dx, b0, zz)
      }
    }
    // apse roof — half cone of slate
    for (let dz = 0; dz <= 6; dz++) {
      const half = Math.max(0, 8 - dz * 1.35)
      this.fill('slate', -Math.floor(half), Math.floor(half), y + 16 + dz, y + 16 + dz, cz - dz - 1, cz - dz - 1, true)
    }
    /* ---- the sanctuary: two steps, then THE THRONE ---- */
    this.fill('marbledark', -5, 5, y, y, -22, -23)
    this.fill('marbledark', -6, 6, y, y, -24, -30)
    this.fill('marble', -5, 5, y + 1, y + 1, -24, -30)
    // clear the apse's center mullions — the throne owns this bay
    this.carve(-3, 3, y, wallTop, -26, -29)
    const ty = y + 2
    this.fill('gold', -2, 2, ty, ty, -26, -28)
    this.fill('woolred', -2, 2, ty + 1, ty + 1, -27, -28)
    this.fill('gold', -2, 2, ty + 1, ty + 4, -29, -29)
    this.b('glow', 0, ty + 5, -29)
    for (const [cx, czz] of [[-2, -26], [2, -26], [-2, -29], [2, -29]] as const) this.col('bonestone', cx, czz, ty + 1, ty + 5)
    this.fill('gold', -3, 3, ty + 6, ty + 6, -30, -25)
    this.b('stainedv', 0, ty + 7, -27)
    // kneeling statues flanking the dais
    for (const sx of [-1, 1] as const) {
      this.fill('darkstone', sx * 4, sx * 4, y + 2, y + 3, -25, -24)
      this.b('cobble', sx * 4, y + 4, -24)
    }
    this.torch(-4, ty, -27)
    this.torch(4, ty, -27)
    // the sanctuary keeps its own warm light — the gods' hearth
    const sl = new THREE.PointLight(0xffb870, 3.2, 24, 1.5)
    sl.position.set(0.5, ty + 5, -26)
    this.group.add(sl)
    const cl = new THREE.PointLight(0xffc890, 2.6, 22, 1.6)
    cl.position.set(0.5, y + 9, -18)
    this.group.add(cl)
    // the great chandelier of the crossing
    this.chandelier(0, y + 26, -11, 3, 26)
  }

  /* ============ the crypt of kings ============ */
  private buildCrypt() {
    const y = PLATEAU + 1
    const fy = CRYPT_FLOOR_Y // floor block bottom → walk on fy+1
    const cy = CRYPT_CEIL_Y // ceiling block bottom
    // chamber shell: x -12..12, z -26..-12
    this.fill('stone', -12, 12, fy, fy, -26, -12)
    for (let x = -12; x <= 12; x++)
      for (let z = -26; z <= -12; z++) {
        const edge = x === -12 || x === 12 || z === -26 || z === -12
        if (edge) this.fill('gobrick', x, x, fy + 1, cy, z, z)
        this.b('gobrick', x, cy, z) // ceiling slab under the cathedral floor
      }
    // twin column rows
    for (const px of [-6, 6])
      for (let z = -24; z <= -13; z += 4) this.col('gobrick', px, z, fy + 1, cy - 1)
    // sarcophagi of kings
    for (const [sx, sz] of [[-9, -22], [-9, -18], [9, -22], [9, -18], [-3, -24], [3, -24]] as const) {
      this.fill('stone', sx - 1, sx + 1, fy + 1, fy + 2, sz, sz + 2)
      this.b('bonestone', sx, fy + 3, sz + 2)
      if ((sx + sz) % 2 === 0) this.b('bone', sx, fy + 3, sz)
    }
    // an open tomb with bones spilling
    this.fill('stone', 0, 2, fy + 1, fy + 1, -20, -18)
    this.b('bone', 1, fy + 2, -19)
    this.b('bone', 2, fy + 2, -18)
    this.b('bone', 0, fy + 2, -17)
    // the half-open iron gate
    for (let x = -2; x <= 2; x += 2) this.col('iron', x, -16, fy + 1, cy - 1)
    this.fill('iron', -2, 2, cy - 1, cy - 1, -16, -16)
    // candle niches + bone heaps
    for (const [nx, nz] of [[-11, -20], [11, -20], [-11, -15], [11, -15]] as const) this.b('glow', nx, fy + 3, nz)
    this.b('bone', -4, fy + 1, -14)
    this.b('bone', 5, fy + 1, -25)
    this.b('cobble', -7, fy + 1, -17)
    /* ---- the stair shaft from the east aisle ---- */
    // tunnel walls (x=8 / x=11) close the stair sides
    for (let z = -3; z <= -8; z++) {
      this.col('gobrick', 8, z, fy, cy)
      this.col('gobrick', 11, z, fy, cy)
    }
    // seal the tunnel's west end under the aisle floor
    this.fill('gobrick', 8, 11, fy, cy, -4, -5)
    // open the floor of the east aisle above the stair head
    this.carve(9, 10, y - 1, y - 1, -7, -6)
    // the steps: six blocks down from the aisle floor to the crypt
    for (let i = 0; i <= 5; i++) this.fill('gobrick', 9, 10, y - 2 - i, y - 2 - i, -6 - i, -6 - i)
    // connect into the chamber at the stair foot
    this.carve(9, 10, fy + 1, cy - 1, -12, -12)
    // crypt lights
    const l1 = new THREE.PointLight(0xffb060, 1.7, 16, 1.9)
    l1.position.set(-5.5, fy + 3.5, -19)
    const l2 = new THREE.PointLight(0xffb060, 1.7, 16, 1.9)
    l2.position.set(5.5, fy + 3.5, -21)
    this.group.add(l1, l2)
  }

  /* ============ the library annex (west aisle door) ============ */
  private buildLibrary() {
    const y = PLATEAU + 1
    const b0 = y - 1
    // room x -22..-12, z -3..5
    this.fill('marble', -21, -13, b0, b0, -2, 4)
    for (let z = -3; z <= 5; z++) {
      this.col('gobrick', -22, z, b0, y + 6)
      this.col('gobrick', -12, z, b0, y + 6)
    }
    for (let x = -22; x <= -12; x++) {
      this.col('gobrick', x, -3, b0, y + 6)
      this.col('gobrick', x, 5, b0, y + 6)
    }
    this.fill('slate', -23, -11, y + 7, y + 7, -4, 6)
    // door from the west aisle (x=-12, z=1..3)
    this.carve(-12, -12, y, y + 2, 1, 3)
    // west windows
    for (const z of [0, 4]) for (let yy = y + 2; yy <= y + 4; yy++) this.b('stainedb', -22, yy, z)
    // shelves + reading tables
    for (const sx of [-21, -19])
      for (let z = -2; z <= 3; z += 3) {
        this.fill('shelf', sx, sx, y, y + 1, z, z + 1)
        this.b('plank', sx + 1, y + 2, z)
      }
    this.fill('plank', -17, -15, y, y, 2, 3)
    this.b('glow', -16, y + 1, 2)
    this.fill('plank', -17, -15, y, y, -1, 0)
    this.b('crate', -13, y, 4)
    const ll = new THREE.PointLight(0xffc880, 1.5, 13, 1.8)
    ll.position.set(-17, y + 4, 2)
    this.group.add(ll)
  }

  /* ============ bell tower (west of the court) ============ */
  private buildBellTower() {
    const y = PLATEAU + 1
    const b0 = y - 1
    const x0 = -30, x1 = -22, z0 = 22, z1 = 30
    this.fill('gobrick', x0, x1, b0, b0, z0, z1)
    this.fill('gobrick', x0, x1, b0, y + 18, z0, z1)
    this.fill('gobrick', x0 - 1, x1 + 1, b0 - 1, b0, z0 - 1, z1 + 1)
    // tall pointed windows up the shaft
    for (const sy of [y + 4, y + 9, y + 14]) {
      this.b('stainedg', x1 + 1, sy, 26)
      this.b('stainedg', x0 - 1, sy, 26)
      this.b('stainedg', -26, sy, z1 + 1)
    }
    // belfry — open pointed arches on all four faces
    for (const [bx, bz] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]] as const) this.col('gobrick', bx, bz, y + 19, y + 23)
    for (let x = x0 + 2; x <= x1 - 2; x++) { this.b('gobrick', x, y + 19, z0); this.b('gobrick', x, y + 19, z1) }
    for (let z = z0 + 2; z <= z1 - 2; z++) { this.b('gobrick', x0, y + 19, z); this.b('gobrick', x1, y + 19, z) }
    this.archTop('gobrick', x0 + 2, x1 - 2, y + 20, z0)
    this.archTop('gobrick', x0 + 2, x1 - 2, y + 20, z1)
    for (const bx of [x0, x1]) {
      let a = z0 + 2, b2 = z1 - 2, yy = y + 20
      while (a < b2) { this.b('gobrick', bx, yy, a); this.b('gobrick', bx, yy, b2); a++; b2--; yy++ }
    }
    // the bell — the golden anchor seen from the whole island
    this.fill('iron', x0 + 2, x1 - 2, y + 24, y + 24, z0 + 2, z1 - 2)
    this.fill('gold', -27, -25, y + 21, y + 23, 25, 27)
    this.b('iron', -26, y + 24, 26)
    this.spire(x0, x1, z0, z1, y + 25, 7)
  }

  /* ============ flying buttresses + gargoyles ============ */
  private buildButtresses() {
    const y = PLATEAU + 1
    // the west piers skip z=0 — the library annex owns that flank
    const zsBySide: [number[], number[]] = [[12, 6, 0, -6, -19], [12, 6, -6, -19]]
    for (const sx of [1, -1] as const) {
      for (const z of sx === 1 ? zsBySide[0] : zsBySide[1]) {
        const px = sx * 15
        this.fill('gobrick', px, px + sx, y - 1, y + 11, z, z + 1)
        this.b('bonestone', px, y + 12, z)
        this.spire(px, px + sx, z, z + 1, y + 13, 3)
        // the flying arch — steps from pier shoulder to clerestory
        let bx = px
        let by = y + 10
        while (Math.abs(bx) > 11) {
          this.b('bonestone', bx, by, z)
          bx -= sx
          by += 1
        }
        this.b('bonestone', sx * 11, y + 13, z)
        this.gargoyle(px, y + 12, z + 1, sx)
      }
    }
  }

  /* ============ yard dressing — no bare ground inside the works ============
     The terrain skips every building footprint, so anything the
     builders don't floor by hand would be a hole. These are the
     deliberate fills: each yard has a purpose, a pavement and its
     own furniture — sealVoids() then mops up whatever is left. */
  private buildYardDressing() {
    const y = PLATEAU + 1
    const b0 = y - 1
    const pave = (x: number, z: number, mat: string) => {
      if (this.solidStruct(x, b0, z)) return
      this.b(mat, x, b0, z)
    }
    const cobbleAt = (x: number, z: number) => ((x * 5 + z * 13) % 11 === 0 ? 'mossy' : 'cobble')

    /* -- WEST: the monks' ossuary court (bell tower ↔ library) -- */
    for (let z = -3; z <= 20; z++)
      for (let x = -31; x <= -23; x++) {
        if (x >= -27 && x <= -25) pave(x, z, (x + z) % 2 === 0 ? 'bonestone' : 'gobrick') // the processional strip
        else pave(x, z, cobbleAt(x, z))
      }
    // six grave slabs of the night order — two rows facing the path
    for (const gz of [0, 6, 12])
      for (const gx of [-30, -24]) {
        this.fill('stone', gx, gx + 1, y, y, gz, gz + 1)
        this.sbA('bonestone', gx + 1, y + 0.62, gz + 1, 8, 2, 8) // ⅔ lid slab
        this.sbA('gold', gx + 1, y + 0.97, gz + 1, 2, 1, 8) // ⅓ gilded spine
        if ((gx + gz) % 3 === 0) this.sb('glow', gx, y, gz + 2, 1, 1, 1, 0, 0.4, -0.6) // ⅓ votive candle
      }
    // two dead cypress sentinels
    this.col('log', -31, 3, y, y + 3)
    this.b('log', -30, y + 3, 3)
    this.col('log', -31, 17, y, y + 2)
    // candle shrine against the library's south gable
    this.b('cobble', -23, y, -2)
    this.b('glow', -23, y + 1, -2)
    this.sb('bonestone', -22, y, -2, 2, 3, 2, -0.5, 0, 0) // ⅔ shrine niche
    // low watch-wall along the island rim
    for (let z = -2; z <= 20; z += 2) this.b('gobrick', -31, y + 1, z)
    // rubble drifts where the masons gave up
    this.sb('cobble', -29, y, 15, 2, 1, 2, 0, 0.45, 0)
    this.sb('cobble', -28, y, 15, 1, 1, 1, 0.6, 0.75, 0.4)
    this.sb('bonestone', -25, y, 9, 2, 1, 1, 0, 0.45, 0)

    /* -- NORTH: the parvis of the apse -- */
    for (let z = -31; z <= -36; z++)
      for (let x = -12; x <= 12; x++) {
        const d = Math.hypot(x, z + 33)
        pave(x, z, d < 6.4 ? ((x + z) % 2 === 0 ? 'marble' : 'marbledark') : d < 8.2 ? 'bonestone' : cobbleAt(x, z))
      }
    // four candle stands framing the apse window
    for (const [cx, cz] of [[-7, -32], [7, -32], [-7, -35], [7, -35]] as const) {
      this.b('cobble', cx, y, cz)
      this.b('glow', cx, y + 1, cz)
      this.sb('iron', cx, y + 1, cz, 1, 2, 1, 0, -0.8, 0) // ⅓ stand under the flame
    }
    // a nameless penitent kneels facing the glass
    this.fill('darkstone', -1, 0, y, y, -35, -34)
    this.b('darkstone', -1, y + 1, -36)
    this.sbA('darkstone', -0.5, y + 1.55, -36.6, 2, 2, 2) // ⅔ bowed head
    // bone offerings left by pilgrims
    this.sb('bone', -3, y, -33, 2, 1, 2, 0, 0.45, 0)
    this.sb('bone', 4, y, -31, 1, 1, 2, 0.4, 0.45, 0)
    this.sb('bone', 2, y, -36, 2, 1, 1, 0, 0.45, 0.3)

    /* -- EAST: the wall patrol walk (curtain ↔ buttress line) -- */
    for (let z = -28; z <= 14; z++)
      for (let x = 22; x <= 28; x++) {
        if (x >= 24 && x <= 26) pave(x, z, cobbleAt(x, z))
        else pave(x, z, (x * 3 + z) % 7 === 0 ? 'mossy' : 'gobrick')
      }
    for (const tz of [-24, -10, 4]) {
      this.b('log', 27, y, tz)
      this.b('glow', 27, y + 1, tz)
    }
    this.sb('cobble', 23, y, -18, 2, 1, 2, 0, 0.45, 0) // rubble
    this.sb('stone', 26, y, -2, 2, 1, 1, 0, 0.45, 0)
    this.sb('cobble', 24, y, 10, 1, 1, 2, 0.4, 0.45, 0)

    /* -- COURT SHOULDERS (between turrets and towers) -- */
    for (let z = 15; z <= 20; z++)
      for (let x = -19; x <= 19; x++) {
        if (Math.abs(x) <= 13) continue // towers/facade own the center
        pave(x, z, x > 0 ? cobbleAt(x, z) : ((x + z) % 2 === 0 ? 'gobrick' : 'cobble'))
      }
    // gardener's nook east: firewood, crates, moss
    this.fill('plank', 21, 22, y, y, 17, 18)
    this.sbA('plank', 21.5, y + 0.55, 18.5, 6, 2, 2) // ⅔ log pile
    this.b('crate', 25, y, 20)
    this.b('crate', 25, y, 21)
    this.b('crate', 25, y + 1, 20)
    // mirror nook west: boneworks
    this.fill('stone', -22, -21, y, y, 17, 18)
    this.sb('bone', -21, y, 20, 2, 1, 2, 0, 0.45, 0)
    this.sb('bone', -23, y, 20, 1, 1, 1, 0, 0.45, 0.4)

    /* -- SOUTHWEST strip beside the bell tower -- */
    for (let z = 21; z <= 32; z++)
      for (let x = -25; x <= -23; x++) pave(x, z, cobbleAt(x, z))
    this.b('cobble', -24, y, 24)
    this.b('glow', -24, y + 1, 24)
    this.sb('bone', -25, y, 28, 2, 1, 2, 0, 0.45, 0)

    /* -- FACADE PARVIS (the approach to the west portal) -- */
    for (let z = 16; z <= 20; z++)
      for (let x = -6; x <= 6; x++) {
        if (x >= -4 && x <= 4 && z <= 19) continue // the porch steps own it
        pave(x, z, (x + z) % 2 === 0 ? 'marble' : 'marbledark')
      }
    for (const px of [-6, 6]) {
      this.b('cobble', px, y, 20)
      this.b('glow', px, y + 1, 20)
    }

    /* -- TRANSEPT SHOULDERS (the seam between nave and transept) -- */
    for (const sx of [1, -1] as const)
      for (let x = 12; x <= 19; x++) pave(sx * x, -7, 'gobrick')
  }

  /* ============ the void sealer ============
     Final sweep: every skipped-terrain cell that no builder floored
     gets a plain gobrick block at plateau level. After this pass the
     island CANNOT show a hole — any future builder that forgets a
     floor still lands on stone. */
  private sealVoids() {
    for (let z = -HALF; z < HALF; z++)
      for (let x = -HALF; x < HALF; x++) {
        if (!this.builtAt(x, z)) continue
        const h = this.heights[this.idx(x, z)]
        if (h <= 0) continue // the cloud chasm — the bridge owns the gap
        // the crypt stairwell is a DELIBERATE hole in the aisle floor
        if (x >= CRYPT_SHAFT.x0 && x <= CRYPT_SHAFT.x1 && z >= CRYPT_SHAFT.z0 && z <= CRYPT_SHAFT.z1) continue
        const y = Math.min(h, PLATEAU)
        if (this.solid[this.cellIdx(x, z, y)] === 1 || this.solid[this.cellIdx(x, z, y - 1)] === 1) continue
        this.b('gobrick', x, y, z)
      }
  }

  /* ============ sub-voxel details — the ⅓/⅔ trim pass ============
     Every piece here exists for a structural or artistic reason:
     moldings relieve an arch, tracery holds glass, statues get
     anatomy, the Roc's deck keeps claw grooves. (1=⅓, 2=⅔, 3=full) */
  private buildSubDetails() {
    const y = PLATEAU + 1
    const b0 = y - 1

    /* -- knight statues (court): plinth steps, pauldrons, visor, sword -- */
    for (const sz of [24, 29])
      for (const sx of [-7, 6]) {
        const cx = sx + 1
        // two ⅔ plinth steps at the base corners
        this.sb('gobrick', sx - 1, b0, sz - 1, 3, 2, 3)
        this.sb('gobrick', sx + 2, b0, sz - 1, 3, 2, 3)
        this.sb('gobrick', sx - 1, b0, sz + 2, 3, 2, 3)
        this.sb('gobrick', sx + 2, b0, sz + 2, 3, 2, 3)
        // ⅔ pauldrons meet at the collarbone
        this.sb('darkstone', sx, y + 2, sz, 2, 2, 2, 1, 1, 0)
        this.sb('darkstone', sx + 1, y + 2, sz, 2, 2, 2, -1, 1, 0)
        // ⅓ visor slit + ⅔ helm crest
        this.sb('darkstone', sx + 1, y + 4, sz, 2, 1, 1, 0, 0, 1)
        this.sb('bonestone', sx, y + 4, sz, 2, 1, 2, 0, 1, 0)
        // a votive blade planted before each knight
        this.sb('iron', cx, y, sz - 1, 1, 5, 1, 0, 0.4, 0)
        this.sb('gold', cx, y + 1, sz - 1, 2, 1, 2, 0, -0.8, 0)
      }

    /* -- gatehouse: portcullis spikes, arch moldings, lion bosses -- */
    for (const px of [-2, 0, 2]) this.sb('iron', px, y + 3, 36, 1, 2, 1, 0, 0.6, 0)
    // a second, thinner arch band stepping ahead of the main one
    for (let xx = -3; xx <= 3; xx++) {
      this.sb('bonestone', xx, y + 5, 32, 3, 1, 2, 0, 0, -0.6)
    }
    for (const sx of [-1, 1] as const) {
      this.sbA('bonestone', sx * 3.9, y + 1.6, 35.4, 2, 2, 2) // springing boss
      this.sbA('darkstone', sx * 3.9, y + 1.6, 35.75, 1, 1, 1) // snout
    }

    /* -- rose window: gold tracery ring + oculus + cross spokes -- */
    const cy = y + 13
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2
      this.sbA('gold', 0.5 + Math.cos(a) * 2.25, cy + 0.5 + Math.sin(a) * 2.25, 15.68, 1, 1, 1)
    }
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2 + Math.PI / 8
      this.sbA('gold', 0.5 + Math.cos(a) * 0.6, cy + 0.5 + Math.sin(a) * 0.6, 15.68, 1, 1, 1)
    }
    for (const [dx, dy] of [[1.35, 0], [-1.35, 0], [0, 1.35], [0, -1.35]] as const)
      this.sbA('gold', 0.5 + dx, cy + 0.5 + dy, 15.68, 1, 1, 1)

    /* -- nave pews: ⅓ end caps -- */
    for (const px of [-3, 3])
      for (const pz of [-4, -1, 2, 5, 8, 11]) {
        this.sb('darkstone', px, y, pz, 2, 3, 1, 0, 0, -0.6)
        this.sb('darkstone', px, y, pz + 2, 2, 3, 1, 0, 0, 0.6)
      }

    /* -- nave side altars: ⅓ gold candlesticks -- */
    for (const sx of [-1, 1] as const) {
      this.sb('gold', sx * 9, y + 2, -5, 1, 2, 1, 0, 0.5, -0.4)
      this.sb('gold', sx * 9, y + 2, -4, 1, 2, 1, 0, 0.5, 0.4)
    }

    /* -- chandeliers: ⅓ iron candle cups under every flame -- */
    for (const [chx, chy, chz, r] of [
      [0, y + 18, 8, 2],
      [0, y + 18, -1, 2],
      [0, y + 26, -11, 3],
    ] as const) {
      const ly = chy - 4
      for (let dx = -r; dx <= r; dx++)
        for (let dz = -r; dz <= r; dz++) {
          if (Math.abs(dx) !== r && Math.abs(dz) !== r) continue
          if (Math.abs(dx) === r && Math.abs(dz) === r && r > 1) continue
          if ((dx + dz) % 2 !== 0) continue
          this.sb('iron', chx + dx, ly - 1, chz + dz, 2, 1, 2, 0, -0.7, 0)
        }
    }

    /* -- buttress piers: ⅔ setoff bands where the profile steps -- */
    const zsBySide: [number[], number[]] = [[12, 6, 0, -6, -19], [12, 6, -6, -19]]
    for (const sx of [1, -1] as const)
      for (const z of sx === 1 ? zsBySide[0] : zsBySide[1]) {
        const pcx = sx * 15 + sx * 0.5
        this.sbA('bonestone', pcx, y + 4.4, z + 1, 8, 2, 8)
        this.sbA('bonestone', pcx, y + 8.4, z + 1, 8, 2, 8)
      }

    /* -- gargoyles: ⅓ horns, snouts and raised wing vanes -- */
    for (const [gx, gy, gz, fx] of [
      [12, y + 11, 33, 1],
      [-12, y + 11, 33, -1],
      [7, y + 20, 13, 1],
      [-7, y + 20, 13, -1],
      [15, y + 12, 13, 1],
      [-15, y + 12, 13, -1],
      [15, y + 12, 7, 1],
      [-15, y + 12, 7, -1],
      [15, y + 12, 1, 1],
      [-15, y + 12, 1, -1],
      [15, y + 12, -5, 1],
      [-15, y + 12, -5, -1],
      [15, y + 12, -18, 1],
      [-15, y + 12, -18, -1],
    ] as const) {
      this.sb('darkstone', gx, gy, gz, 1, 1, 1, fx * 0.7, 1, 0.5) // horn
      this.sb('darkstone', gx, gy, gz, 1, 1, 2, fx * 1, -0.2, 0.5) // snout
      this.sb('darkstone', gx, gy, gz, 1, 2, 1, -fx * 0.5, 0.9, 0) // wing vane
      this.sb('darkstone', gx, gy, gz, 1, 2, 1, -fx * 0.5, 0.9, 1) // wing vane
    }

    /* -- throne of the gods: armrests, canopy fringe, orb -- */
    const ty = y + 2
    this.sb('gold', -2, ty + 1, -27, 2, 2, 8, 0, 0.5, -1)
    this.sb('gold', 2, ty + 1, -27, 2, 2, 8, 0, 0.5, -1)
    for (let fx = -3; fx <= 3; fx++) this.sb('woolred', fx, ty + 5, -25, 2, 1, 1, 0, -0.9, -0.7)
    this.sbA('glow', 0.5, ty + 7.8, -26.5, 1, 1, 1) // the orb above the canopy
    // kneeling statues: ⅔ hoods over the bowed heads
    for (const sx of [-1, 1] as const) this.sb('darkstone', sx * 4, y + 4, -24, 3, 2, 2, 0, 0.4, 0.3)

    /* -- crypt: ⅔ lid slabs + gold spines on every sarcophagus -- */
    for (const [sx, sz] of [
      [-9, -22],
      [-9, -18],
      [9, -22],
      [9, -18],
      [-3, -24],
      [3, -24],
    ] as const) {
      this.sbA('bonestone', sx, CRYPT_FLOOR_Y + 3.62, sz + 1, 8, 2, 8)
      this.sbA('gold', sx, CRYPT_FLOOR_Y + 3.97, sz + 1, 2, 1, 8)
    }
    // scattered ⅓ bones around the open tomb
    this.sb('bone', 3, CRYPT_FLOOR_Y + 1, -17, 1, 1, 2, 0, 0.45, 0)
    this.sb('bone', -1, CRYPT_FLOOR_Y + 1, -19, 2, 1, 1, 0, 0.45, 0.3)
    this.sb('bone', 6, CRYPT_FLOOR_Y + 1, -24, 1, 1, 1, 0.3, 0.45, 0)

    /* -- library: ⅔ books on the tables + a ⅓ reading candle -- */
    this.sb('woolred', -17, y + 1, 2, 2, 2, 1, 0.2, 0, 0)
    this.sb('bonestone', -16, y + 1, 2, 2, 2, 1, -0.3, 0, 0.4)
    this.sb('plank', -16, y + 1, -1, 2, 2, 1, 0, 0, 0.2)
    this.sb('glow', -16, y + 1, 2, 1, 1, 1, 0.8, 0.3, -0.4)

    /* -- bridge: lantern caps + the Roc's claw grooves on the deck -- */
    for (const px of [-3, 3])
      for (let z = 41; z <= 57; z += 4) {
        if (z < 54) this.sb('bonestone', px, y + 2, z, 2, 1, 2, 0, 0.7, 0)
        this.sb('iron', px, y + 2, z, 1, 1, 1, 0, -0.7, 0)
      }
    // the talon grooves — flush darkstone inlays EXACTLY under the
    // perched Roc's feet (perch at (-2.5, ·, 56.2) facing west:
    // contact patch x -1.1..-0.1, foot rows z 55.5 / 56.9), plus
    // landing scratches trailing toward the deck's heart
    this.sbA('darkstone', -0.62, b0 + 0.75, 55.53, 3.6, 1.5, 1.5)
    this.sbA('darkstone', -0.62, b0 + 0.75, 56.87, 3.6, 1.5, 1.5)
    this.sbA('darkstone', 0.35, b0 + 0.81, 56.1, 1.5, 0.6, 2.4)
    this.sbA('darkstone', -1.45, b0 + 0.81, 56.2, 1.2, 0.6, 1.2)

    /* -- apse mullions: ⅓ finial caps on the outer rim -- */
    for (let dx = -8; dx <= 8; dx += 3) {
      const depth = Math.floor(Math.sqrt(Math.max(0, 81 - dx * dx)) - 1)
      this.sb('bonestone', dx, y + 15, -24 - depth, 1, 2, 1, 0, 0.4, 0)
    }

    /* -- bell tower: the clapper under the golden bell -- */
    this.sbA('iron', -25.5, y + 20.4, 26.5, 1, 3, 1)
    this.sbA('iron', -25.5, y + 23.4, 26.5, 2, 1, 2)

    /* -- court processional path: ⅓ gold studs along the border -- */
    for (let z = 22; z <= 32; z += 2) {
      this.sbA('gold', -2.55, b0 + 0.94, z + 0.5, 1, 1, 1)
      this.sbA('gold', 2.55, b0 + 0.94, z + 0.5, 1, 1, 1)
    }

    /* -- ossuary graves: ⅓ candle stubs already placed; add ⅓ bone overflow -- */
    this.sb('bone', -28, y, 5, 1, 1, 2, 0.3, 0.45, 0)
    this.sb('bone', -26, y, 14, 2, 1, 1, 0, 0.45, 0.3)
  }

  /* ============ sky ============ */
  private buildSky() {
    /* the castle carries its OWN lights — they die with the zone when
       the viewer switches back to the Vale */
    const hemi = new THREE.HemisphereLight(0x54628a, 0x141820, 1.15)
    this.group.add(hemi)
    const key = new THREE.DirectionalLight(0xdfe6f2, 1.3)
    key.position.set(-70, 125, 75)
    this.group.add(key)
    const fill = new THREE.DirectionalLight(0x8a96b8, 0.45)
    fill.position.set(80, 40, 60)
    this.group.add(fill)
    // a soft vertical wash — keeps interior ceilings/columns legible
    const top = new THREE.DirectionalLight(0xbcc6dd, 0.55)
    top.position.set(10, 140, 10)
    this.group.add(top)

    const geo = new THREE.SphereGeometry(230, 20, 12)
    const pos = geo.attributes.position
    const colors = new Float32Array(pos.count * 3)
    const zen = new THREE.Color(0x070b16)
    const mid = new THREE.Color(0x1a2238)
    const hor = new THREE.Color(0x36324e)
    const v = new THREE.Vector3()
    for (let i = 0; i < pos.count; i++) {
      v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).normalize()
      const up = Math.max(0, v.y)
      const c = up < 0.3
        ? mid.clone().lerp(hor, ((0.3 - up) / 0.3) * 0.7)
        : mid.clone().lerp(zen, Math.min(1, (up - 0.3) / 0.55))
      colors[i * 3] = c.r
      colors[i * 3 + 1] = c.g
      colors[i * 3 + 2] = c.b
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    this.group.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false })))

    // a bigger, closer moon — the castle sails higher than the Vale
    const moon = new THREE.Mesh(new THREE.BoxGeometry(10, 10, 0.6), new THREE.MeshBasicMaterial({ color: 0xeef1f8, fog: false }))
    moon.position.set(-120, 120, -130)
    moon.lookAt(0, 0, 0)
    this.group.add(moon)
    const halo = new THREE.Mesh(new THREE.PlaneGeometry(22, 22), new THREE.MeshBasicMaterial({ color: 0xc4d2ee, transparent: true, opacity: 0.16, fog: false, depthWrite: false }))
    halo.position.set(-120, 120, -130)
    halo.lookAt(0, 0, 0)
    this.group.add(halo)

    const starN = 190
    const sp = new Float32Array(starN * 3)
    const r = mulberry32(8421)
    for (let i = 0; i < starN; i++) {
      const a = r() * Math.PI * 2
      const el = 0.2 + r() * 0.75
      const rad = 215
      sp[i * 3] = Math.cos(a) * rad * Math.cos(el)
      sp[i * 3 + 1] = Math.sin(el) * rad
      sp[i * 3 + 2] = Math.sin(a) * rad * Math.cos(el)
    }
    const sg = new THREE.BufferGeometry()
    sg.setAttribute('position', new THREE.BufferAttribute(sp, 3))
    this.group.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xd6dcec, size: 1.0, fog: false, transparent: true, opacity: 0.8 })))
  }

  /* ============ batching ============ */
  private buildInstanced(parent: THREE.Object3D, mat: THREE.Material | THREE.Material[], transforms: Vec3Lite[]) {
    if (!transforms.length) return
    const geo = new THREE.BoxGeometry(1, 1, 1)
    const mesh = new THREE.InstancedMesh(geo, mat, transforms.length)
    const d = new THREE.Object3D()
    for (let i = 0; i < transforms.length; i++) {
      d.position.set(transforms[i].x, transforms[i].y, transforms[i].z)
      d.updateMatrix()
      mesh.setMatrixAt(i, d.matrix)
    }
    mesh.instanceMatrix.needsUpdate = true
    // keep every material's cluster visible from every angle — the
    // per-material batches span the whole castle, so a wrong bounding
    // sphere would vanish whole rooms (the throne!) from inside views
    mesh.frustumCulled = false
    mesh.castShadow = true
    mesh.receiveShadow = true
    parent.add(mesh)
  }

  private flush() {
    for (const [key, list] of Object.entries(this.L)) {
      const mat = this.mats[key]
      if (mat && list.length) this.buildInstanced(this.group, mat, list)
    }
    for (const [key, list] of Object.entries(this.LC)) {
      const mat = this.mats[key]
      if (mat && list.length) this.buildInstanced(this.ceil, mat, list)
    }
    this.L = {}
    this.LC = {}
  }

  /** drifting clouds */
  update(dt: number) {
    this.t += dt
    for (let i = 0; i < this.clouds.length; i++) {
      const c = this.clouds[i]
      c.position.x += dt * (0.5 + (i % 3) * 0.25)
      if (c.position.x > 90) c.position.x = -90
    }
  }
}
