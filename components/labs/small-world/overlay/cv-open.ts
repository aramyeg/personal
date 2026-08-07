/**
 * THE SEAM BETWEEN THE ESCAPE HATCH'S DOORS AND THE ROOM BEHIND THEM (Task 83).
 *
 * The plain CV has two entry points and they live nowhere near each other: one is
 * printed on the first sheet the chibi unrolls, four components deep inside
 * `ChapterPanels` → `InfoLeaf` → `InfoPage` → `KetsuPanel` → `ClothDrag`; the
 * other sits beside the restart link in `EndingConnect`. The surface they open is
 * mounted once, in `JourneyOverlay`.
 *
 * Threading a callback down five levels to reach a leaf's contact row would put a
 * prop about a modal on every component in between, including three whose stories
 * and tests render them alone. This is the narrow seam instead, and it is the same
 * one `panel-tap.ts` uses for the same reason.
 *
 * THE LIFETIME IS THE OVERLAY'S. `JourneyOverlay` publishes its opener while it is
 * mounted; a link clicked when nothing is listening — a Storybook story, a unit
 * test rendering `InfoPage` on its own — is a no-op rather than a crash.
 */

/** The label, in one place, because both doors have to say the same word. */
export const CV_LABEL = 'the plain CV'

/** Test ids, exported so the specs and the capture harness never type a string. */
export const CV_TESTID = 'sw-cv'
export const CV_DOC_TESTID = 'sw-cv-doc'
export const CV_CLOSE_TESTID = 'sw-cv-close'
/**
 * The two doors: one printed on the first sheet, one in the ending's connect block.
 *
 * The ending's is named as a member of that block rather than as a CV thing,
 * because that is what it is — `ending-connect.test.tsx` enumerates every element
 * in the block that takes pointer events and this has to answer to that census
 * like the other four.
 */
export const CV_SHEET_LINK_TESTID = 'sw-cv-link-sheet'
export const CV_ENDING_LINK_TESTID = 'sw-connect-cv'

let opener: (() => void) | null = null

/**
 * Publish (or retract) the surface's open action.
 *
 * Retraction is guarded on IDENTITY for the reason `setPanelAdvance` is: React may
 * mount a replacement before running the previous one's cleanup, and an
 * unconditional clear in that order would wipe the incoming registration.
 */
export function setCvOpener(fn: (() => void) | null): () => void {
  opener = fn
  return () => {
    if (opener === fn) opener = null
  }
}

/** Open the plain CV, if anything is listening. */
export function openCv(): void {
  opener?.()
}

/** Whether a surface is mounted to open. Exported for tests and for nothing else. */
export function cvArmed(): boolean {
  return opener !== null
}
