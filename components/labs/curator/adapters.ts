import { experiences } from '@/data/experience'
import { labs, type LabEntry } from '@/lib/labs-manifest'

export type RoomRow = { slug: string; title: string; status: 'live' | 'attic'; date: string; thesis: string; href: string }
export type PersonnelRow = {
  id: string; company: string; role: string; location: string; period: string
  startDate: string; endDate: string | null; tenureMonths: number
  description: string; highlights: string[]; technologies: string[]
}
export type PipelineColumn = 'sourced' | 'in-review' | 'offer' | 'closed-won'
export type DealCard = { id: string; company: string; role: string; period: string; tenureMonths: number; defaultColumn: PipelineColumn }
export type ActivityEvent = { id: string; date: string; label: string; kind: 'shipped' | 'retired' }
export const OPEN_DEAL_ID = 'your-company'

export function tenureMonths(startDate: string, endDate: string | null, now = new Date()): number {
  const [sy, sm] = startDate.split('-').map(Number)
  const end = endDate ? endDate.split('-').map(Number) : [now.getFullYear(), now.getMonth() + 1]
  return (end[0] - sy) * 12 + (end[1] - sm)
}

const roomHref = (l: LabEntry) => l.href ?? `/labs/${l.slug}`

export function getRoomRows(): RoomRow[] {
  return labs.map((l) => ({
    slug: l.slug, title: l.title, status: l.status === 'attic' ? 'attic' : 'live',
    date: l.date, thesis: l.thesis, href: roomHref(l),
  }))
}

export function getPersonnelRows(now = new Date()): PersonnelRow[] {
  return experiences.map((e) => ({
    id: e.id, company: e.company, role: e.role, location: e.location, period: e.period,
    startDate: e.startDate, endDate: e.endDate,
    tenureMonths: tenureMonths(e.startDate, e.endDate, now),
    description: e.description, highlights: e.highlights, technologies: e.technologies,
  }))
}

export function getDealCards(now = new Date()): DealCard[] {
  const won: DealCard[] = experiences.map((e) => ({
    id: e.id, company: e.company, role: e.role, period: e.period,
    tenureMonths: tenureMonths(e.startDate, e.endDate, now), defaultColumn: 'closed-won',
  }))
  return [
    { id: OPEN_DEAL_ID, company: 'Your Company', role: 'Senior Frontend Engineer', period: 'Open', tenureMonths: 0, defaultColumn: 'sourced' },
    ...won,
  ]
}

export function getActivity(): ActivityEvent[] {
  return labs
    .flatMap((l): ActivityEvent[] => {
      const shipped: ActivityEvent = { id: `${l.slug}-shipped`, date: l.date, label: `Room "${l.title}" shipped`, kind: 'shipped' }
      return l.status === 'attic'
        ? [shipped, { id: `${l.slug}-retired`, date: l.date, label: `Room "${l.title}" retired to attic`, kind: 'retired' }]
        : [shipped]
    })
    .sort((a, b) => b.date.localeCompare(a.date))
}

export function getRealKpis(now = new Date()) {
  const first = experiences.map((e) => e.startDate).sort()[0]
  return {
    rooms: labs.length,
    attic: labs.filter((l) => l.status === 'attic').length,
    yearsInProduction: Math.floor(tenureMonths(first, null, now) / 12),
  }
}
