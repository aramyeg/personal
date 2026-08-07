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
 * The four meshes inside it, and why there are exactly four.
 *
 * They are split by HOW THEY ARE SHADED, not by what they are:
 *
 *  - `DeskSurface` — the slab and the pad. The two big flat surfaces, and the only ones whose
 *    shading arrives as a TEXTURE. They had to: a vertex bake cannot hold a contact edge, and the
 *    pad rests on the desk along a 20-unit perimeter of hard contact. Baked to vertices it put a
 *    grey halo around the pad measuring up to 136/255 against the approved render.
 *  - `DeskBaked` — every matte prop. Small, curved, carrying only soft shadows, so per-vertex
 *    colour is enough and costs no image at all. Two colour sets: studio lit and studio dim.
 *  - `DeskMetal` — the trinket dish, the rose-gold pen, the sculpting tool's tip and (from Task 71)
 *    the two foil prints. NOT baked, because a bake stores one colour per vertex and metal at this
 *    roughness shows almost nothing but a reflection of where the viewer is. These take a real
 *    metallic material and a studio environment at runtime.
 *  - `DeskGloss` — the donut's chocolate glaze, and only that (Task 71). It is the one object in
 *    the scene under the studio's 0.28 roughness floor, at 0.12 under a 0.30 coat: the sanctioned
 *    exception, because the matte rule is for studio props and food reads appetizing through sheen.
 *    A sheen is view-dependent and therefore unbakeable for the same reason the metal is, so it
 *    ships DIFFUSE-baked with its specular added at runtime. One extra draw call, bought with the
 *    measurement in task-71-report.md rather than with a preference.
 */
export const DESK_MESHES = ['DeskSurface', 'DeskBaked', 'DeskMetal', 'DeskGloss'] as const
export type DeskMeshName = (typeof DESK_MESHES)[number]

/**
 * A node that draws nothing, so that something later can be drawn from it (Task 71, for Task 72).
 *
 * The ending grows coffee steam next round, and steam has to rise from the coffee's surface — which
 * is inside the joined matte mesh and therefore not addressable. Splitting the coffee out to make
 * it findable would buy a fifth draw call for a 32x16-pixel disc, so the export ships an EMPTY
 * beside it instead: positioned at the centre of the coffee's top surface, and uniformly SCALED to
 * its radius, so the node carries the disc's size as well as its place. `desk-glb.test.ts` reads
 * both out of the shipped file rather than trusting this comment.
 */
export const COFFEE_ANCHOR = 'CoffeeAnchor'

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
 * THE TWO SOUVENIRS, NOW INSIDE THE ASSET (Task 81) — published because other things stand beside
 * them and have to keep out of their way.
 *
 * Until this round the bird and the penguin were drawn by the lab, out of the same toon clay the
 * journey's mascots are made of, and `desk-figurines.tsx` owned their placement. They are baked
 * props now (see `desk-set.tsx` for the law that changed and why), joined into `DeskBaked` and
 * therefore no longer addressable by name — so the placement moves here, where the pad's footprint
 * already lives.
 *
 * These are MEASUREMENTS of the Blender models, in the lab frame, taken from the master blend at
 * `.superpowers/sdd/blender/` (`gltf = (bx, bz, −by)`, which is why the height is the blend's z).
 * `desk-glb.test.ts` checks that the shipped `DeskBaked` really does carry vertices inside these
 * boxes, so the export cannot quietly drop them again — which is exactly what happened for three
 * rounds and is the whole reason this round exists.
 */
export const DESK_FIGURINES = [
  /** The bluebird, on her left. */
  { kind: 'bluebird', x: -0.92, z: 9.471, halfW: 0.2532, halfD: 0.4486, seatY: 1.2653, height: 0.6549 },
  /** ...and the penguin, on her right — the taller of the two. */
  { kind: 'penguin', x: 0.83, z: 9.494, halfW: 0.2313, halfD: 0.243, seatY: 1.2625, height: 0.7652 },
] as const

/** The taller souvenir, which is what anything standing among them is measured against. */
export const FIGURINE_HEIGHT = Math.max(...DESK_FIGURINES.map((f) => f.height))

/**
 * What the whole desk set is allowed to weigh OVER THE WIRE — and the correction that word is.
 *
 * T68 wrote this budget against the file's UNCOMPRESSED length while its own docblock argued in
 * transferred bytes ("at 0.70 MB over the wire, inside a budget of 1.5 MB"). The two agreed then
 * only by luck: 1,211,748 raw happened to sit under 1,500,000 as well. The T69/T70 remodel ends the
 * coincidence — the same set is 1,946,492 bytes raw — so the gate had to be pointed at the quantity
 * it was always about, before it failed for a reason that has nothing to do with what anyone pays.
 *
 * It is a MEASUREMENT, not an assumption. The server sends `Content-Encoding: gzip` for this file
 * (`model/gltf-binary`, `Vary: Accept-Encoding`), and the body it transfers is 1,315,541 bytes —
 * which `zlib.gzipSync` at its default level reproduces EXACTLY, to the byte, so a unit test can
 * hold the shipped file to the number a browser actually downloads rather than to an estimate of it.
 * `desk-glb.test.ts` gates on that, and on the raw length separately, so a regression that doubles
 * the file but happens to compress well still has to answer for itself.
 *
 * Draco was measured and DECLINED again at the new size: it would take the geometry to roughly a
 * third, but it costs a ~260 kB decoder (wasm plus wrapper), a second request, and a WASM
 * instantiation on the path to an ending 1600vh of scrolling away from the loader. At 1.25 MB
 * transferred inside a 1.5 MB budget it still buys nothing.
 */
export const DESK_PAYLOAD_BUDGET = 1_500_000

/**
 * ...and a ceiling on the uncompressed length, which is what the GPU and the parser pay.
 *
 * Deliberately loose — it exists to catch a category change (an accidental texture, a duplicated
 * attribute, modifiers baked on export), not to bound the art. The shipped file is 1,946,492.
 */
export const DESK_RAW_CEILING = 2_400_000
