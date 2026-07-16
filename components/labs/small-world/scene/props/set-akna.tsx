'use client'
import { PALETTE } from '../../palette'
import { chapterTheta } from '../stage'
import { PropAnchor } from './prop-anchor'
import { ClayBlock, ClayBlossom, ClayDisc } from './clay-kit'

const T = (t: number) => chapterTheta(4, t)

function BlockBuilding({ tiers, ...props }: { tiers: Array<{ w: number; h: number; color: string }>; position?: [number, number, number] }) {
  let y = 0
  return (
    <group {...props}>
      {tiers.map((tier, i) => {
        const el = <ClayBlock key={i} w={tier.w} h={tier.h} d={tier.w} color={tier.color} position={[0, y, 0]} />
        y += tier.h
        return el
      })}
    </group>
  )
}

export function AknaSet() {
  return (
    <>
      {/* Street pads down the middle */}
      <PropAnchor theta={T(0.3)} x={0}><ClayDisc color={PALETTE.clayPath} r={0.1} /></PropAnchor>
      <PropAnchor theta={T(0.45)} x={0.05}><ClayDisc color={PALETTE.clayPath} r={0.1} /></PropAnchor>
      <PropAnchor theta={T(0.6)} x={-0.05}><ClayDisc color={PALETTE.clayPath} r={0.1} /></PropAnchor>
      {/* Stacked buildings flanking the street */}
      <PropAnchor theta={T(0.35)} x={-0.45}>
        <BlockBuilding tiers={[{ w: 0.24, h: 0.18, color: PALETTE.tuff }, { w: 0.2, h: 0.14, color: PALETTE.horizon }, { w: 0.14, h: 0.1, color: PALETTE.blossom }]} />
      </PropAnchor>
      <PropAnchor theta={T(0.48)} x={0.5}>
        <BlockBuilding tiers={[{ w: 0.26, h: 0.22, color: PALETTE.horizon }, { w: 0.18, h: 0.16, color: PALETTE.tuff }]} />
      </PropAnchor>
      <PropAnchor theta={T(0.62)} x={-0.5}>
        <BlockBuilding tiers={[{ w: 0.2, h: 0.16, color: PALETTE.sky }, { w: 0.16, h: 0.12, color: PALETTE.tuff }, { w: 0.1, h: 0.1, color: PALETTE.blossomDeep }]} />
      </PropAnchor>
      <PropAnchor theta={T(0.78)} x={0.4}>
        <BlockBuilding tiers={[{ w: 0.3, h: 0.2, color: PALETTE.tuff }, { w: 0.22, h: 0.14, color: PALETTE.sky }, { w: 0.14, h: 0.12, color: PALETTE.horizon }]} />
      </PropAnchor>
      <PropAnchor theta={T(0.85)} x={-0.25}><ClayBlossom /></PropAnchor>
      <PropAnchor theta={T(0.25)} x={0.3}><ClayBlossom color={PALETTE.blossomDeep} /></PropAnchor>
    </>
  )
}
