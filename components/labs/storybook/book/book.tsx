'use client'

/**
 * The book assembly: spine, back cover, two page blocks, two static flat
 * pages, and the front cover pivot. World conventions (must match
 * page-geometry.ts): spine along Z at x=0, pages/covers extend toward +X
 * (the "right"/unread stack) with the mirrored twin toward -X (the
 * "left"/read stack), +Y up.
 *
 * Vertical stack when closed, bottom to top: desk -> back cover -> page
 * block -> front cover. The front cover pivots at the spine; its
 * `rotation.z` rests at the spread's open/closed pose but is driven
 * continuously through the 0..PI turn by the useFrame below whenever a
 * cover turn is in flight (see use-turn-driver.ts).
 */

import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useStorybookStore } from '../store'
import { SPREAD_COUNT, popupContentForSpread } from '../content'
import {
  INTERIOR_SHEETS,
  PAGE_H,
  PAGE_W,
  SHEET_STACK_T,
  STACK_PEDESTAL,
  STACK_TOTAL_H,
  buildPageTemplate,
  buildStackWedge,
  easeTurn,
  easeTurnWeighted,
  restAngles,
} from './page-geometry'
import {
  makeCreaseCanvas,
  makeLeatherCanvas,
  makePaperCanvas,
  makeStackEdgeCanvas,
} from '../procedural/paper-texture'
import { isCoverTurn, useTurnDriver } from './use-turn-driver'
import { TurningPage } from './turning-page'
import { PopupSpread, type PopupRole } from './popup-spread'
import { CoverDecals } from './cover-decals'
import { useSpreadPrints } from './use-page-print'

export const BOOK = {
  coverW: 1.22,
  coverH: 1.58,
  coverT: 0.035,
  // Closed-book page-block height: bound to the bulge model's stack total
  // (pedestal + 9 sheets) so the cover always rests exactly on the sheets.
  blockMaxH: STACK_TOTAL_H,
  pageLift: 0.005,
} as const

const SPREAD_MAX = SPREAD_COUNT - 1
const EDGE_COLOR = '#d8c491'
// Stacks sit almost flush with the open page's fore-edge (round 6: the
// open page read visibly LONGER than the closed stack beneath it).
const BLOCK_WIDTH = PAGE_W * 0.995
const BLOCK_DEPTH = PAGE_H * 0.985

const BACK_COVER_Y = BOOK.coverT / 2
const BACK_COVER_TOP = BOOK.coverT
const CLOSED_FRONT_COVER_Y = BACK_COVER_TOP + BOOK.blockMaxH + BOOK.coverT / 2
const OPEN_FRONT_COVER_Y = BOOK.coverT / 2
// A single Z pivot flips both local axes at PI, so it can only land on both
// the "closed, stacked on top" height and the "open, flat on the desk"
// height if it sits at their midpoint, with the cover mesh offset by half
// the gap between them. See task-9-brief.md for the two target poses.
const FRONT_PIVOT_Y = (CLOSED_FRONT_COVER_Y + OPEN_FRONT_COVER_Y) / 2
const FRONT_LOCAL_Y = (CLOSED_FRONT_COVER_Y - OPEN_FRONT_COVER_Y) / 2
const SPINE_HEIGHT = BOOK.coverT * 2 + BOOK.blockMaxH
// Open state: the spine board lies flat under the spread (real open books
// have no standing wall down the middle) — same thickness as a cover, its
// BOOK.coverH depth still exceeds the page block's BLOCK_DEPTH, so it
// peeks out beyond the pages at the near/far (top/bottom) edges only.
const SPINE_FLAT_HEIGHT = BOOK.coverT
// The ONE hinge LINE everything paper shares: both static page planes,
// the turning sheet's pivot, and the pop-up mechanisms' wedge floor all
// pass through it. The pop-up physics demands this (see popup-mechanics.ts):
// the sheet and the paper glued to it hinge on the same line, so an
// outgoing scene folds EXACTLY into the closing wedge under the sheet.
// Since the bulge model (derive-bulge.mjs, HINGE_KAPPA = 0) the line sits
// at the gutter VALLEY floor — pedestal height, constant for every spread
// — and the page PLANES tilt up from it by their per-spread rest angles
// (restAngles): the open book dips at the gutter and the stacks fan up to
// the fore-edges, trading thickness side to side as you read.
const PAGE_SURFACE_Y = BACK_COVER_TOP + STACK_PEDESTAL + BOOK.pageLift
// Gutter seam core: a narrow strip over the fold LINE only — the near-black
// gap between the page edges and the collapsed pop-ups' folded edges
// peeking out of it (paper-texture.ts makeCreaseCanvas). The wide concave
// valley shadow that used to live here moved INTO the page surfaces as the
// template's vertex-color AO ramp (page-geometry.ts gutterShade): a flat
// floating shadow can't follow pages that tilt up from the hinge, and it
// stayed behind when the sheet lifted — the round-5 "seam disappears from
// the turning page, clicks into place at landing".
const CREASE_WIDTH = 0.05
const CREASE_Y = PAGE_SURFACE_Y + 0.001
// Pop-up layers: a hair above the crease strip, effectively ON the page.
const POPUP_Y = PAGE_SURFACE_Y + 0.0015
// Open-page card thickness (~1mm at book scale, matching the turning
// sheet's PAPER_T): the rim ribbons hang this far under the print surface,
// inside the pageLift gap above the stack wedge — no z-fighting room lost.
const RIM_T = 0.004
// Closed book extends only toward +X from the spine (x=0), so it sits
// right of the HTML CTA's centerline; open, the two blocks/pages already
// straddle x=0 symmetrically. Shifting the whole assembly by -PAGE_W/2
// when closed centers it under the CTA without touching any local layout.
const CLOSED_CENTER_OFFSET_X = -PAGE_W / 2
// Turning sheet underside shade, ramped in mid-air and back to exact white
// at both flat poses (see the useFrame below): the landed face and the
// static page that replaces it must be pixel-identical at hand-off, or the
// brightness step reads as a flash on the landing page.
const SHEET_WHITE = new THREE.Color('#ffffff')
const SHEET_BACK_SHADE = new THREE.Color('#b9ad99')

export function makeCanvasTexture(source: HTMLCanvasElement): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(source)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  return texture
}

/** Builds the three procedural CanvasTextures once per mount and disposes them on unmount. */
function useBookTextures(): {
  paper: THREE.CanvasTexture
  leather: THREE.CanvasTexture
  crease: THREE.CanvasTexture
} {
  const paperCanvas = useMemo(() => makePaperCanvas(), [])
  const leatherCanvas = useMemo(() => makeLeatherCanvas(), [])
  const creaseCanvas = useMemo(() => makeCreaseCanvas(), [])
  const paper = useMemo(() => makeCanvasTexture(paperCanvas), [paperCanvas])
  const leather = useMemo(() => makeCanvasTexture(leatherCanvas), [leatherCanvas])
  const crease = useMemo(() => makeCanvasTexture(creaseCanvas), [creaseCanvas])

  useEffect(
    () => () => {
      paper.dispose()
      leather.dispose()
      crease.dispose()
    },
    [paper, leather, crease]
  )

  return { paper, leather, crease }
}

/** Unit stack-wedge BufferGeometry shared by both open-book stacks (its y
 *  scale is driven per frame to `sheets * SHEET_STACK_T`). */
function useWedgeGeometry(): THREE.BufferGeometry {
  const geometry = useMemo(() => {
    const { positions, uvs, indices } = buildStackWedge(BLOCK_WIDTH, BLOCK_DEPTH)
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
    geo.setIndex(new THREE.BufferAttribute(indices, 1))
    geo.computeVertexNormals()
    return geo
  }, [])
  useEffect(() => () => geometry.dispose(), [geometry])
  return geometry
}

/** Flat page BufferGeometry shared by both static pages (built once, disposed on unmount).
 *  Carries the template's gutter-shade vertex colors — the page materials
 *  render with vertexColors so the fold's AO rides the page surface. */
function usePageGeometry(): THREE.BufferGeometry {
  const geometry = useMemo(() => {
    const { positions, uvs, colors, indices } = buildPageTemplate()
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    geo.setIndex(new THREE.BufferAttribute(indices, 1))
    geo.computeVertexNormals()
    return geo
  }, [])

  useEffect(() => () => geometry.dispose(), [geometry])

  return geometry
}

/** Open burgundy tome, its front cover and centering offset animated live by
 * the turn driver instead of snapping between the closed/open poses. */
export function Book() {
  const spread = useStorybookStore((s) => s.spread)
  const turning = useStorybookStore((s) => s.turning)
  const { paper, leather, crease } = useBookTextures()
  const pageGeometry = usePageGeometry()
  const wedgeGeometry = useWedgeGeometry()
  const { frame, committedSpread } = useTurnDriver()
  const outerGroupRef = useRef<THREE.Group>(null)
  const frontCoverRef = useRef<THREE.Group>(null)
  // Tilt/stack consumers driven per frame (see the rest-pose block in the
  // useFrame below): the two static page CARDS (print + rim ribbons, so
  // the whole card tilts as one) and the two stack wedges.
  const rightPageRef = useRef<THREE.Group>(null)
  const leftPageRef = useRef<THREE.Group>(null)
  const rightWedgeRef = useRef<THREE.Mesh>(null)
  const leftWedgeRef = useRef<THREE.Mesh>(null)
  // Boot sentinel counters (see the markBooted block in the useFrame below).
  const bootFrames = useRef(0)
  const bootElapsedMs = useRef(0)

  const leatherMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ map: leather, roughness: 0.55 }),
    [leather]
  )
  const paperMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ map: paper, roughness: 0.9, side: THREE.DoubleSide }),
    [paper]
  )
  // v2 printed page faces: each static page shows its half of the current
  // spread's full-bleed print (user art `page-<n>.webp`, else the procedural
  // print). During a turn the exposed side pre-swaps to the incoming
  // spread's print — the page the lifting sheet reveals underneath.
  // vertexColors: the shared page template bakes the gutter fold's AO ramp
  // into its `color` attribute (page-geometry.ts gutterShade) — it must
  // multiply every print these pages ever wear, art and placeholder alike.
  const leftPageMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map: paper,
        roughness: 0.9,
        side: THREE.DoubleSide,
        vertexColors: true,
      }),
    [paper]
  )
  const rightPageMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map: paper,
        roughness: 0.9,
        side: THREE.DoubleSide,
        vertexColors: true,
      }),
    [paper]
  )
  const creaseMaterial = useMemo(
    () => new THREE.MeshBasicMaterial({ map: crease, transparent: true, depthWrite: false }),
    [crease]
  )
  // Stack-edge stripe maps (round 6): one canvas per (side, spread), each
  // stripe a sheet's cut edge washed with ITS chapter's lead accent —
  // membership per spread is a contiguous range, so all 20 exist up front
  // and the useFrame below swaps them on the driver clock like the prints.
  // Left stack bottom-up = sheets 1..s-1 (first-turned lowest); right
  // bottom-up = sheets 9..s (the current top sheet stays in the stack
  // until it flies — see restAngles' count note).
  const stackEdgeTextures = useMemo(() => {
    const tint = (k: number): string => popupContentForSpread(k)?.accents[0] ?? ''
    const left: THREE.CanvasTexture[] = []
    const right: THREE.CanvasTexture[] = []
    for (let s = 0; s <= SPREAD_MAX; s++) {
      const sc = Math.max(1, s)
      const leftTints =
        sc - 1 > 0 ? Array.from({ length: sc - 1 }, (_, i) => tint(1 + i)) : ['']
      const rightTints = Array.from({ length: INTERIOR_SHEETS + 1 - sc }, (_, i) =>
        tint(INTERIOR_SHEETS - i)
      )
      left.push(makeCanvasTexture(makeStackEdgeCanvas(leftTints)))
      right.push(makeCanvasTexture(makeStackEdgeCanvas(rightTints)))
    }
    return { left, right }
  }, [])
  const leftStackMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ roughness: 0.9 }),
    []
  )
  const rightStackMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ roughness: 0.9 }),
    []
  )
  // Per-spread page-edge identity tints (round 6b): the chapter's lead
  // accent pulled toward aged paper — what that page's ink looks like at
  // its cut edge. Drives the open pages' rim ribbons and the flying
  // sheet's rims, recolored per frame on the driver clock.
  const pageEdgeTints = useMemo(() => {
    const paper = new THREE.Color(EDGE_COLOR)
    return Array.from({ length: SPREAD_MAX + 1 }, (_, i) => {
      const accent = popupContentForSpread(i)?.accents[0]
      return accent ? new THREE.Color(accent).lerp(paper, 0.3) : paper.clone()
    })
  }, [])
  const rightRimMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: EDGE_COLOR, roughness: 0.92, side: THREE.DoubleSide }),
    []
  )
  const leftRimMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: EDGE_COLOR, roughness: 0.92, side: THREE.DoubleSide }),
    []
  )
  const sheetRimMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: EDGE_COLOR, roughness: 0.92, side: THREE.DoubleSide }),
    []
  )
  // Endpaper band under the fanned sheets: aged deeper than the sheets so
  // the anonymous beige never reads as "a page".
  const pedestalMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#c9b078', roughness: 0.9 }),
    []
  )
  // Closed book (spread 0): the shut block shows the SAME nine striped
  // sheet edges on its fore and z faces (box face order: +x, -x, +y, -y,
  // +z, -z — spine/top/bottom stay plain, they sit against spine board,
  // cover, and back cover).
  const closedBoxMaterials = useMemo(() => {
    const plain = () => new THREE.MeshStandardMaterial({ color: EDGE_COLOR, roughness: 0.85 })
    const striped = () =>
      new THREE.MeshStandardMaterial({ map: stackEdgeTextures.right[0], roughness: 0.85 })
    return [striped(), plain(), plain(), plain(), striped(), striped()]
  }, [stackEdgeTextures])
  useEffect(
    () => () => {
      for (const t of [...stackEdgeTextures.left, ...stackEdgeTextures.right]) t.dispose()
      leftStackMaterial.dispose()
      rightStackMaterial.dispose()
      rightRimMaterial.dispose()
      leftRimMaterial.dispose()
      sheetRimMaterial.dispose()
      pedestalMaterial.dispose()
      for (const m of closedBoxMaterials) m.dispose()
    },
    [
      stackEdgeTextures,
      leftStackMaterial,
      rightStackMaterial,
      rightRimMaterial,
      leftRimMaterial,
      sheetRimMaterial,
      pedestalMaterial,
      closedBoxMaterials,
    ]
  )

  // The turning sheet's two printed faces. Owned HERE (not in
  // turning-page.tsx) because their maps must swap inside the useFrame
  // below, on the driver-ref clock — a React effect in the sheet component
  // raced the driver at both ends of a turn and painted a blank-paper
  // frame whenever its flush landed while the sheet was still visible.
  // vertexColors: the sheet builds from the SAME page template, so its faces
  // carry the same baked gutter-shade ramp as the static pages — the crease
  // rides the flying sheet instead of staying behind on the desk, and the
  // lift-off/landing hand-off against the identically-shaded static page is
  // pixel-identical by construction.
  const sheetFrontMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map: paper,
        roughness: 0.9,
        side: THREE.FrontSide,
        vertexColors: true,
      }),
    [paper]
  )
  const sheetBackMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map: paper,
        roughness: 0.97,
        side: THREE.BackSide,
        vertexColors: true,
      }),
    [paper]
  )

  useEffect(
    () => () => {
      leatherMaterial.dispose()
      paperMaterial.dispose()
      leftPageMaterial.dispose()
      rightPageMaterial.dispose()
      creaseMaterial.dispose()
      sheetFrontMaterial.dispose()
      sheetBackMaterial.dispose()
    },
    [
      leatherMaterial,
      paperMaterial,
      leftPageMaterial,
      rightPageMaterial,
      creaseMaterial,
      sheetFrontMaterial,
      sheetBackMaterial,
    ]
  )

  // Committed open/closed state — drives the cover's *rest* pose and the
  // spine's standing-vs-flat shape. Deliberately NOT blended with `turning`
  // (unlike `isOpen` below): the cover's rotation during a turn is owned
  // entirely by the useFrame below, and a rest-pose prop that also flipped
  // mid-turn would fight it every render.
  const spreadOpen = spread > 0
  // Content-reveal state: open while resting past the cover, or while the
  // cover itself is turning (spread is still 0 the whole time a spread-0
  // "next" turn is in flight — the block/pages must already be visible so
  // the lifting cover reveals them, rather than popping in only once the
  // turn commits).
  const isOpen = spreadOpen || turning !== null
  // True for the entire duration of a cover turn (spread/turning are both
  // committed store state, so this is stable across the whole animation,
  // not a per-frame value). The front cover doubles as the left stack's
  // support board only at its fully-open rest pose (see FRONT_LOCAL_Y
  // above) — mid-rotation it is neither under the left pages (closing) nor
  // yet under them (opening), so the left static page/block must stay
  // hidden for the whole turn and only reappear once `completeTurn()`
  // lands the cover on its new rest pose.
  const isCoverTurning = turning !== null && isCoverTurn(spread, turning)
  const spineHeight = spreadOpen ? SPINE_FLAT_HEIGHT : SPINE_HEIGHT

  // Current spread ± 2 with actual pop-up content, so neighboring layer
  // textures are already warm by the time you turn to them (see
  // popup-spread.tsx's file header) — only `spread` itself ever renders
  // visibly, the neighbors stay hidden until it's their turn. ± 2 (not 1)
  // because a QUEUED turn promotes the instant the first one commits: its
  // destination is spread ± 2 from where the chain started, and a ± 1
  // window only begins loading it at the hand-off — pieces then popped in
  // a few frames into the second turn.
  const popupSpreadIndices = useMemo(
    () =>
      [spread - 2, spread - 1, spread, spread + 1, spread + 2].filter(
        (i) => i >= 1 && i <= SPREAD_MAX && popupContentForSpread(i) !== undefined
      ),
    [spread]
  )
  // The spread a turn (if any) is headed toward — `spread` itself is always
  // the one being left (see popup-spread.tsx's file header). Both are plain
  // re-render-on-commit values (turning/spread), not per-frame reads, so
  // computing this here doesn't touch the "no zustand in the frame loop"
  // contract the turn driver documents.
  const incomingSpreadIndex = turning ? spread + (turning === 'next' ? 1 : -1) : null

  // Printed page faces for the current spread ± 2 (indices 1..SPREAD_MAX —
  // spread 0 is the closed cover, no pages visible). ± 2 for the same
  // chained-turn reason as popupSpreadIndices above: the reveal-side print
  // must already be resolved when a queued turn promotes, or the exposed
  // page holds the outgoing print and swaps it mid-flight.
  const printIndices = useMemo(
    () => [spread - 2, spread - 1, spread, spread + 1, spread + 2].filter((i) => i >= 1 && i <= SPREAD_MAX),
    [spread]
  )
  const prints = useSpreadPrints(printIndices)
  // Upload every resolved print to the GPU as soon as it lands in the warm
  // window. Three.js otherwise uploads a texture on its first *rendered*
  // use — and every print's first rendered use is the first frame of a
  // turn, so the upload stall (tens of ms for a full-page canvas) hit
  // exactly when the eye was tracking the sheet's lift-off.
  const gl = useThree((s) => s.gl)
  useEffect(() => {
    for (const print of Object.values(prints)) {
      gl.initTexture(print.left)
      gl.initTexture(print.right)
    }
  }, [gl, prints])
  useEffect(() => {
    for (const t of [...stackEdgeTextures.left, ...stackEdgeTextures.right]) gl.initTexture(t)
  }, [gl, stackEdgeTextures])

  useFrame((_, delta) => {
    // Boot detection, on the same clock as everything else the eye sees:
    // the book counts as ready only after a run of REAL rendered frames
    // (shaders compiled, initTexture uploads flushed), a minimum dwell,
    // and every print in the warm window resolved. storybook-loader.tsx
    // holds its veil, the "Open the book" CTA and all turn input on this
    // flag — the first-load choppiness was the canvas booting in full
    // view with the cover already clickable.
    if (!useStorybookStore.getState().booted) {
      bootFrames.current += 1
      bootElapsedMs.current += delta * 1000
      const printsResolved = printIndices.every((i) => prints[i] !== undefined)
      if (bootFrames.current >= 12 && bootElapsedMs.current >= 600 && printsResolved) {
        useStorybookStore.getState().markBooted()
      }
    }

    const f = frame.current
    // EVERY print the eye can see during a turn is swapped here, in the
    // frame loop, off the driver's refs — the ONE clock the sheet's
    // visibility also runs on. Anything print-shaped left on React's
    // render/effect clock desyncs by a frame or two at a turn's endpoints
    // (React arms after the driver at lift-off and commits after it at
    // landing) and paints a wrong or blank face exactly when the sheet
    // stops covering it — the turn flash, in all its variants.
    // The lifting cover does its own reveal, so cover turns read the same f.dir.
    const sp = committedSpread.current
    const revealDir = f ? f.dir : null
    // Prefer the incoming half while a turn reveals it, else the current
    // spread's half. Never fall back to blank `paper` mid-book: at a chained
    // turn's hand-off the incoming print can still be a frame from warm (the
    // spread ± 1 window, keyed off React's slower `spread`, hasn't caught up to
    // the driver's committed one), and swapping to `paper` blanks the page for
    // that frame. Skipping the swap when nothing is resolved holds the last
    // real print, riding the gap invisibly until the incoming half warms in.
    const rightWanted = (revealDir === 'next' ? prints[sp + 1]?.right : undefined) ?? prints[sp]?.right
    if (rightWanted && rightPageMaterial.map !== rightWanted) {
      rightPageMaterial.map = rightWanted
      rightPageMaterial.needsUpdate = true
    }
    const leftWanted = (revealDir === 'prev' ? prints[sp - 1]?.left : undefined) ?? prints[sp]?.left
    if (leftWanted && leftPageMaterial.map !== leftWanted) {
      leftPageMaterial.map = leftWanted
      leftPageMaterial.needsUpdate = true
    }

    // The mid-turn sheet's two faces: the print it lifted with and the one
    // it lands as (same hold-last rule as the static pages — never blank).
    if (f && !f.isCover) {
      const frontWanted = f.dir === 'next' ? prints[sp]?.right : prints[sp - 1]?.right
      if (frontWanted && sheetFrontMaterial.map !== frontWanted) {
        sheetFrontMaterial.map = frontWanted
        sheetFrontMaterial.needsUpdate = true
      }
      const backWanted = f.dir === 'next' ? prints[sp + 1]?.left : prints[sp]?.left
      if (backWanted && sheetBackMaterial.map !== backWanted) {
        sheetBackMaterial.map = backWanted
        sheetBackMaterial.needsUpdate = true
      }
      // Underside shade: full card-stock tint only in mid-air, exact white
      // at both flat poses — at t=0/1 this face and the static page showing
      // the SAME print must hand off pixel-identically, and any constant
      // tint popped ~30% brightness on the landing page at commit.
      const shade = Math.sin(Math.PI * easeTurnWeighted(f.t))
      sheetBackMaterial.color.lerpColors(SHEET_WHITE, SHEET_BACK_SHADE, shade)
    }

    // Bulge rest poses, on this same clock and with the SAME side-index
    // rule as the print swaps above: the side that LOSES the flying sheet
    // re-tilts (and its stack wedge shrinks) at lift-off, hidden under the
    // barely-lifted sheet; the side that GAINS it re-tilts at commit,
    // hidden under the just-landed sheet (derive-bulge.mjs A16/A17 — the
    // sheet's tilted sweep starts and ends exactly in these planes).
    const rightIdx = revealDir === 'next' ? sp + 1 : sp
    const leftIdx = revealDir === 'prev' ? sp - 1 : sp
    if (rightPageRef.current) rightPageRef.current.rotation.z = restAngles(rightIdx).aR
    if (leftPageRef.current) leftPageRef.current.rotation.z = -restAngles(leftIdx).aL
    if (rightWedgeRef.current) {
      // +1: the current right page's own sheet stays IN the right stack
      // until it flies (see restAngles' count note).
      rightWedgeRef.current.scale.y = Math.max(
        (INTERIOR_SHEETS + 1 - Math.max(1, rightIdx)) * SHEET_STACK_T,
        1e-4
      )
    }
    if (leftWedgeRef.current) {
      leftWedgeRef.current.scale.y = Math.max((leftIdx - 1) * SHEET_STACK_T, 1e-4)
    }
    // Matching stripe maps for the stacks (same clock, same indices).
    const rightStripes = stackEdgeTextures.right[Math.min(Math.max(rightIdx, 0), SPREAD_MAX)]
    if (rightStripes && rightStackMaterial.map !== rightStripes) {
      rightStackMaterial.map = rightStripes
      rightStackMaterial.needsUpdate = true
    }
    const leftStripes = stackEdgeTextures.left[Math.min(Math.max(leftIdx, 0), SPREAD_MAX)]
    if (leftStripes && leftStackMaterial.map !== leftStripes) {
      leftStackMaterial.map = leftStripes
      leftStackMaterial.needsUpdate = true
    }
    // Page rim identity colors (round 6b): each open page's card edges wear
    // ITS page's tint; the flying sheet's rims wear the sheet it lifted as.
    rightRimMaterial.color.copy(pageEdgeTints[Math.min(Math.max(rightIdx, 0), SPREAD_MAX)])
    leftRimMaterial.color.copy(pageEdgeTints[Math.min(Math.max(leftIdx, 0), SPREAD_MAX)])
    if (f && !f.isCover) {
      sheetRimMaterial.color.copy(pageEdgeTints[f.dir === 'next' ? sp : Math.max(sp - 1, 0)])
    }

    const cover = frontCoverRef.current
    const outer = outerGroupRef.current
    if (!f || !f.isCover || !cover || !outer) return

    const eased = easeTurn(f.t)
    const openAmount = f.dir === 'next' ? eased : 1 - eased
    // Positive theta (not the naive -pi*eased mirror of the sheet angle):
    // FRONT_LOCAL_Y is positive (the cover mesh sits above its pivot at
    // rest), so a positive rotation swings it up through +Y first, arcing
    // over the spine like a real hinge. The opposite sign sends it straight
    // through the desk (verified: worldY dips to ~-0.52 at the midpoint,
    // well below the y=0 desk plane — invisible, not lifting).
    cover.rotation.z = f.dir === 'next' ? Math.PI * eased : Math.PI * (1 - eased)
    outer.position.x = CLOSED_CENTER_OFFSET_X * (1 - openAmount)
  })

  return (
    <group ref={outerGroupRef} position={[spread === 0 ? CLOSED_CENTER_OFFSET_X : 0, 0, 0]}>
      {/* Spine: a standing ridge along the hinge edge when closed; lies flat
          under the spread once open (real open books have no wall down the
          middle) — same footprint, just collapsed to cover thickness. */}
      <mesh position={[-0.02, spineHeight / 2, 0]} material={leatherMaterial}>
        <boxGeometry args={[0.05, spineHeight, BOOK.coverH]} />
      </mesh>

      {/* Gutter crease: soft dark shadow where the open pages meet the spine.
          renderOrder=-1 forces it into the transparent pass *before* every
          default-renderOrder transparent object (the pop-up layers and their
          shadows below) instead of relying on three's distance-based sort.
          That sort keys off each mesh's geometry bounding-sphere center,
          which for a wide, medium-depth strip like this one can end up
          judged "nearer" than a tall standing pop-up layer hinged deep on
          the page — flipping draw order so the crease (depthWrite: false,
          so it never occupies the depth buffer) painted over the layer
          instead of under it. Pinning the order guarantees the layers'
          alpha-tested cutouts always composite on top, wherever they cover
          the strip, while bare page still shows the crease beneath them. */}
      {isOpen && (
        <mesh
          position={[0, CREASE_Y, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          material={creaseMaterial}
          renderOrder={-1}
        >
          <planeGeometry args={[CREASE_WIDTH, BOOK.coverH]} />
        </mesh>
      )}

      {/* Back cover: fixed support board, always under the right-hand stack. */}
      <mesh position={[BOOK.coverW / 2, BACK_COVER_Y, 0]} material={leatherMaterial}>
        <boxGeometry args={[BOOK.coverW, BOOK.coverT, BOOK.coverH]} />
      </mesh>

      {/* Page stacks. CLOSED, all sheets lie flat on the right: one
          full-height box carrying the shut-book silhouette (the front
          cover's rest heights are keyed to it). OPEN, each side becomes a
          pedestal (endpapers/margins) plus a stack WEDGE climbing from the
          gutter valley to the fore-edge — a rigid tilted page cannot drape
          over a full box, and a real open stack IS this wedge. The wedges'
          y scale (sheets * SHEET_STACK_T) trades side to side per frame in
          the useFrame above, on the driver clock with the page tilts. */}
      {!spreadOpen ? (
        <mesh
          position={[BLOCK_WIDTH / 2, BACK_COVER_TOP + BOOK.blockMaxH / 2, 0]}
          material={closedBoxMaterials}
        >
          <boxGeometry args={[BLOCK_WIDTH, BOOK.blockMaxH, BLOCK_DEPTH]} />
        </mesh>
      ) : (
        <>
          <mesh
            position={[BLOCK_WIDTH / 2, BACK_COVER_TOP + STACK_PEDESTAL / 2, 0]}
            material={pedestalMaterial}
          >
            <boxGeometry args={[BLOCK_WIDTH, STACK_PEDESTAL, BLOCK_DEPTH]} />
          </mesh>
          <mesh
            ref={rightWedgeRef}
            position={[0, BACK_COVER_TOP + STACK_PEDESTAL, 0]}
            scale={[1, 1e-4, 1]}
            geometry={wedgeGeometry}
            material={rightStackMaterial}
          />
        </>
      )}

      {/* Left pedestal + wedge. Hidden for the whole duration of a cover
          turn — see isCoverTurning above — since a 'prev' cover turn would
          leave them floating once the cover lifts out from under them. */}
      {isOpen && !isCoverTurning && (
        <>
          <mesh
            position={[-BLOCK_WIDTH / 2, BACK_COVER_TOP + STACK_PEDESTAL / 2, 0]}
            material={pedestalMaterial}
          >
            <boxGeometry args={[BLOCK_WIDTH, STACK_PEDESTAL, BLOCK_DEPTH]} />
          </mesh>
          <mesh
            ref={leftWedgeRef}
            position={[0, BACK_COVER_TOP + STACK_PEDESTAL, 0]}
            scale={[-1, 1e-4, 1]}
            geometry={wedgeGeometry}
            material={leftStackMaterial}
          />
        </>
      )}

      {/* Static pages only exist once the book is open: closed, the mirrored
          left page's footprint (x in [-PAGE_W, 0]) sits outside the front
          cover entirely and would otherwise poke out past the spine. Both
          PLANES pass through the shared hinge line (PAGE_SURFACE_Y) and
          tilt up from it by their rest angles, set per frame in the
          useFrame above (rotation about the spine z axis; the mirrored
          left mesh takes -aL so its fore-edge rises on the -X side). */}
      {isOpen && (
        <group ref={rightPageRef} position={[0, PAGE_SURFACE_Y, 0]}>
          <mesh geometry={pageGeometry} material={rightPageMaterial} />
          {/* 1mm card body: rim ribbons hanging under the print surface
              (they fit inside the pageLift gap over the wedge), tinted per
              the page this card currently is (rim materials above). */}
          <mesh material={rightRimMaterial} position={[PAGE_W, -RIM_T / 2, 0]} rotation={[0, Math.PI / 2, 0]}>
            <planeGeometry args={[PAGE_H, RIM_T]} />
          </mesh>
          <mesh material={rightRimMaterial} position={[PAGE_W / 2, -RIM_T / 2, PAGE_H / 2]}>
            <planeGeometry args={[PAGE_W, RIM_T]} />
          </mesh>
          <mesh material={rightRimMaterial} position={[PAGE_W / 2, -RIM_T / 2, -PAGE_H / 2]} rotation={[0, Math.PI, 0]}>
            <planeGeometry args={[PAGE_W, RIM_T]} />
          </mesh>
        </group>
      )}

      {/* Static left page card, mirrored across the spine (the group's
          x-mirror flips the print mesh AND the rims together; rims are
          DoubleSide so the flipped winding can't cull them). Hidden for
          the whole duration of a cover turn (see isCoverTurning above) —
          the front cover is its support board only at rest, so revealing
          it any earlier than the turn's commit makes it appear to float
          past the book's edge, unsupported. */}
      {isOpen && !isCoverTurning && (
        <group ref={leftPageRef} position={[0, PAGE_SURFACE_Y, 0]} scale={[-1, 1, 1]}>
          <mesh geometry={pageGeometry} material={leftPageMaterial} />
          <mesh material={leftRimMaterial} position={[PAGE_W, -RIM_T / 2, 0]} rotation={[0, Math.PI / 2, 0]}>
            <planeGeometry args={[PAGE_H, RIM_T]} />
          </mesh>
          <mesh material={leftRimMaterial} position={[PAGE_W / 2, -RIM_T / 2, PAGE_H / 2]}>
            <planeGeometry args={[PAGE_W, RIM_T]} />
          </mesh>
          <mesh material={leftRimMaterial} position={[PAGE_W / 2, -RIM_T / 2, -PAGE_H / 2]} rotation={[0, Math.PI, 0]}>
            <planeGeometry args={[PAGE_W, RIM_T]} />
          </mesh>
        </group>
      )}

      {/* The page currently mid-turn; hidden except during a non-cover turn.
          Its two face materials live in this component (see sheetFront/
          sheetBackMaterial above) so their maps swap on the driver clock. */}
      <TurningPage
        frame={frame}
        committedSpread={committedSpread}
        originY={PAGE_SURFACE_Y}
        frontMaterial={sheetFrontMaterial}
        backMaterial={sheetBackMaterial}
        rimMaterial={sheetRimMaterial}
      />

      {/* Pop-up layers for the open spread: folded paper cutouts that spring
          up from the page. Mounted for spread ± 1 (see popupSpreadIndices
          above) to keep neighboring textures warm, but each PopupSpread
          only renders visibly while it's the current spread. */}
      {isOpen && (
        <group position={[0, POPUP_Y, 0]}>
          {popupSpreadIndices.map((i) => {
            const content = popupContentForSpread(i)
            if (!content) return null
            const role: PopupRole =
              turning === null
                ? i === spread
                  ? 'current'
                  : 'hidden'
                : i === spread
                  ? 'outgoing'
                  : i === incomingSpreadIndex
                    ? 'incoming'
                    : 'hidden'
            return (
              <PopupSpread
                key={i}
                layers={content.layers}
                accents={content.accents}
                spreadIndex={i}
                role={role}
                frame={frame}
                committedSpread={committedSpread}
              />
            )
          })}
        </group>
      )}

      {/* Front cover pivot: rotation.z rests at 0 (closed, on top) / PI
          (open, flat left); the turn driver takes over continuously
          in-between whenever a cover turn is in flight. */}
      <group ref={frontCoverRef} position={[0, FRONT_PIVOT_Y, 0]} rotation={[0, 0, spreadOpen ? Math.PI : 0]}>
        <mesh position={[BOOK.coverW / 2, FRONT_LOCAL_Y, 0]} material={leatherMaterial}>
          <boxGeometry args={[BOOK.coverW, BOOK.coverT, BOOK.coverH]} />
        </mesh>
        {/* Crest/corners/title — moves with the cover through the whole
            turn since it's mounted in the same pivot group as the box
            above (task 19). */}
        <CoverDecals coverTopY={FRONT_LOCAL_Y + BOOK.coverT / 2} />
      </group>
    </group>
  )
}
