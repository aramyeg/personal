/**
 * THE HIT LAW (E3 fix lane): the region that shows a `grab` cursor and the
 * region where a press engages must be the SAME region.
 *
 * Measured on the live page before this landed (history-free settled probe,
 * .superpowers/sdd/bench/probe-hit-truth.mjs):
 *   y=590  ...ooooGGGGxx
 *   y=605  ..xxGGGGxxxxx
 * — 'x' = the cursor said grab and the press was discarded, 'o' = the press
 * engaged with no cursor at all. Both directions of the disagreement, on a
 * handle the reviewers reported as WORKING.
 */

import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import type { ThreeEvent } from '@react-three/fiber'
import {
  HANDLE_SLOP_FLAT,
  HANDLE_SLOP_STANDING,
  acceptsHandleHit,
} from '@/components/labs/storybook/book/handle-hit'
import { sharedHandleMaterial } from '@/components/labs/storybook/book/shared-procedural-textures'

const exactMesh = new THREE.Mesh()
const slopMesh = new THREE.Mesh()
const group = new THREE.Group()
group.add(exactMesh, slopMesh)

type Hit = { object: THREE.Object3D; eventObject: THREE.Object3D }

const evt = (object: THREE.Object3D, intersections: Hit[], pointerType = 'mouse'): ThreeEvent<PointerEvent> =>
  ({ object, eventObject: group, intersections, pointerType } as unknown as ThreeEvent<PointerEvent>)

const onExact: Hit = { object: exactMesh, eventObject: group }
const onSlop: Hit = { object: slopMesh, eventObject: group }

describe('acceptsHandleHit — one hit law for every handle family', () => {
  for (const pointerType of ['mouse', 'pen', 'touch']) {
    it(`accepts the exact die-cut for a ${pointerType} pointer`, () => {
      expect(acceptsHandleHit(evt(exactMesh, [onExact, onSlop], pointerType), slopMesh)).toBe(true)
    })

    it(`accepts a slop-only hit for a ${pointerType} pointer (the old rule dropped mouse presses)`, () => {
      expect(acceptsHandleHit(evt(slopMesh, [onSlop], pointerType), slopMesh)).toBe(true)
    })

    it(`defers the slop to the exact die-cut when both are under a ${pointerType} pointer`, () => {
      expect(acceptsHandleHit(evt(slopMesh, [onExact, onSlop], pointerType), slopMesh)).toBe(false)
    })
  }

  it('accepts everything when the family has no slop surface', () => {
    expect(acceptsHandleHit(evt(exactMesh, [onExact]), null)).toBe(true)
  })

  it('does NOT defer to scenery that shares the handle group', () => {
    // E3 s7 round-2 (S7R2-3). A lift flap's group is [board, door, door back,
    // slop] and a volvelle's is [dial, card, slop]; the board and the card take
    // no grab. Deferring to them meant the slop pad was rejected everywhere the
    // scenery lay under the pointer — which is everywhere inside the piece — so
    // an open door, whose own quad has swung off the pixels the reader presses,
    // could not be shut. Measured live: 27 grabbable cells shut, zero at 95 deg.
    const board = new THREE.Mesh()
    board.userData = { handleInert: true }
    group.add(board)
    const e = evt(slopMesh, [{ object: board, eventObject: group }, onSlop])
    expect(acceptsHandleHit(e, slopMesh)).toBe(true)
    // and the exact die-cut still wins when it is genuinely under the pointer
    expect(
      acceptsHandleHit(evt(slopMesh, [{ object: board, eventObject: group }, onExact, onSlop]), slopMesh)
    ).toBe(false)
    group.remove(board)
  })

  it('ignores hits that belong to a different handle', () => {
    const other = new THREE.Mesh()
    const otherGroup = new THREE.Group()
    otherGroup.add(other)
    // A neighbouring handle under the pointer must not make this slop defer to
    // nothing (the exact surface of ANOTHER piece is not ours to yield to).
    const e = evt(slopMesh, [{ object: other, eventObject: otherGroup }, onSlop])
    expect(acceptsHandleHit(e, slopMesh)).toBe(true)
  })

  it('pads a page-flat handle harder than a standing one', () => {
    // Page-flat die-cuts foreshorten to slivers at the ~27deg reading camera
    // (the STIR tab measured 55x22 screen px); a standing flap presents its
    // full area, so it needs less.
    expect(HANDLE_SLOP_FLAT).toBeGreaterThan(HANDLE_SLOP_STANDING)
    expect(HANDLE_SLOP_STANDING).toBeGreaterThan(1)
  })
})

describe('the raycast sentinel material', () => {
  it('is double-sided, so a handle quad wound away from the camera is still hittable', () => {
    // three's raycaster honours material.side. With the default FrontSide,
    // every LEFT-page page-flat handle (side-aware z winding) was unhittable —
    // a whole class of "the cursor says grab and the press does nothing".
    expect(sharedHandleMaterial().side).toBe(THREE.DoubleSide)
    expect(sharedHandleMaterial().visible).toBe(false)
  })
})
