/** headless build-test for CastleZone — finds the perf bottleneck */
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
}
main()
