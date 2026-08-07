'use client'
import { useMemo } from 'react'
import type { ReactNode } from 'react'
import * as THREE from 'three'
import { PALETTE } from '../../palette'
import { PLANET_RADIUS, WATER_LEVEL, terrainBump, terrainBumpB } from '../planet'
import { bandOf, canonicalTheta, channelDist } from '../biomes'
import { GatedProp } from './gated-prop'
import type { JourneyRef } from '../use-journey'
import { ClayBell, ClayBlossom, ClayBoulder, ClayMound, ClayPalm, ClayRock, ClaySpike, ClaySprout, ClayTree, buildMergedClay } from './clay-kit'
import { useClayRamp } from '../toon-ramp'

const DRESSING_COUNT = 46

/** Deterministic 0→1 hash of an integer — no Math.random, stable per index. */
const fract = (v: number): number => v - Math.floor(v)
const seeded = (i: number): number => fract(Math.sin(i * 127.1 + 311.7) * 43758.5453)

type Anchor = { i: number; theta: number; x: number; scale: number; band: 0 | 1 | 2 }

/** The unit direction an anchor plants on, matching anchorTransform. */
function anchorDir(theta: number, x: number): THREE.Vector3 {
  const xN = THREE.MathUtils.clamp(x / PLANET_RADIUS, -0.95, 0.95)
  const ring = Math.sqrt(1 - xN * xN)
  return new THREE.Vector3(xN, ring * Math.cos(theta), ring * Math.sin(theta))
}

/**
 * Builds the always-on flank scatter for one variant. Each item sits on the
 * flanks (|x| ≥ 0.55) so the spine stays the chapter sets' stage, avoids water
 * and channels, and is planted on ITS variant's terrain. The renderer chooses a
 * prop that belongs to the wedge (band + variant) it lands in — so the scatter
 * sells each of the six scenes. Deterministic seeded scatter (no Math.random).
 */
function buildAnchors(variant: 0 | 1, seedBase: number): Anchor[] {
  const bumpFn = variant === 0 ? terrainBump : terrainBumpB
  const list: Anchor[] = []
  for (let i = 0; i < DRESSING_COUNT; i++) {
    const theta = seeded(i + seedBase) * Math.PI * 2
    const sign = i % 2 === 0 ? 1 : -1
    const x = sign * (0.55 + seeded(i + seedBase + 100) * 0.5)
    const dir = anchorDir(theta, x)
    const bump = bumpFn(dir.x * PLANET_RADIUS, dir.y * PLANET_RADIUS, dir.z * PLANET_RADIUS)
    if (1 + bump < WATER_LEVEL) continue // in water
    if (channelDist(dir.x, dir.y, dir.z, variant) < 0.09) continue // in a channel
    const scale = 0.75 + seeded(i + seedBase + 200) * 0.35
    const band = bandOf(canonicalTheta(Math.atan2(dir.z, dir.y)))
    list.push({ i, theta, x, scale, band })
  }
  return list
}

/** Lap-1 (variant A) flank scatter: spring sprouts (A0), flower drifts (A1),
 *  delta reeds/palms (A2). Each item swaps out behind the horizon as its
 *  longitude flips to the lap-2 world. */
export function GlobalDressing({ journeyRef }: { journeyRef: JourneyRef }) {
  const anchors = useMemo(() => buildAnchors(0, 0), [])
  return (
    <>
      {anchors.map(({ i, theta, x, scale, band }) => (
        <GatedProp key={i} theta={theta} x={x} variant={0} journeyRef={journeyRef}>
          {renderA(i, scale, band)}
        </GatedProp>
      ))}
    </>
  )
}

function renderA(i: number, scale: number, band: 0 | 1 | 2) {
  const s = seeded(i + 300)
  if (band === 0) {
    // A0 spring origin: fresh sprouts, blossoms + bells, lobed spring-green trees
    if (s < 0.3) return <ClaySprout scale={scale * 1.2} />
    if (s < 0.5) return <ClayBlossom color={i % 2 === 0 ? PALETTE.blossom : PALETTE.petal} scale={scale} />
    if (s < 0.66) return <ClayBell color={PALETTE.bluebell} scale={scale} />
    return <ClayTree height={0.3 + s * 0.14} shape="lobes" crown={i % 2 === 0 ? PALETTE.foliageDeep : PALETTE.springGreen} scale={scale} />
  }
  if (band === 1) {
    // A1 flower riot: three flower silhouettes (rose blob, periwinkle bell, lupine
    // spike) drifting through a honey-mound meadow — descriptive, not one recolour
    if (s < 0.34) return <ClayBlossom color={i % 2 === 0 ? PALETTE.blossomRose : PALETTE.petal} scale={scale * 1.1} />
    if (s < 0.56) return <ClaySpike color={i % 2 === 0 ? PALETTE.lupine : PALETTE.blossomDeep} scale={scale * 1.1} />
    if (s < 0.74) return <ClayBell color={i % 2 === 0 ? PALETTE.bluebell : PALETTE.blossom} scale={scale * 1.1} />
    if (s < 0.88) return <ClayMound r={0.12 + s * 0.05} color={PALETTE.honey} squash={0.55} scale={scale} />
    return <ClaySprout scale={scale} />
  }
  // A2 grand delta: reeds (tall thin sprouts), a parasol palm on a bank, sand rocks
  if (s < 0.5) return <Skirted seed={i}><ClaySprout scale={scale * 1.4} /></Skirted>
  if (s < 0.75) return <ClayRock color={PALETTE.sand} r={0.07 + s * 0.03} scale={scale} />
  return <Skirted seed={i}><ClayPalm scale={scale * 0.8} /></Skirted>
}

/**
 * A lone upright, given a base and a neighbour.
 *
 * THE DEFECT THIS EXISTS FOR (Task 86). Every checkpoint frame's bottom third is the next
 * wedge's approach, foreshortened about 6:1, and this scatter is one of the few things that
 * reaches it. At that compression a single bare stem with a tuft on top is one stroke with
 * background on either side, and the T84 audit's verdict on chapter 3 — "three bare brown
 * sticks hanging off the bottom with leaf tufts on the ends... it reads as poultry legs" —
 * is a description of exactly three of these, the B0 palm branch below.
 *
 * The scatter's own grammar is the cause: it emits ONE prop per anchor, so a species whose
 * silhouette is a stick can only ever appear as a stick. Rather than delete the palms (they
 * belong in a desert) each upright now arrives with a low mound at its foot and two stones
 * beside it, at deterministic offsets. That is enough to read as a clump instead of a limb,
 * and it costs ONE merged draw on the minority of anchors that draw an upright at all.
 *
 * Deliberately NOT applied to the A0 spring / A1 flower bands (chapter 1 is the reference
 * and is not to be touched) nor to the B2 conifers, whose cones already carry their own mass.
 */
function Skirted({ seed, children }: { seed: number; children: ReactNode }) {
  const ramp = useClayRamp()
  const a = seeded(seed + 1300)
  const b = seeded(seed + 1700)
  // ONE merged draw for the whole skirt. Three separate meshes would have been the obvious
  // shape and it costs three draw calls on every anchor that takes one — measured at +20 over
  // the scatter, which is more than the four new wedge dressings spend between them.
  const geo = useMemo(() => {
    const yaw = a * Math.PI * 2
    return buildMergedClay([
      {
        geo: new THREE.SphereGeometry(0.1 + a * 0.04, 10, 8),
        color: PALETTE.clayPath,
        pos: [0, -0.01, 0],
        scl: [1, 0.3, 1],
      },
      {
        geo: new THREE.DodecahedronGeometry(0.035 + b * 0.02, 0),
        color: PALETTE.stone,
        pos: [Math.cos(yaw) * 0.11, 0.01, Math.sin(yaw) * 0.11],
        scl: [1, 0.6, 1],
      },
      {
        geo: new THREE.DodecahedronGeometry(0.028 + a * 0.016, 0),
        color: PALETTE.dune,
        pos: [Math.cos(yaw + 2.3) * 0.13, 0.01, Math.sin(yaw + 2.3) * 0.13],
        scl: [1, 0.6, 1],
      },
    ])
  }, [a, b])
  return (
    <>
      {children}
      <mesh geometry={geo}>
        <meshToonMaterial vertexColors gradientMap={ramp} />
      </mesh>
    </>
  )
}

/** Lap-2 (variant B) flank scatter: dune rocks + palms (B0), canyon boulders &
 *  dead trees (B1), winter conifers + bare trunks (B2). Grounds on the lap-2
 *  terrain; each item arrives as its longitude flips behind the horizon. */
export function GlobalDressingAutumn({ journeyRef }: { journeyRef: JourneyRef }) {
  const anchors = useMemo(() => buildAnchors(1, 500), [])
  return (
    <>
      {anchors.map(({ i, theta, x, scale, band }) => (
        <GatedProp key={i} theta={theta} x={x} variant={1} journeyRef={journeyRef}>
          {renderB(i, scale, band)}
        </GatedProp>
      ))}
    </>
  )
}

function renderB(i: number, scale: number, band: 0 | 1 | 2) {
  const s = seeded(i + 800)
  if (band === 0) {
    // B0 golden dunes: dune rocks, low gold mounds, the occasional oasis palm
    if (s < 0.5) return <ClayRock color={i % 2 === 0 ? PALETTE.dune : PALETTE.goldSand} r={0.08 + s * 0.04} scale={scale} />
    if (s < 0.78) return <ClayMound r={0.13 + s * 0.05} color={PALETTE.goldSand} squash={0.35} scale={scale} />
    // the palms the audit called poultry legs — never issued bare again (see Skirted)
    return <Skirted seed={i}><ClayPalm scale={scale * 0.85} /></Skirted>
  }
  if (band === 1) {
    // B1 brown canyon: angular earth/stone boulders + bare parasol trees on the rim
    if (s < 0.5) return <ClayBoulder color={i % 2 === 0 ? PALETTE.stone : PALETTE.rust} r={0.09 + s * 0.05} scale={scale} />
    if (s < 0.8) return <Skirted seed={i}><ClayTree height={0.32 + s * 0.12} shape="parasol" crown={PALETTE.earth} scale={scale * 0.9} /></Skirted>
    return <ClayBoulder color={PALETTE.earthDeep} r={0.1 + s * 0.04} scale={scale} />
  }
  // B2 winter summit: pinched-cone snowy conifers, bare trunks, angular snow boulders
  if (s < 0.5) return <ClayTree height={0.34 + s * 0.14} shape="cone" crown={PALETTE.snow} scale={scale} />
  if (s < 0.78) return <ClayTree height={0.3 + s * 0.1} shape="cone" crown={PALETTE.pineDeep} scale={scale * 0.85} />
  return <ClayBoulder color={PALETTE.snow} r={0.08 + s * 0.04} scale={scale} />
}
