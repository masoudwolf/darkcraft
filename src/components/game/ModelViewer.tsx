'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import * as THREE from 'three'
import { BESTIARY, resetMobScale } from '@/lib/game/bestiary'
import { blockMaterials } from '@/lib/game/textures'
import { setFlash, setFlashWhite, disposeHumanoid, type Humanoid } from '@/lib/game/models'

/* ============================================================
   3D MODEL VIEWER — a professional inspection deck for every
   mob & character. Drag = orbit, wheel/pinch = zoom, chips =
   animation, plus wireframe / grid / speed / flash tests.
   Materials are cloned so nothing here leaks into the game.
   ============================================================ */

interface Props {
  onClose: () => void
}

/** clone every material on the humanoid so viewer tweaks stay local */
function cloneHumanoidMaterials(h: Humanoid) {
  const map = new Map<THREE.Material, THREE.Material>()
  const clone = (m: THREE.Material) => {
    let c = map.get(m)
    if (!c) {
      c = m.clone()
      map.set(m, c)
    }
    return c
  }
  h.group.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (!(mesh as unknown as { isMesh?: boolean }).isMesh || !mesh.material) return
    if (Array.isArray(mesh.material)) mesh.material = mesh.material.map(clone)
    else mesh.material = clone(mesh.material)
  })
  h.materials = h.materials.map((m) => map.get(m) as THREE.MeshLambertMaterial ?? m)
  h.extras = h.extras.map((m) => map.get(m) ?? m)
}

/** frame the key light on models of different sizes */
function frameKeyLight(scene: THREE.Scene, scale: number) {
  const key = scene.children.find(
    (o) => (o as THREE.DirectionalLight).isDirectionalLight && (o as THREE.DirectionalLight).castShadow
  ) as THREE.DirectionalLight | undefined
  if (!key) return
  key.position.set(5 * scale, 9 * scale, 6 * scale)
  key.target.position.set(0, 1.05 * scale, 0)
  key.target.updateMatrixWorld()
  scene.add(key.target)
}

/** toggle wireframe across every mesh of the model (clone-local) */
function applyWireframe(h: Humanoid, on: boolean) {
  for (const mat of h.materials) mat.wireframe = on
  h.group.traverse((o) => {
    const mesh = o as THREE.Mesh
    if ((mesh as unknown as { isMesh?: boolean }).isMesh && mesh.material) {
      if (Array.isArray(mesh.material)) {
        for (const mm of mesh.material) mm.wireframe = on
      } else {
        mesh.material.wireframe = on
      }
    }
  })
}

export default function ModelViewer({ onClose }: Props) {
  const mountRef = useRef<HTMLDivElement>(null)
  const [entryIdx, setEntryIdx] = useState(0)
  const [animId, setAnimId] = useState('idle')
  const [speed, setSpeed] = useState(1)
  const [autoRotate, setAutoRotate] = useState(true)
  const [wireframe, setWireframe] = useState(false)
  const [grid, setGrid] = useState(true)
  const [paused, setPaused] = useState(false)

  // three.js world (created once)
  const world = useRef<{
    renderer: THREE.WebGLRenderer
    scene: THREE.Scene
    camera: THREE.PerspectiveCamera
    turn: THREE.Group
    grid: THREE.GridHelper
    pedestal: THREE.Mesh
    disposables: (() => void)[]
  } | null>(null)
  // current model instance
  const model = useRef<{
    h: Humanoid
    refs: Record<string, THREE.Object3D>
    entryIdx: number
  } | null>(null)
  const camState = useRef({ theta: 0.7, phi: 1.12, dist: 5, focusY: 1.05, distTarget: 5 })
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const pinchDist = useRef(0)
  const animClock = useRef(0)
  const flashT = useRef<{ v: number; white: boolean } | null>(null)
  const speedRef = useRef(speed)
  const pausedRef = useRef(paused)
  const autoRef = useRef(autoRotate)
  const animIdRef = useRef(animId)
  useEffect(() => {
    speedRef.current = speed
    pausedRef.current = paused
    autoRef.current = autoRotate
    animIdRef.current = animId
  }, [speed, paused, autoRotate, animId])

  /* ---------- boot the renderer + static scene ---------- */
  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6))
    renderer.setSize(mount.clientWidth, mount.clientHeight)
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFShadowMap
    renderer.domElement.style.display = 'block'
    renderer.domElement.style.touchAction = 'none'
    renderer.domElement.style.cursor = 'grab'
    mount.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x0c1016)
    scene.fog = new THREE.Fog(0x0c1016, 18, 55)

    const camera = new THREE.PerspectiveCamera(50, mount.clientWidth / mount.clientHeight, 0.1, 200)

    const turn = new THREE.Group()
    scene.add(turn)

    // lighting: cool key + warm rim + soft hemi — museum-grade
    const hemi = new THREE.HemisphereLight(0x9db2cc, 0x241a10, 0.85)
    scene.add(hemi)
    const key = new THREE.DirectionalLight(0xfff2dd, 1.5)
    key.position.set(5, 9, 6)
    key.castShadow = true
    key.shadow.mapSize.set(1024, 1024)
    key.shadow.camera.left = -7
    key.shadow.camera.right = 7
    key.shadow.camera.top = 8
    key.shadow.camera.bottom = -4
    key.shadow.camera.far = 40
    key.shadow.bias = -0.0004
    scene.add(key)
    const rim = new THREE.DirectionalLight(0xffb26a, 0.7)
    rim.position.set(-6, 4, -7)
    scene.add(rim)

    // pedestal + grid (shared stonebrick texture from the game's atlas)
    const mats = blockMaterials()
    const pedestal = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.4, 2.6), mats.stonebrick)
    pedestal.position.y = -0.2
    pedestal.receiveShadow = true
    pedestal.castShadow = true
    turn.add(pedestal)

    const gridHelper = new THREE.GridHelper(26, 26, 0x3d4a5c, 0x1d242e)
    gridHelper.position.y = -0.41
    scene.add(gridHelper)

    const onResize = () => {
      const w = mount.clientWidth
      const h = mount.clientHeight
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    }
    window.addEventListener('resize', onResize)

    world.current = { renderer, scene, camera, turn, grid: gridHelper, pedestal, disposables: [] }

    // QA hooks — external test harnesses can orbit/frame the deck precisely:
    // __mviewer.cam = {theta, phi, dist, distTarget, focusY}, __mviewer.world = world ref
    ;(window as unknown as { __mviewer?: object }).__mviewer = { cam: camState.current, world }

    /* ---------- orbit controls (mouse + touch + pinch) ---------- */
    const el = renderer.domElement
    const drag = { active: false, x: 0, y: 0 }

    const onDown = (e: PointerEvent) => {
      el.setPointerCapture(e.pointerId)
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (pointers.current.size === 1) {
        drag.active = true
        drag.x = e.clientX
        drag.y = e.clientY
        el.style.cursor = 'grabbing'
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
          const c = camState.current
          c.distTarget = Math.max(1.6, Math.min(26, c.distTarget * (pinchDist.current / Math.max(1, d))))
        }
        pinchDist.current = d
        return
      }
      if (!drag.active) return
      const c = camState.current
      c.theta -= (e.clientX - drag.x) * 0.0065
      c.phi = Math.max(0.25, Math.min(1.5, c.phi - (e.clientY - drag.y) * 0.0055))
      drag.x = e.clientX
      drag.y = e.clientY
    }
    const onUp = (e: PointerEvent) => {
      pointers.current.delete(e.pointerId)
      if (pointers.current.size === 0) {
        drag.active = false
        pinchDist.current = 0
        el.style.cursor = 'grab'
      }
    }
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const c = camState.current
      c.distTarget = Math.max(1.6, Math.min(26, c.distTarget * (1 + e.deltaY * 0.0011)))
    }
    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerup', onUp)
    el.addEventListener('pointercancel', onUp)
    el.addEventListener('wheel', onWheel, { passive: false })

    /* ---------- render loop ---------- */
    const clock = new THREE.Clock()
    let raf = 0
    const tick = () => {
      raf = requestAnimationFrame(tick)
      const dt = Math.min(clock.getDelta(), 0.05)
      const w = world.current
      const m = model.current
      if (!w) return

      // animation clock
      if (!pausedRef.current) animClock.current += dt * speedRef.current
      const t = animClock.current

      // drive the current animation
      if (m) {
        const entry = BESTIARY[m.entryIdx]
        const anim = entry.anims.find((a) => a.id === animIdRef.current) ?? entry.anims[0]
        anim.fn(m.h, t, dt)
        entry.onFrame?.(m.h, m.refs, anim.id, t, dt)
        // hit/fuse flash tests decay
        if (flashT.current) {
          flashT.current.v -= dt * 2.6
          const v = Math.max(0, flashT.current.v)
          if (flashT.current.white) setFlashWhite(m.h, v)
          else setFlash(m.h, v)
          if (v <= 0) flashT.current = null
        }
      }

      // turntable
      if (autoRef.current && !drag.active) w.turn.rotation.y += dt * 0.45

      // orbit camera
      const c = camState.current
      c.dist += (c.distTarget - c.dist) * Math.min(1, 9 * dt)
      w.camera.position.set(
        c.dist * Math.sin(c.phi) * Math.sin(c.theta),
        c.focusY + c.dist * Math.cos(c.phi),
        c.dist * Math.sin(c.phi) * Math.cos(c.theta)
      )
      w.camera.lookAt(0, c.focusY, 0)

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
      // dispose current model
      if (model.current) {
        model.current.h.group.removeFromParent()
        disposeHumanoid(model.current.h)
        model.current = null
      }
      gridHelper.geometry.dispose()
      ;(gridHelper.material as THREE.Material).dispose()
      pedestal.geometry.dispose()
      renderer.dispose()
      if (renderer.domElement.parentElement === mount) mount.removeChild(renderer.domElement)
      world.current = null
    }
  }, [])

  /* ---------- (re)build the selected mob ---------- */
  useEffect(() => {
    const w = world.current
    if (!w) return
    // tear down the old model (it lives under w.turn — removeFromParent
    // is the safe detach, scene.remove would silently do nothing)
    if (model.current) {
      model.current.h.group.removeFromParent()
      disposeHumanoid(model.current.h)
      model.current = null
    }
    const entry = BESTIARY[entryIdx]
    const h = entry.build()
    cloneHumanoidMaterials(h)
    const refs = entry.refs?.(h) ?? {}
    h.group.position.y = 0
    w.turn.add(h.group)
    model.current = { h, refs, entryIdx }

    // re-frame the camera + key light for the model's size
    const c = camState.current
    c.focusY = 1.05 * entry.scale
    c.dist = c.distTarget = 4.4 * entry.scale + 1.4
    w.pedestal.scale.setScalar(Math.max(0.9, entry.scale))
    frameKeyLight(w.scene, entry.scale)

    animClock.current = 0
  }, [entryIdx])

  /* switch animation — reset clock + any lingering fuse scaling */
  const changeAnim = useCallback(
    (id: string) => {
      setAnimId(id)
      animClock.current = 0
      const m = model.current
      if (m) {
        resetMobScale(m.h, BESTIARY[m.entryIdx].scale)
      }
    },
    []
  )

  /* ---------- toggles that touch the scene ---------- */
  useEffect(() => {
    if (world.current) world.current.grid.visible = grid
  }, [grid])

  useEffect(() => {
    const m = model.current
    if (!m) return
    applyWireframe(m.h, wireframe)
  }, [wireframe, entryIdx])

  const entry = BESTIARY[entryIdx]

  const testFlash = (white: boolean) => {
    if (!model.current) return
    resetMobScale(model.current.h, entry.scale)
    flashT.current = { v: 0.7, white }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#0c1016]" dir="rtl">
      {/* header */}
      <div className="flex items-center justify-between border-b border-white/10 bg-black/50 px-4 py-2.5">
        <div className="flex items-center gap-3">
          <span className="text-xl" aria-hidden>🔬</span>
          <div>
            <h2 className="text-sm font-black text-white">نمایشگر سه‌بعدی موجودات</h2>
            <p className="text-[10px] text-white/45">هر مابی را بچرخان، انیمیشنش را ببین و مشکل‌ها را سریع پیدا کن</p>
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
        {/* mob list */}
        <aside className="order-2 flex shrink-0 gap-2 overflow-x-auto border-t border-white/10 bg-black/40 p-2 md:order-1 md:w-60 md:flex-col md:overflow-x-hidden md:overflow-y-auto md:border-l md:border-t-0 md:p-3">
          {BESTIARY.map((b, i) => (
            <button
              key={b.id}
              onClick={() => {
                setEntryIdx(i)
                changeAnim(b.anims[0].id)
              }}
              className={`flex min-w-[140px] items-start gap-2 rounded-none border p-2 text-right transition-colors md:min-w-0 ${
                i === entryIdx
                  ? 'border-emerald-400/70 bg-emerald-900/40'
                  : 'border-white/10 bg-white/[0.03] hover:bg-white/10'
              }`}
            >
              <span
                className="mt-1 inline-block h-2.5 w-2.5 shrink-0"
                style={{ background: b.dot, boxShadow: `0 0 8px ${b.dot}` }}
                aria-hidden
              />
              <span className="min-w-0">
                <span className="block text-xs font-bold text-white">{b.name}</span>
                <span className="block text-[10px] leading-4 text-white/40">{b.sub}</span>
              </span>
            </button>
          ))}
        </aside>

        {/* viewport */}
        <div className="relative order-1 min-h-[46vh] flex-1 md:order-2">
          <div ref={mountRef} className="absolute inset-0" />

          {/* drag hint */}
          <div className="pointer-events-none absolute right-3 top-3 border border-white/10 bg-black/55 px-2.5 py-1 text-[10px] text-white/55">
            درگ = چرخش · اسکرول/پینچ = زوم
          </div>

          {/* animation chips */}
          <div className="pointer-events-auto absolute inset-x-0 bottom-0 border-t border-white/10 bg-black/60 p-2 backdrop-blur-[2px]">
            <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-2">
              <label className="flex items-center gap-2 text-[10px] text-white/60">
                سرعت
                <input
                  type="range"
                  min={0.25}
                  max={2}
                  step={0.05}
                  value={speed}
                  onChange={(e) => setSpeed(Number(e.target.value))}
                  className="h-1 w-24 accent-emerald-400"
                  dir="ltr"
                />
                <span className="font-pixel text-[9px] text-emerald-300" dir="ltr">{speed.toFixed(2)}x</span>
              </label>
              {(
                [
                  ['چرخش خودکار', autoRotate, () => setAutoRotate((v) => !v)],
                  ['وایرفریم', wireframe, () => setWireframe((v) => !v)],
                  ['شبکه‌ی زمین', grid, () => setGrid((v) => !v)],
                  ['توقف', paused, () => setPaused((v) => !v)],
                ] as const
              ).map(([label, on, toggle]) => (
                <button
                  key={label}
                  onClick={toggle}
                  className={`border px-2 py-1 text-[10px] font-bold transition-colors ${
                    on
                      ? 'border-emerald-400/70 bg-emerald-800/50 text-emerald-200'
                      : 'border-white/15 bg-white/5 text-white/55 hover:bg-white/10'
                  }`}
                >
                  {label}
                </button>
              ))}
              <span className="mr-auto flex items-center gap-1.5">
                <span className="text-[10px] text-white/40">تست:</span>
                <button
                  onClick={() => testFlash(false)}
                  className="border border-red-400/50 bg-red-900/40 px-2 py-1 text-[10px] font-bold text-red-200 hover:bg-red-800/50"
                >
                  ضربه (قرمز)
                </button>
                <button
                  onClick={() => testFlash(true)}
                  className="border border-white/40 bg-white/10 px-2 py-1 text-[10px] font-bold text-white/85 hover:bg-white/20"
                >
                  فیوز (سفید)
                </button>
              </span>
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-0.5">
              {entry.anims.map((a) => (
                <button
                  key={a.id}
                  onClick={() => changeAnim(a.id)}
                  className={`shrink-0 border px-2.5 py-1 text-[11px] font-bold transition-colors ${
                    a.id === animId
                      ? 'border-amber-300/80 bg-amber-700/50 text-amber-100'
                      : 'border-white/15 bg-white/5 text-white/60 hover:bg-white/10'
                  }`}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
