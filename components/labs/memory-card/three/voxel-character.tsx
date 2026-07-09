'use client'

/**
 * VoxelCharacter — the site's pixel avatar re-issued as a designed figurine.
 *
 * Every occupied cell of the 32x37 avatar grid becomes a beveled cube in a
 * single InstancedMesh (0.94 boxes on a 1-unit lattice, so the 0.06 gaps read
 * as clean bevel seams under the studio rig — never a low-res blob). A second,
 * darkened layer sits one cube deeper for a relief-thickness read, and the
 * figure stands on a shell-grey plinth ringed with the four button glyphs.
 */

import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { buildVoxelGrid, GRID_W, GRID_H } from '../lib/voxel-grid'
import { MC, GLYPH_ORDER, GLYPH_PATHS } from '../tokens'

const VOX = 0.94 // cube edge; the 0.06 gap to the 1-unit lattice reads as bevel
const FIGURE_HEIGHT = 2.4 // world units, tall dimension of the figure
const DAIS_H = 0.28
const DAIS_TOP = DAIS_H // figure base rests on the plinth top
const BACK_DARKEN = 0.55

/** Ring of the four button glyphs stroked around the plinth top. */
function makeDaisTexture(): THREE.CanvasTexture {
  const S = 512
  const c = document.createElement('canvas')
  c.width = c.height = S
  const g = c.getContext('2d')!
  g.clearRect(0, 0, S, S)
  const cx = S / 2
  const cy = S / 2
  const ringR = S * 0.34
  const glyphScale = 1.6 // 24px viewBox → ~38px glyph
  const COUNT = 8
  for (let i = 0; i < COUNT; i++) {
    const name = GLYPH_ORDER[i % GLYPH_ORDER.length]
    const angle = (i / COUNT) * Math.PI * 2 - Math.PI / 2
    const gx = cx + Math.cos(angle) * ringR
    const gy = cy + Math.sin(angle) * ringR
    g.save()
    g.translate(gx, gy)
    g.scale(glyphScale, glyphScale)
    g.translate(-12, -12) // center the 24x24 viewBox
    g.strokeStyle = MC.glyphs[name]
    g.lineWidth = 2.1
    g.lineJoin = 'round'
    g.lineCap = 'round'
    g.stroke(new Path2D(GLYPH_PATHS[name]))
    g.restore()
  }
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  return tex
}

export type VoxelCharacterProps = { spin?: boolean }

export function VoxelCharacter({ spin = true }: VoxelCharacterProps) {
  const spinner = useRef<THREE.Group>(null)
  const mesh = useRef<THREE.InstancedMesh>(null)

  const { instances, count, scale, baseOffset } = useMemo(() => {
    const voxels = buildVoxelGrid()
    // grid → local: x centered on 0, y flipped so row 0 (hair) is up top.
    const cx = (GRID_W - 1) / 2
    const local = voxels.map((v) => ({
      x: v.x - cx,
      y: GRID_H - v.y,
      color: v.color,
    }))
    let minY = Infinity
    let maxY = -Infinity
    for (const p of local) {
      if (p.y < minY) minY = p.y
      if (p.y > maxY) maxY = p.y
    }
    const localH = maxY - minY + 1
    const s = FIGURE_HEIGHT / localH
    // after scaling, drop the figure so its base sits on the plinth top.
    const baseOffset = DAIS_TOP - (minY - 0.5) * s
    return { instances: local, count: local.length, scale: s, baseOffset }
  }, [])

  const daisTex = useMemo(() => makeDaisTexture(), [])
  useEffect(() => () => daisTex.dispose(), [daisTex])

  useEffect(() => {
    const m = mesh.current
    if (!m) return
    const dummy = new THREE.Object3D()
    const col = new THREE.Color()
    for (let i = 0; i < count; i++) {
      const p = instances[i]
      dummy.position.set(p.x, p.y, 0)
      dummy.updateMatrix()
      m.setMatrixAt(i, dummy.matrix)
      col.set(p.color)
      m.setColorAt(i, col)
    }
    for (let i = 0; i < count; i++) {
      const p = instances[i]
      dummy.position.set(p.x, p.y, -1)
      dummy.updateMatrix()
      m.setMatrixAt(count + i, dummy.matrix)
      col.set(p.color).multiplyScalar(BACK_DARKEN)
      m.setColorAt(count + i, col)
    }
    m.instanceMatrix.needsUpdate = true
    if (m.instanceColor) m.instanceColor.needsUpdate = true
  }, [instances, count])

  useFrame((_, dt) => {
    if (spin && spinner.current) spinner.current.rotation.y += 0.5 * dt
  })

  return (
    <group ref={spinner}>
      {/* Figure: front layer + darkened back layer, one instanced draw. */}
      <group scale={scale} position={[0, baseOffset, 0]}>
        <instancedMesh
          ref={mesh}
          args={[undefined, undefined, count * 2]}
          castShadow={false}
        >
          <boxGeometry args={[VOX, VOX, VOX]} />
          <meshStandardMaterial roughness={0.55} metalness={0.05} />
        </instancedMesh>
      </group>

      {/* Plinth: sits on the ground (bottom at y=0), figure on its top face. */}
      <mesh position={[0, DAIS_H / 2, 0]}>
        <cylinderGeometry args={[2.1, 2.3, DAIS_H, 48]} />
        <meshStandardMaterial color={MC.shell} roughness={0.5} metalness={0.1} />
      </mesh>
      {/* Glyph ring decal, just proud of the plinth top face. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, DAIS_H + 0.002, 0]}>
        <circleGeometry args={[2.1, 48]} />
        <meshStandardMaterial
          map={daisTex}
          transparent
          roughness={0.6}
          metalness={0}
          polygonOffset
          polygonOffsetFactor={-1}
        />
      </mesh>
    </group>
  )
}

export default VoxelCharacter
