'use client'

/**
 * WILD lane — the brass key toy at the fore edge. Owned by the WAKING implementer.
 *
 * The one thing the reader touches all night. E5 rebuilt how it feels, on the owner's verdict:
 * *"I am not a fond of the key turn mechanism as it is not reliable … the valve should be turning
 * maybe with clicks … right now the interaction looks very clanky if I am not super careful with
 * the handling."* The acceptance is not "it works" — it is that a CARELESS, fast, sloppy drag
 * feels good.
 *
 * THE MECHANISM ITSELF NOW LIVES IN `key-physics.ts`, which imports nothing: no three, no react.
 * That is the point. Three of the four defects behind "clanky" were invisible to careful hands and
 * only appear under bad input, so the mechanism has to be drivable by a script — twelve named
 * bad-input traces at 60 fps, in `scripts/storybook/bench/e5-keyfeel.mjs`. Read that file's header
 * before changing a constant.
 *
 * WHAT THIS FILE IS: the shell. Projection, grab, geometry, feedback. Four things it does that the
 * E4 version did not, each of them a fix for a specific way the key went dead in the hand:
 *
 *   1. THE CLUTCH. `pointermove`/`pointerup` are on WINDOW, and the ray is built from
 *      `clientX/clientY`. r3f re-injects the CAPTURE-TIME intersection whenever a captured pointer
 *      misses the mesh (`@react-three/fiber` events, the `if (!hit) ... capturedEvent` branch), so
 *      a mesh-mounted move handler is guaranteed to freeze the instant the hand leaves the disc,
 *      and then jump when it comes back. That is the prime suspect for "unless I am super
 *      careful". Nothing but pointerup, pointercancel, blur, Escape, or the spread closing may end
 *      a grab: no radius gate, no re-hit test, no hover check.
 *   2. TANGENTIAL MAPPING. `projectHubAngle` onto the page plane, then the physics core measures
 *      how far the hand dragged AROUND the hub over a fixed reference radius — the argument in
 *      `book/handle-projection.ts` CLASS B2-T, which this repo already adopted for the keep winch
 *      after a blind reader found the same defect there.
 *   3. A GENEROUS GRAB. Page-radius OR screen-radius, whichever is kinder, on a hit disc strictly
 *      larger than either. Amnesia's rewrite of Penumbra's crank: *"it is possible to interact
 *      wherever you like."*
 *   4. FEEDBACK ON THE CLICK. One event drives wobble, dip, emissive pulse, halo and a thump, all
 *      on the same frame. No new lights — the pulse is emissive only.
 *
 * `wake` is written from the settled turn, never from the wobble (a wobbling wake would strobe
 * thirty windows), and this component is its only author. No rise clip: the key lies ON the page,
 * so it fades up across REVEAL.dressing with the rest of the courtyard furniture.
 */

import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'

import { projectHubAngle, type HubHit } from '../book/handle-projection'
import { idleClockPinned } from '../book/idle-life'
import { sbSound } from '../sound'
import { useStorybookStore } from '../store'
import { KEY_TOY, PALETTE, REVEAL, STAGE } from './inn-model'
import {
  KEY_FEEL,
  createKeyPhysics,
  keyGrabBegin,
  keyGrabEnd,
  keyNoteDroppedGrab,
  keySample,
  keySeed,
  keyStepDetent,
  keyTick,
  keyWake,
  type KeyClick,
} from './key-physics'
import { damp, ramp, readWildFrame, useWild } from './wild-frame'

const TURN_RAD = KEY_FEEL.turnRad

/** The beckon: a glint and a rock every four seconds until the reader takes hold, then never
 *  again. It leads with a hair of ANTICIPATION (a small counter-rock) so the eye catches the
 *  start of the move rather than only its middle. */
const BECKON_PERIOD = 4.0
const BECKON_LEN = 0.24
const BECKON_AMP = 0.075

const HOVER_LIFT = 0.005
const KEY_Y = 0.019

/** The event the audio layer may adopt. `sbSound.thump()` is the stand-in fired here today; a
 *  dedicated tick in sound.ts is deliberately out of scope. */
export const KEY_CLICK_EVENT = 'wild-key-click'

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v)

/**
 * IS POINTER INPUT SUPPRESSED? A pinned pose (`?sbpose=`) is how every golden capture and every
 * blind reviewer is sent to a spread, and a capture whose key can be nudged by a stray pointer is
 * not a golden. Same predicate as the idle clock's, and the same escape hatch: `?sbidle=1` hands
 * the book back to a human reading a pinned URL.
 */
function pointerPinned(): boolean {
  return idleClockPinned()
}

/** Soft radial glow for the beckon halo — a hand-painted falloff beats an alpha-mapped ring. */
function makeHaloTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 128
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('wild/the-key: 2d canvas context unavailable')
  const g = ctx.createRadialGradient(64, 64, 6, 64, 64, 64)
  g.addColorStop(0, 'rgba(255,214,150,0.85)')
  g.addColorStop(0.38, 'rgba(255,168,74,0.35)')
  g.addColorStop(1, 'rgba(255,140,58,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 128, 128)
  const tex = new THREE.CanvasTexture(canvas)
  tex.generateMipmaps = false
  tex.minFilter = THREE.LinearFilter
  return tex
}

export function TheKey() {
  const ctx = useWild()
  const gl = useThree((s) => s.gl)
  const camera = useThree((s) => s.camera)

  const rootRef = useRef<THREE.Group>(null)
  const keyRef = useRef<THREE.Group>(null)
  const haloRef = useRef<THREE.Mesh>(null)
  const discRef = useRef<THREE.Group>(null)

  const physics = useMemo(() => createKeyPhysics(), [])
  const touchedRef = useRef(false)
  const hoverRef = useRef(false)
  const hoverGlowRef = useRef(0)
  const armedRef = useRef(false)
  /** Live page tilt, republished every frame so the window handlers can build the page basis
   *  without reaching back into the wild frame. */
  const thetaRef = useRef(0)
  const pointerIdRef = useRef<number | null>(null)

  const halo = useMemo(() => makeHaloTexture(), [])

  /** One scratch set for the whole component. Pointer events are strictly one at a time and the
   *  frame loop consumes each value before the next tick, so nothing here may be allocated per
   *  frame — this is a hot path inside the render loop. */
  const scratch = useMemo(
    () => ({
      ndc: new THREE.Vector2(),
      caster: new THREE.Raycaster(),
      ray: new THREE.Ray(),
      inv: new THREE.Matrix4(),
      normal: new THREE.Vector3(),
      world: new THREE.Vector3(),
      center: [0, 0, 0] as [number, number, number],
      e1: [1, 0, 0] as [number, number, number],
      e2: [0, 0, 1] as [number, number, number],
      n: [0, 1, 0] as [number, number, number],
    }),
    [],
  )

  // Posing hook for captures: `?wildwake=` seeds the key itself, not just the wake channel —
  // this component re-stamps `wake` from its own turn every frame, so seeding anything else
  // would be overwritten on the next tick. Seeding the turn keeps key pose and cascade in step.
  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get('wildwake')
    if (raw === null) return
    keySeed(physics, clamp01(Number(raw) || 0))
  }, [physics])

  /** Dev-only telemetry, off unless `?wilddebug=1` — the capture harness and the supervisor's
   *  real-drag review both read the key through this and nothing else. */
  const debugRef = useRef(false)
  useEffect(() => {
    debugRef.current = new URLSearchParams(window.location.search).get('wilddebug') === '1'
  }, [])

  const materials = useMemo(() => {
    // METALNESS IS A TRAP HERE. A true metal with no environment map has nothing to reflect,
    // so at metalness 0.9 the whole toy rendered jet black on near-black cobbles and simply
    // was not there. Brass is faked instead: a half-metal that keeps a diffuse response to the
    // moon, plus an emissive floor so the key always carries its own warmth on the page.
    const brass = new THREE.MeshStandardMaterial({
      color: PALETTE.brass,
      metalness: 0.42,
      roughness: 0.31,
      emissive: new THREE.Color(PALETTE.lamp),
      emissiveIntensity: 0,
      transparent: true,
      opacity: 0,
    })
    const plate = new THREE.MeshStandardMaterial({
      color: '#a8813a',
      metalness: 0.38,
      roughness: 0.5,
      emissive: new THREE.Color(PALETTE.lamp),
      emissiveIntensity: 0,
      transparent: true,
      opacity: 0,
    })
    const hole = new THREE.MeshBasicMaterial({
      color: '#07090f',
      transparent: true,
      opacity: 0,
    })
    const glow = new THREE.MeshBasicMaterial({
      map: halo,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: true,
    })
    return { brass, plate, hole, glow }
  }, [halo])

  useEffect(
    () => () => {
      halo.dispose()
      for (const m of Object.values(materials)) m.dispose()
    },
    [halo, materials],
  )

  // ---------------------------------------------------------------------------------------
  // PROJECTION — window pixels to a point on the escutcheon
  // ---------------------------------------------------------------------------------------

  /**
   * The pointer, in the plate's own polar coordinates. Built from CLIENT PIXELS and the camera,
   * never from an r3f intersection, so it keeps answering when the hand is nowhere near the disc.
   *
   * Returns null only when the ray is too nearly parallel to the page for the intersection to
   * mean anything — a real possibility on the leaned reading camera. The caller must HOLD, not
   * drop: an ill-conditioned frame is not the reader letting go.
   */
  const hitAt = (clientX: number, clientY: number): HubHit | null => {
    const root = rootRef.current
    if (!root || !root.parent) return null
    const rect = gl.domElement.getBoundingClientRect()
    if (rect.width < 1 || rect.height < 1) return null
    scratch.ndc.set(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -(((clientY - rect.top) / rect.height) * 2 - 1),
    )
    scratch.caster.setFromCamera(scratch.ndc, camera)
    scratch.inv.copy(root.parent.matrixWorld).invert()
    scratch.ray.copy(scratch.caster.ray).applyMatrix4(scratch.inv)

    // The page basis at this instant. The escutcheon is set into the COURTYARD, which rides the
    // tilted right page, so the plane the hand is touching is the page plane and not a flat y.
    const th = thetaRef.current
    const sin = Math.sin(th)
    const cos = Math.cos(th)
    scratch.n[0] = -sin
    scratch.n[1] = cos
    scratch.n[2] = 0
    scratch.e1[0] = cos
    scratch.e1[1] = sin
    scratch.e1[2] = 0
    scratch.normal.set(-sin, cos, 0)
    if (Math.abs(scratch.ray.direction.dot(scratch.normal)) < KEY_FEEL.rayMinDot) return null
    return projectHubAngle(scratch.ray, scratch.center, scratch.e1, scratch.e2, scratch.n)
  }

  /** Distance in CSS pixels from a press to the escutcheon's projected centre. The lean makes the
   *  page test noisy along the shallow axis; this one never is, so a press passes on either. */
  const screenDistance = (clientX: number, clientY: number): number => {
    const root = rootRef.current
    if (!root) return Infinity
    const rect = gl.domElement.getBoundingClientRect()
    if (rect.width < 1 || rect.height < 1) return Infinity
    root.getWorldPosition(scratch.world).project(camera)
    const cx = rect.left + ((scratch.world.x + 1) / 2) * rect.width
    const cy = rect.top + ((1 - scratch.world.y) / 2) * rect.height
    return Math.hypot(clientX - cx, clientY - cy)
  }

  const setCursor = (v: string): void => {
    gl.domElement.style.cursor = v
  }

  // ---------------------------------------------------------------------------------------
  // GRAB
  // ---------------------------------------------------------------------------------------

  const beginGrab = (clientX: number, clientY: number, pointerId: number): boolean => {
    if (!armedRef.current || physics.held || pointerPinned()) return false
    if (useStorybookStore.getState().grab) return false
    const hit = hitAt(clientX, clientY)
    const nearPage = hit !== null && hit.r <= KEY_FEEL.grabRPage
    const nearScreen = screenDistance(clientX, clientY) <= KEY_FEEL.grabRPx
    // A refused press is the hardest thing to diagnose from a video, and E4's grab gate was
    // refused ON THE VISIBLE HANDLE for a week. Both gates, and the verdict, in one object.
    if (debugRef.current) {
      ;(window as unknown as { __wildDown?: unknown }).__wildDown = {
        pageR: hit ? hit.r : null,
        pageGate: KEY_FEEL.grabRPage,
        screenPx: screenDistance(clientX, clientY),
        screenGate: KEY_FEEL.grabRPx,
        nearPage,
        nearScreen,
        took: nearPage || nearScreen,
      }
    }
    if (!nearPage && !nearScreen) return false
    // The store's beginGrab silently no-ops before boot and mid-turn (law H2), so it is asked
    // FIRST and its answer is checked. A local drag with no store grab is the exact state §7.5
    // exists to forbid: the page-swipe rule comes back and the reader loses the spread mid-turn.
    useStorybookStore.getState().beginGrab('wild-key', 'knob')
    if (useStorybookStore.getState().grab?.id !== 'wild-key') return false
    touchedRef.current = true
    pointerIdRef.current = pointerId
    keyGrabBegin(physics, hit, performance.now() / 1000)
    setCursor('grabbing')
    return true
  }

  const endGrab = (): void => {
    if (!physics.held) return
    keyGrabEnd(physics, performance.now() / 1000)
    pointerIdRef.current = null
    if (useStorybookStore.getState().grab?.id === 'wild-key') useStorybookStore.getState().endGrab()
    setCursor(hoverRef.current ? 'grab' : '')
  }

  const onPointerDown = (e: ThreeEvent<PointerEvent>): void => {
    if (beginGrab(e.clientX, e.clientY, e.pointerId)) e.stopPropagation()
  }

  const onPointerOver = (): void => {
    hoverRef.current = true
    if (armedRef.current && !physics.held && !pointerPinned()) setCursor('grab')
  }

  const onPointerOut = (): void => {
    hoverRef.current = false
    if (!physics.held) setCursor('')
  }

  // ---------------------------------------------------------------------------------------
  // THE CLUTCH — window-level, and the only thing that ends a drag
  // ---------------------------------------------------------------------------------------

  useEffect(() => {
    const onMove = (e: PointerEvent): void => {
      if (!physics.held) return
      if (pointerIdRef.current !== null && e.pointerId !== pointerIdRef.current) return
      // Backstop for an up we never heard (the pointer left the browser window and came back
      // with the button released). Without pointer capture this is the only signal. MOUSE ONLY:
      // touch contact is specified to report buttons 1, but a browser that gets that wrong would
      // kill every touch drag on its first move — and a dropped grab is the defect being fixed.
      if (e.pointerType === 'mouse' && e.buttons === 0) {
        endGrab()
        return
      }
      keySample(physics, hitAt(e.clientX, e.clientY), performance.now() / 1000)
    }
    const onUp = (e: PointerEvent): void => {
      if (pointerIdRef.current !== null && e.pointerId !== pointerIdRef.current) return
      endGrab()
    }
    const onBlur = (): void => endGrab()
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        endGrab()
        return
      }
      // THE KEYBOARD CLUTCH — the one path that needs no pixel precision at all. `use-book-input`
      // deliberately leaves the vertical arrows unbound (SP-3a), so this cannot fight a page turn.
      if (!armedRef.current || pointerPinned()) return
      if (!hoverRef.current && !physics.held) return
      if (e.key === 'ArrowUp') keyStepDetent(physics, 1)
      else if (e.key === 'ArrowDown') keyStepDetent(physics, -1)
      else return
      e.preventDefault()
    }
    // §1(b): a press that misses the invisible disc but lands within GRAB_R_PX of the projected
    // escutcheon still takes the key. Bubble phase, so the mesh handler above has already run and
    // `physics.held` short-circuits the duplicate.
    const onDown = (e: PointerEvent): void => {
      if (physics.held) return
      if (screenDistance(e.clientX, e.clientY) > KEY_FEEL.grabRPx) return
      beginGrab(e.clientX, e.clientY, e.pointerId)
    }
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    window.addEventListener('blur', onBlur)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      window.removeEventListener('blur', onBlur)
      window.removeEventListener('keydown', onKey)
    }
    // The handlers close over refs and the stable physics object only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [physics])

  /**
   * SINGLE SOURCE OF TRUTH. `use-book-input`'s window backstop can clear the store's grab without
   * this component hearing, and a live local drag against a cleared store grab re-enables the
   * page-swipe rule — i.e. the reader loses the whole spread mid-turn. Follow the store down.
   */
  useEffect(() => {
    const unsub = useStorybookStore.subscribe((st) => {
      if (physics.held && st.grab?.id !== 'wild-key') {
        keyNoteDroppedGrab(physics, performance.now() / 1000)
        pointerIdRef.current = null
        setCursor(hoverRef.current ? 'grab' : '')
      }
    })
    return unsub
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [physics])

  useEffect(
    () => () => {
      gl.domElement.style.cursor = ''
      if (useStorybookStore.getState().grab?.id === 'wild-key') useStorybookStore.getState().endGrab()
    },
    [gl],
  )

  // ---------------------------------------------------------------------------------------
  // FRAME
  // ---------------------------------------------------------------------------------------

  /**
   * ONE CLICK, ALL CHANNELS, SAME FRAME. The physics core has already kicked the wobble, the dip,
   * the emissive and the halo (they are its state, so the bench can gate them); what is left here
   * is everything that needs the page: the sound, and an event the rest of the lab can adopt.
   */
  const fireFeedback = (click: KeyClick): void => {
    sbSound.thump()
    window.dispatchEvent(new CustomEvent<KeyClick>(KEY_CLICK_EVENT, { detail: click }))
  }

  useFrame((_, rawDelta) => {
    const root = rootRef.current
    const key = keyRef.current
    if (!root || !key) return
    const dt = Math.min(rawDelta, 1 / 30)
    const f = readWildFrame(ctx)
    thetaRef.current = f.thetaR

    const fade = ramp(f.open, REVEAL.dressing[0], REVEAL.dressing[1])
    const shown = !f.hidden && fade > 0.01
    root.visible = shown
    armedRef.current = shown && f.open > 0.9
    if (!armedRef.current && physics.held) endGrab()
    if (!shown) return

    // The escutcheon is set into the COURTYARD, not the page: the cobble halves ride the tilted
    // page planes, so at this x the paving stands sin(thetaR)*x above flat — a key seated at
    // page height is a key buried under the stones. Position FIRST, because the pointer plane is
    // built through this point and a frame-late centre is a frame-late grab.
    const pavingY = Math.sin(f.thetaR) * KEY_TOY.center[0] + STAGE.cobbleY + 0.002
    hoverGlowRef.current = damp(hoverGlowRef.current, hoverRef.current || physics.held ? 1 : 0, 11, dt)
    root.position.set(
      KEY_TOY.center[0],
      KEY_TOY.center[1] + pavingY + HOVER_LIFT * hoverGlowRef.current,
      KEY_TOY.center[2],
    )
    scratch.center[0] = root.position.x
    scratch.center[1] = root.position.y
    scratch.center[2] = root.position.z
    // The hit disc lies IN the page plane, not flat: the paving is tilted, so a horizontal disc
    // puts the hit point somewhere the reader is not looking.
    if (discRef.current) discRef.current.rotation.z = f.thetaR

    keyTick(physics, dt)
    for (let i = 0; i < physics.events.length; i++) fireFeedback(physics.events[i])

    const turn = keyWake(physics)
    ctx.wake.current = turn

    if (debugRef.current) {
      ;(window as unknown as { __wildKey?: unknown }).__wildKey = {
        turn,
        target: physics.target,
        vel: physics.vel,
        seatedIndex: physics.seatedIndex,
        clicks: physics.clicks,
        dragging: physics.held,
        armed: armedRef.current,
        droppedGrabs: physics.droppedGrabs,
        samplesDiscarded: physics.samplesDiscarded,
        samplesDegenerate: physics.samplesDegenerate,
        samplesRateCapped: physics.samplesRateCapped,
        /** Camera roll impulse, radians. Nothing consumes it yet — the rig owner has to opt in. */
        roll: physics.roll,
      }
    }

    // THE BECKON. Anticipation first (a small counter-rock), then the sweep back, under an
    // envelope so it starts and ends at rest. Retired the instant the key is touched.
    let beckonRock = 0
    let glint = 0
    if (!touchedRef.current && armedRef.current) {
      const phase = (f.time % BECKON_PERIOD) / BECKON_PERIOD
      if (phase < BECKON_LEN) {
        const w = phase / BECKON_LEN
        const env = Math.sin(w * Math.PI)
        beckonRock = Math.sin(w * Math.PI * 2 + Math.PI) * env * BECKON_AMP
        glint = env * env
      }
    }

    key.rotation.y = -turn * TURN_RAD + physics.wobble + beckonRock
    // The click's dip: the bit dropping a hair into the wards. Page units, gone in 70 ms.
    key.position.y = KEY_Y - physics.dip

    const lit = 0.52 + 0.55 * hoverGlowRef.current + 0.95 * glint + 0.45 * turn + physics.pulse
    materials.brass.emissiveIntensity = lit
    materials.plate.emissiveIntensity = lit * 0.42
    materials.brass.opacity = fade
    materials.plate.opacity = fade
    materials.hole.opacity = fade

    const haloMesh = haloRef.current
    if (haloMesh) {
      const strength =
        0.3 * glint + 0.22 * hoverGlowRef.current + 0.3 * turn + KEY_FEEL.haloOpacity * physics.halo
      materials.glow.opacity = strength * fade
      haloMesh.visible = strength > 0.004
      const s = 1 + 0.16 * glint + KEY_FEEL.haloScale * physics.halo
      haloMesh.scale.set(s, s, 1)
    }
  })

  // ---------------------------------------------------------------------------------------
  // GEOMETRY — a flat great key standing in a brass escutcheon, both lying in the page
  // ---------------------------------------------------------------------------------------

  const R = KEY_TOY.escutcheonRadius
  const bowZ = KEY_TOY.shaftLength + KEY_TOY.bowRadius

  return (
    <group ref={rootRef} name="wild-key" visible={false}>
      {/* The reader's grab surface, lying IN the page plane. Strictly larger than either grab
          gate, so a press that qualifies always has a surface under it — and because the press
          is the only thing this mesh does now (move and up are on window), an oversized disc
          costs nothing: a press that does not qualify never stops propagating. */}
      <group ref={discRef}>
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0.02, 0]}
          renderOrder={-5}
          onPointerDown={onPointerDown}
          onPointerOver={onPointerOver}
          onPointerOut={onPointerOut}
        >
          <circleGeometry args={[KEY_FEEL.hitDiscR, 28]} />
          <meshBasicMaterial colorWrite={false} depthWrite={false} transparent opacity={0} />
        </mesh>
      </group>

      {/* Beckon halo, flat on the page under the plate. */}
      <mesh ref={haloRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.0015, 0]} renderOrder={2} material={materials.glow} visible={false}>
        <planeGeometry args={[R * 4.4, R * 4.4]} />
      </mesh>

      {/* Escutcheon: a sunk brass plate, a proud rim, and the dark of the lock behind it. */}
      <mesh position={[0, 0.005, 0]} material={materials.plate}>
        <cylinderGeometry args={[R, R * 1.02, 0.010, 40]} />
      </mesh>
      <mesh position={[0, 0.010, 0]} rotation={[-Math.PI / 2, 0, 0]} material={materials.plate}>
        <torusGeometry args={[R * 0.94, 0.008, 8, 44]} />
      </mesh>
      <mesh position={[0, 0.0102, 0]} rotation={[-Math.PI / 2, 0, 0]} material={materials.hole}>
        <circleGeometry args={[R * 0.30, 20]} />
      </mesh>

      {/* The key. Its origin is the escutcheon's centre, so rotation.y IS the turn. */}
      <group ref={keyRef} position={[0, KEY_Y, 0]}>
        {/* shaft, running out toward the reader at rest */}
        <mesh position={[0, 0, KEY_TOY.shaftLength * 0.5]} material={materials.brass}>
          <boxGeometry args={[0.015, 0.011, KEY_TOY.shaftLength]} />
        </mesh>
        {/* wards — two teeth on one side only, which is what makes a bar read as a key */}
        <mesh position={[0.019, 0, 0.026]} material={materials.brass}>
          <boxGeometry args={[0.026, 0.010, 0.013]} />
        </mesh>
        <mesh position={[0.016, 0, 0.050]} material={materials.brass}>
          <boxGeometry args={[0.020, 0.010, 0.011]} />
        </mesh>
        {/* collar between shaft and bow */}
        <mesh position={[0, 0, KEY_TOY.shaftLength * 0.86]} rotation={[0, 0, Math.PI / 2]} material={materials.brass}>
          <cylinderGeometry args={[0.014, 0.014, 0.010, 16]} />
        </mesh>
        {/* bow — the handle the eye reads as "turn me" */}
        <mesh position={[0, 0, bowZ]} rotation={[-Math.PI / 2, 0, 0]} material={materials.brass}>
          <torusGeometry args={[KEY_TOY.bowRadius, 0.011, 10, 36]} />
        </mesh>
        {/* three bosses round the bow, so the turn is legible even at thumbnail size */}
        {[-0.85, 0, 0.85].map((a) => (
          <mesh
            key={a}
            position={[
              Math.sin(a) * KEY_TOY.bowRadius,
              0,
              bowZ + Math.cos(a) * KEY_TOY.bowRadius,
            ]}
            material={materials.brass}
          >
            <sphereGeometry args={[0.0125, 10, 8]} />
          </mesh>
        ))}
      </group>
    </group>
  )
}
