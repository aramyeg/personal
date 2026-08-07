import type { Metadata } from 'next'
import { Baloo_2, Bangers, Caveat, Nunito_Sans } from 'next/font/google'
import { GalleryChrome } from '@/components/labs/gallery-chrome'
import { FallbackTimeline } from '@/components/labs/small-world/fallback-timeline'
import { ALWINA } from '@/components/labs/small-world/alwina-cv'
import { SmallWorldLoader } from '@/components/labs/small-world/small-world-loader'

const displayFont = Baloo_2({ subsets: ['latin'], weight: ['600', '700'], variable: '--sw-font-display' })
const panelFont = Bangers({ subsets: ['latin'], weight: '400', variable: '--sw-font-panel' })
const bodyFont = Nunito_Sans({ subsets: ['latin'], variable: '--sw-font-body' })
// Task 65 — the ending's hand. Read by the connect block AND painted into the desk note's canvas
// texture, so the writing in the scene and the writing in the DOM are the same typeface.
const handFont = Caveat({ subsets: ['latin'], weight: ['400', '700'], variable: '--sw-font-hand' })

/**
 * THE TAB, THE BOOKMARK AND EVERY LINK PREVIEW CARRY HER NAME (Task 85, finding 1).
 *
 * The title was `Small World — Style Lab | Aram Yeghiazaryan`, so the one thing
 * a recruiter sees before the page paints — and the one thing that travels when
 * the URL is pasted anywhere — named the wrong person on a page that is
 * Alwina's CV. The audit found it alongside the contact pills and it is the same
 * defect: the loud copy of the identity disagreed with the quiet one.
 *
 * The name comes from `alwina-cv.ts` rather than a literal, for the reason that
 * file exists: her name is now printed by the sheet, the plain CV, the connect
 * pill's label and this, and four transcriptions of one string is how the two
 * old CV surfaces had already drifted.
 *
 * "STYLE LAB" IS GONE FROM THE TITLE and that is deliberate rather than tidying.
 * It names the series this was built for, which is Aram's frame around her CV; a
 * link preview should say whose career it is. The series still owns the museum
 * route that links here.
 */
export const metadata: Metadata = {
  title: `Small World — ${ALWINA.name}`,
  description: `${ALWINA.says} A career told as one lap of a tiny clay planet — six chapters, six landscapes, scroll to travel.`,
  openGraph: {
    title: `Small World — ${ALWINA.name}`,
    description: 'A clay planet small enough to walk in an afternoon — every lap of it is a career.',
    images: [{ url: '/labs/small-world/poster.jpg', width: 768, height: 1024 }],
  },
}

export default function SmallWorldLabPage() {
  return (
    <GalleryChrome>
      {/* `data-sw-fonts` is the handle the desk note resolves `--sw-font-hand` through — a canvas
          texture cannot read a CSS variable, so it probes the element that carries them. */}
      <div
        data-sw-fonts=""
        className={`${displayFont.variable} ${panelFont.variable} ${bodyFont.variable} ${handFont.variable}`}
      >
        <FallbackTimeline />
        <SmallWorldLoader />
      </div>
    </GalleryChrome>
  )
}
