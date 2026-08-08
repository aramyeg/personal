'use client'
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import type { ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { PALETTE } from '../palette'
import type { JourneyRef } from './use-journey'
import { useClayRamp } from './toon-ramp'
import {
  WATER_LEVEL,
  channelDist,
  tideWetnessFast,
  tideFrontOffset,
  TIDE_LAT_LO,
  CROSSINGS_A,
  CROSSINGS_B,
} from './biomes'
import { canonicalTheta } from './renewal'
import { buildBuckets, makeRenewalMorph, type Buckets } from './bucketed-morph'
import { makeBoilMaterial, boilAmplitude, loadPlanetAtlas } from './boil-material'
import { studioLightsFor } from './desk-studio'
import { DIALS, subscribe, bakeVersion, readLandDials } from './tunables'
import { PLANET_RADIUS, terrainBump, terrainBumpB, type LandBakeUV } from './land-bake'
import { createLandBakeClient, type LandBakeClient } from './land-bake-client'
import { GLOBE_UNIFORM } from './globe-nudge'
import {
  type WaterParams,
  waterDeepGate,
  waterFootprintClear,
  waterStreak,
  waterRelief,
  waterNormalTilt,
  iceFootprint,
  iceRim,
  iceCrack,
  ICE_FLATTEN,
} from './water-clay'

// Task 47 — the land TERRAIN bake (all the pure per-vertex math) now lives in the worker-safe
// `./land-bake` module so it can run in a Web Worker. planet.tsx re-exports the public surface
// so every existing consumer (props, stage, tests, benches) keeps importing from `./planet`.
export {
  PLANET_RADIUS,
  ICO_DETAIL,
  ICO_EDGE,
  baseMeadowBump,
  terrainBump,
  terrainBumpB,
  terrainSlope,
  terrainBumpAt,
  surfaceYAt,
  CLAY_DIMPLE_MAX,
  CLAY_SIGNATURE_MAX,
  terrainGradientField,
  paintVertex,
  buildPal,
  bakeLandArrays,
} from './land-bake'
export type { LandBake, PaintPrecomp } from './land-bake'
/** Re-exported so prop/dressing modules keep importing the waterline from here. */
export { WATER_LEVEL }

/** Union of BOTH variants' bridge crossings — the water geometry is shared across laps,
 *  so relief is zeroed under every deck of either lap (see waterFootprintClear). */
const ALL_CROSSINGS = [...CROSSINGS_A, ...CROSSINGS_B] as const

/** T97 S1 — scratch for the globe's pointer rock: one axis + quaternion, reused every frame,
 *  so the wobble costs the frame loop zero allocation. */
const globeRockAxis = new THREE.Vector3()
const globeRockQ = new THREE.Quaternion()

/** The two baked worlds + per-vertex thetaC buckets the per-frame traveling front
 *  lerps between. */
type MorphBake = {
  positionsA: Float32Array; positionsB: Float32Array
  colorsA: Float32Array; colorsB: Float32Array
  /** Task 60 — the epilogue colours (=== colorsB outside the epilogue snow field). */
  colorsC: Float32Array
  normalsA: Float32Array; normalsB: Float32Array
  thetaC: Float32Array; buckets: Buckets
  // Round 7 tide: the flooded-limb target + the static right-cap vertex bucket the
  // per-frame tide re-evaluates (base A === B on the grazing limb, so A is the base).
  floodedPositions: Float32Array; floodedColors: Float32Array; floodedNormals: Float32Array
  capIdx: Int32Array; capNx: Float32Array; capNy: Float32Array; capNz: Float32Array
}

type LandResult = { geometry: THREE.BufferGeometry; bake: MorphBake }

/**
 * Assemble the live land geometry + MorphBake from a baked LandBake (worker or sync). The live
 * position/colour/normal attributes start on lap-1 (A) — a COPY, so the raw A arrays stay as the
 * per-frame renewal/tide source; the front lerps them toward B / the flooded target. buildBuckets
 * runs here on the main thread (the bucketed morph is a main-thread concern).
 */
function assembleLand(b: LandBakeUV): LandResult {
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(b.positionsA.slice(), 3).setUsage(THREE.DynamicDrawUsage))
  geo.setAttribute('color', new THREE.BufferAttribute(b.colorsA.slice(), 3).setUsage(THREE.DynamicDrawUsage))
  geo.setAttribute('normal', new THREE.BufferAttribute(b.normalsA.slice(), 3).setUsage(THREE.DynamicDrawUsage))
  // T90 — the lighting atlas's equirect UV. Unlike the three above it is STATIC: the renewal front
  // and the tide rewrite position/colour/normal every frame, but nothing ever rewrites a UV. So it
  // is shared (not `.slice()`d, since no one mutates it) and left at the default STATIC usage —
  // marking it dynamic would tell the driver to re-upload a buffer that never changes.
  geo.setAttribute('uv', new THREE.BufferAttribute(b.uv, 2))
  return {
    geometry: geo,
    bake: {
      positionsA: b.positionsA, positionsB: b.positionsB,
      colorsA: b.colorsA, colorsB: b.colorsB, colorsC: b.colorsC,
      normalsA: b.normalsA, normalsB: b.normalsB,
      thetaC: b.thetaC, buckets: buildBuckets(b.thetaC),
      floodedPositions: b.floodedPositions, floodedColors: b.floodedColors, floodedNormals: b.floodedNormals,
      capIdx: b.capIdx, capNx: b.capNx, capNy: b.capNy, capNz: b.capNz,
    },
  }
}

/**
 * Task 47 — the land bake, moved OFF the main thread. On mount (and on each rebake `version`
 * bump) it snapshots the twelve land dials BY VALUE (`readLandDials`) and dispatches to the
 * worker client; the resolved LandBake is assembled into the live geometry and applied.
 *
 * COALESCING: a monotone request id is stamped per dispatch. A resolved bake is DROPPED if a
 * newer request has since been made (dials changed mid-bake), so stale arrays never reach the
 * GPU — the newest snapshot always wins. The previous geometry is disposed only when the new one
 * applies (the `[geometry]` cleanup in Planet), so a rebake never leaks or blanks mid-flight.
 *
 * Returns null until the FIRST bake applies (the themed loader covers the gap; the ready
 * handshake in scene.tsx / load-signal.tsx holds "ready" until `onApplied` fires). If the worker
 * is unavailable the client bakes synchronously (the pre-Task-47 freeze) and this still applies —
 * function preserved, just not off-thread.
 */
function useHillGeometry(version: number, onApplied?: () => void): LandResult | null {
  const [result, setResult] = useState<LandResult | null>(null)
  const clientRef = useRef<LandBakeClient | null>(null)
  const reqIdRef = useRef(0)
  const appliedRef = useRef(false)
  const onAppliedRef = useRef(onApplied)
  onAppliedRef.current = onApplied

  // One worker for the component's lifetime; terminated on unmount.
  useEffect(() => {
    const client = createLandBakeClient()
    clientRef.current = client
    return () => {
      client.dispose()
      clientRef.current = null
    }
  }, [])

  useEffect(() => {
    const client = clientRef.current
    if (!client) return
    const id = ++reqIdRef.current
    let cancelled = false
    void client.request(id, readLandDials()).then((b) => {
      if (cancelled) return
      // Coalesce: apply only the newest request's result (drop stale mid-bake arrays).
      if (id !== reqIdRef.current) return
      setResult(assembleLand(b))
      if (!appliedRef.current) {
        appliedRef.current = true
        onAppliedRef.current?.()
      }
    })
    return () => {
      cancelled = true
    }
    // `version` bumps when a rebake-class dial settles (Round 9 tuning panel); it re-dispatches
    // the bake with the new snapshot. eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version])

  return result
}


/** The dual-baked water sphere: variant-independent geometry, two colour bakes. */
type WaterBake = {
  geometry: THREE.BufferGeometry
  colorsA: Float32Array; colorsB: Float32Array
  thetaC: Float32Array; buckets: Buckets
  // Round 7 tide: the right-cap water ring + the committed deep-ocean target it
  // deepens toward as the tide floods (so the flooded limb reads open ocean, not a
  // shallow teal fringe). Colour-only, tied to tideWetness — no geometry change.
  waterCapIdx: Int32Array; waterCapNx: Float32Array
  waterCapNy: Float32Array; waterCapNz: Float32Array
  deepOcean: readonly [number, number, number]
  // Task 33: true when the altitude rise is non-zero, so the render enables a small
  // depth polygonOffset to kill the shallow-angle shore-seam shimmer (see the mesh).
  raised: boolean
}

/**
 * The clay water sphere at WATER_LEVEL. Every basin, river channel and canyon
 * floor dips below it, so it shows through as sea, veins and pools. Deep river
 * blue DOMINATES the surface (darkening toward an ink-blue abyss in the deeps);
 * the lighter river blue survives only as a shallow rim near shores. The sphere
 * carries its own gentle inward-only clay displacement so it reads as
 * hand-pushed clay under the toon ramp, never flat glass — and never pokes
 * above the shoreline.
 *
 * Positions/lumps are variant-INDEPENDENT (water geography is just terrain dipping
 * under the sphere), but the depth-tinted COLOURS read terrainBump — so they are
 * dual-baked (depth vs bumpA and bumpB) and lerped by the SAME bucketed renewal
 * gate as the land. On the spine bumpB === bumpA, so the colour is lap-invariant
 * there; only flank shallows re-tint.
 */
function useWaterGeometry(version: number): WaterBake {
  return useMemo(() => {
    // The live water dial state (Task 31). Read once per bake; a rebake-class edit
    // debounces then bumps `version`, re-running this memo with the new values.
    const wp: WaterParams = {
      pathWarp: DIALS.waterPathWarp.value,
      pathStretch: DIALS.waterPathStretch.value,
      pathDepth: DIALS.waterPathDepth.value,
      pocketTint: DIALS.waterPocketTint.value,
      reliefInward: DIALS.waterReliefInward.value,
      reliefOutward: DIALS.waterReliefOutward.value,
      ridgeSharp: DIALS.waterRidgeSharp.value,
      octaves: DIALS.waterOctaves.value,
      normalRough: DIALS.waterNormalRough.value,
      flowStrength: DIALS.waterFlowStrength.value,
      flowAlign: DIALS.waterFlowAlign.value,
      waterRise: DIALS.waterRise.value,
    }
    // Task 33 — water-altitude rise: the RENDER sphere sits at WATER_LEVEL + waterRise (a
    // proud slab flush with the shore at MAX, today's recessed level at dial 0). The
    // geography classifier WATER_LEVEL is untouched (paintDepth's terrainDepth still reads
    // the constant), and every unit-direction field (streak/relief/flow/normals) is
    // altitude-independent — only the base radius the lumps ride on moves. The rise is
    // clamped (tunables) so the girl's dry lane + every seated anchor stay above it.
    const WATER_R = WATER_LEVEL + wp.waterRise
    // Fewer segments = larger facets; the SphereGeometry is indexed, so
    // toNonIndexed + flat normals below turns it into visible lumpy clay water.
    const geo = new THREE.SphereGeometry(PLANET_RADIUS * WATER_R, 48, 48)
    const pos = geo.attributes.position
    const colorsIdxA = new Float32Array(pos.count * 3)
    const colorsIdxB = new Float32Array(pos.count * 3)
    const v = new THREE.Vector3()
    const ink = new THREE.Color(PALETTE.ink)
    const river = new THREE.Color(PALETTE.river)
    // deep clay blue DOMINATES: riverDeep pushed darker for the body of the water
    const deepBase = new THREE.Color(PALETTE.riverDeep).lerp(ink, 0.22)
    const abyss = new THREE.Color(PALETTE.riverDeep).lerp(ink, 0.5)
    // Task 40 icy lake colours (applied to the variant-B bake only, inside iceFootprint):
    // a pale frozen sheet, darker blue-grey pressed cracks, and a warm-white snow rim.
    const iceSheet = new THREE.Color(PALETTE.ice)
    const iceCrackCol = new THREE.Color(PALETTE.iceDeep)
    const iceSnow = new THREE.Color(PALETTE.snow)
    // Task 40 dial: how icy the B2 winter pond reads (0 = plain clay water, 1 = full ice).
    const iceAmount = DIALS.waterIceAmount.value
    const c = new THREE.Color()
    // Task 23 — molded water: the deep-blue reads TOUGHER and hand-pressed. Colour
    // now answers THREE depths, not just the terrain basin: (1) terrain depth (deep
    // basins → abyss); (2) the sphere's own molded TROUGH depth (a pressed hollow in
    // the clay sheet darkens toward abyss even over a flat floor, so the water is not
    // one even blue); (3) a near-DECK deepening along the lane channels (the A0 strait
    // read pale at mid-face because the shallow-rim brightening dominated its
    // width-carried carve — this pushes its near-deck tint back to deep blue). Rims
    // (high, shallow crests of the clay sheet) keep the lighter river blue.
    //
    // Task 31 adds a fourth term: the genart STREAK field pushes patchy pockets + the
    // tool-dragged grooves toward the abyss blue ("deeper colors"), layered OVER the
    // three above (they still win — the Task-26 flooded-limb deepening is re-applied
    // per frame by the water-tide morph AFTER this bake, so it always dominates at the
    // cap). Colour-only; palette-derived (riverDeep→ink).
    const paintDepth = (
      out: Float32Array, i: number, bump: number, trough: number, deck: number, streak: number,
      ice: number, crack: number, snow: number
    ): void => {
      const terrainDepth = THREE.MathUtils.clamp((WATER_LEVEL - (1 + bump)) / 0.08, 0, 1)
      const deep = Math.max(terrainDepth, 0.85 * trough, 0.7 * deck)
      c.copy(deepBase).lerp(abyss, THREE.MathUtils.smoothstep(deep, 0.3, 1))
      // river-blue rim survives only on the shallow crests: killed in troughs and by
      // the near-deck deepening, so molded hollows + the strait deck stay deep blue.
      const rim = (1 - THREE.MathUtils.smoothstep(terrainDepth, 0.0, 0.15)) *
        (1 - 0.6 * trough) * (1 - 0.7 * deck)
      c.lerp(river, 0.5 * rim)
      // genart pockets + streak grooves deepen toward the abyss blue (path troughs
      // read darkest). Applied everywhere over water (no contact constraint) so the
      // "rougher paths / deeper colours" read reaches the near-shore water too.
      if (streak > 0 && wp.pocketTint > 0) c.lerp(abyss, wp.pocketTint * streak)
      // Task 40 — icy winter lake (variant-B bake only; `ice`=0 for the A buffer, so the
      // A longitude keeps its clay-water look). Within the pond footprint the liquid blue
      // is overpainted with a pale frozen sheet, sparse darker pressed crack veins, and a
      // warm-white snow dusting at the bank rim. Colour only — palette-derived.
      if (ice > 0) {
        c.lerp(iceSheet, 0.9 * ice)
        if (crack > 0) c.lerp(iceCrackCol, 0.55 * crack * ice)
        if (snow > 0) c.lerp(iceSnow, 0.7 * snow * ice)
      }
      out[i * 3] = c.r; out[i * 3 + 1] = c.g; out[i * 3 + 2] = c.b
    }
    // Peak inward push of the molded clay sheet (trough-biased low octave + fine
    // grain). Floor = WATER_LEVEL·(1−WATER_MOLD_MAX) ≈ 0.969·WATER_LEVEL, still well
    // above every basin floor and below the shoreline (proven in scan-task23).
    const WATER_MOLD_MAX = 0.024 + 0.007
    // How near a lane channel the deep near-deck tint reaches (rad); kept tight to the
    // girl's lane (|nx|) so the wide off-lane delta fan / beach shallows are NOT
    // over-darkened — only the deck approaches deepen.
    const DECK_REACH = 0.14
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i)
      const dir = v.clone().normalize()
      const px = dir.x * PLANET_RADIUS, py = dir.y * PLANET_RADIUS, pz = dir.z * PLANET_RADIUS
      // clay lumps, inward-only (radius never exceeds WATER_LEVEL → no shoreline
      // poke-through); two octaves + recomputed normals catch the ramp as clay.
      // Task-23: trough-biased so most of the sheet sits at the shallow rim while
      // occasional pressed hollows dig DEEP (a power curve on the low octave), giving
      // the molded deep-trough / shallow-rim contrast — beyond Task 21's even scale.
      const w1 = Math.sin(3.3 * dir.x + 1.3) * Math.sin(3.0 * dir.y - 0.7) * Math.sin(3.5 * dir.z + 2.1)
      const w2 = Math.sin(7.1 * dir.y + 0.5) * Math.sin(6.6 * dir.z - 1.1) * Math.sin(6.9 * dir.x + 2.6)
      const t1 = Math.pow(0.5 + 0.5 * w1, 1.7)
      const t2 = 0.5 + 0.5 * w2
      const inward = 0.024 * t1 + 0.007 * t2
      const trough = THREE.MathUtils.clamp(inward / WATER_MOLD_MAX, 0, 1)
      // near-deck deepening, per variant (the strait is A0; every lane channel gets a
      // deep deck approach). Gated tight to the lane so the delta/beach stay untouched.
      const nearLane = 1 - THREE.MathUtils.smoothstep(Math.abs(dir.x), 0.12, 0.36)
      const deckA = nearLane * THREE.MathUtils.clamp(
        (DECK_REACH - channelDist(dir.x, dir.y, dir.z, 0)) / DECK_REACH, 0, 1)
      const deckB = nearLane * THREE.MathUtils.clamp(
        (DECK_REACH - channelDist(dir.x, dir.y, dir.z, 1)) / DECK_REACH, 0, 1)
      const bA = terrainBump(px, py, pz)
      const bB = terrainBumpB(px, py, pz)
      // Task 31 genart: the streak-path field (variant-independent) drives colour +
      // an extra groove carve; the ridged relief bulges/carves the sheet. Task 32 gates it
      // by waterDeepGate (the shoreline feather — 0 at any shore, min depth across BOTH
      // bakes, so the shared geometry honours the shoreline contract on both laps) × the
      // deck-FOOTPRINT gate (0 only under a bridge deck of EITHER lap, so mid-face seas /
      // inter-crossing channels / the delta now take the full clay relief while every deck
      // keeps its proven v1-water clearance).
      const theta = Math.atan2(dir.z, dir.y)
      const streak = waterStreak(dir.x, dir.y, dir.z, wp)
      const gate = waterDeepGate(bA, bB) * waterFootprintClear(dir.x, theta, ALL_CROSSINGS)
      const relief = waterRelief(dir.x, dir.y, dir.z, gate, streak, wp)
      // Task 40 — icy winter lake. Inside the B2 pond footprint (hard-masked, 0 elsewhere
      // and at every deck) the ice reads as SOLID: the molded clay lumps are pressed
      // flatter (a glassy sheet at ~waterline), and the variant-B colour is overpainted
      // with the ice family. iceStrength is footprint × the dial; A gets no ice.
      const iceMask = iceFootprint(dir.x, dir.y, dir.z)
      const iceStrength = iceMask * iceAmount
      const crack = iceStrength > 0 ? iceCrack(dir.x, dir.y, dir.z) : 0
      const snow = iceStrength > 0 ? iceRim(dir.x, dir.y, dir.z) : 0
      // flatten only ever RAISES the surface toward the waterline (inward ≥ 0), never
      // above it — the shoreline contract holds; the genart relief here is already 0
      // (waterDeepGate = 0: the pond is land on variant A, so min-depth closes the gate).
      const inwardIced = inward * (1 - ICE_FLATTEN * iceStrength)
      paintDepth(colorsIdxA, i, bA, trough, deckA, streak, 0, 0, 0)
      paintDepth(colorsIdxB, i, bB, trough, deckB, streak, iceStrength, crack, snow)
      // net radius = WATER_LEVEL·(1 − molded inward + genart relief). Relief is signed
      // (outward crests ≤ 0.4× the inward budget, inward troughs deeper), and 0 near any
      // shore/lane so this never exceeds WATER_LEVEL where water meets land.
      v.multiplyScalar(1 - inwardIced + relief)
      pos.setXYZ(i, v.x, v.y, v.z)
    }
    // Flat-shade: expand to non-indexed then per-face normals so the water shows
    // hand-pinched clay facets under the ramp, not a smooth glass blob. Both colour
    // bakes are expanded with the positions, so they stay facet-crisp too.
    geo.setAttribute('color', new THREE.BufferAttribute(colorsIdxA.slice(), 3))
    geo.setAttribute('colorB', new THREE.BufferAttribute(colorsIdxB, 3))
    const flat = geo.toNonIndexed()
    geo.dispose()
    flat.computeVertexNormals()
    // Task 31 non-smoothness: tilt each flat face normal by a coherent per-face amount
    // (one vector per triangle → the facet stays flat) so the toon ramp band-splits
    // across the water like tool-worked clay. Normals only — positions/contact untouched.
    if (wp.normalRough > 0) {
      const fnor = flat.attributes.normal.array as Float32Array
      const fp = flat.attributes.position
      const faceCount = fp.count / 3
      for (let f = 0; f < faceCount; f++) {
        const j0 = f * 3
        // face centroid direction (average of the three verts, normalized)
        let cx = 0, cy = 0, cz = 0
        for (let t = 0; t < 3; t++) {
          cx += fp.getX(j0 + t); cy += fp.getY(j0 + t); cz += fp.getZ(j0 + t)
        }
        const cl = Math.hypot(cx, cy, cz) || 1
        const [dx, dy, dz] = waterNormalTilt(cx / cl, cy / cl, cz / cl, wp.normalRough)
        for (let t = 0; t < 3; t++) {
          const k = (j0 + t) * 3
          const x = fnor[k] + dx, y = fnor[k + 1] + dy, z = fnor[k + 2] + dz
          const l = Math.hypot(x, y, z) || 1
          fnor[k] = x / l; fnor[k + 1] = y / l; fnor[k + 2] = z / l
        }
      }
    }

    // Per-vertex thetaC of the non-indexed water verts, for the same bucketed gate.
    const fpos = flat.attributes.position
    const colorsA = (flat.attributes.color.array as Float32Array).slice()
    const colorsB = (flat.attributes.colorB.array as Float32Array).slice()
    flat.deleteAttribute('colorB')
    // live colour buffer starts on A; the bucketed morph writes toward B per frame
    flat.setAttribute('color', new THREE.BufferAttribute(colorsA.slice(), 3).setUsage(THREE.DynamicDrawUsage))
    const thetaC = new Float32Array(fpos.count)
    // Round 7: collect the right-cap water ring (local nx > TIDE_LAT_LO). The tide
    // deepens these verts toward `deepOcean` — the left ocean's own committed deep
    // blue — as the flood advances, so the overflowed limb reads as open sea.
    const wCapIdx: number[] = []
    const wCapNx: number[] = [], wCapNy: number[] = [], wCapNz: number[] = []
    for (let i = 0; i < fpos.count; i++) {
      const px = fpos.getX(i), py = fpos.getY(i), pz = fpos.getZ(i)
      const l = Math.hypot(px, py, pz) || 1
      const nx = px / l, ny = py / l, nz = pz / l
      thetaC[i] = canonicalTheta(Math.atan2(nz, ny))
      if (nx > TIDE_LAT_LO) { wCapIdx.push(i); wCapNx.push(nx); wCapNy.push(ny); wCapNz.push(nz) }
    }
    const deepOcean = new THREE.Color(PALETTE.riverDeep).lerp(new THREE.Color(PALETTE.ink), 0.5)
    return {
      geometry: flat, colorsA, colorsB, thetaC, buckets: buildBuckets(thetaC),
      waterCapIdx: Int32Array.from(wCapIdx),
      waterCapNx: Float32Array.from(wCapNx),
      waterCapNy: Float32Array.from(wCapNy),
      waterCapNz: Float32Array.from(wCapNz),
      deepOcean: [deepOcean.r, deepOcean.g, deepOcean.b],
      raised: wp.waterRise > 0,
    }
    // `version` bumps when a rebake-class dial settles (Round 9). Water dials are all
    // rebake-class, so this re-bakes the water geometry/colour/normals; the caller
    // disposes the previous water geometry and the water/water-tide morphs re-init.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version])
}

/**
 * The Round 7 overflow tide (Mechanism B). Re-evaluates ONLY the static right-cap
 * vertex bucket (|nx| > TIDE_LAT_LO — a fixed set, since the poles sit at ±x and the
 * planet spins about x) each frame, lerping the base (A, which equals B on the grazing
 * limb) toward the flooded target by tideWetness(nx, rotation). Continuous + monotone
 * in rotation, so the right limb goes dry → wet exactly once across the journey. Runs
 * AFTER the renewal front each frame so it owns the final cap value. Cost is reported
 * next to the front in renewal-cost.mjs (cap bucket ≈ 10% of the buffer).
 */
function makeTideMorph(args: {
  geo: THREE.BufferGeometry
  bake: MorphBake
}): { update: (rotation: number) => void } {
  const { geo, bake } = args
  const posArr = geo.attributes.position.array as Float32Array
  const colArr = geo.attributes.color.array as Float32Array
  const norArr = geo.attributes.normal.array as Float32Array
  const { capIdx, capNx, capNy, capNz } = bake
  const basePos = bake.positionsA
  const baseCol = bake.colorsA
  const baseNor = bake.normalsA
  const { floodedPositions: fPos, floodedColors: fCol, floodedNormals: fNor } = bake
  // Bake the azimuthal shoreline offset per cap vertex ONCE, so the per-frame lerp
  // avoids atan2 (keeps front + tide under the ~0.5 ms budget — see renewal-cost.mjs).
  const capWob = new Float32Array(capIdx.length)
  for (let k = 0; k < capIdx.length; k++) capWob[k] = tideFrontOffset(capNy[k], capNz[k])
  let last = Number.NaN
  const update = (rotation: number): void => {
    if (rotation === last) return
    last = rotation
    for (let k = 0; k < capIdx.length; k++) {
      const i = capIdx[k]
      const g = tideWetnessFast(capNx[k], capWob[k], rotation)
      const j = i * 3
      posArr[j] = basePos[j] + (fPos[j] - basePos[j]) * g
      posArr[j + 1] = basePos[j + 1] + (fPos[j + 1] - basePos[j + 1]) * g
      posArr[j + 2] = basePos[j + 2] + (fPos[j + 2] - basePos[j + 2]) * g
      colArr[j] = baseCol[j] + (fCol[j] - baseCol[j]) * g
      colArr[j + 1] = baseCol[j + 1] + (fCol[j + 1] - baseCol[j + 1]) * g
      colArr[j + 2] = baseCol[j + 2] + (fCol[j + 2] - baseCol[j + 2]) * g
      const nx = baseNor[j] + (fNor[j] - baseNor[j]) * g
      const ny = baseNor[j + 1] + (fNor[j + 1] - baseNor[j + 1]) * g
      const nz = baseNor[j + 2] + (fNor[j + 2] - baseNor[j + 2]) * g
      const l = Math.hypot(nx, ny, nz) || 1
      norArr[j] = nx / l; norArr[j + 1] = ny / l; norArr[j + 2] = nz / l
    }
    geo.attributes.position.needsUpdate = true
    geo.attributes.color.needsUpdate = true
    geo.attributes.normal.needsUpdate = true
  }
  return { update }
}

/**
 * The tide's WATER-sphere companion (Round 7 punch item): as the flood advances, the
 * right-cap water — revealed where the land sank under the waterline — deepens from
 * its baked shallow-rim blue toward `deepOcean` (the left ocean's committed deep blue),
 * so the overflowed limb reads as open ocean rather than a shallow teal fringe. The
 * depth tint is tied to the SAME tideWetness as the land, so the colour deepens exactly
 * as the water does. Colour-only, one deepening lerp over the static water-cap ring.
 */
function makeWaterTideMorph(water: WaterBake): { update: (rotation: number) => void } {
  const colArr = water.geometry.attributes.color.array as Float32Array
  const { waterCapIdx: idx, waterCapNx: nxA, waterCapNy: nyA, waterCapNz: nzA } = water
  const baseCol = water.colorsA // A === B on the grazing limb, so A is the base
  const [dr, dg, db] = water.deepOcean
  const capWob = new Float32Array(idx.length)
  for (let k = 0; k < idx.length; k++) capWob[k] = tideFrontOffset(nyA[k], nzA[k])
  let last = Number.NaN
  const update = (rotation: number): void => {
    if (rotation === last) return
    last = rotation
    for (let k = 0; k < idx.length; k++) {
      const g = tideWetnessFast(nxA[k], capWob[k], rotation)
      const j = idx[k] * 3
      colArr[j] = baseCol[j] + (dr - baseCol[j]) * g
      colArr[j + 1] = baseCol[j + 1] + (dg - baseCol[j + 1]) * g
      colArr[j + 2] = baseCol[j + 2] + (db - baseCol[j + 2]) * g
    }
    water.geometry.attributes.color.needsUpdate = true
  }
  return { update }
}

export function Planet({
  journeyRef,
  children,
  onBakeReady,
}: {
  journeyRef: JourneyRef
  children?: ReactNode
  /** Task 47 — fired once when the first (async, worker) land bake is applied, so the loader's
   *  ready handshake can wait for the terrain instead of revealing an empty scene. */
  onBakeReady?: () => void
}) {
  const group = useRef<THREE.Group>(null)
  const ramp = useClayRamp()
  // Rebake generation from the tuning panel (Round 9). Bumps only when a rebake-class
  // dial settles; on ?tune-absent it is a constant 0, so the bake runs exactly once.
  const version = useSyncExternalStore(subscribe, bakeVersion, bakeVersion)
  // Task 47 — the land bake is async (Web Worker). `land` is null until the first bake applies;
  // the water sphere still bakes synchronously on the main thread (only ~20 ms, not the freeze).
  const land = useHillGeometry(version, onBakeReady)
  const geometry = land?.geometry ?? null
  const bake = land?.bake ?? null
  const water = useWaterGeometry(version)
  // Dispose the previous land + water geometry (and their GPU buffers) when a rebake
  // swaps them in, so live re-tuning never leaks attributes. Task 31 makes the water
  // bake dial-driven too, so it disposes on the same rebake path as the land. The land
  // geometry is nullable now (async), so the previous one is disposed exactly when the new
  // one applies (this cleanup) — never before, so a rebake never blanks the terrain.
  useEffect(() => () => geometry?.dispose(), [geometry])
  useEffect(() => () => water.geometry.dispose(), [water.geometry])
  // The traveling front: each updater re-lerps only the thetaC buckets swept since
  // the last rotation (a full re-apply on the first frame / any big jump). The
  // spine buckets never change, so the girl's lane costs nothing. Null until the land bake
  // resolves; the frame loop no-ops the land morphs until then.
  const planetMorph = useMemo(
    () =>
      geometry && bake
        ? makeRenewalMorph({
            geo: geometry, thetaC: bake.thetaC, buckets: bake.buckets,
            colorsA: bake.colorsA, colorsB: bake.colorsB, colorsC: bake.colorsC,
            positionsA: bake.positionsA, positionsB: bake.positionsB,
            normalsA: bake.normalsA, normalsB: bake.normalsB,
          })
        : null,
    [geometry, bake]
  )
  const waterMorph = useMemo(
    () =>
      makeRenewalMorph({
        geo: water.geometry, thetaC: water.thetaC, buckets: water.buckets,
        colorsA: water.colorsA, colorsB: water.colorsB,
      }),
    [water]
  )
  // Round 7 overflow tide — the right-cap buckets, re-evaluated per frame AFTER the
  // renewal front so they own the final grazing-limb value (land geometry + colour, and
  // the water sphere's deep-ocean deepening over the flooded limb).
  const tideMorph = useMemo(
    () => (geometry && bake ? makeTideMorph({ geo: geometry, bake }) : null),
    [geometry, bake]
  )
  const waterTideMorph = useMemo(() => makeWaterTideMorph(water), [water])
  // Task 29 lever 5 — the land material carries the boil term (a stepped normal tilt
  // driven by one uniform). Water keeps the stock ramp material (it has its own molded
  // depth voice). Disposed on unmount like the other clay resources.
  // T90 — the baked lighting atlas. Requested once for the component's lifetime; `atlasReady`
  // gates the crossfade so a mix can never sample a texture with no image behind it (which reads
  // black). The whole journey is loading time: the crossfade is pinned at 0 until the ending's
  // lights come up, and the atlas is not sampled at all until then.
  const atlasReady = useRef(false)
  const atlas = useMemo(() => loadPlanetAtlas(() => { atlasReady.current = true }), [])
  useEffect(() => () => atlas.dispose(), [atlas])
  const boil = useMemo(() => {
    const b = makeBoilMaterial(ramp)
    // Bound at construction, not in an effect, so the very first compile already has its sampler
    // — and so a ramp change (which builds a new material) can never leave the new one blind.
    b.uniforms.uBakeAtlas.value = atlas
    return b
  }, [ramp, atlas])
  useEffect(() => () => boil.material.dispose(), [boil])
  const boilStep = useRef(-1)

  useFrame((state) => {
    const j = journeyRef.current
    if (group.current) {
      // ALL THREE euler components, not `.x` alone. The wobble below premultiplies the
      // QUATERNION, and three's linked-euler back-write then stores the wobbled pose's y/z in
      // the euler — a `.x`-only write would keep re-baking that residual tilt into every later
      // frame (measured: a permanently shifted globe after one click, the exact failure the
      // "always decays to the authored rest" clause forbids). `set` restores the pure spin pose
      // absolutely each frame, so the wobble owns no state outside its own uniform.
      group.current.rotation.set(-j.rotation, 0, 0)
      // T97 S1 — the ending's cradle nudge (see globe-nudge.ts): a small rock-with-precession
      // premultiplied over the spin, re-derived from the pure pose every frame so it never
      // accumulates; and THE GUARD IS THE LAW — at exact zero the group's pose arithmetic is
      // bit-identical to a build without this feature.
      const u = GLOBE_UNIFORM.value
      if (u[3] !== 0) {
        globeRockAxis.set(u[0], u[1], u[2])
        globeRockQ.setFromAxisAngle(globeRockAxis, u[3])
        group.current.quaternion.premultiply(globeRockQ)
      }
    }
    planetMorph?.update(j.rotation)
    waterMorph.update(j.rotation)
    tideMorph?.update(j.rotation)
    waterTideMorph.update(j.rotation)
    // Boil: hold the phase for ~1/10 s then jump (stepped, never smoothly interpolated).
    // One float write when the step advances; the amplitude honours the runtime dial.
    boil.uniforms.uBoilAmp.value = boilAmplitude()
    const step = Math.floor(state.clock.elapsedTime * DIALS.boilFps.value)
    if (step !== boilStep.current) {
      boilStep.current = step
      boil.uniforms.uBoilPhase.value = step * 1.618033988
    }
    // T90 — the baked-lighting crossfade rides the ending's EXISTING lights-up. Not a new clock,
    // not new state: `studioLightsFor` is the same pure function of `ending.zoom` that the desk's
    // materials, the metal's environment and the DOM grade already read, so the planet cannot
    // disagree with the room about how lit the ending is. It is exactly 0 through the whole
    // journey and the still beat, and exactly 1 at the money shot.
    boil.uniforms.uBakeMix.value = atlasReady.current ? studioLightsFor(j.ending) : 0
  })

  return (
    <group ref={group}>
      <mesh geometry={water.geometry}>
        {/* Task 33 shore seam: when the water is raised flush with the shore the two
            meshes cross at a shallow angle, so a coplanar depth fight can shimmer along the
            new intersection. A small positive polygonOffset pushes the water fragments
            slightly deeper so the land wins at the coincident depth (terrain occludes at the
            shore) — enabled ONLY when raised, so dial 0 stays byte-identical (no offset). */}
        <meshToonMaterial
          vertexColors
          gradientMap={ramp}
          polygonOffset={water.raised}
          polygonOffsetFactor={water.raised ? 1 : 0}
          polygonOffsetUnits={water.raised ? 1 : 0}
        />
      </mesh>
      {geometry && <mesh geometry={geometry} material={boil.material} />}
      {children}
    </group>
  )
}
