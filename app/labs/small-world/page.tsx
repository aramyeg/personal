import type { Metadata } from 'next'
import { GalleryChrome } from '@/components/labs/gallery-chrome'
import { FallbackTimeline } from '@/components/labs/small-world/fallback-timeline'
import { SmallWorldLoader } from '@/components/labs/small-world/small-world-loader'

export const metadata: Metadata = {
  title: 'Small World — Style Lab | Aram Yeghiazaryan',
  description:
    'Style Lab experiment: a career told as one skip around a tiny clay planet — six chapters, six landscapes, scroll to travel.',
  openGraph: {
    title: 'Small World — Style Lab',
    description: 'A clay planet small enough to walk in an afternoon — every lap of it is a career.',
    images: ['/labs/small-world/poster.jpg'],
  },
}

export default function SmallWorldLabPage() {
  return (
    <GalleryChrome>
      <FallbackTimeline />
      <SmallWorldLoader />
    </GalleryChrome>
  )
}
