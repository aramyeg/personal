import type { Metadata } from 'next'
import { GalleryChrome } from '@/components/labs/gallery-chrome'
import { StorybookLoader } from '@/components/labs/storybook/storybook-loader'

export const metadata: Metadata = {
  title: 'Storybook — Style Lab | Aram Yeghiazaryan',
  description:
    'Style Lab experiment #5: the portfolio as a fantasy pop-up book — six kingdoms, one hero, paper dragons; every page turn a small theatre.',
  openGraph: {
    title: 'Storybook — Style Lab',
    description:
      'A Tale of Six Kingdoms — the portfolio as a fantasy pop-up book. Paper dragons included.',
    images: ['/labs/storybook/poster.jpg'],
  },
}

export default function StorybookLabPage() {
  return (
    <GalleryChrome>
      {/* StorybookLoader's own `.sb-root` already covers the viewport
          (fixed inset-0 overflow-hidden); no need to duplicate it here. */}
      <main>
        <StorybookLoader />
      </main>
    </GalleryChrome>
  )
}
