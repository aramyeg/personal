/**
 * Shell-wear texture — the deterministic "this card was owned and handled" layer.
 *
 * Real PS1 memory cards were a junk-drawer of distinct objects: scuffed corners,
 * a hairline scratch across the shell, the ghost of a peeled-off label still
 * stuck to the plastic. `makeShellWearTexture` turns a pure `WearProfile` (from
 * `save-visuals.ts`, seeded per save — never Math.random) into a subtle
 * CanvasTexture floated over the shell around the label recess: light corner
 * scuffs, an optional hairline scratch, and — on the cards the profile marks —
 * the darker rectangle-ghost of an old sticker. Kept faint on purpose:
 * zoom-legible, never dirty.
 */

import * as THREE from 'three'
import { paperAlpha, inkAlpha } from '../tokens'
import type { WearProfile } from './save-visuals'

/** The four corners of the wear canvas, indexed to match `scuffCorner`. */
const CORNERS: ReadonlyArray<readonly [number, number]> = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1],
]

/**
 * Shell-wear texture: a mostly-transparent overlay drawn once, floated on a quad
 * over the plastic around the label recess. Marks are token-coloured (worn
 * plastic = light paperAlpha highlights; grime + adhesive residue = dark
 * inkAlpha) and kept low-alpha so they read as handling, not dirt.
 */
export function makeShellWearTexture(profile: WearProfile, size = 512): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const g = canvas.getContext('2d')!
  const { grime, scuffCorner, scratchAngle, hasScratch, hasResidue } = profile

  // Faint grime creep in from all four edges (a soft inset vignette).
  const inset = size * 0.5
  const edge = g.createRadialGradient(
    size / 2,
    size / 2,
    inset * 0.62,
    size / 2,
    size / 2,
    inset * 1.18
  )
  edge.addColorStop(0, inkAlpha(0))
  edge.addColorStop(1, inkAlpha(0.14 * grime))
  g.fillStyle = edge
  g.fillRect(0, 0, size, size)

  // Sticker-residue ghost — a slightly-off rectangle of old adhesive, drawn
  // before the scuffs so a corner scuff can sit over its edge.
  if (hasResidue) {
    const gw = size * 0.62
    const gh = size * 0.4
    const gx = size * 0.19 + (size * 0.04)
    const gy = size * 0.34
    g.save()
    g.translate(gx + gw / 2, gy + gh / 2)
    g.rotate(0.02)
    g.fillStyle = inkAlpha(0.09)
    g.fillRect(-gw / 2, -gh / 2, gw, gh)
    // Torn-off highlight along the top edge where paper lifted.
    g.fillStyle = paperAlpha(0.16)
    g.fillRect(-gw / 2, -gh / 2, gw, size * 0.012)
    g.restore()
  }

  // Heaviest corner scuff — a soft light bloom of worn plastic at one corner.
  const [cx, cy] = CORNERS[scuffCorner]
  const scuff = g.createRadialGradient(
    cx * size,
    cy * size,
    0,
    cx * size,
    cy * size,
    size * 0.34
  )
  scuff.addColorStop(0, paperAlpha(0.22 * grime))
  scuff.addColorStop(1, paperAlpha(0))
  g.fillStyle = scuff
  g.fillRect(0, 0, size, size)

  // A lighter secondary scuff on the diagonally-opposite corner.
  const [ox, oy] = CORNERS[(scuffCorner + 2) % 4]
  const scuff2 = g.createRadialGradient(
    ox * size,
    oy * size,
    0,
    ox * size,
    oy * size,
    size * 0.26
  )
  scuff2.addColorStop(0, paperAlpha(0.12 * grime))
  scuff2.addColorStop(1, paperAlpha(0))
  g.fillStyle = scuff2
  g.fillRect(0, 0, size, size)

  // Optional hairline scratch across the shell.
  if (hasScratch) {
    g.save()
    g.translate(size / 2, size / 2)
    g.rotate(scratchAngle)
    g.strokeStyle = paperAlpha(0.2 * grime)
    g.lineWidth = size * 0.004
    g.lineCap = 'round'
    g.beginPath()
    g.moveTo(-size * 0.4, size * 0.06)
    g.lineTo(size * 0.42, -size * 0.04)
    g.stroke()
    g.restore()
  }

  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.generateMipmaps = false
  tex.minFilter = THREE.LinearFilter
  tex.anisotropy = 4
  return tex
}
