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
export function InfoLeaf({ chapter, enter }: { chapter: number; enter: number }) {
  return (
    <BookLeaf side="right" enter={enter} className="sw-panel-data" testId="sw-panel-data">
      <InfoPage chapter={chapter} enter={enter} />
    </BookLeaf>
  )
}
