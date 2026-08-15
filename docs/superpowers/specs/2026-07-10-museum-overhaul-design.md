# Museum Overhaul — Design

**Date:** 2026-07-10
**Status:** Approved by Aram (structure + all four direction questions answered; full design approved verbatim)
**Branch:** worktree-museum-main

## Summary

The first-person museum becomes the site's main page at `/`. The terracotta
portfolio is demoted to a painting named **"Classic Claude"** at
`/classic-claude`. The museum itself gets: Shift-to-run and Space-to-jump
movement, a red theater-drape loader that doubles as a visitor's guide
(controls explanation), a "lean-in" info card previewing what's inside a
focused painting, and a rebuilt list view styled as the museum's exhibition
catalogue with a crawlable SEO intro.

User-confirmed decisions:

| Decision | Choice |
| --- | --- |
| Portfolio's new route | `/classic-claude`, painting title "Classic Claude" |
| Old `/labs` hub URL | Dropped entirely (404). No redirect — nothing external links to it. Individual labs stay at `/labs/<slug>`. |
| Crawler content at `/` | Crawlable intro (name, role, links) + redesigned list, server-rendered |
| Painting preview | Lean-in info card driven by existing focus state |
| Controls explanation | On the closed curtains ("visitor's guide"), plus persistent hint line and a "?" reopen button |
| List view direction | Exhibition catalogue — museum identity (wine/gold/serif) brought out of WebGL |

## 1. Routing: the museum takes `/`

### Route changes

- `app/page.tsx` → becomes the hub: `<Suspense fallback={<LabsList />}><LabsViewSwitch /></Suspense>`
  (the exact structure of today's `app/labs/page.tsx:15-17`). Root-layout
  metadata (name, Senior Frontend Engineer, OG, robots — `app/layout.tsx:6-45`)
  stays as-is; the museum inherits the site's SEO identity.
- `app/classic-claude/page.tsx` → the current portfolio page verbatim
  (Header, main#main-content with Hero/About/Skills/StateDemo/ExperienceBento/
  Projects/Contact, Footer — today's `app/page.tsx:1-27`), plus a metadata
  override: title `"Classic Claude | Aram Yeghiazaryan"`, description keeping
  the current portfolio description.
- `app/labs/page.tsx` → **deleted**. `/labs` 404s. `/labs/<slug>` pages are
  untouched. `?view=list` keeps working at `/?view=list` (`lib/labs-view.ts`
  logic is unchanged).

### Manifest (`lib/labs-manifest.ts`)

The `main` entry only (slug stays `main` — poster path `/labs/main/poster.jpg`
unchanged):

- `title: 'Classic Claude'`
- `href: '/classic-claude'`
- `thesis: 'Standard AI with a twist — warm terracotta and cream, pixel avatar, Bricolage Grotesque. The control every experiment is measured against.'`

### Every internal reference that must update

From the research reference catalog (file:line on current main):

| Site | Current | New |
| --- | --- | --- |
| `components/labs/gallery-chrome.tsx:17` (Esc) | `router.push('/labs')` | `router.push('/')` |
| `components/labs/gallery-chrome.tsx:26` (back link) | `href="/labs"` "← Gallery" | `href="/"` "← Gallery" |
| `components/sections/footer.tsx:20` | `{ label: 'Style Lab', href: '/labs' }` | `{ label: 'Museum', href: '/' }` |
| `app/labs/ps1/page.tsx:31` | `<Link href="/labs">← All experiments</Link>` | `href="/"` |
| `app/labs/ps1/page.tsx:34` | `<Link href="/">Main site</Link>` | `href="/classic-claude"`, label "Classic Claude" |
| `components/labs/xp/start-menu.tsx:34` | `router.push('/labs')` | `router.push('/')` |
| `components/labs/xp/win-ie.tsx:17` | `<iframe src="/">` | `src="/classic-claude"` |
| `components/labs/xp/win-ie.tsx:12` | address text `https://aram.dev` | `https://aram.dev/classic-claude` |
| `components/labs/snowpark/snowpark-game.tsx:423,456` | `href="/labs"` | `href="/"` |
| `components/labs/museum/museum-gallery.tsx:88` | `<Link href="/labs?view=list">` | `href="/?view=list"` |
| `components/labs/labs-list.tsx:48-54` | "← Back to the main site" → `/` | removed — the crawlable masthead + Classic Claude catalogue entry replace it |

Unchanged by design: `museum-gallery.tsx:41` and `win-recycle-bin.tsx:21`
(`lab.href ?? /labs/${slug}` — the fallback still points at real lab routes),
`labs-list.tsx:8` (same fallback), poster texture paths (slug-keyed).

### Tests affected

- `e2e/navigation.spec.ts` + `e2e/fixtures/portfolio-page.ts:33`: `goto('/')`
  → `goto('/classic-claude')`. Add `id="hero"` to
  `components/sections/hero.tsx` — fixes the known pre-existing "hero visible"
  failure while retargeting.
- `e2e/labs-gallery.spec.ts`, `e2e/labs-attic.spec.ts`: `/labs` → `/`,
  `/labs?view=list` → `/?view=list`.
- `__tests__/components/labs/labs-list.test.tsx:23-26`: "main site link →
  `/`" assertion is replaced by assertions on the new masthead (see §5).
- `__tests__/labs/gallery-chrome.test.tsx` + `__tests__/components/labs/gallery-chrome.test.tsx`:
  `/labs` → `/`.
- `__tests__/labs/xp/start-menu.test.tsx:29`, `__tests__/labs/xp/esc-ordering.test.tsx:47`:
  `/labs` → `/`.
- `__tests__/labs/manifest.test.ts`: add assertions for the renamed main entry
  (title "Classic Claude", href `/classic-claude`).

## 2. Movement: Shift-run + Space-jump

All in `components/labs/museum/player-controls.tsx` with the math extracted to
a new pure module `components/labs/museum/movement.ts` (unit-testable, like
`layout.ts` — player-controls has no tests and stays untested).

### Sprint

- `ShiftLeft`/`ShiftRight` tracked as a separate boolean ref — **not** added
  to `KEYMAP` (the axis code at player-controls.tsx:48-55 sign-normalizes;
  a multiplier does not belong there).
- Speed: `PLAYER.speed * SPRINT_MULT` with `SPRINT_MULT = 1.85`
  (3 → 5.55 u/s). Constant lives in `movement.ts`.
- Feel: camera FOV lerps 60 → 66 while sprinting *and moving*, back to 60
  otherwise (lerp factor ~8/s, `camera.updateProjectionMatrix()` when it
  changes by >0.01). Sprint with no movement input does not zoom.

### Jump

- `Space` keydown (with `preventDefault`, same listener as existing keys):
  if grounded, set vertical velocity `JUMP_V0 = 3.2` u/s; gravity
  `GRAVITY = 9.8` u/s² (≈0.52u apex, ≈0.65s airtime — a playful hop).
- Integration: `movement.ts` exports a small stepper
  `stepJump(state, dt) -> state` operating on `{ offset, velocity, airborne }`.
  Per frame the camera does
  `camera.position.y = floorY(z, length) + PLAYER.eyeHeight + jumpState.offset`
  — the offset is **added on top of** the existing hard-set (player-controls.tsx:126,149),
  never replacing it. Landing = offset returns to ≤0 → clamp to 0,
  airborne=false.
- Grounded check = `!airborne` (state-based, not float-equality on camera y).
- x/z movement continues at full (possibly sprint) speed while airborne —
  run-jumps carry farther for free. `clampToRegions` is 2D and untouched.
  Jumping on the stair ramp lands on the ramp's local `floorY` naturally.
- Touch: no sprint/jump (joystick unchanged). Keys are desktop-only by nature.

### Hint line

`museum-gallery.tsx:82-84` desktop text becomes:
`Click to walk · WASD + mouse · Shift to run · Space to jump · Esc to release`.
Touch text unchanged.

## 3. Lean-in info card (painting preview)

- Replace the focused-lab pill (`museum-gallery.tsx:74-79`) with an info card
  component `components/labs/museum/focus-card.tsx` (DOM overlay,
  bottom-center, aria-hidden like the canvas — the list view remains the
  accessible path).
- Content, all from the manifest entry: serif title, mono date, **full
  thesis** (no truncation), status tag (`live` → "on display", `attic` →
  "retired — attic"), and the action line "click to enter".
- Driven by the existing `focused` slug state — no raycast changes, no
  precision aiming, works under pointer lock (a physical click anywhere still
  calls `enterFocused`, museum-gallery.tsx:52).
- Enter/exit animation: slide-up + fade ~180ms (CSS transition, not
  framer-motion — keep three-scene overlays dependency-light).
- Placard glow: `painting.tsx` already swaps frame color when `focused`
  (line 57); additionally brighten the placard material (e.g. emissive or a
  lighter placard texture variant) so the 3D placard and the DOM card read as
  one reveal.

## 4. Red-drape loader + visitor's guide

New components:

- `components/labs/museum/curtain.tsx` — DOM overlay (CSS module
  `curtain.module.css`): two velvet panels (layered CSS gradients for folds),
  gold fringe, covering the full viewport above the canvas. Center hosts the
  **visitor's guide** card: museum-serif heading, the controls list
  (Click to walk · WASD move · Shift run · Space jump · Mouse to look ·
  Esc to release · aim at a painting and click to enter), and a loading line
  with live progress.
- `components/labs/museum/load-signal.tsx` — tiny component rendered *inside*
  the Canvas using drei `useProgress` (tracks `THREE.DefaultLoadingManager`,
  which `useTexture` posters feed). Reports `{ progress, ready }` upward via
  callback/store; `ready` = `active === false && progress >= 100`, debounced
  300ms.

Behavior:

- The curtain is rendered by `labs-view-switch.tsx` as soon as `view === '3d'`
  resolves, **replacing** the current `next/dynamic` loading fallback
  ("Entering the gallery…", labs-view-switch.tsx:9-16) — the drapes cover
  chunk download AND texture loading; there is never a flash of empty room.
- Opening: panels translate outward with a slight sway (~1.2s CSS keyframes),
  then the overlay unmounts. Minimum closed hold 800ms (no flicker on warm
  cache); maximum wait 8s (a broken poster must not trap the visitor —
  posters already fail silently via PaintingBoundary).
- Reduced motion: `prefers-reduced-motion` gets an instant fade instead of the
  sway (only reachable via explicit `?view=3d`, but handle it).
- A small "?" button (top corner, styled with the existing pill language of
  museum-gallery.tsx:87-92) re-opens the guide card as a centered plaque with
  dim backdrop; closes on click or Esc. Pointer lock note: clicking "?"
  requires an unlocked pointer, which is exactly the state after the user
  presses Esc — no conflict. The reopened guide must not re-show curtains.

## 5. Exhibition-catalogue list view

Rebuild `components/labs/labs-list.tsx` as the museum's printed program, in a
scoped CSS module `components/labs/catalogue.module.css` (labs convention;
the current view is generic Tailwind on terracotta tokens).

### Identity

Pull the museum's WebGL identity into DOM (values from
`components/labs/museum/textures.ts` / `hall.tsx`):

- Page: deep wine `#5a2028`-family background (darkened for readability),
  cream text `#efe8da`, gilded hairlines `#b08d3f`.
- Type: system serif stack (Georgia first — matches the baked placards, zero
  bytes) for display + placard text; existing mono for dates/labels.
- Each lab: poster in a slim gold frame (border + subtle inner bevel), brass
  placard caption block below (gold gradient background, dark engraved text —
  the DOM translation of `makePlacardTexture`, textures.ts:61-106): serif
  title, italic date, thesis.
- Attic section: aged-paper `#d8cdb4` panel with dark ink `#3a2d16`
  (translating `makeAtticPlaqueTexture`), dust-sheet grey accents,
  retrospective text in the plaque.
- Responsive: single column on mobile, 2-column grid ≥768px. Poster images
  get explicit width/height (768×1024 intrinsic) and `loading="lazy"` as today.
- "Enter the 3D gallery" button (labs-view-switch.tsx:52-61) restyled as a
  gilded button consistent with the catalogue; logic unchanged.

### Crawlable masthead (the SEO block at `/`)

Top of `LabsList`, server-rendered (it's the Suspense fallback so it ships in
initial HTML):

- `<h1>` Aram Yeghiazaryan, role line "Senior Frontend Engineer" (never
  "lead"), 1–2 sentence intro naming the museum conceit, and links: Classic
  Claude (`/classic-claude`), GitHub, LinkedIn — pulled from
  `lib/constants.ts` siteConfig/socialLinks, not hardcoded.
- This replaces the removed "Back to the main site" link.

### Test hooks preserved (locked by existing tests)

- A link per manifest entry named by its title
  (`getByRole('link', { name: RegExp(lab.title) })`), href
  `lab.href ?? /labs/${slug}`.
- Poster `<img>` per lab, alt `"${lab.title} poster"`, src containing
  `/labs/${slug}/poster.jpg`.
- Heading exactly "failed experiments"; snowpark retrospective text visible.
- New assertions replace the "main site link" test: masthead renders name,
  role, and a `/classic-claude` link.

## 6. Testing

Unit (Vitest, jsdom):

- `movement.ts`: sprint speed selection; jump stepper (takeoff, apex, landing
  clamp, no-double-jump while airborne, grounded reset).
- Manifest: Classic Claude title/href/status.
- Rebuilt `labs-list`: preserved hooks + masthead assertions.
- Curtain: renders guide + progress; opens (state class) on ready; max-wait
  fallback fires (fake timers); "?" reopens guide without curtains.
- Focus card: renders title/date/thesis/status from a manifest entry; hidden
  when nothing focused.

E2E (Playwright, respecting existing WebGL/mobile skip guards and `E2E_PORT`):

- Retarget existing specs (§1).
- New smoke: `/` on desktop mounts `<canvas>`, curtain overlay departs
  (waits for its removal), hint line visible.
- `/classic-claude` serves the portfolio (hero visible — with the new
  `id="hero"`).

## Global constraints

- Aram is "Senior Frontend Engineer" — never "lead" (binding for masthead and
  any copy).
- Content only from `data/`, `lib/constants.ts`, `lib/labs-manifest.ts`.
- Commits: `<type>: <description>`, no attribution lines.
- No console.log; no new global CSS outside root layout (CSS modules for the
  curtain and catalogue).
- No mutation patterns (house rule); movement refs inside r3f frame loops are
  the established exception (existing player-controls pattern).
- Museum stays `aria-hidden` decorative; the list view remains the accessible
  path.
- Look-dev gate before structural work: curtain + catalogue visuals get a
  visual review (screenshots/dev server) before the routing tasks proceed,
  per the established design bar.

## Execution

Worktree `museum-main` (branch `worktree-museum-main`), subagent-driven
development with per-task review (the XP/curator process), fable-level final
whole-branch review, single PR. Note: three other worktrees are in flight
(labs-ps1-rework, labs-storybook, labs-curator) — none touch the museum, the
hub routes, or the list view; merge-order conflicts are limited to
`lib/labs-manifest.ts` (additive entries) and are acceptable.
