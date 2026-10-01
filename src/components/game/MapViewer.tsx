'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import * as THREE from 'three'
import { WorldV2, REGIONS_V2 } from '@/lib/game/worldV2'

/* ============================================================
   MAP VIEWER V2 — the inspection deck for the new map.
   Drag = orbit · wheel/pinch = zoom · region chips = fly-to.
   The whole world is built here standalone: the game itself
   is untouched until the design is approved.
   ============================================================ */

interface Props {
  onClose: () => void
}

interface CamState {
  theta: number
  phi: number
  dist: number
  focus: THREE.Vector3
}
interface FlyTarget {
  fromTheta: number
  toTheta: number
  fromPhi: number
  toPhi: number
  fromDist: number
  toDist: number
  fromFocus: THREE.Vector3
  toFocus: THREE.Vector3
  t: number
}

export default function MapViewer({ onClose }: Props) {
  const mountRef = useRef<HTMLDivElement>(null)
  const [regionIdx, setRegionIdx] = useState(0)
  const [autoRotate, setAutoRotate] = useState(false)
  const [showLabels, setShowLabels] = useState(true)

  const world = useRef<{
    renderer: THREE.WebGLRenderer
    scene: THREE.Scene
    camera: THREE.PerspectiveCamera
    w2: WorldV2
    disposables: (() => void)[]
  } | null>(null)
  const cam = useRef<CamState>({ theta: 0.45, phi: 0.98, dist: 112, focus: new THREE.Vector3(-2, 14, 0) })
  const fly = useRef<FlyTarget | null>(null)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const pinchDist = useRef(0)
  const autoRef = useRef(autoRotate)
  const dragRef = useRef({ active: false, x: 0, y: 0, button: 0 })
  const gotoRegionRef = useRef<((idx: number) => void) | null>(null)

  useEffect(() => {
    autoRef.current = autoRotate
  }, [autoRotate])

  /* ---------- boot renderer + build the world once ---------- */
  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.35))
    renderer.setSize(mount.clientWidth, mount.clientHeight)
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFShadowMap
    renderer.domElement.style.display = 'block'
    renderer.domElement.style.touchAction = 'none'
    renderer.domElement.style.cursor = 'grab'
    mount.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x101720)
    // far fog so landmarks stay visible from across the map
    scene.fog = new THREE.Fog(0x101720, 60, 190)

    const camera = new THREE.PerspectiveCamera(52, mount.clientWidth / mount.clientHeight, 0.1, 400)

    /* night lighting: cold moon key + warm hearths */
    const hemi = new THREE.HemisphereLight(0x38445c, 0x2a1c10, 0.8)
    scene.add(hemi)
    const moon = new THREE.DirectionalLight(0xcdd8ee, 1.05)
    moon.position.set(-60, 90, -80)
    moon.castShadow = true
    moon.shadow.mapSize.set(1024, 1024)
    moon.shadow.autoUpdate = false
    moon.shadow.needsUpdate = true
    moon.shadow.camera.left = -75
    moon.shadow.camera.right = 75
    moon.shadow.camera.top = 75
    moon.shadow.camera.bottom = -75
    moon.shadow.camera.far = 260
    moon.shadow.bias = -0.0006
    scene.add(moon)
    const warm = new THREE.DirectionalLight(0xffd9a0, 0.25)
    warm.position.set(40, 30, 60)
    scene.add(warm)

    /* hearth lights: the bonfire, the town, the belfry, the caldera */
    const hearths: [number, number, number, number, number][] = [
      [0, 15.2, 34, 0xff8033, 24], // the bonfire
      [3, 21.5, -2, 0xffa050, 18], // the town street
      [0, 29.5, -21, 0x9fb8ff, 14], // the fog gate runes
      [-34, 27, -32, 0xffc880, 15], // parish altar candles
      [-24, 33, -38, 0xfff0b0, 28], // the bell tower lamp — seen from everywhere
      [40, 13.5, -8, 0xff6a1f, 26], // the caldera
    ]
    for (const [x, y, z, color, dist] of hearths) {
      const l = new THREE.PointLight(color, 2.4, dist, 1.7)
      l.position.set(x, y, z)
      scene.add(l)
    }

    /* the world itself */
    const w2 = new WorldV2()
    scene.add(w2.group)

    const onResize = () => {
      const w = mount.clientWidth
      const h = mount.clientHeight
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    }
    window.addEventListener('resize', onResize)

    world.current = { renderer, scene, camera, w2, disposables: [] }
    /* QA hook — lets test harnesses read the live camera state */
    ;(window as unknown as { __mapdbg?: unknown }).__mapdbg = {
      get: () => ({
        theta: cam.current.theta,
        phi: cam.current.phi,
        dist: cam.current.dist,
        focus: cam.current.focus.toArray(),
        flying: fly.current ? fly.current.t : null,
        info: {
          calls: renderer.info.render.calls,
          tris: renderer.info.render.triangles,
          geoms: renderer.info.memory.geometries,
          tex: renderer.info.memory.textures,
          programs: renderer.info.programs?.length ?? 0,
        },
      }),
      goto: (idx: number) => gotoRegionRef.current?.(idx),
      probe: (x: number, z: number) => ({
        h: w2.getH(x, z),
        surf: w2.surfAt(x, z),
      }),
    }

    /* ---------- orbit + zoom + pan controls ---------- */
    const el = renderer.domElement
    const onDown = (e: PointerEvent) => {
      el.setPointerCapture(e.pointerId)
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (pointers.current.size === 1) {
        dragRef.current = { active: true, x: e.clientX, y: e.clientY, button: e.button }
        el.style.cursor = 'grabbing'
        fly.current = null // a hand on the wheel cancels the flight
      } else if (pointers.current.size === 2) {
        const [a, b] = [...pointers.current.values()]
        pinchDist.current = Math.hypot(a.x - b.x, a.y - b.y)
      }
    }
    const onMove = (e: PointerEvent) => {
      if (!pointers.current.has(e.pointerId)) return
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (pointers.current.size === 2) {
        const [a, b] = [...pointers.current.values()]
        const d = Math.hypot(a.x - b.x, a.y - b.y)
        if (pinchDist.current > 0) {
          cam.current.dist = Math.max(6, Math.min(200, cam.current.dist * (pinchDist.current / Math.max(1, d))))
        }
        pinchDist.current = d
        return
      }
      const dr = dragRef.current
      if (!dr.active) return
      const dx = e.clientX - dr.x
      const dy = e.clientY - dr.y
      dr.x = e.clientX
      dr.y = e.clientY
      const c = cam.current
      if (dr.button === 2 || e.shiftKey) {
        // pan the focus across the ground plane
        const s = c.dist * 0.0016
        const sinT = Math.sin(c.theta)
        const cosT = Math.cos(c.theta)
        c.focus.x -= (dx * cosT - dy * sinT) * s
        c.focus.z -= (dx * sinT + dy * cosT) * s
        c.focus.y = Math.max(2, c.focus.y + 0)
      } else {
        c.theta -= dx * 0.0062
        c.phi = Math.max(0.12, Math.min(1.52, c.phi - dy * 0.0052))
      }
    }
    const onUp = (e: PointerEvent) => {
      pointers.current.delete(e.pointerId)
      if (pointers.current.size === 0) {
        dragRef.current.active = false
        pinchDist.current = 0
        el.style.cursor = 'grab'
      }
    }
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      cam.current.dist = Math.max(6, Math.min(200, cam.current.dist * (1 + e.deltaY * 0.0011)))
    }
    const onCtx = (e: Event) => e.preventDefault()
    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerup', onUp)
    el.addEventListener('pointercancel', onUp)
    el.addEventListener('wheel', onWheel, { passive: false })
    el.addEventListener('contextmenu', onCtx)

    /* ---------- render loop ---------- */
    const clock = new THREE.Clock()
    let raf = 0
    const tick = () => {
      raf = requestAnimationFrame(tick)
      const raw = clock.getDelta()
      const w = world.current
      if (!w) return

      w.w2.update(raw)

      /* fly-to transition — wall-clock based so slow frames
         never stretch the flight */
      const c = cam.current
      if (fly.current) {
        const f = fly.current
        f.t = Math.min(1, f.t + raw / 1.35)
        const e = f.t < 0.5 ? 2 * f.t * f.t : 1 - Math.pow(-2 * f.t + 2, 2) / 2
        c.theta = f.fromTheta + shortestAngle(f.fromTheta, f.toTheta) * e
        c.phi = f.fromPhi + (f.toPhi - f.fromPhi) * e
        c.dist = f.fromDist + (f.toDist - f.fromDist) * e
        c.focus.lerpVectors(f.fromFocus, f.toFocus, e)
        if (f.t >= 1) fly.current = null
      } else if (autoRef.current && !dragRef.current.active) {
        c.theta += raw * 0.1
      }

      w.camera.position.set(
        c.focus.x + c.dist * Math.sin(c.phi) * Math.sin(c.theta),
        c.focus.y + c.dist * Math.cos(c.phi),
        c.focus.z + c.dist * Math.sin(c.phi) * Math.cos(c.theta)
      )
      w.camera.lookAt(c.focus)
      w.renderer.render(w.scene, w.camera)
    }
    tick()

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointercancel', onUp)
      el.removeEventListener('wheel', onWheel)
      el.removeEventListener('contextmenu', onCtx)
      w2.group.traverse((o) => {
        const m = o as THREE.Mesh
        if (m.geometry) m.geometry.dispose()
      })
      renderer.dispose()
      if (renderer.domElement.parentElement === mount) mount.removeChild(renderer.domElement)
      world.current = null
    }
  }, [])

  /* ---------- fly to a region ---------- */
  const gotoRegion = useCallback((idx: number) => {
    setRegionIdx(idx)
    const r = REGIONS_V2[idx]
    const c = cam.current
    fly.current = {
      fromTheta: c.theta,
      toTheta: r.cam.theta,
      fromPhi: c.phi,
      toPhi: r.cam.phi,
      fromDist: c.dist,
      toDist: r.cam.dist,
      fromFocus: c.focus.clone(),
      toFocus: new THREE.Vector3(r.cam.x, r.cam.y, r.cam.z),
      t: 0,
    }
  }, [])
  useEffect(() => {
    gotoRegionRef.current = gotoRegion
  }, [gotoRegion])

  const region = REGIONS_V2[regionIdx]

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#101720]" dir="rtl">
      {/* header */}
      <div className="flex items-center justify-between border-b border-white/10 bg-black/50 px-4 py-2.5">
        <div className="flex items-center gap-3">
          <span className="text-xl" aria-hidden>🗺️</span>
          <div>
            <h2 className="text-sm font-black text-white">پیش‌نمایش نقشهٔ جدید — نسخهٔ V۲</h2>
            <p className="text-[10px] text-white/45">
              جهان بازسازی‌شده به سبک دارک سولز · هر منطقه را ببین؛ اگر تأیید کنی، وارد بازی می‌شود
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="rounded-none border border-white/20 bg-white/5 px-3 py-1.5 text-xs font-bold text-white/80 hover:bg-white/15"
        >
          بازگشت ✕
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        {/* region list */}
        <aside className="order-2 flex shrink-0 gap-2 overflow-x-auto border-t border-white/10 bg-black/40 p-2 md:order-1 md:w-64 md:flex-col md:overflow-x-hidden md:overflow-y-auto md:border-l md:border-t-0 md:p-3">
          {REGIONS_V2.map((r, i) => (
            <button
              key={r.id}
              onClick={() => gotoRegion(i)}
              className={`flex min-w-[150px] items-start gap-2 rounded-none border p-2 text-right transition-colors md:min-w-0 ${
                i === regionIdx
                  ? 'border-emerald-400/70 bg-emerald-900/40'
                  : 'border-white/10 bg-white/[0.03] hover:bg-white/10'
              }`}
            >
              <span
                className="mt-1 inline-block h-2.5 w-2.5 shrink-0"
                style={{ background: r.dot, boxShadow: `0 0 8px ${r.dot}` }}
                aria-hidden
              />
              <span className="min-w-0">
                <span className="block text-xs font-bold text-white">{r.name}</span>
                <span className="block text-[10px] leading-4 text-white/40">{r.sub}</span>
              </span>
            </button>
          ))}
        </aside>

        {/* viewport */}
        <div className="relative order-1 min-h-[46vh] flex-1 md:order-2">
          <div ref={mountRef} className="absolute inset-0" />

          {/* controls hint */}
          <div className="pointer-events-none absolute right-3 top-3 border border-white/10 bg-black/55 px-2.5 py-1 text-[10px] text-white/55">
            درگ = چرخش · درگ راست/Shift = جابه‌جایی · اسکرول/پینچ = زوم
          </div>

          {/* toggles */}
          <div className="absolute left-3 top-3 flex gap-1.5">
            <button
              onClick={() => setAutoRotate((v) => !v)}
              className={`border px-2 py-1 text-[10px] font-bold transition-colors ${
                autoRotate
                  ? 'border-emerald-400/70 bg-emerald-800/50 text-emerald-200'
                  : 'border-white/15 bg-black/55 text-white/55 hover:bg-white/10'
              }`}
            >
              چرخش خودکار
            </button>
            <button
              onClick={() => setShowLabels((v) => !v)}
              className={`border px-2 py-1 text-[10px] font-bold transition-colors ${
                showLabels
                  ? 'border-emerald-400/70 bg-emerald-800/50 text-emerald-200'
                  : 'border-white/15 bg-black/55 text-white/55 hover:bg-white/10'
              }`}
            >
              پنل توضیح
            </button>
          </div>

          {/* region info card */}
          {showLabels && (
            <div className="pointer-events-none absolute bottom-3 left-3 right-3 md:right-auto md:max-w-md">
              <div className="border border-white/15 bg-black/70 p-3 backdrop-blur-[2px]">
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block h-3 w-3 shrink-0"
                    style={{ background: region.dot, boxShadow: `0 0 10px ${region.dot}` }}
                    aria-hidden
                  />
                  <h3 className="text-sm font-black text-white">{region.name}</h3>
                  <span className="text-[10px] text-white/45">{region.sub}</span>
                </div>
                <p className="mt-2 text-[11px] leading-5 text-white/75">{region.desc}</p>
                <p className="mt-1.5 border-r-2 border-amber-400/60 pr-2 text-[10px] leading-4 text-amber-200/85">
                  🎯 {region.design}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* shortest signed angular difference a→b */
function shortestAngle(a: number, b: number) {
  let d = (b - a) % (Math.PI * 2)
  if (d > Math.PI) d -= Math.PI * 2
  if (d < -Math.PI) d += Math.PI * 2
  return d
}
