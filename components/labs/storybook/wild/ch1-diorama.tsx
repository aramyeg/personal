'use client'

/**
 * WILD lane — "Lamplight": the root of the chapter-1 diorama.
 *
 * `PopupSpread` hands spread 2 to this component and renders nothing else for it (D1), so this
 * file owns the group the rest of the book expects to find (`popup-spread-2`, hidden with its
 * role) and everything inside it.
 *
 * WHAT LIVES HERE, AND WHY IT LIVES HERE RATHER THAN IN A CHILD
 *
 *  - The shared state. `WildContext` carries the turn refs plus the two mutable channels every
 *    consumer reads: `wake` (written by the key toy) and `clock` (one wall clock, so no two
 *    drifts can go out of phase because they each integrated their own delta).
 *
 *  - The renderer switches the diorama needs but the book's Canvas does not set: local clipping
 *    (for RISE_CLIP) and a shadow map (book-scene mounts `<Canvas>` with no `shadows`). Both are
 *    saved and restored on unmount, so paging away leaves the rest of the book byte-identical.
 *
 *  - The clip height. RISE_CLIP is a WORLD-space plane and this group sits at the book's
 *    POPUP_Y, so the plane's constant is read off this group's own world matrix rather than
 *    written down — a number copied by hand is a number that drifts when the page stack does.
 *    It is re-read every frame because the desk's parallax rig LIFTS the whole book (up to
 *    ~0.1 world units at the edge of its swing); a height sampled once at mount would let the
 *    page surface climb out from under the plane and slice the base off the inn.
 *
 *  - THE RISE ITSELF. The children build the inn at its final position and never translate for
 *    the reveal; this group does the moving. One owner means the building cannot tear.
 */

import { type RefObject, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'

import type { PopupRole } from '../book/popup-spread'
import type { TurnFrame } from '../book/use-turn-driver'
import { AtmosphereFx } from './atmosphere-fx'
import { CinematicGrade } from './cinematic-grade'
import { InnBuilding } from './inn-building'
import { MASS_APEX_Y, REVEAL } from './inn-model'
import { NightStage } from './night-stage'
import { setRiseClipHeight } from './rise-clip'
import { TheKey } from './the-key'
import { InnWindows } from './windows'
import { ramp, readWildFrame, WildContext, type WildContextValue } from './wild-frame'

// ==== TEMPORARY LOOK-DEV PROXY — DELETE BEFORE REPORTING ====================================
import { HALL, JETTY, CHIMNEY, TOWER, WINDOWS, PALETTE } from './inn-model'
import { applyRiseClip } from './rise-clip'
import { useWild } from './wild-frame'

function MassingProxy() {
  const { wake } = useWild()
  const mat = useMemo(
    () =>
      applyRiseClip(
        new THREE.MeshStandardMaterial({ color: PALETTE.stoneCold, roughness: 0.92, metalness: 0 })
      ),
    []
  )
  const glass = useMemo(() => {
    const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.glassDark) })
    return applyRiseClip(m)
  }, [])
  const litRef = useRef<THREE.Group>(null)

  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    wake.current = p.get('wildwake') ? Number(p.get('wildwake')) : 0
  }, [wake])

  useFrame(() => {
    const g = litRef.current
    if (!g) return
    const w = wake.current
    g.children.forEach((c, i) => {
      const m = (c as THREE.Mesh).material as THREE.MeshBasicMaterial
      const on = w > WINDOWS[i].at ? 1 : 0
      m.color.setRGB(0.05 + 5.2 * on, 0.04 + 3.1 * on, 0.03 + 1.1 * on)
    })
  })

  const boxes = [HALL, JETTY, TOWER, CHIMNEY].map((b) => ({
    min: b.min as unknown as number[],
    max: b.max as unknown as number[],
  }))

  return (
    <group>
      {boxes.map((b, i) => (
        <mesh
          key={i}
          castShadow
          receiveShadow
          material={mat}
          position={[(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2]}
        >
          <boxGeometry args={[b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]]} />
        </mesh>
      ))}
      <group ref={litRef}>
        {WINDOWS.map((w) => (
          <mesh
            key={w.id}
            position={[w.pos[0], w.pos[1], w.pos[2]]}
            rotation={w.facing[0] === 1 ? [0, Math.PI / 2, 0] : [0, 0, 0]}
            material={glass.clone()}
          >
            <planeGeometry args={[w.w, w.h]} />
          </mesh>
        ))}
      </group>
    </group>
  )
}
// ==== END TEMPORARY PROXY ====================================================================

export type Ch1DioramaProps = {
  spreadIndex: number
  role: PopupRole
  frame: RefObject<TurnFrame | null>
  committedSpread: RefObject<number>
}

/**
 * How hard the building brakes on its way up. `ramp` is a smoothstep, so the mass already
 * leaves the paper gently; composing an ease-out cubic on top of it moves the energy to the
 * front of the travel and flattens the last third almost to nothing — the inn arrives at its
 * final height with (very nearly) zero velocity. A building that slams looks like a prop being
 * dropped into place; this one looks like it grew there and stopped growing.
 */
const RISE_BRAKE = 3

function riseSettle(open: number): number {
  const p = ramp(open, REVEAL.rise[0], REVEAL.rise[1])
  return 1 - (1 - p) ** RISE_BRAKE
}

/** World y of an object, straight off its world matrix (element 13 is the translation's y). */
function worldY(object: THREE.Object3D): number {
  object.updateWorldMatrix(true, false)
  return object.matrixWorld.elements[13]
}

export function Ch1Diorama({ spreadIndex, role, frame, committedSpread }: Ch1DioramaProps) {
  const gl = useThree((s) => s.gl)

  const wake = useRef(0)
  const clock = useRef(0)
  const rootRef = useRef<THREE.Group>(null)
  const stageRef = useRef<THREE.Group>(null)
  const riseRef = useRef<THREE.Group>(null)

  const context = useMemo<WildContextValue>(
    () => ({ spreadIndex, frame, committedSpread, wake, clock }),
    [spreadIndex, frame, committedSpread]
  )

  // Renderer capabilities the diorama borrows and gives back. `localClippingEnabled` arms
  // RISE_CLIP; the shadow map is off by default on this Canvas (book-scene mounts no `shadows`
  // prop) and the moon is the only caster in the book, so the diorama switches it on for the
  // life of the spread and hands the renderer back exactly as it found it.
  useEffect(() => {
    const prevLocalClipping = gl.localClippingEnabled
    const prevShadowsEnabled = gl.shadowMap.enabled
    const prevShadowType = gl.shadowMap.type
    gl.localClippingEnabled = true
    gl.shadowMap.enabled = true
    gl.shadowMap.type = THREE.PCFSoftShadowMap
    gl.shadowMap.needsUpdate = true
    return () => {
      gl.localClippingEnabled = prevLocalClipping
      gl.shadowMap.enabled = prevShadowsEnabled
      gl.shadowMap.type = prevShadowType
      gl.shadowMap.needsUpdate = true
    }
  }, [gl])

  // Pin the clip to the page surface before the first frame, so nothing can render for even one
  // frame against a plane at y = 0 (which would be BELOW the page and reveal the buried mass).
  useLayoutEffect(() => {
    const root = rootRef.current
    if (root) setRiseClipHeight(worldY(root))
  }, [])

  useFrame((_, delta) => {
    clock.current += delta

    const root = rootRef.current
    if (!root) return
    setRiseClipHeight(worldY(root))

    const { open, hidden } = readWildFrame(context)

    const stage = stageRef.current
    if (stage) stage.visible = !hidden

    const rise = riseRef.current
    if (rise) rise.position.y = -MASS_APEX_Y * (1 - riseSettle(open))
  })

  const live = role !== 'hidden'

  return (
    <group ref={rootRef} name={`popup-spread-${spreadIndex}`} visible={live}>
      <WildContext.Provider value={context}>
        {/* The composer seizes r3f's render loop for as long as it is mounted, so it mounts
            only while this spread is on screen (current, incoming or outgoing) and unmounts
            the moment the book commits to a neighbour — every other spread renders normally. */}
        {live && <CinematicGrade />}
        <group ref={stageRef}>
          <NightStage />
          {/* The reveal's one moving part. Children build at final position; this translates. */}
          <group ref={riseRef} name="wild-rise" position={[0, -MASS_APEX_Y, 0]}>
            <InnBuilding />
            <InnWindows />
            <MassingProxy />
          </group>
          <AtmosphereFx />
          <TheKey />
        </group>
      </WildContext.Provider>
    </group>
  )
}
