'use client'

import { useMemo, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { getDealCards, type DealCard, type PipelineColumn } from '../adapters'
import { PIPELINE_COLUMNS, useCuratorStore } from '../store'
import { DealCardView } from '../ui/deal-card'
import { SpecChip } from '../ui/spec-chip'

function SortableDealCard({ id, deal }: { id: string; deal: DealCard }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style = { transform: CSS.Transform.toString(transform), transition }

  return (
    <div ref={setNodeRef} style={style} className="touch-manipulation" {...attributes} {...listeners}>
      <DealCardView deal={deal} dragging={isDragging} />
    </div>
  )
}

function PipelineColumnShell({
  col, cardIds, deals,
}: { col: { id: PipelineColumn; label: string }; cardIds: string[]; deals: Map<string, DealCard> }) {
  const { setNodeRef } = useDroppable({ id: `col-${col.id}` })
  const cards = cardIds.map((id) => deals.get(id)).filter(Boolean) as DealCard[]

  return (
    <div
      data-testid={`column-${col.id}`}
      className="rounded-[6px] border border-[var(--c-border)] bg-[var(--c-canvas)] p-3"
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--c-text-soft)]">{col.label}</span>
        <span className="font-[family-name:var(--font-data)] text-[11px] tabular-nums text-[var(--c-text-soft)]">{cardIds.length}</span>
      </div>
      <SortableContext items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
        <div ref={setNodeRef} className="min-h-[80px] space-y-2">
          {cards.map((deal) => (
            <SortableDealCard key={deal.id} id={deal.id} deal={deal} />
          ))}
        </div>
      </SortableContext>
    </div>
  )
}

export default function PipelineModule() {
  const deals = useMemo(() => new Map(getDealCards().map((d) => [d.id, d])), [])
  const pipeline = useCuratorStore((s) => s.pipeline)
  const movePipelineCard = useCuratorStore((s) => s.movePipelineCard)
  const [activeId, setActiveId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const won = pipeline['closed-won'].length
  const lost = 0
  const total = won + lost
  const winRate = total === 0 ? '—' : `${Math.round((won / total) * 100)}%`

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id))
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveId(null)
    if (!over) return

    const overId = String(over.id)
    let targetColumn: PipelineColumn
    let targetIndex: number

    if (overId.startsWith('col-')) {
      targetColumn = overId.slice('col-'.length) as PipelineColumn
      targetIndex = pipeline[targetColumn].length
    } else {
      const found = (Object.keys(pipeline) as PipelineColumn[]).find((col) => pipeline[col].includes(overId))
      if (!found) return
      targetColumn = found
      targetIndex = pipeline[found].indexOf(overId)
    }

    movePipelineCard(String(active.id), targetColumn, targetIndex)
  }

  function handleDragCancel() {
    setActiveId(null)
  }

  const activeDeal = activeId ? deals.get(activeId) : undefined

  return (
    <div className="space-y-4">
      <header className="flex items-center gap-2">
        <div>
          <h1 className="text-[18px] font-semibold">Pipeline</h1>
          <p className="mt-1 text-[12px] text-[var(--c-text-soft)]">Opportunity management — win rate {winRate}</p>
        </div>
        <div className="ml-auto"><SpecChip briefId="EB-005" /></div>
      </header>
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className="grid grid-flow-col auto-cols-[260px] gap-3 overflow-x-auto lg:grid-flow-row lg:auto-cols-auto lg:grid-cols-4 lg:overflow-x-visible">
          {PIPELINE_COLUMNS.map((col) => (
            <PipelineColumnShell key={col.id} col={col} cardIds={pipeline[col.id]} deals={deals} />
          ))}
        </div>
        <DragOverlay>
          {activeDeal ? <DealCardView deal={activeDeal} dragging /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  )
}
