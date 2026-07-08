import type { Metadata } from 'next'
import { GalleryChrome } from '@/components/labs/gallery-chrome'
import { SnowparkGameLoader } from '@/components/labs/snowpark/game-loader'

export const metadata: Metadata = {
  title: 'Powder Lines — Style Lab | Aram Yeghiazaryan',
  description:
    'Style Lab experiment #2: the CV as a snowboard run — every kicker, rail and box is a real skill; land the trick to collect it.',
  openGraph: {
    title: 'Powder Lines — Style Lab',
    description:
      'A playable snowboard descent drawn as pure geometry. Every obstacle is a real skill — land the trick to collect it.',
    images: ['/labs/snowpark/poster.jpg'],
  },
}

export default function SnowparkLabPage() {
  return (
    <GalleryChrome>
      <main className="fixed inset-0 overflow-hidden">
        <SnowparkGameLoader />
      </main>
    </GalleryChrome>
  )
}
