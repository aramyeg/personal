import { ALWINA_STORY, type StoryChapter } from './alwina-story'

export const CHAPTER_COUNT = 6

/**
 * A chapter as the lab renders it.
 *
 * This used to be a projection of `@/data/experience` — Aram's CV — with a
 * per-chapter staging direction bolted on. The lab tells ALWINA's story now, so
 * the shape follows her card layout (hook, lines, stamps, caption) and the
 * words come from `alwina-story.ts`. `data/experience.ts` is untouched and is
 * no longer imported here: the portfolio's own Experience section still renders
 * Aram's career from it, and the two stories must not learn about each other.
 *
 * The mapping is deliberately thin — one source of story words, and the only
 * thing added is the chapter's position, which is also the biome it is told
 * over (chapter 0 spring … chapter 5 winter).
 */
export type Chapter = StoryChapter & {
  /** 0-based position in the journey; also the index of the biome it is told over. */
  index: number
}

export const chapters: Chapter[] = ALWINA_STORY.map((c, index) => ({ ...c, index }))
