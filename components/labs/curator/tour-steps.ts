export type TourStep = { id: string; target: string; title: string; body: string }

export const TOUR_STEPS: TourStep[] = [
  {
    id: 'workspace-nav',
    target: '[data-tour="workspace-nav"]',
    title: 'Your workspace',
    body: 'Seven modules, each code-split and loaded on demand, all managed from a single manifest.',
  },
  {
    id: 'spec-chip',
    target: '[data-tour="spec-chip"]',
    title: 'Engineering annotations',
    body: 'Every module documents its own construction. Open any SPEC chip for the stack, the pattern, and the reasoning behind it.',
  },
  {
    id: 'nav-engineering',
    target: '[data-tour="nav-engineering"]',
    title: 'The handbook',
    body: 'The full set of engineering briefs lives in the Engineering module.',
  },
  {
    id: 'nav-settings',
    target: '[data-tour="nav-settings"]',
    title: 'Preferences',
    body: 'Density, motion, and data preferences persist locally. Adjust any of them at any time in Settings.',
  },
]
