/* Generate raw AI vocal takes (neural TTS) that will be DSP-processed into
   monster roars, growls, hurt grunts and ghostly wails. */
import ZAI from 'z-ai-web-dev-sdk'
import fs from 'fs'
import path from 'path'

const OUT = path.join(__dirname, '..', 'tts_raw')

interface Take {
  name: string
  text: string
  voice: string
  speed: number
  vol: number
}

const TAKES: Take[] = [
  // big monster roars
  { name: 'roar_a', text: 'Grrraaaaaggghhh!', voice: 'tongtong', speed: 0.5, vol: 4 },
  { name: 'roar_b', text: 'Raaaauuuggghh!', voice: 'xiaochen', speed: 0.5, vol: 4 },
  { name: 'roar_c', text: 'Guurrraaaahhh!', voice: 'kazi', speed: 0.5, vol: 4 },
  { name: 'roar_d', text: 'Aaaarrrggghhhh!', voice: 'jam', speed: 0.5, vol: 4 },
  { name: 'roar_e', text: 'Grraaaoooohhh!', voice: 'luodo', speed: 0.5, vol: 4 },
  { name: 'roar_f', text: 'Huuurrraaagghh!', voice: 'douji', speed: 0.5, vol: 4 },
  { name: 'roar_g', text: 'Uuurrroooagghh!', voice: 'chuichui', speed: 0.5, vol: 4 },
  // deep roars (phase change / boss)
  { name: 'deep_a', text: 'Hmmm... Guuurrrrggghhhh...', voice: 'tongtong', speed: 0.5, vol: 5 },
  { name: 'deep_b', text: 'Uuurrrmmm... Grrrraaaahhhh...', voice: 'xiaochen', speed: 0.5, vol: 5 },
  { name: 'deep_c', text: 'Mmmrrrr... Hoooouuurggghhh...', voice: 'jam', speed: 0.5, vol: 5 },
  { name: 'deep_d', text: 'Grrrrmmm... Aaaaauuurrggghhh...', voice: 'kazi', speed: 0.5, vol: 5 },
  { name: 'deep_e', text: 'Hooommm... Grrruuuaaaggghh...', voice: 'luodo', speed: 0.5, vol: 5 },
  // boss
  { name: 'boss_a', text: 'RRRAAAAAAGGGHHH!', voice: 'tongtong', speed: 0.5, vol: 5 },
  { name: 'boss_b', text: 'GRRAAAOOOWWRR!', voice: 'jam', speed: 0.5, vol: 5 },
  // mid growls
  { name: 'mon_a', text: 'Grrrr!', voice: 'chuichui', speed: 0.6, vol: 3 },
  { name: 'mon_b', text: 'Hsssgrrr!', voice: 'douji', speed: 0.6, vol: 3 },
  { name: 'mon_c', text: 'Grraaap!', voice: 'kazi', speed: 0.6, vol: 3 },
  { name: 'mon_d', text: 'Hurrrg!', voice: 'luodo', speed: 0.6, vol: 3 },
  // giant
  { name: 'giant_a', text: 'Hmmm... Hoohh...', voice: 'tongtong', speed: 0.5, vol: 5 },
  { name: 'giant_b', text: 'Hooo... Mmmrrrh...', voice: 'xiaochen', speed: 0.5, vol: 5 },
  // hurt grunts (human-ish, will only be pitched slightly)
  { name: 'hurt_a', text: 'Ugh!', voice: 'jam', speed: 0.8, vol: 3 },
  { name: 'hurt_b', text: 'Agh!', voice: 'kazi', speed: 0.8, vol: 3 },
  { name: 'hurt_c', text: 'Uh!', voice: 'douji', speed: 0.8, vol: 3 },
  // ghostly shades — breathy
  { name: 'shade_a', text: 'Haaaaaahhh... haaa...', voice: 'tongtong', speed: 0.6, vol: 2 },
  { name: 'shade_b', text: 'Wooooaaahhh...', voice: 'jam', speed: 0.6, vol: 2 },
  { name: 'shade_c', text: 'Hoooohhhh... aaaaahhh...', voice: 'xiaochen', speed: 0.6, vol: 2 },
]

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

async function genRetry(zai: Awaited<ReturnType<typeof ZAI.create>>, t: Take, out: string) {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      // SDK types don't declare `volume` but the API accepts it
      const body = {
        input: t.text,
        voice: t.voice,
        speed: t.speed,
        volume: t.vol,
        response_format: 'wav',
        stream: false,
      }
      const response = await zai.audio.tts.create(body as unknown as Parameters<typeof zai.audio.tts.create>[0])
      const ab = await response.arrayBuffer()
      const buf = Buffer.from(new Uint8Array(ab))
      fs.writeFileSync(out, buf)
      console.log('ok', t.name, buf.length)
      return true
    } catch (e) {
      const msg = (e as Error).message || ''
      if (msg.includes('429')) {
        console.log(`429 on ${t.name}, wait ${8000 * (attempt + 1)}ms`)
        await sleep(8000 * (attempt + 1))
      } else {
        console.error('FAIL', t.name, msg)
        return false
      }
    }
  }
  console.error('GIVEUP', t.name)
  return false
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true })
  const zai = await ZAI.create()
  let pending = 0
  for (const t of TAKES) {
    const out = path.join(OUT, t.name + '.wav')
    if (fs.existsSync(out) && fs.statSync(out).size > 10000) {
      continue
    }
    pending++
    await genRetry(zai, t, out)
    await sleep(2500)
  }
  if (!pending) console.log('all takes already present')
}
main()
