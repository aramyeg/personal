'use client'

/**
 * The cloth banner: a fixed-topology grid whose positions are copied from the
 * sim's pose array each frame (y flipped to three's convention). The message
 * is a canvas texture painted once — it deforms with the surface for free.
 */

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react'
import * as THREE from 'three'
import { useThree } from '@react-three/fiber'
import { paintBanner } from '@/lib/labs/cloth-pull/paint'
import type { BannerDims } from '@/lib/labs/cloth-pull/banner'

export interface BannerMeshHandle {
  write(sim: Float32Array, w: number, h: number, skipNormals: boolean): void
}

export const BannerMesh = forwardRef<
  BannerMeshHandle,
  { dims: BannerDims; message: string }
>(function BannerMesh({ dims, message }, ref) {
  const { gl } = useThree()
  const nx = dims.segX + 1
  const ny = dims.segY + 1

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    const pos = new Float32Array(nx * ny * 3)
    const uv = new Float32Array(nx * ny * 2)
    const idx: number[] = []
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        uv[(j * nx + i) * 2] = i / dims.segX
        uv[(j * nx + i) * 2 + 1] = 1 - j / dims.segY
      }
    }
    for (let j = 0; j < dims.segY; j++) {
      for (let i = 0; i < dims.segX; i++) {
        const a = j * nx + i
        const b = a + 1
        const c = a + nx
        const d = c + 1
        idx.push(a, c, b, b, c, d)
      }
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
    geo.setIndex(idx)
    return geo
  }, [nx, ny, dims.segX, dims.segY])

  const [texture, setTexture] = useState<THREE.CanvasTexture | null>(null)
  useEffect(() => {
    let disposed = false
    let tex: THREE.CanvasTexture | null = null
    const paint = () => {
      if (disposed) return
      const canvas = paintBanner(
        message,
        dims.width,
        dims.height,
        window.devicePixelRatio || 1
      )
      const next = new THREE.CanvasTexture(canvas)
      next.colorSpace = THREE.SRGBColorSpace
      next.anisotropy = gl.capabilities.getMaxAnisotropy()
      tex?.dispose()
      tex = next
      setTexture(next)
    }
    paint()
    // repaint in the site display font once it is actually loaded
    document.fonts?.ready.then(paint).catch(() => undefined)
    return () => {
      disposed = true
      tex?.dispose()
    }
  }, [message, dims.width, dims.height, gl])

  const frame = useRef(0)

  useImperativeHandle(ref, () => ({
    write(sim: Float32Array, w: number, h: number, skipNormals: boolean) {
      const attr = geometry.getAttribute('position') as THREE.BufferAttribute
      const pos = attr.array as Float32Array
      for (let o = 0; o < sim.length; o += 3) {
        pos[o] = sim[o] - w / 2
        pos[o + 1] = h / 2 - sim[o + 1]
        pos[o + 2] = sim[o + 2]
      }
      attr.needsUpdate = true
      frame.current++
      if (!skipNormals || frame.current % 2 === 0) {
        geometry.computeVertexNormals()
      }
    },
  }))

  if (!texture) return null
  return (
    <mesh geometry={geometry} castShadow frustumCulled={false}>
      <meshStandardMaterial
        map={texture}
        side={THREE.DoubleSide}
        roughness={0.92}
        metalness={0}
      />
    </mesh>
  )
})
