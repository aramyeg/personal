'use client'
import { useMemo } from 'react'
import * as THREE from 'three'
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

/**
 * A clay pyramid — the desert's "structure" (Task 41; grounded in Task 46). A four-sided
 * pressed-clay pyramid in the sand family. Flat FACE normals are baked into the geometry
 * (toNonIndexed + computeVertexNormals) so each of the four faces takes its own crisp toon
 * band — a lit face + a shaded face at a glance, without the material `flatShading` flag (which
 * meshToonMaterial doesn't type).
 *
 * Task 46 (Aram — "make the dunes and pyramids more of a stable structures"): the pyramid now
 * sits on a STEPPED two-tier pressed-clay plinth (a wide grounding step + a narrower seat step)
 * so it reads as a seated monument, not a cone dropped on the sand. `tilt` leans it a touch and
 * `sink` buries the seat for hand-made claymation charm; `spin` turns which faces front the
 * camera. `size` is the square base edge (world units).
 */
export function ClayPyramid({
  color = PALETTE.sand,
  base = PALETTE.dune,
  size = 0.5,
  height,
  tilt = 0,
  sink = 0,
  spin = Math.PI / 4,
  ...x
}: Xform & {
  color?: string
  base?: string
  size?: number
  height?: number
  tilt?: number
  sink?: number
  spin?: number
}) {
  const ramp = useClayRamp()
  const h = height ?? size
  const r = size / Math.SQRT2 // cone radius whose square base has edge = size
  const plinthH = size * 0.1 // one plinth step height, scaled to the pyramid
  const geo = useMemo(() => {
    const g = new THREE.ConeGeometry(r, h, 4).toNonIndexed()
    g.computeVertexNormals() // per-face flat normals → crisp faceted sun/shade faces
    return g
  }, [r, h])
  return (
    <group {...x}>
      {/* stepped pressed-clay plinth — a wide grounding step seated into the sand + a narrower
          seat step, so the pyramid reads as a grounded STRUCTURE (Task 46 stability). */}
      <mesh position={[0, plinthH * 0.5, 0]}>
        <boxGeometry args={[size * 1.2, plinthH, size * 1.2]} />
        <meshToonMaterial color={base} gradientMap={ramp} />
      </mesh>
      <mesh position={[0, plinthH * 1.4, 0]}>
        <boxGeometry args={[size * 1.0, plinthH * 0.8, size * 1.0]} />
        <meshToonMaterial color={base} gradientMap={ramp} />
      </mesh>
      <group rotation={[tilt, spin, 0]} position={[0, plinthH * 1.8 - sink, 0]}>
        <mesh geometry={geo} position={[0, h / 2, 0]}>
          <meshToonMaterial color={color} gradientMap={ramp} />
        </mesh>
      </group>
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

// --- Lurking jungle animals (Task 42) ---------------------------------------
//
// Aram: "some animals lurking around." Small clay figures HIDING in the jungle —
// the charm is mostly-occluded placement (a snake at a trunk, cat eyes behind a
// canopy mound, a parrot on a branch, a frog by the water). Each is a few clay
// primitives with a strong silhouette and one accent colour, in the clay-kit idiom.
// All accents are named palette.ts entries.
//
// Each animal is built as ONE merged vertex-coloured geometry (its primitives baked to
// a single BufferGeometry under the shared toon ramp), so a whole animal is a SINGLE
// draw call instead of one per primitive — 4 animals cost 4 draws, not ~25 (the flora
// is already instanced). The merge bakes each primitive's local transform + accent into
// per-vertex colour; the silhouette + shading are identical to the per-mesh build.

type ClayPart = { geo: THREE.BufferGeometry; color: string; pos?: [number, number, number]; rot?: [number, number, number]; scl?: [number, number, number] }

/** Local transform matrix for a part (Euler order XYZ, matching r3f's `rotation` prop). */
function partMatrix(p: ClayPart): THREE.Matrix4 {
  const q = new THREE.Quaternion()
  if (p.rot) q.setFromEuler(new THREE.Euler(p.rot[0], p.rot[1], p.rot[2]))
  return new THREE.Matrix4().compose(
    new THREE.Vector3(...(p.pos ?? [0, 0, 0])),
    q,
    new THREE.Vector3(...(p.scl ?? [1, 1, 1]))
  )
}

/** Bake a list of clay primitives into ONE vertex-coloured, non-indexed BufferGeometry:
 *  each part's local transform is applied to its geometry (positions + normals) and its
 *  accent colour is written per-vertex. Rendered with a single meshToonMaterial
 *  (vertexColors) so the whole figure is one draw call. The source geometries are disposed. */
function buildMergedClay(parts: ClayPart[]): THREE.BufferGeometry {
  const positions: number[] = []
  const normals: number[] = []
  const colors: number[] = []
  const col = new THREE.Color()
  for (const part of parts) {
    const src = part.geo
    const g = src.index ? src.toNonIndexed() : src
    g.applyMatrix4(partMatrix(part)) // transforms positions AND (normalised) normals
    const pos = g.attributes.position.array as ArrayLike<number>
    const nor = g.attributes.normal.array as ArrayLike<number>
    for (let i = 0; i < pos.length; i++) {
      positions.push(pos[i])
      normals.push(nor[i])
    }
    col.set(part.color)
    for (let i = 0; i < g.attributes.position.count; i++) colors.push(col.r, col.g, col.b)
    if (g !== src) g.dispose()
    src.dispose()
  }
  const out = new THREE.BufferGeometry()
  out.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  out.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  out.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  return out
}

/** A coiled snake resting at a trunk base: a flattened spiral body + a raised head with
 *  two ink eyes and a honey tongue. Accent = emerald body. */
export function ClaySnake({ color = PALETTE.snakeBody, ...x }: Xform & { color?: string }) {
  const ramp = useClayRamp()
  const geo = useMemo(
    () =>
      buildMergedClay([
        { geo: new THREE.TorusGeometry(0.075, 0.026, 10, 20), color, rot: [Math.PI / 2, 0, 0], scl: [1, 1, 0.55] },
        { geo: new THREE.TorusGeometry(0.04, 0.024, 10, 18), color, pos: [0.02, 0.02, 0.01], rot: [Math.PI / 2, 0, 0], scl: [1, 1, 0.55] },
        { geo: new THREE.SphereGeometry(0.03, 12, 12), color, pos: [0.08, 0.05, 0.05], rot: [0, 0, -0.5], scl: [1.5, 1, 1] },
        { geo: new THREE.SphereGeometry(0.014, 8, 8), color: PALETTE.honey, pos: [0.11, 0.062, 0.058], scl: [1, 0.3, 1] },
        { geo: new THREE.SphereGeometry(0.006, 6, 6), color: PALETTE.ink, pos: [0.1, 0.075, 0.045] },
        { geo: new THREE.SphereGeometry(0.006, 6, 6), color: PALETTE.ink, pos: [0.1, 0.075, 0.065] },
      ]),
    [color]
  )
  return <mesh {...x} geometry={geo}><meshToonMaterial vertexColors gradientMap={ramp} /></mesh>
}

/** A big cat peeking from cover — only the crown of the head, two ears and two glowing
 *  eyes show (the body stays hidden behind a canopy mound). Accent = amber eyes. */
export function ClayJaguar({ fur = PALETTE.jaguarFur, eye = PALETTE.jaguarEye, ...x }: Xform & { fur?: string; eye?: string }) {
  const ramp = useClayRamp()
  const geo = useMemo(
    () =>
      buildMergedClay([
        { geo: new THREE.SphereGeometry(0.09, 14, 14), color: fur, scl: [1.25, 0.85, 1] },
        { geo: new THREE.ConeGeometry(0.035, 0.06, 10), color: fur, pos: [-0.06, 0.075, 0] },
        { geo: new THREE.ConeGeometry(0.035, 0.06, 10), color: fur, pos: [0.06, 0.075, 0] },
        { geo: new THREE.SphereGeometry(0.018, 10, 10), color: eye, pos: [-0.04, 0.01, 0.075] },
        { geo: new THREE.SphereGeometry(0.018, 10, 10), color: eye, pos: [0.04, 0.01, 0.075] },
        { geo: new THREE.SphereGeometry(0.012, 8, 8), color: PALETTE.ink, pos: [-0.04, 0.005, 0.09], scl: [0.5, 1, 0.5] },
        { geo: new THREE.SphereGeometry(0.012, 8, 8), color: PALETTE.ink, pos: [0.04, 0.005, 0.09], scl: [0.5, 1, 0.5] },
      ]),
    [fur, eye]
  )
  return <mesh {...x} geometry={geo}><meshToonMaterial vertexColors gradientMap={ramp} /></mesh>
}

/** A parrot perched on a branch: a plump body, a hooked beak, a long tail and a wing
 *  patch of a second colour. Accent = scarlet body with a teal wing. */
export function ClayParrot({ body = PALETTE.parrotBody, wing = PALETTE.parrotWing, ...x }: Xform & { body?: string; wing?: string }) {
  const ramp = useClayRamp()
  const geo = useMemo(
    () =>
      buildMergedClay([
        { geo: new THREE.SphereGeometry(0.06, 14, 14), color: body, scl: [1, 1.25, 1] },
        { geo: new THREE.SphereGeometry(0.042, 12, 12), color: body, pos: [0.01, 0.09, 0.02] },
        { geo: new THREE.ConeGeometry(0.02, 0.05, 8), color: PALETTE.honey, pos: [0.05, 0.085, 0.03], rot: [0, 0, -1.1] },
        { geo: new THREE.SphereGeometry(0.045, 10, 10), color: wing, pos: [-0.03, 0.0, 0.03], rot: [0.3, 0.2, 0.4], scl: [0.55, 1.4, 0.9] },
        { geo: new THREE.SphereGeometry(0.03, 10, 10), color: wing, pos: [-0.05, -0.09, 0], rot: [0, 0, 0.6], scl: [0.5, 2.4, 0.7] },
        { geo: new THREE.SphereGeometry(0.008, 6, 6), color: PALETTE.ink, pos: [0.035, 0.1, 0.05] },
      ]),
    [body, wing]
  )
  return <mesh {...x} geometry={geo}><meshToonMaterial vertexColors gradientMap={ramp} /></mesh>
}

/** A little frog crouched by the water: a wide squat body with two bulging eyes on
 *  top and a pale throat. Accent = bright leaf green. */
export function ClayFrog({ color = PALETTE.frogBody, throat = PALETTE.frogThroat, ...x }: Xform & { color?: string; throat?: string }) {
  const ramp = useClayRamp()
  const geo = useMemo(
    () =>
      buildMergedClay([
        { geo: new THREE.SphereGeometry(0.055, 14, 12), color, scl: [1.3, 0.8, 1.15] },
        { geo: new THREE.SphereGeometry(0.04, 10, 10), color: throat, pos: [0.045, -0.005, 0], scl: [0.7, 0.55, 0.9] },
        { geo: new THREE.SphereGeometry(0.02, 10, 10), color, pos: [0.02, 0.045, -0.028] },
        { geo: new THREE.SphereGeometry(0.02, 10, 10), color, pos: [0.02, 0.045, 0.028] },
        { geo: new THREE.SphereGeometry(0.009, 8, 8), color: PALETTE.ink, pos: [0.032, 0.051, -0.028] },
        { geo: new THREE.SphereGeometry(0.009, 8, 8), color: PALETTE.ink, pos: [0.032, 0.051, 0.028] },
      ]),
    [color, throat]
  )
  return <mesh {...x} geometry={geo}><meshToonMaterial vertexColors gradientMap={ramp} /></mesh>
}

// --- Desert life that appears on approach (Task 46) -------------------------
//
// Aram: "when the girl walks towards the desert biome camels, oasis can appear." The camels
// are merged single-draw clay animals (buildMergedClay, same as the jungle beasts): a strong
// dromedary silhouette — a long body on four legs, ONE high hump under a terracotta saddle
// blanket, a raised neck + head with a heavy muzzle — in the golden-desert sand family with a
// single warm saddle accent. Feet sit at y=0 so it stands on the dune it is anchored to. One
// draw call each; revealed by the rotation-driven grow in set-accenture.tsx.
export function ClayCamel({ hide = PALETTE.camelHide, saddle = PALETTE.camelSaddle, ...x }: Xform & { hide?: string; saddle?: string }) {
  const ramp = useClayRamp()
  const leg = (px: number, pz: number): ClayPart => ({
    geo: new THREE.CylinderGeometry(0.017, 0.02, 0.16, 7),
    color: PALETTE.camelHideDeep,
    pos: [px, 0.08, pz],
  })
  const geo = useMemo(
    () =>
      buildMergedClay([
        // four legs (feet at y=0)
        leg(0.1, 0.055), leg(0.1, -0.055), leg(-0.1, 0.055), leg(-0.1, -0.055),
        // long barrel body
        { geo: new THREE.SphereGeometry(0.11, 16, 14), color: hide, pos: [0, 0.23, 0], scl: [1.55, 0.92, 0.9] },
        // single high hump
        { geo: new THREE.SphereGeometry(0.075, 14, 14), color: hide, pos: [-0.015, 0.31, 0], scl: [1.15, 1.05, 0.95] },
        // terracotta saddle blanket draped over the hump (the one accent)
        { geo: new THREE.SphereGeometry(0.06, 14, 12), color: saddle, pos: [-0.015, 0.34, 0], scl: [1.25, 0.5, 1.02] },
        // neck rising toward the front
        { geo: new THREE.CylinderGeometry(0.03, 0.042, 0.18, 8), color: hide, pos: [0.17, 0.31, 0], rot: [0, 0, -0.62] },
        // head + heavy muzzle
        { geo: new THREE.SphereGeometry(0.05, 12, 12), color: hide, pos: [0.24, 0.4, 0], scl: [1.25, 0.95, 0.9] },
        { geo: new THREE.SphereGeometry(0.03, 10, 10), color: PALETTE.camelHideDeep, pos: [0.29, 0.37, 0], scl: [1.4, 0.85, 0.85] },
        // two ink eyes + two little ears
        { geo: new THREE.SphereGeometry(0.008, 6, 6), color: PALETTE.ink, pos: [0.265, 0.42, 0.032] },
        { geo: new THREE.SphereGeometry(0.008, 6, 6), color: PALETTE.ink, pos: [0.265, 0.42, -0.032] },
        { geo: new THREE.ConeGeometry(0.016, 0.03, 7), color: hide, pos: [0.22, 0.45, 0.03] },
        { geo: new THREE.ConeGeometry(0.016, 0.03, 7), color: hide, pos: [0.22, 0.45, -0.03] },
        // stubby tail
        { geo: new THREE.CylinderGeometry(0.008, 0.012, 0.1, 6), color: PALETTE.camelHideDeep, pos: [-0.17, 0.24, 0], rot: [0, 0, 0.6] },
      ]),
    [hide, saddle]
  )
  return <mesh {...x} geometry={geo}><meshToonMaterial vertexColors gradientMap={ramp} /></mesh>
}

/** A dusty tuft of oasis reeds — a few tapered blades fanning up from the base, merged into
 *  ONE geometry (single draw). Reads as the marsh grass ringing the oasis pool. */
export function ClayReeds({ color = PALETTE.reedGreen, ...x }: Xform & { color?: string }) {
  const ramp = useClayRamp()
  const geo = useMemo(() => {
    const blades: ClayPart[] = []
    const lean = [-0.35, -0.12, 0.1, 0.32, 0.02]
    const yaw = [0.2, 1.4, 2.7, 3.9, 5.2]
    for (let i = 0; i < lean.length; i++) {
      blades.push({
        geo: new THREE.ConeGeometry(0.012, 0.2 + 0.05 * (i % 2), 5),
        color,
        pos: [0.03 * Math.cos(yaw[i]), 0.1, 0.03 * Math.sin(yaw[i])],
        rot: [lean[i], yaw[i], lean[i] * 0.6],
      })
    }
    return buildMergedClay(blades)
  }, [color])
  return <mesh {...x} geometry={geo}><meshToonMaterial vertexColors gradientMap={ramp} /></mesh>
}

// --- Delta wetland wildlife + structure (Task 48) ---------------------------
//
// Aram (Round 13): biome 2 (the A2 grand delta) "kind of lacks features" — bring it to the
// jungle compass in the delta's OWN wet-sandy vocabulary. These are the lurking WADERS (a
// heron standing in a shallow, a turtle basking on a sandbank), a fish-RIPPLE hint on the
// water, and one STRUCTURE touch (a stilt fishing hut on a levee). Each is ONE merged
// vertex-coloured geometry (buildMergedClay) so a whole figure is a SINGLE draw call — same
// idiom as the jungle beasts + desert camels. All accents are named palette.ts entries.

/** A heron/stork wading in the shallows: two long thin legs (feet at y=0), a plump body high
 *  on the legs, an S-curved neck, a small head with a dagger bill and two ink eyes. Accent =
 *  pale blue-grey plumage with a slate wing and a warm bill/legs. Reads tall + still. */
export function ClayHeron({ body = PALETTE.heronBody, wing = PALETTE.heronWing, bill = PALETTE.heronBill, ...x }: Xform & { body?: string; wing?: string; bill?: string }) {
  const ramp = useClayRamp()
  const geo = useMemo(
    () =>
      buildMergedClay([
        // two long legs — feet at y=0
        { geo: new THREE.CylinderGeometry(0.008, 0.01, 0.26, 6), color: bill, pos: [0.022, 0.13, 0.01] },
        { geo: new THREE.CylinderGeometry(0.008, 0.01, 0.26, 6), color: bill, pos: [-0.022, 0.13, -0.01] },
        // plump body riding high on the legs
        { geo: new THREE.SphereGeometry(0.07, 14, 12), color: body, pos: [0, 0.31, 0], scl: [1.55, 0.92, 1] },
        // folded slate wing patch on the flank
        { geo: new THREE.SphereGeometry(0.055, 12, 10), color: wing, pos: [-0.02, 0.32, 0.04], rot: [0.2, 0, 0.3], scl: [1.5, 0.75, 0.5] },
        // short tail sweeping back
        { geo: new THREE.ConeGeometry(0.03, 0.11, 8), color: wing, pos: [-0.11, 0.32, 0], rot: [0, 0, 1.3] },
        // S-neck: a lower forward-lean segment + an upright upper segment
        { geo: new THREE.CylinderGeometry(0.016, 0.02, 0.12, 7), color: body, pos: [0.05, 0.4, 0], rot: [0, 0, -0.7] },
        { geo: new THREE.CylinderGeometry(0.013, 0.016, 0.12, 7), color: body, pos: [0.08, 0.5, 0], rot: [0, 0, 0.35] },
        // head + dagger bill
        { geo: new THREE.SphereGeometry(0.028, 10, 10), color: body, pos: [0.1, 0.56, 0] },
        { geo: new THREE.ConeGeometry(0.014, 0.09, 8), color: bill, pos: [0.17, 0.55, 0], rot: [0, 0, -1.35] },
        // two ink eyes
        { geo: new THREE.SphereGeometry(0.006, 6, 6), color: PALETTE.ink, pos: [0.11, 0.575, 0.022] },
        { geo: new THREE.SphereGeometry(0.006, 6, 6), color: PALETTE.ink, pos: [0.11, 0.575, -0.022] },
      ]),
    [body, wing, bill]
  )
  return <mesh {...x} geometry={geo}><meshToonMaterial vertexColors gradientMap={ramp} /></mesh>
}

/** A turtle basking on a sandbank: a low domed carapace, a head poking forward, four stubby
 *  flippers and a little tail. Accent = mossy olive shell over pale-olive skin. Low + calm. */
export function ClayTurtle({ shell = PALETTE.turtleShell, skin = PALETTE.turtleSkin, ...x }: Xform & { shell?: string; skin?: string }) {
  const ramp = useClayRamp()
  const flipper = (px: number, pz: number, yaw: number): ClayPart => ({
    geo: new THREE.SphereGeometry(0.028, 10, 8),
    color: skin,
    pos: [px, 0.02, pz],
    rot: [0, yaw, 0],
    scl: [1.5, 0.45, 0.9],
  })
  const geo = useMemo(
    () =>
      buildMergedClay([
        // domed carapace
        { geo: new THREE.SphereGeometry(0.09, 16, 12), color: shell, pos: [0, 0.05, 0], scl: [1.3, 0.62, 1.05] },
        // pale plastron rim just under the shell
        { geo: new THREE.SphereGeometry(0.085, 14, 8), color: skin, pos: [0, 0.02, 0], scl: [1.32, 0.24, 1.08] },
        // head poking forward
        { geo: new THREE.SphereGeometry(0.032, 12, 12), color: skin, pos: [0.11, 0.05, 0], scl: [1.2, 0.9, 0.9] },
        // four stubby flippers
        flipper(0.07, 0.075, 0.7), flipper(0.07, -0.075, -0.7),
        flipper(-0.075, 0.07, 2.3), flipper(-0.075, -0.07, -2.3),
        // little tail
        { geo: new THREE.ConeGeometry(0.014, 0.05, 6), color: skin, pos: [-0.12, 0.04, 0], rot: [0, 0, 1.4] },
        // two ink eyes
        { geo: new THREE.SphereGeometry(0.007, 6, 6), color: PALETTE.ink, pos: [0.128, 0.062, 0.018] },
        { geo: new THREE.SphereGeometry(0.007, 6, 6), color: PALETTE.ink, pos: [0.128, 0.062, -0.018] },
      ]),
    [shell, skin]
  )
  return <mesh {...x} geometry={geo}><meshToonMaterial vertexColors gradientMap={ramp} /></mesh>
}

/** A fish-ripple hint on the water surface — two flat concentric rings, as if something just
 *  broke the surface. Merged single-draw; laid flat (lies in the horizontal plane at y≈0), so
 *  it reads on the water, not standing. Accent = the river blues. */
export function ClayRipple({ color = PALETTE.river, inner = PALETTE.riverDeep, ...x }: Xform & { color?: string; inner?: string }) {
  const ramp = useClayRamp()
  const geo = useMemo(
    () =>
      buildMergedClay([
        { geo: new THREE.TorusGeometry(0.075, 0.006, 6, 20), color, rot: [Math.PI / 2, 0, 0] },
        { geo: new THREE.TorusGeometry(0.042, 0.005, 6, 18), color: inner, pos: [0, 0.002, 0], rot: [Math.PI / 2, 0, 0] },
      ]),
    [color, inner]
  )
  return <mesh {...x} geometry={geo}><meshToonMaterial vertexColors gradientMap={ramp} /></mesh>
}

/**
 * A stilt fishing hut — the delta's ONE structure touch (Task 48). A little reed-and-plank
 * cabin raised on four posts over the shallows, with a plank deck, a pitched thatch roof, a
 * dark doorway and a short jetty plank reaching out toward the water. Built as ONE merged
 * vertex-coloured geometry (single draw), feet (post bases) at y=0 so it stands on the levee
 * it is anchored to. Reads crisp at the reading camera (the structures bar).
 */
export function ClayStiltHut({ wall = PALETTE.stiltWall, roof = PALETTE.stiltRoof, ...x }: Xform & { wall?: string; roof?: string }) {
  const ramp = useClayRamp()
  const post = (px: number, pz: number): ClayPart => ({
    geo: new THREE.CylinderGeometry(0.018, 0.022, 0.3, 6),
    color: roof,
    pos: [px, 0.15, pz],
  })
  const geo = useMemo(
    () =>
      buildMergedClay([
        // four stilt posts standing in the shallows (bases at y=0)
        post(0.15, 0.12), post(0.15, -0.12), post(-0.15, 0.12), post(-0.15, -0.12),
        // plank deck platform on top of the posts
        { geo: new THREE.BoxGeometry(0.4, 0.03, 0.34), color: PALETTE.clayPath, pos: [0, 0.31, 0] },
        // a short jetty plank reaching out toward the water
        { geo: new THREE.BoxGeometry(0.22, 0.025, 0.1), color: PALETTE.clayPath, pos: [0.28, 0.31, 0.08] },
        // cabin walls
        { geo: new THREE.BoxGeometry(0.32, 0.22, 0.28), color: wall, pos: [0, 0.44, 0] },
        // dark doorway
        { geo: new THREE.BoxGeometry(0.08, 0.15, 0.02), color: PALETTE.ink, pos: [0, 0.4, 0.141] },
        // pitched thatch roof (4-sided cone, overhanging the walls)
        { geo: new THREE.ConeGeometry(0.28, 0.18, 4), color: roof, pos: [0, 0.64, 0], rot: [0, Math.PI / 4, 0] },
      ]),
    [wall, roof]
  )
  return <mesh {...x} geometry={geo}><meshToonMaterial vertexColors gradientMap={ramp} /></mesh>
}
