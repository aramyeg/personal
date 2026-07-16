# Tiny-Planet Journey — Visual Reference Language

Research for a "tiny planet journey" web piece: a character traveling a small 3D world as the user scrolls. Synthesized from award-winning scroll sites, tiny-planet games, The Little Prince illustration conventions, Turning Red's shape language, and clay/claymation rendering.

## TL;DR — Composition Rules

1. **Whole-planet framing, not a horizon.** Every strong reference (Mario Galaxy planetoids, Messenger's tiny world, The Little Prince) keeps the *entire sphere* legible in one glance rather than showing a slice of horizon like a normal landscape. The curvature itself is the tell that sells "small world" — hide it and you just have a hill.
2. **Camera sits above and slightly back, looking down at ~15–30° below the horizontal**, framing the planet as a three-quarter globe (roughly 55–70% of a full circle visible, not a flat disc and not a full silhouette ball with nothing readable on top). This is the Little Prince pose: the boy stands on top, the curvature falls away on both sides, and you can see just enough of the "far side" to imply continuation, not so much that the near-side detail gets crushed into a strip.
3. **Planet fills 45–65% of the viewport's shorter axis.** Big enough that props (a lamppost, a rose, a house) read as recognizable objects, small enough that the full sphere plus a margin of "space/void" around it stays inside frame — this negative space is what tells the eye "this is an object floating in a void," not a diorama on a table. Reference: Mario Galaxy planetoids, Messenger's tiny sphere, Old Man's Journey's diorama layers (which use the same "whole small world visible at once" logic in 2D).
4. **Character occupies 8–15% of frame height**, standing on the near-top curvature of the sphere (roughly the top third of the visible globe), gravity-aligned to the surface normal so they visually "stand up" off the curve rather than perpendicular to the screen — this is the Mario Galaxy / Little Prince gravity trick: orient the character (and any "up" foliage, lampposts, hair) to the local radius vector, not to world-up.
5. **Discovery moments are staged as slow planet-rotation, not camera cuts.** Scroll should rotate the planet (or orbit the camera around it) so new zones/props scroll into view from the frame edge while the whole sphere stays in shot — matching Messenger's "walk in any direction and end up back where you started" structure and Solar Journey's "planet switch" transitions between scroll chapters. Avoid hard cuts to close-ups that break the "small self-contained world" read; if you need a close-up beat, dolly the camera closer *while keeping curvature visible at the frame edges* so the world doesn't flatten into a wall.
6. **Prop density is sparse and iconic, not naturalistic.** The Little Prince's planet has exactly the props that matter to the story (a rose, a volcano, a chair) with generous bare ground between them — clutter reads as "regular landscape," sparsity reads as "a whole world I can hold in my head." Aim for 3–6 hero props per visible hemisphere, each large enough relative to the character to read as a landmark.
7. **Shape language: rounded, chunky, "bigger and rounder" (Turning Red's "chunky cute" rule).** Terrain, props, and the character should skew toward soft rounded-rectangle and sphere primitives with minimal sharp angles — this both matches the clay-render aesthetic (clay doesn't hold crisp edges) and reinforces the planet's own spherical shape language throughout the scene (self-similar shapes: round planet, round hills, round character head).
8. **Color: saturated but restricted, push warm/cool contrast for camera-relevant landmarks.** Turning Red put its two leads on opposite sides of the color wheel (red vs. green) specifically so silhouettes stay legible at a glance; do the same for character-vs-world (character color must pop against the planet's dominant palette at every rotation angle) and for "next destination" props (give the next discovery beat a color that doesn't otherwise appear yet on the visible hemisphere, so the eye is pulled toward it during scroll).
9. **Clay/matte material read: kill specularity, keep soft ambient occlusion, add micro-imperfection.** No hard mirror highlights; use broad, soft falloff shadows (baked AO or soft area lights) in the crevices between props and terrain; add very subtle asymmetry / fingerprint-like surface noise on hero props so nothing reads as a perfect CAD primitive. This is the single biggest lever for "clay" over "generic low-poly game," per both the Aardman references and the AI clay-render prompting patterns.
10. **Camera stays static in world-space "up," planet does the rotating.** For a scroll-driven piece specifically, it reads more stable if the camera holds a fixed height/pitch above the sphere and the *sphere itself* rotates under the character/camera rig as scroll progresses (this is exactly how Mario Galaxy's gravity-relative camera and Messenger's tracking camera behave) — that keeps the "hero pose" (character silhouette, lighting direction) consistent across the whole journey instead of it swinging around unpredictably.

## Example-by-Example Notes

### 1. Messenger (Vicente Lucendo & Michael Sungaila, 2025 — viral WebGL browser game)
A young mail carrier delivers parcels on a small, fully walkable spherical planet split into seven distinct zones (neighborhood, plaza, cemetery, beach, mountain temple, forest, factory) — walk far enough in one direction and you loop back to your start, King Kai's-planet style. Uses an over-the-shoulder tracking camera (compared to God of War/Arc Raiders) so the character stays framed automatically without manual camera work — directly useful for a scroll-driven rig where the user isn't steering the camera themselves. Art direction is deliberately "imperfect and hand-drawn": a custom outline shader with tunable thickness/color/transparency, plus a minimalist 16×16-pixel texture atlas driving the whole world's palette so mood can be shifted globally. Went viral specifically for its "cozy but a little weird" tone — a good tonal reference for a "journey" piece that should feel gentle rather than epic. Multiplayer touches (other travelers visible, 3D emoji communication) aren't relevant to us, but the "whole planet is walkable and always partially visible" structure is the core takeaway.

### 2. Super Mario Galaxy (Nintendo, 2007) — not a website, but the canonical tiny-planet camera/gravity reference
Solves the two hard problems any tiny-planet piece has to solve: gravity direction and camera direction. Gravity is derived from the surface normal of whatever planetoid the character is standing on — the inverse of that normal is "down," and that same normal is used to align the character's up-axis to the local curvature (this is exactly rule #4 above). Camera direction follows character movement rather than the reverse, and Nintendo's own dev commentary (Iwata Asks) frames the whole spherical-world approach as a deliberate choice to let players "discover" new orientations and layouts on the same object, rather than a purely technical gimmick. Also notable: not every planetoid is a perfect sphere — many are lumpy or shaped like objects (ice cream, an apple) with rounded edges, which supports rule #7 (soft/rounded shape language reads as "planet" even without geometric perfection).

### 3. Solar Journey (Julian Fella, Awwwards Honorable Mention)
A "laid-back tour through the solar system" built to show off scale while staying fun/informative. Awwwards' tagged interactions — "Intro Scroll Animation," "Clickable Planets," "Planet Switch Animation," "Hero Intro Animation" — indicate the site is structured as discrete chapters, each keyed to a planet, with an explicit transition animation between them rather than a single continuous camera move. That chapter/transition structure is a reasonable model for staging discovery beats in a scroll piece without needing continuous procedural camera logic for every moment.
URL: https://www.awwwards.com/sites/solar-journey

### 4. A Cosmic Scroll Journey (Wix Studio showcase, Awwwards Honorable Mention)
An "epic scrollytelling experience" moving through space, built to demonstrate Wix Studio's no-code scroll/animation effects — useful mainly as a proof that pure-scroll (no drag/orbit controls) can carry a full space-journey narrative without the user ever taking manual camera control, which matches our brief of a scroll-only interaction model.
URL: https://www.awwwards.com/inspiration/a-cosmic-scroll-journey-a-cosmic-scroll-journey

### 5. Planetoño (case study via Tubik Studio blog)
A food-delivery-brand 3D web piece structured as a two-part scroll: a hero shot of finished "combo meal" scenes, then a step-by-step walkthrough where each scroll step reveals one new build layer (burger, fries, toy, delivery box) with each new scene "sliding into place like layers of cardboard in a diorama." That diorama-layer-reveal pattern is a strong, concrete model for staging our own discovery beats (a new prop/zone slides/rotates into frame per scroll step rather than everything being visible at once from the start). Visual style leans toon-shaded — flat colors, bold graphic shadows — with a deliberately oversaturated, warmed palette ("overcooked, street-food glow"); the toon-shader + bold-shadow combination is adjacent to, but distinct from, the clay-matte look we want (toon shading uses hard-edged flat shadow shapes; clay wants soft AO gradients instead) — worth noting as a "near miss" to avoid literally copying.
URL: https://blog.tubikstudio.com/planetono-3d-web-design/

### 6. Bruno Simon Portfolio (bruno-simon.com) — Awwwards Site of the Year 2020
Not a tiny planet, but the reference for "no-UI, drive/explore a whole small 3D world built as a single readable object" (a bounded island rather than an open landscape). Built in Three.js + Blender geometry + Cannon.js physics, deliberately interface-free so exploration itself carries the experience. Useful for the general principle that a small, fully-explorable bounded world reads as more inviting and "toy-like" than an open/unbounded environment — reinforces keeping our planet a hard-edged, fully-contained object in frame at all times.
URL: https://bruno-simon.com/

### 7. Old Man's Journey (Broken Rules, 2017) — 2D diorama analog
Not 3D and not a planet, but structurally the closest 2D analog to "the whole small world stays visible while the character moves through it": each scene is a layered diorama (foreground/background terrain bands) that the player physically raises and lowers to build a walkable path, in a pastel, watercolor, pop-up-book style with visible brushstrokes and an intentionally imperfect, hand-crafted texture. Confirms that "the whole self-contained world is visible in one frame, terrain layers move to reveal path/story" is a viable, tested discovery mechanic independent of full 3D — useful if any 2.5D fallback is considered.

### 8. Spiritfarer (Thunder Lotus, 2020)
Island-hopping-by-boat structure: sail to a new shore, dock, explore fully, sail on. Hand-drawn, soft-lined, vibrant art direction with "no fail state, no time pressure" pacing. Relevant mainly for pacing philosophy — discovery beats are unhurried and player/scroll-paced, each island revealed as a complete, generous "everything is here to be found" space rather than a sparse waypoint, which argues for giving each stop on our planet enough prop density and incident to reward lingering, even inside the "sparse, iconic" prop-density rule above (sparse per hemisphere, but each of those few props should have a small story/animation beat attached).

### 9. Wonderputt / Wonderputt Forever (Damp Gnat / Reece Millidge)
Isometric mini-golf where the whole course is one continuously reconfiguring scene — new holes fold out of and replace the current terrain via a mechanical, cross-section, almost pop-up-book transformation. The comparison critics reached for was M.C. Escher and scientific cross-section illustration. Good reference specifically for how to transition between "chapters" of a small world mechanically (terrain folding/rotating/reconfiguring in place) rather than cutting — an alternative to Solar Journey's discrete "planet switch" if we want the whole scene to visibly transform instead of swap.

## The Little Prince — Planet & Scale Conventions

- **Character-to-planet scale is exaggerated small-planet, not geographically plausible**: the prince is drawn roughly comparable in height to the visible curvature radius of his asteroid (B612), which is what makes the "tiny personal world" reading land — a planet so small one person's belongings (a chair, a volcano, a rose under a glass dome) constitute its entire content.
- **Line economy**: the original illustrations use simple, uncluttered line work with hatching for shading and deliberately avoid excess linework ("carried off the composition without a single excess line") — supports rule #6 (sparse, iconic props) and argues against busy/naturalistic texture detail on our planet's surface.
- **Iconic prop set, not a landscape**: the recurring elements are always the same small cast — the rose (often under a glass dome), the volcano(es), a single chair, the fox, a lamplighter's lamppost on other asteroids in the story — each one large enough relative to the prince to be a clear "thing," never a backdrop texture.
- **Palette**: simple, pastel-leaning coloring (originally watercolor/colored pencil), used more for mood than for local realism — a palette decision, not a rendering-technique one, but consistent with keeping the clay/matte render restrained rather than photoreal.

## Turning Red — Shape Language & Color Rules

- **"Chunky cute" as the explicit brief**: production designer Rona Liu and director Domee Shi's stated goal was building everything "bigger and rounder" for a coming-of-age story — i.e., shape language itself is used to communicate warmth/approachability, not just character personality. Directly supports rule #7.
- **Color-wheel-opposite leads**: Mei (fire red) and Ming (emerald green) are placed on exact opposite sides of the color wheel specifically to keep the two characters — and by extension their emotional conflict — instantly legible in any shot, even in silhouette or at a glance. This is a transferable trick: pick the character's hero color as the complement of the planet's dominant ground/foliage color so the character never visually disappears into the world at any rotation angle.
- **Personal, autobiographical character grounding**: Mei's specific features (chubby cheeks, sparse eyebrows, moles, early-2000s outfit) were drawn from the filmmakers' own teenage appearance — a reminder that "chunky/rounded" shape language still needs specific, non-generic character detail layered on top, not just a smoothed-out primitive.
- General Pixar shape-language principle (not Turning Red specific, but corroborating): shapes read as personality before any surface detail is added (round = soft/approachable, blocky = strong/stable, angular = dangerous/sharp) — worth applying deliberately to props (rounded rocks/houses = friendly world) versus any antagonist or hazard elements (should break the rounded rule to read as "wrong" for this world).

## Clay / Claymation Aesthetic — What Sells the Read

- **No specularity.** Clay is "about as matte as it gets" — hard mirror highlights immediately break the read and make something look like painted plastic instead of clay.
- **Soft global-illumination-style shadowing.** The claymation look is achieved less through the base material and more through soft, broad ambient-occlusion-style shadowing in crevices (precomputed radiance transfer / spherical harmonics / baked AO all cited as techniques that push a render toward "claymation"), i.e. soft contact shadows everywhere two clay forms meet, rather than a single hard directional shadow.
- **Fingerprint / hand-touch micro-imperfection.** Aardman's specific, well-documented practice: their clay (Newplast) takes and holds fingerprints, and after some periods of trying to erase all tool marks, they made a deliberate choice to leave fingerprints back in — "it's all about the soul, about the human input." For our render, this argues for adding subtle asymmetric surface noise/displacement on hero props (never perfectly smooth, never perfectly symmetric) rather than clean primitive geometry.
- **Earthy, natural, slightly desaturated-but-warm palette** is cited as part of Aardman's charm, alongside "exaggerated features and round shapes with glossy eyes" for characters specifically (note: glossy *eyes* as a deliberate exception to the otherwise-matte material rule — wet/glossy eyes against matte skin is a classic clay/stop-motion character trick worth keeping even if the rest of the material is matte).
- **Practical rendering technique callouts** found in tutorials: clay-style shader setups typically strip texture/albedo detail down to near-solid colors per material, lean on ambient occlusion and soft global illumination for all form-reading, and avoid subsurface scattering or specular highlights that would push the material toward skin/plastic/wax-candle instead of modeling clay.

## Sources

- [Messenger — Awwwards](https://www.awwwards.com/messenger.html)
- [A WebGL game where you deliver messages on a tiny planet — Hacker News](https://news.ycombinator.com/item?id=45396441)
- [Messenger (video game) — Wikipedia](https://en.wikipedia.org/wiki/Messenger_(video_game))
- [Deliver Mail on Tiny Planet in This Relaxing Web Game — 80.lv](https://80.lv/articles/deliver-mail-on-tiny-colorful-planet-in-this-relaxing-web-game)
- [Solar Journey — Awwwards](https://www.awwwards.com/sites/solar-journey)
- [A Cosmic Scroll Journey — Awwwards](https://www.awwwards.com/sites/a-cosmic-scroll-journey)
- [A cosmic Scroll Journey (1 Pager) — Awwwards](https://www.awwwards.com/inspiration/a-cosmic-scroll-journey-a-cosmic-scroll-journey)
- [Planetoño: Our Favorite Project That Doesn't Exist — Tubik Blog](https://blog.tubikstudio.com/planetono-3d-web-design/)
- [Bruno Simon — Portfolio (case study)](https://medium.com/@bruno_simon/bruno-simon-portfolio-case-study-960402cc259b)
- [Bruno Simon — Portfolio Wins Site of the Month November — Awwwards](https://www.awwwards.com/bruno-simon-portfolio-wins-site-of-the-month-november.html)
- [bruno-simon.com](https://bruno-simon.com/)
- [Games Demystified: Super Mario Galaxy — Game Developer](https://www.gamedeveloper.com/design/games-demystified-super-mario-galaxy)
- [Iwata Asks: Super Mario Galaxy — Benefits of a Spherical Field — Nintendo](https://www.nintendo.com/en-gb/Iwata-Asks/Iwata-Asks-Super-Mario-Galaxy/Volume-2-The-Developers/2-Benefits-of-a-Spherical-Field/2-Benefits-of-a-Spherical-Field-222607.html)
- [Super Mario Galaxy — Wikipedia](https://en.wikipedia.org/wiki/Super_Mario_Galaxy)
- [portfolio site with procedurally generated tiny planets + a VR version — three.js forum](https://discourse.threejs.org/t/portfolio-site-with-procedurally-generated-tiny-planets-a-vr-version/70798)
- [Old Man's Journey Review — WCRobinson](https://wcrobinson.org/2020/07/12/old-mans-journey-review/)
- [Old Man's Journey — Broken Rules (itch.io)](https://brokenrules.itch.io/old-mans-journey)
- [Spiritfarer — Nintendo World Report hands-on preview](http://www.nintendoworldreport.com/hands-on-preview/53075/spiritfarer-is-the-coziest-game-about-death-youre-liable-to-play)
- [Spiritfarer Locations Guide — Indie Game Culture](https://indiegameculture.com/guides/spiritfarer-locations-guide/)
- [Wonderputt — Wikipedia](https://en.wikipedia.org/wiki/Wonderputt)
- [Wonderputt Forever — Rogue Games](https://rogueco.com/games/wonderputt-forever/)
- [The Helpful Art Teacher: Tiny Planets, inspired by The Little Prince and Asteroid B612](http://thehelpfulartteacher.blogspot.com/2014/12/tiny-planets-inspired-by-little-prince.html)
- [The Little Prince — Wikipedia](https://en.wikipedia.org/wiki/The_Little_Prince)
- [Creating the Look of Disney and Pixar's "Turning Red" — SoCalThrills](https://socalthrills.com/disney-and-pixar-creating-the-look-of-turning-red/)
- [The Art of Turning Red — Stuart Ng Books](https://stuartngbooks.com/products/the-art-of-turning-red-first-printing)
- [Inside 'Turning Red's' Production Design — Variety](https://variety.com/2022/artisans/news/turning-red-how-anime-teen-bedrooms-and-easter-eggs-all-feature-in-production-design-1235202044/)
- [The making of Pixar's Turning Red — Creative Review](https://www.creativereview.co.uk/pixar-turning-red-director/)
- [Shape Language in Character Design Explained — Pixune](https://pixune.com/blog/shape-language-technique/)
- [The clay that makes Aardman Animations come to life — The Kid Should See This](https://thekidshouldseethis.com/post/the-clay-that-makes-aardman-animations-come-to-life)
- [Aardman Animations Midjourney style — Midlibrary](https://midlibrary.io/styles/aardman-animations)
- [Explore Clay Render in AI Prompts for Clean 3D Visuals](https://netnuggets.ghost.io/clay-render/)
- [Clay Rendering Explained: Quick Setup, Pro Tips, and Examples](https://www.myarchitectai.com/blog/clay-rendering)
- [A Short Hike — Wikipedia](https://en.wikipedia.org/wiki/A_Short_Hike)
- [press kit — a short hike](https://ashorthike.com/press/)
