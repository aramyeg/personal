'use client'
import { PALETTE } from '../../palette'
import { chapterTheta } from '../stage'
import { PropAnchor } from './prop-anchor'
import { ClayBlossom, ClayMound, ClayTree } from './clay-kit'
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

/** Chapter 6 — xDataGroup: present day, the tallest hill in full bloom. */
export function XdatagroupSet() {
  return (
    <>
      <PropAnchor theta={T(0.7)} x={0}><ClayMound r={0.55} squash={0.5} /></PropAnchor>
      {/* Vault door lies on the mound's camera-facing slope */}
      <PropAnchor theta={T(0.62)} x={0.12}><VaultDoor position={[0, 0.16, 0]} rotation={[0.5, 0, 0]} /></PropAnchor>
      <PropAnchor theta={T(0.55)} x={-0.4}><ClayTree crown={PALETTE.blossom} height={0.5} /></PropAnchor>
      <PropAnchor theta={T(0.68)} x={0.45}><ClayTree crown={PALETTE.blossomDeep} height={0.55} /></PropAnchor>
      <PropAnchor theta={T(0.8)} x={-0.3}><ClayTree crown={PALETTE.blossom} height={0.6} /></PropAnchor>
      <PropAnchor theta={T(0.86)} x={0.25}><ClayTree crown={PALETTE.blossom} height={0.45} /></PropAnchor>
      <PropAnchor theta={T(0.3)} x={0.35}><ClayBlossom /></PropAnchor>
      <PropAnchor theta={T(0.4)} x={-0.5}><ClayBlossom color={PALETTE.blossomDeep} /></PropAnchor>
      <PropAnchor theta={T(0.9)} x={-0.55}><ClayBlossom /></PropAnchor>
      <PropAnchor theta={T(0.2)} x={-0.15}><ClayBlossom /></PropAnchor>
    </>
  )
}
