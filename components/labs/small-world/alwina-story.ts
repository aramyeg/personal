/**
 * Alwina's story — the six chapters the little world is now about.
 *
 * The lab used to map `@/data/experience`, which is Aram's CV. It is a GIFT
 * now, so the words are hers. Every string below is transcribed from the
 * approved story pack (`.superpowers/sdd/alwina-manga-prompt-pack.md`) — hooks,
 * lines and captions verbatim, in the pack's voice. This file is deliberately
 * separate from `data/experience.ts` and does not import it: the portfolio's
 * own Experience section still renders Aram's career from there, and the two
 * must never learn about each other.
 *
 * NOTHING here comes from outside the pack. The one place that needed judgement
 * is `stamps` and `tech`, which the pack does not list as fields — both are
 * built ONLY from nouns and figures the pack's own lines already contain (see
 * the note on `tech`), so no claim is made about her that the pack does not
 * make. Confirm the tech rows against her real CV before this ships.
 *
 * Chapter order is the journey order, and it is also the biome order: chapter i
 * is told over biome i (spring, meadow, delta, desert, canyon, winter), which is
 * how the pack was written — "The Observatory" is a winter summit because the
 * sixth biome is winter.
 */
import { PALETTE } from './palette'

export type StoryChapter = {
  id: string
  /** The pack's chapter title. Also the staging direction's name. */
  theme: string
  /** The opening line, set in display type. */
  hook: string
  /** The body: short sentences, in the pack's order. */
  lines: string[]
  /** The footer credit, exactly as the pack writes it. */
  caption: string
  /** Short badges that land last, like a stamp press. Figures from `lines`. */
  stamps: string[]
  /**
   * Pill row. Every entry is a word the pack itself uses for that chapter's
   * work — "drag-and-drop", "cross-browser", "component library",
   * "infrastructure", "real-time", "maps" — rather than a stack guessed from
   * the company name. Inference is fine; invention about a real person is not.
   */
  tech: string[]
  accent: string
}

export const ALWINA_STORY: readonly StoryChapter[] = [
  {
    id: 'lyon',
    theme: 'The Pull',
    hook: 'She studied how people choose — then taught herself to build the things they choose.',
    lines: ['Master of Marketing & Business, Lyon.', 'Four languages.', 'One self-taught pivot.'],
    caption: 'Université Jean Moulin Lyon III · 2013–2019',
    stamps: ['4 languages', '1 pivot'],
    tech: ['Marketing', 'Business', 'Self-taught code'],
    accent: PALETTE.sprout,
  },
  {
    id: 'iu-networks',
    theme: 'First Tools',
    hook: 'Her first job set the lifelong theme: build the tool that lets everyone else build.',
    lines: [
      'A drag-and-drop interface builder — no code needed by anyone but her.',
      'Rock-solid in every browser.',
    ],
    caption: 'Frontend Developer · IU Networks · 2020–2021',
    stamps: ['no code needed', 'every browser'],
    tech: ['Frontend', 'Drag-and-drop', 'Cross-browser'],
    accent: PALETTE.honey,
  },
  {
    id: 'sportion',
    theme: 'Taste',
    hook: 'She learned that flow is a craft — polish every stone people step on.',
    lines: ['Session time up 15%.', 'Operations 30% smoother.', 'Details are the product.'],
    caption: 'UI/UX Engineer · Sportion · 2021',
    stamps: ['+15% session', '30% smoother'],
    tech: ['UI', 'UX', 'Interaction'],
    accent: PALETTE.river,
  },
  {
    id: 'qiibee',
    theme: 'One Craft, Many Colors',
    hook: 'One well-made system — thirteen brands around the world.',
    lines: [
      'A component library that cut build time 40%.',
      'Revenue up 42%.',
      'Craft that scales is still craft.',
    ],
    caption: 'React Developer · qiibee · 2021–2023',
    stamps: ['13 brands', '−40% build', '+42% revenue'],
    tech: ['React', 'Component library', 'Design system'],
    accent: PALETTE.dune,
  },
  {
    id: 'wooskill',
    theme: 'Deeper',
    hook: 'She went full-stack — down to the foundations — and still handed the tools over.',
    lines: [
      'Frontend to backend to infrastructure.',
      'A page builder for non-technical teams.',
      'Load −20%, conversion +19%, retention +15%.',
    ],
    caption: 'Full-stack Software Engineer · Wooskill · 2023–2024',
    stamps: ['−20% load', '+19% conversion', '+15% retention'],
    tech: ['Frontend', 'Backend', 'Infrastructure', 'Page builder'],
    accent: PALETTE.tuff,
  },
  {
    id: 'sync-design',
    theme: 'The Observatory',
    hook: 'Now she owns the glass — and the foundations under the snow.',
    lines: [
      'Real-time maps, camera feeds, living data.',
      'Infrastructure as code across three stacks.',
      'The whole picture, hers.',
    ],
    caption: 'Frontend Engineer · Sync Design Tech · 2025–now',
    stamps: ['3 stacks', 'living data'],
    tech: ['Real-time', 'Maps', 'Infrastructure as code'],
    accent: PALETTE.blossomDeep,
  },
]
