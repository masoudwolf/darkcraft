'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import * as THREE from 'three'
import { WorldV3, REGIONS_V3 } from '@/lib/game/worldV3'
import { CastleZone, REGIONS_CASTLE } from '@/lib/game/castle'
import { createRoc, animRocFlap, animRocGlide, animRocGrab, animRocCarry, type RocRig } from '@/lib/game/roc'
import { createHumanoid, resetPose, type Humanoid } from '@/lib/game/models'

/* ============================================================
   MAP VIEWER V4 — the inspection deck for BOTH worlds.
   Tab 1 «درّهٔ اخگر»: the live Vale (WorldV3) — unchanged.
   Tab 2 «قلعهٔ مانولث»: the NEW gothic castle zone (preview),
   isolated from the Vale, with the Night Roc flying overhead
   and a replayable grab-and-carry cinematic.
   Drag = orbit · wheel/pinch = zoom · region chips = fly-to.
   The game itself is untouched until the design is approved.
   ============================================================ */

interface Props {
  onClose: () => void
}

type WorldTab = 'vale' | 'castle'

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

interface CineKey {
  t: number
  pos: [number, number, number]
}

/** the grab-and-carry flight path — wall-clock keyframes */
const CINE_KEYS: CineKey[] = [
  { t: 0, pos: [0, 62, 92] },
  { t: 3.2, pos: [0, 17.5, 53] }, // the dive — low over the landing deck
  { t: 5.5, pos: [10, 28, 28] }, // climbing, banking past the gate towers
  { t: 8.0, pos: [6, 38, 2] }, // over the nave roofline
  { t: 10.5, pos: [-14, 40, -11] }, // circling the lantern tower
  { t: 13.0, pos: [0, 50, -30] }, // over the choir, heading out
  { t: 15.5, pos: [0, 58, -90] }, // fading into the clouds
]
const CINE_DUR = 17.2

const CINE_CAPTIONS: { t0: number; t1: number; title: string; sub: string }[] = [
  {
    t0: 0.5,
    t1: 4.6,
    title: 'سه لرد درّه افتادند…',
    sub: 'و آسمان، بدهکارِ خاکستر ماند — سروصدای بال‌ها از ابرها می‌آید.',
  },
  {
    t0: 5.2,
    t1: 10.2,
    title: 'رُخِ شب — آخرین خدمتکار خدایان کهن',
    sub: 'پنجه‌هایش مسافر را می‌گیرد؛ مقصد، قلعه‌ای است که جز از آسمان راهی به آن نیست.',
  },
  {
    t0: 12.6,
    t1: 16.6,
    title: 'قلعهٔ مانولث',
    sub: 'سرایِ خدایانِ گم‌شده — بر فرازِ دریای ابر. (پیش‌نمایش — پس از تأیید، سکانس به پایانِ دستهٔ اول متصل می‌شود)',
  },
]

/** smooth interpolation along the cinematic keyframe track */
function cinePos(t: number, out: THREE.Vector3) {
  const keys = CINE_KEYS
  let i = 0
  while (i < keys.length - 2 && t > keys[i + 1].t) i++
  const a = keys[i]
  const b = keys[i + 1]
  const span = Math.max(0.001, b.t - a.t)
  let p = Math.min(1, Math.max(0, (t - a.t) / span))
  p = p * p * (3 - 2 * p) // smoothstep
  out.set(
    a.pos[0] + (b.pos[0] - a.pos[0]) * p,
    a.pos[1] + (b.pos[1] - a.pos[1]) * p,
    a.pos[2] + (b.pos[2] - a.pos[2]) * p
  )
  return i
}

export default function MapViewer({ onClose }: Props) {
  const mountRef = useRef<HTMLDivElement>(null)
  const [world, setWorld] = useState<WorldTab>('vale')
  const [regionIdx, setRegionIdx] = useState(0)
  const [autoRotate, setAutoRotate] = useState(false)
  const [showLabels, setShowLabels] = useState(true)
  const [showRoof, setShowRoof] = useState(true)
  const [cineActive, setCineActive] = useState(false)
  const [captionIdx, setCaptionIdx] = useState(-1)
  const captionRef = useRef(-1)

  const worldRef = useRef<{
    renderer: THREE.WebGLRenderer
    scene: THREE.Scene
    camera: THREE.PerspectiveCamera
    w2: WorldV3
    castle: CastleZone
    valeLights: THREE.Group
    roc: { h: Humanoid; rig: RocRig } | null
    rider: Humanoid | null
    disposables: (() => void)[]
  } | null>(null)
  const cam = useRef<CamState>({ theta: 0.45, phi: 0.98, dist: 112, focus: new THREE.Vector3(-2, 14, 0) })
  const fly = useRef<FlyTarget | null>(null)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const pinchDist = useRef(0)
  const autoRef = useRef(autoRotate)
  const dragRef = useRef({ active: false, x: 0, y: 0, button: 0 })
  const worldTabRef = useRef<WorldTab>('vale')
  const roofRef = useRef(true)
  const cine = useRef<{ active: boolean; t: number }>({ active: false, t: 0 })
  const rocClock = useRef(0)
  const gotoRegionRef = useRef<((idx: number, w?: WorldTab) => void) | null>(null)

  useEffect(() => {
    autoRef.current = autoRotate
  }, [autoRotate])
  useEffect(() => {
    worldTabRef.current = world
  }, [world])
  useEffect(() => {
    roofRef.current = showRoof
  }, [showRoof])

  /* ---------- boot renderer + build BOTH worlds once ---------- */
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
    scene.fog = new THREE.Fog(0x101720, 60, 190)

    const camera = new THREE.PerspectiveCamera(52, mount.clientWidth / mount.clientHeight, 0.1, 500)

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
    moon.shadow.camera.far = 300
    moon.shadow.bias = -0.0006
    scene.add(moon)
    const warm = new THREE.DirectionalLight(0xffd9a0, 0.25)
    warm.position.set(40, 30, 60)
    scene.add(warm)

    /* hearth lights for the VALE */
    const hearths: [number, number, number, number, number][] = [
      [0, 15.2, 34, 0xff8033, 24],
      [3, 21.5, -2, 0xffa050, 18],
      [0, 29.5, -21, 0x9fb8ff, 14],
      [-34, 27, -32, 0xffc880, 15],
      [-24, 33, -38, 0xfff0b0, 28],
      [40, 13.5, -8, 0xff6a1f, 26],
    ]
    const valeLights = new THREE.Group()
    for (const [x, y, z, color, dist] of hearths) {
      const l = new THREE.PointLight(color, 2.4, dist, 1.7)
      l.position.set(x, y, z)
      valeLights.add(l)
    }
    scene.add(valeLights)
    /* the worlds themselves */
    const w2 = new WorldV3()
    scene.add(w2.group)
    const castle = new CastleZone()
    castle.group.visible = false
    scene.add(castle.group)
    scene.add(castle.ceil)

    /* ---- THE NIGHT ROC — alive above the castle ---- */
    const rocH = createRoc(2.1)
    const rig = rocH.group.userData.roc as RocRig
    rocH.group.visible = false
    scene.add(rocH.group)

    /* the rider for the cinematic — dangling from the talons */
    const rider = createHumanoid('player', 1, { sword: true, shield: true })
    rider.group.visible = false
    scene.add(rider.group)

    const onResize = () => {
      const w = mount.clientWidth
      const h = mount.clientHeight
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    }
    window.addEventListener('resize', onResize)

    worldRef.current = { renderer, scene, camera, w2, castle, valeLights, roc: { h: rocH, rig }, rider, disposables: [] }

    /* QA hook — lets test harnesses read the live camera state */
    ;(window as unknown as { __mapdbg?: unknown }).__mapdbg = {
      get: () => ({
        world: worldTabRef.current,
        theta: cam.current.theta,
        phi: cam.current.phi,
        dist: cam.current.dist,
        focus: cam.current.focus.toArray(),
        flying: fly.current ? fly.current.t : null,
        cine: cine.current.active ? cine.current.t : null,
        info: {
          calls: renderer.info.render.calls,
          tris: renderer.info.render.triangles,
          geoms: renderer.info.memory.geometries,
          tex: renderer.info.memory.textures,
          programs: renderer.info.programs?.length ?? 0,
        },
      }),
      cz: castle,
      setCam: (x: number, y: number, z: number, dist: number, theta: number, phi: number) => {
        cam.current.focus.set(x, y, z)
        cam.current.dist = dist
        cam.current.theta = theta
        cam.current.phi = phi
        fly.current = null
      },
      goto: (idx: number, w?: WorldTab) => gotoRegionRef.current?.(idx, w),
      jump: (idx: number, w?: WorldTab) => {
        const which = w ?? worldTabRef.current
        const r = which === 'vale' ? REGIONS_V3[idx] : REGIONS_CASTLE[idx]
        cam.current.theta = r.cam.theta
        cam.current.phi = r.cam.phi
        cam.current.dist = r.cam.dist
        cam.current.focus.set(r.cam.x, r.cam.y, r.cam.z)
        fly.current = null
        if (which === 'castle' && worldRef.current) {
          const roof = !REGIONS_CASTLE[idx].interior
          worldRef.current.castle.ceil.visible = roof
        }
        // keep React state in sync (the tick loop reads refs only)
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('mapdbg-region', { detail: { idx, world: which } }))
        }, 0)
      },
      startCine: () => {
        if (!cine.current.active) {
          cine.current = { active: true, t: 0 }
          cam.current.focus.set(0, 22, 47)
          cam.current.dist = 30
          cam.current.theta = 0.02
          cam.current.phi = 1.1
          fly.current = null
          setCineActive(true)
        }
      },
      stopCine: () => {
        cine.current = { active: false, t: 0 }
        setCineActive(false)
      },
      seekCine: (t: number) => {
        if (cine.current.active) cine.current.t = t
      },
      probe: (x: number, z: number) => ({
        h: worldTabRef.current === 'vale' ? w2.getH(x, z) : castle.getH(x, z),
        surf: worldTabRef.current === 'vale' ? w2.surfAt(x, z) : -1,
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
        fly.current = null
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
          cam.current.dist = Math.max(6, Math.min(320, cam.current.dist * (pinchDist.current / Math.max(1, d))))
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
      cam.current.dist = Math.max(6, Math.min(320, cam.current.dist * (1 + e.deltaY * 0.0011)))
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
    const rocTmp = new THREE.Vector3()
    const rocNext = new THREE.Vector3()
    const riderOffset = new THREE.Vector3()
    const UP = new THREE.Vector3(0, 1, 0)

    const tick = () => {
      raf = requestAnimationFrame(tick)
      const raw = Math.min(clock.getDelta(), 0.08)
      const w = worldRef.current
      if (!w) return
      const isCastle = worldTabRef.current === 'castle'

      if (isCastle) {
        w.castle.update(raw)
        w.castle.ceil.visible = roofRef.current
      }

      /* ===== THE NIGHT ROC ===== */
      if (w.roc) {
        const roc = w.roc.h
        const rocG = roc.group
        rocG.visible = isCastle
        w.rider!.group.visible = false
        if (isCastle) {
          if (cine.current.active) {
            /* ---- cinematic: the grab & carry ---- */
            cine.current.t += raw
            const ct = cine.current.t
            if (ct >= CINE_DUR) {
              cine.current = { active: false, t: 0 }
              setCineActive(false)
              setCaptionIdx(-1)
              captionRef.current = -1
            } else {
              cinePos(ct, rocTmp)
              rocG.position.copy(rocTmp)
              // face the direction of travel
              cinePos(Math.min(CINE_DUR, ct + 0.25), rocNext)
              const dx = rocNext.x - rocTmp.x
              const dz = rocNext.z - rocTmp.z
              if (Math.abs(dx) + Math.abs(dz) > 0.001) rocG.rotation.y = Math.atan2(dx, dz)
              rocG.rotation.z = 0.18 * Math.min(1, Math.max(0, (ct - 3.4) / 2))
              // animation beats
              rocClock.current += raw
              if (ct < 1.6) animRocGlide(roc, rocClock.current)
              else if (ct < 3.2) animRocGrab(roc, (ct - 1.6) / 1.6)
              else animRocCarry(roc, rocClock.current)
              // the rider clamps on at the low point
              if (ct >= 2.9 && w.rider) {
                w.rider.group.visible = true
                riderOffset
                  .set(0, -4.1, 0.5)
                  .applyAxisAngle(UP, rocG.rotation.y)
                w.rider.group.position.set(
                  rocG.position.x + riderOffset.x,
                  rocG.position.y + riderOffset.y,
                  rocG.position.z + riderOffset.z
                )
                w.rider.group.rotation.y = rocG.rotation.y
                w.rider.group.rotation.z = Math.sin(ct * 2.2) * 0.1
                resetPose(w.rider)
                w.rider.armL.rotation.x = Math.PI * 0.82
                w.rider.armR.rotation.x = Math.PI * 0.82
                w.rider.legL.rotation.x = 0.25
                w.rider.legR.rotation.x = 0.2
              }
              // caption state (kept in React state, never read during render)
              const capIdx = CINE_CAPTIONS.findIndex((cc) => ct >= cc.t0 && ct <= cc.t1)
              if (capIdx !== captionRef.current) {
                captionRef.current = capIdx
                setCaptionIdx(capIdx)
              }
              /* cinematic camera — the director owns it */
              const c = cam.current
              if (ct < 3.2) {
                // locked on the landing deck, watching the dive come down
                c.focus.lerp(new THREE.Vector3(0, 22, 47), Math.min(1, 3 * raw))
                c.dist += (30 - c.dist) * Math.min(1, 2 * raw)
                c.theta += (0.02 - c.theta) * Math.min(1, 2 * raw)
                c.phi += (1.1 - c.phi) * Math.min(1, 2 * raw)
              } else if (ct < 13.2) {
                // chase cam — the focus rides the Roc, the camera trails behind
                const yaw = rocG.rotation.y
                c.focus.lerp(rocG.position, Math.min(1, 6 * raw))
                c.dist += (15 - c.dist) * Math.min(1, 2.4 * raw)
                c.phi += (1.28 - c.phi) * Math.min(1, 2 * raw)
                c.theta += shortestAngle(c.theta, yaw + Math.PI) * Math.min(1, 3 * raw)
              } else {
                // settle back to the gate panorama as the Roc fades
                c.focus.lerp(new THREE.Vector3(0, 26, 22), Math.min(1, 1.4 * raw))
                c.dist += (86 - c.dist) * Math.min(1, 1.2 * raw)
                c.theta += (0.03 - c.theta) * Math.min(1, 1.4 * raw)
                c.phi += (0.95 - c.phi) * Math.min(1, 1.4 * raw)
              }
            }
          } else {
            /* ---- idle patrol: a slow circle above the castle ---- */
            rocClock.current += raw
            const t = rocClock.current
            const a = t * 0.13
            rocG.position.set(Math.cos(a) * 42, 41 + Math.sin(t * 0.6) * 2.5, Math.sin(a) * 42)
            const dx = -Math.sin(a)
            const dz = Math.cos(a)
            rocG.rotation.y = Math.atan2(dx, dz)
            rocG.rotation.z = 0.16
            const phase = t % 11
            if (phase < 5.5) animRocGlide(roc, t)
            else if (phase < 8.5) animRocFlap(roc, t)
            else animRocGlide(roc, t)
          }
        }
      }

      w.w2.update(raw)

      /* fly-to transition — wall-clock based so slow frames
         never stretch the flight (disabled during the cinematic) */
      const c = cam.current
      if (cine.current.active && worldTabRef.current === 'castle') {
        // camera fully owned by the director
      } else if (fly.current) {
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

      const aim = c.focus
      w.camera.position.set(
        c.focus.x + c.dist * Math.sin(c.phi) * Math.sin(c.theta),
        c.focus.y + c.dist * Math.cos(c.phi),
        c.focus.z + c.dist * Math.sin(c.phi) * Math.cos(c.theta)
      )
      w.camera.lookAt(aim)
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
      castle.group.traverse((o) => {
        const m = o as THREE.Mesh
        if (m.geometry) m.geometry.dispose()
      })
      renderer.dispose()
      if (renderer.domElement.parentElement === mount) mount.removeChild(renderer.domElement)
      worldRef.current = null
    }
  }, [])

  /* ---------- world switch ---------- */
  const gotoRegion = useCallback((idx: number, w?: WorldTab) => {
    const which = w ?? worldTabRef.current
    setRegionIdx(idx)
    const r = which === 'vale' ? REGIONS_V3[idx] : REGIONS_CASTLE[idx]
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
    // interior regions peek under the roof
    if (which === 'castle') {
      const cr = REGIONS_CASTLE[idx]
      const ref = worldRef.current
      if (ref) {
        const roof = !cr.interior
        setShowRoof(roof)
        ref.castle.ceil.visible = roof
      }
    }
  }, [])

  const switchWorld = useCallback(
    (w: WorldTab) => {
      setWorld(w)
      const ref = worldRef.current
      if (!ref) return
      ref.w2.group.visible = w === 'vale'
      ref.valeLights.visible = w === 'vale'
      ref.castle.group.visible = w === 'castle'
      ref.castle.ceil.visible = w === 'castle'
      if (ref.roc) ref.roc.h.group.visible = false
      if (ref.rider) ref.rider.group.visible = false
      ;(ref.scene.fog as THREE.Fog).near = w === 'vale' ? 60 : 110
      ;(ref.scene.fog as THREE.Fog).far = w === 'vale' ? 190 : 330
      cine.current = { active: false, t: 0 }
      setCineActive(false)
      setRegionIdx(0)
      // jump the camera straight to the new world's overview
      const r = w === 'vale' ? REGIONS_V3[0] : REGIONS_CASTLE[0]
      cam.current.theta = r.cam.theta
      cam.current.phi = r.cam.phi
      cam.current.dist = r.cam.dist
      cam.current.focus.set(r.cam.x, r.cam.y, r.cam.z)
      fly.current = null
      worldTabRef.current = w
    },
    []
  )
  useEffect(() => {
    gotoRegionRef.current = gotoRegion
  }, [gotoRegion])

  /* the QA jump hook announces its region so the UI follows */
  useEffect(() => {
    const onRegion = (e: Event) => {
      const d = (e as CustomEvent).detail as { idx: number; world: WorldTab }
      setWorld(d.world)
      setRegionIdx(d.idx)
      if (d.world === 'castle') setShowRoof(!REGIONS_CASTLE[d.idx].interior)
    }
    window.addEventListener('mapdbg-region', onRegion)
    return () => window.removeEventListener('mapdbg-region', onRegion)
  }, [])

  const regions = world === 'vale' ? REGIONS_V3 : REGIONS_CASTLE
  const region = regions[regionIdx]

  const startCine = () => {
    cine.current = { active: true, t: 0 }
    captionRef.current = -1
    setCaptionIdx(-1)
    fly.current = null
    // the director cuts straight to the landing deck
    cam.current.focus.set(0, 22, 47)
    cam.current.dist = 30
    cam.current.theta = 0.02
    cam.current.phi = 1.1
    setCineActive(true)
  }
  const stopCine = () => {
    cine.current = { active: false, t: 0 }
    captionRef.current = -1
    setCaptionIdx(-1)
    setCineActive(false)
  }

  const activeCaption = cineActive && captionIdx >= 0 ? CINE_CAPTIONS[captionIdx] : undefined

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#101720]" dir="rtl">
      {/* header */}
      <div className="flex items-center justify-between border-b border-white/10 bg-black/50 px-4 py-2.5">
        <div className="flex items-center gap-3">
          <span className="text-xl" aria-hidden>🗺️</span>
          <div>
            <h2 className="text-sm font-black text-white">نقشهٔ بازدید مناطق — دارک‌کرفت</h2>
            <p className="text-[10px] text-white/45">
              دو جهانِ جدا: درّهٔ اخگر و قلعهٔ مانولث (پیش‌نمایش) · هر منطقه را از نزدیک ببین
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* world tabs */}
          <div className="flex border border-white/15">
            <button
              onClick={() => switchWorld('vale')}
              className={`border-l border-white/10 px-3 py-1.5 text-xs font-bold transition-colors ${
                world === 'vale' ? 'bg-emerald-900/60 text-emerald-200' : 'bg-white/5 text-white/55 hover:bg-white/10'
              }`}
            >
              🏕️ درّهٔ اخگر
            </button>
            <button
              onClick={() => switchWorld('castle')}
              className={`px-3 py-1.5 text-xs font-bold transition-colors ${
                world === 'castle' ? 'bg-sky-900/60 text-sky-200' : 'bg-white/5 text-white/55 hover:bg-white/10'
              }`}
            >
              🏰 قلعهٔ مانولث — جهان جدید
            </button>
          </div>
          <button
            onClick={onClose}
            className="rounded-none border border-white/20 bg-white/5 px-3 py-1.5 text-xs font-bold text-white/80 hover:bg-white/15"
          >
            بازگشت ✕
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        {/* region list */}
        <aside className="order-2 flex shrink-0 gap-2 overflow-x-auto border-t border-white/10 bg-black/40 p-2 md:order-1 md:w-64 md:flex-col md:overflow-x-hidden md:overflow-y-auto md:border-l md:border-t-0 md:p-3">
          {regions.map((r, i) => (
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
          <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
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
            {world === 'castle' && (
              <button
                onClick={() => {
                  const v = !showRoof
                  setShowRoof(v)
                  const ref = worldRef.current
                  if (ref) ref.castle.ceil.visible = v
                }}
                className={`border px-2 py-1 text-[10px] font-bold transition-colors ${
                  !showRoof
                    ? 'border-sky-400/70 bg-sky-800/50 text-sky-200'
                    : 'border-white/15 bg-black/55 text-white/55 hover:bg-white/10'
                }`}
              >
                {!showRoof ? '🏠 نمای خانه‌عروسکی' : '🔒 سقف‌ها روی‌اند'}
              </button>
            )}
          </div>

          {/* cinematic trigger — castle only */}
          {world === 'castle' && !cineActive && (
            <button
              onClick={startCine}
              className="absolute bottom-24 right-3 z-10 border border-amber-300/70 bg-amber-900/70 px-4 py-2 text-xs font-black text-amber-100 shadow-lg shadow-black/40 hover:bg-amber-800/80 md:bottom-6"
            >
              ▶ پیش‌نمایش سینماتیک: رُخِ شب می‌بردت به قلعه
            </button>
          )}
          {cineActive && (
            <button
              onClick={stopCine}
              className="absolute bottom-24 right-3 z-10 border border-white/30 bg-black/70 px-3 py-2 text-xs font-bold text-white/80 hover:bg-black/85 md:bottom-6"
            >
              ⏭ رد کردن سینماتیک
            </button>
          )}

          {/* letterbox bars */}
          <div
            className="pointer-events-none absolute inset-x-0 top-0 bg-black transition-opacity duration-500"
            style={{ height: '9%', opacity: cineActive ? 1 : 0 }}
          />
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 bg-black transition-opacity duration-500"
            style={{ height: '9%', opacity: cineActive ? 1 : 0 }}
          />

          {/* cinematic captions */}
          {activeCaption && (
            <div className="pointer-events-none absolute inset-x-0 bottom-[11%] text-center">
              <h3 className="text-lg font-black tracking-wide text-amber-100 drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)] md:text-2xl">
                {activeCaption.title}
              </h3>
              <p className="mx-auto mt-1 max-w-xl px-4 text-[11px] leading-5 text-white/85 drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] md:text-sm">
                {activeCaption.sub}
              </p>
            </div>
          )}

          {/* region info card */}
          {showLabels && !cineActive && (
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
