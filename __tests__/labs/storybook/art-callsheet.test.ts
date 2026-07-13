import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  CHAPTERS,
  EXTRA_SPREAD_LAYERS,
  SPREAD_COUNT,
  type SceneLayer,
} from '@/components/labs/storybook/content'
import { SATCHEL_ITEMS } from '@/components/labs/storybook/satchel-items'

// D-G7: the art call sheet (docs/superpowers/art-call-sheet.md) is the
// interface document artists generate against. This test keeps it from
// silently rotting as layers are added/removed/renamed: every layer id
// must get its own entry, and every asset-key-shaped token the doc mentions
// must match a construction pattern the renderers actually use.

const DOC_PATH = path.join(process.cwd(), 'docs', 'superpowers', 'art-call-sheet.md')
const doc = readFileSync(DOC_PATH, 'utf8')

function allLayers(): readonly SceneLayer[] {
  const layers: SceneLayer[] = []
  for (const chapter of CHAPTERS) layers.push(...chapter.layers)
  for (const extra of Object.values(EXTRA_SPREAD_LAYERS)) layers.push(...extra)
  return layers
}

/**
 * Every id/key legitimately allowed to appear as a standalone backtick-
 * wrapped token in a call-sheet table row: every layer id (the "Layer id"
 * column) plus every ASSET KEY the renderers actually construct from that
 * layer (the "Asset key(s)" column), plus the handful of fixed, non-layer
 * book-level ids. Mirrors the real construction rules:
 *  - popup-box-layer.tsx's FACE_ART table gated by capFront/capBack/roof
 *    (walls -side always present; -front iff capFront; -back iff capBack;
 *    -top iff roof !== 'open' — an open-roof box has no lid/roof patches).
 *  - popup-platform-layer.tsx: `<id>-deck`.
 *  - popup-tabpiece-layer.tsx: `<id>-face`.
 *  - popup-anatomy-layers.tsx's fanMemberLayers: `<id>-m<index>`, 0-based.
 *  - Every other mech (vfold/child/rider/dress/rotor/stripflap/kinetic)
 *    requests its OWN layer id with no suffix (useLayerTexture/useArtTexture
 *    called with `layer.id` directly).
 */
function knownGoodIds(): ReadonlySet<string> {
  const ids = new Set<string>()
  for (const layer of allLayers()) {
    ids.add(layer.id)
    if (layer.mech === 'box') {
      ids.add(`${layer.id}-side`)
      if (layer.capFront ?? true) ids.add(`${layer.id}-front`)
      if (layer.capBack ?? true) ids.add(`${layer.id}-back`)
      if (layer.roof !== 'open') ids.add(`${layer.id}-top`)
    }
    if (layer.mech === 'platform') ids.add(`${layer.id}-deck`)
    if (layer.mech === 'tabpiece') ids.add(`${layer.id}-face`)
    if (layer.mech === 'fan') {
      layer.members.forEach((_, i) => ids.add(`${layer.id}-m${i}`))
    }
  }
  // Fixed, book-level ids not tied to any content.ts layer (cover-decals.tsx,
  // use-page-print.ts, satchel-items.ts's HTML-overlay icons).
  ids.add('cover-crest')
  ids.add('cover-corner')
  for (let spread = 1; spread <= SPREAD_COUNT - 1; spread++) ids.add(`page-${spread}`)
  for (const item of SATCHEL_ITEMS) ids.add(item.assetId)
  return ids
}

/** Asset-key shape: lowercase alnum, hyphen-separated, starting with a
 *  letter. Deliberately excludes things prose in the doc also wraps in
 *  backticks that are NOT concrete asset keys: partial suffixes like
 *  `-front`, code fields like `capFront:false`, filenames like
 *  `ch1-stable.webp`, and pattern templates like `<id>-front`/`page-<spread>`. */
const ASSET_KEY_SHAPE = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/

describe('art call sheet — doc/code sync (D-G7)', () => {
  it('gives every content.ts layer id its own call-sheet entry', () => {
    const ids = Array.from(new Set(allLayers().map((l) => l.id)))
    const missing = ids.filter((id) => !doc.includes(`\`${id}\``))
    expect(missing, `layer ids with no \`backtick\` entry in the call sheet: ${missing.join(', ')}`).toEqual([])
  })

  it('mentions every fixed book-level asset id (covers, page prints, satchel-drawer icons)', () => {
    const fixed = [
      'cover-crest',
      'cover-corner',
      ...Array.from({ length: SPREAD_COUNT - 1 }, (_, i) => `page-${i + 1}`),
      ...SATCHEL_ITEMS.map((item) => item.assetId),
    ]
    const missing = fixed.filter((id) => !doc.includes(`\`${id}\``))
    expect(missing, `fixed asset ids missing from the call sheet: ${missing.join(', ')}`).toEqual([])
  })

  it('every asset-key-shaped backtick token in a spread table row matches a real construction pattern', () => {
    // Scoped to the per-spread sections (## 2 onward): section 1's
    // conventions tables use bare mechanism names (`box`, `platform`, ...)
    // in backticks as pattern documentation, not concrete asset keys, and
    // pattern templates like `<id>-front`/`page-<spread>` (which fail
    // ASSET_KEY_SHAPE anyway thanks to the angle brackets).
    const scopeStart = doc.indexOf('## 2. Chapter I')
    expect(scopeStart, 'expected the call sheet to contain a "## 2. Chapter I" section').toBeGreaterThan(0)
    const scoped = doc.slice(scopeStart)

    const known = knownGoodIds()
    const unmatched = new Set<string>()
    for (const line of scoped.split('\n')) {
      if (!line.trimStart().startsWith('|')) continue
      for (const match of line.matchAll(/`([^`]+)`/g)) {
        const token = match[1]
        if (!ASSET_KEY_SHAPE.test(token)) continue
        if (!known.has(token)) unmatched.add(token)
      }
    }
    expect(
      Array.from(unmatched),
      `asset-key-shaped tokens with no matching construction pattern: ${Array.from(unmatched).join(', ')}`
    ).toEqual([])
  })

  it('flags no orphaned box/platform/tabpiece/fan asset key as missing from the sheet', () => {
    // The inverse direction of the previous test: every key the renderers
    // would actually REQUEST for a box/platform/tabpiece/fan layer must
    // appear in the sheet too, not just keys the sheet happens to mention.
    const constructed: string[] = []
    for (const layer of allLayers()) {
      if (layer.mech === 'box') {
        constructed.push(`${layer.id}-side`)
        if (layer.capFront ?? true) constructed.push(`${layer.id}-front`)
        if (layer.capBack ?? true) constructed.push(`${layer.id}-back`)
        if (layer.roof !== 'open') constructed.push(`${layer.id}-top`)
      }
      if (layer.mech === 'platform') constructed.push(`${layer.id}-deck`)
      if (layer.mech === 'tabpiece') constructed.push(`${layer.id}-face`)
      if (layer.mech === 'fan') layer.members.forEach((_, i) => constructed.push(`${layer.id}-m${i}`))
    }
    const missing = constructed.filter((key) => !doc.includes(`\`${key}\``))
    expect(missing, `constructed asset keys missing from the call sheet: ${missing.join(', ')}`).toEqual([])
  })
})
