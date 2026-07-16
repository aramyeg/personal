'use client'
import { PALETTE } from '../../palette'
import { chapterTheta } from '../stage'
import { PropAnchor } from './prop-anchor'
import { ClayBird, ClayDisc, ClayRock } from './clay-kit'

const T = (t: number) => chapterTheta(2, t)

/** The delta: overlapping blue discs spanning the girl's line. */
const RIVER: Array<[number, number, number]> = [
  // [t, x, r]
  [0.38, -0.7, 0.2], [0.42, -0.35, 0.24], [0.46, 0, 0.26], [0.5, 0.35, 0.24],
  [0.54, 0.7, 0.2], [0.48, -0.55, 0.18], [0.52, 0.15, 0.2], [0.44, 0.5, 0.18],
]

export function Dialog360Set() {
  return (
    <>
      {RIVER.map(([t, x, r]) => (
        <PropAnchor key={`${t}-${x}`} theta={T(t)} x={x}>
          <ClayDisc color={PALETTE.river} r={r} h={0.03} />
        </PropAnchor>
      ))}
      <PropAnchor theta={T(0.46)} x={-0.18}><ClayDisc color={PALETTE.riverDeep} r={0.14} h={0.045} /></PropAnchor>
      {/* Message-pebble stepping stones across the girl's line */}
      <PropAnchor theta={T(0.42)} x={0.02}><ClayDisc color={PALETTE.sky} r={0.07} h={0.05} /></PropAnchor>
      <PropAnchor theta={T(0.47)} x={-0.04}><ClayDisc color={PALETTE.sky} r={0.07} h={0.05} /></PropAnchor>
      <PropAnchor theta={T(0.52)} x={0.03}><ClayDisc color={PALETTE.sky} r={0.07} h={0.05} /></PropAnchor>
      {/* Carrier birds overhead */}
      <PropAnchor theta={T(0.6)} x={-0.4}><ClayBird position={[0, 0.55, 0]} rotation={[0, 1.2, 0]} /></PropAnchor>
      <PropAnchor theta={T(0.7)} x={0.2}><ClayBird position={[0, 0.7, 0]} rotation={[0, 2, 0]} /></PropAnchor>
      <PropAnchor theta={T(0.78)} x={-0.1}><ClayBird position={[0, 0.5, 0]} rotation={[0, 0.6, 0]} /></PropAnchor>
      <PropAnchor theta={T(0.25)} x={0.55}><ClayRock /></PropAnchor>
      <PropAnchor theta={T(0.85)} x={-0.55}><ClayRock r={0.11} /></PropAnchor>
    </>
  )
}
