'use client'

/**
 * The set of art ids that actually exist, from the manifest the prepare-art
 * pipeline writes next to the images. Consulting it BEFORE any image
 * request is the only reliable way to keep the console clean: Chrome logs
 * "Failed to load resource" for ANY 404 — <img>, TextureLoader, and plain
 * fetch alike — no matter how quietly the response is handled. With the
 * manifest, art that hasn't been generated yet costs zero requests and zero
 * console noise; the manifest itself is a committed file, so its own fetch
 * always resolves. Fetched once per session, shared by every consumer.
 *
 * Lives in its own three-free module so DOM overlays can consult it
 * without pulling three.js toward the route's initial bundle.
 */

import { useEffect, useState } from 'react'

let manifestPromise: Promise<ReadonlySet<string>> | null = null

export function artManifest(): Promise<ReadonlySet<string>> {
  manifestPromise ??= fetch('/labs/storybook/art/manifest.json')
    .then((res) => (res.ok ? (res.json() as Promise<string[]>) : []))
    .then((ids) => new Set(ids))
    .catch(() => new Set<string>())
  return manifestPromise
}

/** React view of the manifest: `null` while resolving, then the id set. */
export function useArtIds(): ReadonlySet<string> | null {
  const [ids, setIds] = useState<ReadonlySet<string> | null>(null)

  useEffect(() => {
    let cancelled = false
    artManifest().then((set) => {
      if (!cancelled) setIds(set)
    })
    return () => {
      cancelled = true
    }
  }, [])

  return ids
}
