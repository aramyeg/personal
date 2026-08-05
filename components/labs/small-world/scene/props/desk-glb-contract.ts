/**
 * THE DESK ASSET'S CONTRACT (Task 68) — the handful of facts that both the loader and the gate have
 * to agree on, in a module neither of them owns.
 *
 * It is deliberately free of three.js and of React, so `desk-glb.test.ts` can hold the shipped file
 * to it in a plain unit test without a canvas, and so the runtime loader cannot drift from the names
 * the gate checks.
 */

/** Where the baked desk lives, relative to the site root. */
export const DESK_GLB_URL = '/labs/small-world/desk.glb'

/**
 * The three meshes inside it, and why there are exactly three.
 *
 * They are split by HOW THEY ARE SHADED, not by what they are:
 *
 *  - `DeskSurface` — the slab and the pad. The two big flat surfaces, and the only ones whose
 *    shading arrives as a TEXTURE. They had to: a vertex bake cannot hold a contact edge, and the
 *    pad rests on the desk along a 20-unit perimeter of hard contact. Baked to vertices it put a
 *    grey halo around the pad measuring up to 136/255 against the approved render.
 *  - `DeskBaked` — every matte prop. Small, curved, carrying only soft shadows, so per-vertex
 *    colour is enough and costs no image at all. Two colour sets: studio lit and studio dim.
 *  - `DeskMetal` — the trinket dish, the rose-gold pen and the sculpting tool's tip. NOT baked,
 *    because a bake stores one colour per vertex and metal at this roughness shows almost nothing
 *    but a reflection of where the viewer is. These take a real metallic material and a studio
 *    environment at runtime.
 */
export const DESK_MESHES = ['DeskSurface', 'DeskBaked', 'DeskMetal'] as const
export type DeskMeshName = (typeof DESK_MESHES)[number]

/**
 * THE PAD'S FOOTPRINT, published because the lab still places things ON it.
 *
 * Task 65's blotter was a `DESK_PROPS` entry, so `desk-stage.test.ts` could check that the note lay
 * on it by reading the same table the renderer built from. The pad is now inside the asset and that
 * table is gone, but the claim is not: the note and both figurines are still positioned by the lab
 * and still have to land on the pink rather than beside it.
 *
 * These four numbers therefore mirror the Blender source (archived under
 * `.superpowers/sdd/blender/`), and `desk-glb.test.ts` re-derives them from the SHIPPED mesh rather
 * than taking them on trust — the pad is the only part of `DeskSurface` standing above the slab's
 * own plane, so its extent is recoverable from the vertices that do.
 */
export const DESK_PAD = {
  /** Half-width along x. */
  halfW: 3.3,
  /** Rearmost z — the edge nearest the journey camera's world. */
  backZ: 8.65,
  /** ...and the near edge, toward the viewer. */
  nearZ: 12.35,
  /** Its top surface's height, i.e. how far it stands proud of the slab. */
  top: 1.303,
} as const

/**
 * What the whole desk set is allowed to weigh, uncompressed.
 *
 * The shipped file is 1,202,552 bytes and gzips to 737,646 — the number a browser actually pays.
 * Draco was measured and DECLINED: it would take the geometry to roughly a third of its size, but
 * it costs a ~260 kB decoder (wasm plus wrapper), a second request, and a WASM instantiation on the
 * path to an ending that is already 1600vh of scrolling away from the loader. At 0.70 MB over the
 * wire, inside a budget of 1.5 MB, that trade buys nothing.
 */
export const DESK_PAYLOAD_BUDGET = 1_500_000
