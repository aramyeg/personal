'use client'

/**
 * Renders the chapter-I TUNNEL: a raked stage deck, six receding die-cut
 * planes, a glowing trap door, and one brass ring the reader pulls.
 *
 * ============================================================================
 * DELIBERATE ARCHITECTURAL DIVERGENCE — READ BEFORE "FIXING" THIS FILE.
 * ============================================================================
 * Every other popup family in this book (popup-oanave-layer.tsx is the model)
 * solves world-space `PanelQuad`s in a pure solver and rewrites a
 * `DynamicDrawUsage` position buffer every frame. That is correct for THOSE
 * families, because their paper DEFORMS: a v-fold's panels change shape with
 * the dihedral, so there is no rigid body to transform and the vertices must
 * be recomputed.
 *
 * The tunnel's pieces are RIGID EXTRUSIONS. A die-cut plate does not change
 * shape when it hinges up off the deck; it rotates. So the correct — and
 * vastly simpler, and cheaper — solution is the one used here:
 *
 *   - every `ExtrudeGeometry` is built ONCE in a `useMemo` keyed on nothing
 *     (the contours in tunnel-cuts.ts are static), and
 *   - the pose is applied entirely with nested `<group>` transforms written
 *     in `useFrame`.
 *
 * Rewriting this into the quad-buffer idiom would mean re-triangulating six
 * die-cut contours with holes every frame to express a rotation a 4x4 matrix
 * already expresses exactly. Do not do it.
 *
 * ============================================================================
 * WHY EXTRUSIONS AT ALL (the E3 post-mortem)
 * ============================================================================
 * E3's depth stack was near-parallel unlit alpha quads. A billboard has no
 * edge: its silhouette ends in a hard alpha step with nothing to catch light,
 * so six planes composited into one stripe at the reading camera. An extruded
 * contour has a real side wall along every cut line, and the bright rim that
 * side wall catches is the entire reason a tunnel book reads as STACKED PAPER
 * rather than as a printed picture. That requires real lights, which is why
 * this is the book's only `MeshStandardMaterial` family.
 *
 * ============================================================================
 * THE STAGE TRANSFORM (the one piece of arithmetic worth stating)
 * ============================================================================
 * `STAGE` + `deckY` in tunnel-cuts.ts describe the FULLY DEPLOYED stage in the
 * layer's own frame (y=0 is the page plane, x=0 the gutter). Everything inside
 * `stageRef` is authored in those coordinates minus the front-edge pivot
 * (`stageLocal` below), and the whole stage FOLDS by rotating rigidly about
 * that pivot: `rotation.x = deckRake - RAKE_ANGLE`, which is 0 when deployed
 * and -RAKE_ANGLE when flat. That is not an approximation — rotating the raked
 * deck backwards by exactly its own rake lands every deck point at y = frontY,
 * i.e. genuinely flat, which is the paper-true fold.
 *
 * The deck SLAB is the one exception: `deckPlan()` is authored in PLAN view
 * (x = world x, y = world z), so its plan-y must be SHEARED up onto the rake
 * rather than merely rotated (rotation would shorten its z footprint by
 * cos(rake) and miss `deckY`). `DECK_PLAN_TO_STAGE` below is that shear, baked
 * into the geometry once at build time.
 *
 * ============================================================================
 * LIGHT SCOPING — WHAT THREE ACTUALLY DOES (divergence, deliberate)
 * ============================================================================
 * The lane spec asked for `light.layers.set(TUNNEL_LAYER)` so these lights
 * touch only tunnel meshes. three's WebGLRenderer does NOT support that:
 * `Object3D.layers` on a light is tested against the CAMERA's layers, not
 * against each lit object (three.module.js: `object.isLight &&
 * object.layers.test(camera.layers)` is the only light-layer test in the
 * renderer). Calling `.set(3)` would therefore not scope the light — it would
 * DELETE it, because the reading camera is on layer 0 only.
 *
 * The goal is met anyway, by construction: every other popup in the book is
 * `MeshBasicMaterial`, which is unlit, so no light added here can change a
 * single pixel outside this family. And shadows are opt-in per mesh
 * (`castShadow`/`receiveShadow` default false everywhere else), so switching
 * the Canvas to `shadows` changes nothing but this diorama. The meshes still
 * `layers.enable(TUNNEL_LAYER)` — a free tag for a future selective pass — and
 * the lights enable it too rather than `set` it, so they keep layer 0 and
 * actually render.
 */

import { useEffect, useMemo, useRef, type RefObject } from 'react'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import type { SceneLayer } from '../content'
import { useGuardedDispose } from './material-pool'
import { liveSpreadRole, spreadPageAnglesTilted } from './popup-mechanics'
import { easeTurnWeighted } from './page-geometry'
import { TURN_MS, type TurnFrame } from './use-turn-driver'
import { sharedHandleMaterial } from './shared-procedural-textures'
import { useStorybookStore } from '../store'
import {
  beginGrabChannel,
  clearUserDrive,
  endGrabChannel,
  readDriveOverride,
  readUserDrive,
  writeUserDrive,
} from '../user-drive'
import { markHandleHovered } from './handle-hover'
import { acceptsHandleHit } from './handle-hit'
import { STEP_CAP, stepUserDriveReturn, turnFrames } from './user-drive-return'
import {
  STAGE,
  deckPlan,
  deckY,
  coachPiece,
  tunnelPieces,
  wellPieces,
  type CutPiece,
  type CutTone,
  type PlaneKey,
} from './tunnel-cuts'
import {
  RAKE_ANGLE,
  TUNNEL_PLANE_ORDER,
  clamp01,
  lerp,
  solveTunnelPose,
  tunnelConfig,
  tunnelWorstPullStep,
  type TunnelGeom,
} from './popup-tunnel'

const FLAT_EPSILON = 0.02

/** Tag layer for the tunnel's own meshes and lights (see the header note on
 *  what three does and does not do with this). */
const TUNNEL_LAYER = 3

// --- the stage frame -------------------------------------------------------

const PIVOT_Y = STAGE.deck.frontY
const PIVOT_Z = STAGE.deck.zFront

/** Layer coordinates -> stage-group local (the front-edge fold pivot). */
const stageLocal = (x: number, y: number, z: number): [number, number, number] => [
  x,
  y - PIVOT_Y,
  z - PIVOT_Z,
]

/**
 * The deck plan's shear onto the rake. Maps an ExtrudeGeometry built from
 * `deckPlan()` — vertices (X = world x, Y = world z, Z = extrusion depth) —
 * into stage-local coordinates:
 *
 *   x = X
 *   y = (zFront - Y) * tan(A) - Z * cos(A)      [rake, then DOWN the normal]
 *   z = (Y - zFront)          - Z * sin(A)
 *
 * so the Z=0 face is the deck's top surface sitting exactly on `deckY`, and
 * the extrusion runs downward along the deck's own normal.
 */
const DECK_PLAN_TO_STAGE = (() => {
  const t = STAGE.deck.rake
  const c = Math.cos(RAKE_ANGLE)
  const s = Math.sin(RAKE_ANGLE)
  return new THREE.Matrix4().set(
    1, 0, 0, 0,
    0, -t, -c, PIVOT_Z * t,
    0, 1, -s, -PIVOT_Z,
    0, 0, 0, 1
  )
})()

// --- tone table ------------------------------------------------------------

type ToneSpec = {
  color: string
  roughness: number
  metalness: number
  emissive?: string
  emissiveIntensity?: number
}

const TONES: Record<CutTone, ToneSpec> = {
  timber: { color: '#4a3527', roughness: 0.85, metalness: 0 },
  plaster: { color: '#d9c9a8', roughness: 0.95, metalness: 0 },
  stone: { color: '#8d8577', roughness: 0.9, metalness: 0 },
  slate: { color: '#33343a', roughness: 0.8, metalness: 0 },
  silhouette: { color: '#1a1614', roughness: 1, metalness: 0 },
  glass: {
    color: '#ffd9a0',
    roughness: 0.4,
    metalness: 0,
    emissive: '#ff9d45',
    emissiveIntensity: 1.6,
  },
  brass: { color: '#c9963f', roughness: 0.35, metalness: 0.8 },
  foliage: { color: '#48603c', roughness: 0.95, metalness: 0 },
}

/**
 * ATMOSPHERIC PERSPECTIVE, mechanism 1 of 2. Depth is not free at a shallow
 * reading angle: identical paper at six stations reads as one slab unless the
 * far stations lose contrast. Each rank's material is a CLONE tinted toward
 * the haze, so plane 5 is a blue-grey ghost and plane 0 is full-strength.
 */
const HAZE = new THREE.Color('#4c6a93')
const HAZE_RAMP = [0, 0.1, 0.22, 0.36, 0.52, 0.66] as const
/** Emissive gets the same ramp at 0.6 strength so far windows cannot out-punch
 *  near ones — an unhazed emissive is the one channel that would defeat the
 *  whole cue. */
const HAZE_EMISSIVE_SCALE = 0.6

/** Mechanism 2 of 2: a translucent scrim standing in FRONT of each rank 1..5.
 *  Tint alone only desaturates; a physical veil of air also LIFTS the black
 *  level, which is what actually separates a far plane from a near one. */
const SCRIM_COLOR = '#5b7ba6'
const SCRIM_OPACITY = [0.04, 0.07, 0.1, 0.13, 0.16] as const
const SCRIM_OVERSIZE = 1.15
const SCRIM_Z = 0.03

/** Reader stroke geometry: the ring's rest station, and the pull axis. */
const RING_POS: [number, number, number] = [0.62, deckY(0.3) + 0.03, 0.34]
const RING_MAJOR = 0.05
const RING_MINOR = 0.013
/** Invisible coarse-pointer pad around the ring (the house slop idiom). */
const RING_SLOP = 0.13

type PieceNode = {
  id: string
  geometry: THREE.BufferGeometry
  material: THREE.MeshStandardMaterial
  slideKey?: 'gate-l' | 'gate-r'
}

type PlaneNode = {
  key: PlaneKey
  rank: number
  position: [number, number, number]
  pieces: PieceNode[]
  scrim: {
    geometry: THREE.PlaneGeometry
    material: THREE.MeshBasicMaterial
    position: [number, number, number]
    renderOrder: number
  } | null
}

export function TunnelPopupLayer({
  layer,
  spreadIndex,
  frame,
  committedSpread,
}: {
  layer: SceneLayer & TunnelGeom
  spreadIndex: number
  frame: RefObject<TurnFrame | null>
  committedSpread: RefObject<number>
}) {
  const rootRef = useRef<THREE.Group>(null)
  const scaleRef = useRef<THREE.Group>(null)
  const stageRef = useRef<THREE.Group>(null)
  const coachRef = useRef<THREE.Group>(null)
  const planeRefs = useRef<Partial<Record<PlaneKey, THREE.Group>>>({})
  const gateRefs = useRef<Record<string, THREE.Group>>({})
  const dirRef = useRef<THREE.DirectionalLight>(null)
  const targetRef = useRef<THREE.Object3D>(null)
  const slopRef = useRef<THREE.Mesh>(null)

  const cfg = useMemo(() => tunnelConfig(layer), [layer])
  /** Last solved pose, for the dev probe below (never read by the render). */
  const poseRef = useRef<ReturnType<typeof solveTunnelPose> | null>(null)

  // -------------------------------------------------------------------------
  // ONE build pass. Contours are static, so this runs exactly once: every
  // ExtrudeGeometry, every haze-ranked material clone, every scrim.
  // -------------------------------------------------------------------------
  const built = useMemo(() => {
    const geometries: THREE.BufferGeometry[] = []
    const materials: THREE.Material[] = []

    const matCache = new Map<string, THREE.MeshStandardMaterial>()
    const toneMaterial = (tone: CutTone, rank: number): THREE.MeshStandardMaterial => {
      const key = `${tone}|${rank}`
      const hit = matCache.get(key)
      if (hit) return hit
      const spec = TONES[tone]
      const haze = HAZE_RAMP[Math.min(HAZE_RAMP.length - 1, Math.max(0, rank))]
      const m = new THREE.MeshStandardMaterial({
        color: new THREE.Color(spec.color).lerp(HAZE, haze),
        roughness: spec.roughness,
        metalness: spec.metalness,
        // A tunnel is looked INTO: apertures show the back faces of far
        // planes, and a single-sided cut would punch holes in the world.
        side: THREE.DoubleSide,
      })
      if (spec.emissive) {
        m.emissive = new THREE.Color(spec.emissive).lerp(HAZE, haze * HAZE_EMISSIVE_SCALE)
        m.emissiveIntensity = (spec.emissiveIntensity ?? 1) * (1 - haze * HAZE_EMISSIVE_SCALE)
      }
      matCache.set(key, m)
      materials.push(m)
      return m
    }

    /** A cut piece as a real extrusion, centred on its own plane so the
     *  paper's thickness straddles the station instead of hanging off it. */
    const extrude = (piece: CutPiece): THREE.BufferGeometry => {
      const g = new THREE.ExtrudeGeometry(piece.shapes as THREE.Shape[], {
        depth: piece.thickness,
        bevelEnabled: false,
        curveSegments: 24,
      })
      g.translate(0, 0, -piece.thickness / 2)
      geometries.push(g)
      return g
    }

    // --- deck slab (plan-authored, sheared onto the rake) -------------------
    const deckGeometry = new THREE.ExtrudeGeometry(deckPlan(), {
      depth: STAGE.deck.slab,
      bevelEnabled: false,
    })
    deckGeometry.applyMatrix4(DECK_PLAN_TO_STAGE)
    deckGeometry.computeVertexNormals()
    geometries.push(deckGeometry)
    // The deck's tone is the LAYER's call — `deckPlan()` ships a contour and
    // no tone. It is 'stone', not 'timber', and that is a measured decision:
    // with timber the deck rendered sRGB (66,47,36) against a facade at
    // (66,49,40) — literally the same value, so the stage floor and the
    // building in front of it were one silhouette and the rake light's arch
    // shadow had nothing to fall on. Stone (#8d8577) is the courtyard the
    // shadow needs, and it is the one surface in the diorama whose whole job
    // is to CARRY a shadow.
    const deckMaterial = toneMaterial('stone', 0)

    // --- the well: far wall of the trap, top flush with the deck -----------
    const wellPosition = stageLocal(0, deckY(STAGE.well.z0) - STAGE.well.depth, STAGE.well.z0)
    const well: PieceNode[] = wellPieces().map((p) => ({
      id: p.id,
      geometry: extrude(p),
      material: toneMaterial(p.tone, 0),
    }))

    // --- the six planes -----------------------------------------------------
    const planes: PlaneNode[] = TUNNEL_PLANE_ORDER.map((key, rank) => {
      const plane = STAGE.planes[key]
      const pieces: PieceNode[] = tunnelPieces(key).map((p) => ({
        id: p.id,
        geometry: extrude(p),
        material: toneMaterial(p.tone, rank),
        slideKey: p.slideKey,
      }))
      let scrim: PlaneNode['scrim'] = null
      if (rank >= 1) {
        const w = plane.halfW * 2 * SCRIM_OVERSIZE
        const h = plane.height * SCRIM_OVERSIZE
        const geometry = new THREE.PlaneGeometry(w, h)
        geometries.push(geometry)
        const material = new THREE.MeshBasicMaterial({
          color: SCRIM_COLOR,
          transparent: true,
          opacity: SCRIM_OPACITY[rank - 1],
          depthWrite: false,
          side: THREE.DoubleSide,
        })
        materials.push(material)
        scrim = {
          geometry,
          material,
          position: [0, h / 2, SCRIM_Z],
          // Back-to-front: the deepest veil draws first, so each nearer one
          // composites over everything behind it.
          renderOrder: 100 + (TUNNEL_PLANE_ORDER.length - 1 - rank),
        }
      }
      return {
        key,
        rank,
        position: stageLocal(0, deckY(plane.z), plane.z),
        pieces,
        scrim,
      }
    })

    // --- the coach ----------------------------------------------------------
    const coach = coachPiece()
    const coachNode: PieceNode = {
      id: coach.id,
      geometry: extrude(coach),
      material: toneMaterial(coach.tone, 2),
    }

    // --- the reader's ring --------------------------------------------------
    const ringGeometry = new THREE.TorusGeometry(RING_MAJOR, RING_MINOR, 12, 32)
    geometries.push(ringGeometry)
    const ringMaterial = toneMaterial('brass', 0)
    const slopGeometry = new THREE.SphereGeometry(RING_SLOP, 12, 8)
    geometries.push(slopGeometry)

    return {
      deckGeometry,
      deckMaterial,
      wellPosition,
      well,
      planes,
      coachNode,
      ringGeometry,
      ringMaterial,
      slopGeometry,
      disposables: [...geometries, ...materials] as readonly { dispose(): void }[],
    }
    // Deps are EMPTY on purpose and the linter agrees: the cut vocabulary is
    // static by contract (tunnel-cuts.ts), so nothing here can ever change.
  }, [])

  useGuardedDispose(built.disposables)

  // Shadow frustum + target. Tight on purpose: the diorama is ~2 world units
  // across, and a default 100-unit frustum spends its 2048 map on empty desk.
  useEffect(() => {
    const light = dirRef.current
    const target = targetRef.current
    if (!light || !target) return
    light.target = target
    const cam = light.shadow.camera
    cam.left = -1.3
    cam.right = 1.3
    cam.top = 1.3
    cam.bottom = -1.3
    cam.near = 0.5
    cam.far = 7
    cam.updateProjectionMatrix()
    light.shadow.mapSize.set(2048, 2048)
    light.shadow.bias = -0.0006
    light.shadow.normalBias = 0.02
    light.layers.enable(TUNNEL_LAYER)
  }, [])

  /**
   * Dev-only probe handle, the house idiom (store.ts's `__sbStore`,
   * user-drive.ts's `__sbUserDrive`). A capture bench can read the live
   * diorama's transforms and world bounds directly instead of inferring
   * geometry from pixels — which is how the deck shear and the plane stagger
   * were verified. Compiled out of production.
   */
  useEffect(() => {
    if (process.env.NODE_ENV === 'production' || typeof window === 'undefined') return
    const w = window as unknown as { __sbTunnel?: unknown }
    w.__sbTunnel = { root: rootRef.current, pose: () => poseRef.current }
    return () => {
      delete w.__sbTunnel
    }
  }, [])

  // -------------------------------------------------------------------------
  // Reader input: the brass ring. House idiom (popup-tabpiece-layer.tsx) —
  // zustand holds only the grab IDENTITY, the drive value flows through the
  // module scrub channel, and this layer hands its own teardown to the channel
  // so the window backstop can always end the grab (r3f v9 never dispatches
  // pointercancel / lostpointercapture to an object's handlers).
  // -------------------------------------------------------------------------
  const grabRef = useRef<{ z0: number; pull0: number } | null>(null)
  const invRoot = useMemo(() => new THREE.Matrix4(), [])
  const localRay = useMemo(() => new THREE.Ray(), [])
  const hitPoint = useMemo(() => new THREE.Vector3(), [])
  const pullPlane = useMemo(
    () => new THREE.Plane(new THREE.Vector3(0, 1, 0), -RING_POS[1]),
    []
  )

  /** The pointer's station along the deck's z axis, in LAYER coordinates.
   *  The ray is r3f's world ray pushed through the root group's inverse, so
   *  the parallax rig's tilt and the book's placement cancel out generically
   *  — and unlike a mesh-local read it does not swing with the stage's own
   *  fold rotation mid-turn. */
  const projectPullZ = (e: ThreeEvent<PointerEvent>): number | null => {
    const root = rootRef.current
    if (!root) return null
    invRoot.copy(root.matrixWorld).invert()
    localRay.copy(e.ray).applyMatrix4(invRoot)
    const hit = localRay.intersectPlane(pullPlane, hitPoint)
    return hit ? hit.z : null
  }

  const releaseGrab = (e?: ThreeEvent<PointerEvent> | null): void => {
    if (!grabRef.current) return
    grabRef.current = null
    endGrabChannel(layer.id)
    useStorybookStore.getState().endGrab()
    try {
      if (e) (e.target as Element).releasePointerCapture(e.pointerId)
    } catch {
      // capture already gone — nothing to release
    }
  }

  const onPointerDown = (e: ThreeEvent<PointerEvent>): void => {
    if (!acceptsHandleHit(e, slopRef.current)) return
    const st = useStorybookStore.getState()
    if (!st.booted || st.turning !== null || st.spread !== spreadIndex) return
    const z0 = projectPullZ(e)
    if (z0 === null) return
    const pull0 = clamp01(readUserDrive(layer.id) ?? 0)
    st.beginGrab(layer.id, 'tab')
    if (useStorybookStore.getState().grab?.id !== layer.id) return // guard re-check no-oped
    grabRef.current = { z0, pull0 }
    writeUserDrive(layer.id, pull0, [0, 1])
    beginGrabChannel(layer.id, releaseGrab)
    ;(e.target as Element).setPointerCapture(e.pointerId)
    e.stopPropagation()
  }

  const onPointerMove = (e: ThreeEvent<PointerEvent>): void => {
    // Hover truth on MOVE, not just on enter (handle-hover.ts): a pointer
    // parked on the ring through the boot would otherwise read dead forever.
    markHandleHovered(layer.id, spreadIndex)
    const grab = grabRef.current
    if (!grab) return
    if (useStorybookStore.getState().grab?.id !== layer.id) {
      releaseGrab(e)
      return
    }
    const z = projectPullZ(e)
    if (z === null) return
    // Pulling TOWARD the reader is +z, and it is the direction that opens the
    // gates and brings the coach on.
    const pull = clamp01(grab.pull0 + (z - grab.z0) / cfg.pullStroke)
    writeUserDrive(layer.id, pull, [0, 1])
    e.stopPropagation()
  }

  const onPointerOver = (): void => markHandleHovered(layer.id, spreadIndex)
  const onPointerOut = (): void => useStorybookStore.getState().clearHover(layer.id)

  // -------------------------------------------------------------------------
  // The frame loop. Zero React re-renders: every value below lands on an
  // Object3D transform or a material field.
  // -------------------------------------------------------------------------
  useFrame((_, delta) => {
    const root = rootRef.current
    if (!root) return
    const f = frame.current
    const role = liveSpreadRole(spreadIndex, committedSpread.current, f?.dir ?? null)
    const { thetaL, thetaR } = spreadPageAnglesTilted(
      spreadIndex,
      committedSpread.current,
      f?.dir ?? null,
      f ? easeTurnWeighted(f.t) : 0
    )
    const beta = thetaL - thetaR
    const visible = role !== 'hidden' && beta > FLAT_EPSILON
    root.visible = visible
    if (!visible) return

    // --- the reader's drive -------------------------------------------------
    const override = readDriveOverride(layer.id)
    const grabbed = useStorybookStore.getState().grab?.id === layer.id
    const channel = readUserDrive(layer.id)
    let pull: number
    if (override !== null) {
      pull = clamp01(override)
    } else if (grabbed) {
      pull = clamp01(channel ?? 0)
    } else if (channel !== undefined) {
      // Released: the ring springs home, capped so it can never move a vertex
      // faster than an autonomous piece is allowed to (law H2).
      const step = stepUserDriveReturn(
        channel,
        0,
        turnFrames(delta, TURN_MS),
        (a0, a1) => tunnelWorstPullStep(layer, a0, a1),
        STEP_CAP
      )
      pull = clamp01(step.next)
      if (step.settled) clearUserDrive(layer.id)
      else writeUserDrive(layer.id, pull, [0, 1])
    } else {
      pull = 0
    }

    const pose = solveTunnelPose({ beta, pull })
    poseRef.current = pose

    if (scaleRef.current) scaleRef.current.scale.y = pose.groupScaleY
    // The stage folds rigidly about its own front edge: 0 when deployed,
    // -RAKE_ANGLE when the deck has come flat.
    if (stageRef.current) stageRef.current.rotation.x = pose.deckRake - RAKE_ANGLE

    for (const key of TUNNEL_PLANE_ORDER) {
      const g = planeRefs.current[key]
      if (!g) continue
      g.rotation.x = pose.planes[key].hinge
    }

    const gateShift = cfg.gateSlide * pose.gateOpen
    for (const [id, g] of Object.entries(gateRefs.current)) {
      g.position.x = id.endsWith('gate-l') ? -gateShift : gateShift
    }

    const coach = coachRef.current
    if (coach) {
      const z = lerp(cfg.coachZ[0], cfg.coachZ[1], pose.coachT)
      const s = lerp(cfg.coachScale[0], cfg.coachScale[1], pose.coachT)
      // Rides the rake: the base follows the deck surface at its own station.
      coach.position.set(...stageLocal(STAGE.arch.cx, deckY(z), z))
      coach.scale.setScalar(s)
    }
  })

  const tagMesh = (m: THREE.Mesh | null): void => {
    if (m) m.layers.enable(TUNNEL_LAYER)
  }

  return (
    <group ref={rootRef} visible={false} name={`tunnel-${layer.id}`}>
      {/* Lights live OUTSIDE the deploy squash so their positions and their
          shadow frustum stay put while the diorama folds. */}
      <group name="tunnel-lights">
        <ambientLight color="#7f93b8" intensity={0.35} />
        {/* THE MONEY LIGHT: the warm glow deep in the inn. Sitting behind the
            arch mouth, it rims the INNER edge of every die-cut — which is the
            single cue that says "these are separate sheets of paper". */}
        <pointLight
          position={[-0.29, 0.62, -0.34]}
          color="#ffb15e"
          intensity={9}
          distance={2.4}
          decay={2}
          ref={(l) => l?.layers.enable(TUNNEL_LAYER)}
        />
        {/* The rake light, from the reader's upper right: each plane throws its
            shadow onto the plane behind it and across the courtyard floor. That
            raking arch shadow is a primary depth read, not decoration. */}
        <directionalLight
          ref={dirRef}
          position={[1.7, 2.3, 1.9]}
          color="#cfe3ff"
          intensity={1.6}
          castShadow
        />
        <object3D ref={targetRef} position={[0, 0.36, -0.2]} />
        {/* The kitchen burning below the trap. */}
        <pointLight
          position={[-0.69, 0.16, 0.17]}
          color="#ff8a3c"
          intensity={4}
          distance={1.1}
          decay={2}
          ref={(l) => l?.layers.enable(TUNNEL_LAYER)}
        />
      </group>

      <group ref={scaleRef}>
        <group ref={stageRef} position={[0, PIVOT_Y, PIVOT_Z]}>
          {/* the raked deck */}
          <mesh
            ref={tagMesh}
            geometry={built.deckGeometry}
            material={built.deckMaterial}
            castShadow
            receiveShadow
          />

          {/* down the trap */}
          <group position={built.wellPosition}>
            {built.well.map((p) => (
              <mesh
                key={p.id}
                ref={tagMesh}
                geometry={p.geometry}
                material={p.material}
                castShadow
                receiveShadow
              />
            ))}
          </group>

          {/* the six receding planes, each hinged on its own base line */}
          {built.planes.map((plane) => (
            <group
              key={plane.key}
              position={plane.position}
              ref={(g) => {
                if (g) planeRefs.current[plane.key] = g
              }}
            >
              {plane.pieces.map((p) =>
                p.slideKey ? (
                  <group
                    key={p.id}
                    ref={(g) => {
                      if (g) gateRefs.current[`${p.id}|${p.slideKey}`] = g
                    }}
                  >
                    <mesh
                      ref={tagMesh}
                      geometry={p.geometry}
                      material={p.material}
                      castShadow
                      receiveShadow
                    />
                  </group>
                ) : (
                  <mesh
                    key={p.id}
                    ref={tagMesh}
                    geometry={p.geometry}
                    material={p.material}
                    // The sky is the back of the box: it TAKES shadow but casts
                    // none — there is nothing behind it to catch one, and a
                    // caster there would only self-shadow the whole backdrop.
                    castShadow={plane.key !== 'sky'}
                    receiveShadow
                  />
                )
              )}
              {plane.scrim && (
                <mesh
                  position={plane.scrim.position}
                  geometry={plane.scrim.geometry}
                  material={plane.scrim.material}
                  renderOrder={plane.scrim.renderOrder}
                />
              )}
            </group>
          ))}

          {/* the coach, coming up the tunnel on the reader's pull */}
          <group ref={coachRef}>
            <mesh
              ref={tagMesh}
              geometry={built.coachNode.geometry}
              material={built.coachNode.material}
              castShadow
              receiveShadow
            />
          </group>

          {/* THE HANDLE: a brass ring at the fore edge of the deck. */}
          <group
            position={stageLocal(...RING_POS)}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={releaseGrab}
            onPointerOver={onPointerOver}
            onPointerOut={onPointerOut}
          >
            <mesh
              ref={tagMesh}
              rotation={[-Math.PI * 0.25, 0, 0]}
              geometry={built.ringGeometry}
              material={built.ringMaterial}
              castShadow
            />
            {/* Coarse-pointer pad — never drawn, only raycast (handle-hit.ts). */}
            <mesh ref={slopRef} geometry={built.slopGeometry} material={sharedHandleMaterial()} />
          </group>
        </group>
      </group>
    </group>
  )
}
