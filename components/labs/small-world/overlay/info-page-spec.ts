import type { Rect } from '../manga/types'

/**
 * THE RIGHT-HAND LEAF — what it says, as DATA.
 *
 * ============================================================================
 * THE PREMISE
 * ============================================================================
 * This lab is Alwina's CV. The contrast is the idea: a playful colour clay world
 * with clay creatures leaning into it, and — printed in black and white — the book
 * where the facts live. The right leaf is not a card describing her from outside.
 * It is a manga page, in the same ink as the leaf beside it, in her own voice.
 *
 * ============================================================================
 * THE PAGE IS FOUR BEATS, AND THAT IS A RESEARCH RESULT RATHER THAN A TASTE
 * ============================================================================
 * Two independent research passes converged on Bach et al. (CHI 2019): DATA COMICS
 * beat infographics on comprehension, recall (~23%) and enjoyment — and the win
 * conditions are specific. An EXPLICIT READING ORDER, and TEXT FUSED INTO PICTURES
 * rather than set beside them. A poster of panels has neither: the eye enters
 * wherever the contrast is highest and leaves without a sequence.
 *
 * So the page is KISHOTENKETSU, four beats, top to bottom:
 *
 *   1. KI (setup) — the donated story panel. The chapter's own art, carried over
 *      from the left leaf, which is what makes the spread read as one page flow.
 *   2. SHO (development) — the work itself: a TIGHTER CROP OF THE SAME ART. The
 *      "zoom-in triad" (wide, tight, number-inside) glues the fact to the story
 *      with no new art at all, and it is the cheapest way to obey "fuse the text
 *      into the picture".
 *   3. TEN (the twist) — THE METRIC, and it is the hero: half the page, the number
 *      oversized and tilted and BREAKING its own panel border, speed lines aiming
 *      at it, and it is the only pink on the page.
 *   4. KETSU (resolution) — quiet. One first-person line, and the printed colophon.
 *
 * ============================================================================
 * THE LAWS THAT CONSTRAIN EVERY ENTRY BELOW
 * ============================================================================
 *  - FIRST PERSON. Always. The old data card said "She learned that flow is a
 *    craft"; a CV that talks about its author in the third person is a bio someone
 *    else wrote.
 *  - ONE HERO NUMBER PER PAGE. A second figure is not a second hero — it rides
 *    inside beat 2 as a note, at a fraction of the size. Two numbers competing is
 *    two numbers ignored.
 *  - SEVEN WORDS. No caption or note runs longer. The test enforces it.
 *  - THE TEXT GUARD: if a beat's meaning survives deleting its text, it passes. If
 *    it does not, the answer is to redraw the beat, never to add words.
 *  - PINK IS A SEMANTIC CHANNEL, not decoration: it appears on the beat-3 number
 *    and its impact burst and NOWHERE else. The moment pink decorates, numbers
 *    stop reading as numbers. (This retired the pink caption rule and the pink
 *    stamp outlines the first draft of this page had.)
 *
 * ============================================================================
 * THE SPOT ART IS NOT NEW ART, AND IT IS NOT DUPLICATED EITHER
 * ============================================================================
 * Beats 1 and 2 are CROPS OF THE CHAPTER'S OWN PRINTED PAGE — the manifest carries
 * every panel rect, so a close-up of her hands is a rectangle rather than a
 * drawing. It costs no new asset and cannot drift in style, because it IS that
 * page. And per Aram's correction the panel it comes from is REMOVED from the left
 * leaf (`DONATED_PANEL` below), so no panel is ever printed twice on one spread.
 */

/** A crop of a printed page, in page fractions — the manifest's own coordinate space. */
export type SpotCrop = Rect & {
  /** Page index in `MANGA_PAGES`. */
  page: number
}

/**
 * Beat 3's claim.
 *
 * A `number` ticks up from zero; a `count` plants that many marks one at a time.
 * Both exist because they answer different questions — "how much did it move" and
 * "how many were there" — and an Isotype row of thirteen marks says the second one
 * in a way the numeral 13 cannot.
 */
export type Hero =
  | {
      kind: 'number'
      /** The magnitude. It counts up from 0, so it has to be a number and not a string. */
      value: number
      /** Sign or symbol printed before the digits, and never animated. */
      prefix?: string
      /** Unit, which lands LATE, as its own beat. */
      suffix?: string
      label: string
      /**
       * A SUPPORTING count, planted under the number in INK.
       *
       * For the chapter whose claim is "thirteen clients, and revenue up 42%": the
       * number is the fact and the marks are what earned it, so they share the hero
       * panel and the number keeps the pink. Two separate pink claims would be two
       * claims ignored — this is how a count rides along without competing.
       */
      marks?: { count: number; label: string }
    }
  | { kind: 'count'; count: number; label: string }
  /**
   * A hand-lettered WORD, given the number's treatment.
   *
   * Not every chapter has a percentage, and a beat-3 that is a metric-shaped hole is
   * worse than one that is honest. Manga's own answer to "this is the loud part" is
   * SFX — oversized, tilted, breaking the frame — and a word can carry that as well
   * as a numeral. A count of ONE is not an Isotype row; it is a flag on its own,
   * which is what this replaces.
   */
  | { kind: 'sfx'; text: string; label: string }

export type InfoPageSpec = {
  /**
   * Beat 1: a WIDE crop of the donated panel.
   *
   * Not the whole panel, and that is geometry rather than taste: a vertical
   * four-beat stack needs a landscape establishing shot, and three of the six
   * donated panels are square or portrait. Filling a wide slot with a portrait
   * panel shows an arbitrary top-strip of it — captured on chapter 3, where beat 1
   * came out as hair and an empty balloon. The crop must lie INSIDE the donated
   * panel (asserted), so the no-duplicate rule still holds.
   */
  ki: { crop: SpotCrop; alt: string }
  /** Beat 2: a tighter crop of the same art, and at most one supporting figure. */
  sho: { crop: SpotCrop; alt: string; note?: string }
  /** Beat 3: the hero. `inverted` prints it white-on-black — at most one chapter may. */
  ten: { hero: Hero; inverted?: boolean }
  /** Beat 4: her line, the colophon, and the stack as a quiet aside. */
  ketsu: { line: string; tools: string[] }
  footer: { role: string; org: string; period: string }
}

/**
 * WHICH PANEL EACH CHAPTER DONATES TO ITS INFO PAGE — the no-duplicate rule.
 *
 * The panel beat 1 shows is REMOVED from the left leaf's render, so the spread
 * reads as one page flow: the story's panels on the left, its closing panel
 * carried over to anchor the data on the right. One source of that fact — the info
 * page reads it for its art, the story page reads it for what to leave out.
 *
 * THREE OF THESE WERE WRONG IN THE FIRST DRAFT and the bench caught it: the panel
 * being removed was not the panel the info leaf showed, so a panel was deleted for
 * nothing AND the duplication survived. `info-page.test.tsx` now asserts beat 1
 * and beat 2 both lie inside the donated panel, which makes that class of mistake
 * impossible rather than unlikely.
 *
 * NOT EVERY PAGE SURVIVES THE OPERATION. Measured (`bench/task76-redistribute.mjs`):
 * a page of full-width strips gives up an END strip cleanly but loses a lot of
 * leaf; a splash with insets gives up an inset for free; a stacked column leaves a
 * HOLE in the middle of the composition. Per-chapter verdicts are in the report —
 * the ones that fight it are routed to newly generated art rather than forced.
 */
export const DONATED_PANEL: readonly number[] = [
  2, // ch1 Lyon (page-0): the closing strip, her hands and the seedling. CLEAN — 72% leaf, 0.8% hole.
  0, // ch2 IU Networks (page-1): the opening strip. Clean remainder but only 56.7% leaf — the worst letterbox.
  1, // ch3 Sportion (page-2): the chisel. INTERIOR of a tall-left layout — opens a 26% hole. Route to new art.
  1, // ch4 qiibee (page-3): the painted chest, an inset drawn ON the splash. CLEANEST — 99% leaf, 0% hole.
  1, // ch5 Wooskill (page-4): the foundation panel. Interior of the right column — 27% hole. Route to new art.
  0, // ch6 Sync Design (page-5): the observatory strip. Clean remainder, 61% leaf.
]

export const donatedPanelFor = (chapterIndex: number): number | undefined => DONATED_PANEL[chapterIndex]

/**
 * The six pages.
 *
 * COPY PROVENANCE, because these are a real person's words about her own career:
 * every fact is already in `alwina-story.ts` (transcribed from the approved pack)
 * or in Aram's own first-person drafts. What changed is PERSON and LENGTH. No
 * claim is added anywhere. Each chapter records its draft beside what shipped, so
 * his line-edit can pick either without reconstructing anything from a diff.
 *
 * STILL UNCONFIRMED WITH HER: the tool rows, and the one formatting liberty
 * (`+30% smoother`, which the pack writes unsigned).
 */
export const INFO_PAGES: readonly InfoPageSpec[] = [
  // ── 1 · The Pull — Lyon ─────────────────────────────────────────────────────
  // DRAFT:   "I studied marketing in Lyon. Somewhere between the lectures, I
  //           started building things — and it stuck."
  // SHIPPED: "I studied why people choose — then taught myself to build it."
  // OPEN — Aram's call; the draft is warmer, mine is tighter and rhymes with the
  // seedling above it.
  // The HERO here is a count, because this chapter has no percentage to its name:
  // four languages, planted one flag at a time.
  {
    ki: { alt: 'Her cupped hands holding a seedling', crop: { page: 0, x: 0.0117, y: 0.7271, w: 0.9766, h: 0.2657 } },
    sho: {
      alt: 'The seedling itself, close',
      crop: { page: 0, x: 0.2999, y: 0.8204, w: 0.4102, h: 0.1272 },
      note: 'Self-taught',
    },
    ten: { hero: { kind: 'count', count: 4, label: 'languages' } },
    ketsu: {
      line: 'I studied why people choose — then taught myself to build it.',
      tools: ['Marketing', 'Business', 'Code'],
    },
    footer: {
      role: 'Master of Marketing & Business',
      org: 'Université Jean Moulin Lyon III',
      period: '2013–2019',
    },
  },

  // ── 2 · First Tools — IU Networks ───────────────────────────────────────────
  // DRAFT:   "My first job: a drag-and-drop page builder, so the team didn't need
  //           a developer for every small change."
  // SHIPPED: the draft, distilled twice — the first cut ran 13 words and the text
  // guard caught it. "No developer for small changes" keeps the humility and the fact.
  {
    ki: { alt: 'She sets a block on a growing tower', crop: { page: 1, x: 0.0059, y: 0.0559, w: 0.9873, h: 0.2682 } },
    sho: {
      alt: 'The block in her fingers',
      crop: { page: 1, x: 0.2527, y: 0.1208, w: 0.4147, h: 0.1284 },
      note: 'Every browser',
    },
    ten: { hero: { kind: 'sfx', text: 'No code', label: 'for small changes' } },
    ketsu: {
      line: 'My first job: a page builder — no developer for small changes.',
      tools: ['Frontend', 'Drag-and-drop', 'Cross-browser'],
    },
    footer: { role: 'Frontend Developer', org: 'IU Networks', period: '2020–2021' },
  },

  // ── 3 · Taste — Sportion ────────────────────────────────────────────────────
  // DRAFT:   "At a sports platform I learned how much the small stuff matters."
  // SHIPPED: "I polish the stones people step on."
  // OPEN — Aram's call.
  // TWO figures, ONE hero: +30% is the bigger claim and takes beat 3; +15% rides
  // inside beat 2 at a fraction of the size. Two heroes would be no hero.
  {
    ki: {
      alt: 'Her hands working a stepping stone with a hammer and chisel',
      crop: { page: 2, x: 0.5068, y: 0.2644, w: 0.4824, h: 0.1313 },
    },
    sho: {
      alt: 'The chisel’s edge on the stone',
      crop: { page: 2, x: 0.6887, y: 0.3036, w: 0.2026, h: 0.0628 },
      note: '+15% session',
    },
    ten: { hero: { kind: 'number', value: 30, prefix: '+', suffix: '%', label: 'smoother' } },
    ketsu: { line: 'I polish the stones people step on.', tools: ['UI', 'UX', 'Interaction'] },
    footer: { role: 'UI/UX Engineer', org: 'Sportion', period: '2021' },
  },

  // ── 4 · One Craft, Many Colors — qiibee ─────────────────────────────────────
  // DRAFT:   "One loyalty app, thirteen clients, each with their own colors — the
  //           same craft underneath."
  // SHIPPED: the draft, distilled; the marks carry "thirteen" so the sentence does
  // not have to. CLIENTS, his word and the accurate one.
  // THE ONE INVERTED PAGE. Thirteen is the set's biggest single claim and the
  // research allows exactly one chapter to print white-on-black; this is it.
  {
    ki: { alt: 'She paints the lid of a patterned chest', crop: { page: 3, x: 0.0205, y: 0.8002, w: 0.4395, h: 0.1196 } },
    sho: {
      alt: 'The brush on the pattern',
      crop: { page: 3, x: 0.0927, y: 0.7974, w: 0.1846, h: 0.0572 },
      note: '−40% build time',
    },
    ten: {
      hero: {
        kind: 'number',
        value: 42,
        prefix: '+',
        suffix: '%',
        label: 'revenue',
        marks: { count: 13, label: 'clients' },
      },
      inverted: true,
    },
    ketsu: {
      line: 'One loyalty app I built — each client in their own colors.',
      tools: ['React', 'Component library', 'Design system'],
    },
    footer: { role: 'React Developer', org: 'qiibee', period: '2021–2023' },
  },

  // ── 5 · Deeper — Wooskill ───────────────────────────────────────────────────
  // DRAFT:   "At Wooskill I went full-stack — React on top, PHP underneath, AWS
  //           holding it all up."
  // SHIPPED: the draft, distilled (the colophon already says Wooskill). The rail
  // names React / PHP / AWS because his draft does — better provenance than the
  // stack I had inferred from the company name.
  {
    ki: { alt: 'She sets a foundation stone by lamplight', crop: { page: 4, x: 0.4727, y: 0.2688, w: 0.5234, h: 0.1424 } },
    sho: {
      alt: 'Her hands on the stone',
      crop: { page: 4, x: 0.5901, y: 0.2709, w: 0.2198, h: 0.0682 },
      note: '+19% conversion',
    },
    ten: { hero: { kind: 'number', value: 20, prefix: '−', suffix: '%', label: 'load' } },
    ketsu: {
      line: 'I went full-stack — React on top, PHP underneath, AWS holding it up.',
      tools: ['React', 'PHP', 'AWS'],
    },
    footer: { role: 'Full-stack Software Engineer', org: 'Wooskill', period: '2023–2024' },
  },

  // ── 6 · The Observatory — Sync Design Tech ──────────────────────────────────
  // DRAFT:   "Now I build dashboards full of live maps, camera feeds and data that
  //           never sits still — and the infrastructure underneath them."
  // SHIPPED: the draft, distilled. "Data that never sits still" is the best phrase
  // in the set and the cut loses it — worth his second look.
  {
    ki: { alt: 'She watches the observatory glass at dawn', crop: { page: 5, x: 0.0039, y: 0.0452, w: 0.9922, h: 0.2695 } },
    sho: {
      alt: 'The lit charts in the glass',
      crop: { page: 5, x: 0.3916, y: 0.0705, w: 0.4167, h: 0.129 },
      note: 'Live data',
    },
    ten: { hero: { kind: 'count', count: 3, label: 'stacks' } },
    ketsu: {
      line: 'I build live maps and camera feeds — and what holds them up.',
      tools: ['Real-time', 'Maps', 'Infra as code'],
    },
    footer: { role: 'Frontend Engineer', org: 'Sync Design Tech', period: '2025–now' },
  },
]

export const infoPageFor = (chapterIndex: number): InfoPageSpec | undefined => INFO_PAGES[chapterIndex]
