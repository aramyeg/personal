import type { Metadata } from 'next'
import { Suspense } from 'react'
import { LabsList } from '@/components/labs/labs-list'
import { LabsViewSwitch } from '@/components/labs/labs-view-switch'

export const metadata: Metadata = {
  title: 'Style Lab | Aram Yeghiazaryan',
  description:
    'One portfolio, many design systems. Each experiment re-skins the same content in a different visual identity — an exercise in un-slopping AI-assisted design.',
}

export default function LabsPage() {
  return (
    <main className="min-h-screen">
      <Suspense fallback={<LabsList />}>
        <LabsViewSwitch />
      </Suspense>
    </main>
  )
}
