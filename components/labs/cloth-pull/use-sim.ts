/**
 * The sim world for the towed staging: motion (speed/intro/grab) + chain +
 * banner advance on a fixed 1/60 timestep with an accumulator. Pure of
 * three.js — components read the arrays it fills and write geometries.
 */

import { CFG, layoutFor, type StageLayout } from '@/lib/labs/cloth-pull/config'
import {
  createSwing,
  poseBanner,
  type BannerDims,
  type SwingState,
} from '@/lib/labs/cloth-pull/banner'
import {
  createChain,
  fistStretch,
  grabChain,
  indexAtLength,
  releaseChain,
  setFist,
  stepChain,
  type Chain,
} from '@/lib/labs/cloth-pull/chain'
import {
  createMotion,
  type MotionState,
} from '@/lib/labs/cloth-pull/motion'
import { stepMotion } from '@/lib/labs/cloth-pull/motion'

export interface SimWorld {
  w: number
  h: number
  reduced: boolean
  lowPower: boolean
  layout: StageLayout
  chain: Chain
  motion: MotionState
  swing: SwingState
  dims: BannerDims
  /** banner vertex positions in y-down sim px, written each step */
  bannerSim: Float32Array
  time: number
  acc: number
  /** true once the intro is allowed to run (chibi ready or timed out) */
  started: boolean
  energy: number
  /** ground scroll accumulator, px (drives floor marks + walk phase) */
  travel: number
}

/** fist-cluster height above the feet as a fraction of body height
 * (clasped hands sit at ~0.48 of the 0.90-unit model) */
const FIST_FRAC = 0.53

export function createSimWorld(
  w: number,
  h: number,
  reduced: boolean
): SimWorld {
  const lowPower = w < 760
  const layout = layoutFor(w)

  const width = Math.min(w * layout.bannerWidthFrac, CFG.banner.widthMax)
  const dims: BannerDims = {
    width,
    height: width * layout.bannerAspect,
    segX: lowPower ? CFG.banner.segXLow : CFG.banner.segX,
    segY: lowPower ? CFG.banner.segYLow : CFG.banner.segY,
  }

  const xRest = w * layout.chibiXFrac
  const motion = createMotion(w, xRest, reduced)
  const fistY = h * layout.floorFrac - FIST_FRAC * layout.chibiHeightFrac * h
  const stringLen = Math.max(CFG.chain.stringMin, w * CFG.chain.stringFrac)
  const chain = createChain({
    fistX: motion.x,
    fistY,
    stringLen,
    hemLen: width * 1.02,
    viewportH: h,
  })
  // reduced motion starts settled: relax the chain onto its baseline
  if (reduced) {
    for (let i = 0; i < 120; i++) {
      stepChain(chain, 1 / 60, { time: 0, speed: 0, wind: 0 })
    }
  }

  return {
    w,
    h,
    reduced,
    lowPower,
    layout,
    chain,
    motion,
    swing: createSwing(),
    dims,
    bannerSim: new Float32Array((dims.segX + 1) * (dims.segY + 1) * 3),
    time: 0,
    acc: 0,
    started: reduced,
    energy: reduced ? 0.05 : CFG.banner.idleEnergy,
    travel: 0,
  }
}

/**
 * Route a pointer-down to a cloth grab. Returns true if something grabbed.
 *
 * The pick is against the DRAWN cloth — the posed banner vertices — not
 * against the hem chain, because the cloth is what the visitor sees and aims
 * at. The hem line alone is a bad proxy: it runs above the banner, so a pick
 * radius wide enough to reach the cloth's bottom edge also swallowed clicks on
 * the chibi (measured 158px from her torso to the nearest hem point) and on
 * empty sky. That is what made a click on HER heave the cloth.
 */
export function tryGrab(world: SimWorld, x: number, y: number): boolean {
  const nx = world.dims.segX + 1
  const ny = world.dims.segY + 1
  const sim = world.bannerSim
  let bestD: number = CFG.motion.grabPick
  let bestU = -1
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const o = (j * nx + i) * 3
      const d = Math.hypot(sim[o] - x, sim[o + 1] - y)
      if (d < bestD) {
        bestD = d
        bestU = i / world.dims.segX
      }
    }
  }
  if (bestU < 0) return false
  // the hem point above the picked column: the cloth hangs off the chain there
  const idx = indexAtLength(
    world.chain,
    world.chain.stringLen + bestU * world.dims.width
  )
  grabChain(world.chain, idx, x, y)
  return true
}

export function endWorldGrab(world: SimWorld): void {
  releaseChain(world.chain)
}

/**
 * Advance the world by one rendered frame. `fist` is the fist-cluster
 * position in sim px (or null while the chibi is still loading — the seed
 * pin holds).
 */
export function stepSimWorld(
  world: SimWorld,
  frameDt: number,
  fist: { x: number; y: number } | null
): void {
  const fixed = CFG.scene.fixedDt
  world.acc += Math.min(frameDt, CFG.scene.maxDt)

  while (world.acc >= fixed) {
    world.acc -= fixed
    world.time += fixed

    const stretch = fistStretch(world.chain)
    if (world.started) {
      stepMotion(world.motion, fixed, { stretch, viewportW: world.w })
    }
    world.travel += world.motion.speed * fixed

    world.energy = world.reduced
      ? 0.05
      : Math.min(
          1.25,
          CFG.banner.idleEnergy +
            world.motion.effort * 0.7 +
            (world.motion.speed / CFG.motion.cruise) * 0.25
        )

    if (fist) setFist(world.chain, fist.x, fist.y)
    else setFist(world.chain, world.motion.x, world.chain.fist.y)

    stepChain(world.chain, fixed, {
      time: world.time,
      speed: world.motion.speed,
      wind: world.reduced ? 0.12 : 1,
      grabX: world.motion.grabbing ? world.motion.grabX : undefined,
      grabY: world.motion.grabbing ? world.motion.grabY : undefined,
    })

    poseBanner(world.bannerSim, world.chain, world.swing, world.dims, {
      time: world.time,
      energy: world.energy,
      speed: world.motion.speed,
      dt: fixed,
    })
  }
}
