'use client'

/**
 * The book assembly: spine, back cover, two page blocks, two static flat
 * pages, and the front cover pivot. World conventions (must match
 * page-geometry.ts): spine along Z at x=0, pages/covers extend toward +X
 * (the "right"/unread stack) with the mirrored twin toward -X (the
 * "left"/read stack), +Y up.
 *
 * Vertical stack when closed, bottom to top: desk -> back cover -> page
 * block -> front cover. The front cover pivots at the spine; Task 10 will
 * drive `rotation.z` continuously through the 0..PI turn. For now it snaps
 * per the spread's open/closed state.
 */

import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { useStorybookStore } from '../store'
import { SPREAD_COUNT } from '../content'
import { PAGE_H, PAGE_W, buildPageTemplate } from './page-geometry'
import { makeCreaseCanvas, makeLeatherCanvas, makePaperCanvas } from '../procedural/paper-texture'

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
// Closed book extends only toward +X from the spine (x=0), so it sits
// right of the HTML CTA's centerline; open, the two blocks/pages already
// straddle x=0 symmetrically. Shifting the whole assembly by -PAGE_W/2
// when closed centers it under the CTA without touching any local layout.
const CLOSED_CENTER_OFFSET_X = -PAGE_W / 2

function makeCanvasTexture(source: HTMLCanvasElement): THREE.CanvasTexture {
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

/** Closed burgundy tome that snaps to a flat two-page spread once `spread > 0`. */
export function Book() {
  const spread = useStorybookStore((s) => s.spread)
  const { paper, leather, crease } = useBookTextures()
  const pageGeometry = usePageGeometry()

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
  const creaseMaterial = useMemo(
    () => new THREE.MeshBasicMaterial({ map: crease, transparent: true, depthWrite: false }),
    [crease]
  )

  useEffect(
    () => () => {
      leatherMaterial.dispose()
      edgeMaterial.dispose()
      paperMaterial.dispose()
      creaseMaterial.dispose()
    },
    [leatherMaterial, edgeMaterial, paperMaterial, creaseMaterial]
  )

  const isOpen = spread > 0
  const rightHeight = BOOK.blockMaxH * (1 - spread / SPREAD_MAX)
  const leftHeight = BOOK.blockMaxH * (spread / SPREAD_MAX)
  const spineHeight = isOpen ? SPINE_FLAT_HEIGHT : SPINE_HEIGHT

  return (
    <group position={[spread === 0 ? CLOSED_CENTER_OFFSET_X : 0, 0, 0]}>
      {/* Spine: a standing ridge along the hinge edge when closed; lies flat
          under the spread once open (real open books have no wall down the
          middle) — same footprint, just collapsed to cover thickness. */}
      <mesh position={[-0.02, spineHeight / 2, 0]} material={leatherMaterial}>
        <boxGeometry args={[0.05, spineHeight, BOOK.coverH]} />
      </mesh>

      {/* Gutter crease: soft dark shadow where the open pages meet the spine. */}
      {isOpen && (
        <mesh position={[0, CREASE_Y, 0]} rotation={[-Math.PI / 2, 0, 0]} material={creaseMaterial}>
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

      {/* Left page block: nonexistent at spread 0 (a zero-height box still
          renders coincident top/bottom faces, so it's skipped entirely
          rather than shrunk to zero), grows once the book is open. */}
      {isOpen && (
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
        <>
          {/* Static right page (no curl) resting on the right block. */}
          <mesh
            position={[0, BACK_COVER_TOP + rightHeight + BOOK.pageLift, 0]}
            geometry={pageGeometry}
            material={paperMaterial}
          />

          {/* Static left page, mirrored across the spine. */}
          <mesh
            position={[0, BACK_COVER_TOP + leftHeight + BOOK.pageLift, 0]}
            scale={[-1, 1, 1]}
            geometry={pageGeometry}
            material={paperMaterial}
          />
        </>
      )}

      {/* Front cover pivot: rotation.z snaps 0 (closed, on top) -> PI (open,
          flat left). Task 10 drives this continuously during the turn. */}
      <group position={[0, FRONT_PIVOT_Y, 0]} rotation={[0, 0, isOpen ? Math.PI : 0]}>
        <mesh position={[BOOK.coverW / 2, FRONT_LOCAL_Y, 0]} material={leatherMaterial}>
          <boxGeometry args={[BOOK.coverW, BOOK.coverT, BOOK.coverH]} />
        </mesh>
      </group>
    </group>
  )
}
