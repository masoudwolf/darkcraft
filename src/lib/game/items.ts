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
export type EquipSlot = 'rh1' | 'rh2' | 'lh1' | 'lh2' | ArmorSlot | 'charm1' | 'charm2'
export type ItemCategory = 'sword' | 'shield' | 'bow' | 'armor' | 'material' | 'charm'
export type DmgType = 'phys' | 'fire' | 'blast'

/** what a ring or amulet quietly does while it is worn */
export interface PassiveDef {
  /** flat max-HP bonus */
  hp?: number
  /** stamina regeneration multiplier (1.25 = a quarter faster) */
  stamRegen?: number
  /** outgoing damage multiplier */
  dmgMul?: number
  /** souls earned multiplier */
  soulsMul?: number
  /** walk & sprint speed multiplier */
  walkMul?: number
  /** extra soak applied to every damage type (0.08 = 8% off the top) */
  soak?: number
}

export interface ItemDef {
  id: ItemId
  name: string
  cat: ItemCategory
  /** the canonical slot this equips into (rh → rh1/rh2, lh → lh1/lh2, charm → charm1/charm2) */
  slot: 'rh' | 'lh' | 'charm' | ArmorSlot
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
  /* charm — the passive it whispers while worn */
  passive?: PassiveDef
  /* keys — open one door, weigh nothing, sell for almost nothing */
  key?: boolean
}

/* ---------------- the catalogue ---------------- */

const I = (d: ItemDef) => d

export const ITEMS: Record<ItemId, ItemDef> = {
  /* ---- starter gear ---- */
  worn_sword: I({
    id: 'worn_sword', name: 'شمشیر پوسیده', cat: 'sword', slot: 'rh', weight: 3.0,
    icon: '🗡️', desc: 'شمشیری از فولاد آتش‌گاه؛ سازنده‌اش نامش را روی دسته کند. هر دو نام — سازنده و برنده — فراموش شده‌اند، اما تیغه هنوز وفادار است.',
    tier: 'common', dmg: 30, spd: 1, style: 'iron', scale: 1,
  }),
  wooden_shield: I({
    id: 'wooden_shield', name: 'سپر چوبی', cat: 'shield', slot: 'lh', weight: 2.5,
    icon: '🛡️', desc: 'تخته‌ای از بلوط درّه با رینگ آهنی. حرفی روی آن کنده‌شده که نصفش ساییده شده؛ بقیه‌اش را می‌توانی حدس بزنی — مثل همه‌ی این جهان.',
    tier: 'common', block: 0.85, tint: 0x8a6437,
  }),

  /* ---- hollow (zombie) gear — ragged but real ---- */
  rust_sword: I({
    id: 'rust_sword', name: 'شمشیر زنگ‌زده', cat: 'sword', slot: 'rh', weight: 3.6,
    icon: '⚔️', desc: 'تیغه‌ی دندانه‌دار خالی‌ها. زنگ، خاطره‌ی فولاد است؛ همان‌طور که آرام‌آرام این تیغه را می‌خورد، فراموشی هم صاحبش را خورد.',
    tier: 'common', dmg: 34, spd: 0.97, style: 'rust', scale: 1,
  }),
  iron_shield: I({
    id: 'iron_shield', name: 'سپر آهنی', cat: 'shield', slot: 'lh', weight: 4.2,
    icon: '🛡️', desc: 'پرده‌ی فولادی نگهبانان آتش‌گاه. بر لبه‌اش نوشته‌اند: «ایستادن، تنها سوگندی است که فراموش نمی‌شود.»',
    tier: 'rare', block: 0.93, tint: 0x9aa0a8,
  }),
  hollow_hood: I({
    id: 'hollow_hood', name: 'کلاه‌پوسیده', cat: 'armor', slot: 'head', weight: 1.2,
    icon: '🎩', desc: 'کلاهی از چرم خیس و خزه. صاحبش تا آخرین نفس می‌خواست شکلِ چهره‌اش را به یاد آورد؛ خزه یادگارِ آن تلاش است.',
    tier: 'common', def: 0.05, tint: 0x5a6b4a, tint2: 0x46543c,
  }),
  hollow_tunic: I({
    id: 'hollow_tunic', name: 'تن‌پوش پوسیده', cat: 'armor', slot: 'chest', weight: 2.2,
    icon: '🥋', desc: 'جامه‌ی یک بنا که خانه‌هایش هنوز سرپا هستند. سوراخ‌هایش با نخ‌هایی وصله شده که خودشان از پوسیدگی بافته شده‌اند.',
    tier: 'common', def: 0.09, tint: 0x4a5940, tint2: 0x3a4634,
  }),
  hollow_wraps: I({
    id: 'hollow_wraps', name: 'نوارهای کهنه', cat: 'armor', slot: 'hands', weight: 0.9,
    icon: '🧤', desc: 'نوارهای دستِ یک سازنده‌ی خالی. دست‌ها هنوز حرکتِ چیدنِ بلوک را می‌دانند؛ ساختن را دیگر نه.',
    tier: 'common', def: 0.03, tint: 0x6b6a58, tint2: 0x575648,
  }),
  hollow_trousers: I({
    id: 'hollow_trousers', name: 'شلوار وصله‌دار', cat: 'armor', slot: 'legs', weight: 1.4,
    icon: '👖', desc: 'شلواری با وصله‌های بی‌شمار. هر وصله یک روز از عمرِ فراموش‌شده‌ی صاحبش است؛ هیچ‌کس نمی‌داند زیر همه‌ی آن‌ها چه چیزی مانده.',
    tier: 'common', def: 0.05, tint: 0x54503e, tint2: 0x453f30,
  }),

  /* ---- skeleton archer gear — bone-light ---- */
  bone_bow: I({
    id: 'bone_bow', name: 'کمان استخوانی', cat: 'bow', slot: 'lh', weight: 2.4,
    icon: '🏹', desc: 'کمانی از استخوان رانِ نگهبان؛ رگه‌هایش هنوز حالتِ ایستادن پشتِ دروازه را دارد. عهد، از گوشت جاودانه‌تر بود.',
    tier: 'rare', bowDmg: 26, tint: 0xd8d2c2,
  }),
  arrow_wood: I({
    id: 'arrow_wood', name: 'تیر چوبی', cat: 'bow', slot: 'lh', weight: 0.05,
    icon: '➳', desc: 'تیرهای ساده‌ی نگهبانان؛ پرکاک از پرهای کلاغ‌های درّه. کلاغ‌ها هنوز می‌آیند — آن‌ها فقط شکل عوض کرده‌اند.',
    tier: 'common', bowDmg: 0, ammo: true, tint: 0xc9b083,
  }),
  arrow_fire: I({
    id: 'arrow_fire', name: 'تیر آتشین', cat: 'bow', slot: 'lh', weight: 0.06,
    icon: '🔥', desc: 'نوکِ آغشته به قیرِ زغالِ نخستین. جایی که می‌افتد، خبرِ آتش‌گاه را می‌رساند؛ حتی بعد از مرگش، هنوز می‌سوزد.',
    tier: 'rare', bowDmg: 7, ammo: true, tint: 0xff8a3a,
  }),
  bone_helm: I({
    id: 'bone_helm', name: 'کاسه‌ی جمجمه', cat: 'armor', slot: 'head', weight: 1.0,
    icon: '💀', desc: 'نیم‌کاسه‌ای استخوانی از نگهبانان قدیم. پوشیدنش هیچ ترسی را کم نمی‌کند — فقط آن را استخوانی می‌کند.',
    tier: 'common', def: 0.06, tint: 0xd8d2c2, tint2: 0xb8b2a2,
  }),
  bone_chest: I({
    id: 'bone_chest', name: 'قفسه‌ی سینه‌ی استخوانی', cat: 'armor', slot: 'chest', weight: 1.8,
    icon: '🦴', desc: 'دنده‌های به‌هم‌بافته‌ی نگهبانان. استخوان، آخرین چیزی است که از یک عهد باقی می‌ماند.',
    tier: 'common', def: 0.08, tint: 0xcfc9b8, tint2: 0xb0aa9a,
  }),
  bone_gloves: I({
    id: 'bone_gloves', name: 'مفصل‌های استخوانی', cat: 'armor', slot: 'hands', weight: 0.8,
    icon: '🦴', desc: 'بندهای مفصلی از انگشتان بی‌صاحب؛ هنوز به شکلِ گرفتنِ کمان خم شده‌اند.',
    tier: 'common', def: 0.04, tint: 0xd8d2c2, tint2: 0xb8b2a2,
  }),
  bone_greaves: I({
    id: 'bone_greaves', name: 'ساق استخوانی', cat: 'armor', slot: 'legs', weight: 1.2,
    icon: '🦴', desc: 'ساق‌بندی از استخوان پا. با هر قدم کلیک می‌کند؛ مثل شمارشِ گام‌های نگهبانی که تمام نمی‌شود.',
    tier: 'common', def: 0.05, tint: 0xcfc9b8, tint2: 0xb0aa9a,
  }),
  tattered_cape: I({
    id: 'tattered_cape', name: 'شنل کهنه', cat: 'armor', slot: 'cape', weight: 0.7,
    icon: '🧣', desc: 'شنلِ تیراندازی که نشست و دیگر برنخاست. شنل هنوز در باد موج می‌زند؛ کسی به آن نگفته که صاحبش تمام است.',
    tier: 'common', def: 0.02, tint: 0x6a5a48, tint2: 0x54463a,
  }),

  /* ---- wither skeleton gear — charcoal plate ---- */
  stone_cleaver: I({
    id: 'stone_cleaver', name: 'شمشیر سنگی', cat: 'sword', slot: 'rh', weight: 6.5,
    icon: '⛏️', desc: 'تیغه‌ای از گرانیتِ کوره‌گاه؛ سنگی که سازندگان با آن جهان را می‌بریدند. حالا یک خالی آن را می‌کشد و نمی‌پرسد چرا.',
    tier: 'rare', dmg: 46, spd: 0.9, style: 'stone', scale: 1.05,
  }),
  wither_helm: I({
    id: 'wither_helm', name: 'کلاه‌خود زغالی', cat: 'armor', slot: 'head', weight: 1.8,
    icon: '🎩', desc: 'ذغالِ فشرده از عمق کوره‌گاه. گرمایش از گورستان‌های خاکستر می‌آید؛ آن‌جا که خاطره‌ها را می‌سوزاندند.',
    tier: 'rare', def: 0.10, tint: 0x3a3a40, tint2: 0x26262c,
  }),
  wither_plate: I({
    id: 'wither_plate', name: 'سینه‌پوش ویسری', cat: 'armor', slot: 'chest', weight: 3.4,
    icon: '🥋', desc: 'صفحاتِ تیره‌ی نگهبانانِ خاکستر؛ هر صفحه با علامتِ کوره‌ای نشان‌گذاری شده که دیگر روشن نیست. مثل دیوار پشت توست — دیواری که صاحبش را ندیده.',
    tier: 'rare', def: 0.14, tint: 0x33333a, tint2: 0x222228,
  }),
  wither_gauntlets: I({
    id: 'wither_gauntlets', name: 'دستکش ویسری', cat: 'armor', slot: 'hands', weight: 1.4,
    icon: '🧤', desc: 'دستکش‌های دودی کوره‌بانان. دستِ درونشان دیگر فقط وزنِ تیغه را می‌شناسد؛ همین‌قدر کافی است.',
    tier: 'rare', def: 0.06, tint: 0x3a3a40, tint2: 0x26262c,
  }),
  wither_greaves: I({
    id: 'wither_greaves', name: 'ساق‌بند ویسری', cat: 'armor', slot: 'legs', weight: 2.2,
    icon: '👖', desc: 'ساق‌بندهایی که در خاکستر راه رفته‌اند؛ هر قدم ردی سیاه بر زمین سوخته می‌گذارد. خاکستر، خاطره‌ی آتش است.',
    tier: 'rare', def: 0.08, tint: 0x33333a, tint2: 0x222228,
  }),
  ashen_cape: I({
    id: 'ashen_cape', name: 'شنل خاکستری', cat: 'armor', slot: 'cape', weight: 1.0,
    icon: '🧣', desc: 'شنلی از خاکستر فشرده. کوره‌بانان باور داشتند خاکستر، خاطره‌ی آتش است — به تن‌پوشیدنِ آن، یادِ شعله را می‌پوشی.',
    tier: 'common', def: 0.04, fire: 0.06, tint: 0x4a4440, tint2: 0x38342f,
  }),

  /* ---- creeper ---- */
  creeper_hide: I({
    id: 'creeper_hide', name: 'پوست کریپر', cat: 'armor', slot: 'chest', weight: 2.0,
    icon: '🟩', desc: 'پوست کهن‌دارِ یک نهالِ شکست‌خورده. سازندگان جاندارانی از اخگر زادند که به جای بیدار شدن، ترکیدند؛ این پوست، ترکیدن را مثل نیش می‌خورد.',
    tier: 'rare', def: 0.07, blast: 0.35, tint: 0x4f8f45, tint2: 0x3d7236,
  }),

  /* ---- blaze ---- */
  blaze_cape: I({
    id: 'blaze_cape', name: 'شنل اخگری', cat: 'armor', slot: 'cape', weight: 1.2,
    icon: '🧣', desc: 'پارچه‌ای که در کوره‌ی یک بلِیز جان گرفت. کوره‌بانان می‌گفتند شعله، روحِ ناتمامِ کوره است؛ حالا روحِ کوره، شانه‌های توست.',
    tier: 'rare', def: 0.03, fire: 0.25, tint: 0xd97a2a, tint2: 0xb05a18,
  }),

  /* ---- BOSS 1: the Ancient Zombie Knight ---- */
  knight_helm: I({
    id: 'knight_helm', name: 'کلاه‌خود شوالیه‌ی کهن', cat: 'armor', slot: 'head', weight: 3.0,
    icon: '👑', desc: 'آهنِ پرچ‌کاری‌شده با کاکل زرشکی؛ زیر آن چشمی بود که حتی در خواب نمی‌لنبد. حالا فقط فرورفتگیِ چشم‌هاست — و هنوز نگاه می‌کند.',
    tier: 'boss', def: 0.13, tint: 0x7c828c, tint2: 0x565a64,
  }),
  knight_chest: I({
    id: 'knight_chest', name: 'سینه‌پوش فولادی', cat: 'armor', slot: 'chest', weight: 4.6,
    icon: '🥋', desc: 'فولاد صیقلیِ سرِ سپاهِ آتش‌گاه. لکه‌ی سینه‌اش خونِ خودش است — از شبی که برای اولین بار پشت به دشمن کرد و سوگند خورد دیگر تکرار نشود.',
    tier: 'boss', def: 0.19, tint: 0x7c828c, tint2: 0x565a64,
  }),
  iron_greatsword: I({
    id: 'iron_greatsword', name: 'شمشیر بزرگ آهنی', cat: 'sword', slot: 'rh', weight: 8.0,
    icon: '⚔️', desc: 'شمشیری عظیم که با دو دست از آتش کشیده شد؛ روی فولادش نام «سپردار» کندند. هر ضربه‌اش قضاوت است — برای هر دو طرف.',
    tier: 'boss', dmg: 58, spd: 0.84, style: 'iron', scale: 1.28,
  }),

  /* ---- BOSS 2: the Flame King ---- */
  flame_crown: I({
    id: 'flame_crown', name: 'تاج پادشاه شعله', cat: 'armor', slot: 'head', weight: 2.6,
    icon: '👑', desc: 'پنج زبان شعله‌ی ابسیدینی که هرگز خاموش نمی‌شوند. پادشاه تاجش را در گودالِ گداخته فراموش کرد؛ شعله‌ها یادشان نرفت.',
    tier: 'boss', def: 0.11, fire: 0.20, tint: 0x241d20, tint2: 0x171114,
  }),
  flame_chest: I({
    id: 'flame_chest', name: 'سینه‌پوش ابسیدین', cat: 'armor', slot: 'chest', weight: 5.0,
    icon: '🥋', desc: 'صفحاتی از شیشه‌ی آتشفشانیِ کفِ گودال؛ زیرشان قلبی می‌تپد که خودش را به زغالِ نخستین بخشید. تن تو کوره می‌شود.',
    tier: 'boss', def: 0.17, fire: 0.14, tint: 0x241d20, tint2: 0x171114,
  }),
  flame_cape: I({
    id: 'flame_cape', name: 'شنل شعله‌ور', cat: 'armor', slot: 'cape', weight: 1.6,
    icon: '🧣', desc: 'شنلِ سلطنتی‌ای که در لحظه‌ی جهش به گودال، از تنِ پادشاه جدا شد. هنوز گرم است؛ هنوز منتظرِ برگشتنش است.',
    tier: 'boss', def: 0.05, fire: 0.30, tint: 0xb03818, tint2: 0x8a2810,
  }),
  obsidian_greatsword: I({
    id: 'obsidian_greatsword', name: 'تیغ ابسیدین', cat: 'sword', slot: 'rh', weight: 8.5,
    icon: '⚔️', desc: 'تیغه‌ای از ابسیدینِ کفِ گودال؛ آخرین کسی که آن را بلند کرد دیگر انسان نبود. وزنش مثل یک دعوت به مرگ است — دعوتی که ردّش آخرین وظیفه‌ی یک اخگر است.',
    tier: 'boss', dmg: 64, spd: 0.8, style: 'obsidian', scale: 1.32,
  }),

  /* ---- smithing materials — the forge remembers what the world forgot ---- */
  iron_chunk: I({
    id: 'iron_chunk', name: 'تکه‌سنگ آهن', cat: 'material', slot: 'rh', weight: 1.6,
    icon: '⛓️', desc: 'رگه‌ای خام از آهنِ درّه. سازندگان با چنین سنگ‌هایی، جهان را بلوک به بلوک بالا کشیدند. کوره‌بان می‌تواند آن را در دلِ کوره آب کند و به تیغه‌ی تو بیامیزد.',
    tier: 'common',
  }),
  ember_iron: I({
    id: 'ember_iron', name: 'اخگرآهن', cat: 'material', slot: 'rh', weight: 1.9,
    icon: '🔥', desc: 'آهنی که در خاکسترگاه پخته شد و هنوز از درون گرم است. فقط لردها و قهرمان‌ها آن را حمل می‌کنند؛ فلزی که خاطره‌ی آتش را نگه داشته، تنها با آتشِ بیشتر رام می‌شود.',
    tier: 'rare',
  }),

  /* ---- champion relics — guarded by the mini-lords of the Vale ---- */
  captain_blade: I({
    id: 'captain_blade', name: 'تیغِ سردار', cat: 'sword', slot: 'rh', weight: 5.2,
    icon: '🗡️', desc: 'تیغِ نشانه‌دارِ سردارِ نگهبانان. روی غلافش هنوز شمارشِ شب‌ها کنده شده — شبی که نگهبانان بدونِ گزارش برگشتند، شمارش متوقف شد. تیغ هنوز منتظرِ گزارشِ آخر است.',
    tier: 'boss', dmg: 48, spd: 0.94, style: 'iron', scale: 1.1,
  }),
  warden_shield: I({
    id: 'warden_shield', name: 'سپرِ نگهبانِ گور', cat: 'shield', slot: 'lh', weight: 4.0,
    icon: '🛡️', desc: 'سپری از آلیاژِ شمع و قیر که روی قبرِ بی‌نامِ نخستین آویخته بودند. شعله‌ی ریزِ لبه‌اش هرگز تمام نمی‌شود؛ می‌گویند هر کس که سپر را بلند کند، یک عمرِ نگهبانی به عهده می‌گیرد.',
    tier: 'boss', block: 0.93, tint: 0xb9a86a,
  }),

  /* ---- THE FIRST COAL — the last lord of the Vale ---- */
  coalblade: I({
    id: 'coalblade', name: 'تیغِ ذغالِ نخستین', cat: 'sword', slot: 'rh', weight: 9.0,
    icon: '⚔️', desc: 'تیغه‌ای که سازنده‌ی خالی، از خودِ زغالِ نخستین تراشید. رگه‌ی اخگر در دلِ ابسیدینش می‌تپد — همان آتشی که جهان را آفرید، حالا در دستِ توست. ساختن یا سوزاندن؛ انتخاب با تو.',
    tier: 'boss', dmg: 72, spd: 0.82, style: 'coalblade', scale: 1.3,
  }),
  coal_crown: I({
    id: 'coal_crown', name: 'تاجِ سازنده‌ی خالی', cat: 'armor', slot: 'head', weight: 2.8,
    icon: '👑', desc: 'تاجی از پایه‌های شکسته‌ی ستون‌ها؛ یادگارِ روزی که صاحبش، معبدِ نخستین را بلند می‌کرد. ترک‌هایش هنوز نفس می‌کشند — گرم و سرخ، مثل خاطره‌ای که نمی‌خواهد برود.',
    tier: 'boss', def: 0.12, fire: 0.22, tint: 0x241e22, tint2: 0x171215,
  }),
  coal_plate: I({
    id: 'coal_plate', name: 'سینه‌پوشِ بسترِ ذغال', cat: 'armor', slot: 'chest', weight: 5.4,
    icon: '🥋', desc: 'صفحاتی از سنگِ گداخته‌ی کفِ گودال؛ قلبِ کوره‌ای که هزار سال تنها سوخت. آن را که بپوشی، صدای چکشِ سازندگان را در نبضِ خودت می‌شنوی.',
    tier: 'boss', def: 0.18, fire: 0.18, tint: 0x241e22, tint2: 0x171215,
  }),

  /* ---- charms — rings & amulets, the quiet passives (2 slots) ---- */
  ring_ember_knight: I({
    id: 'ring_ember_knight', name: 'انگشترِ شوالیهٔ اخگر', cat: 'charm', slot: 'charm', weight: 0.4,
    icon: '💍', desc: ' حلقه‌ای از آهنِ سپرِ شوالیهٔ کهن، با نگینی که از قلبِ آتشگاه تراشیده‌اند. دستی که این را ببندد، سوگندِ ایستادن را به یاد می‌آورد — و ضربه‌اش سنگین‌تر می‌شود.',
    tier: 'rare', passive: { dmgMul: 1.12 },
  }),
  ring_ashwalker: I({
    id: 'ring_ashwalker', name: 'انگشترِ خاکسترراه', cat: 'charm', slot: 'charm', weight: 0.3,
    icon: '💍', desc: 'انگشتری که کوره‌بانانِ خاکسترگاه با آن پیمان بستند: «پا، پیش از آتش برسد.» پوشنده‌اش روی خاکستر مثل روی چمن راه می‌رود.',
    tier: 'rare', passive: { walkMul: 1.15 },
  }),
  ring_cling: I({
    id: 'ring_cling', name: 'انگشترِ چسبیده', cat: 'charm', slot: 'charm', weight: 0.3,
    icon: '💍', desc: 'حلقه‌ای قدیمی در حلقهٔ سنگیِ چمن پیدا شد — جایی که کسی خیلی پیش‌تر نشسته بود و برنخاست. انگشتر به انگشت چسبیده بود؛ نفَسِ صاحبش هنوز در حلقه‌اش جاری است و بنده را تازه نگه می‌دارد.',
    tier: 'rare', passive: { stamRegen: 1.25 },
  }),
  ring_first_maker: I({
    id: 'ring_first_maker', name: 'انگشترِ نخستینِ سازندگان', cat: 'charm', slot: 'charm', weight: 0.5,
    icon: '💍', desc: 'سنگ‌نگینِ آتشین از انگشتری که نخستینِ سازندگان به دست کرد، وقتی نخستین بلوک را بر نخستین خاک گذاشت. در دهلیزِ پنهانِ بسترِ ذغال جا مانده بود — انگشتری که جهان با آن اندازه گرفته شد، هم می‌سازد و هم نگه می‌دارد.',
    tier: 'boss', passive: { dmgMul: 1.15, soak: 0.08 },
  }),
  amulet_souls: I({
    id: 'amulet_souls', name: 'طلسمِ روح‌خواه', cat: 'charm', slot: 'charm', weight: 0.4,
    icon: '📿', desc: 'گردن‌آویزی از استخوانِ ماهی و سیمِ قبر که روح‌های گریخته را در مسیرش نگه می‌داشت. صاحبش می‌گفت روح، ثروتِ جهانِ مرده است — حالا ثروتش از گردنِ تو می‌گذرد.',
    tier: 'rare', passive: { soulsMul: 1.3 },
  }),
  amulet_vigil: I({
    id: 'amulet_vigil', name: 'طلسمِ بیداری', cat: 'charm', slot: 'charm', weight: 0.5,
    icon: '📿', desc: 'تسمه‌ای چرمی با قطعه‌ای از شیشهٔ پنجرهٔ کلیسا؛ شیشه‌ای که هزار سال ماه را رد کرده است. آن را که بر گردن آویزد، خوابِ عمیق از او می‌گریزد — و قلبش، یکی دو نفسِ دیگر برای ایستادن پیدا می‌کند.',
    tier: 'rare', passive: { hp: 25 },
  }),
  amulet_iron_skin: I({
    id: 'amulet_iron_skin', name: 'طلسمِ پوستِ آهنین', cat: 'charm', slot: 'charm', weight: 0.6,
    icon: '📿', desc: 'صفحه‌ای کوچک از آهنِ سردابِ دژ، با حکاکیِ زرهی که صاحب ندارد. کوره‌بان می‌گوید فلزِ بی‌صاحب، صاحبِ تازه را آزمایش می‌کند: اگر تیغِ دشمن را نگه دارد، تورا هم نگه می‌دارد.',
    tier: 'rare', passive: { soak: 0.14 },
  }),

  /* ---- keys — small iron promises ---- */
  key_crypt: I({
    id: 'key_crypt', name: 'کلیدِ سردابه', cat: 'material', slot: 'rh', weight: 0.2,
    icon: '🗝️', desc: 'کلیدی آهنی با ریشِ خزه. نگهبانِ گورستان آن را با خود دفن کردند تا سردابه برای همیشه بماند بسته — اما مرگِ نگهبان، سوگندش را آزاد کرد.',
    tier: 'rare', key: true,
  }),
  key_tower: I({
    id: 'key_tower', name: 'کلیدِ برج', cat: 'material', slot: 'rh', weight: 0.2,
    icon: '🗝️', desc: 'کلیدِ برنجیِ برجِ دیدبانِ چمن. زاهدِ خاکسترگاه آن را از راهرویی برد که دیگر وجود ندارد؛ می‌گوید برجی که نگهبان ندارد، فقط قفسِ زنگ است.',
    tier: 'rare', key: true,
  }),
}

/* ---------------- slots & load math ---------------- */

export const ALL_SLOTS: EquipSlot[] = ['rh1', 'rh2', 'lh1', 'lh2', 'head', 'chest', 'hands', 'legs', 'cape', 'charm1', 'charm2']

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
  charm1: 'انگشتر/طلسم ۱',
  charm2: 'انگشتر/طلسم ۲',
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

/** the quiet sum of both worn charms — rings and amulets never shout */
export function charmTotals(eq: EquippedMap): { hp: number; stamRegen: number; dmgMul: number; soulsMul: number; walkMul: number; soak: number; count: number } {
  const t = { hp: 0, stamRegen: 1, dmgMul: 1, soulsMul: 1, walkMul: 1, soak: 0, count: 0 }
  for (const s of ['charm1', 'charm2'] as const) {
    const id = eq[s]
    const p = id ? ITEMS[id]?.passive : null
    if (!p) continue
    t.count++
    t.hp += p.hp ?? 0
    t.stamRegen *= p.stamRegen ?? 1
    t.dmgMul *= p.dmgMul ?? 1
    t.soulsMul *= p.soulsMul ?? 1
    t.walkMul *= p.walkMul ?? 1
    t.soak += p.soak ?? 0
  }
  return t
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
    { id: 'iron_chunk', p: 0.17, n: [1, 2] },
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
    { id: 'iron_chunk', p: 0.15 },
  ],
  wither: [
    { id: 'stone_cleaver', p: 0.11 },
    { id: 'wither_helm', p: 0.028 },
    { id: 'wither_plate', p: 0.028 },
    { id: 'wither_gauntlets', p: 0.028 },
    { id: 'wither_greaves', p: 0.028 },
    { id: 'ashen_cape', p: 0.07 },
    { id: 'iron_chunk', p: 0.2, n: [1, 2] },
  ],
  creeper: [{ id: 'creeper_hide', p: 0.22 }, { id: 'iron_chunk', p: 0.16 }],
  blaze: [{ id: 'blaze_cape', p: 0.17 }, { id: 'ember_iron', p: 0.24 }],
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
export function bossLoot(boss: 1 | 2 | 3, rnd: () => number = Math.random): LootRoll[] {
  if (boss === 1) {
    const armor = rnd() < 0.5 ? 'knight_helm' : 'knight_chest'
    return [{ id: 'iron_greatsword', n: 1 }, { id: armor, n: 1 }, { id: 'ember_iron', n: 1 }]
  }
  if (boss === 2) {
    const armor = ['flame_crown', 'flame_chest', 'flame_cape'][Math.floor(rnd() * 3)]
    return [{ id: 'obsidian_greatsword', n: 1 }, { id: armor, n: 1 }, { id: 'ember_iron', n: 2 }]
  }
  const armor = rnd() < 0.5 ? 'coal_crown' : 'coal_plate'
  return [{ id: 'coalblade', n: 1 }, { id: armor, n: 1 }, { id: 'ember_iron', n: 3 }]
}

/* ---------------- the forge — weapon upgrades ---------------- */

export const MAX_UPGRADE = 5

/** damage multiplier of a blade forged to `lv` (+14% per ember-grade) */
export function upgradeMult(lv: number): number {
  return 1 + Math.max(0, Math.min(MAX_UPGRADE, lv)) * 0.14
}

export interface UpgradeCost {
  souls: number
  iron: number
  ember: number
}

/** price of taking a blade from (lv) to (lv+1) — null at +5 */
export function upgradeCost(lv: number): UpgradeCost | null {
  switch (lv) {
    case 0: return { souls: 350, iron: 2, ember: 0 }
    case 1: return { souls: 700, iron: 3, ember: 0 }
    case 2: return { souls: 1200, iron: 4, ember: 1 }
    case 3: return { souls: 2000, iron: 5, ember: 2 }
    case 4: return { souls: 3200, iron: 6, ember: 3 }
    default: return null
  }
}

/** the blacksmith's lines — he forges to remember the heat of creation */
export const SMITH_LINES: string[] = [
  'فلز دروغ نمی‌گوید؛ یا می‌بندد یا نمی‌بندد. کاش یادگیری هم این‌قدر رک بود.',
  'من هم شاگردِ سازندگان بودم. دستم هنوز چکش را بلد است؛ نامِ چیزی که می‌ساختم را دیگر نه.',
  'این تیغه را که می‌آوری، خاطره‌هایش را هم آورده‌ای. هر گرما، یکی‌اش را آزاد می‌کند.',
  'اخگرآهن را از سردارها بگیر. فلزی که آتش را به یاد دارد، فقط زیر چکشِ من آرام می‌شود.',
  'تیغه‌ی داغ می‌درخشد، اما تو داغش نکن — رو و آرام. مثل سوگند.',
]

/** the default loadout of every new unkindled */
export function defaultEquip(): EquippedMap {
  return { rh1: 'worn_sword', lh1: 'wooden_shield' }
}

/** does an item belong in the right hand, the left hand, or elsewhere? */
export function slotGroupOf(it: ItemDef): 'rh' | 'lh' | 'charm' | ArmorSlot {
  return it.slot
}

/** the quiver order — fire arrows are loosed first while present */
export const QUIVER_ORDER: ItemId[] = ['arrow_fire', 'arrow_wood']

/* ---------------- selling to the grey merchant ---------------- */

/** what the merchant pays for ONE unit — a lowball fraction of real worth
    (DS rule: merchants never pay what a thing is truly worth) */
export function sellValueOf(id: ItemId): number {
  const it = ITEMS[id]
  if (!it) return 0
  const base = it.ammo ? 2 : it.tier === 'boss' ? 160 : it.tier === 'rare' ? 45 : 12
  return Math.max(1, Math.round(base + it.weight * (it.ammo ? 1 : 4)))
}
