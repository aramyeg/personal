'use client'
import { useMemo } from 'react'
import type { ReactNode } from 'react'
import { anchorTransform } from '../stage'

/** Plants children on the terrain at local angle theta / lateral x. Pass
 *  `lapB` to seat on the lap-2 terrain (terrainBumpB) — the lap-2 flank dressing
 *  uses this so its props ground on the morphed autumn land. */
export function PropAnchor({
  theta,
  x = 0,
  lapB = false,
  children,
}: {
  theta: number
  x?: number
  lapB?: boolean
  children: ReactNode
}) {
  const { position, quaternion } = useMemo(
    () => anchorTransform(theta, x, lapB ? 1 : undefined),
    [theta, x, lapB]
  )
  return (
    <group position={position} quaternion={quaternion}>
      {children}
    </group>
  )
}
