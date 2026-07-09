import type { Metadata } from 'next'
import { GalleryChrome } from '@/components/labs/gallery-chrome'
import { XpDesktopLoader } from '@/components/labs/xp/desktop-loader'

export const metadata: Metadata = {
  title: 'Bliss — Style Lab | Aram Yeghiazaryan',
  description:
    'Style Lab experiment #3: the portfolio as a Windows XP desktop — Luna chrome, the real boot chime, a helpful paperclip.',
  openGraph: {
    title: 'Bliss — Style Lab',
    description:
      'The portfolio as a Windows XP desktop. The most beloved OS ever shipped, rebuilt as a design system.',
    images: ['/labs/xp/poster.jpg'],
  },
}

export default function XpLabPage() {
  return (
    <GalleryChrome>
      <main className="fixed inset-0 overflow-hidden">
        <XpDesktopLoader />
      </main>
    </GalleryChrome>
  )
}
