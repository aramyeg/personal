'use client'

/**
 * Loads a pop-up layer's SHAPED-MESH OUTLINE from
 * `/labs/storybook/art/<id>.outline.json` — the normalized [0,1]^2 contour the
 * code-generated art module emits alongside the painted webp (the charter-G3
 * identity: the same roofline points are the paint's cut edge and the mesh cut).
 *
 * Gated by `/labs/storybook/art/outlines.json` (the list of ids that carry a
 * sidecar, written by scripts/storybook/generate-art.mjs), for the same reason
 * `art-manifest.ts` gates textures: consulting the manifest BEFORE the request
 * keeps the console clean and costs zero network for ids without an outline.
 *
 * A missing sidecar resolves to `null`, and every consumer treats `null` as
 * "fall back to the rectangle quad" — so a piece with no generated outline
 * renders exactly as it did before this lane existed.
 *
 * Three-free (outlines are plain numbers), so it stays off the route's initial
 * three.js bundle, mirroring art-manifest.ts.
 */

import { useEffect, useState } from 'react'

/** A closed silhouette ring in normalized [0,1]^2, v-up (0 hinge -> 1 crest). */
export type Outline = ReadonlyArray<readonly [number, number]>

let manifestPromise: Promise<ReadonlySet<string>> | null = null

/** The set of ids that have a generated outline sidecar. Fetched once per
 *  session, shared by every consumer (the committed file always resolves). */
export function outlineManifest(): Promise<ReadonlySet<string>> {
  manifestPromise ??= fetch('/labs/storybook/art/outlines.json')
    .then((res) => (res.ok ? (res.json() as Promise<string[]>) : []))
    .then((ids) => new Set(ids))
    .catch(() => new Set<string>())
  return manifestPromise
}

/**
 * Resolves one layer's outline: `onLoad(outline)` if a sidecar exists and
 * parses, `onError()` otherwise (not in the manifest, fetch/parse failure) —
 * both silently, and both suppressed after `cancel()` so an effect cleanup can
 * drop a load that settles post-unmount. Mirrors `loadArtTexture`'s
 * cancel/StrictMode lifecycle so the two loaders behave identically.
 */
export function loadOutline(
  id: string,
  onLoad: (outline: Outline) => void,
  onError: () => void
): { cancel: () => void } {
  let cancelled = false
  outlineManifest()
    .then((ids) => {
      if (cancelled) return
      if (!ids.has(id)) {
        onError()
        return
      }
      fetch(`/labs/storybook/art/${id}.outline.json`)
        .then((res) => (res.ok ? (res.json() as Promise<Outline>) : Promise.reject(new Error('outline fetch failed'))))
        .then((outline) => {
          if (!cancelled) onLoad(outline)
        })
        .catch(() => {
          if (!cancelled) onError()
        })
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
 * React view of one layer's outline: `null` while loading and whenever no
 * sidecar exists (the caller then renders the rectangle quad). Re-resolves on
 * id change; the cleanup cancels an in-flight load.
 */
export function useLayerOutline(id: string): Outline | null {
  const [outline, setOutline] = useState<Outline | null>(null)

  useEffect(() => {
    setOutline(null)
    const { cancel } = loadOutline(
      id,
      (loaded) => setOutline(loaded),
      () => setOutline(null)
    )
    return cancel
  }, [id])

  return outline
}
