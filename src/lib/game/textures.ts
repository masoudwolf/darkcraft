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
  // netherrack — the bruised red stone of the Ash Wastes
  const netherTex = makeTex(16, 23, (c, r, s) => {
    fillNoise(c, r, s, [98, 44, 38], 22)
    for (let i = 0; i < 12; i++) px(c, Math.floor(r() * s), Math.floor(r() * s), 'rgb(66,26,22)', 2, 2)
    for (let i = 0; i < 7; i++) px(c, Math.floor(r() * s), Math.floor(r() * s), 'rgb(146,58,44)', 1, 1)
  })
  // lava — glowing cells (unlit material so it reads as molten)
  const lavaTex = makeTex(32, 24, (c, r, s) => {
    fillNoise(c, r, s, [244, 110, 18], 30)
    for (let i = 0; i < 26; i++) px(c, Math.floor(r() * (s - 2)), Math.floor(r() * (s - 2)), 'rgb(255,208,64)', 2, 2)
    for (let i = 0; i < 18; i++) px(c, Math.floor(r() * (s - 2)), Math.floor(r() * (s - 2)), 'rgb(150,44,10)', 2, 1)
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
    nether: lam(netherTex),
    lava: new THREE.MeshBasicMaterial({ map: lavaTex }),
  }
  return blockMats
}

/* ================= CHARACTER TEXTURES ================= */

export type CharKind = 'player' | 'zombie' | 'boss' | 'creeper' | 'skeleton' | 'wither' | 'blaze' | 'bossflame'

interface CharTexs {
  skin: THREE.Texture
  face: THREE.Texture
  hairTop: THREE.Texture
  body: THREE.Texture
  arm: THREE.Texture
  leg: THREE.Texture
}

const charTexs: Record<string, CharTexs> = {}

/** scattered patches — rot, camo, moss, embers */
function blotch(
  ctx: CanvasRenderingContext2D,
  rng: Rng,
  s: number,
  color: string,
  n: number,
  w = 2,
  h = 2
) {
  for (let i = 0; i < n; i++) {
    px(ctx, Math.floor(rng() * s), Math.floor(rng() * s), color, w, h)
  }
}

function getCharTexs(kind: CharKind): CharTexs {
  if (charTexs[kind]) return charTexs[kind]

  /* per-kind base palettes for the plain-noise fallbacks */
  const skinBase: Record<CharKind, [[number, number, number], number]> = {
    player: [[198, 152, 110], 14],
    zombie: [[96, 148, 86], 16],
    boss: [[118, 140, 100], 12],
    creeper: [[88, 168, 88], 24],
    skeleton: [[224, 220, 204], 10],
    wither: [[56, 54, 58], 10],
    blaze: [[236, 176, 52], 24],
    bossflame: [[52, 42, 44], 10],
  }
  const [sb, sv] = skinBase[kind]

  /* ---------- FACES (8x8, the soul of every mob) ---------- */
  const faceTex = makeTex(8, 30, (c, r, s) => {
    fillNoise(c, r, s, sb, sv)

    if (kind === 'creeper') {
      // the iconic face — kept canonical
      const bl = '#0d1f0d'
      px(c, 1, 2, bl, 2, 2)
      px(c, 5, 2, bl, 2, 2)
      px(c, 3, 4, bl, 2, 1)
      px(c, 2, 5, bl, 4, 2)
      px(c, 2, 7, bl, 1, 1)
      px(c, 5, 7, bl, 1, 1)
      return
    }

    if (kind === 'zombie') {
      // sunken brow + dead black eyes + ragged mouth
      px(c, 1, 3, 'rgba(0,0,0,0.30)', 2, 1)
      px(c, 5, 3, 'rgba(0,0,0,0.30)', 2, 1)
      px(c, 2, 4, '#0c120c')
      px(c, 5, 4, '#0c120c')
      px(c, 1, 4, 'rgba(20,34,20,0.55)')
      px(c, 6, 4, 'rgba(20,34,20,0.55)')
      px(c, 2, 5, 'rgba(30,50,28,0.6)')
      px(c, 5, 5, 'rgba(30,50,28,0.6)')
      px(c, 3, 5, 'rgba(0,0,0,0.15)', 2, 1)
      px(c, 2, 6, 'rgba(16,26,16,0.95)', 1, 1)
      px(c, 4, 6, 'rgba(16,26,16,0.95)', 2, 1)
      px(c, 3, 7, '#b8c0a8') // a lone tooth
      return
    }

    if (kind === 'boss') {
      // ancient knight corpse: helm shadow, burning red eyes, ragged beard
      px(c, 0, 2, 'rgba(0,0,0,0.45)', 8, 1)
      px(c, 1, 3, 'rgba(120,20,20,0.9)', 2, 1)
      px(c, 5, 3, 'rgba(120,20,20,0.9)', 2, 1)
      px(c, 1, 4, '#8a1414')
      px(c, 6, 4, '#8a1414')
      px(c, 2, 4, '#ff2a2a')
      px(c, 5, 4, '#ff2a2a')
      px(c, 1, 5, 'rgba(0,0,0,0.28)')
      px(c, 6, 5, 'rgba(0,0,0,0.28)')
      px(c, 3, 5, 'rgba(0,0,0,0.2)', 2, 1)
      px(c, 2, 6, 'rgba(24,30,22,0.95)', 4, 1)
      px(c, 1, 7, 'rgba(58,66,50,0.95)', 6, 1) // grey stubble
      return
    }

    if (kind === 'skeleton') {
      // skull: brow ridge, hollow sockets, nasal gap, grinning teeth
      px(c, 1, 2, 'rgba(150,142,124,0.9)', 2, 1)
      px(c, 5, 2, 'rgba(150,142,124,0.9)', 2, 1)
      px(c, 1, 3, '#141414', 2, 2)
      px(c, 5, 3, '#141414', 2, 2)
      px(c, 1, 3, 'rgba(206,202,186,0.55)') // faint glint of empty bone
      px(c, 0, 5, 'rgba(120,112,96,0.8)')
      px(c, 7, 5, 'rgba(120,112,96,0.8)')
      px(c, 3, 5, 'rgba(90,84,70,0.95)', 2, 1)
      px(c, 1, 6, '#d8d4c4', 6, 1)
      px(c, 2, 6, '#6a6456')
      px(c, 4, 6, '#6a6456')
      px(c, 6, 6, '#6a6456')
      px(c, 2, 7, 'rgba(0,0,0,0.18)', 4, 1)
      return
    }

    if (kind === 'wither') {
      // charcoal skull with embers burning inside the sockets
      px(c, 1, 2, 'rgba(20,18,22,0.9)', 2, 1)
      px(c, 5, 2, 'rgba(20,18,22,0.9)', 2, 1)
      px(c, 1, 3, '#0c0a0c', 2, 2)
      px(c, 5, 3, '#0c0a0c', 2, 2)
      px(c, 2, 4, '#ff9a3a')
      px(c, 5, 4, '#ff9a3a')
      px(c, 3, 5, '#26242a', 2, 1)
      px(c, 2, 6, '#26242a', 4, 1)
      px(c, 4, 0, 'rgba(255,123,36,0.55)', 1, 2) // glowing crack on the crown
      return
    }

    if (kind === 'blaze') {
      // white-hot eyes over a dark smoke maw
      px(c, 1, 3, '#fff6d8', 2, 2)
      px(c, 5, 3, '#fff6d8', 2, 2)
      px(c, 1, 5, 'rgba(255,150,40,0.85)', 2, 1)
      px(c, 5, 5, 'rgba(255,150,40,0.85)', 2, 1)
      px(c, 3, 5, '#4a2208', 2, 2)
      blotch(c, r, s, 'rgba(90,42,8,0.5)', 4, 1, 1)
      return
    }

    if (kind === 'bossflame') {
      // burning glare + a molten crack splitting the jaw
      px(c, 1, 2, 'rgba(0,0,0,0.55)', 2, 1)
      px(c, 5, 2, 'rgba(0,0,0,0.55)', 2, 1)
      px(c, 1, 3, '#ffd23d', 2, 1)
      px(c, 5, 3, '#ffd23d', 2, 1)
      px(c, 2, 4, '#fff4c8')
      px(c, 5, 4, '#fff4c8')
      px(c, 2, 5, '#c24a18', 4, 1)
      px(c, 3, 6, '#ff7a1e', 2, 1)
      px(c, 1, 6, '#8a2c10')
      px(c, 0, 4, 'rgba(255,122,30,0.6)')
      px(c, 7, 4, 'rgba(255,122,30,0.6)')
      return
    }

    // player — classic minecraft eyes + brow + mouth
    px(c, 1, 4, '#ffffff')
    px(c, 2, 4, '#4a4ac0')
    px(c, 5, 4, '#4a4ac0')
    px(c, 6, 4, '#ffffff')
    px(c, 1, 3, 'rgba(0,0,0,0.25)', 2, 1)
    px(c, 5, 3, 'rgba(0,0,0,0.25)', 2, 1)
    px(c, 3, 5, 'rgba(0,0,0,0.18)', 2, 1)
    px(c, 3, 6, 'rgb(122,82,62)', 2, 1)
  })

  /* ---------- BODY PARTS ---------- */
  const texs: CharTexs = {
    skin: makeTex(8, 31, (c, r, s) => {
      fillNoise(c, r, s, sb, sv)
      if (kind === 'zombie') {
        blotch(c, r, s, 'rgba(44,80,40,0.85)', 5, 2, 1)
        blotch(c, r, s, 'rgba(150,192,124,0.8)', 4, 1, 1)
      }
      if (kind === 'creeper') {
        blotch(c, r, s, 'rgba(30,80,30,0.9)', 8, 2, 2)
        blotch(c, r, s, 'rgba(150,214,140,0.75)', 5, 1, 1)
        blotch(c, r, s, 'rgba(60,130,60,0.8)', 4, 2, 1)
      }
      if (kind === 'skeleton') {
        // hairline bone cracks + age stains
        for (let i = 0; i < 3; i++) {
          const x = Math.floor(r() * 6), y = Math.floor(r() * 5)
          px(c, x, y, 'rgba(130,120,100,0.7)', 1, 2)
          px(c, x + 1, y + 1, 'rgba(130,120,100,0.5)')
        }
        blotch(c, r, s, 'rgba(178,168,140,0.5)', 2, 2, 1)
      }
      if (kind === 'wither') {
        blotch(c, r, s, 'rgba(24,22,26,0.8)', 4, 2, 1)
        px(c, Math.floor(r() * s), Math.floor(r() * s), 'rgba(255,123,36,0.85)', 1, 1)
        px(c, Math.floor(r() * s), Math.floor(r() * s), 'rgba(255,123,36,0.6)', 1, 1)
      }
      if (kind === 'blaze') {
        blotch(c, r, s, 'rgba(255,224,120,0.9)', 3, 2, 2)
        blotch(c, r, s, 'rgba(90,42,8,0.45)', 5, 1, 1)
      }
      if (kind === 'bossflame') {
        for (let i = 0; i < 3; i++) {
          px(c, Math.floor(r() * s), Math.floor(r() * s), 'rgba(255,122,30,0.85)', 1, 2)
        }
        blotch(c, r, s, 'rgba(20,14,16,0.9)', 3, 2, 1)
      }
    }),
    face: faceTex,
    hairTop: makeTex(8, 32, (c, r, s) => {
      if (kind === 'boss') {
        // iron helm crown with rivets and battle scratches
        fillNoise(c, r, s, [100, 104, 112], 10)
        px(c, 0, 0, 'rgba(60,64,72,0.9)', 8, 1)
        px(c, 0, 7, 'rgba(60,64,72,0.9)', 8, 1)
        px(c, 1, 1, '#565a64'); px(c, 6, 1, '#565a64')
        px(c, 1, 6, '#565a64'); px(c, 6, 6, '#565a64')
        blotch(c, r, s, 'rgba(150,158,168,0.8)', 3, 2, 1)
        return
      }
      if (kind === 'zombie') {
        fillNoise(c, r, s, [80, 122, 72], 14)
        blotch(c, r, s, 'rgba(52,84,48,0.8)', 4, 1, 1)
        return
      }
      if (kind === 'skeleton') {
        fillNoise(c, r, s, [206, 200, 182], 10)
        px(c, Math.floor(r() * 6), 3, 'rgba(130,120,100,0.7)', 1, 2)
        return
      }
      if (kind === 'wither') {
        fillNoise(c, r, s, [44, 42, 46], 8)
        px(c, 3, 2, 'rgba(255,123,36,0.6)', 1, 1)
        return
      }
      if (kind === 'blaze') {
        fillNoise(c, r, s, [214, 140, 36], 20)
        blotch(c, r, s, 'rgba(255,224,120,0.9)', 3, 2, 1)
        return
      }
      if (kind === 'bossflame') {
        fillNoise(c, r, s, [38, 30, 32], 8)
        px(c, 2, 4, 'rgba(255,122,30,0.7)', 1, 2)
        px(c, 6, 1, 'rgba(255,122,30,0.5)', 1, 1)
        return
      }
      if (kind === 'creeper') {
        fillNoise(c, r, s, [74, 148, 74], 20)
        blotch(c, r, s, 'rgba(30,80,30,0.85)', 4, 2, 1)
        return
      }
      fillNoise(c, r, s, [66, 48, 33], 12)
    }),
    body: makeTex(8, 33, (c, r, s) => {
      if (kind === 'zombie') {
        // torn teal tunic: moss stains, holes with rot showing through, ragged hem
        fillNoise(c, r, s, [44, 96, 82], 14)
        blotch(c, r, s, 'rgba(30,58,38,0.75)', 5, 2, 2)
        for (let i = 0; i < 3; i++) {
          const x = Math.floor(r() * 6), y = 2 + Math.floor(r() * 4)
          px(c, x, y, 'rgba(12,20,12,0.95)', 2, 1)
          px(c, x, y, 'rgba(96,148,86,0.9)', 1, 1)
        }
        px(c, 0, 7, 'rgba(20,30,22,0.95)', 8, 1)
        px(c, 2, 7, 'rgba(44,96,82,1)')
        px(c, 5, 7, 'rgba(52,104,88,1)')
        return
      }
      if (kind === 'boss') {
        // steel chestplate: center ridge, rivets, belt, tattered skirt
        fillNoise(c, r, s, [108, 112, 120], 10)
        px(c, 3, 0, 'rgba(150,158,168,0.85)', 2, 6)
        px(c, 0, 0, 'rgba(60,64,72,0.9)', 8, 1)
        px(c, 0, 0, 'rgba(60,64,72,0.7)', 1, 6)
        px(c, 7, 0, 'rgba(60,64,72,0.7)', 1, 6)
        px(c, 1, 1, '#565a64'); px(c, 6, 1, '#565a64')
        px(c, 0, 4, '#565a64'); px(c, 7, 4, '#565a64')
        blotch(c, r, s, 'rgba(120,26,26,0.5)', 2, 2, 1)
        px(c, 0, 6, '#4a3826', 8, 1)
        px(c, 3, 6, '#9aa0a8', 2, 1)
        px(c, 0, 7, '#33383a', 8, 1)
        px(c, 1, 7, '#22262a')
        px(c, 5, 7, '#22262a')
        return
      }
      if (kind === 'skeleton') {
        // ribcage: horizontal bone gaps + bright sternum + pelvis
        fillNoise(c, r, s, [216, 212, 196], 10)
        px(c, 0, 2, 'rgba(138,132,114,0.9)', 8, 1)
        px(c, 0, 4, 'rgba(138,132,114,0.9)', 8, 1)
        px(c, 0, 6, 'rgba(138,132,114,0.9)', 8, 1)
        px(c, 3, 1, 'rgba(238,234,218,0.9)', 2, 5)
        px(c, 0, 0, 'rgba(150,142,124,0.9)', 2, 1)
        px(c, 6, 0, 'rgba(150,142,124,0.9)', 2, 1)
        px(c, 0, 7, 'rgba(160,152,132,0.9)', 8, 1)
        px(c, 3, 7, 'rgba(138,132,114,0.9)', 2, 1)
        return
      }
      if (kind === 'wither') {
        // charred ribcage with embers nested between the bones
        fillNoise(c, r, s, [66, 64, 70], 10)
        px(c, 0, 2, 'rgba(38,36,42,0.9)', 8, 1)
        px(c, 0, 4, 'rgba(38,36,42,0.9)', 8, 1)
        px(c, 0, 6, 'rgba(38,36,42,0.9)', 8, 1)
        px(c, 3, 1, 'rgba(92,88,96,0.9)', 2, 5)
        px(c, 1, 3, 'rgba(255,123,36,0.85)', 1, 1)
        px(c, 6, 5, 'rgba(255,123,36,0.7)', 1, 1)
        return
      }
      if (kind === 'blaze') {
        fillNoise(c, r, s, [196, 124, 32], 18)
        blotch(c, r, s, 'rgba(255,214,100,0.9)', 3, 2, 1)
        blotch(c, r, s, 'rgba(60,40,20,0.55)', 6, 1, 1)
        return
      }
      if (kind === 'bossflame') {
        // obsidian plates split by glowing lava veins
        fillNoise(c, r, s, [46, 36, 38], 8)
        px(c, 0, 2, 'rgba(20,14,16,0.95)', 8, 1)
        px(c, 0, 5, 'rgba(20,14,16,0.95)', 8, 1)
        px(c, 0, 5, 'rgb(160,40,20)', 8, 1)
        for (let i = 0; i < 4; i++) {
          px(c, Math.floor(r() * s), Math.floor(r() * s), 'rgb(255,122,30)', 1, 2)
        }
        px(c, 4, 3, 'rgb(255,200,80)')
        return
      }
      if (kind === 'creeper') {
        fillNoise(c, r, s, [84, 162, 84], 20)
        blotch(c, r, s, 'rgba(30,80,30,0.9)', 6, 2, 2)
        blotch(c, r, s, 'rgba(150,214,140,0.7)', 3, 1, 1)
        return
      }
      if (kind === 'player') {
        fillNoise(c, r, s, [0, 148, 148], 14)
        return
      }
      fillNoise(c, r, s, sb, sv)
    }),
    arm: makeTex(8, 34, (c, r, s) => {
      if (kind === 'player') {
        // sleeve + bare forearm
        fillNoise(c, r, s, [0, 148, 148], 14)
        for (let y = 5; y < s; y++)
          for (let x = 0; x < s; x++) {
            const v = (r() - 0.5) * 14
            px(c, x, y, `rgb(${clamp255(198 + v)},${clamp255(152 + v)},${clamp255(110 + v)})`)
          }
        return
      }
      if (kind === 'zombie') {
        fillNoise(c, r, s, [96, 148, 86], 16)
        blotch(c, r, s, 'rgba(44,80,40,0.85)', 4, 2, 1)
        px(c, 0, 6, 'rgba(40,60,36,0.45)', 8, 2)
        return
      }
      if (kind === 'boss') {
        // pauldron + torn sleeve + gauntlet
        px(c, 0, 0, '#7c828c', 8, 3)
        px(c, 0, 0, 'rgba(60,64,72,0.9)', 8, 1)
        px(c, 1, 1, '#565a64', 1, 1)
        px(c, 5, 2, '#565a64', 1, 1)
        fillNoise2(c, r, s, [50, 56, 50], 12, 3, 6)
        px(c, 0, 3, 'rgba(20,24,20,0.6)', 8, 1)
        px(c, 0, 6, '#8d939c', 8, 2)
        px(c, 0, 6, 'rgba(60,64,72,0.8)', 8, 1)
        return
      }
      if (kind === 'skeleton') {
        fillNoise(c, r, s, [224, 220, 204], 10)
        px(c, 0, 0, 'rgba(150,142,124,0.9)', 8, 1)
        px(c, 0, 7, 'rgba(150,142,124,0.9)', 8, 1)
        px(c, 3, 3, 'rgba(130,120,100,0.7)', 1, 2)
        return
      }
      if (kind === 'wither') {
        fillNoise(c, r, s, [56, 54, 58], 10)
        px(c, 0, 0, 'rgba(30,28,32,0.9)', 8, 1)
        px(c, 0, 7, 'rgba(30,28,32,0.9)', 8, 1)
        px(c, 5, 4, 'rgba(255,123,36,0.7)', 1, 1)
        return
      }
      if (kind === 'bossflame') {
        fillNoise(c, r, s, [52, 42, 44], 10)
        px(c, 0, 5, 'rgba(184,134,42,0.95)', 8, 1) // gold bracer
        px(c, 2, 2, 'rgba(255,122,30,0.8)', 1, 2)
        px(c, 0, 7, 'rgba(20,14,16,0.9)', 8, 1)
        return
      }
      fillNoise(c, r, s, sb, sv)
      if (kind === 'blaze') {
        blotch(c, r, s, 'rgba(255,224,120,0.9)', 3, 2, 1)
      }
      if (kind === 'creeper') {
        blotch(c, r, s, 'rgba(30,80,30,0.9)', 5, 2, 1)
      }
    }),
    leg: makeTex(8, 35, (c, r, s) => {
      if (kind === 'zombie') {
        fillNoise(c, r, s, [74, 66, 76], 12)
        px(c, 3, 3, 'rgba(94,84,94,0.9)', 2, 2)
        px(c, 0, 5, 'rgba(20,20,22,0.6)', 3, 1)
        px(c, 0, 6, 'rgba(40,34,38,0.95)', 8, 2)
        return
      }
      if (kind === 'boss') {
        // armored greave: knee plate, strap, dark boot
        fillNoise(c, r, s, [104, 108, 116], 10)
        px(c, 2, 2, 'rgba(150,158,168,0.9)', 4, 2)
        px(c, 0, 4, 'rgba(58,44,30,0.95)', 8, 1)
        px(c, 0, 6, 'rgba(60,64,70,0.95)', 8, 2)
        px(c, 0, 0, 'rgba(60,64,72,0.7)', 8, 1)
        return
      }
      if (kind === 'skeleton') {
        fillNoise(c, r, s, [212, 208, 192], 10)
        px(c, 0, 0, 'rgba(145,140,126,0.9)', 8, 1)
        px(c, 3, 3, 'rgba(238,234,218,0.9)', 2, 1)
        px(c, 0, 7, 'rgba(145,140,126,0.9)', 8, 1)
        px(c, 1, 5, 'rgba(130,120,100,0.6)', 1, 2)
        return
      }
      if (kind === 'wither') {
        fillNoise(c, r, s, [48, 46, 50], 10)
        px(c, 0, 0, 'rgba(28,26,30,0.9)', 8, 1)
        px(c, 0, 7, 'rgba(28,26,30,0.9)', 8, 1)
        px(c, 6, 3, 'rgba(255,123,36,0.6)', 1, 1)
        return
      }
      if (kind === 'bossflame') {
        fillNoise(c, r, s, [40, 32, 34], 8)
        px(c, 0, 2, 'rgba(20,14,16,0.9)', 8, 1)
        px(c, 4, 4, 'rgba(255,122,30,0.8)', 1, 2)
        px(c, 0, 6, 'rgba(24,18,20,0.95)', 8, 2)
        return
      }
      fillNoise(c, r, s, sb, sv)
      if (kind === 'creeper') {
        blotch(c, r, s, 'rgba(30,80,30,0.85)', 5, 2, 1)
      }
      if (kind === 'blaze') {
        blotch(c, r, s, 'rgba(255,224,120,0.8)', 2, 2, 1)
      }
    }),
  }
  charTexs[kind] = texs
  return texs
}

/** fill only a horizontal band of rows (rows y0..y1-1) */
function fillNoise2(
  ctx: CanvasRenderingContext2D,
  rng: Rng,
  s: number,
  base: [number, number, number],
  vary: number,
  y0: number,
  y1: number
) {
  for (let y = y0; y < y1; y++) {
    for (let x = 0; x < s; x++) {
      const v = (rng() - 0.5) * vary
      ctx.fillStyle = `rgb(${clamp255(base[0] + v)},${clamp255(base[1] + v)},${clamp255(base[2] + v)})`
      ctx.fillRect(x, y, 1, 1)
    }
  }
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

/* ================= FOG-GATE SMOKE (live GPU fog) =================

   The old canvas-texture fog pooled into corners and went patchy —
   a vignette baked into a tiny bitmap can never fill a wall. This
   shader fog is the opposite: an fbm noise field whose DENSITY stays
   uniform across the whole curtain (noise sculpts light and shade,
   never coverage), billowing slowly in two counter-scrolling layers,
   with a soft blend into the stone frame only at the outermost edge. */

const FOG_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const FOG_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform float uTime;
uniform float uSeed;
uniform vec2 uScale;
uniform vec2 uDrift;
uniform float uOpacity;
uniform vec3 uDeep;
uniform vec3 uMid;
uniform vec3 uHi;

float hash(vec2 p) {
  p = fract(p * vec2(234.34, 435.345));
  p += dot(p, p + 34.23);
  return fract(p.x * p.y);
}
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 5; i++) {
    v += a * vnoise(p);
    p = rot * p * 2.03 + vec2(3.7);
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 p = vUv;
  float t = uTime;

  // two smoke fields drifting in opposite directions; the first one's
  // fbm WARPS the second so billows roll and fold like real vapour
  vec2 q1 = p * uScale + vec2(t * uDrift.x, t * uDrift.y) + uSeed;
  vec2 q2 = p * uScale * 1.9 - vec2(t * uDrift.y * 1.6, t * uDrift.x * 1.1) + uSeed * 1.7 + 11.3;
  float warp = fbm(q1 * 1.4);
  float n1 = fbm(q1 + warp * 0.85);
  float n2 = fbm(q2 + warp * 0.55);
  float smoke = n1 * 0.62 + n2 * 0.38;

  // UNIFORM body — density stays high everywhere; no holes, no pooling
  float dens = 0.8 + smoke * 0.2;
  // the whole curtain breathes, very gently
  dens *= 0.97 + 0.03 * sin(t * 0.6 + uSeed * 3.0);

  // blend into the stone frame only at the outermost few percent
  vec2 e = min(p, 1.0 - p);
  float edge = smoothstep(0.0, 0.09, min(e.x, e.y));

  // colour: slate shadows inside billows, pale mist riding the crests
  vec3 col = mix(uDeep, uMid, smoothstep(0.28, 0.72, smoke));
  col = mix(col, uHi, smoothstep(0.66, 0.96, smoke));
  col += vec3(0.035, 0.04, 0.05) * p.y; // faint lift toward the lintel

  gl_FragColor = vec4(col, dens * edge * uOpacity);
}
`

export interface FogMatOptions {
  seed?: number
  scale?: [number, number]
  drift?: [number, number]
  opacity?: number
  deep?: number
  mid?: number
  hi?: number
}

export function createFogMaterial(opts: FogMatOptions = {}): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uSeed: { value: opts.seed ?? 0 },
      uScale: { value: new THREE.Vector2(...(opts.scale ?? [2.6, 2.0])) },
      uDrift: { value: new THREE.Vector2(...(opts.drift ?? [0.05, 0.032])) },
      uOpacity: { value: opts.opacity ?? 0.96 },
      uDeep: { value: new THREE.Color(opts.deep ?? 0x39414b) },
      uMid: { value: new THREE.Color(opts.mid ?? 0x8b97a2) },
      uHi: { value: new THREE.Color(opts.hi ?? 0xd8dee6) },
    },
    vertexShader: FOG_VERT,
    fragmentShader: FOG_FRAG,
  })
}
