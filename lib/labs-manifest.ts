/**
 * Style Lab manifest — one entry per design experiment.
 *
 * Each lab is a fully self-contained route under app/labs/<slug>/ with its
 * own components in components/labs/<slug>/. Labs are free-form (a full site,
 * a game screen, a newspaper — anything), with one rule: content comes from
 * the shared data/ files so every experiment re-skins the same substance.
 *
 * Every lab also ships a poster at public/labs/<slug>/poster.jpg
 * (portrait ~3:4, <=200 KB) — it hangs in the /labs museum and thumbnails
 * the list view. Generators live in scripts/posters/. Each lab page wraps
 * its content in <GalleryChrome> for the back-to-gallery button and Esc.
 */

export type LabEntry = {
  slug: string
  title: string
  /** ISO date the experiment shipped */
  date: string
  /** One-line statement of what the experiment explores */
  thesis: string
  status: 'live' | 'wip' | 'attic'
  /** Route the artwork opens; defaults to /labs/<slug> */
  href?: string
  /** The honest saga shown on the attic plaque and in the list view.
   * Required in practice for status 'attic'. */
  retrospective?: string
}

export const labs: LabEntry[] = [
  {
    slug: 'main',
    title: 'Terracotta',
    date: '2026-07-08',
    thesis:
      'The daily driver — warm terracotta and cream, pixel avatar, Bricolage Grotesque. The control every experiment is measured against.',
    status: 'live',
    href: '/',
  },
  {
    slug: 'memory-card',
    title: 'Memory Card',
    date: '2026-07-10',
    thesis:
      'The PS1 memory-card manager as an editorial site — crisp retro-3D product shots, save-slot typography, four button-glyph accents. No pixelation, all nostalgia.',
    status: 'live',
  },
  {
    slug: 'snowpark',
    title: 'Powder Lines',
    date: '2026-07-08',
    thesis:
      'A playable snowboard descent drawn as pure geometry — every kicker, rail and box is a real skill; land the trick to collect it.',
    status: 'attic',
    retrospective:
      'Three passes, three verdicts. v1: flat polylines and a stick figure — "a cheap copy of Happy Wheels." v2: Alto-style rebuild — day cycle, parallax, jointed rider — but the ramps were painted on and one button did everything. v3: real ramp physics, flips, spins, grabs — better bones, same cheap read. Retired here, still playable, as evidence.',
  },
  {
    slug: 'xp',
    title: 'Bliss',
    date: '2026-07-09',
    thesis:
      'The portfolio as a Windows XP desktop — Luna chrome, the real boot chime, a helpful paperclip. The most beloved OS ever shipped, rebuilt as a design system.',
    status: 'live',
  },
]

/** What hangs in the main hall — everything not retired to the attic. */
export const hallLabs: LabEntry[] = labs.filter((l) => l.status !== 'attic')

/** The failed experiments upstairs. */
export const atticLabs: LabEntry[] = labs.filter((l) => l.status === 'attic')
