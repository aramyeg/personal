'use client'

import { useEffect, useState } from 'react'
import { useEscCapture } from './use-esc-capture'
import { useCuratorStore } from './store'

const SCORES = Array.from({ length: 11 }, (_, i) => i)

export function NpsSurvey() {
  const [open, setOpen] = useState(false)
  const npsDone = useCuratorStore((s) => s.npsDone)
  const visits = useCuratorStore((s) => s.moduleVisits)
  const tourOpen = useCuratorStore((s) => s.tourOpen)
  const markNpsDone = useCuratorStore((s) => s.markNpsDone)
  const pushToast = useCuratorStore((s) => s.pushToast)

  useEffect(() => {
    if (npsDone || tourOpen) return
    const timer = setTimeout(() => setOpen(true), 90_000)
    return () => clearTimeout(timer)
  }, [npsDone, tourOpen])

  useEffect(() => {
    if (visits >= 3 && !npsDone && !tourOpen) setOpen(true)
  }, [visits, npsDone, tourOpen])

  function resolve(scored: boolean): void {
    setOpen(false)
    markNpsDone()
    if (scored) pushToast({ title: 'Thanks for your feedback' })
  }

  useEscCapture(open, () => resolve(false))

  if (npsDone || !open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(12,35,64,0.4)]"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) resolve(false)
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Feedback survey"
        className="w-full max-w-[420px] rounded-[6px] border border-[var(--c-border)] bg-[var(--c-surface)] p-4"
      >
        <p className="text-[13px] font-semibold text-[var(--c-text)]">
          How likely are you to recommend this CV to a colleague or recruiter?
        </p>
        <p className="mt-1 text-[12px] text-[var(--c-text-soft)]">
          Your feedback helps us improve the candidate experience.
        </p>
        <div className="mt-4 flex gap-1.5">
          {SCORES.map((score) => (
            <button
              key={score}
              type="button"
              aria-label={String(score)}
              onClick={() => resolve(true)}
              className="flex h-7 w-7 touch-manipulation items-center justify-center rounded-[4px] border border-[var(--c-border)] font-[family-name:var(--font-data)] text-[12px] text-[var(--c-text)] transition-colors duration-150 hover:bg-[var(--c-navy)] hover:text-white"
            >
              {score}
            </button>
          ))}
        </div>
        <div className="mt-2 flex items-center justify-between text-[10px] text-[var(--c-text-soft)]">
          <span>Not likely at all</span>
          <span>Extremely likely</span>
        </div>
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={() => resolve(false)}
            className="text-[12px] text-[var(--c-text-soft)] transition-colors duration-150 hover:text-[var(--c-text)]"
          >
            Remind me later
          </button>
        </div>
      </div>
    </div>
  )
}
