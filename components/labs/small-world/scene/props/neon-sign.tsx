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

/**
 * ONE WORD's strokes as one merged tube geometry, world-space baked.
 *
 * It was both words in one draw until Task 106's second pass, and the split is the stutter's
 * doing: `Lets` and `Create` are separate runs of glass on separate electrodes, one of them goes
 * bad at a time, and two words sharing a material can only ever flicker in unison — which is a
 * dimmer on the whole circuit, not a neon. The cost is one extra draw call for the tube and one
 * for the halo; the halo's canvas is still painted once and shared by both materials.
 */
export function buildWordTube(index: number): THREE.BufferGeometry {
  const positions: number[] = []
  const normals: number[] = []
  for (const stroke of wordPointsWorld(SIGN_WORDS[index])) {
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

/** ONE WORD's halo quad: the frame the painter used, mapped to that word's cell of the atlas. */
export function buildWordHalo(index: number): THREE.BufferGeometry {
  const { x0, x1, y0, y1, u0, u1 } = haloFrame(index)
  const zq = wordPointsWorld(SIGN_WORDS[index])[0][0][2] - 0.12
  const geo = new THREE.BufferGeometry()
  geo.setAttribute(
    'position',
    new THREE.Float32BufferAttribute([x0, y0, zq, x1, y0, zq, x1, y1, zq, x0, y1, zq], 3)
  )
  geo.setAttribute('uv', new THREE.Float32BufferAttribute([u0, 0, u1, 0, u1, 1, u0, 1], 2))
  geo.setIndex([0, 1, 2, 0, 2, 3])
  return geo
}

export function NeonSign({ journeyRef }: { journeyRef: JourneyRef }) {
  const group = useRef<THREE.Group>(null)
  const reduced = usePrefersReducedMotion()
  // ONE PAIR PER WORD (Task 106): each tube stutters on its own schedule, so each needs its own
  // opacity. The halo CANVAS is still painted once — only the material is per word, and both
  // materials share the one texture, each reading its own cell through its quad's uvs.
  const tubeGeos = useMemo(() => SIGN_WORDS.map((_, i) => buildWordTube(i)), [])
  const haloGeos = useMemo(() => SIGN_WORDS.map((_, i) => buildWordHalo(i)), [])
  const tubeMats = useMemo(
    () =>
      SIGN_WORDS.map(
        () =>
          new THREE.MeshBasicMaterial({
            color: PALETTE.neonRose,
            transparent: true,
            opacity: 0,
            toneMapped: false,
            depthWrite: false,
          })
      ),
    []
  )
  const haloTex = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = HALO_CANVAS_W
    canvas.height = HALO_CANVAS_H
    paintHalo(canvas)
    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    return tex
  }, [])
  const haloMats = useMemo(
    () =>
      SIGN_WORDS.map(
        () =>
          new THREE.MeshBasicMaterial({
            map: haloTex,
            transparent: true,
            opacity: 0,
            toneMapped: false,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
          })
      ),
    [haloTex]
  )
  useEffect(() => {
    return () => {
      for (const g of tubeGeos) g.dispose()
      for (const g of haloGeos) g.dispose()
      for (const m of tubeMats) m.dispose()
      for (const m of haloMats) m.dispose()
      haloTex.dispose()
    }
  }, [tubeGeos, haloGeos, tubeMats, haloMats, haloTex])

  /**
   * The stutter's accumulator (Task 106). It advances only while the strike envelope is above 0 —
   * see `neonClockAt` and the scoping argument beside it in `scene/neon-sign.ts`. Held in a ref
   * rather than in state because nothing renders from it: it reaches material opacities.
   */
  const clock = useRef(0)
  // NaN so the mount frame always applies once; every dark frame after costs one compare.
  const lastEnv = useRef(Number.NaN)
  useFrame((_, delta) => {
    const g = group.current
    if (!g) return
    const lights = studioLightsFor(journeyRef.current.ending)
    const env = flickerAt(lights, reduced)
    clock.current = neonClockAt(clock.current, delta, env, reduced)
    // The whole journey costs one compare: a dark sign that was dark last frame writes nothing.
    if (env === 0 && lastEnv.current === 0) return
    lastEnv.current = env
    // VISIBILITY IS STILL THE ENVELOPE'S, not the product's: the stutter never reaches 0, so the
    // containment argument ("dark exactly where the studio lights are dark") is untouched by it.
    g.visible = env > 0
    for (let i = 0; i < SIGN_WORDS.length; i++) {
      const amb = neonAmbientAt(clock.current, i, reduced)
      tubeMats[i].opacity = env * amb
      // The glow takes the stutter with extra bite and the ignition straight, so the strike's
      // authored halo weights are the same numbers they were before the stutter existed.
      haloMats[i].opacity = env * Math.pow(amb, NEON_HALO_BITE) * HALO_MAX
    }
  })

  return (
    <group ref={group} visible={false}>
      {/* the tubes first, the halos OVER them: the halo canvas carries the near-white core pass,
          and additive-over-rose is what makes the glass read hot rather than painted. */}
      {tubeGeos.map((geo, i) => (
        <mesh key={`t${i}`} geometry={geo} material={tubeMats[i]} renderOrder={2} />
      ))}
      {haloGeos.map((geo, i) => (
        <mesh key={`h${i}`} geometry={geo} material={haloMats[i]} renderOrder={3} />
      ))}
    </group>
  )
}
