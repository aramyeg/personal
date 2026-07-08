/**
 * The mountain master curve. World coords: x increases in the direction of
 * travel, y increases DOWNWARD (canvas convention) — a descending slope has
 * positive gradient. One base grade plus two long sine waves gives rolling
 * terrain without ever tipping past vertical.
 */
const BASE_GRADE = 0.32
const WAVE_A = { amp: 60, wavelength: 210 }
const WAVE_B = { amp: 30, wavelength: 97, phase: 1.7 }

export function slopeY(x: number): number {
  return (
    BASE_GRADE * x +
    WAVE_A.amp * Math.sin(x / WAVE_A.wavelength) +
    WAVE_B.amp * Math.sin(x / WAVE_B.wavelength + WAVE_B.phase)
  )
}

export function slopeGradient(x: number): number {
  return (
    BASE_GRADE +
    (WAVE_A.amp / WAVE_A.wavelength) * Math.cos(x / WAVE_A.wavelength) +
    (WAVE_B.amp / WAVE_B.wavelength) * Math.cos(x / WAVE_B.wavelength + WAVE_B.phase)
  )
}

/** Tangent angle in radians; positive tilts downhill (screen-down). */
export function slopeAngle(x: number): number {
  return Math.atan(slopeGradient(x))
}

/** Advance a distance ds along the curve from x; returns the new x. */
export function advanceAlongSlope(x: number, ds: number): number {
  return x + ds * Math.cos(slopeAngle(x))
}
