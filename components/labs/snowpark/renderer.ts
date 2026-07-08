/**
 * Powder Lines renderer — flat-color, geometry-only canvas 2D.
 *
 * Aesthetic law: every color comes from `palette`; depth is carried by line
 * weight and horizontal parallax, never by blur, glow, or gradient. Amber is
 * reserved for the sun disc and collected-skill dots. The renderer reads state
 * and course read-only; its sole internal state is the trail ring buffer.
 */
import type { Course, CourseObstacle } from './course'
import { slopeAngle, slopeY } from './slope'
import { BAIL_TIME, obstacleSurfaceY, type RiderState } from './rider'
import { palette } from './palette'

export type Renderer = {
  draw(state: RiderState, course: Course): void
  resize(): void
}

/** Rider's anchored position as a fraction of the viewport. */
const RIDER_FRAC_X = 0.35
const RIDER_FRAC_Y = 0.45
const TRAIL_MAX = 40
const DEG2RAD = Math.PI / 180

/** Everything a layer helper needs: context, size, state, camera anchor. */
type Scene = {
  ctx: CanvasRenderingContext2D
  w: number
  h: number
  s: RiderState
  /** rider anchor in screen px */
  rx: number
  ry: number
}

type FarLayer = { p: number; k: number; lift: number; color: string; width: number }

const FAR_LAYERS: FarLayer[] = [
  { p: 0.15, k: 0.5, lift: -104, color: palette.bluePale, width: 1.5 },
  { p: 0.35, k: 0.7, lift: -58, color: palette.blueMid, width: 2 },
]

/** Echo lines below the master snow line: [offset, color, width]. */
const TERRAIN_ECHOES: [number, string, number][] = [
  [14, palette.blueMid, 2.5],
  [30, palette.blueMid, 1.75],
  [48, palette.bluePale, 1.25],
]

export function createRenderer(canvas: HTMLCanvasElement): Renderer {
  const maybeCtx = canvas.getContext('2d')
  if (!maybeCtx) throw new Error('snowpark renderer: 2D context unavailable')
  const ctx: CanvasRenderingContext2D = maybeCtx

  let cssW = 0
  let cssH = 0
  const trailX = new Float64Array(TRAIL_MAX)
  const trailY = new Float64Array(TRAIL_MAX)
  let trailLen = 0
  let lastX = Number.NEGATIVE_INFINITY

  function resize(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const rect = canvas.getBoundingClientRect()
    cssW = rect.width
    cssH = rect.height
    canvas.width = Math.round(cssW * dpr)
    canvas.height = Math.round(cssH * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  function pushTrail(s: RiderState): void {
    if (s.x < lastX - 50) trailLen = 0 // respawn: rider jumped backward
    lastX = s.x
    if (trailLen < TRAIL_MAX) {
      trailX[trailLen] = s.x
      trailY[trailLen] = s.y
      trailLen += 1
      return
    }
    trailX.copyWithin(0, 1)
    trailY.copyWithin(0, 1)
    trailX[TRAIL_MAX - 1] = s.x
    trailY[TRAIL_MAX - 1] = s.y
  }

  function draw(state: RiderState, course: Course): void {
    if (cssW === 0) resize()
    const scene: Scene = {
      ctx,
      w: cssW,
      h: cssH,
      s: state,
      rx: cssW * RIDER_FRAC_X,
      ry: cssH * RIDER_FRAC_Y,
    }
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'alphabetic'
    ctx.font = '11px ui-monospace, monospace'

    drawSky(scene)
    drawSun(scene)
    for (const layer of FAR_LAYERS) drawFarLayer(scene, layer)
    drawTerrain(scene)
    drawObstacles(scene, course)
    pushTrail(state)
    drawTrail(scene, trailX, trailY, trailLen)
    drawRider(scene)
    drawFinish(scene, course)
    drawSnow(scene)
  }

  return { draw, resize }
}

// --- camera ---------------------------------------------------------------

const toScreenX = (sc: Scene, worldX: number): number => worldX - sc.s.x + sc.rx
const toScreenY = (sc: Scene, worldY: number): number => worldY - sc.s.y + sc.ry

// --- layers ---------------------------------------------------------------

function drawSky(sc: Scene): void {
  sc.ctx.fillStyle = palette.ice
  sc.ctx.fillRect(0, 0, sc.w, sc.h)
}

function drawSun(sc: Scene): void {
  const drift = clamp(sc.s.x * 0.02, 0, sc.w * 0.18)
  const x = sc.w * 0.82 - drift
  const y = sc.h * 0.16
  sc.ctx.beginPath()
  sc.ctx.arc(x, y, 26, 0, Math.PI * 2)
  sc.ctx.fillStyle = palette.amber
  sc.ctx.fill()
}

/** A distant, parallax-slowed contour; baseline-subtracted so it never crawls. */
function drawFarLayer(sc: Scene, cfg: FarLayer): void {
  const { ctx, w, s, rx, ry } = sc
  const base = slopeY(s.x * cfg.p * cfg.k)
  ctx.beginPath()
  for (let sx = 0; sx <= w; sx += 28) {
    const worldX = s.x * cfg.p + (sx - rx)
    const y = ry + cfg.lift + (slopeY(worldX * cfg.k) - base) * 0.4
    if (sx === 0) ctx.moveTo(sx, y)
    else ctx.lineTo(sx, y)
  }
  ctx.strokeStyle = cfg.color
  ctx.lineWidth = cfg.width
  ctx.stroke()
}

function drawTerrain(sc: Scene): void {
  strokeSnowLine(sc, 0, palette.blueDeep, 3)
  for (const [offset, color, width] of TERRAIN_ECHOES) {
    strokeSnowLine(sc, offset, color, width)
  }
}

/** The master curve (or an echo of it) sampled across the viewport. */
function strokeSnowLine(sc: Scene, offset: number, color: string, width: number): void {
  const { ctx, w } = sc
  ctx.beginPath()
  for (let sx = 0; sx <= w; sx += 24) {
    const worldX = sc.s.x + (sx - sc.rx)
    const y = toScreenY(sc, slopeY(worldX)) + offset
    if (sx === 0) ctx.moveTo(sx, y)
    else ctx.lineTo(sx, y)
  }
  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.stroke()
}

// --- obstacles ------------------------------------------------------------

function drawObstacles(sc: Scene, course: Course): void {
  const left = sc.s.x - sc.rx - 80
  const right = sc.s.x + (sc.w - sc.rx) + 80
  course.obstacles.forEach((o, i) => {
    if (o.x + o.length < left || o.x > right) return
    if (o.type === 'kicker') drawKicker(sc, o)
    else if (o.type === 'rail') drawRail(sc, o)
    else drawBox(sc, o)
    drawLabel(sc, o, sc.s.collected[i])
  })
}

function drawKicker(sc: Scene, o: CourseObstacle): void {
  const { ctx } = sc
  const end = o.x + o.length
  ctx.beginPath()
  ctx.moveTo(toScreenX(sc, o.x), toScreenY(sc, slopeY(o.x)))
  ctx.lineTo(toScreenX(sc, end), toScreenY(sc, slopeY(end)))
  ctx.lineTo(toScreenX(sc, end), toScreenY(sc, slopeY(end) - 34))
  ctx.closePath()
  ctx.strokeStyle = palette.ink
  ctx.lineWidth = 2.5
  ctx.stroke()
}

function drawRail(sc: Scene, o: CourseObstacle): void {
  const { ctx } = sc
  const end = o.x + o.length
  const yA = obstacleSurfaceY(o, o.x)
  const yB = obstacleSurfaceY(o, end)
  ctx.strokeStyle = palette.ink
  ctx.lineWidth = 1.5
  drawSeg(sc, o.x, yA, o.x, slopeY(o.x))
  drawSeg(sc, end, yB, end, slopeY(end))
  ctx.lineWidth = 3
  drawSeg(sc, o.x, yA, end, yB)
}

function drawBox(sc: Scene, o: CourseObstacle): void {
  const { ctx } = sc
  const end = o.x + o.length
  const left = toScreenX(sc, o.x)
  const top = toScreenY(sc, obstacleSurfaceY(o, o.x))
  const wBox = toScreenX(sc, end) - left
  const hBox = toScreenY(sc, slopeY(o.x)) - top
  ctx.beginPath()
  ctx.roundRect(left, top, wBox, hBox, 6)
  ctx.strokeStyle = palette.ink
  ctx.lineWidth = 2.5
  ctx.stroke()
}

function drawLabel(sc: Scene, o: CourseObstacle, collected: boolean): void {
  const { ctx } = sc
  const cx = toScreenX(sc, o.x + o.length / 2)
  const topWorldY =
    o.type === 'kicker' ? slopeY(o.x + o.length) - 34 : obstacleSurfaceY(o, o.x)
  const y = toScreenY(sc, topWorldY) - 12
  const text = o.skill.name.toLowerCase()
  ctx.fillStyle = palette.ink
  ctx.fillText(text, cx, y)
  if (!collected) return
  const half = ctx.measureText(text).width / 2
  ctx.beginPath()
  ctx.arc(cx - half - 8, y - 4, 4, 0, Math.PI * 2)
  ctx.fillStyle = palette.amber
  ctx.fill()
}

// --- trail ----------------------------------------------------------------

function drawTrail(sc: Scene, xs: Float64Array, ys: Float64Array, len: number): void {
  if (len < 2) return
  const { ctx } = sc
  ctx.strokeStyle = palette.bluePale
  for (let i = 1; i < len; i++) {
    ctx.lineWidth = (i / len) * 3
    drawSeg(sc, xs[i - 1], ys[i - 1], xs[i], ys[i])
  }
}

// --- rider ----------------------------------------------------------------

function drawRider(sc: Scene): void {
  const s = sc.s
  if (s.mode === 'bail') return drawBailedRider(sc)
  const angle = s.mode === 'air' ? s.rotationDeg * DEG2RAD : slopeAngle(s.x)
  const bodyLen = s.grabbing ? 9 : 16
  drawBoard(sc, sc.rx, sc.ry, angle)
  drawBody(sc, sc.rx, sc.ry, angle, bodyLen)
}

/** Board + leaning body + head, spinning apart as the bail timer runs down. */
function drawBailedRider(sc: Scene): void {
  const t = 1 - sc.s.bailTimer / BAIL_TIME
  const seed = Math.floor((sc.s.time - (BAIL_TIME - sc.s.bailTimer)) * 1000)
  const parts = [0, 1, 2]
  for (const part of parts) {
    const dir = hash(seed + part * 31) * Math.PI * 2
    const dist = t * (40 + part * 14)
    const px = sc.rx + Math.cos(dir) * dist
    const py = sc.ry + Math.sin(dir) * dist - t * 20
    const spin = t * (part + 2) * Math.PI * 2
    if (part === 0) drawBoard(sc, px, py, spin)
    else if (part === 1) drawBody(sc, px, py, spin, 14)
    else drawHead(sc, px, py)
  }
}

function drawBoard(sc: Scene, cx: number, cy: number, angle: number): void {
  const { ctx } = sc
  const dx = Math.cos(angle) * 9
  const dy = Math.sin(angle) * 9
  ctx.beginPath()
  ctx.moveTo(cx - dx, cy - dy)
  ctx.lineTo(cx + dx, cy + dy)
  ctx.strokeStyle = palette.ink
  ctx.lineWidth = 3
  ctx.stroke()
}

function drawBody(sc: Scene, cx: number, cy: number, angle: number, len: number): void {
  const { ctx } = sc
  const ux = Math.cos(angle - Math.PI / 2)
  const uy = Math.sin(angle - Math.PI / 2)
  const hipX = cx + ux * (len * 0.4)
  const hipY = cy + uy * (len * 0.4)
  const shX = cx + ux * len + Math.cos(angle) * 3
  const shY = cy + uy * len + Math.sin(angle) * 3
  ctx.strokeStyle = palette.ink
  ctx.lineWidth = 2.5
  ctx.beginPath()
  ctx.moveTo(cx, cy)
  ctx.lineTo(hipX, hipY)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(hipX, hipY)
  ctx.lineTo(shX, shY)
  ctx.stroke()
  drawHead(sc, shX + ux * 4, shY + uy * 4)
}

function drawHead(sc: Scene, x: number, y: number): void {
  const { ctx } = sc
  ctx.beginPath()
  ctx.arc(x, y, 3.5, 0, Math.PI * 2)
  ctx.fillStyle = palette.ink
  ctx.fill()
}

// --- finish + snow --------------------------------------------------------

function drawFinish(sc: Scene, course: Course): void {
  const { ctx } = sc
  const leftX = course.finishX
  const rightX = course.finishX + 140
  if (toScreenX(sc, leftX) > sc.w + 40 || toScreenX(sc, rightX) < -40) return
  const topL = slopeY(leftX) - 74
  const topR = slopeY(rightX) - 74
  ctx.strokeStyle = palette.ink
  ctx.lineWidth = 3
  drawSeg(sc, leftX, slopeY(leftX), leftX, topL)
  drawSeg(sc, rightX, slopeY(rightX), rightX, topR)
  drawSeg(sc, leftX, topL, rightX, topR)
  ctx.fillStyle = palette.ink
  ctx.fillText('finish', toScreenX(sc, (leftX + rightX) / 2), toScreenY(sc, (topL + topR) / 2) - 8)
}

/** ≤60 drifting dots — a mood, not a particle system. No per-frame allocation. */
function drawSnow(sc: Scene): void {
  const { ctx, w, h } = sc
  const t = sc.s.time
  ctx.fillStyle = palette.bluePale
  for (let i = 0; i < 60; i++) {
    const x = mod(hash(i) * w - t * 12, w)
    const y = mod(hash(i + 500) * h + t * 18, h)
    ctx.beginPath()
    ctx.arc(x, y, 1.5, 0, Math.PI * 2)
    ctx.fill()
  }
}

// --- primitives -----------------------------------------------------------

function drawSeg(sc: Scene, x0: number, y0: number, x1: number, y1: number): void {
  const { ctx } = sc
  ctx.beginPath()
  ctx.moveTo(toScreenX(sc, x0), toScreenY(sc, y0))
  ctx.lineTo(toScreenX(sc, x1), toScreenY(sc, y1))
  ctx.stroke()
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}

function mod(a: number, n: number): number {
  return ((a % n) + n) % n
}

/** Deterministic 0..1 hash of an integer — the only source of scatter. */
function hash(n: number): number {
  const x = Math.sin(n * 12.9898) * 43758.5453
  return x - Math.floor(x)
}
