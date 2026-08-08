import type { Metadata } from 'next'
import { GalleryChrome } from '@/components/labs/gallery-chrome'
import { ClothPullLoader } from '@/components/labs/cloth-pull/cloth-pull-loader'
import { DEFAULT_MESSAGE } from '@/lib/labs/cloth-pull/config'

export const metadata: Metadata = {
  title: 'Cloth Pull — Style Lab | Aram Yeghiazaryan',
  description:
    'A chibi hauls a cloth banner along a real rope — the message is written on the cloth and deforms with it. Drag to pull.',
  openGraph: {
    title: 'Cloth Pull — Style Lab',
    description:
      'A chibi hauls a cloth banner along a real rope. Drag to pull; the cloth answers.',
    images: ['/labs/cloth-pull/poster.jpg'],
  },
}

/** Message is swappable data: /labs/cloth-pull?m=Any+copy+you+like
 * Character A/B (Aram's pick 2026-08-08): 2.5D sprite Alwi is the DEFAULT;
 * the 3D chibi stays reachable behind ?c=3d. */
export default async function ClothPullPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string; c?: string }>
}) {
  const { m, c } = await searchParams
  const message = (m ?? DEFAULT_MESSAGE).slice(0, 90).trim() || DEFAULT_MESSAGE
  const character = c === '3d' ? ('3d' as const) : ('sprite' as const)

  return (
    <GalleryChrome>
      <main className="fixed inset-0 overflow-hidden">
        <h1 className="sr-only">Cloth Pull — a hauling toy</h1>
        <p className="sr-only">
          A chibi character stands on the left, gripping a rope that runs off
          the right edge of the screen. A cloth banner hangs from the rope and
          carries the message: {message}. Dragging the pointer left hauls the
          banner in; releasing lets it spring back. The left and right arrow
          keys nudge the rope.
        </p>
        <ClothPullLoader message={message} character={character} />
      </main>
    </GalleryChrome>
  )
}
