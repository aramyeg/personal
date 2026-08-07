'use client'
import { useMemo } from 'react'
import * as THREE from 'three'
import { PALETTE } from '../../palette'
import { buildMergedClay, type ClayPart } from './clay-kit'
import { clusterPlacements, InstancedFamilies, type ClusterSpec, type FamilySpec, type Placed } from './approach-kit'
import type { JourneyRef } from '../use-journey'

/**
 * DESERT GROVES — the B0 GOLDEN DUNES wedge's approach + tail dressing (Task 86).
 *
 * THE DEFECT (T84 audit, the headline finding this file fixes). At chapter 3's checkpoint the
 * bottom third of the planet was a bald mustard-gold dome with THREE LONE ClayPalm instances
 * hanging off the bottom limb — "three bare brown sticks... poultry legs" in the audit's words.
 * Per approach-kit's own header, that band is foreshortened ~6:1, so an isolated upright is a
 * single stroke with background on both sides; the modelling was never the fault, the ISOLATION
 * was. The fix is not fewer palms or no palms — it is giving every upright a clump and a base so
 * the eye reads vegetation, the way chapter 1's overlapping crowns read as one decorated edge.
 *
 * THE GRAMMAR — dune echelon + oasis groves, this wedge's own mechanism (not borrowed):
 *   1. DUNE RIDGES — long, low, overlapping mounds run in echelon (parallel runs, offset
 *      diagonally). The dominant move: it costs no verticals and turns the bald dome into a
 *      landscape with a crest line. Two tones, one small step apart — dune bulk / goldSand crest.
 *   2. OASIS GROVES — 3-4 palms of DIFFERENT heights per clump, crowns overlapping, standing on
 *      a shared low mound, skirted by rocks + scrub. A grove is never one palm.
 *   3. SCRUB + STONE FIELDS — small clusters filling the gaps between ridges so no patch of the
 *      wedge reads as flat smear at reading distance.
 *   4. Zone B only — a couple of mid-scale waymarks (a half-buried block under a stacked cairn
 *      stone) so the lower-middle band chapter 4's OWN checkpoint reads has something to read.
 *
 * MACHINERY. Every placement comes from `clusterPlacements` (approach-kit): a pure function of
 * chapter/variant/window/seed and the terrain — no Math.random, no wall clock, no journeyRef read
 * except inside InstancedFamilies' per-frame gate. Groves reuse the SAME cluster window/seed
 * across their mound/palm/rock/scrub calls so the four layers land on the SAME cluster centres
 * (clusterPlacements' centre math depends only on chapter/variant/t/x/clusters/seed/side, never on
 * perCluster/spreadT/spreadX/scale — see its source) without hand-authoring a grove list.
 *
 * REVISION ROUND (t86-planet-art capture review, same-day). The first pass killed the poultry
 * legs but overshot the ridge SCALE by ~2.5x (mounds were reading as pale slabs pasted on the
 * sphere) and put too much of that mass right next to the pyramids/camels at the desert's own
 * checkpoint. Four numeric corrections, all still in this file:
 *   - SCALE: mound geometry radius 0.4→0.13 and the ridge `scale` ranges cut so a ridge mound
 *     tops out around 0.44 long / 0.07 tall / 0.16 wide (world units) — a swell, not a slab.
 *   - VALUE: ridge colour swapped to `dune` as the majority (bulk) tone with `goldSand` as the
 *     1/3-share crest accent, one small luminance step apart — nothing near-white in this wedge.
 *   - DENSITY: DUNE_RUNS_A cut from 3 clusters to 2 and pushed to |x| ∈ [0.75, 1.65] (off the
 *     limb, away from the hero pyramids/camels that share Zone A's screen position at the
 *     desert's own checkpoint); grove/rock/scrub Zone-A windows are untouched, they read fine.
 *   - THE SURVIVING LONE PALM: a 6th, forced-side rescue grove seats at t∈[0.10,0.18], x∈
 *     [-1.0,-0.6] — the exact latitude of the global-dressing single ClayPalm the audit still
 *     found — so that palm gains the neighbours + base this whole file exists to guarantee. Every
 *     grove's palm spread (≤2×spreadX per pair, ≤0.13 world units) is already inside the
 *     "nearest neighbour ≤ 0.25" bound the brief asked to confirm.
 *
 * ROUND 3 (same review thread). The ridge push-out in round 2 correctly gave the pyramids/camels
 * air, but it also emptied t∈[0.02,0.16] / |x|∈[0.50,1.10] — the face ABOVE the now-dressed rim at
 * the desert's own checkpoint — down to flat gold-olive. Section 5 (GROUND COVER) adds fine pebble
 * fields, dry scrub and thin wind-ripple streaks THERE, reusing the mound/rock/scrub families
 * (no 7th draw call) at a scale well under a ridge's own, and centred at |x| ≈ 0.75-0.8 so
 * clusterPlacements' `laneMin` guard (drops any member whose |x| < 0.45 after jitter) doesn't
 * eat the clusters. The groves and ridges from rounds 1-2 are otherwise untouched.
 *
 * DRAW / TRIANGLE BUDGET — exactly 6 InstancedMesh (the hard cap), ~7.9k triangles total (budget
 * is 45k, so ~18% of it): mounds 80-tri sphere(8×6) × ~38 ≈ 3.0k · trunks 24-tri cylinder(6) ×
 * ~22 ≈ 0.5k · crowns 80-tri sphere(8×6) × ~22 ≈ 1.8k · rocks 20-tri icosahedron(0) × ~88 ≈ 1.8k ·
 * scrub 15-tri 3-blade tuft × ~39 ≈ 0.6k · zone-B waymarks 52-tri cairn × ~3 ≈ 0.16k. Counts above
 * are the spec midpoints; the dry/channel/lane rejects in clusterPlacements can only shrink them.
 */

const CHAPTER = 3
const VARIANT = 1 as const // lap-2 / B — everything in this file is B0 content

// ---- the two zones named in the brief --------------------------------------
// Zone A ("approach") is the PRIORITY: the bald bottom third at chapter 3's own checkpoint.
// Zone B ("tail") is the lower-middle band chapter 4's checkpoint reads back across the horizon.
// Both windows keep |x| >= 0.5, well clear of the girl's lane (|x| < 0.45 is forbidden).
const ZONE_A_T: [number, number] = [0.02, 0.32]
const ZONE_A_X: [number, number] = [0.5, 1.65]
const ZONE_B_T: [number, number] = [0.72, 1.0]
const ZONE_B_X: [number, number] = [0.5, 1.55]

// ---- 1. DUNE RIDGES: echelon runs of overlapping low mounds ----------------
// spreadT >> spreadX gives each cluster an elongated footprint (members bunch along the travel
// axis more than across it), which combined with the per-member yaw-oriented squash in
// `moundLocal` is what reads as a "run" rather than a round clump. spreadT/spreadX were both
// pulled in for the revision round: with the mound geometry itself now ~1/3 its old size, the old
// jitter radii would open gaps between members and lose the "overlapping crests" read.
//
// Zone A also got two revision-round changes DUNE_RUNS_B did NOT: clusters cut 3→2 ("about half")
// and x pushed out to [0.75, 1.65] (was [0.5, 1.65]) — at the desert's OWN checkpoint, Zone A
// lands near the TOP of the disc where the pyramids/camels live, so its ridges now sit toward the
// limb instead of crowding the hero content. Zone B's ridges weren't flagged as cluttered and are
// left at the original window; only their SCALE shrank along with every other mound.
const DUNE_RUNS_A: ClusterSpec = {
  chapter: CHAPTER, variant: VARIANT, t: ZONE_A_T, x: [0.75, 1.65],
  clusters: 2, perCluster: [4, 6], spreadT: 0.04, spreadX: 0.09, scale: [0.7, 1.0], seed: 11.3,
}
const DUNE_RUNS_B: ClusterSpec = {
  chapter: CHAPTER, variant: VARIANT, t: ZONE_B_T, x: ZONE_B_X,
  clusters: 2, perCluster: [4, 6], spreadT: 0.03, spreadX: 0.065, scale: [0.45, 0.7], seed: 29.7,
}

// ---- 2. OASIS GROVES: mound + palms + rocks + scrub sharing cluster centres ----
// Each *_BASE spec fixes {chapter, variant, t, x, clusters, seed, side}; the four layers below
// spread that base with their OWN perCluster/spreadT/spreadX/scale so a grove's mound, its palms,
// its skirt rocks and its scrub tufts all land around the SAME point without a hand-authored list.
// 4 groves in zone A (the priority) + 1 in zone B tail + 1 forced-side RESCUE grove (below, for
// the lone global-dressing palm the revision round found still standing alone) = 6 total.
const GROVES_A_BASE = { chapter: CHAPTER, variant: VARIANT, t: ZONE_A_T, x: ZONE_A_X, clusters: 4, seed: 53.1 } as const
const GROVES_B_BASE = { chapter: CHAPTER, variant: VARIANT, t: ZONE_B_T, x: ZONE_B_X, clusters: 1, seed: 67.9 } as const

// RESCUE grove — not part of the brief's original 3-5, added in the revision round. The audit
// found ONE global-dressing ClayPalm still standing alone (not ours; the flank scatter's own
// "occasional oasis palm") at roughly t≈0.10-0.18 on the NEGATIVE flank. `side: -1` forces every
// member onto that flank so this grove's mound/palms/rocks/scrub land right at that palm's own
// latitude and give it the neighbours + base the rest of this file already guarantees everywhere
// else — the surviving instance of the exact defect this task exists to remove.
const RESCUE_BASE = {
  chapter: CHAPTER, variant: VARIANT, t: [0.1, 0.18] as [number, number], x: [0.6, 1.0] as [number, number],
  side: -1 as const, clusters: 1, seed: 151.2,
} as const

const GROVE_MOUNDS_A: ClusterSpec = { ...GROVES_A_BASE, perCluster: [1, 1], spreadT: 0.004, spreadX: 0.01, scale: [0.6, 0.8] }
const GROVE_MOUNDS_B: ClusterSpec = { ...GROVES_B_BASE, perCluster: [1, 1], spreadT: 0.004, spreadX: 0.01, scale: [0.5, 0.65] }
const GROVE_PALMS_A: ClusterSpec = { ...GROVES_A_BASE, perCluster: [3, 4], spreadT: 0.02, spreadX: 0.065, scale: [0.6, 1.25] }
const GROVE_PALMS_B: ClusterSpec = { ...GROVES_B_BASE, perCluster: [3, 4], spreadT: 0.016, spreadX: 0.05, scale: [0.5, 0.95] }
const GROVE_ROCKS_A: ClusterSpec = { ...GROVES_A_BASE, perCluster: [3, 5], spreadT: 0.03, spreadX: 0.09, scale: [0.6, 1.1] }
const GROVE_ROCKS_B: ClusterSpec = { ...GROVES_B_BASE, perCluster: [3, 5], spreadT: 0.024, spreadX: 0.07, scale: [0.5, 0.9] }
const GROVE_SCRUB_A: ClusterSpec = { ...GROVES_A_BASE, perCluster: [2, 3], spreadT: 0.03, spreadX: 0.08, scale: [0.7, 1.1] }
const GROVE_SCRUB_B: ClusterSpec = { ...GROVES_B_BASE, perCluster: [2, 3], spreadT: 0.024, spreadX: 0.06, scale: [0.6, 0.9] }
const RESCUE_MOUND: ClusterSpec = { ...RESCUE_BASE, perCluster: [1, 1], spreadT: 0.004, spreadX: 0.01, scale: [0.6, 0.75] }
const RESCUE_PALMS: ClusterSpec = { ...RESCUE_BASE, perCluster: [3, 4], spreadT: 0.02, spreadX: 0.065, scale: [0.6, 1.2] }
const RESCUE_ROCKS: ClusterSpec = { ...RESCUE_BASE, perCluster: [3, 5], spreadT: 0.03, spreadX: 0.09, scale: [0.6, 1.05] }
const RESCUE_SCRUB: ClusterSpec = { ...RESCUE_BASE, perCluster: [2, 3], spreadT: 0.03, spreadX: 0.08, scale: [0.65, 1.0] }

// ---- 3. SCRUB + STONE FIELDS: independent clusters filling the gaps --------
const FIELD_ROCKS_A: ClusterSpec = {
  chapter: CHAPTER, variant: VARIANT, t: ZONE_A_T, x: ZONE_A_X,
  clusters: 3, perCluster: [4, 8], spreadT: 0.05, spreadX: 0.2, scale: [0.45, 1.0], seed: 83.4,
}
const FIELD_ROCKS_B: ClusterSpec = {
  chapter: CHAPTER, variant: VARIANT, t: ZONE_B_T, x: ZONE_B_X,
  clusters: 2, perCluster: [4, 6], spreadT: 0.04, spreadX: 0.15, scale: [0.4, 0.8], seed: 97.2,
}
const FIELD_SCRUB_A: ClusterSpec = {
  chapter: CHAPTER, variant: VARIANT, t: ZONE_A_T, x: ZONE_A_X,
  clusters: 3, perCluster: [2, 4], spreadT: 0.05, spreadX: 0.18, scale: [0.6, 1.0], seed: 109.6,
}
const FIELD_SCRUB_B: ClusterSpec = {
  chapter: CHAPTER, variant: VARIANT, t: ZONE_B_T, x: ZONE_B_X,
  clusters: 2, perCluster: [2, 3], spreadT: 0.04, spreadX: 0.13, scale: [0.5, 0.85], seed: 121.8,
}

// ---- 4. ZONE B ONLY: mid-scale waymarks -------------------------------------
const ZONE_B_MIDOBJECTS: ClusterSpec = {
  chapter: CHAPTER, variant: VARIANT, t: ZONE_B_T, x: ZONE_B_X,
  clusters: 1, perCluster: [2, 3], spreadT: 0.08, spreadX: 0.28, scale: [0.8, 1.4], seed: 139.4,
}

// ---- 5. GROUND COVER (round 3): the untextured mid-face band -----------------
// Round-2 pushed the ridges out to |x| >= 0.75 to give the pyramids/camels air, which left
// t∈[0.02,0.16] / |x|∈[0.50,1.10] — the face ABOVE the now-dressed rim, at the desert's own
// checkpoint — as flat gold-olive with only sparse dots. This is texture, not landscape: fine
// pebble fields, dry scrub and thin wind-ripple streaks, reusing the THREE EXISTING families
// (rocks / scrub / mounds) at small scale rather than opening a 7th draw call. Cluster centres
// sit at |x| ≈ 0.75-0.8, not 0.50 — clusterPlacements now drops any member whose |x| falls below
// its `laneMin` (0.45) AFTER jitter, and a centre near the window's own floor would lose most of
// its members to that guard before ever reaching the ground.
const GROUND_T: [number, number] = [0.02, 0.16]
const GROUND_PEBBLES: ClusterSpec = {
  chapter: CHAPTER, variant: VARIANT, t: GROUND_T, x: [0.65, 0.9],
  clusters: 4, perCluster: [6, 12], spreadT: 0.04, spreadX: 0.16, scale: [0.18, 0.5], seed: 167.4,
}
const GROUND_SCRUB: ClusterSpec = {
  chapter: CHAPTER, variant: VARIANT, t: GROUND_T, x: [0.65, 0.9],
  clusters: 3, perCluster: [2, 4], spreadT: 0.035, spreadX: 0.14, scale: [0.4, 0.7], seed: 179.8,
}
// "Wind-ripple streaks" reuse the mound family's own elongated-squash local (1.7, 0.26, 0.62 —
// already thin and long) at a scale small enough to read as a mark in the sand rather than a
// competing ridge (≤ ~0.12 long at the top of this range, versus a ridge mound's ~0.44).
const GROUND_STREAKS: ClusterSpec = {
  chapter: CHAPTER, variant: VARIANT, t: GROUND_T, x: [0.7, 0.95],
  clusters: 3, perCluster: [3, 5], spreadT: 0.03, spreadX: 0.12, scale: [0.15, 0.28], seed: 191.6,
}

/** A dusty tuft of desert scrub — three tapered blades fanning from a base, merged into ONE
 *  geometry (buildMergedClay). `color` on each part is baked into an unused vertex-colour
 *  attribute (InstancedFamilies' material is not vertexColors); harmless, kept for readability if
 *  this geometry is ever reused somewhere that IS vertex-coloured. Open-ended cones: 5 tri each. */
function makeScrubTuft(): THREE.BufferGeometry {
  const lean = [-0.32, 0.04, 0.34]
  const yaw = [0.4, 2.35, 4.6]
  const parts: ClayPart[] = lean.map((l, i) => ({
    geo: new THREE.ConeGeometry(0.012, 0.08 + 0.025 * (i % 2), 5, 1, true),
    color: PALETTE.reedGreen,
    pos: [0.015 * Math.cos(yaw[i]), 0.04, 0.015 * Math.sin(yaw[i])],
    rot: [l, yaw[i], l * 0.5],
  }))
  return buildMergedClay(parts)
}

/** A half-buried block topped with two stacked stones — the zone-B "half-buried block / cairn /
 *  wind-carved stone" waymark, collapsed into ONE merged geometry (draw-budget forced the three
 *  flavours in the brief into one silhouette; per-instance scale still buys "distinct sizes"). */
function makeWaymark(): THREE.BufferGeometry {
  return buildMergedClay([
    { geo: new THREE.BoxGeometry(0.22, 0.1, 0.18), color: PALETTE.sand, pos: [0, 0.05, 0], rot: [0.05, 0.4, 0.02] },
    { geo: new THREE.IcosahedronGeometry(0.075, 0), color: PALETTE.dune, pos: [0.02, 0.13, -0.01], scl: [1, 0.85, 1] },
    { geo: new THREE.IcosahedronGeometry(0.05, 0), color: PALETTE.sand, pos: [-0.01, 0.2, 0.015] },
  ])
}

export function DesertGroves({ journeyRef }: { journeyRef: JourneyRef }) {
  const families = useMemo<FamilySpec[]>(() => {
    // Scratch matrices reused across every `local` call below — the build loop in
    // InstancedFamilies runs synchronously and one family at a time, so sharing these is safe
    // (same idiom as jungle.tsx's buildLayer) and avoids a per-instance allocation.
    const yawT = new THREE.Matrix4()
    const trans = new THREE.Matrix4()
    const scl = new THREE.Matrix4()

    // -- mounds: dune-run members + each grove's shared base mound, ONE family --------------
    const moundPlaced: Placed[] = [
      ...clusterPlacements(DUNE_RUNS_A),
      ...clusterPlacements(DUNE_RUNS_B),
      ...clusterPlacements(GROVE_MOUNDS_A),
      ...clusterPlacements(GROVE_MOUNDS_B),
      ...clusterPlacements(RESCUE_MOUND),
      ...clusterPlacements(GROUND_STREAKS), // round 3: small wind-ripple marks, not more ridge
    ]
    // Stretch into a long low ridge and orient by the member's OWN yaw so a run's mounds don't
    // all point the same way (reads hand-placed, not stamped); squash keeps it low and wide.
    // REVISION ROUND: geometry radius 0.4→0.13 and the squash tightened (1.9,0.34,1.05 →
    // 1.7,0.26,0.62) — at the top of each ridge's own `scale` range (1.0) this now tops out at
    // 2·0.13·1.7·1.0 ≈ 0.44 long / 2·0.13·0.26·1.0 ≈ 0.07 tall / 2·0.13·0.62·1.0 ≈ 0.16 wide,
    // inside the calibration a dune ridge may be "up to ~0.45 long, under ~0.10 tall, ~0.22 wide."
    const moundLocal = (m: THREE.Matrix4, p: Placed) => {
      yawT.makeRotationY(p.yaw)
      scl.makeScale(1.7, 0.26, 0.62)
      m.multiply(yawT).multiply(scl)
    }
    const moundGeo = new THREE.SphereGeometry(0.13, 8, 6) // 80 tri

    // -- palms: trunks + crowns share ONE placement array (grove clumps) --------------------
    const palmPlaced: Placed[] = [
      ...clusterPlacements(GROVE_PALMS_A),
      ...clusterPlacements(GROVE_PALMS_B),
      ...clusterPlacements(RESCUE_PALMS),
    ]
    // `mi` is the member's index within its own grove (0 = anchor). Staggering height by mi
    // rather than only by the spec's random `s` range is what makes a grove of 3-4 read as
    // palms of DIFFERENT heights whose crowns overlap, instead of four copies of one tree.
    const heightFactor = (p: Placed) => 1 - 0.12 * p.mi
    const trunkLocal = (m: THREE.Matrix4, p: Placed) => {
      const hf = heightFactor(p)
      scl.makeScale(1, hf, 1) // cylinder is symmetric about Y, so no yaw needed here
      trans.makeTranslation(0, 0.25 * hf, 0) // lift so the base stays at the ground
      m.multiply(trans).multiply(scl)
    }
    const trunkGeo = new THREE.CylinderGeometry(0.028, 0.045, 0.5, 6) // 24 tri
    const crownLocal = (m: THREE.Matrix4, p: Placed) => {
      const hf = heightFactor(p)
      yawT.makeRotationY(p.yaw)
      scl.makeScale(1.5, 0.55, 1.5)
      // small lateral offset (keyed off yaw, still pure/deterministic) so neighbouring crowns
      // don't sit dead-centre over their own trunks — that's what buys the overlap the brief asks
      // for instead of four blobs stacked on four sticks in a neat row.
      trans.makeTranslation(0.03 * Math.cos(p.yaw), 0.5 * hf, 0.03 * Math.sin(p.yaw))
      m.multiply(trans).multiply(yawT).multiply(scl)
    }
    const crownGeo = new THREE.SphereGeometry(0.16, 8, 6) // 80 tri

    // -- rocks: grove skirts + the general stone fields, ONE family -------------------------
    const rockPlaced: Placed[] = [
      ...clusterPlacements(GROVE_ROCKS_A),
      ...clusterPlacements(GROVE_ROCKS_B),
      ...clusterPlacements(FIELD_ROCKS_A),
      ...clusterPlacements(FIELD_ROCKS_B),
      ...clusterPlacements(RESCUE_ROCKS),
      ...clusterPlacements(GROUND_PEBBLES), // round 3: fine pebble-field texture for the mid band
    ]
    const rockLocal = (m: THREE.Matrix4, p: Placed) => {
      yawT.makeRotationY(p.yaw)
      scl.makeScale(1, 0.75, 0.9) // faceted, slightly flattened — a chipped clay rock, not a ball
      m.multiply(yawT).multiply(scl)
    }
    const rockGeo = new THREE.IcosahedronGeometry(0.09, 0) // 20 tri

    // -- scrub: grove tufts + the general scrub fields, ONE family --------------------------
    const scrubPlaced: Placed[] = [
      ...clusterPlacements(GROVE_SCRUB_A),
      ...clusterPlacements(GROVE_SCRUB_B),
      ...clusterPlacements(FIELD_SCRUB_A),
      ...clusterPlacements(FIELD_SCRUB_B),
      ...clusterPlacements(RESCUE_SCRUB),
      ...clusterPlacements(GROUND_SCRUB), // round 3: dry scrub filling the mid band
    ]
    const scrubLocal = (m: THREE.Matrix4, p: Placed) => {
      yawT.makeRotationY(p.yaw)
      m.copy(yawT)
    }
    const scrubGeo = makeScrubTuft() // 3 blades x 5 tri = 15 tri

    // -- zone-B only: a couple of mid-scale waymarks -----------------------------------------
    const midPlaced: Placed[] = clusterPlacements(ZONE_B_MIDOBJECTS)
    const midLocal = (m: THREE.Matrix4, p: Placed) => {
      yawT.makeRotationY(p.yaw)
      m.copy(yawT)
    }
    const midGeo = makeWaymark() // 12 + 20 + 20 = 52 tri

    return [
      // 1: dune-ridge + grove-base mounds — the dominant landscape move. REVISION ROUND: `color`
      // (the 2/3-majority tone) is now `dune` — the bulk/shadow-side read — with `goldSand` (a
      // measured shade RICHER than dune, not paler) kept for the 1/3-share crest accent, so the
      // wedge stays gold-dominant instead of the pale-slab read the first pass shipped.
      { placed: moundPlaced, geometry: moundGeo, color: PALETTE.dune, colorDeep: PALETTE.goldSand, local: moundLocal },
      // 2: palm trunks
      { placed: palmPlaced, geometry: trunkGeo, color: PALETTE.palmTrunk, local: trunkLocal },
      // 3: palm crowns
      { placed: palmPlaced, geometry: crownGeo, color: PALETTE.palmFrond, colorDeep: PALETTE.palmFrondDeep, local: crownLocal },
      // 4: rocks (grove skirts + stone fields)
      { placed: rockPlaced, geometry: rockGeo, color: PALETTE.dune, colorDeep: PALETTE.sand, local: rockLocal },
      // 5: scrub tufts (grove skirts + scrub fields)
      { placed: scrubPlaced, geometry: scrubGeo, color: PALETTE.reedGreen, colorDeep: PALETTE.palmFrondDeep, local: scrubLocal },
      // 6: zone-B mid-scale waymarks
      { placed: midPlaced, geometry: midGeo, color: PALETTE.sand, colorDeep: PALETTE.dune, local: midLocal },
    ]
  }, [])

  return <InstancedFamilies families={families} variant={VARIANT} journeyRef={journeyRef} />
}
