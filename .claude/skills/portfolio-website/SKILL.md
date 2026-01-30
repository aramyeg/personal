---
name: portfolio-website
description: Personal portfolio/CV website patterns for Next.js 15, React 19, Tailwind CSS 4, Framer Motion, and Zustand. Covers section components, animations, and responsive design.
user_invocable: true
command: portfolio
---

# Portfolio Website Patterns

Patterns and conventions for the personal portfolio/CV website.

## Tech Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js | 15 | Framework (App Router, Turbopack) |
| React | 19 | UI Library |
| TypeScript | 5.7 | Type safety |
| Tailwind CSS | 4 | Styling |
| Framer Motion | 12+ | Animations |
| Zustand + Immer | 5 | State management |
| Radix UI | - | Accessible primitives |
| Vitest | 4 | Unit testing |
| Playwright | 1.58 | E2E testing |
| Storybook | 10 | Component development |

## Project Structure

```
app/
├── layout.tsx          # Root layout with providers
├── page.tsx            # Homepage with all sections
└── providers.tsx       # Theme and state providers

components/
├── sections/           # Page sections
│   ├── hero.tsx        # Hero/intro section
│   ├── about.tsx       # About me
│   ├── timeline.tsx    # Career timeline
│   ├── career-game.tsx # Game entry point
│   ├── world-game.tsx  # Main platformer game
│   ├── skills.tsx      # Technical skills
│   ├── projects.tsx    # Project showcase
│   ├── contact.tsx     # Contact form
│   └── footer.tsx      # Site footer
├── ui/                 # Reusable UI components
└── game/               # Game-specific components
    ├── overworld/      # World map components
    ├── LevelComplete.tsx
    ├── SkillUnlock.tsx
    └── GameHUD.tsx

lib/
├── game/world/         # Game logic
└── utils/              # Utility functions
```

## Section Component Pattern

```typescript
'use client'

import { motion } from 'framer-motion'

type SectionProps = {
  id: string
  className?: string
}

export function Section({ id, className }: SectionProps) {
  return (
    <section
      id={id}
      className={cn(
        'py-16 md:py-24',
        'scroll-mt-16', // Offset for sticky header
        className
      )}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-100px' }}
        transition={{ duration: 0.5 }}
      >
        {/* Content */}
      </motion.div>
    </section>
  )
}
```

## Animation Patterns

### Scroll Reveal

```typescript
const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.5 },
}

<motion.div {...fadeInUp}>
  {content}
</motion.div>
```

### Staggered Children

```typescript
const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
}

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
}

<motion.ul variants={container} initial="hidden" animate="show">
  {items.map((i) => (
    <motion.li key={i.id} variants={item}>
      {i.content}
    </motion.li>
  ))}
</motion.ul>
```

### Hover Effects

```typescript
<motion.div
  whileHover={{ scale: 1.02 }}
  whileTap={{ scale: 0.98 }}
  transition={{ type: 'spring', stiffness: 400, damping: 17 }}
>
  {content}
</motion.div>
```

## Tailwind CSS 4 Patterns

### Container

```typescript
<div className="container mx-auto px-4 md:px-6 lg:px-8">
  {content}
</div>
```

### Responsive Typography

```typescript
<h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold">
  {title}
</h1>
```

### Dark Mode

```typescript
<div className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
  {content}
</div>
```

### Glass Effect

```typescript
<div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border border-gray-200 dark:border-gray-800">
  {content}
</div>
```

## State Management

### Theme Provider (next-themes)

```typescript
import { ThemeProvider } from 'next-themes'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      {children}
    </ThemeProvider>
  )
}
```

### Zustand Store Pattern

```typescript
import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { persist } from 'zustand/middleware'

type Store = {
  // State
  value: string
  // Actions
  setValue: (value: string) => void
}

export const useStore = create<Store>()(
  persist(
    immer((set) => ({
      value: '',
      setValue: (value) => set((state) => { state.value = value }),
    })),
    { name: 'store-key' }
  )
)
```

## Testing Patterns

### Unit Test (Vitest)

```typescript
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Section } from './Section'

describe('Section', () => {
  it('renders with correct id', () => {
    render(<Section id="test" />)
    expect(document.getElementById('test')).toBeInTheDocument()
  })
})
```

### E2E Test (Playwright)

```typescript
import { test, expect } from '@playwright/test'

test('homepage loads', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle(/Portfolio/)
  await expect(page.locator('#hero')).toBeVisible()
})

test('navigation works', async ({ page }) => {
  await page.goto('/')
  await page.click('a[href="#about"]')
  await expect(page.locator('#about')).toBeInViewport()
})
```

### Storybook Story

```typescript
import type { Meta, StoryObj } from '@storybook/react'
import { Section } from './Section'

const meta: Meta<typeof Section> = {
  component: Section,
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    id: 'test-section',
  },
}
```

## Commands

```bash
npm run dev           # Start dev server with Turbopack
npm run build         # Production build
npm test              # Run Vitest
npm run test:e2e      # Run Playwright E2E tests
npm run storybook     # Start Storybook
npm run lint          # ESLint
```

## Key Files

| Purpose | Path |
|---------|------|
| Homepage | `app/page.tsx` |
| Layout | `app/layout.tsx` |
| Providers | `app/providers.tsx` |
| Hero Section | `components/sections/hero.tsx` |
| Career Game | `components/sections/career-game.tsx` |
| UI Components | `components/ui/` |

## Best Practices

1. **Accessibility**: Use semantic HTML, Radix primitives, proper aria attributes
2. **Performance**: Lazy load below-fold sections, optimize images
3. **SEO**: Add meta tags, structured data, sitemap
4. **Responsive**: Mobile-first design, test at all breakpoints
5. **Animations**: Use `prefers-reduced-motion` for accessibility
6. **State**: Keep client state minimal, prefer server components
