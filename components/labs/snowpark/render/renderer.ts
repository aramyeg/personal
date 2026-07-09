/**
 * Powder Lines renderer (M3 atmosphere).
 *
 * The camera transform (zoom, lead, shake) established in M1 now drives a
 * layered Alto-style scene: the day-cycle sky, three cached parallax bands
 * fogged toward the horizon, the near snowfield as a filled rim-lit body with
 * the rider's carve line, phase-aware obstacle shapes, pooled spray/trail
 * juice, and a rare foreground occluder. The rider is a procedural jointed rig
 * with a verlet scarf (M4, render/rider-rig.ts + render/scarf.ts). Layer
 * ordering is the load-bearing contract here.
 */
import type { Course, CourseObstacle } from '../course'
import { slopeAngle, slopeY } from '../slope'
import { PHYS, obstacleSurfaceY, type RiderState } from '../rider'
import { CAM, shakeOffset, type CameraState } from '../camera'
import { palette } from '../palette'
import { createParticles } from './particles'
import { createFx } from './fx'
import { boardAngle, drawRider, riderJoints } from './rider-rig'
import { createScarf } from './scarf'
import { drawSky, skyColors, type PhaseColors } from './sky'
import {
  BANDS,
  darken,
  drawForeground,
  drawHazeVeil,
  drawParallax,
  drawStretchProps,
  drawTerrain,
  mix,
  RIM_TINT,
  type TerrainView,
} from './terrain'

export type Renderer = {
  draw(state: RiderState, course: Course, cam: CameraState): void
  resize(): void
}

const OFFSCREEN_MARGIN = 80
/** Obstacle strokes tint toward the band color so they read as part of the
 * mountain, not a diagram overlaid on it. */
const OBSTACLE_STROKE_TINT = 0.15
/** Respawn tell: the rider's world x jumps back by more than this in one
 * frame (v1 convention) — the renderer's cue to clear particles/trail. */
const RESPAWN_JUMP = 50

/**
 * GATE C: plain ink obstacle labels are illegible once the sky goes to
 * night. The sanctioned fix (Task 12) is a soft amber halo behind labels,
 * collected dots, and the finish banner, scaled by `colors.glow01` so it's
 * invisible by day and never overpowers the scene at night — alpha is
 * capped at GLOW_ALPHA_MAX·glow01.
 */
const GLOW_ALPHA_MAX = 0.5
/** "Radius 2× glyph": the label/finish font is 11px, so 22px covers a word
 * without engulfing the whole HUD-adjacent area. */
const GLOW_RADIUS_TEXT = 22
/** Same "2× glyph" rule applied to the collected dot's own size (2× its
 * 8px diameter) rather than the font. */
const GLOW_RADIUS_DOT = 16

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}

/** 0..1 along-slope speed, the shared "how fast" input for camera/juice. */
function speed01(state: RiderState): number {
  return clamp((state.speed - PHYS.MIN_SPEED) / (PHYS.MAX_SPEED - PHYS.MIN_SPEED), 0, 1)
}

/** `min(floor(chain/3), 3)` — raises trail width (and, from M3, brightness). */
function chainTierOf(state: RiderState): number {
  return Math.min(Math.floor(state.chain / 3), 3)
}

/** Everything a layer helper needs: context, size, state, camera transform,
 * and this frame's phase colors (obstacle stroke precomputed). */
type Scene = {
  ctx: CanvasRenderingContext2D
  w: number
  h: number
  s: RiderState
  cam: CameraState
  ox: number
  oy: number
  colors: PhaseColors
  obStroke: string
}

const sx = (sc: Scene, wx: number): number => (wx - sc.cam.x) * sc.cam.zoom + sc.ox
const sy = (sc: Scene, wy: number): number => (wy - sc.cam.y) * sc.cam.zoom + sc.oy

export function createRenderer(canvas: HTMLCanvasElement): Renderer {
  const maybeCtx = canvas.getContext('2d')
  if (!maybeCtx) throw new Error('snowpark renderer: 2D context unavailable')
  const ctx: CanvasRenderingContext2D = maybeCtx

  let cssW = 0
  let cssH = 0
  const particles = createParticles()
  const fx = createFx()
  const scarf = createScarf()
  // Render-layer internal state (documented exception, see particles.ts):
  // tracks sim-time delta and one-frame transitions the draw call itself
  // has no other way to see (draw() only receives the latest state).
  let lastTime = 0
  let lastX = Number.NEGATIVE_INFINITY
  let lastMode: RiderState['mode'] | null = null
  let scarfSeeded = false

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
    const ox = cssW * CAM.ANCHOR_X + shake.x
    const oy = cssH * CAM.ANCHOR_Y + shake.y
    const p = clamp(state.x / course.finishX, 0, 1)
    const colors = skyColors(p)
    const scene: Scene = {
      ctx,
      w: cssW,
      h: cssH,
      s: state,
      cam,
      ox,
      oy,
      colors,
      obStroke: mix(palette.ink, colors.band, OBSTACLE_STROKE_TINT),
    }
    const view: TerrainView = {
      camX: cam.x,
      camY: cam.y,
      zoom: cam.zoom,
      ox,
      oy,
      w: cssW,
      h: cssH,
      p,
    }
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'alphabetic'
    ctx.font = '11px ui-monospace, monospace'

    stepJuice(scene)

    // Back-to-front: sky, three hazed parallax bands, the filled snowfield,
    // the carve ribbon, the course, the spray, the rider, a foreground pine,
    // then the screen-space speed lines and finish banner.
    drawSky(ctx, cssW, cssH, p, state.time)
    for (let i = 0; i < BANDS.length; i++) {
      drawParallax(ctx, view, colors, BANDS[i], i)
      drawHazeVeil(ctx, colors, cssW, cssH)
    }
    drawTerrain(ctx, view, colors, particles.trailPositions())
    drawStretchProps(ctx, view, colors, course)
    drawTrailLayer(scene)
    drawObstacles(scene, course)
    drawParticleLayer(scene)
    drawRiderLayer(scene)
    drawForeground(ctx, view, colors)
    fx.drawSpeedLines(ctx, cssW, cssH, speed01(state))
    drawFinish(scene, course)
  }

  /** Feed this frame's flags into the particle system and the fx spring
   * (renderer stays the only caller; sim state is read-only). Runs before
   * any drawing so a respawn-triggered clear() lands before draw(). The fx
   * spring's own clock is driven by this same dt, so it freezes right along
   * with everything else during hit-stop (dt collapses to 0 while step()
   * is on hold — see use-game-loop.ts). */
  function stepJuice(sc: Scene): void {
    const s = sc.s
    const dt = Math.max(0, s.time - lastTime)
    lastTime = s.time

    const respawned = s.x < lastX - RESPAWN_JUMP
    if (respawned) particles.clear()
    lastX = s.x

    // Bail fires once, on the frame mode transitions into it — justLaunched
    // fires on tiny crest hops too, so launch FX are gated on vy below
    // (upward launches only: pops, kicker exits, grind ollies).
    if (s.mode === 'bail' && lastMode !== 'bail') particles.burst(s.x, s.y, 1)
    lastMode = s.mode

    if (s.mode === 'snow') {
      // Spray from the board's REAR contact point, not its center: offset
      // half a board length back along the slope tangent (RIG.BOARD_LEN 46).
      const a = slopeAngle(s.x)
      particles.spray(s.x - Math.cos(a) * 23, s.y - Math.sin(a) * 23, speed01(s), dt)
    }
    if (s.justLanded) particles.burst(s.x, s.y, s.impact)
    particles.pushTrail(s.x, s.y, chainTierOf(s))
    particles.update(dt)

    if (s.justLaunched && s.vy < 0) fx.onLaunch()
    if (s.justLanded) fx.onLand(s.impact)
    fx.update(dt)

    // Scarf: verlet cloth pinned at the fx-scaled neck, wind opposing travel.
    // On snow/grind the equivalent horizontal speed is the along-slope speed
    // projected flat; airborne it is vx. Reset on a respawn's backward x-jump
    // (and once on the first frame) so the chain never streaks across the seam.
    const anchor = scarfAnchor(s, fx.riderScale())
    if (respawned || !scarfSeeded) {
      scarf.reset(anchor.x, anchor.y)
      scarfSeeded = true
    }
    const vxEquiv =
      s.mode === 'air' || s.mode === 'bail' ? s.vx : Math.cos(slopeAngle(s.x)) * s.speed
    scarf.update(anchor.x, anchor.y, -vxEquiv * 0.9, dt)
  }

  /** Carve ribbon under the obstacles (world units, local camera transform —
   * the same zoom-scaling the rider rect gets, without threading zoom through
   * the ParticleSystem interface). */
  function drawTrailLayer(sc: Scene): void {
    const { ctx: c } = sc
    c.save()
    c.translate(sc.ox, sc.oy)
    c.scale(sc.cam.zoom, sc.cam.zoom)
    c.translate(-sc.cam.x, -sc.cam.y)
    particles.drawTrail(c, chainTierOf(sc.s))
    c.restore()
  }

  /** Spray/burst pool over the obstacles (same local camera transform). */
  function drawParticleLayer(sc: Scene): void {
    const { ctx: c } = sc
    c.save()
    c.translate(sc.ox, sc.oy)
    c.scale(sc.cam.zoom, sc.cam.zoom)
    c.translate(-sc.cam.x, -sc.cam.y)
    particles.drawParticles(c)
    c.restore()
  }

  /** The rider and scarf, in world units under the same local camera transform
   * as the juice layers. Scarf under the body so its root tucks behind the
   * shoulder while the trailing flag flows free behind the figure. */
  function drawRiderLayer(sc: Scene): void {
    const { ctx: c } = sc
    c.save()
    c.translate(sc.ox, sc.oy)
    c.scale(sc.cam.zoom, sc.cam.zoom)
    c.translate(-sc.cam.x, -sc.cam.y)
    scarf.draw(c)
    drawRider(c, sc.s, fx.riderScale(), sc.colors)
    c.restore()
  }

  return { draw, resize }
}

// --- layers -----------------------------------------------------------------

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function rgba(hex: string, a: number): string {
  const [r, g, b] = hexToRgb(hex)
  return `rgba(${r}, ${g}, ${b}, ${a})`
}

/** Soft radial halo, the sanctioned night-glow treatment (see GLOW_ALPHA_MAX
 * above). No-op below GATE C's night-glow ramp so daylight frames skip the
 * gradient allocation entirely. */
function drawGlow(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  color: string,
  alpha: number,
): void {
  if (alpha <= 0) return
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius)
  g.addColorStop(0, rgba(color, alpha))
  g.addColorStop(1, rgba(color, 0))
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(cx, cy, radius, 0, Math.PI * 2)
  ctx.fill()
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

/** A kicker is packed snow fused to the slope: a filled wedge whose base
 * follows the slope curve (no chord gap underneath), a snow body gradient lit
 * toward the lip, a sun rim-light plus a thin ink edge along the ride face
 * only, and a snow-shadow back cut instead of an inked post — a full outline
 * made it read as a propped-up cutout (GATE G). The lip sits PHYS.LIP_RAISE
 * above the snow — the same face the rider climbs and launches off in the sim. */
function drawKicker(sc: Scene, o: CourseObstacle): void {
  const { ctx } = sc
  const entryX = sx(sc, o.x)
  const entryY = sy(sc, slopeY(o.x))
  const lipX = sx(sc, o.x + o.length)
  const lipTopY = sy(sc, slopeY(o.x + o.length) - PHYS.LIP_RAISE)
  const lipBaseY = sy(sc, slopeY(o.x + o.length))

  // Body: snow gradient, lit toward the lip, seated into the slope along the
  // slope's own curve back to the entry.
  const grad = ctx.createLinearGradient(0, lipTopY, 0, lipBaseY)
  grad.addColorStop(0, mix(sc.colors.snow, '#ffffff', 0.15))
  grad.addColorStop(1, darken(sc.colors.snow, 0.06))
  ctx.beginPath()
  ctx.moveTo(entryX, entryY)
  ctx.lineTo(lipX, lipTopY)
  for (let t = 0; t <= 1; t += 0.25) {
    const wx = o.x + o.length * (1 - t)
    ctx.lineTo(sx(sc, wx), sy(sc, slopeY(wx)))
  }
  ctx.closePath()
  ctx.fillStyle = grad
  ctx.fill()

  // Back cut in shadow — packed snow sliced at the lip, not a post.
  ctx.strokeStyle = darken(sc.colors.snow, 0.28)
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(lipX, lipTopY)
  ctx.lineTo(lipX, lipBaseY)
  ctx.stroke()

  // The ride face carries the definition: a thin ink edge under the same sun
  // rim used on the snowline crest.
  ctx.strokeStyle = sc.obStroke
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(entryX, entryY)
  ctx.lineTo(lipX, lipTopY)
  ctx.stroke()
  ctx.strokeStyle = mix(sc.colors.sun, '#ffffff', RIM_TINT)
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(entryX, entryY - 1.5)
  ctx.lineTo(lipX, lipTopY - 1.5)
  ctx.stroke()
}

function drawRail(sc: Scene, o: CourseObstacle): void {
  const { ctx } = sc
  ctx.strokeStyle = sc.obStroke
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
  ctx.strokeStyle = sc.obStroke
  ctx.lineWidth = 2.5
  ctx.beginPath()
  ctx.roundRect(x0, y0, x1 - x0, Math.max(y1 - y0, 10), 6)
  ctx.stroke()
}

function drawLabel(sc: Scene, o: CourseObstacle, collected: boolean): void {
  const { ctx } = sc
  const cx = sx(sc, o.x + o.length / 2)
  const cy = sy(sc, slopeY(o.x + o.length / 2) - PHYS.SURFACE_RAISE) - 16
  const glowAlpha = GLOW_ALPHA_MAX * sc.colors.glow01
  if (glowAlpha > 0) drawGlow(ctx, cx, cy - 4, GLOW_RADIUS_TEXT, palette.amber, glowAlpha)
  ctx.fillStyle = palette.ink
  ctx.fillText(o.skill.name.toLowerCase(), cx, cy)
  if (collected) {
    const dotX = cx + ctx.measureText(o.skill.name).width / 2 + 10
    const dotY = cy - 3
    if (glowAlpha > 0) drawGlow(ctx, dotX, dotY, GLOW_RADIUS_DOT, palette.amber, glowAlpha)
    ctx.fillStyle = palette.amber
    ctx.beginPath()
    ctx.arc(dotX, dotY, 4, 0, Math.PI * 2)
    ctx.fill()
  }
}

function drawFinish(sc: Scene, course: Course): void {
  if (!visible(sc, course.finishX, 60)) return
  const { ctx } = sc
  const x0 = sx(sc, course.finishX)
  const x1 = x0 + 46
  const y0 = sy(sc, slopeY(course.finishX))
  const y1 = sy(sc, slopeY(course.finishX) - 90)
  const glow01 = sc.colors.glow01
  const glowAlpha = GLOW_ALPHA_MAX * glow01

  // Posts: always ink — only the banner line and text carry the night glow.
  ctx.strokeStyle = palette.ink
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(x0, y0)
  ctx.lineTo(x0, y1)
  ctx.moveTo(x1, sy(sc, slopeY(course.finishX + 46)))
  ctx.lineTo(x1, y1)
  ctx.stroke()

  // Banner line: amber + glow scaled by glow01 — the finish crescendo.
  if (glowAlpha > 0) drawGlow(ctx, (x0 + x1) / 2, y1, GLOW_RADIUS_TEXT, palette.amber, glowAlpha)
  ctx.strokeStyle = glow01 > 0 ? mix(palette.ink, palette.amber, glow01) : palette.ink
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(x0, y1)
  ctx.lineTo(x1, y1)
  ctx.stroke()

  if (glowAlpha > 0) drawGlow(ctx, x0 + 23, y1 - 8, GLOW_RADIUS_TEXT, palette.amber, glowAlpha)
  ctx.fillStyle = palette.ink
  ctx.fillText('finish', x0 + 23, y1 - 8)
}

/**
 * The scarf's pinned root in WORLD units: the neck joint with the fx squash/
 * stretch applied exactly as `drawRider` applies it (in the board-local frame,
 * around the contact point), so the cloth stays glued to the shoulder through a
 * landing squash. During a bail the neck already rides the torso piece and no
 * scale is in play, so the joint is used as-is.
 */
function scarfAnchor(state: RiderState, scale: { sx: number; sy: number }): { x: number; y: number } {
  const neck = riderJoints(state).neck
  if (state.mode === 'bail') return neck
  const a = boardAngle(state)
  const dx = neck.x - state.x
  const dy = neck.y - state.y
  // World offset → board-local (rotate by −a) → squash → back to world.
  const ci = Math.cos(-a)
  const si = Math.sin(-a)
  const lx = (dx * ci - dy * si) * scale.sx
  const ly = (dx * si + dy * ci) * scale.sy
  const c = Math.cos(a)
  const s = Math.sin(a)
  return { x: state.x + lx * c - ly * s, y: state.y + lx * s + ly * c }
}
