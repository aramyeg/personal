'use client'

/**
 * A pop-up book spread: one folded paper-cutout layer per `SceneLayer`,
 * each hinged along its `hingeZ` line and posed between lying flat on the
 * page (rotation.x = π/2) and standing up toward the reader (rotation.x =
 * π/2 − standAngle). Mounted by book.tsx for the current spread ± 1 so
 * neighboring textures are warm before you turn to them (see
 * use-layer-texture.ts) — but only spreads with a `role` other than
 * 'hidden' are ever visible.
 *
 * Task 18 rework: a layer's stand progress is driven two different ways
 * depending on `role`:
 *  - 'current' / 'hidden' (no turn in flight, or a warm-but-inactive
 *    neighbor): the original manual spring, unchanged — mouse parallax sway
 *    and the staggered mount/reveal rise live here.
 *  - 'outgoing' / 'incoming' (this spread is the one being left, or the one
 *    about to become current, for the duration of a turn): stand progress
 *    is a direct, deterministic function of the turn's own t (see
 *    popup-kinematics.ts) instead of an independent spring, so the paper
 *    can never be caught still standing while the turning page sweeps
 *    overhead. The spring resumes automatically the instant the layer's
 *    role flips back to 'current' at commit, continuing from wherever the
 *    kinematic function left `stand` (~0.92) for a small natural overshoot
 *    settle. That handoff does seed the spring's staggered-rise clock
 *    (`risingClock`) to this layer's own stagger delay on the transition
 *    frame — without it, the clock would restart from ~0 like a fresh
 *    mount/reveal, holding the spring's target at 0 until the stagger
 *    elapses and pulling the already-risen layer back down before
 *    re-raising it. See the incoming->current branch below.
 *
 * Convention (matches page-geometry.ts): the enclosing group already sits
 * at the open page's surface height, so a layer's local y=0 is the page.
 * Lying flat, a layer's plane extends from its hinge toward +z (further
 * across the page); standing, it rises straight up in local y (world up).
 */

import { useEffect, useMemo, useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { layerFold, type SceneLayer } from '../content'
import { makeShadowCanvas } from '../procedural/paper-texture'
import { makeCanvasTexture } from './book'
import { incomingRiseStand, outgoingFoldStand } from './popup-kinematics'
import { COVER_MS, TURN_MS, type TurnFrame } from './use-turn-driver'
import { useLayerTexture } from './use-layer-texture'

// Manual spring integrator constants (semi-implicit Euler): k is stiffness,
// c is damping. c sits below critical (2*sqrt(k) ≈ 19) on purpose — the
// layers should overshoot slightly and settle, like paper springing into
// place, not glide to a stop.
const SPRING_K = 90
const SPRING_C = 9
const STAGGER_S = 0.085
const SHADOW_HEIGHT = 0.18
const SHADOW_Z_OFFSET = 0.05
const SHADOW_Y_LIFT = 0.001
const SHADOW_MAX_OPACITY = 0.35
const PARALLAX_SWAY = 0.015
// Per-layer kinematic stagger, converted from a fixed ms budget into a t
// fraction using the turn's actual duration (cover turns run slower, so the
// same ms budget buys a smaller t fraction there — the stagger still reads
// like ~12ms/layer either way, not a fraction that grows with duration).
const PHASE_STEP_MS = 12
// Below this, a layer's stand is treated as "still flat" for visibility
// purposes (see cutoutRef/shadowRef) regardless of role — incoming-waiting,
// outgoing-folded, or a current/hidden layer that hasn't started its rise
// yet all read as flat paper with nothing to show. A hair above 0 rather
// than exactly 0 so float noise in the spring/kinematic math can't flicker
// the mesh.
const STAND_EPSILON = 0.002
// v2 paper engineering (see content.ts's LayerFold):
// - v-fold: half-panels yaw around the vertical center crease as the piece
//   stands, forming the classic V (crease toward the reader). Fully flat at
//   stand=0 — yaw and pitch collapse together, like real glued paper.
const VFOLD_YAW_RAD = (24 * Math.PI) / 180
// - crease: the upper segment leans back from the horizontal fold line.
const CREASE_SPLIT = 0.6 // lower segment's share of the piece's height
const CREASE_TILT_RAD = (16 * Math.PI) / 180
// Fold shading, baked as material tints (the print itself carries the
// light — materials are unlit): the half/segment turned away from the key
// side reads a step darker, which is what sells the crease as a real fold.
const FOLD_SHADE_TINT = '#d9cdb4'

/** A pop-up spread's relationship to any turn currently in flight — see the
 *  file header for how each drives `stand`. */
export type PopupRole = 'current' | 'outgoing' | 'incoming' | 'hidden'

type PopupSpreadProps = {
  layers: readonly SceneLayer[]
  accents: readonly string[]
  spreadIndex: number
  role: PopupRole
  frame: RefObject<TurnFrame | null>
}

function PopupLayer({
  layer,
  accents,
  index,
  layerCount,
  role,
  frame,
}: {
  layer: SceneLayer
  accents: readonly string[]
  index: number
  layerCount: number
  role: PopupRole
  frame: RefObject<TurnFrame | null>
}) {
  const texture = useLayerTexture(layer.id, layer.kind, accents)
  const groupRef = useRef<THREE.Group>(null)
  // Every chapter's four layers share identical hingeZ/width per kind (see
  // content.ts's layerDefaults) — with the outgoing AND incoming spreads
  // both mounted during a turn (see PopupSpread below), their flat
  // (stand≈0) cutouts are geometrically coincident and would z-fight, one
  // chapter's colors flickering through another's. These refs let each
  // layer's cutout mesh and contact shadow stay fully invisible whenever
  // they have nothing to show (stand at or below this epsilon) — whether
  // that's an incoming layer still waiting to rise, an outgoing layer that
  // has already folded flat, or a current/hidden layer sitting flat before
  // its own rise starts — rather than resolving the conflict by
  // depth-buffer luck or leaving flat paper visibly painted on the page.
  const cutoutRef = useRef<THREE.Group>(null)
  const shadowRef = useRef<THREE.Mesh>(null)
  // Spring state (stand progress 0..1) and its velocity, integrated by hand
  // every frame rather than via a library — see SPRING_K/SPRING_C above.
  const stand = useRef(0)
  const velocity = useRef(0)
  // Seconds since `rising` last flipped true; null while not rising. Drives
  // this layer's staggered entrance (target flips to 1 once it passes
  // index * STAGGER_S).
  const risingClock = useRef<number | null>(null)
  // `stand` captured the instant this layer's role last became 'outgoing' —
  // the fold starts from wherever it actually was (spring overshoot, a
  // chained turn cutting a prior rise short), never snapped to 1 first.
  const foldStart = useRef(0)
  const prevRole = useRef<PopupRole>(role)

  const fold = layerFold(layer)
  // Sub-pivot refs for the fold mechanics (v-fold half-panels / crease's
  // upper segment) — posed every frame alongside the main pitch group.
  const leftPivotRef = useRef<THREE.Group>(null)
  const rightPivotRef = useRef<THREE.Group>(null)
  const upperPivotRef = useRef<THREE.Group>(null)

  // Piece geometries per fold structure. Every piece is bottom-anchored at
  // its fold line (local y=0 = the glue line on the page).
  const geometries = useMemo(() => {
    const { width, height } = layer
    if (fold === 'vfold') {
      const half = new THREE.PlaneGeometry(width / 2, height)
      const left = half.clone()
      left.translate(-width / 4, height / 2, 0)
      const right = half
      right.translate(width / 4, height / 2, 0)
      return { a: left, b: right }
    }
    if (fold === 'crease') {
      const lowerH = height * CREASE_SPLIT
      const upperH = height - lowerH
      const lower = new THREE.PlaneGeometry(width, lowerH)
      lower.translate(0, lowerH / 2, 0)
      const upper = new THREE.PlaneGeometry(width, upperH)
      upper.translate(0, upperH / 2, 0)
      return { a: lower, b: upper }
    }
    const flat = new THREE.PlaneGeometry(width, height)
    flat.translate(0, height / 2, 0)
    return { a: flat, b: null }
  }, [layer, fold])

  // Unlit print materials — the artwork carries its own light, like ink on
  // paper; scene lights set the mood around the book, not on the print. The
  // second piece (v-fold's far panel / crease's leaning top) gets a baked
  // shade tint, which is what visually sells the fold.
  const materials = useMemo(() => {
    const make = (tint: string) =>
      new THREE.MeshBasicMaterial({
        transparent: true,
        alphaTest: 0.1,
        side: THREE.DoubleSide,
        color: tint,
      })
    return { a: make('#ffffff'), b: fold === 'flat' ? null : make(FOLD_SHADE_TINT) }
  }, [fold])

  // Texture halves per fold: v-fold splits the art at the center crease
  // (left|right), crease splits it at the fold line (lower|upper), flat
  // shows it whole. Clones share the GPU upload; only uv transforms differ.
  useEffect(() => {
    if (!texture) return
    texture.wrapS = THREE.ClampToEdgeWrapping
    texture.wrapT = THREE.ClampToEdgeWrapping
    const clones: THREE.Texture[] = []
    const assign = (material: THREE.Material | null, map: THREE.Texture) => {
      if (!(material instanceof THREE.MeshBasicMaterial)) return
      material.map = map
      material.needsUpdate = true
    }
    if (fold === 'vfold') {
      const left = texture.clone()
      left.repeat.set(0.5, 1)
      const right = texture.clone()
      right.repeat.set(0.5, 1)
      right.offset.x = 0.5
      clones.push(left, right)
      assign(materials.a, left)
      assign(materials.b, right)
    } else if (fold === 'crease') {
      const lower = texture.clone()
      lower.repeat.set(1, CREASE_SPLIT)
      const upper = texture.clone()
      upper.repeat.set(1, 1 - CREASE_SPLIT)
      upper.offset.y = CREASE_SPLIT
      clones.push(lower, upper)
      assign(materials.a, lower)
      assign(materials.b, upper)
    } else {
      assign(materials.a, texture)
    }
    return () => clones.forEach((clone) => clone.dispose())
  }, [texture, fold, materials])

  const shadowCanvas = useMemo(() => makeShadowCanvas(), [])
  const shadowTexture = useMemo(() => makeCanvasTexture(shadowCanvas), [shadowCanvas])
  const shadowMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: shadowTexture,
        transparent: true,
        depthWrite: false,
        opacity: 0,
      }),
    [shadowTexture]
  )

  useEffect(
    () => () => {
      geometries.a.dispose()
      geometries.b?.dispose()
      materials.a.dispose()
      materials.b?.dispose()
      shadowTexture.dispose()
      shadowMaterial.dispose()
    },
    [geometries, materials, shadowTexture, shadowMaterial]
  )

  useFrame((state, delta) => {
    const group = groupRef.current
    if (!group) return

    // Clamp to a 30fps-equivalent step: after the tab is backgrounded and
    // resumed, three.js's next `delta` can be seconds long, which would
    // blow up the spring integrator (and the stagger clock below) for one
    // frame and flash the pose/opacity.
    const dt = Math.min(delta, 1 / 30)
    const f = frame.current

    // Captured the instant `role` first becomes 'outgoing', independent of
    // whether the driver frame ref (`f`) happens to be populated yet this
    // same tick. Hardening (task 18 review): this used to live inside the
    // `role === 'outgoing' && f` branch below, so a frame where `f` was
    // still null on that first outgoing tick would skip the capture — and
    // since `prevRole.current` flips to 'outgoing' regardless (see the
    // unconditional assignment below), the real capture opportunity on the
    // *next* tick (once `f` arrives) would already be gone, leaving
    // `foldStart` stale and folding from the wrong value (a visible snap).
    // Splitting the capture out so it can never depend on mount order.
    if (role === 'outgoing' && prevRole.current !== 'outgoing') {
      foldStart.current = stand.current
    }

    if (role === 'outgoing' && f) {
      const duration = f.isCover ? COVER_MS : TURN_MS
      // Foreground-most layers (highest index) lead the fold — they're the
      // first thing the lifting page would otherwise sweep through.
      const phaseOffset = ((layerCount - 1 - index) * PHASE_STEP_MS) / duration
      stand.current = outgoingFoldStand(f.t, foldStart.current, phaseOffset)
      velocity.current = 0
      risingClock.current = null
    } else if (role === 'incoming' && f) {
      const duration = f.isCover ? COVER_MS : TURN_MS
      // Backdrop-most layers (lowest index) lead the rise, same order the
      // idle stagger below uses — foreground trails in last.
      const phaseOffset = (index * PHASE_STEP_MS) / duration
      stand.current = incomingRiseStand(f.t, phaseOffset)
      velocity.current = 0
      risingClock.current = null
    } else {
      // Landing from the kinematic rise (role just flipped 'incoming' ->
      // 'current' at commit): seed the stagger clock so this frame's spring
      // target is already 1, continuing the settle from wherever
      // incomingRiseStand left `stand` (~0.92, see popup-kinematics.ts).
      // Without this, risingClock starts back at (near) 0 — same as a
      // fresh mount/reveal — so the staggered target stays 0 until
      // index * STAGGER_S elapses, pulling the already-risen layer back
      // down before re-raising it (worse for later-indexed/foreground
      // layers, which can dip enough to cross STAND_EPSILON and blink
      // invisible). Seeding to exactly the stagger delay reproduces the
      // "already past its own stagger" state instead of restarting it.
      if (prevRole.current === 'incoming' && role === 'current') {
        risingClock.current = index * STAGGER_S
      }

      const rising = role === 'current'
      risingClock.current = rising ? (risingClock.current ?? 0) + dt : null

      const staggerDelay = index * STAGGER_S
      const target = risingClock.current !== null && risingClock.current >= staggerDelay ? 1 : 0

      const accel = SPRING_K * (target - stand.current) - SPRING_C * velocity.current
      velocity.current += accel * dt
      stand.current += velocity.current * dt
    }
    prevRole.current = role

    const standRad = (layer.standAngle * Math.PI) / 180
    // Extra per-layer parallax sway on top of the spring pose — deeper
    // layers (higher index) sway a touch more, cheap parallax depth cue.
    // Idle-only (per task 18): a turn in flight drives `stand` kinematically
    // off the page's own motion, and mouse sway has no business perturbing
    // that — it would desync the paper from the page sweeping above it.
    const depthFactor = index / 3
    const sway = role === 'current' ? state.pointer.y * PARALLAX_SWAY * depthFactor : 0
    group.rotation.x = Math.PI / 2 - standRad * stand.current + sway

    shadowMaterial.opacity = SHADOW_MAX_OPACITY * Math.max(0, Math.min(1, stand.current))

    // Fold mechanics, driven by the same stand value as the pitch — the
    // whole mechanism collapses flat together and opens together, the way
    // one glued sheet of paper must.
    if (fold === 'vfold') {
      // Mountain fold: the center crease points at the reader, panel outer
      // edges sweep back — the classic pop-up centerpiece pose.
      if (leftPivotRef.current) leftPivotRef.current.rotation.y = -VFOLD_YAW_RAD * stand.current
      if (rightPivotRef.current) rightPivotRef.current.rotation.y = VFOLD_YAW_RAD * stand.current
    } else if (fold === 'crease' && upperPivotRef.current) {
      // Upper segment leans back from the fold line as the piece stands.
      upperPivotRef.current.rotation.x = -CREASE_TILT_RAD * stand.current
    }

    // See cutoutRef's declaration: paper is only worth drawing once it has
    // actually started rising off the page, whatever role got it there —
    // incoming-waiting, outgoing-folded-flat, and a current/hidden layer
    // still flat pre-rise all read the same way here. Also gated on the
    // texture having resolved — an unmapped basic material would flash as
    // a solid white card.
    const paperVisible = stand.current > STAND_EPSILON && texture !== null
    if (cutoutRef.current) {
      cutoutRef.current.visible = paperVisible
    }
    if (shadowRef.current) {
      shadowRef.current.visible = paperVisible
    }
  })

  return (
    <>
      {/* renderOrder=0 (the three.js default, pinned explicitly here) keeps
          this cutout drawing after the gutter crease's renderOrder=-1 (see
          book.tsx) regardless of where three's distance-based transparent
          sort would otherwise place it — so a standing layer always
          composites on top of the crease instead of being painted over. */}
      <group ref={groupRef} position={[layer.offsetX ?? 0, 0, layer.hingeZ]}>
        <group ref={cutoutRef}>
          {fold === 'vfold' && (
            <>
              {/* Half-panels pivot around the vertical center crease (local
                  x=0); their geometries already carry the ±width/4 offset. */}
              <group ref={leftPivotRef}>
                <mesh geometry={geometries.a} material={materials.a} renderOrder={0} />
              </group>
              <group ref={rightPivotRef}>
                <mesh geometry={geometries.b!} material={materials.b!} renderOrder={0} />
              </group>
            </>
          )}
          {fold === 'crease' && (
            <>
              <mesh geometry={geometries.a} material={materials.a} renderOrder={0} />
              {/* Upper segment pivots at the horizontal fold line. */}
              <group ref={upperPivotRef} position={[0, layer.height * CREASE_SPLIT, 0]}>
                <mesh geometry={geometries.b!} material={materials.b!} renderOrder={0} />
              </group>
            </>
          )}
          {fold === 'flat' && (
            <mesh geometry={geometries.a} material={materials.a} renderOrder={0} />
          )}
        </group>
      </group>
      <mesh
        ref={shadowRef}
        position={[layer.offsetX ?? 0, SHADOW_Y_LIFT, layer.hingeZ + SHADOW_Z_OFFSET]}
        rotation={[-Math.PI / 2, 0, 0]}
        material={shadowMaterial}
        renderOrder={0}
      >
        <planeGeometry args={[layer.width, SHADOW_HEIGHT]} />
      </mesh>
    </>
  )
}

/** One spread's worth of pop-up layers. Always mounted (for the current
 *  spread ± 1) but only visible while `role !== 'hidden'` — see the file
 *  header for what each role does. */
export function PopupSpread({ layers, accents, spreadIndex, role, frame }: PopupSpreadProps) {
  return (
    <group visible={role !== 'hidden'} name={`popup-spread-${spreadIndex}`}>
      {layers.map((layer, index) => (
        <PopupLayer
          key={layer.id}
          layer={layer}
          accents={accents}
          index={index}
          layerCount={layers.length}
          role={role}
          frame={frame}
        />
      ))}
    </group>
  )
}
