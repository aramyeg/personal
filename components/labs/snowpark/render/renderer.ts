/**
 * Powder Lines renderer (M1 placeholder).
 *
 * This pass exists to prove the FEEL: camera transform (zoom, lead, shake)
 * over flat placeholder art — ice sky, one terrain line, v1 obstacle shapes,
 * the rider as a rotated ink rectangle. Milestones 2-4 replace the art layer
 * by layer (particles, sky cycle, filled terrain, jointed rig); the camera
 * plumbing and layer ordering established here survive.
 */
import type { Course, CourseObstacle } from '../course'
import { slopeAngle, slopeY } from '../slope'
import { PHYS, obstacleSurfaceY, type RiderState } from '../rider'
import { CAM, shakeOffset, type CameraState } from '../camera'
import { palette } from '../palette'

export type Renderer = {
  draw(state: RiderState, course: Course, cam: CameraState): void
  resize(): void
}

const DEG2RAD = Math.PI / 180
const TERRAIN_STEP_PX = 16
const OFFSCREEN_MARGIN = 80

/** Everything a layer helper needs: context, size, state, camera transform. */
type Scene = {
  ctx: CanvasRenderingContext2D
  w: number
  h: number
  s: RiderState
  cam: CameraState
  ox: number
  oy: number
}

const sx = (sc: Scene, wx: number): number => (wx - sc.cam.x) * sc.cam.zoom + sc.ox
const sy = (sc: Scene, wy: number): number => (wy - sc.cam.y) * sc.cam.zoom + sc.oy
/** inverse of sx — which world x sits at this screen x */
const wx = (sc: Scene, screenX: number): number => (screenX - sc.ox) / sc.cam.zoom + sc.cam.x

export function createRenderer(canvas: HTMLCanvasElement): Renderer {
  const maybeCtx = canvas.getContext('2d')
  if (!maybeCtx) throw new Error('snowpark renderer: 2D context unavailable')
  const ctx: CanvasRenderingContext2D = maybeCtx

  let cssW = 0
  let cssH = 0

  function resize(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const rect = canvas.getBoundingClientRect()
    cssW = rect.width
    cssH = rect.height
    canvas.width = Math.round(cssW * dpr)
    canvas.height = Math.round(cssH * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  function draw(state: RiderState, course: Course, cam: CameraState): void {
    if (cssW === 0) resize()
    const shake = shakeOffset(cam)
    const scene: Scene = {
      ctx,
      w: cssW,
      h: cssH,
      s: state,
      cam,
      ox: cssW * CAM.ANCHOR_X + shake.x,
      oy: cssH * CAM.ANCHOR_Y + shake.y,
    }
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'alphabetic'
    ctx.font = '11px ui-monospace, monospace'

    ctx.fillStyle = palette.ice
    ctx.fillRect(0, 0, cssW, cssH)
    drawTerrainLine(scene)
    drawObstacles(scene, course)
    drawFinish(scene, course)
    drawRider(scene)
  }

  return { draw, resize }
}

// --- layers -----------------------------------------------------------------

function drawTerrainLine(sc: Scene): void {
  const { ctx } = sc
  ctx.strokeStyle = palette.blueDeep
  ctx.lineWidth = 3
  ctx.beginPath()
  for (let px = -TERRAIN_STEP_PX; px <= sc.w + TERRAIN_STEP_PX; px += TERRAIN_STEP_PX) {
    const worldX = wx(sc, px)
    const py = sy(sc, slopeY(worldX))
    if (px === -TERRAIN_STEP_PX) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.stroke()
}

function visible(sc: Scene, worldX: number, length: number): boolean {
  const left = sx(sc, worldX)
  const right = sx(sc, worldX + length)
  return right > -OFFSCREEN_MARGIN && left < sc.w + OFFSCREEN_MARGIN
}

function drawObstacles(sc: Scene, course: Course): void {
  for (let i = 0; i < course.obstacles.length; i++) {
    const o = course.obstacles[i]
    if (!visible(sc, o.x, o.length)) continue
    if (o.type === 'kicker') drawKicker(sc, o)
    else if (o.type === 'rail') drawRail(sc, o)
    else drawBox(sc, o)
    drawLabel(sc, o, sc.s.collected[i])
  }
}

function drawKicker(sc: Scene, o: CourseObstacle): void {
  const { ctx } = sc
  const baseY = sy(sc, slopeY(o.x))
  const lipX = sx(sc, o.x + o.length)
  const lipY = sy(sc, slopeY(o.x + o.length) - 34)
  ctx.strokeStyle = palette.ink
  ctx.lineWidth = 2.5
  ctx.beginPath()
  ctx.moveTo(sx(sc, o.x), baseY)
  ctx.lineTo(lipX, lipY)
  ctx.lineTo(lipX, sy(sc, slopeY(o.x + o.length)))
  ctx.closePath()
  ctx.stroke()
}

function drawRail(sc: Scene, o: CourseObstacle): void {
  const { ctx } = sc
  ctx.strokeStyle = palette.ink
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(sx(sc, o.x), sy(sc, obstacleSurfaceY(o, o.x)))
  ctx.lineTo(sx(sc, o.x + o.length), sy(sc, obstacleSurfaceY(o, o.x + o.length)))
  ctx.stroke()
  ctx.lineWidth = 1.5
  for (const t of [0.15, 0.85]) {
    const px = o.x + o.length * t
    ctx.beginPath()
    ctx.moveTo(sx(sc, px), sy(sc, obstacleSurfaceY(o, px)))
    ctx.lineTo(sx(sc, px), sy(sc, slopeY(px)))
    ctx.stroke()
  }
}

function drawBox(sc: Scene, o: CourseObstacle): void {
  const { ctx } = sc
  const x0 = sx(sc, o.x)
  const y0 = sy(sc, obstacleSurfaceY(o, o.x))
  const x1 = sx(sc, o.x + o.length)
  const y1 = sy(sc, slopeY(o.x + o.length / 2))
  ctx.strokeStyle = palette.ink
  ctx.lineWidth = 2.5
  ctx.beginPath()
  ctx.roundRect(x0, y0, x1 - x0, Math.max(y1 - y0, 10), 6)
  ctx.stroke()
}

function drawLabel(sc: Scene, o: CourseObstacle, collected: boolean): void {
  const { ctx } = sc
  const cx = sx(sc, o.x + o.length / 2)
  const cy = sy(sc, slopeY(o.x + o.length / 2) - PHYS.SURFACE_RAISE) - 16
  ctx.fillStyle = palette.ink
  ctx.fillText(o.skill.name.toLowerCase(), cx, cy)
  if (collected) {
    ctx.fillStyle = palette.amber
    ctx.beginPath()
    ctx.arc(cx + ctx.measureText(o.skill.name).width / 2 + 10, cy - 3, 4, 0, Math.PI * 2)
    ctx.fill()
  }
}

function drawFinish(sc: Scene, course: Course): void {
  if (!visible(sc, course.finishX, 60)) return
  const { ctx } = sc
  const x0 = sx(sc, course.finishX)
  const y0 = sy(sc, slopeY(course.finishX))
  const y1 = sy(sc, slopeY(course.finishX) - 90)
  ctx.strokeStyle = palette.ink
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(x0, y0)
  ctx.lineTo(x0, y1)
  ctx.moveTo(x0 + 46, sy(sc, slopeY(course.finishX + 46)))
  ctx.lineTo(x0 + 46, y1)
  ctx.moveTo(x0, y1)
  ctx.lineTo(x0 + 46, y1)
  ctx.stroke()
  ctx.fillStyle = palette.ink
  ctx.fillText('finish', x0 + 23, y1 - 8)
}

function boardAngle(s: RiderState): number {
  if (s.mode === 'air') return (s.launchAngleDeg + s.rotationDeg) * DEG2RAD
  if (s.mode === 'bail') return s.bailTimer * 12
  return slopeAngle(s.x)
}

function drawRider(sc: Scene): void {
  const { ctx } = sc
  const px = sx(sc, sc.s.x)
  const py = sy(sc, sc.s.y)
  ctx.save()
  ctx.translate(px, py)
  ctx.rotate(boardAngle(sc.s))
  ctx.fillStyle = palette.ink
  ctx.fillRect(-12 * sc.cam.zoom, -8 * sc.cam.zoom, 24 * sc.cam.zoom, 8 * sc.cam.zoom)
  ctx.restore()
}
