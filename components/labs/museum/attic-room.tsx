'use client'

import { Suspense, useMemo } from 'react'
import * as THREE from 'three'
import { atticLabs } from '@/lib/labs-manifest'
import {
  ATTIC,
  STAIR,
  atticDepth,
  atticPlacements,
  atticPlaquePlacement,
} from './layout'
import { AtticDressing, CornerDrape } from './attic-dressing'
import { Painting, PaintingBoundary } from './painting'
import { makeAtticPlaqueTexture, makePlankTexture } from './textures'

const BEAM = '#3d2f21'
const ROOF = '#2e241a'
const WALLTONE = '#8a7a63'

/**
 * A roof slope as an explicit quad between the knee-wall top line and the
 * ridge line, spanning the room's full depth. Built from vertices rather than
 * a rotated plane so the edges land exactly on the knee walls and both gable
 * triangles — no Euler-order guessing.
 */
function makeRoofSlope(side: -1 | 1, hallLen: number): THREE.BufferGeometry {
  const floorYAbs = STAIR.rise
  const yKnee = floorYAbs + ATTIC.wallHeight
  const yRidge = floorYAbs + ATTIC.ridgeHeight
  const zNear = -(hallLen + STAIR.run)
  const zFar = -(hallLen + STAIR.run + ATTIC.depth)
  const xKnee = side * ATTIC.halfWidth
  // knee-near, knee-far, ridge-far, ridge-near
  const verts = new Float32Array([
    xKnee, yKnee, zNear,
    xKnee, yKnee, zFar,
    0, yRidge, zFar,
    0, yRidge, zNear,
  ])
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(verts, 3))
  geo.setIndex([0, 1, 2, 0, 2, 3])
  geo.computeVertexNormals()
  return geo
}

/**
 * The failed-experiments wing: a gabled room above the end zone plus the
 * stair shaft that reaches it. Exhibits use the same Painting component as
 * the hall, so focus and click-to-enter work unchanged.
 */
export function AtticRoom({
  hallLen,
  register,
  focused,
}: {
  hallLen: number
  register: (slug: string, obj: THREE.Object3D | null) => void
  focused: string | null
}) {
  const far = atticDepth(hallLen)
  const roomZ = -(hallLen + STAIR.run + ATTIC.depth / 2) // room center
  const floorYAbs = STAIR.rise

  const planks = useMemo(() => {
    const t = makePlankTexture()
    t.repeat.set(ATTIC.halfWidth, ATTIC.depth / 3.5)
    return t
  }, [])

  const plaque = useMemo(() => {
    const first = atticLabs[0]
    return makeAtticPlaqueTexture('failed experiments', first?.retrospective ?? '')
  }, [])

  const placements = useMemo(() => atticPlacements(atticLabs, hallLen), [hallLen])
  const plaquePos = useMemo(() => atticPlaquePlacement(hallLen), [hallLen])

  // Roof planes: explicit quads from the side-wall tops to the ridge.
  const roofs = useMemo(() => [makeRoofSlope(-1, hallLen), makeRoofSlope(1, hallLen)], [hallLen])

  return (
    <group>
      {/* Stair shaft: two side walls, a ceiling, and the ramp floor */}
      <StairShaft hallLen={hallLen} />

      {/* Attic floor */}
      <mesh rotation-x={-Math.PI / 2} position={[0, floorYAbs, roomZ]}>
        <planeGeometry args={[ATTIC.halfWidth * 2, ATTIC.depth]} />
        <meshStandardMaterial map={planks} roughness={0.85} />
      </mesh>

      {/* Side knee walls */}
      {[-1, 1].map((s) => (
        <mesh
          key={s}
          position={[s * ATTIC.halfWidth, floorYAbs + ATTIC.wallHeight / 2, roomZ]}
          rotation-y={s > 0 ? -Math.PI / 2 : Math.PI / 2}
        >
          <planeGeometry args={[ATTIC.depth, ATTIC.wallHeight]} />
          <meshStandardMaterial color={WALLTONE} roughness={0.95} side={THREE.DoubleSide} />
        </mesh>
      ))}

      {/* Roof slopes up to the ridge */}
      {roofs.map((geo, i) => (
        <mesh key={i} geometry={geo}>
          <meshStandardMaterial color={ROOF} roughness={1} side={THREE.DoubleSide} />
        </mesh>
      ))}

      {/* Gable walls: entry (with the stair opening) and the far exhibit wall */}
      <GableWall z={-(hallLen + STAIR.run)} floorYAbs={floorYAbs} withOpening />
      <GableWall z={-far} floorYAbs={floorYAbs} />

      {/* Roof beams */}
      {[0.16, 0.42, 0.68].map((t) => (
        <mesh
          key={t}
          position={[0, floorYAbs + ATTIC.ridgeHeight - 0.35, -(hallLen + STAIR.run + t * ATTIC.depth)]}
        >
          <boxGeometry args={[ATTIC.halfWidth * 2 - 0.6, 0.18, 0.18]} />
          <meshStandardMaterial color={BEAM} roughness={0.9} />
        </mesh>
      ))}

      {/* One dim warm bulb at the ridge */}
      <pointLight
        position={[0, floorYAbs + ATTIC.ridgeHeight - 0.5, roomZ]}
        intensity={9}
        distance={11}
        decay={1.8}
        color="#ffd9a0"
      />

      {/* Exhibits — same Painting, same focus/enter contract as the hall */}
      <Suspense fallback={null}>
        {placements.map((p) => (
          <PaintingBoundary key={p.slug}>
            <Painting placement={p} focused={focused === p.slug} register={register} />
          </PaintingBoundary>
        ))}
      </Suspense>

      {/* The saga plaque */}
      <mesh position={plaquePos.position} rotation-y={plaquePos.rotationY}>
        <planeGeometry args={[1.15, 1.15]} />
        <meshStandardMaterial map={plaque} roughness={0.9} />
      </mesh>

      {/* Inert set dressing: sheeted frames, covered statues, a corner drape */}
      <AtticDressing hallLen={hallLen} />
      {placements[0] && <CornerDrape placement={placements[0]} />}
    </group>
  )
}

/** Corridor interior: plank walls, stepped treads, low ceiling, and its own
 * small bulb — from the hall the doorway glows instead of reading as a void
 * (user note at preview: "you can see nothing the moment entering"). The
 * visual steps sit under the smooth floorY ramp the camera actually walks;
 * the ≤0.12 u mismatch is invisible at eye height. */
const STEPS = 10

function StairShaft({ hallLen }: { hallLen: number }) {
  const midZ = -(hallLen + STAIR.run / 2)
  const w = STAIR.doorWidth + 0.4

  const boards = useMemo(() => {
    const t = makePlankTexture()
    t.repeat.set(2.5, 3)
    return t
  }, [])

  const stepDepth = STAIR.run / STEPS
  const stepRise = STAIR.rise / STEPS

  return (
    <group>
      {/* Stepped treads: each step is a full-height box up to its tread top */}
      {Array.from({ length: STEPS }, (_, i) => (
        <mesh
          key={i}
          position={[
            STAIR.doorX,
            ((i + 1) * stepRise) / 2,
            -(hallLen + (i + 0.5) * stepDepth),
          ]}
        >
          <boxGeometry args={[w, (i + 1) * stepRise, stepDepth]} />
          <meshStandardMaterial color="#6b5844" roughness={0.9} />
        </mesh>
      ))}
      {/* Side walls in rough boards */}
      {[-1, 1].map((s) => (
        <mesh
          key={s}
          position={[STAIR.doorX + (s * w) / 2, STAIR.rise / 2 + 1.1, midZ]}
          rotation-y={s > 0 ? -Math.PI / 2 : Math.PI / 2}
        >
          <planeGeometry args={[STAIR.run, STAIR.rise + 3.4]} />
          <meshStandardMaterial map={boards} color="#b9a58c" roughness={0.95} side={THREE.DoubleSide} />
        </mesh>
      ))}
      {/* Shaft ceiling */}
      <mesh position={[STAIR.doorX, STAIR.rise + 2.7, midZ]} rotation-x={Math.PI / 2}>
        <planeGeometry args={[w, STAIR.run]} />
        <meshStandardMaterial color="#4a3c2d" roughness={1} side={THREE.DoubleSide} />
      </mesh>
      {/* The stairwell's own bulb — visible as a warm glow from the hall */}
      <pointLight
        position={[STAIR.doorX, STAIR.rise + 1.6, midZ]}
        intensity={7}
        distance={8}
        decay={1.8}
        color="#ffdcae"
      />
    </group>
  )
}

/** A gable end: rectangle up to wall height plus the triangle to the ridge.
 * All materials are DoubleSide, so both gables are placed in world
 * coordinates with no rotation — no mirrored math to get wrong. */
function GableWall({
  z,
  floorYAbs,
  withOpening,
}: {
  z: number
  floorYAbs: number
  withOpening?: boolean
}) {
  const tri = useMemo(() => {
    const shape = new THREE.Shape()
    shape.moveTo(-ATTIC.halfWidth, 0)
    shape.lineTo(ATTIC.halfWidth, 0)
    shape.lineTo(0, ATTIC.ridgeHeight - ATTIC.wallHeight)
    shape.closePath()
    return new THREE.ShapeGeometry(shape)
  }, [])
  // The stair shaft interior is doorWidth + 0.4 wide; the opening matches it
  // and runs to the right knee wall (a sliver segment there would be
  // degenerate). Left segment: from -halfWidth to the opening's left edge.
  const openLeft = STAIR.doorX - (STAIR.doorWidth + 0.4) / 2 // = 1.6
  const leftW = openLeft + ATTIC.halfWidth // = 5.1
  return (
    <group position={[0, 0, z]}>
      {withOpening ? (
        <mesh position={[openLeft - leftW / 2, floorYAbs + ATTIC.wallHeight / 2, 0]}>
          <planeGeometry args={[leftW, ATTIC.wallHeight]} />
          <meshStandardMaterial color={WALLTONE} roughness={0.95} side={THREE.DoubleSide} />
        </mesh>
      ) : (
        <mesh position={[0, floorYAbs + ATTIC.wallHeight / 2, 0]}>
          <planeGeometry args={[ATTIC.halfWidth * 2, ATTIC.wallHeight]} />
          <meshStandardMaterial color={WALLTONE} roughness={0.95} side={THREE.DoubleSide} />
        </mesh>
      )}
      <mesh geometry={tri} position={[0, floorYAbs + ATTIC.wallHeight, 0]}>
        <meshStandardMaterial color={WALLTONE} roughness={0.95} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}
