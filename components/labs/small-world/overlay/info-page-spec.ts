import type { Rect } from '../manga/types'

/**
 * THE RIGHT-HAND LEAF — what it says, as DATA.
 *
 * ============================================================================
 * THE PREMISE
 * ============================================================================
 * This lab is Alwina's CV. The contrast is the whole idea: a playful colour clay
 * world with clay creatures leaning into it, and — printed in black and white —
 * the book where the facts live. So the right leaf is not a card describing her
 * from outside. It is a MANGA PAGE, in the same ink as the leaf beside it, and
 * it speaks in her own voice.
 *
 * TWO RULES GOVERN EVERYTHING BELOW.
 *
 * 1. FIRST PERSON. Every word on this page is hers. The old data card said "She
 *    learned that flow is a craft"; a CV that talks about its author in the
 *    third person is a bio someone else wrote.
 *
 * 2. IT IS LOOKED AT, NOT READ. Nobody reads a CV — they scan it, and the ones
 *    that work are the ones that survive scanning. So a figure is a STAMPED
 *    NUMERAL, a count is that many DRAWN FLAGS (you can see there are thirteen
 *    without counting, and counting them is a pleasure rather than a task), a
 *    stack is TOOLS HANGING ON A RAIL, and there is exactly ONE sentence per
 *    page. If a panel needs a paragraph to work, it is the wrong panel.
 *
 * ============================================================================
 * WHY A SPEC RATHER THAN SIX COMPONENTS
 * ============================================================================
 * Six hand-built pages is six things to restyle every time the ink changes, and
 * it makes chapter seven a design project. A page is therefore a list of PANELS
 * from a closed set of kinds, and `info-page.tsx` knows how to ink each kind.
 * Designing chapters 1 and 3 designed all six; the rest are data.
 *
 * ============================================================================
 * THE SPOT ART IS NOT NEW ART
 * ============================================================================
 * `spot` panels are CROPS OF THE PRINTED PAGES — the manifest carries every
 * panel rect, so a close-up of her hands is a rectangle rather than a drawing.
 * That costs no new asset, no new request, and it cannot drift in style from the
 * page beside it, because it IS that page. The crops are authored against the
 * shipped webps and cut by eye (`scratchpad/t74/crop.mjs` renders a candidate so
 * it can be looked at before it is committed to).
 */

/** A crop of a printed page, in page fractions — the same coordinate space the manifest uses. */
export type SpotCrop = Rect & {
  /** Page index in `MANGA_PAGES`. */
  page: number
}

export type InfoPanel =
  /** A close-up cut from the chapter's own printed page. */
  | { kind: 'spot'; crop: SpotCrop; alt: string }
  /**
   * Figures, pressed. One to three per panel — past three a stamp row stops
   * being a claim and becomes a table, which is the thing this page exists to
   * avoid. `value` carries its own sign and unit; `label` is what it counts.
   */
  | { kind: 'stamps'; figures: { value: string; label: string }[] }
  /**
   * A word pressed like a rubber stamp — APPROVED, PAID, SELF-TAUGHT. For the
   * chapters whose claim is not a number.
   */
  | { kind: 'mark'; text: string }
  /** `count` drawn flags and what they are. Seen, not read. */
  | { kind: 'tally'; count: number; label: string }
  /** The tools of the trade, hanging from a rail. */
  | { kind: 'shelf'; tools: string[] }
  /** THE one sentence. Her voice, in a narrator box. */
  | { kind: 'caption'; text: string }

/** One row of the page: panels side by side, with relative widths. */
export type InfoRow = {
  /** Relative height of the row. `auto` lets a spot panel keep its crop's aspect. */
  h: number | 'auto'
  cells: { panel: InfoPanel; w: number }[]
}

export type InfoPageSpec = {
  rows: InfoRow[]
  /** The printed colophon: what she was, where, when. Small type — it is a reference, not a claim. */
  footer: { role: string; org: string; period: string }
}

/**
 * The six pages.
 *
 * ============================================================================
 * COPY PROVENANCE — these are a real person's words about her own career
 * ============================================================================
 * Two sources, and every line below is one of them distilled, never invented:
 *
 *  - THE PACK, via `alwina-story.ts` (transcribed from the approved story pack).
 *  - ARAM'S DRAFTS, a set of first-person lines he has been shown but has not yet
 *    line-edited. They set the REGISTER this page is written in: first person,
 *    humble, specific, no sermons.
 *
 * What changed from the pack is PERSON and LENGTH — third to first, three lines
 * to one. No claim is added anywhere.
 *
 * EACH CHAPTER BELOW RECORDS ITS DRAFT AND ITS SHIPPED LINE as a pair, because
 * Aram line-edits from captures and the useful question is "which of these two".
 * Where the draft is what ships, it says so; where a tighter line won, the draft
 * is kept underneath it so nothing has to be reconstructed from a diff. Two are
 * flagged as genuinely open (chapters 1 and 3) — the drafts and mine say the same
 * thing at different temperatures and that is his call, not mine.
 *
 * STILL UNCONFIRMED WITH HER: the tech rows, and the one formatting liberty
 * (`+30% smoother`, which the pack writes unsigned). Chapter 5's rail now names
 * React / PHP / AWS because Aram's own draft names them — better provenance than
 * the stack I had inferred from the company.
 */
export const INFO_PAGES: readonly InfoPageSpec[] = [
  // ── 1 · The Pull ────────────────────────────────────────────────────────────
  // DRAFT:   "I studied marketing in Lyon. Somewhere between the lectures, I
  //           started building things — and it stuck."
  // SHIPPED: "I studied why people choose — then taught myself to build it."
  // OPEN — Aram's call. The draft is warmer and names Lyon (which the footer
  // already carries); mine is tighter and rhymes with the seedling above it.
  // Her hands and the seedling, cut out of her own first page: the chapter is a
  // beginning she made herself, and the picture says that without a word.
  {
    rows: [
      {
        h: 'auto',
        cells: [
          {
            w: 1,
            panel: {
              kind: 'spot',
              alt: 'Her cupped hands holding a seedling',
              crop: { page: 0, x: 0.28, y: 0.8, w: 0.42, h: 0.193 },
            },
          },
        ],
      },
      {
        h: 1,
        cells: [
          { w: 0.46, panel: { kind: 'mark', text: 'Self-taught' } },
          { w: 0.54, panel: { kind: 'tally', count: 4, label: 'languages' } },
        ],
      },
      { h: 0.95, cells: [{ w: 1, panel: { kind: 'shelf', tools: ['Marketing', 'Business', 'Code'] } }] },
      {
        h: 0.72,
        cells: [
          {
            w: 1,
            panel: { kind: 'caption', text: 'I studied why people choose — then taught myself to build it.' },
          },
        ],
      },
    ],
    footer: {
      role: 'Master of Marketing & Business',
      org: 'Université Jean Moulin Lyon III',
      period: '2013–2019',
    },
  },

  // ── 2 · First Tools ─────────────────────────────────────────────────────────
  // DRAFT:   "My first job: a drag-and-drop page builder, so the team didn't need
  //           a developer for every small change."
  // SHIPPED: the draft, distilled to one line. "A small change" keeps the humility
  // the long version has and that my earlier "I built the builder" had lost.
  {
    rows: [
      {
        h: 'auto',
        cells: [
          {
            w: 1,
            panel: {
              kind: 'spot',
              alt: 'Her hands stacking a small block tower',
              crop: { page: 1, x: 0.3, y: 0.13, w: 0.42, h: 0.185 },
            },
          },
        ],
      },
      {
        h: 1,
        cells: [
          { w: 0.5, panel: { kind: 'mark', text: 'No code needed' } },
          { w: 0.5, panel: { kind: 'mark', text: 'Every browser' } },
        ],
      },
      {
        h: 0.95,
        cells: [{ w: 1, panel: { kind: 'shelf', tools: ['Frontend', 'Drag-and-drop', 'Cross-browser'] } }],
      },
      {
        h: 0.72,
        cells: [
          { w: 1, panel: { kind: 'caption', text: 'My first job: a page builder, so a small change didn’t need a developer.' } },
        ],
      },
    ],
    footer: { role: 'Frontend Developer', org: 'IU Networks', period: '2020–2021' },
  },

  // ── 3 · Taste ───────────────────────────────────────────────────────────────
  // DRAFT:   "At a sports platform I learned how much the small stuff matters."
  // SHIPPED: "I polish the stones people step on."
  // OPEN — Aram's call. Mine is a metaphor and the art beside it is literally
  // that stone, which is the argument for it; the draft is plainer and says
  // where she was. The stamps carry the claim either way.
  // The chisel. This is the chapter where the figures carry the page, so the
  // stamps get a row to themselves and the picture is the reason to believe them.
  // The chisel. This is the chapter where the figures carry the page, so the
  // stamps get a row to themselves and the picture is the reason to believe them.
  {
    rows: [
      {
        h: 'auto',
        cells: [
          {
            w: 1,
            panel: {
              kind: 'spot',
              alt: 'Her hands working a stepping stone with a hammer and chisel',
              crop: { page: 2, x: 0.6, y: 0.26, w: 0.31, h: 0.14 },
            },
          },
        ],
      },
      {
        h: 1.05,
        cells: [
          {
            w: 1,
            panel: {
              kind: 'stamps',
              figures: [
                { value: '+15%', label: 'session' },
                { value: '+30%', label: 'smoother' },
              ],
            },
          },
        ],
      },
      { h: 0.95, cells: [{ w: 1, panel: { kind: 'shelf', tools: ['UI', 'UX', 'Interaction'] } }] },
      { h: 0.78, cells: [{ w: 1, panel: { kind: 'caption', text: 'I polish the stones people step on.' } }] },
    ],
    footer: { role: 'UI/UX Engineer', org: 'Sportion', period: '2021' },
  },

  // ── 4 · One Craft, Many Colors ──────────────────────────────────────────────
  // DRAFT:   "One loyalty app, thirteen clients, each with their own colors — the
  //           same craft underneath."
  // SHIPPED: the draft, distilled; the flags carry "thirteen" so the sentence
  // does not have to — a first cut kept the numeral and the panel above it said
  // the same thing twice, which is the exact redundancy this page is against.
  // CLIENTS, not "brands" — his word, and the more accurate one.
  // Thirteen flags. The count IS the claim, and thirteen drawn pennants say it
  // faster than the numeral does — and reward the reader who stops to count.
  // Thirteen flags. The count IS the claim, and thirteen drawn pennants say it
  // faster than the numeral does — and reward the reader who stops to count.
  {
    rows: [
      {
        h: 'auto',
        cells: [
          {
            w: 1,
            panel: {
              kind: 'spot',
              alt: 'A caravan carrying identical patterned chests',
              crop: { page: 3, x: 0.24, y: 0.42, w: 0.46, h: 0.2 },
            },
          },
        ],
      },
      { h: 0.78, cells: [{ w: 1, panel: { kind: 'tally', count: 13, label: 'clients' } }] },
      {
        h: 1.15,
        cells: [
          {
            w: 1,
            panel: {
              kind: 'stamps',
              figures: [
                { value: '−40%', label: 'build time' },
                { value: '+42%', label: 'revenue' },
              ],
            },
          },
        ],
      },
      { h: 0.82, cells: [{ w: 1, panel: { kind: 'shelf', tools: ['React', 'Component library', 'Design system'] } }] },
      {
        h: 0.72,
        cells: [
          { w: 1, panel: { kind: 'caption', text: 'One loyalty app I built — each client in their own colors.' } },
        ],
      },
    ],
    footer: { role: 'React Developer', org: 'qiibee', period: '2021–2023' },
  },

  // ── 5 · Deeper ──────────────────────────────────────────────────────────────
  // DRAFT:   "At Wooskill I went full-stack — React on top, PHP underneath, AWS
  //           holding it all up."
  // SHIPPED: the draft, distilled (the footer already says Wooskill). The RAIL
  // now hangs React / PHP / AWS rather than the Frontend / Backend / Infrastructure
  // I had inferred — his draft names the real stack, which is better provenance
  // and a far better line on a CV.
  {
    rows: [
      {
        h: 'auto',
        cells: [
          {
            w: 1,
            panel: {
              kind: 'spot',
              alt: 'Her hands setting a foundation stone by lamplight',
              crop: { page: 4, x: 0.55, y: 0.24, w: 0.4, h: 0.18 },
            },
          },
        ],
      },
      {
        h: 1.05,
        cells: [
          {
            w: 1,
            panel: {
              kind: 'stamps',
              figures: [
                { value: '−20%', label: 'load' },
                { value: '+19%', label: 'conversion' },
                { value: '+15%', label: 'retention' },
              ],
            },
          },
        ],
      },
      {
        h: 0.95,
        cells: [{ w: 1, panel: { kind: 'shelf', tools: ['React', 'PHP', 'AWS'] } }],
      },
      {
        h: 0.72,
        cells: [
          { w: 1, panel: { kind: 'caption', text: 'I went full-stack — React on top, PHP underneath, AWS holding it up.' } },
        ],
      },
    ],
    footer: { role: 'Full-stack Software Engineer', org: 'Wooskill', period: '2023–2024' },
  },

  // ── 6 · The Observatory ─────────────────────────────────────────────────────
  // DRAFT:   "Now I build dashboards full of live maps, camera feeds and data that
  //           never sits still — and the infrastructure underneath them."
  // SHIPPED: the draft, distilled. "Data that never sits still" is the best phrase
  // in the set and it is the one thing the cut loses — worth his second look.
  {
    rows: [
      {
        h: 'auto',
        cells: [
          {
            w: 1,
            panel: {
              kind: 'spot',
              alt: 'Her hands over a lit map at the observatory glass',
              crop: { page: 5, x: 0.3, y: 0.45, w: 0.42, h: 0.19 },
            },
          },
        ],
      },
      {
        h: 1,
        cells: [
          { w: 0.46, panel: { kind: 'mark', text: 'Live data' } },
          { w: 0.54, panel: { kind: 'tally', count: 3, label: 'stacks' } },
        ],
      },
      {
        h: 0.95,
        cells: [{ w: 1, panel: { kind: 'shelf', tools: ['Real-time', 'Maps', 'Infra as code'] } }],
      },
      {
        h: 0.72,
        cells: [
          { w: 1, panel: { kind: 'caption', text: 'I build live maps and camera feeds — and the infrastructure under them.' } },
        ],
      },
    ],
    footer: { role: 'Frontend Engineer', org: 'Sync Design Tech', period: '2025–now' },
  },
]

export const infoPageFor = (chapterIndex: number): InfoPageSpec | undefined => INFO_PAGES[chapterIndex]
