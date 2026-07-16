# Manga/Comic Panel Visual Grammar for Web Overlays

Research for a web overlay system that renders art as panels (borders, halftones, speed lines, speech
bubbles) with framer-motion entrance choreography, while keeping data/HTML content accessible.

## TL;DR Build Recipe

**Panel shell (CSS):**
- Border: 2 layers — a thick outer ink border (`border: 3px solid #111` or an SVG hand-drawn border for
  organic edges) + inner gutter as real margin/gap (not border) so panels can bleed independently.
- Gutter width: 4–8px small gaps, 12–20px "big" gaps between tiers — mirrors print convention (small
  gutter ≈ 1–2mm, big gutter ≈ 3× that, scaled up for web viewing distance).
- Tilt: `transform: rotate(-2deg to 4deg)` on ~1 in 4–6 panels max, reserved for action/impact beats —
  never on dialogue-heavy or data panels.
- Bleed: some panels should intentionally break the grid (`position: absolute` / negative margins over
  the gutter, or full-viewport-width) to read as "big moment" panels — this is the manga convention, not
  a Western-comics one, and is the easiest lever for visual hierarchy.

**Halftone (CSS-only, no images):**
```css
.halftone {
  background:
    radial-gradient(closest-side, #777, #fff) 0 / 1em 1em space,
    linear-gradient(90deg, #888, #fff); /* swap 2nd layer for any lightness map */
  background-blend-mode: multiply;
  filter: contrast(16);
}
```
This is the entire technique: gradient #1 is the dot lattice, gradient #2 (or a mask-image) is the
"lightness map" that makes dots grow/shrink, `multiply` merges them, and extreme `contrast()` clips the
soft blend into crisp dots. Swap the second layer for a `radial-gradient`/`conic-gradient` to fake light
falloff on a panel, or drive it from a per-panel CSS custom property for parallax/mouse-follow shading.

**Speed lines / action bursts (SVG, filter-driven, not per-frame JS unless needed):**
```xml
<filter id="speedlines">
  <feTurbulence type="turbulence" baseFrequency="0.01 0.3" numOctaves="1" seed="2" result="noise"/>
  <feDisplacementMap in="SourceGraphic" in2="noise" scale="40" xChannelSelector="R" yChannelSelector="G"/>
</filter>
```
Use an *asymmetric* `baseFrequency` (very low on one axis, high on the other) to get directional streaks
radiating from a focal point rather than isotropic noise — that's the difference between "speed lines"
and generic turbulence. Layer 3–5 conic-gradient hard-edge wedges (`conic-gradient(from 0deg, #000 0deg
2deg, transparent 2deg 8deg, ...)` repeated) behind/around a focal subject for the classic radial
action-burst without any SVG at all — cheaper and crisper at all DPRs since it has no noise sampling.

**Entrance motion grammar (framer-motion):**
1. Panels stagger in reading order (LTR/top-down for Western; mirror for manga N-pattern) via
   `staggerChildren` on the grid parent, 60–120ms per panel — matches how the eye actually saunters
   across a page.
2. Each panel enters via `clip-path` wipe (inset or a diagonal/asymmetric wedge, not a plain fade) —
   this reads as the "panel being drawn/uncovered" rather than a UI card fading in.
3. Add a small `overshoot` on scale/rotate (spring with `damping: ~12, stiffness: ~300`) so impactful
   panels "land" with a snap rather than ease-out smoothly — mirrors comic timing (anticipation → hit →
   settle) more than standard UI easing.
4. Gate all of the above behind `prefers-reduced-motion`: reduced-motion users get an instant `opacity`
   crossfade with no clip-path wipe, no overshoot, no turbulence animation.

**Accessibility split:** art panels are `<img>`/background images with real `alt` text describing the
story beat; caption/dialogue/data panels are typeset HTML (real `<p>`/`<blockquote>` inside the panel,
not baked into the image) so they're selectable, translatable, and screen-reader friendly. Decorative
halftone/speed-line layers are `aria-hidden="true"` and pure CSS/SVG background, never meaningful content.

---

## 1. Panel border / gutter conventions

- **Gutters**: small gutters run ~1–2mm (≈0.04–0.08in) in print; "big" gutters run roughly 3× that. On
  web this scales to roughly 4–8px small / 12–24px large at typical panel sizes — enough to read as
  deliberate rhythm, not accidental spacing.
- **Western vs. manga**: Western comics keep gutters fairly uniform on all sides; manga varies gutter
  width panel-to-panel as a storytelling tool (tight gutters = fast time passing, wide/black gutters =
  a beat or scene break).
- **Border style as meaning**: changing a panel's border style (thin/thick/none/jagged/dashed) signals a
  shift in state — flashback, dream, another world. This is a cheap, reusable CSS lever: keep border
  style/weight as a per-panel token (`--panel-border: dream | normal | impact | none`).
- **Tilted panels**: canted/rotated panels are the shounen-battle-manga signature for action, movement,
  and unease — used sparingly, on high-intensity beats, never as a default panel state.
- **Borderless panels**: suggest emotional/spatial expansion — good for quiet, contemplative content.
- **Bleed**: panels running to the page edge with no border are common and expected in manga (much more
  so than in Western comics); it makes art feel larger and amplifies dynamism. On web, "bleed" = a panel
  that breaks out of the grid container (full-bleed width, or overlapping the gutter of neighbors).
- **Inset panels**: a small panel overlapping a larger one highlights a specific detail — maps directly
  to a `position: absolute` panel nested inside a larger panel's bounding box.

## 2. Halftone dots in pure CSS

Two proven approaches, both radial-gradient based, no images or canvas:

**A. Blend + contrast (recommended default)** — from Frontend Masters / master.dev:
```css
.halftone {
  background:
    radial-gradient(closest-side, #777, #fff) 0 / 1em 1em space,
    linear-gradient(90deg, #888, #fff);
  background-blend-mode: multiply;
  filter: contrast(16);
}
```
- Gradient 1 = dot lattice (soft-edged circle so contrast has something to clip).
- Gradient 2 = the "value map" — replace with any gradient/mask to steer where dots grow (dark) vs.
  shrink (light). This is what makes it a *halftone* rather than a static dot grid: dot size communicates
  shading.
- `background-blend-mode: multiply` merges the two; `filter: contrast(16)` (bump to ~40–80 for bigger
  dots) pushes mid-grays to pure black/white, producing crisp dot edges instead of a blurry lattice.
- Single element, no pseudo-elements needed — cheapest version.

**B. Mask + contrast variant (css-irl.info / leanrada.com)** — for coloring or animating the dot layer
independently of a base image:
```css
.halftone {
  position: relative;
  filter: brightness(0.8) blur(3px) contrast(999);
}
.halftone::after {
  content: "";
  position: absolute; inset: 0;
  background-image: radial-gradient(10px at center, black, white);
  background-size: 20px 20px;
  mix-blend-mode: screen;
}
```
- Use a `mask-image` (linear/radial/conic gradient) on the `::after` to vary dot density across the panel
  (e.g., dense near a shadow edge, sparse toward the light side) — this is the "angled/graduated halftone"
  effect seen in manga screentones.
- A CMYK variant layers 4 offset radial gradients (K/C/M/Y) with `background-blend-mode: multiply` and an
  outer `mix-blend-mode: screen` to fake print-style color halftone — more expensive, use sparingly.

**Performance / DPR notes**: none of the sources found hard DPR benchmarks, but the mechanism is cheap
(gradients + one blend + one filter, no JS, no canvas) so it should be fine at any DPR — the risk is
**moiré**, not raw performance. Moiré arises from overlaying two periodic patterns at close angles/
frequencies (a halftone texture over a striped/checkered background, or two halftone layers at similar
angles). Mitigations: offset repeated halftone layers ~15–45° from each other (classic 4-color-print
angle separation is 15°/75°/0°/45° for the 4 plates); avoid stacking a halftone panel directly on another
regular grid pattern; if a moiré artifact appears at a specific zoom/DPR, nudge `background-size` by a
few percent rather than trying to "fix" the angle live. Screen resolution / print lpi math (35 lpi max
for typical low-DPI print) implies web halftone dot pitch should stay coarse (≥8–12px at 1x) — fine
lattices sub-8px are where moiré and rendering artifacts show up on non-integer DPR scaling.

## 3. Speed lines / action bursts

Two techniques, pick based on whether you need "hand-jittered" organic lines or clean graphic bursts:

**A. SVG feTurbulence + feDisplacementMap (organic/sketchy)**
```xml
<filter id="distortionFilter">
  <feTurbulence type="turbulence" baseFrequency="0.03" numOctaves="2" seed="1" result="noise"/>
  <feDisplacementMap in="SourceGraphic" in2="noise" scale="20"
    xChannelSelector="R" yChannelSelector="G"/>
</filter>
```
- `feTurbulence` generates Perlin/turbulence noise; `feDisplacementMap` uses that noise to offset pixels
  of whatever it's applied to (a line, a burst shape, an image).
- For directional **speed lines** rather than isotropic wobble, use a two-value `baseFrequency="fx fy"`
  with a large gap between the two (e.g. `0.01 0.4`) — low frequency on the axis along the lines (keeps
  them straight/long), high frequency across (adds jitter/roughness perpendicular to travel direction).
- Animate via JS by mutating `baseFrequency`/`seed` every 100–200ms (or an SVG `<animate>` on the
  attribute) for a "boiling ink" quality — sources warn this is easy to overdo ("a little goes a long
  way").
- This is the same primitive used for hand-drawn/wobbly-line effects generally, so it doubles as your
  "sketchy ink border" technique if you want organic (non-vector-perfect) panel borders too.

**B. Conic-gradient radial burst (clean, cheap, no noise sampling)** — not found verbatim in sources but
directly derivable from the halftone/gradient techniques above:
```css
.action-burst {
  background: repeating-conic-gradient(
    from 0deg,
    #111 0deg 1.5deg,
    transparent 1.5deg 9deg
  );
  mask-image: radial-gradient(circle at center, transparent 20%, black 45%, transparent 70%);
}
```
- `repeating-conic-gradient` gives evenly spaced radial wedges (the classic manga "focus lines" burst)
  with zero noise sampling — cheaper than the SVG filter route and immune to moiré since it's not a
  periodic 2D lattice.
- The `mask-image` radial gradient carves out a clear center (so the focal subject/text isn't obscured)
  and fades the lines out before the panel edge.
- Prefer this for anything that needs to scale/animate smoothly across DPRs or needs many simultaneous
  instances (perf-sensitive lists of panels) — reserve the SVG turbulence route for one-off hero moments.

## 4. Speech bubble & caption typography

- **Orientation/reading order**: manga is vertical-text, right-to-left (N-pattern); Western comics and
  webtoons are horizontal, left-to-right (Z-pattern). For a web overlay mixing both aesthetics, pick one
  reading direction per "world" (e.g., manga-styled art panels can still hold LTR horizontal Latin text —
  don't force vertical CJK-style text unless the content is literally Japanese).
- **Bubble weight signals genre**: thin, minimal-stroke bubbles read as manga/webtoon; bold, thick-outlined
  bubbles read as Western/superhero. Pick stroke weight deliberately per section, don't mix within one
  panel type.
- **Caps and alignment**: ALL CAPS + center-aligned text is the Western comic-lettering convention
  (maximizes legibility at small balloon sizes); manga localization typically uses mixed case. For a data/
  caption panel meant to be *read* rather than *decorative*, prefer normal sentence case with left
  alignment — comic-style all-caps center-alignment is legible in short bursts (a speech bubble) but
  fatigues on longer paragraphs (a caption/data panel).
- **Fonts**: comic-lettering fonts (Anime Ace, Wild Words, Blambot's library) are hand-lettering
  simulations tuned for small-balloon legibility, not general-purpose display faces — good for short
  bubble text and onomatopoeia, bad for body copy/data. Use a real UI/reading font for any panel content
  that's meant to be data (numbers, labels, longer prose) and reserve the comic-lettering font for
  in-world dialogue/SFX only.
- **SFX**: manga sound effects are typically drawn as part of the artwork (large stylized type integrated
  into the panel image) rather than typeset HTML — if you need SFX-style text, treat it as decorative art
  (image or `aria-hidden` styled text), not as content.

## 5. Panel entrance animations — real-world grounding

Directly comparable "manga-panel-grammar as a web animation system" examples are thin on the ground; the
strongest concrete case found is:

- **Ponpon Mania** (Awwwards feature) — https://www.awwwards.com/ponpon-mania-a-comic-that-breathes-through-web-interaction.html
  A webcomic built with WebGL: hand-drawn art is texture-atlas'd (via TexturePacker) and reconstructed as
  WebGL planes, with **GSAP choreographing panel transitions** and **looping idle animation on every
  panel** ("all the panels are animated with some loop animation to make them feel more alive"). Color is
  used selectively (black-and-white base art, color only in dream sequences) as a narrative/attention
  device rather than a blanket style — a technique directly reusable in an overlay system: keep the base
  panel grayscale/halftone and reserve full color for the "important" panel.
  Note: the live project site itself was not independently reachable during this research session; the
  description above is sourced from the Awwwards feature page's write-up of the project.

- Beyond this, no other manga/comic-panel-grammar site with documented entrance choreography surfaced in
  search (Awwwards' animation and GSAP showcase pages list many motion-forward sites, but their write-ups
  don't describe comic-panel-specific grammar in enough detail to cite reliably). Treat the motion
  grammar below as **synthesized from general scroll/stagger-reveal best practice + comic timing
  conventions**, not lifted from a single named site — flag this to the team rather than presenting it as
  observed fact.

**Recipe (framer-motion), synthesized:**
```tsx
const grid = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
}

const panel = {
  hidden: { clipPath: "inset(0 0 100% 0)", opacity: 0 },
  show: {
    clipPath: "inset(0 0 0% 0)",
    opacity: 1,
    transition: { type: "spring", stiffness: 300, damping: 14 },
  },
}
```
- `staggerChildren` in the 60–120ms range mirrors natural reading-order eye movement across a page (not
  so fast it reads as one flash, not so slow it drags).
- `clip-path: inset(...)` (or a diagonal polygon for "action" panels) as the reveal mechanism reads as
  "the panel is being uncovered," which is closer to how a comic page is actually consumed (line-by-line
  reveal) than a generic fade/slide.
- A spring with light overshoot (`damping` in the 10–16 range against `stiffness` 250–350) gives the
  "snap into place" feel that matches comic impact timing (anticipation → hit → settle) rather than a
  smoothed UI ease curve.
- Reserve larger overshoot / rotation-in for panels flagged as `impact`/`action`; keep dialogue and data
  panels on a plain clip-path + fade with no spring overshoot, so information-dense panels don't feel
  jittery.

## 6. Accessible art-vs-data split

- **Art panels**: rendered as `<img>` or CSS background images. Always carry a real `alt` (art panels) or
  `role="img" aria-label` (CSS-background panels) describing the *story content*, not the visual
  technique ("Character leaps across rooftops at night," not "halftone panel with speed lines").
- **Data/caption panels**: real semantic HTML inside the panel shell — `<p>`, `<blockquote>`, `<dl>` for
  stat blocks, etc. — so text is selectable, searchable (find-in-page), translatable, and read correctly
  by screen readers regardless of the decorative panel chrome around it. Don't bake this text into an
  image or a canvas-rendered layer.
  A useful pattern seen in the wild: keep the real content in a plain, semantically-correct DOM node (an
  `<article>`, ordinary flow) for assistive tech / copy-paste / find-in-page, and layer the decorative
  comic treatment (halftone, borders, clip-path reveal) as non-content wrapper elements around/behind it.
- **Decorative layers**: halftone backgrounds, speed-line SVGs/conic-gradients, and ink-splash reveal
  masks are all `aria-hidden="true"` and/or pure CSS (`background-image`, `::before`/`::after`) — never
  real DOM content, so they can't be mistakenly read or tabbed to.
- **Reduced motion**: gate every entrance effect behind `prefers-reduced-motion: reduce`. MDN's guidance
  is a binary switch (`no-preference` / `reduce`) — the pragmatic pattern is: for `reduce`, drop
  clip-path wipes, spring overshoot, and any `feTurbulence`/JS-driven noise animation, and replace with a
  plain opacity crossfade (or show content with no animation at all). Test via Chrome DevTools' "Emulate
  CSS media feature prefers-reduced-motion" rather than toggling OS settings during development.
  ```css
  @media (prefers-reduced-motion: reduce) {
    .panel { animation: none !important; transition: opacity 0.15s linear; clip-path: none !important; }
  }
  ```

## Sources

- [CSS { In Real Life } — CSS Halftone Patterns](https://css-irl.info/css-halftone-patterns/)
- [Creating a halftone effect with CSS — leanrada.com](https://leanrada.com/notes/pure-css-halftone/)
- [Pure CSS Halftone Effect in 3 Declarations — master.dev (formerly Frontend Masters Blog)](https://master.dev/blog/pure-css-halftone-effect-in-3-declarations/)
- [Pure CSS Halftone Effect — CodePen (coreh)](https://codepen.io/coreh/pen/LQJBLa)
- [Hexio — Moiré / Screen clash](https://hexio.co.uk/2019/06/moire-screen-clash/)
- [How to avoid a moiré pattern in a halftone screen — Brad Guigar](https://bradguigar.substack.com/p/how-to-avoid-a-moire-pattern-in-a)
- [Pro Artist's Guide to Comic & Manga Layouts, Paneling, Flow — Art Rocket / ClipStudio](https://www.clipstudio.net/how-to-draw/archives/160963)
- [Creator Tips and Tricks #8: Gutters and Panel Layouts — GlobalComix Blog](https://globalcomix.com/news/details/249/creator-tips-and-tricks-8-gutters-and-panel-layouts)
- [Creator Tips and Tricks: Margins and Trims for Comics and Manga — GlobalComix Blog](https://globalcomix.com/news/details/200/creator-tips-and-tricks-margins-and-trims-for-comics-and-manga)
- [Comic Book Panelling: Master Panel Types, Transitions & Gutters — Jenova](https://www.jenova.ai/en/resources/comic-book-panelling)
- [<feTurbulence> — MDN Web Docs](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/feTurbulence)
- [<feDisplacementMap> — MDN Web Docs](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/feDisplacementMap)
- [Simulating Hand-Drawn Motion with SVG Filters — Camillo Visini](https://camillovisini.com/coding/simulating-hand-drawn-motion-with-svg-filters)
- [SVG Filter Effects: Creating Texture with feTurbulence — Codrops](https://tympanus.net/codrops/2019/02/19/svg-filter-effects-creating-texture-with-feturbulence/)
- [SVG Turbulence Filter Generator](https://sean.brunnock.com/SVG/SVGTurbulenceGenerator/)
- [Comic Speech Bubbles: Types & Placement Guide — YarnSaga](https://yarnsaga.com/blog/how-to-add-speech-bubbles-to-comic)
- [Speech Bubble Design: Create Professional Dialogue for Comics and Webtoons — Multic](https://www.multic.com/guides/speech-bubble-design/)
- [Comic Book Grammar & Tradition — Blambot Comic Fonts & Lettering](https://blambot.com/pages/comic-book-grammar-tradition)
- [What Font Do Comics Use? The Art of Lettering — Design Your Way](https://www.designyourway.net/blog/what-font-do-comics-use/)
- [Ponpon Mania: A comic that breathes Through web interaction — Awwwards](https://www.awwwards.com/ponpon-mania-a-comic-that-breathes-through-web-interaction.html)
- [Best Animation Websites — Awwwards](https://www.awwwards.com/websites/animation/)
- [11 Comic Book Website Snippets — CodeMyUI](https://codemyui.com/tag/comic-book/)
- [8 Comic-Inspired Snippets Powered by CSS & JavaScript — Speckyboy](https://speckyboy.com/comic-inspired-css-javascript-snippets/)
- [CSS Grid Layout and Comics (as Explained by Barry the Cat) — Envato Tuts+](https://webdesign.tutsplus.com/css-grid-layout-and-comics-as-explained-by-barry-the-cat--cms-27617t)
- [Comics Etc — Awwwards Honorable Mention](https://www.awwwards.com/sites/comics-etc)
- [The Magic of Clip Path — Emil Kowalski](https://emilkowal.ski/ui/the-magic-of-clip-path)
- [stagger — Motion for React docs](https://www.framer.com/motion/stagger/)
- [Creating Staggered Animations with Framer Motion — Kehinde Ridwan Onifade / Medium](https://medium.com/@onifkay/creating-staggered-animations-with-framer-motion-0e7dc90eae33)
- [prefers-reduced-motion CSS media feature — MDN Web Docs](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-reduced-motion)
- [Design accessible animation and movement with code examples — Pope Tech](https://blog.pope.tech/2025/12/08/design-accessible-animation-and-movement/)
- [Ink bleed effect with SVG filters — Andy Jakubowski](https://andyjakubowski.com/tutorial/ink-bleed-effect-with-svg-filters)
- [Ink Transition Scroll Effect — FreeFrontend](https://freefrontend.com/code/ink-transition-scroll-effect-2026-01-18/)
