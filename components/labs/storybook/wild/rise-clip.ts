/**
 * WILD lane — the page-surface floor.
 *
 * This plane used to BE the curtain-up: the whole mass translated up from -MASS_APEX_Y and the
 * plane hid whatever was still buried, so the inn grew out of the paper. The inn now ERECTS
 * instead (wild/fold-birth.ts) and nothing is ever buried — but the plane stays, doing the job
 * it was always quietly doing as well: it is the hard floor that guarantees no fold, no barge
 * board and no shadow can ever show BENEATH the page it is folding on.
 *
 * The plane is a module singleton on purpose: three compares clipping planes by identity when
 * it builds programs, so every material sharing this one instance shares a shader variant.
 * Set its height once from the diorama's world transform; never allocate a second plane.
 */
import * as THREE from 'three'

/** Keeps the half-space above the page surface (normal.dot(p) + constant > 0). */
export const RISE_CLIP = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)

export const RISE_CLIP_PLANES = [RISE_CLIP]

/**
 * Point the clip at the real page surface. Called once by the diorama root with the world y of
 * its own group, because <PopupSpread> sits at POPUP_Y and clipping planes are world-space.
 */
export function setRiseClipHeight(worldY: number): void {
  RISE_CLIP.constant = -worldY
}

/**
 * Opt a material into the reveal. Also enables `clipShadows` so the moon's shadow of the
 * still-buried part of the building does not appear on the cobbles before the building does.
 */
export function applyRiseClip<T extends THREE.Material>(material: T): T {
  material.clippingPlanes = RISE_CLIP_PLANES
  material.clipShadows = true
  return material
}
