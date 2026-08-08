'use client'
import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { PALETTE } from '../../palette'
import { studioLightsFor } from '../desk-studio'
import {
  SIGN_TUBE_R,
  SIGN_WORDS,
  SIGN_XHEIGHT,
  flickerAt,
  signPointsWorld,
  wordBounds,
  wordPointsWorld,
  sampleStroke,
} from '../neon-sign'
import type { JourneyRef } from '../use-journey'
import { usePrefersReducedMotion } from '../use-reduced-motion'

/**
 * THE "LET'S CREATE" NEON, as it reaches the screen. `scene/neon-sign.ts` carries the design,
 * the letterforms, the placement solve and the strike envelope; this file only bends the tubes
 * and holds two materials' opacity to the envelope.
 *
 * TWO DRAWS, ZERO WIRE. The tube is every stroke of both words merged into ONE geometry built
 * at mount from the module's own sampled polylines (no asset, no fetch); the halo is ONE
 * additive quad pair sharing a canvas painted once at mount. Both are `visible: false`
 * whenever the envelope is 0 — which is the entire journey and the whole still beat — so the
 * sign costs nothing and can leak nothing before the studio lights come up.
 *
 * WHY THE GLOW CANNOT RE-LIGHT THE SCENE. The tube is MeshBasicMaterial: unlit, tone-map
 * exempt, reads from no light and writes to none. The halo is an additive billboard whose
 * texture is painted at mount. Neither is a THREE light; the T90 bake and the studio blend
 * never see them. The one thing a real neon would add — a warm pool on the cyc — is
 * deliberately absent (the cyc's wash is an approved picture; see the module header).
 */

/** Halo texture: painted once at mount, both words on one canvas — no ctx.filter (Safari
 *  guarantees), just widening soft passes of the room's rose. */
const HALO_CANVAS_W = 1024
const HALO_CANVAS_H = 320
/** World-unit pad around each word's bbox for the glow to breathe into. */
const HALO_PAD = 0.55
/** The halo's peak opacity — the tube stays the bright thing. */
const HALO_MAX = 0.6

function paintHalo(canvas: HTMLCanvasElement | OffscreenCanvas): void {
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D
  ctx.clearRect(0, 0, HALO_CANVAS_W, HALO_CANVAS_H)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  // two atlas cells, one per word, sized by each word's padded bbox
  SIGN_WORDS.forEach((word, i) => {
    const b = wordBounds(word.strokes)
    const wW = (b.maxX - b.minX) * SIGN_XHEIGHT + 2 * HALO_PAD
    const wH = (b.maxY - b.minY) * SIGN_XHEIGHT + 2 * HALO_PAD
    const cell = atlasCell(i)
    // uniform world→px scale, centred in the cell
    const s = Math.min((cell.w - 8) / wW, (HALO_CANVAS_H - 8) / wH)
    const ox = cell.x + cell.w / 2 - (wW / 2) * s
    const oy = HALO_CANVAS_H / 2 + (wH / 2) * s
    const px = (lx: number) => ox + (lx * SIGN_XHEIGHT - b.minX * SIGN_XHEIGHT + HALO_PAD) * s
    const py = (ly: number) => oy - (ly * SIGN_XHEIGHT - b.minY * SIGN_XHEIGHT + HALO_PAD) * s
    // widening passes: far corona → near glow (the tube mesh itself is the core)
    const passes: [number, number][] = [
      [SIGN_TUBE_R * 11 * s, 0.05],
      [SIGN_TUBE_R * 7 * s, 0.1],
      [SIGN_TUBE_R * 4.5 * s, 0.16],
      [SIGN_TUBE_R * 3 * s, 0.24],
    ]
    for (const [width, alpha] of passes) {
      ctx.strokeStyle = PALETTE.neonRose
      ctx.globalAlpha = alpha
      ctx.lineWidth = width
      for (const stroke of word.strokes) {
        const pts = sampleStroke(stroke)
        ctx.beginPath()
        pts.forEach(([x, y], k) => (k ? ctx.lineTo(px(x), py(y)) : ctx.moveTo(px(x), py(y))))
        ctx.stroke()
      }
    }
  })
  ctx.globalAlpha = 1
}

const atlasCell = (i: number): { x: number; w: number } =>
  i === 0 ? { x: 0, w: HALO_CANVAS_W * 0.42 } : { x: HALO_CANVAS_W * 0.42, w: HALO_CANVAS_W * 0.58 }

/** All strokes of both words as ONE merged tube geometry, world-space baked. */
export function buildNeonTube(): THREE.BufferGeometry {
  const positions: number[] = []
  const normals: number[] = []
  for (const stroke of signPointsWorld()) {
    const curve = new THREE.CatmullRomCurve3(
      stroke.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
      false,
      'catmullrom',
      0
    )
    const tube = new THREE.TubeGeometry(curve, Math.max(8, stroke.length - 1), SIGN_TUBE_R, 6, false)
    const nonIndexed = tube.toNonIndexed()
    positions.push(...Array.from(nonIndexed.getAttribute('position').array))
    normals.push(...Array.from(nonIndexed.getAttribute('normal').array))
    tube.dispose()
    nonIndexed.dispose()
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  return geo
}

/** The halo quads: one per word, padded bbox in world space, atlas-mapped, merged. */
export function buildHaloQuads(): THREE.BufferGeometry {
  const positions: number[] = []
  const uvs: number[] = []
  const index: number[] = []
  SIGN_WORDS.forEach((word, i) => {
    const pts = wordPointsWorld(word)
    // the transformed points' own bbox rather than the local bbox re-transformed: under the
    // roll the two differ, and the quad must cover what actually shipped.
    let minX = Infinity
    let maxX = -Infinity
    let minY = Infinity
    let maxY = -Infinity
    let z = 0
    for (const stroke of pts) {
      for (const [x, y, pz] of stroke) {
        minX = Math.min(minX, x)
        maxX = Math.max(maxX, x)
        minY = Math.min(minY, y)
        maxY = Math.max(maxY, y)
        z = pz
      }
    }
    const x0 = minX - HALO_PAD
    const x1 = maxX + HALO_PAD
    const y0 = minY - HALO_PAD
    const y1 = maxY + HALO_PAD
    const zq = z - 0.12
    const cell = atlasCell(i)
    const u0 = cell.x / HALO_CANVAS_W
    const u1 = (cell.x + cell.w) / HALO_CANVAS_W
    const base = positions.length / 3
    positions.push(x0, y0, zq, x1, y0, zq, x1, y1, zq, x0, y1, zq)
    uvs.push(u0, 0, u1, 0, u1, 1, u0, 1)
    index.push(base, base + 1, base + 2, base, base + 2, base + 3)
  })
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geo.setIndex(index)
  return geo
}

export function NeonSign({ journeyRef }: { journeyRef: JourneyRef }) {
  const group = useRef<THREE.Group>(null)
  const reduced = usePrefersReducedMotion()
  const tubeGeo = useMemo(buildNeonTube, [])
  const haloGeo = useMemo(buildHaloQuads, [])
  const tubeMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: PALETTE.neonTube,
        transparent: true,
        opacity: 0,
        toneMapped: false,
        depthWrite: false,
      }),
    []
  )
  const haloMat = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = HALO_CANVAS_W
    canvas.height = HALO_CANVAS_H
    paintHalo(canvas)
    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    return new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      opacity: 0,
      toneMapped: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  }, [])
  useEffect(() => {
    return () => {
      tubeGeo.dispose()
      haloGeo.dispose()
      tubeMat.dispose()
      haloMat.map?.dispose()
      haloMat.dispose()
    }
  }, [tubeGeo, haloGeo, tubeMat, haloMat])

  // NaN so the mount frame always applies once; every dark frame after costs one compare.
  const last = useRef(Number.NaN)
  useFrame(() => {
    const g = group.current
    if (!g) return
    const lights = studioLightsFor(journeyRef.current.ending)
    const v = flickerAt(lights, reduced)
    if (v === last.current) return
    last.current = v
    g.visible = v > 0
    tubeMat.opacity = v
    haloMat.opacity = v * HALO_MAX
  })

  return (
    <group ref={group} visible={false}>
      <mesh geometry={haloGeo} material={haloMat} renderOrder={2} />
      <mesh geometry={tubeGeo} material={tubeMat} renderOrder={3} />
    </group>
  )
}
