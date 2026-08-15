'use client'

/**
 * WILD lane — the stage the inn stands on: sky, moon, distance, weather, cobbles, and the
 * lighting rig. Everything here is scenery and light; the building's own surfaces belong to the
 * inn implementer and its warm response to lamplight belongs to the atmosphere implementer.
 *
 * TWO DECISIONS WORTH KNOWING BEFORE READING THE CODE
 *
 * 1. NO `scene.fog`. Fog is a renderer-wide switch and this scene shares its renderer with the
 *    desk, the covers and every other spread; a fogged book is a graded book. Distance is sold
 *    instead by a horizon haze card and three drifting mist cards, which are art-directable,
 *    cheaper, and stop at the edge of this spread.
 *
 * 2. THE READING ROOM DIMS AS THE NIGHT ARRIVES. book-scene lights the book for daylight —
 *    ambient #fff3e0 at 0.85 plus a warm key — and a warm 0.85 ambient flattens a moonlit inn
 *    into a grey box, which would cost this candidate the entire asleep/woken value story. The
 *    stage therefore eases the book's own room lights down as `open` runs through REVEAL.night
 *    and restores their authored intensities on unmount. The candle is deliberately left alone:
 *    it is the reader's desk, it should keep burning while the page goes to night.
 */

import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'

import {
  CHIMNEY,
  HALL,
  JETTY,
  MASS_APEX_Y,
  PALETTE,
  REVEAL,
  ROOF,
  STAGE,
  TOWER,
  type Vec3,
} from './inn-model'
import { STAGE_LIFE as LIFE, windDriftAt } from './stage-life'
import { ramp, readWildFrame, useWild } from './wild-frame'

// ---------------------------------------------------------------------------------------------
// STAGE GEOMETRY THE CONTRACT DOES NOT OWN
// ---------------------------------------------------------------------------------------------

/**
 * The courtyard floor: exactly the open spread, so the page is fully dressed and no further.
 *
 * IT IS TWO HALVES, NOT ONE PLANE. The book's pages are not flat — each one tilts up from the
 * spine by however many sheets of paper lie under it, and at this chapter that is one sheet on
 * the left and eight on the right, so the right page climbs about eight times as steeply as the
 * left. A single flat sheet of cobbles laid at STAGE.cobbleY therefore dives under the paper a
 * few centimetres out from the gutter and the chapter's OWN printed art surfaces through it for
 * most of both pages. So the courtyard is hinged at the spine like the pages are, and each half
 * rides its own page's live angle.
 */
const COBBLES = { halfW: 1.15, halfD: 0.75, repeat: [6, 4] as const }

/**
 * How far each half floats above its page, measured square to the paper. The paper also bulges
 * slightly between the rest tilts, so this is a clearance rather than a fit — big enough to
 * survive the bulge, small enough that nothing standing on the cobbles looks stilted.
 */
const COBBLE_LIFT = STAGE.cobbleY

/** The two halves, and which way each one's own texture is shifted so the spread does not
 *  read as one paving pattern printed twice. */
const HALVES = [
  { side: -1, key: 'left', offset: 0.37 },
  { side: 1, key: 'right', offset: 0 },
] as const

/**
 * The seam patch. STAGE.sky is a vertical card at z = -2.6 and it is cut off by the desk plane
 * at the world horizon (about 229 px down a 1600x900 frame at the reading camera); the skyline
 * at z = -1.3 tops out well below that line, so without something between them the distant town
 * would be silhouetted against the reader's DESK rather than against the night. This is that
 * something: a low band of atmosphere standing just behind the skyline, opaque and cool at its
 * base and gone by its top, which reads as the haze every distant town sits in.
 */
const HAZE = { z: -1.34, halfW: 2.6, bottom: -0.06, top: 0.66 }

/** Ground behind the page, filling the gap between the skyline's feet and the book's far edge. */
const FAR_GROUND = { nearZ: -0.72, farZ: -1.7, halfW: 2.6, y: -0.028 }

/** Point the moon light at the middle of the built mass rather than at the origin. */
const INN_FOCUS: Vec3 = [(TOWER.min[0] + JETTY.max[0]) / 2, MASS_APEX_Y * 0.45, -0.3]

/** How far down the book's own room lights are pulled once the night has fully arrived. */
const ROOM_DIM = 0.86

// ---------------------------------------------------------------------------------------------
// PAINTERS — procedural, deterministic, drawn once per mount (D7)
// ---------------------------------------------------------------------------------------------

/** mulberry32: a tiny deterministic PRNG, so a texture looks the same on every machine. */
function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function surface(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('WILD night stage: 2D canvas unavailable for a procedural texture')
  return [canvas, ctx]
}

function toTexture(canvas: HTMLCanvasElement): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  return texture
}

/** Night sky: a cold vertical gradient, the moon's broad glow, and stars that thin at the horizon. */
function paintSky(): THREE.CanvasTexture {
  const W = 512
  const H = 512
  const [canvas, g] = surface(W, H)

  const sky = g.createLinearGradient(0, 0, 0, H)
  sky.addColorStop(0, '#04070f')
  sky.addColorStop(0.42, PALETTE.night)
  sky.addColorStop(0.74, '#141f36')
  sky.addColorStop(0.86, '#1d2b45')
  sky.addColorStop(1, '#1d2b45')
  g.fillStyle = sky
  g.fillRect(0, 0, W, H)

  // Where the moon sits on this card, in the card's own uv.
  const mx = ((STAGE.moon.pos[0] + STAGE.sky.halfW) / (2 * STAGE.sky.halfW)) * W
  const my = (1 - (STAGE.moon.pos[1] - STAGE.sky.bottom) / (STAGE.sky.top - STAGE.sky.bottom)) * H

  const glow = g.createRadialGradient(mx, my, 0, mx, my, W * 0.5)
  glow.addColorStop(0, 'rgba(148,180,224,0.5)')
  glow.addColorStop(0.28, 'rgba(96,128,180,0.18)')
  glow.addColorStop(1, 'rgba(80,110,160,0)')
  g.fillStyle = glow
  g.fillRect(0, 0, W, H)

  const r = rng(0x1a3b5c)
  for (let i = 0; i < 520; i += 1) {
    const x = r() * W
    const y = r() * H
    // Stars fade out toward the horizon and wash out inside the moon's glow.
    const altitude = 1 - y / H
    const fromMoon = Math.min(1, Math.hypot(x - mx, y - my) / (W * 0.34))
    const alpha = r() * 0.6 * altitude * altitude * fromMoon
    if (alpha < 0.03) continue
    g.fillStyle = `rgba(214,230,255,${alpha.toFixed(3)})`
    g.beginPath()
    g.arc(x, y, r() < 0.07 ? 1.7 : 0.85, 0, Math.PI * 2)
    g.fill()
  }

  return toTexture(canvas)
}

/** A soft round falloff, used for the moon's halo and for the mist's own edge fade. */
function paintRadialGlow(inner: string, outer: string): THREE.CanvasTexture {
  const S = 256
  const [canvas, g] = surface(S, S)
  const glow = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2)
  glow.addColorStop(0, inner)
  glow.addColorStop(0.22, inner)
  glow.addColorStop(0.55, outer)
  glow.addColorStop(1, 'rgba(0,0,0,0)')
  g.fillStyle = glow
  g.fillRect(0, 0, S, S)
  return toTexture(canvas)
}

/**
 * Horizon haze: cool and near-solid where it meets the ground, gone by the top of the card, with
 * a slow horizontal wobble so the band is not a ruled line. This is what the distant town is
 * silhouetted against.
 */
function paintHaze(): THREE.CanvasTexture {
  const W = 256
  const H = 256
  const [canvas, g] = surface(W, H)

  const band = g.createLinearGradient(0, 0, 0, H)
  band.addColorStop(0, 'rgba(14,22,38,0)')
  band.addColorStop(0.42, 'rgba(16,26,45,0.4)')
  band.addColorStop(0.78, 'rgba(21,33,54,0.88)')
  band.addColorStop(1, 'rgba(23,36,58,1)')
  g.fillStyle = band
  g.fillRect(0, 0, W, H)

  const r = rng(0x7a1e)
  g.globalCompositeOperation = 'lighter'
  for (let i = 0; i < 26; i += 1) {
    const x = r() * W
    const y = H * (0.55 + r() * 0.45)
    const radius = W * (0.1 + r() * 0.22)
    const blob = g.createRadialGradient(x, y, 0, x, y, radius)
    blob.addColorStop(0, `rgba(48,72,112,${(0.05 + r() * 0.07).toFixed(3)})`)
    blob.addColorStop(1, 'rgba(48,72,112,0)')
    g.fillStyle = blob
    g.beginPath()
    g.arc(x, y, radius, 0, Math.PI * 2)
    g.fill()
  }

  return toTexture(canvas)
}

/**
 * The distant town: pure silhouette, with a scatter of far-off lit windows. The card is ten
 * times wider than it is tall, so the texture is authored at that aspect — a square canvas
 * stretched across it would smear every speck into a dash.
 */
function paintSkyline(): THREE.CanvasTexture {
  const W = 2048
  const H = 192
  const [canvas, g] = surface(W, H)
  const r = rng(0x5c0f21)

  let x = -20
  while (x < W) {
    const w = 30 + r() * 120
    const h = H * (0.2 + r() * 0.74)
    const top = H - h
    g.fillStyle = '#060a13'
    g.fillRect(x, top, w + 1.5, h)

    const roof = r()
    if (roof < 0.3) {
      g.beginPath()
      g.moveTo(x, top)
      g.lineTo(x + w / 2, top - w * 0.3)
      g.lineTo(x + w, top)
      g.closePath()
      g.fill()
    } else if (roof < 0.42) {
      const sx = x + w * (0.25 + r() * 0.5)
      const sh = H * (0.16 + r() * 0.3)
      g.beginPath()
      g.moveTo(sx - 4, top)
      g.lineTo(sx, top - sh)
      g.lineTo(sx + 4, top)
      g.closePath()
      g.fill()
    }

    // A handful of lit rooms, warm and tiny. These are the only warm pixels in the distance.
    const lit = r() < 0.55 ? 1 + Math.floor(r() * 3) : 0
    for (let i = 0; i < lit; i += 1) {
      const px = x + 6 + r() * Math.max(1, w - 14)
      const py = top + 8 + r() * Math.max(1, h - 20)
      if (py > H - 6) continue
      g.fillStyle = `rgba(255,193,120,${(0.3 + r() * 0.55).toFixed(3)})`
      g.fillRect(px, py, 2.6, 3)
    }

    x += w + (r() < 0.22 ? 8 + r() * 24 : 0)
  }

  return toTexture(canvas)
}

/** Mist: soft blobs that tile horizontally, faded to nothing at the card's top and bottom. */
function paintMist(seed: number): THREE.CanvasTexture {
  const W = 1024
  const H = 256
  const [canvas, g] = surface(W, H)
  const r = rng(seed)

  g.globalCompositeOperation = 'lighter'
  for (let i = 0; i < 80; i += 1) {
    const x = r() * W
    const y = H * (0.22 + r() * 0.56)
    const radius = H * (0.3 + r() * 0.62)
    const alpha = 0.05 + r() * 0.1
    // Drawn three times so the blob wraps cleanly across the seam.
    for (const dx of [-W, 0, W]) {
      const blob = g.createRadialGradient(x + dx, y, 0, x + dx, y, radius)
      blob.addColorStop(0, `rgba(255,255,255,${alpha.toFixed(3)})`)
      blob.addColorStop(1, 'rgba(255,255,255,0)')
      g.fillStyle = blob
      g.beginPath()
      g.arc(x + dx, y, radius, 0, Math.PI * 2)
      g.fill()
    }
  }

  g.globalCompositeOperation = 'destination-in'
  const fade = g.createLinearGradient(0, 0, 0, H)
  fade.addColorStop(0, 'rgba(0,0,0,0)')
  fade.addColorStop(0.36, 'rgba(0,0,0,1)')
  fade.addColorStop(0.74, 'rgba(0,0,0,1)')
  fade.addColorStop(1, 'rgba(0,0,0,0)')
  g.fillStyle = fade
  g.fillRect(0, 0, W, H)

  const texture = toTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  return texture
}

/**
 * THE VEIL — thin cloud crossing in front of the moon.
 *
 * The moon is the brightest object in the frame and it was the stillest: a disc, a halo breathing
 * in opacity, and nothing else for as long as the reader looks at it. This card is the one thing
 * on the stage allowed to touch it — high cloud drifting past, dimming the disc a little and
 * catching its light along the way, so the sky reads as weather rather than as a backdrop.
 *
 * It is painted as long horizontal streaks rather than round blobs, because cloud at altitude is
 * sheared by the wind it is riding, and a field of circles reads as smoke.
 */
function paintVeil(): THREE.CanvasTexture {
  const W = 1024
  const H = 256
  const [canvas, g] = surface(W, H)
  const r = rng(0x2c7f)

  g.globalCompositeOperation = 'lighter'
  for (let i = 0; i < 34; i += 1) {
    const x = r() * W
    const y = H * (0.18 + r() * 0.64)
    const rx = W * (0.06 + r() * 0.13)
    const ry = H * (0.05 + r() * 0.12)
    const alpha = 0.05 + r() * 0.09
    // Three copies so a streak straddling the seam comes back on the other side. The gradient is
    // built INSIDE the transform: a gradient is resolved in user space, so one created before the
    // scale would be stretched away from the ellipse it is supposed to fill.
    for (const dx of [-W, 0, W]) {
      g.save()
      g.translate(x + dx, y)
      g.scale(rx, ry)
      const blob = g.createRadialGradient(0, 0, 0, 0, 0, 1)
      blob.addColorStop(0, `rgba(150,178,220,${alpha.toFixed(3)})`)
      blob.addColorStop(1, 'rgba(150,178,220,0)')
      g.fillStyle = blob
      g.beginPath()
      g.arc(0, 0, 1, 0, Math.PI * 2)
      g.fill()
      g.restore()
    }
  }

  // Gone at the top and bottom edges, so the band never shows a hem against the sky.
  g.globalCompositeOperation = 'destination-in'
  const fade = g.createLinearGradient(0, 0, 0, H)
  fade.addColorStop(0, 'rgba(0,0,0,0)')
  fade.addColorStop(0.3, 'rgba(0,0,0,1)')
  fade.addColorStop(0.72, 'rgba(0,0,0,1)')
  fade.addColorStop(1, 'rgba(0,0,0,0)')
  g.fillStyle = fade
  g.fillRect(0, 0, W, H)

  const texture = toTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  return texture
}

/** Cobbles: staggered courses of worn stones with dark joints. Tiles in both axes. */
function paintCobbles(): HTMLCanvasElement {
  const S = 512
  const [canvas, g] = surface(S, S)
  const r = rng(0x0cb6)

  g.fillStyle = '#12161f'
  g.fillRect(0, 0, S, S)

  const cols = 8
  const rows = 8
  const base = [0x24, 0x2b, 0x3a]
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const stagger = (row % 2) * 0.5
      const cx = ((col + stagger + 0.5) / cols) * S + (r() - 0.5) * 7
      const cy = ((row + 0.5) / rows) * S + (r() - 0.5) * 7
      const rx = (S / cols) * 0.47 * (0.8 + r() * 0.34)
      const ry = (S / rows) * 0.45 * (0.8 + r() * 0.34)
      const tilt = (r() - 0.5) * 0.35
      const value = 0.7 + r() * 0.55
      const hi = base.map((c) => Math.min(255, Math.round(c * value) + 18))
      const lo = base.map((c) => Math.max(0, Math.round(c * value) - 11))
      // Nine copies so stones straddling an edge appear on the opposite edge too.
      for (const dx of [-S, 0, S]) {
        for (const dy of [-S, 0, S]) {
          const shade = g.createRadialGradient(
            cx + dx - rx * 0.32,
            cy + dy - ry * 0.42,
            rx * 0.08,
            cx + dx,
            cy + dy,
            rx * 1.06
          )
          shade.addColorStop(0, `rgb(${hi[0]},${hi[1]},${hi[2]})`)
          shade.addColorStop(1, `rgb(${lo[0]},${lo[1]},${lo[2]})`)
          g.fillStyle = shade
          g.beginPath()
          g.ellipse(cx + dx, cy + dy, rx, ry, tilt, 0, Math.PI * 2)
          g.fill()
        }
      }
    }
  }

  // Grit: a light dusting of speckle so the stones do not read as moulded plastic.
  const grit = rng(0x9e11)
  for (let i = 0; i < 2600; i += 1) {
    const x = grit() * S
    const y = grit() * S
    const v = grit()
    g.fillStyle = v < 0.5 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.05)'
    g.fillRect(x, y, 1.4, 1.4)
  }

  return canvas
}

/**
 * One half's paving. Each half is its own texture rather than one shared instance, because the
 * two halves need different offsets: the same tile run printed twice either side of the gutter
 * is the one pattern a reader's eye finds instantly.
 */
function cobbleTexture(canvas: HTMLCanvasElement, offsetU: number): THREE.CanvasTexture {
  const texture = toTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  // Half the width carries half the tiles, so a stone is the same size as it always was.
  texture.repeat.set(COBBLES.repeat[0] / 2, COBBLES.repeat[1])
  texture.offset.x = offsetU
  return texture
}

// ---------------------------------------------------------------------------------------------
// SHADOW FRUSTUM — fitted to the mass, because a loose one wastes the whole map
// ---------------------------------------------------------------------------------------------

const sub3 = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const dot3 = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross3 = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
]
const unit3 = (a: Vec3): Vec3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1
  return [a[0] / l, a[1] / l, a[2] / l]
}

/** The whole built mass, as one box: every consumer of inn-model's volumes, unioned. */
const MASS = {
  min: [
    Math.min(HALL.min[0], JETTY.min[0], TOWER.min[0], ROOF.minX, CHIMNEY.min[0]),
    0,
    Math.min(HALL.min[2], JETTY.min[2], TOWER.min[2], ROOF.backEaveZ, CHIMNEY.min[2]),
  ] as Vec3,
  max: [
    Math.max(HALL.max[0], JETTY.max[0], TOWER.max[0], ROOF.maxX, CHIMNEY.max[0]),
    MASS_APEX_Y,
    Math.max(HALL.max[2], JETTY.max[2], TOWER.max[2], ROOF.frontEaveZ, CHIMNEY.max[2]),
  ] as Vec3,
}

/**
 * Everything the moon's shadow map has to contain: the mass itself, plus where each of its top
 * corners throws a shadow on the courtyard floor. Fitting to the mass alone would clip the cast
 * shadow off at the building's own footprint, which is the one place the shadow is not.
 */
function shadowVolumePoints(lightDirection: Vec3): Vec3[] {
  const points: Vec3[] = []
  for (const x of [MASS.min[0], MASS.max[0]]) {
    for (const y of [MASS.min[1], MASS.max[1]]) {
      for (const z of [MASS.min[2], MASS.max[2]]) {
        const corner: Vec3 = [x, y, z]
        points.push(corner)
        if (y <= STAGE.cobbleY || lightDirection[1] >= -1e-3) continue
        const t = (STAGE.cobbleY - y) / lightDirection[1]
        points.push([
          x + lightDirection[0] * t,
          STAGE.cobbleY,
          z + lightDirection[2] * t,
        ])
      }
    }
  }
  return points
}

/** Tight orthographic bounds, in the light's own space, around those points. */
function fitShadowCamera(lightPos: Vec3, targetPos: Vec3) {
  const back = unit3(sub3(lightPos, targetPos))
  const worldUp: Vec3 = Math.abs(back[1]) > 0.999 ? [0, 0, 1] : [0, 1, 0]
  const right = unit3(cross3(worldUp, back))
  const up = cross3(back, right)
  const direction = unit3(sub3(targetPos, lightPos))

  let left = Infinity
  let rightEdge = -Infinity
  let bottom = Infinity
  let top = -Infinity
  let near = Infinity
  let far = -Infinity

  for (const p of shadowVolumePoints(direction)) {
    const rel = sub3(p, lightPos)
    const x = dot3(rel, right)
    const y = dot3(rel, up)
    const depth = -dot3(rel, back)
    left = Math.min(left, x)
    rightEdge = Math.max(rightEdge, x)
    bottom = Math.min(bottom, y)
    top = Math.max(top, y)
    near = Math.min(near, depth)
    far = Math.max(far, depth)
  }

  const pad = 0.04
  return {
    left: left - pad,
    right: rightEdge + pad,
    bottom: bottom - pad,
    top: top + pad,
    near: Math.max(0.02, near - pad),
    far: far + pad,
  }
}

const MOON_SHADOW = fitShadowCamera(STAGE.moon.pos, INN_FOCUS)

// ---------------------------------------------------------------------------------------------
// THE READING ROOM'S OWN LIGHTS
// ---------------------------------------------------------------------------------------------

type RoomLight = { light: THREE.Light; authored: number }

/**
 * Collects the book's ambient and key lights so the night can pull them down, and puts their
 * authored intensities back the moment this spread lets go. Point lights are skipped on purpose:
 * the only one is the desk candle, it animates its own intensity every frame, and it should keep
 * burning through the night anyway.
 */
function useRoomLights(scene: THREE.Scene) {
  const collected = useRef<RoomLight[]>([])

  useEffect(() => {
    const found: RoomLight[] = []
    scene.traverse((object) => {
      const light = object as THREE.Light
      if (!light.isLight) return
      if (light.userData.wildStage === true) return
      if ((light as THREE.PointLight).isPointLight) return
      found.push({ light, authored: light.intensity })
    })
    collected.current = found
    return () => {
      for (const entry of found) entry.light.intensity = entry.authored
      collected.current = []
    }
  }, [scene])

  return collected
}

// ---------------------------------------------------------------------------------------------

type NightArt = {
  sky: THREE.CanvasTexture
  halo: THREE.CanvasTexture
  haze: THREE.CanvasTexture
  skyline: THREE.CanvasTexture
  veil: THREE.CanvasTexture
  mist: THREE.CanvasTexture[]
  cobbles: THREE.CanvasTexture[]
}

let artCache: NightArt | null = null

/** The stage's painted textures, once per session (idle-warmed via wild/warmup) — never
 *  disposed, so paging away and back reuses them instead of repainting on the turn. */
export function nightArt(): NightArt {
  if (!artCache) {
    const paving = paintCobbles()
    artCache = {
      sky: paintSky(),
      halo: paintRadialGlow('rgba(196,218,255,0.85)', 'rgba(120,158,214,0.22)'),
      haze: paintHaze(),
      skyline: paintSkyline(),
      veil: paintVeil(),
      mist: STAGE.mist.map((_, i) => paintMist(0x4d15 + i * 977)),
      cobbles: HALVES.map((half) => cobbleTexture(paving, half.offset)),
    }
  }
  return artCache
}

export function NightStage() {
  const wild = useWild()
  const scene = useThree((s) => s.scene)
  const roomLights = useRoomLights(scene)

  const art = nightArt()

  const moonTarget = useMemo(() => {
    const object = new THREE.Object3D()
    object.position.set(INN_FOCUS[0], INN_FOCUS[1], INN_FOCUS[2])
    return object
  }, [])

  const moonRef = useRef<THREE.DirectionalLight>(null)
  const fillRef = useRef<THREE.DirectionalLight>(null)
  const ambientRef = useRef<THREE.AmbientLight>(null)
  const skyRef = useRef<THREE.Mesh>(null)
  const moonGroupRef = useRef<THREE.Group>(null)
  const haloRef = useRef<THREE.Mesh>(null)
  const skylineRef = useRef<THREE.Mesh>(null)
  const veilRef = useRef<THREE.Mesh>(null)
  const hazeRef = useRef<THREE.Mesh>(null)
  const farGroundRef = useRef<THREE.Mesh>(null)
  /** One hinge group and one paving mesh per page half. */
  const cobbleHingeRefs = useRef<(THREE.Group | null)[]>([])
  const cobbleRefs = useRef<(THREE.Mesh | null)[]>([])
  const mistRefs = useRef<(THREE.Mesh | null)[]>([])

  // The moon is the book's only shadow caster, and its frustum is fitted to the mass rather
  // than guessed: a 1024 map spread over a loose box is a 1024 map spent on empty courtyard.
  useEffect(() => {
    const moon = moonRef.current
    if (!moon) return
    moon.target = moonTarget
    moonTarget.updateMatrixWorld()
    const camera = moon.shadow.camera
    camera.left = MOON_SHADOW.left
    camera.right = MOON_SHADOW.right
    camera.top = MOON_SHADOW.top
    camera.bottom = MOON_SHADOW.bottom
    camera.near = MOON_SHADOW.near
    camera.far = MOON_SHADOW.far
    camera.updateProjectionMatrix()
    moon.shadow.mapSize.set(1024, 1024)
    moon.shadow.bias = -0.0006
    moon.shadow.normalBias = 0.014
    moon.shadow.needsUpdate = true
  }, [moonTarget])

  const opacityOf = (mesh: THREE.Mesh | null, value: number) => {
    if (!mesh) return
    const material = mesh.material as THREE.Material
    material.opacity = value
    mesh.visible = value > 0.004
  }

  useFrame(() => {
    const { open, time, thetaL, thetaR, wake } = readWildFrame(wild)

    // THE NIGHT ARRIVES (REVEAL.night). Eased out, not linear: the dark floods in and then
    // settles, which is how a room reads when the lamps go down rather than a cross-fade.
    const night = ramp(open, REVEAL.night[0], REVEAL.night[1])
    const arrived = 1 - (1 - night) ** 2

    // THE COURTYARD RESOLVES (REVEAL.courtyard), later and slower — the cobbles come up out of
    // the paper after the sky already owns the frame.
    const courtyard = ramp(open, REVEAL.courtyard[0], REVEAL.courtyard[1])
    const paved = 1 - (1 - courtyard) ** 3

    // Weather is the last thing to start, with the rest of the dressing.
    const weather = ramp(open, REVEAL.dressing[0], REVEAL.dressing[1])

    // The reading room dims as the night takes the page.
    for (const entry of roomLights.current) {
      entry.light.intensity = entry.authored * (1 - ROOM_DIM * arrived)
    }

    const moon = moonRef.current
    if (moon) moon.intensity = STAGE.moonlight.intensity * arrived

    // The bounce fill arrives with the night and yields to the lamps as the inn wakes.
    const fill = fillRef.current
    if (fill) fill.intensity = STAGE.fill.intensity * arrived * (1 - STAGE.fill.wakeCut * wake)

    const ambient = ambientRef.current
    if (ambient) ambient.intensity = STAGE.ambient.intensity * arrived

    opacityOf(skyRef.current, arrived)
    opacityOf(hazeRef.current, arrived * 0.92)
    opacityOf(farGroundRef.current, arrived)

    // The moon does not fade alone — it settles: the halo breathes open from a touch under full
    // size, so the brightest object in the frame arrives rather than appears.
    const moonGroup = moonGroupRef.current
    if (moonGroup) {
      const settle = 0.9 + 0.1 * arrived
      moonGroup.scale.setScalar(settle)
      // The disc itself has no opacity ramp (its over-1 colour is the point), and this tree is
      // never visibility-gated as a whole — so the moon must gate itself or it hangs over the
      // title page. A mesh-group flip is safe; only LIGHT visibility re-links programs.
      moonGroup.visible = arrived > 0.004
    }
    // The halo breathes in SIZE as well as in brightness, on a period long enough (STAGE_LIFE)
    // that a reader never catches it moving — they only notice, two looks apart, that it has.
    const halo = haloRef.current
    if (halo) {
      const breath = 1 + LIFE.moon.haloBreath * Math.sin((Math.PI * 2 * time) / LIFE.moon.haloPeriod)
      halo.scale.setScalar(breath)
    }
    opacityOf(halo, arrived * (0.82 + 0.06 * Math.sin(time * 0.31)))

    // THE VEIL crosses the disc: a slow crawl plus a slower swell, so the moon is sometimes bare
    // and sometimes behind cloud. It fades with the night like everything else on this card.
    const veil = veilRef.current
    if (veil) {
      const material = veil.material as THREE.MeshBasicMaterial
      if (material.map) material.map.offset.x = (time * LIFE.moon.veilDrift) % 1
      const swell = 1 - LIFE.moon.veilBreath * (0.5 + 0.5 * Math.sin((Math.PI * 2 * time) / LIFE.moon.veilPeriod))
      opacityOf(veil, arrived * LIFE.moon.veilOpacity * swell)
    }

    // The distant roofline rises the last few millimetres into place as it fades up, so the
    // horizon reads as something coming into focus instead of a decal turning on.
    const skyline = skylineRef.current
    if (skyline) {
      skyline.position.y = STAGE.skyline.maxY / 2 - (1 - arrived) * 0.05
      opacityOf(skyline, arrived)
    }

    // THE COURTYARD CONFORMS TO THE PAGE. Each half swings on the spine to its own page's live
    // angle: a page runs from the spine along [cos theta, sin theta], so the right half turns by
    // thetaR and the left — whose theta is measured back from PI — by thetaL - PI. Both are read
    // fresh every frame, so the paving follows a page that is being turned instead of tearing
    // off it. The lift is applied inside the hinge, which makes it a clearance measured square
    // to the paper rather than a height above a flat floor that no longer exists.
    cobbleHingeRefs.current[0]?.rotation.set(0, 0, thetaL - Math.PI)
    cobbleHingeRefs.current[1]?.rotation.set(0, 0, thetaR)

    // Fade up, and settle the last hair down onto the paper as they resolve.
    for (const cobbles of cobbleRefs.current) {
      if (!cobbles) continue
      const material = cobbles.material as THREE.MeshStandardMaterial
      material.opacity = paved
      material.transparent = paved < 0.995
      cobbles.position.y = COBBLE_LIFT + (1 - paved) * 0.012
      cobbles.visible = paved > 0.004
    }

    // Mist drifts horizontally off the shared clock. The texture scrolls rather than the card,
    // so the drift never runs out of card and never has to snap back.
    STAGE.mist.forEach((band, i) => {
      const mesh = mistRefs.current[i]
      if (!mesh) return
      const material = mesh.material as THREE.MeshBasicMaterial
      const map = material.map
      // Carried by the gusts as well as by its own authored drift: `windDriftAt` is the breeze's
      // bounded running displacement, so a swell shoves the mist along and the lull lets it back
      // without anything ever integrating a delta.
      if (map) map.offset.x = (time * band.speed + LIFE.mist.carry * windDriftAt(time)) % 1
      opacityOf(mesh, band.opacity * weather)
    })
  })

  return (
    <group name="wild-night-stage">
      {/* Cool fill. The moon rims the mass from behind; this is the only thing keeping the
          faces we actually see off pure black while the inn sleeps. Intensity rides `arrived`
          (see the useFrame): this tree is never visibility-gated, so a constant ambient would
          leak the diorama's cool wash over every other spread. */}
      <ambientLight
        ref={ambientRef}
        color={STAGE.ambient.color}
        intensity={0}
        userData={{ wildStage: true }}
      />
      <directionalLight
        ref={moonRef}
        position={STAGE.moon.pos}
        color={STAGE.moonlight.color}
        intensity={0}
        castShadow
        userData={{ wildStage: true }}
      />
      {/* Moonlight bounce — see STAGE.fill. No shadow: it is scattered light, not a source. */}
      <directionalLight
        ref={fillRef}
        position={STAGE.fill.pos}
        color={STAGE.fill.color}
        intensity={0}
        target={moonTarget}
        userData={{ wildStage: true }}
      />
      <primitive object={moonTarget} />

      {/* SKY — not clipped by RISE_CLIP. Sky does not rise out of the paper. */}
      <mesh
        ref={skyRef}
        position={[0, (STAGE.sky.top + STAGE.sky.bottom) / 2, STAGE.sky.z]}
        renderOrder={-30}
      >
        <planeGeometry args={[STAGE.sky.halfW * 2, STAGE.sky.top - STAGE.sky.bottom]} />
        <meshBasicMaterial map={art.sky} transparent opacity={0} depthWrite={false} />
      </mesh>

      {/* MOON — a hot disc over its own halo. The disc's colour is deliberately above 1 in
          linear space so it clears the bloom threshold and ACES rolls it off to white; that is
          what makes it a light source in the frame rather than a pale circle. */}
      <group ref={moonGroupRef} position={STAGE.moon.pos} visible={false}>
        <mesh ref={haloRef} position={[0, 0, -0.02]} renderOrder={-29}>
          <planeGeometry args={[STAGE.moon.haloRadius * 2, STAGE.moon.haloRadius * 2]} />
          <meshBasicMaterial
            map={art.halo}
            transparent
            opacity={0}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            color="#8fb4e8"
          />
        </mesh>
        <mesh renderOrder={-28}>
          <circleGeometry args={[STAGE.moon.radius, 48]} />
          <meshBasicMaterial color={new THREE.Color().setRGB(2.4, 2.6, 2.95)} depthWrite={false} />
        </mesh>
      </group>

      {/* THE VEIL — high cloud crossing the moon. It stands between the disc (z -2.1) and the
          horizon haze (z -1.34), and its renderOrder puts it there in the transparent stack too:
          after the moon it dims, before the haze that stands in front of both. */}
      <mesh
        ref={veilRef}
        position={[0, (LIFE.moon.veilTop + LIFE.moon.veilBottom) / 2, LIFE.moon.veilZ]}
        renderOrder={-27.5}
      >
        <planeGeometry
          args={[LIFE.moon.veilHalfW * 2, LIFE.moon.veilTop - LIFE.moon.veilBottom]}
        />
        <meshBasicMaterial map={art.veil} transparent opacity={0} depthWrite={false} />
      </mesh>

      {/* HORIZON HAZE — the band the distant town is silhouetted against. */}
      <mesh
        ref={hazeRef}
        position={[0, (HAZE.top + HAZE.bottom) / 2, HAZE.z]}
        renderOrder={-27}
      >
        <planeGeometry args={[HAZE.halfW * 2, HAZE.top - HAZE.bottom]} />
        <meshBasicMaterial map={art.haze} transparent opacity={0} depthWrite={false} />
      </mesh>

      {/* DISTANT TOWN — silhouette plus far-off lit specks. Also unclipped: it is horizon. */}
      <mesh ref={skylineRef} position={[0, STAGE.skyline.maxY / 2, STAGE.skyline.z]} renderOrder={-26}>
        <planeGeometry
          args={[STAGE.skyline.maxX - STAGE.skyline.minX, STAGE.skyline.maxY]}
        />
        <meshBasicMaterial map={art.skyline} transparent opacity={0} depthWrite={false} />
      </mesh>

      {/* Ground beyond the page, so the town stands on night rather than on the reader's desk. */}
      <mesh
        ref={farGroundRef}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, FAR_GROUND.y, (FAR_GROUND.nearZ + FAR_GROUND.farZ) / 2]}
        renderOrder={-25}
      >
        <planeGeometry args={[FAR_GROUND.halfW * 2, FAR_GROUND.nearZ - FAR_GROUND.farZ]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} color="#0c1220" />
      </mesh>

      {/* THE COURTYARD. The one surface that takes the moon's shadow — and the only one that
          has to lie ON the paper, so it is hinged at the spine exactly as the pages are. The
          two halves meet along the gutter with a hair of overlap rather than a seam. */}
      {HALVES.map((half, i) => (
        <group
          key={half.key}
          ref={(group) => {
            cobbleHingeRefs.current[i] = group
          }}
        >
          <mesh
            ref={(mesh) => {
              cobbleRefs.current[i] = mesh
            }}
            rotation={[-Math.PI / 2, 0, 0]}
            position={[(half.side * COBBLES.halfW) / 2, COBBLE_LIFT, 0]}
            receiveShadow
            renderOrder={-24}
          >
            <planeGeometry args={[COBBLES.halfW, COBBLES.halfD * 2]} />
            <meshStandardMaterial
              map={art.cobbles[i]}
              roughness={0.88}
              metalness={0}
              transparent
              opacity={0}
            />
          </mesh>
        </group>
      ))}

      {/* MIST. Cool, always — its warm answer to lamplight belongs to the atmosphere lane. */}
      {STAGE.mist.map((band, i) => (
        <mesh
          key={`mist-${band.z}`}
          ref={(mesh) => {
            mistRefs.current[i] = mesh
          }}
          position={[0, band.y, band.z]}
          renderOrder={band.z > 0 ? 6 : -20 + i}
        >
          <planeGeometry args={[band.halfW * 2, band.height]} />
          <meshBasicMaterial
            map={art.mist[i]}
            transparent
            opacity={0}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            color="#41618f"
          />
        </mesh>
      ))}
    </group>
  )
}
