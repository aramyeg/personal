'use client'

/**
 * Module-level singleton textures/materials for the popup layers (E-G4 fix
 * wave, root cause #1 continued): several procedural canvases are drawn
 * with ZERO per-instance parameters — `makeShadowCanvas`, `makeTabGripCanvas`,
 * `makeRotorCanvas` and `makeKnobCanvas` take no layer-specific input and
 * contain no `Math.random()` (verified against paper-texture.ts) — so every
 * layer that called `useMemo(() => makeCanvasTexture(makeXCanvas()), [])`
 * was uploading and holding an independent GPU copy of pixel-identical
 * output. Sharing one instance is bit-for-bit the same render.
 *
 * `makePaperCanvas` DOES carry per-pixel `Math.random()` grain, so a shared
 * instance is a fixed (not independently re-rolled per piece) grain pattern
 * — but book.tsx already shares ONE `paper` canvas across every static page,
 * the stack blocks and the turning sheet (by far the most prominent, best-
 * lit surfaces in the scene), so sharing it for the popup layers' small,
 * shadowed BackSide interior faces follows the same established precedent
 * rather than introducing a new one.
 *
 * Loaded lazily (not at module top level) since these call into
 * `document.createElement('canvas')` via `assertBrowser`, which throws
 * during SSR; every export here is a getter so importing this module stays
 * safe on the server and the canvas work only happens on first client use.
 */

import * as THREE from 'three'
import {
  makeKnobCanvas,
  makePaperCanvas,
  makeRotorCanvas,
  makeShadowCanvas,
  makeTabGripCanvas,
} from '../procedural/paper-texture'
import { makeCanvasTexture } from './book'

function lazySingleton<T>(build: () => T): () => T {
  let value: T | undefined
  return () => {
    value ??= build()
    return value
  }
}

export const sharedPaperTexture = lazySingleton(() => makeCanvasTexture(makePaperCanvas(256, 256)))
export const sharedShadowTexture = lazySingleton(() => makeCanvasTexture(makeShadowCanvas()))
export const sharedTabGripTexture = lazySingleton(() => makeCanvasTexture(makeTabGripCanvas()))
export const sharedRotorTexture = lazySingleton(() => makeCanvasTexture(makeRotorCanvas(256, 256)))
export const sharedKnobTexture = lazySingleton(() => makeCanvasTexture(makeKnobCanvas(256, 256)))

/** The invisible touch-slop / raycast-only sentinel (`visible: false`, no
 *  map, never mutated) that every grabbable layer used to allocate its own
 *  copy of. One instance, shared and never disposed — same lifetime as the
 *  module, like the other singletons above. */
export const sharedHandleMaterial = lazySingleton(() => new THREE.MeshBasicMaterial({ visible: false }))
