'use client'

/**
 * Intercepting overlay for a loaded save. On client navigation from the screen
 * (`router.push('/labs/memory-card/save/[id]')`) this slot renders the save as a
 * paper panel OVER the still-visible character-select screen; a hard load of the
 * same URL bypasses the intercept and hits the standalone `save/[id]/page.tsx`
 * instead.
 *
 * Closing — the panel's close button, Escape, or a click on the scrim — pops the
 * history entry (`router.back()`) and fires the back() blip. The overlay carries
 * its own audio provider because it lives in a sibling slot to the screen's, and
 * both resolve the same module-level audio instance. Below `lg` the panel fills
 * the viewport as a sheet; at `lg+` it centers as a card over the ink scrim.
 */

import { useCallback } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { notFound, useParams, useRouter } from 'next/navigation'
import {
  MemoryCardAudioProvider,
  useMemoryCardAudioActions,
} from '@/components/labs/memory-card/audio-context'
import { PanelShell } from '@/components/labs/memory-card/panels/panel-shell'
import { SavePanel } from '@/components/labs/memory-card/panels/save-panel'
import { accentFor, inkAlpha } from '@/components/labs/memory-card/tokens'
import { projects, type ExtendedProject } from '@/data/projects'

export default function InterceptedSavePanel() {
  const params = useParams<{ id: string }>()
  const project = projects.find((p) => p.id === params.id)
  if (!project) notFound()

  return (
    <MemoryCardAudioProvider>
      <SaveOverlay project={project} />
    </MemoryCardAudioProvider>
  )
}

function SaveOverlay({ project }: { project: ExtendedProject }) {
  const router = useRouter()
  const { back } = useMemoryCardAudioActions()
  const reduced = useReducedMotion()

  const close = useCallback(() => {
    back()
    router.back()
  }, [back, router])

  const index = projects.findIndex((p) => p.id === project.id)
  const accent = accentFor(index < 0 ? 0 : index)

  return (
    <motion.div
      className="fixed inset-0 z-50 flex lg:items-center lg:justify-center lg:p-6"
      style={{ background: inkAlpha(0.6), ['--mc-ring' as string]: accent }}
      onClick={close}
      // Panels fade only — no slide/scale — and instant under reduced motion.
      initial={reduced ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.18, ease: [0, 0, 0.2, 1] }}
    >
      <div className="w-full lg:max-w-[46rem]">
        <PanelShell title={project.title} onClose={close}>
          <SavePanel project={project} />
        </PanelShell>
      </div>
    </motion.div>
  )
}
