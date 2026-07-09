# Bliss — Windows XP Lab Design Spec

**Date:** 2026-07-09
**Status:** Approved direction (full XP desktop lab; boot + Clippy + screensaver/error chaos; no Minesweeper)
**Route:** `/labs/xp` · Hangs as painting #4 in the `/labs` museum hall
**Branch:** `feat/labs-xp` (worktree at `.claude/worktrees/labs-xp`, isolated from the concurrent PS1 rework worktree)

## Why

Style Lab #3: the portfolio re-skinned as a Windows XP desktop. XP is the most
universally nostalgic software artifact on the web — Luna chrome, the boot
chime, Bliss, Clippy — and it is genuinely a *design system*: bitmaps,
gradients, and Tahoma, all achievable in hand-rolled CSS. The experiment is to
rebuild that system faithfully and let the real portfolio content live inside
its apps.

User decision (2026-07-09): this is a personal site — real Microsoft assets
(Bliss wallpaper, XP system sounds) are approved for use. No procedural
stand-ins required.

## Manifest entry (`lib/labs-manifest.ts`)

```ts
{
  slug: 'xp',
  title: 'Bliss',
  date: '2026-07-09',
  thesis:
    'The portfolio as a Windows XP desktop — Luna chrome, the real boot ' +
    'chime, a helpful paperclip. The most beloved OS ever shipped, rebuilt ' +
    'as a design system.',
  status: 'live',
}
```

Hangs automatically in the museum hall (4th painting — under the ~8-lab
point-light ceiling; no lighting work needed).

## Architecture

**Hand-built DOM/CSS desktop** (approach A, approved over canvas rendering and
the community `XP.css` library — the latter stays a visual reference only).

- `app/labs/xp/page.tsx` — server component: per-lab OG metadata for LinkedIn
  unfurls; server-renders the full portfolio content as semantic HTML (the
  crawler/a11y/no-JS path, same pattern as snowpark's skill list); dynamically
  imports the client desktop which visually replaces it.
- `components/labs/xp/` — all lab components, self-contained.
- Luna chrome as scoped CSS custom properties (the lab owns its full-viewport
  token scope, per series rules): title-bar blue gradients, green Start
  button, gray 3D bevels. Type: Tahoma for UI text, Trebuchet MS bold for
  title bars.
- **Window manager**: Zustand + Immer store (project pattern) — windows array
  `{ id, app, position, size, zIndex, minimized, maximized }`, focus/z-order,
  drag (pointer events), minimize-to-taskbar, maximize. Small files, one
  component per app window.
- Content comes exclusively from shared sources: `data/` exports
  (`projects`, `experiences`, `skills`/`skillCategories`), `lib/constants.ts`
  (`siteConfig`, `socialLinks`) for contact, and `atticLabs` from the
  manifest for the Recycle Bin.

## Boot flow

Once per session (`sessionStorage` flag), skippable with any key/click;
`prefers-reduced-motion` skips straight to the desktop.

1. **Boot screen** (~2.5 s): black, centered XP logo, the crawling blue
   loading-bar segments.
2. **Welcome screen**: Luna blue login, single account **Aram** with the
   site's existing pixel avatar. Clicking the account plays the real XP
   startup chime — this click is also the browser autoplay unlock — and fades
   into the desktop.

## Desktop

- **Wallpaper:** the real Bliss (`public/labs/xp/bliss.jpg`).
- **Icons** (single-click selects with the classic highlight, double-click /
  Enter opens; touch: single tap opens): My Computer, My Projects,
  `resume.doc`, `about-me.txt`, Messenger, Internet Explorer, Recycle Bin,
  `free_ringtones.exe`.
- **Taskbar:** green Start button, task buttons for open windows (click
  focuses / minimizes), tray with live clock, working mute toggle, occasional
  balloon tips.
- **Start menu:** full two-column Luna layout — pixel-avatar banner, apps in
  the left column, content shortcuts right, **Turn Off Computer → shutdown
  dialog → exits to `/labs`** (alongside GalleryChrome's back button and
  Esc).

## Content mapping

| XP surface | Content | Notes |
|---|---|---|
| **My Computer** (Explorer window) | hub | Local Disk (C:) flavor + shortcuts to My Projects, `resume.doc`, `about-me.txt`, and Control Panel → Add or Remove Programs |
| **My Projects** (Explorer window) | `data/projects.ts` | Toolbar + address bar + Common Tasks pane; projects as folders; select → details in the tasks pane; open → project window with full details and links |
| **resume.doc** (WordPad window) | `data/experience.ts` | White page, document typography; experience timeline. Aram is **Senior Frontend Engineer** at xdatagroup — never "lead" (standing rule) |
| **Add or Remove Programs** (Control Panel) | `data/skills.ts` | Skills as installed programs grouped by `skillCategories`; "size on disk" derived from `years` + `level` — the hero gag. Change/Remove buttons present but inert |
| **Messenger** (MSN-style window) | `lib/constants.ts` | `siteConfig.email` + `socialLinks` as real links, availability status from `siteConfig.available`, Nudge button that shakes the window with the real nudge sound |
| **Internet Explorer** | iframe of `/` | IE6 chrome, "aram.dev" in the address bar — the Terracotta main site, recursive |
| **about-me.txt** (Notepad) | bio/about | Plain monospace text file |
| **Recycle Bin** | `atticLabs` from the manifest | Retired labs as deleted items with their `retrospective` strings; "Restore" navigates to the retired lab route |

## Clippy

Hand-drawn SVG paperclip (googly eyes, framer-motion animation — not the
Office sprite sheets; drawing it is part of the design exercise). Appears
~10 s after login: *"It looks like you're trying to hire a frontend engineer.
Would you like help?"* — buttons open the relevant windows. Rare contextual
tips afterwards (low frequency, genuinely useful or cheeky). Permanently
dismissible for the session.

## Screensaver + error chaos

- **Screensaver:** ~60 s idle → 3D Pipes (react-three-fiber, already a
  dependency; random-walk pipes on a grid, sphere joints). Any input
  dismisses. Suppressed under `prefers-reduced-motion`.
- **Error cascade easter egg:** running `free_ringtones.exe` spawns error
  dialogs that multiply as you close them (escalating absurd messages),
  ending in a full-screen BSOD; any key "reboots" — quick boot bar, desktop
  restored intact (window state preserved).
- **Balloon tips:** occasional tray balloons with the real balloon sound.

## Sounds

Real XP sounds in `public/labs/xp/sounds/`: startup, error/critical stop,
balloon, nudge, recycle, navigation click, shutdown. Unlocked by the login
click; tray mute toggle silences everything and persists for the session.

## Esc discipline (snowpark lesson — binding)

The lab consumes Esc for its own layers (screensaver dismiss, Start menu
close, dialog close, BSOD reboot) via a `window` keydown listener registered
with `capture: true`, calling `preventDefault()` only when a layer consumed
it. GalleryChrome's bubble listener has the matching `if (e.defaultPrevented)
return` guard, so an unconsumed Esc still exits to the museum. Ordering tests
dispatch on `document.body`, never `window`.

## Mobile / touch

Boot + login play as designed. After login, windows open **maximized** with
the taskbar as the switcher — no drag, no resize, no overlap. Desktop-only
affordances (drag, screensaver idle timer) degrade silently. The museum's
list view (`/labs?view=list`) remains the touch entry path and thumbnails the
lab normally.

## Deliverables checklist (series rules)

- [ ] Manifest entry (above)
- [ ] `public/labs/xp/poster.jpg` — portrait ~3:4, ≤200 KB; generator
      committed to `scripts/posters/` (Bliss + a Luna window + XP logo)
- [ ] Lab page wrapped in `<GalleryChrome>`
- [ ] Per-lab OG metadata for LinkedIn unfurls
- [ ] Server-rendered crawlable content path
- [ ] Real content from `data/` only

## Testing

- **Unit:** window-manager store (open/focus/z-order/minimize/maximize/
  close), boot state machine (phases, skip, session flag, reduced-motion),
  idle timer, error-cascade state, Esc capture ordering (dispatch on
  `document.body`).
- **E2E:** boot → login → desktop; open a project window from the desktop
  icon; Turn Off Computer exits to `/labs`; Esc with Start menu open closes
  the menu without leaving the lab. URL assertions wait for settle (dev-server
  compile delay lesson).
- Known pre-existing failure on main: `navigation.spec.ts` hero test — not
  ours, do not chase it here.

## Out of scope

- Minesweeper (explicitly cut by user — no playable games in this lab)
- Pixel-perfect bitmap-font rendering (Tahoma antialiased is accepted)
- Multi-user accounts, working file system, IE browsing beyond the iframe
- Museum architecture changes (this lab is a painting in the existing hall)
