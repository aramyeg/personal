'use client'

import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react'
import { SKILL_TREE_COLORS } from '@/lib/game/skillTree'

type Props = {
  zoom: number
  onZoomIn: () => void
  onZoomOut: () => void
  onResetView: () => void
}

export function ZoomControls({ zoom, onZoomIn, onZoomOut, onResetView }: Props) {
  const zoomPercent = Math.round(zoom * 100)

  return (
    <div
      className="absolute bottom-3 right-3 flex flex-col rounded-lg overflow-hidden backdrop-blur-sm"
      style={{
        backgroundColor: `${SKILL_TREE_COLORS.nodeInactive}e6`,
        border: `1px solid ${SKILL_TREE_COLORS.nodeBorder}`,
      }}
    >
      <button
        onClick={onZoomIn}
        disabled={zoom >= 2}
        className="p-2 transition-colors hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed"
        aria-label="Zoom in"
      >
        <ZoomIn className="w-4 h-4" style={{ color: SKILL_TREE_COLORS.text }} />
      </button>

      <div
        className="text-xs text-center py-1 font-mono"
        style={{
          color: SKILL_TREE_COLORS.textMuted,
          borderTop: `1px solid ${SKILL_TREE_COLORS.nodeBorder}`,
          borderBottom: `1px solid ${SKILL_TREE_COLORS.nodeBorder}`,
        }}
      >
        {zoomPercent}%
      </div>

      <button
        onClick={onZoomOut}
        disabled={zoom <= 0.5}
        className="p-2 transition-colors hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed"
        aria-label="Zoom out"
      >
        <ZoomOut className="w-4 h-4" style={{ color: SKILL_TREE_COLORS.text }} />
      </button>

      <button
        onClick={onResetView}
        className="p-2 transition-colors hover:bg-white/10"
        style={{ borderTop: `1px solid ${SKILL_TREE_COLORS.nodeBorder}` }}
        aria-label="Reset view"
      >
        <Maximize2 className="w-4 h-4" style={{ color: SKILL_TREE_COLORS.textMuted }} />
      </button>
    </div>
  )
}
