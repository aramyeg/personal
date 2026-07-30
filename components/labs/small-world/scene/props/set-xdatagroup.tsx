'use client'
import { PALETTE } from '../../palette'
import { chapterTheta } from '../stage'
import { PropAnchor } from './prop-anchor'
import { ClayBoulder, ClayIgloo, ClayMound, ClayRock, ClaySnowConifer } from './clay-kit'
import { useClayRamp } from '../toon-ramp'

const T = (t: number) => chapterTheta(5, t)

function VaultDoor(props: { position?: [number, number, number]; rotation?: [number, number, number] }) {
  const ramp = useClayRamp()
  return (
    <group {...props}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.09, 0.025, 12, 24]} />
        <meshToonMaterial color={PALETTE.honey} gradientMap={ramp} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.005, 0]}>
        <circleGeometry args={[0.085, 24]} />
        <meshToonMaterial color={PALETTE.ink} gradientMap={ramp} />
      </mesh>
      <mesh position={[0, 0.02, 0]}>
        <sphereGeometry args={[0.02, 10, 10]} />
        <meshToonMaterial color={PALETTE.honey} gradientMap={ramp} />
      </mesh>
    </group>
  )
}

/**
 * Chapter 6 — xDataGroup: present day, the summit.
 *
 * Task 60 turns this set WINTER. It used to be a blossom summit — four pink-crowned trees, four
 * ground blossoms and a bright green mound — which was the warmest thing on the coldest chapter,
 * and with the journey now ending in snow on every side it was the last spring left standing.
 * The mound keeps its size and place (the vault door is set into its camera-facing slope, and that
 * door is the chapter's own narrative object, untouched); it just stops being a green hill.
 *
 * The set trades 8 blossom props for 8 winter ones, so the draw-call count is unchanged. An igloo
 * joins the summit to tie it to the camp on the face below.
 *
 * KNOWN COPY MISMATCH, deliberately not fixed here: the chapter-6 card still reads "pink trees in
 * bloom". Card content is deferred by Aram, so changing chapters.ts is out of scope — flagged in
 * the Task-60 report instead.
 */
export function XdatagroupSet() {
  return (
    <>
      {/* THE SUMMIT. Painting the mound PALETTE.snow was the obvious move and the wrong one for the
          same reason the igloos were: a white dome on a white field has nothing to be lighter than,
          and from the chapter-6 travelling angles it read as one featureless pale bulge with no
          form at all — an outline, not a hill.
          So the mass takes the MID tone and the white is demoted to a cap that sits on top and
          back, leaving the camera-facing flank in shadow; rock breaks through that flank to give
          the dome a surface rather than a silhouette. Same correction, applied to terrain instead
          of to architecture. The vault door keeps its anchor — it is set INTO this hillside and is
          the chapter's own object. */}
      <PropAnchor theta={T(0.7)} x={0}>
        <ClayMound r={0.55} squash={0.5} color={PALETTE.frostShadow} />
      </PropAnchor>
      <PropAnchor theta={T(0.73)} x={0}>
        <ClayMound r={0.43} squash={0.46} color={PALETTE.snow} position={[0, 0.1, 0]} />
      </PropAnchor>
      {/* outcrops seated ON the dome (lifted to its surface), not beside it */}
      <PropAnchor theta={T(0.655)} x={-0.1}>
        <ClayBoulder color={PALETTE.stone} r={0.15} position={[0, 0.2, 0]} />
      </PropAnchor>
      <PropAnchor theta={T(0.68)} x={0.26}>
        <ClayBoulder color={PALETTE.driftShade} r={0.1} position={[0, 0.17, 0]} />
      </PropAnchor>
      {/* drift rubble round the foot, so the hill meets the field instead of being placed on it */}
      <PropAnchor theta={T(0.6)} x={-0.3}><ClayBoulder color={PALETTE.stone} r={0.13} /></PropAnchor>
      <PropAnchor theta={T(0.64)} x={-0.42}><ClayBoulder color={PALETTE.driftShade} r={0.11} /></PropAnchor>
      {/* Vault door lies on the mound's camera-facing slope */}
      <PropAnchor theta={T(0.62)} x={0.12}><VaultDoor position={[0, 0.16, 0]} rotation={[0.5, 0, 0]} /></PropAnchor>
      {/* snow conifers where the blossom trees stood, same anchors and heights */}
      <PropAnchor theta={T(0.55)} x={-0.4}><ClaySnowConifer height={0.5} /></PropAnchor>
      <PropAnchor theta={T(0.68)} x={0.45}><ClaySnowConifer height={0.55} rotation={[0, 1.7, 0]} /></PropAnchor>
      <PropAnchor theta={T(0.8)} x={-0.3}><ClaySnowConifer height={0.6} rotation={[0, 2.6, 0]} /></PropAnchor>
      <PropAnchor theta={T(0.86)} x={0.25}><ClaySnowConifer height={0.45} rotation={[0, 0.9, 0]} /></PropAnchor>
      {/* a shelter on the summit, and drift rubble where the ground flowers were */}
      <PropAnchor theta={T(0.3)} x={0.35}><ClayIgloo r={0.16} rotation={[0, -0.6, 0]} /></PropAnchor>
      <PropAnchor theta={T(0.4)} x={-0.5}><ClayBoulder color={PALETTE.frostShadow} r={0.1} /></PropAnchor>
      <PropAnchor theta={T(0.9)} x={-0.55}><ClayRock color={PALETTE.ice} r={0.09} /></PropAnchor>
      <PropAnchor theta={T(0.2)} x={-0.15}><ClayRock color={PALETTE.snow} r={0.08} /></PropAnchor>
    </>
  )
}
