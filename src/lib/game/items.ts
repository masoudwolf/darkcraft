/* ============================================================
   EQUIPMENT & LOOT — the Dark-Souls-style inventory backbone
   ------------------------------------------------------------
   DS1 rules adopted:
   - equipment slots: RH1/RH2 (right weapons), LH1/LH2 (shields
     and bows), and armor: head / chest / hands / legs / cape
   - EVERY equipped slot counts toward equip load — not just
     what is currently held
   - equip-burden ratio drives mobility:
       <25%  fast roll      25-50%  medium roll
       50-100% heavy roll   >100%   overburdened (no roll)
   - the inventory holds everything you own; equipping is a
     separate act (nothing is ever lost by swapping)
   ============================================================ */

import type { SwordStyle } from './models'

export type ItemId = string

export type ArmorSlot = 'head' | 'chest' | 'hands' | 'legs' | 'cape'
export type EquipSlot = 'rh1' | 'rh2' | 'lh1' | 'lh2' | ArmorSlot
export type ItemCategory = 'sword' | 'shield' | 'bow' | 'armor'
export type DmgType = 'phys' | 'fire' | 'blast'

export interface ItemDef {
  id: ItemId
  name: string
  cat: ItemCategory
  /** the canonical slot this equips into (rh → rh1/rh2, lh → lh1/lh2) */
  slot: 'rh' | 'lh' | ArmorSlot
  weight: number
  icon: string
  desc: string
  tier: 'common' | 'rare' | 'boss'
  /* weapon (sword) */
  dmg?: number // melee power — multiplies the player's base moveset (30 = exact starter)
  spd?: number // swing speed multiplier (<1 = heavier, slower swings)
  style?: SwordStyle
  scale?: number // model scale on the character
  /* shield */
  block?: number // 0..1 — fraction of damage soaked by a clean guard
  /* bow */
  bowDmg?: number
  /** ammo (arrows) — never equipped, consumed automatically when loosing */
  ammo?: boolean
  /* armor */
  def?: number // physical reduction fraction (0..0.2 per piece)
  fire?: number
  blast?: number
  /* visuals */
  tint?: number
  tint2?: number
}

/* ---------------- the catalogue ---------------- */

const I = (d: ItemDef) => d

export const ITEMS: Record<ItemId, ItemDef> = {
  /* ---- starter gear ---- */
  worn_sword: I({
    id: 'worn_sword', name: 'شمشیر پوسیده', cat: 'sword', slot: 'rh', weight: 3.0,
    icon: '🗡️', desc: 'تیغه‌ای که از آتش کمپ با آن برخاستی. ساده، اما وفادار.',
    tier: 'common', dmg: 30, spd: 1, style: 'iron', scale: 1,
  }),
  wooden_shield: I({
    id: 'wooden_shield', name: 'سپر چوبی', cat: 'shield', slot: 'lh', weight: 2.5,
    icon: '🛡️', desc: 'تخته‌ای با رینگ آهنی. ضربه را منحرف می‌کند، نه بیشتر.',
    tier: 'common', block: 0.85, tint: 0x8a6437,
  }),

  /* ---- hollow (zombie) gear — ragged but real ---- */
  rust_sword: I({
    id: 'rust_sword', name: 'شمشیر زنگ‌زده', cat: 'sword', slot: 'rh', weight: 3.6,
    icon: '⚔️', desc: 'تیغه‌ی دندانه‌دار هالک‌ها. زنگ، هنوز برنده را برنده می‌کند.',
    tier: 'common', dmg: 34, spd: 0.97, style: 'rust', scale: 1,
  }),
  iron_shield: I({
    id: 'iron_shield', name: 'سپر آهنی', cat: 'shield', slot: 'lh', weight: 4.2,
    icon: '🛡️', desc: 'پرده‌ی فولادیِ خالص. سنگین است اما ضربه‌ها را می‌خورد.',
    tier: 'rare', block: 0.93, tint: 0x9aa0a8,
  }),
  hollow_hood: I({
    id: 'hollow_hood', name: 'کلاه‌پوسیده', cat: 'armor', slot: 'head', weight: 1.2,
    icon: '🎩', desc: 'کلاهی از چرم خیس و خزه. بوی گور می‌دهد.',
    tier: 'common', def: 0.05, tint: 0x5a6b4a, tint2: 0x46543c,
  }),
  hollow_tunic: I({
    id: 'hollow_tunic', name: 'تن‌پوش پوسیده', cat: 'armor', slot: 'chest', weight: 2.2,
    icon: '🥋', desc: 'جامه‌ای کهنه با سوراخ‌های پوسیدگی. عجیب است که هنوز یکپارچه است.',
    tier: 'common', def: 0.09, tint: 0x4a5940, tint2: 0x3a4634,
  }),
  hollow_wraps: I({
    id: 'hollow_wraps', name: 'نوارهای کهنه', cat: 'armor', slot: 'hands', weight: 0.9,
    icon: '🧤', desc: 'دست‌هایی پیچیده در نوار خاکستری. چالاکی می‌بخشد.',
    tier: 'common', def: 0.03, tint: 0x6b6a58, tint2: 0x575648,
  }),
  hollow_trousers: I({
    id: 'hollow_trousers', name: 'شلوار وصله‌دار', cat: 'armor', slot: 'legs', weight: 1.4,
    icon: '👖', desc: 'شلواری که وصله‌هایش خودش وصله دارند.',
    tier: 'common', def: 0.05, tint: 0x54503e, tint2: 0x453f30,
  }),

  /* ---- skeleton archer gear — bone-light ---- */
  bone_bow: I({
    id: 'bone_bow', name: 'کمان استخوانی', cat: 'bow', slot: 'lh', weight: 2.4,
    icon: '🏹', desc: 'کمانی از استخوان ران. صدای خش‌خش آن نشانه‌ی مرگ از دور است.',
    tier: 'rare', bowDmg: 26, tint: 0xd8d2c2,
  }),
  arrow_wood: I({
    id: 'arrow_wood', name: 'تیر چوبی', cat: 'bow', slot: 'lh', weight: 0.05,
    icon: '➳', desc: 'تیر ساده با پرکاک روشن. مهمات کمان — هنگام شلیک خودکار مصرف می‌شود.',
    tier: 'common', bowDmg: 0, ammo: true, tint: 0xc9b083,
  }),
  arrow_fire: I({
    id: 'arrow_fire', name: 'تیر آتشین', cat: 'bow', slot: 'lh', weight: 0.06,
    icon: '🔥', desc: 'نوکش آغشته به قیر سوزان. مهمات کمان — می‌سوزد، حتی بعد از برخورد.',
    tier: 'rare', bowDmg: 7, ammo: true, tint: 0xff8a3a,
  }),
  bone_helm: I({
    id: 'bone_helm', name: 'کاسه‌ی جمجمه', cat: 'armor', slot: 'head', weight: 1.0,
    icon: '💀', desc: 'نیم‌کاسه‌ای استخوانی. پوشیدنش چیزی از ترس کم نمی‌کند.',
    tier: 'common', def: 0.06, tint: 0xd8d2c2, tint2: 0xb8b2a2,
  }),
  bone_chest: I({
    id: 'bone_chest', name: 'قفسه‌ی سینه‌ی استخوانی', cat: 'armor', slot: 'chest', weight: 1.8,
    icon: '🦴', desc: 'دنده‌های به‌هم‌بافته. سبک مثل باد و سخت مثل استخوان.',
    tier: 'common', def: 0.08, tint: 0xcfc9b8, tint2: 0xb0aa9a,
  }),
  bone_gloves: I({
    id: 'bone_gloves', name: 'مفصل‌های استخوانی', cat: 'armor', slot: 'hands', weight: 0.8,
    icon: '🦴', desc: 'بند‌های مفصلی از انگشتان بی‌صاحب.',
    tier: 'common', def: 0.04, tint: 0xd8d2c2, tint2: 0xb8b2a2,
  }),
  bone_greaves: I({
    id: 'bone_greaves', name: 'ساق استخوانی', cat: 'armor', slot: 'legs', weight: 1.2,
    icon: '🦴', desc: 'ساق‌بندی که صدای کلیک استخوان می‌دهد با هر قدم.',
    tier: 'common', def: 0.05, tint: 0xcfc9b8, tint2: 0xb0aa9a,
  }),
  tattered_cape: I({
    id: 'tattered_cape', name: 'شنل کهنه', cat: 'armor', slot: 'cape', weight: 0.7,
    icon: '🧣', desc: 'شنلی که یک تیرانداز مرده پوشیده بود. لبه‌هایش در باد ذوب می‌شود.',
    tier: 'common', def: 0.02, tint: 0x6a5a48, tint2: 0x54463a,
  }),

  /* ---- wither skeleton gear — charcoal plate ---- */
  stone_cleaver: I({
    id: 'stone_cleaver', name: 'شمشیر سنگی', cat: 'sword', slot: 'rh', weight: 6.5,
    icon: '⛏️', desc: 'تیغه‌ای از گرانیت سیاه. سپرها را می‌جَوَد و دست‌ها را خسته می‌کند.',
    tier: 'rare', dmg: 46, spd: 0.9, style: 'stone', scale: 1.05,
  }),
  wither_helm: I({
    id: 'wither_helm', name: 'کلاه‌خود زغالی', cat: 'armor', slot: 'head', weight: 1.8,
    icon: '🎩', desc: 'ذغالی فشرده که هنوز گرمای گور را حفظ کرده.',
    tier: 'rare', def: 0.10, tint: 0x3a3a40, tint2: 0x26262c,
  }),
  wither_plate: I({
    id: 'wither_plate', name: 'سینه‌پوش ویسری', cat: 'armor', slot: 'chest', weight: 3.4,
    icon: '🥋', desc: 'صفحات تیره‌ی نگهبانان خاکستر. سنگین، اما مثل دیوار پشت توست.',
    tier: 'rare', def: 0.14, tint: 0x33333a, tint2: 0x222228,
  }),
  wither_gauntlets: I({
    id: 'wither_gauntlets', name: 'دستکش ویسری', cat: 'armor', slot: 'hands', weight: 1.4,
    icon: '🧤', desc: 'دستکش‌هایی سیاه که شمشیر سنگی را تاب داده‌اند.',
    tier: 'rare', def: 0.06, tint: 0x3a3a40, tint2: 0x26262c,
  }),
  wither_greaves: I({
    id: 'wither_greaves', name: 'ساق‌بند ویسری', cat: 'armor', slot: 'legs', weight: 2.2,
    icon: '👖', desc: 'پوشش ساق با تسمه‌های دودی. هر قدم جای پای خاکستر می‌گذارد.',
    tier: 'rare', def: 0.08, tint: 0x33333a, tint2: 0x222228,
  }),
  ashen_cape: I({
    id: 'ashen_cape', name: 'شنل خاکستری', cat: 'armor', slot: 'cape', weight: 1.0,
    icon: '🧣', desc: 'شنلی از خاکستر فشرده. حرارت شعله را از تن دور نگه می‌دارد.',
    tier: 'common', def: 0.04, fire: 0.06, tint: 0x4a4440, tint2: 0x38342f,
  }),

  /* ---- creeper ---- */
  creeper_hide: I({
    id: 'creeper_hide', name: 'پوست کریپر', cat: 'armor', slot: 'chest', weight: 2.0,
    icon: '🟩', desc: 'پوستی کهن‌دار و سبز. انفجار را مثل نیش می‌خورد.',
    tier: 'rare', def: 0.07, blast: 0.35, tint: 0x4f8f45, tint2: 0x3d7236,
  }),

  /* ---- blaze ---- */
  blaze_cape: I({
    id: 'blaze_cape', name: 'شنل اخگری', cat: 'armor', slot: 'cape', weight: 1.2,
    icon: '🧣', desc: 'پارچه‌ای که در کوره‌ی یک بلِیز جان گرفت. آتش دیگر تو را غریبه نمی‌داند.',
    tier: 'rare', def: 0.03, fire: 0.25, tint: 0xd97a2a, tint2: 0xb05a18,
  }),

  /* ---- BOSS 1: the Ancient Zombie Knight ---- */
  knight_helm: I({
    id: 'knight_helm', name: 'کلاه‌خود شوالیه‌ی کهن', cat: 'armor', slot: 'head', weight: 3.0,
    icon: '👑', desc: 'آهن پرچ‌کاری‌شده با کاکل زرشکی. نگاه سردش هنوز در فرو رفتگی‌هاست.',
    tier: 'boss', def: 0.13, tint: 0x7c828c, tint2: 0x565a64,
  }),
  knight_chest: I({
    id: 'knight_chest', name: 'سینه‌پوش فولادی', cat: 'armor', slot: 'chest', weight: 4.6,
    icon: '🥋', desc: 'فولاد صیقلی با خط مرکزی و لکه‌ی خونی که دیگر پاک نمی‌شود.',
    tier: 'boss', def: 0.19, tint: 0x7c828c, tint2: 0x565a64,
  }),
  iron_greatsword: I({
    id: 'iron_greatsword', name: 'شمشیر بزرگ آهنی', cat: 'sword', slot: 'rh', weight: 8.0,
    icon: '⚔️', desc: 'شمشیر عظیم شوالیه‌ی کهن. هر ضربه، قضاوت است.',
    tier: 'boss', dmg: 58, spd: 0.84, style: 'iron', scale: 1.28,
  }),

  /* ---- BOSS 2: the Flame King ---- */
  flame_crown: I({
    id: 'flame_crown', name: 'تاج پادشاه شعله', cat: 'armor', slot: 'head', weight: 2.6,
    icon: '👑', desc: 'پنج زبان شعله‌ی ابسیدینی که هرگز خاموش نمی‌شوند.',
    tier: 'boss', def: 0.11, fire: 0.20, tint: 0x241d20, tint2: 0x171114,
  }),
  flame_chest: I({
    id: 'flame_chest', name: 'سینه‌پوش ابسیدین', cat: 'armor', slot: 'chest', weight: 5.0,
    icon: '🥋', desc: 'صفحات سیاه با رگه‌های گداخته. تن تو کوره می‌شود.',
    tier: 'boss', def: 0.17, fire: 0.14, tint: 0x241d20, tint2: 0x171114,
  }),
  flame_cape: I({
    id: 'flame_cape', name: 'شنل شعله‌ور', cat: 'armor', slot: 'cape', weight: 1.6,
    icon: '🧣', desc: 'شنل سلطنتیِ آتش. ردپایت در خاکستر داغ می‌ماند.',
    tier: 'boss', def: 0.05, fire: 0.30, tint: 0xb03818, tint2: 0x8a2810,
  }),
  obsidian_greatsword: I({
    id: 'obsidian_greatsword', name: 'تیغ ابسیدین', cat: 'sword', slot: 'rh', weight: 8.5,
    icon: '⚔️', desc: 'تیغه‌ی سیاه با لبه‌ی گداخته. وزنش مثل یک دعوت به مرگ است.',
    tier: 'boss', dmg: 64, spd: 0.8, style: 'obsidian', scale: 1.32,
  }),
}

/* ---------------- slots & load math ---------------- */

export const ALL_SLOTS: EquipSlot[] = ['rh1', 'rh2', 'lh1', 'lh2', 'head', 'chest', 'hands', 'legs', 'cape']

export type EquippedMap = Partial<Record<EquipSlot, ItemId | null>>

export const SLOT_LABEL: Record<EquipSlot, string> = {
  rh1: 'دست راست ۱',
  rh2: 'دست راست ۲',
  lh1: 'دست چپ ۱',
  lh2: 'دست چپ ۲',
  head: 'سر',
  chest: 'سینه',
  hands: 'دست‌ها',
  legs: 'پاها',
  cape: 'شنل',
}

/** total weight of everything equipped (DS counts every slot, not just held) */
export function equipLoad(eq: EquippedMap): number {
  let w = 0
  for (const s of ALL_SLOTS) {
    const id = eq[s]
    if (id && ITEMS[id]) w += ITEMS[id].weight
  }
  return w
}

/** max equip load grows with the character level (Vitality-equivalent) */
export function maxLoadFor(level: number): number {
  return 32 + level * 3
}

export type RollTier = 'fast' | 'medium' | 'heavy' | 'over'

/** DS1 equip-burden tiers */
export function rollTier(load: number, max: number): RollTier {
  const r = load / max
  if (r > 1) return 'over'
  if (r >= 0.5) return 'heavy'
  if (r >= 0.25) return 'medium'
  return 'fast'
}

export const TIER_INFO: Record<RollTier, { label: string; color: string; walk: number; sprint: number; roll: number; rollCost: number }> = {
  fast: { label: 'چابک — غلتک سریع', color: '#59d959', walk: 1, sprint: 1, roll: 1, rollCost: 1 },
  medium: { label: 'متوسط — غلتک معمولی', color: '#ffd54a', walk: 0.95, sprint: 0.92, roll: 0.87, rollCost: 1.1 },
  heavy: { label: 'سنگین — غلتک کند', color: '#ff8a3a', walk: 0.82, sprint: 0.74, roll: 0.7, rollCost: 1.3 },
  over: { label: 'بیش‌ازحد! غلتک نداری', color: '#ff5a4a', walk: 0.55, sprint: 0, roll: 0, rollCost: 1 },
}

/** summed armor protections across the five armor slots */
export function armorTotals(eq: EquippedMap): { def: number; fire: number; blast: number } {
  let def = 0, fire = 0, blast = 0
  for (const s of ['head', 'chest', 'hands', 'legs', 'cape'] as ArmorSlot[]) {
    const id = eq[s]
    const it = id ? ITEMS[id] : null
    if (it) {
      def += it.def ?? 0
      fire += it.fire ?? 0
      blast += it.blast ?? 0
    }
  }
  return { def: Math.min(0.6, def), fire: Math.min(0.7, fire), blast: Math.min(0.7, blast) }
}

/* ---------------- loot tables ---------------- */

export interface LootRoll { id: ItemId; n: number }

type Table = Array<{ id: ItemId; p: number; n?: [number, number] }>

const TABLES: Record<string, Table> = {
  zombie: [
    { id: 'rust_sword', p: 0.09 },
    { id: 'iron_shield', p: 0.04 },
    { id: 'hollow_hood', p: 0.028 },
    { id: 'hollow_tunic', p: 0.028 },
    { id: 'hollow_wraps', p: 0.028 },
    { id: 'hollow_trousers', p: 0.028 },
  ],
  skeleton: [
    { id: 'bone_bow', p: 0.16 },
    { id: 'arrow_wood', p: 0.42, n: [5, 9] },
    { id: 'arrow_fire', p: 0.07, n: [3, 4] },
    { id: 'bone_helm', p: 0.023 },
    { id: 'bone_chest', p: 0.023 },
    { id: 'bone_gloves', p: 0.023 },
    { id: 'bone_greaves', p: 0.023 },
    { id: 'tattered_cape', p: 0.07 },
  ],
  wither: [
    { id: 'stone_cleaver', p: 0.11 },
    { id: 'wither_helm', p: 0.028 },
    { id: 'wither_plate', p: 0.028 },
    { id: 'wither_gauntlets', p: 0.028 },
    { id: 'wither_greaves', p: 0.028 },
    { id: 'ashen_cape', p: 0.07 },
  ],
  creeper: [{ id: 'creeper_hide', p: 0.22 }],
  blaze: [{ id: 'blaze_cape', p: 0.17 }],
}

/** roll a mob's loot — independent chances, stacked ammo counts */
export function rollLoot(kind: string, rnd: () => number = Math.random): LootRoll[] {
  const table = TABLES[kind]
  if (!table) return []
  const out: LootRoll[] = []
  for (const row of table) {
    if (rnd() < row.p) {
      const n = row.n ? row.n[0] + Math.floor(rnd() * (row.n[1] - row.n[0] + 1)) : 1
      out.push({ id: row.id, n })
    }
  }
  return out
}

/** the lords drop their signature blade + one special armor piece */
export function bossLoot(boss: 1 | 2, rnd: () => number = Math.random): LootRoll[] {
  if (boss === 1) {
    const armor = rnd() < 0.5 ? 'knight_helm' : 'knight_chest'
    return [{ id: 'iron_greatsword', n: 1 }, { id: armor, n: 1 }]
  }
  const armor = ['flame_crown', 'flame_chest', 'flame_cape'][Math.floor(rnd() * 3)]
  return [{ id: 'obsidian_greatsword', n: 1 }, { id: armor, n: 1 }]
}

/** the default loadout of every new unkindled */
export function defaultEquip(): EquippedMap {
  return { rh1: 'worn_sword', lh1: 'wooden_shield' }
}

/** does an item belong in the right hand or left hand? */
export function slotGroupOf(it: ItemDef): 'rh' | 'lh' | ArmorSlot {
  return it.slot
}

/** the quiver order — fire arrows are loosed first while present */
export const QUIVER_ORDER: ItemId[] = ['arrow_fire', 'arrow_wood']
