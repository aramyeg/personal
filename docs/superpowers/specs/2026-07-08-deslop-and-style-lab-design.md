# De-slop + Style Lab — Design Spec

Date: 2026-07-08
Status: approved direction (terracotta + pixel avatar for main site; PS1/Y2K saved as first lab)

## Goals

1. Remove the generic "AI-generated portfolio" look from the main site while keeping its
   two real assets: the warm terracotta/cream token system and the hand-made personality
   layer (pixel avatar, terminal, easter eggs).
2. Set up an extensible `/labs` structure so the same content (`data/`) can be re-skinned
   as many different visual identities, published near-daily to LinkedIn.

## Non-goals

- No content rewrites beyond framing copy (experience/project data stays as is).
- No new backend, CMS, or analytics.
- Labs are free-form: the structure must not assume a page shape (a lab may be a full
  site, a game screen, a maze, a newspaper — anything that reads `data/`).

## Track 1 — De-slop the main site

### Phase 1: broken basics
- Hero content visible immediately; entrance animation becomes enhancement (no blank
  cream screen). Sections render visible by default; scroll animation only enhances.
- Fix `components/layout/header.tsx:48` — `hsl(var(--background)/0.8)` resolves to
  nothing (tokens are OKLCH). Use a working token-based background.
- Reconcile contact data: email is `aramyeg96@gmail.com` everywhere
  (`lib/constants.ts` has `aramyeg@gmail.com`; terminal has `aram@example.com`).
  Verify GitHub/LinkedIn URLs in `lib/constants.ts` with the user before shipping.

### Phase 2: the purge
Remove: gradient orbs, floating tech icons, floating code glyphs, typewriter taglines,
stacked hero badge pills, bouncing SCROLL indicator, emoji stat counters, skill progress
bars with "Expert" badges, fake "Impact Level" and "Developer Power Level" meters,
Contact section floating emoji + hype copy, "Built with ❤️ using Next.js…" footer line,
"20+ Projects Delivered" (unverifiable).

Unify accents to the terracotta system: replace hardcoded `#3B82F6/#8B5CF6/#A855F7/...`
in `lib/experience-grid.ts`, sky/amber/rose gradients in About/Skills, the purple-pink
combo banner in Skills, and restyle the grey terminal into warm tokens.

Copy rewrite: lead with facts (AMIO Bank platform lead; 360dialog 50k+ businesses /
4B+ messages; SNB car-leasing feature, 5M+ downloads / 4.7★; marketing→code 2016).
Kill "exceptional experiences", "passionate", "cutting-edge", "magic together" family.
Keep the easter eggs (avatar clicker, terminal commands, footer eras, skills combo).

### Phase 3: signature — pixel avatar as hero centerpiece
- Redraw on a 32×40 grid: buzz cut (replaces man-bun/long hair), 2–3 tone shading,
  defined face, band-tee print (abstract metal nod), theme-reactive tee colors kept.
- Eyes track the cursor (4px eyes, look left/right/up/down); keep blink + click easter egg.
- Larger presence in hero; remove the orbiting code glyphs around it.

### Phase 4: typography
- Display face: Bricolage Grotesque (variable, self-hosted via @fontsource-variable)
  for headings; Inter stays for body; JetBrains Mono stays for terminal/utility.
  If Bricolage clashes with the warm system in practice, decide replacement at
  implementation with a screenshot comparison.

## Track 2 — Style lab

- `lib/labs-manifest.ts`: `{ slug, title, date, thesis }[]` + per-lab OG metadata.
- `app/labs/page.tsx`: gallery page (main-site design system) listing experiments.
- `app/labs/<slug>/page.tsx` + `components/labs/<slug>/`: fully self-contained
  experiments. Each lab renders inside its own full-viewport wrapper that owns its
  tokens/background, escaping the terracotta globals. Shared content comes only
  from `data/`.
- Lab #1 `/labs/ps1`: port the PS1/Y2K concept (software-rendered canvas: flat shading,
  Bayer dither, vertex snap at 384px internal res; grid world; memory-card project
  slots) into a React client component. "Player select" screen is a candidate v2.

## Order of work

1. Track 1 phases 1→4 (screenshot checkpoint after each phase).
2. Track 2 structure + PS1 port.

## Verification

- `pnpm lint`, `pnpm test:unit`, `pnpm build` green after each phase.
- Visual verification in browser (screenshots) per phase; reduced-motion respected.
