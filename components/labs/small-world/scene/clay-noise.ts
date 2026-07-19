/**
 * clay-noise.ts — Task 31 (Round 9). A small, PURE, deterministic coherent-noise
 * kit: seeded 3D gradient (Perlin) noise, fBm, RIDGED fBm, and a domain-warp helper.
 * This is the reusable "genart vocabulary" Aram invited (he pointed at Perlin noise
 * for the clay water); Task 32 reuses the same kit on the open fields.
 *
 * Why coherent noise, not the existing hash noise: the scene's `hash01` (a sin-fract)
 * is WHITE / value noise — uncorrelated point-to-point, so it only ever reads as
 * grain. Perlin gradient noise is spatially COHERENT: neighbouring samples flow, so
 * fBm gives organic lumps and domain-warping gives the tool-dragged smear paths the
 * clay water wants. Deterministic (seeded permutation, NO Math.random / Date.now), so
 * both renewal bakes agree byte-for-byte and the Node benches can reproduce the field.
 *
 * ZERO imports — a leaf module (safe in the stage↔planet cycle, and Vitest/Next can
 * import it anywhere). The raw-Node benches can't resolve extensionless TS import
 * chains, so they PORT this math inline (same discipline as scan-task23 porting the
 * clay dimple); the unit test pins determinism + range bounds on THIS copy.
 */

/** Deterministic 32-bit PRNG (mulberry32) — seeds the permutation shuffle only. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return function next(): number {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * A seeded permutation table of length 512 (0..255 shuffled, then doubled so the
 * gradient lookup never has to wrap-mask its index). Same seed ⇒ identical table.
 */
export function makePermutation(seed: number): Uint8Array {
  const p = new Uint8Array(256)
  for (let i = 0; i < 256; i++) p[i] = i
  const rand = mulberry32(seed)
  // Fisher–Yates with the seeded PRNG.
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    const t = p[i]
    p[i] = p[j]
    p[j] = t
  }
  const perm = new Uint8Array(512)
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255]
  return perm
}

const fade = (t: number): number => t * t * t * (t * (t * 6 - 15) + 10)
const lerp = (a: number, b: number, t: number): number => a + t * (b - a)

/** Ken Perlin's improved gradient: dot of one of 12 edge-vectors with (x,y,z). */
function grad(hash: number, x: number, y: number, z: number): number {
  const h = hash & 15
  const u = h < 8 ? x : y
  const v = h < 4 ? y : h === 12 || h === 14 ? x : z
  return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v)
}

/**
 * Improved 3D Perlin noise at (x,y,z) using a permutation table. Output is coherent
 * and bounded in roughly [-1, 1] (empirically |n| ≲ 1; the unit test pins the bound).
 */
export function perlin3(perm: Uint8Array, x: number, y: number, z: number): number {
  const X = Math.floor(x) & 255
  const Y = Math.floor(y) & 255
  const Z = Math.floor(z) & 255
  const xf = x - Math.floor(x)
  const yf = y - Math.floor(y)
  const zf = z - Math.floor(z)
  const u = fade(xf)
  const v = fade(yf)
  const w = fade(zf)
  const A = perm[X] + Y
  const AA = perm[A] + Z
  const AB = perm[A + 1] + Z
  const B = perm[X + 1] + Y
  const BA = perm[B] + Z
  const BB = perm[B + 1] + Z
  return lerp(
    lerp(
      lerp(grad(perm[AA], xf, yf, zf), grad(perm[BA], xf - 1, yf, zf), u),
      lerp(grad(perm[AB], xf, yf - 1, zf), grad(perm[BB], xf - 1, yf - 1, zf), u),
      v
    ),
    lerp(
      lerp(grad(perm[AA + 1], xf, yf, zf - 1), grad(perm[BA + 1], xf - 1, yf, zf - 1), u),
      lerp(grad(perm[AB + 1], xf, yf - 1, zf - 1), grad(perm[BB + 1], xf - 1, yf - 1, zf - 1), u),
      v
    ),
    w
  )
}

/**
 * Fractal Brownian motion: sum `octaves` of Perlin noise, each `lacunarity`× the
 * frequency and `gain`× the amplitude of the last, normalized back to ~[-1, 1].
 */
export function fbm3(
  perm: Uint8Array,
  x: number,
  y: number,
  z: number,
  octaves: number,
  lacunarity: number,
  gain: number
): number {
  let amp = 1
  let freq = 1
  let sum = 0
  let norm = 0
  const n = octaves < 1 ? 1 : octaves
  for (let o = 0; o < n; o++) {
    sum += amp * perlin3(perm, x * freq, y * freq, z * freq)
    norm += amp
    amp *= gain
    freq *= lacunarity
  }
  return norm > 0 ? sum / norm : 0
}

/**
 * Ridged fBm: each octave folded through 1−|n| so noise zero-crossings become sharp
 * CRESTS (value → 1 on the ridge lines, → 0 in the troughs between them), raised to
 * `sharpness` to pinch the crests. Normalized to [0, 1]. This is the "molded clay
 * ridge" generator — tool-dragged crests with carved troughs, not smooth swells.
 */
export function ridged3(
  perm: Uint8Array,
  x: number,
  y: number,
  z: number,
  octaves: number,
  lacunarity: number,
  gain: number,
  sharpness: number
): number {
  let amp = 1
  let freq = 1
  let sum = 0
  let norm = 0
  const n = octaves < 1 ? 1 : octaves
  const s = sharpness > 0 ? sharpness : 1
  for (let o = 0; o < n; o++) {
    let r = 1 - Math.abs(perlin3(perm, x * freq, y * freq, z * freq)) // [0,1], 1 on ridge
    r = Math.pow(r, s)
    sum += amp * r
    norm += amp
    amp *= gain
    freq *= lacunarity
  }
  return norm > 0 ? sum / norm : 0
}

/**
 * Domain warp: displace the sample point by `k`× a vector of three decorrelated
 * Perlin fields (p' = p + k·noise(p)). Sampling any field at the warped point is the
 * classic genart marbling / smear move — straight structure becomes flowing, dragged
 * paths. Returns the warped coordinate as a fresh triple (pure).
 */
export function domainWarp3(
  perm: Uint8Array,
  x: number,
  y: number,
  z: number,
  k: number
): [number, number, number] {
  const wx = perlin3(perm, x + 5.2, y + 1.3, z + 2.8)
  const wy = perlin3(perm, x + 9.7, y + 4.1, z + 6.3)
  const wz = perlin3(perm, x + 3.4, y + 7.9, z + 1.1)
  return [x + k * wx, y + k * wy, z + k * wz]
}
