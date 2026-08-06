import type { MangaPage } from './types'

/**
 * THE PROPOSED LETTERING REVISION — Aram's dialogue swaps, staged as data.
 *
 * The printed pages carry blank balloons and the site typesets every word in
 * them (see `types.ts`), so changing what she says is a text change and not an
 * art change. This file is where a proposed set of those changes lives while it
 * is being judged, rather than being applied destructively to seven manifests
 * where the previous wording would survive only in a diff.
 *
 * WHY A LAYER RATHER THAN AN EDIT. Aram rules on these from CAPTURES, and the
 * useful question is "which of the two reads better" — which needs both versions
 * reachable. `REVISION_ON` is that switch: flip it and the pages letter the way
 * they shipped. Once he has ruled, the winning text moves into the manifests and
 * this file is deleted; it is scaffolding with a known end, not a permanent
 * indirection.
 *
 * WHY `from` IS RECORDED. A swap keyed only by position silently retargets if
 * anyone reorders a manifest's balloons, and it would do so invisibly, because
 * the result is still a page with words on it. Every entry therefore names the
 * text it replaces, and `dialogue-revision.test.ts` asserts each one still
 * matches the shipped manifest. If a manifest is re-lettered upstream, that test
 * fails and this file gets revisited rather than quietly lettering the wrong
 * balloon.
 *
 * THE EDITORIAL THROUGH-LINE, because it is the reason the list looks arbitrary:
 * the lab is Alwina's CV in HER voice, and three of these seven are the narrator
 * talking ABOUT her in the third person — "Her favourite thing to make: makers",
 * "These days, she watches everything at once". Those are the same defect the
 * right-hand leaf was rebuilt to remove, still sitting in the art's captions. The
 * rest trade a maxim for something a person would actually say: "Build it once.
 * Build it right." is a slogan; "Same box. New paint." is a woman describing her
 * afternoon.
 */

/** Flip to false to letter the pages exactly as they shipped before the revision. */
export const REVISION_ON = true

type Swap = {
  /** Page file stem. */
  page: string
  kind: 'balloon' | 'caption'
  /** Index within that page's `balloons` or `captions` array. */
  index: number
  /** What the manifest says today — asserted, so a reorder cannot retarget the swap. */
  from: string
  to: string
  /** Why, in one line. These are a real person's words; the reason belongs with them. */
  note: string
}

export const DIALOGUE_REVISION: readonly Swap[] = [
  {
    page: 'page-1',
    kind: 'balloon',
    index: 2,
    from: 'You can now.',
    to: 'Try dragging that one.',
    note: 'Her line to the villager. "You can now" is a benediction; the revision is an instruction, which is what a person handing over a tool actually says.',
  },
  {
    page: 'page-1',
    kind: 'caption',
    index: 0,
    from: 'Her favorite thing to make: makers.',
    to: 'It worked in every browser. Eventually.',
    note: 'THIRD PERSON, and a slogan. The revision is hers, and it is funny about the unglamorous part — which is the register the whole lab is being pulled toward.',
  },
  {
    page: 'page-2',
    kind: 'balloon',
    index: 1,
    from: 'If they can feel the seam, it isn’t done.',
    to: 'Almost… there.',
    note: 'A maxim delivered mid-chisel. The revision is what somebody concentrating says out loud.',
  },
  {
    page: 'page-2',
    kind: 'caption',
    index: 0,
    from: 'Nobody notices a perfect stone. Everybody feels it.',
    to: 'Most of this work is invisible. That’s fine by me.',
    note: 'Same observation, first person and without the aphorism. "That’s fine by me" is the humility the sermon version claims.',
  },
  {
    page: 'page-3',
    kind: 'balloon',
    index: 0,
    from: 'Build it once. Build it right.',
    to: 'Same box. New paint.',
    note: 'The slogan becomes the shop-floor description of a component library, which is also more precise about what she did.',
  },
  {
    page: 'page-4',
    kind: 'balloon',
    index: 2,
    from: 'Your turn — carve your own door.',
    to: 'Careful — heavier than it looks.',
    note: 'Handing over the tools without the moral attached.',
  },
  {
    page: 'page-5',
    kind: 'caption',
    index: 0,
    from: 'These days, she watches everything at once.',
    to: '2025 — present. Still building.',
    note: 'THIRD PERSON, and the last page is where a CV wants a date. Plain, and it lands the ending on work rather than on a portrait.',
  },
]

/** The revision entries that apply to one page. */
export function swapsFor(pageId: string): readonly Swap[] {
  return DIALOGUE_REVISION.filter((s) => s.page === pageId)
}

/**
 * A page with the revision applied — or the page itself when the revision is off
 * or has nothing to say about it.
 *
 * Returns a NEW page rather than mutating: the manifests are module-level
 * constants shared by the card, the lightbox and the info leaf's crops, and a
 * mutation would reach all three from whichever rendered first.
 */
export function withRevision(page: MangaPage): MangaPage {
  if (!REVISION_ON) return page
  const swaps = swapsFor(page.id)
  if (swaps.length === 0) return page
  const apply = (kind: 'balloon' | 'caption', i: number, text: string) =>
    swaps.find((s) => s.kind === kind && s.index === i && s.from === text)?.to ?? text
  return {
    ...page,
    balloons: page.balloons.map((b, i) => ({ ...b, text: apply('balloon', i, b.text) })),
    captions: page.captions.map((c, i) => ({ ...c, text: apply('caption', i, c.text) })),
  }
}
