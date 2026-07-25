/**
 * Which art ids each pop-up family actually REQUESTS, and through which
 * texture-loading path. Shared by the texture-budget accounting
 * (texture-budget.test.ts); art-callsheet.test.ts keeps its own `knownGoodIds`
 * for the doc-sync direction, which needs the union across the whole book
 * rather than the per-layer, per-path breakdown here.
 *
 * `sprite` marks a family whose renderer resolves art through the INFRA-1
 * sprite path (`useArtSprite`/`useLayerSprite`/`useAtlasSet` + `applyUvRect`)
 * and can therefore share an atlas page. A family without it fetches the loose
 * `<id>.webp` even when the sidecar maps that id, because its uv table has no
 * way to address a sub-rect — which is exactly the accounting error the s6 lane
 * flagged (spread 6 landed at 17 uploads against a pack estimate of 4).
 */

import type { SceneLayer } from '@/components/labs/storybook/content'
import { CHAPTERS, EXTRA_SPREAD_LAYERS } from '@/components/labs/storybook/content'

/** One art id a renderer asks for, and whether that renderer can address it as
 *  an atlas sub-rect. */
export type ArtRequest = { readonly id: string; readonly sprite: boolean }

/** Families whose ids must ALL land on one page or none of them can (a merged
 *  single-material mesh — `useAtlasSet` is all-or-nothing by construction). */
export const MERGED_FAMILIES: ReadonlySet<string> = new Set(['keepstack'])

/** Every art id `layer` causes to be requested, in the renderer's own order.
 *  Mirrors the construction rules in the renderers one-for-one; see
 *  art-callsheet.test.ts's `knownGoodIds` for the same rules stated for the
 *  doc-sync gate. */
export function artRequests(layer: SceneLayer): readonly ArtRequest[] {
  const sprite = (...ids: string[]): ArtRequest[] => ids.map((id) => ({ id, sprite: true }))
  const loose = (...ids: string[]): ArtRequest[] => ids.map((id) => ({ id, sprite: false }))

  switch (layer.mech) {
    case 'box': {
      const ids = [`${layer.id}-side`]
      if (layer.capFront ?? true) ids.push(`${layer.id}-front`)
      if (layer.capBack ?? true) ids.push(`${layer.id}-back`)
      if (layer.roof !== 'open') ids.push(`${layer.id}-top`)
      return sprite(...ids)
    }
    case 'platform':
      return sprite(`${layer.id}-deck`)
    case 'dress':
    case 'rotor':
      return sprite(layer.id)
    case 'keepstack': {
      const ids: string[] = []
      for (const s of layer.stories) {
        ids.push(`${layer.id}-${s.key}-side`)
        if (s.capFront ?? true) ids.push(`${layer.id}-${s.key}-front`)
        if (s.capBack ?? true) ids.push(`${layer.id}-${s.key}-back`)
        if (s.roof !== 'open') ids.push(`${layer.id}-${s.key}-top`)
      }
      if (layer.balcony) ids.push(`${layer.id}-balcony`)
      if (layer.spire) {
        layer.spire.members.forEach((_, i) => ids.push(`${layer.id}-spire-m${i}`))
        if (layer.spire.raven) ids.push(`${layer.id}-raven`)
      }
      return sprite(...ids)
    }
    case 'skyline':
      return sprite(...layer.rows.map((_, i) => `${layer.id}-mound${i}`))
    case 'stripflap':
      return sprite(layer.id)
    case 'swarmarc':
      return sprite(`${layer.id}-atlas`)
    case 'oanave':
      return sprite(layer.id, `${layer.id}-back`)
    case 'tabpiece':
      return loose(`${layer.id}-face`)
    // Fan members re-enter popup-spread.tsx's generic two-quad path as
    // synthesized v-folds, so they inherit its sprite support.
    case 'fan':
      return sprite(...layer.members.map((_, i) => `${layer.id}-m${i}`))
    case 'knobtower':
      return loose(`${layer.id}-disc`, ...layer.tiers.map((_, i) => `${layer.id}-tier${i}`))
    case 'volvelle':
      return loose(`${layer.id}-dial`, `${layer.id}-card`)
    case 'liftflap':
      return loose(`${layer.id}-board`, ...layer.doors.map((d) => `${layer.id}-door${d.plate}`))
    case 'keepwinch':
      return sprite(
        `${layer.id}-disc`,
        `${layer.id}-semaphore`,
        `${layer.id}-iris`,
        `${layer.id}-counterweight`
      )
    case 'depthvista':
      return loose(...layer.wings.map((w) => `${layer.id}-${w.key}`))
    case 'dissolve':
      return loose(`${layer.id}-dunes`, `${layer.id}-gold`, `${layer.id}-tab`)
    default:
      // vfold / child / parallel / rider / kinetic / keepsake / mfoldrange /
      // stagedchain: one texture, the layer's own id. The first five render
      // through popup-spread.tsx's generic two-quad path (sprite-aware);
      // keepsake/mfoldrange/stagedchain own their uv tables in their own
      // renderers and stay loose.
      return layer.mech === 'keepsake' || layer.mech === 'mfoldrange' || layer.mech === 'stagedchain'
        ? loose(layer.id)
        : sprite(layer.id)
  }
}

/** Every layer mounted on a spread, chapter or decorative. */
export function layersForSpread(spread: number): readonly SceneLayer[] {
  const chapter = CHAPTERS.find((c) => c.spread === spread)
  if (chapter) return chapter.layers
  return EXTRA_SPREAD_LAYERS[spread] ?? []
}
