/** headless build-test for CastleZone — perf check + VOID audit.
    Finds every column inside the castle island that should carry a
    floor but has none (the "empty patches" the player reported). */
// mock the DOM canvas API before importing the texture module
;(globalThis as unknown as { document: unknown }).document = {
  createElement: () => {
    const ctx = {
      fillStyle: '',
      fillRect: () => {},
      clearRect: () => {},
      getImageData: () => ({ data: new Uint8ClampedArray(4) }),
      putImageData: () => {},
    }
    return {
      width: 0,
      height: 0,
      getContext: () => ctx,
    }
  },
}

async function main() {
  const { CastleZone } = await import('../src/lib/game/castle')
  const t0 = performance.now()
  const cz = new CastleZone()
  const ms = Math.round(performance.now() - t0)
  let meshes = 0
  let instances = 0
  cz.group.traverse((o: any) => {
    if (o.isInstancedMesh) {
      meshes++
      instances += o.count
    }
  })
  let cmeshes = 0
  let cinst = 0
  cz.ceil.traverse((o: any) => {
    if (o.isInstancedMesh) {
      cmeshes++
      cinst += o.count
    }
  })
  console.log(`CastleZone built in ${ms}ms | group: ${meshes} instanced meshes / ${instances} blocks | ceil: ${cmeshes} / ${cinst}`)

  /* ---- VOID AUDIT ----
     Mirrors sealVoids(): a cell is a hole when the terrain skip owns
     it, the heightmap says it should have floor, and no builder laid
     one (chasm + crypt stairwell excluded by design). */
  const HALF = 64
  const builtAt = (x: number, z: number) =>
    (Math.abs(x) <= 21 && z <= 21 && z >= -32) ||
    (Math.abs(x) <= 27 && z >= 15 && z <= 34) ||
    (Math.abs(x) <= 12 && z >= 34 && z <= 41) ||
    (Math.abs(x) <= 6 && z >= 40 && z <= 59) ||
    (x >= -32 && x <= -11 && z >= -4 && z <= 32) ||
    (x >= 9 && x <= 10 && z >= -7 && z <= -6)
  const holes: string[] = []
  const seen = new Set<string>()
  for (let z = -HALF; z < HALF; z++)
    for (let x = -HALF; x < HALF; x++) {
      if (!builtAt(x, z)) continue
      if (x >= -8 && x <= 8 && z >= 41 && z <= 58) continue // the chasm
      if (x >= 9 && x <= 10 && z >= -7 && z <= -6) continue // the stairwell
      const h = cz.getH(x, z)
      if (h <= 0) continue
      const y = Math.min(h, 13)
      if (!cz.solidStruct(x, y, z) && !cz.solidStruct(x, y - 1, z)) {
        const k = `${Math.floor(x / 4)},${Math.floor(z / 4)}`
        if (!seen.has(k)) {
          seen.add(k)
          holes.push(`HOLE x=${x} z=${z}`)
        }
      }
    }
  console.log(`\nVOID AUDIT — ${holes.length} remaining holes:`)
  for (const h of holes) console.log('  ' + h)
}
main()
