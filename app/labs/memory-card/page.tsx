import type { Metadata } from 'next'
import { GalleryChrome } from '@/components/labs/gallery-chrome'

export const metadata: Metadata = {
  title: 'Memory Card — Style Lab | Aram Yeghiazaryan',
  description:
    'Style Lab experiment: the PS1 memory-card manager as an editorial designer site — crisp retro-3D, save-slot typography, button-glyph accents.',
  openGraph: {
    title: 'Memory Card — Style Lab',
    description:
      'The PS1 memory-card manager as an editorial site. No pixelation, all nostalgia.',
    images: ['/labs/memory-card/poster.jpg'],
  },
}

export default function MemoryCardLabPage() {
  return (
    <GalleryChrome>
      <main className="min-h-screen" style={{ background: '#101014', color: '#e9e7e0' }}>
        <h1 className="p-8 text-2xl">memory card</h1>
      </main>
    </GalleryChrome>
  )
}
