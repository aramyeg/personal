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
 *    page surface climb out from under the plane and slice the base off the inn. Nothing rises
 *    through the plane any more — it is now purely the floor that keeps the fold-birth from ever
 *    showing paper under the paper.
 *
 *  - THE FOLD-BIRTH ITSELF. The inn no longer grows out of the page through a clipping plane; it
 *    ERECTS, in seven separated hinge events (wild/fold-birth.ts). This component is the single
 *    owner of that solve: once per frame it poses every chunk and writes the result into the
 *    shared fold uniforms, so no two consumers can ever disagree about where a piece is.
 */

import { type RefObject, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'

import type { PopupRole } from '../book/popup-spread'
import type { TurnFrame } from '../book/use-turn-driver'
import { AtmosphereFx } from './atmosphere-fx'
import { CinematicGrade, warmGradePrograms } from './cinematic-grade'
import { createLandingWatch, solveFoldBirth } from './fold-birth'
import { writeFoldPoses } from './fold-uniforms'
import { InnBuilding } from './inn-building'
import { innMaterials, skinTextures } from './inn-materials'
import { NightStage, nightArt } from './night-stage'
import { setRiseClipHeight } from './rise-clip'
import { TheKey } from './the-key'
import { InnWindows, windowAtlases } from './windows'
import { readWildFrame, WildContext, type WildContextValue } from './wild-frame'
import { scheduleWildWarmup } from './warmup'

// The diorama's procedural painting starts warming the moment the book's bundle loads —
// one paint per idle slice — so the page-turn that mounts this spread finds every cache hot
// instead of paying ~15M canvas pixel ops in a single dead frame (see wild/warmup.ts).
scheduleWildWarmup([
  () => skinTextures('stone'),
  () => skinTextures('timber'),
  () => skinTextures('shingle'),
  () => skinTextures('brick'),
  () => skinTextures('sign'),
  () => innMaterials(),
  () => windowAtlases(),
  () => nightArt(),
])

export type Ch1DioramaProps = {
  spreadIndex: number
  role: PopupRole
  frame: RefObject<TurnFrame | null>
  committedSpread: RefObject<number>
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
  /** Last `open` the fold was solved at, so a resting spread allocates nothing per frame. */
  const solvedOpen = useRef(Number.NaN)
  const landingWatch = useMemo(() => createLandingWatch(), [])

  const context = useMemo<WildContextValue>(
    () => ({ spreadIndex, frame, committedSpread, wake, clock }),
    [spreadIndex, frame, committedSpread]
  )

  // THE POSING HOOK. `?wildwake=0.62` drops the key's turn straight into the channel the toy
  // otherwise owns, so a capture can be taken at a chosen point in the cascade and compared
  // against the last one taken there. Read once at mount; the toy takes the channel back the
  // moment it is on screen and grabbable.
  useEffect(() => {
    const param = new URLSearchParams(window.location.search).get('wildwake')
    if (param === null) return
    const value = Number(param)
    if (Number.isFinite(value)) wake.current = value
  }, [])

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

  // Warm the grade chain's programs while the spread is still shut. The scene-graph materials
  // are covered by the book's own E-G4 `gl.compile` pass (which runs on mount, at load — and
  // whose header documents that `compileAsync` CRASHES on this scene's materials, so none of
  // that here); the composer's passes are NOT in the scene graph, so they get this one
  // idle-time warm render instead of a ~1s link stall on arrival at the chapter.
  useEffect(() => {
    let cancelled = false
    const kick = (): void => {
      if (!cancelled) warmGradePrograms(gl)
    }
    const idle: number | ReturnType<typeof setTimeout> =
      typeof window.requestIdleCallback === 'function'
        ? window.requestIdleCallback(kick, { timeout: 1500 })
        : setTimeout(kick, 300)
    return () => {
      cancelled = true
      if (typeof window.cancelIdleCallback === 'function' && typeof idle === 'number')
        window.cancelIdleCallback(idle)
      else clearTimeout(idle as ReturnType<typeof setTimeout>)
    }
  }, [gl])

  // Pin the clip to the page surface before the first frame, so nothing can render for even one
  // frame against a plane at y = 0 (which would be BELOW the page and reveal the buried mass).
  useLayoutEffect(() => {
    const root = rootRef.current
    if (root) setRiseClipHeight(worldY(root))
  }, [])

  // PRIORITY -1, and it matters. r3f runs frame subscribers in ascending priority, and children
  // subscribe before their parents — so at the default priority this callback would land AFTER
  // the sign, the lantern and the keys had already read the fold matrices, and those three would
  // ride one frame behind the merged inn for the whole turn. A negative priority runs first and
  // (unlike a positive one, which is how the grade seizes the loop) does not claim rendering.
  useFrame((_, delta) => {
    clock.current += delta

    const root = rootRef.current
    if (!root) return
    setRiseClipHeight(worldY(root))

    const { open } = readWildFrame(context)

    // The stage is NEVER hidden by visibility: flipping it would change the renderer's
    // visible-light set, and a light-count change re-links every program in the scene — the
    // ~1s dead frames the production profile caught on arrival and at the first drag. While
    // the spread is closed everything hides itself instead: the building is folded dead flat
    // into the page, and every card, pool, beam and glow fades by `open`/`stage` to zero.

    // THE FOLD-BIRTH. Solved once, written once. Skipped entirely while `open` holds still —
    // which is every frame the reader is not turning the page, i.e. almost all of them.
    if (open !== solvedOpen.current) {
      solvedOpen.current = open
      const poses = solveFoldBirth(open)
      writeFoldPoses(poses)
      landingWatch(poses)
    }
  }, -1)

  const live = role !== 'hidden'

  return (
    // Always visible for the same light-count reason as the stage gate above; `live` only
    // decides whether the grade owns presentation.
    <group ref={rootRef} name={`popup-spread-${spreadIndex}`}>
      <WildContext.Provider value={context}>
        {/* The composer seizes r3f's render loop for as long as it is mounted, so it mounts
            only while this spread is on screen (current, incoming or outgoing) and unmounts
            the moment the book commits to a neighbour — every other spread renders normally. */}
        {live && <CinematicGrade />}
        <group ref={stageRef}>
          <NightStage />
          {/* No transform here any more: the inn is authored at its final position and every
              moving piece is swung up about its own crease by the fold uniforms. */}
          <group name="wild-fold">
            <InnBuilding />
            <InnWindows />
          </group>
          <AtmosphereFx />
          <TheKey />
        </group>
      </WildContext.Provider>
    </group>
  )
}
