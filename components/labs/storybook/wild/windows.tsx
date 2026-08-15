'use client'

/**
 * WILD lane — instanced windows and the waking cascade. Owned by the WAKING implementer.
 *
 * THE WHOLE INN IS ONE DRAW CALL. Every pane in `WINDOWS` is an instance of a single unit
 * quad; the shape (square / tall / arched / round), the occupant silhouette and the live
 * glow all travel as per-instance attributes into one ShaderMaterial. Thirty meshes would be
 * thirty draw calls at the turn peak, which is the one thing this candidate cannot afford.
 *
 * Spill is FOUR real point lights at room centroids (`ROOM_LIGHTS`), never one per window.
 *
 * This file also owns the waking MATHS — `igniteCurve`, `windowGlow`, `roomLevel` — because
 * the atmosphere layer has to light its shafts and pools off exactly the same curve the glass
 * is using, or the beam and its window disagree by a frame and the illusion dies.
 */

import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'

import { foldSlot, type FoldChunkName } from './fold-birth'
import { FOLD_GLSL_MOVE, foldMoveUniforms } from './fold-uniforms'
import {
  NIGHT_WINDOW_ID,
  PALETTE,
  ROOM_CASCADE,
  ROOM_LIGHTS,
  WINDOWS,
  type Occupant,
  type RoomId,
  type WindowSlot,
} from './inn-model'
import { applyRiseClip } from './rise-clip'
import { catCrossingAt, STAGE_LIFE } from './stage-life'
import { ramp, readWildFrame, useWild } from './wild-frame'

// -----------------------------------------------------------------------------------------
// THE IGNITE CURVE — a candle catching, not a crossfade
// -----------------------------------------------------------------------------------------

/**
 * The step response of an underdamped second-order system: quadratic start (the wick takes),
 * a fast rise, ~14% overshoot at t = 0.37 (the flare as the wax gives), then a settle. It is
 * the one ease in this layer and nothing here is linear.
 *
 *   v(t) = 1 - e^(-A t) [ cos(W t) + (A/W) sin(W t) ]
 *
 * A and W are picked so the overshoot is small and the residual at t = 1 is under 1%.
 */
const IGNITE_A = 5.2
const IGNITE_W = 8.4

export function igniteCurve(t: number): number {
  if (t <= 0) return 0
  if (t >= 1) return 1
  const decay = Math.exp(-IGNITE_A * t)
  return 1 - decay * (Math.cos(IGNITE_W * t) + (IGNITE_A / IGNITE_W) * Math.sin(IGNITE_W * t))
}

/** How much of the key's turn one window spends catching. Slightly wider than the spacing
 *  inside the busiest room (the gallery's seven, at 0.037 apart) so the run overlaps and
 *  reads as a wave rather than a row of switches. */
export const IGNITE_SPAN = 0.06

/** The one gable window burning all night — the sleeping inn's second and last warm note. */
const NIGHT_FLOOR = 0.34

/** Live glow of one pane, 0 (dead) .. ~1.14 (mid-flare) .. 1 (settled). */
export function windowGlow(wake: number, slot: WindowSlot): number {
  const g = igniteCurve((wake - slot.at) / IGNITE_SPAN)
  if (slot.id !== NIGHT_WINDOW_ID) return g
  // Blended rather than max()'d: a max would kink the moment the cascade overtakes the floor.
  return g + NIGHT_FLOOR * (1 - Math.min(1, Math.max(0, g)))
}

/** Live level of a whole room — what the spill light, the shaft and the pools follow. */
export function roomLevel(wake: number, room: RoomId): number {
  const [lo, hi] = ROOM_CASCADE[room]
  return igniteCurve((wake - lo) / (hi - lo + IGNITE_SPAN))
}

// -----------------------------------------------------------------------------------------
// ATLASES — shapes and occupants, painted once at mount
// -----------------------------------------------------------------------------------------

const SHAPE_INDEX: Record<WindowSlot['shape'], number> = {
  square: 0,
  tall: 1,
  arched: 2,
  round: 3,
}

const OCCUPANT_INDEX: Record<Occupant, number> = {
  none: 0,
  fiddler: 1,
  dancers: 2,
  cat: 3,
  ledger: 4,
  child: 5,
}

/** Columns in the occupant atlas. Six standing occupants plus the walking cat, so 4x2. */
const OCCUPANT_COLS = 4
/** The walking cat's cell — the only occupant that is not chosen per window in `inn-model`. */
const CAT_WALK_CELL = 6

const CELL = 128
/** Painted margin inside every cell, so linear filtering at a cell seam picks up empty pixels
 *  from its own cell rather than its neighbour's silhouette. */
const PAD = 6

function makeCanvas(w: number, h: number): CanvasRenderingContext2D {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('wild/windows: 2d canvas context unavailable')
  return ctx
}

function canvasTexture(ctx: CanvasRenderingContext2D): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(ctx.canvas)
  // flipY off so cell (col,row) is addressable straight from canvas coordinates.
  tex.flipY = false
  tex.generateMipmaps = false
  tex.minFilter = THREE.LinearFilter
  tex.magFilter = THREE.LinearFilter
  tex.wrapS = THREE.ClampToEdgeWrapping
  tex.wrapT = THREE.ClampToEdgeWrapping
  return tex
}

/** 2x2 atlas of pane masks: square, tall, arched, round. White where glass is. */
function paintShapeAtlas(): THREE.CanvasTexture {
  const ctx = makeCanvas(CELL * 2, CELL * 2)
  ctx.fillStyle = '#ffffff'
  const cell = (i: number): { x: number; y: number } => ({
    x: (i % 2) * CELL,
    y: Math.floor(i / 2) * CELL,
  })
  const inner = CELL - PAD * 2

  // square — a plain light with a hair of a chamfer
  {
    const { x, y } = cell(0)
    ctx.fillRect(x + PAD, y + PAD, inner, inner)
  }
  // tall — narrower, full height
  {
    const { x, y } = cell(1)
    ctx.fillRect(x + PAD + inner * 0.09, y + PAD, inner * 0.82, inner)
  }
  // arched — square-headed below, semicircular above
  {
    const { x, y } = cell(2)
    const w = inner * 0.84
    const left = x + PAD + (inner - w) / 2
    const r = w / 2
    const springY = y + PAD + r
    ctx.beginPath()
    ctx.moveTo(left, y + PAD + inner)
    ctx.lineTo(left, springY)
    ctx.arc(left + r, springY, r, Math.PI, 0)
    ctx.lineTo(left + w, y + PAD + inner)
    ctx.closePath()
    ctx.fill()
  }
  // round — a bullseye roof light
  {
    const { x, y } = cell(3)
    ctx.beginPath()
    ctx.arc(x + CELL / 2, y + CELL / 2, inner / 2, 0, Math.PI * 2)
    ctx.fill()
  }
  return canvasTexture(ctx)
}

/**
 * 4x2 atlas of occupant silhouettes. Each pane is ~32x47 reference pixels on screen, so these
 * are painted as BOLD single masses with one readable gesture apiece — a fiddle arm, two
 * linked bodies, a pair of ears. Detail below about four pixels would be a smudge.
 *
 * Cells 0-5 are the STANDING occupants, chosen per window in `inn-model`. Cell 6 is the only one
 * that moves across its glass: the walking cat (see OCCUPANT_GRID and the crossing in the frag).
 */
function paintOccupantAtlas(): THREE.CanvasTexture {
  const ctx = makeCanvas(CELL * OCCUPANT_COLS, CELL * 2)
  ctx.fillStyle = '#000000'
  ctx.strokeStyle = '#000000'
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  const at = (i: number): void => {
    ctx.save()
    ctx.translate((i % OCCUPANT_COLS) * CELL, Math.floor(i / OCCUPANT_COLS) * CELL)
  }
  const done = (): void => ctx.restore()

  const body = (cx: number, top: number, bot: number, halfW: number): void => {
    ctx.beginPath()
    ctx.moveTo(cx - halfW * 0.62, bot)
    ctx.lineTo(cx - halfW, top + (bot - top) * 0.28)
    ctx.quadraticCurveTo(cx, top, cx + halfW, top + (bot - top) * 0.28)
    ctx.lineTo(cx + halfW * 0.62, bot)
    ctx.closePath()
    ctx.fill()
  }
  const head = (cx: number, cy: number, r: number): void => {
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.fill()
  }

  // 0 — none. Left empty on purpose; index 0 is never sampled.

  // 1 — fiddler: a body, a head, and the bow arm thrown up across the light.
  at(1)
  head(64, 40, 13)
  body(64, 54, 120, 22)
  ctx.lineWidth = 9
  ctx.beginPath()
  ctx.moveTo(60, 66)
  ctx.lineTo(88, 44)
  ctx.stroke()
  ctx.lineWidth = 5
  ctx.beginPath()
  ctx.moveTo(84, 52)
  ctx.lineTo(112, 34)
  ctx.stroke()
  done()

  // 2 — dancers: two bodies leaning into each other, arms joined overhead. The pair sways.
  at(2)
  head(42, 42, 11)
  body(42, 55, 120, 18)
  head(88, 44, 11)
  body(88, 57, 120, 18)
  ctx.lineWidth = 8
  ctx.beginPath()
  ctx.moveTo(48, 64)
  ctx.quadraticCurveTo(65, 34, 82, 66)
  ctx.stroke()
  done()

  // 3 — cat: haunches, chest, two ears, a tail curled along the sill.
  at(3)
  ctx.beginPath()
  ctx.ellipse(58, 96, 30, 24, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(46, 96)
  ctx.quadraticCurveTo(44, 58, 62, 54)
  ctx.quadraticCurveTo(80, 58, 76, 100)
  ctx.closePath()
  ctx.fill()
  head(62, 52, 17)
  ctx.beginPath()
  ctx.moveTo(48, 44)
  ctx.lineTo(50, 24)
  ctx.lineTo(62, 40)
  ctx.closePath()
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(76, 44)
  ctx.lineTo(76, 24)
  ctx.lineTo(64, 40)
  ctx.closePath()
  ctx.fill()
  ctx.lineWidth = 9
  ctx.beginPath()
  ctx.moveTo(86, 108)
  ctx.quadraticCurveTo(112, 108, 106, 78)
  ctx.stroke()
  done()

  // 4 — ledger: someone bent over a desk, the desk edge cutting the light low.
  at(4)
  ctx.save()
  ctx.translate(60, 62)
  ctx.rotate(0.22)
  head(0, 0, 13)
  ctx.restore()
  ctx.beginPath()
  ctx.moveTo(38, 116)
  ctx.lineTo(46, 74)
  ctx.quadraticCurveTo(66, 60, 86, 84)
  ctx.lineTo(86, 116)
  ctx.closePath()
  ctx.fill()
  ctx.fillRect(24, 112, 88, 16)
  done()

  // 5 — child: small, low in the frame, nose to the glass.
  at(5)
  head(64, 78, 15)
  ctx.beginPath()
  ctx.moveTo(42, 128)
  ctx.lineTo(48, 96)
  ctx.quadraticCurveTo(64, 88, 80, 96)
  ctx.lineTo(86, 128)
  ctx.closePath()
  ctx.fill()
  done()

  // 6 — THE WALKING CAT. Painted feet-down at the bottom of the cell and facing +u, because the
  // crossing slides this cell across one pane's glass and lifts it to the sill; a cat drawn
  // anywhere but on the cell's floor would walk through the air. Side-on and long: at this size
  // the read is the SILHOUETTE — low back, upright head, tail up — not the animal.
  at(6)
  ctx.beginPath()
  ctx.ellipse(60, 96, 34, 15, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.ellipse(86, 92, 16, 15, 0, 0, Math.PI * 2)
  ctx.fill()
  head(101, 79, 13)
  // Ears, and a blunt muzzle so the head is not a ball.
  ctx.beginPath()
  ctx.moveTo(93, 71)
  ctx.lineTo(91, 57)
  ctx.lineTo(102, 67)
  ctx.closePath()
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(105, 69)
  ctx.lineTo(110, 57)
  ctx.lineTo(113, 71)
  ctx.closePath()
  ctx.fill()
  ctx.beginPath()
  ctx.ellipse(111, 84, 7, 5, 0, 0, Math.PI * 2)
  ctx.fill()
  // Four legs, mid-stride: the near pair gathered, the far pair reaching.
  ctx.lineWidth = 8
  for (const [x0, x1] of [
    [92, 95],
    [80, 74],
    [44, 39],
    [56, 60],
  ]) {
    ctx.beginPath()
    ctx.moveTo(x0, 100)
    ctx.lineTo(x1, 120)
    ctx.stroke()
  }
  // The tail, up and hooked — the one line that says cat from across a room.
  ctx.lineWidth = 8
  ctx.beginPath()
  ctx.moveTo(28, 94)
  ctx.quadraticCurveTo(10, 84, 16, 56)
  ctx.stroke()
  done()

  return canvasTexture(ctx)
}

// -----------------------------------------------------------------------------------------
// SHADER
// -----------------------------------------------------------------------------------------

const ATLAS_UV = /* glsl */ `
// Cells run left-to-right, top-to-bottom in canvas order; the texture is flipY:false, so the
// pane's v has to be flipped back into canvas-down space before it indexes a cell.
vec2 atlasUv(vec2 uv, float idx, vec2 grid) {
  float col = mod(idx, grid.x);
  float row = floor(idx / grid.x);
  vec2 t = vec2(uv.x, 1.0 - uv.y);
  return (vec2(col, row) + t) / grid;
}
`

const VERT = /* glsl */ `
#include <clipping_planes_pars_vertex>
${FOLD_GLSL_MOVE}
attribute float aGlow;
attribute float aPhase;
attribute float aShape;
attribute float aOcc;
attribute float aCross;
varying vec2 vUv;
varying float vGlow;
varying float vPhase;
varying float vShape;
varying float vOcc;
varying float vCross;

void main() {
  vUv = uv;
  vGlow = aGlow;
  vPhase = aPhase;
  vShape = aShape;
  vOcc = aOcc;
  vCross = aCross;
  // Each pane rides the fold chunk of the wall it is cut into. The instance matrix places it at
  // its REST position first; the fold map then moves that, exactly as it moves the wall's own
  // vertices — so a window can never drift out of its hole mid-fold.
  vec4 rest = instanceMatrix * vec4(position, 1.0);
  vec4 mvPosition = modelViewMatrix * uFoldM[ int( aFold + 0.5 ) ] * rest;
  gl_Position = projectionMatrix * mvPosition;
  #include <clipping_planes_vertex>
}
`

const FRAG = /* glsl */ `
#include <clipping_planes_pars_fragment>
uniform sampler2D uShapes;
uniform sampler2D uOccupants;
uniform float uTime;
/** The cat crossing: (slide in pane widths, gate 0..1, facing -1/+1, sill height in pane heights). */
uniform vec4 uCross;
varying vec2 vUv;
varying float vGlow;
varying float vPhase;
varying float vShape;
varying float vOcc;
varying float vCross;

${ATLAS_UV}

// Palette, straight from inn-model's PALETTE, arriving as uniforms rather than GLSL constants
// on purpose: the grade's OutputPass tone-maps and sRGB-encodes this layer's output, so every
// colour here has to be in LINEAR working space. THREE.Color does that conversion; a hex
// pasted into GLSL does not, and the whole inn came out washed pale the one time it was.
uniform vec3 uGlass;
uniform vec3 uDim;
uniform vec3 uMid;
uniform vec3 uHot;

void main() {
  #include <clipping_planes_fragment>

  float mask = texture2D(uShapes, atlasUv(vUv, vShape, vec2(2.0, 2.0))).a;
  float alpha = smoothstep(0.34, 0.62, mask);
  if (alpha < 0.01) discard;

  // A lit inn BREATHES. Two summed sines per pane off its own phase, deeper while the flame
  // is still catching, so no two windows ever sit at the same value.
  float g0 = max(vGlow, 0.0);
  float f1 = sin(uTime * (2.4 + vPhase * 2.1) + vPhase * 12.566);
  float f2 = sin(uTime * (6.1 + vPhase * 3.4) + vPhase * 7.13);
  float flicker = 1.0 + (0.045 + 0.055 * (1.0 - clamp(g0, 0.0, 1.0))) * (0.68 * f1 + 0.32 * f2);
  float g = g0 * flicker;

  // Warm-up: an ember-orange first catch, gold once the room is properly alight.
  vec3 warm = mix(uDim, uMid, smoothstep(0.02, 0.45, g));
  warm = mix(warm, uHot, smoothstep(0.45, 1.05, g));

  // The lamp is IN the room, low and behind the glass: brighter at the sill, falling off up.
  float pool = 1.0 - 0.42 * smoothstep(0.18, 1.0, vUv.y);
  pool *= 1.0 - 0.22 * smoothstep(0.30, 1.0, abs(vUv.x - 0.5) * 2.0);

  vec3 col = uGlass + warm * g * (0.65 + 0.85 * g) * pool;

  // Occupants fade in as their room lights. The dancers sway; everyone else holds still.
  if (vOcc > 0.5) {
    vec2 oUv = vUv;
    if (vOcc > 1.5 && vOcc < 2.5) {
      oUv.x += sin(uTime * 1.15 + vPhase * 6.283) * 0.13;
      oUv.y += 0.020 * (1.0 - cos(uTime * 2.30 + vPhase * 6.283));
    }
    float occ = 0.0;
    if (oUv.x > 0.0 && oUv.x < 1.0 && oUv.y > 0.0 && oUv.y < 1.0) {
      occ = texture2D(uOccupants, atlasUv(oUv, vOcc, vec2(${OCCUPANT_COLS}.0, 2.0))).a;
    }
    occ *= smoothstep(0.22, 0.72, g);
    col = mix(col, col * 0.09 + uGlass * 0.30, occ);
  }

  // THE CAT CROSSING. One pane, once every twenty-odd seconds: the walking cell slid across the
  // glass on the shared clock, lifted to the sill, bobbing a hair per step, and mirrored on the
  // return leg so it does not moonwalk home. Costs no geometry and no draw call — this is the
  // whole reason the occupants are an atlas.
  if (vCross > 0.5 && uCross.y > 0.002) {
    vec2 cUv = vec2(
      vUv.x - uCross.x,
      vUv.y - uCross.w + ${STAGE_LIFE.cat.bob.toFixed(4)} * sin(uTime * ${((Math.PI * 2) / STAGE_LIFE.cat.bobPeriod).toFixed(3)})
    );
    if (uCross.z < 0.0) cUv.x = 1.0 - cUv.x;
    float walk = 0.0;
    if (cUv.x > 0.0 && cUv.x < 1.0 && cUv.y > 0.0 && cUv.y < 1.0) {
      walk = texture2D(uOccupants, atlasUv(cUv, ${CAT_WALK_CELL}.0, vec2(${OCCUPANT_COLS}.0, 2.0))).a;
    }
    walk *= smoothstep(0.22, 0.72, g) * uCross.y;
    col = mix(col, col * 0.09 + uGlass * 0.30, walk);
  }

  // Glazing bars. Rectangular lights only — a bar across a bullseye reads as a crack.
  if (vShape < 2.5) {
    float bv = 1.0 - smoothstep(0.022, 0.055, abs(vUv.x - 0.5));
    float h1 = 1.0 - smoothstep(0.016, 0.040, abs(vUv.y - 0.3333));
    float h2 = 1.0 - smoothstep(0.016, 0.040, abs(vUv.y - 0.6667));
    col *= 1.0 - 0.50 * clamp(bv + h1 + h2, 0.0, 1.0);
  }

  // The reveal: glass sits inside a thickness of wall, so its border is always in shadow.
  float edge = smoothstep(0.0, 0.10, min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y)));
  col *= 0.42 + 0.58 * edge;

  gl_FragColor = vec4(col, alpha);
}
`

// -----------------------------------------------------------------------------------------
// COMPONENT
// -----------------------------------------------------------------------------------------

const UP = new THREE.Vector3(0, 1, 0)

/**
 * Which hinge chunk each pane rides. Derived from the room, because the room already says which
 * wall the pane is cut into — the one exception is the bullseye, which lies IN the roof slope
 * rather than in a dormer face and so folds with the roof.
 */
const ROOM_FOLD: Record<RoomId, FoldChunkName> = {
  passage: 'walls',
  taproom: 'walls',
  kitchen: 'walls',
  stair: 'tower',
  gallery: 'jetty',
  chambers: 'jetty',
  attic: 'dormers',
}

function foldSlotFor(slot: WindowSlot): number {
  if (Math.abs(slot.facing[1]) > 0.5) return foldSlot('roof')
  return foldSlot(ROOM_FOLD[slot.room])
}

/**
 * Which pane the cat walks across, and which room has to be lit for it to be worth walking.
 *
 * A missing id is NOT an error: the attribute stays zero, the crossing never fires, and the inn is
 * exactly the inn that shipped without it — the same deliberate failure mode as fold slot 0.
 */
const CAT_PANE = WINDOWS.findIndex((slot) => slot.id === STAGE_LIFE.cat.pane)
const CAT_ROOM: RoomId | null = CAT_PANE >= 0 ? WINDOWS[CAT_PANE].room : null

/** Deterministic per-window phase — a hash, not Math.random, so a reload looks the same. */
function phaseFor(index: number): number {
  const s = Math.sin(index * 127.1 + 311.7) * 43758.5453
  return s - Math.floor(s)
}

let atlasCache: { shapes: THREE.CanvasTexture; occupants: THREE.CanvasTexture } | null = null

/** Both window atlases, painted once per session (idle-warmed via wild/warmup). */
export function windowAtlases(): NonNullable<typeof atlasCache> {
  if (!atlasCache) atlasCache = { shapes: paintShapeAtlas(), occupants: paintOccupantAtlas() }
  return atlasCache
}

export function InnWindows() {
  const ctx = useWild()
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const lightRefs = useRef<(THREE.PointLight | null)[]>([])

  const { shapes, occupants } = windowAtlases()

  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(1, 1)
    const n = WINDOWS.length
    const glow = new Float32Array(n)
    const phase = new Float32Array(n)
    const shape = new Float32Array(n)
    const occ = new Float32Array(n)
    const fold = new Float32Array(n)
    const cross = new Float32Array(n)
    WINDOWS.forEach((slot, i) => {
      phase[i] = phaseFor(i)
      shape[i] = SHAPE_INDEX[slot.shape]
      occ[i] = OCCUPANT_INDEX[slot.occupant]
      fold[i] = foldSlotFor(slot)
      cross[i] = i === CAT_PANE ? 1 : 0
    })
    const glowAttr = new THREE.InstancedBufferAttribute(glow, 1)
    glowAttr.setUsage(THREE.DynamicDrawUsage)
    geo.setAttribute('aGlow', glowAttr)
    geo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phase, 1))
    geo.setAttribute('aShape', new THREE.InstancedBufferAttribute(shape, 1))
    geo.setAttribute('aOcc', new THREE.InstancedBufferAttribute(occ, 1))
    geo.setAttribute('aFold', new THREE.InstancedBufferAttribute(fold, 1))
    geo.setAttribute('aCross', new THREE.InstancedBufferAttribute(cross, 1))
    return geo
  }, [])

  const material = useMemo(() => {
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        ...foldMoveUniforms(),
        uShapes: { value: shapes },
        uOccupants: { value: occupants },
        uTime: { value: 0 },
        uCross: { value: new THREE.Vector4(0, 0, 1, STAGE_LIFE.cat.sill) },
        uGlass: { value: new THREE.Color(PALETTE.glassDark) },
        uDim: { value: new THREE.Color('#ff6b1e') },
        uMid: { value: new THREE.Color(PALETTE.lamp) },
        uHot: { value: new THREE.Color(PALETTE.lampHot) },
      },
      transparent: true,
      depthWrite: true,
      // ShaderMaterial only gets the clipping chunks compiled in when it asks for them.
      clipping: true,
    })
    return applyRiseClip(mat)
  }, [shapes, occupants])

  // Per-instance transforms are static: position, orientation off `facing`, scale off w/h.
  useEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return
    const m = new THREE.Matrix4()
    const look = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const pos = new THREE.Vector3()
    const eye = new THREE.Vector3()
    const scale = new THREE.Vector3()
    WINDOWS.forEach((slot, i) => {
      pos.set(slot.pos[0], slot.pos[1], slot.pos[2])
      // lookAt(eye, target, up) points the object's +z from target toward eye, so putting the
      // eye one facing-length in front of the pane aims +z straight down the wall's normal.
      eye.set(slot.facing[0], slot.facing[1], slot.facing[2]).normalize().add(pos)
      look.lookAt(eye, pos, UP)
      q.setFromRotationMatrix(look)
      scale.set(slot.w, slot.h, 1)
      m.compose(pos, q, scale)
      mesh.setMatrixAt(i, m)
    })
    mesh.instanceMatrix.needsUpdate = true
    mesh.frustumCulled = false
  }, [])

  // The atlases are NOT disposed: they live in the module cache so a later remount (paging
  // away and back) reuses them instead of repainting on the turn.
  useEffect(
    () => () => {
      geometry.dispose()
      material.dispose()
    },
    [geometry, material],
  )

  useFrame(() => {
    const mesh = meshRef.current
    if (!mesh) return
    const f = readWildFrame(ctx)
    mesh.visible = !f.hidden
    if (f.hidden) {
      for (const light of lightRefs.current) if (light) light.intensity = 0
      return
    }

    material.uniforms.uTime.value = f.time

    // THE CAT. Its schedule is a pure function of the shared clock, and it is gated on the room
    // being lit — a silhouette needs something to be a silhouette against. The gate is a ramp
    // rather than a threshold so reversing the key fades the cat out instead of deleting it.
    if (CAT_ROOM) {
      const cross = catCrossingAt(f.time)
      const lit = roomLevel(f.wake, CAT_ROOM)
      const gate = cross.gate * ramp(lit, STAGE_LIFE.cat.litFloor * 0.55, STAGE_LIFE.cat.litFloor)
      const u = material.uniforms.uCross.value as THREE.Vector4
      u.set(cross.shift, gate, cross.dir, STAGE_LIFE.cat.sill)
    }

    const attr = geometry.getAttribute('aGlow') as THREE.InstancedBufferAttribute
    const arr = attr.array as Float32Array
    for (let i = 0; i < WINDOWS.length; i += 1) arr[i] = windowGlow(f.wake, WINDOWS[i])
    attr.needsUpdate = true

    // FOUR lights for thirty windows (D5). Each one carries its whole room's spill, and gets
    // a slow two-sine wander so the pool it throws on the cobbles is never dead still.
    // Lights are NEVER visibility-flipped — a change in the visible-light count re-links every
    // program in the scene (a ~1s dead frame); an unlit room is intensity 0, not a hidden light.
    ROOM_LIGHTS.forEach((spec, i) => {
      const light = lightRefs.current[i]
      if (!light) return
      const level = roomLevel(f.wake, spec.room)
      const wander =
        1 + 0.055 * Math.sin(f.time * (1.7 + i * 0.43) + i * 2.1) + 0.03 * Math.sin(f.time * 4.3 + i)
      light.intensity = spec.intensity * level * wander
    })
  })

  return (
    <>
      <instancedMesh
        ref={meshRef}
        args={[geometry, material, WINDOWS.length]}
        renderOrder={1}
        name="wild-windows"
      />
      {ROOM_LIGHTS.map((spec, i) => (
        <pointLight
          key={spec.room}
          ref={(el) => {
            lightRefs.current[i] = el
          }}
          position={spec.pos as unknown as [number, number, number]}
          distance={spec.distance}
          decay={2}
          intensity={0}
          color={spec.room === 'passage' ? PALETTE.lampHot : PALETTE.lamp}
          castShadow={false}
        />
      ))}
    </>
  )
}
