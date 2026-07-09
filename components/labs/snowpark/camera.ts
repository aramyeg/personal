import { PHYS, type RiderState } from './rider'
import { slopeAngle } from './slope'

/**
 * The camera is a speed instrument, not a window: it leads the rider by a slice
 * of current velocity, zooms out the faster you go so speed reads as widening
 * peripheral view, and hangs softer at an air apex so hero moments breathe.
 * Pure math — the renderer owns pixels, this owns intent.
 */
export const CAM = {
  /** rider screen anchor as viewport fractions */
  ANCHOR_X: 0.35,
  ANCHOR_Y: 0.45,
  /** zoom 1 at MIN_SPEED shrinking to ZOOM_FAR at MAX_SPEED (wider view) */
  ZOOM_FAR: 0.74,
  /** camera leads travel by LEAD_S seconds of current velocity, clamped */
  LEAD_S: 0.35,
  LEAD_MAX: 260,
  /** follow stiffness (1/s); APEX_STIFF applies when airborne and |vy| < APEX_VY */
  STIFF: 6,
  APEX_STIFF: 2.2,
  APEX_VY: 80,
  SHAKE_DECAY: 8,
  SHAKE_FREQ: 37,
} as const

export type CameraState = {
  x: number
  y: number
  zoom: number
  shakeMag: number
  shakeT: number
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}

/** Airborne is the only mode with meaningful vx/vy; snow & grind ride the surface. */
function airborne(rider: RiderState): boolean {
  return rider.mode === 'air'
}

/** Horizontal velocity used to lead the camera — real vx aloft, slope-projected speed on snow. */
function leadVelocity(rider: RiderState): number {
  return airborne(rider) ? rider.vx : Math.cos(slopeAngle(rider.x)) * rider.speed
}

/** Where the camera wants to sit this frame (rider position plus a velocity lead). */
function targetX(rider: RiderState): number {
  return rider.x + clamp(leadVelocity(rider) * CAM.LEAD_S, -CAM.LEAD_MAX, CAM.LEAD_MAX)
}

/** Speed feeding the zoom — airborne uses full velocity magnitude, else along-slope speed. */
function zoomSpeed(rider: RiderState): number {
  return airborne(rider) ? Math.hypot(rider.vx, rider.vy) : rider.speed
}

/** Zoom target: 1 at MIN_SPEED widening to ZOOM_FAR at MAX_SPEED. */
function targetZoom(rider: RiderState): number {
  const span = PHYS.MAX_SPEED - PHYS.MIN_SPEED
  const speed01 = clamp((zoomSpeed(rider) - PHYS.MIN_SPEED) / span, 0, 1)
  return 1 + (CAM.ZOOM_FAR - 1) * speed01
}

/** Frame-rate-independent ease factor for a given stiffness. */
function ease(stiff: number, dt: number): number {
  return 1 - Math.exp(-stiff * dt)
}

export function createCamera(rider: RiderState): CameraState {
  return {
    x: targetX(rider),
    y: rider.y,
    zoom: targetZoom(rider),
    shakeMag: 0,
    shakeT: 0,
  }
}

export function updateCamera(cam: CameraState, rider: RiderState, dt: number): CameraState {
  // Softer follow near an air apex so the peak of a jump hangs on screen.
  const atApex = airborne(rider) && Math.abs(rider.vy) < CAM.APEX_VY
  const kPos = ease(atApex ? CAM.APEX_STIFF : CAM.STIFF, dt)
  const kZoom = ease(CAM.STIFF, dt)

  const tx = targetX(rider)
  const tz = targetZoom(rider)
  return {
    x: cam.x + kPos * (tx - cam.x),
    y: cam.y + kPos * (rider.y - cam.y),
    zoom: cam.zoom + kZoom * (tz - cam.zoom),
    shakeMag: cam.shakeMag * Math.exp(-CAM.SHAKE_DECAY * dt),
    shakeT: cam.shakeT + dt,
  }
}

/** Kick the camera with an impulse; keeps the stronger of any in-flight shake and resets phase. */
export function addShake(cam: CameraState, mag: number): CameraState {
  return { ...cam, shakeMag: Math.max(cam.shakeMag, mag), shakeT: 0 }
}

/** Deterministic per-frame shake displacement — same state in, same offset out. */
export function shakeOffset(cam: CameraState): { x: number; y: number } {
  return {
    x: cam.shakeMag * Math.sin(cam.shakeT * CAM.SHAKE_FREQ),
    y: cam.shakeMag * Math.cos(cam.shakeT * CAM.SHAKE_FREQ * 1.3),
  }
}
