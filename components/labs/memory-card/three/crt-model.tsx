'use client'

/**
 * CRTModel — a 4:3 molded-plastic tube TV, shot as a product.
 *
 * The `MC.warmGrey` shell wraps the screen on all four sides (~10% bezel per
 * side); a raised bezel lip frames a recess so the glass sits a few mm INTO the
 * set with a dark gasket shadow line. The screen is a gently convex sphere
 * section lit by an evenly-glowing emissive ticker — the curvature is felt as a
 * tight specular glint sweeping the glass (low roughness), never as a dim
 * geometric vignette. A stand foot reads below the shell.
 */

import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { MC } from '../tokens'
import { drawBitmapText, measureBitmapText } from '../lib/bitmap-font'

const SHELL_W = 3.4
const SHELL_H = 2.5
const SHELL_D = 2.1
const FOOT_H = 0.24
const PLACE_Y = SHELL_H / 2 + FOOT_H // foot bottom rests at y=0

const FACE_Z = SHELL_D / 2 // shell front face
const LIP = 0.12 // how far the bezel lip stands proud of the face
// Bezel lip frame — outer near the shell edge, inner is the screen opening.
const OUT_HW = 1.6
const OUT_HH = 1.16
const IN_HW = 1.37
const IN_HH = 1.01
// Curved glass sits recessed inside the opening. A subtly bulged plane fills
// the rectangular opening evenly (a trimmed sphere-section patch rendered as a
// rounded blob with dark corners — the plane is the read the brief allows).
const GLASS_W = 2.72
const GLASS_H = 2.0
const GLASS_BULGE = 0.07
const GLASS_FRONT_Z = 1.13 // bulge apex, ~0.05 behind the lip front

const TICK_W = 640
const TICK_H = 480

/** Phosphor ticker: bitmap lines on a dark field, with scanlines. The lines
 *  are spaced evenly over the full canvas height so the upward scroll wraps
 *  seamlessly. */
function makeTickerTexture(lines: string[]): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = TICK_W
  c.height = TICK_H
  const g = c.getContext('2d')!
  g.fillStyle = '#0c1a18'
  g.fillRect(0, 0, TICK_W, TICK_H)

  const scale = 3
  const step = TICK_H / Math.max(1, lines.length)
  lines.forEach((line, i) => {
    const w = measureBitmapText(line, scale)
    const y = Math.round(i * step + step / 2 - 3.5 * scale)
    drawBitmapText(g, line, Math.round((TICK_W - w) / 2), y, {
      scale,
      color: '#8ff6ec',
    })
  })

  // scanlines every 3px
  g.fillStyle = 'rgba(0,0,0,0.14)'
  for (let sy = 0; sy < TICK_H; sy += 3) {
    g.fillRect(0, sy, TICK_W, 1)
  }

  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.anisotropy = 8
  return tex
}

/** Soft elliptical highlight used as a faked glass glint (additive). */
function makeGlintTexture(): THREE.CanvasTexture {
  const S = 256
  const c = document.createElement('canvas')
  c.width = c.height = S
  const g = c.getContext('2d')!
  const grad = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2)
  grad.addColorStop(0, 'rgba(255,255,255,0.5)')
  grad.addColorStop(0.5, 'rgba(210,240,255,0.14)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, S, S)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

export type CRTModelProps = { lines: string[] }

export function CRTModel({ lines }: CRTModelProps) {
  const shell = useMemo(
    () => new RoundedBoxGeometry(SHELL_W, SHELL_H, SHELL_D, 4, 0.12),
    []
  )
  useEffect(() => () => shell.dispose(), [shell])

  const screenGeo = useMemo(() => {
    const g = new THREE.PlaneGeometry(GLASS_W, GLASS_H, 40, 30)
    const pos = g.attributes.position
    const hw = GLASS_W / 2
    const hh = GLASS_H / 2
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      const y = pos.getY(i)
      const z = GLASS_BULGE * (1 - (x / hw) ** 2) * (1 - (y / hh) ** 2)
      pos.setZ(i, z)
    }
    pos.needsUpdate = true
    g.computeVertexNormals()
    g.translate(0, 0, GLASS_FRONT_Z - GLASS_BULGE)
    return g
  }, [])
  useEffect(() => () => screenGeo.dispose(), [screenGeo])

  const shellMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: MC.warmGrey,
        roughness: 0.6,
        metalness: 0.06,
      }),
    []
  )
  useEffect(() => () => shellMat.dispose(), [shellMat])

  const ticker = useMemo(() => makeTickerTexture(lines), [lines])
  useEffect(() => () => ticker.dispose(), [ticker])

  const glint = useMemo(() => makeGlintTexture(), [])
  useEffect(() => () => glint.dispose(), [glint])

  useFrame((_, dt) => {
    ticker.offset.y = (ticker.offset.y + dt * 0.02) % 1
  })

  // Four warmGrey bars forming the raised bezel lip around the opening.
  const bezelBars: [number, number, number, number][] = [
    // [w, h, x, y] with shared depth; top / bottom / left / right
    [OUT_HW * 2, OUT_HH - IN_HH, 0, (IN_HH + OUT_HH) / 2],
    [OUT_HW * 2, OUT_HH - IN_HH, 0, -(IN_HH + OUT_HH) / 2],
    [OUT_HW - IN_HW, IN_HH * 2, -(IN_HW + OUT_HW) / 2, 0],
    [OUT_HW - IN_HW, IN_HH * 2, (IN_HW + OUT_HW) / 2, 0],
  ]
  const barZ = FACE_Z + LIP / 2 - 0.005
  const barD = LIP + 0.02

  return (
    <group position={[0, PLACE_Y, 0]}>
      {/* Molded plastic shell */}
      <mesh geometry={shell} material={shellMat} />

      {/* Raised bezel lip framing the screen recess */}
      {bezelBars.map(([w, h, x, y], i) => (
        <mesh key={i} position={[x, y, barZ]} material={shellMat}>
          <boxGeometry args={[w, h, barD]} />
        </mesh>
      ))}

      {/* Dark gasket at the back of the recess (shadow line around the glass) */}
      <mesh position={[0, 0, FACE_Z + 0.006]}>
        <planeGeometry args={[IN_HW * 2, IN_HH * 2]} />
        <meshStandardMaterial color="#131208" roughness={0.85} metalness={0} />
      </mesh>

      {/* Curved glowing glass — UNLIT (basic) so the phosphor field is
          perfectly even edge to edge; the scene's broad specular used to read
          as a dim central vignette on the near-flat cap. */}
      <mesh geometry={screenGeo}>
        <meshBasicMaterial map={ticker} toneMapped={false} />
      </mesh>

      {/* Faked glass glint — a soft off-axis highlight (additive) that sells
          the curvature without lighting the whole screen. */}
      <mesh position={[-0.6, 0.52, GLASS_FRONT_Z + 0.02]} rotation={[0, 0, 0.55]}>
        <planeGeometry args={[1.25, 0.52]} />
        <meshBasicMaterial
          map={glint}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          opacity={0.4}
        />
      </mesh>

      {/* Stand foot */}
      <mesh position={[0, -(SHELL_H / 2 + FOOT_H / 2), -0.1]} material={shellMat}>
        <boxGeometry args={[2.4, FOOT_H, 1.8]} />
      </mesh>
    </group>
  )
}

export default CRTModel
