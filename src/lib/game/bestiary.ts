import * as THREE from 'three'
import {
  createHumanoid, createBow, createBlazeRods, setBowDraw, setNocked, bowDrawAmount,
  animIdle, animWalk, animZombieWalk, animZombieIdle,
  animCreeperWalk, animCreeperIdle, animSkeletonWalk, animBowIdle,
  animWitherWalk, animAttack, animHit, animDead, animRoll, animBlock, animBlockWalk, animDrink, animCast,
  animRoar, animSlam, animSweep, animCharge, animStomp, animStagger, animBossDead,
  animBowDraw, animBowShoot, animPoke, lerp, resetPose, setFlash, setFlashWhite,
  type Humanoid,
} from './models'

/* ============================================================
   BESTIARY — the registry that powers the 3D viewer.
   Every mob of the game with every animation it can perform.
   ============================================================ */

export interface ViewerAnim {
  id: string
  label: string
  /** loop length in seconds for one-shot (progress-based) animations;
      omit for ambient pose animations driven directly by elapsed time */
  dur?: number
  fn: (h: Humanoid, t: number, dt: number) => void
}

export interface BestiaryEntry {
  id: string
  name: string
  sub: string
  dot: string
  /** model scale as used in-game (drives viewer framing) */
  scale: number
  build: () => Humanoid
  /** per-frame hook for rig extras (bow string, blaze rods …) */
  onFrame?: (h: Humanoid, refs: Record<string, THREE.Object3D>, animId: string, t: number, dt: number) => void
  /** extra refs (besides the humanoid) the viewer must keep alive */
  refs?: (h: Humanoid) => Record<string, THREE.Object3D>
  anims: ViewerAnim[]
}

/** loop a one-shot animation: p = normalized cycle progress */
function shot(dur: number, fn: (h: Humanoid, p: number) => void) {
  return (h: Humanoid, t: number) => fn(h, (t % dur) / dur)
}

export const BESTIARY: BestiaryEntry[] = [
  /* ---------------- PLAYER ---------------- */
  {
    id: 'player',
    name: 'بي‌نام (بازیکن)',
    sub: 'آتش‌خاموش — شمشیر و سپر',
    dot: '#2fbf4a',
    scale: 1,
    build: () => createHumanoid('player', 1, { sword: true, shield: true }),
    anims: [
      { id: 'idle', label: 'ایستادن', fn: (h, t) => animIdle(h, t) },
      { id: 'walk', label: 'راه رفتن', fn: (h, t) => animWalk(h, t) },
      { id: 'atk1', label: 'حمله ۱', dur: 0.55, fn: shot(0.55, (h, p) => animAttack(h, p, 'light0')) },
      { id: 'atk2', label: 'حمله ۲', dur: 0.55, fn: shot(0.55, (h, p) => animAttack(h, p, 'light1')) },
      { id: 'atk3', label: 'حمله‌ی چرخشی', dur: 0.8, fn: shot(0.8, (h, p) => animAttack(h, p, 'light2')) },
      { id: 'heavy', label: 'حمله‌ی سنگین', dur: 0.9, fn: shot(0.9, (h, p) => animAttack(h, p, 'heavy')) },
      { id: 'block', label: 'دفاع', fn: (h, t) => animBlock(h, t) },
      { id: 'blockwalk', label: 'راه رفتن با سپر', fn: (h, t) => animBlockWalk(h, t) },
      { id: 'roll', label: 'غلتک', dur: 0.6, fn: shot(0.6, (h, p) => animRoll(h, p)) },
      { id: 'drink', label: 'نوشیدن شربت', dur: 1.2, fn: shot(1.2, (h, p) => animDrink(h, p)) },
      { id: 'cast', label: 'جادو', dur: 0.9, fn: shot(0.9, (h, p) => animCast(h, p)) },
      { id: 'hit', label: 'ضربه خوردن', dur: 0.45, fn: shot(0.45, (h, p) => animHit(h, p)) },
    ],
  },

  /* ---------------- HOLLOW ZOMBIE ---------------- */
  {
    id: 'zombie',
    name: 'زامبی تهی‌شده',
    sub: 'مردگان معمولی هالو',
    dot: '#96945a',
    scale: 0.98,
    build: () => createHumanoid('zombie', 0.98, { sword: true }),
    anims: [
      { id: 'idle', label: 'شامبل ایستاده', fn: (h, t) => animZombieIdle(h, t) },
      { id: 'walk', label: 'شامبل راه رفتن', fn: (h, t) => animZombieWalk(h, t) },
      { id: 'atk', label: 'حمله با شمشیر', dur: 0.55, fn: shot(0.55, (h, p) => animAttack(h, p, 'light0')) },
      { id: 'hit', label: 'ضربه خوردن', dur: 0.45, fn: shot(0.45, (h, p) => animHit(h, p)) },
      { id: 'dead', label: 'مرگ', dur: 1.0, fn: shot(1.0, (h, p) => animDead(h, p)) },
    ],
  },

  /* ---------------- SKELETON ARCHER ---------------- */
  {
    id: 'skeleton',
    name: 'تیرانداز استخوانی',
    sub: 'کماندار با کمان رفت‌وبرگشتی و تیر نوک‌شده',
    dot: '#ece8dc',
    scale: 0.97,
    build: () => createHumanoid('skeleton', 0.97),
    refs: (h) => {
      const bow = createBow()
      bow.position.set(0, -0.68, 0.05)
      bow.rotation.y = Math.PI / 2
      h.armL.add(bow)
      return { bow }
    },
    onFrame: (h, refs, animId, t, _dt) => {
      const bow = refs.bow as THREE.Group
      if (animId === 'draw') {
        setNocked(bow, true)
        setBowDraw(bow, bowDrawAmount((t % 1.4) / 1.4))
      } else if (animId === 'shoot') {
        const p = (t % 0.9) / 0.9
        setBowDraw(bow, Math.max(0, 1 - p * 7))
        setNocked(bow, p <= 0.06)
      } else {
        setNocked(bow, false)
        setBowDraw(bow, 0)
      }
    },
    anims: [
      { id: 'idle', label: 'آماده با کمان', fn: (h, t) => animBowIdle(h, t) },
      { id: 'walk', label: 'راه رفتن', fn: (h, t) => animSkeletonWalk(h, t) },
      { id: 'draw', label: 'نوشدن کمان', dur: 1.4, fn: (h, t) => animBowDraw(h, (t % 1.4) / 1.4) },
      { id: 'shoot', label: 'رها کردن تیر', dur: 0.9, fn: (h, t) => animBowShoot(h, (t % 0.9) / 0.9) },
      { id: 'poke', label: 'ضربه‌ی نزدیک', dur: 0.6, fn: shot(0.6, (h, p) => animPoke(h, p)) },
      { id: 'hit', label: 'ضربه خوردن', dur: 0.45, fn: shot(0.45, (h, p) => animHit(h, p)) },
      { id: 'dead', label: 'متلاشی شدن', dur: 1.0, fn: shot(1.0, (h, p) => animDead(h, p)) },
    ],
  },

  /* ---------------- CREEPER ---------------- */
  {
    id: 'creeper',
    name: 'خزنده‌ی سی‌سوخته',
    sub: 'چهارپای خزنده — فیوز روشن می‌شود',
    dot: '#59d959',
    scale: 0.92,
    build: () => createHumanoid('creeper', 0.92),
    anims: [
      { id: 'idle', label: 'نشستن ساکت', fn: (h, t) => animCreeperIdle(h, t) },
      { id: 'walk', label: 'چهارنوع راه رفتن', fn: (h, t) => animCreeperWalk(h, t) },
      {
        id: 'fuse',
        label: 'فیوز (سوختن)',
        dur: 1.05,
        fn: (h, _t, _dt) => {
          /* filled below — needs the base scale */
        },
      },
      { id: 'hit', label: 'ضربه خوردن', dur: 0.45, fn: shot(0.45, (h, p) => animHit(h, p)) },
    ],
  },

  /* ---------------- WITHER SKELETON ---------------- */
  {
    id: 'wither',
    name: 'شمشیرزن ویسری',
    sub: 'نگهبان خاکسترگاه با شمشیر سنگی',
    dot: '#8a8a96',
    scale: 1.08,
    build: () => createHumanoid('wither', 1.08, { sword: true, swordStyle: 'stone' }),
    anims: [
      { id: 'idle', label: 'کمین', fn: (h, t) => animZombieIdle(h, t) },
      { id: 'walk', label: 'راه رفتن شکارچی', fn: (h, t) => animWitherWalk(h, t) },
      { id: 'atk', label: 'تشه‌ی سنگین', dur: 0.55, fn: shot(0.55, (h, p) => animAttack(h, p, 'light0')) },
      { id: 'hit', label: 'ضربه خوردن', dur: 0.45, fn: shot(0.45, (h, p) => animHit(h, p)) },
      { id: 'dead', label: 'مرگ', dur: 1.0, fn: shot(1.0, (h, p) => animDead(h, p)) },
    ],
  },

  /* ---------------- BLAZE ---------------- */
  {
    id: 'blaze',
    name: 'شعله‌ی سرگردان',
    sub: 'نگهبان شناور با میله‌های دود چرخان',
    dot: '#ffb347',
    scale: 0.95,
    build: () => {
      const h = createHumanoid('blaze', 0.95)
      h.armL.visible = false
      h.armR.visible = false
      h.legL.visible = false
      h.legR.visible = false
      return h
    },
    refs: (h) => {
      const rods = createBlazeRods()
      h.root.add(rods.group)
      return { rods: rods.group }
    },
    onFrame: (h, refs, animId, _t, dt) => {
      const rods = refs.rods as THREE.Group
      rods.rotation.y += dt * (animId === 'windup' ? 9 : 2.4)
    },
    anims: [
      { id: 'idle', label: 'شناوری', fn: (h, t) => animCreeperIdle(h, t) },
      {
        id: 'windup',
        label: 'گرم شدن',
        dur: 0.85,
        fn: shot(0.85, (h, p) => {
          resetPose(h)
          h.head.rotation.x = -0.3 * p
          setFlashWhite(h, p * 0.55)
        }),
      },
      {
        id: 'shoot',
        label: 'شلیک گوی آتش',
        dur: 0.55,
        fn: shot(0.55, (h, p) => {
          resetPose(h)
          h.head.rotation.x = 0.15 * Math.sin(p * Math.PI)
          h.root.rotation.x = 0.1
        }),
      },
      {
        id: 'dead',
        label: 'فروریختن',
        dur: 0.9,
        fn: shot(0.9, (h, p) => {
          animDead(h, p)
        }),
      },
    ],
  },

  /* ---------------- BOSS 1: ANCIENT ZOMBIE KNIGHT ---------------- */
  {
    id: 'boss',
    name: 'شوالیه‌ی زامبی کهن',
    sub: 'باس اول — زره فولادی بر جسد پوسیده',
    dot: '#d43737',
    scale: 2.25,
    build: () => createHumanoid('boss', 2.25, { sword: true, swordScale: 1.9 }),
    anims: [
      { id: 'idle', label: 'قرار گرفتن', fn: (h, t) => animZombieIdle(h, t) },
      { id: 'walk', label: 'گام سنگین', fn: (h, t) => animWalk(h, t, 1.25) },
      { id: 'roar', label: 'خشم (معرفی)', dur: 2.1, fn: shot(2.1, (h, p) => animRoar(h, p)) },
      { id: 'slam', label: 'کوبیدن دودست', dur: 0.62, fn: shot(0.62, (h, p) => animSlam(h, p)) },
      { id: 'sweep', label: 'جاروی افقی', dur: 0.75, fn: shot(0.75, (h, p) => animSweep(h, p)) },
      { id: 'charge', label: 'یورش', dur: 0.85, fn: shot(0.85, (h, p) => animCharge(h, p)) },
      { id: 'stomp', label: 'لگد زمین‌شکن', dur: 0.9, fn: shot(0.9, (h, p) => animStomp(h, p)) },
      { id: 'stagger', label: 'شکست تعادل', dur: 1.9, fn: (h, t) => animStagger(h, (t % 1.9) / 1.9, t) },
      { id: 'dead', label: 'مرگ سینمایی', dur: 1.7, fn: shot(1.7, (h, p) => animBossDead(h, p)) },
      { id: 'hit', label: 'ضربه خوردن', dur: 0.45, fn: shot(0.45, (h, p) => animHit(h, p)) },
    ],
  },

  /* ---------------- BOSS 2: THE FLAME KING ---------------- */
  {
    id: 'bossflame',
    name: 'پادشاه شعله',
    sub: 'باس دوم — زره ابسیدین با رگه‌های گدازه',
    dot: '#ff6a1f',
    scale: 2.35,
    build: () => createHumanoid('bossflame', 2.35, { sword: true, swordScale: 2.1 }),
    anims: [
      { id: 'idle', label: 'قرار گرفتن', fn: (h, t) => animZombieIdle(h, t) },
      { id: 'walk', label: 'گام جنگ‌سالار', fn: (h, t) => animWalk(h, t, 1.1) },
      { id: 'roar', label: 'خشم (معرفی)', dur: 1.9, fn: shot(1.9, (h, p) => animRoar(h, p)) },
      {
        id: 'volley',
        label: 'رگبار گوی آتش',
        dur: 0.75,
        fn: shot(0.75, (h, p) => {
          resetPose(h)
          const q = Math.min(1, p * 2.5)
          h.armR.rotation.x = lerp(-2.9, -1.2, q)
          h.armL.rotation.x = lerp(-2.9, -1.2, q)
          h.head.rotation.x = -0.35 * (1 - q)
          setFlashWhite(h, 0.35 * (1 - q))
        }),
      },
      { id: 'sweep', label: 'جاروی شعله', dur: 0.75, fn: shot(0.75, (h, p) => animSweep(h, p)) },
      { id: 'slam', label: 'کوبیدن گدازه', dur: 0.65, fn: shot(0.65, (h, p) => animSlam(h, p)) },
      { id: 'dash', label: 'جهش آتشین', dur: 0.8, fn: shot(0.8, (h, p) => animCharge(h, p)) },
      { id: 'stagger', label: 'شکست تعادل', dur: 1.8, fn: (h, t) => animStagger(h, (t % 1.8) / 1.8, t) },
      { id: 'dead', label: 'مرگ سینمایی', dur: 1.7, fn: shot(1.7, (h, p) => animBossDead(h, p)) },
      { id: 'hit', label: 'ضربه خوردن', dur: 0.45, fn: shot(0.45, (h, p) => animHit(h, p)) },
    ],
  },
]

/* creeper fuse needs its base scale — patch it in after the registry literal */
{
  const entry = BESTIARY.find((e) => e.id === 'creeper')!
  const fuse = entry.anims.find((a) => a.id === 'fuse')!
  fuse.fn = shot(1.05, (h, p) => {
    resetPose(h)
    const s = 0.92 * (1 + 0.3 * p * p + Math.sin(p * 34) * 0.05 * p)
    h.group.scale.setScalar(s)
    h.legL.rotation.x = 0.45 * p
    h.legR.rotation.x = -0.45 * p
    if (h.legsBack) {
      h.legsBack[0].rotation.x = -0.35 * p
      h.legsBack[1].rotation.x = 0.35 * p
    }
    setFlashWhite(h, p * 0.5 + Math.max(0, Math.sin(p * 26)) * 0.3 * p)
  })
}

/** reset a creeper (or any scaled mob) back to its rest scale after a fuse loop */
export function resetMobScale(h: Humanoid, scale: number) {
  h.group.scale.setScalar(scale)
  setFlash(h, 0)
  setFlashWhite(h, 0)
  resetPose(h)
}
