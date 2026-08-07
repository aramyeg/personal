'use client'

/**
 * Rope rendered as a fixed-topology tube: R rings x K sides whose positions
 * are rewritten each frame from an even arc-length resample of the verlet
 * chain. A striped canvas texture scrolls with the hauled distance so the
 * line reads as running through the hands, not translating.
 */

import { forwardRef, useImperativeHandle, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { CFG } from '@/lib/labs/cloth-pull/config'
import { atLength, ropeLength, type Rope } from '@/lib/labs/cloth-pull/rope'

export interface RopeMeshHandle {
  write(rope: Rope, w: number, h: number, z: number, hauled: number): void
}

function makeStripeTexture(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null
  const c = document.createElement('canvas')
  c.width = 64
  c.height = 8
  const x = c.getContext('2d')
  if (!x) return null
  x.fillStyle = '#7a5a3a'
  x.fillRect(0, 0, 64, 8)
  x.strokeStyle = '#5d4227'
  x.lineWidth = 3.4
  for (let i = -1; i < 6; i++) {
    x.beginPath()
    x.moveTo(i * 13 - 6, 10)
    x.lineTo(i * 13 + 8, -2)
    x.stroke()
  }
  const t = new THREE.CanvasTexture(c)
  t.wrapS = THREE.RepeatWrapping
  t.wrapT = THREE.RepeatWrapping
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

export const RopeMesh = forwardRef<RopeMeshHandle>(function RopeMesh(_, ref) {
  const R = CFG.scene.ropeSamples
  const K = CFG.scene.ropeSides
  const radius = CFG.scene.ropeRadius

  const { geometry, texture } = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    const pos = new Float32Array(R * K * 3)
    const uv = new Float32Array(R * K * 2)
    const idx: number[] = []
    for (let i = 0; i < R; i++) {
      for (let k = 0; k < K; k++) {
        uv[(i * K + k) * 2] = i / (R - 1)
        uv[(i * K + k) * 2 + 1] = k / (K - 1)
      }
    }
    for (let i = 0; i < R - 1; i++) {
      for (let k = 0; k < K; k++) {
        const a = i * K + k
        const b = i * K + ((k + 1) % K)
        const c = (i + 1) * K + k
        const d = (i + 1) * K + ((k + 1) % K)
        idx.push(a, c, b, b, c, d)
      }
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
    geo.setIndex(idx)
    return { geometry: geo, texture: makeStripeTexture() }
  }, [R, K])

  const meshRef = useRef<THREE.Mesh>(null)

  useImperativeHandle(ref, () => ({
    write(rope: Rope, w: number, h: number, z: number, hauled: number) {
      const attr = geometry.getAttribute('position') as THREE.BufferAttribute
      const pos = attr.array as Float32Array
      const len = ropeLength(rope)
      for (let i = 0; i < R; i++) {
        const s = (i / (R - 1)) * len
        const p = atLength(rope, s)
        const q = atLength(rope, Math.min(s + 4, len))
        let tx = q.x - p.x
        let ty = q.y - p.y
        const tl = Math.hypot(tx, ty) || 1
        tx /= tl
        ty /= tl
        // world-space center (flip sim y-down to three y-up)
        const cx = p.x - w / 2
        const cy = h / 2 - p.y
        const tyW = -ty
        // normal in the screen plane + binormal out of it
        const nx = -tyW
        const ny = tx
        for (let k = 0; k < K; k++) {
          const a = (k / K) * Math.PI * 2
          const ca = Math.cos(a) * radius
          const sa = Math.sin(a) * radius
          const o = (i * K + k) * 3
          pos[o] = cx + nx * ca
          pos[o + 1] = cy + ny * ca
          pos[o + 2] = z + sa
        }
      }
      attr.needsUpdate = true
      geometry.computeVertexNormals()
      if (texture) {
        texture.repeat.x = len / CFG.scene.ropeLay
        texture.offset.x = -hauled / CFG.scene.ropeLay
      }
    },
  }))

  return (
    <mesh ref={meshRef} geometry={geometry} castShadow frustumCulled={false}>
      <meshStandardMaterial
        map={texture ?? undefined}
        color={texture ? '#ffffff' : '#6B4F35'}
        roughness={0.85}
        metalness={0}
      />
    </mesh>
  )
})
