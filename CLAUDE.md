# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Personal portfolio website with an integrated Super Mario World-style career platformer game. Built with Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS 4, Framer Motion, and Zustand.

## Commands

```bash
# Development
pnpm dev                    # Start dev server with Turbopack
pnpm build                  # Production build
pnpm lint                   # ESLint

# Testing
pnpm test                   # All tests (unit + storybook)
pnpm test:unit              # Unit tests only
pnpm test:storybook         # Story tests only (browser)
pnpm test:coverage          # With coverage report
pnpm test:e2e               # Playwright E2E (starts dev server)
pnpm test:e2e:ui            # Playwright UI mode

# Run single test file
pnpm vitest __tests__/path/to/file.test.ts

# Storybook
pnpm storybook              # Dev on port 6006
pnpm build-storybook        # Build static
```

## Architecture

### Portfolio Sections
The main page (`app/page.tsx`) renders sections sequentially: Hero, About, Skills, Timeline, Projects, StateDemo, CareerGame, Contact.

### Career Platformer Game

The game is a canvas-based 2D platformer where completing "worlds" (based on real work experience) unlocks skills:

| World | Company | Skill Unlocked |
|-------|---------|----------------|
| 1 | BlueNet | double_jump |
| 2 | FLYERBEE | wall_slide |
| 3 | 360dialog | dash |
| 4 | Accenture | shield |
| 5 | AKNA | magnet |
| 6 | xDataGroup | float |

**Key game files:**
- `components/sections/world-game.tsx` - Main game loop, rendering, screen management (~1000 lines)
- `lib/game/world/worldState.ts` - Zustand store for progression (persisted to localStorage)
- `lib/game/world/skillPhysics.ts` - Skill mechanics, physics processing
- `lib/game/world/levelGenerator.ts` - Procedural platform/collectible generation
- `lib/game/world/index.ts` - Public API barrel export

**Screen state machine:** `overworld → level → level_complete → skill_unlock → overworld`

### State Management Pattern

Zustand with Immer middleware for immutable updates:
```typescript
create<State>()(
  devtools(
    persist(
      immer((set) => ({ /* actions */ })),
      { name: 'store-key' }
    )
  )
)
```

## Critical Patterns

### Immutability (MANDATORY for game code)

Zustand+Immer freezes state. Direct mutation causes runtime errors:
```typescript
// ❌ WRONG - causes error
skillState.doubleJump.jumpsRemaining -= 1

// ✅ CORRECT - create new objects
const newSkillState = {
  ...skillState,
  doubleJump: { ...skillState.doubleJump, jumpsRemaining: skillState.doubleJump.jumpsRemaining - 1 }
}
```

### Game Loop Refs

Use refs for values accessed every frame to avoid re-renders:
```typescript
const skillStateRef = useRef<SkillState>(createInitialSkillState())
const keysRef = useRef<Set<string>>(new Set())
```

### Delta Time Physics

Always use delta time for frame-rate independence:
```typescript
const deltaTime = Math.min((now - lastTime) / 16.67, 2)
player.x += player.vx * deltaTime
```

### Seeded Random

Level generation uses deterministic seeded random for consistent levels.

## Testing

- **Unit tests:** `__tests__/**/*.test.{ts,tsx}` - jsdom environment
- **Story tests:** Storybook with Vitest addon - browser environment
- **E2E tests:** `e2e/` - Playwright (5 browser configs)

Test setup files mock browser APIs: IntersectionObserver, ResizeObserver, matchMedia, scrollTo, requestAnimationFrame.

## Path Alias

`@/*` maps to project root (e.g., `@/components/ui/button`).
