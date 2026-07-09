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
import { makeLeatherCanvas, makePaperCanvas } from '../procedural/paper-texture'

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

function makeCanvasTexture(source: HTMLCanvasElement): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(source)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  return texture
}

/** Builds the two procedural CanvasTextures once per mount and disposes them on unmount. */
function useBookTextures(): { paper: THREE.CanvasTexture; leather: THREE.CanvasTexture } {
  const paperCanvas = useMemo(() => makePaperCanvas(), [])
  const leatherCanvas = useMemo(() => makeLeatherCanvas(), [])
  const paper = useMemo(() => makeCanvasTexture(paperCanvas), [paperCanvas])
  const leather = useMemo(() => makeCanvasTexture(leatherCanvas), [leatherCanvas])

  useEffect(
    () => () => {
      paper.dispose()
      leather.dispose()
    },
    [paper, leather]
  )

  return { paper, leather }
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
  const { paper, leather } = useBookTextures()
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

  useEffect(
    () => () => {
      leatherMaterial.dispose()
      edgeMaterial.dispose()
      paperMaterial.dispose()
    },
    [leatherMaterial, edgeMaterial, paperMaterial]
  )

  const isOpen = spread > 0
  const rightHeight = BOOK.blockMaxH * (1 - spread / SPREAD_MAX)
  const leftHeight = BOOK.blockMaxH * (spread / SPREAD_MAX)

  return (
    <group>
      {/* Spine ridge: static, always visible along the hinge edge. */}
      <mesh position={[-0.02, SPINE_HEIGHT / 2, 0]} material={leatherMaterial}>
        <boxGeometry args={[0.05, SPINE_HEIGHT, BOOK.coverH]} />
      </mesh>

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
