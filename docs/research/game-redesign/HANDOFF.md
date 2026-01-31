# Portfolio Game Redesign: Handoff Document

**Created**: 2026-01-31
**Purpose**: Enable another agent to continue implementation with full context

---

## Project Vision

Transform the portfolio career game from a **decorative platformer** into a **meaningful career visualization** where work experience IS the gameplay, not just decoration.

**Current Problem**: The existing Super Mario World-style platformer treats career data as flavor. The game would function identically with different career data. Recruiters may skip it entirely.

**Target Outcome**: An interactive experience where:
- Recruiters understand the full career scope in **7 seconds**
- Technologies and achievements are **core mechanics**, not collectibles
- The game is **optional** - all content accessible without playing
- Completion takes **under 2 minutes**

---

## Research Findings Summary

Six parallel research agents investigated:

| Research Area | Key Finding |
|---------------|-------------|
| **Game Genres** | Skill Tree + Timeline beats platformer for recruiter time constraints |
| **Visual Styles** | Geometric + glow effects achieve premium look with zero art assets |
| **Level Design** | Solution-path-first algorithm guarantees playability |
| **Experience Integration** | Deck-builder offers deepest integration; Skill Tree best effort/impact ratio |
| **Recruiter Psychology** | 7.4 seconds initial scan; Peak-End Rule critical; must be optional |
| **Portfolio Examples** | Robby Leonardi pattern proven; Bruno Simon too heavy for our needs |

### Critical Stats

- **7.4 seconds**: Average recruiter resume review time
- **55 seconds**: Combined resume + portfolio evaluation
- **5 seconds**: Window to hook or lose attention
- **2 minutes**: Maximum realistic engagement time
- **40%+**: Recruiters checking portfolios on mobile

---

## Recommended Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    PORTFOLIO GAME v2                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   ┌─────────────────────┐    ┌─────────────────────────┐   │
│   │   SKILL TREE VIEW   │    │   PLAY MODE (Optional)  │   │
│   │   (Default Entry)   │    │                         │   │
│   ├─────────────────────┤    ├─────────────────────────┤   │
│   │ • Interactive nodes │    │ • 6 worlds (existing)   │   │
│   │ • Timeline animation│    │ • Platformer gameplay   │   │
│   │ • Company details   │    │ • Unlocks tree nodes    │   │
│   │ • Project links     │    │ • Visual polish (final) │   │
│   │ • Quick stats       │    │                         │   │
│   └─────────────────────┘    └─────────────────────────┘   │
│              │                          │                   │
│              └──────────┬───────────────┘                   │
│                         ▼                                    │
│              ┌─────────────────────┐                        │
│              │  SHARED CAREER DATA │                        │
│              │  (Single Source)    │                        │
│              └─────────────────────┘                        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Implementation Phases

### Phase 1: Skill Tree Component (Priority)
Build interactive skill tree as the **primary** portfolio game view.

**Deliverables**:
- Interactive node graph showing all technologies
- Click node → show companies, projects, proficiency
- Timeline mode → animate skill acquisition over career
- Quick stats always visible (years, tech count, role)
- Mobile touch support (pan/zoom)

**Why First**: Addresses core recruiter need (fast information access) without requiring game play.

### Phase 2: Data Integration
Connect skill tree to real career data and existing game state.

**Deliverables**:
- Unified career data store (companies, technologies, projects)
- Skill tree nodes populated from data
- Playing platformer unlocks/highlights tree nodes
- Bi-directional: tree can launch specific world

### Phase 3: Platformer Enhancements
Deepen career integration in existing platformer.

**Deliverables**:
- Technology collectibles with identity (not generic)
- Company-specific level theming
- Achievement cards for career highlights
- Optional: Card/synergy mechanics

### Phase 4: Visual Polish (Final)
Apply visual upgrades across both views.

**Deliverables**:
- Geometric + glow effect system
- Per-world color palettes
- Particle effects (jump, land, collect, dash)
- Parallax backgrounds
- Screen shake, celebrations

**Why Last**: Visual polish is high-impact but not structural. Build mechanics first.

---

## Technical Context

### Current Stack
- **Framework**: Next.js 15 + React 19 + TypeScript 5.7
- **Styling**: Tailwind CSS 4 + Framer Motion 12
- **State**: Zustand 5 + Immer (frozen state - NO MUTATIONS)
- **Rendering**: HTML5 Canvas (620×220 game, 620×300 overworld)
- **Testing**: Vitest 4 + Playwright 1.58

### Existing Game Structure
```
lib/game/world/
├── types.ts              # World, Level, Skill definitions
├── worldData.ts          # 6 worlds configuration
├── worldState.ts         # Zustand store (persisted)
├── levelGenerator.ts     # Procedural generation
├── skillConfig.ts        # 6 skills definitions
└── skillPhysics.ts       # Immutable physics processing

components/sections/
├── career-game.tsx       # Entry point
└── world-game.tsx        # Main game (~900 lines)
```

### Career Data (6 Worlds)

| World | Company | Skill Unlocked | Key Technologies |
|-------|---------|----------------|------------------|
| 1 | BlueNet/FreeDOM | double_jump | React, Electron, Node.js |
| 2 | FLYERBEE AG | wall_slide | React Native, Redux |
| 3 | 360dialog | dash | TypeScript, GraphQL, PostgreSQL |
| 4 | Accenture | shield | React Native, Jest, Security |
| 5 | AKNA | magnet | Next.js, Styled Components |
| 6 | xDataGroup | float | Prisma, TanStack Query, Chakra UI |

### Critical Pattern: Immutability

```typescript
// ❌ WRONG - Zustand+Immer freezes state
skillState.doubleJump.jumpsRemaining -= 1;

// ✅ CORRECT - Create new objects
const newSkillState = {
  ...skillState,
  doubleJump: {
    ...skillState.doubleJump,
    jumpsRemaining: skillState.doubleJump.jumpsRemaining - 1,
  },
};
```

---

## Skill Tree Specification

### Data Model

```typescript
interface SkillNode {
  id: string;                    // 'react', 'typescript', etc.
  name: string;                  // Display name
  category: 'frontend' | 'backend' | 'mobile' | 'cloud' | 'tools';
  proficiency: 1 | 2 | 3 | 4 | 5;
  companies: WorldId[];          // Where this tech was used
  projects: ProjectLink[];       // Related work
  connections: string[];         // Related skill IDs
  yearsUsed: number;
  unlockedAt?: Date;             // For timeline animation
}

interface SkillTreeState {
  nodes: SkillNode[];
  selectedNode: string | null;
  viewMode: 'tree' | 'timeline';
  timelineYear: number;
  zoom: number;
  pan: { x: number; y: number };
}
```

### Visual Spec

```
COLORS (GitHub Dark theme):
├── Background: #0d1117
├── Node inactive: #161b22
├── Node active: #58a6ff (with glow)
├── Connections: #30363d
├── Text: #c9d1d9
└── Category accents:
    ├── Frontend: #7ee787
    ├── Backend: #f78166
    ├── Mobile: #a371f7
    ├── Cloud: #79c0ff
    └── Tools: #ffa657

INTERACTIONS:
├── Hover: Scale 1.1, glow increase
├── Click: Expand details panel
├── Drag: Pan view
├── Pinch/Scroll: Zoom
└── Timeline toggle: Animate nodes appearing chronologically
```

---

## Research Documents

All research is available in `docs/research/game-redesign/`:

| File | Contents |
|------|----------|
| `RESEARCH_PLAN.md` | Original research questions and agent prompts |
| `game-genres.md` | 5 genre options analyzed |
| `visual-styles.md` | 5 visual approaches with code examples |
| `level-design.md` | Procedural generation algorithms |
| `experience-integration.md` | 6 integration approaches (deck-builder, skill tree, etc.) |
| `recruiter-psychology.md` | Eye-tracking studies, time stats, do's/don'ts |
| `portfolio-examples.md` | 12 real portfolio examples analyzed |
| `synthesis.md` | Full decision matrix and recommendations |

---

## Success Criteria

### Quantitative

| Metric | Target |
|--------|--------|
| Time to First Interaction | < 3 seconds |
| Core Understanding | < 10 seconds |
| Full Experience | < 2 minutes |
| Mobile Playability | Full touch support |
| Code Complexity | < 500 lines for skill tree |

### Qualitative

- [ ] Recruiter can understand career scope in 7 seconds
- [ ] All skills/companies visible without playing game
- [ ] Game enhances portfolio, doesn't gate it
- [ ] Career data IS the mechanics, not decoration
- [ ] Mobile experience equals desktop

---

## Next Action

**Start Phase 1**: Build the Skill Tree component.

1. Create `components/game/SkillTree.tsx`
2. Define skill node data structure
3. Implement interactive canvas/SVG rendering
4. Add node selection and detail panel
5. Connect to existing world data
6. Add timeline animation mode

The skill tree becomes the **default view** of the career game section, with "Play Game" as an optional mode for engaged visitors.

---

*Handoff document created: 2026-01-31*
*Research complete. Ready for implementation.*
