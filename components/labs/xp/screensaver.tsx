'use client'

import { useEffect, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useXpStore } from './store'

const COLORS = ['#2f7fdc', '#3fae49', '#d43f3f', '#e0a72f', '#8a4fd0']
const DIRS: [number, number, number][] = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]
const BOUND = 6

type Segment = { from: THREE.Vector3; to: THREE.Vector3; color: string }

function segmentProps(s: Segment) {
  const mid = s.from.clone().add(s.to).multiplyScalar(0.5)
  const dir = s.to.clone().sub(s.from)
  const len = dir.length()
  const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize())
  return { mid, len, quat }
}

function Pipes() {
  const [segments, setSegments] = useState<Segment[]>([])
  const state = useRef({
    pos: new THREE.Vector3(0, 0, 0),
    dir: new THREE.Vector3(1, 0, 0),
    color: COLORS[0],
    elapsed: 0,
  })

  useFrame((_, delta) => {
    const st = state.current
    st.elapsed += delta
    if (st.elapsed < 0.12) return
    st.elapsed = 0
    setSegments((prev) => {
      if (prev.length > 220) {
        st.pos = new THREE.Vector3(0, 0, 0)
        st.color = COLORS[Math.floor(Math.random() * COLORS.length)]
        return []
      }
      const turns = DIRS.filter(([x, y, z]) => {
        const next = st.pos.clone().add(new THREE.Vector3(x, y, z))
        return Math.abs(next.x) <= BOUND && Math.abs(next.y) <= BOUND && Math.abs(next.z) <= BOUND
      })
      const keepStraight = Math.random() < 0.6
      const [dx, dy, dz] = keepStraight && turns.some(([x, y, z]) => x === st.dir.x && y === st.dir.y && z === st.dir.z)
        ? [st.dir.x, st.dir.y, st.dir.z]
        : turns[Math.floor(Math.random() * turns.length)]
      st.dir = new THREE.Vector3(dx, dy, dz)
      const from = st.pos.clone()
      st.pos = st.pos.clone().add(st.dir)
      return [...prev, { from, to: st.pos.clone(), color: st.color }]
    })
  })

  return (
    <>
      {segments.map((s, i) => {
        const { mid, len, quat } = segmentProps(s)
        return (
          <group key={i}>
            <mesh position={mid} quaternion={quat}>
              <cylinderGeometry args={[0.16, 0.16, len, 12]} />
              <meshStandardMaterial color={s.color} metalness={0.4} roughness={0.3} />
            </mesh>
            <mesh position={s.to}>
              <sphereGeometry args={[0.2, 12, 12]} />
              <meshStandardMaterial color={s.color} metalness={0.4} roughness={0.3} />
            </mesh>
          </group>
        )
      })}
    </>
  )
}

export function Screensaver() {
  const on = useXpStore((s) => s.screensaver)

  useEffect(() => {
    if (!on) return
    const dismiss = (e: Event) => {
      if (e.type === 'keydown') e.preventDefault()
      useXpStore.getState().setScreensaver(false)
    }
    const events = ['pointermove', 'pointerdown', 'keydown'] as const
    events.forEach((ev) => window.addEventListener(ev, dismiss, { capture: true }))
    return () => events.forEach((ev) => window.removeEventListener(ev, dismiss, { capture: true }))
  }, [on])

  if (!on) return null
  return (
    <div data-testid="screensaver" style={{ position: 'fixed', inset: 0, zIndex: 30000, background: '#000' }}>
      <Canvas camera={{ position: [10, 8, 14], fov: 45 }}>
        <ambientLight intensity={0.4} />
        <directionalLight position={[6, 10, 8]} intensity={1.2} />
        <Pipes />
      </Canvas>
    </div>
  )
}
