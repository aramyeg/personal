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
  /** No room behind the frame: the experiment left the museum and only its
   * sign remains. Nothing may link or navigate to a remnant — `labHref`
   * returns null for it and every consumer renders the entry unlinked. */
  remnant?: true
}

/** The route an entry opens, or null when there is nothing to open.
 * The one place the /labs/<slug> convention is spelled out — routing a lab
 * anywhere else risks pointing at a room this build never shipped. */
export function labHref(lab: LabEntry): string | null {
  return lab.remnant ? null : (lab.href ?? `/labs/${lab.slug}`)
}

export const labs: LabEntry[] = [
  {
    slug: 'main',
    title: 'Classic Claude',
    date: '2026-07-08',
    thesis:
      'Standard AI with a twist — warm terracotta and cream, pixel avatar, Bricolage Grotesque. The control every experiment is measured against.',
    status: 'live',
    href: '/classic-claude',
  },
  {
    slug: 'memory-card',
    title: 'Memory Card',
    date: '2026-07-10',
    thesis:
      'The PS1 memory-card manager rebuilt as a character-select screen — pick a save from the spec-sheet index and the figure re-dresses into that slot’s fit as the room re-lights in its accent. No pixelation, all nostalgia.',
    status: 'attic',
    retrospective:
      'Two builds, one lesson. v1: conventional sections around a spinning card fan — "generic sloppy layout." v2: a split-hero character select — six outfits painted straight onto the body the way PS1 games did it, a real boot moment, ink and grain. The screen learned to read designed; the characters never did — "the models look really bad… the geometry is weak." You can script a render pipeline; you can’t script a character artist. Retired here, still playable, as evidence.',
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
  {
    slug: 'curator',
    title: 'Curator',
    date: '2026-07-10',
    thesis:
      'The portfolio as enterprise SaaS — a navy-and-white operations console where the museum itself is the managed asset. Every ritual played straight; the pagination paginates six rows.',
    status: 'live',
  },
  {
    slug: 'small-world',
    title: 'Small World',
    date: '2026-07-16',
    thesis:
      'A clay planet small enough to walk in an afternoon — every lap of it is a career. A cartoon girl skips through six chapters as the world resculpts itself under her feet.',
    status: 'attic',
    remnant: true,
    retrospective:
      'There was a whole world in this room once — clay, four seasons, one career walked in an afternoon. It was never really an exhibit; it was a present being wrapped. The museum kept the loading screen.',
  },
]

/** What hangs in the main hall — everything not retired to the attic. */
export const hallLabs: LabEntry[] = labs.filter((l) => l.status !== 'attic')

/** The failed experiments upstairs. */
export const atticLabs: LabEntry[] = labs.filter((l) => l.status === 'attic')
