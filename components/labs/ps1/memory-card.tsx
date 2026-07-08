import { projects } from '@/data/projects'

/**
 * Projects rendered as PS1 memory-card save slots.
 * Content comes from the shared data layer; only the skin is PS1.
 */

const SLOT_ICONS = [
  // 8x8 pixel motifs on a 16x16 canvas, one per slot
  { color: '#37e39f', px: [[3, 1, 1, 1], [2, 2, 4, 1], [1, 3, 6, 1], [2, 4, 4, 1], [3, 5, 1, 1]] }, // diamond
  { color: '#5583ff', px: [[2, 1, 4, 1], [1, 2, 6, 3], [2, 5, 4, 1]] }, // disk
  { color: '#e8edf4', px: [[1, 1, 6, 1], [1, 2, 2, 1], [1, 3, 6, 1], [5, 4, 2, 1], [1, 5, 6, 1]] }, // S
]

function SlotIcon({ index }: { index: number }) {
  const icon = SLOT_ICONS[index % SLOT_ICONS.length]
  return (
    <svg
      viewBox="0 0 16 16"
      className="w-8 h-8 [image-rendering:pixelated]"
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

export function MemoryCard() {
  return (
    <section className="max-w-[860px] mx-auto px-5 pt-24 pb-10" aria-label="Selected work, presented as memory card saves">
      <div
        className="border border-[#39414f] bg-[#0d1117]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(57,65,79,.14) 1px, transparent 1px), linear-gradient(90deg, rgba(57,65,79,.14) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }}
      >
        <div className="flex justify-between items-center bg-[#1b2c55] border-b border-[#39414f] text-[#e8edf4] px-4 py-2.5 text-xs tracking-[.2em] uppercase">
          <span>Memory card (1) — select data to load</span>
          <span className="text-[#87919f] tracking-[.1em]">{projects.length} saves</span>
        </div>

        {projects.map((project, i) => {
          const inProgress = project.year.toLowerCase().includes('present')
          return (
            <div
              key={project.id}
              className="grid grid-cols-[44px_1fr] sm:grid-cols-[44px_1fr_auto] gap-4 items-center px-4 py-4 border-b border-[#232a35] last:border-b-0 hover:bg-[#5583ff]/5 transition-colors"
            >
              <SlotIcon index={i} />
              <div>
                <div className="[font-family:'Arial_Black','Helvetica_Neue',Arial,sans-serif] text-[15px] tracking-[.04em] uppercase text-[#e8edf4]">
                  {project.title}
                </div>
                <div className="mt-1.5 text-[11px] tracking-[.12em] uppercase text-[#87919f]">
                  {project.company} <span className="text-[#5583ff]">·</span>{' '}
                  {project.metrics?.slice(0, 2).join(' · ')}
                </div>
              </div>
              <div className="text-[11px] tracking-[.2em] uppercase sm:text-right text-[#37e39f] col-start-2 sm:col-start-3">
                {inProgress ? 'In progress' : 'Saved'}
                <span className="block mt-1 text-[#87919f] tracking-[.1em]">{project.year}</span>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
