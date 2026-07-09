/**
 * Pooled carve spray, landing/bail bursts, and a tapering trail ribbon — the
 * M2 juice layer. Everything here runs in world units; the renderer wraps
 * `draw` in a camera-scaled canvas transform so sizes scale with zoom exactly
 * like the placeholder rider rect does.
 *
 * EXCEPTION (documented, per the redesign plan): the pool and the trail ring
 * buffer are private, mutable render-layer state for performance — zero
 * per-frame allocation. Sim state (`RiderState`) is never touched; the
 * renderer is the sole caller, reading state flags read-only. `trailPositions`
 * hands the terrain layer a live view of the ring for its carve line — read
 * only, valid for the current frame only (same exception).
 */
import { palette } from '../palette'
import { mix } from './terrain'

/** Live view of the trail ring — the terrain carve line's source. */
export type TrailView = { x: Float64Array; y: Float64Array; len: number }

export type ParticleSystem = {
  spray(x: number, y: number, speed01: number, dt: number): void
  burst(x: number, y: number, impact: number): void
  pushTrail(x: number, y: number, chainTier: number): void
  update(dt: number): void
  /** Tapering carve ribbon — its own layer, drawn under the obstacles. */
  drawTrail(ctx: CanvasRenderingContext2D, chainTier: number): void
  /** Spray/burst pool — its own layer, drawn over the obstacles. */
  drawParticles(ctx: CanvasRenderingContext2D): void
  /** Live ring arrays for the carve line (read-only, this frame only). */
  trailPositions(): TrailView
  clear(): void
}

export const PARTICLES = {
  POOL_SIZE: 256,
  TRAIL_MAX: 48,
  GRAVITY: 600,
  /** spray only emits while carving at real speed */
  SPRAY_MIN_SPEED01: 0.25,
  /** particles/second at speed01 1; ~ceil(speed01*3) per 1/60s render frame */
  SPRAY_RATE_PER_S: 180,
  SPRAY_BASE_SPEED: 70,
  SPRAY_JITTER: 45,
  /** upward kick so spray kicks off the snow instead of dragging through it */
  SPRAY_RISE: 35,
  SPRAY_LIFE_MIN: 0.35,
  SPRAY_LIFE_MAX: 0.6,
  SPRAY_SIZE_MIN: 1.5,
  SPRAY_SIZE_MAX: 2.5,
  BURST_BASE_COUNT: 8,
  BURST_IMPACT_COUNT: 22,
  BURST_SPEED_MIN: 90,
  BURST_SPEED_MAX: 260,
  /** fan width around the up-and-back base direction (radians) */
  BURST_SPREAD: (Math.PI * 2) / 3,
  BURST_LIFE_MIN: 0.35,
  BURST_LIFE_MAX: 0.9,
  BURST_SIZE_MIN: 1.5,
  BURST_SIZE_MAX: 2.75,
  TRAIL_WIDTH: 4,
  TRAIL_ALPHA: 0.5,
  /** width added per chain tier (0..3), floored against the live tier so a
   * fresh bail doesn't leave visibly out-of-date fat trail behind it */
  TRAIL_TIER_WIDTH: 1,
  /** chain-lit trail (Task 12): ribbon color lerps bluePale → amber by tier/3,
   * so the trail visibly heats up as chain climbs, not just widens. Tunable
   * ceiling (1 = full amber at tier 3) so GATE can pull it back without
   * touching the lerp math. */
  TRAIL_TIER_AMBER_MAX: 1,
} as const

/** Deterministic 0..1 hash of two integers (pool slot, spawn count) — the v1
 * convention (`fract(sin(n)*43758.5453)`) extended with a second term so a
 * reused pool slot never repeats the same jitter. The only source of scatter
 * in this module; nothing here calls into the RNG. */
function hash(i: number, n: number): number {
  const v = Math.sin(i * 127.1 + n * 311.7) * 43758.5453
  return v - Math.floor(v)
}

// --- pool ---------------------------------------------------------------

/** Fixed-size struct-of-arrays pool with a free-list stack: O(1) alloc/free,
 * zero per-frame allocation. `active` holds the live slot indices compacted
 * at the front; `free` holds the reclaimed ones. */
type Pool = {
  x: Float64Array
  y: Float64Array
  vx: Float64Array
  vy: Float64Array
  life: Float64Array
  maxLife: Float64Array
  size: Float64Array
  active: Int32Array
  activeCount: number
  free: Int32Array
  freeCount: number
}

function createPool(n: number): Pool {
  const free = new Int32Array(n)
  for (let i = 0; i < n; i++) free[i] = i
  return {
    x: new Float64Array(n),
    y: new Float64Array(n),
    vx: new Float64Array(n),
    vy: new Float64Array(n),
    life: new Float64Array(n),
    maxLife: new Float64Array(n),
    size: new Float64Array(n),
    active: new Int32Array(n),
    activeCount: 0,
    free,
    freeCount: n,
  }
}

/** Claim a slot, or -1 if the pool is exhausted (spawn is silently dropped). */
function alloc(pool: Pool): number {
  if (pool.freeCount === 0) return -1
  pool.freeCount -= 1
  const idx = pool.free[pool.freeCount]
  pool.active[pool.activeCount] = idx
  pool.activeCount += 1
  return idx
}

/** Swap-remove the active-list entry at `pos` and return its slot to the free stack. */
function release(pool: Pool, pos: number): void {
  const idx = pool.active[pos]
  pool.activeCount -= 1
  pool.active[pos] = pool.active[pool.activeCount]
  pool.free[pool.freeCount] = idx
  pool.freeCount += 1
}

function resetPool(pool: Pool): void {
  pool.activeCount = 0
  pool.freeCount = pool.free.length
  for (let i = 0; i < pool.free.length; i++) pool.free[i] = i
}

function updatePool(pool: Pool, dt: number): void {
  for (let i = pool.activeCount - 1; i >= 0; i--) {
    const idx = pool.active[i]
    const life = pool.life[idx] - dt
    if (life <= 0) {
      release(pool, i)
      continue
    }
    pool.life[idx] = life
    pool.vy[idx] += PARTICLES.GRAVITY * dt
    pool.x[idx] += pool.vx[idx] * dt
    pool.y[idx] += pool.vy[idx] * dt
  }
}

function drawPool(pool: Pool, ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = palette.bluePale
  for (let i = 0; i < pool.activeCount; i++) {
    const idx = pool.active[i]
    ctx.globalAlpha = pool.life[idx] / pool.maxLife[idx]
    ctx.beginPath()
    ctx.arc(pool.x[idx], pool.y[idx], pool.size[idx], 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1
}

/** Carve spray: opposes travel (world −x), ± hash jitter, small upward kick. */
function spawnSpray(pool: Pool, x: number, y: number, speed01: number, seed: number): void {
  const idx = alloc(pool)
  if (idx < 0) return
  const jitterAngle = (hash(idx, seed) - 0.5) * 1.6
  const jitterSpeed = hash(idx, seed + 1) * PARTICLES.SPRAY_JITTER
  const dir = Math.PI + jitterAngle // base: −x (opposing +x travel)
  const speed = PARTICLES.SPRAY_BASE_SPEED * (0.5 + speed01) + jitterSpeed
  pool.x[idx] = x
  pool.y[idx] = y
  pool.vx[idx] = Math.cos(dir) * speed
  pool.vy[idx] = Math.sin(dir) * speed - PARTICLES.SPRAY_RISE
  const life =
    PARTICLES.SPRAY_LIFE_MIN + hash(idx, seed + 2) * (PARTICLES.SPRAY_LIFE_MAX - PARTICLES.SPRAY_LIFE_MIN)
  pool.life[idx] = life
  pool.maxLife[idx] = life
  pool.size[idx] =
    PARTICLES.SPRAY_SIZE_MIN + hash(idx, seed + 3) * (PARTICLES.SPRAY_SIZE_MAX - PARTICLES.SPRAY_SIZE_MIN)
}

/** Landing/bail burst: fans upward-and-back (world −y is up, tilted toward −x). */
function spawnBurst(pool: Pool, x: number, y: number, seed: number): void {
  const idx = alloc(pool)
  if (idx < 0) return
  const spread = (hash(idx, seed) - 0.5) * PARTICLES.BURST_SPREAD
  const dir = -Math.PI / 2 - Math.PI / 8 + spread
  const speed =
    PARTICLES.BURST_SPEED_MIN + hash(idx, seed + 1) * (PARTICLES.BURST_SPEED_MAX - PARTICLES.BURST_SPEED_MIN)
  pool.x[idx] = x
  pool.y[idx] = y
  pool.vx[idx] = Math.cos(dir) * speed
  pool.vy[idx] = Math.sin(dir) * speed
  const life =
    PARTICLES.BURST_LIFE_MIN + hash(idx, seed + 2) * (PARTICLES.BURST_LIFE_MAX - PARTICLES.BURST_LIFE_MIN)
  pool.life[idx] = life
  pool.maxLife[idx] = life
  pool.size[idx] =
    PARTICLES.BURST_SIZE_MIN + hash(idx, seed + 3) * (PARTICLES.BURST_SIZE_MAX - PARTICLES.BURST_SIZE_MIN)
}

// --- trail ribbon ---------------------------------------------------------

/** Ring buffer of recent board positions + the chain tier active when each
 * was laid down — the tier fades out of the ribbon naturally as it scrolls
 * off the back, ~TRAIL_MAX frames after a bail resets the chain. */
type Trail = {
  x: Float64Array
  y: Float64Array
  tier: Float64Array
  len: number
}

function createTrail(n: number): Trail {
  return { x: new Float64Array(n), y: new Float64Array(n), tier: new Float64Array(n), len: 0 }
}

function pushTrailPoint(trail: Trail, x: number, y: number, chainTier: number): void {
  const max = trail.x.length
  if (trail.len < max) {
    trail.x[trail.len] = x
    trail.y[trail.len] = y
    trail.tier[trail.len] = chainTier
    trail.len += 1
    return
  }
  trail.x.copyWithin(0, 1)
  trail.y.copyWithin(0, 1)
  trail.tier.copyWithin(0, 1)
  trail.x[max - 1] = x
  trail.y[max - 1] = y
  trail.tier[max - 1] = chainTier
}

/** One polyline, width 4→0 and alpha 0.5→0 from head (rider) to tail. Each
 * segment's width floors against the LIVE chainTier, so the whole visible
 * ribbon always reads at least the current combo state, while a still-fresh
 * higher historical tier (e.g. just after a bail) keeps showing its peak. */
function strokeTrailRibbon(ctx: CanvasRenderingContext2D, trail: Trail, chainTier: number): void {
  if (trail.len < 2) return
  ctx.lineCap = 'round'
  const last = trail.len - 1
  for (let i = 1; i <= last; i++) {
    const t = i / last
    const tier = Math.max(trail.tier[i], chainTier)
    ctx.lineWidth = t * (PARTICLES.TRAIL_WIDTH + tier * PARTICLES.TRAIL_TIER_WIDTH)
    ctx.strokeStyle = mix(palette.bluePale, palette.amber, (tier / 3) * PARTICLES.TRAIL_TIER_AMBER_MAX)
    ctx.globalAlpha = t * PARTICLES.TRAIL_ALPHA
    ctx.beginPath()
    ctx.moveTo(trail.x[i - 1], trail.y[i - 1])
    ctx.lineTo(trail.x[i], trail.y[i])
    ctx.stroke()
  }
  ctx.globalAlpha = 1
}

// --- factory ---------------------------------------------------------------

export function createParticles(): ParticleSystem {
  const pool = createPool(PARTICLES.POOL_SIZE)
  const trail = createTrail(PARTICLES.TRAIL_MAX)
  let spawnCount = 0
  let sprayCarry = 0

  function spray(x: number, y: number, speed01: number, dt: number): void {
    if (speed01 <= PARTICLES.SPRAY_MIN_SPEED01) {
      sprayCarry = 0
      return
    }
    // Continuous, frame-rate-independent emission rate (accumulate fractional
    // particles rather than a flat count-per-call, so spray density doesn't
    // depend on the display's refresh rate).
    sprayCarry += speed01 * PARTICLES.SPRAY_RATE_PER_S * dt
    while (sprayCarry >= 1) {
      sprayCarry -= 1
      spawnSpray(pool, x, y, speed01, spawnCount)
      spawnCount += 1
    }
  }

  function burst(x: number, y: number, impact: number): void {
    const count = PARTICLES.BURST_BASE_COUNT + Math.round(impact * PARTICLES.BURST_IMPACT_COUNT)
    for (let k = 0; k < count; k++) {
      spawnBurst(pool, x, y, spawnCount)
      spawnCount += 1
    }
  }

  function pushTrail(x: number, y: number, chainTier: number): void {
    pushTrailPoint(trail, x, y, chainTier)
  }

  function update(dt: number): void {
    updatePool(pool, dt)
  }

  function drawTrail(ctx: CanvasRenderingContext2D, chainTier: number): void {
    strokeTrailRibbon(ctx, trail, chainTier)
  }

  function drawParticles(ctx: CanvasRenderingContext2D): void {
    drawPool(pool, ctx)
  }

  /** Live ring arrays for the carve line — read-only, valid this frame only. */
  function trailPositions(): TrailView {
    return { x: trail.x, y: trail.y, len: trail.len }
  }

  function clear(): void {
    resetPool(pool)
    trail.len = 0
    sprayCarry = 0
  }

  return { spray, burst, pushTrail, update, drawTrail, drawParticles, trailPositions, clear }
}
