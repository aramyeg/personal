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
import { artAtlas, insetUvRect, type UvRect } from '../art-atlas'
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

// ---------------------------------------------------------------------------
// INFRA-1 — shared atlas pages (see ../art-atlas.ts for the sidecar contract).
// ---------------------------------------------------------------------------

/** A resolved piece of art: the texture to sample, and WHERE in it. `rect` is
 *  null for a piece that owns its whole texture (every pre-atlas piece), and a
 *  sub-rect for an atlas-backed one — in which case the texture is SHARED and
 *  the consumer must never dispose it (release happens through `cancel`). */
export type ArtSprite = { readonly texture: THREE.Texture; readonly rect: UvRect | null }

type AtlasPage = {
  refs: number
  texture: THREE.Texture | null
  promise: Promise<THREE.Texture | null>
}

/** One entry per atlas page, shared by every piece packed into it — the whole
 *  point of the mechanism (many pieces, ONE upload). Refcounted rather than
 *  cached forever so a page still unloads when the warm window scrolls past
 *  the last piece that used it. */
const atlasPages = new Map<string, AtlasPage>()

/**
 * Atlas pages deliberately IGNORE the caller's `TexTier`: one page is shared by
 * hero faces and edge-on slivers alike, so it always loads at full resolution
 * with mips. The per-piece memory win comes from packing (16 pieces in one
 * 1024² upload), not from downscaling the page.
 */
function acquireAtlasPage(atlasId: string, maxAnisotropy: number): Promise<THREE.Texture | null> {
  let entry = atlasPages.get(atlasId)
  if (!entry) {
    const created: AtlasPage = { refs: 0, texture: null, promise: Promise.resolve(null) }
    created.promise = new Promise<THREE.Texture | null>((resolve) => {
      new THREE.TextureLoader().load(
        `/labs/storybook/art/${atlasId}.webp`,
        (loaded) => {
          loaded.colorSpace = THREE.SRGBColorSpace
          loaded.anisotropy = maxAnisotropy
          // ClampToEdge is half of the anti-bleed rule (the other half is the
          // half-texel inset in art-atlas.ts): a sub-rect must never wrap.
          loaded.wrapS = THREE.ClampToEdgeWrapping
          loaded.wrapT = THREE.ClampToEdgeWrapping
          if (created.refs <= 0) {
            // Every consumer left while the page was in flight.
            loaded.dispose()
            atlasPages.delete(atlasId)
            resolve(null)
            return
          }
          created.texture = loaded
          resolve(loaded)
        },
        undefined,
        () => {
          atlasPages.delete(atlasId)
          resolve(null)
        }
      )
    })
    atlasPages.set(atlasId, created)
    entry = created
  }
  entry.refs++
  return entry.promise
}

function releaseAtlasPage(atlasId: string): void {
  const entry = atlasPages.get(atlasId)
  if (!entry) return
  entry.refs--
  if (entry.refs > 0) return
  if (entry.texture) {
    entry.texture.dispose()
    atlasPages.delete(atlasId)
  }
  // Still in flight: the loader's own `refs <= 0` branch disposes on arrival.
}

/**
 * Resolves an art id to an `ArtSprite`: an atlas sub-rect when the sidecar maps
 * the id, otherwise the id's own webp through `loadArtTexture` (identical
 * behaviour to before this mechanism existed, `rect` null).
 *
 * `cancel` both suppresses a late resolution and releases the atlas page this
 * call acquired — so the caller's only disposal duty is the `rect === null`
 * case, where the texture is genuinely its own.
 */
export function loadArtSprite(
  id: string,
  onLoad: (sprite: ArtSprite) => void,
  onError: () => void,
  maxAnisotropy = 1,
  tier: TexTier = ART_TIER
): { cancel: () => void } {
  let cancelled = false
  let heldPage: string | null = null
  let inner: (() => void) | null = null

  artAtlas()
    .then((sprites) => {
      if (cancelled) return
      const sprite = sprites.get(id)
      if (!sprite) {
        inner = loadArtTexture(id, (texture) => onLoad({ texture, rect: null }), onError, maxAnisotropy, tier).cancel
        return
      }
      heldPage = sprite.atlas
      acquireAtlasPage(sprite.atlas, maxAnisotropy).then((page) => {
        if (cancelled) return
        if (!page) {
          onError()
          return
        }
        onLoad({ texture: page, rect: insetUvRect(sprite.rect, sprite.page) })
      })
    })
    .catch(() => {
      if (!cancelled) onError()
    })

  return {
    cancel: () => {
      cancelled = true
      inner?.()
      if (heldPage) {
        releaseAtlasPage(heldPage)
        heldPage = null
      }
    },
  }
}

/** A whole family of pieces resolved onto ONE atlas page — the precondition for
 *  merging them into a single-material mesh (the keep, Batch C-2). */
export type AtlasSet = {
  readonly texture: THREE.Texture
  readonly rects: ReadonlyMap<string, UvRect>
}

/**
 * Resolves `ids` to a shared page, or `null` if they cannot be merged: any id
 * missing from the sidecar, or ids split across two pages, means the caller
 * must fall back to its per-piece path. All-or-nothing on purpose — a merged
 * mesh has one material, so a partial atlas is not a partial win, it is a bug.
 */
export function useAtlasSet(ids: readonly string[]): AtlasSet | null {
  const [set, setSet] = useState<AtlasSet | null>(null)
  const gl = useThree((s) => s.gl)
  const silhouette = useMemo(readSilhouetteMode, [])
  const maxAnisotropy = useMemo(() => gl.capabilities.getMaxAnisotropy(), [gl])
  // The caller builds its id list from geometry, so it is a fresh array every
  // render; key the effect on the joined ids instead of the array identity.
  const key = useMemo(() => [...ids].sort().join(' '), [ids])

  useEffect(() => {
    if (silhouette) {
      // The silhouette gate strips art book-wide, so there is nothing to merge.
      setSet(null)
      return
    }
    let cancelled = false
    let heldPage: string | null = null
    const wanted = key.split(' ').filter(Boolean)

    artAtlas()
      .then((sprites) => {
        if (cancelled) return
        const entries = wanted.map((id) => [id, sprites.get(id)] as const)
        const first = entries[0]?.[1]
        if (!first || entries.some(([, s]) => !s || s.atlas !== first.atlas)) {
          setSet(null)
          return
        }
        heldPage = first.atlas
        acquireAtlasPage(first.atlas, maxAnisotropy).then((page) => {
          if (cancelled) return
          if (!page) {
            setSet(null)
            return
          }
          const rects = new Map<string, UvRect>()
          for (const [id, sprite] of entries) rects.set(id, insetUvRect(sprite!.rect, sprite!.page))
          gl.initTexture(page)
          setSet({ texture: page, rects })
        })
      })
      .catch(() => {
        if (!cancelled) setSet(null)
      })

    return () => {
      cancelled = true
      if (heldPage) {
        releaseAtlasPage(heldPage)
        heldPage = null
      }
      setSet(null)
    }
  }, [key, silhouette, maxAnisotropy, gl])

  return set
}

export type ArtSpriteState = { readonly texture: THREE.Texture | null; readonly rect: UvRect | null }

/** The resting state of the sprite hooks — a module constant so an unresolved
 *  hook returns a STABLE identity frame after frame (these land in memo deps). */
const NO_SPRITE: ArtSpriteState = { texture: null, rect: null }

/**
 * The atlas-aware sibling of `useArtTexture`: resolves `{ texture, rect }` so a
 * quad-writing layer can remap its static uv table into the region (see
 * `applyUvRect`). `rect` is null for a piece that owns its texture, and the
 * hook then disposes it on unmount exactly as `useArtTexture` does; an atlas
 * page is shared, so it is released (refcount) rather than disposed.
 */
export function useArtSprite(id: string, tier: TexTier = ART_TIER): ArtSpriteState {
  const [sprite, setSprite] = useState<ArtSpriteState>(NO_SPRITE)
  const gl = useThree((s) => s.gl)
  const silhouette = useMemo(readSilhouetteMode, [])
  const maxAnisotropy = useMemo(() => gl.capabilities.getMaxAnisotropy(), [gl])

  useEffect(() => {
    if (silhouette) {
      // See useArtTexture: behave exactly as if the art never resolved.
      setSprite(NO_SPRITE)
      return
    }
    let owned: THREE.Texture | null = null
    const { cancel } = loadArtSprite(
      id,
      (loaded) => {
        // An atlas page belongs to the shared cache, never to this consumer.
        owned = loaded.rect ? null : loaded.texture
        setSprite(loaded)
      },
      () => setSprite(NO_SPRITE),
      maxAnisotropy,
      tier
    )
    return () => {
      cancel()
      owned?.dispose()
      setSprite(NO_SPRITE)
    }
  }, [id, silhouette, maxAnisotropy, tier])

  // Same pre-warm rationale as useLayerTexture.
  useEffect(() => {
    if (sprite.texture) gl.initTexture(sprite.texture)
  }, [gl, sprite.texture])

  return sprite
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
 * The atlas-aware sibling of `useLayerTexture`: same placeholder-fallback
 * contract, plus the `rect` a quad-writing layer needs to address its region of
 * a shared page. A placeholder always resolves with `rect: null` — it is a
 * freshly painted canvas that owns its whole texture.
 */
export function useLayerSprite(
  layerId: string,
  kind: LayerKind,
  accents: readonly string[]
): ArtSpriteState {
  const [sprite, setSprite] = useState<ArtSpriteState>(NO_SPRITE)
  const gl = useThree((s) => s.gl)
  const silhouette = useMemo(readSilhouetteMode, [])
  const tier = useMemo(() => (kind === 'backdrop' ? SLIVER_TIER : ART_TIER), [kind])
  const maxAnisotropy = useMemo(() => gl.capabilities.getMaxAnisotropy(), [gl])

  useEffect(() => {
    let owned: THREE.Texture | null = null
    const installPlaceholder = (palette: readonly string[]) => {
      const canvas = makePlaceholderLayer(kind, palette, hashLayerId(layerId))
      const fallback = makeCanvasTexture(canvas)
      owned = fallback
      setSprite({ texture: fallback, rect: null })
    }

    let cancel = () => {}
    if (silhouette) {
      installPlaceholder(KRAFT_TINTS)
    } else {
      ;({ cancel } = loadArtSprite(
        layerId,
        (loaded) => {
          owned = loaded.rect ? null : loaded.texture
          setSprite(loaded)
        },
        () => installPlaceholder(accents),
        maxAnisotropy,
        tier
      ))
    }

    return () => {
      cancel()
      owned?.dispose()
      setSprite(NO_SPRITE)
    }
  }, [layerId, kind, accents, silhouette, maxAnisotropy, tier])

  useEffect(() => {
    if (sprite.texture) gl.initTexture(sprite.texture)
  }, [gl, sprite.texture])

  return sprite
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
