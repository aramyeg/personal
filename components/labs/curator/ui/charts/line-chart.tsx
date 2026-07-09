'use client'

import { useEffect, useState } from 'react'
import type { TrafficPoint } from '../../analytics-source'
import { scalePoints, linePath, areaPath } from './chart-math'

const W = 640
const H = 180

export function LineChart({ data, annotations = [], title, caption }: {
  data: TrafficPoint[]; annotations?: { date: string; label: string }[]; title: string; caption?: string
}) {
  const pts = scalePoints(data.map((p) => p.visitors), W, H, 8)
  const xByDate = new Map(data.map((p, i) => [p.date, pts[i]?.x ?? 0]))
  const [drawn, setDrawn] = useState(false)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setDrawn(true)
      return
    }
    const id = requestAnimationFrame(() => setDrawn(true))
    return () => cancelAnimationFrame(id)
  }, [])

  return (
    <figure className="rounded-[6px] border border-[var(--c-border)] bg-[var(--c-surface)] p-4">
      <figcaption className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--c-text-soft)]">
        {title}
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 h-[180px] w-full" preserveAspectRatio="none" role="img" aria-label={title}>
        <path d={areaPath(pts, H)} fill="var(--c-blue)" opacity={0.08} />
        {annotations.map((a) => {
          const x = xByDate.get(a.date)
          if (x === undefined) return null
          return <line key={a.date} x1={x} x2={x} y1={0} y2={H} stroke="var(--c-border)" strokeDasharray="3 3" />
        })}
        <path
          d={linePath(pts)}
          fill="none" stroke="var(--c-blue)" strokeWidth={1.5}
          pathLength={1} strokeDasharray={1} strokeDashoffset={drawn ? 0 : 1}
          style={{ transition: 'stroke-dashoffset 600ms ease-out' }}
        />
      </svg>
      <div className="mt-1 flex justify-between font-[family-name:var(--font-data)] text-[10px] text-[var(--c-text-soft)]">
        <span>{data[0]?.date}</span>
        {caption && <span>{caption}</span>}
        <span>{data[data.length - 1]?.date}</span>
      </div>
    </figure>
  )
}
