import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { SPREAD_COUNT } from '@/components/labs/storybook/content'
import { artRequests, layersForSpread, MERGED_FAMILIES } from './art-requests'

/**
 * INFRA-2 — the per-spread TEXTURE FILE budget.
 *
 * `texLive` (the live GPU probe's headline number) is dominated by how many
 * distinct image FILES a spread's warm window has to fetch, and that number is
 * decidable from three committed artefacts alone: content.ts (which layers a
 * spread mounts), manifest.json (which of their art ids actually exist), and
 * atlas.json (which of those ids are packed onto a shared page). This test does
 * that arithmetic, so a spread that quietly regrows a dozen loose webps fails
 * here rather than months later on a device probe.
 *
 * The subtlety the s6 lane recorded: a sidecar entry only saves an upload if the
 * RENDERER can address a sub-rect. Before INFRA-2, `popup-box-layer.tsx` and
 * friends called `useArtTexture`, which fetches `<id>.webp` whether or not the
 * sidecar maps that id — so packing those faces would have cost a page and saved
 * nothing. `art-requests.ts` carries the sprite-vs-loose flag per family, and
 * the count below honours it.
 */

const ART_DIR = path.join(process.cwd(), 'public', 'labs', 'storybook', 'art')
const manifest: readonly string[] = JSON.parse(readFileSync(path.join(ART_DIR, 'manifest.json'), 'utf8'))
const atlas: { pages: Record<string, number>; sprites: Record<string, { atlas: string }> } = JSON.parse(
  readFileSync(path.join(ART_DIR, 'atlas.json'), 'utf8')
)

const artIds = new Set(manifest)
const pageOf = (id: string): string | null => atlas.sprites[id]?.atlas ?? null

/** Chapter spreads carry the pop-up scenes; 1/8/9 are the decorative title,
 *  satchel and end spreads. Spread 0 is the closed cover (no content). */
const CHAPTER_SPREADS = [2, 3, 4, 5, 6, 7] as const

/** The texture FILES a spread's warm window fetches: its page print plus, per
 *  layer, either the atlas page a sprite-aware family resolves through or the
 *  loose webp everything else fetches. Ids with no baked art cost nothing (they
 *  fall back to a procedural placeholder painted on the CPU). */
export function spreadTextureFiles(spread: number): ReadonlySet<string> {
  const files = new Set<string>()
  if (artIds.has(`page-${spread}`)) files.add(`page-${spread}`)

  for (const layer of layersForSpread(spread)) {
    const requests = artRequests(layer).filter((r) => artIds.has(r.id))
    if (requests.length === 0) continue

    // A merged single-material mesh resolves all-or-nothing (`useAtlasSet`):
    // one id off the shared page and the whole family falls back to per-face
    // loose fetches, which is a cliff, not a gradient.
    if (MERGED_FAMILIES.has(layer.mech)) {
      const pages = new Set(requests.map((r) => pageOf(r.id)))
      const merged = pages.size === 1 && !pages.has(null)
      if (merged) {
        files.add([...pages][0]!)
        continue
      }
      for (const r of requests) files.add(r.id)
      continue
    }

    for (const r of requests) {
      const page = r.sprite ? pageOf(r.id) : null
      files.add(page ?? r.id)
    }
  }
  return files
}

describe('per-spread texture FILE budget (INFRA-2)', () => {
  it('keeps every chapter spread at or under 8 texture files', () => {
    const over = CHAPTER_SPREADS.map((s) => [s, spreadTextureFiles(s).size] as const).filter(([, n]) => n > 8)
    expect(
      over.map(([s, n]) => `spread ${s}: ${n}`),
      'chapter spreads over the 8-file budget'
    ).toEqual([])
  })

  it('keeps the decorative spreads (title, satchel, end) at or under 8 too', () => {
    const over = [1, 8, 9].map((s) => [s, spreadTextureFiles(s).size] as const).filter(([, n]) => n > 8)
    expect(over.map(([s, n]) => `spread ${s}: ${n}`)).toEqual([])
  })

  it('keeps the whole book under the 60-texture live budget across any warm window', () => {
    // The warm window is the current spread ± 1, so the worst case is the
    // largest sum of three consecutive spreads — the real ceiling a probe sees,
    // not the book-wide union.
    const counts = Array.from({ length: SPREAD_COUNT }, (_, s) => spreadTextureFiles(s).size)
    let worst = 0
    for (let s = 0; s < SPREAD_COUNT; s++) {
      const window = new Set<string>()
      for (const n of [s - 1, s, s + 1]) {
        if (n < 0 || n >= SPREAD_COUNT) continue
        for (const f of spreadTextureFiles(n)) window.add(f)
      }
      worst = Math.max(worst, window.size)
    }
    expect(counts.length).toBe(SPREAD_COUNT)
    expect(worst, `worst warm-window texture-file count: ${worst}`).toBeLessThanOrEqual(60)
  })

  it('never packs an id onto an atlas page that no renderer can address', () => {
    // A sidecar entry for a loose-only family is worse than useless: it costs a
    // slot on the page AND still fetches the webp. Every packed id must belong
    // to a sprite-aware request somewhere in the book.
    const spriteAware = new Set<string>()
    for (let s = 0; s < SPREAD_COUNT; s++) {
      for (const layer of layersForSpread(s)) {
        for (const r of artRequests(layer)) if (r.sprite) spriteAware.add(r.id)
      }
    }
    const stranded = Object.keys(atlas.sprites).filter((id) => !spriteAware.has(id))
    expect(stranded, `atlas ids no renderer can address as a sub-rect: ${stranded.join(', ')}`).toEqual([])
  })
})
