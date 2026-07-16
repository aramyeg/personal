'use client'
import { useMemo } from 'react'
import type { ReactNode } from 'react'
import { anchorTransform } from '../stage'

/** Plants children on the terrain at local angle theta / lateral x. */
export function PropAnchor({
  theta,
  x = 0,
  children,
}: {
  theta: number
  x?: number
  children: ReactNode
}) {
  const { position, quaternion } = useMemo(() => anchorTransform(theta, x), [theta, x])
  return (
    <group position={position} quaternion={quaternion}>
      {children}
    </group>
  )
}
