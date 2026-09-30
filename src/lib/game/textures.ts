import * as THREE from 'three'

/* ---------- deterministic pixel rng ---------- */
export type Rng = () => number

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const clamp255 = (v: number) => Math.max(0, Math.min(255, v | 0))

export function makeTex(
  size: number,
  seed: number,
  draw: (ctx: CanvasRenderingContext2D, rng: Rng, s: number) => void
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')!
  draw(ctx, mulberry32(seed), size)
  const tex = new THREE.CanvasTexture(canvas)
  tex.magFilter = THREE.NearestFilter
  tex.minFilter = THREE.NearestFilter
  tex.generateMipmaps = false
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

function fillNoise(
  ctx: CanvasRenderingContext2D,
  rng: Rng,
  s: number,
  base: [number, number, number],
  vary: number
) {
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const v = (rng() - 0.5) * vary
      ctx.fillStyle = `rgb(${clamp255(base[0] + v)},${clamp255(base[1] + v)},${clamp255(base[2] + v)})`
      ctx.fillRect(x, y, 1, 1)
    }
  }
}

function px(ctx: CanvasRenderingContext2D, x: number, y: number, c: string, w = 1, h = 1) {
  ctx.fillStyle = c
  ctx.fillRect(x, y, w, h)
}

/* ================= BLOCK TEXTURES ================= */

let blockMats: Record<string, THREE.Material | THREE.Material[]> | null = null

export function blockMaterials(): Record<string, THREE.Material | THREE.Material[]> {
  if (blockMats) return blockMats

  const lam = (map: THREE.Texture) => new THREE.MeshLambertMaterial({ map })

  const grassTopTex = makeTex(16, 11, (c, r, s) => fillNoise(c, r, s, [98, 148, 62], 30))
  const dirtTex = makeTex(16, 12, (c, r, s) => fillNoise(c, r, s, [124, 88, 58], 26))
  const grassSideTex = makeTex(16, 13, (c, r, s) => {
    fillNoise(c, r, s, [124, 88, 58], 26)
    for (let x = 0; x < s; x++) {
      const d = 3 + Math.floor(r() * 2)
      for (let y = 0; y < d; y++) {
        const v = (r() - 0.5) * 30
        px(c, x, y, `rgb(${clamp255(98 + v)},${clamp255(148 + v)},${clamp255(62 + v)})`)
      }
    }
  })
  const stoneTex = makeTex(16, 14, (c, r, s) => fillNoise(c, r, s, [128, 128, 128], 20))
  const cobbleTex = makeTex(16, 15, (c, r, s) => {
    fillNoise(c, r, s, [112, 112, 112], 16)
    // cobble cell borders
    for (let gy = 0; gy < 4; gy++) {
      for (let gx = 0; gx < 4; gx++) {
        const ox = gx * 4 + Math.floor(r() * 2)
        const oy = gy * 4 + Math.floor(r() * 2)
        for (let i = 0; i < 4; i++) {
          px(c, (ox + i) % s, oy % s, 'rgb(78,78,78)')
          px(c, ox % s, (oy + i) % s, 'rgb(84,84,84)')
        }
      }
    }
  })
  const stoneBrickTex = makeTex(16, 16, (c, r, s) => {
    fillNoise(c, r, s, [138, 138, 138], 14)
    for (let i = 0; i < s; i++) {
      px(c, i, 0, 'rgb(95,95,95)')
      px(c, i, 8, 'rgb(95,95,95)')
      px(c, 0, i, 'rgb(95,95,95)')
      px(c, 8, i, 'rgb(100,100,100)')
    }
    for (let i = 0; i < 6; i++) px(c, Math.floor(r() * s), Math.floor(r() * s), 'rgb(105,105,105)')
  })
  const logSideTex = makeTex(16, 17, (c, r, s) => {
    fillNoise(c, r, s, [108, 82, 50], 14)
    for (let x = 0; x < s; x++) {
      if (r() < 0.4) {
        for (let y = 0; y < s; y++) {
          const v = (r() - 0.5) * 10
          px(c, x, y, `rgb(${clamp255(84 + v)},${clamp255(62 + v)},${clamp255(38 + v)})`)
        }
      }
    }
  })
  const logTopTex = makeTex(16, 18, (c, r, s) => {
    fillNoise(c, r, s, [154, 124, 76], 14)
    const ring = (o: number, col: string) => {
      for (let i = o; i < s - o; i++) {
        px(c, i, o, col)
        px(c, i, s - 1 - o, col)
        px(c, o, i, col)
        px(c, s - 1 - o, i, col)
      }
    }
    ring(1, 'rgb(110,86,52)')
    ring(3, 'rgb(120,94,58)')
    ring(5, 'rgb(110,86,52)')
  })
  const leavesTex = makeTex(16, 19, (c, r, s) => {
    fillNoise(c, r, s, [58, 108, 44], 34)
    for (let i = 0; i < 40; i++) {
      px(c, Math.floor(r() * s), Math.floor(r() * s), 'rgb(38,76,30)')
    }
  })
  const coalTex = makeTex(16, 20, (c, r, s) => {
    fillNoise(c, r, s, [120, 120, 120], 18)
    for (let i = 0; i < 9; i++) {
      const x = Math.floor(r() * 13), y = Math.floor(r() * 13)
      px(c, x, y, 'rgb(38,38,38)', 2 + Math.floor(r() * 2), 2)
    }
  })
  const glowTex = makeTex(16, 21, (c, r, s) => {
    fillNoise(c, r, s, [226, 186, 96], 40)
    for (let i = 0; i < 14; i++) {
      px(c, Math.floor(r() * s), Math.floor(r() * s), 'rgb(255,232,150)', 2, 2)
    }
  })
  const fogTex = makeTex(32, 22, (c, r, s) => {
    const img = c.createImageData(s, s)
    for (let i = 0; i < s * s; i++) {
      const a = 90 + Math.floor(r() * 130)
      img.data[i * 4] = 235
      img.data[i * 4 + 1] = 238
      img.data[i * 4 + 2] = 240
      img.data[i * 4 + 3] = a
    }
    c.putImageData(img, 0, 0)
  })

  const grassSide = lam(grassSideTex)
  blockMats = {
    grass: [grassSide, grassSide, lam(grassTopTex), lam(dirtTex), grassSide, grassSide],
    dirt: lam(dirtTex),
    stone: lam(stoneTex),
    cobble: lam(cobbleTex),
    stonebrick: lam(stoneBrickTex),
    log: lam(logSideTex),
    logTop: lam(logTopTex),
    leaves: lam(leavesTex),
    coal: lam(coalTex),
    glow: lam(glowTex),
    fog: new THREE.MeshBasicMaterial({
      map: fogTex,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  }
  return blockMats
}

/* ================= CHARACTER TEXTURES ================= */

export type CharKind = 'player' | 'zombie' | 'boss' | 'creeper' | 'skeleton'

interface CharTexs {
  skin: THREE.Texture
  face: THREE.Texture
  hairTop: THREE.Texture
  body: THREE.Texture
  arm: THREE.Texture
  leg: THREE.Texture
}

const charTexs: Record<string, CharTexs> = {}

function getCharTexs(kind: CharKind): CharTexs {
  if (charTexs[kind]) return charTexs[kind]

  const cfg = {
    player: {
      skin: [198, 152, 110] as [number, number, number],
      skinVary: 14,
      hairTop: [66, 48, 33] as [number, number, number],
      body: [0, 148, 148] as [number, number, number],
      arm: [198, 152, 110] as [number, number, number],
      sleeve: true,
      leg: [58, 62, 112] as [number, number, number],
      eye: '#4a4ac0',
      mouth: [122, 82, 62] as [number, number, number],
    },
    zombie: {
      skin: [96, 148, 86] as [number, number, number],
      skinVary: 18,
      hairTop: [80, 122, 72] as [number, number, number],
      body: [44, 96, 82] as [number, number, number],
      arm: [96, 148, 86] as [number, number, number],
      sleeve: false,
      leg: [74, 66, 76] as [number, number, number],
      eye: '#101410',
      mouth: [40, 64, 40] as [number, number, number],
    },
    boss: {
      skin: [118, 140, 100] as [number, number, number],
      skinVary: 14,
      hairTop: [72, 62, 50] as [number, number, number],
      body: [108, 112, 120] as [number, number, number],
      arm: [118, 122, 130] as [number, number, number],
      sleeve: false,
      leg: [88, 92, 100] as [number, number, number],
      eye: '#c82828',
      mouth: [50, 56, 46] as [number, number, number],
    },
    creeper: {
      skin: [96, 176, 96] as [number, number, number],
      skinVary: 30,
      hairTop: [74, 148, 74] as [number, number, number],
      body: [84, 162, 84] as [number, number, number],
      arm: [96, 176, 96] as [number, number, number],
      sleeve: false,
      leg: [78, 152, 78] as [number, number, number],
      eye: '#0d1f0d',
      mouth: [12, 24, 12] as [number, number, number],
    },
    skeleton: {
      skin: [224, 220, 204] as [number, number, number],
      skinVary: 16,
      hairTop: [206, 200, 182] as [number, number, number],
      body: [216, 212, 196] as [number, number, number],
      arm: [224, 220, 204] as [number, number, number],
      sleeve: false,
      leg: [212, 208, 192] as [number, number, number],
      eye: '#141414',
      mouth: [64, 60, 52] as [number, number, number],
    },
  }[kind]

  const faceTex = makeTex(8, 30, (c, r, s) => {
    fillNoise(c, r, s, cfg.skin, cfg.skinVary)
    if (kind === 'creeper') {
      // iconic creeper face on an 8x8 grid
      const bl = '#0d1f0d'
      px(c, 1, 2, bl, 2, 2) // left eye
      px(c, 5, 2, bl, 2, 2) // right eye
      px(c, 3, 4, bl, 2, 1) // mouth top
      px(c, 2, 5, bl, 4, 2) // mouth wide
      px(c, 2, 7, bl, 1, 1) // fang left
      px(c, 5, 7, bl, 1, 1) // fang right
      return
    }
    if (kind === 'skeleton') {
      // hollow black sockets + grim teeth — the classic skull grid
      px(c, 1, 3, '#141414', 2, 2)
      px(c, 5, 3, '#141414', 2, 2)
      px(c, 3, 5, '#3a362e', 2, 1)
      px(c, 2, 6, '#3a362e', 4, 1)
      px(c, 3, 7, '#cfcaba', 1, 1) // tooth gaps
      px(c, 5, 7, '#cfcaba', 1, 1)
      return
    }
    // eyes (minecraft style)
    px(c, 1, 4, '#ffffff')
    px(c, 2, 4, cfg.eye)
    px(c, 5, 4, cfg.eye)
    px(c, 6, 4, '#ffffff')
    // brow
    px(c, 1, 3, 'rgba(0,0,0,0.25)', 2, 1)
    px(c, 5, 3, 'rgba(0,0,0,0.25)', 2, 1)
    // nose + mouth
    px(c, 3, 5, 'rgba(0,0,0,0.18)', 2, 1)
    px(c, 3, 6, `rgb(${cfg.mouth[0]},${cfg.mouth[1]},${cfg.mouth[2]})`, 2, 1)
  })

  const texs: CharTexs = {
    skin: makeTex(8, 31, (c, r, s) => {
      fillNoise(c, r, s, cfg.skin, cfg.skinVary)
      if (kind === 'creeper') {
        // camo patches
        for (let i = 0; i < 9; i++) {
          px(c, Math.floor(r() * s), Math.floor(r() * s), 'rgba(38,92,38,0.85)', 2, 2)
        }
        for (let i = 0; i < 6; i++) {
          px(c, Math.floor(r() * s), Math.floor(r() * s), 'rgba(150,214,140,0.7)', 2, 1)
        }
      }
    }),
    face: faceTex,
    hairTop: makeTex(8, 32, (c, r, s) => fillNoise(c, r, s, cfg.hairTop, 12)),
    body: makeTex(8, 33, (c, r, s) => {
      fillNoise(c, r, s, cfg.body, 16)
      if (kind === 'skeleton') {
        // ribcage shading — dark horizontal bone gaps
        px(c, 0, 2, '#8a8578', s, 1)
        px(c, 0, 4, '#8a8578', s, 1)
        px(c, 0, 6, '#8a8578', s, 1)
        px(c, 3, 1, '#9a9484', 2, 5)
      }
      if (kind === 'creeper') {
        for (let i = 0; i < 8; i++) {
          px(c, Math.floor(r() * s), Math.floor(r() * s), 'rgba(38,92,38,0.85)', 2, 2)
        }
      }
      if (kind === 'zombie') {
        for (let i = 0; i < 8; i++) {
          px(c, Math.floor(r() * s), Math.floor(r() * s), 'rgba(20,30,20,0.6)', 2, 2)
        }
      }
      if (kind === 'boss') {
        for (let i = 0; i < 6; i++) {
          px(c, Math.floor(r() * s), Math.floor(r() * s), 'rgb(70,74,82)')
        }
        px(c, 0, 5, 'rgb(140,40,40)', 8, 1)
      }
    }),
    arm: makeTex(8, 34, (c, r, s) => {
      if (cfg.sleeve) {
        fillNoise(c, r, s, cfg.body, 14)
        for (let y = 5; y < s; y++)
          for (let x = 0; x < s; x++) {
            const v = (r() - 0.5) * cfg.skinVary
            px(c, x, y, `rgb(${clamp255(cfg.arm[0] + v)},${clamp255(cfg.arm[1] + v)},${clamp255(cfg.arm[2] + v)})`)
          }
      } else {
        fillNoise(c, r, s, cfg.arm, cfg.skinVary)
      }
    }),
    leg: makeTex(8, 35, (c, r, s) => {
      fillNoise(c, r, s, cfg.leg, 14)
      if (kind === 'skeleton') {
        // bone joint shading
        px(c, 0, 0, '#918c7e', s, 1)
        px(c, 0, 7, '#918c7e', s, 1)
      }
      if (kind === 'creeper') {
        for (let i = 0; i < 6; i++) {
          px(c, Math.floor(r() * s), Math.floor(r() * s), 'rgba(38,92,38,0.85)', 2, 1)
        }
      }
    }),
  }
  charTexs[kind] = texs
  return texs
}

export interface CharMats {
  head: THREE.Material[]
  body: THREE.MeshLambertMaterial
  arm: THREE.MeshLambertMaterial
  leg: THREE.MeshLambertMaterial
  all: THREE.MeshLambertMaterial[]
}

export function characterMaterials(kind: CharKind): CharMats {
  const t = getCharTexs(kind)
  const mk = (map: THREE.Texture) => new THREE.MeshLambertMaterial({ map })
  const side = mk(t.skin)
  const top = mk(t.hairTop)
  const bottom = mk(t.skin)
  const face = mk(t.face)
  const body = mk(t.body)
  const arm = mk(t.arm)
  const leg = mk(t.leg)
  return {
    head: [side, side, top, bottom, face, side], // +z = face
    body,
    arm,
    leg,
    all: [side, top, bottom, face, body, arm, leg],
  }
}
