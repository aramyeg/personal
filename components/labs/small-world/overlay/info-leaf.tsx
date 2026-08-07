'use client'
import { BookLeaf } from './book-leaf'
import { InfoPage } from './info-page'

/**
 * The book's RIGHT leaf: the page about her work.
 *
 * This replaces the old `StoryCard`, and the replacement is the point of the
 * round rather than a refactor of it. That card was a different design system
 * parked beside a comic — pastel pills, a heading, three sentences — and it
 * described her in the third person. This is a manga page in the same ink as the
 * leaf beside it, in her own voice, built to be LOOKED at: a close-up cut from
 * her own printed page, her figures stamped, her count drawn, her tools on a
 * rail, and one sentence.
 *
 * The frame is `BookLeaf` (shared with the story page); everything inside it is
 * `info-page.tsx`; what it says for each chapter is `info-page-spec.ts`.
 *
 * `sw-panel-data` is kept as the test id: it is what the e2e suite, the panel-tap
 * tests and the phone stack's CSS all reach for, and renaming it would be churn
 * in six files to say the same thing.
 */
export function InfoLeaf({
  chapter,
  enter,
  page,
}: {
  chapter: number
  enter: number
  /**
   * The page's ink progress 0→1, scroll-pure. TWO CLOCKS ARRIVE HERE AND THEY ARE
   * NOT THE SAME KIND: `enter` is the leaf's screen-space entrance and may ride
   * the arrival wall clock; `page` is what the page inside is DRAWN from and may
   * only ever be a function of scroll. Keeping them separate at the boundary is
   * what stops the second one quietly becoming the first again.
   */
  page: number
}) {
  return (
    <BookLeaf side="right" enter={enter} className="sw-panel-data" testId="sw-panel-data" swallowClicks>
      <InfoPage chapter={chapter} page={page} />
    </BookLeaf>
  )
}
