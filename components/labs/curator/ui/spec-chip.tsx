'use client'

import { useEffect, useRef, useState } from 'react'
import { getBrief } from '../annotations'
import { useCuratorStore } from '../store'
import { useEscCapture } from '../use-esc-capture'
import { BriefFields, BriefHeader } from './brief-fields'

export function SpecChip({ briefId }: { briefId: string }) {
  const brief = getBrief(briefId)
  const showSpecChips = useCuratorStore((s) => s.preferences.showSpecChips)
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  const close = () => setOpen(false)
  useEscCapture(open, close)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) close()
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  if (!showSpecChips) return null

  return (
    <div ref={rootRef} className="relative inline-flex">
      <button
        type="button"
        aria-label={`Spec ${brief.id}`}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center whitespace-nowrap rounded-[4px] border px-1.5 py-0.5 font-[family-name:var(--font-data)] text-[10px] font-medium uppercase tracking-[0.06em] transition-colors duration-150 ${
          open
            ? 'border-[var(--c-blue)] text-[var(--c-blue)]'
            : 'border-[var(--c-border)] text-[var(--c-text-soft)] hover:border-[var(--c-blue)] hover:text-[var(--c-blue)]'
        }`}
      >
        SPEC · {brief.title}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-40 mt-2 w-[340px] rounded-[6px] border border-[var(--c-border)] bg-[var(--c-surface)] p-4 text-left">
          <BriefHeader brief={brief} />
          <BriefFields brief={brief} />
        </div>
      )}
    </div>
  )
}
