'use client'

import { useEffect, useRef, type RefObject } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { PLAYER, clampToRegions, floorY } from './layout'
import { GROUNDED, fovTarget, speedFor, stepJump, tryJump, type JumpState } from './movement'

export type MoveVec = { x: number; y: number }

const KEYMAP: Record<string, [keyof MoveVec, number]> = {
  KeyW: ['y', 1], ArrowUp: ['y', 1],
  KeyS: ['y', -1], ArrowDown: ['y', -1],
  KeyA: ['x', -1], ArrowLeft: ['x', -1],
  KeyD: ['x', 1], ArrowRight: ['x', 1],
}

/**
 * Chrome's requestPointerLock returns a Promise that can reject
 * (WrongDocumentError/SecurityError); Firefox returns undefined. The DOM lib
 * types it as void, so cast through unknown to guard the rejection safely.
 */
function requestPointerLockSafe(el: Element) {
  const result = (el.requestPointerLock() as unknown) as Promise<void> | undefined
  result?.catch?.(() => {})
}

/**
 * First-person rig: pointer-lock mouse look + WASD on desktop,
 * drag-look + joystick vector on touch. Camera stays at eye height,
 * clamped inside the hall.
 */
export function PlayerControls({
  length,
  moveRef,
}: {
  length: number
  moveRef: RefObject<MoveVec>
}) {
  const { camera, gl } = useThree()
  const yaw = useRef(0) // face down the hall (-z); 0 = camera default -Z
  const pitch = useRef(0)
  const keys = useRef<MoveVec>({ x: 0, y: 0 })
  const pressed = useRef(new Set<string>())
  const sprint = useRef(false)
  const jump = useRef<JumpState>(GROUNDED)

  useEffect(() => {
    const el = gl.domElement

    const recomputeKeys = () => {
      const v = { x: 0, y: 0 }
      for (const code of pressed.current) {
        const m = KEYMAP[code]
        if (m) v[m[0]] += m[1]
      }
      keys.current = { x: Math.sign(v.x), y: Math.sign(v.y) }
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') { sprint.current = true; return }
      if (e.code === 'Space') { jump.current = tryJump(jump.current); e.preventDefault(); return }
      if (KEYMAP[e.code]) { pressed.current.add(e.code); recomputeKeys(); e.preventDefault() }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') { sprint.current = false; return }
      pressed.current.delete(e.code); recomputeKeys()
    }

    const onClick = () => {
      if (document.pointerLockElement !== el) requestPointerLockSafe(el)
    }
    const onMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement !== el) return
      yaw.current -= e.movementX * 0.0022
      pitch.current = Math.max(-1.2, Math.min(1.2, pitch.current - e.movementY * 0.0022))
    }

    // Touch look: one-finger drag anywhere on the canvas
    let lastTouch: { x: number; y: number } | null = null
    const onTouchStart = (e: TouchEvent) => {
      lastTouch = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    }
    const onTouchMove = (e: TouchEvent) => {
      if (!lastTouch) return
      const t = e.touches[0]
      yaw.current -= (t.clientX - lastTouch.x) * 0.005
      pitch.current = Math.max(-1.2, Math.min(1.2, pitch.current - (t.clientY - lastTouch.y) * 0.005))
      lastTouch = { x: t.clientX, y: t.clientY }
    }
    const onTouchEnd = () => { lastTouch = null }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    el.addEventListener('click', onClick)
    window.addEventListener('mousemove', onMouseMove)
    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: true })
    el.addEventListener('touchend', onTouchEnd)

    // Dev-only probe for orchestrator gate walkthroughs (mirrors snowpark's __powder).
    if (process.env.NODE_ENV !== 'production') {
      ;(window as unknown as Record<string, unknown>).__museum = {
        pos: () => camera.position.toArray(),
        place: (x: number, z: number, yawRad: number) => {
          yaw.current = yawRad
          camera.position.set(x, 0, z) // y is recomputed by the next frame's floorY
        },
      }
    }

    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      el.removeEventListener('click', onClick)
      window.removeEventListener('mousemove', onMouseMove)
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
      if (process.env.NODE_ENV !== 'production') {
        delete (window as unknown as Record<string, unknown>).__museum
      }
    }
  }, [gl, camera])

  useFrame((_, delta) => {
    camera.rotation.set(pitch.current, yaw.current, 0, 'YXZ')

    const dt = Math.min(delta, 0.05)
    jump.current = stepJump(jump.current, dt)

    const joy = moveRef.current ?? { x: 0, y: 0 }
    const mx = keys.current.x + joy.x
    const my = keys.current.y + joy.y
    const moving = mx !== 0 || my !== 0

    // Sprint FOV: widen while running, settle back when not.
    const cam = camera as THREE.PerspectiveCamera
    const fov = THREE.MathUtils.lerp(cam.fov, fovTarget(sprint.current, moving), Math.min(1, delta * 8))
    if (Math.abs(fov - cam.fov) > 0.01) {
      cam.fov = fov
      cam.updateProjectionMatrix()
    }

    if (!moving) {
      camera.position.y = floorY(camera.position.z, length) + PLAYER.eyeHeight + jump.current.offset
      return
    }

    // Normalize so diagonals and stacked keyboard+joystick don't exceed unit speed.
    const len = Math.hypot(mx, my)
    const nx2 = len > 1 ? mx / len : mx
    const ny2 = len > 1 ? my / len : my

    const dir = new THREE.Vector3()
    camera.getWorldDirection(dir)
    dir.y = 0
    dir.normalize()
    const right = new THREE.Vector3(dir.z, 0, -dir.x).negate()

    const step = speedFor(PLAYER.speed, sprint.current) * dt
    const nx = camera.position.x + (dir.x * ny2 + right.x * nx2) * step
    const nz = camera.position.z + (dir.z * ny2 + right.z * nx2) * step
    const clamped = clampToRegions(
      { x: camera.position.x, z: camera.position.z },
      { x: nx, z: nz },
      length
    )
    camera.position.set(
      clamped.x,
      floorY(clamped.z, length) + PLAYER.eyeHeight + jump.current.offset,
      clamped.z
    )
  })

  return null
}
