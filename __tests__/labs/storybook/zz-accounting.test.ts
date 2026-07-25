import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, it } from 'vitest'
import { SPREAD_COUNT } from '@/components/labs/storybook/content'
import { artRequests, layersForSpread, MERGED_FAMILIES } from './art-requests'

const ART_DIR = path.join(process.cwd(), 'public', 'labs', 'storybook', 'art')
const manifest: readonly string[] = JSON.parse(readFileSync(path.join(ART_DIR, 'manifest.json'), 'utf8'))
const atlas: { sprites: Record<string, { atlas: string }> } = JSON.parse(
  readFileSync(path.join(ART_DIR, 'atlas.json'), 'utf8')
)
const artIds = new Set(manifest)
const pageOf = (id: string): string | null => atlas.sprites[id]?.atlas ?? null

// PRE-INFRA-2 sprite set: only keepstack/skyline/stripflap/swarmarc/oanave.
const OLD_SPRITE = new Set(['keepstack', 'skyline', 'stripflap', 'swarmarc', 'oanave'])

function files(spread: number, old: boolean): Set<string> {
  const out = new Set<string>()
  if (artIds.has(`page-${spread}`)) out.add(`page-${spread}`)
  for (const layer of layersForSpread(spread)) {
    const reqs = artRequests(layer).filter((r) => artIds.has(r.id))
    if (!reqs.length) continue
    const spriteOk = old ? OLD_SPRITE.has(layer.mech) : true
    if (MERGED_FAMILIES.has(layer.mech)) {
      const pages = new Set(reqs.map((r) => pageOf(r.id)))
      if (spriteOk && pages.size === 1 && !pages.has(null)) {
        out.add([...pages][0]!)
        continue
      }
      for (const r of reqs) out.add(r.id)
      continue
    }
    for (const r of reqs) {
      const page = spriteOk && r.sprite ? pageOf(r.id) : null
      out.add(page ?? r.id)
    }
  }
  return out
}

describe('accounting dump', () => {
  it('prints per-spread counts', () => {
    for (let s = 0; s < SPREAD_COUNT; s++) {
      const before = files(s, true)
      const after = files(s, false)
      console.log(`spread ${s}: before=${before.size} after=${after.size}`)
      console.log(`   before: ${[...before].sort().join(' ')}`)
      if (after.size !== before.size) console.log(`   after : ${[...after].sort().join(' ')}`)
    }
  })
})
