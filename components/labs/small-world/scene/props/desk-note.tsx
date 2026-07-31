'use client'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { PALETTE } from '../../palette'
import type { EndingState } from '../../ending-timeline'
import { DESK_NOTE, DESK_TOP_Y } from '../desk-stage'
import { useClayRamp } from '../toon-ramp'
import type { JourneyRef } from '../use-journey'
import { tiltTowardKey } from './desk-kit'

/**
 * THE NOTE (Task 65) — the hand-written half of the ending, lying on the desk.
 *
 * The writing is drawn into a canvas rather than built out of clay, and that is the whole reason it
 * reads. At full pull-back the sheet is roughly 340 × 120 device pixels on a 1440-wide frame, and
 * it is foreshortened, so anything spelled in geometry at that size is a smear of facets. Ink on
 * paper survives the same reduction because it is ink on paper: the texture is authored at
 * 1024 × 544 and the mip chain does the rest.
 *
 * The font is the lab's own — `--sw-font-hand`, resolved off the element that carries the lab's
 * font variables rather than hard-coded, so the note cannot drift from the page's typography.
 *
 * ============================================================================
 * WHY THERE IS A SECOND PAINT, AND WHY IT CANNOT BE SEEN
 * ============================================================================
 * The sheet is painted once at mount with whatever hand the browser has. If the webfont has not
 * landed yet that is `Caveat Fallback` — metric-matched, so the layout is identical and only the
 * letterforms differ (measured: 7.69% of the texture's pixels; advance widths 736.0 vs 721.1 px).
 * A second paint on `document.fonts.ready` upgrades it.
 *
 * The first version of this file claimed that second paint could not land during the reveal because
 * the visitor is "at the top of a 1600 vh track". That was wrong twice over. It is one keypress to
 * the bottom of a track — review measured `fonts.ready` resolving at 10056 ms with the visitor
 * already at scrollY 15840, i.e. a glyph swap on the largest readable object in frame — and the
 * thing that actually makes the RELOAD path safe is `beginManualScrollRestoration` in
 * `scroll-reset.ts`, not the distance.
 *
 * So the repaint is GATED rather than assumed safe, and the gate is exact rather than generous: it
 * happens only while `ending.zoom === 0`. Two proofs this round already owns compose to make that
 * airtight — at `zoom === 0` the camera pose is bit-identical to the static pose
 * (`ending-camera.test.ts`), and at the static pose every vertex of this sheet is below the bottom
 * frustum plane (`desk-stage.test.ts`). The note is therefore not merely unlikely to be on screen
 * when it changes; it is provably off it. If the font arrives after the pull-back has begun the
 * upgrade is skipped for good and the fallback hand stands — a difference nobody can see without an
 * A/B, which is a better trade than a swap somebody can.
 *
 * Deterministic: the texture is a pure function of its own module constants and the mesh never
 * moves. The journey ref is read at exactly one instant — the moment the font resolves — and never
 * per frame; nothing here subscribes to a frame loop.
 */

const TEX_W = 1024
const TEX_H = Math.round((TEX_W * DESK_NOTE.depth) / DESK_NOTE.width)

/** Resolve `--sw-font-hand` to the family name the browser actually loaded. */
function handFamily(): string {
  const host = document.querySelector('[data-sw-fonts]')
  if (!host) return 'cursive'
  const probe = document.createElement('span')
  probe.style.fontFamily = 'var(--sw-font-hand)'
  probe.style.position = 'absolute'
  probe.style.visibility = 'hidden'
  host.appendChild(probe)
  const family = getComputedStyle(probe).fontFamily
  host.removeChild(probe)
  return family || 'cursive'
}

/** `#RRGGBB` + alpha to a canvas fill string, so the palette owns the colour and this file the alpha. */
function rgba(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`
}

/** A hand-drawn rule: one stroke that wobbles, because a straight one reads as a border. */
function squiggle(ctx: CanvasRenderingContext2D, x0: number, x1: number, y: number, amp: number) {
  ctx.beginPath()
  ctx.moveTo(x0, y)
  const n = 40
  for (let i = 1; i <= n; i++) {
    const t = i / n
    const x = x0 + t * (x1 - x0)
    ctx.lineTo(x, y + Math.sin(t * 7.4 + 0.6) * amp + Math.sin(t * 2.1) * amp * 0.7)
  }
  ctx.stroke()
}

function paint(ctx: CanvasRenderingContext2D, family: string) {
  ctx.clearRect(0, 0, TEX_W, TEX_H)
  ctx.fillStyle = PALETTE.notePaper
  ctx.fillRect(0, 0, TEX_W, TEX_H)

  // paper is never one flat cream: a faint warmer wash down the right-hand side gives the sheet a
  // side to be lit from without asking the scene for another light. Both stops are palette entries
  // now — the ALPHAS are a drawing parameter and stay here, the COLOURS are a palette decision and
  // do not. These were the only rgba() literals under scene/.
  const wash = ctx.createLinearGradient(0, 0, TEX_W, TEX_H)
  wash.addColorStop(0, rgba(PALETTE.notePaperLit, 0.35))
  wash.addColorStop(1, rgba(PALETTE.notePaperTint, 0.16))
  ctx.fillStyle = wash
  ctx.fillRect(0, 0, TEX_W, TEX_H)

  ctx.fillStyle = PALETTE.ink
  ctx.strokeStyle = PALETTE.ink
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  ctx.save()
  ctx.translate(62, 0)
  ctx.rotate(-0.018)
  ctx.font = `700 158px ${family}`
  ctx.textBaseline = 'alphabetic'
  ctx.fillText('connect with me', 0, 208)
  ctx.lineWidth = 7
  squiggle(ctx, 6, 742, 244, 5)
  ctx.restore()

  ctx.save()
  ctx.translate(70, 0)
  ctx.rotate(-0.01)
  ctx.font = `400 68px ${family}`
  ctx.fillStyle = PALETTE.ink
  ctx.globalAlpha = 0.82
  ctx.fillText('the next chapter is unwritten —', 0, 348)
  ctx.fillText('say hi', 0, 424)
  ctx.restore()

  // the signature, and a doodle of the thing the visitor has just spent six chapters walking around
  ctx.save()
  ctx.translate(TEX_W - 62, 0)
  ctx.rotate(-0.06)
  ctx.font = `700 92px ${family}`
  ctx.textAlign = 'right'
  ctx.fillText('Aram', 0, 476)
  ctx.restore()

  ctx.save()
  ctx.strokeStyle = PALETTE.ink
  ctx.globalAlpha = 0.55
  ctx.lineWidth = 6
  ctx.beginPath()
  ctx.arc(TEX_W - 96, 300, 38, 0, Math.PI * 2)
  ctx.stroke()
  ctx.beginPath()
  ctx.ellipse(TEX_W - 96, 300, 38, 13, 0.34, 0, Math.PI * 2)
  ctx.stroke()
  ctx.globalAlpha = 1
  ctx.restore()
}

/**
 * Whether the deferred upgrade may still be applied. Every vertex of the sheet is below the bottom
 * frustum plane for the one pose the camera holds while `zoom` is 0, so this is the exact boundary
 * rather than a margin around one.
 */
export function noteRepaintAllowed(ending: EndingState): boolean {
  return ending.zoom === 0
}

/** The font shorthand the headline is drawn at — what `fonts.check` has to answer for. */
const handProbe = (family: string) => `700 158px ${family}`

function useNoteTexture(journeyRef: JourneyRef): THREE.CanvasTexture | null {
  const built = useMemo(() => {
    if (typeof document === 'undefined') return null
    const canvas = document.createElement('canvas')
    canvas.width = TEX_W
    canvas.height = TEX_H
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    const family = handFamily()
    paint(ctx, family)
    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = 8
    // if the hand was already loaded, this paint IS the final one and there is nothing deferred
    return { tex, needsUpgrade: !(document.fonts?.check(handProbe(family)) ?? true) }
  }, [])

  useEffect(() => {
    if (!built?.needsUpgrade) return
    let live = true
    document.fonts?.ready.then(() => {
      if (!live) return
      // THE GATE. Past this the camera has moved and the sheet is on screen; a better hand is not
      // worth a visible swap, so the fallback stands.
      if (!noteRepaintAllowed(journeyRef.current.ending)) return
      const ctx = (built.tex.image as HTMLCanvasElement).getContext('2d')
      if (!ctx) return
      // r3f runs a continuous loop, so flagging the texture is the whole of the update — there is
      // nothing to re-render in React and no state here to make stale.
      paint(ctx, handFamily())
      built.tex.needsUpdate = true
    })
    return () => {
      live = false
    }
  }, [built, journeyRef])

  useEffect(() => () => built?.tex.dispose(), [built])

  return built?.tex ?? null
}

/**
 * The sheet: a grid so one corner can curl. `DESK_NOTE.top` is the lift, and it is the same number
 * the containment gate is made against — the curl is authored FROM the published ceiling rather
 * than added on top of a flat sheet afterwards.
 */
function buildSheet(): THREE.BufferGeometry {
  const NU = 14
  const NV = 10
  const positions: number[] = []
  const uvs: number[] = []
  const index: number[] = []
  const cos = Math.cos(DESK_NOTE.rot)
  const sin = Math.sin(DESK_NOTE.rot)
  const ramp = (t: number) => {
    const x = Math.min(1, Math.max(0, (t - 0.58) / 0.42))
    return x * x * (3 - 2 * x)
  }

  for (let iv = 0; iv <= NV; iv++) {
    const v = iv / NV
    for (let iu = 0; iu <= NU; iu++) {
      const u = iu / NU
      const lx = (u - 0.5) * DESK_NOTE.width
      const lz = (0.5 - v) * DESK_NOTE.depth
      // the near-right corner lifts off the desk, the way a sheet that has been under something does
      const curl = (DESK_NOTE.top - DESK_NOTE.lift) * ramp(u) * ramp(v)
      positions.push(
        DESK_NOTE.x + lx * cos + lz * sin,
        DESK_TOP_Y + DESK_NOTE.lift + curl,
        DESK_NOTE.z - lx * sin + lz * cos
      )
      uvs.push(u, v)
    }
  }
  const row = NU + 1
  for (let iv = 0; iv < NV; iv++) {
    for (let iu = 0; iu < NU; iu++) {
      const a = iv * row + iu
      // wound so the face normal comes out +y: the sheet's rows run AWAY from the viewer (z falls
      // as v rises), which reverses the handedness the slab's grid has
      index.push(a, a + 1, a + row, a + 1, a + row + 1, a + row)
    }
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geo.setIndex(index)
  geo.computeVertexNormals()
  // keep a little of the curl's own shading, take the rest from the key — see tiltTowardKey
  tiltTowardKey(geo, 0.42)
  return geo
}

export function DeskNote({ journeyRef }: { journeyRef: JourneyRef }) {
  const ramp = useClayRamp()
  const texture = useNoteTexture(journeyRef)
  const sheet = useMemo(buildSheet, [])
  useEffect(() => () => sheet.dispose(), [sheet])

  return (
    <mesh geometry={sheet}>
      <meshToonMaterial map={texture} color={texture ? '#ffffff' : PALETTE.notePaper} gradientMap={ramp} />
    </mesh>
  )
}
