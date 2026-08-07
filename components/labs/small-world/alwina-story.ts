/**
 * Alwina's story — the six stops the little world is now about.
 *
 * The lab used to map `@/data/experience`, which is Aram's CV. It is a GIFT now,
 * so the words are hers. This file is deliberately separate from
 * `data/experience.ts` and does not import it: the portfolio's own Experience
 * section still renders Aram's career from there, and the two must never learn
 * about each other.
 *
 * ============================================================================
 * ROUND 3, AND IT IS A DIFFERENT VOICE ON PURPOSE
 * ============================================================================
 * Every string below is the APPROVED round-3 pack
 * (`.superpowers/sdd/task-80-report.md`, "ROUND 3 — full pack, voice C+A"),
 * verbatim. Aram picked taste-forward and opinionated, tempered with dry and
 * self-aware, over the earlier register — which the research round had
 * diagnosed as the "Alwi isn't Jesus" detector firing: aphorisms, a narrator,
 * and a stamp row on every chapter, which is a 2026 AI-generated tell.
 *
 * The pack's own law, and it is the one to protect: OPINION PLUS RECEIPT, every
 * stop. No opinion floats without its checkable fact, and where a number exists
 * it lands last. Nothing here is a claim the evidence does not already carry.
 *
 * WHAT CHANGED STRUCTURALLY, not just in wording:
 *  - COMPANIES ARE DEMOTED, NEVER DELETED. The headline is the thing she made;
 *    the employer and the years are a museum wall label in `caption`.
 *  - STAMPS ARE NOW RARE. Three in the whole walk, on two stops. They used to be
 *    on all six, which is exactly the tell above. `stamps` is routinely EMPTY
 *    and that is the design, not missing data.
 *  - DEAD METRICS STAY DEAD. `+42% revenue`, `+19% conversion` and
 *    `+15% retention` are gone and are not to be reinstated: they were filtered
 *    out on ATTRIBUTABILITY, which is a truthfulness question rather than an
 *    editing one. `+15% session` survives as a body line, never as a stamp.
 *  - LANGUAGES ARE NAMED ONCE, AS FACT, on the sheet — not counted, and never
 *    offered as an asset.
 *
 * ONE SLOT SHIPS EMPTY. Stop 4 has an `{ANECDOTE}` placeholder in the pack — one
 * real qiibee ticket showing pixel-level care. It is a question for Alwina, and
 * inventing a war story about a real person is the one thing this file may never
 * do, so the stop ships as three lines and reads complete.
 *
 * Chapter order is the journey order, and it is also the biome order: chapter i
 * is told over biome i (spring, meadow, delta, desert, canyon, winter).
 */
import { PALETTE } from './palette'

export type StoryChapter = {
  id: string
  /** The stop's title — the thing she made, not the company she made it at. */
  theme: string
  /**
   * The headline: the most scannable sentence a stop has, and its opinion.
   *
   * HER VOICE, ALWAYS. It may not describe her from outside — a CV that talks
   * about its author in the third person is a bio someone else wrote, and the
   * gate in `chapters.test.ts` is written against exactly that. It need NOT
   * carry an explicit pronoun: several of the approved headlines elide the
   * subject ("Eight months on a sports platform"), which is still first person
   * and is the register a CV line is normally written in.
   */
  hook: string
  /** The body: short sentences, in the pack's order. Opinion first, receipt last. */
  lines: string[]
  /** The museum wall label — role, employer, years, exactly as the pack writes it. */
  caption: string
  /**
   * Short badges that land like a stamp press — and MOST STOPS HAVE NONE.
   *
   * Three in the whole walk, across two stops. A stamp row on every chapter was
   * the single loudest generated-copy tell in the research round, so scarcity is
   * the feature: a badge means "this one is the number", and six of them mean
   * nothing. An empty array here is correct and must not be helpfully filled.
   */
  stamps: string[]
  /**
   * Pill row. Every entry is a word the pack itself uses for that stop's work,
   * rather than a stack guessed from the company name. Inference is fine;
   * invention about a real person is not. Still worth confirming against her CV.
   */
  tech: string[]
  accent: string
}

export const ALWINA_STORY: readonly StoryChapter[] = [
  {
    id: 'lyon',
    theme: 'Marketing, then code',
    hook: 'A marketing degree, then code. Better order than it sounds.',
    lines: [
      'Marketing is four years of studying why people click things.',
      "So I taught myself to code — I'd rather build than brief.",
    ],
    caption: 'Master of Marketing & Business — Université Jean Moulin Lyon III, 2013–19',
    stamps: [],
    tech: ['Marketing', 'Self-taught code'],
    accent: PALETTE.sprout,
  },
  {
    id: 'iu-networks',
    theme: 'The interface builder',
    hook: 'My first job was a drag-and-drop builder people actually used.',
    lines: [
      "Internal tools deserve real design — the team isn't a lesser user.",
      'Anyone could change a page without waiting on a developer.',
      'Making it behave in every browser took longer than building it.',
    ],
    caption: 'Frontend Developer — IU Networks, 2020–21',
    stamps: [],
    tech: ['Frontend', 'Drag-and-drop', 'Cross-browser'],
    accent: PALETTE.honey,
  },
  {
    id: 'sportion',
    theme: 'The small stuff',
    hook: 'Eight months on a sports platform. All the small stuff.',
    lines: ['The kind of work nobody screenshots.', 'Session time went up 15% anyway.'],
    caption: 'UI/UX Engineer — Sportion, 2021',
    stamps: [],
    tech: ['UI', 'UX', 'Interaction'],
    accent: PALETTE.river,
  },
  {
    id: 'qiibee',
    theme: 'One system, thirteen looks',
    hook: 'Thirteen brands on one library — none of them looked bolted-on.',
    // THREE LINES, NOT FOUR. The pack carries an {ANECDOTE} slot here — one real
    // qiibee ticket showing pixel-level care — and it ships ABSENT rather than
    // filled: it is a question for Alwina, and inventing a war story about a real
    // person is the one thing this file may never do. The stop is written to read
    // complete without it.
    lines: [
      "White-label usually means lowest common denominator. Ours didn't.",
      'Each brand got its own look, not a recolored template.',
      'And new brands still launched 40% faster.',
    ],
    caption: 'React Developer — qiibee, 2021–23',
    stamps: ['13 clients', '−40% build time'],
    tech: ['React', 'Component library', 'Design system'],
    accent: PALETTE.dune,
  },
  {
    id: 'wooskill',
    theme: 'The page builder',
    hook: 'I went full-stack: React up top, PHP and AWS underneath.',
    lines: [
      'Tools for non-developers have to be better-built, not just simpler.',
      'Non-technical teams shipped their own pages with it.',
      'Page load dropped 20% while I was down there.',
    ],
    caption: 'Full-stack Software Engineer — Wooskill, 2023–24',
    stamps: ['−20% load'],
    tech: ['React', 'PHP', 'AWS'],
    accent: PALETTE.tuff,
  },
  {
    id: 'sync-design',
    theme: 'The dashboards',
    hook: 'Now I build dashboards where the data never sits still.',
    lines: [
      'Real-time is a different discipline — nothing on screen waits for you.',
      'I keep the infrastructure under it too: code, three stacks.',
    ],
    caption: 'Frontend Engineer — Sync Design Tech, 2025–now',
    stamps: [],
    tech: ['Real-time', 'Maps', 'Infra as code'],
    accent: PALETTE.blossomDeep,
  },
]
