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
/** A basin of water: a cap that carves the terrain down to a floor. */
export type WaterBody = Cap & { depth: number }

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
/** River channel floor depth target (bump units, radius = R·(1+bump)). */
const RIVER_DEPTH = 0.05 // floor ~0.95R — below waterline, above ocean floor
const CANYON_DEPTH = 0.055
const CANYON_BANK = 0.05

// --- Water bodies ----------------------------------------------------------

/** The ocean owns the +x side: a hemisphere-ish basin at the right pole,
 *  present every rotation. */
export const OCEAN: WaterBody = { dir: norm3([0.94, -0.12, 0.16]), radius: 0.95, feather: 0.34, depth: 0.09 }
/** A cold sea on the OPPOSITE (-x, left) side, a whole hemisphere from the
 *  ocean, so water shows on the left of the lap too. Catches the middle river. */
export const SEA: WaterBody = { dir: norm3([-0.6, -0.13, -0.79]), radius: 0.4, feather: 0.26, depth: 0.06 }
/** A highland lake near the top longitude — catches the last river. */
export const LAKE: WaterBody = { dir: norm3([0.5, 0.8, -0.23]), radius: 0.32, feather: 0.22, depth: 0.055 }
/** A little pond nestled in the front meadow — breaks up the central face. */
export const POND: WaterBody = { dir: norm3([0.4, 0.36, 0.84]), radius: 0.14, feather: 0.11, depth: 0.045 }
/** Every water body (basins, masks, beaches). */
export const WATER_BODIES: readonly WaterBody[] = [OCEAN, SEA, LAKE, POND]
/** Bodies rivers may drain to (the pond is decorative — no river feeds it). */
const RIVER_BODIES: readonly WaterBody[] = [OCEAN, SEA, LAKE]

/** A few little islands poking out of the ocean — small delight peaks that ride
 *  above the basin's waterline, ringed by deep water. */
export const ISLANDS: Peak[] = [
  { dir: norm3([0.8, 0.12, 0.34]), h: 0.13, r: 0.055 },
  { dir: norm3([0.87, -0.26, 0.18]), h: 0.11, r: 0.05 },
  { dir: norm3([0.72, 0.28, 0.28]), h: 0.12, r: 0.05 },
]

/** The cold region on the near-left flank — pulled off the pure -x pole so its
 * snowy ground + range actually face the camera (a pole cap foreshortens to an
 * invisible edge sliver). Opposite the ocean, clear of the girl's lane. */
export const SNOW: Cap = { dir: norm3([-0.66, 0.22, 0.42]), radius: 0.5, feather: 0.26 }

/** A dense forest patch on the near-left flank, clear of ocean + snow cores. */
export const FOREST: Cap = { dir: norm3([-0.46, 0.5, 0.73]), radius: 0.44, feather: 0.16 }

/** ONE distinct mountain range: a tight snowy arc across the cold left-front. */
export const RANGE: Peak[] = [
  { dir: norm3([-0.62, 0.52, 0.52]), h: 0.19, r: 0.11 },
  { dir: norm3([-0.68, 0.3, 0.64]), h: 0.28, r: 0.09 }, // sharp snowy spire
  { dir: norm3([-0.71, 0.06, 0.69]), h: 0.26, r: 0.088 }, // sharp snowy spire
  { dir: norm3([-0.7, -0.2, 0.66]), h: 0.17, r: 0.11 },
  { dir: norm3([-0.64, -0.42, 0.62]), h: 0.14, r: 0.13 },
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
/** Nearest river-fed water body to a unit direction (angular distance to centre). */
function nearestBody(dx: number, dy: number, dz: number): WaterBody {
  let best = RIVER_BODIES[0]
  let bestDot = -Infinity
  for (let i = 0; i < RIVER_BODIES.length; i++) {
    const d = RIVER_BODIES[i].dir
    const dot = dx * d[0] + dy * d[1] + dz * d[2]
    if (dot > bestDot) {
      bestDot = dot
      best = RIVER_BODIES[i]
    }
  }
  return best
}
/** Each river runs from its spine crossing out to its NEAREST water body, so the
 *  three crossings drain to three different bodies and water veins the whole lap. */
const RIVER_ARCS: Arc[] = RIVER_CROSSINGS.map((theta) => {
  const c = crossPoint(theta)
  const o = nearestBody(c[0], c[1], c[2]).dir
  // aim ~82% of the way toward the body centre so the mouth lands in its shallows.
  const mx = c[0] * 0.18 + o[0] * 0.82
  const my = c[1] * 0.18 + o[1] * 0.82
  const mz = c[2] * 0.18 + o[2] * 0.82
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

/** Strongest water-body membership at a point (0..1) — for beach + skip tests. */
export function waterMask(nx: number, ny: number, nz: number): number {
  let m = 0
  for (let i = 0; i < WATER_BODIES.length; i++) {
    const v = capMask(nx, ny, nz, WATER_BODIES[i])
    if (v > m) m = v
  }
  return m
}

/**
 * Authored feature displacement, added on top of the base meadow in
 * terrainBump. Pure; scalar-only.
 */
export function biomeBump(nx: number, ny: number, nz: number): number {
  let bump = 0

  // Water basins — each dips below the waterline into a real body of water.
  for (let i = 0; i < WATER_BODIES.length; i++) {
    const b = WATER_BODIES[i]
    bump -= b.depth * capMask(nx, ny, nz, b)
  }

  // Islands riding above the ocean basin — small delight peaks.
  for (let i = 0; i < ISLANDS.length; i++) {
    const p = ISLANDS[i]
    const dot = clampU(nx * p.dir[0] + ny * p.dir[1] + nz * p.dir[2])
    const d = Math.acos(dot)
    const g = d / p.r
    bump += p.h * Math.exp(-g * g)
  }

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

  const rd = riverDist(nx, ny, nz)
  const nearWater = waterMask(nx, ny, nz) > 0.02 || rd < RIVER_HALF + 0.05
  // Beach: a thin sand band just above any waterline (every body + river mouth).
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
