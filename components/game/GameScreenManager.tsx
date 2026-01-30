'use client'

import { AnimatePresence } from 'framer-motion'
import {
  useCurrentScreen,
  usePendingSkillUnlock,
} from '@/lib/game/world'
import { GameModeSelector } from './GameModeSelector'
import { WorldMap } from './overworld/WorldMap'
import { LevelComplete } from './LevelComplete'
import { SkillUnlock } from './SkillUnlock'
import type { GameMode } from '@/lib/game/types'

type GameScreenManagerProps = {
  onStartLevel: () => void
  onSelectMode: (mode: GameMode) => void
  children: React.ReactNode
}

export function GameScreenManager({
  onStartLevel,
  onSelectMode,
  children,
}: GameScreenManagerProps) {
  const currentScreen = useCurrentScreen()
  const pendingSkillUnlock = usePendingSkillUnlock()

  return (
    <div className="relative">
      {/* Game canvas is always rendered but may be hidden */}
      <div className={currentScreen === 'level' ? 'block' : 'hidden'}>
        {children}
      </div>

      {/* Screen overlays */}
      <AnimatePresence mode="wait">
        {currentScreen === 'menu' && (
          <div key="menu" className="relative">
            <GameModeSelector onSelectMode={onSelectMode} />
          </div>
        )}

        {currentScreen === 'overworld' && (
          <WorldMap key="overworld" onStartLevel={onStartLevel} />
        )}

        {currentScreen === 'level_complete' && (
          <LevelComplete key="level_complete" />
        )}

        {currentScreen === 'skill_unlock' && pendingSkillUnlock && (
          <SkillUnlock key="skill_unlock" skillId={pendingSkillUnlock} />
        )}
      </AnimatePresence>
    </div>
  )
}
