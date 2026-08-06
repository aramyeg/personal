'use client'
import { useMemo, useRef } from 'react'
import type { ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { PALETTE } from '../../palette'
import { approachFrac, approachRevealGrow } from '../../journey-timeline'
import { anchorTransform, chapterTheta } from '../stage'
import { canonicalTheta, sceneVariantAt } from '../renewal'
import { PropAnchor } from './prop-anchor'
import { ClayBlock, ClayCamel, ClayMound, ClayPalm, ClayPyramid, ClayReeds, ClayRock } from './clay-kit'
import type { JourneyRef } from '../use-journey'

/** Chapter 3 (B0 desert) longitude at travel fraction t. */
const T = (t: number) => chapterTheta(3, t)
/** The desert is chapter 3 (band 0, variant B). */
const DESERT_CHAPTER = 3
// Approach-reveal timing (Task 46): the camels + oasis life hold hidden until the girl is
// ~45% into the desert travel, then spring up (easeOutBack) over the next ~40%, finishing just
// before her arrival — so they "appear as she approaches" against the already-standing dunes +
// pyramids. Rotation-driven (deterministic); the money-shot before/mid/after reveal.
// Fractions of the APPROACH, not of the whole slice — see `approachFrac`. The two numbers are
// the same 0.45 / 0.40 the caravan has always used; what changed under them (Task 73) is that the
// approach is now 21% of the slice rather than all of it, so naming them in slice units would
// have popped the camels in AFTER the card instead of before it. Ending at 0.85 of the approach
// keeps them standing, at full size, by the time she stops.
const REVEAL_START_FRAC = approachFrac(0.45)
const REVEAL_SPAN_FRAC = approachFrac(0.4)

function BankFacade(props: { position?: [number, number, number] }) {
  return (
    <group {...props}>
      <ClayBlock w={0.4} h={0.3} d={0.16} color={PALETTE.sky} />
      <ClayBlock w={0.3} h={0.1} d={0.18} color={PALETTE.honey} position={[0, 0.3, 0]} />
      <ClayBlock w={0.06} h={0.2} d={0.02} color={PALETTE.ink} position={[0, 0, 0.08]} />
      <ClayBlock w={0.05} h={0.24} d={0.14} color={PALETTE.dune} position={[-0.24, 0, 0]} />
      <ClayBlock w={0.05} h={0.24} d={0.14} color={PALETTE.dune} position={[0.24, 0, 0]} />
    </group>
  )
}

/** A half-buried pressed-clay ruin block — a broken monolith sunk into the sand at a lean, so
 *  the desert reads as an ancient, settled place (Task 46 "stable structures"). */
function RuinBlock({ tilt = 0.12, sink = 0.12 }: { tilt?: number; sink?: number }) {
  return (
    <group rotation={[tilt, 0.4, tilt * 0.5]} position={[0, -sink, 0]}>
      <ClayBlock w={0.16} h={0.42} d={0.16} color={PALETTE.sand} />
      <ClayBlock w={0.2} h={0.06} d={0.2} color={PALETTE.dune} position={[0, -0.02, 0]} />
    </group>
  )
}

/**
 * The desert's STABLE STRUCTURES — always present with the chapter set (grown/sunk by
 * ChapterSet's morph): grounded stepped pyramids, low dune mounds, a couple of half-buried
 * ruin blocks, the bank facade and scatter rocks. The living desert (camels + oasis) is the
 * separate approach-reveal below.
 */
export function AccentureSet() {
  return (
    <>
      {/* Pyramids — the desert's monuments (Task 41; grounded on stepped plinths + upsized in
          Task 46): one large + two smaller, off-lane on the dunes, sunken/tilted for charm. */}
      <PropAnchor theta={T(0.5)} x={-0.55}>
        <ClayPyramid size={0.82} color={PALETTE.sand} base={PALETTE.dune} sink={0.05} spin={0.5} />
      </PropAnchor>
      <PropAnchor theta={T(0.38)} x={0.5}>
        <ClayPyramid size={0.5} color={PALETTE.dune} base={PALETTE.clayPath} tilt={0.05} sink={0.035} spin={-0.4} />
      </PropAnchor>
      <PropAnchor theta={T(0.68)} x={0.44}>
        <ClayPyramid size={0.4} color={PALETTE.sand} base={PALETTE.dune} tilt={-0.04} sink={0.03} spin={1.1} />
      </PropAnchor>

      {/* half-buried ruins — settled monuments in the sand */}
      <PropAnchor theta={T(0.24)} x={0.58}><RuinBlock tilt={0.14} sink={0.14} /></PropAnchor>
      <PropAnchor theta={T(0.72)} x={-0.5}><RuinBlock tilt={-0.1} sink={0.1} /></PropAnchor>

      <PropAnchor theta={T(0.3)} x={0.45}><ClayMound r={0.35} color={PALETTE.dune} squash={0.4} /></PropAnchor>
      <PropAnchor theta={T(0.45)} x={-0.5}><ClayMound r={0.45} color={PALETTE.dune} squash={0.35} /></PropAnchor>
      <PropAnchor theta={T(0.6)} x={0.3}><ClayMound r={0.3} color={PALETTE.honey} squash={0.3} /></PropAnchor>
      <PropAnchor theta={T(0.78)} x={-0.4}><BankFacade /></PropAnchor>
      <PropAnchor theta={T(0.85)} x={0.35}><ClayRock color={PALETTE.dune} r={0.1} /></PropAnchor>
      <PropAnchor theta={T(0.2)} x={-0.3}><ClayRock color={PALETTE.dune} r={0.07} /></PropAnchor>
    </>
  )
}

/**
 * One approach-revealed desert prop: anchored on the variant-B desert terrain, shown only while
 * variant B is active at its longitude (so it never appears on lap 1 / the spring wedge), and
 * grown from the sand with a springy easeOutBack pop driven by the girl's rotation proximity to
 * the desert stop (Task 46). The inner group scales about the anchor (ground level), so the prop
 * rises OUT OF the dune as she nears — deterministic (rotation only, no wall-clock).
 */
function DesertReveal({
  theta,
  x,
  journeyRef,
  children,
}: {
  theta: number
  x: number
  journeyRef: JourneyRef
  children: ReactNode
}) {
  const outer = useRef<THREE.Group>(null)
  const inner = useRef<THREE.Group>(null)
  const tc = useMemo(() => canonicalTheta(theta), [theta])
  const { position, quaternion } = useMemo(() => anchorTransform(theta, x, 1), [theta, x])
  useFrame(() => {
    const g = outer.current
    const gi = inner.current
    if (!g || !gi) return
    const rot = journeyRef.current.rotation
    // Task 60 — sceneVariantAt, not activeVariantAt: the whole desert stands inside the epilogue
    // snow field, so the camels and the oasis palms hand themselves back behind the horizon when
    // the snow takes over. Without this the ending would be camels in a snowdrift.
    const active = sceneVariantAt(tc, rot) === 1
    g.visible = active
    if (active) {
      const grow = approachRevealGrow(DESERT_CHAPTER, rot, REVEAL_START_FRAC, REVEAL_SPAN_FRAC)
      gi.scale.setScalar(Math.max(grow, 0.0001))
    }
  })
  return (
    <group ref={outer} position={position} quaternion={quaternion}>
      <group ref={inner}>{children}</group>
    </group>
  )
}

/**
 * The living desert (Task 46) — camels crossing the dunes and the oasis palm/reed cluster, all
 * REVEALED as the girl approaches the desert chapter (grow-in with easeOutBack). Composed into
 * the scene as a sibling of the chapter sets (like the Jungle), so its own variant-B gate +
 * rotation reveal own its lifecycle. Every anchor is off-lane and dry (the oasis dressing rings
 * the pool without standing in it; the camels stride the dry dunes).
 */
export function DesertLife({ journeyRef }: { journeyRef: JourneyRef }) {
  return (
    <>
      {/* two camels striding the dunes, facing along the journey */}
      <DesertReveal theta={T(0.48)} x={0.92} journeyRef={journeyRef}>
        <ClayCamel rotation={[0, 1.5, 0]} />
      </DesertReveal>
      <DesertReveal theta={T(0.58)} x={0.66} journeyRef={journeyRef}>
        <ClayCamel rotation={[0, 2.1, 0]} scale={0.9} />
      </DesertReveal>

      {/* oasis palm + reed cluster ringing the pool (off the water) */}
      <DesertReveal theta={T(0.31)} x={0.46} journeyRef={journeyRef}>
        <ClayPalm />
      </DesertReveal>
      <DesertReveal theta={T(0.43)} x={0.8} journeyRef={journeyRef}>
        <ClayPalm rotation={[0, 2.4, 0]} scale={0.85} />
      </DesertReveal>
      <DesertReveal theta={T(0.33)} x={0.5} journeyRef={journeyRef}>
        <ClayReeds />
      </DesertReveal>
      <DesertReveal theta={T(0.4)} x={0.86} journeyRef={journeyRef}>
        <ClayReeds rotation={[0, 1.7, 0]} />
      </DesertReveal>
    </>
  )
}
