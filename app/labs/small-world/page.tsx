import type { Metadata } from 'next'
import { Baloo_2, Bangers, Nunito_Sans } from 'next/font/google'
import { GalleryChrome } from '@/components/labs/gallery-chrome'
import { FallbackTimeline } from '@/components/labs/small-world/fallback-timeline'
import { SmallWorldLoader } from '@/components/labs/small-world/small-world-loader'

const displayFont = Baloo_2({ subsets: ['latin'], weight: ['600', '700'], variable: '--sw-font-display' })
const panelFont = Bangers({ subsets: ['latin'], weight: '400', variable: '--sw-font-panel' })
const bodyFont = Nunito_Sans({ subsets: ['latin'], variable: '--sw-font-body' })

export const metadata: Metadata = {
  title: 'Small World — Style Lab | Aram Yeghiazaryan',
  description:
    'Style Lab experiment: a career told as one skip around a tiny clay planet — six chapters, six landscapes, scroll to travel.',
  openGraph: {
    title: 'Small World — Style Lab',
    description: 'A clay planet small enough to walk in an afternoon — every lap of it is a career.',
    images: [{ url: '/labs/small-world/poster.jpg', width: 768, height: 1024 }],
  },
}

export default function SmallWorldLabPage() {
  return (
    <GalleryChrome>
      <div className={`${displayFont.variable} ${panelFont.variable} ${bodyFont.variable}`}>
        <FallbackTimeline />
        <SmallWorldLoader />
      </div>
    </GalleryChrome>
  )
}
