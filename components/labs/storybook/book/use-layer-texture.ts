'use client'

/**
 * Loads a pop-up layer's baked art from `/labs/storybook/art/<id>.webp`;
 * falls back to a procedural placeholder cutout (Task 8) whenever that file
 * doesn't exist — which, until real art lands, is every layer, every time.
 * The fallback is therefore the expected path today, not a real error, so
 * it stays silent (no console noise) rather than logging.
 */

import { useEffect, useState } from 'react'
import * as THREE from 'three'
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
    let cancelled = false
    let owned: THREE.Texture | null = null

    const loader = new THREE.TextureLoader()
    loader.load(
      `/labs/storybook/art/${layerId}.webp`,
      (loaded) => {
        if (cancelled) {
          loaded.dispose()
          return
        }
        loaded.colorSpace = THREE.SRGBColorSpace
        owned = loaded
        setTexture(loaded)
      },
      undefined,
      () => {
        // Expected path today (see file header) — no art/ directory exists
        // yet, so this fires for every layer. Deliberately silent.
        if (cancelled) return
        const canvas = makePlaceholderLayer(kind, accents, hashLayerId(layerId))
        const fallback = makeCanvasTexture(canvas)
        owned = fallback
        setTexture(fallback)
      }
    )

    return () => {
      cancelled = true
      owned?.dispose()
      setTexture(null)
    }
  }, [layerId, kind, accents])

  return texture
}
