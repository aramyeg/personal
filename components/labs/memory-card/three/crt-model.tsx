'use client'

/**
 * CRTModel — a small molded-plastic CRT set with a gently curved, glowing
 * screen running a bitmap-font ticker.
 *
 * The screen is a windowed sphere section (so it bulges convex toward the
 * camera like real glass), lit by an emissiveMap of the bitmap ticker over a
 * dark phosphor field — a soft self-glow, never a blown-out emissive. The
 * ticker canvas scrolls upward each frame; scanlines keep it reading as a tube.
 */

import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { MC } from '../tokens'
import { drawBitmapText, measureBitmapText } from '../lib/bitmap-font'

const SHELL_W = 3.2
const SHELL_H = 2.6
const SHELL_D = 2.4
const PLACE_Y = 1.42 // foot bottom rests at y=0
const TICK_W = 640
const TICK_H = 480
// Screen cap: a section of a large-radius sphere reads as a gently convex
// tube face (a small radius collapses to a dark spotlit circle).
const SCREEN_R = 9
const SCREEN_HW = 1.24 // half-width of the visible cap
const SCREEN_HH = 0.96 // half-height
const SCREEN_FACE_Z = 1.24 // where the cap bulge sits, just proud of the shell

/** Phosphor ticker: bitmap lines on a dark field, with scanlines. The four
 *  lines are spaced evenly over the full canvas height so the upward scroll
 *  wraps seamlessly. */
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

export type CRTModelProps = { lines: string[] }

export function CRTModel({ lines }: CRTModelProps) {
  const shell = useMemo(
    () => new RoundedBoxGeometry(SHELL_W, SHELL_H, SHELL_D, 4, 0.12),
    []
  )
  useEffect(() => () => shell.dispose(), [shell])

  // Sphere-section screen: a cap of a big sphere, windowed around +z so it
  // bulges gently toward the viewer like tube glass.
  const screenGeo = useMemo(() => {
    const dPhi = SCREEN_HW / SCREEN_R
    const dTheta = SCREEN_HH / SCREEN_R
    const g = new THREE.SphereGeometry(
      SCREEN_R,
      64,
      48,
      Math.PI / 2 - dPhi,
      dPhi * 2,
      Math.PI / 2 - dTheta,
      dTheta * 2
    )
    // pull the cap forward so its bulge sits just proud of the shell face
    g.translate(0, 0, SCREEN_FACE_Z - SCREEN_R)
    return g
  }, [])
  useEffect(() => () => screenGeo.dispose(), [screenGeo])

  const ticker = useMemo(() => makeTickerTexture(lines), [lines])
  useEffect(() => () => ticker.dispose(), [ticker])

  useFrame((_, dt) => {
    ticker.offset.y = (ticker.offset.y + dt * 0.02) % 1
  })

  return (
    <group position={[0, PLACE_Y, 0]}>
      {/* Molded plastic shell */}
      <mesh geometry={shell}>
        <meshStandardMaterial color={MC.warmGrey} roughness={0.62} metalness={0.05} />
      </mesh>

      {/* Dark screen faceplate framing the tube, just proud of the shell */}
      <mesh position={[0, 0, SHELL_D / 2 + 0.001]}>
        <planeGeometry args={[2.86, 2.24]} />
        <meshStandardMaterial color="#15140f" roughness={0.85} metalness={0} />
      </mesh>

      {/* Curved glowing screen — emissive white lets the ticker colors read
          at full strength; the dark field self-glows as idle phosphor. */}
      <mesh geometry={screenGeo}>
        <meshStandardMaterial
          color="#060d0c"
          emissive="#eafffb"
          emissiveIntensity={1.15}
          emissiveMap={ticker}
          roughness={0.42}
          metalness={0}
        />
      </mesh>

      {/* Foot */}
      <mesh position={[0, -(SHELL_H / 2 + 0.12), 0]}>
        <boxGeometry args={[2.4, 0.24, 1.8]} />
        <meshStandardMaterial color={MC.warmGrey} roughness={0.65} metalness={0.05} />
      </mesh>
    </group>
  )
}

export default CRTModel
