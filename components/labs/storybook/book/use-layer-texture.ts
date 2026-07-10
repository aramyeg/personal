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

import { useEffect, useState } from 'react'
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

/**
 * Loads `/labs/storybook/art/<id>.webp`, routing success to `onLoad` and
 * any failure (not in the manifest, decode error, ...) to `onError` — both
 * silently, per the file header. Returns a `cancel` function so the
 * caller's effect cleanup can suppress a load that resolves after unmount.
 */
export function loadArtTexture(
  id: string,
  onLoad: (texture: THREE.Texture) => void,
  onError: () => void
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

  useEffect(() => {
    let owned: THREE.Texture | null = null
    const { cancel } = loadArtTexture(
      layerId,
      (loaded) => {
        owned = loaded
        setTexture(loaded)
      },
      () => {
        const canvas = makePlaceholderLayer(kind, accents, hashLayerId(layerId))
        const fallback = makeCanvasTexture(canvas)
        owned = fallback
        setTexture(fallback)
      }
    )

    return () => {
      cancel()
      owned?.dispose()
      setTexture(null)
    }
  }, [layerId, kind, accents])

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

  useEffect(() => {
    let owned: THREE.Texture | null = null
    const { cancel } = loadArtTexture(
      id,
      (loaded) => {
        owned = loaded
        setTexture(loaded)
      },
      () => setTexture(null)
    )

    return () => {
      cancel()
      owned?.dispose()
      setTexture(null)
    }
  }, [id])

  return texture
}
