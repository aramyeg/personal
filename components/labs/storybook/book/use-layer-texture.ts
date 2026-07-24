'use client'

/**
 * Loads a pop-up layer's baked art from `/labs/storybook/art/<id>.webp`;
 * falls back to a procedural placeholder cutout (Task 8) whenever that file
 * doesn't exist — which, until real art lands, is every layer, every time.
 * The fallback is therefore the expected path today, not a real error, so
 * it stays silent (no console noise) rather than logging.
 *
 * `loadArtTexture` below is the one place that actually talks to
 * `THREE.TextureLoader`; both `useLayerTexture` (placeholder fallback) and
 * `useArtTexture` (task 19's cover decals — no placeholder, missing art
 * just means no decal) build on it instead of duplicating the loader
 * boilerplate.
 */

import { useEffect, useMemo, useState } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { artManifest } from '../art-manifest'
import type { LayerKind } from '../content'
import { makePlaceholderLayer } from '../procedural/placeholder-art'
import { makeCanvasTexture } from './book'

/** Tiny deterministic string hash (djb2 variant) — the same layer id always
 *  seeds the same placeholder silhouette, and different ids reliably seed
 *  visibly different ones. */
function hashLayerId(id: string): number {
  let hash = 5381
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) + hash + id.charCodeAt(i)) | 0
  }
  return hash
}

/** Dev-only silhouette gate for the capture-review benchmark (D-G6, see
 *  .superpowers/sdd/bench/capture-silhouette.mjs): `?sbsilhouette=1` strips
 *  every pop-up piece's art down to plain warm stock, so a capture with art
 *  disabled still has to read as a compelling paper scene on silhouette and
 *  shadow alone. Read once per hook instance, same pattern as use-turn-driver's
 *  `?sbpose`. Compiled out of production builds. */
function readSilhouetteMode(): boolean {
  if (process.env.NODE_ENV === 'production') return false
  if (typeof window === 'undefined') return false
  return new URLSearchParams(window.location.search).get('sbsilhouette') === '1'
}

// A couple of warm kraft/aged-paper tones (mirrors PAPER/PAPER_AGED in
// ../procedural/paper-texture.ts — kept in sync by eye, like that file's own
// duplicated palette) standing in for a chapter's real accent colors while
// the silhouette gate is on. Two tones (not one) so placeholder shapes that
// alternate accents by index (drawBackdrop's humps, drawHero's mound/body/
// head, ...) still separate by value, not just outline.
const KRAFT_TINTS: readonly string[] = ['#e7d5a8', '#c9b078']

/**
 * Resident-memory tier for a loaded art texture (E2.0 perf fix C). Art is
 * authored up to 1536px; at the reading camera that resolution is only ever
 * spent on the hero/figure/foreground pieces the eye actually lands on. Two
 * levers cut GPU memory (budget: <= 180 MB resident, incl. mips) without
 * touching the art files on disk:
 *   - `maxDim`: the loaded image is downscaled at load (canvas draw, high-
 *     quality resample) so only the smaller image — and its mip chain — is
 *     ever uploaded. The art webp on disk is untouched.
 *   - `mipmaps`: false drops the whole mip pyramid (another ~33%) and uses a
 *     plain LinearFilter — correct for faces that are edge-on slivers or far
 *     upstage, where a mip chain buys nothing the reader can see.
 * This runs in `loadArtTexture`'s success path, so it is deliberately a no-op
 * when the loaded texture has no decodable image (the unit tests hand it a
 * bare `new THREE.Texture()`).
 */
export type TexTier = { readonly maxDim: number; readonly mipmaps: boolean }

/** Full-resolution painted art the eye lands on: heroes, figures, foreground
 *  fringes, box front caps, facade plates, page prints. 1024 is crisp at the
 *  reading distance; the authored 1536 was never resolved on screen. */
export const ART_TIER: TexTier = { maxDim: 1024, mipmaps: true }

/** Slivers and far-upstage sheets — box top/back/side faces (edge-on or
 *  hollow-interior, barely any screen area) and backdrop-kind planes (behind
 *  everything, heavily foreshortened). Half the size, no mips. */
export const SLIVER_TIER: TexTier = { maxDim: 512, mipmaps: false }

/** Downscale the texture's image to `tier.maxDim` (longest edge) when it is
 *  larger, and drop mips/anisotropy-eligible filtering when the tier asks for
 *  it. Mutates and returns the same texture. Safe on a texture with no image
 *  (returns it untouched) so the loader's success path stays test-friendly. */
function applyTexTier(texture: THREE.Texture, tier: TexTier): THREE.Texture {
  const image = texture.image as (HTMLImageElement | ImageBitmap | HTMLCanvasElement) | undefined
  const w = image?.width ?? 0
  const h = image?.height ?? 0
  if (image && typeof document !== 'undefined' && Math.max(w, h) > tier.maxDim) {
    const scale = tier.maxDim / Math.max(w, h)
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(w * scale))
    canvas.height = Math.max(1, Math.round(h * scale))
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
      texture.image = canvas
      texture.needsUpdate = true
    }
  }
  if (!tier.mipmaps) {
    // LinearFilter (no mip sampling) — changing minFilter off the mipmapped
    // default only takes effect with needsUpdate, set below.
    texture.minFilter = THREE.LinearFilter
    texture.magFilter = THREE.LinearFilter
    texture.generateMipmaps = false
    texture.needsUpdate = true
  }
  return texture
}

/**
 * Loads `/labs/storybook/art/<id>.webp`, routing success to `onLoad` and
 * any failure (not in the manifest, decode error, ...) to `onError` — both
 * silently, per the file header. Returns a `cancel` function so the
 * caller's effect cleanup can suppress a load that resolves after unmount.
 *
 * `maxAnisotropy` (E-G5 floor d): painted art is the LEAST-filtered yet
 * MOST-foreshortened texture family in the scene — procedural/page textures
 * already get `anisotropy = 4` (book.tsx's `makeCanvasTexture`), art
 * textures got only the THREE default of 1. This function is plain (no
 * hook), so the caller threads the device's real ceiling in from its own
 * `useThree((s) => s.gl)` rather than this module reaching for a GL context
 * itself; defaults to 1 (THREE's own default) so callers that don't care
 * (or tests with no WebGL context at all) don't have to pass it.
 *
 * `tier` (E2.0 fix C): the resident-memory budget for this texture — see
 * `applyTexTier`. Defaults to `ART_TIER` (1024, mipmapped); slivers pass
 * `SLIVER_TIER`. Applied only on a real decoded image, so it is inert in the
 * unit tests (which resolve a bare `new THREE.Texture()`).
 */
export function loadArtTexture(
  id: string,
  onLoad: (texture: THREE.Texture) => void,
  onError: () => void,
  maxAnisotropy = 1,
  tier: TexTier = ART_TIER
): { cancel: () => void } {
  let cancelled = false
  artManifest()
    .then((ids) => {
      if (cancelled) return
      if (!ids.has(id)) {
        onError()
        return
      }
      new THREE.TextureLoader().load(
        `/labs/storybook/art/${id}.webp`,
        (loaded) => {
          if (cancelled) {
            loaded.dispose()
            return
          }
          loaded.colorSpace = THREE.SRGBColorSpace
          loaded.anisotropy = maxAnisotropy
          // Resident-memory tier (fix C): downscale-at-load + mip control.
          applyTexTier(loaded, tier)
          onLoad(loaded)
        },
        undefined,
        () => {
          if (!cancelled) onError()
        }
      )
    })
    .catch(() => {
      if (!cancelled) onError()
    })
  return {
    cancel: () => {
      cancelled = true
    },
  }
}

/**
 * Resolves one layer's texture: real baked art if it exists at
 * `/labs/storybook/art/<id>.webp`, otherwise a seeded placeholder cutout
 * built from `kind`/`accents`. Both paths set `colorSpace = SRGBColorSpace`
 * so painted color and procedural color match under the same lighting.
 * Disposes whichever texture it created on unmount or layer-identity change.
 */
export function useLayerTexture(
  layerId: string,
  kind: LayerKind,
  accents: readonly string[]
): THREE.Texture | null {
  const [texture, setTexture] = useState<THREE.Texture | null>(null)
  const gl = useThree((s) => s.gl)
  const silhouette = useMemo(readSilhouetteMode, [])
  // Resident-memory tier (fix C): backdrop-kind planes sit far upstage,
  // foreshortened and behind everything, so they take the sliver tier (512,
  // no mips); every other kind (hero/midground/foreground) is full 1024 art.
  // useMemo so it resolves to one of two stable module constants (never a
  // fresh object) and can join the load effect's dep list without churning it.
  const tier = useMemo(() => (kind === 'backdrop' ? SLIVER_TIER : ART_TIER), [kind])
  // Stable per-renderer ceiling (E-G5 floor d) — a plain useMemo (not read
  // inline in the effect below) so the effect's own dep list stays exactly
  // what it was before threading this through: `gl` itself never changes
  // identity for the Canvas's lifetime, so re-deriving this from `gl` would
  // otherwise trip exhaustive-deps for a value that can't actually change.
  const maxAnisotropy = useMemo(() => gl.capabilities.getMaxAnisotropy(), [gl])

  useEffect(() => {
    let owned: THREE.Texture | null = null
    const installPlaceholder = (palette: readonly string[]) => {
      const canvas = makePlaceholderLayer(kind, palette, hashLayerId(layerId))
      const fallback = makeCanvasTexture(canvas)
      owned = fallback
      setTexture(fallback)
    }

    let cancel = () => {}
    if (silhouette) {
      // Silhouette gate: never attempt the real-art fetch, always land on
      // the placeholder cutout painted in kraft tones instead of the
      // chapter's real accents.
      installPlaceholder(KRAFT_TINTS)
    } else {
      ;({ cancel } = loadArtTexture(
        layerId,
        (loaded) => {
          owned = loaded
          setTexture(loaded)
        },
        () => installPlaceholder(accents),
        maxAnisotropy,
        tier
      ))
    }

    return () => {
      cancel()
      owned?.dispose()
      setTexture(null)
    }
  }, [layerId, kind, accents, silhouette, maxAnisotropy, tier])

  // Upload as soon as resolved: warm-window neighbors mount hidden, and a
  // hidden mesh never renders, so without this the GPU upload stalled the
  // first frames of the turn that revealed the piece.
  useEffect(() => {
    if (texture) gl.initTexture(texture)
  }, [gl, texture])

  return texture
}

/**
 * Loads `/labs/storybook/art/<id>.webp` with no placeholder fallback:
 * resolves `null` while loading and whenever the file doesn't exist yet.
 * Used by the cover decals (task 19) — a crest/corner/etc. with no baked
 * art simply isn't drawn, rather than substituting a placeholder shape that
 * was never designed for a flat leather cover.
 *
 * `tier` (fix C) picks the resident-memory budget: full 1024 art by default,
 * or the caller passes `SLIVER_TIER` for faces that are edge-on/hidden slivers
 * at the reading camera (box top/back/side). Callers pass one of the two
 * module-constant tiers, so its identity is stable in the effect dep list.
 */
export function useArtTexture(id: string, tier: TexTier = ART_TIER): THREE.Texture | null {
  const [texture, setTexture] = useState<THREE.Texture | null>(null)
  const gl = useThree((s) => s.gl)
  const silhouette = useMemo(readSilhouetteMode, [])
  // See useLayerTexture's identical comment above.
  const maxAnisotropy = useMemo(() => gl.capabilities.getMaxAnisotropy(), [gl])

  useEffect(() => {
    if (silhouette) {
      // Silhouette gate: no placeholder exists for this hook (see the file
      // header), so behave exactly as if the art never resolved — the
      // renderer's own missing-art fallback takes over, unchanged.
      setTexture(null)
      return
    }

    let owned: THREE.Texture | null = null
    const { cancel } = loadArtTexture(
      id,
      (loaded) => {
        owned = loaded
        setTexture(loaded)
      },
      () => setTexture(null),
      maxAnisotropy,
      tier
    )

    return () => {
      cancel()
      owned?.dispose()
      setTexture(null)
    }
  }, [id, silhouette, maxAnisotropy, tier])

  // Same pre-warm rationale as useLayerTexture above.
  useEffect(() => {
    if (texture) gl.initTexture(texture)
  }, [gl, texture])

  return texture
}
