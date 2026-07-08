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
  status: 'live' | 'wip'
  /** Route the artwork opens; defaults to /labs/<slug> */
  href?: string
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
    slug: 'ps1',
    title: 'PS1 / Y2K',
    date: '2026-07-08',
    thesis:
      'PS1-era software rendering — flat shading, ordered dithering, vertex snap at 384px — on a Y2K grid world. Projects become memory-card saves.',
    status: 'live',
  },
  {
    slug: 'snowpark',
    title: 'Powder Lines',
    date: '2026-07-08',
    thesis:
      'A playable snowboard descent drawn as pure geometry — every kicker, rail and box is a real skill; land the trick to collect it.',
    status: 'live',
  },
]
