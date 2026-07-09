'use client'

/**
 * CardModel — a save-slot memory card shot like a product on a seamless.
 *
 * A rounded, semi-gloss plastic shell (clearcoat so the studio rim light
 * skates along the bevels) carries a crisp printed paper label: an accent
 * header band with the slot number, a big grotesque title, mono company/year
 * rows, and a small stroked button glyph. It tilts toward a target each frame
 * and springs a half-turn to reveal a metrics label on the back.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { MC, GLYPH_PATHS, type GlyphName } from '../tokens'
import { grotesk, monoFamily } from '../fonts'

const CARD_W = 2.2
const CARD_H = 2.9
const CARD_D = 0.28
const LABEL_W = 1.9
const LABEL_H = 2.3
const TEX_W = 512
const TEX_H = 620
const PLACE_Y = 1.42 // float height so the contact shadow reads beneath it

export type CardLabel = {
  title: string
  company: string
  year: string
  slot: string
  accent: string
}

/** Which button glyph matches an accent hex (falls back to triangle). */
function glyphForAccent(accent: string): GlyphName {
  const hit = (Object.keys(MC.glyphs) as GlyphName[]).find(
    (n) => MC.glyphs[n].toLowerCase() === accent.toLowerCase()
  )
  return hit ?? 'triangle'
}

function roundRect(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  g.beginPath()
  g.moveTo(x + r, y)
  g.arcTo(x + w, y, x + w, y + h, r)
  g.arcTo(x + w, y + h, x, y + h, r)
  g.arcTo(x, y + h, x, y, r)
  g.arcTo(x, y, x + w, y, r)
  g.closePath()
}

function wrapCaps(
  g: CanvasRenderingContext2D,
  text: string,
  maxW: number,
  maxLines: number
): string[] {
  const words = text.toUpperCase().split(/\s+/)
  const lines: string[] = []
  let line = ''
  for (const w of words) {
    const next = line ? `${line} ${w}` : w
    if (g.measureText(next).width > maxW && line) {
      lines.push(line)
      line = w
      if (lines.length === maxLines) break
    } else {
      line = next
    }
  }
  if (lines.length < maxLines && line) lines.push(line)
  return lines
}

function strokeGlyph(
  g: CanvasRenderingContext2D,
  glyph: GlyphName,
  x: number,
  y: number,
  size: number,
  color: string
) {
  const scale = size / 24
  g.save()
  g.translate(x, y)
  g.scale(scale, scale)
  g.strokeStyle = color
  g.lineWidth = 2.4
  g.lineJoin = 'round'
  g.lineCap = 'round'
  g.stroke(new Path2D(GLYPH_PATHS[glyph]))
  g.restore()
}

function drawFrame(g: CanvasRenderingContext2D) {
  // paper field with a faint printed sheen
  const grad = g.createLinearGradient(0, 0, 0, TEX_H)
  grad.addColorStop(0, '#f2f0ea')
  grad.addColorStop(1, MC.paper)
  g.fillStyle = grad
  g.fillRect(0, 0, TEX_W, TEX_H)
  // 1px inner border, ink at 0.15
  g.strokeStyle = 'rgba(16,16,20,0.15)'
  g.lineWidth = 2
  roundRect(g, 14, 14, TEX_W - 28, TEX_H - 28, 10)
  g.stroke()
}

function drawHeader(
  g: CanvasRenderingContext2D,
  slot: string,
  accent: string,
  monoFont: string
) {
  g.fillStyle = accent
  g.fillRect(28, 28, TEX_W - 56, 88)
  g.fillStyle = '#f6f5f1'
  g.font = `600 30px ${monoFont}`
  g.textBaseline = 'middle'
  g.textAlign = 'left'
  g.fillText(`SLOT ${slot}`, 48, 74)
  g.textAlign = 'right'
  g.font = `600 22px ${monoFont}`
  g.fillText('MEMORY CARD', TEX_W - 48, 74)
}

/** Front label: header + big title + company/year + a stroked glyph. */
function makeFrontTexture(label: CardLabel, titleFont: string): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = TEX_W
  c.height = TEX_H
  const g = c.getContext('2d')!
  const glyph = glyphForAccent(label.accent)
  drawFrame(g)
  drawHeader(g, label.slot, label.accent, monoFamily)

  // Title — big grotesque caps, wrapped
  g.fillStyle = MC.ink
  g.textAlign = 'left'
  g.textBaseline = 'alphabetic'
  g.font = `700 64px ${titleFont}`
  const lines = wrapCaps(g, label.title, TEX_W - 96, 3)
  let ty = 220
  for (const line of lines) {
    g.fillText(line, 48, ty)
    ty += 70
  }

  // Company + year rows, mono
  g.fillStyle = 'rgba(16,16,20,0.72)'
  g.font = `500 28px ${monoFamily}`
  g.fillText(label.company.toUpperCase(), 48, TEX_H - 150)
  g.fillStyle = label.accent
  g.fillText(label.year.toUpperCase(), 48, TEX_H - 108)

  // Stroked button glyph, bottom-right
  strokeGlyph(g, glyph, TEX_W - 118, TEX_H - 128, 64, label.accent)

  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  return tex
}

/** Back label: header + a mono metrics list (backLines). */
function makeBackTexture(label: CardLabel, backLines: string[]): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = TEX_W
  c.height = TEX_H
  const g = c.getContext('2d')!
  const glyph = glyphForAccent(label.accent)
  drawFrame(g)
  drawHeader(g, label.slot, label.accent, monoFamily)

  g.fillStyle = MC.ink
  g.textAlign = 'left'
  g.textBaseline = 'alphabetic'
  g.font = `600 26px ${monoFamily}`
  g.fillText('SAVE DATA', 48, 190)
  g.strokeStyle = 'rgba(16,16,20,0.18)'
  g.lineWidth = 2
  g.beginPath()
  g.moveTo(48, 210)
  g.lineTo(TEX_W - 48, 210)
  g.stroke()

  g.font = `500 24px ${monoFamily}`
  let by = 264
  for (const line of backLines.slice(0, 6)) {
    g.fillStyle = label.accent
    g.fillText('›', 48, by)
    g.fillStyle = 'rgba(16,16,20,0.82)'
    g.fillText(line.toUpperCase(), 80, by)
    by += 46
  }

  strokeGlyph(g, glyph, TEX_W - 118, TEX_H - 128, 64, label.accent)

  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  return tex
}

export type CardModelProps = {
  label: CardLabel
  tilt?: { x: number; y: number }
  flipped?: boolean
  backLines?: string[]
}

export function CardModel({
  label,
  tilt = { x: 0, y: 0 },
  flipped = false,
  backLines = [],
}: CardModelProps) {
  const pivot = useRef<THREE.Group>(null)
  const [fontsReady, setFontsReady] = useState(false)

  useEffect(() => {
    let alive = true
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts
    if (fonts?.ready) fonts.ready.then(() => alive && setFontsReady(true))
    else setFontsReady(true)
    return () => {
      alive = false
    }
  }, [])

  const shell = useMemo(
    () => new RoundedBoxGeometry(CARD_W, CARD_H, CARD_D, 5, 0.09),
    []
  )
  useEffect(() => () => shell.dispose(), [shell])

  const titleFont = grotesk.style.fontFamily
  const frontTex = useMemo(
    () => makeFrontTexture(label, titleFont),
    // fontsReady forces a redraw once the webfont is available
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [label, titleFont, fontsReady]
  )
  useEffect(() => () => frontTex.dispose(), [frontTex])

  const backTex = useMemo(
    () => makeBackTexture(label, backLines),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [label, backLines, fontsReady]
  )
  useEffect(() => () => backTex.dispose(), [backTex])

  const grooveMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(MC.shell).multiplyScalar(0.6),
        roughness: 0.5,
        metalness: 0.1,
      }),
    []
  )
  useEffect(() => () => grooveMat.dispose(), [grooveMat])

  useFrame((_, dt) => {
    const p = pivot.current
    if (!p) return
    const k = Math.min(1, dt * 8)
    const targetY = (flipped ? Math.PI : 0) + tilt.y
    p.rotation.y += (targetY - p.rotation.y) * k
    p.rotation.x += (tilt.x - p.rotation.x) * k
  })

  return (
    <group position={[0, PLACE_Y, 0]}>
      <group ref={pivot}>
        {/* Shell */}
        <mesh geometry={shell}>
          <meshPhysicalMaterial
            color={MC.shell}
            roughness={0.34}
            metalness={0.1}
            clearcoat={0.6}
            clearcoatRoughness={0.3}
          />
        </mesh>

        {/* Three connector grooves across the top edge */}
        {[-0.6, 0, 0.6].map((x) => (
          <mesh
            key={x}
            position={[x, CARD_H / 2 - 0.02, 0]}
            material={grooveMat}
          >
            <boxGeometry args={[0.5, 0.1, 0.3]} />
          </mesh>
        ))}

        {/* Front label */}
        <mesh position={[0, 0, CARD_D / 2 + 0.005]}>
          <planeGeometry args={[LABEL_W, LABEL_H]} />
          <meshStandardMaterial map={frontTex} roughness={0.55} metalness={0} />
        </mesh>

        {/* Back label (faces −z, revealed on flip) */}
        <mesh position={[0, 0, -(CARD_D / 2 + 0.005)]} rotation={[0, Math.PI, 0]}>
          <planeGeometry args={[LABEL_W, LABEL_H]} />
          <meshStandardMaterial map={backTex} roughness={0.55} metalness={0} />
        </mesh>
      </group>
    </group>
  )
}

export default CardModel
