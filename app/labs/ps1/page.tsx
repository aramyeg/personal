import type { Metadata } from 'next'
import Link from 'next/link'
import { PS1Scene } from '@/components/labs/ps1/ps1-scene'
import { MemoryCard } from '@/components/labs/ps1/memory-card'
import { GalleryChrome } from '@/components/labs/gallery-chrome'

export const metadata: Metadata = {
  title: 'PS1 / Y2K — Style Lab | Aram Yeghiazaryan',
  description:
    'Style Lab experiment #1: the same portfolio re-skinned as a PS1-era boot world — software rendering, ordered dithering, memory-card saves.',
  openGraph: {
    title: 'PS1 / Y2K — Style Lab',
    description:
      'The same portfolio re-skinned as a PS1-era boot world: software rendering, ordered dithering, projects as memory-card saves.',
  },
}

export default function PS1LabPage() {
  return (
    <GalleryChrome>
      {/* The lab owns its whole visual world — the site theme does not apply here */}
      <main className="min-h-dvh bg-[#07090d] text-[#e8edf4] font-mono">
        <PS1Scene />
        <MemoryCard />

        <footer className="max-w-[860px] mx-auto px-5 pb-24 pt-6 flex flex-wrap items-center justify-between gap-4 text-[11px] tracking-[.18em] uppercase text-[#87919f]">
          <span>
            Style Lab № 1 — same content, different world.{' '}
          </span>
          <span className="flex gap-6">
            <Link href="/labs" className="hover:text-[#5583ff] transition-colors">
              ← All experiments
            </Link>
            <Link href="/" className="hover:text-[#5583ff] transition-colors">
              Main site
            </Link>
          </span>
        </footer>
      </main>
    </GalleryChrome>
  )
}
