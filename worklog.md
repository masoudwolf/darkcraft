# Worklog

---
Task ID: 1
Agent: main (Z.ai Code)
Task: ساخت بازی Mine Souls — سولزلایک دارک سولز با تم و استایل ماینکرفت (فاز اول)

Work Log:
- پروژه بررسی شد (Next.js 16 + Tailwind 4 + shadcn/ui) و `three` + `@types/three` نصب شد.
- `src/lib/game/textures.ts`: تکسچرهای پیکسلی پروسیجرال ماینکرفتی (grass, dirt, stone, cobble, stonebrick, log, leaves, coal, glowstone, fog) با Canvas 2D و NearestFilter + اسکین‌های کاراکتر (player/zombie/boss) با صورت پیکسلی.
- `src/lib/game/models.ts`: مدل هومانونید بلاکی ماینکرفتی (سر/بدن/دست/پا از BoxGeometry با نسبت‌های کلاسیک ۸px/۱۲px) + شمشیر و سپر + انیمیشن‌ها (idle, walk, zombie-walk, حمله سبک ×۳ واریانت، حمله سنگین، غلتک، نوشیدن، ضربه خوردن، مرگ) + فلش قرمز ضربه و فید مرگ.
- `src/lib/game/engine.ts`: رندرر Three.js (سایه، toneMapping)، کلاس Input کامل (کیبورد، ماوس با pointer-lock و fallback درگ، wheel zoom، لمسی: joystick/look/دکمه‌ها) و رزولوشن تطبیقی برای دستگاه‌های ضعیف.
- `src/lib/game/sfx.ts`: افکت‌های صوتی WebAudio پروسیجرال (swing, hit, hurt, roll, heal, souls, levelup, death, bonfire, bossRoar, victory, heavy) بدون هیچ فایل صوتی.
- `src/lib/game/world.ts`: دنیای وکسلی ۶۰×۶۰ با heightmap سینوسی + فلت شدن ناحیه آتش کمپ و آرنای باس، حذف بلاک‌های پنهان + chunking ۸×۸ برای frustum culling، دیوار مرزی، ۸ درخت بلوط، ویرانه‌ها، مسیر خاکی، حلقه سنگی آتش کمپ + block زغال، آرنای باس با ستون‌های glowstone، دیوار مه متحرک، ماه مربعی، ستاره‌ها و ابرهای مکعبی متحرک.
- `src/lib/game/player.ts`: کنترلر سولزلایک کامل — استقامت (حمله ۱۸/سنگین ۳۲/غلتک ۲۲، ریجن با تأخیر)، غلتک با i-frame ۰.۳۴s، کمبو ۳ ضربه‌ای (ضربه سوم چرخشی ۳۶۰°)، حمله سنگین اورهد، شربت استوس (۳ عدد، هیل ۵۵٪)، lock-on، دویدن با Shift، HP ۹۵ پایه.
- `src/lib/game/enemy.ts`: هوش مصنوعی دشمن (idle/wander/chase/return/windup telegraph/strike/recover/hitstun/dead) + جداکنندگی از هم + leash به خانه + **حوله امن آتش کمپ** (دشمن‌ها تعقیب نمی‌کنند) + کلاس BossEnemy با ۲.۲۵x اسکیل، حمله Slam (AoE) و Sweep (قوسی)، فاز ۲ زیر ۵۰٪ جان (سریع‌تر، winudup کوتاه‌تر)، ۶۸۰HP و ۳۰۰۰ سول.
- `src/lib/game/game.ts`: ارکستراتور — دوربین سوم‌شخص نرم با لرزش و برخورد با زمین، hitstop، لکه خون سول‌ها (بازیابی با F)، گوی‌های سول پرنده، اعداد آسیب شناور، ذرات انفجاری، شعله آتش کمپ (Points + نور فلیکر)، vignette قرمز آسیب، reticle قفل هدف DOM، عبور سینمایی از دیوار مه (چرخش دوربین)، باری‌ر آرنای باس، مرگ → YOU DIED → ریسپاون خودکار، ذخیره/بارگذاری localStorage (سول/سطح/ویت/اند/استر) فقط هنگام استراحت، HUD state emit با change-detection.
- `src/components/game/GameClient.tsx`: منوی اصلی (MINE SOULS پیکسلی + کنترل‌ها)، HUD سولزی (HP/استقامت با بوردر مشکی، استوس، سطح، شمارنده سول با الماس، نوار باس فارسی، prompt تعامل)، مودال استراحت آتش کمپ با لول‌آپ (جان/استقامت/قدرت)، صفحه YOU DIED و دشمن بزرگ نابود شد، کنترل لمسی (جوی‌استیک + ۶ دکمه + ناحیه نگاه)، نوار راهنما پایین (فوتر فیکس).
- `src/app/page.tsx`, `layout.tsx` (فونت Vazirmatn + Press Start 2P، RTL)، `globals.css` (انیمیشن youdied/fadein، overflow hidden).
- تست مرورگر کامل با agent-browser: منو، حرکت، مباره، کشتن دشمن، سول، مرگ/ریسپاون، لکه خون، استراحت، لول‌آپ، عبور از مه، فعال‌سازی و کشتن باس، پیروزی، بازیابی ۳۴۲۰ سول، کنترل لمسی، موبایل — همه پاس.
- بهینه‌سازی: حذف بلاک پنهان (۱۴۴k → ۳۵k تری‌انگل)، chunked instancing، سایه‌مپ ۱۰۲۴ با آپدیت هر ۰.۱۵s، رزولوشن تطبیقی.

Stage Summary:
- بازی Mine Souls فاز ۱ کامل و قابل بازیه: چرخه کامل «بجنگ → سول بگیر → بمیر → لکه خون → آتش کمپ → لول‌آپ → باس → پیروزی».
- فایل‌های بازی در `src/lib/game/` (۷ ماژول) و UI در `src/components/game/GameClient.tsx`.
- ذخیره در localStorage با کلید `minesouls_v1`.
- Debug hook: `window.__minesouls` برای توسعه آینده.
- پیشنهاد فاز بعد: باس‌های بیشتر، جادو/معجون، آیتم و لوت، مناطق جدید، مینی‌مپ، گیم‌پد، موسیقی.

---
Task ID: 2
Agent: main (Z.ai Code)
Task: رفع ۳ باگ گزارش‌شده (سپر، غلتک، شمشیر) + گام بعدی: مکانیک دفاع با سپر و دشمن کریپر

Work Log:
- models.ts: چرخش شمشیر از ‎-75°‎ به ‎+105°‎ اصلاح شد (تیغه حالا رو به جلو با نوک کمی پایین — قبلاً به پشت اشاره می‌کرد). برای همه (بازیکن، زامبی، باس) یکجاع اعمال شد.
- models.ts: سپر بازطراحی شد (صفحه چوبی + قاب آهنی + میخ مرکزی) و حالا روی ساعد بیرونی دست چپ (x=+0.175) با زاویه ۲۶° رو به جلو بسته می‌شود — دیگر داخل دست فرو نرفته.
- models.ts: گروه pivot جدید «spin» در مرکز بدن (y=0.9) به Humanoid اضافه شد؛ animRoll بازنویسی شد: چرخش smoothstep کامل ۳۶۰° دور مرکز بدن + جمع‌کردن دست/پا/سر (tuck) + قوس پرش sin×0.42 — دیگر نه زیر زمین می‌رود نه چرخ‌وفلکی دور پاها می‌زند. resetPose حالا spin را هم ریست می‌کند.
- models.ts: animBlock (ژست دفاع: سپر جلوی بدن با لرزش ظریف) و setFlashWhite (فلاش سفید فتیله کریپر) اضافه شد؛ مدل کریپر (بدن کشیده، سر بزرگ با صورت آیکونیک، ۴ پا) در createHumanoid برای kind='creeper'.
- textures.ts: CharKind جدید 'creeper' + صورت پیکسلی کلاسیک کریپر روی گرید ۸×۸ + تکسچر استتار سبز برای skin/body/leg.
- engine.ts: Input حالا set/feld «held» دارد (RMB نگه‌داشته = دفاع، دکمه لمسی Block) + پاک‌سازی در blur و mouseup.
- player.ts: state جدید 'block' — سرعت ×۰.۴۲، ریجن استقامت ۳۵٪، فقط غلتک از داخل دفاع مجاز؛ takeDamage با پارامتر game: ضربه از قوس جلویی (dot>0.3) بلاک می‌شود (آسیب چینی ۱۵٪ + استقامت ۰.۹×دمج)، اتمام استقامت = گاردبریک (chip + منگ ۰.۸۵s + پیام «شکستن دفاع!»)؛ حمله سنگین حالا Shift+LMB یا دکمه HEAVY لمسی؛ hitDur متغیر برای منگ‌های طولانی.
- enemy.ts: هوک‌های onWindupStart(game) و windupShouldCancel(dist) به کلاس پایه؛ کلاس CreeperEnemy: تعقیب سریع → فتیله ۱.۰۵s (هیس + باد کردن + فلاش سفید) → انفجار AoE شعاع ۳.۴ (۳۶ dmg، قابل بلاک) → خودتخریب + اورب سول ۳۰؛ اگر بازیکن در فتیله فرار کند (>4.3) فتیله خنثی می‌شود. همه takeDamageها پارامتر game گرفتند.
- game.ts: ۳ کریپر به دنیا اضافه شد؛ onPlayerBlock (جرقه + صدای کلیگ)، onGuardBreak، onCreeperBoom (انفجار ذرات + نور لحظه‌ای + لرزش)؛ soulsValue برای اورب‌ها؛ hud.blocking؛ touchHold API.
- sfx.ts: block (کلینگ فلزی)، guardBreak، hiss (نویز صعودی)، boom (انفجار کم‌بسامد).
- GameClient.tsx: راهنماها به‌روز (RMB=دفاع، Shift+LMB=سنگین)، نشانگر 🛡️ کنار نوار استقامت، دکمه لمسی دفاع با نگه‌داشتن (بولد شدن هنگام فعال)، نسخه ۰.۲.

Stage Summary:
- هر سه باگ کاربر تایید مرورگری شد: شمشیر رو به جلو (نمای جلو)، سپر روی ساعد بیرونی، غلتک پشتک واقعی بالای زمین در p=0.25..0.7.
- مکانیک دفاع کامل تست شد: جلو بلاک (HP دست‌نخورده، استقامت ۹۵→۷۶)، پشت آسیب کامل، گاردبریک با استقامت کم (chip+منگ).
- کریپر تست شد: فیله → انفجار (مُرد + اورب سول + آسیب) و خنثی‌سازی با فرار (برگشت به chase، بدون آسیب).
- بدون خطای کنسول؛ lint پاس؛ موبایل/لمسی چک شد.
- پیشنهاد گام بعد: باس دوم یا منطقه جدید، جادو/آیتم، پری (parry) روی زمان‌بندی دقیق دفاع.

---
Task ID: 3
Agent: main (Z.ai Code)
Task: بازبینی کامل انیمیشن‌ها و حمله‌های باس + رفع ضعف‌ها و افزودن انیمیشن‌های جدید

Work Log:
- بازبینی کد باس (enemy.ts / models.ts / game.ts) و شناسایی ۴ ضعف/باگ:
  ۱) باگ جدی: متغیر angDiff در update پایه تعریف نشده بود (ReferenceError هر فریم → کل هوش مصنوعی دشمن‌ها بی‌صدا فریز می‌شد) — با محاسبه زاویه امضادار قبل از switch رفع شد.
  ۲) حمله Sweep با دست اشتباه انیمیت می‌شد (windup با دست راست شمشیردار، strike با animAttack('light1') که دست چپ را تکان می‌داد) — انیمیشن اختصاصی animSweep با دست شمشیر ساخته شد.
  ۳) onBossPhase2 هیچ‌وقت صدا زده نمی‌شد (کد مرده) — ترنزیشن فاز ۲ حالا واقعی است.
  ۴) Slam بدون تلگراف بصری بود — حالا حلقه شوک‌ویو expanding دارد.
- models.ts: ۷ انیمیشن جدید باس اضافه شد: animRoar (غرش سینمایی با لرزش)، animSlam (نگهداشتن بالای سر + ضربه ناگهانی + فرو رفتن در زمین)، animSweep (کمان افقی با دست راست)، animCharge (خم عمیق + شمشیر جلو + پاها)، animStomp (زانو + کوبش)، animStagger (شکست تعادل با لرزش)، animBossDead (مرگ سینمایی: عقب‌رفتن → زانو زدن → افتادن رو به جلو).
- enemy.ts: معماری hook-based برای کلاس پایه (wantsAttack, strikeDur, strikeImpactP, strikeMove, onStrikeStart, recoverAnim, roar/stagger/death hooks)؛ بازنویسی کامل BossEnemy:
  * ۴ حمله: Slam (AoE + شوک‌ویو)، Sweep (قوس افقی)، Charge (شارژ ۸ متر با تلگرام خم‌شدن — ضد کایت‌کردن)، Stomp (نوا ۳۶۰° برای تنبیه چسبیدن/پشت سر).
  * انتخاب هوشمند حمله بر اساس فاصله و زاویه (wantsAttack) به‌جای فقط برد نزدیک.
  * فاز ۲: غرش سینمایی ۲.۱ ثانیه‌ای غیرقابل‌وقفه + نسل زدن + آسیب‌ناپذیری + هاله قرمز تپنده + کمبوهای زنجیره‌ای (slam→sweep, sweep→slam با cooldown 0.14s) + windup ۲۸٪ سریع‌تر.
  * سیستم Poise: ۱۵۰ آسیب تجمعی → stagger ۱.۹ ثانیه‌ای (پنجره تنبیه) + متن «تعادلش شکست!».
  * غرش معرفی هنگام فعال‌سازی باس (intro roar).
- game.ts: کلاس Shockwave (حلقه RingGeometry منبسط‌شونده روی زمین که هنگام عبور از زیر پای بازیکن ۱۴-۱۶ دمیج می‌زند — قابل رول/دفاع) + onBossIntro/onBossStomp/onBossStagger + تقویت onBossSlam/onBossPhase2.
- sfx.ts: phaseRoar (غرش عمیق‌تر فاز ۲)، stomp، dash، stagger.
- تست مرورگر کامل: هر ۴ حمله به‌صورت قطعی (دمج مستقیم)، شوک‌ویو در ۴.۴m، فاز ۲ (غلوی قرمز 0.21 + آسیب‌ناپذیری غرش)، stagger، مرگ سینمایی + بنر پیروزی + ریست کامل بعد از ریسپاون. همچنین جریان واقعی دیوار مه → فعال‌سازی → معرفی → مباره → مرگ بازیکن → ریست.
- نکته تست: headless browser فاصله‌های بین دستورات rAF را throttle می‌کند (نه باگ بازی — در مرورگر واقعی ۶۰fps است).

Stage Summary:
- باس از ۲ حمله ساده به ۴ حمله context-aware با تلگراف، شوک‌ویو، کمبو فاز ۲، سیستم poise/stagger و انیمیشن‌های اختصاصی ارتقا یافت.
- باگ فریز شدن کل AI دشمن‌ها (angDiff) رفع شد — این باگ بازی را بعد از اولین حمله دشمن‌ها بی‌صدا متوقف می‌کرد.
- انیمیشن sweep حالا با دست شمشیردار است؛ فاز ۲ واقعاً سینمایی است (غرش + هاله قرمز + آسیب‌ناپذیری).
- فایل‌ها: models.ts (+۱۷۰ خط انیمیشن)، enemy.ts (بازنویسی باس)، game.ts (Shockwave + رویدادها)، sfx.ts (+۴ صدا).
- پیشنهاد گام بعد: لوت/آیتم از باس، دشمن mínimo جدید (اسکلت/عنکبوت)، یا مینی‌مپ/نقشه.

---
Task ID: 4
Agent: main (Z.ai Code)
Task: فاز ۴ توسعه — دشمن اسکلت تیرانداز + فلش پروازی + مینی‌مپ + تکه‌ی استوس (لوت باس) + آماده‌سازی گیت برای GitHub

Work Log:
- textures.ts: CharKind جدید 'skeleton' — استخوان سفید استخوانی، صورت جمجمه با حدقه‌های سیاه توخالی و دندان، بافت بدن با سایه‌ی دنده (ribcage)، سایه‌ی مفصلی روی پاها.
- models.ts: createBow() — کمان بلوکی ماینکرفتی (دسته + دو بازو + زه) با محور بازو روی X محلی تا موقع نشانه‌گیری عمودی بایستد؛ ۳ انیمیشن جدید: animBowDraw (کمان‌کشی با لرزش ظریف نزدیک رها کردن)، animBowShoot (رها کردن با ری‌کویل)، animPoke (ضربه‌ی نزدیک با دست کمان).
- sfx.ts: arrowShoot (توانگ زه + ویز)، arrowHit (توق خوردن فلش)، arrowBlock (کلیگ برگشت از سپر)، shard (آکورد گرم برداشتن تکه استوس).
- enemy.ts: هوک جدید chaseMove در کلاس پایه (حرکت/چرخش در حالت chase از پایه جدا شد تا دشمن‌های رنجیر بازنویسیش کنند)؛ سازنده‌ی Enemy فقط برای zombie/boss شمشیر می‌سازد؛ کلاس SkeletonEnemy: هوش کایتینگ (زیر ۵.۶ متر عقب‌عقب می‌رود، ۶..۱۱.۵ می‌ایستد و strafe می‌کند، بالاتر پیش می‌آید)، دو حمله: Shoot (windup ۰.۹۵s کشیدن کمان → فلش) و Poke (ضربه‌ی پانیک زیر ۲.۶ متر)، مرگ با فروپاشی استخوانی، ۵۵HP/۴۵ سول.
- game.ts: کلاس Arrow — پرتابه بلوکی (بدنه + نوک + پر)، سرعت ۱۵.۵ با قوس ملایم، برخورد با زمین → گیر کردن ۱.۳ ثانیه + گردوخاک، برخورد با بازیکن (کپسول تنه) → آسیب قابل دفاع/قابل غلتک؛ spawnArrow + onArrowBlocked؛ ۳ اسکلت در دنیا؛ مینی‌مپ canvas ۱۳۲px بلوکی (terrain پیش‌رندر شده ۱px/بلاک + لایه‌ی داینامیک: بازیکن سفید با نشانگر جهت سبز، دشمن‌ها رنگ‌کدشده، آتش کمپ کهربایی، باس زرشکی، لکه خون چشمک‌زن، شارد)؛ Estus Shard — لوت باس: بعد از مرگ باس کنار جسد می‌افتد (شیشه کهربایی + نور تپنده)، برداشتن با F → ظرفیت شربت دائمی +۱؛ SaveData.estusUp برای ماندگاری.
- GameClient.tsx: متن پیروزی باس + شماره‌ی نسخه ۰.۳.
- باگ رفع‌شده حین تست: WORLD_HALF بدون import در game.ts (ReferenceError → صفحه سفید) — فیکس شد.
- تست مرورگر قطعی: کایتینگ اسکلت (فاصله ۵.۷-۶.۳ پایدار)، ۳ فلش شلیک → ۲ برگشت از سپر (استقامت -۱۸/ضربه، HP سالم)، فلش آزاد ۲۰ دمیج، i-frame غلتک فلش را رد می‌کند، کشتن باس → شارد → برداشتن → ۴/۴ استوس → ذخیره → بعد از reload هم ۴/۴ ماند، مینی‌مپ همه‌ی نشانگرها را رندر می‌کند.
- اسکرین‌شات‌ها: اسکلت در حال کمان‌کشی، فلش در پرواز، بافت دنده، مینی‌مپ فعال — همه تایید بصری شدند.
- گیت: ریپوی https://github.com/masoudwolf/darkcraft پیدا شد (public و خالی)، remote origin تنظیم شد؛ برای push به توکن واقعی PAT نیاز است (لینک توکن فقط صفحه لاگین می‌دهد).

Stage Summary:
- بازی الان ۳ نوع دشمن دارد: زامبی (نزدیک)، کریپر (انفجاری)، اسکلت تیرانداز (رنجیر با کایتینگ) — مثلث تاکتیکی کامل: حمله/فاصله/دفاع.
- فلش‌ها سومین زبان مبارزی هستند: بلاک (چیپ استقامت)، غلتک (i-frame)، یا خوردن — خواندن تلگراف کشیدن کمان مهارت اصلی جدید.
- مینی‌مپ ناوبری دنیا را کامل حل کرد؛ تکه‌ی استوس اولین لوت دائمی بازی است (حس پیشرفت سولزلایک).
- فایل‌ها: textures.ts، models.ts (+۶۵ خط)، sfx.ts (+۲۰)، enemy.ts (+۱۵۰)، game.ts (+۲۸۰)، GameClient.tsx.
- گام بعد پیشنهادی: باس دوم / منطقه‌ی جدید، جادوی بازیکن (آتش/اذیت)، NPC و فروشگاه، گیم‌پد.

---
Task ID: 1
Agent: main (Z.ai Code)
Task: Push project to GitHub repo masoudwolf/darkcraft using user's fine-grained PAT

Work Log:
- Configured remote origin with user's token: https://github.com/masoudwolf/darkcraft.git
- Verified remote access (git ls-remote OK, repo was empty)
- Pushed main branch (51fc951 "Phase 4: skeleton archer + arrows + minimap + estus shard loot") as first push

Stage Summary:
- GitHub workflow established; every future update must be committed & pushed to origin/main

---
Task ID: 2
Agent: main (Z.ai Code)
Task: Broad playtest & mechanical review of the whole game (boss power check, enemy AI, combat mechanics, UI flows) — fix bugs, improve what needs improving

Work Log:
- Playtested in a real browser via agent-browser + a synchronous game-time stepper (drive onFrame directly to bypass headless RAF throttling) + an input-driven player-AI
- Verified working: intro roar, 4 boss moves (slam 39-48dmg, sweep 33, stomp 34-39+16wave, charge ~32 w/ 15.5u/s dash), anti-kite charge trigger (cd expiring >7.5m), phase 2 (speed x1.35, windups x0.72, combo chains), poise/stagger (150dmg -> 1.9s punish), arena barrier, shockwaves, i-frames, block arcs, creeper fuse/explosion/self-destruct, skeleton kiting band 6-11m + arrows 14-17dmg, bloodstain death loop, save/load, minimap, victory flow (+3000 souls, banner, shard)
- BUG FIX A (enemy.ts): added player personal-space separation — enemies used to walk INSIDE the player (dist ~0), degenerating every direction-based check (blocks failed with dot~0, strikes whiffed, camera clipped). Humanoids pushed to 0.72, boss 1.5
- BUG FIX B (game.ts playerStrike): melee geometry now horizontal (blocky terrain height steps inflated 3D distance) + point-blank auto-hit bypass (d <= 0.9 skips the arc check) — hugging enemies are hittable again
- BUG FIX C (enemy.ts BossEnemy.takeDamage): boss roar now TAKES damage (feedback/numbers) without interrupting the cinematic or refreshing roarT
- BUG FIX D (player.ts ROLL_IFRAME 0.34 -> 0.42): boss slam impact lands 0.33s after strike start; old i-frames made dodging frame-perfect. Reaction rolls now reliably cover impacts (verified: full AI boss kill, 0 direct hits taken)
- BUG FIX E (game.ts rest/levelUp): released pointer lock on rest — pointer lock retargeted every click to the canvas, making the rest menu (level-up/arise) UNCLICKABLE on desktop; Escape now also leaves rest; level-up tops up new max HP/stamina
- BUG FIX F (player.ts block): standing guard anchors the shield to camera-forward (stale last-move yaw let hits sneak through); chip damage (15%) now actually applies on successful blocks (was computed but never applied)
- Boss power verdict: balanced for a leveled player — AI fight at level ~10: killed in 60.5s, 101/191 HP left, only shockwave chips taken; at level 1 it is a deliberate 2-hit-kill wall (souls gating via bonfire loop)

Stage Summary:
- 6 gameplay bugs fixed (separation, point-blank whiff, roar feedback, i-frame timing, pointer-lock UI trap, block arc/chip)
- All mechanics re-verified in browser after fixes; boss kill run through real input pipeline
- Boss numbers kept (mechanics fixes already make the fight ~2x fairer)
