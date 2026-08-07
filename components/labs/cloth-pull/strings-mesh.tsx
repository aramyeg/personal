'use client'

/**
 * The two tow strings, fixed-topology thin tubes rewritten each frame:
 * - string A (structural): follows the chain's string run, fist -> cloth
 *   top-leading corner;
 * - string B (cosmetic): fist -> cloth bottom-leading corner, drawn as a
 *   sagging quadratic bezier whose sag eases out as the line tautens.
 */

import { forwardRef, useImperativeHandle, useMemo } from 'react'
import * as THREE from 'three'
import { CFG } from '@/lib/labs/cloth-pull/config'
import { atLength, type Chain } from '@/lib/labs/cloth-pull/chain'

export interface StringsMeshHandle {
  write(
    chain: Chain,
    fistZ: number,
    corner: { x: number; y: number; z: number },
    w: number,
    h: number
  ): void
}

interface Tube {
  geometry: THREE.BufferGeometry
  rings: number
}

function makeTube(rings: number, sides: number): Tube {
  const geo = new THREE.BufferGeometry()
  const pos = new Float32Array(rings * sides * 3)
  const idx: number[] = []
  for (let i = 0; i < rings - 1; i++) {
    for (let k = 0; k < sides; k++) {
      const a = i * sides + k
      const b = i * sides + ((k + 1) % sides)
      const c = (i + 1) * sides + k
      const d = (i + 1) * sides + ((k + 1) % sides)
      idx.push(a, c, b, b, c, d)
    }
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geo.setIndex(idx)
  return { geometry: geo, rings }
}

function writeTube(
  tube: Tube,
  sides: number,
  radius: number,
  sample: (t: number) => { x: number; y: number; z: number }
): void {
  const attr = tube.geometry.getAttribute('position') as THREE.BufferAttribute
  const pos = attr.array as Float32Array
  for (let i = 0; i < tube.rings; i++) {
    const t = i / (tube.rings - 1)
    const p = sample(t)
    const q = sample(Math.min(1, t + 0.04))
    let tx = q.x - p.x
    let ty = q.y - p.y
    const tl = Math.hypot(tx, ty) || 1
    tx /= tl
    ty /= tl
    const nx = -ty
    const ny = tx
    for (let k = 0; k < sides; k++) {
      const a = (k / sides) * Math.PI * 2
      const ca = Math.cos(a) * radius
      const sa = Math.sin(a) * radius
      const o = (i * sides + k) * 3
      pos[o] = p.x + nx * ca
      pos[o + 1] = p.y + ny * ca
      pos[o + 2] = p.z + sa
    }
  }
  attr.needsUpdate = true
  tube.geometry.computeVertexNormals()
}

export const StringsMesh = forwardRef<StringsMeshHandle>(
  function StringsMesh(_, ref) {
    const S = CFG.scene
    const { tubeA, tubeB } = useMemo(
      () => ({
        tubeA: makeTube(S.stringSamples, S.stringSides),
        tubeB: makeTube(S.stringSamples, S.stringSides),
      }),
      [S.stringSamples, S.stringSides]
    )

    useImperativeHandle(ref, () => ({
      write(
        chain: Chain,
        fistZ: number,
        corner: { x: number; y: number; z: number },
        w: number,
        h: number
      ) {
        const vx = (x: number) => x - w / 2
        const vy = (y: number) => h / 2 - y

        writeTube(tubeA, S.stringSides, S.stringRadius, (t) => {
          const p = atLength(chain, t * chain.stringLen)
          return { x: vx(p.x), y: vy(p.y), z: fistZ * (1 - t) }
        })

        const fist = chain.pts[0]
        const cx = vx(corner.x)
        const cy = vy(corner.y)
        const fx = vx(fist.x)
        const fy = vy(fist.y)
        const dist = Math.hypot(cx - fx, cy - fy)
        const rest = Math.hypot(chain.stringLen, corner.y - fist.y)
        const slack = Math.max(0, 1 - dist / (rest || 1))
        const sag = 8 + slack * 46
        writeTube(tubeB, S.stringSides, S.stringRadius * 0.85, (t) => {
          const mx = (fx + cx) / 2
          const my = (fy + cy) / 2 - sag
          const omt = 1 - t
          return {
            x: omt * omt * fx + 2 * omt * t * mx + t * t * cx,
            y: omt * omt * fy + 2 * omt * t * my + t * t * cy,
            z: fistZ * (1 - t) + corner.z * t,
          }
        })
      },
    }))

    return (
      <>
        <mesh geometry={tubeA.geometry} castShadow frustumCulled={false}>
          <meshStandardMaterial color="#6B4F35" roughness={0.85} metalness={0} />
        </mesh>
        <mesh geometry={tubeB.geometry} castShadow frustumCulled={false}>
          <meshStandardMaterial color="#6B4F35" roughness={0.85} metalness={0} />
        </mesh>
      </>
    )
  }
)
