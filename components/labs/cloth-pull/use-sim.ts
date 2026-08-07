/**
 * The sim world: owns rope + drive + swing state and advances them on a
 * fixed 1/60 timestep with an accumulator. Pure of three.js — components
 * read the arrays it fills and write them into geometries.
 */

import { CFG, layoutFor, type StageLayout } from '@/lib/labs/cloth-pull/config'
import {
  createSwing,
  poseBanner,
  type BannerDims,
  type SwingState,
} from '@/lib/labs/cloth-pull/banner'
import {
  createDrive,
  driveTension,
  stepDrive,
  type DriveState,
} from '@/lib/labs/cloth-pull/drive'
import {
  atLength,
  createRope,
  ropeLength,
  setHand,
  stepRope,
  type Rope,
} from '@/lib/labs/cloth-pull/rope'

export interface SimWorld {
  w: number
  h: number
  reduced: boolean
  lowPower: boolean
  layout: StageLayout
  rope: Rope
  drive: DriveState
  swing: SwingState
  dims: BannerDims
  /** banner vertex positions in y-down sim px, written each step */
  bannerSim: Float32Array
  /** arc position of the banner center when h = 0 (fully paid out) */
  s0: number
  time: number
  acc: number
  /** true once the intro is allowed to run (chibi ready or timed out) */
  started: boolean
  energy: number
  tension: number
  /** set on frames the idle tug fires, consumed by the chibi */
  tugged: boolean
}

/** Find the arc position whose point has the given x (x is monotonic). */
function sAtX(rope: Rope, x: number): number {
  let lo = 0
  let hi = ropeLength(rope)
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2
    if (atLength(rope, mid).x < x) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

export function createSimWorld(
  w: number,
  h: number,
  reduced: boolean
): SimWorld {
  const S = CFG.scene
  const B = CFG.banner
  const lowPower = w < 760
  const layout = layoutFor(w)
  // seed the hand pin where the chibi's fist will actually be (fist sits at
  // ~0.615 of body height, measured from the exported GLB)
  const handY = h * layout.floorFrac - 0.615 * layout.chibiHeightFrac * h
  const rope = createRope({
    handX: w * S.handXFrac,
    handY,
    anchorX: w * S.anchorXFrac,
    anchorY: handY - h * 0.05,
    viewportH: h,
  })
  for (let i = 0; i < 90; i++) {
    stepRope(rope, 1 / 60, { time: 0, tension: 0, wind: 0 })
  }

  const width = Math.min(w * layout.bannerWidthFrac, B.widthMax)
  const dims: BannerDims = {
    width,
    height: width * layout.bannerAspect,
    segX: lowPower ? B.segXLow : B.segX,
    segY: lowPower ? B.segYLow : B.segY,
  }

  const s0 = sAtX(rope, w + dims.width * 0.55)
  const hRest = s0 - sAtX(rope, w * layout.restCenterFrac)
  const drive = createDrive(w, reduced, hRest)

  return {
    w,
    h,
    reduced,
    lowPower,
    layout,
    rope,
    drive,
    swing: createSwing(),
    dims,
    bannerSim: new Float32Array((dims.segX + 1) * (dims.segY + 1) * 3),
    s0,
    time: 0,
    acc: 0,
    started: reduced,
    energy: reduced ? 0.05 : CFG.banner.idleEnergy,
    tension: 0,
    tugged: false,
  }
}

/** Current arc position of the banner center, clamped onto the rope. */
export function bannerSMid(world: SimWorld): number {
  const half = world.dims.width * 0.5
  const margin = 10
  return Math.max(
    half + margin,
    Math.min(world.s0 - world.drive.h, ropeLength(world.rope) - half - margin)
  )
}

/**
 * Advance the world by one rendered frame. `hand` is the fist position in
 * sim px (or null while the chibi is still loading — the seed pin holds).
 */
export function stepSimWorld(
  world: SimWorld,
  frameDt: number,
  hand: { x: number; y: number } | null
): void {
  const fixed = CFG.scene.fixedDt
  world.acc += Math.min(frameDt, CFG.scene.maxDt)
  world.tugged = false

  while (world.acc >= fixed) {
    world.acc -= fixed
    world.time += fixed

    if (world.started) {
      const out = stepDrive(world.drive, fixed)
      if (out.tugged) world.tugged = true
    }

    world.tension = driveTension(world.drive)
    world.energy = world.reduced
      ? 0.05
      : Math.min(1.25, CFG.banner.idleEnergy + world.drive.effort * 0.9)

    if (hand) setHand(world.rope, hand.x, hand.y)
    stepRope(world.rope, fixed, {
      time: world.time,
      tension: world.tension,
      wind: world.reduced ? 0.12 : 1,
    })
    poseBanner(world.bannerSim, world.rope, world.swing, world.dims, {
      sMid: bannerSMid(world),
      time: world.time,
      energy: world.energy,
      dt: fixed,
    })
  }
}
