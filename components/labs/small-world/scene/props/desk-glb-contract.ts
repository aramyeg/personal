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
/**
 * ...and a FIFTH, from Task 92: `BookVerso` — the paper glued to the notebook cover's underside,
 * carrying the pencil sketch the deep tier's open reveals. It could not join `DeskBaked`, because
 * it MOVES: the runtime rotates it about the spine axis by the same angle the cover's shader
 * chunk reads (`desk-deep.ts`). It was spliced into the shipped file SURGICALLY
 * (`t92_book_splice.mjs`) rather than re-exported through the pipeline, because a pipeline re-run
 * re-bakes every vertex colour a little and the T92 rest gate is pixel-diff ZERO against the
 * previous ship — every pre-existing byte of every pre-existing accessor is copied verbatim.
 * Measured cost of the whole interior (page + gutter appended to `DeskBaked`, plus this mesh):
 * +25,971 B gzipped on the file on disk, inside the standing budget below.
 */
/**
 * ...and the WATERING PIECE, from Task 92's second half: `Can_B` (the sage-mint can, 1,500 v —
 * the arm's facet-audit floor — carrying the same two baked colour sets as every matte prop) and
 * seven `Water_Drop##` beads (unbaked: they exist only mid-pour, scale 0 at rest, and a studio
 * gradient pinned to a flying bead is wrong everywhere except the frame it was baked in). All
 * eight ride ONE spliced animation (`WaterAction`) scrubbed from interaction progress. Spliced
 * surgically (`t92_set_splice.mjs`) — these pieces touch no existing accessor at all, so the
 * rest bytes are verbatim by construction, not by care. Measured cost: +53,717 B gzipped on the
 * file on disk (including the rose's shadow-floor lift — see the bake script's docblock).
 */
export const DESK_MESHES = [
  'DeskSurface',
  'DeskBaked',
  'DeskMetal',
  'DeskGloss',
  'BookVerso',
  'Can_B',
  'Water_Drop00',
  'Water_Drop01',
  'Water_Drop02',
  'Water_Drop03',
  'Water_Drop04',
  'Water_Drop05',
  'Water_Drop06',
] as const
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
 * THE NUDGE ZONES (Task 89) — the five props that answer the pointer, as boxes over the MERGED bake.
 *
 * The desk ships as four joined meshes (see `DESK_MESHES`), so "the mug" is not an object anyone can
 * rotate — it is a run of vertices inside `DeskBaked` plus its foil print inside `DeskMetal`. The
 * pointer interactions therefore select by REST POSITION: a vertex belongs to a zone iff its
 * authored position lies inside the zone's box, and the zone's motion is applied in the vertex
 * shader (`desk-nudge.ts` owns the motion; this table owns only the geometry facts).
 *
 * That makes the boxes load-bearing in a way an eyeballed hitbox never is: a box that CUTS an
 * object tears it — half a mug rocks and half stays — and a box that swallows a neighbour's
 * vertices rocks the neighbour. So every bound below is derived from the shipped file, not typed
 * from taste: a union-find over the GLB's triangles (plus co-located split vertices) gives each
 * physical object as a connected component with an exact AABB, and each zone is the union of its
 * own components padded to the midpoint of the measured gap to the nearest foreign component. The
 * tightest of those gaps are real constraints — the sculpting tool's rod ends at x 2.5506 and the
 * pen cup begins at 2.5650, the mug's body ends at x −2.2507 and the donut's cake begins at
 * −2.1700 — which is why some pads are 0.01 where others are 0.05.
 *
 * `desk-nudge-zones.test.ts` re-derives the components from the shipped bytes and holds every zone
 * to the no-tear condition (each component entirely inside or entirely outside each zone box, per
 * mesh the zone is registered in), so a re-bake that moves a prop cannot silently shear it.
 *
 * `pivot` is the centre of the object's contact with the desk and `baseR` its contact radius: the
 * shader rocks the object about a horizontal axis through the pivot and lifts it by baseR·|angle|,
 * which is exactly (to first order) a rock about the base's EDGE — the far rim stays seated instead
 * of sinking through the desk.
 */
export type DeskNudgeKind = 'mug' | 'donut' | 'pencup' | 'bird' | 'penguin'
export const DESK_NUDGE_ZONES: readonly {
  kind: DeskNudgeKind
  min: readonly [number, number, number]
  max: readonly [number, number, number]
  pivot: readonly [number, number, number]
  baseR: number
  meshes: readonly DeskMeshName[]
}[] = [
  /** Body + handle in the bake, foil print in the metal. The coffee disc (DeskGloss) is
   *  DELIBERATELY not registered: the liquid stays level while the cup rocks around it. */
  {
    kind: 'mug',
    min: [-3.2, 1.26, 10.92],
    max: [-2.21, 2.08, 11.68],
    pivot: [-2.595, 1.303, 11.3],
    baseR: 0.3,
    meshes: ['DeskBaked', 'DeskMetal'],
  },
  /** Cake + all sprinkles in the bake, icing in the gloss — one rigid wobble. */
  {
    kind: 'donut',
    min: [-2.2, 1.26, 10.92],
    max: [-1.34, 1.62, 11.83],
    pivot: [-1.78, 1.303, 11.36],
    baseR: 0.26,
    meshes: ['DeskBaked', 'DeskGloss'],
  },
  /** The cup and every pen standing in it; the rose-gold pen and the cup's foil print are metal. */
  {
    kind: 'pencup',
    min: [2.558, 1.26, 11.42],
    max: [3.27, 2.76, 12.23],
    pivot: [2.875, 1.303, 11.855],
    baseR: 0.31,
    meshes: ['DeskBaked', 'DeskMetal'],
  },
  /** The two souvenirs — same boxes DESK_FIGURINES publishes, grown to cover beak/tail/wings. */
  {
    kind: 'bird',
    min: [-1.22, 1.24, 8.98],
    max: [-0.62, 1.96, 9.96],
    pivot: [-0.92, 1.2653, 9.471],
    baseR: 0.18,
    meshes: ['DeskBaked'],
  },
  {
    kind: 'penguin',
    min: [0.55, 1.23, 9.2],
    max: [1.11, 2.07, 9.79],
    pivot: [0.83, 1.2625, 9.494],
    baseR: 0.16,
    meshes: ['DeskBaked'],
  },
] as const

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
 *
 * ============================================================================
 * RAISED ONCE, IN TASK 81, BY THE MEASURED COST OF A SCOPE CHANGE — AND NOT BY MORE
 * ============================================================================
 * 1,500,000 was set against an asset that was MISSING two of its objects. The bird and the penguin
 * had never been exported (see `DESK_FIGURINES`), Aram asked for them twice, and shipping them is
 * not discretionary. They cost **+182,997 B gzipped, measured** — which lands the pre-existing
 * asset at 1,500,106, six figures of coincidence and 106 bytes over.
 *
 * So the raise is +200,000, which is that measurement rounded, and NOTHING ELSE. Everything the
 * round spent on quality was paid for out of savings inside the old number first:
 *
 *   * −211,444 B raw of colour alpha no shader reads (`t81_trim.py`);
 *   * −1,886 vertices below one screen pixel, the new floor under `PROP_EDGE_MAX`'s cap;
 *   * the atlas moved PNG → lossless WebP, −40% for bit-identical texels.
 *
 * THE ATLAS DOES NOT SET THIS NUMBER. It fills whatever geometry leaves and shrinks to fit — which
 * is why it ships at 1408² and not the 2048² that measures better, and why the lossy WebP rungs
 * were refused rather than used to buy a bigger sheet. That ordering is the whole discipline here,
 * because the atlas has no natural stopping point: even 2048² leaves one texel covering 2.6 DEVICE
 * pixels at the ending's dpr floor, so "bigger looks better" will be true at every size and is
 * therefore not evidence for anything.
 *
 * The next quality lever is a COMPRESSION one, not another raise: `KHR_mesh_quantization` on
 * POSITION (12 B float → 6 B short) is worth roughly −220 kB gzipped and would fit 2048² inside
 * this same budget. It is deferred because several tests re-derive world-space facts straight from
 * the POSITION accessors and would all have to learn the node transform first.
 */
/**
 * ============================================================================
 * RAISED AGAIN IN TASK 92, BY THE MEASURED COST OF THE WATERING PIECE — AND NOT BY MORE
 * ============================================================================
 * Aram approved the watering resurrection (T92 spikes §4: can B, sage-mint, behind-pot staging,
 * accepted narrow-crop risk). The piece measures +53,717 B gzipped on the file on disk — can at
 * the arm's 1,500-vertex facet-audit floor (the 1,000-vertex rung FAILS the 2x-crop audit),
 * seven beads, both clips, two baked colour sets. The raise is exactly that measurement. The
 * plant's response and the soil darkening cost 0 B (shader chunks over bytes already shipped).
 */
export const DESK_PAYLOAD_BUDGET = 1_753_717

/**
 * ...and a ceiling on the uncompressed length, which is what the GPU and the parser pay.
 *
 * Deliberately loose — it exists to catch a category change (an accidental texture, a duplicated
 * attribute, modifiers baked on export), not to bound the art. The shipped file is 2,289,376:
 * the figurines added ~10,000 vertices and the atlas quadrupled its texels, while the alpha trim
 * gave 211,444 B back. Raised with the wire budget and for the same reason, and kept loose —
 * the ratio it wants to catch is a sudden one, not the 18% this round's contents grew by.
 */
export const DESK_RAW_CEILING = 2_600_000
