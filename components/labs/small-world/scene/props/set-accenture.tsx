'use client'
import { PALETTE } from '../../palette'
import { chapterTheta } from '../stage'
import { PropAnchor } from './prop-anchor'
import { ClayBlock, ClayMound, ClayPalm, ClayPyramid, ClayRock } from './clay-kit'

const T = (t: number) => chapterTheta(3, t)

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

export function AccentureSet() {
  return (
    <>
      {/* Pyramids — the desert's structures (Task 41): one large + two smaller, off-lane on the
          dunes, slightly sunken/tilted for claymation charm. */}
      <PropAnchor theta={T(0.5)} x={-0.55}>
        <ClayPyramid size={0.72} color={PALETTE.sand} base={PALETTE.dune} sink={0.05} spin={0.5} />
      </PropAnchor>
      <PropAnchor theta={T(0.38)} x={0.5}>
        <ClayPyramid size={0.42} color={PALETTE.dune} base={PALETTE.clayPath} tilt={0.06} sink={0.035} spin={-0.4} />
      </PropAnchor>
      <PropAnchor theta={T(0.68)} x={0.44}>
        <ClayPyramid size={0.34} color={PALETTE.sand} base={PALETTE.dune} tilt={-0.05} sink={0.03} spin={1.1} />
      </PropAnchor>

      <PropAnchor theta={T(0.3)} x={0.45}><ClayMound r={0.35} color={PALETTE.dune} squash={0.4} /></PropAnchor>
      <PropAnchor theta={T(0.45)} x={-0.5}><ClayMound r={0.45} color={PALETTE.dune} squash={0.35} /></PropAnchor>
      <PropAnchor theta={T(0.6)} x={0.3}><ClayMound r={0.3} color={PALETTE.honey} squash={0.3} /></PropAnchor>
      <PropAnchor theta={T(0.55)} x={0.6}><ClayPalm /></PropAnchor>
      <PropAnchor theta={T(0.78)} x={-0.4}><BankFacade /></PropAnchor>
      <PropAnchor theta={T(0.85)} x={0.35}><ClayRock color={PALETTE.dune} r={0.1} /></PropAnchor>
      <PropAnchor theta={T(0.2)} x={-0.3}><ClayRock color={PALETTE.dune} r={0.07} /></PropAnchor>
    </>
  )
}
