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

/**
 * `tag` carries no render meaning at all — `buildMergedClay` never reads it — and exists so a test
 * can find a named feature in a merged figure EXACTLY rather than by guessing from colour.
 *
 * Task 61 added it because the guess had broken. The mascot suite located every character's face by
 * "any `ink` part sitting forward in Z", which held only while ink was used on faces alone; the
 * moment a raptor got talons and a bear got claws, the face test started measuring a foot and
 * failing. A probe that silently changes what it measures is the failure mode this cast has been
 * bitten by twice, so the feature says what it is instead.
 */
export type ClayPart = {
  geo: THREE.BufferGeometry
  color: string
  pos?: [number, number, number]
  rot?: [number, number, number]
  scl?: [number, number, number]
  tag?: string
}

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
 *  (vertexColors) so the whole figure is one draw call. The source geometries are disposed.
 *  Exported for the checkpoint peekers (Task 53), which are the same kind of figure staged in
 *  the sky instead of on the terrain. */
export function buildMergedClay(parts: ClayPart[]): THREE.BufferGeometry {
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

// --- Canyon geysers + hoodoos (Task 49) -------------------------------------
//
// Aram (Round 13): the canyon "still... can add a lot there to make the art more exciting.
// maybe geysers." A geyser is TWO merged single-draw pieces: (1) ClayGeyser — a pale mineral
// SINTER cone seated on a terraced clay platform with a bubbling pool at the vent, always
// present; (2) ClayGeyserPlume — a sculpted column of opaque clay puffs that the canyon
// component GROWS and SHRINKS on a slow rotation-driven cycle (geyser.ts), so the eruption
// reads as a solid mineral jet, never a flicker/particle spray (his flicker-family veto). The
// plume is built with its base at y=0 so a uniform scale about the vent grows it straight up.
// Hoodoos add stratified-rock variety to the gorge (his "dirt ridge + cliffs" stay untouched).

/** A geyser's mineral base: a pale sinter cone on a two-step terraced platform with a darker
 *  bubbling pool disc at the vent. ONE merged draw; base at y=0 so it seats on the canyon floor.
 *  The plume erupts from `ClayGeyserPlume` positioned at the cone's mouth. */
export function ClayGeyser({ crust = PALETTE.sinter, shade = PALETTE.sinterDeep, pool = PALETTE.geyserPool, ...x }: Xform & { crust?: string; shade?: string; pool?: string }) {
  const ramp = useClayRamp()
  const geo = useMemo(
    () =>
      buildMergedClay([
        // two-step terraced sinter platform (a wide grounding apron + a narrower seat)
        { geo: new THREE.CylinderGeometry(0.2, 0.23, 0.04, 16), color: shade, pos: [0, 0.02, 0] },
        { geo: new THREE.CylinderGeometry(0.15, 0.17, 0.04, 16), color: crust, pos: [0, 0.06, 0] },
        // the sinter cone rising to the vent
        { geo: new THREE.CylinderGeometry(0.055, 0.13, 0.16, 14), color: crust, pos: [0, 0.16, 0] },
        // shaded upper collar just under the rim
        { geo: new THREE.CylinderGeometry(0.058, 0.07, 0.04, 14), color: shade, pos: [0, 0.235, 0] },
        // the bubbling mineral pool sitting in the vent mouth
        { geo: new THREE.CylinderGeometry(0.05, 0.05, 0.02, 14), color: pool, pos: [0, 0.255, 0] },
      ]),
    [crust, shade, pool]
  )
  return <mesh {...x} geometry={geo}><meshToonMaterial vertexColors gradientMap={ramp} /></mesh>
}

/** The erupting plume: a sculpted column of opaque clay puffs, base at y=0. ONE merged draw.
 *  The canyon component scales this uniformly by the rotation-driven plume height (geyser.ts),
 *  so it rises straight up from the vent and settles — a solid mineral jet, no flicker. */
export function ClayGeyserPlume({ steam = PALETTE.geyserPlume, base = PALETTE.geyserPool, ...x }: Xform & { steam?: string; base?: string }) {
  const ramp = useClayRamp()
  const geo = useMemo(() => {
    // stacked blobby puffs, wider + wetter at the base, tapering to a steamy crown; a gentle
    // lean and side-puffs read as billowing spray without any transparency or sparkle.
    const puff = (y: number, r: number, color: string, dx = 0, dz = 0): ClayPart => ({
      geo: new THREE.SphereGeometry(r, 12, 12),
      color,
      pos: [dx, y, dz],
      scl: [1, 1.15, 1],
    })
    return buildMergedClay([
      puff(0.05, 0.085, base),
      puff(0.15, 0.078, base, 0.02),
      puff(0.26, 0.072, steam, -0.015),
      puff(0.34, 0.05, steam, 0.05, 0.02), // a side billow
      puff(0.37, 0.066, steam, 0.015),
      puff(0.47, 0.055, steam, -0.03),
      puff(0.56, 0.042, steam, 0.02),
    ])
  }, [steam, base])
  return <mesh {...x} geometry={geo}><meshToonMaterial vertexColors gradientMap={ramp} /></mesh>
}

/** A cluster of stratified hoodoo spires — tall tapered terracotta rocks with a lighter caprock,
 *  in the canyon rust family. ONE merged draw; bases at y=0. Adds badland-spire variety to the
 *  gorge floor without touching the sacred cliffs/ridge (the canyon's beloved relief). */
export function ClayHoodoo({ rock = PALETTE.hoodooRock, cap = PALETTE.hoodooCap, ...x }: Xform & { rock?: string; cap?: string }) {
  const ramp = useClayRamp()
  const geo = useMemo(() => {
    // three spires of different heights, each a stack of tapering drums (the strata) under a
    // wider caprock — the classic hoodoo silhouette.
    const spires: Array<{ px: number; pz: number; h: number; r: number }> = [
      { px: 0, pz: 0, h: 0.42, r: 0.05 },
      { px: 0.13, pz: 0.06, h: 0.28, r: 0.045 },
      { px: -0.1, pz: -0.05, h: 0.34, r: 0.042 },
    ]
    const parts: ClayPart[] = []
    for (const s of spires) {
      const drums = 3
      for (let d = 0; d < drums; d++) {
        const y0 = (s.h * d) / drums
        const seg = s.h / drums
        const rLo = s.r * (1 - 0.12 * d)
        const rHi = s.r * (1 - 0.12 * (d + 1))
        parts.push({ geo: new THREE.CylinderGeometry(rHi, rLo, seg, 8), color: rock, pos: [s.px, y0 + seg / 2, s.pz] })
      }
      // caprock crown
      parts.push({ geo: new THREE.SphereGeometry(s.r * 1.35, 10, 8), color: cap, pos: [s.px, s.h, s.pz], scl: [1.1, 0.6, 1.1] })
    }
    return buildMergedClay(parts)
  }, [rock, cap])
  return <mesh {...x} geometry={geo}><meshToonMaterial vertexColors gradientMap={ramp} /></mesh>
}

// --- Winter feel: wildlife + frozen fall + snow-laden conifer (Task 50) ------
//
// Aram (Round 13): he likes the winter lake + right-side forest, "we can work a bit more on
// overall feel." Bring the winter wedge to the jungle COMPASS in its own COLD vocabulary —
// hidden wildlife lurking in the drifts, a frozen cascade, and snow-laden conifers. Each is ONE
// merged vertex-coloured geometry (buildMergedClay) so a whole figure is a SINGLE draw call —
// same idiom as the jungle beasts / desert camels / delta waders. COLD-PALETTE DISCIPLINE: the
// only warm accent in the whole winter scene is the red FOX's coat; everything else is
// blue-white / ice / cold-spruce (named palette.ts entries).

/** A red fox curled asleep in a drift — a rounded coiled body loaf, a bushy tail swept around to
 *  the nose with a cream tip, a resting head with a pointed snout, two ears and a closed-eye read.
 *  Accent = rust fox coat (the ONE warm note in the cold winter scene). ONE merged draw; base y=0. */
export function ClayFox({ fur = PALETTE.foxFur, belly = PALETTE.foxBelly, dark = PALETTE.foxDark, ...x }: Xform & { fur?: string; belly?: string; dark?: string }) {
  const ramp = useClayRamp()
  const geo = useMemo(
    () =>
      buildMergedClay([
        // curled body loaf
        { geo: new THREE.SphereGeometry(0.1, 16, 14), color: fur, pos: [0, 0.06, 0], scl: [1.55, 0.7, 1.15] },
        // rear haunch curl
        { geo: new THREE.SphereGeometry(0.062, 12, 12), color: fur, pos: [-0.08, 0.065, 0.02], scl: [1.1, 0.95, 1.0] },
        // pale belly / chest tuck at the front
        { geo: new THREE.SphereGeometry(0.055, 12, 12), color: belly, pos: [0.075, 0.04, 0.02], scl: [1.1, 0.55, 1.0] },
        // bushy tail sweeping around toward the nose, with a cream tip
        { geo: new THREE.SphereGeometry(0.05, 12, 12), color: fur, pos: [0.03, 0.055, 0.1], rot: [0.2, -0.5, 0], scl: [2.6, 0.75, 0.95] },
        { geo: new THREE.SphereGeometry(0.033, 10, 10), color: belly, pos: [0.14, 0.05, 0.07] },
        // head resting on the paws
        { geo: new THREE.SphereGeometry(0.05, 14, 14), color: fur, pos: [0.12, 0.06, -0.03], scl: [1.05, 0.95, 1.0] },
        // pointed snout + cream muzzle
        { geo: new THREE.ConeGeometry(0.026, 0.07, 10), color: fur, pos: [0.175, 0.045, -0.03], rot: [0, 0, -1.35] },
        { geo: new THREE.SphereGeometry(0.02, 10, 10), color: belly, pos: [0.15, 0.035, -0.03], scl: [1.2, 0.7, 1.0] },
        // two pointed ears (dark tips) laid on the crown
        { geo: new THREE.ConeGeometry(0.022, 0.045, 8), color: dark, pos: [0.1, 0.11, -0.055], rot: [-0.3, 0, 0.2] },
        { geo: new THREE.ConeGeometry(0.022, 0.045, 8), color: dark, pos: [0.1, 0.11, 0.0], rot: [0.3, 0, 0.2] },
        // ink nose + a closed-eye dot (sleeping)
        { geo: new THREE.SphereGeometry(0.01, 8, 8), color: PALETTE.ink, pos: [0.205, 0.045, -0.03] },
        { geo: new THREE.SphereGeometry(0.007, 6, 6), color: PALETTE.ink, pos: [0.135, 0.075, -0.045], scl: [1.4, 0.4, 1] },
      ]),
    [fur, belly, dark]
  )
  return <mesh {...x} geometry={geo}><meshToonMaterial vertexColors gradientMap={ramp} /></mesh>
}

/** An owl perched on a dead SNAG — a plump upright body, a pale facial disc with two big amber
 *  eyes and ear tufts, a small beak, folded wings, all riding a short bark snag (base at y=0).
 *  Cold-neutral grey-brown plumage (no warm saturation but the tiny amber eyes). ONE merged draw. */
export function ClayOwl({ body = PALETTE.owlBody, face = PALETTE.owlFace, ...x }: Xform & { body?: string; face?: string }) {
  const ramp = useClayRamp()
  const geo = useMemo(
    () =>
      buildMergedClay([
        // the dead snag the owl perches on (bark), base at y=0
        { geo: new THREE.CylinderGeometry(0.03, 0.042, 0.24, 7), color: PALETTE.clayPath, pos: [0, 0.12, 0] },
        { geo: new THREE.CylinderGeometry(0.012, 0.018, 0.09, 6), color: PALETTE.clayPath, pos: [0.05, 0.2, 0], rot: [0, 0, -0.9] }, // broken stub
        // plump upright body
        { geo: new THREE.SphereGeometry(0.075, 14, 14), color: body, pos: [0, 0.31, 0], scl: [1, 1.3, 0.95] },
        // folded wings on the flanks
        { geo: new THREE.SphereGeometry(0.05, 12, 10), color: body, pos: [-0.06, 0.31, 0], rot: [0, 0, 0.2], scl: [0.5, 1.5, 0.8] },
        { geo: new THREE.SphereGeometry(0.05, 12, 10), color: body, pos: [0.06, 0.31, 0], rot: [0, 0, -0.2], scl: [0.5, 1.5, 0.8] },
        // pale facial disc
        { geo: new THREE.SphereGeometry(0.06, 14, 12), color: face, pos: [0, 0.37, 0.045], scl: [1.05, 1.05, 0.5] },
        // two big eyes: pale ring + amber iris + ink pupil
        { geo: new THREE.SphereGeometry(0.022, 10, 10), color: PALETTE.jaguarEye, pos: [-0.028, 0.38, 0.08], scl: [1, 1, 0.6] },
        { geo: new THREE.SphereGeometry(0.022, 10, 10), color: PALETTE.jaguarEye, pos: [0.028, 0.38, 0.08], scl: [1, 1, 0.6] },
        { geo: new THREE.SphereGeometry(0.01, 8, 8), color: PALETTE.ink, pos: [-0.028, 0.38, 0.095] },
        { geo: new THREE.SphereGeometry(0.01, 8, 8), color: PALETTE.ink, pos: [0.028, 0.38, 0.095] },
        // little beak
        { geo: new THREE.ConeGeometry(0.012, 0.03, 7), color: PALETTE.honey, pos: [0, 0.35, 0.09], rot: [1.2, 0, 0] },
        // two ear tufts
        { geo: new THREE.ConeGeometry(0.018, 0.05, 7), color: body, pos: [-0.045, 0.44, 0], rot: [0, 0, 0.35] },
        { geo: new THREE.ConeGeometry(0.018, 0.05, 7), color: body, pos: [0.045, 0.44, 0], rot: [0, 0, -0.35] },
      ]),
    [body, face]
  )
  return <mesh {...x} geometry={geo}><meshToonMaterial vertexColors gradientMap={ramp} /></mesh>
}

/** A snow hare crouched beside its burrow — a low white-grey body, a small head, two long
 *  laid-back ears, a puff tail, next to a little snow mound with a dark burrow mouth. Cold white
 *  palette (no warm accent). ONE merged draw; base y=0. */
export function ClaySnowHare({ fur = PALETTE.hareFur, shade = PALETTE.hareShade, ...x }: Xform & { fur?: string; shade?: string }) {
  const ramp = useClayRamp()
  const geo = useMemo(
    () =>
      buildMergedClay([
        // burrow mound + dark mouth, off to one side
        { geo: new THREE.SphereGeometry(0.09, 14, 10), color: fur, pos: [-0.14, 0.03, 0.02], scl: [1.3, 0.6, 1.2] },
        { geo: new THREE.SphereGeometry(0.035, 10, 10), color: PALETTE.ink, pos: [-0.11, 0.03, 0.06], scl: [1.2, 1, 0.5] },
        // crouched hare body
        { geo: new THREE.SphereGeometry(0.07, 14, 12), color: fur, pos: [0.05, 0.05, 0], scl: [1.35, 0.85, 1] },
        // haunch
        { geo: new THREE.SphereGeometry(0.05, 12, 12), color: fur, pos: [0.0, 0.05, 0.0], scl: [1, 1, 1] },
        // head lifted at the front
        { geo: new THREE.SphereGeometry(0.04, 12, 12), color: fur, pos: [0.13, 0.08, 0], scl: [1.05, 1, 0.95] },
        // two long ears laid back (pale outer, shaded inner)
        { geo: new THREE.SphereGeometry(0.028, 10, 8), color: fur, pos: [0.08, 0.13, -0.025], rot: [0, 0, -0.5], scl: [0.5, 2.4, 0.4] },
        { geo: new THREE.SphereGeometry(0.028, 10, 8), color: fur, pos: [0.08, 0.13, 0.025], rot: [0, 0, -0.5], scl: [0.5, 2.4, 0.4] },
        { geo: new THREE.SphereGeometry(0.02, 8, 8), color: shade, pos: [0.083, 0.135, -0.025], rot: [0, 0, -0.5], scl: [0.35, 2.0, 0.25] },
        // puff tail
        { geo: new THREE.SphereGeometry(0.028, 10, 10), color: fur, pos: [-0.02, 0.05, 0] },
        // ink eye + nose
        { geo: new THREE.SphereGeometry(0.008, 6, 6), color: PALETTE.ink, pos: [0.15, 0.09, 0.025] },
        { geo: new THREE.SphereGeometry(0.008, 6, 6), color: PALETTE.ink, pos: [0.165, 0.075, 0] },
      ]),
    [fur, shade]
  )
  return <mesh {...x} geometry={geo}><meshToonMaterial vertexColors gradientMap={ramp} /></mesh>
}

/** A frozen waterfall spilling off a ledge — a dark rock back-wall, a curtain of pale icicle
 *  columns hanging down (wide at the ledge, tapering to points) over a frozen pool at the base.
 *  ONE merged draw; base y=0 (the pool). Reads as the winter's "frozen fall" where terrain steps.
 *  All cold (ice / iceDeep / stone) — no warm accent. */
export function ClayFrozenFall({ iceCol = PALETTE.ice, iceShade = PALETTE.iceDeep, rock = PALETTE.stone, ...x }: Xform & { iceCol?: string; iceShade?: string; rock?: string }) {
  const ramp = useClayRamp()
  const geo = useMemo(() => {
    const parts: ClayPart[] = [
      // the rock ledge / back wall the fall pours over
      { geo: new THREE.BoxGeometry(0.34, 0.44, 0.1), color: rock, pos: [0, 0.24, -0.06], rot: [0.12, 0, 0] },
      { geo: new THREE.BoxGeometry(0.4, 0.08, 0.16), color: rock, pos: [0, 0.44, -0.02] }, // the lip
      // frozen pool at the base
      { geo: new THREE.CylinderGeometry(0.18, 0.15, 0.03, 16), color: iceCol, pos: [0, 0.015, 0.03] },
    ]
    // a curtain of icicle columns hanging from the lip, varied lengths + shades
    const cols: Array<{ px: number; len: number; r: number; shade: boolean }> = [
      { px: -0.13, len: 0.34, r: 0.03, shade: false },
      { px: -0.07, len: 0.42, r: 0.036, shade: true },
      { px: -0.01, len: 0.3, r: 0.028, shade: false },
      { px: 0.05, len: 0.4, r: 0.034, shade: true },
      { px: 0.12, len: 0.32, r: 0.03, shade: false },
    ]
    for (const c of cols) {
      // an icicle = a downward cone (wide at the ledge, point at the bottom); base of the cone
      // sits at the lip (~y0.42), tip hangs toward the pool.
      const topY = 0.42
      parts.push({
        geo: new THREE.ConeGeometry(c.r, c.len, 8),
        color: c.shade ? iceShade : iceCol,
        pos: [c.px, topY - c.len / 2, 0.01],
        rot: [0, 0, Math.PI], // point downward
      })
    }
    return buildMergedClay(parts)
  }, [iceCol, iceShade, rock])
  return <mesh {...x} geometry={geo}><meshToonMaterial vertexColors gradientMap={ramp} /></mesh>
}

/** A snow-laden conifer — a short trunk under three tiers of drooping cone boughs (cold spruce),
 *  each crowned with a settled layer of snow, plus a snow cap on the crown. Distinct from the
 *  Forest's clean conifer cones (Task 23): the flattened, snow-topped tiers read as branches
 *  bowed under snow. ONE merged draw; base y=0. Cold (spruce + snow) — no warm accent. */
export function ClaySnowConifer({ needle = PALETTE.spruceDeep, snow = PALETTE.snow, height = 0.5, ...x }: Xform & { needle?: string; snow?: string; height?: number }) {
  const ramp = useClayRamp()
  const geo = useMemo(() => {
    const h = height
    const parts: ClayPart[] = [
      // trunk
      { geo: new THREE.CylinderGeometry(0.026, 0.036, h * 0.32, 6), color: PALETTE.clayPath, pos: [0, h * 0.14, 0] },
    ]
    // three drooping bough tiers (flattened cones), each with a snow layer riding its crown
    const tiers = [
      { y: h * 0.36, r: h * 0.4, coneH: h * 0.34 },
      { y: h * 0.58, r: h * 0.3, coneH: h * 0.3 },
      { y: h * 0.78, r: h * 0.2, coneH: h * 0.26 },
    ]
    for (const t of tiers) {
      parts.push({ geo: new THREE.ConeGeometry(t.r, t.coneH, 8), color: needle, pos: [0, t.y, 0], scl: [1, 0.82, 1] })
      // a settled snow layer capping the tier (a flatter, slightly smaller cone in snow)
      parts.push({ geo: new THREE.ConeGeometry(t.r * 0.86, t.coneH * 0.42, 8), color: snow, pos: [0, t.y + t.coneH * 0.24, 0], scl: [1, 0.7, 1] })
    }
    // crown snow cap
    parts.push({ geo: new THREE.ConeGeometry(h * 0.11, h * 0.18, 8), color: snow, pos: [0, h * 0.94, 0] })
    return buildMergedClay(parts)
  }, [needle, snow, height])
  return <mesh {...x} geometry={geo}><meshToonMaterial vertexColors gradientMap={ramp} /></mesh>
}

/**
 * A snow-block igloo (Task 60 — the winter ending set). Built rather than moulded: the read has
 * to survive at reading size, where a bare hemisphere is just a white lump indistinguishable from
 * a drift. Three things carry it — courses of blocks laid around the dome, a stubby entrance
 * tunnel breaking the silhouette, and a dark doorway mouth. The doorway is PAINT (a recessed
 * ochre disc); this lab has no lights to put inside one.
 */
export function ClayIgloo({
  shell = PALETTE.iglooShell,
  block = PALETTE.snow,
  seam = PALETTE.ice,
  door = PALETTE.iglooDoor,
  r = 0.24,
  ...x
}: Xform & { shell?: string; block?: string; seam?: string; door?: string; r?: number }) {
  const ramp = useClayRamp()
  const geo = useMemo(() => {
    const parts: ClayPart[] = [
      // The dome takes the MID tone and the blocks take the near-whites. Painting the whole hut
      // snow-white is the obvious move and it is the wrong one: on a snow field the figure then
      // has nothing to be lighter than, which is exactly how the Round-15 yeti earned its rebuild.
      { geo: new THREE.SphereGeometry(r, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), color: shell, scl: [1, 0.82, 1] },
      { geo: new THREE.CylinderGeometry(r * 1.06, r * 1.16, r * 0.16, 14), color: block, pos: [0, r * 0.06, 0] },
    ]
    // Three courses of blocks, offset from each other so the wall reads as LAID. This camera looks
    // DOWN at anything on the planet's face, so the courses are what the visitor actually sees:
    // from above they are concentric rings of light blocks on a darker dome.
    const courses = [
      { t: 0.22, ring: 0.99, n: 9, phase: 0 },
      { t: 0.5, ring: 0.9, n: 7, phase: Math.PI / 7 },
      { t: 0.75, ring: 0.68, n: 5, phase: Math.PI / 5 },
    ]
    for (const c of courses) {
      const up = Math.sin(c.t * Math.PI * 0.5)
      const rad = r * c.ring * Math.cos(c.t * Math.PI * 0.5)
      for (let i = 0; i < c.n; i++) {
        const a = c.phase + (i / c.n) * Math.PI * 2
        parts.push({
          geo: new THREE.BoxGeometry(r * 0.34, r * 0.13, r * 0.17),
          color: i % 3 === 2 ? seam : block,
          pos: [Math.cos(a) * rad, r * 0.83 * up, Math.sin(a) * rad],
          rot: [0, -a, 0],
        })
      }
    }
    // The smoke hole. A doorway on a vertical wall is invisible from directly overhead, so the
    // opening that carries the read at this camera is the one in the ROOF — which is also where a
    // real snow house puts it. Ringed by a raised collar so it is a hole, not a smudge.
    parts.push({ geo: new THREE.TorusGeometry(r * 0.17, r * 0.045, 6, 14), color: block, pos: [0, r * 0.8, 0], rot: [Math.PI / 2, 0, 0] })
    parts.push({ geo: new THREE.CircleGeometry(r * 0.16, 12), color: door, pos: [0, r * 0.845, 0], rot: [-Math.PI / 2, 0, 0] })
    // entrance tunnel + its shadowed mouth, breaking the circle in plan view
    parts.push({ geo: new THREE.CylinderGeometry(r * 0.36, r * 0.4, r * 0.72, 10), color: block, pos: [0, r * 0.28, r * 0.82], rot: [Math.PI / 2, 0, 0] })
    parts.push({ geo: new THREE.SphereGeometry(r * 0.38, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), color: shell, pos: [0, r * 0.28, r * 0.82], rot: [Math.PI / 2, 0, 0], scl: [1, 0.9, 1] })
    parts.push({ geo: new THREE.CircleGeometry(r * 0.28, 12), color: door, pos: [0, r * 0.3, r * 1.16], rot: [-0.5, 0, 0] })
    return buildMergedClay(parts)
  }, [shell, block, seam, door, r])
  return <mesh {...x} geometry={geo}><meshToonMaterial vertexColors gradientMap={ramp} /></mesh>
}

/**
 * A woolly mammoth (Task 60). Lurking-wildlife scale, like the fox and the hare — not a monument.
 *
 * Both identifying features are built for the reading camera, which looks DOWN on anything
 * standing on the planet's face. Tusks that curve UP are the picture-book pose and they foreshorten
 * to two dots from overhead, so these sweep OUT and FORWARD in the horizontal plane instead, hooking
 * back at the tips — a shape read in plan, which is the view that exists. The SHAG is likewise
 * structural: eight tufts wide enough to break the body's outline from above, alternating tone so
 * the break survives the toon ramp flattening the lot into one band.
 */
export function ClayMammoth({
  fur = PALETTE.mammothFur,
  shag = PALETTE.mammothShag,
  tusk = PALETTE.mammothTusk,
  ...x
}: Xform & { fur?: string; shag?: string; tusk?: string }) {
  const ramp = useClayRamp()
  const geo = useMemo(() => {
    const parts: ClayPart[] = [
      { geo: new THREE.SphereGeometry(0.115, 16, 14), color: fur, pos: [0, 0.135, 0], scl: [1.45, 1.05, 1] },
      // shoulder hump — the profile cue, and from above it is the lighter ridge down the back
      { geo: new THREE.SphereGeometry(0.066, 12, 10), color: fur, pos: [0.045, 0.215, 0], scl: [1.5, 0.8, 0.85] },
    ]
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2
      parts.push({
        geo: new THREE.SphereGeometry(0.062, 8, 7),
        color: i % 2 === 0 ? shag : fur,
        pos: [Math.cos(a) * 0.132, 0.086 + (i % 3) * 0.014, Math.sin(a) * 0.098],
        scl: [0.95, 1.35, 0.95],
        rot: [0, 0, Math.cos(a) * 0.32],
      })
    }
    const legs: Array<[number, number]> = [[0.085, 0.052], [0.085, -0.052], [-0.075, 0.052], [-0.075, -0.052]]
    for (const [lx, lz] of legs) {
      parts.push({ geo: new THREE.CylinderGeometry(0.031, 0.026, 0.076, 7), color: shag, pos: [lx, 0.038, lz] })
    }
    parts.push({ geo: new THREE.SphereGeometry(0.068, 12, 12), color: fur, pos: [0.168, 0.15, 0], scl: [1, 1.05, 0.95] })
    parts.push({ geo: new THREE.SphereGeometry(0.032, 8, 8), color: shag, pos: [0.15, 0.212, 0], scl: [1.3, 0.7, 1.2] })
    const trunk: Array<[number, number, number, number]> = [
      [0.218, 0.112, 0, 0.028],
      [0.248, 0.076, 0, 0.023],
      [0.268, 0.04, 0, 0.018],
      [0.258, 0.014, 0, 0.014],
    ]
    for (const [tx, ty, tz, tr] of trunk) {
      parts.push({ geo: new THREE.SphereGeometry(tr, 8, 8), color: fur, pos: [tx, ty, tz] })
    }
    for (const sz of [1, -1]) {
      parts.push({ geo: new THREE.SphereGeometry(0.034, 8, 8), color: shag, pos: [0.138, 0.163, 0.058 * sz], scl: [0.5, 1, 1.1] })
    }
    // THE TUSKS — built as an explicit curve in the horizontal plane rather than a rotated arc,
    // so the shape read from overhead is the shape authored, with no orientation guesswork.
    // Sampled densely enough that consecutive beads OVERLAP — at five points the spacing
    // exceeded the diameter and the tusk read as a string of pearls under magnification.
    const curve: Array<[number, number, number, number]> = [
      [0.202, 0.102, 0.05, 0.018],
      [0.225, 0.1, 0.064, 0.017],
      [0.248, 0.098, 0.076, 0.0155],
      [0.271, 0.097, 0.084, 0.0145],
      [0.292, 0.098, 0.088, 0.0135],
      [0.313, 0.1, 0.085, 0.0125],
      [0.332, 0.104, 0.078, 0.0115],
      [0.348, 0.109, 0.066, 0.0105],
      [0.36, 0.114, 0.052, 0.0095],
    ]
    for (const sz of [1, -1]) {
      for (const [cx, cy, cz, cr] of curve) {
        parts.push({ geo: new THREE.SphereGeometry(cr, 7, 7), color: tusk, pos: [cx, cy, cz * sz] })
      }
    }
    parts.push({ geo: new THREE.SphereGeometry(0.009, 6, 6), color: PALETTE.ink, pos: [0.211, 0.172, 0.045] })
    return buildMergedClay(parts)
  }, [fur, shag, tusk])
  return <mesh {...x} geometry={geo}><meshToonMaterial vertexColors gradientMap={ramp} /></mesh>
}

/**
 * An iceberg for the left ocean (Task 60). Faceted rather than moulded: after merging, the whole
 * figure takes flat per-face normals (the merged buffer is non-indexed, so computeVertexNormals
 * gives exactly that) — the same trick the pyramids use, and the reason a berg reads as CUT ice
 * beside the planet's pressed-clay everything-else. A wider, darker shelf sits at the waterline so
 * the mass looks like it continues below the surface rather than resting on it.
 */
export function ClayIceberg({
  ice = PALETTE.ice,
  deep = PALETTE.iceDeep,
  crest = PALETTE.snow,
  r = 0.15,
  ...x
}: Xform & { ice?: string; deep?: string; crest?: string; r?: number }) {
  const ramp = useClayRamp()
  const geo = useMemo(() => {
    const g = buildMergedClay([
      // the waterline shelf: wide, low and darker — it is what stops the berg looking perched
      { geo: new THREE.DodecahedronGeometry(r * 0.95, 0), color: deep, pos: [0, -r * 0.16, 0], scl: [1.15, 0.34, 1.05] },
      // main peak, tilted off vertical
      { geo: new THREE.ConeGeometry(r * 0.72, r * 1.72, 5), color: ice, pos: [r * 0.04, r * 0.72, 0], rot: [0.12, 0.6, -0.16] },
      // two subsidiary crags, so the silhouette is bergy rather than one cone
      { geo: new THREE.ConeGeometry(r * 0.42, r * 0.92, 5), color: ice, pos: [-r * 0.56, r * 0.3, r * 0.3], rot: [-0.2, 1.4, 0.28] },
      { geo: new THREE.OctahedronGeometry(r * 0.4, 0), color: ice, pos: [r * 0.5, r * 0.26, -r * 0.34], rot: [0.3, 0.4, 0.2], scl: [1, 0.85, 1] },
      // a snow crest catching the light on the tallest face
      { geo: new THREE.ConeGeometry(r * 0.3, r * 0.44, 5), color: crest, pos: [r * 0.02, r * 1.42, 0], rot: [0.12, 0.6, -0.16] },
    ])
    g.computeVertexNormals() // per-face flat normals → cut ice, not a moulded lump
    return g
  }, [ice, deep, crest, r])
  return <mesh {...x} geometry={geo}><meshToonMaterial vertexColors gradientMap={ramp} /></mesh>
}
