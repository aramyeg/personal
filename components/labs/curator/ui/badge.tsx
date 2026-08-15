import type { ReactNode } from 'react'

const TONES = {
  ok: 'bg-[#e6f4ec] text-[var(--c-ok)]',
  warn: 'bg-[#fdf0e3] text-[var(--c-warn)]',
  bad: 'bg-[#fae8ec] text-[var(--c-bad)]',
  neutral: 'bg-[#eef1f6] text-[var(--c-text-soft)]',
} as const

export function Badge({ tone = 'neutral', children }: { tone?: keyof typeof TONES; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${TONES[tone]}`}>
      {children}
    </span>
  )
}
