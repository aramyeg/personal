'use client'
import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { PALETTE } from '../../palette'
import { studioLightsFor } from '../desk-studio'
import {
  HALO_CANVAS_H,
  HALO_CANVAS_W,
  NEON_HALO_BITE,
  SIGN_TUBE_R,
  SIGN_WORDS,
  flickerAt,
  haloFrame,
  haloPx,
  haloPy,
  neonAmbientAt,
  neonClockAt,
  signPointsWorld,
  wordPointsWorld,
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

/**
 * The halo's peak opacity, and the pass weights below it, RE-SOLVED in Task 103.
 *
 * T99's numbers were tuned against a halo that did not land on its own tube (see the frame note
 * in `scene/neon-sign.ts`): the hot core sat beside every stroke, so the fill kept its colour
 * and the additive load never stacked. Registered, the same numbers clip — the first capture of
 * this lane came back with a WHITE sign, chroma 8 where the shipped build measured 30.
 *
 * So the weight moved outward. The corona passes carry more (they are what makes the room feel
 * lit, and they land on the cyc rather than on the tube), the two near-tube passes carry less,
 * and the filament is narrower and softer — at money-shot size a stroke is about seven pixels
 * wide, so a core covering half of it is not a highlight, it is the letter.
 */
const HALO_MAX = 0.55

/**
 * Halo texture: painted once at mount, both words on one canvas — no ctx.filter (Safari
 * guarantees), just widening soft passes of the room's rose.
 *
 * It paints the WORLD polylines through `haloFrame`, which is the same rectangle
 * `buildHaloQuads` maps the cell onto (see the module header in `scene/neon-sign.ts`). Painting
 * from the local unrolled bbox instead is what put a white ghost beside every tube in T99.
 */
function paintHalo(canvas: HTMLCanvasElement | OffscreenCanvas): void {
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D
  ctx.clearRect(0, 0, HALO_CANVAS_W, HALO_CANVAS_H)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  SIGN_WORDS.forEach((word, i) => {
    const f = haloFrame(i)
    // widening passes: far corona → near glow in the gas rose, then ONE narrow near-white
    // pass — the hot core. The halo draws OVER the tube (renderOrder), so the additive core
    // lands on the rose glass and reads as the tube's own heat.
    const passes: [number, number, string][] = [
      [SIGN_TUBE_R * 11 * f.s, 0.1, PALETTE.neonRose],
      [SIGN_TUBE_R * 7 * f.s, 0.17, PALETTE.neonRose],
      [SIGN_TUBE_R * 4.5 * f.s, 0.16, PALETTE.neonRose],
      [SIGN_TUBE_R * 3 * f.s, 0.12, PALETTE.neonRose],
      [SIGN_TUBE_R * 0.8 * f.s, 0.3, PALETTE.neonTube],
    ]
    const world = wordPointsWorld(word)
    for (const [width, alpha, color] of passes) {
      ctx.strokeStyle = color
      ctx.globalAlpha = alpha
      ctx.lineWidth = width
      for (const stroke of world) {
        ctx.beginPath()
        stroke.forEach(([x, y], k) =>
          k
            ? ctx.lineTo(haloPx(f, x), haloPy(f, y))
            : ctx.moveTo(haloPx(f, x), haloPy(f, y))
        )
        ctx.stroke()
      }
    }
  })
  ctx.globalAlpha = 1
}

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

/** The halo quads: one per word, the frame the painter used, atlas-mapped, merged. */
export function buildHaloQuads(): THREE.BufferGeometry {
  const positions: number[] = []
  const uvs: number[] = []
  const index: number[] = []
  SIGN_WORDS.forEach((word, i) => {
    const { x0, x1, y0, y1, u0, u1 } = haloFrame(i)
    const zq = wordPointsWorld(word)[0][0][2] - 0.12
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
        color: PALETTE.neonRose,
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

  /**
   * The ambient dip's accumulator (Task 106). It advances only while the strike envelope is above
   * 0 — see `neonClockAt` and the scoping argument beside it in `scene/neon-sign.ts`. Held in a
   * ref rather than in state because nothing renders from it: it reaches two material opacities.
   */
  const clock = useRef(0)
  // NaN so the mount frame always applies once; every dark frame after costs one compare.
  const last = useRef(Number.NaN)
  useFrame((_, delta) => {
    const g = group.current
    if (!g) return
    const lights = studioLightsFor(journeyRef.current.ending)
    const env = flickerAt(lights, reduced)
    clock.current = neonClockAt(clock.current, delta, env, reduced)
    const amb = neonAmbientAt(clock.current, reduced)
    const v = env * amb
    if (v === last.current) return
    last.current = v
    // VISIBILITY IS STILL THE ENVELOPE'S, not the product's: the ambient never reaches 0, so the
    // containment argument ("dark exactly where the studio lights are dark") is untouched by it.
    g.visible = env > 0
    tubeMat.opacity = v
    // The glow takes the ambient with extra bite and the ignition straight, so the strike's
    // authored halo weights are the same numbers they were before the dip existed.
    haloMat.opacity = env * Math.pow(amb, NEON_HALO_BITE) * HALO_MAX
  })

  return (
    <group ref={group} visible={false}>
      {/* the tube first, the halo OVER it: the halo canvas carries the near-white core pass,
          and additive-over-rose is what makes the glass read hot rather than painted. */}
      <mesh geometry={tubeGeo} material={tubeMat} renderOrder={2} />
      <mesh geometry={haloGeo} material={haloMat} renderOrder={3} />
    </group>
  )
}
