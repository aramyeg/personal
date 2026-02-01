'use client'

import { useEffect, useRef, useCallback, useMemo } from 'react'
import { Play, Pause, RotateCcw } from 'lucide-react'
import { SKILL_TREE_COLORS } from '@/lib/game/skillTree'

/** Animation speed: milliseconds per year */
const ANIMATION_INTERVAL_MS = 500

type Props = {
  year: number
  minYear: number
  maxYear: number
  isAnimating: boolean
  onYearChange: (year: number) => void
  onStartAnimation: () => void
  onStopAnimation: () => void
}

// Career milestones for visual markers
const CAREER_MILESTONES: Record<number, string> = {
  2016: 'Started',
  2018: 'FLYERBEE',
  2020: '360dialog',
  2022: 'Accenture',
  2024: 'xDataGroup',
}

export function TimelineSlider({
  year,
  minYear,
  maxYear,
  isAnimating,
  onYearChange,
  onStartAnimation,
  onStopAnimation,
}: Props) {
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const yearRef = useRef(year)

  // Keep yearRef in sync
  useEffect(() => {
    yearRef.current = year
  }, [year])

  // Animation loop
  useEffect(() => {
    if (!isAnimating) return

    if (yearRef.current >= maxYear) {
      onStopAnimation()
      return
    }

    intervalRef.current = setInterval(() => {
      const nextYear = yearRef.current + 1
      if (nextYear > maxYear) {
        onStopAnimation()
        if (intervalRef.current) clearInterval(intervalRef.current)
      } else {
        onYearChange(nextYear)
      }
    }, ANIMATION_INTERVAL_MS)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [isAnimating, maxYear, onYearChange, onStopAnimation])

  const handleSliderChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onYearChange(parseInt(e.target.value, 10))
    },
    [onYearChange]
  )

  const handleReset = useCallback(() => {
    onStopAnimation()
    onYearChange(minYear)
  }, [minYear, onYearChange, onStopAnimation])

  const handleTogglePlay = useCallback(() => {
    if (isAnimating) {
      onStopAnimation()
    } else {
      if (year >= maxYear) onYearChange(minYear)
      onStartAnimation()
    }
  }, [isAnimating, year, maxYear, minYear, onYearChange, onStartAnimation, onStopAnimation])

  // Generate year markers
  const yearMarkers = useMemo(() => {
    const markers = []
    for (let y = minYear; y <= maxYear; y++) {
      const percent = ((y - minYear) / (maxYear - minYear)) * 100
      const isMilestone = CAREER_MILESTONES[y]
      const isActive = y <= year

      markers.push({
        year: y,
        percent,
        isMilestone: !!isMilestone,
        label: isMilestone,
        isActive,
      })
    }
    return markers
  }, [minYear, maxYear, year])

  const progressPercent = ((year - minYear) / (maxYear - minYear)) * 100

  return (
    <div
      className="absolute bottom-3 left-3 right-3 z-20 px-4 py-3 rounded-xl backdrop-blur-md"
      style={{
        backgroundColor: 'rgba(13, 17, 23, 0.95)',
        border: `1px solid ${SKILL_TREE_COLORS.nodeBorder}`,
        boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.3)',
      }}
    >
      {/* Controls row */}
      <div className="flex items-center gap-4 mb-3">
        {/* Play/Pause button */}
        <button
          onClick={handleTogglePlay}
          className="flex items-center justify-center w-10 h-10 rounded-full transition-all duration-200 hover:scale-105"
          style={{
            backgroundColor: isAnimating ? '#f78166' : '#58a6ff',
            boxShadow: isAnimating
              ? '0 0 20px rgba(247, 129, 102, 0.4)'
              : '0 0 20px rgba(88, 166, 255, 0.4)',
          }}
          aria-label={isAnimating ? 'Pause timeline' : 'Play timeline'}
        >
          {isAnimating ? (
            <Pause className="w-5 h-5 text-white" />
          ) : (
            <Play className="w-5 h-5 text-white ml-0.5" />
          )}
        </button>

        {/* Title and current year */}
        <div className="flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-medium" style={{ color: SKILL_TREE_COLORS.text }}>
              Career Journey
            </span>
            <span className="text-xs" style={{ color: SKILL_TREE_COLORS.textMuted }}>
              {minYear} - {maxYear}
            </span>
          </div>
          <div
            className="text-xs mt-0.5"
            style={{ color: SKILL_TREE_COLORS.textMuted }}
          >
            {isAnimating ? 'Watching skills unlock...' : 'Drag to explore'}
          </div>
        </div>

        {/* Reset button */}
        <button
          onClick={handleReset}
          className="p-2 rounded-lg transition-colors hover:bg-white/10"
          aria-label="Reset timeline"
          style={{ color: SKILL_TREE_COLORS.textMuted }}
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

      {/* Timeline track */}
      <div className="relative h-8">
        {/* Background track */}
        <div
          className="absolute top-1/2 left-0 right-0 h-1 -translate-y-1/2 rounded-full"
          style={{ backgroundColor: SKILL_TREE_COLORS.nodeBorder }}
        />

        {/* Progress track */}
        <div
          className="absolute top-1/2 left-0 h-1 -translate-y-1/2 rounded-full transition-all duration-100"
          style={{
            width: `${progressPercent}%`,
            backgroundColor: '#58a6ff',
            boxShadow: '0 0 10px rgba(88, 166, 255, 0.5)',
          }}
        />

        {/* Year markers */}
        {yearMarkers.map((marker) => (
          <div
            key={marker.year}
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2"
            style={{ left: `${marker.percent}%` }}
          >
            {/* Marker dot */}
            <div
              className="w-2.5 h-2.5 rounded-full transition-all duration-200"
              style={{
                backgroundColor: marker.isActive ? '#58a6ff' : SKILL_TREE_COLORS.nodeBorder,
                boxShadow: marker.isActive ? '0 0 8px rgba(88, 166, 255, 0.6)' : 'none',
                transform: marker.isMilestone ? 'scale(1.4)' : 'scale(1)',
              }}
            />

            {/* Milestone label */}
            {marker.isMilestone && (
              <div
                className="absolute top-4 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-medium"
                style={{
                  color: marker.isActive ? SKILL_TREE_COLORS.text : SKILL_TREE_COLORS.textMuted,
                }}
              >
                {marker.label}
              </div>
            )}
          </div>
        ))}

        {/* Current year indicator */}
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 transition-all duration-100"
          style={{ left: `${progressPercent}%` }}
        >
          <div
            className="w-5 h-5 rounded-full border-2 border-white"
            style={{
              backgroundColor: '#58a6ff',
              boxShadow: '0 0 15px rgba(88, 166, 255, 0.8)',
            }}
          />
        </div>

        {/* Hidden range input for interaction */}
        <input
          type="range"
          min={minYear}
          max={maxYear}
          value={year}
          onChange={handleSliderChange}
          aria-label="Timeline year"
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
      </div>
    </div>
  )
}
