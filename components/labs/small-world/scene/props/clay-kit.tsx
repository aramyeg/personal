'use client'
import { PALETTE } from '../../palette'
import { useClayRamp } from '../toon-ramp'
import { DECK_RISE } from '../stage'

type Xform = {
  position?: [number, number, number]
  rotation?: [number, number, number]
  scale?: number
}

/** Crown silhouette family (Task 23): each tree family owns a distinct shape so the
 *  forest is not one blobby crown recoloured. 'lobes' = broadleaf stacked spheres
 *  (spring woods); 'cone' = pinched conifer (winter/evergreen); 'parasol' = flat wide
 *  umbrella crown (delta/dry-land). */
export type CrownShape = 'lobes' | 'cone' | 'parasol'

export function ClayTree({
  crown = PALETTE.leaf,
  height = 0.45,
  shape = 'lobes',
  ...x
}: Xform & { crown?: string; height?: number; shape?: CrownShape }) {
  const ramp = useClayRamp()
  return (
    <group {...x}>
      <mesh position={[0, height * 0.25, 0]}>
        <cylinderGeometry args={[0.035, 0.05, height * 0.5, 7]} />
        <meshToonMaterial color={PALETTE.clayPath} gradientMap={ramp} />
      </mesh>
      {shape === 'cone' ? (
        <>
          <mesh position={[0, height * 0.78, 0]}>
            <coneGeometry args={[height * 0.34, height * 0.72, 7]} />
            <meshToonMaterial color={crown} gradientMap={ramp} />
          </mesh>
          <mesh position={[0, height * 1.06, 0]}>
            <coneGeometry args={[height * 0.2, height * 0.4, 7]} />
            <meshToonMaterial color={crown} gradientMap={ramp} />
          </mesh>
        </>
      ) : shape === 'parasol' ? (
        <mesh position={[0, height * 0.68, 0]} scale={[1, 0.42, 1]}>
          <sphereGeometry args={[height * 0.5, 12, 8]} />
          <meshToonMaterial color={crown} gradientMap={ramp} />
        </mesh>
      ) : (
        <>
          <mesh position={[0, height * 0.72, 0]}>
            <sphereGeometry args={[height * 0.38, 10, 10]} />
            <meshToonMaterial color={crown} gradientMap={ramp} />
          </mesh>
          <mesh position={[height * 0.18, height * 0.95, 0]}>
            <sphereGeometry args={[height * 0.22, 16, 16]} />
            <meshToonMaterial color={crown} gradientMap={ramp} />
          </mesh>
        </>
      )}
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

/** A bell / tulip flower — a molded cup nodding on its stem (Task 23 silhouette
 *  variant, distinct from the blossom blob). The cup is a cone hung wide-end-down. */
export function ClayBell({ color = PALETTE.bluebell, ...x }: Xform & { color?: string }) {
  const ramp = useClayRamp()
  return (
    <group {...x}>
      <mesh position={[0, 0.06, 0]}>
        <cylinderGeometry args={[0.008, 0.012, 0.12, 6]} />
        <meshToonMaterial color={PALETTE.leaf} gradientMap={ramp} />
      </mesh>
      <mesh position={[0, 0.145, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[0.038, 0.07, 8, 1, true]} />
        <meshToonMaterial color={color} gradientMap={ramp} side={2} />
      </mesh>
      <mesh position={[0, 0.185, 0]}>
        <sphereGeometry args={[0.02, 8, 8]} />
        <meshToonMaterial color={color} gradientMap={ramp} />
      </mesh>
    </group>
  )
}

/** A spike flower — a lupine/foxglove tower of small molded florets up a stalk
 *  (Task 23 silhouette variant). Reads tall and narrow against the round blossoms. */
export function ClaySpike({ color = PALETTE.lupine, ...x }: Xform & { color?: string }) {
  const ramp = useClayRamp()
  const florets = [0.11, 0.14, 0.17, 0.2, 0.225]
  return (
    <group {...x}>
      <mesh position={[0, 0.08, 0]}>
        <cylinderGeometry args={[0.009, 0.013, 0.16, 6]} />
        <meshToonMaterial color={PALETTE.leaf} gradientMap={ramp} />
      </mesh>
      {florets.map((y, i) => (
        <mesh key={y} position={[0, y, 0]}>
          <sphereGeometry args={[0.036 - i * 0.005, 8, 8]} />
          <meshToonMaterial color={color} gradientMap={ramp} />
        </mesh>
      ))}
    </group>
  )
}

/** An angular faceted boulder — a low-poly icosahedron pinched flat, so it reads as a
 *  chipped clay rock, not a smooth pebble (Task 23: canyon/winter boulders). */
export function ClayBoulder({ color = PALETTE.stone, r = 0.1, ...x }: Xform & { color?: string; r?: number }) {
  const ramp = useClayRamp()
  return (
    <mesh {...x} scale={[1, 0.72, 0.9].map((s) => s * (x.scale ?? 1)) as [number, number, number]}>
      <icosahedronGeometry args={[r, 0]} />
      <meshToonMaterial color={color} gradientMap={ramp} />
    </mesh>
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
        <cylinderGeometry args={[0.03, 0.05, 0.5, 7]} />
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

/**
 * A little arched wooden footbridge in rich clay-brown, spanning a river
 * crossing. Anchored at the carved river floor; the plank deck rides `rise`
 * above it (matched to stage's DECK_RISE) so the girl's feet land on the
 * planks. Planks + posts in `earth`, rail tops in the lighter `clayPath`.
 */
export function ClayBridge({ rise = DECK_RISE, ...x }: Xform & { rise?: number }) {
  const ramp = useClayRamp()
  // flat deck (so the girl's feet land at DECK_RISE); the arched read comes from
  // tall pylons + raised handrails that carry a clear bridge silhouette at range.
  const planksZ = [-0.18, -0.09, 0, 0.09, 0.18]
  const corners: Array<[number, number]> = [
    [-0.24, -0.19], [0.24, -0.19], [-0.24, 0.19], [0.24, 0.19],
  ]
  const rows = [-0.16, 0, 0.16]
  return (
    <group {...x}>
      {/* solid deck planks */}
      {planksZ.map((z) => (
        <mesh key={z} position={[0, rise, z]}>
          <boxGeometry args={[0.46, 0.055, 0.11]} />
          <meshToonMaterial color={PALETTE.earth} gradientMap={ramp} />
        </mesh>
      ))}
      {/* thick end pylons standing well above the deck */}
      {corners.map(([px, pz], i) => (
        <mesh key={i} position={[px, rise * 0.5 + 0.08, pz]}>
          <cylinderGeometry args={[0.035, 0.045, rise + 0.3, 8]} />
          <meshToonMaterial color={PALETTE.earth} gradientMap={ramp} />
        </mesh>
      ))}
      {/* handrails: a thick clayPath top bar each side + balusters — the light
          rail against the dark deck is what reads the bridge from the camera */}
      {[-0.24, 0.24].map((px) => (
        <group key={px}>
          <mesh position={[px, rise + 0.2, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.022, 0.022, 0.44, 8]} />
            <meshToonMaterial color={PALETTE.clayPath} gradientMap={ramp} />
          </mesh>
          {rows.map((z) => (
            <mesh key={z} position={[px, rise + 0.12, z]}>
              <cylinderGeometry args={[0.016, 0.016, 0.16, 6]} />
              <meshToonMaterial color={PALETTE.clayPath} gradientMap={ramp} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  )
}

export function ClayMound({ r = 0.5, color = PALETTE.meadow, squash = 0.55, ...x }: Xform & { r?: number; color?: string; squash?: number }) {
  const ramp = useClayRamp()
  return (
    <mesh {...x} scale={[1, squash, 1].map((s) => s * (x.scale ?? 1)) as [number, number, number]}>
      <sphereGeometry args={[r, 12, 12]} />
      <meshToonMaterial color={color} gradientMap={ramp} />
    </mesh>
  )
}
