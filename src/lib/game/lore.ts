/* ============================================================
   LORE — the story backbone of MINE SOULS
   ------------------------------------------------------------
   Dark Souls tells its story the way ruins do: never through
   an exposition speech, but through fragmented memories —
   item descriptions, monuments, and the shape of the world
   itself. This file is the game's memory stone.

   THE STORY (short version):
   In the beginning there was shapeless dust. Then the First
   Coal (زغالِ نخستین) ignited in the dark — the heart of
   creation. From its embers rose the BUILDERS (سازندگان),
   giants who wove the world block by block, placing every
   stone and planting every tree by hand.

   But no fire burns for free. As the Coal dimmed, the
   Builders fed it: first wood, then stone, then memories,
   then pieces of their own light — souls. Those who gave
   too much FORGOT their craft. Their hands kept building by
   habit while their faces went hollow. These are the
   HOLLOWED (خالی‌شدگان) wandering the village they once
   raised. The shrine guards' oaths outlived their flesh —
   they became skeletons. The Builder-lord who leapt into
   the forge-pit burns forever as the FLAME KING.

   You are the last EMBER (اخگر) — a small spark the final
   Builder set apart, to sleep until the world needed
   relighting. Tonight, for the first time in ages, a
   bonfire answered. A single word is written on your hand
   in ash:  افروز کن — "Kindle."
   ============================================================ */

export interface LoreStoneDef {
  id: string
  title: string
  /** the paragraphs engraved on the stone */
  text: string[]
  x: number
  z: number
  /** facing yaw of the rune side */
  yaw: number
}

/** the memorial stones of the Vale — read with F, remembered forever */
export const LORE_STONES: LoreStoneDef[] = [
  {
    id: 'first_stone',
    title: 'سنگِ نخست',
    text: [
      '«این‌جا نخستین سنگ گذاشته شد.»',
      'سنگی که سازندگان، پیش از هر کوه و هر درخت، بر گرد و غبار نهادند. تا آن روز، جهان چیزی نبود جز غباری بی‌شکل که می‌آمد و می‌رفت.',
      'زغالِ نخستین در دلِ تاریکی گرفت و روشن شد، و از اخگرهایش غولانی برخاستند که هر بلوک را با دست می‌چیدند. نامِ نخستین سنگ را دیگر هیچ سنگ‌یادی نگه ندارد؛ فقط این ستون هست که هنوز سرپاست.',
    ],
    x: 3,
    z: 11,
    yaw: Math.PI,
  },
  {
    id: 'last_bonfire',
    title: 'آتش‌گاهِ آخر',
    text: [
      '«آتش کمپ را مادر صدا نکن.»',
      'او خانه‌ای است که هنوز نپذیرفته خاموش شود. سازندگان پیش از رفتن، اخگری کوچک جدا کردند و در آتشگاهِ آخر خواباندند — تا روزی که جهان دوباره به آتش نیاز پیدا کند.',
      'قرن‌ها گذشت. امشب، برای نخستین بار، شعله سر برداشت. یعنی تو بیدار شده‌ای.',
    ],
    x: -2.4,
    z: 11,
    yaw: 0,
  },
  {
    id: 'village_hollow',
    title: 'دهکده‌ی فراموشی',
    text: [
      '«آن‌چه بیش از حد بخشید، ساختن را فراموش کرد.»',
      'این خانه‌ها را کسانی بالا آوردند که نامشان را روی آجرها کندند. زغال رو به خاموشی رفت و سازندگان بخشیدند: نخست چوب را، آن‌گاه سنگ را، آن‌گاه خاطره‌ها را.',
      'ساکنانِ این‌جا هنوز هر شب به در خانه‌هایشان دست می‌کشند. دست‌هایشان هنوز حرکتِ بنا را می‌دانند؛ ساختن را دیگر نه. آن‌ها را خالی‌شدگان می‌نامند.',
    ],
    x: -17,
    z: 6,
    yaw: Math.PI / 2,
  },
  {
    id: 'graveyard_brother',
    title: 'گورِ برادر',
    text: [
      '«او برای برادرش گور کند. بعد برای همه.»',
      'آخرین سازنده‌ای که هنوز نامش را می‌دانست، برادرش را — اولین خالی‌شده — پشتِ آتش‌گاه دفن کرد و از آن پس کندن گور را رها نکرد.',
      'مردمِ درّه می‌گفتند تا وقتی این دست‌ها می‌کنند، هنوز چیزی برای ساختن مانده. سنگِ آخرِ قبر، برای خودش کنده شده؛ نیمه‌تمام.',
    ],
    x: -14,
    z: 23,
    yaw: Math.PI / 2,
  },
  {
    id: 'watcher_oath',
    title: 'عهدِ نگهبانان',
    text: [
      '«ما تا بیداریم، چشم داریم. تا چشم داریم، دیواریم.»',
      'نگهبانان آتش‌گاه بر این بلندی سوگند خوردند که خوابِ دشمن را ندیده بگیرند. کمان‌هایشان از استخوانِ خودشان تراشیده شد تا عهد، از گوشت جاودانه‌تر باشد.',
      'عهد، گوشت را زندگی کرد و زندگی کرد... تا هذیان شد. حالا نگهبانان هنوز بر بلندی ایستاده‌اند؛ به هرچه حرکت می‌کند تیر می‌بارند و نمی‌دانند برای چه.',
    ],
    x: 7,
    z: 19,
    yaw: Math.PI,
  },
  {
    id: 'knight_vigil',
    title: 'بیداریِ شوالیه',
    text: [
      '«سرِ سپاه پشتِ دروازه می‌خوابد؛ حتی خوابش هم نمی‌لنبد.»',
      'شوالیه‌ی کهن، نخستین فرمانده‌ی نگهبانانِ زغال بود. شبی که بخشش‌هایش از حد گذشت، برای این‌که فراموشی چهره‌اش را نبیند، خود را پشت دروازه‌ی شمالی زنجیر کرد.',
      'حالا آن‌پَرِ زره، آن‌پَرِ خواب است. اگر پشت مه رفتید، به او پشت نکنید. هرگز.',
    ],
    x: -2.5,
    z: -8.5,
    yaw: Math.PI,
  },
  {
    id: 'flame_sacrifice',
    title: 'جهشِ پادشاه',
    text: [
      '«آخرین پادشاه، از خودش آتش‌گیرتر بود.»',
      'روزهای آخر، زغال آن‌قدر کم‌سو شده بود که سازندگان خاکسترِ خاطره‌ها را می‌سوزاندند. پادشاهِ شرق فرمان داد کوره‌گاهی بسازند و خودش در گودالِ گداخته پرید.',
      'شعله‌ها پادشاه را نشناختند و ماندگار شدند. تاجش را در گودال فراموش کرد؛ شعله‌ها یادشان نرفت. حالا پنج زبانِ آتش، از فرازِ خاکسترگاه، پادشاهی می‌کنند.',
    ],
    x: 14.5,
    z: 14.5,
    yaw: -Math.PI / 2,
  },
]

/** the prologue pages — shown once, at the birth of a new unkindled */
export const PROLOGUE: { title: string; lines: string[] }[] = [
  {
    title: 'زغالِ نخستین',
    lines: [
      'در آغاز، گرد و غباری بی‌شکل بود؛ جهانی که هنوز کسی آن را نساخته بود.',
      'آنگاه زغالِ نخستین در دلِ تاریکی گرفت و روشن شد.',
      'از اخگرهایش غولانی برخاستند: سازندگان. آنان سنگ را می‌بافتند، چوب را می‌کاشتند و جهان را بلوک به بلوک، با دست، چیدند.',
    ],
  },
  {
    title: 'سرد شدن',
    lines: [
      'اما هیچ آتشی بی‌هزینه نمی‌سوزد.',
      'زغال رو به خاموشی رفت و سازندگان برای نگه‌داشتنش بخشیدند: نخست چوب را، آن‌گاه سنگ را، آن‌گاه خاطره‌ها را... و سرانجام، تکه‌هایی از خودشان.',
      'آن‌چه بیش از حد بخشید، ساختن را فراموش کرد. دست‌هایش هنوز می‌چیدند؛ چهره‌اش خالی بود.',
    ],
  },
  {
    title: 'آخرین اخگر',
    lines: [
      'سازندگان پیش از رفتن، اخگری کوچک جدا کردند و در آتشگاهِ آخر خواباندند: تو.',
      'قرن‌ها گذشت. دهکده‌ها خالی شد، نگهبانان استخوان شدند، و پادشاهان در خودشان سوختند.',
      'امشب، برای نخستین بار، آتشِ کمپ باز سر برداشت.',
    ],
  },
  {
    title: 'بند',
    lines: [
      'دستت را باز کن.',
      'بر کف دستت، با خاکستر، یک واژه نوشته شده است:',
      'افروز کن.',
      'سنگ‌یادها را بخوان. سول‌ها را بیار. و هرچه مانده را — بساز، یا بسوزان.',
    ],
  },
]

/** the grey merchant's idle lines — he trades to remember what he sold */
export const MERCHANT_LINES: string[] = [
  'هر سولی که می‌خرم، خاطره‌ای است که نمی‌گذارم بپرد.',
  'من هم روزی شاگردِ سازندگان بودم. دستم هنوز می‌داند چطور ببافد؛ سرم دیگر نمی‌داند چرا.',
  'قلعه‌ها را نبین. آن‌چه را ساخته‌اند ببین، نه آن‌چه مانده.',
  'خالی‌ها دشمن تو نیستند؛ فقط یادشان رفته چه کسی بوده‌اند. این را هیچ شمشیری نمی‌فهمد.',
  'شعله‌ی پیرمانسی را از خاکسترگاه می‌شناسم؟ مالِ کوره‌بانی بود که خنده‌اش آتش می‌گرفت. واقعاً می‌گرفت.',
]
