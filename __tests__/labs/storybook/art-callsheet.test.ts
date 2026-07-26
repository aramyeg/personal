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
 *  - popup-platform-layer.tsx: `<id>-deck` plus `<id>-strut` (optional —
 *    struts fall back to raw kraft when the art is not baked).
 *  - popup-tabpiece-layer.tsx: `<id>-face`, plus an OPTIONAL `<id>-tab` (a
 *    painted pull tab; without it the tab wears the shared kraft grip texture,
 *    so the key is allowed in the sheet but never required of a piece).
 *  - popup-anatomy-layers.tsx's fanMemberLayers: `<id>-m<index>`, 0-based.
 *  - popup-knobtower-layer.tsx: `<id>-disc` (the knob) + `<id>-tier<k>` per
 *    tier, 0-based (KnobDisc/KnobTier request them directly).
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
    if (layer.mech === 'platform') {
      ids.add(`${layer.id}-deck`)
      ids.add(`${layer.id}-strut`)
    }
    if (layer.mech === 'tabpiece') {
      ids.add(`${layer.id}-face`)
      ids.add(`${layer.id}-tab`) // optional — see the header note
    }
    if (layer.mech === 'fan') {
      layer.members.forEach((_, i) => ids.add(`${layer.id}-m${i}`))
    }
    if (layer.mech === 'knobtower') {
      ids.add(`${layer.id}-disc`)
      layer.tiers.forEach((_, i) => ids.add(`${layer.id}-tier${i}`))
    }
    // The dispatch dial (popup-volvelle-layer.tsx): the spun DIAL beneath the
    // static WINDOW CARD, both hub-riveted coplanar into the page.
    if (layer.mech === 'volvelle') {
      ids.add(`${layer.id}-dial`)
      ids.add(`${layer.id}-card`)
    }
    // The lift-flap (popup-liftflap-layer.tsx): the key-board plaque plus one
    // numbered door leaf per door (requested as `<id>-board` and
    // `<id>-door<plate>` directly by the layer).
    if (layer.mech === 'liftflap') {
      ids.add(`${layer.id}-board`)
      for (const d of layer.doors) ids.add(`${layer.id}-door${d.plate}`)
    }
    // The dispatch keep (popup-keepstack-layer.tsx): each story renders through
    // a box instance as `<id>-<key>-side/-front/-back/-top` (same box FACE_ART
    // gating), plus the balcony deck, the fan spire members and the raven finial.
    if (layer.mech === 'keepstack') {
      for (const s of layer.stories) {
        ids.add(`${layer.id}-${s.key}-side`)
        if (s.capFront ?? true) ids.add(`${layer.id}-${s.key}-front`)
        if (s.capBack ?? true) ids.add(`${layer.id}-${s.key}-back`)
        if (s.roof !== 'open') ids.add(`${layer.id}-${s.key}-top`)
      }
      if (layer.balcony) ids.add(`${layer.id}-balcony`)
      if (layer.spire) {
        layer.spire.members.forEach((_, i) => ids.add(`${layer.id}-spire-m${i}`))
        if (layer.spire.raven) ids.add(`${layer.id}-raven`)
      }
    }
    // The tower-hoist winch (popup-keepwinch-layer.tsx): the disc handle plus
    // the three output bodies.
    if (layer.mech === 'keepwinch') {
      ids.add(`${layer.id}-disc`)
      ids.add(`${layer.id}-semaphore`)
      ids.add(`${layer.id}-iris`)
      ids.add(`${layer.id}-counterweight`)
    }
    // The skyline (popup-skyline-layer.tsx): one art per rooftop mound.
    if (layer.mech === 'skyline') {
      layer.rows.forEach((_, i) => ids.add(`${layer.id}-mound${i}`))
    }
    // The dispatch line (popup-dispatchline-layer.tsx): the die-cut cable PANEL
    // requests the layer id itself, plus `<id>-basket` for the in-plane rider
    // the reader pushes down the wire.
    if (layer.mech === 'dispatchline') ids.add(`${layer.id}-basket`)
    // The carrier swarm (popup-swarmarc-layer.tsx): ONE shared sprite atlas
    // for all 28 riders + the strut swatch + the stir-tab handle.
    if (layer.mech === 'swarmarc') {
      ids.add(`${layer.id}-atlas`)
    }
    // The depth vista (popup-depthvista-layer.tsx): one shaped flap art per wing
    // config (`<id>-<key>`, e.g. -near/-mid/-rear), each mirrored to both flanks.
    if (layer.mech === 'depthvista') {
      for (const wing of layer.wings) ids.add(`${layer.id}-${wing.key}`)
    }
    // The oanave rank (popup-oanave-layer.tsx): the face art plus the T4
    // print-back tint sprite (`<id>-back`) its back-face quads sample.
    if (layer.mech === 'oanave') ids.add(`${layer.id}-back`)
    // popup-dissolve-layer.tsx: the two crossfade paintings (dunes up-face,
    // gold under-face) sliced across the venetian slats, plus the tab's own
    // brass-plate art (`<id>-tab`, kraft-grip fallback when unpainted).
    if (layer.mech === 'dissolve') {
      ids.add(`${layer.id}-dunes`)
      ids.add(`${layer.id}-gold`)
      ids.add(`${layer.id}-tab`)
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
      if (layer.mech === 'platform') constructed.push(`${layer.id}-deck`, `${layer.id}-strut`)
      if (layer.mech === 'tabpiece') constructed.push(`${layer.id}-face`)
      if (layer.mech === 'fan') layer.members.forEach((_, i) => constructed.push(`${layer.id}-m${i}`))
      if (layer.mech === 'knobtower') {
        constructed.push(`${layer.id}-disc`)
        layer.tiers.forEach((_, i) => constructed.push(`${layer.id}-tier${i}`))
      }
      if (layer.mech === 'keepstack') {
        for (const s of layer.stories) {
          constructed.push(`${layer.id}-${s.key}-side`)
          if (s.capFront ?? true) constructed.push(`${layer.id}-${s.key}-front`)
          if (s.capBack ?? true) constructed.push(`${layer.id}-${s.key}-back`)
          if (s.roof !== 'open') constructed.push(`${layer.id}-${s.key}-top`)
        }
        if (layer.balcony) constructed.push(`${layer.id}-balcony`)
        if (layer.spire) {
          layer.spire.members.forEach((_, i) => constructed.push(`${layer.id}-spire-m${i}`))
          if (layer.spire.raven) constructed.push(`${layer.id}-raven`)
        }
      }
      if (layer.mech === 'keepwinch') {
        constructed.push(`${layer.id}-disc`, `${layer.id}-semaphore`, `${layer.id}-iris`, `${layer.id}-counterweight`)
      }
      if (layer.mech === 'skyline') {
        layer.rows.forEach((_, i) => constructed.push(`${layer.id}-mound${i}`))
      }
      if (layer.mech === 'swarmarc') {
        constructed.push(`${layer.id}-atlas`)
      }
    }
    const missing = constructed.filter((key) => !doc.includes(`\`${key}\``))
    expect(missing, `constructed asset keys missing from the call sheet: ${missing.join(', ')}`).toEqual([])
  })
})
