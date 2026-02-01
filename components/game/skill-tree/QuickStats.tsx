'use client'

import { Code2, Building2, Calendar, Award } from 'lucide-react'
import type { SkillNode } from '@/lib/game/skillTree'
import { SKILL_TREE_COLORS } from '@/lib/game/skillTree'

type Props = {
  nodes: SkillNode[]
}

export function QuickStats({ nodes }: Props) {
  // Calculate stats
  const uniqueCompanies = new Set(nodes.flatMap((n) => n.companies))
  const totalYears = Math.max(...nodes.map((n) => n.yearsUsed), 0)
  const expertSkills = nodes.filter((n) => n.proficiency >= 4).length

  const stats = [
    {
      icon: Calendar,
      value: `${totalYears}+`,
      label: 'Years',
      color: '#58a6ff',
    },
    {
      icon: Code2,
      value: nodes.length.toString(),
      label: 'Technologies',
      color: '#7ee787',
    },
    {
      icon: Building2,
      value: uniqueCompanies.size.toString(),
      label: 'Companies',
      color: '#f78166',
    },
    {
      icon: Award,
      value: expertSkills.toString(),
      label: 'Expert',
      color: '#ffa657',
    },
  ]

  return (
    <div className="absolute bottom-3 left-3 flex gap-2">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg backdrop-blur-sm"
          style={{
            backgroundColor: `${SKILL_TREE_COLORS.nodeInactive}e6`,
            border: `1px solid ${SKILL_TREE_COLORS.nodeBorder}`,
          }}
        >
          <stat.icon className="w-3.5 h-3.5" style={{ color: stat.color }} />
          <span
            className="text-xs font-medium"
            style={{ color: SKILL_TREE_COLORS.text }}
          >
            {stat.value}
          </span>
          <span
            className="text-xs hidden sm:inline"
            style={{ color: SKILL_TREE_COLORS.textMuted }}
          >
            {stat.label}
          </span>
        </div>
      ))}
    </div>
  )
}
