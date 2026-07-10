import type { Metadata } from 'next'
import { GalleryChrome } from '@/components/labs/gallery-chrome'
import { MemoryCardChrome } from '@/components/labs/memory-card/sections/chrome'
import { SaveSelectScreen } from '@/components/labs/memory-card/save-select/screen'
import { MemoryCardAudioProvider } from '@/components/labs/memory-card/audio-context'
import { GlyphCursor } from '@/components/labs/memory-card/cursor'
import { siteConfig } from '@/lib/constants'

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
      <MemoryCardAudioProvider>
        <GlyphCursor />
        <MemoryCardChrome />
        <SaveSelectScreen />

        {/* Plain-HTML fallback so the save data stays crawlable with JS off.
            Non-heading so it never competes with the screen's own <h1>. */}
        <noscript>
          <div>
            <p>
              <strong>{siteConfig.name}</strong> — Senior Frontend Engineer
            </p>
            <p>{siteConfig.description}</p>
            <p>
              <a href={`mailto:${siteConfig.email}`}>{siteConfig.email}</a>
            </p>
          </div>
        </noscript>
      </MemoryCardAudioProvider>
    </GalleryChrome>
  )
}
