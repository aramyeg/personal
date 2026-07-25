'use client'

/**
 * INFRA-1 — SHARED-ATLAS ADDRESSING (book-wide; s4 is the first adopter, s3/s5/
 * s6/s7 adopt the same plumbing in their own lanes).
 *
 * A piece's art id normally resolves to its own `/labs/storybook/art/<id>.webp`.
 * An atlas-backed id instead names a SUB-RECT of a shared page: many pieces then
 * share ONE texture upload, which is the whole texLive win (s4: ~25 files -> ~8).
 * The mapping lives in a committed sidecar, `/labs/storybook/art/atlas.json`,
 * written by scripts/storybook/generate-art.mjs:
 *
 * ```json
 * {
 *   "pages":   { "keep-atlas-s4": 1024 },
 *   "sprites": { "ch3-keep-hall-front": { "atlas": "keep-atlas-s4",
 *                                         "rect": [u0, v0, u1, v1] } }
 * }
 * ```
 *
 * `pages` maps an atlas id to its SQUARE page size in pixels (the half-texel
 * inset below needs it). `rect` is in TEXTURE uv space, NOT image-pixel space:
 * v is measured from the image BOTTOM, because three uploads art with the
 * default `flipY`. The packer owns that conversion so the runtime stays a pure
 * affine remap.
 *
 * This module is deliberately three-free (plain numbers and Float32Arrays), for
 * the same reason art-manifest.ts is: the sidecar is consulted before any
 * texture work, and DOM-side consumers must not drag three.js toward the
 * route's initial bundle.
 */

/** A sub-rect of an atlas page in texture uv space: `[u0, v0, u1, v1]`, v-up. */
export type UvRect = readonly [number, number, number, number]

/** One atlas-backed art id: which page it lives on, where, and how big that
 *  page is (needed for the half-texel inset). */
export type AtlasSprite = {
  readonly atlas: string
  readonly rect: UvRect
  readonly page: number
}

type AtlasFile = {
  pages?: Record<string, number>
  sprites?: Record<string, { atlas?: string; rect?: number[] }>
}

const ATLAS_URL = '/labs/storybook/art/atlas.json'

/** Default page size assumed when a sidecar names a page it never declared —
 *  every atlas this book packs is 1024², and guessing here is strictly better
 *  than dropping the sprite (a too-small guess only widens the inset). */
const DEFAULT_PAGE = 1024

let atlasPromise: Promise<ReadonlyMap<string, AtlasSprite>> | null = null

function parseAtlas(file: AtlasFile): ReadonlyMap<string, AtlasSprite> {
  const pages = file.pages ?? {}
  const out = new Map<string, AtlasSprite>()
  for (const [id, entry] of Object.entries(file.sprites ?? {})) {
    const atlas = entry?.atlas
    const rect = entry?.rect
    // A malformed entry is skipped rather than thrown: the id then falls back
    // to its own loose webp, which is exactly the pre-atlas behaviour.
    if (typeof atlas !== 'string' || !Array.isArray(rect) || rect.length !== 4) continue
    if (!rect.every((n) => typeof n === 'number' && Number.isFinite(n))) continue
    const page = pages[atlas] ?? DEFAULT_PAGE
    out.set(id, { atlas, rect: [rect[0], rect[1], rect[2], rect[3]] as UvRect, page })
  }
  return out
}

/** The atlas sidecar, fetched once per session and shared by every consumer.
 *  A missing or unparseable file resolves to an EMPTY map, so a book with no
 *  atlases behaves exactly as it did before this module existed. */
export function artAtlas(): Promise<ReadonlyMap<string, AtlasSprite>> {
  atlasPromise ??= fetch(ATLAS_URL)
    .then((res) => (res.ok ? (res.json() as Promise<AtlasFile>) : {}))
    .then(parseAtlas)
    .catch(() => new Map<string, AtlasSprite>())
  return atlasPromise
}

/**
 * Shrink a rect by half a texel on every side. Bilinear sampling of a texel at
 * the very edge of a region reaches HALF a texel past it — into the neighbour —
 * so without this the atlas bleeds a sliver of the wrong art along every seam
 * (ClampToEdge cannot help: the neighbour is inside the same image). Clamped to
 * a quarter of the region so a hypothetical 1-2px sliver region can never
 * invert.
 */
export function insetUvRect(rect: UvRect, page: number): UvRect {
  const size = page > 0 ? page : DEFAULT_PAGE
  const e = 0.5 / size
  const [u0, v0, u1, v1] = rect
  const du = Math.min(e, Math.abs(u1 - u0) / 4)
  const dv = Math.min(e, Math.abs(v1 - v0) / 4)
  return [u0 + du, v0 + dv, u1 - du, v1 - dv]
}

/**
 * Remap a layer's STATIC uv table into an atlas sub-rect: `uv' = rect.min +
 * uv * rect.size`. Every quad-writing layer in the book authors its uvs in the
 * unit square (identity, half-splits at 0.5, side-aware flips, shaped-mesh
 * outlines), so one affine pass converts any of them — including flipped tables,
 * where u0 > u1 simply maps the flip into the region.
 *
 * Returns a NEW array (the caller's table is a module constant shared by every
 * instance of that layer family, and must never be mutated). `rect === null`
 * returns a copy, so callers can use one code path for both.
 */
export function applyUvRect(uvs: Float32Array, rect: UvRect | null): Float32Array {
  const out = new Float32Array(uvs)
  if (!rect) return out
  const [u0, v0, u1, v1] = rect
  const du = u1 - u0
  const dv = v1 - v0
  for (let i = 0; i < out.length; i += 2) {
    out[i] = u0 + out[i] * du
    out[i + 1] = v0 + out[i + 1] * dv
  }
  return out
}
