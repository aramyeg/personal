/** The lab's single tuning surface — gates tune here, nowhere else. */
export const PSX = {
  LOW_W: 384,
  LOW_H: 216,
  SNAP_W: 320,
  SNAP_H: 180,
  FPS: 30,
  /** Rotating-cube speed (rad/s) for the temporary GATE-A proof scene only. */
  PROOF_CUBE_SPIN: 0.35,
  /**
   * The room light rig (overcast neutral key + teal-leaning ambient fill).
   * Scenes consume these — never hardcode light colors/intensities in a
   * component. Ambient runs hot so shadow sides stay readable teal, never
   * grey-black (tone law).
   */
  LIGHTS: {
    key: '#e8e6e0',
    keyIntensity: 3.7,
    ambient: '#4d5f5a',
    ambientIntensity: 5.8,
  },
  TEX: {
    wall: '#b3ac9b',
    wallShade: '#968f7e',
    plywood: '#a8895f',
    plywoodDark: '#816545',
    carpet: '#7e8272',
    carpetDark: '#646859',
    concrete: '#9b9d97',
    shadowTeal: '#3d5450',
    crtTeal: '#7de8e0',
    crtTealDark: '#2e6b66',
    accentOrange: '#d96b2f',
    accentYellow: '#d9b23a',
    accentRed: '#b8402e',
    accentBlue: '#3e6fb8',
    /** Window view's dull-yellow lit-window accent — its only warm note. */
    litWindow: '#c9a94e',
  },
} as const
