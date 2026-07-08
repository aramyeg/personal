/**
 * The mountain master curve. World coords: x increases in the direction of
 * travel, y increases DOWNWARD (canvas convention) — a descending slope has
 * positive gradient. A base grade plus one long pumpable roller and a gentle
 * secondary texture gives momentum-friendly terrain that never tips uphill.
 */
export const RHYTHM = {
  BASE_GRADE: 0.38,
  /** primary rollers — the pumpable build/launch/land tempo */
  PRIMARY: { amp: 110, wavelength: 520 },
  /** secondary texture — keeps lines from feeling synthetic */
  SECONDARY: { amp: 22, wavelength: 173, phase: 2.1 },
} as const

// Gradient bounds (guaranteed regardless of phase alignment):
//   downhill max: 0.38 + 110/520 + 22/173 ≈ 0.72  (< 0.75, rideable)
//   flattest:     0.38 − 110/520 − 22/173 ≈ 0.04  (> 0, always descending)

export function slopeY(x: number): number {
  return (
    RHYTHM.BASE_GRADE * x +
    RHYTHM.PRIMARY.amp * Math.sin(x / RHYTHM.PRIMARY.wavelength) +
    RHYTHM.SECONDARY.amp * Math.sin(x / RHYTHM.SECONDARY.wavelength + RHYTHM.SECONDARY.phase)
  )
}

export function slopeGradient(x: number): number {
  return (
    RHYTHM.BASE_GRADE +
    (RHYTHM.PRIMARY.amp / RHYTHM.PRIMARY.wavelength) *
      Math.cos(x / RHYTHM.PRIMARY.wavelength) +
    (RHYTHM.SECONDARY.amp / RHYTHM.SECONDARY.wavelength) *
      Math.cos(x / RHYTHM.SECONDARY.wavelength + RHYTHM.SECONDARY.phase)
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
