# Aram Yeghiazaryan - Portfolio

A modern, interactive portfolio website built with Next.js 15, showcasing 8+ years of frontend engineering expertise.

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Styling**: Tailwind CSS 4 with OKLCH color system
- **Animations**: Framer Motion
- **State Management**: Zustand (with immer & persist)
- **UI Components**: Shadcn/ui
- **Language**: TypeScript

## Features

### Sections
- **Hero** - Animated pixel art avatar, typewriter effect, floating tech icons
- **About** - Expandable cards, fun facts, animated background elements
- **Skills** - Focus areas highlighting modern stack, category filters
- **Experience** - Interactive timeline with tech filtering, career progression
- **Projects** - Category filters, impact metrics, featured project badges
- **Interactive Terminal** - Fun command-line interface to explore
- **Contact** - Maximum personality with power level meter, confetti effects

### Highlights
- Warm terracotta/burgundy color palette
- Light & dark theme support
- Responsive design
- Smooth scroll animations
- SEO optimized
- Accessibility focused

### Hidden Features
There are easter eggs hidden throughout the site. Happy hunting!

## Getting Started

### Prerequisites
- Node.js 18+
- pnpm (recommended)

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/portfolio.git
cd portfolio

# Install dependencies
pnpm install

# Start development server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

### Build

```bash
# Build for production
pnpm build

# Start production server
pnpm start
```

## Project Structure

```
├── app/                    # Next.js App Router
│   ├── layout.tsx          # Root layout
│   ├── page.tsx            # Home page
│   ├── providers.tsx       # Theme & easter egg providers
│   └── globals.css         # Global styles & theme variables
├── components/
│   ├── animation/          # Reusable animation components
│   ├── sections/           # Page sections
│   ├── layout/             # Header, footer
│   └── ui/                 # UI primitives (shadcn)
├── data/                   # Static data (projects, skills, experience)
├── hooks/                  # Custom React hooks
├── lib/                    # Utilities, constants, store
└── types/                  # TypeScript type definitions
```

## Performance

- Static generation for optimal performance
- Code splitting with dynamic imports
- Optimized images and assets
- ~180KB First Load JS (including animations)

## Accessibility

- Semantic HTML structure
- ARIA labels where appropriate
- Keyboard navigation support
- Color contrast compliant
- Reduced motion support (respects user preferences)

## Customization

### Colors
Edit theme colors in `app/globals.css`:
- Primary: Warm terracotta
- Accent: Soft peach
- Background: Cream (light) / Dark charcoal (dark)

### Content
Update your information in:
- `lib/constants.ts` - Personal info, social links
- `data/projects.ts` - Project portfolio
- `data/experience.ts` - Work history
- `data/skills.ts` - Tech skills

## License

MIT License - feel free to use this as a template for your own portfolio!

## Author

**Aram Yeghiazaryan**
- Senior Frontend Engineer & Technical Lead
- 8+ years of experience
- Specializing in React, TypeScript, Next.js

---

Built with passion for great user experiences.
