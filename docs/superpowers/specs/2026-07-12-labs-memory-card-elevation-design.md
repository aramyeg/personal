# Memory Card Lab — Elevation v2: Split-Hero Character Select

Date: 2026-07-12. Supersedes the **composition and character sections** of
`2026-07-10-labs-memory-card-save-select-design.md`. Panels, routes, boot/audio
architecture, a11y contracts, and all standing laws carry over unless amended here.

## Verdict driving this spec (owner, verbatim essentials)

- "the characters do not look good... the clothes are too simple shapes and they are too
  bulgy, on ps1 ps2 those were most often reskins... with clever drawing the jeans...
  fit better, the hair as well has the same problem, also the facial features need to
  be worked on."
- "the website still reads as very cheap, this should be an awwwards level designer
  website... maybe some items need to gain dimension, some need to lose them."
- Composition direction (verbatim): "accent on the character, it being almost half the
  screen and slowly spinning, the memory slot select should be in the other half, with
  some small text maybe, or other visuals."

Research grounding (session artifacts, not committed): `.superpowers/sdd/redesign/`
r1 (awwwards craft rules), r2 (PS-era character playbook), r3 (reference teardowns),
r4 (screenshot audit + 22 shots). The binding rules below are distilled from them;
implementer briefs may cite the reports directly.

## 1. Composition v2 — split-hero

Desktop (≥1024px): two halves.

- **Left ≈ 50vw — the hero.** The character, large (figure fills most of the half's
  height), slowly spinning on a turntable (one full revolution ≈ 24–32s, imperceptible
  easing, reduced-motion = static 3/4 pose). It stands on a visible ground: contact
  gradient + fog so the space reads *lit*, not void. The active save's accent tints the
  atmosphere (backdrop ramp / fog / rim treatment — this is where the per-save accent
  finally becomes visible). This is the ONLY live WebGL scene on the select screen.
- **Right ≈ 50vw — the slot select.** Six slots as the index (roving-tabindex listbox
  contract preserved). Each slot row is drawn as a **flat 2D memory-card label** —
  spec-sheet editorial style: slot number, title, kind, year, block meter — reusing the
  existing canvas label art system (`lib/label-texture.ts` drawing primitives) or a pure
  DOM/CSS re-expression of it. Active slot expands to reveal the "small text": role
  line, one-line story, stack chips, tabular stats. No second 3D scene.
- The 3D card fan (`three/card-arc.tsx`) and its scene **die**. The six baked shell
  textures may be reused as 2D art if useful; otherwise retire them.
- Display title of the active save remains a big type moment (see §3 scale) anchored to
  the select half or bridging the seam — final placement decided at look-dev.
- Mobile (<1024px): hero on top (~55vh), slot select below; footer must not overlap the
  last rows (current bug — fix).

Look-dev gate: a static composition mock (screenshot, real page or HTML mock) passes
orchestrator zoom review BEFORE structural build; the first repainted character fit
passes the same gate BEFORE batch repaint. User gates on Vercel preview only.

## 2. Character craft v2 — era-authentic (paint-first)

The bulge is structural: a garment shell must be wider than the body, so shell width IS
the bulge. Era law replaces the shell-first approach:

- **Paint, don't model:** tees, jeans, shorts, socks, belts, prints are painted onto the
  body mesh's own UVs. Bake AO + folds + seams into ONE ≤256px body atlas per fit
  ("lighting lives in the texture"). Delete the corresponding shells.
- **Geometry only for silhouette:** open/tied flannel, caps, shoes, skateboard, blades,
  chain, glasses, hair buns — slimmed to ~1–1.5cm standoff, seams at real anatomy lines.
- **Face:** dedicated face texture region (128–256px): pixel eyes (sclera + iris + 1px
  pupil + lash line), asymmetric painted brows, nose/mouth shading. No more mannequin.
- **Hair:** buzz = painted scalp with ragged hairline (no mesh); long/parted = thin
  skull-hugging shell, straight root-to-tip UVs, painted strands, 1-bit alpha edges;
  never a bulb.
- **Renderer:** NearestFilter, `generateMipmaps: false`, textures ≤256px, unlit
  (MeshBasicMaterial) or vertex-lit Lambert; no normal/PBR maps. Accent "lighting" is
  atmosphere (backdrop/fog/ground/rim), not material lights.
- All six fit identities survive: 01 Y2K, 02 grunge, 03 skate, 04 engineer,
  05 rollerblade, 06 flannel. Garment deformation verified IN MOTION, not stills.
- Base body stays the Quaternius CC0 base (65-bone skeleton, one `fit-idle` clip per
  fit). Repainting its UVs is in scope; replacing the body is not.

## 3. Surface system v2

- **Ink ramp:** replace single near-black with a 4–5 step cool-cast ramp (≈ #08090C →
  #262A33, +4–6% lightness per step, hue ≈ 250) in `tokens.ts`; paper stays warm
  off-white. Depth via lightness layers, not shadows.
- **Grain:** one full-page SVG grain layer (feTurbulence baseFrequency ≈ 0.85,
  numOctaves 2, opacity 3–6%, blend overlay) — kills banding and the flat-black tell.
- **Typography:** dual scale — display ratio ≈1.5, text ratio ≈1.25; hero display up to
  `clamp(3.5rem, 13vw, 12rem)`, line-height ≈0.88, tracking ≈ −0.03em; ≥6× hero-to-body
  delta; introduce a real mid-hierarchy (the audit's "sea of identical tiny mono" dies).
  `font-variant-numeric: tabular-nums` on every stat/year/meter numeral.
- **Casing law:** REMOVE the CSS uppercase transform from save titles — it mangles
  product names ("iBank" → "IBANK"). Titles render in their true casing; mono labels
  may stay lowercase per lab voice.
- **Accent discipline:** triangle-teal is the single system accent (focus, hovers,
  meters). The other PS glyph colors appear only on objects they own (glyph row, panel
  identities). Per-save accent owns the hero atmosphere + active slot row.
- **Hairlines:** paper at 0.10–0.12 alpha, one weight.
- **Motion tokens:** `--ease-entrance: cubic-bezier(0.19,1,0.22,1)`,
  `--ease-move: cubic-bezier(0.86,0,0.07,1)`; entrances scale 0.98→1 + ≤16px rise,
  ~50ms stagger; exits ~20% faster. Save-select is the signature transition: slot
  expand + hero atmosphere crossfade + title swap on one shared ~280ms timing.
  Reduced-motion: opacity-only.
- **Seam law:** the WebGL canvas clear color matches the exact ink token behind it.

## 4. Fix list (bugs promoted to law)

1. Boot beat is effectively invisible (~250ms flash in dev). Diagnose (StrictMode/dev
   artifact vs real), then make the beat a real brand moment: full 3s, big glyph
   choreography, PS1 boot audio gesture-gated as-is. Verify in production build.
2. Mobile footer overlaps last slot rows — layout fix (§1 mobile stack).
3. Uppercase/iBank mangling (§3 casing law).
4. Stat numerals jitter — tabular-nums (§3).

## 5. Preserved (do not regress)

Paper-on-ink dialog panels (audit: near award-grade) · parallel/intercepting routes ·
boot sessionStorage + Esc ownership patterns · roving-tabindex listbox semantics ·
sounds-from-gestures + PS1 boot mp3 · attribution lines (crt/meipal CC BY 4.0,
quaternius CC0) · character-agnostic code/copy/tests · no `/lead/i` claims ·
mulberry32-only randomness · 44px touch targets · tokens-only styling · 5-browser e2e
contract (`--workers=1` locally).

## 6. Acceptance

- Look-dev still (composition) and fit-1 repaint each pass orchestrator zoom-crop
  review before their lanes scale out.
- All six fits repainted, verified in motion; select screen rebuilt split-hero; one
  WebGL scene on select; fix list closed.
- Suites green: unit, e2e (updated journeys), tsc, lint, `pnpm build`.
- Poster regenerated. PR #10 updated by forward commits only; user verdict on Vercel
  preview gates merge.
