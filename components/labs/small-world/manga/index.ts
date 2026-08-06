import { withRevision } from './dialogue-revision'
import { EPILOGUE } from './epilogue'
import { PAGE_0 } from './page-0'
import { PAGE_1 } from './page-1'
import { PAGE_2 } from './page-2'
import { PAGE_3 } from './page-3'
import { PAGE_4 } from './page-4'
import { PAGE_5 } from './page-5'
import type { MangaPage } from './types'

/**
 * One page per chapter stop, in journey order.
 *
 * The lettering runs through `withRevision`, which is where Aram's proposed
 * dialogue swaps live while he judges them (`dialogue-revision.ts` — one flag
 * reverts every page to the wording that shipped). The ART is untouched by it:
 * the pages carry blank balloons and the site typesets them, so a swap is a
 * string and never a re-render.
 */
export const MANGA_PAGES: readonly MangaPage[] = [PAGE_0, PAGE_1, PAGE_2, PAGE_3, PAGE_4, PAGE_5].map(
  withRevision
)

/**
 * The wordless closing page. It has no chapter stop of its own — the pack hands
 * off to the lab's 3D desk ending here — so it is prepared and shipped but not
 * yet mounted anywhere. Exported so the ending lane can pick it up without
 * re-deriving its geometry.
 */
export { EPILOGUE }

export const mangaPageFor = (chapterIndex: number): MangaPage | undefined => MANGA_PAGES[chapterIndex]

export type { MangaPage, Rect, Point, Balloon, Caption } from './types'
export { mangaPageSrc } from './types'
