'use client'

/**
 * v2 pivot: printed page faces. A real pop-up book's pages are fully
 * illustrated — the printed world the cutouts rise out of. Each spread gets
 * one full-width print (user art at `/labs/storybook/art/page-<spread>.webp`,
 * else the procedural print from placeholder-art.ts), split into left/right
 * page halves via texture transforms:
 *
 * - `right`: repeat (0.5, 1), offset (0.5, 0) — the print's right half in
 *   right-page orientation (geometry u=0 at the spine).
 * - `left`: repeat (-0.5, 1), offset (0.5, 0) — the print's left half,
 *   pre-mirrored so the left static page's `scale.x = -1` mesh (and the
 *   turning page's BackSide face at its landed pose, which shares the same
 *   spine-out uv direction) displays it upright.
 *
 * Prints are kept warm for the current spread ± 1 (same policy as the
 * pop-up layer textures) and disposed when they scroll out of that window.
 */

import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { popupContentForSpread } from '../content'
import { makePlaceholderPagePrint } from '../procedural/placeholder-art'
import { makeCanvasTexture } from './book'
import { loadArtTexture } from './use-layer-texture'

export type SpreadPrint = {
  full: THREE.Texture
  left: THREE.Texture
  right: THREE.Texture
}

const FALLBACK_ACCENTS: readonly string[] = ['#c9a227', '#6a8f5f']

function deriveHalves(full: THREE.Texture): SpreadPrint {
  full.wrapS = THREE.ClampToEdgeWrapping
  const right = full.clone()
  right.repeat.set(0.5, 1)
  right.offset.set(0.5, 0)
  const left = full.clone()
  left.repeat.set(-0.5, 1)
  left.offset.set(0.5, 0)
  return { full, left, right }
}

function disposePrint(print: SpreadPrint): void {
  // Clones share the full texture's GPU image but own their uniforms; the
  // full texture owns the upload.
  print.left.dispose()
  print.right.dispose()
  print.full.dispose()
}

/** Resolves printed page faces for the given spread indices (call with the
 *  current spread ± 1). Entries appear as their textures resolve. */
export function useSpreadPrints(indices: readonly number[]): Record<number, SpreadPrint> {
  const [prints, setPrints] = useState<Record<number, SpreadPrint>>({})
  const cancelsRef = useRef<Map<number, () => void>>(new Map())

  const key = indices.join(',')
  useEffect(() => {
    const wanted = new Set(indices)

    setPrints((current) => {
      let changed = false
      const next: Record<number, SpreadPrint> = {}
      for (const [idxStr, print] of Object.entries(current)) {
        const idx = Number(idxStr)
        if (wanted.has(idx)) {
          next[idx] = print
        } else {
          disposePrint(print)
          changed = true
        }
      }
      return changed ? next : current
    })

    const cancels = cancelsRef.current
    for (const idx of indices) {
      if (cancels.has(idx)) continue
      const accents = popupContentForSpread(idx)?.accents ?? FALLBACK_ACCENTS
      const install = (texture: THREE.Texture) =>
        setPrints((current) => {
          if (current[idx]) {
            // A resolve raced an earlier install for the same index — keep
            // the first, drop this one.
            texture.dispose()
            return current
          }
          return { ...current, [idx]: deriveHalves(texture) }
        })
      const { cancel } = loadArtTexture(
        `page-${idx}`,
        install,
        () => install(makeCanvasTexture(makePlaceholderPagePrint(accents, idx * 7919)))
      )
      cancels.set(idx, cancel)
    }
    for (const [idx, cancel] of cancels) {
      if (!wanted.has(idx)) {
        cancel()
        cancels.delete(idx)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  // Dispose everything on unmount.
  useEffect(
    () => () => {
      for (const cancel of cancelsRef.current.values()) cancel()
      cancelsRef.current.clear()
      setPrints((current) => {
        for (const print of Object.values(current)) disposePrint(print)
        return {}
      })
    },
    []
  )

  return prints
}
