import type { Metadata } from 'next'
import { GalleryChrome } from '@/components/labs/gallery-chrome'
import { MemoryCardChrome } from '@/components/labs/memory-card/sections/chrome'
import { HeroSection } from '@/components/labs/memory-card/sections/hero'
import { WorkSection } from '@/components/labs/memory-card/sections/work'
import { SkillsSection } from '@/components/labs/memory-card/sections/skills'
import { MC } from '@/components/labs/memory-card/tokens'

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
      <MemoryCardChrome />
      <main className="min-h-screen" style={{ background: MC.ink, color: MC.paper }}>
        <HeroSection />
        <WorkSection />
        <SkillsSection />
      </main>
    </GalleryChrome>
  )
}
