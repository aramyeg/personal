/**
 * Skill Tree Types
 * Types for the interactive career skill tree visualization
 */

/**
 * Categories for organizing skills in the tree
 * Matches existing SkillCategory from types/index.ts
 */
export type SkillTreeCategory =
  | 'frontend'
  | 'mobile'
  | 'state'
  | 'styling'
  | 'backend'
  | 'tools'

/**
 * Proficiency level for a skill (1-5 scale)
 */
export type ProficiencyLevel = 1 | 2 | 3 | 4 | 5

/**
 * A node in the skill tree representing a technology
 */
export type SkillNode = {
  /** Unique identifier (e.g., 'react', 'typescript') */
  id: string
  /** Display name */
  name: string
  /** Category for grouping and coloring */
  category: SkillTreeCategory
  /** Proficiency level 1-5 */
  proficiency: ProficiencyLevel
  /** Company IDs where this skill was used */
  companies: string[]
  /** Related skill IDs for connection lines */
  connections: string[]
  /** Years of experience with this skill */
  yearsUsed: number
  /** Position in the tree canvas */
  position: { x: number; y: number }
  /** Year the skill was first learned (for timeline animation) */
  unlockedYear: number
}

/**
 * View modes for the skill tree
 */
export type SkillTreeViewMode = 'tree' | 'timeline'

/**
 * State for the skill tree visualization
 */
export type SkillTreeState = {
  /** All skill nodes */
  nodes: SkillNode[]
  /** Currently selected node ID */
  selectedNodeId: string | null
  /** Currently hovered node ID */
  hoveredNodeId: string | null
  /** Current view mode */
  viewMode: SkillTreeViewMode
  /** Current year for timeline filter */
  timelineYear: number
  /** Zoom level (0.5 to 2) */
  zoom: number
  /** Pan offset */
  pan: { x: number; y: number }
  /** Whether timeline animation is playing */
  isAnimating: boolean
}

/**
 * Actions for skill tree state management
 */
export type SkillTreeActions = {
  selectNode: (nodeId: string | null) => void
  hoverNode: (nodeId: string | null) => void
  setViewMode: (mode: SkillTreeViewMode) => void
  setTimelineYear: (year: number) => void
  setZoom: (zoom: number) => void
  setPan: (pan: { x: number; y: number }) => void
  adjustPan: (delta: { x: number; y: number }) => void
  resetView: () => void
  startTimelineAnimation: () => void
  stopTimelineAnimation: () => void
}
