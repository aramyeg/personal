'use client'

/**
 * WILD lane — the brass key toy at the fore edge. Owned by the WAKING implementer.
 *
 * The one thing the reader touches all night, so the whole file is about how it feels in the
 * hand. Three separate things make the weight:
 *
 *   1. LAG — the drawn angle `damp()`s toward the angle the pointer is asking for, so the key
 *      trails the hand the way something heavy does. The hand never moves the key directly.
 *   2. MAGNETISM — inside a detent's capture radius a spring pulls the key the rest of the way
 *      in, so the notches suck the ball home instead of merely snapping on release.
 *   3. THE CLICK — crossing a detent kicks a small underdamped wobble spring that lives only in
 *      the drawn angle. The bit springing in the wards; three degrees, gone in a third of a
 *      second, and it never touches `wake` (a wobbling wake would strobe thirty windows).
 *
 * `wake` is written from the settled turn, not the wobble, and this component is its only
 * author. No rise clip: the key lies ON the page, it does not grow out of it, so it fades up
 * across REVEAL.dressing with the rest of the courtyard furniture instead.
 */

import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'

import { useStorybookStore } from '../store'
import { KEY_TOY, PALETTE, REVEAL, STAGE } from './inn-model'
import { damp, ramp, readWildFrame, useWild } from './wild-frame'

const TURN_RAD = (KEY_TOY.turnDeg * Math.PI) / 180

/** How closely the drawn angle chases the pointer. Low enough to feel like brass. */
const FOLLOW_LAMBDA = 13
/** Turn fractions within which a detent starts to pull. The detents sit 0.34 apart, so this
 *  leaves most of the sweep free — the notches are punctuation, not a quantiser. */
const DETENT_R = 0.075
const MAGNET = 7.5
/** Wobble spring: omega ~ 22.8 rad/s, zeta ~ 0.58 — one visible bounce, then gone. */
const WOBBLE_K = 520
const WOBBLE_C = 27
const WOBBLE_KICK = 1.25

/** The beckon: a glint and a rock every four seconds until the reader takes hold, then never
 *  again. It leads with a hair of ANTICIPATION (a small counter-rock) so the eye catches the
 *  start of the move rather than only its middle. */
const BECKON_PERIOD = 4.0
const BECKON_LEN = 0.24
const BECKON_AMP = 0.075

const HOVER_LIFT = 0.005
const KEY_Y = 0.019

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v)

/** Shortest signed way round from one angle to another. */
function wrapDelta(d: number): number {
  let x = d
  while (x > Math.PI) x -= Math.PI * 2
  while (x < -Math.PI) x += Math.PI * 2
  return x
}

function nearestDetent(turn: number): number {
  let best = KEY_TOY.detents[0]
  let bestD = Infinity
  for (const d of KEY_TOY.detents) {
    const dist = Math.abs(d - turn)
    if (dist < bestD) {
      bestD = dist
      best = d
    }
  }
  return best
}

function detentCell(turn: number): number {
  let best = 0
  let bestD = Infinity
  KEY_TOY.detents.forEach((d, i) => {
    const dist = Math.abs(d - turn)
    if (dist < bestD) {
      bestD = dist
      best = i
    }
  })
  return best
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

  const rootRef = useRef<THREE.Group>(null)
  const keyRef = useRef<THREE.Group>(null)
  const haloRef = useRef<THREE.Mesh>(null)

  /** Where the pointer says the key should be. */
  const targetRef = useRef(0)
  /** Where the key actually is — what `wake` is written from. */
  const turnRef = useRef(0)
  const wobbleRef = useRef(0)
  const wobbleVRef = useRef(0)
  const cellRef = useRef(0)
  const dragRef = useRef<{ last: number } | null>(null)
  const touchedRef = useRef(false)
  const hoverRef = useRef(false)
  const hoverGlowRef = useRef(0)
  const armedRef = useRef(false)

  const halo = useMemo(() => makeHaloTexture(), [])

  // Posing hook for captures: `?wildwake=` seeds the key itself, not just the wake channel —
  // this component re-stamps `wake` from its own turn every frame, so seeding anything else
  // would be overwritten on the next tick. Seeding the turn keeps key pose and cascade in step.
  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get('wildwake')
    if (raw === null) return
    const v = clamp01(Number(raw) || 0)
    targetRef.current = v
    turnRef.current = v
    cellRef.current = detentCell(v)
  }, [])

  /** Dev-only telemetry, off unless `?wilddebug=1` — the capture harness reads the turn. */
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
  // POINTER
  // ---------------------------------------------------------------------------------------

  const tmp = useMemo(() => new THREE.Vector3(), [])

  /** Pointer position on the page, as an angle about the escutcheon. 0 points at the reader. */
  const angleAt = (e: ThreeEvent<PointerEvent>): number | null => {
    const root = rootRef.current
    if (!root || !root.parent) return null
    const p = root.parent.worldToLocal(tmp.copy(e.point))
    const dx = p.x - KEY_TOY.center[0]
    const dz = p.z - KEY_TOY.center[2]
    if (dx * dx + dz * dz < 1e-6) return null
    return Math.atan2(dx, dz)
  }

  const setCursor = (v: string): void => {
    gl.domElement.style.cursor = v
  }

  const release = (e?: ThreeEvent<PointerEvent> | null): void => {
    if (!dragRef.current) return
    dragRef.current = null
    useStorybookStore.getState().endGrab()
    setCursor(hoverRef.current ? 'grab' : '')
    // The hand lets go inside a notch: finish the job rather than leaving it half-seated.
    const near = nearestDetent(targetRef.current)
    if (Math.abs(near - targetRef.current) < DETENT_R * 1.5) targetRef.current = near
    try {
      if (e) (e.target as Element).releasePointerCapture(e.pointerId)
    } catch {
      // capture already gone — nothing to release
    }
  }

  const onPointerDown = (e: ThreeEvent<PointerEvent>): void => {
    if (!armedRef.current) return
    const root = rootRef.current
    if (!root || !root.parent) return
    const p = root.parent.worldToLocal(tmp.copy(e.point))
    const dx = p.x - KEY_TOY.center[0]
    const dz = p.z - KEY_TOY.center[2]
    if (debugRef.current) {
      ;(window as unknown as { __wildDown?: unknown }).__wildDown = {
        point: e.point.toArray(),
        local: [p.x, p.y, p.z],
        dist: Math.hypot(dx, dz),
        gate: KEY_TOY.grabRadius + KEY_TOY.bowRadius,
      }
    }
    // The grab disc is deliberately wider than the hit floor so a drag that swings the bow out
    // past the escutcheon keeps producing intersections; the GRAB itself is gated tight.
    if (Math.hypot(dx, dz) > KEY_TOY.grabRadius + KEY_TOY.bowRadius) return
    const a = angleAt(e)
    if (a === null) return
    touchedRef.current = true
    useStorybookStore.getState().beginGrab('wild-key', 'knob')
    dragRef.current = { last: a }
    setCursor('grabbing')
    try {
      ;(e.target as Element).setPointerCapture(e.pointerId)
    } catch {
      // no capture available (synthetic pointer) — the drag still tracks via move events
    }
    e.stopPropagation()
  }

  const onPointerMove = (e: ThreeEvent<PointerEvent>): void => {
    const drag = dragRef.current
    if (!drag) return
    const a = angleAt(e)
    if (a === null) return
    // The key turns CLOCKWISE to the reader, which is negative rotation about +y, so a
    // decreasing pointer angle is an increasing turn.
    const d = wrapDelta(a - drag.last)
    drag.last = a
    targetRef.current = clamp01(targetRef.current - d / TURN_RAD)
    e.stopPropagation()
  }

  const onPointerOver = (): void => {
    hoverRef.current = true
    if (armedRef.current && !dragRef.current) setCursor('grab')
  }

  const onPointerOut = (): void => {
    hoverRef.current = false
    if (!dragRef.current) setCursor('')
  }

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

  useFrame((_, rawDelta) => {
    const root = rootRef.current
    const key = keyRef.current
    if (!root || !key) return
    const dt = Math.min(rawDelta, 1 / 30)
    const f = readWildFrame(ctx)

    const fade = ramp(f.open, REVEAL.dressing[0], REVEAL.dressing[1])
    const shown = !f.hidden && fade > 0.01
    root.visible = shown
    armedRef.current = shown && f.open > 0.9
    if (!armedRef.current && dragRef.current) release(null)
    if (!shown) return

    // 1 — LAG. The hand asks; the brass follows.
    let turn = damp(turnRef.current, targetRef.current, FOLLOW_LAMBDA, dt)

    // 2 — MAGNETISM. Inside the capture radius a detent pulls, hardest at its lip and easing
    // to nothing at dead centre so the key seats rather than buzzing in the notch.
    const near = nearestDetent(turn)
    const gap = near - turn
    const inside = 1 - Math.min(1, Math.abs(gap) / DETENT_R)
    if (inside > 0) turn += gap * Math.min(1, MAGNET * inside * dt)
    turn = clamp01(turn)

    // 3 — THE CLICK. A crossing kicks the wobble spring in the direction of travel.
    const cell = detentCell(turn)
    if (cell !== cellRef.current) {
      wobbleVRef.current += Math.sign(turn - turnRef.current || 1) * WOBBLE_KICK
      cellRef.current = cell
    }
    wobbleVRef.current += (-WOBBLE_K * wobbleRef.current - WOBBLE_C * wobbleVRef.current) * dt
    wobbleRef.current += wobbleVRef.current * dt

    turnRef.current = turn
    ctx.wake.current = turn

    if (debugRef.current) {
      ;(window as unknown as { __wildKey?: unknown }).__wildKey = {
        turn,
        target: targetRef.current,
        dragging: !!dragRef.current,
        armed: armedRef.current,
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

    key.rotation.y = -turn * TURN_RAD + wobbleRef.current + beckonRock

    // HOVER: brighter and a whisker off the page. Light and lift, both damped, neither
    // large enough to be mistaken for the turn itself.
    hoverGlowRef.current = damp(
      hoverGlowRef.current,
      hoverRef.current || dragRef.current ? 1 : 0,
      11,
      dt,
    )
    // The escutcheon is set into the COURTYARD, not the page: the cobble halves ride the tilted
    // page planes, so at this x the paving stands sin(thetaR)*x above flat — a key seated at
    // page height is a key buried under the stones.
    const pavingY = Math.sin(f.thetaR) * KEY_TOY.center[0] + STAGE.cobbleY + 0.002
    root.position.set(
      KEY_TOY.center[0],
      KEY_TOY.center[1] + pavingY + HOVER_LIFT * hoverGlowRef.current,
      KEY_TOY.center[2],
    )

    const lit = 0.52 + 0.55 * hoverGlowRef.current + 0.95 * glint + 0.45 * turn
    materials.brass.emissiveIntensity = lit
    materials.plate.emissiveIntensity = lit * 0.42
    materials.brass.opacity = fade
    materials.plate.opacity = fade
    materials.hole.opacity = fade

    const haloMesh = haloRef.current
    if (haloMesh) {
      const strength = 0.30 * glint + 0.22 * hoverGlowRef.current + 0.30 * turn
      materials.glow.opacity = strength * fade
      haloMesh.visible = strength > 0.004
      const s = 1 + 0.16 * glint
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
      {/* The reader's grab surface. Wide enough that a bow swung right out past the plate is
          still over it, invisible because it writes neither colour nor depth. */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.02, 0]}
        renderOrder={-5}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={release}
        onPointerCancel={release}
        onLostPointerCapture={release}
        onPointerOver={onPointerOver}
        onPointerOut={onPointerOut}
      >
        <circleGeometry args={[R + KEY_TOY.shaftLength + KEY_TOY.bowRadius * 2.4, 24]} />
        <meshBasicMaterial colorWrite={false} depthWrite={false} transparent opacity={0} />
      </mesh>

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
