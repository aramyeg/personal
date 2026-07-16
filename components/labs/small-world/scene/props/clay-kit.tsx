'use client'
import { PALETTE } from '../../palette'
import { useClayRamp } from '../toon-ramp'

type Xform = {
  position?: [number, number, number]
  rotation?: [number, number, number]
  scale?: number
}

export function ClayTree({ crown = PALETTE.leaf, height = 0.45, ...x }: Xform & { crown?: string; height?: number }) {
  const ramp = useClayRamp()
  return (
    <group {...x}>
      <mesh position={[0, height * 0.25, 0]}>
        <cylinderGeometry args={[0.035, 0.05, height * 0.5, 8]} />
        <meshToonMaterial color={PALETTE.clayPath} gradientMap={ramp} />
      </mesh>
      <mesh position={[0, height * 0.72, 0]}>
        <sphereGeometry args={[height * 0.38, 20, 20]} />
        <meshToonMaterial color={crown} gradientMap={ramp} />
      </mesh>
      <mesh position={[height * 0.18, height * 0.95, 0]}>
        <sphereGeometry args={[height * 0.22, 16, 16]} />
        <meshToonMaterial color={crown} gradientMap={ramp} />
      </mesh>
    </group>
  )
}

export function ClaySprout(x: Xform) {
  const ramp = useClayRamp()
  return (
    <group {...x}>
      <mesh position={[0, 0.05, 0]}>
        <cylinderGeometry args={[0.012, 0.018, 0.1, 6]} />
        <meshToonMaterial color={PALETTE.sprout} gradientMap={ramp} />
      </mesh>
      <mesh position={[-0.035, 0.1, 0]} rotation={[0, 0, 0.6]} scale={[1, 0.45, 0.7]}>
        <sphereGeometry args={[0.045, 12, 12]} />
        <meshToonMaterial color={PALETTE.sprout} gradientMap={ramp} />
      </mesh>
      <mesh position={[0.035, 0.11, 0]} rotation={[0, 0, -0.6]} scale={[1, 0.45, 0.7]}>
        <sphereGeometry args={[0.045, 12, 12]} />
        <meshToonMaterial color={PALETTE.sprout} gradientMap={ramp} />
      </mesh>
    </group>
  )
}

export function ClayBlossom({ color = PALETTE.blossom, ...x }: Xform & { color?: string }) {
  const ramp = useClayRamp()
  return (
    <group {...x}>
      <mesh position={[0, 0.05, 0]}>
        <cylinderGeometry args={[0.008, 0.012, 0.1, 6]} />
        <meshToonMaterial color={PALETTE.leaf} gradientMap={ramp} />
      </mesh>
      <mesh position={[0, 0.12, 0]}>
        <sphereGeometry args={[0.04, 12, 12]} />
        <meshToonMaterial color={color} gradientMap={ramp} />
      </mesh>
      <mesh position={[0, 0.155, 0]}>
        <sphereGeometry args={[0.016, 8, 8]} />
        <meshToonMaterial color={PALETTE.honey} gradientMap={ramp} />
      </mesh>
    </group>
  )
}

export function ClayRock({ color = PALETTE.dune, r = 0.09, ...x }: Xform & { color?: string; r?: number }) {
  const ramp = useClayRamp()
  return (
    <mesh {...x} scale={[1, 0.6, 1].map((s) => s * (x.scale ?? 1)) as [number, number, number]}>
      <dodecahedronGeometry args={[r, 0]} />
      <meshToonMaterial color={color} gradientMap={ramp} />
    </mesh>
  )
}

export function ClayHut({ walls = PALETTE.sky, roof = PALETTE.clayPath, ...x }: Xform & { walls?: string; roof?: string }) {
  const ramp = useClayRamp()
  return (
    <group {...x}>
      <mesh position={[0, 0.13, 0]}>
        <boxGeometry args={[0.34, 0.26, 0.3]} />
        <meshToonMaterial color={walls} gradientMap={ramp} />
      </mesh>
      <mesh position={[0, 0.34, 0]} rotation={[0, Math.PI / 4, 0]}>
        <coneGeometry args={[0.28, 0.2, 4]} />
        <meshToonMaterial color={roof} gradientMap={ramp} />
      </mesh>
      <mesh position={[0, 0.08, 0.152]}>
        <boxGeometry args={[0.08, 0.16, 0.01]} />
        <meshToonMaterial color={PALETTE.ink} gradientMap={ramp} />
      </mesh>
    </group>
  )
}

export function ClayDisc({ color, r = 0.14, h = 0.035, ...x }: Xform & { color: string; r?: number; h?: number }) {
  const ramp = useClayRamp()
  return (
    <mesh {...x} position={[...(x.position ?? [0, 0, 0])].map((v, i) => (i === 1 ? v + h / 2 : v)) as [number, number, number]}>
      <cylinderGeometry args={[r, r * 1.15, h, 20]} />
      <meshToonMaterial color={color} gradientMap={ramp} />
    </mesh>
  )
}

export function ClayBee(x: Xform) {
  const ramp = useClayRamp()
  return (
    <group {...x}>
      <mesh scale={[1.3, 1, 1]}>
        <sphereGeometry args={[0.055, 14, 14]} />
        <meshToonMaterial color={PALETTE.honey} gradientMap={ramp} />
      </mesh>
      <mesh position={[0.08, 0.01, 0]}>
        <sphereGeometry args={[0.038, 12, 12]} />
        <meshToonMaterial color={PALETTE.ink} gradientMap={ramp} />
      </mesh>
      <mesh position={[-0.02, 0.055, 0]} scale={[1.6, 0.35, 1]}>
        <sphereGeometry args={[0.035, 10, 10]} />
        <meshToonMaterial color={PALETTE.sky} gradientMap={ramp} />
      </mesh>
    </group>
  )
}

export function ClayBird(x: Xform) {
  const ramp = useClayRamp()
  return (
    <group {...x}>
      <mesh scale={[1.5, 1, 1]}>
        <sphereGeometry args={[0.05, 14, 14]} />
        <meshToonMaterial color={PALETTE.sky} gradientMap={ramp} />
      </mesh>
      <mesh position={[0, 0.03, 0]} scale={[2.4, 0.25, 1.4]}>
        <sphereGeometry args={[0.04, 10, 10]} />
        <meshToonMaterial color={PALETTE.horizon} gradientMap={ramp} />
      </mesh>
      <mesh position={[0.09, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <coneGeometry args={[0.015, 0.04, 8]} />
        <meshToonMaterial color={PALETTE.honey} gradientMap={ramp} />
      </mesh>
    </group>
  )
}

export function ClayPalm(x: Xform) {
  const ramp = useClayRamp()
  const fronds = [0, 1.25, 2.5, 3.75, 5]
  return (
    <group {...x}>
      <mesh position={[0.03, 0.24, 0]} rotation={[0, 0, -0.12]}>
        <cylinderGeometry args={[0.03, 0.05, 0.5, 8]} />
        <meshToonMaterial color={PALETTE.clayPath} gradientMap={ramp} />
      </mesh>
      {fronds.map((a) => (
        <mesh
          key={a}
          position={[0.06 + 0.11 * Math.cos(a), 0.5, 0.11 * Math.sin(a)]}
          rotation={[0, -a, 0.5]}
          scale={[1.8, 0.18, 0.55]}
        >
          <sphereGeometry args={[0.11, 10, 10]} />
          <meshToonMaterial color={PALETTE.leaf} gradientMap={ramp} />
        </mesh>
      ))}
    </group>
  )
}

export function ClayBlock({ w = 0.2, h = 0.2, d = 0.2, color, ...x }: Xform & { w?: number; h?: number; d?: number; color: string }) {
  const ramp = useClayRamp()
  return (
    <mesh {...x} position={[...(x.position ?? [0, 0, 0])].map((v, i) => (i === 1 ? v + h / 2 : v)) as [number, number, number]}>
      <boxGeometry args={[w, h, d]} />
      <meshToonMaterial color={color} gradientMap={ramp} />
    </mesh>
  )
}

export function ClayMound({ r = 0.5, color = PALETTE.meadow, squash = 0.55, ...x }: Xform & { r?: number; color?: string; squash?: number }) {
  const ramp = useClayRamp()
  return (
    <mesh {...x} scale={[1, squash, 1].map((s) => s * (x.scale ?? 1)) as [number, number, number]}>
      <sphereGeometry args={[r, 24, 24]} />
      <meshToonMaterial color={color} gradientMap={ramp} />
    </mesh>
  )
}
