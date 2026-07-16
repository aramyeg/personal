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
 */
export function loadArtTexture(
  id: string,
  onLoad: (texture: THREE.Texture) => void,
  onError: () => void,
  maxAnisotropy = 1
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
        maxAnisotropy
      ))
    }

    return () => {
      cancel()
      owned?.dispose()
      setTexture(null)
    }
  }, [layerId, kind, accents, silhouette, maxAnisotropy])

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
 */
export function useArtTexture(id: string): THREE.Texture | null {
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
      maxAnisotropy
    )

    return () => {
      cancel()
      owned?.dispose()
      setTexture(null)
    }
  }, [id, silhouette, maxAnisotropy])

  // Same pre-warm rationale as useLayerTexture above.
  useEffect(() => {
    if (texture) gl.initTexture(texture)
  }, [gl, texture])

  return texture
}
