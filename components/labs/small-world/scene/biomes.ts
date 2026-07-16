/**
 * Authored biome map — the single hand-placed source of truth for where each
 * feature lives on the planet. Terrain displacement, vertex colors, water,
 * props, forest scatter and bridges are ALL derived from these declarations,
 * so the world reads as designed regions ("ocean owns the right, snow + one
 * mountain range own the left, a forest patch, a brown canyon, rivers the girl
 * crosses") rather than tuned global noise.
 *
 * Coordinate frame: planet-LOCAL unit directions. The girl walks the great
 * circle at nx=0 (the y-z plane); the planet spins about x, so nx=±1 are the
 * permanent left/right poles from the fixed camera. Features live off the spine
 * (|nx| ≥ ~0.5) so her lane stays calm — except the authored river crossings.
 *
 * Purity: every evaluator is a pure scalar function. Arc planes and normalized
 * directions are precomputed once at module load, so the hot paths allocate
 * nothing (no Vector3 churn per vertex / per frame).
 */

export type Cap = { dir: readonly [number, number, number]; radius: number; feather: number }
export type Peak = { dir: readonly [number, number, number]; h: number; r: number }

const clamp01 = (t: number): number => (t < 0 ? 0 : t > 1 ? 1 : t)
const smoothstep01 = (t: number): number => {
  const x = clamp01(t)
  return x * x * (3 - 2 * x)
}
const clampU = (t: number): number => (t < -1 ? -1 : t > 1 ? 1 : t)

function norm3(v: readonly [number, number, number]): [number, number, number] {
  const l = Math.hypot(v[0], v[1], v[2]) || 1
  return [v[0] / l, v[1] / l, v[2] / l]
}

/** Water glaze radius as a fraction of PLANET_RADIUS (Aram's "a lot more water"). */
export const WATER_LEVEL = 0.972
/** River channel floor + ocean floor depth targets (bump units, radius = R·(1+bump)). */
const RIVER_DEPTH = 0.05 // floor ~0.95R — below waterline, above ocean floor
const OCEAN_DEPTH = 0.09 // floor ~0.91R — a genuine basin
const CANYON_DEPTH = 0.055
const CANYON_BANK = 0.05

// --- Authored regions ------------------------------------------------------

/** The ocean owns the +x side: a hemisphere-ish basin at the right pole. */
export const OCEAN: Cap = { dir: norm3([0.94, -0.12, 0.16]), radius: 0.95, feather: 0.34 }

/** The cold region on the near-left flank — pulled off the pure -x pole so its
 * snowy ground + range actually face the camera (a pole cap foreshortens to an
 * invisible edge sliver). Opposite the ocean, clear of the girl's lane. */
export const SNOW: Cap = { dir: norm3([-0.66, 0.22, 0.42]), radius: 0.5, feather: 0.26 }

/** A dense forest patch on the near-left flank, clear of ocean + snow cores. */
export const FOREST: Cap = { dir: norm3([-0.46, 0.5, 0.73]), radius: 0.44, feather: 0.16 }

/** ONE distinct mountain range: a tight snowy arc across the cold left-front. */
export const RANGE: Peak[] = [
  { dir: norm3([-0.62, 0.52, 0.52]), h: 0.17, r: 0.13 },
  { dir: norm3([-0.68, 0.3, 0.64]), h: 0.2, r: 0.12 },
  { dir: norm3([-0.71, 0.06, 0.69]), h: 0.18, r: 0.12 },
  { dir: norm3([-0.7, -0.2, 0.66]), h: 0.16, r: 0.13 },
  { dir: norm3([-0.64, -0.42, 0.62]), h: 0.14, r: 0.14 },
]

/**
 * A great-circle arc field: precomputed plane normal + endpoint angle so the
 * per-point distance is pure scalar trig.
 */
type Arc = {
  ax: number; ay: number; az: number
  bx: number; by: number; bz: number
  nx: number; ny: number; nz: number
  ab: number
}
function makeArc(a: readonly [number, number, number], b: readonly [number, number, number]): Arc {
  const [ax, ay, az] = norm3(a)
  const [bx, by, bz] = norm3(b)
  // plane normal = normalize(a × b)
  const cx = ay * bz - az * by
  const cy = az * bx - ax * bz
  const cz = ax * by - ay * bx
  const [nx, ny, nz] = norm3([cx, cy, cz])
  const ab = Math.acos(clampU(ax * bx + ay * by + az * bz))
  return { ax, ay, az, bx, by, bz, nx, ny, nz, ab }
}

/** Angular distance from a unit point to a great-circle arc segment (radians). */
function arcDist(px: number, py: number, pz: number, arc: Arc): number {
  const pn = px * arc.nx + py * arc.ny + pz * arc.nz
  // project P onto the arc's plane
  let qx = px - arc.nx * pn
  let qy = py - arc.ny * pn
  let qz = pz - arc.nz * pn
  const ql = Math.hypot(qx, qy, qz) || 1
  qx /= ql; qy /= ql; qz /= ql
  const angA = Math.acos(clampU(qx * arc.ax + qy * arc.ay + qz * arc.az))
  const angB = Math.acos(clampU(qx * arc.bx + qy * arc.by + qz * arc.bz))
  if (angA + angB <= arc.ab + 1e-3) return Math.abs(Math.asin(clampU(pn)))
  const dA = Math.acos(clampU(px * arc.ax + py * arc.ay + pz * arc.az))
  const dB = Math.acos(clampU(px * arc.bx + py * arc.by + pz * arc.bz))
  return dA < dB ? dA : dB
}

/**
 * ONE rich-brown canyon on the ocean's warm side (between the spine and the
 * ocean): a carved channel with raised earth banks.
 */
export const CANYON_ARC = makeArc([0.55, 0.62, 0.55], [0.74, -0.12, 0.66])
const CANYON_HALF = 0.06 // channel half-width (rad)

/**
 * River crossings — authored local thetas where a channel crosses the girl's
 * ring, running out to the ocean. Chosen in the widest gaps between chapter
 * prop clusters: ≥0.12 rad from every |x|<0.35 PropAnchor and ≥0.1 rad from the
 * pinned-test sample thetas. (The brief's [1.35,3.6,5.1] all fell on prop
 * clusters; these are the relocated, verified crossings.)
 */
export const RIVER_CROSSINGS = [2.65, 4.55, 6.03] as const
const RIVER_HALF = 0.045 // channel half-width (rad)
const RIVER_RAMP = 0.05 // carve feather beyond the half-width

/** Point on the girl's ring (nx=0) at a crossing theta. */
function crossPoint(theta: number): [number, number, number] {
  return [0, Math.cos(theta), Math.sin(theta)]
}
/** Each river arc runs from its spine crossing out toward the ocean edge. */
const RIVER_ARCS: Arc[] = RIVER_CROSSINGS.map((theta) => {
  const c = crossPoint(theta)
  // aim at a point ~80% of the way toward the ocean centre so the mouth lands
  // in the ocean shallows, bending off the spine toward +x.
  const o = OCEAN.dir
  const mx = c[0] * 0.2 + o[0] * 0.8
  const my = c[1] * 0.2 + o[1] * 0.8
  const mz = c[2] * 0.2 + o[2] * 0.8
  return makeArc(c, [mx, my, mz])
})

// --- Field evaluators ------------------------------------------------------

/** Smooth 0..1 membership of a cap, feathered at its rim. */
export function capMask(nx: number, ny: number, nz: number, cap: Cap): number {
  const dot = clampU(nx * cap.dir[0] + ny * cap.dir[1] + nz * cap.dir[2])
  const d = Math.acos(dot)
  return smoothstep01((cap.radius - d) / cap.feather)
}

/** Distance (rad) to the nearest river channel centre-arc. */
export function riverDist(nx: number, ny: number, nz: number): number {
  let m = Infinity
  for (let i = 0; i < RIVER_ARCS.length; i++) {
    const d = arcDist(nx, ny, nz, RIVER_ARCS[i])
    if (d < m) m = d
  }
  return m
}

/** Distance (rad) to the canyon centre-arc. */
export function canyonDist(nx: number, ny: number, nz: number): number {
  return arcDist(nx, ny, nz, CANYON_ARC)
}

/**
 * Authored feature displacement, added on top of the base meadow in
 * terrainBump. Pure; scalar-only.
 */
export function biomeBump(nx: number, ny: number, nz: number): number {
  let bump = 0

  // Ocean basin — dips well below the waterline into a real sea.
  bump -= OCEAN_DEPTH * capMask(nx, ny, nz, OCEAN)

  // The mountain range — gaussian peaks in a tight arc.
  for (let i = 0; i < RANGE.length; i++) {
    const p = RANGE[i]
    const dot = clampU(nx * p.dir[0] + ny * p.dir[1] + nz * p.dir[2])
    const d = Math.acos(dot)
    const g = d / p.r
    bump += p.h * Math.exp(-g * g)
  }

  // Canyon — a carved channel flanked by raised earth banks.
  const cd = canyonDist(nx, ny, nz)
  if (cd < CANYON_HALF + 0.12) {
    const channel = -CANYON_DEPTH * smoothstep01((CANYON_HALF - cd) / 0.045)
    const bank =
      CANYON_BANK *
      (smoothstep01((cd - CANYON_HALF) / 0.03) - smoothstep01((cd - CANYON_HALF - 0.055) / 0.04))
    bump += channel + bank
  }

  // River channels — narrow dips to the river floor (below the waterline).
  const rd = riverDist(nx, ny, nz)
  if (rd < RIVER_HALF + RIVER_RAMP) {
    bump -= RIVER_DEPTH * (1 - smoothstep01((rd - RIVER_HALF) / RIVER_RAMP))
  }

  return bump
}

export type BiomeKind = 'snow' | 'forest' | 'canyon' | 'beach' | 'meadow' | 'underwater'

/**
 * Cheap per-vertex classification for the color pass. `currentBump` is the full
 * terrainBump (base + biome) so the caller doesn't recompute it.
 */
export function biomeTint(
  nx: number,
  ny: number,
  nz: number,
  currentBump: number
): { kind: BiomeKind; t: number } {
  const radius = 1 + currentBump

  // Underwater floors first.
  if (radius < WATER_LEVEL) {
    return { kind: 'underwater', t: clamp01((WATER_LEVEL - radius) / 0.06) }
  }

  const oceanM = capMask(nx, ny, nz, OCEAN)
  const rd = riverDist(nx, ny, nz)
  const nearWater = oceanM > 0.02 || rd < RIVER_HALF + 0.05
  // Beach: a thin sand band just above any waterline.
  if (nearWater && radius < 0.986) {
    return { kind: 'beach', t: clamp01((0.986 - radius) / 0.014) }
  }

  // Canyon walls read as rich brown clay.
  const cd = canyonDist(nx, ny, nz)
  if (cd < CANYON_HALF + 0.05) {
    return { kind: 'canyon', t: clamp01((CANYON_HALF + 0.05 - cd) / (CANYON_HALF + 0.05)) }
  }

  // Cold pole: snow ground, with earth showing on the range's lower flanks.
  const snowM = capMask(nx, ny, nz, SNOW)
  if (snowM > 0.02) {
    return { kind: 'snow', t: snowM }
  }

  // Forest floor.
  const forestM = capMask(nx, ny, nz, FOREST)
  if (forestM > 0.02) {
    return { kind: 'forest', t: forestM }
  }

  return { kind: 'meadow', t: 0 }
}
