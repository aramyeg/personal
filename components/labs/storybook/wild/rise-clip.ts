/**
 * WILD lane — the curtain-up clip.
 *
 * The inn does not unfold; it RISES out of the paper. The whole built mass translates up from
 * -MASS_APEX_Y to 0 across REVEAL.rise while this world-space plane hides everything still
 * below the page surface, so the building appears to grow out of the page.
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
