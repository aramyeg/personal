/**
 * Style Lab manifest — one entry per design experiment.
 *
 * Each lab is a fully self-contained route under app/labs/<slug>/ with its
 * own components in components/labs/<slug>/. Labs are free-form (a full site,
 * a game screen, a newspaper — anything), with one rule: content comes from
 * the shared data/ files so every experiment re-skins the same substance.
 */

export type LabEntry = {
  slug: string
  title: string
  /** ISO date the experiment shipped */
  date: string
  /** One-line statement of what the experiment explores */
  thesis: string
  status: 'live' | 'wip'
}

export const labs: LabEntry[] = [
  {
    slug: 'ps1',
    title: 'PS1 / Y2K',
    date: '2026-07-08',
    thesis:
      'PS1-era software rendering — flat shading, ordered dithering, vertex snap at 384px — on a Y2K grid world. Projects become memory-card saves.',
    status: 'live',
  },
]
