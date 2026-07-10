export type EngineeringBrief = {
  id: string // 'EB-001'…
  area: 'Platform' | 'State' | 'Data' | 'Interaction' | 'Forms' | 'Performance'
  title: string
  stack: string // comma-separated tech
  pattern: string // 1-2 sentences, what the mechanism is
  rationale: string // 1-2 sentences, why
}

export const briefs: EngineeringBrief[] = [
  {
    id: 'EB-001',
    area: 'Platform',
    title: 'Session Management',
    stack: 'jose, Next.js route handlers, React Server Components',
    pattern:
      'Stateless sessions are issued as HS256-signed JSON Web Tokens and delivered in an HTTP-only, SameSite=Lax cookie. The token is verified server-side in the RSC layer on every request.',
    rationale:
      'Client JavaScript never touches the credential, eliminating token exfiltration via XSS. Demo deployment note: all credentials are accepted by design — the integrity of the token, not its issuance, is the exhibit.',
  },
  {
    id: 'EB-002',
    area: 'State',
    title: 'Client State Architecture',
    stack: 'Zustand, Immer, zustand/middleware persist',
    pattern:
      'A single Zustand store, wrapped in an Immer producer, holds every module’s UI and domain state. Components read module-scoped slices through selectors (e.g. useCuratorStore((s) => s.pipeline)) rather than the whole tree, and a persist middleware partializes only density, notification preferences, pipeline placement, and NPS completion to storage.',
    rationale:
      'One store lets seven independently code-split modules share state without prop drilling or nested providers, and partializing keeps session-scoped noise — the active module, the toast queue, sidebar state — out of localStorage so a reload restores preferences, not transient UI.',
  },
  {
    id: 'EB-003',
    area: 'Data',
    title: 'Single Source of Truth',
    stack: 'TypeScript adapters, data/experience.ts, lib/labs-manifest.ts',
    pattern:
      'Rooms, Personnel, and Pipeline never read data/experience.ts or the labs manifest directly — they call adapters.ts, a single layer of pure functions that maps those two sources into typed view models (RoomRow, PersonnelRow, DealCard).',
    rationale:
      'Shipping a new lab is one manifest entry; it surfaces in the Rooms table, the Overview KPIs, and the Pipeline’s activity feed without a single module component changing. The adapters are plain functions, testable independent of React.',
  },
  {
    id: 'EB-004',
    area: 'Data',
    title: 'Analytics Abstraction',
    stack: 'TypeScript, mulberry32 PRNG',
    pattern:
      'Traffic data is read through an AnalyticsSource interface (getTraffic, getVisitorKpi), implemented today by a seeded simulator: each calendar date seeds a mulberry32 PRNG, so a given day’s visitor count is identical regardless of the requested window length, and ship dates pulled from the labs manifest produce traffic spikes.',
    rationale:
      'The dashboard is written against the interface, not the simulation — wiring in a GA4 or Plausible-backed implementation is a one-file swap with zero call-site changes. Seeding by date rather than array index keeps the chart reproducible across renders and window sizes instead of re-rolling on every mount.',
  },
  {
    id: 'EB-005',
    area: 'Interaction',
    title: 'Drag-and-Drop',
    stack: '@dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities',
    pattern:
      'Pipeline cards drag through @dnd-kit with three input sensors: pointer (4px activation distance, so a click isn’t mistaken for a drag), touch (150ms hold delay, 8px tolerance, so a scroll isn’t hijacked), and keyboard (arrow-key reordering via sortableKeyboardCoordinates). Each column is its own SortableContext, and a drop resolves to a column-end or a specific card index before being written to the store.',
    rationale:
      'The activation thresholds make the board usable on touch without fighting native scroll, and the keyboard sensor means the kanban is fully operable without a pointer. Placement is written through the same persisted store slice as the rest of the app’s preferences, so a reorder survives a reload.',
  },
  {
    id: 'EB-006',
    area: 'Forms',
    title: 'Validation Strategy',
    stack: 'zod, hand-rolled multi-step React state',
    pattern:
      'The ticket form validates against two focused zod schemas — requesterSchema and detailsSchema — one per wizard step, merged into a single ticketSchema that types the assembled draft. Each step’s "Continue" runs safeParse and maps failed issues to a flat field-to-message record rendered inline under the offending input.',
    rationale:
      'Validating per step means a user on step 2 has already cleared step 1 — nothing re-validates fields they’ve moved past. For a three-field, three-step form, zod plus component state covers the full validate/error/submit cycle without the bundle or abstraction cost of a form library.',
  },
  {
    id: 'EB-007',
    area: 'Data',
    title: 'Table Logic',
    stack: 'TypeScript, no runtime dependency',
    pattern:
      'Sorting, filtering, pagination, and CSV export live in ui/table-core.ts as plain generic functions — sortRows, filterRows, paginate, toCsv — with no import of React and no dependency on any component. Personnel composes them inside a single useMemo keyed on the current query, sort, and page state.',
    rationale:
      'Logic that never touches the DOM is unit-tested directly against plain fixtures instead of through component rendering, and it stays reusable by any future table without dragging a specific module along with it.',
  },
  {
    id: 'EB-008',
    area: 'Performance',
    title: 'Module Code-Splitting',
    stack: 'next/dynamic, hand-rolled SVG (chart-math.ts)',
    pattern:
      'Every module — Overview through Settings — is registered behind next/dynamic in module-host.tsx and mounted only once its nav item is selected, sharing one SkeletonModule loading fallback. Charts are plain SVG paths computed by chart-math.ts (scalePoints, linePath, areaPath); no charting library is loaded.',
    rationale:
      'A visitor who never opens Pipeline never downloads @dnd-kit; a visitor who never opens Personnel never downloads its table logic. Hand-rolling two chart types avoids shipping a full charting library for a line and a set of bars.',
  },
  {
    id: 'EB-009',
    area: 'Platform',
    title: 'Design Tokens',
    stack: 'CSS custom properties, CSS Modules, next/font/google + Fontsource',
    pattern:
      'Color, typography, and structural tokens are declared as CSS custom properties on a single scoped .root class in curator.module.css — --c-navy, --c-blue, --c-border, --font-ui, --font-data — instead of the site’s shared Tailwind theme. Every surface uses a 1px --c-border hairline for structure; the module renders no box-shadow.',
    rationale:
      'Scoping tokens to the lab root lets Curator commit to its own enterprise palette without leaking into, or being leaked into by, the main portfolio identity or the other labs. Hairlines over shadows is a deliberate constraint — it is the visual signature of the dense, flat enterprise-console aesthetic the lab imitates.',
  },
]

export function getBrief(id: string): EngineeringBrief {
  const brief = briefs.find((b) => b.id === id)
  if (!brief) throw new Error(`Unknown engineering brief id: ${id}`)
  return brief
}
