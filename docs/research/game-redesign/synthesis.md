# Portfolio Game Redesign: Research Synthesis

**Created**: 2026-01-30
**Status**: Complete
**Research Files Synthesized**: 6

---

## Executive Summary

After synthesizing research across game genres, visual styles, level design, experience integration, recruiter psychology, and portfolio examples, **three approaches emerge as optimal** for the portfolio career game:

1. **Hybrid Skill Tree + Timeline Explorer** - Best balance of information density and engagement
2. **Deck-Builder Career System** - Deepest integration of career data as mechanics
3. **Visual-First Platformer Upgrade** - Lowest effort, highest immediate impact on current game

**Critical Insight**: Recruiters spend only **7.4 seconds** on initial review. Any approach must hook within 5 seconds and complete within 2 minutes. The game must be **optional** with all content accessible without playing.

---

## 1. Decision Matrix

### Genre Comparison

| Genre | Recruiter Time | Career Integration | Asset Needs | Mobile | Complexity | Score |
|-------|----------------|-------------------|-------------|--------|------------|-------|
| **Skill Tree + Timeline** | ★★★★★ | ★★★★☆ | ★★★★★ | ★★★★★ | ★★★★☆ | **24/25** |
| **Deck-Builder** | ★★★☆☆ | ★★★★★ | ★★★★☆ | ★★★★☆ | ★★★☆☆ | **19/25** |
| **Current Platformer (upgraded)** | ★★★★☆ | ★★★☆☆ | ★★★★★ | ★★★★☆ | ★★★★★ | **21/25** |
| **Idle/Incremental** | ★★★☆☆ | ★★★★☆ | ★★★★★ | ★★★★★ | ★★★★☆ | **20/25** |
| **Interactive Fiction** | ★★★★★ | ★★★★☆ | ★★★★★ | ★★★★★ | ★★★★★ | **24/25** |
| **3D Experience (Bruno Simon)** | ★★☆☆☆ | ★★☆☆☆ | ★☆☆☆☆ | ★★☆☆☆ | ★☆☆☆☆ | **8/25** |

**Scoring**: ★ = Poor, ★★★ = Average, ★★★★★ = Excellent

### Visual Style Comparison

| Style | Effort | Impact | Portfolio Fit | Performance | Score |
|-------|--------|--------|---------------|-------------|-------|
| **Geometric + Glow** | ★★★★★ | ★★★★☆ | ★★★★★ | ★★★★★ | **19/20** |
| **Silhouette + Gradient** | ★★★★★ | ★★★★★ | ★★★★☆ | ★★★★★ | **19/20** |
| **Flat Limited Palette** | ★★★★★ | ★★★★☆ | ★★★★★ | ★★★★★ | **19/20** |
| **Particle Effects** | ★★★★☆ | ★★★★★ | ★★★★☆ | ★★★★☆ | **17/20** |
| **Pixel Art (current)** | ★★★☆☆ | ★★★☆☆ | ★★★☆☆ | ★★★★★ | **14/20** |

### Experience Integration Depth

| Approach | Integration Depth | Implementation Effort | Recruiter Appeal |
|----------|-------------------|----------------------|------------------|
| **Deck-Builder Cards** | ★★★★★ | High | Medium |
| **Skill Tree Visualization** | ★★★★☆ | Medium | High |
| **Relic/Artifact System** | ★★★★☆ | Medium | Medium |
| **Narrative System** | ★★★☆☆ | Medium | High |
| **Current (Skills per World)** | ★★☆☆☆ | Already done | Medium |

---

## 2. Top 3 Recommended Approaches

### Approach A: Hybrid Skill Tree + Timeline Explorer (RECOMMENDED)

**Concept**: Interactive tech tree showing all skills, with timeline mode revealing career progression.

```
┌─────────────────────────────────────────────────────────┐
│  CAREER SKILL TREE                    [Timeline Mode]  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│              [TypeScript]──────[GraphQL]               │
│                 /    \            |                    │
│          [React]      [Node.js]──[PostgreSQL]         │
│           / | \          |                             │
│    [Native][Next.js][Redux]───[Prisma]                │
│       |       |                                        │
│   [Zustand] [TailwindCSS]                             │
│                                                         │
│  Click any node to see: Projects, Companies, Impact    │
├─────────────────────────────────────────────────────────┤
│  6 Companies • 12 Technologies • Technical Lead        │
└─────────────────────────────────────────────────────────┘
```

**Why Top Choice**:
- **Information Dense**: Recruiters can scan all skills at once (7-second friendly)
- **Interactive Depth**: Engaged users explore connections
- **Career Narrative**: Timeline mode tells the growth story
- **Low Assets**: Geometric shapes with glow effects
- **Mobile Excellent**: Pan/zoom works naturally on touch

**Key Features**:
- Main view: Interactive skill tree
- Click skill → Show companies where used, projects, proficiency
- Timeline toggle → Animate skill acquisition over career
- Quick stats always visible (years experience, tech count)

**Effort**: Medium (2-3 weeks)
**Impact**: Very High

---

### Approach B: Deck-Builder Career System

**Concept**: Technologies and achievements as playable cards with synergies.

```
┌─────────────────────────────────────────────────────────┐
│  YOUR CAREER DECK                      [15 Cards]      │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐                │
│  │★★ React │  │★★★ TS  │  │★ Node   │                │
│  │         │  │         │  │         │                │
│  │ +15%    │  │ +20%    │  │ Backend │                │
│  │ Speed   │  │ Dash    │  │ Skills  │                │
│  │         │  │         │  │         │                │
│  │ SYNERGY:│  │ SYNERGY:│  │ SYNERGY:│                │
│  │ Native  │  │ React   │  │ GraphQL │                │
│  └─────────┘  └─────────┘  └─────────┘                │
│                                                         │
│  [4B MESSAGES] - Achievement Card (360dialog)          │
│  "One-time: Clear all obstacles on screen"             │
│                                                         │
├─────────────────────────────────────────────────────────┤
│  Synergy Bonus: React + TypeScript = +1 Extra Jump     │
└─────────────────────────────────────────────────────────┘
```

**Why Strong Choice**:
- **Deepest Integration**: Career data IS the gameplay
- **Memorable**: Card synergies show skill relationships
- **Replayable**: Different "builds" for different career paths
- **Modern Appeal**: Deck-builders are popular (Slay the Spire, Balatro)

**Key Features**:
- Collect technology cards through worlds
- Cards have stats affecting gameplay
- Synergies reveal skill combinations
- Achievement cards from career highlights

**Effort**: High (4-6 weeks)
**Impact**: Very High (but higher time investment to experience)

---

### Approach C: Visual-First Platformer Upgrade (Quick Win)

**Concept**: Keep current platformer, dramatically upgrade visuals with zero art.

```
BEFORE (Current):                 AFTER (Upgraded):
┌─────────────────────┐          ┌─────────────────────┐
│ ████ ░░░░           │          │ ▓▓▓▓ ✧✧✧✧ ░░░ ≋≋≋  │
│    ████             │          │    ░▓▓▓▓░  ✦        │
│ ██████████████      │    →     │ ░░▓▓▓▓▓▓▓▓▓▓▓▓░░   │
│ Basic pixel art     │          │ Glow + Particles    │
│ No visual identity  │          │ Per-world palettes  │
└─────────────────────┘          └─────────────────────┘
```

**Immediate Upgrades** (1-2 days each):
1. Add `shadowBlur` glow to all entities
2. Implement 4-color palette per world
3. Add particle system for jump/land/collect
4. Create parallax background layers

**Why Strong Choice**:
- **Lowest Effort**: Build on existing code
- **Immediate Impact**: Visual polish is obvious
- **No Architecture Change**: Minimal risk
- **Can Combine**: Layer on top of Approach A later

**Key Features**:
- Geometric player with colored glow
- World-specific color palettes
- Particle effects for game "juice"
- Simple parallax backgrounds

**Effort**: Low (1 week)
**Impact**: Medium-High

---

## 3. Risk/Effort/Impact Analysis

### Detailed Assessment

| Approach | Effort | Impact | Risk | Time to MVP | Maintenance |
|----------|--------|--------|------|-------------|-------------|
| **A: Skill Tree** | Medium | Very High | Low | 2-3 weeks | Low |
| **B: Deck-Builder** | High | Very High | Medium | 4-6 weeks | Medium |
| **C: Visual Upgrade** | Low | Medium-High | Very Low | 1 week | Very Low |

### Risk Breakdown

**Approach A (Skill Tree)**
- ✅ Proven pattern (RPG skill trees well understood)
- ✅ Information accessible without playing
- ✅ Works on all devices
- ⚠️ May feel less "game-like"
- ⚠️ Requires good information architecture

**Approach B (Deck-Builder)**
- ✅ Most memorable and unique
- ✅ Deep career integration
- ⚠️ Takes time to experience fully
- ⚠️ Card balance is tricky
- ⚠️ May overwhelm casual viewers

**Approach C (Visual Upgrade)**
- ✅ Lowest risk (existing code)
- ✅ Immediate visual improvement
- ⚠️ Doesn't address shallow career integration
- ⚠️ Platformer may still not suit all recruiters

### Recruiter Psychology Alignment

| Approach | 5-Second Hook | 2-Minute Complete | Skip Option | Mobile |
|----------|---------------|-------------------|-------------|--------|
| **A: Skill Tree** | ★★★★★ | ★★★★★ | ★★★★★ | ★★★★★ |
| **B: Deck-Builder** | ★★★☆☆ | ★★★☆☆ | ★★★★☆ | ★★★★☆ |
| **C: Visual Upgrade** | ★★★★☆ | ★★★★☆ | ★★★★★ | ★★★★☆ |

---

## 4. Recommended Next Steps

### Phased Implementation Plan

```
PHASE 1: Visual Foundation (Week 1)
├── Implement geometric + glow visual style
├── Add particle effects
├── Create world-specific color palettes
└── Optimize for mobile touch

PHASE 2: Skill Tree Integration (Weeks 2-3)
├── Build interactive skill tree component
├── Connect to career data
├── Add timeline animation mode
└── Integrate with existing game (optional play)

PHASE 3: Deep Integration (Weeks 4-6, Optional)
├── Add card system for technologies
├── Implement synergy mechanics
└── Create achievement cards
└── Polish and balance
```

### Immediate Actions

1. **Today**: Create visual style prototype with glow effects
2. **This Week**: Build skill tree component with mock data
3. **Next Week**: Connect skill tree to real career data
4. **Then**: Evaluate if deck-builder adds enough value for effort

### Decision Points

| Checkpoint | Question | Go/No-Go Criteria |
|------------|----------|-------------------|
| End of Week 1 | Does visual upgrade feel premium? | Yes → Continue, No → Revisit style |
| End of Week 3 | Does skill tree provide value without game? | Yes → Ship, No → Iterate |
| End of Week 4 | Is deck-builder worth the extra effort? | Yes → Build, No → Ship skill tree |

---

## 5. Prototype Specifications

### Prototype A: Interactive Skill Tree

#### Technical Specification

```typescript
interface SkillNode {
  id: string;
  name: string;
  category: 'frontend' | 'backend' | 'mobile' | 'cloud' | 'tools';
  proficiency: 1 | 2 | 3 | 4 | 5;
  companies: string[];
  projects: string[];
  connections: string[]; // related skill IDs
  yearsUsed: number;
  position: { x: number; y: number };
}

interface SkillTreeState {
  nodes: SkillNode[];
  selectedNode: string | null;
  viewMode: 'tree' | 'timeline';
  timelineYear: number; // for animation
  zoomLevel: number;
  panOffset: { x: number; y: number };
}
```

#### Visual Design

```
COLORS:
├── Background: #0d1117 (GitHub dark)
├── Node inactive: #161b22
├── Node active: #58a6ff (glow)
├── Connections: #30363d
├── Text: #c9d1d9
└── Accent per category:
    ├── Frontend: #7ee787 (green)
    ├── Backend: #f78166 (orange)
    ├── Mobile: #a371f7 (purple)
    ├── Cloud: #79c0ff (light blue)
    └── Tools: #ffa657 (yellow)

ANIMATIONS:
├── Node hover: Scale 1.1, glow increase
├── Node select: Pulse animation, connections highlight
├── Timeline: Nodes fade in chronologically
└── Transitions: 300ms ease-out
```

#### Component Structure

```
<SkillTreeExplorer>
├── <TreeCanvas>
│   ├── <ConnectionLines />
│   ├── <SkillNodes />
│   └── <ZoomControls />
├── <NodeDetail>
│   ├── <SkillInfo />
│   ├── <CompanyList />
│   └── <ProjectLinks />
├── <TimelineSlider />
└── <QuickStats />
```

#### User Flows

```
Flow 1: Quick Scan (7 seconds)
Landing → See full tree → Scan categories → Quick stats visible → Decision

Flow 2: Engaged Exploration (2 minutes)
Landing → Click skill → See details → Click company → See related skills → Click project → External link

Flow 3: Timeline Journey (1 minute)
Landing → Click "Timeline" → Watch skills appear → See growth over time → End at current state
```

---

### Prototype B: Visual Upgrade for Current Platformer

#### Implementation Checklist

```typescript
// 1. GLOW EFFECTS (Day 1)
function drawPlayerWithGlow(ctx: CanvasRenderingContext2D, player: Player) {
  // Glow layer
  ctx.shadowColor = getWorldAccentColor(currentWorld);
  ctx.shadowBlur = 15 + Math.sin(Date.now() * 0.005) * 5; // Pulse
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;

  // Player shape (geometric rectangle)
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(player.x, player.y, PLAYER_WIDTH, PLAYER_HEIGHT);

  // Reset
  ctx.shadowBlur = 0;
}

// 2. WORLD PALETTES (Day 1)
const WORLD_PALETTES: Record<WorldId, Palette> = {
  bluenet: {
    bg: '#1a1a2e',
    platform: '#16213e',
    accent: '#ffd700', // Hotel gold
    player: '#ffffff',
  },
  flyerbee: {
    bg: '#1a1a1a',
    platform: '#2d2d2d',
    accent: '#ff6b00', // Logistics orange
    player: '#ffffff',
  },
  // ... etc
};

// 3. PARTICLE SYSTEM (Day 2)
class ParticleSystem {
  particles: Particle[] = [];

  emit(x: number, y: number, type: 'jump' | 'land' | 'collect' | 'dash') {
    const config = PARTICLE_CONFIGS[type];
    for (let i = 0; i < config.count; i++) {
      this.particles.push(new Particle(x, y, config));
    }
  }

  update(deltaTime: number) {
    this.particles = this.particles.filter(p => {
      p.update(deltaTime);
      return p.life > 0;
    });
  }

  draw(ctx: CanvasRenderingContext2D) {
    for (const p of this.particles) {
      p.draw(ctx);
    }
  }
}

// 4. PARALLAX BACKGROUND (Day 2-3)
interface ParallaxLayer {
  speed: number;
  color: string;
  generator: (x: number, canvasHeight: number) => void;
}

function drawParallax(ctx: CanvasRenderingContext2D, cameraX: number) {
  for (const layer of PARALLAX_LAYERS) {
    const offset = (cameraX * layer.speed) % ctx.canvas.width;
    layer.generator(offset, ctx.canvas.height);
  }
}
```

#### Before/After Comparison

| Element | Before | After |
|---------|--------|-------|
| Player | Flat colored rectangle | White rectangle with pulsing glow |
| Platforms | Solid dark rectangles | Dark with subtle edge glow |
| Background | Single color | 3-layer parallax with gradient |
| Collectibles | Static sprites | Glowing orbs with particle trail |
| Jump | No effect | Dust particle burst |
| Land | No effect | Impact particles |
| Dash | No effect | Speed lines + afterimage |
| Level Complete | Basic text | Particle celebration + screen flash |

---

## 6. Success Metrics

### Quantitative Targets

| Metric | Current | Target | Measurement |
|--------|---------|--------|-------------|
| Time to First Interaction | ~5s | <3s | Analytics |
| Core Loop Understanding | ~15s | <10s | User testing |
| Full Experience Discovery | ~5min | <2min | Session duration |
| Mobile Playability | Partial | Full | Device testing |
| Bounce Rate | Unknown | <40% | Analytics |
| Time on Site | Unknown | >2min | Analytics |

### Qualitative Targets

- [ ] Recruiter can understand career scope in 7 seconds
- [ ] All skills and companies visible without playing
- [ ] Game enhances rather than gates portfolio
- [ ] Mobile experience matches desktop
- [ ] Visual style feels premium and professional
- [ ] Career narrative is clear and memorable

---

## 7. Final Recommendation

### Executive Decision

**Implement Approach A (Skill Tree) with Approach C (Visual Upgrade) as foundation.**

**Rationale**:
1. **Addresses core weakness**: Shallow career integration
2. **Respects recruiter time**: Info visible in seconds
3. **Maintains game option**: Platformer as "Play" mode
4. **Low risk, high reward**: Proven patterns
5. **Mobile-first**: Critical for recruiter use case
6. **Extensible**: Can add deck-builder later if desired

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    PORTFOLIO GAME                        │
├──────────────────────┬──────────────────────────────────┤
│   SKILL TREE VIEW    │         PLAY MODE               │
│   (Default)          │         (Optional)               │
├──────────────────────┼──────────────────────────────────┤
│ • Interactive nodes  │ • 6 worlds (existing)           │
│ • Timeline animation │ • Visual upgrade                │
│ • Project links      │ • Skills unlock nodes           │
│ • Quick stats        │ • Technologies as collectibles  │
├──────────────────────┴──────────────────────────────────┤
│                  SHARED CAREER DATA                      │
│        Companies • Technologies • Projects • Skills      │
└─────────────────────────────────────────────────────────┘
```

### Timeline

| Week | Deliverable |
|------|-------------|
| 1 | Visual upgrade complete (Approach C) |
| 2 | Skill tree prototype with mock data |
| 3 | Skill tree integrated with real career data |
| 4 | Polish, mobile testing, accessibility |
| 5 | Launch + gather feedback |

---

## Appendix: Research File Summary

| File | Key Insight |
|------|-------------|
| `game-genres.md` | Skill Tree + Timeline is optimal for recruiter time constraints |
| `visual-styles.md` | Geometric + glow achieves premium look with zero art |
| `level-design.md` | Solution path first algorithm ensures playability |
| `experience-integration.md` | Deck-builder offers deepest integration but highest effort |
| `recruiter-psychology.md` | 7.4 seconds to hook, Peak-End Rule critical |
| `portfolio-examples.md` | Robby Leonardi pattern proven; must be optional |

---

*Synthesis completed: 2026-01-30*
*Ready for implementation planning*
