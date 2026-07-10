import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { GalleryChrome } from '@/components/labs/gallery-chrome'
import { CuratorRoot } from '@/components/labs/curator/curator-root'
import { SESSION_COOKIE, verifySession } from '@/components/labs/curator/server/session'

export const metadata: Metadata = {
  title: 'Curator — Style Lab | Aram Yeghiazaryan',
  description:
    'Style Lab experiment #4: the portfolio as enterprise SaaS — a navy-and-white operations console where the museum itself is the managed asset.',
  openGraph: {
    title: 'Curator — Style Lab',
    description:
      'The portfolio as enterprise SaaS. Every ritual played straight; the pagination paginates six rows.',
    images: ['/labs/curator/poster.jpg'],
  },
}

export default async function CuratorLabPage() {
  const jar = await cookies()
  const session = await verifySession(jar.get(SESSION_COOKIE)?.value)
  return (
    <GalleryChrome>
      <CuratorRoot session={session} />
    </GalleryChrome>
  )
}
