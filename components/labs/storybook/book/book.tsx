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
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useStorybookStore } from '../store'
import { SPREAD_COUNT, popupContentForSpread } from '../content'
import { PAGE_H, PAGE_W, buildPageTemplate, easeTurn } from './page-geometry'
import { makeCreaseCanvas, makeLeatherCanvas, makePaperCanvas } from '../procedural/paper-texture'
import { isCoverTurn, useTurnDriver } from './use-turn-driver'
import { TurningPage } from './turning-page'
import { PopupSpread, type PopupRole } from './popup-spread'
import { CoverDecals } from './cover-decals'
import { useSpreadPrints } from './use-page-print'

export const BOOK = {
  coverW: 1.22,
  coverH: 1.58,
  coverT: 0.035,
  blockMaxH: 0.11,
  pageLift: 0.005,
} as const

const SPREAD_MAX = SPREAD_COUNT - 1
const EDGE_COLOR = '#d8c491'
const BLOCK_WIDTH = PAGE_W * 0.98
const BLOCK_DEPTH = PAGE_H * 0.98

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
// The ONE hinge plane everything paper shares: both static page surfaces,
// the turning sheet's pivot, and the pop-up mechanisms' wedge floor. The
// pop-up physics demands this (see popup-mechanics.ts): the sheet and the
// paper glued to it hinge on the same line, so an outgoing scene folds
// EXACTLY into the closing wedge under the sheet — pieces can never poke
// through the page that is pressing them flat. (Previously pages sat at
// per-stack heights while pop-ups anchored at the block top: pieces
// floated ~0.05 above their pages at rest and pierced the sheet mid-turn.)
const PAGE_SURFACE_Y = BACK_COVER_TOP + BOOK.blockMaxH + BOOK.pageLift
// Gutter crease: the valley strip laid flat over the seam where the open
// pages meet, just above the page surfaces. Widened with the round-4
// gutter valley (paper-texture.ts makeCreaseCanvas): the concave falloff,
// curl highlights, and folded-edge hairlines need the span to read as a
// fold holding paper rather than a printed stripe.
const CREASE_WIDTH = 0.16
const CREASE_Y = PAGE_SURFACE_Y + 0.001
// Pop-up layers: a hair above the crease strip, effectively ON the page.
const POPUP_Y = PAGE_SURFACE_Y + 0.0015
// Closed book extends only toward +X from the spine (x=0), so it sits
// right of the HTML CTA's centerline; open, the two blocks/pages already
// straddle x=0 symmetrically. Shifting the whole assembly by -PAGE_W/2
// when closed centers it under the CTA without touching any local layout.
const CLOSED_CENTER_OFFSET_X = -PAGE_W / 2

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

/** Flat page BufferGeometry shared by both static pages (built once, disposed on unmount). */
function usePageGeometry(): THREE.BufferGeometry {
  const geometry = useMemo(() => {
    const { positions, uvs, indices } = buildPageTemplate()
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

/** Open burgundy tome, its front cover and centering offset animated live by
 * the turn driver instead of snapping between the closed/open poses. */
export function Book() {
  const spread = useStorybookStore((s) => s.spread)
  const turning = useStorybookStore((s) => s.turning)
  const { paper, leather, crease } = useBookTextures()
  const pageGeometry = usePageGeometry()
  const { frame, committedSpread } = useTurnDriver()
  const outerGroupRef = useRef<THREE.Group>(null)
  const frontCoverRef = useRef<THREE.Group>(null)

  const leatherMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ map: leather, roughness: 0.55 }),
    [leather]
  )
  const edgeMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: EDGE_COLOR, roughness: 0.85 }),
    []
  )
  const paperMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ map: paper, roughness: 0.9, side: THREE.DoubleSide }),
    [paper]
  )
  // v2 printed page faces: each static page shows its half of the current
  // spread's full-bleed print (user art `page-<n>.webp`, else the procedural
  // print). During a turn the exposed side pre-swaps to the incoming
  // spread's print — the page the lifting sheet reveals underneath.
  const leftPageMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ map: paper, roughness: 0.9, side: THREE.DoubleSide }),
    [paper]
  )
  const rightPageMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ map: paper, roughness: 0.9, side: THREE.DoubleSide }),
    [paper]
  )
  const creaseMaterial = useMemo(
    () => new THREE.MeshBasicMaterial({ map: crease, transparent: true, depthWrite: false }),
    [crease]
  )

  useEffect(
    () => () => {
      leatherMaterial.dispose()
      edgeMaterial.dispose()
      paperMaterial.dispose()
      leftPageMaterial.dispose()
      rightPageMaterial.dispose()
      creaseMaterial.dispose()
    },
    [leatherMaterial, edgeMaterial, paperMaterial, leftPageMaterial, rightPageMaterial, creaseMaterial]
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

  // Current spread ± 1 with actual pop-up content, so neighboring layer
  // textures are already warm by the time you turn to them (see
  // popup-spread.tsx's file header) — only `spread` itself ever renders
  // visibly, the neighbors stay hidden until it's their turn.
  const popupSpreadIndices = useMemo(
    () =>
      [spread - 1, spread, spread + 1].filter(
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

  // Printed page faces for the current spread ± 1 (indices 1..SPREAD_MAX —
  // spread 0 is the closed cover, no pages visible).
  const printIndices = useMemo(
    () => [spread - 1, spread, spread + 1].filter((i) => i >= 1 && i <= SPREAD_MAX),
    [spread]
  )
  const prints = useSpreadPrints(printIndices)
  // The half each static page shows — at rest the current spread's own halves,
  // during a turn the exposed side pre-swapped to the incoming spread — is set
  // in the useFrame below, NOT here. It has to run on the SAME per-frame clock
  // as the turning sheet's visibility (the driver refs), or it desyncs: read on
  // React's render clock, `turning` arms a frame or two AFTER the driver at a
  // turn's start, and `spread` commits a frame or two AFTER the sheet hides at
  // its end. Either gap paints a print onto the bare static page while the
  // sheet isn't covering it — the right-page turn flash. Driving both the
  // direction and the spread off the driver refs keeps every swap atomic with
  // the sheet. The mid-turn sheet's own two faces stay on the render clock
  // below: they're only ever seen ON the sheet, never on the bare page.
  // The mid-turn sheet's two faces: what it was showing when it lifted, and
  // what it lands as (see turning-page.tsx for the uv orientations).
  const turnFrontMap = turning
    ? (turning === 'next' ? prints[spread]?.right : prints[spread - 1]?.right) ?? null
    : null
  const turnBackMap = turning
    ? (turning === 'next' ? prints[spread + 1]?.left : prints[spread]?.left) ?? null
    : null

  useFrame(() => {
    const f = frame.current
    // Static page prints, swapped here (frame loop) rather than in a React
    // effect — see the printIndices note above for the flash this prevents.
    // Both the turn's direction (f.dir) and the committed spread come off the
    // driver's refs, the SAME clock the turning sheet's visibility runs on, so
    // every swap — the incoming half revealed as the sheet lifts at the start,
    // and the landing half committed as the sheet hides at the end — lands on
    // the exact frame the sheet covers it. (A React-clock `turning`/`spread`
    // ran a frame or two out of step with the sheet, baring the wrong print.)
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

      {/* Page blocks: constant full-height stacks under the shared page
          surface plane (PAGE_SURFACE_Y). Real stacks would trade thickness
          side to side as you read, but the paper physics needs every sheet
          hinging on ONE line — the thick-tome look keeps the fore-edges
          filled at all times. */}
      <mesh
        position={[BLOCK_WIDTH / 2, BACK_COVER_TOP + BOOK.blockMaxH / 2, 0]}
        material={edgeMaterial}
      >
        <boxGeometry args={[BLOCK_WIDTH, BOOK.blockMaxH, BLOCK_DEPTH]} />
      </mesh>

      {/* Left page block. Hidden for the whole duration of a cover turn —
          see isCoverTurning above — since a 'prev' cover turn would leave
          it floating once the cover lifts out from under it. */}
      {isOpen && !isCoverTurning && (
        <mesh
          position={[-BLOCK_WIDTH / 2, BACK_COVER_TOP + BOOK.blockMaxH / 2, 0]}
          material={edgeMaterial}
        >
          <boxGeometry args={[BLOCK_WIDTH, BOOK.blockMaxH, BLOCK_DEPTH]} />
        </mesh>
      )}

      {/* Static pages only exist once the book is open: closed, the mirrored
          left page's footprint (x in [-PAGE_W, 0]) sits outside the front
          cover entirely and would otherwise poke out past the spine. Both
          lie in the shared hinge plane (see PAGE_SURFACE_Y). */}
      {isOpen && (
        <mesh position={[0, PAGE_SURFACE_Y, 0]} geometry={pageGeometry} material={rightPageMaterial} />
      )}

      {/* Static left page, mirrored across the spine. Hidden for the whole
          duration of a cover turn (see isCoverTurning above) — the front
          cover is its support board only at rest, so revealing it any
          earlier than the turn's commit makes it appear to float past the
          book's edge, unsupported. */}
      {isOpen && !isCoverTurning && (
        <mesh
          position={[0, PAGE_SURFACE_Y, 0]}
          scale={[-1, 1, 1]}
          geometry={pageGeometry}
          material={leftPageMaterial}
        />
      )}

      {/* The page currently mid-turn; hidden except during a non-cover turn. */}
      <TurningPage frame={frame} originY={PAGE_SURFACE_Y} frontMap={turnFrontMap} backMap={turnBackMap} />

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
