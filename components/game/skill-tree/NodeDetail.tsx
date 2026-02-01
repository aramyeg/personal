'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { X, Building2, Calendar, Star } from 'lucide-react'
import type { SkillNode } from '@/lib/game/skillTree'
import { CATEGORY_COLORS, SKILL_TREE_COLORS } from '@/lib/game/skillTree'
import { experiences } from '@/data/experience'

type Props = {
  node: SkillNode | undefined
  onClose: () => void
}

function getProficiencyLabel(proficiency: number): string {
  switch (proficiency) {
    case 5:
      return 'Expert'
    case 4:
      return 'Advanced'
    case 3:
      return 'Intermediate'
    default:
      return 'Beginner'
  }
}

export function NodeDetail({ node, onClose }: Props) {
  // Get related experiences (only when node exists)
  const relatedExperiences = node
    ? experiences.filter((exp) => node.companies.includes(exp.id))
    : []

  const categoryColor = node ? CATEGORY_COLORS[node.category] : undefined

  return (
    <AnimatePresence>
      {node && (
        <motion.div
          key={node.id}
          role="dialog"
          aria-label={`${node.name} skill details`}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          transition={{ duration: 0.2 }}
          className="absolute right-0 top-0 w-72 h-full overflow-y-auto"
          style={{
            backgroundColor: SKILL_TREE_COLORS.nodeInactive,
            borderLeft: `1px solid ${SKILL_TREE_COLORS.nodeBorder}`,
          }}
        >
          <div className="p-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: categoryColor }}
                  aria-hidden="true"
                />
                <h3
                  className="text-base font-semibold"
                  style={{ color: SKILL_TREE_COLORS.text }}
                >
                  {node.name}
                </h3>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded transition-colors hover:bg-white/10"
                aria-label="Close skill details"
              >
                <X className="w-4 h-4" style={{ color: SKILL_TREE_COLORS.textMuted }} />
              </button>
            </div>

            {/* Proficiency Bar */}
            <div className="mb-4">
              <div
                className="text-xs uppercase mb-1.5 tracking-wide"
                style={{ color: SKILL_TREE_COLORS.textMuted }}
              >
                Proficiency
              </div>
              <div
                className="flex gap-1"
                role="img"
                aria-label={`Proficiency: ${node.proficiency} out of 5, ${getProficiencyLabel(node.proficiency)}`}
              >
                {Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-2 flex-1 rounded"
                    style={{
                      backgroundColor:
                        i < node.proficiency ? categoryColor : SKILL_TREE_COLORS.nodeBorder,
                    }}
                  />
                ))}
              </div>
              <div
                className="text-xs mt-1"
                style={{ color: SKILL_TREE_COLORS.textMuted }}
              >
                {getProficiencyLabel(node.proficiency)}
              </div>
            </div>

            {/* Years Experience */}
            <div
              className="flex items-center gap-2 mb-4 text-sm"
              style={{ color: SKILL_TREE_COLORS.textMuted }}
            >
              <Calendar className="w-4 h-4" aria-hidden="true" />
              <span>{node.yearsUsed} years experience</span>
            </div>

            {/* Connected Skills */}
            {node.connections.length > 0 && (
              <div className="mb-4">
                <div
                  className="flex items-center gap-2 text-xs uppercase mb-2 tracking-wide"
                  style={{ color: SKILL_TREE_COLORS.textMuted }}
                >
                  <Star className="w-3 h-3" aria-hidden="true" />
                  Related Skills
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {node.connections.map((connId) => (
                    <span
                      key={connId}
                      className="px-2 py-0.5 rounded text-xs capitalize"
                      style={{
                        backgroundColor: SKILL_TREE_COLORS.background,
                        color: SKILL_TREE_COLORS.text,
                        border: `1px solid ${SKILL_TREE_COLORS.nodeBorder}`,
                      }}
                    >
                      {connId.replace(/-/g, ' ')}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Companies */}
            <div>
              <div
                className="flex items-center gap-2 text-xs uppercase mb-2 tracking-wide"
                style={{ color: SKILL_TREE_COLORS.textMuted }}
              >
                <Building2 className="w-3 h-3" aria-hidden="true" />
                Used at
              </div>
              <div className="space-y-2">
                {relatedExperiences.map((exp) => (
                  <div
                    key={exp.id}
                    className="p-2.5 rounded"
                    style={{
                      backgroundColor: SKILL_TREE_COLORS.background,
                      border: `1px solid ${SKILL_TREE_COLORS.nodeBorder}`,
                    }}
                  >
                    <div
                      className="text-sm font-medium"
                      style={{ color: SKILL_TREE_COLORS.text }}
                    >
                      {exp.company}
                    </div>
                    <div
                      className="text-xs"
                      style={{ color: SKILL_TREE_COLORS.textMuted }}
                    >
                      {exp.role}
                    </div>
                    <div
                      className="text-xs mt-0.5"
                      style={{ color: SKILL_TREE_COLORS.textMuted }}
                    >
                      {exp.period}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
