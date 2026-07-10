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
// Gutter crease: a narrow dark-transparent-gradient strip laid flat over
// the seam where the open pages meet, sitting just above the taller of
// the two page blocks so it never z-fights with either page.
const CREASE_WIDTH = 0.1
const CREASE_Y = BACK_COVER_TOP + BOOK.blockMaxH + BOOK.pageLift + 0.001
// Pop-up layers sit just above the crease, at the height of the taller
// stack — always the very top of the open block regardless of `spread`
// (rightHeight + leftHeight is constant), so the illustration never steps
// down to match whichever page is momentarily shorter.
const POPUP_Y = CREASE_Y + 0.004
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
  const frame = useTurnDriver()
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
  const rightHeight = BOOK.blockMaxH * (1 - spread / SPREAD_MAX)
  const leftHeight = BOOK.blockMaxH * (spread / SPREAD_MAX)
  const spineHeight = spreadOpen ? SPINE_FLAT_HEIGHT : SPINE_HEIGHT
  // The turning page's resting height: wherever it's departing from (the
  // right stack for a 'next' turn, the left stack for 'prev'), matching the
  // static pages' own height formula below exactly.
  const turnOriginY = BACK_COVER_TOP + (turning === 'prev' ? leftHeight : rightHeight) + BOOK.pageLift

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
  // The half each static page shows: at rest, the current spread's own
  // halves; during a turn, the side the lifting sheet exposes pre-swaps to
  // the incoming spread (the turning sheet's own faces cover the seam — its
  // landing face is the same image the static page switches to at commit).
  const leftPrintIndex = turning === 'prev' ? spread - 1 : spread
  const rightPrintIndex = turning === 'next' ? spread + 1 : spread
  useEffect(() => {
    const left = prints[leftPrintIndex]?.left ?? paper
    if (leftPageMaterial.map !== left) {
      leftPageMaterial.map = left
      leftPageMaterial.needsUpdate = true
    }
    const right = prints[rightPrintIndex]?.right ?? paper
    if (rightPageMaterial.map !== right) {
      rightPageMaterial.map = right
      rightPageMaterial.needsUpdate = true
    }
  }, [prints, leftPrintIndex, rightPrintIndex, leftPageMaterial, rightPageMaterial, paper])
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

      {/* Right page block: full at spread 0, shrinks toward the spine as pages "turn". */}
      <mesh
        position={[BLOCK_WIDTH / 2, BACK_COVER_TOP + rightHeight / 2, 0]}
        material={edgeMaterial}
      >
        <boxGeometry args={[BLOCK_WIDTH, rightHeight, BLOCK_DEPTH]} />
      </mesh>

      {/* Left page block: nonexistent at spread 0 or mid-cover-turn (a
          zero-height box still renders coincident top/bottom faces, so it's
          skipped entirely rather than shrunk to zero), grows once a page has
          actually turned. Also hidden for the whole duration of a cover
          turn — see isCoverTurning above — since a 'prev' cover turn starts
          with leftHeight > 0 (spread is still 1 until commit) and would
          otherwise float once the cover lifts out from under it. */}
      {isOpen && leftHeight > 0 && !isCoverTurning && (
        <mesh
          position={[-BLOCK_WIDTH / 2, BACK_COVER_TOP + leftHeight / 2, 0]}
          material={edgeMaterial}
        >
          <boxGeometry args={[BLOCK_WIDTH, leftHeight, BLOCK_DEPTH]} />
        </mesh>
      )}

      {/* Static pages only exist once the book is open: closed, the mirrored
          left page's footprint (x in [-PAGE_W, 0]) sits outside the front
          cover entirely and would otherwise poke out past the spine. */}
      {isOpen && (
        <mesh
          position={[0, BACK_COVER_TOP + rightHeight + BOOK.pageLift, 0]}
          geometry={pageGeometry}
          material={rightPageMaterial}
        />
      )}

      {/* Static left page, mirrored across the spine. Hidden for the whole
          duration of a cover turn (see isCoverTurning above) — the front
          cover is its support board only at rest, so revealing it any
          earlier than the turn's commit makes it appear to float past the
          book's edge, unsupported. */}
      {isOpen && !isCoverTurning && (
        <mesh
          position={[0, BACK_COVER_TOP + leftHeight + BOOK.pageLift, 0]}
          scale={[-1, 1, 1]}
          geometry={pageGeometry}
          material={leftPageMaterial}
        />
      )}

      {/* The page currently mid-turn; hidden except during a non-cover turn. */}
      <TurningPage frame={frame} originY={turnOriginY} frontMap={turnFrontMap} backMap={turnBackMap} />

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
