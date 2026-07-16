'use client'
import { PALETTE } from '../../palette'
import { chapterTheta } from '../stage'
import { PropAnchor } from './prop-anchor'
import { ClayBee, ClayBlossom, ClayDisc, ClayMound, ClayTree } from './clay-kit'

const T = (t: number) => chapterTheta(1, t)

/** The winding path: clay stepping discs alternating around the girl's line. */
const PATH: Array<[number, number]> = [
  [0.08, 0.1], [0.16, -0.12], [0.24, 0.18], [0.32, -0.2], [0.4, 0.12],
  [0.48, -0.08], [0.56, 0.2], [0.64, -0.16], [0.72, 0.1],
]

function Beehive(props: { position?: [number, number, number] }) {
  return (
    <group {...props}>
      <ClayMound r={0.16} squash={0.5} color={PALETTE.honey} position={[0, 0.06, 0]} />
      <ClayMound r={0.13} squash={0.5} color={PALETTE.dune} position={[0, 0.16, 0]} />
      <ClayMound r={0.09} squash={0.5} color={PALETTE.honey} position={[0, 0.24, 0]} />
    </group>
  )
}

/** Chapter 2 — FLYERBEE: bees over pink flowers along the delivery path. */
export function FlyerbeeSet() {
  return (
    <>
      {PATH.map(([t, x]) => (
        <PropAnchor key={t} theta={T(t)} x={x}>
          <ClayDisc color={PALETTE.clayPath} r={0.09} />
        </PropAnchor>
      ))}
      <PropAnchor theta={T(0.3)} x={0.5}><ClayBlossom /></PropAnchor>
      <PropAnchor theta={T(0.45)} x={-0.55}><ClayBlossom color={PALETTE.blossomDeep} /></PropAnchor>
      <PropAnchor theta={T(0.55)} x={0.6}><ClayBlossom /></PropAnchor>
      <PropAnchor theta={T(0.62)} x={-0.35}><ClayTree crown={PALETTE.blossom} height={0.4} /></PropAnchor>
      <PropAnchor theta={T(0.78)} x={-0.5}><Beehive /></PropAnchor>
      <PropAnchor theta={T(0.74)} x={-0.3}><ClayBee position={[0, 0.35, 0]} /></PropAnchor>
      <PropAnchor theta={T(0.82)} x={-0.15}><ClayBee position={[0, 0.45, 0]} rotation={[0, 2.5, 0]} /></PropAnchor>
      <PropAnchor theta={T(0.88)} x={0.25}><ClayBee position={[0, 0.3, 0]} rotation={[0, 4, 0]} /></PropAnchor>
      <PropAnchor theta={T(0.9)} x={0.45}><ClayBlossom /></PropAnchor>
    </>
  )
}
