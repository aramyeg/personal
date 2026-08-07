'use client'
import { useMemo } from 'react'
import * as THREE from 'three'
import { PALETTE } from '../../palette'
import { clusterPlacements, InstancedFamilies, type ClusterSpec, type FamilySpec, type Placed } from './approach-kit'
import type { JourneyRef } from '../use-journey'

/**
 * B1 CANYON — MESAS + TALUS (Task 86). Fills approach-kit's cluster sampler with this wedge's
 * OWN grammar: broad flat-topped massifs shedding fans of graded rubble, not another scatter of
 * lone rust hexagons.
 *
 * THE DEFECT (T84/blind-audit). At chapter 4's own checkpoint (bottom third, this wedge's
 * approach) the ground was "a pale pink-tan bald dome with a few tiny scattered rust flecks" and
 * canyon.tsx's two geyser plumes read as "grey drips" dangling off the limb. At chapter 5's
 * checkpoint the verdict was worse: "a brown mud sphere with unarranged dark-red hexagons... a
 * stack of white pebbles that reads as nothing" — rust boulders placed one at a time, evenly,
 * never touching, no dark anchor, no value structure. canyon.tsx's existing 3 geysers + 2 single
 * hoodoos are kept untouched and complemented, never duplicated.
 *
 * REVISION ROUND 1 — the first cut passed tsc but FAILED composition: "the mesas read as orange
 * cardboard boxes tipped over the planet, and the talus reads as broken packing crates." Fixed by
 * (a) SCALE: everything was ~2.5x too big — every geometry + scale range re-derived off chapter
 * 1's largest approved element (a jungle canopy reaching ~0.35 world units from centre), landing
 * the biggest mesa at ~0.37-0.40 across x ~0.13 tall and the biggest talus boulder at ~0.08-0.10
 * across; (b) GEOMETRY LANGUAGE: `BoxGeometry` read as shipping crates — mesas rebuilt as two
 * squashed, offset icosahedra (a low base + a smaller "shoulder"), ledges rebuilt as a flattened
 * elongated sphere; (c) VALUE + HUE: the sunlit mesa tone (`strataDust`) was lighter/more
 * saturated than the ground it sat on — replaced with `PALETTE.earth`, the literal base colour of
 * land-bake.ts's own `case 'canyon'` ground paint, keeping `earthDeep` as the one dark tone.
 *
 * REVISION ROUND 2 — Round 1's mesas/talus were confirmed working ("the cardboard boxes are gone
 * ... reads as a proper dark rocky band") and are UNTOUCHED below. Two things were still wrong,
 * both scoped to chapter 5's own frame (this wedge's Zone B):
 *   (d) THE MIDDLE WAS A SMEAR — Zone B's centre band (roughly |x| in [0.50, 1.15]) had mesas and
 *       talus at its edges but nothing filling the middle, so it read as untextured low-contrast
 *       clay. Fixed by a new GROUND COVER family: a tiny merged clast (two pebbles, a flattened
 *       gravel chip and a wisp of dry-brush) repeated in dense 6-12-member clusters, each member
 *       0.02-0.05 across with its own size gradient — texture, not objects.
 *   (e) THE HOODOOS STILL READ AS NOTHING — "a stack of white pebbles" persisted because the
 *       groups were both too small AND too pale (the light `hoodooCap` tone dominated a tiny
 *       silhouette). Fixed by (i) re-deriving the spire geometry so the TALLEST spire in the
 *       biggest group reaches ~0.30 world units, and (ii) merging the body+cap draw into ONE
 *       family in `PALETTE.hoodooRock` (the wedge's own rock, `earth`'s reddish sibling) with
 *       `earthDeep` as the shadow alternate — no pale tone anywhere in the group now. The merge
 *       also pays for the new ground-cover family without exceeding the 6-draw-call cap.
 *
 * THE GRAMMAR — mesa + talus, this wedge's own mechanism (not borrowed from the dune echelons or
 * braided shoals next door):
 *   1. MESAS/BUTTES — low, rounded, flat-crowned mounds, distinctly wider than tall, placed in
 *      overlapping pairs/triples per cluster so a cluster reads as one massif with a soft
 *      shoulder-line. Two tones (instanceColor alternation): `earth` lit / `earthDeep` shadow.
 *   2. TALUS FANS — boulders spilling from EACH MESA'S OWN cluster centres (the talus specs
 *      reuse the mesa specs' {chapter,variant,t,x,clusters,seed} base, so a fan is anchored to
 *      its massif by construction), 8-14 per fan, size-graded by member index `mi`.
 *   3. HOODOO GROUPS — 3-5 spires of MIXED height (>=40% shortest-to-tallest spread) baked onto
 *      ONE shared plinth per group, so a soloist can never occur; sized (Round 2) to actually
 *      register next to the mesas, and toned (Round 2) to read as rock, not ornament.
 *   4. STRATA LEDGES — long, thin, ROUNDED shelves in alternating earth/rust tones, filling the
 *      gaps between massifs with banding instead of more scattered rubble.
 *   5. DARK ROCK MASSES — its own family, `earthDeep`/`strataShade` boulders weighted toward
 *      Zone B, so the value fix holds even where the talus fans alone wouldn't carry enough dark
 *      area.
 *   6. GROUND COVER (Round 2) — dense tiny pebble/gravel/scrub clasts across Zone B's middle
 *      band, the direct fix for the untextured smear.
 *
 * MACHINERY. Every placement is `clusterPlacements` (approach-kit): a pure function of
 * chapter/variant/window/seed and the terrain — no Math.random, no wall clock, no journeyRef read
 * outside InstancedFamilies' per-frame gate. `variant: 1` throughout (lap-2 / B, the only lap this
 * wedge is ever seen in).
 *
 * DRAW CALLS / TRIANGLES (self-reported; the dry/channel reject inside clusterPlacements can only
 * shrink these further, never grow them) — 6 InstancedMesh, hard cap (Round 2 merged the hoodoo
 * body+cap draws into one to make room for ground cover without exceeding it):
 *   mesas         2 icosahedra(0) merged,  40 tri  x ~20  instances ≈ 0.8k
 *   talus         icosahedron(0),          20 tri  x ~77  instances ≈ 1.5k
 *   dark rock     icosahedron(0)*,         20 tri  x ~20  instances ≈ 0.4k  (* shares the talus geo)
 *   ledges        1 flattened sphere(8x6), 80 tri  x ~32  instances ≈ 2.6k
 *   hoodoo groups plinth+12 drums+4 caps, 344 tri  x   4  instances ≈ 1.4k  (merged, Round 2)
 *   ground cover  2 pebbles+chip+blade,    68 tri  x ~45  instances ≈ 3.1k  (new, Round 2)
 *   total ≈ 9.8k triangles — comfortably under the 45k budget, at the 6-draw-call cap.
 *
 * UNCERTAINTIES (flagged for the caller):
 *  - Ledge orientation uses each member's own free yaw, not a true tangent-to-contour direction —
 *    approach-kit's placement frame doesn't expose one; unchanged from Round 1, not revisited.
 *  - Zone windows' x-lo is 0.50 with spreadX up to ~0.12-0.24; worst-case member jitter can in
 *    principle land inside the nominal |x|<0.45 lane guard, mirroring the exact margins already
 *    shipped in desert-groves.tsx / delta-shoals.tsx.
 *  - The ground-cover family's single merged geometry stands in for three named textures (pebble
 *    field, dry-brush tuft, gravel patch) at once, alternating flatness per instance rather than
 *    carrying three separate silhouettes — a deliberate simplification to stay inside the 6-draw
 *    cap by merging (per the Round 2 instruction) instead of adding a 7th family.
 *  - Hoodoo groups now reach a similar footprint to a mid-sized mesa (~0.35 across at the biggest);
 *    they're still shorter and sparser (4 instances vs ~20 mesas) so they read as an accent, but a
 *    future capture is the real judge of whether that balance holds.
 */

const CHAPTER = 4 // B1 canyon
const VARIANT = 1 as const // lap-2 / B — everything in this file is B1 content

// ---- the two zones named in the brief --------------------------------------
const ZONE_A_T: [number, number] = [0.02, 0.32]
const ZONE_A_X: [number, number] = [0.5, 1.65]
const ZONE_B_T: [number, number] = [0.72, 1.0]
const ZONE_B_X: [number, number] = [0.5, 1.55]
// Round 2 — the specific "smear" band inside Zone B: the untextured middle of chapter 5's frame,
// narrower than the full Zone B window (which extends out to the limb where talus already reads).
const ZONE_B_MID_X: [number, number] = [0.5, 1.15]

// ---- shared bases: talus fans anchor to their OWN mesa's cluster centres ----
// Only {chapter,variant,t,x,clusters,seed,side?} feed clusterPlacements' centre math (see its
// source) — perCluster/spreadT/spreadX/scale never do — so reusing a base object across the mesa
// and talus specs below guarantees a fan spills from the mesa it belongs to, the same technique
// desert-groves.tsx uses for its mound/palm/rock/scrub groves.
//
// UNCHANGED SINCE ROUND 1 — the mesas + talus fans were confirmed working; nothing in this block
// or the two `make*Geometry`/local functions that consume it was touched in Round 2.
const MASSIF_A_BASE = { chapter: CHAPTER, variant: VARIANT, t: ZONE_A_T, x: ZONE_A_X, clusters: 4, seed: 13.7 } as const
const MASSIF_B_BASE = { chapter: CHAPTER, variant: VARIANT, t: ZONE_B_T, x: ZONE_B_X, clusters: 3, seed: 41.3 } as const

// 1) MESAS — overlapping pairs/triples per cluster (small spread relative to the mesa's own
// footprint). Scale ranges keep the BIGGEST instance at ~0.37-0.40 across (geometry's baked full
// width 0.34 x up to 1.1 spec-scale x up to ~1.07 local wobble ≈ 0.40) and ~0.13 tall.
const MESA_A: ClusterSpec = { ...MASSIF_A_BASE, perCluster: [2, 4], spreadT: 0.045, spreadX: 0.12, scale: [0.75, 1.1] }
const MESA_B: ClusterSpec = { ...MASSIF_B_BASE, perCluster: [2, 3], spreadT: 0.035, spreadX: 0.1, scale: [0.55, 0.85] }

// 2) TALUS FANS — 8-14 per fan (the brief's own count), spilling wider than the mesa cluster it
// shares centres with. Geometry radius 0.045 (baked diameter 0.09) x these scale ranges x the
// mi-gradient keeps the biggest boulder ~0.08 across and most in the 0.03-0.06 range.
const TALUS_A: ClusterSpec = { ...MASSIF_A_BASE, perCluster: [8, 14], spreadT: 0.09, spreadX: 0.22, scale: [0.4, 0.85] }
const TALUS_B: ClusterSpec = { ...MASSIF_B_BASE, perCluster: [8, 14], spreadT: 0.07, spreadX: 0.18, scale: [0.35, 0.7] }

// 2b) DARK ROCK MASSES — the SAME small boulder geometry as talus (shared), just a bigger
// scale/gradient window so the biggest reads ~0.10 across (the general talus-family ceiling) —
// deliberately its own family (item 5 above), weighted toward Zone B where the "brown on peach,
// no value structure" verdict was earned.
const DARK_ROCK_A: ClusterSpec = {
  chapter: CHAPTER, variant: VARIANT, t: ZONE_A_T, x: ZONE_A_X,
  clusters: 2, perCluster: [3, 5], spreadT: 0.05, spreadX: 0.14, scale: [0.55, 0.9], seed: 173.9,
}
const DARK_ROCK_B: ClusterSpec = {
  chapter: CHAPTER, variant: VARIANT, t: ZONE_B_T, x: ZONE_B_X,
  clusters: 3, perCluster: [3, 5], spreadT: 0.04, spreadX: 0.12, scale: [0.5, 0.85], seed: 191.1,
}

// 3) HOODOO GROUPS — each PLACED instance is a whole 4-spire group (perCluster: [1,1]) baked on
// one shared plinth, so a soloist can never occur. ROUND 2: scale ranges raised (were [0.6,0.85]/
// [0.5,0.7]) so the tallest spire in the biggest group reaches the requested ~0.30 world units —
// see HOODOO_SPIRES for the baked geometry this multiplies.
const HOODOO_A: ClusterSpec = {
  chapter: CHAPTER, variant: VARIANT, t: ZONE_A_T, x: ZONE_A_X,
  clusters: 2, perCluster: [1, 1], spreadT: 0.01, spreadX: 0.02, scale: [0.95, 1.1], seed: 227.3,
}
const HOODOO_B: ClusterSpec = {
  chapter: CHAPTER, variant: VARIANT, t: ZONE_B_T, x: ZONE_B_X,
  clusters: 2, perCluster: [1, 1], spreadT: 0.01, spreadX: 0.02, scale: [0.8, 0.95], seed: 251.9,
}

// 4) STRATA LEDGES — long thin flat shelves filling the gaps between massifs; elongated footprint
// (spreadT >> spreadX, echoing desert-groves' dune-run streaks) so a cluster reads as a run of
// shelves rather than a blob of them.
const LEDGE_A: ClusterSpec = {
  chapter: CHAPTER, variant: VARIANT, t: ZONE_A_T, x: ZONE_A_X,
  clusters: 4, perCluster: [3, 6], spreadT: 0.07, spreadX: 0.1, scale: [0.55, 0.95], seed: 281.7,
}
const LEDGE_B: ClusterSpec = {
  chapter: CHAPTER, variant: VARIANT, t: ZONE_B_T, x: ZONE_B_X,
  clusters: 3, perCluster: [3, 6], spreadT: 0.055, spreadX: 0.08, scale: [0.45, 0.75], seed: 307.1,
}

// 6) GROUND COVER (Round 2, new) — the fix for the untextured Zone-B middle: dense small clusters
// (6-12 members, the brief's own count) of a tiny merged pebble/gravel/scrub clast, confined to
// the |x| in [0.50, 1.15] band the capture called out. Two cluster groups so the cover doesn't
// read as one uniform band across the whole width.
// Task 88: one more cluster group and a lifted floor — the centre band still carried lone
// small clasts between the groups at the checkpoint's reading distance.
const GROUND_COVER_B: ClusterSpec = {
  chapter: CHAPTER, variant: VARIANT, t: ZONE_B_T, x: ZONE_B_MID_X,
  clusters: 6, perCluster: [8, 12], spreadT: 0.055, spreadX: 0.12, scale: [0.5, 1.0], seed: 337.9,
}

/** A local-only clone of clay-kit's merge idiom (position + normal, NO vertex colour) — the
 *  InstancedFamilies pathway tints a whole instance from FamilySpec.color/colorDeep, so baking a
 *  vertex-colour attribute (clay-kit's buildMergedClay) would carry an attribute nothing reads.
 *  Same rationale + implementation as delta-shoals.tsx's mergeRaw; kept local because this task
 *  owns exactly one file. */
type RawPart = {
  geo: THREE.BufferGeometry
  pos?: [number, number, number]
  rot?: [number, number, number]
  scl?: [number, number, number]
}
function mergeRaw(parts: RawPart[]): THREE.BufferGeometry {
  const q = new THREE.Quaternion()
  const positions: number[] = []
  const normals: number[] = []
  for (const part of parts) {
    q.setFromEuler(new THREE.Euler(...(part.rot ?? [0, 0, 0])))
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(...(part.pos ?? [0, 0, 0])),
      q,
      new THREE.Vector3(...(part.scl ?? [1, 1, 1]))
    )
    const g = part.geo.toNonIndexed()
    g.applyMatrix4(m)
    const pos = g.attributes.position.array as ArrayLike<number>
    const nor = g.attributes.normal.array as ArrayLike<number>
    for (let i = 0; i < pos.length; i++) {
      positions.push(pos[i])
      normals.push(nor[i])
    }
    g.dispose()
    part.geo.dispose()
  }
  const out = new THREE.BufferGeometry()
  out.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  out.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  return out
}

/** A low, ROUNDED, flat-crowned mound — two squashed icosahedra (the ClayBoulder/ClayMound
 *  idiom), a wide low base with a smaller "shoulder" riding on it, off-centre so the join reads
 *  as a shoulder rather than a concentric staircase. UNCHANGED since Round 1. Base 0.17
 *  icosahedron flattened to 0.30 in Y (full width 0.34, full height ~0.115) + a 0.11 shoulder —
 *  base at y=0 so it seats on the canyon floor. 2 icosahedra(0) x 20 tri = 40 tri. */
function makeMesaGeometry(): THREE.BufferGeometry {
  const base: RawPart = { geo: new THREE.IcosahedronGeometry(0.17, 0), pos: [0, 0.051, 0], scl: [1.0, 0.3, 0.86] }
  const shoulder: RawPart = { geo: new THREE.IcosahedronGeometry(0.11, 0), pos: [0.025, 0.082, -0.015], scl: [0.95, 0.3, 0.82] }
  return mergeRaw([base, shoulder])
}

/** A long, thin, ROUNDED shelf — a flattened, elongated 8x6 sphere (matches delta-shoals'
 *  sandbar idiom), NOT a box. UNCHANGED since Round 1: full width ~0.31, full thickness ~0.017
 *  (a third of the box this replaced), full depth ~0.10. 8x6 sphere = 80 tri. */
function makeLedgeGeometry(): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(0.1, 8, 6)
  g.scale(1.55, 0.085, 0.5)
  return g
}

/**
 * ROUND 2 — re-derived. The tallest spire's baked height was raised from 0.16 to 0.27 so that,
 * at HOODOO_A's top spec-scale (1.1), the tallest spire in the biggest group reaches
 * 0.27 x 1.1 ≈ 0.30 world units, the size the capture asked for ("currently too small to
 * register"). Radii and in-plinth positions were scaled up in the same proportion (x1.227) so the
 * group's internal geometry stays consistent, not just uniformly rescaled from a single knob.
 * Heights 0.27/0.172/0.221/0.141 — tallest-to-shortest is a 47.8% drop (past the 40% floor), a
 * genuine GROUP skyline, never a single lone hoodoo (the "stack of white pebbles" defect).
 */
const HOODOO_SPIRES: Array<{ px: number; pz: number; h: number; r: number }> = [
  { px: 0, pz: 0, h: 0.27, r: 0.047 },
  { px: 0.123, pz: 0.061, h: 0.172, r: 0.039 },
  { px: -0.11, pz: -0.055, h: 0.221, r: 0.04 },
  { px: 0.025, pz: -0.123, h: 0.141, r: 0.033 },
]
/** The plinth's own full height (see makeHoodooGeometry) — spires + caps are offset above it. */
const HOODOO_PLINTH_H = 0.028

/**
 * ROUND 2 — merged. The hoodoo body (plinth + drums) and its caprocks used to be two separate
 * InstancedMesh draws so the group could be two-tone (rock body / lighter cap); the capture's
 * "still reads as pale" verdict + the need for a 6th family (ground cover) for the same 6-draw
 * budget both point the same way, so they're now ONE merged geometry in a single rock tone
 * (colorDeep supplies the shadow side per-instance instead of a lighter per-part cap). A hoodoo
 * group is a shared plinth (radial 6) + each spire's 3 tapering drums (radial 5, the strata) +
 * one squashed-icosahedron caprock per spire crown — baked as a GROUP so a soloist can never
 * occur. Plinth 6*4=24 tri; 4 spires x 3 drums x (5*4)=240 tri; 4 caps x 20 tri=80 tri; total
 * 344 tri.
 */
function makeHoodooGeometry(): THREE.BufferGeometry {
  const parts: RawPart[] = [{ geo: new THREE.CylinderGeometry(0.14, 0.16, HOODOO_PLINTH_H, 6), pos: [0, HOODOO_PLINTH_H / 2, 0] }]
  for (const s of HOODOO_SPIRES) {
    const drums = 3
    for (let d = 0; d < drums; d++) {
      const y0 = HOODOO_PLINTH_H + (s.h * d) / drums
      const seg = s.h / drums
      const rLo = s.r * (1 - 0.12 * d)
      const rHi = s.r * (1 - 0.12 * (d + 1))
      parts.push({ geo: new THREE.CylinderGeometry(rHi, rLo, seg, 5), pos: [s.px, y0 + seg / 2, s.pz] })
    }
    parts.push({
      geo: new THREE.IcosahedronGeometry(s.r * 1.5, 0),
      pos: [s.px, HOODOO_PLINTH_H + s.h, s.pz],
      scl: [1.1, 0.55, 1.1],
    })
  }
  return mergeRaw(parts)
}

/**
 * ROUND 2 — new. The Zone-B "smear" fix: a tiny merged clast standing in for three named ground
 * textures at once (two round pebbles, one flattened gravel chip, one wisp of dry-brush) inside a
 * ~0.05-world-unit footprint, base at y≈0. Repeated in dense clusters (see GROUND_COVER_B) rather
 * than varied by geometry — `groundCoverLocal` alternates flatness per instance (pebble-round vs
 * gravel-flat) from the SAME geometry, which is the "merge families, don't add a 7th" move the
 * brief asked for. 2 icosahedra x 20 tri + 1 icosahedron x 20 tri + 1 cone(4) x 8 tri = 68 tri.
 */
function makeGroundCoverGeometry(): THREE.BufferGeometry {
  return mergeRaw([
    { geo: new THREE.IcosahedronGeometry(0.014, 0), pos: [0, 0.012, 0] },
    { geo: new THREE.IcosahedronGeometry(0.01, 0), pos: [0.016, 0.008, 0.006], scl: [1, 0.8, 1] },
    { geo: new THREE.IcosahedronGeometry(0.016, 0), pos: [-0.012, 0.006, -0.008], scl: [1.1, 0.5, 1.1] }, // flat gravel chip
    { geo: new THREE.ConeGeometry(0.006, 0.03, 4), pos: [0.006, 0.015, -0.014], rot: [0.25, 0.6, 0.1] }, // dry-brush wisp
  ])
}

/**
 * The B1 canyon's mesa-and-talus dressing (Task 86, Round 2): low rounded massifs with a dark
 * shadow tone pulled from the ground's own paint recipe, graded talus fans anchored to each
 * massif, deliberately dark boulder masses for value structure, hoodoo GROUPS (never soloists,
 * now sized and toned to register as rock), rounded contour-banding strata ledges, and dense
 * small-scale ground cover filling Zone B's middle. Every family is variant 1 (lap-2 / B) —
 * InstancedFamilies gates each instance by the renewal front at its own longitude, the same
 * Forest/Jungle/DesertGroves/DeltaShoals contract.
 */
export function CanyonBadlands({ journeyRef }: { journeyRef: JourneyRef }) {
  const families = useMemo<FamilySpec[]>(() => {
    // Scratch matrices reused across every `local` call below — InstancedFamilies' build loop
    // runs synchronously, one family/instance at a time, so sharing these is safe (same idiom as
    // jungle.tsx's buildLayer / desert-groves.tsx) and avoids a per-instance allocation.
    const yawT = new THREE.Matrix4()
    const scl = new THREE.Matrix4()

    // -- 1: mesas — rounded massifs, overlapping pairs/triples per cluster ------------------
    const mesaPlaced: Placed[] = [...clusterPlacements(MESA_A), ...clusterPlacements(MESA_B)]
    const mesaLocal = (m: THREE.Matrix4, p: Placed) => {
      yawT.makeRotationY(p.yaw)
      // A small per-instance non-uniform stretch (x/z only — height stays governed purely by
      // the geometry + spec scale, so the ~0.13 tall cap always holds), a pure function of the
      // member's own yaw, so overlapping members in one cluster don't read as stamped copies.
      const wobble = 0.93 + 0.14 * (0.5 + 0.5 * Math.cos(p.yaw * 3.0))
      scl.makeScale(wobble, 1, 1 / wobble)
      m.multiply(yawT).multiply(scl)
    }
    const mesaGeo = makeMesaGeometry() // 40 tri

    // -- 2: talus — fans anchored to the SAME cluster centres as the mesas ------------------
    const talusPlaced: Placed[] = [...clusterPlacements(TALUS_A), ...clusterPlacements(TALUS_B)]
    const talusGeo = new THREE.IcosahedronGeometry(0.045, 0) // 20 tri; shared with the dark-rock family below
    const talusLocal = (m: THREE.Matrix4, p: Placed) => {
      yawT.makeRotationY(p.yaw)
      // Size gradient keyed off the member index within its own fan: big near the anchor
      // (mi = 0, "the top of the fan"), tapering toward the toe as mi climbs.
      const g = Math.max(0.4, 1.05 - 0.06 * p.mi)
      scl.makeScale(g, g * 0.75, g * 0.9)
      m.multiply(yawT).multiply(scl)
    }

    // -- 2b: dark rock masses — bigger, deliberately darker, weighted toward Zone B ---------
    const darkRockPlaced: Placed[] = [...clusterPlacements(DARK_ROCK_A), ...clusterPlacements(DARK_ROCK_B)]
    const darkRockLocal = (m: THREE.Matrix4, p: Placed) => {
      yawT.makeRotationY(p.yaw)
      const g = Math.max(0.6, 1.15 - 0.05 * p.mi)
      scl.makeScale(g, g * 0.8, g * 0.95)
      m.multiply(yawT).multiply(scl)
    }

    // -- 3: hoodoo groups — every placed instance IS a spired group, never a soloist --------
    const hoodooPlaced: Placed[] = [...clusterPlacements(HOODOO_A), ...clusterPlacements(HOODOO_B)]
    const hoodooLocal = (m: THREE.Matrix4, p: Placed) => m.makeRotationY(p.yaw)
    const hoodooGeo = makeHoodooGeometry() // 344 tri (merged body + caps, Round 2)

    // -- 4: strata ledges — long thin rounded shelves filling the gaps between massifs ------
    const ledgePlaced: Placed[] = [...clusterPlacements(LEDGE_A), ...clusterPlacements(LEDGE_B)]
    const ledgeLocal = (m: THREE.Matrix4, p: Placed) => m.makeRotationY(p.yaw)
    const ledgeGeo = makeLedgeGeometry() // 80 tri

    // -- 6: ground cover — dense tiny pebble/gravel/scrub clasts across Zone B's middle -----
    const groundCoverPlaced: Placed[] = clusterPlacements(GROUND_COVER_B)
    const groundCoverLocal = (m: THREE.Matrix4, p: Placed) => {
      yawT.makeRotationY(p.yaw)
      // Size gradient within each little field (same idiom as talusLocal), plus a free
      // pebble/gravel-chip alternation keyed off mi's parity — flattened members read as
      // gravel, rounder ones as pebbles, from the SAME merged geometry (no extra draw call).
      const g = Math.max(0.35, 1.0 - 0.05 * p.mi)
      const flat = p.mi % 2 === 0 ? 1 : 0.55
      scl.makeScale(g, g * flat, g)
      m.multiply(yawT).multiply(scl)
    }
    const groundCoverGeo = makeGroundCoverGeometry() // 68 tri

    return [
      // 1: mesas — `earth` lit (the ground's own base tone, per land-bake.ts's canyon paint) /
      // `earthDeep` shadow (the ONE genuinely dark tone) — Round 1 replaced `strataDust`, which
      // was lighter + more saturated than the ground it sat on and read as a foreign object.
      { placed: mesaPlaced, geometry: mesaGeo, color: PALETTE.earth, colorDeep: PALETTE.earthDeep, local: mesaLocal },
      // 2: talus fans — rust primary / stone alternate, size-graded per fan
      { placed: talusPlaced, geometry: talusGeo, color: PALETTE.rust, colorDeep: PALETTE.stone, local: talusLocal },
      // 3: dark rock masses — the explicit value-structure fix (earthDeep / strataShade)
      { placed: darkRockPlaced, geometry: talusGeo, color: PALETTE.earthDeep, colorDeep: PALETTE.strataShade, local: darkRockLocal },
      // 4: hoodoo groups (Round 2: merged body+caps, bigger, no pale tone) — hoodooRock lit /
      // earthDeep shadow, so a group reads as rock, not a pale ornament.
      { placed: hoodooPlaced, geometry: hoodooGeo, color: PALETTE.hoodooRock, colorDeep: PALETTE.earthDeep, local: hoodooLocal },
      // 5: strata ledges — earth primary / rust alternate, banding the gaps between massifs
      { placed: ledgePlaced, geometry: ledgeGeo, color: PALETTE.earth, colorDeep: PALETTE.rust, local: ledgeLocal },
      // 6: ground cover (Round 2, new) — close to the ground colour with a slightly darker
      // alternate, dense and small: texture, not objects.
      { placed: groundCoverPlaced, geometry: groundCoverGeo, color: PALETTE.stone, colorDeep: PALETTE.earthDeep, local: groundCoverLocal },
    ]
  }, [])

  return <InstancedFamilies families={families} variant={VARIANT} journeyRef={journeyRef} />
}
