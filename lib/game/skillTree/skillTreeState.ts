/**
 * Skill Tree State Management
 * Zustand store with Immer for immutable updates
 */

import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { useShallow } from 'zustand/react/shallow'
import type { SkillTreeState, SkillTreeActions } from './types'
import { SKILL_NODES, getMinYear, getMaxYear } from './skillTreeData'

// ============================================
// INITIAL STATE
// ============================================

const INITIAL_STATE: SkillTreeState = {
  nodes: SKILL_NODES,
  selectedNodeId: null,
  hoveredNodeId: null,
  viewMode: 'tree',
  timelineYear: getMaxYear(),
  zoom: 1,
  pan: { x: 0, y: 0 },
  isAnimating: false,
}

// ============================================
// STORE
// ============================================

export const useSkillTreeStore = create<SkillTreeState & SkillTreeActions>()(
  immer((set) => ({
    ...INITIAL_STATE,

    selectNode: (nodeId) => {
      set((state) => {
        state.selectedNodeId = nodeId
      })
    },

    hoverNode: (nodeId) => {
      set((state) => {
        state.hoveredNodeId = nodeId
      })
    },

    setViewMode: (mode) => {
      set((state) => {
        state.viewMode = mode
        // Reset timeline to max year when switching to tree view
        if (mode === 'tree') {
          state.timelineYear = getMaxYear()
          state.isAnimating = false
        }
      })
    },

    setTimelineYear: (year) => {
      set((state) => {
        state.timelineYear = Math.max(getMinYear(), Math.min(getMaxYear(), year))
      })
    },

    setZoom: (zoom) => {
      set((state) => {
        // Clamp zoom between 0.5 and 2
        state.zoom = Math.max(0.5, Math.min(2, zoom))
      })
    },

    setPan: (pan) => {
      set((state) => {
        state.pan = pan
      })
    },

    adjustPan: (delta) => {
      set((state) => {
        state.pan = {
          x: state.pan.x + delta.x,
          y: state.pan.y + delta.y,
        }
      })
    },

    resetView: () => {
      set((state) => {
        state.zoom = 1
        state.pan = { x: 0, y: 0 }
        state.selectedNodeId = null
        state.hoveredNodeId = null
      })
    },

    startTimelineAnimation: () => {
      set((state) => {
        state.isAnimating = true
        state.timelineYear = getMinYear()
      })
    },

    stopTimelineAnimation: () => {
      set((state) => {
        state.isAnimating = false
      })
    },
  }))
)

// ============================================
// SELECTOR HOOKS
// ============================================

/**
 * Get the currently selected node
 */
export function useSelectedNode() {
  return useSkillTreeStore((state) =>
    state.nodes.find((n) => n.id === state.selectedNodeId)
  )
}

/**
 * Get the currently hovered node
 */
export function useHoveredNode() {
  return useSkillTreeStore((state) =>
    state.nodes.find((n) => n.id === state.hoveredNodeId)
  )
}

/**
 * Get nodes visible based on current view mode and timeline year
 * Uses shallow comparison to avoid infinite re-renders
 */
export function useVisibleNodes() {
  return useSkillTreeStore(
    useShallow((state) => {
      if (state.viewMode === 'tree') {
        return state.nodes
      }
      // In timeline mode, filter by unlocked year
      return state.nodes.filter((n) => n.unlockedYear <= state.timelineYear)
    })
  )
}

/**
 * Get IDs of nodes connected to the selected node
 * Uses shallow comparison for array stability
 */
export function useConnectedNodeIds() {
  return useSkillTreeStore(
    useShallow((state) => {
      if (!state.selectedNodeId) return []
      const selectedNode = state.nodes.find((n) => n.id === state.selectedNodeId)
      return selectedNode?.connections ?? []
    })
  )
}

/**
 * Check if a node should be highlighted
 */
export function useIsNodeHighlighted(nodeId: string) {
  return useSkillTreeStore((state) => {
    if (state.selectedNodeId === nodeId) return true
    if (state.hoveredNodeId === nodeId) return true
    if (!state.selectedNodeId) return false
    const selectedNode = state.nodes.find((n) => n.id === state.selectedNodeId)
    return selectedNode?.connections.includes(nodeId) ?? false
  })
}

/**
 * Get current view state (for component props)
 * Uses shallow comparison for object stability
 */
export function useViewState() {
  return useSkillTreeStore(
    useShallow((state) => ({
      viewMode: state.viewMode,
      timelineYear: state.timelineYear,
      zoom: state.zoom,
      pan: state.pan,
      isAnimating: state.isAnimating,
    }))
  )
}
