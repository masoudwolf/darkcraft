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
  // wooden planks — board seams and grain for roofs, floors and platforms
  const plankTex = makeTex(16, 25, (c, r, s) => {
    fillNoise(c, r, s, [148, 112, 66], 14)
    for (let y = 0; y < s; y += 4) {
      for (let i = 0; i < s; i++) px(c, i, y, 'rgb(96,70,40)')
    }
    for (let b = 0; b < 3; b++) {
      const x = Math.floor(r() * s)
      for (let y = 0; y < s; y++) px(c, x, y, 'rgb(112,84,50)')
    }
    for (let i = 0; i < 10; i++) px(c, Math.floor(r() * s), Math.floor(r() * s), 'rgb(120,90,54)')
  })
  // mossy cobble — the green-eaten stone of forgotten places
  const mossyTex = makeTex(16, 26, (c, r, s) => {
    fillNoise(c, r, s, [104, 108, 96], 16)
    for (let gy = 0; gy < 4; gy++) {
      for (let gx = 0; gx < 4; gx++) {
        const ox = gx * 4 + Math.floor(r() * 2)
        const oy = gy * 4 + Math.floor(r() * 2)
        for (let i = 0; i < 4; i++) {
          px(c, (ox + i) % s, oy % s, 'rgb(70,74,64)')
          px(c, ox % s, (oy + i) % s, 'rgb(76,80,68)')
        }
      }
    }
    for (let i = 0; i < 26; i++) px(c, Math.floor(r() * s), Math.floor(r() * s), 'rgb(74,112,52)', 1, 2)
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
  /* ---- V2 map materials — the gothic townsfolk palette ---- */
  // dark shingle roof — stepped gable roofs of the dead town
  const roofTex = makeTex(16, 30, (c, r, s) => {
    fillNoise(c, r, s, [112, 68, 46], 12)
    for (let y = 0; y < s; y += 4) {
      for (let i = 0; i < s; i++) px(c, i, y, 'rgb(64,36,24)')
      for (let i = 0; i < s; i += 2) px(c, (i + (y % 8 === 0 ? 0 : 1)) % s, (y + 2) % s, 'rgb(84,52,34)')
    }
    for (let i = 0; i < 8; i++) px(c, Math.floor(r() * s), Math.floor(r() * s), 'rgb(52,28,18)', 2, 1)
  })
  // near-black cathedral brick — parish walls that swallow the moonlight
  const darkBrickTex = makeTex(16, 31, (c, r, s) => {
    fillNoise(c, r, s, [62, 60, 66], 10)
    for (let y = 0; y < s; y += 8) for (let i = 0; i < s; i++) px(c, i, y, 'rgb(38,37,42)')
    for (let y = 4; y < s; y += 8) for (let i = 0; i < s; i++) px(c, (i + 4) % s, y, 'rgb(40,39,44)')
    for (let x = 0; x < s; x += 8) for (let y = 0; y < 8; y++) px(c, x, y, 'rgb(44,43,48)')
  })
  // pale cathedral glass — moonlit windows of the parish
  const glassTex = makeTex(16, 32, (c, r, s) => {
    fillNoise(c, r, s, [168, 196, 214], 16)
    for (let i = 0; i < s; i++) { px(c, i, 0, 'rgb(210,228,240)'); px(c, i, s - 1, 'rgb(120,146,164)') }
    for (let i = 0; i < 5; i++) px(c, Math.floor(r() * s), Math.floor(r() * s), 'rgb(220,238,250)', 2, 2)
  })
  const glass = new THREE.MeshLambertMaterial({ map: glassTex, transparent: true, opacity: 0.82 })
  // rose glass — the shattered faith of the parish window
  const roseTex = makeTex(16, 33, (c, r, s) => {
    fillNoise(c, r, s, [172, 64, 84], 18)
    for (let i = 0; i < s; i++) { px(c, i, 0, 'rgb(214,120,136)'); px(c, i, s - 1, 'rgb(110,32,48)') }
    for (let i = 0; i < 6; i++) px(c, Math.floor(r() * s), Math.floor(r() * s), 'rgb(238,150,160)', 2, 2)
  })
  const rose = new THREE.MeshLambertMaterial({ map: roseTex, transparent: true, opacity: 0.85 })
  // gold — the parish bell, forever calling nobody
  const goldTex = makeTex(16, 34, (c, r, s) => {
    fillNoise(c, r, s, [212, 172, 64], 16)
    for (let i = 0; i < s; i++) { px(c, i, 0, 'rgb(244,214,120)'); px(c, i, s - 1, 'rgb(150,116,38)') }
    for (let i = 0; i < 7; i++) px(c, Math.floor(r() * s), Math.floor(r() * s), 'rgb(248,224,140)', 2, 1)
  })
  // still water — the drowned ravine keeps its secrets
  const waterTex = makeTex(16, 35, (c, r, s) => {
    fillNoise(c, r, s, [44, 74, 108], 14)
    for (let i = 0; i < 10; i++) {
      const y = Math.floor(r() * s)
      for (let x = 0; x < 4; x++) px(c, (Math.floor(r() * s) + x) % s, y, 'rgb(70,110,150)')
    }
  })
  const water = new THREE.MeshLambertMaterial({ map: waterTex, transparent: true, opacity: 0.86 })

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
    plank: lam(plankTex),
    mossy: lam(mossyTex),
    lava: new THREE.MeshBasicMaterial({ map: lavaTex }),
    roof: lam(roofTex),
    darkstone: lam(darkBrickTex),
    glass,
    rose,
    gold: lam(goldTex),
    water,
  }
  return blockMats
}

/* ================= CHARACTER TEXTURES ================= */

export type CharKind = 'player' | 'zombie' | 'boss' | 'creeper' | 'skeleton' | 'wither' | 'blaze' | 'bossflame' | 'merchant'

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
    merchant: [[206, 166, 124], 12],
  }
  const [sb, sv] = skinBase[kind]

  /* lords render at the vanilla 16px resolution — twice the pixel count
     of the common mobs, because a boss fills the screen and every plate
     of his armor is read by the player up close */
  const S = kind === 'boss' || kind === 'bossflame' ? 16 : 8

  /* ---------- FACES (8x8 common mobs, 16x16 lords) ---------- */
  const faceTex = makeTex(S, 30, (c, r, s) => {
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
      // a scarred great-helm: riveted brow, a barred visor slit with two
      // coals burning inside, breath drilled below, rust weeping down
      const steel = 'rgb(116,120,128)'
      const steelD = 'rgb(78,82,90)'
      const steelL = 'rgb(152,158,170)'
      fillNoise(c, r, s, [108, 112, 120], 9)
      // dome shading — dark rim, sheen across the brow
      px(c, 0, 0, steelD, 16, 2)
      px(c, 0, 2, 'rgba(70,74,82,0.5)', 1, 14)
      px(c, 15, 2, 'rgba(70,74,82,0.5)', 1, 14)
      px(c, 3, 2, steelL, 10, 1)
      // riveted brow band
      px(c, 0, 4, steelD, 16, 1)
      for (const x of [1, 5, 10, 14]) px(c, x, 3, steelL)
      // visor slit — black gap, central reinforcement bar, burning coals
      px(c, 2, 6, '#101014', 12, 3)
      px(c, 7, 6, steel, 2, 3)
      px(c, 2, 6, 'rgba(0,0,0,0.45)', 12, 1)
      px(c, 3, 6, '#6a1010', 3, 3)
      px(c, 10, 6, '#6a1010', 3, 3)
      px(c, 3, 7, '#8a1414')
      px(c, 12, 7, '#8a1414')
      px(c, 4, 7, '#ff2a2a')
      px(c, 11, 7, '#ff2a2a')
      // breath holes drilled in two staggered rows
      for (const x of [4, 6, 8, 10, 12]) {
        px(c, x, 10, 'rgba(10,10,12,0.9)')
        px(c, x + 1, 11, 'rgba(10,10,12,0.7)')
      }
      // chin plate
      px(c, 1, 13, steelD, 14, 1)
      px(c, 1, 14, 'rgba(60,64,72,0.8)', 14, 2)
      // battle scars + rust weeping from the seams
      px(c, 5, 2, 'rgba(30,32,36,0.8)', 1, 3)
      px(c, 6, 2, 'rgba(30,32,36,0.55)', 1, 2)
      px(c, 12, 8, 'rgba(30,32,36,0.6)', 2, 1)
      px(c, 2, 12, 'rgba(122,90,60,0.75)', 2, 2)
      px(c, 13, 13, 'rgba(122,90,60,0.6)', 2, 1)
      px(c, 9, 4, 'rgba(122,90,60,0.5)', 1, 2)
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
      // the obsidian visor of the Flame King — gold brow, a white-hot
      // stare, a molten fissure splitting the cheek, ember-flecked jaw
      fillNoise(c, r, s, [44, 36, 40], 7)
      px(c, 0, 1, 'rgb(184,134,42)', 16, 2)
      px(c, 0, 2, 'rgba(120,84,20,0.8)', 16, 1)
      // deep sockets with white-hot cores
      px(c, 2, 5, 'rgba(0,0,0,0.75)', 5, 4)
      px(c, 9, 5, 'rgba(0,0,0,0.75)', 5, 4)
      px(c, 3, 6, '#ff9a2e', 3, 2)
      px(c, 10, 6, '#ff9a2e', 3, 2)
      px(c, 4, 6, '#fff4c8')
      px(c, 4, 7, '#fff4c8')
      px(c, 11, 6, '#fff4c8')
      px(c, 11, 7, '#fff4c8')
      // molten fissure — a jagged diagonal burning down the right cheek
      px(c, 12, 3, '#ff7a1e', 1, 2)
      px(c, 11, 5, '#ff7a1e', 1, 2)
      px(c, 10, 7, '#ff7a1e')
      px(c, 9, 8, '#ff9a2e', 1, 2)
      px(c, 8, 10, '#ff7a1e', 1, 2)
      px(c, 7, 12, '#ff9a2e', 1, 2)
      px(c, 6, 13, 'rgba(255,122,30,0.7)', 1, 2)
      // a dark mouth split with ember teeth
      px(c, 4, 12, 'rgba(8,6,8,0.95)', 8, 2)
      for (const x of [5, 7, 9, 11]) px(c, x, 12, '#c24a18')
      // heat shimmer bleeding at the edges
      px(c, 0, 4, 'rgba(255,122,30,0.35)', 1, 8)
      px(c, 15, 4, 'rgba(255,122,30,0.35)', 1, 8)
      px(c, 2, 15, 'rgba(255,122,30,0.3)', 12, 1)
      return
    }

    if (kind === 'merchant') {
      // a tired, friendly face: warm eyes, grey brows, tidy brown beard
      px(c, 1, 3, 'rgba(96,96,104,0.85)', 2, 1)
      px(c, 5, 3, 'rgba(96,96,104,0.85)', 2, 1)
      px(c, 1, 4, '#2c2013')
      px(c, 2, 4, '#5a3c1c')
      px(c, 5, 4, '#5a3c1c')
      px(c, 6, 4, '#2c2013')
      px(c, 3, 5, 'rgba(0,0,0,0.14)', 2, 1)
      px(c, 2, 6, 'rgba(110,79,48,0.95)', 4, 1) // beard body
      px(c, 3, 7, 'rgba(88,62,38,0.95)', 2, 1) // beard tip
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
    skin: makeTex(S, 31, (c, r, s) => {
      if (kind === 'boss') {
        // great-helm flank — vertical plate seams, rivet columns,
        // low vent slits, rust and scars
        fillNoise(c, r, s, [104, 108, 116], 9)
        px(c, 7, 0, 'rgba(70,74,82,0.85)', 2, 16)
        px(c, 8, 0, 'rgba(150,158,168,0.4)', 1, 16)
        for (const x of [3, 12]) px(c, x, 2, 'rgba(70,74,82,0.6)', 1, 12)
        for (const y of [1, 5, 9]) {
          px(c, 3, y, 'rgb(152,158,170)')
          px(c, 12, y, 'rgb(152,158,170)')
        }
        px(c, 4, 12, 'rgba(12,12,14,0.9)', 8, 1)
        px(c, 4, 14, 'rgba(12,12,14,0.9)', 8, 1)
        px(c, 10, 4, 'rgba(30,32,36,0.7)', 3, 1)
        px(c, 2, 8, 'rgba(30,32,36,0.55)', 1, 3)
        px(c, 5, 10, 'rgba(122,90,60,0.7)', 2, 2)
        px(c, 13, 6, 'rgba(122,90,60,0.55)', 1, 3)
        px(c, 0, 15, 'rgba(50,54,60,0.9)', 16, 1)
        return
      }
      if (kind === 'bossflame') {
        // obsidian flank plates — gold seam ring, ember cracks, edge chips
        fillNoise(c, r, s, [42, 34, 38], 7)
        px(c, 7, 0, 'rgba(20,14,16,0.9)', 2, 16)
        px(c, 0, 7, 'rgb(184,134,42)', 16, 1)
        px(c, 0, 8, 'rgba(120,84,20,0.8)', 16, 1)
        px(c, 11, 2, 'rgba(255,122,30,0.9)', 1, 3)
        px(c, 10, 5, 'rgba(255,122,30,0.7)', 1, 2)
        px(c, 12, 10, 'rgba(255,122,30,0.8)', 1, 2)
        px(c, 3, 11, 'rgba(255,122,30,0.5)', 1, 2)
        px(c, 2, 3, 'rgba(70,60,66,0.8)', 2, 1)
        px(c, 12, 13, 'rgba(70,60,66,0.7)', 2, 1)
        return
      }
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
    }),
    face: faceTex,
    hairTop: makeTex(S, 32, (c, r, s) => {
      if (kind === 'boss') {
        // helm crown — dome sheen, corner rivets, the crest mount burned
        // dark crimson where the plume once bolted on
        fillNoise(c, r, s, [112, 116, 124], 9)
        px(c, 0, 0, 'rgba(60,64,72,0.9)', 16, 1)
        px(c, 0, 15, 'rgba(60,64,72,0.9)', 16, 1)
        px(c, 0, 0, 'rgba(60,64,72,0.7)', 1, 16)
        px(c, 15, 0, 'rgba(60,64,72,0.7)', 1, 16)
        px(c, 2, 1, 'rgb(150,158,168)', 12, 1)
        for (const [x, y] of [[1, 1], [14, 1], [1, 14], [14, 14]]) px(c, x, y, 'rgb(158,164,176)', 2, 2)
        px(c, 6, 6, '#4a1010', 4, 4)
        px(c, 7, 7, '#6a1d1d', 2, 2)
        px(c, 7, 0, 'rgba(90,22,22,0.8)', 2, 3)
        px(c, 5, 9, 'rgba(30,32,36,0.6)', 2, 1)
        px(c, 10, 3, 'rgba(122,90,60,0.6)', 2, 1)
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
        // the crown platform — gold ring, five flame mounts, hot cracks
        fillNoise(c, r, s, [36, 28, 32], 7)
        px(c, 0, 0, 'rgb(184,134,42)', 16, 2)
        px(c, 0, 14, 'rgb(184,134,42)', 16, 2)
        px(c, 0, 2, 'rgba(120,84,20,0.8)', 16, 1)
        px(c, 0, 13, 'rgba(120,84,20,0.8)', 16, 1)
        for (const x of [2, 5, 8, 11, 14]) px(c, x, 7, '#ff7a1e', 2, 2)
        px(c, 8, 4, 'rgba(255,194,61,0.9)', 1, 2)
        px(c, 4, 10, 'rgba(255,122,30,0.6)', 2, 1)
        return
      }
      if (kind === 'creeper') {
        fillNoise(c, r, s, [74, 148, 74], 20)
        blotch(c, r, s, 'rgba(30,80,30,0.85)', 4, 2, 1)
        return
      }
      if (kind === 'merchant') {
        // moss-green hood crown with a stitched rim
        fillNoise(c, r, s, [62, 96, 58], 12)
        px(c, 0, 0, 'rgba(40,62,38,0.9)', 8, 1)
        px(c, 0, 7, 'rgba(40,62,38,0.9)', 8, 1)
        blotch(c, r, s, 'rgba(88,128,80,0.7)', 3, 2, 1)
        return
      }
      fillNoise(c, r, s, [66, 48, 33], 12)
    }),
    body: makeTex(S, 33, (c, r, s) => {
      if (kind === 'boss') {
        // plate cuirass over a torn heraldic tabard — gorget, center
        // ridge, riveted seam, blood-soaked plate, belt, ragged hem
        fillNoise(c, r, s, [108, 112, 120], 9)
        px(c, 0, 0, 'rgba(70,74,82,0.95)', 16, 2)
        px(c, 4, 0, 'rgb(150,158,168)', 8, 1)
        px(c, 7, 2, 'rgb(150,158,168)', 2, 8)
        px(c, 8, 2, 'rgba(70,74,82,0.5)', 1, 8)
        px(c, 0, 6, 'rgba(70,74,82,0.85)', 16, 1)
        for (const x of [1, 5, 10, 14]) px(c, x, 5, 'rgb(152,158,168)')
        px(c, 0, 2, 'rgba(60,64,72,0.55)', 2, 8)
        px(c, 14, 2, 'rgba(60,64,72,0.55)', 2, 8)
        px(c, 3, 3, 'rgba(122,26,26,0.7)', 3, 2)
        px(c, 2, 4, 'rgba(122,26,26,0.4)', 2, 1)
        // the order's faded crimson chevron
        px(c, 6, 8, 'rgba(122,30,30,0.85)', 4, 1)
        px(c, 5, 9, 'rgba(122,30,30,0.85)', 2, 1)
        px(c, 9, 9, 'rgba(122,30,30,0.85)', 2, 1)
        px(c, 6, 9, 'rgba(90,22,22,0.6)', 4, 1)
        px(c, 11, 3, 'rgba(30,32,36,0.7)', 3, 1)
        px(c, 12, 9, 'rgba(30,32,36,0.5)', 1, 2)
        px(c, 0, 11, '#4a3826', 16, 2)
        px(c, 6, 11, '#8a929c', 4, 2)
        px(c, 7, 11, '#5a626c', 2, 2)
        px(c, 0, 13, 'rgb(48,42,38)', 16, 3)
        px(c, 6, 13, 'rgb(100,24,24)', 4, 3)
        px(c, 2, 13, 'rgba(20,18,16,0.9)', 2, 3)
        px(c, 11, 14, 'rgba(20,18,16,0.9)', 2, 2)
        px(c, 5, 15, 'rgba(20,18,16,0.95)', 1, 1)
        px(c, 9, 15, 'rgba(20,18,16,0.95)', 2, 1)
        return
      }
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
        // obsidian cuirass — gold-trimmed, its furnace heart burning
        // behind grate slats, lava fissures running off the core
        fillNoise(c, r, s, [44, 36, 40], 7)
        px(c, 0, 0, 'rgb(184,134,42)', 16, 1)
        px(c, 0, 4, 'rgba(20,14,16,0.95)', 16, 1)
        px(c, 0, 10, 'rgba(20,14,16,0.95)', 16, 1)
        px(c, 5, 5, 'rgba(255,122,30,0.95)', 6, 5)
        px(c, 6, 6, '#ffc23d', 4, 3)
        px(c, 7, 6, '#fff4c8', 2, 2)
        px(c, 5, 7, 'rgba(20,12,10,0.9)', 6, 1)
        px(c, 4, 10, '#ff7a1e', 1, 3)
        px(c, 11, 8, '#ff7a1e', 1, 4)
        px(c, 12, 5, 'rgba(255,122,30,0.7)', 1, 2)
        px(c, 3, 3, 'rgba(255,122,30,0.6)', 2, 1)
        px(c, 0, 1, 'rgb(160,116,30)', 1, 13)
        px(c, 15, 1, 'rgb(160,116,30)', 1, 13)
        px(c, 0, 13, 'rgb(184,134,42)', 16, 2)
        px(c, 6, 13, 'rgb(120,84,20)', 4, 2)
        px(c, 0, 15, 'rgb(24,18,20)', 16, 1)
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
      if (kind === 'merchant') {
        // travelling cloak: moss green, leather belt, brass clasp, satchel strap
        fillNoise(c, r, s, [62, 96, 58], 12)
        blotch(c, r, s, 'rgba(40,62,38,0.75)', 4, 2, 1)
        blotch(c, r, s, 'rgba(96,136,88,0.7)', 3, 1, 1)
        // satchel strap runs diagonal across the chest
        for (let i = 0; i < 8; i++) px(c, i, Math.min(7, Math.max(0, i - 1)), 'rgba(74,54,32,0.95)', 1, 1)
        px(c, 0, 5, '#4a3826', 8, 1) // belt
        px(c, 3, 5, '#c9a44a', 2, 1) // brass buckle
        px(c, 0, 0, 'rgba(40,62,38,0.9)', 8, 1) // hood shadow on the shoulders
        return
      }
      fillNoise(c, r, s, sb, sv)
    }),
    arm: makeTex(S, 34, (c, r, s) => {
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
        // pauldron over a rotted sleeve, then vambrace bands and a
        // riveted gauntlet — every layer of the knight's arm painted
        fillNoise(c, r, s, [108, 112, 120], 9)
        px(c, 0, 0, 'rgba(60,64,72,0.95)', 16, 1)
        px(c, 1, 1, 'rgb(150,158,168)', 14, 1)
        px(c, 2, 3, 'rgb(152,158,170)')
        px(c, 12, 3, 'rgb(152,158,170)')
        px(c, 0, 5, 'rgba(70,74,82,0.95)', 16, 1)
        px(c, 0, 6, 'rgba(20,24,20,0.6)', 16, 1)
        fillNoise2(c, r, s, [50, 56, 50], 12, 7, 11)
        px(c, 3, 8, 'rgba(28,34,28,0.8)', 2, 2)
        px(c, 9, 9, 'rgba(28,34,28,0.7)', 3, 1)
        px(c, 6, 7, 'rgba(16,20,16,0.9)', 1, 2)
        px(c, 12, 10, 'rgba(96,148,86,0.6)', 2, 1)
        px(c, 0, 11, 'rgb(146,152,162)', 16, 2)
        px(c, 0, 12, 'rgba(70,74,82,0.7)', 16, 1)
        px(c, 0, 13, 'rgb(126,132,142)', 16, 1)
        px(c, 0, 14, 'rgb(74,78,88)', 16, 2)
        for (const x of [3, 7, 11]) px(c, x, 14, 'rgb(126,132,142)')
        px(c, 0, 15, 'rgba(40,44,50,0.9)', 16, 1)
        return
      }
      if (kind === 'bossflame') {
        // obsidian pauldron with a gold rim, a molten vein burning down
        // the arm, a gold bracer and a clawed gauntlet
        fillNoise(c, r, s, [42, 34, 38], 7)
        px(c, 0, 0, 'rgba(20,14,16,0.95)', 16, 1)
        px(c, 1, 1, 'rgb(66,56,62)', 14, 3)
        px(c, 0, 4, 'rgb(184,134,42)', 16, 1)
        px(c, 7, 5, '#ff7a1e', 2, 4)
        px(c, 8, 9, 'rgba(255,194,61,0.9)', 1, 2)
        px(c, 6, 9, 'rgba(255,122,30,0.6)', 1, 1)
        px(c, 0, 8, 'rgba(20,14,16,0.8)', 16, 1)
        px(c, 0, 11, 'rgb(184,134,42)', 16, 2)
        px(c, 0, 12, 'rgba(120,84,20,0.9)', 16, 1)
        px(c, 0, 13, 'rgb(30,24,28)', 16, 3)
        for (const x of [3, 7, 11]) px(c, x, 13, 'rgb(120,124,132)')
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
      if (kind === 'merchant') {
        // cloak sleeve with a rolled cuff
        fillNoise(c, r, s, [62, 96, 58], 12)
        px(c, 0, 6, 'rgba(40,62,38,0.9)', 8, 2)
        px(c, 0, 0, 'rgba(40,62,38,0.75)', 8, 1)
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
    leg: makeTex(S, 35, (c, r, s) => {
      if (kind === 'zombie') {
        fillNoise(c, r, s, [74, 66, 76], 12)
        px(c, 3, 3, 'rgba(94,84,94,0.9)', 2, 2)
        px(c, 0, 5, 'rgba(20,20,22,0.6)', 3, 1)
        px(c, 0, 6, 'rgba(40,34,38,0.95)', 8, 2)
        return
      }
      if (kind === 'boss') {
        // cuisse, strapped knee cop, greave and sabaton — a full leg
        // harness for the ancient knight
        fillNoise(c, r, s, [104, 108, 116], 9)
        px(c, 7, 0, 'rgb(150,158,168)', 2, 6)
        px(c, 0, 6, 'rgba(70,74,82,0.85)', 16, 1)
        px(c, 3, 7, 'rgb(150,158,168)', 10, 2)
        px(c, 7, 7, 'rgb(90,94,102)', 2, 2)
        fillNoise2(c, r, s, [96, 100, 108], 9, 9, 13)
        px(c, 0, 11, '#4a3826', 16, 1)
        px(c, 6, 11, '#8a929c', 3, 1)
        px(c, 0, 13, 'rgba(70,74,82,0.95)', 16, 1)
        px(c, 0, 14, 'rgb(52,56,64)', 16, 2)
        px(c, 4, 14, 'rgba(122,90,60,0.5)', 2, 1)
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
        // obsidian cuisse with ember cracks, a gold knee band, a molten
        // greave fissure and a gold-trimmed boot
        fillNoise(c, r, s, [40, 32, 34], 7)
        px(c, 7, 0, 'rgb(66,56,62)', 2, 6)
        px(c, 4, 2, 'rgba(255,122,30,0.85)', 1, 3)
        px(c, 5, 4, 'rgba(255,122,30,0.5)', 1, 1)
        px(c, 0, 6, 'rgba(20,14,16,0.95)', 16, 1)
        px(c, 0, 7, 'rgb(184,134,42)', 16, 1)
        px(c, 0, 8, 'rgba(120,84,20,0.9)', 16, 1)
        fillNoise2(c, r, s, [36, 28, 32], 7, 9, 14)
        px(c, 8, 10, '#ff7a1e', 1, 3)
        px(c, 0, 14, 'rgb(28,22,24)', 16, 2)
        px(c, 0, 15, 'rgb(184,134,42)', 16, 1)
        return
      }
      if (kind === 'merchant') {
        // dark travelling trousers tucked into boots
        fillNoise(c, r, s, [58, 48, 40], 10)
        px(c, 0, 6, 'rgba(34,26,20,0.95)', 8, 2)
        px(c, 0, 0, 'rgba(44,36,30,0.85)', 8, 1)
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

/* ================= GEAR TEXTURES =================
   Pixel-painted materials for everything the unkindled can
   wear or wield — Minecraft-nearest, Dark-Souls soul. Each
   family gets its own painted pattern so a knight's plate,
   a hollow's ragged leather and a bone cuirass read apart
   even before the shape says anything. */

export type GearKind =
  | 'plate' // forged steel — seams, rivets, scratches
  | 'dark' // charcoal plate — ash grain, ember flecks
  | 'bone' // pale bone — cracks and pores
  | 'leather' // ragged leather — patches and stitching
  | 'cloth' // woven cloth — bands and fray
  | 'ember' // smoldering cloth — weave with burning flecks
  | 'hide' // creeper hide — mottled camo
  | 'obsidian' // black glass plate — faint ember veins

const gearTexCache = new Map<string, THREE.CanvasTexture>()
const gearMatCache = new Map<string, THREE.MeshLambertMaterial>()

type RGB = [number, number, number]

const rgbOf = (hex: number): RGB => {
  const c = new THREE.Color(hex)
  return [Math.round(c.r * 255), Math.round(c.g * 255), Math.round(c.b * 255)]
}
const cssOf = (c: RGB, f = 1) => `rgb(${clamp255(c[0] * f)},${clamp255(c[1] * f)},${clamp255(c[2] * f)})`
const mixOf = (a: RGB, b: RGB, t: number): RGB => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
]

function paintGear(ctx: CanvasRenderingContext2D, rng: Rng, s: number, kind: GearKind, B: RGB, A: RGB) {
  const vary = kind === 'obsidian' ? 8 : kind === 'bone' ? 12 : kind === 'dark' ? 10 : 15
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const v = (rng() - 0.5) * vary
      ctx.fillStyle = `rgb(${clamp255(B[0] + v)},${clamp255(B[1] + v)},${clamp255(B[2] + v)})`
      ctx.fillRect(x, y, 1, 1)
    }
  }
  const fpx = (x: number, y: number, f: number, w = 1, h = 1) => px(ctx, x, y, cssOf(B, f), w, h)

  if (kind === 'plate' || kind === 'dark') {
    // two plate seams with rivets below them
    for (const y of [10, 22]) {
      for (let x = 0; x < s; x++) fpx(x, y, kind === 'dark' ? 0.55 : 0.62)
      for (const x of [3, 11, 19, 27]) {
        fpx(x, y + 2, 1.5)
        fpx(x, y + 3, 1.25)
      }
    }
    // battle scratches
    for (let i = 0; i < 7; i++) {
      const x = Math.floor(rng() * s)
      const y = Math.floor(rng() * s)
      const l = 2 + Math.floor(rng() * 4)
      for (let k = 0; k < l; k++) fpx((x + k) % s, y, 1.3)
    }
    if (kind === 'dark') {
      // ash settling on the charcoal
      for (let i = 0; i < 26; i++) px(ctx, Math.floor(rng() * s), Math.floor(rng() * s), cssOf(mixOf(B, [125, 125, 130], 0.55)))
      // a few dying embers
      for (let i = 0; i < 4; i++) px(ctx, Math.floor(rng() * s), Math.floor(rng() * s), cssOf([255, 122, 30], 1))
    }
    for (let x = 0; x < s; x++) {
      fpx(x, 0, 0.85)
      fpx(x, s - 1, 0.72)
    }
  } else if (kind === 'bone') {
    // wiggly vertical cracks
    for (let c = 0; c < 3; c++) {
      let x = 4 + Math.floor(rng() * (s - 8))
      for (let y = 0; y < s; y++) {
        px(ctx, x, y, cssOf(A, 0.5))
        if (rng() < 0.3) x = Math.max(1, Math.min(s - 2, x + (rng() < 0.5 ? 1 : -1)))
        if (rng() < 0.06) break // the crack dies out
      }
    }
    // pores
    for (let i = 0; i < 22; i++) fpx(Math.floor(rng() * s), Math.floor(rng() * s), 0.68)
    // faint growth bands
    for (const y of [7, 15, 23]) for (let x = 0; x < s; x++) if (rng() < 0.6) fpx(x, y, 0.88)
  } else if (kind === 'leather') {
    // worn patches
    for (let i = 0; i < 5; i++) {
      const x = Math.floor(rng() * (s - 6))
      const y = Math.floor(rng() * (s - 5))
      px(ctx, x, y, cssOf(A, 0.9), 4 + Math.floor(rng() * 4), 3 + Math.floor(rng() * 3))
    }
    // stitching dashes
    for (const y of [8, 20]) {
      for (let x = 0; x < s; x += 3) px(ctx, x, y, cssOf(A, 1.45))
    }
    for (let i = 0; i < 14; i++) fpx(Math.floor(rng() * s), Math.floor(rng() * s), 0.7)
  } else if (kind === 'cloth' || kind === 'ember') {
    // the weave — alternating bands + thread hints
    for (let y = 0; y < s; y++) {
      const band = (y >> 1) % 2 === 0 ? 1.04 : 0.92
      for (let x = 0; x < s; x++) if (x % 4 === 0) fpx(x, y, band * 0.96)
    }
    // frayed specks
    for (let i = 0; i < 16; i++) fpx(Math.floor(rng() * s), Math.floor(rng() * s), 0.62)
    if (kind === 'ember') {
      // smoldering flecks burning through the weave
      for (let i = 0; i < 15; i++) {
        const x = Math.floor(rng() * s)
        const y = Math.floor(rng() * s)
        px(ctx, x, y, cssOf([255, 122, 30]))
        if (rng() < 0.4) px(ctx, x + 1, y, cssOf([255, 194, 61]))
      }
    }
  } else if (kind === 'hide') {
    // mottled camo blobs
    for (let i = 0; i < 9; i++) {
      const x = Math.floor(rng() * (s - 3))
      const y = Math.floor(rng() * (s - 3))
      px(ctx, x, y, cssOf(A, rng() < 0.5 ? 0.85 : 1.18), 2 + Math.floor(rng() * 3), 2 + Math.floor(rng() * 2))
    }
    for (let i = 0; i < 12; i++) fpx(Math.floor(rng() * s), Math.floor(rng() * s), 0.7)
  } else {
    // obsidian — glassy streaks over the dark, rare ember veins
    for (let i = 0; i < 3; i++) {
      let x = Math.floor(rng() * s)
      for (let y = 0; y < s; y++) {
        px(ctx, x, y, cssOf(mixOf(B, [120, 110, 118], 0.5)))
        x = (x + 1) % s
      }
    }
    for (let i = 0; i < 6; i++) px(ctx, Math.floor(rng() * s), Math.floor(rng() * s), cssOf([255, 122, 30], 1))
  }
}

/** a shared, texture-painted material for a gear family — the cached
    original is safe for ground drops; humanoids clone before flashing */
export function gearMaterial(kind: GearKind, tint: number, tint2?: number): THREE.MeshLambertMaterial {
  const key = `${kind}|${tint}|${tint2 ?? tint}`
  const hit = gearMatCache.get(key)
  if (hit) return hit
  const B = rgbOf(tint)
  const A = rgbOf(tint2 ?? tint)
  const seed = ((tint * 2654435761) ^ ((tint2 ?? tint) * 40503) ^ (kind.charCodeAt(0) * 2246822519)) >>> 0
  const tex = makeTex(32, seed, (ctx, rng, s) => paintGear(ctx, rng, s, kind, B, A))
  const mat = new THREE.MeshLambertMaterial({ map: tex })
  gearMatCache.set(key, mat)
  return mat
}

/* ---------- weapon materials ---------- */

const bladeMatCache = new Map<string, THREE.MeshLambertMaterial>()

/** painted blade faces per sword style — fuller, glints, rust, granite */
export function bladeMaterial(
  style: 'iron' | 'rust' | 'stone' | 'obsidian' | 'greatsword' | 'kingblade'
): THREE.MeshLambertMaterial {
  const hit = bladeMatCache.get(style)
  if (hit) return hit
  const base: Record<string, RGB> = {
    iron: [205, 212, 222],
    rust: [154, 163, 154],
    stone: [154, 159, 164],
    obsidian: [42, 34, 38],
    greatsword: [148, 154, 148],
    kingblade: [42, 34, 38],
  }
  const B = base[style]
  const tex = makeTex(16, style.length * 977 + 13, (c, r, s) => {
    for (let y = 0; y < s; y++) {
      for (let x = 0; x < s; x++) {
        const v = (r() - 0.5) * 14
        c.fillStyle = `rgb(${clamp255(B[0] + v)},${clamp255(B[1] + v)},${clamp255(B[2] + v)})`
        c.fillRect(x, y, 1, 1)
      }
    }
    // the fuller — a darker column down the middle
    for (let y = 0; y < s; y++) {
      px(c, 7, y, cssOf(B, 0.68))
      px(c, 8, y, cssOf(B, 0.74))
    }
    // edge glints
    for (const y of [2, 9]) for (let x = 0; x < s; x++) if (r() < 0.4) px(c, x, y, cssOf(B, 1.22))
    if (style === 'rust' || style === 'greatsword') {
      for (let i = 0; i < 14; i++) px(c, Math.floor(r() * s), Math.floor(r() * s), 'rgb(122,90,60)', 1 + Math.floor(r() * 2), 1)
      for (let i = 0; i < 3; i++) px(c, Math.floor(r() * s), Math.floor(r() * s), 'rgb(70,54,40)', 2, 1) // nicks
      if (style === 'greatsword') {
        // old pitting — the scars of a century of war
        for (let i = 0; i < 6; i++) px(c, Math.floor(r() * s), Math.floor(r() * s), 'rgb(88,94,88)', 2, 2)
      }
    } else if (style === 'stone') {
      for (let i = 0; i < 18; i++) px(c, Math.floor(r() * s), Math.floor(r() * s), cssOf(B, 0.6))
      for (let i = 0; i < 10; i++) px(c, Math.floor(r() * s), Math.floor(r() * s), cssOf(B, 1.3))
    } else if (style === 'obsidian' || style === 'kingblade') {
      for (let i = 0; i < 5; i++) px(c, Math.floor(r() * s), Math.floor(r() * s), 'rgb(255,122,30)')
      for (let i = 0; i < 8; i++) px(c, Math.floor(r() * s), Math.floor(r() * s), cssOf(B, 2.2))
    }
  })
  const mat = new THREE.MeshLambertMaterial({ map: tex })
  bladeMatCache.set(style, mat)
  return mat
}

const woodMatCache = new Map<string, THREE.MeshLambertMaterial>()

/** painted plank/limb wood — vertical seams and grain streaks */
export function woodMaterial(tint: number, tint2: number): THREE.MeshLambertMaterial {
  const key = `${tint}|${tint2}`
  const hit = woodMatCache.get(key)
  if (hit) return hit
  const B = rgbOf(tint)
  const D = rgbOf(tint2)
  const tex = makeTex(16, (tint ^ 0xb04) >>> 0, (c, r, s) => {
    for (let y = 0; y < s; y++) {
      for (let x = 0; x < s; x++) {
        const v = (r() - 0.5) * 16
        c.fillStyle = `rgb(${clamp255(B[0] + v)},${clamp255(B[1] + v)},${clamp255(B[2] + v)})`
        c.fillRect(x, y, 1, 1)
      }
    }
    for (const x of [5, 11]) for (let y = 0; y < s; y++) px(c, x, y, cssOf(D, 0.9))
    for (let i = 0; i < 9; i++) {
      const y = Math.floor(r() * s)
      const x = Math.floor(r() * s)
      const l = 2 + Math.floor(r() * 3)
      for (let k = 0; k < l; k++) px(c, (x + k) % s, y, cssOf(D, 1.1))
    }
  })
  const mat = new THREE.MeshLambertMaterial({ map: tex })
  woodMatCache.set(key, mat)
  return mat
}
