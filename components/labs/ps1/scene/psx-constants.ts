/** The lab's single tuning surface — gates tune here, nowhere else. */
export const PSX = {
  LOW_W: 384,
  LOW_H: 216,
  SNAP_W: 320,
  SNAP_H: 180,
  FPS: 30,
  /** Rotating-cube speed (rad/s) for the temporary GATE-A proof scene only. */
  PROOF_CUBE_SPIN: 0.35,
  TEX: {
    wall: '#8a8578',
    wallShade: '#6f6a5f',
    plywood: '#8f7350',
    plywoodDark: '#6b5238',
    carpet: '#5f6258',
    carpetDark: '#4a4d45',
    concrete: '#7d7f7a',
    shadowTeal: '#3d5450',
    crtTeal: '#7de8e0',
    crtTealDark: '#2e6b66',
    accentOrange: '#d96b2f',
    accentYellow: '#d9b23a',
    accentRed: '#b8402e',
    accentBlue: '#3e6fb8',
  },
} as const
