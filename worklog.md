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
