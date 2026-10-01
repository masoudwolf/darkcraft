'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Game, type HudState, type GameSettings } from '@/lib/game/game'
import ModelViewer from '@/components/game/ModelViewer'

/* ================= small pixel icons (inline SVG) ================= */

function EmeraldIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden>
      <polygon points="8,1 15,6 12,15 4,15 1,6" fill="#2fbf4a" stroke="#0d3a16" strokeWidth="1.4" />
      <polygon points="8,3 12.6,6.2 8,7 3.4,6.2" fill="#7dff9a" opacity="0.85" />
    </svg>
  )
}

function EstusIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden>
      <rect x="6" y="1" width="4" height="2" fill="#7a5a34" />
      <path d="M5 3 h6 l2 5 a5 5 0 0 1 -10 0 z" fill="#3a2a18" stroke="#1a1208" strokeWidth="1" />
      <path d="M6.5 6 h3 l1.4 3.6 a3.4 3.4 0 0 1 -5.8 0 z" fill="#ffb63d" />
      <rect x="4.5" y="10" width="7" height="1.4" fill="#ffd98a" opacity="0.7" />
    </svg>
  )
}

function PixelSwordIcon({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden style={{ imageRendering: 'pixelated' }}>
      <rect x="7" y="1" width="2" height="9" fill="#dfe6ef" />
      <rect x="7" y="1" width="1" height="9" fill="#ffffff" opacity="0.7" />
      <rect x="5" y="10" width="6" height="1.6" fill="#6e4f30" />
      <rect x="7" y="11.6" width="2" height="3.4" fill="#4a3620" />
    </svg>
  )
}

/* ================= HUD ================= */

function Hud({ hud }: { hud: HudState }) {
  const hpPct = Math.max(0, (hud.hp / hud.maxHp) * 100)
  const stPct = Math.max(0, (hud.st / hud.maxSt) * 100)
  const bossPct = hud.bossMax > 0 ? Math.max(0, (hud.bossHp / hud.bossMax) * 100) : 0

  return (
    <div className="pointer-events-none absolute inset-0 z-10 select-none" dir="rtl">
      {/* top-left bars */}
      <div className="absolute left-3 top-3 w-72 max-w-[62vw]">
        <div className="h-[18px] border-2 border-black/90 bg-black/70 p-[2px] shadow-[3px_3px_0_rgba(0,0,0,0.45)]">
          <div
            className="h-full bg-gradient-to-b from-[#e2453c] to-[#8f1d17] transition-[width] duration-200"
            style={{ width: `${hpPct}%` }}
          />
        </div>
        <div className="mt-1.5 flex items-center gap-2">
          <div className="h-[13px] w-[70%] border-2 border-black/90 bg-black/70 p-[2px] shadow-[3px_3px_0_rgba(0,0,0,0.45)]">
            <div
              className="h-full bg-gradient-to-b from-[#79d94f] to-[#2f7a1c] transition-[width] duration-150"
              style={{ width: `${stPct}%` }}
            />
          </div>
          {/* block indicator */}
          <span
            className={`text-lg leading-none transition-opacity ${hud.blocking ? 'opacity-100 drop-shadow-[0_0_8px_rgba(255,220,120,0.9)]' : 'opacity-25'}`}
            aria-hidden
          >
            🛡️
          </span>
        </div>
        <div className="mt-2 flex items-center gap-3 text-white">
          <div className="flex items-center gap-1 bg-black/55 px-1.5 py-0.5 border border-black/70">
            <EstusIcon size={18} />
            <span className="text-sm font-bold text-amber-300">{hud.estus}/{hud.maxEstus}</span>
          </div>
          {hud.pyroUnlocked && (
            <div className="flex items-center gap-1 bg-black/55 px-1.5 py-0.5 border border-black/70">
              <span className="text-sm leading-none" aria-hidden>🔥</span>
              <span className="text-sm font-bold text-orange-300">{hud.pyro}/{hud.maxPyro}</span>
            </div>
          )}
          <div className="bg-black/55 px-1.5 py-0.5 border border-black/70 text-xs text-white/85">
            سطح <span className="font-pixel text-[10px] text-emerald-300">{hud.level}</span>
          </div>
        </div>
      </div>

      {/* souls bottom-right */}
      <div className="absolute bottom-9 right-4 flex items-center gap-2 bg-black/60 border border-black/80 px-3 py-1.5 shadow-[3px_3px_0_rgba(0,0,0,0.4)]">
        <EmeraldIcon size={22} />
        <span className="font-pixel text-sm text-emerald-300" dir="ltr">{hud.souls.toLocaleString('en-US')}</span>
      </div>

      {/* boss bar */}
      {hud.bossName && (
        <div className="absolute bottom-12 left-1/2 w-[min(80vw,560px)] -translate-x-1/2">
          <div className="mb-1 text-center text-sm font-bold text-white/90 drop-shadow-[0_2px_2px_rgba(0,0,0,0.9)]">
            {hud.bossName}
          </div>
          <div className="h-[14px] border-2 border-black/90 bg-black/70 p-[2px]">
            <div
              className="h-full bg-gradient-to-b from-[#d4b04a] to-[#7a5a14] transition-[width] duration-200"
              style={{ width: `${bossPct}%` }}
            />
          </div>
        </div>
      )}

      {/* interaction prompt */}
      {hud.prompt && (
        <div className="absolute bottom-24 left-1/2 flex -translate-x-1/2 items-center gap-2 border border-white/25 bg-black/75 px-3 py-1.5 text-sm text-white/95">
          <kbd className="rounded border border-white/35 bg-white/10 px-1.5 py-0.5 font-pixel text-[10px]">F</kbd>
          <span>{hud.prompt}</span>
        </div>
      )}
    </div>
  )
}

/* ================= footer hint bar (fixed to bottom) ================= */

function HintBar() {
  const items = [
    ['WASD', 'حرکت'],
    ['Shift', 'دویدن'],
    ['Space', 'غلتک'],
    ['کلیک چپ', 'حمله'],
    ['Shift+کلیک چپ', 'حمله سنگین'],
    ['کلیک راست', 'دفاع (نگه‌دار)'],
    ['Q', 'قفل روی دشمن'],
    ['E', 'شربت'],
    ['R', 'جادو'],
    ['F', 'تعامل'],
    ['Esc', 'توقف'],
  ]
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 hidden justify-center gap-x-4 gap-y-0.5 border-t border-white/10 bg-black/45 py-1 text-[11px] text-white/55 backdrop-blur-[2px] sm:flex sm:flex-wrap">
      {items.map(([k, v]) => (
        <span key={k} className="whitespace-nowrap">
          <b className="font-pixel text-[9px] text-white/80">{k}</b> {v}
        </span>
      ))}
    </div>
  )
}

/* ================= settings modal (shared: menu + pause) ================= */

function SettingsModal({
  settings,
  onChange,
  onClose,
}: {
  settings: GameSettings
  onChange: (patch: Partial<GameSettings>) => void
  onClose: () => void
}) {
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/75 px-4" dir="rtl">
      <div className="fadein-anim w-[min(94vw,420px)] rounded-none border-2 border-black bg-zinc-950/95 shadow-[6px_6px_0_rgba(0,0,0,0.6)]">
        <div className="flex items-center gap-2 border-b border-white/10 px-5 py-4">
          <span className="text-2xl" aria-hidden>⚙️</span>
          <h3 className="text-lg font-black text-white">تنظیمات</h3>
        </div>
        <div className="space-y-5 px-5 py-5">
          {/* sensitivity */}
          <div>
            <div className="mb-1.5 flex items-center justify-between text-sm">
              <span className="text-white/80">حساسیت ماوس</span>
              <span className="font-pixel text-[10px] text-emerald-300" dir="ltr">{settings.sens.toFixed(2)}x</span>
            </div>
            <input
              type="range" min={0.3} max={2.2} step={0.05} value={settings.sens}
              onChange={(e) => onChange({ sens: Number(e.target.value) })}
              className="h-1.5 w-full accent-emerald-400" dir="ltr"
            />
          </div>
          {/* volume */}
          <div>
            <div className="mb-1.5 flex items-center justify-between text-sm">
              <span className="text-white/80">بلندی صدا</span>
              <span className="font-pixel text-[10px] text-amber-300" dir="ltr">{Math.round(settings.volume * 100)}%</span>
            </div>
            <input
              type="range" min={0} max={1} step={0.05} value={settings.volume}
              onChange={(e) => onChange({ volume: Number(e.target.value) })}
              className="h-1.5 w-full accent-amber-400" dir="ltr"
            />
          </div>
          {/* toggles */}
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ['وارونگی محور Y', settings.invertY, () => onChange({ invertY: !settings.invertY })],
                ['سایه‌ها', settings.shadows, () => onChange({ shadows: !settings.shadows })],
              ] as const
            ).map(([label, on, toggle]) => (
              <button
                key={label}
                onClick={toggle}
                className={`flex items-center justify-between border px-3 py-2.5 text-xs font-bold transition-colors ${
                  on
                    ? 'border-emerald-400/70 bg-emerald-900/40 text-emerald-200'
                    : 'border-white/15 bg-white/5 text-white/50 hover:bg-white/10'
                }`}
              >
                {label}
                <span className={`ml-2 inline-block h-2.5 w-2.5 ${on ? 'bg-emerald-400' : 'bg-white/25'}`} aria-hidden />
              </button>
            ))}
          </div>
          <p className="text-[10px] leading-4 text-white/35">
            تنظیمات خودکار ذخیره می‌شوند. برای بهترین تجربه، سایه‌ها را روی دستگاه‌های ضعیف خاموش کنید.
          </p>
        </div>
        <div className="border-t border-white/10 px-5 py-4">
          <Button onClick={onClose} className="h-10 w-full rounded-none border-2 border-black/70 bg-zinc-800 font-bold text-white shadow-[3px_3px_0_rgba(0,0,0,0.55)] hover:bg-zinc-700">
            بازگشت
          </Button>
        </div>
      </div>
    </div>
  )
}

/* ================= main menu ================= */

type MenuPage = 'root' | 'settings' | 'exit'

function MainMenu({
  onStart,
  hasSave,
  onClear,
  onViewer,
  onSettings,
  onExit,
}: {
  onStart: () => void
  hasSave: boolean
  onClear: () => void
  onViewer: () => void
  onSettings: () => void
  onExit: () => void
}) {
  return (
    <div className="absolute inset-0 z-30 flex flex-col items-center justify-center overflow-y-auto bg-gradient-to-b from-black/85 via-black/55 to-black/90 px-4 py-8" dir="rtl">
      <div className="flex items-center gap-3">
        <PixelSwordIcon size={44} />
        <h1 className="font-pixel text-4xl leading-relaxed sm:text-6xl" dir="ltr">
          <span className="text-emerald-500 drop-shadow-[3px_3px_0_rgba(0,0,0,0.9)]">MINE</span>{' '}
          <span className="text-red-600 drop-shadow-[3px_3px_0_rgba(0,0,0,0.9)]">SOULS</span>
        </h1>
        <PixelSwordIcon size={44} />
      </div>
      <p className="mt-4 max-w-md text-center text-sm text-white/75 sm:text-base">
        نبردی تاریک در دنیای مکعبی — جایی که پیکسل‌ها به سولز می‌رسند.
        <br />
        بجنگ، بسوز، در آتش کمپ بیاسای و دوباره برخیز.
      </p>

      <div className="mt-8 flex w-[min(90vw,300px)] flex-col gap-2.5">
        <Button
          size="lg"
          onClick={onStart}
          className="h-12 w-full border-2 border-black/80 bg-emerald-700 font-bold text-white shadow-[4px_4px_0_rgba(0,0,0,0.6)] hover:bg-emerald-600"
        >
          {hasSave ? 'ادامه‌ی بازی' : 'شروع بازی'}
        </Button>
        <Button
          size="lg"
          onClick={onViewer}
          className="h-11 w-full border-2 border-black/80 bg-sky-900 font-bold text-white shadow-[4px_4px_0_rgba(0,0,0,0.6)] hover:bg-sky-800"
        >
          🔬 نمایشگر سه‌بعدی
        </Button>
        <Button
          size="lg"
          onClick={onSettings}
          className="h-11 w-full border-2 border-black/80 bg-zinc-800 font-bold text-white shadow-[4px_4px_0_rgba(0,0,0,0.6)] hover:bg-zinc-700"
        >
          ⚙️ تنظیمات
        </Button>
        <Button
          size="lg"
          onClick={onExit}
          className="h-11 w-full border-2 border-black/80 bg-red-950 font-bold text-red-200 shadow-[4px_4px_0_rgba(0,0,0,0.6)] hover:bg-red-900"
        >
          خروج
        </Button>
      </div>
      {hasSave && (
        <button
          onClick={onClear}
          className="mt-3 text-xs text-white/45 underline-offset-4 hover:text-white/80 hover:underline"
        >
          پاک کردن ذخیره و شروع تازه
        </button>
      )}

      <div className="mt-10 grid grid-cols-2 gap-x-8 gap-y-1.5 rounded border border-white/15 bg-black/60 px-6 py-4 text-xs text-white/70 sm:grid-cols-4">
        <span><b className="font-pixel text-[10px] text-emerald-300">WASD</b> حرکت</span>
        <span><b className="font-pixel text-[10px] text-emerald-300">Space</b> غلتک</span>
        <span><b className="font-pixel text-[10px] text-emerald-300">LMB</b> حمله</span>
        <span><b className="font-pixel text-[10px] text-emerald-300">Shift+LMB</b> سنگین</span>
        <span><b className="font-pixel text-[10px] text-emerald-300">RMB</b> دفاع (نگه‌دار)</span>
        <span><b className="font-pixel text-[10px] text-emerald-300">Q</b> قفل هدف</span>
        <span><b className="font-pixel text-[10px] text-emerald-300">E</b> شربت</span>
        <span><b className="font-pixel text-[10px] text-emerald-300">R</b> جادو</span>
        <span><b className="font-pixel text-[10px] text-emerald-300">F</b> تعامل</span>
        <span><b className="font-pixel text-[10px] text-emerald-300">Esc</b> توقف / منو</span>
      </div>
      <p className="mt-6 text-center text-[11px] leading-5 text-white/35">
        نسخه ۰.۶ — جدید: منوی کامل، نمایشگر سه‌بعدی موجودات، دروازه‌های مه ترمیم‌شده
        <br />و انیمیشن حرفه‌ای کماندار با تیر نوک‌شده
      </p>
    </div>
  )
}

/* ================= pause menu ================= */

function PauseMenu({
  onResume,
  onSettings,
  onExitToMenu,
}: {
  onResume: () => void
  onSettings: () => void
  onExitToMenu: () => void
}) {
  return (
    <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/70 px-4" dir="rtl">
      <h2 className="font-pixel text-3xl tracking-[0.2em] text-white/90" dir="ltr">PAUSED</h2>
      <p className="mt-2 text-xs text-white/50">نبرد نفس می‌کشد... اما خاکستر صبر نمی‌کند</p>
      <div className="mt-7 flex w-[min(90vw,280px)] flex-col gap-2.5">
        <Button
          size="lg"
          onClick={onResume}
          className="h-11 w-full border-2 border-black/80 bg-emerald-700 font-bold text-white shadow-[4px_4px_0_rgba(0,0,0,0.6)] hover:bg-emerald-600"
        >
          ادامه‌ی بازی
        </Button>
        <Button
          size="lg"
          onClick={onSettings}
          className="h-11 w-full border-2 border-black/80 bg-zinc-800 font-bold text-white shadow-[4px_4px_0_rgba(0,0,0,0.6)] hover:bg-zinc-700"
        >
          ⚙️ تنظیمات
        </Button>
        <Button
          size="lg"
          onClick={onExitToMenu}
          className="h-11 w-full border-2 border-black/80 bg-red-950 font-bold text-red-200 shadow-[4px_4px_0_rgba(0,0,0,0.6)] hover:bg-red-900"
        >
          خروج به منوی اصلی
        </Button>
      </div>
    </div>
  )
}

/* ================= exit screen ================= */

function ExitScreen({ onBack }: { onBack: () => void }) {
  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black px-4" dir="rtl">
      <PixelSwordIcon size={54} />
      <h2 className="mt-8 text-2xl font-black text-white/85">آتش خاموش شد.</h2>
      <p className="mt-3 max-w-sm text-center text-sm leading-6 text-white/45">
        «مردن تنها پایان راه نیست.»
        <br />
        تا زمان بازگشتت، سول‌ها در تاریکی منتظر می‌مانند...
      </p>
      <button
        onClick={onBack}
        className="mt-10 border-2 border-white/25 bg-white/5 px-8 py-2.5 text-sm font-bold text-white/80 hover:bg-white/15"
      >
        روشن کردن دوباره‌ی آتش
      </button>
    </div>
  )
}

/* ================= misc overlays ================= */

function YouDied() {
  return (
    <div className="pointer-events-none absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/75" dir="ltr">
      <h2 className="youdied-anim font-pixel text-4xl tracking-[0.25em] text-red-700 sm:text-6xl" style={{ textShadow: '0 0 30px rgba(160,0,0,0.8)' }}>
        YOU DIED
      </h2>
      <p className="youdied-anim mt-6 text-sm text-white/60" dir="rtl">
        سول‌هایت در همان‌جا باقی ماند... برو و آن‌ها را بازیابی کن
      </p>
    </div>
  )
}

function BossFell({
  title,
  sub,
  sub2,
  accent,
}: {
  title: string
  sub: string
  sub2: string
  accent: string
}) {
  return (
    <div className="pointer-events-none absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/45" dir="rtl">
      <h2 className="fadein-anim text-3xl font-black tracking-wide sm:text-5xl" style={{ color: accent, textShadow: `0 0 34px ${accent}99` }}>
        {title}
      </h2>
      <p className="fadein-anim mt-4 text-sm text-white/70">{sub}</p>
      <p className="fadein-anim mt-1 text-xs" style={{ color: `${accent}cc` }}>{sub2}</p>
    </div>
  )
}

function RestModal({
  hud,
  onLevel,
  onLeave,
}: {
  hud: HudState
  onLevel: (s: 'vit' | 'end' | 'str') => void
  onLeave: () => void
}) {
  const stats = [
    { key: 'vit' as const, name: 'جان', value: hud.vit, effect: '+۱۶ سلامتی' },
    { key: 'end' as const, name: 'استقامت', value: hud.end, effect: '+۹ استقامت' },
    { key: 'str' as const, name: 'قدرت', value: hud.str, effect: '+۸٪ آسیب' },
  ]
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/70 px-4" dir="rtl">
      <div className="fadein-anim w-[min(94vw,430px)] rounded-none border-2 border-black bg-zinc-950/95 shadow-[6px_6px_0_rgba(0,0,0,0.6)]">
        <div className="flex items-center gap-2 border-b border-white/10 px-5 py-4">
          <span className="text-2xl">🔥</span>
          <div>
            <h3 className="text-lg font-black text-amber-200">آتش کمپ</h3>
            <p className="text-xs text-white/55">جان و شربت بازیابی شد — دشمنان دوباره برخاسته‌اند</p>
          </div>
        </div>

        <div className="px-5 py-4">
          <div className="mb-3 flex items-center justify-between text-sm">
            <span className="text-white/70">سول‌ها</span>
            <span className="flex items-center gap-1.5 font-bold text-emerald-300">
              <EmeraldIcon size={16} /> {hud.souls.toLocaleString('en-US')}
            </span>
          </div>
          <div className="space-y-2">
            {stats.map((s) => {
              const affordable = hud.souls >= hud.nextCost
              return (
                <div key={s.key} className="flex items-center justify-between rounded-none border border-white/10 bg-white/5 px-3 py-2">
                  <div>
                    <div className="text-sm font-bold text-white">{s.name}</div>
                    <div className="text-[11px] text-white/45">{s.effect}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-pixel text-[11px] text-white/80">{s.value}</span>
                    <Button
                      size="sm"
                      disabled={!affordable}
                      onClick={() => onLevel(s.key)}
                      className="h-8 w-9 rounded-none border border-black/60 bg-emerald-800 font-pixel text-xs hover:bg-emerald-700 disabled:opacity-30"
                    >
                      +
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
          <div className="mt-3 text-center text-[11px] text-white/45">
            هزینه هر سطح: <span className="text-emerald-300">{hud.nextCost}</span> سول — سطح فعلی:{' '}
            <span className="font-pixel text-[10px] text-white/80">{hud.level}</span>
          </div>
        </div>

        <div className="border-t border-white/10 px-5 py-4">
          <Button onClick={onLeave} className="h-10 w-full rounded-none border-2 border-black/70 bg-amber-700 font-bold text-white shadow-[3px_3px_0_rgba(0,0,0,0.55)] hover:bg-amber-600">
            برخیزید
          </Button>
        </div>
      </div>
    </div>
  )
}

/* ================= touch controls ================= */

function TouchControls({
  onMove,
  onLook,
  onPress,
  onHold,
  onPause,
}: {
  onMove: (x: number, y: number) => void
  onLook: (dx: number, dy: number) => void
  onPress: (name: string) => void
  onHold: (name: string, down: boolean) => void
  onPause: () => void
}) {
  const stickRef = useRef<HTMLDivElement>(null)
  const knobRef = useRef<HTMLDivElement>(null)
  const stickId = useRef<number | null>(null)
  const lookId = useRef<number | null>(null)
  const lookLast = useRef<{ x: number; y: number } | null>(null)
  const [blockDown, setBlockDown] = useState(false)

  const handleStick = useCallback(
    (e: React.TouchEvent) => {
      const stick = stickRef.current
      if (!stick) return
      const rect = stick.getBoundingClientRect()
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height / 2
      let dx = 0, dy = 0
      for (const t of Array.from(e.touches)) {
        if (t.identifier === stickId.current) {
          dx = t.clientX - cx
          dy = t.clientY - cy
        }
      }
      const max = rect.width / 2
      const len = Math.hypot(dx, dy)
      const clamped = Math.min(1, len / max)
      const nx = len > 0 ? (dx / len) * clamped : 0
      const ny = len > 0 ? (dy / len) * clamped : 0
      onMove(nx, -ny)
      if (knobRef.current) {
        knobRef.current.style.transform = `translate(${nx * max * 0.7}px, ${ny * max * 0.7}px)`
      }
    },
    [onMove]
  )

  const endStick = useCallback(() => {
    stickId.current = null
    onMove(0, 0)
    if (knobRef.current) knobRef.current.style.transform = 'translate(0px, 0px)'
  }, [onMove])

  return (
    <div className="absolute inset-0 z-20 select-none" style={{ touchAction: 'none' }}>
      {/* look layer */}
      <div
        className="absolute inset-0"
        onTouchStart={(e) => {
          if (lookId.current === null) {
            const t = e.changedTouches[0]
            lookId.current = t.identifier
            lookLast.current = { x: t.clientX, y: t.clientY }
          }
        }}
        onTouchMove={(e) => {
          for (const t of Array.from(e.changedTouches)) {
            if (t.identifier === lookId.current && lookLast.current) {
              onLook(t.clientX - lookLast.current.x, t.clientY - lookLast.current.y)
              lookLast.current = { x: t.clientX, y: t.clientY }
            }
          }
        }}
        onTouchEnd={() => {
          lookId.current = null
          lookLast.current = null
        }}
      />

      {/* pause button */}
      <button
        className="absolute left-3 top-3 z-20 flex h-11 w-11 items-center justify-center rounded-none border-2 border-white/30 bg-black/55 text-lg text-white/85 active:bg-white/20"
        onTouchStart={(e) => {
          e.stopPropagation()
          onPause()
        }}
        aria-label="توقف بازی"
      >
        ⏸
      </button>

      {/* joystick */}
      <div
        ref={stickRef}
        className="absolute bottom-16 left-5 h-32 w-32 rounded-full border-2 border-white/25 bg-black/35"
        onTouchStart={(e) => {
          e.stopPropagation()
          if (stickId.current === null) {
            stickId.current = e.changedTouches[0].identifier
            handleStick(e)
          }
        }}
        onTouchMove={(e) => {
          e.stopPropagation()
          handleStick(e)
        }}
        onTouchEnd={(e) => {
          e.stopPropagation()
          endStick()
        }}
      >
        <div ref={knobRef} className="absolute left-1/2 top-1/2 h-14 w-14 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/40 bg-white/20" />
      </div>

      {/* action buttons */}
      <div className="absolute bottom-16 right-5 grid grid-cols-3 gap-2">
        {(
          [
            ['E', '🍎', 'شربت'],
            ['Block', '🛡️', 'دفاع'],
            ['LMB', '⚔️', 'حمله'],
            ['HEAVY', '💥', 'سنگین'],
            ['Cast', '☄️', 'جادو'],
            ['KeyQ', '🎯', 'قفل'],
            ['Space', '💨', 'غلتک'],
            ['KeyF', '🔥', 'تعامل'],
          ] as const
        ).map(([code, icon, label]) => {
          if (code === 'Block') {
            return (
              <button
                key={code}
                className={`h-14 w-14 rounded-full border-2 text-xl active:scale-95 ${
                  blockDown
                    ? 'border-emerald-300 bg-emerald-700/70 scale-95'
                    : 'border-white/30 bg-black/50'
                }`}
                onTouchStart={(e) => {
                  e.stopPropagation()
                  setBlockDown(true)
                  onHold('Block', true)
                }}
                onTouchEnd={(e) => {
                  e.stopPropagation()
                  setBlockDown(false)
                  onHold('Block', false)
                }}
                onTouchCancel={() => {
                  setBlockDown(false)
                  onHold('Block', false)
                }}
                aria-label={label}
              >
                {icon}
              </button>
            )
          }
          return (
            <button
              key={code}
              className="h-14 w-14 rounded-full border-2 border-white/30 bg-black/50 text-xl active:scale-95 active:bg-white/25"
              onTouchStart={(e) => {
                e.stopPropagation()
                onPress(code)
              }}
              aria-label={label}
            >
              {icon}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/* ================= main client ================= */

export default function GameClient() {
  const containerRef = useRef<HTMLDivElement>(null)
  const gameRef = useRef<Game | null>(null)
  const [hud, setHud] = useState<HudState | null>(null)
  const [isTouch, setIsTouch] = useState(false)
  const [hasSave, setHasSave] = useState(false)
  const [ready, setReady] = useState(false)
  const [menuPage, setMenuPage] = useState<MenuPage>('root')
  const [viewerOpen, setViewerOpen] = useState(false)
  const [settings, setSettings] = useState<GameSettings>({ sens: 1, volume: 0.8, invertY: false, shadows: true })

  useEffect(() => {
    const g = new Game(containerRef.current!)
    gameRef.current = g
    g.onState = (s) => setHud(s)
    setSettings({ ...g.settings })
    const raf = requestAnimationFrame(() => {
      setIsTouch(
        typeof window !== 'undefined' &&
          ('ontouchstart' in window ||
            (navigator.maxTouchPoints ?? 0) > 0 ||
            /Android|iPhone|iPad|Mobi/i.test(navigator.userAgent))
      )
      setHasSave(g.hasSave())
      setReady(true)
    })
    return () => {
      cancelAnimationFrame(raf)
      g.dispose()
      gameRef.current = null
    }
  }, [])

  const phase = hud?.phase ?? 'menu'

  const start = useCallback(() => {
    gameRef.current?.startGame()
  }, [])

  const clearSave = useCallback(() => {
    gameRef.current?.clearSave()
    setHasSave(false)
  }, [])

  const openViewer = useCallback(() => {
    const g = gameRef.current
    if (g) g.frozen = true
    setViewerOpen(true)
  }, [])

  const closeViewer = useCallback(() => {
    const g = gameRef.current
    if (g) g.frozen = false
    setViewerOpen(false)
  }, [])

  const applySettings = useCallback((patch: Partial<GameSettings>) => {
    const g = gameRef.current
    if (g) {
      g.applySettings(patch)
      setSettings({ ...g.settings })
    }
  }, [])

  const exitGame = useCallback(() => {
    // a browser tab can only be closed by script in rare cases — fall back
    // to the farewell screen which offers a fresh reload
    try {
      window.close()
    } catch { /* ignore */ }
    setMenuPage('exit')
  }, [])

  if (menuPage === 'exit') {
    return (
      <div className="fixed inset-0 overflow-hidden bg-black no-select">
        <ExitScreen onBack={() => window.location.reload()} />
      </div>
    )
  }

  return (
    <div className="fixed inset-0 overflow-hidden bg-black no-select">
      <div ref={containerRef} className="absolute inset-0" />

      {ready && hud && (hud.phase === 'playing' || hud.phase === 'paused') && <Hud hud={hud} />}
      {ready && hud && hud.phase === 'playing' && isTouch && (
        <TouchControls
          onMove={(x, y) => gameRef.current?.setTouchMove(x, y)}
          onLook={(dx, dy) => gameRef.current?.touchLook(dx, dy)}
          onPress={(n) => gameRef.current?.touchPress(n)}
          onHold={(n, d) => gameRef.current?.touchHold(n, d)}
          onPause={() => gameRef.current?.pause()}
        />
      )}

      {phase === 'menu' && (
        <MainMenu
          onStart={start}
          hasSave={hasSave}
          onClear={clearSave}
          onViewer={openViewer}
          onSettings={() => setMenuPage('settings')}
          onExit={exitGame}
        />
      )}
      {phase === 'menu' && menuPage === 'settings' && (
        <SettingsModal settings={settings} onChange={applySettings} onClose={() => setMenuPage('root')} />
      )}
      {phase === 'paused' && (
        <PauseMenu
          onResume={() => gameRef.current?.resume()}
          onSettings={() => setMenuPage('settings')}
          onExitToMenu={() => {
            setMenuPage('root')
            gameRef.current?.exitToMenu()
          }}
        />
      )}
      {phase === 'paused' && menuPage === 'settings' && (
        <SettingsModal
          settings={settings}
          onChange={applySettings}
          onClose={() => setMenuPage('root')}
        />
      )}
      {viewerOpen && <ModelViewer onClose={closeViewer} />}
      {phase === 'dead' && <YouDied />}
      {hud?.banner === 'bossfell' && phase === 'playing' && (
        <BossFell
          title="دشمن بزرگ نابود شد!"
          sub="۳۰۰۰ سول به دست آمد"
          sub2="تکه‌ای استوس کنار جسدش بر زمین افتاده است..."
          accent="#ffc44d"
        />
      )}
      {hud?.banner === 'bossfell2' && phase === 'playing' && (
        <BossFell
          title="پادشاه شعله نابود شد!"
          sub="۴۵۰۰ سول به دست آمد"
          sub2="اخگری بزرگ کنار خاکسترش بر زمین افتاده است..."
          accent="#ff8a3a"
        />
      )}
      {phase === 'rest' && hud && (
        <RestModal
          hud={hud}
          onLevel={(s) => gameRef.current?.levelUp(s)}
          onLeave={() => gameRef.current?.leaveRest()}
        />
      )}
      {!isTouch && phase === 'playing' && <HintBar />}
    </div>
  )
}
