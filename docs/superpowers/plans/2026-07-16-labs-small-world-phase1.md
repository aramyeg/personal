# Small World Lab — Phase 1 Implementation Plan (Research → Backbone → Gate 0)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Research the full asset/technique landscape, build the concept-independent backbone (timeline math, route, crawlable fallback), and ship the Gate-0 look-dev scene — a clay planet with a skipping girl in the spring palette — for Aram's go/kill verdict on the character lane.

**Architecture:** Scroll-driven R3F scene behind a lazy `next/dynamic` boundary. A pure `journey-timeline.ts` module maps scroll progress → planet rotation / chapter / morph / panel state; every scene component reads from it. The girl is pinned on top of a wheel-spinning planet (side view); props anchor to longitudes. Server-rendered chapter timeline is the crawler/no-WebGL path.

**Tech Stack:** Next.js 15 App Router, React 19, @react-three/fiber + drei (already in repo), TypeScript, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-07-16-labs-small-world-design.md` — read it before starting any task.

## Global Constraints

- Work only in worktree `.claude/worktrees/labs-small-world`, branch `worktree-labs-small-world`.
- Subagents: opus/sonnet only, never haiku.
- three.js must never be imported statically from a route file — only inside the chunk behind `small-world-loader.tsx` (`next/dynamic`, `ssr: false`).
- Content comes only from `data/experience.ts`. Copy rule: Aram is "Senior Frontend Engineer" at xDataGroup — never "Technical Lead"/"leading".
- Test files explicitly `import { describe, it, expect } from 'vitest'` (CI runs bare `pnpm exec tsc --noEmit`).
- No `console.log` in committed code. No mutation — immutable patterns.
- Commits: `type: description` (feat/fix/docs/test/chore), no attribution lines.
- Do NOT add the lab to `lib/labs-manifest.ts` in this phase — a manifest entry without a poster leaves an empty museum wall. Manifest + poster land in Phase 2.
- Palette hexes and font candidates are fixed in the spec — do not invent new ones outside `palette.ts`.
- E2E: `CI=1` (workers=1), `E2E_PORT` to avoid port fights with other worktrees; `rm -rf .next` when switching dev/prod servers.

## File Structure

```
docs/superpowers/research/2026-07-16-small-world-*.md      # Task 1 outputs (6 docs)
docs/superpowers/research/2026-07-16-small-world-asset-manifest.md  # Task 2 (for Aram)
components/labs/small-world/
  palette.ts               # color tokens + per-chapter accents
  chapters.ts              # experience.ts → 6 chronological chapter stagings
  journey-timeline.ts      # pure scroll→state math (unit-tested)
  small-world-loader.tsx   # next/dynamic boundary (ssr:false)
  small-world-experience.tsx # client shell: WebGL detect, scroll track, canvas mount
  fallback-timeline.tsx    # server-rendered crawlable chapter timeline
  scene/
    scene.tsx              # Canvas + composition
    sky.tsx                # gradient background + vignette
    planet.tsx             # clay sphere, toon ramp shading
    girl-proxy.tsx         # capsule stand-in with skip/squash math (foot-sync proof)
    girl.tsx               # GLB slot (manifest-gated), AnimationMixer — Task 7
app/labs/small-world/page.tsx
__tests__/labs/small-world/chapters.test.ts
__tests__/labs/small-world/journey-timeline.test.ts
e2e/labs-small-world.spec.ts
public/labs/small-world/   # girl.glb + art land here later, manifest-gated
```

---

### Task 1: Research fan-out (orchestrator-executed, not a coding subagent)

**Files:**
- Create: `docs/superpowers/research/2026-07-16-small-world-meshy-pipeline.md`
- Create: `docs/superpowers/research/2026-07-16-small-world-animation-retarget.md`
- Create: `docs/superpowers/research/2026-07-16-small-world-reference-language.md`
- Create: `docs/superpowers/research/2026-07-16-small-world-clay-shading.md`
- Create: `docs/superpowers/research/2026-07-16-small-world-sphere-locomotion.md`
- Create: `docs/superpowers/research/2026-07-16-small-world-manga-panel-grammar.md`

**Interfaces:**
- Produces: six research docs consumed by Task 2 (asset manifest) and Phase 2 planning.

- [ ] **Step 1: Dispatch six parallel research agents** (general-purpose, web-enabled). Each writes its own doc to the exact path above, with a Sources section of working URLs. Prompts:

1. **meshy-pipeline:** "Research the 2026 state of Meshy AI for a character pipeline: image-to-3D quality for stylized/cartoon characters (Turning Red-like chunky toon proportions), auto-rigging capability and skeleton format, the built-in animation library (does it have skip/hop/jump/wave/idle clips?), export formats (GLB with skinned mesh + clips?), pricing/credits, known failure modes (topology, hands, faces), and how people prep ChatGPT/DALL-E character turnaround sheets (front/side/back T-pose or A-pose) for best image-to-3D results. Also check nearest alternatives (Tripo, Rodin/Hyper3D, Hunyuan3D — both available via our Blender MCP) for the same job. Conclude with a recommended end-to-end recipe: prompt → images → Meshy settings → rigged animated GLB."
2. **animation-retarget:** "Research how to get a stylized skip/hop cycle onto a Meshy- or Mixamo-rigged character and play it in three.js/react-three-fiber: Mixamo animation catalog (which clips read as a happy skip — 'Skipping', 'Hopping', 'Joyful Jump'?), retargeting a Mixamo clip onto a non-Mixamo skeleton (three.js SkeletonUtils.retarget, Blender rig conversion, Meshy-to-Mixamo round trip), AnimationMixer crossfades between clips (skip→idle→discovery), and root-motion removal so the character animates in place. Give a concrete recommended pipeline with tools and steps."
3. **reference-language:** "Collect the visual language for a 'tiny planet journey' web piece: awwwards/FWA-level scroll sites where a character travels a small 3D planet or world as you scroll (find 5-10 real examples with URLs and what each does well), The Little Prince planet imagery conventions, Turning Red's character design rules (shape language, proportions, color), and claymation/clay-render aesthetics (Aardman, clay dioramas). Extract composition rules: camera height, planet-to-viewport ratio, character screen position, how discovery moments are staged."
4. **clay-shading:** "Research how to make three.js materials read as hand-sculpted clay/claymation: MeshToonMaterial gradient ramps (3-4 step DataTexture), matcap approaches for clay, subtle roughness/fingerprint normal maps, outline techniques (inverted hull vs postprocess), soft contact shadows under characters, and ambient occlusion for chunky toon scenes. Include working code snippets for react-three-fiber and named examples/demos. Also: vertex-displacement techniques for cartoon terrain on a sphere (valleys/canyons that stay chunky, not noisy)."
5. **sphere-locomotion:** "Research the 'character walks on a tiny rotating planet' technique for three.js: keeping the character fixed while rotating the planet (transform hierarchy, prop anchoring at longitudes/latitudes on a sphere), foot-contact sync so walk cadence matches surface speed (stride length ↔ angular velocity math), scroll-driven animation timelines in react-three-fiber (native scroll vs drei ScrollControls — pros/cons when HTML overlay content must coexist), and how sites handle scroll-snap/dwell zones at story stops. Concrete code patterns preferred."
6. **manga-panel-grammar:** "Research manga/comic panel visual grammar for a web overlay system: panel border/gutter conventions, halftone dot patterns in CSS (repeating gradients vs SVG filters), speed-line/action-burst effects, speech bubble and caption-box typography, panel entrance animations used on comic-style websites (real examples with URLs), and accessible/selectable-text approaches where art panels are images but data panels are typeset HTML. Extract a build recipe: CSS techniques + entrance motion grammar."

- [ ] **Step 2: Review all six docs** — verify each has concrete recommendations and real sources; re-dispatch any thin ones (VERIFY research-agent claims — repo lesson).

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/research/
git commit -m "docs: research pack for Small World lab (assets, shading, locomotion, panels)"
```

---

### Task 2: Asset manifest for Aram (orchestrator-executed, after Task 1)

**Files:**
- Create: `docs/superpowers/research/2026-07-16-small-world-asset-manifest.md`

**Interfaces:**
- Consumes: meshy-pipeline + animation-retarget + reference-language docs.
- Produces: the document Aram uses to generate the girl + panels; Task 7 consumes the resulting `girl.glb`.

- [ ] **Step 1: Write the manifest** with these required sections, filled from research (no placeholders — exact prompts he can paste):
  - **Girl turnaround sheet:** exact ChatGPT image prompt(s) for a Turning Red-style girl (chunky rounded proportions, big head, spring dress in palette colors `#7BC47F`/`#F7A8C4`, happy expression), specifying T-pose/A-pose front+side+back on neutral background, square dimensions, per research recipe.
  - **Meshy steps:** exact image-to-3D settings, auto-rig instructions, which animation-library clips to attach (skip cycle, idle bounce, discovery jump, wave), GLB export settings; deliver to `public/labs/small-world/girl.glb`.
  - **Fallback lane:** the Mixamo retarget recipe if Meshy clips disappoint.
  - **Comic panels (per chapter, 6×):** prompt template with per-chapter subject lines from `data/experience.ts` content, style constants (ink line weight, halftone, palette), portrait dimensions, PNG delivery paths `public/labs/small-world/panels/<chapter-id>-1.png`.
  - **Delivery + gating note:** everything is optional-at-runtime; the lab renders with proxy/placeholder until files exist (manifest-gated — no 404 spam).

- [ ] **Step 2: Commit and hand the path to Aram in the session summary**

```bash
git add docs/superpowers/research/2026-07-16-small-world-asset-manifest.md
git commit -m "docs: Small World asset manifest for generation (girl, animations, panels)"
```

---

### Task 3: Palette + chapter content module (TDD)

**Files:**
- Create: `components/labs/small-world/palette.ts`
- Create: `components/labs/small-world/chapters.ts`
- Test: `__tests__/labs/small-world/chapters.test.ts`

**Interfaces:**
- Consumes: `experiences` from `@/data/experience` (`Experience[]`, newest-first).
- Produces: `PALETTE` const; `CHAPTER_COUNT = 6`; `chapters: Chapter[]` (oldest-first) with `type Chapter = { id: string; company: string; role: string; period: string; location: string; description: string; highlights: string[]; technologies: string[]; theme: string; accent: string }`.

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/labs/small-world/chapters.test.ts
import { describe, it, expect } from 'vitest'
import { chapters, CHAPTER_COUNT } from '@/components/labs/small-world/chapters'
import { PALETTE } from '@/components/labs/small-world/palette'

describe('small-world chapters', () => {
  it('exposes exactly six chapters, oldest first', () => {
    expect(chapters).toHaveLength(CHAPTER_COUNT)
    expect(chapters[0].id).toBe('bluenet')
    expect(chapters[CHAPTER_COUNT - 1].id).toBe('xdatagroup')
  })

  it('carries real experience content through', () => {
    const xdg = chapters[CHAPTER_COUNT - 1]
    expect(xdg.company).toBe('xDataGroup')
    expect(xdg.role).toBe('Senior Frontend Engineer') // no-lead-title-claims
    expect(xdg.technologies).toContain('Next.js')
  })

  it('gives every chapter a theme and a hex accent', () => {
    for (const c of chapters) {
      expect(c.theme.length).toBeGreaterThan(0)
      expect(c.accent).toMatch(/^#[0-9A-Fa-f]{6}$/)
    }
  })

  it('palette anchors match the spec', () => {
    expect(PALETTE.meadow).toBe('#7BC47F')
    expect(PALETTE.blossom).toBe('#F7A8C4')
    expect(PALETTE.river).toBe('#6FB7D9')
    expect(PALETTE.sky).toBe('#FFF3D6')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run __tests__/labs/small-world/chapters.test.ts`
Expected: FAIL — cannot resolve `@/components/labs/small-world/chapters`

- [ ] **Step 3: Implement**

```ts
// components/labs/small-world/palette.ts
/** Small World color system — spec: docs/superpowers/specs/2026-07-16-labs-small-world-design.md */
export const PALETTE = {
  meadow: '#7BC47F',
  leaf: '#4E9A51',
  sprout: '#A8DCA0',
  blossom: '#F7A8C4',
  blossomDeep: '#E86FA4',
  river: '#6FB7D9',
  riverDeep: '#4E9EC7',
  sky: '#FFF3D6',
  horizon: '#FFE3EC',
  clayPath: '#D98E6A',
  ink: '#2B2B33',
  // chapter accents (tints of the base system)
  honey: '#F7C948',
  dune: '#E8C58A',
  tuff: '#DE8E9E',
} as const
```

```ts
// components/labs/small-world/chapters.ts
import { experiences } from '@/data/experience'
import { PALETTE } from './palette'

export const CHAPTER_COUNT = 6

export type Chapter = {
  id: string
  company: string
  role: string
  period: string
  location: string
  description: string
  highlights: string[]
  technologies: string[]
  /** One-line staging direction for the chapter's planet region */
  theme: string
  accent: string
}

/** Per-chapter staging: theme + accent, keyed by experience id. */
const STAGING: Record<string, { theme: string; accent: string }> = {
  bluenet: { theme: 'First shoots of spring — seedlings and a small clay hotel with a reception bell', accent: PALETTE.sprout },
  flyerbee: { theme: 'Beehive and fat clay bees over pink flowers along a winding delivery path', accent: PALETTE.honey },
  '360dialog': { theme: 'A wide blue river delta with message-pebble stepping stones and carrier birds', accent: PALETTE.river },
  accenture: { theme: 'Golden dunes rising from the green, a palm, a geometric bank facade', accent: PALETTE.dune },
  akna: { theme: 'A clay market street of stacked component-block buildings in pink tuff', accent: PALETTE.tuff },
  xdatagroup: { theme: 'Blossom summit at present day — pink trees in bloom, a vault door in the hillside', accent: PALETTE.blossomDeep },
}

/** The journey runs the career chronologically: oldest experience first. */
export const chapters: Chapter[] = [...experiences].reverse().map((e) => ({
  id: e.id,
  company: e.company,
  role: e.role,
  period: e.period,
  location: e.location,
  description: e.description,
  highlights: e.highlights,
  technologies: e.technologies,
  ...STAGING[e.id],
}))
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run __tests__/labs/small-world/chapters.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add components/labs/small-world/palette.ts components/labs/small-world/chapters.ts __tests__/labs/small-world/chapters.test.ts
git commit -m "feat: Small World palette and chapter staging module"
```

---

### Task 4: journey-timeline pure module (TDD)

**Files:**
- Create: `components/labs/small-world/journey-timeline.ts`
- Test: `__tests__/labs/small-world/journey-timeline.test.ts`

**Interfaces:**
- Consumes: `CHAPTER_COUNT` from `./chapters`.
- Produces: `journeyStateAt(progress: number): JourneyState` where `type JourneyState = { progress: number; rotation: number; chapter: number; morph: number[]; burst: number | null; panel: { chapter: number; t: number } | null }`; consts `ROTATION_TOTAL`, `TRAVEL_END = 0.55`, `BURST_END = 0.65`, `PANEL_END = 0.95`, `MORPH_WINDOW = 0.35`; helper `smoothstep(t: number): number`. Scene components (Tasks 6-7, Phase 2) read ONLY this state.

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/labs/small-world/journey-timeline.test.ts
import { describe, it, expect } from 'vitest'
import {
  journeyStateAt,
  ROTATION_TOTAL,
  TRAVEL_END,
  BURST_END,
  PANEL_END,
} from '@/components/labs/small-world/journey-timeline'
import { CHAPTER_COUNT } from '@/components/labs/small-world/chapters'

const SEG = 1 / CHAPTER_COUNT
/** progress at a local position inside chapter i's segment */
const at = (i: number, local: number) => (i + local) * SEG

describe('journeyStateAt', () => {
  it('clamps progress to [0,1]', () => {
    expect(journeyStateAt(-0.5).progress).toBe(0)
    expect(journeyStateAt(1.5).progress).toBe(1)
  })

  it('starts at zero rotation and completes one full lap', () => {
    expect(journeyStateAt(0).rotation).toBe(0)
    expect(journeyStateAt(1).rotation).toBeCloseTo(ROTATION_TOTAL, 10)
  })

  it('rotation is monotonically non-decreasing', () => {
    let prev = -1
    for (let p = 0; p <= 1.0001; p += 0.001) {
      const r = journeyStateAt(p).rotation
      expect(r).toBeGreaterThanOrEqual(prev)
      prev = r
    }
  })

  it('freezes rotation while a panel is open', () => {
    const a = journeyStateAt(at(2, BURST_END + 0.01))
    const b = journeyStateAt(at(2, PANEL_END - 0.01))
    expect(a.rotation).toBeCloseTo(b.rotation, 10)
  })

  it('reports the active chapter', () => {
    expect(journeyStateAt(0).chapter).toBe(0)
    expect(journeyStateAt(at(3, 0.5)).chapter).toBe(3)
    expect(journeyStateAt(0.999).chapter).toBe(CHAPTER_COUNT - 1)
  })

  it('opens the panel only inside the dwell window, with t in (0,1)', () => {
    expect(journeyStateAt(at(2, 0.3)).panel).toBeNull()
    const mid = journeyStateAt(at(2, (BURST_END + PANEL_END) / 2)).panel
    expect(mid).not.toBeNull()
    expect(mid!.chapter).toBe(2)
    expect(mid!.t).toBeGreaterThan(0)
    expect(mid!.t).toBeLessThan(1)
    expect(journeyStateAt(at(2, PANEL_END + 0.01)).panel).toBeNull()
  })

  it('exposes the discovery burst window between travel and panel', () => {
    expect(journeyStateAt(at(1, 0.3)).burst).toBeNull()
    const b = journeyStateAt(at(1, (TRAVEL_END + BURST_END) / 2)).burst
    expect(b).toBeGreaterThan(0)
    expect(b).toBeLessThan(1)
  })

  it('morphs the incoming set in as the outgoing set sinks', () => {
    const start = journeyStateAt(0)
    expect(start.morph[0]).toBe(1)
    expect(start.morph[1]).toBe(0)
    const mid = journeyStateAt(at(3, 0.175)) // halfway through the morph window
    expect(mid.morph[3]).toBeCloseTo(0.5, 1)
    expect(mid.morph[2]).toBeCloseTo(0.5, 1)
    const settled = journeyStateAt(at(3, 0.5))
    expect(settled.morph[3]).toBe(1)
    expect(settled.morph[2]).toBe(0)
    expect(settled.morph[4]).toBe(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run __tests__/labs/small-world/journey-timeline.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement**

```ts
// components/labs/small-world/journey-timeline.ts
import { CHAPTER_COUNT } from './chapters'

/**
 * Pure scroll→scene math. One scroll lap = one planet lap = the career.
 * Each chapter owns an equal progress segment, subdivided:
 *   [0, TRAVEL_END)          girl skips, planet rotates its slice
 *   [TRAVEL_END, BURST_END)  discovery animation ("!"), rotation frozen
 *   [BURST_END, PANEL_END)   comic panel dwell, rotation frozen
 *   [PANEL_END, 1]           release, next chapter's travel resumes rotation
 */
export const ROTATION_TOTAL = Math.PI * 2
export const TRAVEL_END = 0.55
export const BURST_END = 0.65
export const PANEL_END = 0.95
/** Fraction of a segment over which the incoming prop set grows (and the outgoing sinks). */
export const MORPH_WINDOW = 0.35

export type PanelState = { chapter: number; t: number }
export type JourneyState = {
  progress: number
  rotation: number
  chapter: number
  morph: number[]
  burst: number | null
  panel: PanelState | null
}

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v))

export const smoothstep = (t: number): number => {
  const x = clamp01(t)
  return x * x * (3 - 2 * x)
}

export function journeyStateAt(rawProgress: number): JourneyState {
  const progress = clamp01(rawProgress)
  const segLen = 1 / CHAPTER_COUNT
  const chapter = Math.min(CHAPTER_COUNT - 1, Math.floor(progress / segLen))
  const local = (progress - chapter * segLen) / segLen

  const slice = ROTATION_TOTAL / CHAPTER_COUNT
  const rotation = chapter * slice + clamp01(local / TRAVEL_END) * slice

  const morph = Array.from({ length: CHAPTER_COUNT }, (_, i) => {
    const grow = chapter === 0 ? 1 : smoothstep(local / MORPH_WINDOW)
    if (i === chapter) return i === 0 ? 1 : grow
    if (i === chapter - 1) return 1 - smoothstep(local / MORPH_WINDOW)
    return 0
  })

  const burst =
    local >= TRAVEL_END && local < BURST_END
      ? (local - TRAVEL_END) / (BURST_END - TRAVEL_END)
      : null

  const panel: PanelState | null =
    local >= BURST_END && local < PANEL_END
      ? { chapter, t: (local - BURST_END) / (PANEL_END - BURST_END) }
      : null

  return { progress, rotation, chapter, morph, burst, panel }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run __tests__/labs/small-world/journey-timeline.test.ts`
Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add components/labs/small-world/journey-timeline.ts __tests__/labs/small-world/journey-timeline.test.ts
git commit -m "feat: Small World journey timeline (scroll to rotation/morph/panel math)"
```

---

### Task 5: Route, loader boundary, crawlable fallback

**Files:**
- Create: `app/labs/small-world/page.tsx`
- Create: `components/labs/small-world/small-world-loader.tsx`
- Create: `components/labs/small-world/small-world-experience.tsx`
- Create: `components/labs/small-world/fallback-timeline.tsx`

**Interfaces:**
- Consumes: `chapters` from `./chapters`; `GalleryChrome` from `@/components/labs/gallery-chrome`.
- Produces: route `/labs/small-world`; `SmallWorldExperience` renders the scroll track and (Task 6) the canvas; `FallbackTimeline` is the server-rendered SEO/no-WebGL path.

- [ ] **Step 1: Fallback timeline (server component)**

```tsx
// components/labs/small-world/fallback-timeline.tsx
import { chapters } from './chapters'

/**
 * Server-rendered career timeline — the crawler / no-WebGL / reduced-motion
 * path. Hidden by the client shell once the 3D scene takes over.
 */
export function FallbackTimeline() {
  return (
    <section data-testid="small-world-fallback" aria-label="Career journey">
      <h1>Small World — a career in one lap of a tiny planet</h1>
      <ol>
        {chapters.map((c) => (
          <li key={c.id}>
            <h2>
              {c.role} — {c.company}
            </h2>
            <p>
              {c.period} · {c.location}
            </p>
            <p>{c.description}</p>
            <ul>
              {c.highlights.map((h) => (
                <li key={h}>{h}</li>
              ))}
            </ul>
            <p>{c.technologies.join(', ')}</p>
          </li>
        ))}
      </ol>
    </section>
  )
}
```

- [ ] **Step 2: Loader boundary + client shell**

```tsx
// components/labs/small-world/small-world-loader.tsx
'use client'
import dynamic from 'next/dynamic'

/** The 3D bundle loads client-side only; museum/list pay nothing for it. */
export const SmallWorldLoader = dynamic(
  () => import('./small-world-experience').then((m) => m.SmallWorldExperience),
  { ssr: false }
)
```

```tsx
// components/labs/small-world/small-world-experience.tsx
'use client'
import { useEffect, useRef, useState } from 'react'
import { CHAPTER_COUNT } from './chapters'
import { SmallWorldScene } from './scene/scene'

function detectWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas')
    return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'))
  } catch {
    return false
  }
}

const TRACK_VH_PER_CHAPTER = 150

/**
 * Owns the tall scroll track and turns document scroll into a 0..1 progress
 * ref for the scene. Falls back to the server timeline when WebGL is missing
 * or the visitor prefers reduced motion.
 */
export function SmallWorldExperience() {
  const [active, setActive] = useState(false)
  const progressRef = useRef(0)
  const trackRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!reduced && detectWebGL()) setActive(true)
  }, [])

  useEffect(() => {
    if (!active) return
    const onScroll = () => {
      const el = trackRef.current
      if (!el) return
      const total = el.scrollHeight - window.innerHeight
      progressRef.current = total > 0 ? Math.min(1, Math.max(0, window.scrollY / total)) : 0
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [active])

  if (!active) return null

  return (
    <div ref={trackRef} style={{ height: `${CHAPTER_COUNT * TRACK_VH_PER_CHAPTER}vh` }}>
      <div style={{ position: 'sticky', top: 0, height: '100dvh' }}>
        <SmallWorldScene progressRef={progressRef} />
      </div>
      <style>{`[data-testid="small-world-fallback"]{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}`}</style>
    </div>
  )
}
```

Note: the fallback stays in the DOM (visually hidden, still crawlable) rather than unmounting — cheap and keeps SEO content stable. Task 6 creates `scene/scene.tsx`; until then, stub it inline in this task as `export function SmallWorldScene(_: { progressRef: React.MutableRefObject<number> }) { return null }` in `components/labs/small-world/scene/scene.tsx` so the shell compiles.

- [ ] **Step 3: Page**

```tsx
// app/labs/small-world/page.tsx
import type { Metadata } from 'next'
import { GalleryChrome } from '@/components/labs/gallery-chrome'
import { FallbackTimeline } from '@/components/labs/small-world/fallback-timeline'
import { SmallWorldLoader } from '@/components/labs/small-world/small-world-loader'

export const metadata: Metadata = {
  title: 'Small World — Style Lab | Aram Yeghiazaryan',
  description:
    'Style Lab experiment: a career told as one skip around a tiny clay planet — six chapters, six landscapes, scroll to travel.',
  openGraph: {
    title: 'Small World — Style Lab',
    description: 'A clay planet small enough to walk in an afternoon — every lap of it is a career.',
    images: ['/labs/small-world/poster.jpg'],
  },
}

export default function SmallWorldLabPage() {
  return (
    <GalleryChrome>
      <FallbackTimeline />
      <SmallWorldLoader />
    </GalleryChrome>
  )
}
```

- [ ] **Step 4: Verify build boundary and route**

Run: `pnpm exec tsc --noEmit && pnpm lint && pnpm build`
Expected: clean; in the build output, `/labs/small-world` first-load JS must NOT include three.js (compare against `/labs/xp` sized routes — the route chunk should be small, three only in the lazy chunk).

- [ ] **Step 5: Commit**

```bash
git add app/labs/small-world components/labs/small-world
git commit -m "feat: Small World route with lazy 3D boundary and crawlable fallback"
```

---

### Task 6: Look-dev scene — clay planet, sky, proxy girl with foot-sync

**Files:**
- Create: `components/labs/small-world/scene/scene.tsx` (replace stub)
- Create: `components/labs/small-world/scene/sky.tsx`
- Create: `components/labs/small-world/scene/planet.tsx`
- Create: `components/labs/small-world/scene/girl-proxy.tsx`

**Interfaces:**
- Consumes: `journeyStateAt` (Task 4), `PALETTE` (Task 3), `progressRef` prop from the shell (Task 5).
- Produces: `SmallWorldScene({ progressRef })`; `PLANET_RADIUS = 2.2`; `SURFACE_Y` (world y of the planet's top). Task 7 swaps `GirlProxy` for the GLB `Girl` behind the same transform contract: positioned at planet top, hop offset added to y.

- [ ] **Step 1: Sky + scene composition**

```tsx
// components/labs/small-world/scene/sky.tsx
import { PALETTE } from '../palette'

/** Butter-cream to pink-horizon gradient, drawn as a screen-space backdrop. */
export function Sky() {
  return (
    <mesh position={[0, 0, -20]} scale={[60, 40, 1]}>
      <planeGeometry />
      <shaderMaterial
        depthWrite={false}
        uniforms={{}}
        vertexShader={`varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`}
        fragmentShader={`
          varying vec2 vUv;
          void main(){
            vec3 sky = vec3(${hexToGlsl(PALETTE.sky)});
            vec3 horizon = vec3(${hexToGlsl(PALETTE.horizon)});
            vec3 col = mix(horizon, sky, smoothstep(0.15, 0.75, vUv.y));
            float vig = smoothstep(1.25, 0.45, distance(vUv, vec2(0.5)));
            gl_FragColor = vec4(col * (0.92 + 0.08 * vig), 1.0);
          }`}
      />
    </mesh>
  )
}

function hexToGlsl(hex: string): string {
  const n = parseInt(hex.slice(1), 16)
  const c = [16, 8, 0].map((s) => (((n >> s) & 255) / 255).toFixed(4))
  return c.join(',')
}
```

```tsx
// components/labs/small-world/scene/scene.tsx
'use client'
import { Canvas } from '@react-three/fiber'
import type { MutableRefObject } from 'react'
import { Sky } from './sky'
import { Planet, PLANET_RADIUS } from './planet'
import { GirlProxy } from './girl-proxy'

export type SceneProps = { progressRef: MutableRefObject<number> }

/** Side-view stage: planet is a wheel spinning about z; girl pinned on top. */
export function SmallWorldScene({ progressRef }: SceneProps) {
  return (
    <Canvas
      camera={{ position: [0, PLANET_RADIUS * 0.55, 8], fov: 42 }}
      gl={{ antialias: true }}
      dpr={[1, 2]}
    >
      <Sky />
      <ambientLight intensity={0.85} />
      <directionalLight position={[4, 6, 5]} intensity={1.2} />
      <group position={[0, -PLANET_RADIUS * 0.45, 0]}>
        <Planet progressRef={progressRef} />
        <GirlProxy progressRef={progressRef} />
      </group>
    </Canvas>
  )
}
```

- [ ] **Step 2: Clay planet with toon ramp**

```tsx
// components/labs/small-world/scene/planet.tsx
'use client'
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { journeyStateAt } from '../journey-timeline'
import { PALETTE } from '../palette'
import type { SceneProps } from './scene'

export const PLANET_RADIUS = 2.2

/** 4-step toon ramp — the clay read. */
function useToonRamp(): THREE.DataTexture {
  return useMemo(() => {
    const steps = new Uint8Array([120, 170, 220, 255])
    const data = new Uint8Array(steps.length * 4)
    steps.forEach((v, i) => data.set([v, v, v, 255], i * 4))
    const tex = new THREE.DataTexture(data, steps.length, 1, THREE.RGBAFormat)
    tex.needsUpdate = true
    tex.minFilter = THREE.NearestFilter
    tex.magFilter = THREE.NearestFilter
    return tex
  }, [])
}

/** Chunky vertex-displaced sphere: gentle rolling hills, no noisy detail. */
function useHillGeometry(): THREE.IcosahedronGeometry {
  return useMemo(() => {
    const geo = new THREE.IcosahedronGeometry(PLANET_RADIUS, 24)
    const pos = geo.attributes.position
    const v = new THREE.Vector3()
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i)
      const bump =
        0.05 * Math.sin(3 * v.x + 1.7) * Math.sin(4 * v.y - 0.6) * Math.sin(3 * v.z + 2.2)
      v.multiplyScalar(1 + bump)
      pos.setXYZ(i, v.x, v.y, v.z)
    }
    geo.computeVertexNormals()
    return geo
  }, [])
}

export function Planet({ progressRef }: SceneProps) {
  const group = useRef<THREE.Group>(null)
  const ramp = useToonRamp()
  const geometry = useHillGeometry()

  useFrame(() => {
    const { rotation } = journeyStateAt(progressRef.current)
    if (group.current) group.current.rotation.z = -rotation
  })

  return (
    <group ref={group}>
      <mesh geometry={geometry}>
        <meshToonMaterial color={PALETTE.meadow} gradientMap={ramp} />
      </mesh>
    </group>
  )
}
```

- [ ] **Step 3: Proxy girl proving foot-sync**

```tsx
// components/labs/small-world/scene/girl-proxy.tsx
'use client'
import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { journeyStateAt } from '../journey-timeline'
import { PALETTE } from '../palette'
import { PLANET_RADIUS } from './planet'

/** Surface distance covered by one skip — ties hop cadence to rotation. */
const STRIDE = 0.55
const HOP_HEIGHT = 0.16

/**
 * Capsule stand-in for the girl. Its ONLY job: prove that hop cadence
 * locks to surface speed (no moonwalking) before the real GLB lands.
 * Contract for the real Girl (Task 7): same group transform, hop offset
 * ADDED to the surface y — never replacing it.
 */
export function GirlProxy({ progressRef }: { progressRef: React.MutableRefObject<number> }) {
  const group = useRef<THREE.Group>(null)

  useFrame(() => {
    const { rotation } = journeyStateAt(progressRef.current)
    const surfaceDistance = rotation * PLANET_RADIUS
    const hopPhase = (surfaceDistance / STRIDE) * Math.PI
    const hop = Math.abs(Math.sin(hopPhase)) * HOP_HEIGHT
    const squash = 1 - 0.12 * Math.cos(hopPhase * 2) // squash at contact, stretch mid-air
    if (group.current) {
      group.current.position.y = PLANET_RADIUS + 0.28 + hop
      group.current.scale.set(1 / squash, squash, 1 / squash)
    }
  })

  return (
    <group ref={group} position={[-0.6, PLANET_RADIUS + 0.28, 0]}>
      <mesh>
        <capsuleGeometry args={[0.14, 0.28, 8, 16]} />
        <meshToonMaterial color={PALETTE.blossomDeep} />
      </mesh>
      <mesh position={[0, 0.34, 0]}>
        <sphereGeometry args={[0.16, 24, 24]} />
        <meshToonMaterial color={PALETTE.blossom} />
      </mesh>
    </group>
  )
}
```

- [ ] **Step 4: Verify in the browser** — `pnpm dev`, open `/labs/small-world`, scroll: planet spins like a wheel, proxy hops in lock-step with the surface (watch a surface bump pass under her feet exactly one stride per hop), rotation freezes in each chapter's dwell window. Fix constants (`STRIDE`, camera, planet screen ratio per reference-language research) until it feels right. `pnpm exec tsc --noEmit && pnpm lint && pnpm test:unit` all green.

- [ ] **Step 5: Commit**

```bash
git add components/labs/small-world/scene
git commit -m "feat: Small World look-dev scene — clay planet, sky, foot-synced proxy"
```

---

### Task 7: Real girl GLB slot (manifest-gated) + skip animation

**Files:**
- Create: `components/labs/small-world/scene/girl.tsx`
- Create: `components/labs/small-world/art-manifest.ts`
- Modify: `components/labs/small-world/scene/scene.tsx` (render `Girl` when available, else `GirlProxy`)

**Interfaces:**
- Consumes: `public/labs/small-world/girl.glb` (from Aram via Task 2 manifest — may not exist yet), `journeyStateAt`, proxy transform contract from Task 6.
- Produces: `Girl` component playing the skip clip via `AnimationMixer`, cadence-locked (`mixer.timeScale` from rotation delta); `hasArt(id)` gate.

- [ ] **Step 1: Art manifest gate** (repo lesson: raw fetch/loader 404s spam the console — a committed manifest is the only silent gate)

```ts
// components/labs/small-world/art-manifest.ts
/**
 * Committed registry of delivered art. Loaders consult this BEFORE any
 * network request — absent ids render fallbacks with zero 404 noise.
 * Update this list when files land in public/labs/small-world/.
 */
export const DELIVERED_ART: ReadonlySet<string> = new Set<string>([
  // 'girl', 'panel-bluenet-1', ...
])

export const hasArt = (id: string): boolean => DELIVERED_ART.has(id)
```

- [ ] **Step 2: Girl component** — gate in scene.tsx: `{hasArt('girl') ? <Girl progressRef={progressRef} /> : <GirlProxy progressRef={progressRef} />}`. Implementation per animation-retarget research findings; contract fixed here:

```tsx
// components/labs/small-world/scene/girl.tsx
'use client'
import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF, useAnimations } from '@react-three/drei'
import * as THREE from 'three'
import { journeyStateAt } from '../journey-timeline'
import { PLANET_RADIUS } from './planet'

const GIRL_URL = '/labs/small-world/girl.glb'
/** Surface distance one skip-cycle covers at timeScale 1 — tune to the clip. */
const CLIP_STRIDE = 0.55

export function Girl({ progressRef }: { progressRef: React.MutableRefObject<number> }) {
  const group = useRef<THREE.Group>(null)
  const { scene, animations } = useGLTF(GIRL_URL)
  const { actions, mixer } = useAnimations(animations, group)
  const lastRotation = useRef(0)

  useEffect(() => {
    // Clip names confirmed once the real asset lands; 'skip' is the manifest ask.
    actions.skip?.reset().play()
  }, [actions])

  useFrame((_, delta) => {
    const { rotation } = journeyStateAt(progressRef.current)
    const surfaceSpeed = ((rotation - lastRotation.current) * PLANET_RADIUS) / Math.max(delta, 1e-6)
    lastRotation.current = rotation
    // Cadence lock: clip playback speed follows surface speed; idle when stopped.
    mixer.timeScale = THREE.MathUtils.clamp(surfaceSpeed / CLIP_STRIDE, 0, 2.5)
  })

  return (
    <group ref={group} position={[-0.6, PLANET_RADIUS, 0]}>
      <primitive object={scene} />
    </group>
  )
}
```

(Crossfade to idle/discovery clips and exact scale/offset are finalized against the real GLB — the numbers cannot be known before the asset exists; everything else above is final.)

- [ ] **Step 3: Verify** — with `girl.glb` absent, scene renders proxy, zero console errors/404s. `pnpm exec tsc --noEmit && pnpm lint` green. When Aram delivers the GLB: add `'girl'` to `DELIVERED_ART`, verify skip cadence and scale in browser.

- [ ] **Step 4: Commit**

```bash
git add components/labs/small-world
git commit -m "feat: Small World manifest-gated girl GLB slot with cadence-locked skip"
```

---

### Task 8: E2E smoke

**Files:**
- Create: `e2e/labs-small-world.spec.ts`

**Interfaces:**
- Consumes: route from Task 5; museum root Esc contract from GalleryChrome.

- [ ] **Step 1: Write the spec** (follow existing e2e file conventions — check `e2e/` for the shared helpers/format first)

```ts
// e2e/labs-small-world.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Small World lab', () => {
  test('serves the crawlable career timeline', async ({ page }) => {
    await page.goto('/labs/small-world')
    const fallback = page.getByTestId('small-world-fallback')
    await expect(fallback).toBeAttached()
    await expect(fallback).toContainText('xDataGroup')
    await expect(fallback).toContainText('Senior Frontend Engineer')
    await expect(fallback).toContainText('BlueNet')
  })

  test('Esc returns to the museum', async ({ page }) => {
    await page.goto('/labs/small-world')
    await page.waitForLoadState('networkidle')
    await page.keyboard.press('Escape')
    await expect(page).toHaveURL('/')
  })
})
```

- [ ] **Step 2: Run it**

Run: `rm -rf .next; $env:CI=1; pnpm test:e2e -- labs-small-world.spec.ts` (PowerShell) — Expected: PASS on all browser projects.

- [ ] **Step 3: Full unit suite regression check**

Run: `pnpm test:unit` → all green (baseline was 531). Run: `pnpm build` → clean.

- [ ] **Step 4: Commit**

```bash
git add e2e/labs-small-world.spec.ts
git commit -m "test: Small World e2e smoke (crawlable fallback, Esc to museum)"
```

---

### Task 9: Gate 0 package (orchestrator-executed)

**Files:**
- Create: screenshots to scratchpad (not committed)

- [ ] **Step 1: Capture the look-dev deck** — Chrome MCP against `pnpm dev`: full-planet frame at rest, mid-skip frame, dwell-freeze frame; if `girl.glb` has landed, the real girl in all three. Strict self-review first against the reference-language research (composition rules, palette read, clay read) — fix what fails before showing anything.
- [ ] **Step 2: Present Gate 0 to Aram** — the deck + the asset manifest doc + a clear ask: bless/kill the character lane, bless the palette/clay read. Record the verdict.
- [ ] **Step 3: Write the Phase 2 plan** (`docs/superpowers/plans/<date>-labs-small-world-phase2.md`) from the verdict + research: chapter prop sets & morphing, discovery bursts, comic panel overlay system, poster + manifest entry, full e2e, Gate 1/Gate 2.

---

## Self-Review Notes

- **Spec coverage:** research phase (Task 1), asset pipeline (Tasks 2, 7), palette/type anchors (Task 3), timeline architecture (Task 4), route/fallback/bundle boundary (Task 5), look-dev + foot-sync (Task 6), gates (Task 9). Deliberately deferred to Phase 2 per gate ordering: chapter prop sets & morphing, panels, poster/manifest, museum integration, full e2e matrix. Fonts load in Phase 2 with the panel/title UI (no UI text exists in Phase 1 beyond the fallback).
- **Type consistency:** `journeyStateAt`, `JourneyState`, `PLANET_RADIUS`, `progressRef: MutableRefObject<number>`, `hasArt` used identically across Tasks 4-8.
- **Placeholder scan:** Task 7's clip names/scale are explicitly asset-dependent facts, not plan laziness — the contract (manifest gate, cadence lock, transform) is fully specified.
