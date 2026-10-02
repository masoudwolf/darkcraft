'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Game, SHOP_ITEMS, type HudState, type GameSettings, type InvHud, type InvItemView, type LoreHud } from '@/lib/game/game'
import { PROLOGUE } from '@/lib/game/lore'
import ModelViewer from '@/components/game/ModelViewer'
import MapViewer from '@/components/game/MapViewer'

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

      {/* arrows chip — visible when a bow is equipped (or arrows held) */}
      {(hud.bowEquipped || hud.arrows > 0) && (
        <div
          className={`absolute right-4 bottom-20 flex items-center gap-1.5 border bg-black/60 px-2.5 py-1 ${hud.arrows > 0 ? 'border-black/80' : 'border-red-900/80'}`}
          dir="rtl"
        >
          <span aria-hidden>🏹</span>
          <span className={`font-pixel text-xs ${hud.arrows > 0 ? 'text-amber-200' : 'text-red-400'}`} dir="ltr">×{hud.arrows}</span>
        </div>
      )}

      {/* bow crosshair — pixel reticle + draw-power bar, only while aiming */}
      {hud.aiming && (
        <div className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
          <div className="relative h-10 w-10" aria-hidden>
            <span className="absolute left-1/2 top-1/2 h-[6px] w-[6px] -translate-x-1/2 -translate-y-1/2 bg-white/90 shadow-[0_0_3px_rgba(0,0,0,0.9)]" />
            <span className="absolute left-1/2 top-0 h-[10px] w-[2px] -translate-x-1/2 bg-white/70" />
            <span className="absolute bottom-0 left-1/2 h-[10px] w-[2px] -translate-x-1/2 bg-white/70" />
            <span className="absolute left-0 top-1/2 h-[2px] w-[10px] -translate-y-1/2 bg-white/70" />
            <span className="absolute right-0 top-1/2 h-[2px] w-[10px] -translate-y-1/2 bg-white/70" />
          </div>
          {/* draw power — fills as the string pulls home; green when shot-ready */}
          <div className="mt-1 h-[5px] w-14 -translate-x-0 border border-black/80 bg-black/60 p-[1px]">
            <div
              className={`h-full transition-[width] duration-75 ${hud.draw >= 0.35 ? 'bg-gradient-to-b from-[#8ae06a] to-[#3f8a24]' : 'bg-gradient-to-b from-[#d9c26a] to-[#8a6a1c]'}`}
              style={{ width: `${Math.round(hud.draw * 100)}%` }}
            />
          </div>
          {hud.arrows <= 0 && (
            <div className="mt-1 text-center font-pixel text-[9px] text-red-400">بدون تیر</div>
          )}
        </div>
      )}

      {/* item pickup / switch toast — the DS "Item Attained" moment */}
      {hud.toast && (
        <div key={hud.toast} className="toast-anim absolute left-1/2 top-16 -translate-x-1/2 border-2 border-black bg-black/85 px-5 py-2.5 text-center shadow-[4px_4px_0_rgba(0,0,0,0.5)]" dir="rtl">
          <span className="text-sm font-bold text-amber-200">{hud.toast}</span>
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
    ['I', 'کوله‌پشتی'],
    ['1/2', 'سلاح / کمان'],
    ['RMB+LMB', 'کمان: نشانه و شلیک'],
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

/* ================= shop modal (the grey merchant) ================= */

function ShopModal({
  hud,
  onBuy,
  onSell,
  onClose,
}: {
  hud: HudState
  onBuy: (id: 'estus' | 'whet' | 'coal') => void
  onSell: (id: string) => void
  onClose: () => void
}) {
  const shop = hud.shop
  if (!shop) return null
  const levels: Record<string, number> = {
    estus: shop.estusLv,
    whet: shop.whetLv,
    coal: shop.coalLv,
  }
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/70 px-4" dir="rtl">
      <div className="fadein-anim flex max-h-[94vh] w-[min(94vw,540px)] flex-col overflow-hidden rounded-none border-2 border-black bg-zinc-950/95 shadow-[6px_6px_0_rgba(0,0,0,0.6)]">
        <div className="flex items-center gap-2 border-b border-white/10 px-5 py-4">
          <span className="text-2xl" aria-hidden>🧺</span>
          <div>
            <h3 className="text-lg font-black text-emerald-200">بازرگان خاکستری</h3>
            <p className="text-xs text-white/55">«{shop.line}»</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="mb-3 flex items-center justify-between text-sm">
            <span className="text-white/70">سول‌های تو</span>
            <span className="flex items-center gap-1.5 font-bold text-emerald-300">
              <EmeraldIcon size={16} /> {shop.souls.toLocaleString('en-US')}
            </span>
          </div>
          <div className="space-y-2">
            {SHOP_ITEMS.map((item) => {
              const lv = levels[item.id] ?? 0
              const maxed = lv >= item.max
              const locked = item.id === 'coal' && !shop.pyroUnlocked
              const price = item.price(lv)
              const affordable = shop.souls >= price && !locked && !maxed
              return (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-none border border-white/10 bg-white/5 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sm font-bold text-white">
                      <span aria-hidden>{item.icon}</span>
                      {item.name}
                      <span className="font-pixel text-[9px] text-white/40" dir="ltr">
                        {lv}/{item.max}
                      </span>
                    </div>
                    <div className="mt-0.5 text-[11px] text-white/45">
                      {locked ? 'پیرمانسی هنوز نیاموخته‌ای...' : item.desc}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    {maxed ? (
                      <span className="text-[11px] font-bold text-amber-300">تمام شد</span>
                    ) : (
                      <span className={`flex items-center gap-1 text-xs font-bold ${affordable ? 'text-emerald-300' : 'text-white/35'}`}>
                        <EmeraldIcon size={13} /> {price}
                      </span>
                    )}
                    <Button
                      size="sm"
                      disabled={!affordable}
                      onClick={() => onBuy(item.id)}
                      className="h-8 rounded-none border border-black/60 bg-emerald-800 px-3 font-pixel text-xs hover:bg-emerald-700 disabled:opacity-30"
                    >
                      خرید
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
          <p className="mt-3 text-center text-[11px] leading-4 text-white/40">
            خریدها همیشگی‌اند و ذخیره می‌شوند — فروشنده جایی نمی‌رود؛ مثل تو، به آتش کمپ پابند است.
          </p>

          {/* ---- selling loot — the merchant buys at his lowball rates ---- */}
          <div className="mt-4 border-t border-white/10 pt-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-bold text-white/75">فروش غنایم</span>
              <span className="text-[10px] text-white/40">با هر کلیک یک عدد فروخته می‌شود</span>
            </div>
            {shop.sellables.length === 0 ? (
              <div className="border border-dashed border-white/15 px-3 py-4 text-center text-xs text-white/35">
                کوله‌ات خالی است — چیزی برای فروش نداری
              </div>
            ) : (
              <div className="max-h-44 space-y-1.5 overflow-y-auto pl-1">
                {shop.sellables.map((s) => (
                  <div key={s.id} className="flex items-center gap-2 border border-white/10 bg-white/5 px-2.5 py-1.5">
                    <span aria-hidden>{s.icon}</span>
                    <span className={`truncate text-xs font-bold ${TIER_STYLE[s.tier]}`}>{s.name}</span>
                    {s.n > 1 && <span className="font-pixel text-[9px] text-white/50">×{s.n}</span>}
                    {s.equipped && <span className="font-pixel text-[8px] text-amber-300/80">تجهیز شده</span>}
                    <Button
                      size="sm"
                      onClick={() => onSell(s.id)}
                      className="mr-auto h-7 shrink-0 rounded-none border border-black/60 bg-emerald-900/70 px-2 font-pixel text-[10px] text-emerald-200 hover:bg-emerald-800"
                    >
                      +{s.sell} سول
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-white/10 px-5 py-4">
          <Button onClick={onClose} className="h-10 w-full rounded-none border-2 border-black/70 bg-zinc-800 font-bold text-white shadow-[3px_3px_0_rgba(0,0,0,0.55)] hover:bg-zinc-700">
            بستن دکّه (Esc)
          </Button>
        </div>
      </div>
    </div>
  )
}

/* ================= inventory & equipment (Dark-Souls style) ================= */

const TIER_STYLE: Record<string, string> = {
  common: 'text-white/75',
  rare: 'text-emerald-300',
  boss: 'text-amber-300',
}

function ItemStatLine({ it }: { it: InvItemView }) {
  const bits: string[] = []
  if (it.dmg) bits.push(`آسیب ${it.dmg}`)
  if (it.spd && it.spd !== 1) bits.push(`سرعت ${Math.round(it.spd * 100)}٪`)
  if (it.block) bits.push(`دفاع سپر ${Math.round(it.block * 100)}٪`)
  if (it.cat === 'bow' && !it.ammo) bits.push(`آسیب تیر ${it.bowDmg ?? 0}`)
  if (it.ammo && it.bowDmg) bits.push(`آسیب +${it.bowDmg}`)
  if (it.def) bits.push(`جسم‌ساز +${Math.round(it.def * 100)}٪`)
  if (it.fire) bits.push(`آتش‌بند +${Math.round(it.fire * 100)}٪`)
  if (it.blast) bits.push(`انفجارگریز +${Math.round(it.blast * 100)}٪`)
  bits.push(`وزن ${it.weight}`)
  return <span className="text-[10px] text-white/45" dir="rtl">{bits.join(' · ')}</span>
}

function InventoryModal({
  inv,
  onEquip,
  onUnequip,
  onDrop,
  onSell,
  onClose,
}: {
  inv: InvHud
  onEquip: (id: string) => void
  onUnequip: (slot: string) => void
  onDrop: (id: string) => void
  onSell: (id: string) => void
  onClose: () => void
}) {
  const [sel, setSel] = useState<InvItemView | null>(null)
  const loadPct = Math.min(120, (inv.load / inv.maxLoad) * 100)
  const handSlots = inv.slots.filter((s) => s.slot.startsWith('rh') || s.slot.startsWith('lh'))
  const armorSlots = inv.slots.filter((s) => !s.slot.startsWith('rh') && !s.slot.startsWith('lh'))

  const SlotCell = ({ slot, label, item, active }: { slot: string; label: string; item: InvItemView | null; active?: boolean }) => (
    <button
      onClick={() => (item ? onUnequip(slot) : undefined)}
      title={item ? 'برداشتن' : 'خالی'}
      className={`flex items-center gap-2 border px-2.5 py-2 text-right transition-colors ${
        active
          ? 'border-amber-400/80 bg-amber-950/40'
          : item
            ? 'border-white/20 bg-white/5 hover:bg-white/10'
            : 'border-dashed border-white/15 bg-transparent'
      }`}
    >
      <span className="w-6 text-center text-lg" aria-hidden>{item?.icon ?? '·'}</span>
      <span className="min-w-0 flex-1">
        <span className={`block truncate text-xs font-bold ${item ? TIER_STYLE[item.tier] : 'text-white/30'}`}>
          {item?.name ?? '— خالی —'}
        </span>
        <span className="block text-[9px] text-white/40">
          {label}{item ? ` · ${item.weight}` : ''}
        </span>
      </span>
    </button>
  )

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/75 px-3 py-6" dir="rtl">
      <div className="fadein-anim flex max-h-[94vh] w-[min(96vw,880px)] flex-col overflow-hidden rounded-none border-2 border-black bg-zinc-950/95 shadow-[6px_6px_0_rgba(0,0,0,0.6)]">
        {/* header */}
        <div className="flex items-center gap-2 border-b border-white/10 px-5 py-3.5">
          <span className="text-2xl" aria-hidden>🎒</span>
          <div>
            <h3 className="text-lg font-black text-white">تجهیزات و کوله‌پشتی</h3>
            <p className="text-[11px] text-white/50">روی آیتم بزن تا تجهیزش کنی — 💰 فروش به بازرگان (نزدیک او) · ⬇ انداختن روی زمین</p>
          </div>
          <span className="mr-auto flex items-center gap-1.5 text-sm font-bold text-emerald-300">
            <EmeraldIcon size={16} /> {inv.souls.toLocaleString('en-US')}
          </span>
        </div>

        <div className="grid flex-1 overflow-y-auto md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
          {/* ---- right: slots + load ---- */}
          <div className="border-b border-white/10 p-4 md:border-b-0 md:border-l">
            <div className="mb-2 text-xs font-bold text-white/70">دست‌ها</div>
            <div className="grid grid-cols-2 gap-2">
              {handSlots.map((s) => (
                <SlotCell
                  key={s.slot}
                  slot={s.slot}
                  label={s.label}
                  item={s.item}
                  active={(s.slot === 'rh1' && inv.rhActive === 1) || (s.slot === 'rh2' && inv.rhActive === 2) ||
                    (s.slot === 'lh1' && inv.lhActive === 1) || (s.slot === 'lh2' && inv.lhActive === 2)}
                />
              ))}
            </div>
            <div className="mb-2 mt-4 text-xs font-bold text-white/70">زره — سر، سینه، دست، پا، شنل</div>
            <div className="grid grid-cols-2 gap-2">
              {armorSlots.map((s) => (
                <SlotCell key={s.slot} slot={s.slot} label={s.label} item={s.item} />
              ))}
            </div>

            {/* equip burden — DS thresholds */}
            <div className="mt-5">
              <div className="mb-1.5 flex items-center justify-between text-xs">
                <span className="font-bold text-white/75">بارِ تجهیزات</span>
                <span className="font-pixel text-[10px]" style={{ color: inv.tierColor }} dir="ltr">
                  {inv.load} / {inv.maxLoad}
                </span>
              </div>
              <div className="relative h-4 border-2 border-black/80 bg-black/60 p-[2px]">
                <div
                  className="h-full transition-[width] duration-300"
                  style={{ width: `${Math.min(100, loadPct)}%`, background: `linear-gradient(180deg, ${inv.tierColor}cc, ${inv.tierColor}55)` }}
                />
                {/* DS breakpoints 25 / 50 / 100 */}
                {[25, 50, 100].map((m) => (
                  <span
                    key={m}
                    className="absolute top-0 h-full w-px bg-white/45"
                    style={{ left: `${m / 1.2}%` }}
                    aria-hidden
                  />
                ))}
              </div>
              <div className="mt-1 text-[10px]" style={{ color: inv.tierColor }}>{inv.tierLabel}</div>
              <div className="mt-2 flex gap-3 text-[10px] text-white/55">
                <span>جسم‌ساز <b className="text-emerald-300">{inv.def}٪</b></span>
                <span>آتش‌بند <b className="text-orange-300">{inv.fire}٪</b></span>
                <span>انفجارگریز <b className="text-amber-300">{inv.blast}٪</b></span>
              </div>
            </div>
          </div>

          {/* ---- left: the bag ---- */}
          <div className="flex flex-col p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-bold text-white/70">کوله‌پشتی</span>
              <span className="text-[10px] text-white/40">{inv.bag.length} قلم</span>
            </div>
            <div className="max-h-72 space-y-1.5 overflow-y-auto pr-1 md:max-h-[52vh]">
              {inv.bag.length === 0 && (
                <div className="border border-dashed border-white/15 px-3 py-6 text-center text-xs text-white/35">
                  کوله‌ات خالی است — دشمنان گاهی زره و سلاحشان را جا می‌گذارند
                </div>
              )}
              {inv.bag.map((it) => (
                <div
                  key={it.id}
                  onMouseEnter={() => setSel(it)}
                  className={`w-full border px-3 py-2 transition-colors ${
                    it.equipped
                      ? 'border-amber-400/60 bg-amber-950/30'
                      : 'border-white/12 bg-white/5 hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => (it.ammo ? setSel(it) : onEquip(it.id))}
                      title={it.ammo ? 'مهمات — هنگام شلیک خودکار مصرف می‌شود' : 'تجهیز کردن'}
                      className="flex min-w-0 flex-1 items-center gap-2 text-right"
                    >
                      <span className="text-lg" aria-hidden>{it.icon}</span>
                      <span className={`truncate text-xs font-bold ${TIER_STYLE[it.tier]}`}>{it.name}</span>
                      {it.n > 1 && <span className="font-pixel text-[9px] text-white/60">×{it.n}</span>}
                      {it.ammo && <span className="rounded-sm border border-sky-700/60 bg-sky-950/50 px-1 py-px font-pixel text-[8px] text-sky-300">مهمات</span>}
                      {it.equipped && <span className="mr-auto font-pixel text-[9px] text-amber-300/90">تجهیز شده</span>}
                    </button>
                    <button
                      onClick={() => onSell(it.id)}
                      disabled={!inv.nearMerchant}
                      title={inv.nearMerchant ? `فروش به بازرگان — +${it.sell} سول` : 'برای فروش باید کنار بازرگان بایستی'}
                      className="h-7 shrink-0 rounded-none border border-black/60 bg-emerald-900/70 px-2 font-pixel text-[10px] text-emerald-200 hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      💰{it.sell}
                    </button>
                    <button
                      onClick={() => onDrop(it.id)}
                      title="انداختن روی زمین — ۲۰ ثانیه بعد نابود می‌شود"
                      className="h-7 shrink-0 rounded-none border border-black/60 bg-zinc-800 px-2 font-pixel text-[10px] text-white/80 hover:bg-zinc-700"
                    >
                      ⬇
                    </button>
                  </div>
                  <div className="mt-0.5 pr-7"><ItemStatLine it={it} /></div>
                </div>
              ))}
            </div>
            {/* description of the hovered item */}
            <div className="mt-3 min-h-[52px] border border-white/10 bg-black/40 px-3 py-2">
              {sel ? (
                <>
                  <div className={`text-xs font-bold ${TIER_STYLE[sel.tier]}`}>{sel.icon} {sel.name}</div>
                  <p className="mt-0.5 text-[10px] leading-4 text-white/55">{sel.desc}</p>
                </>
              ) : (
                <p className="text-[10px] text-white/35">نشانه‌گذر روی آیتم‌ها توضیحشان را نشان می‌دهد — 💰 فروش فقط کنار بازرگان · ⬇ آیتم انداخته‌شده بعد از ۲۰ ثانیه نابود می‌شود (غنایم دشمنان همیشه می‌مانند)</p>
              )}
            </div>
          </div>
        </div>

        <div className="border-t border-white/10 px-5 py-3.5">
          <Button onClick={onClose} className="h-10 w-full rounded-none border-2 border-black/70 bg-zinc-800 font-bold text-white shadow-[3px_3px_0_rgba(0,0,0,0.55)] hover:bg-zinc-700">
            بستن کوله (Esc / I)
          </Button>
        </div>
      </div>
    </div>
  )
}

/* ================= the story — prologue & lore stones ================= */

/** the opening scroll — shown once at the birth of a new unkindled,
    re-readable from the menu; every page advances on click */
function PrologueModal({
  page,
  onNext,
  onClose,
  closable,
}: {
  page: number
  onNext: () => void
  onClose: () => void
  closable: boolean
}) {
  const pg = PROLOGUE[Math.min(page, PROLOGUE.length - 1)]
  const last = page >= PROLOGUE.length - 1
  return (
    <div
      className="absolute inset-0 z-40 flex items-center justify-center bg-black px-4"
      dir="rtl"
      onClick={onNext}
      role="presentation"
    >
      <div className="fadein-anim w-[min(94vw,620px)] cursor-pointer select-none py-8 text-center">
        <p className="font-pixel text-[11px] tracking-[0.35em] text-emerald-700" dir="ltr">
          {closable ? 'MEMORY' : 'PROLOGUE'} — {page + 1}/{PROLOGUE.length}
        </p>
        <h2 className="mt-5 font-pixel text-2xl text-emerald-400 drop-shadow-[2px_2px_0_rgba(0,0,0,1)] sm:text-3xl">
          {pg.title}
        </h2>
        <div className="mx-auto mt-6 max-w-lg space-y-4">
          {pg.lines.map((ln, i) => (
            <p key={i} className="text-sm leading-8 text-white/80 sm:text-base">
              {ln}
            </p>
          ))}
        </div>
        <div className="mt-8 flex items-center justify-center gap-2">
          {PROLOGUE.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 w-1.5 rounded-full ${i === page ? 'bg-emerald-400' : 'bg-white/25'}`}
            />
          ))}
        </div>
        <div className="mt-7 flex justify-center gap-3" onClick={(e) => e.stopPropagation()}>
          <Button
            size="lg"
            onClick={onNext}
            className={`h-11 border-2 border-black/80 font-bold text-white shadow-[4px_4px_0_rgba(0,0,0,0.6)] ${
              last ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-zinc-800 hover:bg-zinc-700'
            }`}
          >
            {last ? '🔥 افروز کن' : 'ادامه'}
          </Button>
          {closable && (
            <Button
              size="lg"
              onClick={onClose}
              className="h-11 border-2 border-black/80 bg-zinc-900 font-bold text-white/70 shadow-[4px_4px_0_rgba(0,0,0,0.6)] hover:bg-zinc-800"
            >
              بازگشت
            </Button>
          )}
        </div>
        {!closable && !last && (
          <p className="mt-5 text-[11px] text-white/35">برای رفتن به صفحه‌ی بعد، هر جا کلیک کن</p>
        )}
      </div>
    </div>
  )
}

/** reading a memorial stone — the Vale's memory, dark-souls style */
function LoreModal({ lore, onClose }: { lore: LoreHud; onClose: () => void }) {
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/80 px-4" dir="rtl">
      <div className="fadein-anim flex max-h-[92vh] w-[min(94vw,560px)] flex-col overflow-hidden border-2 border-black bg-zinc-950/97 shadow-[6px_6px_0_rgba(0,0,0,0.65)] outline outline-1 outline-emerald-900/60">
        <div className="border-b border-emerald-900/40 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl" aria-hidden>🗿</span>
            <div>
              <p className="font-pixel text-[10px] tracking-[0.3em] text-emerald-700" dir="ltr">MEMORY STONE</p>
              <h3 className="text-lg font-black text-emerald-200">سنگ‌یاد — {lore.title}</h3>
            </div>
          </div>
          {lore.first && (
            <p className="mt-2 inline-block rounded border border-emerald-800/60 bg-emerald-950/60 px-2 py-1 text-[11px] text-emerald-300">
              ✦ خاطره‌ای تازه در حافظه‌ی خاکستر ثبت شد
            </p>
          )}
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          {lore.text.map((p, i) => (
            <p key={i} className="text-sm leading-8 text-white/85">
              {p}
            </p>
          ))}
        </div>
        <div className="border-t border-white/10 px-5 py-3.5">
          <Button
            onClick={onClose}
            className="h-10 w-full rounded-none border-2 border-black/70 bg-zinc-800 font-bold text-white shadow-[3px_3px_0_rgba(0,0,0,0.55)] hover:bg-zinc-700"
          >
            بستن سنگ‌یاد (Esc)
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
  onMapPreview,
  onSettings,
  onStory,
  loreCount,
  loreTotal,
  onExit,
}: {
  onStart: () => void
  hasSave: boolean
  onClear: () => void
  onViewer: () => void
  onMapPreview: () => void
  onSettings: () => void
  onStory: () => void
  loreCount: number
  loreTotal: number
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
        زغالِ نخستین رو به خاموشی است. سازندگان فراموش شدند؛ تو آخرین اخگری.
        <br />
        سنگ‌یادها را بخوان، بجنگ، بسوز، در آتش کمپ بیاسای و دوباره برخیز.
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
          onClick={onStory}
          className="h-11 w-full border-2 border-black/80 bg-[#3a2c14] font-bold text-amber-200 shadow-[4px_4px_0_rgba(0,0,0,0.6)] hover:bg-[#4a3a1c]"
        >
          📖 داستان و خاطرات
        </Button>
        <Button
          size="lg"
          onClick={onViewer}
          className="h-11 w-full border-2 border-black/80 bg-zinc-800 font-bold text-white shadow-[4px_4px_0_rgba(0,0,0,0.6)] hover:bg-zinc-700"
        >
          🔬 نمایشگر سه‌بعدی
        </Button>
        <Button
          size="lg"
          onClick={onMapPreview}
          className="h-11 w-full border-2 border-black/80 bg-[#1a2a1f] font-bold text-emerald-200 shadow-[4px_4px_0_rgba(0,0,0,0.6)] hover:bg-[#24382b]"
        >
          🗺️ نقشهٔ جهان — بازدید مناطق
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
      <p className="mt-3 text-xs text-white/55">
        خاطرات بازیابی‌شده: <b className="text-emerald-300">{loreCount}</b> از {loreTotal} سنگ‌یاد
      </p>
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
        <span><b className="font-pixel text-[10px] text-emerald-300">F</b> تعامل / سنگ‌یاد</span>
        <span><b className="font-pixel text-[10px] text-emerald-300">Esc</b> توقف / منو</span>
      </div>
      <p className="mt-6 max-w-lg text-center text-[11px] leading-5 text-white/35">
        نسخه ۰.۹ — داستان «زغالِ نخستین»: پرولوگ آغازین، ۷ سنگ‌یاد در درّه، لور آیتم‌ها و دیالوگ بازرگان
        <br />مناطق طراحی‌شده: آتش‌گاه، دهکده‌ی فراموشی، گورستان، بلندای تیراندازان، معبد شمالی
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

/** cinematic letterbox — the director is shooting; click/space skips */
function CinematicOverlay({
  title,
  sub,
  caption,
  onSkip,
}: {
  title: string | null
  sub: string | null
  caption: string | null
  onSkip: () => void
}) {
  return (
    <div
      className="absolute inset-0 z-40 cursor-pointer"
      onPointerDown={onSkip}
      role="button"
      aria-label="رد کردن سینماتیک"
    >
      <div className="cinebar-top pointer-events-none absolute inset-x-0 top-0 h-[11vh] bg-black" />
      <div className="cinebar-bot pointer-events-none absolute inset-x-0 bottom-0 h-[11vh] bg-black" />
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center" dir="rtl">
        {title && (
          <div className="cine-title-anim text-center">
            <h2
              className="font-pixel text-3xl font-black text-[#ffd54a] sm:text-5xl"
              style={{ textShadow: '0 0 40px rgba(255,180,60,0.5), 0 3px 14px rgba(0,0,0,0.9)' }}
            >
              {title}
            </h2>
            {sub && <p className="mt-3 text-sm text-white/60 sm:text-base">{sub}</p>}
          </div>
        )}
        {caption && (
          <p
            key={caption}
            className="cine-cap-anim absolute bottom-[13.5vh] mx-6 max-w-[85%] text-center text-sm text-white/90 sm:text-base"
            style={{ textShadow: '0 2px 10px rgba(0,0,0,0.95)' }}
          >
            {caption}
          </p>
        )}
      </div>
      <p className="pointer-events-none absolute bottom-[2.5vh] left-4 text-[11px] text-white/35" dir="rtl">
        کلیک / فاصله — رد شدن
      </p>
    </div>
  )
}

/** Dark-Souls-style location title card (region entry / champion intro) */
function TitleCard({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center" dir="rtl">
      <div className="cardrise-anim text-center">
        <h3
          className="font-pixel text-2xl font-black text-white/90 sm:text-4xl"
          style={{ textShadow: '0 0 30px rgba(0,0,0,0.95), 0 2px 12px rgba(0,0,0,0.9)' }}
        >
          {title}
        </h3>
        <div className="mx-auto mt-2 h-px w-28 bg-gradient-to-r from-transparent via-[#ffd54a99] to-transparent" />
        <p className="mt-2 text-xs text-[#ffd54a]/85 sm:text-sm">{sub}</p>
      </div>
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
            ['KeyI', '🎒', 'کوله'],
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
  const [mapPreviewOpen, setMapPreviewOpen] = useState(false)
  const [settings, setSettings] = useState<GameSettings>({ sens: 1, volume: 0.8, invertY: false, shadows: true })
  /** prologue: null = hidden; number = current page. fromMenu = re-reading from the title screen */
  const [prologuePage, setProloguePage] = useState<number | null>(null)
  const [prologueFromMenu, setPrologueFromMenu] = useState(false)

  useEffect(() => {
    const g = new Game(containerRef.current!)
    gameRef.current = g
    g.onState = (s) => setHud(s)
    // debug/QA hook — lets external test harnesses inspect live game state
    ;(window as unknown as { __minesouls?: Game }).__minesouls = g
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
    // a brand-new unkindled gets the opening scroll; a saved one walks straight in
    if (!hasSave) {
      setPrologueFromMenu(false)
      setProloguePage(0)
    } else {
      gameRef.current?.startGame()
    }
  }, [hasSave])

  const prologueNext = useCallback(() => {
    setProloguePage((p) => {
      if (p === null) return null
      if (p >= PROLOGUE.length - 1) {
        if (!prologueFromMenu) gameRef.current?.startGame()
        return null
      }
      return p + 1
    })
  }, [prologueFromMenu])

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

  const openMapPreview = useCallback(() => {
    const g = gameRef.current
    if (g) g.frozen = true
    setMapPreviewOpen(true)
  }, [])

  const closeMapPreview = useCallback(() => {
    const g = gameRef.current
    if (g) g.frozen = false
    setMapPreviewOpen(false)
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
          onMapPreview={openMapPreview}
          onSettings={() => setMenuPage('settings')}
          onStory={() => {
            setPrologueFromMenu(true)
            setProloguePage(0)
          }}
          loreCount={hud?.loreCount ?? 0}
          loreTotal={hud?.loreTotal ?? 7}
          onExit={exitGame}
        />
      )}
      {prologuePage !== null && (
        <PrologueModal
          page={prologuePage}
          onNext={prologueNext}
          onClose={() => setProloguePage(null)}
          closable={prologueFromMenu}
        />
      )}
      {phase === 'lore' && hud?.lore && (
        <LoreModal lore={hud.lore} onClose={() => gameRef.current?.closeLore()} />
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
      {mapPreviewOpen && <MapViewer onClose={closeMapPreview} />}
      {phase === 'dead' && <YouDied />}
      {hud?.cine && phase === 'playing' && (
        <CinematicOverlay
          title={hud.cine.title}
          sub={hud.cine.sub}
          caption={hud.cine.caption}
          onSkip={() => gameRef.current?.skipCinematic()}
        />
      )}
      {hud?.card && phase === 'playing' && !hud?.cine && (
        <TitleCard key={hud.card.key} title={hud.card.title} sub={hud.card.sub} />
      )}
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
      {phase === 'shop' && hud && (
        <ShopModal
          hud={hud}
          onBuy={(id) => gameRef.current?.buyShopItem(id)}
          onSell={(id) => gameRef.current?.sellItem(id)}
          onClose={() => gameRef.current?.closeShop()}
        />
      )}
      {phase === 'inventory' && hud?.inv && (
        <InventoryModal
          inv={hud.inv}
          onEquip={(id) => gameRef.current?.equipItem(id)}
          onUnequip={(slot) => gameRef.current?.unequipSlot(slot as never)}
          onDrop={(id) => gameRef.current?.dropItem(id)}
          onSell={(id) => gameRef.current?.sellItem(id)}
          onClose={() => gameRef.current?.closeInventory()}
        />
      )}
      {!isTouch && phase === 'playing' && <HintBar />}
    </div>
  )
}
