/**
 * Fixed camera angles (RE/FF7-style hard cuts) and the pure experience
 * reducer that drives them. No three.js, no React — plain data and a
 * reducer function only.
 */

export type AngleId = 'room' | 'desk' | 'shelf' | 'tv'

export type CameraAngle = {
  id: AngleId
  position: [number, number, number]
  lookAt: [number, number, number]
  fov: number
  label: string
}

export const ANGLES: Record<AngleId, CameraAngle> = {
  room: {
    id: 'room',
    position: [1.9, 1.5, 2.3],
    lookAt: [-0.4, 0.9, -1.2],
    fov: 60,
    label: 'the room',
  },
  desk: {
    id: 'desk',
    position: [-0.6, 1.25, -0.7],
    lookAt: [-0.6, 1.05, -2.2],
    fov: 50,
    label: 'the desk',
  },
  shelf: {
    id: 'shelf',
    position: [0.4, 1.35, 0.2],
    lookAt: [2.0, 1.3, -0.4],
    fov: 52,
    label: 'the shelf',
  },
  tv: {
    id: 'tv',
    position: [-0.2, 1.0, 0.2],
    lookAt: [1.5, 0.5, 1.8],
    fov: 55,
    label: 'the tv',
  },
}

export const ANGLE_ORDER: AngleId[] = ['room', 'desk', 'shelf', 'tv']

export type PanelId = 'menu' | 'about' | 'projects' | 'skills' | 'contact' | 'labs' | null

export type ExperienceState = {
  booted: boolean
  angle: AngleId
  panel: PanelId
  soundOn: boolean
}

export type ExperienceAction =
  | { type: 'BOOT_DONE' }
  | { type: 'CUT'; dir: 1 | -1 }
  | { type: 'CUT_TO'; angle: AngleId }
  | { type: 'OPEN_PANEL'; panel: Exclude<PanelId, null> }
  | { type: 'CLOSE_PANEL' }
  | { type: 'ESCAPE' }
  | { type: 'TOGGLE_SOUND' }

export const initialState: ExperienceState = {
  booted: false,
  angle: 'room',
  panel: null,
  soundOn: false,
}

export function experienceReducer(
  s: ExperienceState,
  a: ExperienceAction
): ExperienceState {
  switch (a.type) {
    case 'BOOT_DONE':
      return { ...s, booted: true }

    case 'CUT': {
      if (!s.booted || s.panel !== null) return s
      const i = ANGLE_ORDER.indexOf(s.angle)
      const next = ANGLE_ORDER[(i + a.dir + ANGLE_ORDER.length) % ANGLE_ORDER.length]
      return { ...s, angle: next }
    }

    case 'CUT_TO': {
      if (!s.booted || s.panel !== null) return s
      return { ...s, angle: a.angle }
    }

    case 'OPEN_PANEL':
      if (!s.booted) return s
      return { ...s, panel: a.panel }

    case 'CLOSE_PANEL':
      if (s.panel === null) return s
      return { ...s, panel: null }

    case 'ESCAPE':
      if (s.panel === null) return s
      return { ...s, panel: null }

    case 'TOGGLE_SOUND':
      return { ...s, soundOn: !s.soundOn }

    default:
      return s
  }
}
