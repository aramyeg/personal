# Labs Museum Gallery — Design Spec

**Date:** 2026-07-08
**Status:** Approved for planning
**Depends on:** Style Lab structure (`lib/labs-manifest.ts`, `app/labs/`), shipped 2026-07-08

## Summary

Replace the flat `/labs` gallery page with a first-person 3D museum: a single
grand hall inspired by classical galleries (Hermitage, Louvre) where each Style
Lab hangs as a painted poster in a gilded frame. Visitors walk the hall
(WASD + mouse look), approach a painting, and click it to enter that lab.
A simplified list view remains for people who just want links, and is the
default on touch devices. Every lab gains a consistent way back: an on-screen
"Back to gallery" button and the `Esc` key.

## Decisions (settled during brainstorming)

| Question | Decision |
|---|---|
| Hub format | Navigable 3D library where artworks are portals to labs |
| Perspective | First-person walk (pointer lock on desktop) |
| Interior | Classical palace museum — Hermitage/Louvre picture gallery |
| Artworks | Static painted poster per lab in a gilded frame with brass placard |
| Mobile default | List view; 3D gallery is opt-in ("Enter the gallery") |
| Technology | react-three-fiber + drei (option A); Blender-authored assets are a possible future migration, not now |
| Scale | One grand hall now; smaller connected halls are a possible later expansion |

## The space

A single long rectangular hall (enfilade-style):

- High coved ceiling with a central skylight band; crown moldings.
- Herringbone parquet floor (CC0 PBR texture, e.g. Poly Haven).
- Deep wine-red fabric-paneled walls with marble baseboards — the classic
  Old Master hanging color that makes gilded frames pop.
- Dressing: a couple of benches and rope stanchions down the center line.
- Lighting: warm ambient from the skylight plus an individual picture light
  over each frame. No real-time shadows beyond one cheap map if it stays
  within budget; the look comes from textures and warm light pools.
- Paintings hang at eye height along both long walls, evenly spaced.
  Positions are **generated from `labs` in `lib/labs-manifest.ts`** — adding
  a manifest entry automatically hangs the next frame.
- At the far end, one cloth-draped frame under a spotlight ("opening soon").
  The drape is part of the museum dressing, not a manifest entry.

## Navigation and interaction

Desktop:
- Click the canvas to enter pointer lock; WASD to walk, mouse to look.
- Camera is a simple bounded first-person rig: fixed eye height, walk speed
  capped, position clamped to the room's inner AABB. No physics engine.
- Raycast from screen center: when a painting is in range and centered, its
  frame highlights and a placard hint appears ("Click to enter").
- Click while a painting is focused → `router.push('/labs/<slug>')`.
- `Esc` releases pointer lock (browser behavior); an always-visible corner
  control switches to the list view.

Mobile (opt-in from the list view):
- Left-thumb virtual joystick to walk, drag anywhere else to look.
- Tap a painting (raycast from tap point) to enter it.

## Routes and view switching

- `/labs` renders the **list view** shell immediately (server component,
  fast paint). A client component decides the default experience:
  - Pointer-fine + wide viewport → auto-enter the 3D gallery, with a
    "Prefer the list?" link.
  - Touch/coarse pointer → stay on the list, show an "Enter the gallery"
    button that lazily loads the 3D bundle.
- `?view=list` forces the list (deep-linkable; also the reduced-motion and
  no-WebGL fallback). `?view=3d` forces the gallery where supported.
- The entire three.js/R3F bundle is `next/dynamic`-imported with
  `ssr: false`; the list view never pays for it.

## Return path (every lab)

New shared component `components/labs/gallery-chrome.tsx`:
- Fixed "← Back to gallery" button (top-left), styled neutrally so it sits
  acceptably on any lab's visual world (small, translucent, monochrome).
- Global `Esc` keydown → `router.push('/labs')`.
- Each lab page wraps its content in `GalleryChrome`. Added to the lab
  checklist in the manifest header comment.

## Assets and conventions

- Each lab ships a portrait poster at `public/labs/<slug>/poster.jpg`
  (~3:4, ≤ 200 KB, art-directed in the lab's own aesthetic). One asset,
  two uses: painting texture in 3D and thumbnail in the list view.
- PS1 lab poster: a dithered CRT still-life in the lab's blue/green/white
  palette.
- Museum materials: small set of CC0 PBR textures (parquet, marble, wall
  fabric, gilt trim) stored under `public/labs/_museum/`, compressed
  (1k resolution, JPEG/basis) to keep total payload modest.

## Component structure

```
app/labs/page.tsx                     — server shell: heading + list view + client switch
components/labs/labs-list.tsx         — simplified list (extracted from current page)
components/labs/gallery-chrome.tsx    — back button + Esc handler (used by every lab)
components/labs/museum/
  museum-gallery.tsx                  — dynamic-import boundary, Canvas, view switch UI
  hall.tsx                            — room geometry + materials + dressing
  painting.tsx                        — frame + poster + placard + focus highlight
  draped-frame.tsx                    — the "opening soon" piece
  player-controls.tsx                 — pointer-lock rig, bounds clamp, mobile joystick
  use-painting-focus.ts               — raycast focus state
  layout.ts                           — pure function: manifest → wall positions
```

`layout.ts` is a pure function (`labs[] → PaintingPlacement[]`) so it is
unit-testable without WebGL.

## Performance and accessibility

- Target ≤ 1.5 MB total transfer for the 3D experience (three.js + textures).
- 60 fps target on integrated GPUs: no postprocessing beyond vignette,
  few lights, no per-frame allocations.
- `prefers-reduced-motion` → list view default everywhere.
- No WebGL / WebGL context loss → graceful fallback to list with a notice.
- List view is fully keyboard-navigable and screen-reader friendly; the 3D
  canvas gets `aria-hidden` with the list as the accessible alternative.

## Testing

- Unit: `layout.ts` placement math; `gallery-chrome` Esc handling and
  navigation (jsdom); list view rendering from manifest.
- E2E (Playwright): `/labs?view=list` shows all labs and links work;
  `/labs` on desktop viewport mounts the canvas; Esc from a lab page
  returns to `/labs`.
- Visual check in browser for the hall itself (no automated pixel tests).

## Out of scope (future directions, user-flagged)

- **Blender MCP pipeline:** authoring the hall and props in Blender and
  syncing via MCP, replacing procedural geometry with curated GLBs.
- **Additional smaller halls/wings** connected to the grand hall as the
  lab count grows (door at the far end already implied by the draped frame).
- Statues/mixed media for experimental labs.
- Live animated canvases inside frames.
