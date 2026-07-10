import { Suspense } from 'react'
import { LabsList } from '@/components/labs/labs-list'
import { LabsViewSwitch } from '@/components/labs/labs-view-switch'

export default function Home() {
  return (
    <main className="min-h-screen">
      <Suspense fallback={<LabsList />}>
        <LabsViewSwitch />
      </Suspense>
    </main>
  )
}
