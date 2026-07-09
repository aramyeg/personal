import type { LabEntry } from '@/lib/labs-manifest'

/** Hall cross-section and player constants shared by every museum piece. */
export const HALL = { width: 10, height: 6, margin: 0.7 }
export const PLAYER = { eyeHeight: 1.6, speed: 3 }

export const SPACING = 5
export const FIRST_OFFSET = 6
export const END_ZONE = 7

/** Wall x for hung paintings, slightly inside the physical wall. */
const WALL_X = HALL.width / 2 - 0.1
const HANG_HEIGHT = 2

export function hallLength(labCount: number): number {
  return FIRST_OFFSET + labCount * SPACING + END_ZONE
}

export type PaintingPlacement = {
  slug: string
  title: string
  date: string
  thesis: string
  position: [number, number, number]
  rotationY: number
}

/** One frame per manifest entry, alternating walls down the hall. */
export function paintingPlacements(labs: LabEntry[]): PaintingPlacement[] {
  return labs.map((lab, i) => {
    const left = i % 2 === 0
    return {
      slug: lab.slug,
      title: lab.title,
      date: lab.date,
      thesis: lab.thesis,
      position: [left ? -WALL_X : WALL_X, HANG_HEIGHT, -(FIRST_OFFSET + i * SPACING)],
      rotationY: left ? Math.PI / 2 : -Math.PI / 2,
    }
  })
}

/** The cloth-draped "opening soon" frame on the far wall. */
export function drapedPlacement(labCount: number): {
  position: [number, number, number]
  rotationY: number
} {
  return { position: [0, HANG_HEIGHT, -(hallLength(labCount) - 0.1)], rotationY: 0 }
}

/** Clamp a walk position to the hall's inner bounds. */
export function clampToHall(x: number, z: number, length: number): { x: number; z: number } {
  const maxX = HALL.width / 2 - HALL.margin
  return {
    x: Math.min(maxX, Math.max(-maxX, x)),
    z: Math.min(-HALL.margin, Math.max(-(length - HALL.margin), z)),
  }
}

/** Stairwell through the end wall: doorway placement and the climb. */
export const STAIR = {
  doorX: 2.5,
  doorWidth: 1.4,
  doorHeight: 2.6,
  /** how far the corridor runs past the end wall (z units) */
  run: 4,
  /** attic floor height */
  rise: 2.8,
  /** half of the walkable corridor width */
  walkHalf: 0.5,
}

/** The gabled room above the end zone. */
export const ATTIC = {
  halfWidth: 3.5,
  depth: 6,
  /** side wall height above the attic floor */
  wallHeight: 1.6,
  /** ridge height above the attic floor */
  ridgeHeight: 3.4,
  floorMargin: 0.5,
  /** how far exhibits sit off the far gable wall */
  hangOffset: 0.12,
}

/** Absolute far end of walkable space (positive number; walls at z = -atticDepth). */
export function atticDepth(hallLen: number): number {
  return hallLen + STAIR.run + ATTIC.depth
}

/** Floor height under the player: hall 0, linear stair ramp, attic STAIR.rise. */
export function floorY(z: number, hallLen: number): number {
  const into = -z - hallLen // how far past the end wall plane
  if (into <= 0) return 0
  if (into >= STAIR.run) return STAIR.rise
  return (into / STAIR.run) * STAIR.rise
}

type Rect = { minX: number; maxX: number; minZ: number; maxZ: number }

function regions(hallLen: number): Rect[] {
  const maxX = HALL.width / 2 - HALL.margin
  return [
    // hall
    { minX: -maxX, maxX, minZ: -(hallLen - HALL.margin), maxZ: -HALL.margin },
    // stair corridor (overlaps the hall edge so the door plane is crossable)
    {
      minX: STAIR.doorX - STAIR.walkHalf,
      maxX: STAIR.doorX + STAIR.walkHalf,
      minZ: -(hallLen + STAIR.run),
      maxZ: -(hallLen - HALL.margin),
    },
    // attic (starts exactly where the corridor ends)
    {
      minX: -(ATTIC.halfWidth - ATTIC.floorMargin),
      maxX: ATTIC.halfWidth - ATTIC.floorMargin,
      minZ: -(atticDepth(hallLen) - ATTIC.floorMargin),
      maxZ: -(hallLen + STAIR.run),
    },
  ]
}

function inAnyRegion(x: number, z: number, rects: Rect[]): boolean {
  return rects.some((r) => x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ)
}

/**
 * Axis-separated region collision. Frame steps are small (<= ~0.15 u), so
 * trying x and z independently against the region union gives clean wall
 * sliding with no teleporting: a blocked axis simply keeps its previous value.
 */
export function clampToRegions(
  prev: { x: number; z: number },
  next: { x: number; z: number },
  hallLen: number
): { x: number; z: number } {
  const rects = regions(hallLen)
  const x = inAnyRegion(next.x, prev.z, rects) ? next.x : prev.x
  const z = inAnyRegion(x, next.z, rects) ? next.z : prev.z
  return { x, z }
}

/** Exhibits hang on the far gable wall, facing back toward the stairs. */
export function atticPlacements(atticEntries: LabEntry[], hallLen: number): PaintingPlacement[] {
  const wallZ = -(atticDepth(hallLen) - ATTIC.hangOffset)
  const hangY = STAIR.rise + 1.5
  return atticEntries.map((lab, i) => ({
    slug: lab.slug,
    title: lab.title,
    date: lab.date,
    thesis: lab.thesis,
    position: [-1.2 + i * 2.6, hangY, wallZ],
    rotationY: 0,
  }))
}

/** The failed-experiments plaque, right of the first exhibit on the same wall. */
export function atticPlaquePlacement(hallLen: number): {
  position: [number, number, number]
  rotationY: number
} {
  return {
    position: [1.6, STAIR.rise + 1.5, -(atticDepth(hallLen) - ATTIC.hangOffset)],
    rotationY: 0,
  }
}
