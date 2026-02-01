/**
 * Skill Tree Module
 * Interactive career skill tree visualization
 */

// Types
export type {
  SkillNode,
  SkillTreeCategory,
  ProficiencyLevel,
  SkillTreeViewMode,
  SkillTreeState,
  SkillTreeActions,
} from './types'

// Data & Constants
export {
  CATEGORY_COLORS,
  SKILL_TREE_COLORS,
  SKILL_TREE_DIMENSIONS,
  SKILL_NODES,
  getNodeById,
  getNodesByCategory,
  getConnectedNodes,
  getNodesAtYear,
  getMinYear,
  getMaxYear,
  getAllCompanies,
  getTotalYears,
  getExpertSkillsCount,
} from './skillTreeData'

// State Management
export {
  useSkillTreeStore,
  useSelectedNode,
  useHoveredNode,
  useVisibleNodes,
  useConnectedNodeIds,
  useIsNodeHighlighted,
  useViewState,
} from './skillTreeState'

// Animations
export {
  GLOW_CONFIG,
  PARTICLE_CONFIG,
  PARALLAX_LAYERS,
  getGlowIntensity,
  getGlowBlur,
  getPhaseOffset,
  interpolateColor,
  easeOutCubic,
  easeInOutCubic,
  createParticle,
  updateParticle,
} from './animations'

export type { Particle, ParticleType } from './animations'
