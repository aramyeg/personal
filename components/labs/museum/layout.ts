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
