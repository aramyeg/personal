/**
 * Analytic banner cloth: NOT simulated. The top edge samples the towed
 * chain's hem span; everything below is a designed wave field (out-of-plane
 * waves + in-plane billow + corner furl) with a damped swing DOF, plus a
 * speed-proportional trailing tilt so the sheet streams when she walks.
 * Deterministic, unconditionally stable, art-directable.
 *
 * Pure module: writes world-space vertex positions into a caller-owned
 * Float32Array. Coordinates are y-DOWN sim pixels; the caller flips y and
 * hands z through unchanged.
 */

import { CFG } from './config'
import { addForceAt, atLength, type Chain } from './chain'

export interface SwingState {
  theta: number
  thetaV: number
  prevX: number
  prevVX: number
  initialized: boolean
}

export function createSwing(): SwingState {
  return { theta: 0, thetaV: 0, prevX: 0, prevVX: 0, initialized: false }
}

export interface BannerDims {
  width: number
  height: number
  segX: number
  segY: number
}

export interface BannerPoseParams {
  time: number
  /** 0..~1.2 motion energy (effort + idle floor) */
  energy: number
  /** travel speed, px/s — tilts the hang backward */
  speed: number
  dt: number
}

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/**
 * Legibility dip: 1 outside the type region, (1 - textCalm) at its center,
 * smooth in between — borders ripple harder than the words.
 */
export function textCalmFactor(u: number, v: number): number {
  const B = CFG.banner
  const inU =
    smoothstep(B.textU0 - 0.1, B.textU0 + 0.08, u) *
    (1 - smoothstep(B.textU1 - 0.08, B.textU1 + 0.1, u))
  const inV =
    smoothstep(B.textV0 - 0.1, B.textV0 + 0.08, v) *
    (1 - smoothstep(B.textV1 - 0.08, B.textV1 + 0.1, v))
  return 1 - B.textCalm * inU * inV
}

/** Advance the damped swing spring from the hang point's acceleration. */
export function stepSwing(
  sw: SwingState,
  dt: number,
  hangX: number,
  energy: number,
  time: number
): void {
  const B = CFG.banner
  if (!sw.initialized || dt <= 0) {
    sw.prevX = hangX
    sw.prevVX = 0
    sw.initialized = true
    return
  }
  const vx = (hangX - sw.prevX) / dt
  const acc = (vx - sw.prevVX) / dt
  sw.prevVX = vx
  sw.prevX = hangX
  sw.thetaV +=
    (-B.swingK * sw.theta -
      B.swingDamp * sw.thetaV -
      acc * B.swingAccGain +
      energy * B.swingWindGain * Math.sin(time * 1.9)) *
    dt
  sw.theta = Math.max(
    -B.swingMax,
    Math.min(B.swingMax, sw.theta + sw.thetaV * dt)
  )
}

/**
 * Write the full cloth pose for this frame and feed the cloth's weight back
 * into the chain along the hem span. The cloth's u axis runs from the
 * LEADING edge (nearest her, chain arc = stringLen) toward the trailing
 * free end. `out` is (segX+1)*(segY+1)*3 floats, row-major from the top
 * edge down, [x, y(down), z].
 */
export function poseBanner(
  out: Float32Array,
  chain: Chain,
  sw: SwingState,
  dims: BannerDims,
  p: BannerPoseParams
): void {
  const B = CFG.banner
  const { width, height, segX, segY } = dims
  const nx = segX + 1
  const ny = segY + 1
  const s0 = chain.stringLen

  const aL = atLength(chain, s0)
  const aR = atLength(chain, s0 + width)
  stepSwing(sw, p.dt, (aL.x + aR.x) * 0.5, p.energy, p.time)

  // hem angle measured against the trailing (-x) direction so a level hem
  // reads as zero; positive = trailing end droops lower
  const hemAngRel = Math.atan2(aR.y - aL.y, -(aR.x - aL.x))
  // she walks +x, cloth trails -x: streaming tilts the hang BACK toward -x,
  // which in y-down screen space is an angle beyond straight-down (PI/2)
  const tilt = Math.min(B.speedTiltMax, p.speed * B.speedTilt)
  const dAng = Math.PI / 2 + hemAngRel * 0.35 + sw.theta + tilt
  const dnx = Math.cos(dAng)
  const dny = Math.sin(dAng)
  const sdx = -dny
  const sdy = dnx

  const amp = Math.min(height * B.ampH, width * B.ampW) * (0.4 + p.energy)
  const ph0 = p.time * B.waveSpeed

  for (let i = 0; i < nx; i++) {
    const u = i / segX
    const top = atLength(chain, s0 + u * width)
    const uEnv = Math.sin(Math.PI * u)
    for (let j = 0; j < ny; j++) {
      const v = j / segY
      const dist = B.hemChannel + v * height
      const rake = B.rake * Math.pow(v, B.rakePow)
      const env =
        (0.12 + 0.88 * Math.pow(v, 0.95)) *
        (0.25 + 0.75 * uEnv) *
        textCalmFactor(u, v)
      const phase = ph0 + u * B.waveLenU - v * B.waveLenV
      const wave =
        amp * env * (Math.sin(phase) * 0.9 + Math.sin(phase * 1.73 + 1.1) * 0.34)
      const furl = B.curl * amp * Math.pow(v, 2.2) * Math.abs(u - 0.5) * 2
      const z = wave + furl
      const shrink = amp * 0.26 * env * Math.cos(phase)
      const rise = amp * 0.24 * env * Math.sin(phase + 0.9)
      const px =
        top.x + dnx * dist + sdx * shrink + dnx * (rise - Math.abs(z) * 0.16)
      const py =
        top.y + dny * dist + sdy * shrink + dny * (rise - Math.abs(z) * 0.16)
      const o = (j * nx + i) * 3
      out[o] = px
      out[o + 1] = py
      out[o + 2] = rake + z
    }
  }

  const loops = 5
  for (let k = 0; k < loops; k++) {
    const s = s0 + (k / (loops - 1)) * width
    addForceAt(chain, s, 0, B.weight / loops)
  }
}

/** The cloth's bottom-leading corner — the cosmetic second string ties here. */
export function bottomLeadingCorner(
  out: Float32Array,
  dims: BannerDims
): { x: number; y: number; z: number } {
  const nx = dims.segX + 1
  const o = dims.segY * nx * 3
  return { x: out[o], y: out[o + 1], z: out[o + 2] }
}
