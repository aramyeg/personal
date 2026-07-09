'use client'

import { projects } from '@/data/projects'
import { PanelShell, PSX_UI } from './panel-shell'

/**
 * Save-slot pixel motifs, ported from the v1 memory-card.tsx (deleted in Task
 * 12) — 8-motif pixels on a 16x16 canvas, one per slot, with scanline overlay.
 */
const SLOT_ICONS = [
  { color: '#37e39f', px: [[3, 1, 1, 1], [2, 2, 4, 1], [1, 3, 6, 1], [2, 4, 4, 1], [3, 5, 1, 1]] }, // diamond
  { color: '#5583ff', px: [[2, 1, 4, 1], [1, 2, 6, 3], [2, 5, 4, 1]] }, // disk
  { color: '#e8edf4', px: [[1, 1, 6, 1], [1, 2, 2, 1], [1, 3, 6, 1], [5, 4, 2, 1], [1, 5, 6, 1]] }, // S
] as const

function SlotIcon({ index }: { index: number }) {
  const icon = SLOT_ICONS[index % SLOT_ICONS.length]
  return (
    <svg
      viewBox="0 0 16 16"
      className="h-9 w-9 [image-rendering:pixelated]"
      shapeRendering="crispEdges"
      aria-hidden="true"
    >
      <rect width={16} height={16} fill="#10151c" />
      {icon.px.map(([x, y, w, h], i) => (
        <rect key={i} x={x * 2} y={y * 2} width={w * 2} height={h * 2} fill={icon.color} />
      ))}
      {Array.from({ length: 8 }, (_, i) => (
        <rect key={`s-${i}`} x={0} y={i * 2} width={16} height={1} fill="rgba(7,9,13,.35)" />
      ))}
    </svg>
  )
}

export function ProjectsPanel({ onClose }: { onClose: () => void }) {
  return (
    <PanelShell title="memory card · select data" onClose={onClose} sticker="saves">
      <div
        className="mb-3 flex items-center justify-between font-mono text-[11px] uppercase tracking-[0.16em]"
        style={{ color: PSX_UI.inkDim }}
      >
        <span>load save data</span>
        <span>{projects.length} saves</span>
      </div>

      <ul
        className="border-2"
        style={{
          borderColor: PSX_UI.borderSoft,
          backgroundImage:
            'linear-gradient(rgba(46,107,102,.14) 1px, transparent 1px), linear-gradient(90deg, rgba(46,107,102,.14) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }}
      >
        {projects.map((project, i) => {
          const inProgress = project.year.toLowerCase().includes('present')
          return (
            <li
              key={project.id}
              className="grid min-h-[44px] grid-cols-[36px_1fr] items-center gap-4 border-b-2 px-3 py-3 last:border-b-0 sm:grid-cols-[36px_1fr_auto]"
              style={{ borderColor: 'rgba(58,91,87,0.5)' }}
            >
              <SlotIcon index={i} />
              <div>
                <div
                  className="text-[14px] font-black uppercase tracking-[0.04em]"
                  style={{
                    color: PSX_UI.ink,
                    fontFamily: "'Arial Black','Helvetica Neue',Arial,sans-serif",
                  }}
                >
                  {project.title}
                </div>
                <div
                  className="mt-1 font-mono text-[10px] uppercase tracking-[0.1em]"
                  style={{ color: PSX_UI.inkDim }}
                >
                  {project.company}
                  {project.metrics?.slice(0, 2).map((m) => (
                    <span key={m}>
                      <span style={{ color: PSX_UI.teal }}> · </span>
                      {m}
                    </span>
                  ))}
                </div>
              </div>
              <div
                className="col-start-2 font-mono text-[10px] uppercase tracking-[0.16em] sm:col-start-3 sm:text-right"
                style={{ color: inProgress ? PSX_UI.yellow : PSX_UI.teal }}
              >
                {inProgress ? 'in progress' : 'saved'}
                <span className="mt-0.5 block" style={{ color: PSX_UI.inkDim }}>
                  {project.year}
                </span>
              </div>
            </li>
          )
        })}
      </ul>
    </PanelShell>
  )
}
