# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Personal portfolio website with interactive Bento Grid experience section. Built with Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS 4, Framer Motion, and Zustand.

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
The main page (`app/page.tsx`) renders sections sequentially: Hero, About, Skills, ExperienceBento, Projects, Contact.

### Experience Bento Grid

Interactive grid showcasing work experience with hover reveals:
- `components/sections/experience-bento.tsx` - Main section with career stats and grid
- `components/experience/bento-cell.tsx` - Individual cell with hover effects
- `lib/experience-grid.ts` - Grid configuration (sizes, colors, featured status)

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

### Immutability (MANDATORY)

Zustand+Immer freezes state. Direct mutation causes runtime errors:
```typescript
// ❌ WRONG - causes error
state.value = newValue

// ✅ CORRECT - create new objects
return { ...state, value: newValue }
```

## Testing

- **Unit tests:** `__tests__/**/*.test.{ts,tsx}` - jsdom environment
- **Story tests:** Storybook with Vitest addon - browser environment
- **E2E tests:** `e2e/` - Playwright (5 browser configs)

Test setup files mock browser APIs: IntersectionObserver, ResizeObserver, matchMedia, scrollTo, requestAnimationFrame.

## Path Alias

`@/*` maps to project root (e.g., `@/components/ui/button`).
