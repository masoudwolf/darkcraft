import * as THREE from 'three'

/* ================= INPUT ================= */

export class Input {
  keys = new Set<string>()
  mouseDX = 0
  mouseDY = 0
  pointerLocked = false
  isTouch = false
  touchMove = { x: 0, y: 0 }
  touchLookDX = 0
  touchLookDY = 0
  wheel = 0

  private presses = new Set<string>()
  private dragging = false
  private dragMoved = 0
  private dragStart = { x: 0, y: 0, t: 0 }
  private disposed = false

  constructor(private canvas: HTMLCanvasElement) {
    this.isTouch =
      typeof window !== 'undefined' &&
      ('ontouchstart' in window || (navigator.maxTouchPoints ?? 0) > 0)

    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)
    window.addEventListener('mousemove', this.onMouseMove)
    window.addEventListener('mouseup', this.onMouseUp)
    canvas.addEventListener('mousedown', this.onMouseDown)
    canvas.addEventListener('contextmenu', this.onContextMenu)
    canvas.addEventListener('wheel', this.onWheel, { passive: true })
    document.addEventListener('pointerlockchange', this.onLockChange)
    window.addEventListener('blur', this.onBlur)
  }

  private onBlur = () => {
    this.keys.clear()
    this.dragging = false
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (e.repeat) return
    if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault()
    this.keys.add(e.code)
    this.presses.add(e.code)
  }

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code)
  }

  private onMouseDown = (e: MouseEvent) => {
    if (e.button === 0) {
      if (this.pointerLocked) {
        this.presses.add('LMB')
      } else {
        this.dragging = true
        this.dragMoved = 0
        this.dragStart = { x: e.clientX, y: e.clientY, t: performance.now() }
      }
    } else if (e.button === 2) {
      this.presses.add('RMB')
    } else if (e.button === 1) {
      this.presses.add('KeyQ')
      e.preventDefault()
    }
  }

  private onMouseUp = (e: MouseEvent) => {
    if (e.button === 0 && this.dragging) {
      this.dragging = false
      // click (not drag) => attack when pointer-lock isn't available
      if (
        !this.pointerLocked &&
        this.dragMoved < 8 &&
        performance.now() - this.dragStart.t < 350
      ) {
        this.presses.add('LMB')
      }
    }
  }

  private onMouseMove = (e: MouseEvent) => {
    if (this.pointerLocked) {
      this.mouseDX += e.movementX
      this.mouseDY += e.movementY
    } else if (this.dragging) {
      this.mouseDX += e.movementX
      this.mouseDY += e.movementY
      this.dragMoved += Math.abs(e.movementX) + Math.abs(e.movementY)
    }
  }

  private onContextMenu = (e: Event) => e.preventDefault()

  private onWheel = (e: WheelEvent) => {
    this.wheel += e.deltaY
  }

  private onLockChange = () => {
    this.pointerLocked = document.pointerLockElement === this.canvas
  }

  requestLock() {
    try {
      const p = this.canvas.requestPointerLock() as unknown as Promise<void> | undefined
      if (p && typeof p.catch === 'function') p.catch(() => {})
    } catch {
      /* sandboxed iframe – drag-look fallback stays active */
    }
  }

  releaseLock() {
    if (document.pointerLockElement === this.canvas) document.exitPointerLock()
  }

  press(name: string) {
    this.presses.add(name)
  }

  consume(name: string): boolean {
    if (this.presses.has(name)) {
      this.presses.delete(name)
      return true
    }
    return false
  }

  axis(): { x: number; z: number } {
    let x = 0
    let z = 0
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) z += 1
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) z -= 1
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x += 1
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) x -= 1
    x += this.touchMove.x
    z += this.touchMove.y
    const len = Math.hypot(x, z)
    if (len > 1) {
      x /= len
      z /= len
    }
    return { x, z }
  }

  takeMouse(): { dx: number; dy: number } {
    const dx = this.mouseDX + this.touchLookDX
    const dy = this.mouseDY + this.touchLookDY
    this.mouseDX = 0
    this.mouseDY = 0
    this.touchLookDX = 0
    this.touchLookDY = 0
    return { dx, dy }
  }

  takeWheel(): number {
    const w = this.wheel
    this.wheel = 0
    return w
  }

  dispose() {
    if (this.disposed) return
    this.disposed = true
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)
    window.removeEventListener('mousemove', this.onMouseMove)
    window.removeEventListener('mouseup', this.onMouseUp)
    this.canvas.removeEventListener('mousedown', this.onMouseDown)
    this.canvas.removeEventListener('contextmenu', this.onContextMenu)
    this.canvas.removeEventListener('wheel', this.onWheel)
    document.removeEventListener('pointerlockchange', this.onLockChange)
    window.removeEventListener('blur', this.onBlur)
  }
}

/* ================= ENGINE ================= */

export class Engine {
  renderer: THREE.WebGLRenderer
  scene = new THREE.Scene()
  camera: THREE.PerspectiveCamera
  input: Input
  onFrame?: (dt: number) => void

  private raf = 0
  private clock = new THREE.Clock()
  private running = false
  private disposed = false
  private basePixelRatio = Math.min(window.devicePixelRatio || 1, 1.25)
  private fpsAcc = 0
  private fpsFrames = 0
  private adaptLevel = 0

  constructor(public container: HTMLElement) {
    const w = container.clientWidth || window.innerWidth
    const h = container.clientHeight || window.innerHeight

    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(this.basePixelRatio)
    this.renderer.setSize(w, h)
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFShadowMap
    this.renderer.domElement.style.display = 'block'
    this.renderer.domElement.style.touchAction = 'none'
    container.appendChild(this.renderer.domElement)

    this.camera = new THREE.PerspectiveCamera(62, w / h, 0.1, 260)

    this.input = new Input(this.renderer.domElement)

    window.addEventListener('resize', this.onResize)
  }

  private onResize = () => {
    const w = this.container.clientWidth || window.innerWidth
    const h = this.container.clientHeight || window.innerHeight
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(w, h)
  }

  /** adaptive resolution for weak devices */
  private tickAdaptive(dt: number) {
    this.fpsAcc += dt
    this.fpsFrames++
    if (this.fpsAcc >= 2.5) {
      const avg = this.fpsFrames / this.fpsAcc
      this.fpsAcc = 0
      this.fpsFrames = 0
      if (avg < 24 && this.adaptLevel < 3) {
        this.adaptLevel++
        const r = this.basePixelRatio * [1, 0.8, 0.66, 0.5][this.adaptLevel]
        this.renderer.setPixelRatio(r)
      }
    }
  }

  start() {
    if (this.running) return
    this.running = true
    this.clock.start()
    const loop = () => {
      if (!this.running) return
      this.raf = requestAnimationFrame(loop)
      const dt = Math.min(this.clock.getDelta(), 0.05)
      this.tickAdaptive(dt)
      this.onFrame?.(dt)
      this.renderer.render(this.scene, this.camera)
    }
    this.raf = requestAnimationFrame(loop)
  }

  dispose() {
    if (this.disposed) return
    this.disposed = true
    this.running = false
    cancelAnimationFrame(this.raf)
    this.input.dispose()
    window.removeEventListener('resize', this.onResize)
    this.renderer.dispose()
    if (this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement)
    }
  }
}
