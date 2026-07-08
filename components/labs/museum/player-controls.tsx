'use client'

import { useEffect, useRef, type RefObject } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { PLAYER, clampToHall } from './layout'

export type MoveVec = { x: number; y: number }

const KEYMAP: Record<string, [keyof MoveVec, number]> = {
  KeyW: ['y', 1], ArrowUp: ['y', 1],
  KeyS: ['y', -1], ArrowDown: ['y', -1],
  KeyA: ['x', -1], ArrowLeft: ['x', -1],
  KeyD: ['x', 1], ArrowRight: ['x', 1],
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
  const yaw = useRef(Math.PI) // face down the hall (-z)
  const pitch = useRef(0)
  const keys = useRef<MoveVec>({ x: 0, y: 0 })
  const pressed = useRef(new Set<string>())

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
      if (KEYMAP[e.code]) { pressed.current.add(e.code); recomputeKeys(); e.preventDefault() }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      pressed.current.delete(e.code); recomputeKeys()
    }

    const onClick = () => {
      if (document.pointerLockElement !== el) el.requestPointerLock()
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
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      el.removeEventListener('click', onClick)
      window.removeEventListener('mousemove', onMouseMove)
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
    }
  }, [gl])

  useFrame((_, delta) => {
    camera.rotation.set(pitch.current, yaw.current, 0, 'YXZ')

    const joy = moveRef.current ?? { x: 0, y: 0 }
    const mx = keys.current.x + joy.x
    const my = keys.current.y + joy.y
    if (mx === 0 && my === 0) return

    const dir = new THREE.Vector3()
    camera.getWorldDirection(dir)
    dir.y = 0
    dir.normalize()
    const right = new THREE.Vector3(dir.z, 0, -dir.x).negate()

    const step = PLAYER.speed * Math.min(delta, 0.05)
    const nx = camera.position.x + (dir.x * my + right.x * mx) * step
    const nz = camera.position.z + (dir.z * my + right.z * mx) * step
    const clamped = clampToHall(nx, nz, length)
    camera.position.set(clamped.x, PLAYER.eyeHeight, clamped.z)
  })

  return null
}
