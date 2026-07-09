'use client'

/**
 * VoxelCharacter — the site's pixel avatar re-issued as a designed figurine.
 *
 * Every occupied cell of the 32x37 avatar grid becomes a beveled cube (0.94
 * boxes on a 1-unit lattice, so the 0.06 gaps read as clean bevel seams under
 * the studio rig — never a low-res blob). A darkened back layer gives relief
 * thickness. The blade/hilt voxels are split into their own mesh with a lifted
 * colour and a faint self-glow so the avatar's signature sword reads against
 * the near-black tee. The figure stands on a molded shell-grey plinth engraved
 * with the four button glyphs.
 */

import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { buildVoxelGrid, GRID_W, GRID_H } from '../lib/voxel-grid'
import { MC, GLYPH_ORDER, GLYPH_PATHS } from '../tokens'

const VOX = 0.94 // cube edge; the 0.06 gap to the 1-unit lattice reads as bevel
const FIGURE_HEIGHT = 2.4 // world units, tall dimension of the figure
const DAIS_TOP = 0.3 // figure base rests on the plinth top (body + chamfer)
const BACK_DARKEN = 0.55
const INITIAL_YAW = -0.5 // seeded so turntable screenshots are reproducible

// Sword voxel colours from the grid data (blade / hilt). Lifted a value step so
// the avatar's signature reads against the tee; the mesh also gets a warm
// self-glow. Kept in sync with `lib/voxel-grid.ts`.
const SWORD_HEXES = new Set(['#e0a878', '#b0563d'])

/** Engraved plinth ring: an inset band with the four glyphs at 90°, stroked at
 *  full accent strength so they read at gate resolution. */
function makeDaisTexture(): THREE.CanvasTexture {
  const S = 1024
  const c = document.createElement('canvas')
  c.width = c.height = S
  const g = c.getContext('2d')!
  g.clearRect(0, 0, S, S)
  const cx = S / 2
  const cy = S / 2

  // Darker inset band the glyphs sit in.
  g.beginPath()
  g.arc(cx, cy, S * 0.55, 0, Math.PI * 2)
  g.arc(cx, cy, S * 0.4, 0, Math.PI * 2, true)
  g.fillStyle = 'rgba(24,24,28,0.22)'
  g.fill('evenodd')

  const ringR = S * 0.475
  const glyphScale = S * 0.0055 // 24px viewBox → ~135px glyph
  // triangle top, circle right, cross bottom, square left
  GLYPH_ORDER.forEach((name, i) => {
    const angle = (i / GLYPH_ORDER.length) * Math.PI * 2 - Math.PI / 2
    const gx = cx + Math.cos(angle) * ringR
    const gy = cy + Math.sin(angle) * ringR
    g.save()
    g.translate(gx, gy)
    g.scale(glyphScale, glyphScale)
    g.translate(-12, -12) // center the 24x24 viewBox
    g.strokeStyle = MC.glyphs[name]
    g.lineWidth = 3
    g.lineJoin = 'round'
    g.lineCap = 'round'
    g.stroke(new Path2D(GLYPH_PATHS[name]))
    g.restore()
  })

  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  return tex
}

type Inst = { x: number; y: number; color: string }

/** Fill an InstancedMesh with a front layer and a darkened back layer. */
function fillLayers(
  mesh: THREE.InstancedMesh,
  instances: Inst[],
  opts?: { lift?: number }
) {
  const dummy = new THREE.Object3D()
  const col = new THREE.Color()
  const white = new THREE.Color('#ffffff')
  const n = instances.length
  for (let i = 0; i < n; i++) {
    const p = instances[i]
    dummy.position.set(p.x, p.y, 0)
    dummy.updateMatrix()
    mesh.setMatrixAt(i, dummy.matrix)
    col.set(p.color)
    if (opts?.lift) col.lerp(white, opts.lift)
    mesh.setColorAt(i, col)
  }
  for (let i = 0; i < n; i++) {
    const p = instances[i]
    dummy.position.set(p.x, p.y, -1)
    dummy.updateMatrix()
    mesh.setMatrixAt(n + i, dummy.matrix)
    col.set(p.color)
    if (opts?.lift) col.lerp(white, opts.lift)
    col.multiplyScalar(BACK_DARKEN)
    mesh.setColorAt(n + i, col)
  }
  mesh.instanceMatrix.needsUpdate = true
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
}

export type VoxelCharacterProps = { spin?: boolean }

export function VoxelCharacter({ spin = true }: VoxelCharacterProps) {
  const spinner = useRef<THREE.Group>(null)
  const bodyMesh = useRef<THREE.InstancedMesh>(null)
  const swordMesh = useRef<THREE.InstancedMesh>(null)

  const { body, sword, scale, baseOffset } = useMemo(() => {
    const voxels = buildVoxelGrid()
    const cx = (GRID_W - 1) / 2
    const local = voxels.map((v) => ({
      x: v.x - cx,
      y: GRID_H - v.y, // flip so grid row 0 (hair) is up top
      color: v.color,
    }))
    let minY = Infinity
    let maxY = -Infinity
    for (const p of local) {
      if (p.y < minY) minY = p.y
      if (p.y > maxY) maxY = p.y
    }
    const s = FIGURE_HEIGHT / (maxY - minY + 1)
    const baseOffset = DAIS_TOP - (minY - 0.5) * s
    const body: Inst[] = []
    const sword: Inst[] = []
    for (const p of local) {
      ;(SWORD_HEXES.has(p.color.toLowerCase()) ? sword : body).push(p)
    }
    return { body, sword, scale: s, baseOffset }
  }, [])

  const daisTex = useMemo(() => makeDaisTexture(), [])
  useEffect(() => () => daisTex.dispose(), [daisTex])

  useEffect(() => {
    if (bodyMesh.current) fillLayers(bodyMesh.current, body)
  }, [body])
  useEffect(() => {
    if (swordMesh.current) fillLayers(swordMesh.current, sword, { lift: 0.16 })
  }, [sword])

  useEffect(() => {
    if (spinner.current) spinner.current.rotation.y = INITIAL_YAW
  }, [])

  useFrame((_, dt) => {
    if (spin && spinner.current) spinner.current.rotation.y += 0.5 * dt
  })

  return (
    <group ref={spinner}>
      <group scale={scale} position={[0, baseOffset, 0]}>
        {/* Body voxels: front + darkened back. Slightly glossy so the black
            tee catches highlights and reads as form, not a flat void. */}
        <instancedMesh ref={bodyMesh} args={[undefined, undefined, body.length * 2]}>
          <boxGeometry args={[VOX, VOX, VOX]} />
          <meshStandardMaterial roughness={0.46} metalness={0.12} />
        </instancedMesh>

        {/* Sword voxels: lifted colour + faint warm self-glow (no halo). */}
        <instancedMesh ref={swordMesh} args={[undefined, undefined, sword.length * 2]}>
          <boxGeometry args={[VOX, VOX, VOX]} />
          <meshStandardMaterial
            roughness={0.32}
            metalness={0.25}
            emissive="#3a2410"
            emissiveIntensity={0.3}
          />
        </instancedMesh>
      </group>

      {/* Molded plinth: tapered body + a chamfered top lip so it reads molded,
          not a flat white disc. Sits on the ground (bottom at y=0). */}
      <mesh position={[0, 0.12, 0]}>
        <cylinderGeometry args={[2.05, 2.22, 0.24, 64]} />
        <meshStandardMaterial color={MC.shell} roughness={0.58} metalness={0.1} />
      </mesh>
      <mesh position={[0, 0.27, 0]}>
        <cylinderGeometry args={[1.96, 2.05, 0.06, 64]} />
        <meshStandardMaterial color={MC.shell} roughness={0.5} metalness={0.1} />
      </mesh>
      {/* Engraved glyph ring on the plinth top */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, DAIS_TOP + 0.002, 0]}>
        <circleGeometry args={[1.92, 64]} />
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
