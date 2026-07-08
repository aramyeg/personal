import type { Metadata } from 'next'
import { LabsList } from '@/components/labs/labs-list'

export const metadata: Metadata = {
  title: 'Style Lab | Aram Yeghiazaryan',
  description:
    'One portfolio, many design systems. Each experiment re-skins the same content in a different visual identity — an exercise in un-slopping AI-assisted design.',
}

export default function LabsPage() {
  return (
    <main className="min-h-screen">
      <LabsList />
    </main>
  )
}
