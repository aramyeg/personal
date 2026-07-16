'use client'
import { PALETTE } from '../../palette'
import { chapterTheta } from '../stage'
import { PropAnchor } from './prop-anchor'
import { ClayBlossom, ClayHut, ClayRock, ClaySprout, ClayTree } from './clay-kit'
import { useClayRamp } from '../toon-ramp'

const T = (t: number) => chapterTheta(0, t)

function ReceptionBell(props: { position?: [number, number, number] }) {
  const ramp = useClayRamp()
  return (
    <group {...props}>
      <mesh position={[0, 0.05, 0]}>
        <cylinderGeometry args={[0.05, 0.06, 0.1, 12]} />
        <meshToonMaterial color={PALETTE.clayPath} gradientMap={ramp} />
      </mesh>
      <mesh position={[0, 0.13, 0]}>
        <sphereGeometry args={[0.05, 14, 14]} />
        <meshToonMaterial color={PALETTE.honey} gradientMap={ramp} />
      </mesh>
    </group>
  )
}

/** Chapter 1 — BlueNet/FreeDOM: career origin, first shoots of spring. */
export function BluenetSet() {
  return (
    <>
      <PropAnchor theta={T(0.1)} x={0.35}><ClaySprout /></PropAnchor>
      <PropAnchor theta={T(0.18)} x={-0.3}><ClaySprout scale={1.3} /></PropAnchor>
      <PropAnchor theta={T(0.28)} x={0.15}><ClayBlossom /></PropAnchor>
      <PropAnchor theta={T(0.34)} x={-0.5}><ClaySprout /></PropAnchor>
      <PropAnchor theta={T(0.42)} x={0.55}><ClayTree crown={PALETTE.sprout} height={0.35} /></PropAnchor>
      <PropAnchor theta={T(0.5)} x={-0.25}><ClayBlossom /></PropAnchor>
      <PropAnchor theta={T(0.6)} x={0.4}><ClayRock r={0.07} /></PropAnchor>
      <PropAnchor theta={T(0.72)} x={-0.45}><ClayHut /></PropAnchor>
      <PropAnchor theta={T(0.8)} x={-0.18}><ReceptionBell /></PropAnchor>
      <PropAnchor theta={T(0.86)} x={0.3}><ClayTree crown={PALETTE.leaf} height={0.42} /></PropAnchor>
      <PropAnchor theta={T(0.92)} x={-0.6}><ClayBlossom /></PropAnchor>
    </>
  )
}
