/**
 * "written with" — the save file's own metadata.
 *
 * This lab IS a save file; the skills section is its curated metadata: the
 * short, honest stack that actually wrote THIS page. Not the portfolio's full
 * skill inventory (that lives on the main site) — only what built the lab you
 * are looking at. This is lab copy, like 'select your file', not portfolio
 * data, so it lives here rather than in `data/`.
 *
 * Each `note` points at something real and present on this page. Where a name
 * also exists in `data/skills.ts` its exact string is reused (React, Next.js,
 * TypeScript, Tailwind CSS); Framer Motion / three.js / Vitest are lab-local
 * additions the portfolio data never listed.
 */
export type WrittenWithEntry = {
  /** Exact `data/skills.ts` name where one exists; lab-local name otherwise. */
  name: string
  /** Short lowercase mono note aimed at something visible/real on this page. */
  note: string
}

export const WRITTEN_WITH: readonly WrittenWithEntry[] = [
  { name: 'React', note: 'the component tree behind every section' },
  { name: 'Next.js', note: 'the app router that served this route' },
  { name: 'TypeScript', note: 'every design token, typed at the source' },
  { name: 'Tailwind CSS', note: 'this panel, spaced one utility at a time' },
  { name: 'Framer Motion', note: 'the headline wipe you just watched' },
  { name: 'three.js', note: 'the character posed inside the capsule' },
  { name: 'Vitest', note: 'every section, asserted before it shipped' },
] as const
