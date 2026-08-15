# PS1 diorama bedroom: art direction research

Research brief: rebuild `/labs/ps1` as a single dense scene — a 1999 developer's bedroom/office
at **golden-hour dusk**, rendered as a genuine PS1-era diorama (three.js, PSX pipeline, fixed
camera angles), with portfolio content as inspectable objects (CRT = menu, memory cards =
projects, posters = skills). The current build failed by reading as **synthwave/retro-cyberpunk**
(blue void, neon grid horizon, floating wireframe morphing shapes) instead of PS1.

**Revision note:** an earlier pass of this research over-indexed on PS1 *horror* (Silent Hill,
Signalis) as the anchor references. That's the wrong mood for this room. The corrected anchors are
the **energetic, punchy, saturated side of PS1**: Tony Hawk's Pro Skater, Crash Bandicoot, Twisted
Metal 2, plus Spyro and Ape Escape. The room should feel lived-in and fun — someone's messy,
loved bedroom at the end of a bright day — not lonely or dreadful. Horror-PSX shows up here only
once, briefly, as a labeled contrast (§2).

**Diagnosis of the current build** (`components/labs/ps1/ps1-scene.tsx`): a `void`/`grid`/
`horizon`/`star` palette (deep blue-black background, blue-grey grid lines, sky-blue horizon
band) with morphing icosahedron/octahedron/cube wireframes drifting in empty space. That's the
*Outrun* formula almost exactly — infinite void, neon grid, geometric primitives floating with
nothing around them. The fix isn't just "make it warmer," it's a category change: a **cluttered,
sunset-lit, specific room**, not an abstract void — energetic clutter, not empty geometry.

---

## 1. What actually separates PS1 from synthwave/outrun — and PS1's two registers

**Synthwave/Outrun is a curated *memory* of the 80s, not a technical artifact.** It's a deliberate
stylization — magenta/cyan neon grids, chrome lettering, sunset gradients, high-contrast neon on
near-black backgrounds — filtered through 80s sci-fi and arcade culture, clean and idealized. It
does not document any actual hardware. [Aesthetics Wiki – Synthwave](https://aesthetics.fandom.com/wiki/Synthwave),
[Outrun: The Aesthetic Deconstructed](https://medium.com/@cywjoel/outrun-the-aesthetic-deconstructed-dbd3cd8679b7).

**PS1 is what real 1990s hardware constraints looked like — and those constraints are a fixed
technical fingerprint that sits *underneath* every PS1 game regardless of genre or mood:**

- **Vertex jitter.** Fixed-point math, no subpixel precision — triangle vertices snap to the
  nearest screen pixel every frame, visibly wobbling even on static geometry. [Fixed-Point Math
  and Why Your Childhood Looked Unstable](https://cosmicosmo.co/blog/ps1-graphics), [NeoGAF
  thread](https://www.neogaf.com/threads/why-do-playstation-1-polys-jitter-when-the-camera-pans.879050/page-2).
- **Affine texture warping.** No perspective-correct texture mapping — UVs interpolate linearly in
  screen space, so textures swim and bend on angled surfaces. [Polycount Retro 3D Art FAQ](https://polycount.com/discussion/226167/retro-3d-art-faq-everything-you-need-to-know-to-create-ps1-n64-dreamcast-etc-3d-art).
- **Dithering as forced color compression.** 24-bit internal color, **15-bit (32,768 colors)**
  output — everything gets an ordered dither pattern to fake extra gradient steps, tuned to be
  blurred smooth by a composite-video CRT. Dithering is per-polygon controllable hardware state
  (GPU command `GP0 $E1`), not a blanket filter — real PS1 games turn it on and off deliberately
  per object. [PlayStation 1 Dithering Removal](https://www.chrismcovell.com/psxdither.html),
  [Dithering – Emulation wiki](https://emulation.gametechwiki.com/index.php/Dithering).
- **Gouraud (per-vertex) lighting, no per-pixel lighting.** Light computed at vertices, interpolated
  across the face — reads as discrete pools and gradients, not smooth PBR falloff.
- **Low, memory-budgeted textures carrying real hand-painted or vertex-painted detail.** Typical
  textures: 32×32 to 64×64, 4-bit/8-bit paletted, because the whole texture+mipmap set had to fit a
  4KB cache with ~1MB shared VRAM total. [Polycount Retro 3D Art FAQ](https://polycount.com/discussion/226167/retro-3d-art-faq-everything-you-need-to-know-to-create-ps1-n64-dreamcast-etc-3d-art).
- **Short, hard render/fog distance** — small draw distance is load-bearing, not decorative; every
  genre solved it differently (see Spyro below).

**The part the earlier research draft got backwards: these technical truths do not imply a mood.**
PS1 games split into (at least) two visually opposite registers built on the *exact same*
hardware fingerprint:

- **Muted-dread register** (Silent Hill, Metal Gear Solid, Resident Evil, Signalis): washed-out,
  desaturated, warm-dark, fog-heavy. Saturation is rationed to almost nothing.
- **Saturated-arcade register** (Crash Bandicoot, Spyro, Tony Hawk's Pro Skater, Twisted Metal,
  Ape Escape): **bright, punchy, deliberately vibrant** — and just as dithered, jittered, and
  low-res as the horror titles. Crash Bandicoot's artists explicitly rejected "the muted grays and
  browns common in 3D games of that era" and chose saturated color as a differentiator. [Lessons in
  Color Theory for Spyro the Dragon](https://www.gamedeveloper.com/art/lessons-in-color-theory-for-i-spyro-the-dragon-i-).

**This room is the second register.** The dither/jitter/warp/low-res-texture fingerprint stays —
that's still what makes it PS1 and not synthwave — but the palette target is Crash's box art and
a skate deck, not a foggy hallway. Synthwave and muted-PS1-horror are actually *both* wrong turns
for this brief, for related but distinct reasons: synthwave has no texture, no grain, no technical
fingerprint at all (it's clean vector/gradient art); muted-PS1-horror has the right fingerprint but
the wrong palette and mood for a bedroom someone loves being in.

---

## 2. What we are NOT doing (one paragraph, for contrast only)

Silent Hill 1's fog began as a technical workaround for the PS1's short draw distance and became
the game's entire emotional register — washed-out greenish/bluish desaturation, constant film
grain, fog used to conceal rather than reveal. [SUPERJUMP – Through Mist, Light, and Darkness](https://www.superjumpmagazine.com/drafting-through-the-mists/). Signalis deliberately builds on
that same lineage — 8-bit (256-color) dithering modeled after Silent Hill specifically for mood,
skipping affine texture warping because the developers found it "distracting" for their tone.
[Signalis dev discussion](https://steamcommunity.com/app/1262350/discussions/0/4034727291137394217/).
Both are excellent, disciplined art direction — for a game about dread. None of that palette
logic (fog-as-concealment, rationed-to-zero saturation, grain-as-permanent-dread-texture) belongs
in this room. Where this doc still cites Silent-Hill-adjacent sources below, it's for a *technique*
(fixed-camera-as-directing-tool, technical pipeline discipline), never for mood.

---

## 3. The vibrant PS1 canon — primary references

### Tony Hawk's Pro Skater (1999) — skate-culture UI energy
THPS grounds itself in "punk rock and ska punk" skate culture — angsty, mainstream-adjacent,
irreverent. [Wikipedia](https://en.wikipedia.org/wiki/Tony_Hawk's_Pro_Skater). Four details worth
stealing directly:

- **School and Downhill Jam are the sunset-anchor levels, and the sunset treatment is itself a
  meaningful signal.** The original 1999 School ran midday with a cyan-tinted starting area, and
  the original 1999 Downhill Jam ran dark late evening; when the series' own 2020 remaster
  (THPS 1+2) revisited these exact levels, it deliberately re-lit both toward **warm late-afternoon/
  golden-hour light** — School's roofs went from cyan to a warmer green-gold and its time-of-day
  moved to late afternoon, and Downhill Jam (a descending dam/mall run) shifted from dark evening to
  **bright late-afternoon sunset**. [School level lighting change](https://www.pushsquare.com/guides/tony-hawks-pro-skater-1-plus-2-school-all-park-goals-gaps-and-challenges), [Downhill Jam level lighting change](https://tonyhawkgames.fandom.com/wiki/Downhill_Jam). In other words: when this
  franchise's own art directors, decades later, wanted these levels to feel more *iconic and
  premium*, golden-hour warmth is specifically what they reached for — direct precedent for lighting
  this room at sunset rather than flat midday or void-dark night.
- **The VHS tape collectible.** THPS's career-mode objectives are represented as physical VHS
  tapes you collect per level — explicitly modeled on Mario 64's stars, i.e. "make an abstract
  progress system into a tangible, of-the-era physical object." [Tony Hawk's Pro Skater —
  Wikipedia](https://en.wikipedia.org/wiki/Tony_Hawk's_Pro_Skater). This is a direct template for
  turning "projects" into physical objects in the room (memory cards, VHS tapes, CD spindles all
  work as the same idea).
- **1990s skate deck/zine visual language.** Skate culture's graphic identity in this era —
  Powell Peralta, Santa Cruz's Screaming Hand, Vision's Psycho Stick — is bold hand-drawn line art,
  saturated flat color fields, stencil and grunge type, sticker collage, printed in limited runs
  with a raw DIY quality. [Skateboard sticker history/culture](https://www.skateboardstickers.com/blogs/skateboard-stickers-about-history-culture/100-expert-answers-to-the-most-asked-questions-about-skateboard-stickers). Steal this for the UI/prop layer: stickers on the tower
  case, a leaned skate deck as a prop with real graphic art on the underside, grip-tape texture.
- **Polaroid/zine documentation culture.** 90s skate culture self-documented obsessively and
  cheaply: zines assembled from whatever a skater could photocopy at the library rather than afford
  in a $30,000 print run, Thrasher's "ink-heavy paper that got on your fingers" full of rough,
  unpolished action photos, and photographer/pro skater Ed Templeton shooting Polaroids of friends
  for gallery shows as early as 1994. [GOAT — Decoding the Visual Language of the 90s and Early
  2000s](https://www.goat.com/editorial/skateboarding-graphics-videos), [Jenkem — Zine Culture's
  Impact on Skateboarding](https://www.jenkemmag.com/home/2024/06/27/a-scholarly-look-at-zine-cultures-impact-on-skateboarding/). Steal directly: a **Polaroid-style photo prop** (a stack or a couple pinned to
  the corkboard/wall) is a legitimate, period-correct object for this room, and its square-frame,
  white-bordered, slightly-overexposed look is a good template for how "project" thumbnails or
  achievement callouts could render in the UI — cheap, physical, hand-placed documentation rather
  than a polished screenshot.

### Crash Bandicoot (1996) — saturated color discipline within 15-bit constraints
Crash is the single best case study for "how do you stay vibrant inside PS1's hardware ceiling."
Concrete technique, not vibes: Naughty Dog deliberately made Crash's *character model*
**untextured** — colored purely with **vertex coloring** (a color per vertex, gradient-blended
across the face) — specifically because the PS1 was strong at shaded-untextured polygons and this
sidestepped the affine-warping problem entirely on the hero character. Where textures *are* used
(props, environment), they're composited over the vertex color using a **modulate-2x blend** so
texture detail and saturated base color multiply together rather than the texture flattening the
color. [Vertex coloring + modulate 2x — Tumblr/Crash modding community](https://www.tumblr.com/harmlessplant/708700835633397760/in-the-original-ps1-crash-bandicoot-games-models). Also: Crash's fur
color went through a **failed green iteration that made him disappear into jungle backgrounds** —
the final orange-red was chosen partly for *character-vs-environment contrast*, not just appeal.
Steal: **vertex-color your hero/interactive objects (CRT, memory cards) in saturated flat-to-gradient
color, reserve fine texture detail for the static room**, and make sure interactive objects sit a
full contrast-step brighter/more saturated than the room around them so they read as "the thing
you can click," the same way Crash reads as "the thing you control."

### Twisted Metal 2 (1996) — cartoony vehicular chaos, real-world arenas as playgrounds
TM2's tone is "vibrant... overall cartoony look" applied to real cities turned into destructible
playgrounds — Los Angeles with a shot-up Hollywood sign, Paris with a bomb-able Eiffel Tower,
arenas dense with signage, landmarks, and destructible scenery. [TM2 review commentary](https://www.resetera.com/threads/lttp-twisted-metal-2-is-a-massive-refinement-on-the-original-but-still-a-bit-rough-in-2025.1279950/), [Los Angeles arena detail](https://twistedmetal.fandom.com/wiki/Los_Angeles). Its signature
character, Sweet Tooth, is a "flamboyant" killer-clown-in-an-ice-cream-truck — over-the-top and
theatrical rather than atmospheric-scary; TM2's version leans more unsettling than TM1's,
[deviantart commentary](https://www.deviantart.com/blok--head/art/Sweet-Tooth-Twisted-Metal-Classic-Doodle-1139356873), which is a useful boundary marker: **playful-grungy chaos, carnival
theatricality, real-world-landmark irreverence — not creeping dread.** Steal: **dense environmental
signage and landmark clutter as personality** (posters, stickers, a skate deck standing in for a
"destructible landmark" the way the Hollywood sign or Eiffel Tower do), and a willingness toward
loud, graphic, poster-style flat color for wall decoration rather than photographic realism.

### Spyro the Dragon (1998) — saturated palette discipline and hiding draw distance in beauty
The clearest documented color-theory rulebook in this whole set. Insomniac's own internal rule:
**"a level's core palette should contain only two or three base colors"**, built out via shade/value
variation and a *few* selective complementary accents — enough to avoid "emotional mud" from
over-hueing a scene. They rejected the muted-gray-and-brown 3D-game default of the era in favor of
**bright, saturated color as a deliberate differentiator.** Two more transferable rules: (1) base
*textures* stay **somewhat desaturated** so that colored vertex-lighting overlays have headroom
without blowing out on CRT contrast enhancement — i.e. saturation is spent in the *lighting layer*,
not baked flat into every texture; (2) **the sky is the dominant color anchor** for a scene — Spyro's
artists found an "unearthly" misty-green sky accidentally read as poisonous/toxic and had to
redesign toward a more legible palette, meaning sky color choice alone can flip a scene's emotional
read. [Lessons in Color Theory for Spyro the Dragon](https://www.gamedeveloper.com/art/lessons-in-color-theory-for-i-spyro-the-dragon-i-). On draw distance specifically: Spyro's engine used **no
distance fog**; instead levels were built from solid continuous masses (mountain ranges, walls,
cliffs) so geometry pop-in was architecturally hidden rather than fogged out, and collectibles got
animated sparkle so they stay legible at range. [Lessons in Color Theory for Spyro](https://www.gamedeveloper.com/art/lessons-in-color-theory-for-i-spyro-the-dragon-i-). Skyboxes themselves were **vertex-painted
spheres**, not textures — cheap, and the reason Spyro skies have that characteristic soft
triangular-gradient bleed. [Spyro skybox vertex-color technique](https://danielilett.com/2019-12-11-tut4-1-spyro-skyboxes/). Steal directly: **the "2-3 base colors per
zone" rule for each camera angle**, a desaturated-texture/saturated-light-layer split, and treating
the window's sunset gradient as the room's dominant color anchor the way Spyro treats its skybox.

### Ape Escape (1999) — toy-like prop design
Ape Escape's whole premise is chasing apes with an "impressive array of toy-like gadgets" —
props designed to read as physical toys, not sci-fi equipment: rounded, primary-colored, legible
silhouettes. [The Making of Ape Escape](https://www.timeextension.com/features/best-of-2025-the-making-of-ape-escape-sonys-groundbreaking-platformer-that-unlocked-the-dualshocks-potential). Steal: treat every prop in the room (the
CRT, the controller, the game cases) as a **toy-colored object first, a realistic object second** —
rounded plastic forms in one or two saturated colors read as more "PS1-vibrant" than
photoreal beige/grey electronics.

---

## 4. Supporting technique references (tone-neutral, kept from the original brief)

- **Metal Gear Solid 1** — one transferable technique regardless of MGS1's own darker palette:
  **environmental color tinting bleeds onto every material in a zone** — a room reads uniformly
  orange-yellow or uniformly blue-grey as a whole, not object-by-object. [MGS1 case study](https://polycount.com/discussion/139243/mgs1-case-study-calling-all-you-lowpoly-fiends). Steal the
  *mechanism* — one dominant color cast per camera angle — and feed it warm sunset-orange instead
  of MGS1's own muted military palette.
- **Final Fantasy VII/VIII pre-rendered rooms** — backgrounds were painted offline at
  film-quality render time, then composited with real-time low-poly characters via a
  **depth-sorted tile system** so characters could walk in front of and behind static objects.
  [An Adventure in Pre-Rendered Backgrounds](https://www.jmeiners.com/pre-rendered-backgrounds/). Steal the *bias*: put far more visual richness into
  the static room than into anything that has to move or be interactive, and depth-layer foreground
  clutter in front of midground objects even in true 3D to reinforce depth.
- **Resident Evil fixed cameras** — Shinji Mikami's angles are a directing tool, not a limitation:
  middle-distance framing holding both a close foreground and a far background, and **foreground
  occluders** (a doorframe edge, a hanging garment, a shelf) between camera and subject.
  [Cinematography of Resident Evil](https://www.sevastromo.com/the-cinematography-of-resident-evil/). Steal the composition mechanics; drop the horror
  intent entirely — here a foreground occluder (a leaned skate deck, a draped hoodie) is framing
  and depth, not a hiding-something-scary cue.
- **Gran Turismo menu chrome** — PS1 had **no sprite scaling**, so menus are rigid fixed-size
  blocks in a grid rather than fluidly resizing panels; GT2 pushed into metallic gradient panel
  fills with yellow-accent UI blocks. [Gran Turismo Menu Styles](https://gran-turismo.fandom.com/wiki/Menu_Styles), [GT2 sprite-scaling limitation](https://tcrf.net/Proto:Gran_Turismo_(PlayStation)/Test_Drive_Disc/Menu_Differences).
- **PSX BIOS/boot environment** — a 3D diamond-and-logo assembling itself over black, plain
  grey-blocked memory-card manager with square 16×16-icon slots. [AVID – PlayStation Startup Screen](https://www.avid.wiki/PlayStation_(console)/Startup_Screen), [GameSpot – the boot logo was actually 3D](https://www.gamespot.com/articles/yes-the-ps1-boot-logo-was-actually-3d-this-whole-time/1100-6493544/). Direct template for the
  memory-card-manager-as-projects-grid UI.
- **LSD: Dream Emulator / Petscop** — mentioned only as a very light optional flourish, not a
  driving reference given the mood correction: **one** slightly-off object in an otherwise coherent
  room (a poster with subtly impossible proportions) can add PS1-authentic uncanniness without
  tipping into dread, but this is a garnish, not a pillar, for this brief. [LSD: Dream Emulator —
  Wikipedia](https://en.wikipedia.org/wiki/LSD:_Dream_Emulator).
- **Modern PSX-revival pipeline discipline** (Signalis, Crow Country, Paratopic, Bloodborne PSX,
  the Haunted PS1 scene) — this indie scene skews horror by genre convention, so it is cited here
  for **pipeline lessons only**, not tone: the recurring, sharpest lesson across all of them is that
  constraints must be **built into the render pipeline** (real low-res framebuffer, real vertex
  snap, real palette-reduced textures) rather than **applied as a post-process filter over an
  otherwise modern-fidelity render** — post-filters can't recover perspective-correct UVs, can't
  fake real color-depth loss, and typically mishandle transparency. [PS1/PSX PostProcessing —
  Godot Shaders](https://godotshaders.com/shader/ps1-psx-postprocessing/), [The Haunted PS1
  Aesthetic and Medium-Specific Noise](https://intermittentmechanism.blog/2022/10/31/the-haunted-ps1-aesthetic-and-medium-specific-noise/). Crow Country in particular is a good "not actually
  dreadful" data point within that scene — creative director Adam Vian notes its pre-rendered-FF7
  look happened partly by accident from heavily textured, heavily lit real-time environments with
  simple flat-colored characters on top; weather/lighting shift live to keep static rooms feeling
  alive. [GamesRadar – Crow Country](https://www.gamesradar.com/crow-country-an-atmospheric-survival-horror-set-in-1990-is-a-haunting-love-letter-to-ps1-era-games/).

**Concrete render recipe** (unchanged by the mood correction — this is pipeline, not palette):
render to a genuinely low-res offscreen target (320×240 or the codebase's existing `LOW_W = 384`
constant) and upscale nearest-neighbor; snap clip-space vertex positions to the low-res pixel grid
before the perspective divide (`snapped.xy = floor(grid * ndc.xy) / grid`, then re-multiply by
`w`) [David Colson – Building a PS1-style renderer](https://www.david-colson.com/2021/11/30/ps1-style-renderer.html); use real per-vertex
(Gouraud) lighting; cap texture resolution hard (32–128px) with genuine palette reduction, not just
downsampled 24-bit art; apply ordered (Bayer-matrix) dithering as a real quantization step on final
color output so gradient falloffs (sunset light, CRT glow) look like in-engine dithering, not
decorative noise; keep affine warping subtle and localized to large angled surfaces (floor, wall)
rather than uniform.

---

## 5. The room — golden-hour dev bedroom

Same diorama concept as before, but the light logic flips: **sunset flooding through the window is
now the key light**, warm and dominant; the **CRT glow anchors the room's cool complement** — the
brightest, most saturated point of the teal half of the palette (§5 palette section below), still
secondary in weight to the sunset but not an isolated garnish — the unlit background and shadowed
surfaces carry that same saturated teal, not a neutral or a warm-dark fallback. The room reads as
*lived-in and fun* — someone who loves this stuff spends their evenings here — not empty or lonely.

### Props list
- **CRT monitor** (beige/grey plastic) on the desk — the menu; catches warm sunset light on its
  bezel with a cool teal glow from its own screen.
- **Beige tower PC**, with **stickers on the case** (skate-brand-style sticker collage — the THPS
  personality touch) and one or two saturated LED status lights.
- **Mechanical/membrane keyboard + ball mouse**, cables draped off the desk edge.
- **CD spindle / stack of jewel cases**, saturated spine colors visible (Crash-orange, Spyro-purple,
  THPS-yellow-coded cases) — natural home for "projects."
- **Memory cards** on a tray next to the keyboard — the literal inspectable "projects" objects.
- **Skate deck** leaned in a corner or against the desk, graphic art visible on the underside —
  THPS/skate-culture anchor prop and a strong foreground-occluder candidate.
- **Band/skate posters and stickers** on the wall — skills go here; bold flat-color poster-style
  art (TM2-style graphic irreverence) rather than photographic or painted-realism posters.
- **Desk lamp**, warm bulb, now a minor accent light rather than the primary fill (sunset does that
  job).
- **Second play area**: tube TV on the floor/low stand, a console, controller with coiled cord,
  beanbag or floor cushion.
- **Bed**, rumpled, visible in the wide shot, poster wall behind it.
- **Window**, the star of the lighting rig: warm sunset flooding in, maybe a visible dust-mote light
  shaft through the beam, silhouetted rooftops/trees outside rather than a night/rain mood.
- **Small ephemera**: soda can, notebook, VHS tapes (THPS-style collectible echo), a Discman, a wall
  clock — cheap per-object clutter that sells "someone lives here," played for warmth, not dread.

### Layering / depth-selling instinct (from FF7's tile system, §4)
Three depth bands per camera angle: a **foreground occluder** close to the lens (the skate deck
edge, a draped hoodie, a shelf corner); a **midground** where interactive objects live (CRT,
memory cards, posters); a **background** that falls into the scene's saturated teal shadow (see
palette below) rather than fading to grey or fog — the background stays a *color*, just the cool
half of the room's complementary pair, not an absence of color.

### Camera angles (fixed diorama shots)
1. **Desk frontal (primary/menu shot).** Facing the CRT dead-on or 3/4, keyboard and memory cards
   in the near-midground, tower PC (with stickers) to one side. Foreground occluder: the leaned
   skate deck at frame-left. Light: sunset flood is the dominant warm wash across the desk from the
   window side; the CRT's own teal-cyan glow is a small, saturated cool pop on the opposite side of
   the frame — the scene's single point of color contrast, not a competing light source of equal
   weight.
2. **3/4 room-wide establishing shot** from a back corner, showing the desk zone and the floor-TV
   zone, bed and poster wall in frame, the window as the frame's brightest, warmest area with
   visible light shaft. This is the hero/title angle — dense and sun-washed, THPS-box-art energy.
3. **Floor-TV 3/4 angle**, lower camera height, tube TV as its own small glow (a second cool/green
   accent distinct from the CRT's teal, for variety), game boxes with saturated spines and the
   controller cord as foreground occluders.
4. **Detail insert** (optional 4th angle): a close pass on the memory-card tray or CD spindle for
   the "open project" state — warm sunset rim light plus a small CRT teal kicker, everything else
   falls off into the saturated teal shadow rather than to dead black.

Camera language: cut between fixed angles (RE-mechanics, THPS-energy — no smooth tracking). FOV
tight-ish (~50–55° vertical) to avoid a modern-fisheye read.

### Palette proposal (hex ramps) — punchy warm/teal complementary, era-correct saturation limits

The governing logic here is **teal-and-orange complementary grading**, not "avoid all cool colors."
Orange and teal sit opposite each other on the color wheel and have the **highest contrast in
exposure value of any complementary pair** — that contrast, not desaturation-avoidance, is what
reads as vibrant rather than muddy; the technique is specifically "designed to maximize contrast
rather than blend colors — the opposite of what creates muddiness." [Beverly Boy — What is the
Teal-Orange Look?](https://beverlyboy.com/filmmaking/what-is-teal-orange-look/), [PetaPixel — Why is
the Orange & Teal Look So Popular?](https://petapixel.com/2017/02/23/orange-teal-look-popular-hollywood/). So the earlier draft's instinct to keep shadows "warm-dark, never blue-black" was solving the
wrong problem — a *saturated* teal shadow reads as punchy blockbuster/skate-video energy, and a
*desaturated* blue-black shadow reads as horror. Saturation and contrast are the real dial, not hue.

Sunset key light (dominant, warm — the room's main light source, seen through the window):
| Role | Hex | Notes |
|---|---|---|
| Window brightest / sun core | `#ffb347` | warm saturated orange, not neon |
| Sunset mid-tone | `#ff8c42` | |
| Sunset deep edge | `#d94f30` | toward the window frame |
| Upper sky / pink transition | `#ff6f91` | Spyro-skybox-style gradient band, saturated pink-orange |
| Sky top / dusk violet | `#8a5a78` | where the gradient cools toward the top of the window pane |

Room surfaces catching direct warm light:
| Role | Hex | Notes |
|---|---|---|
| Lit wall/desk highlight | `#e8935a` | |
| Lit floor | `#c46f3f` | |

Shadow / ambient — **saturated teal, the orange's complement, not a desaturated neutral**:
| Role | Hex | Notes |
|---|---|---|
| Ambient shadow | `#1f3d42` | saturated teal-shadow, the orange's complementary partner |
| Deepest corners | `#12262b` | still saturated teal-black, never a flat/dead `#000` |

CRT accent (the shadow-family's brightest, most saturated point — ties key and shadow together):
| Role | Hex | Notes |
|---|---|---|
| Screen core glow | `#7de8e0` | bright cyan-teal, saturated |
| Screen glow falloff | `#2f6e6b` | |
| CRT/tower plastic (era beige) | `#cfc9b8` | warmer beige to sit inside the golden-hour cast |

Saturated toy-plastic accents (skate deck, stickers, game cases, posters — Crash/Spyro/TM2-vibrant,
never neon-max):
| Role | Hex | Notes |
|---|---|---|
| Red accent | `#e8453c` | deck/stickers |
| Yellow accent | `#f0b429` | game case, sticker |
| Teal/cyan accent | `#2fb6a8` | echoes the CRT and shadow family, ties the palette together |
| Grape/purple accent | `#8a4fae` | Spyro/TM2-chaos nod |
| Green accent | `#6fae4f` | Ape Escape toy green |

**Rules that keep this punchy without drifting synthwave or muddy-horror:** the scene runs on
**one complementary pair, pushed hard** — saturated sunset-orange key light against saturated
teal-shadow/CRT-accent, exactly the "teal and orange" contrast-maximizing grade, not a warm-only
palette with a single cool garnish. This is still structurally distinct from both failure modes:
synthwave is a **cool void** with neon accents and no orange key at all; muddy-horror is
**desaturated** in both the warm and cool direction at once (nothing fully commits). Here, both
ends of the pair are pushed toward maximum saturation — that's the tell. Per Spyro's own rule, hold
each camera angle to **2-3 base colors** (sunset-orange key + teal shadow/CRT + one small
toy-plastic accent) and keep the fill ratio warm-dominant (roughly 2/3 orange-lit surface to 1/3
teal-shadowed surface per frame) so the room still reads as sun-flooded rather than as a even
50/50 split, which would flatten the sense of a single strong light source.

---

## 6. Era UI/typography — THPS grunge energy blended with PSX BIOS chrome

Two visual languages, deliberately layered rather than picking one:

- **Structural/chrome layer (PSX BIOS + Gran Turismo).** Primary navigation and headers in a
  boxy, geometric, industrial sans — closest public analogue to the PS1 logotype is **Zrnic**
  (Typodermic Fonts). [PS1 font ≈ Zrnic](https://www.fontbolt.com/font/playstation-font/). Fixed-size UI blocks in a rigid grid (PS1 had no
  sprite scaling — snap layout changes, don't smoothly tween size). [GT2 sprite-scaling
  limitation](https://tcrf.net/Proto:Gran_Turismo_(PlayStation)/Test_Drive_Disc/Menu_Differences). Panel fills use dithered gradients (Bayer-pattern
  background, not a clean CSS `linear-gradient`) plus GT-style **metallic gradient sweeps** for
  panel chrome specifically. Memory-card manager convention — grey-blocked background, small
  square icon slots — is the direct template for the projects grid: uniform tiles, one icon + short
  ALL-CAPS letter-spaced label each. [AVID – PlayStation Startup Screen](https://www.avid.wiki/PlayStation_(console)/Startup_Screen).
- **Personality/grunge layer (THPS + skate deck culture).** Secondary labels, callouts, and
  "sticker" accents use a rougher register: stencil or hand-marker type, halftone/print-grain
  texture, torn-sticker or masking-tape edges, spray-paint-adjacent texture fills — the visual
  language of Powell Peralta/Santa Cruz-era deck graphics and skate zines: bold hand-drawn line
  art, saturated flat color fields, DIY collage. [Skateboard sticker history/culture](https://www.skateboardstickers.com/blogs/skateboard-stickers-about-history-culture/100-expert-answers-to-the-most-asked-questions-about-skateboard-stickers). Use this
  layer for things that want personality — a "NEW" sticker on a project card, a taped-on label, a
  scrawled annotation — not for primary structural chrome.
- **"Sticker chips" as a concrete UI pattern.** Small rounded/torn-edge badges — status tags,
  category labels, "new" flags — rendered as if they were physical stickers stuck to a card rather
  than flat CSS pills: a slight rotation off-grid, a drop shadow implying a peeled edge, saturated
  flat color fills matching the deck/sticker accent palette (§5). This is the single most
  legible way to inject THPS-grunge energy into small UI without touching the structural grid.
- **The blend, concretely:** the memory-card grid itself stays boxy BIOS-chrome (structure), but
  each card can carry a sticker-chip accent (a torn-tape corner, a hand-stamped label) the way a
  real 1999 CD case would have a price sticker or a hand-labeled mix-tape strip on it. The VHS-tape
  collectible motif from THPS is a legitimate literal object here too — a tape with a hand-written
  label is both period-correct and instantly reads as "personal, not corporate." A **Polaroid-frame
  treatment** (square image, thick white border, faint rotation) is a good template for project
  thumbnails specifically — cheap, physical, hand-placed documentation in the same spirit as 90s
  skate-zine photography (§3).
- **Boot/loading motif** (kept from PSX BIOS, tone-neutral): the assembling 3D diamond-logo-over-
  black is still a legitimate transitional loading-state animation for page transitions — used
  sparingly, not as the room's ambient background. [GameSpot – the PS1 boot logo was actually 3D](https://www.gamespot.com/articles/yes-the-ps1-boot-logo-was-actually-3d-this-whole-time/1100-6493544/).

---

## Ranked: what makes it read PS1 (do these, in priority order)

1. **A saturated teal/orange complementary pair, pushed hard, warm-dominant** (sunset orange key
   vs. teal shadow/CRT accent, ~2:1 in favor of orange) — never a cool neon void, never a
   double-desaturated muddy-horror palette where neither pole commits.
2. **Saturated "toy-plastic" accent colors on props** (deck, stickers, game cases) layered on top of
   that teal/orange base — the Crash/Spyro instinct.
3. **A dense, cluttered, lived-in room** — energetic clutter (posters, stickers, VHS tapes, game
   boxes), not empty geometric space and not dread-clutter. Density reads "someone's here and
   loves this," emptiness reads "tech demo," fog-heavy dimness reads "someone left."
4. **Low-res textures/vertex-colored props carrying detail the ~250–750-tri geometry can't** —
   Crash's vertex-color + modulate-2x trick is the concrete technique.
5. **Pipeline-level constraints baked into the renderer** (vertex snap, real dither quantization,
   capped texture res) — not a post-process filter over a modern-fidelity render. This is what
   separates "genuine" from "cheap filter" regardless of which mood register you're in.
6. **Fixed camera cuts with foreground occluders and depth-band layering**, RE/FF7-style
   mechanics — but framed for energy (a skate deck breaking the frame) rather than horror staging.
7. **Era UI chrome blended with skate-culture grunge**: boxy geometric caps type + rigid grid
   structure (BIOS/GT) carrying sticker/tape/stencil personality accents (THPS/deck culture).

**Two traps to avoid, not one:**

1. **Synthwave** — treating "PS1" as a shader bolted onto an empty scene: a *cool, empty void* with
   neon accents, clean gradients, floating wireframe primitives (the current build's exact
   failure). No grain, no texture, no technical fingerprint at all — and critically, no warm key
   light at all, so it can never read as sunset.
2. **Muted PS1-horror** — overcorrecting into Silent Hill/Signalis dread: **both** poles
   desaturated at once (washed-out warm *and* washed-out cool), fog-heavy, nothing pushed to full
   saturation, shadow going flat/dead rather than staying a vivid color. This has the right
   technical fingerprint but the wrong mood for a bedroom someone loves being in — it's the trap
   this research itself fell into on the first pass. The fix isn't "make shadows warm instead of
   cool," it's "make both the key and the shadow color fully saturated" — a proper teal/orange pair,
   not a monochrome warm wash.

The target sits between them: **PS1's real technical fingerprint (dither, jitter, warp, low-res
texture, vertex light) applied to a fully-saturated teal/orange complementary room, warm-dominant
and cluttered and joyful** — Crash's box art and a skate deck at golden hour, not a cool empty void
and not a desaturated foggy hallway.

---

## Sources

- [Aesthetics Wiki – Synthwave](https://aesthetics.fandom.com/wiki/Synthwave)
- [Medium – Outrun: The Aesthetic Deconstructed](https://medium.com/@cywjoel/outrun-the-aesthetic-deconstructed-dbd3cd8679b7)
- [cosmicosmo.co – Fixed-Point Math and Why Your Childhood Looked Unstable](https://cosmicosmo.co/blog/ps1-graphics)
- [NeoGAF – Why do PS1 polys jitter when the camera pans?](https://www.neogaf.com/threads/why-do-playstation-1-polys-jitter-when-the-camera-pans.879050/page-2)
- [Polycount – Retro 3D Art FAQ (PS1/N64/Dreamcast)](https://polycount.com/discussion/226167/retro-3d-art-faq-everything-you-need-to-know-to-create-ps1-n64-dreamcast-etc-3d-art)
- [chrismcovell.com – PlayStation 1 Dithering Removal](https://www.chrismcovell.com/psxdither.html)
- [Emulation General Wiki – Dithering](https://emulation.gametechwiki.com/index.php/Dithering)
- [SUPERJUMP – Through Mist, Light, and Darkness (Silent Hill)](https://www.superjumpmagazine.com/drafting-through-the-mists/)
- [Steam Community – Signalis dev discussion on dithering/texture choices](https://steamcommunity.com/app/1262350/discussions/0/4034727291137394217/)
- [Wikipedia – Tony Hawk's Pro Skater](https://en.wikipedia.org/wiki/Tony_Hawk's_Pro_Skater)
- [Push Square – THPS 1+2 School level lighting/goals](https://www.pushsquare.com/guides/tony-hawks-pro-skater-1-plus-2-school-all-park-goals-gaps-and-challenges)
- [Tony Hawk's Games Wiki – Downhill Jam level lighting](https://tonyhawkgames.fandom.com/wiki/Downhill_Jam)
- [GOAT – Decoding the Visual Language of the 90s and Early 2000s](https://www.goat.com/editorial/skateboarding-graphics-videos)
- [Jenkem Magazine – A Scholarly Look at Zine Culture's Impact on Skateboarding](https://www.jenkemmag.com/home/2024/06/27/a-scholarly-look-at-zine-cultures-impact-on-skateboarding/)
- [skateboardstickers.com – Skateboard sticker history and culture](https://www.skateboardstickers.com/blogs/skateboard-stickers-about-history-culture/100-expert-answers-to-the-most-asked-questions-about-skateboard-stickers)
- [Beverly Boy Productions – What is the Teal-Orange Look?](https://beverlyboy.com/filmmaking/what-is-teal-orange-look/)
- [PetaPixel – What is the 'Orange & Teal Look' and Why is it So Popular?](https://petapixel.com/2017/02/23/orange-teal-look-popular-hollywood/)
- [Tumblr/harmlessplant – Crash Bandicoot vertex coloring + modulate 2x blend](https://www.tumblr.com/harmlessplant/708700835633397760/in-the-original-ps1-crash-bandicoot-games-models)
- [ResetEra – Twisted Metal 2 LTTP review](https://www.resetera.com/threads/lttp-twisted-metal-2-is-a-massive-refinement-on-the-original-but-still-a-bit-rough-in-2025.1279950/)
- [Twisted Metal Fandom – Los Angeles arena](https://twistedmetal.fandom.com/wiki/Los_Angeles)
- [DeviantArt – Sweet Tooth character design commentary](https://www.deviantart.com/blok--head/art/Sweet-Tooth-Twisted-Metal-Classic-Doodle-1139356873)
- [Game Developer – Lessons in Color Theory for Spyro the Dragon](https://www.gamedeveloper.com/art/lessons-in-color-theory-for-i-spyro-the-dragon-i-)
- [danielilett.com – Spyro skybox vertex-color technique](https://danielilett.com/2019-12-11-tut4-1-spyro-skyboxes/)
- [Time Extension – The Making of Ape Escape](https://www.timeextension.com/features/best-of-2025-the-making-of-ape-escape-sonys-groundbreaking-platformer-that-unlocked-the-dualshocks-potential)
- [Polycount – MGS1 case study](https://polycount.com/discussion/139243/mgs1-case-study-calling-all-you-lowpoly-fiends)
- [jmeiners.com – An Adventure in Pre-Rendered Backgrounds](https://www.jmeiners.com/pre-rendered-backgrounds/)
- [Sevastromo – The Cinematography of Resident Evil](https://www.sevastromo.com/the-cinematography-of-resident-evil/)
- [Gran Turismo Fandom – Menu Styles](https://gran-turismo.fandom.com/wiki/Menu_Styles)
- [The Cutting Room Floor – Gran Turismo Test Drive Disc Menu Differences](https://tcrf.net/Proto:Gran_Turismo_(PlayStation)/Test_Drive_Disc/Menu_Differences)
- [AVID Wiki – PlayStation Startup Screen](https://www.avid.wiki/PlayStation_(console)/Startup_Screen)
- [GameSpot – Yes, The PS1 Boot Logo Was Actually 3D](https://www.gamespot.com/articles/yes-the-ps1-boot-logo-was-actually-3d-this-whole-time/1100-6493544/)
- [Wikipedia – LSD: Dream Emulator](https://en.wikipedia.org/wiki/LSD:_Dream_Emulator)
- [godotshaders.com – PS1/PSX PostProcessing](https://godotshaders.com/shader/ps1-psx-postprocessing/)
- [Intermittent Mechanism – The Haunted PS1 Aesthetic and Medium-Specific Noise](https://intermittentmechanism.blog/2022/10/31/the-haunted-ps1-aesthetic-and-medium-specific-noise/)
- [GamesRadar – Crow Country](https://www.gamesradar.com/crow-country-an-atmospheric-survival-horror-set-in-1990-is-a-haunting-love-letter-to-ps1-era-games/)
- [David Colson – Building a PS1 style retro 3D renderer](https://www.david-colson.com/2021/11/30/ps1-style-renderer.html)
- [FontBolt – PlayStation Font Generator (≈ Zrnic)](https://www.fontbolt.com/font/playstation-font/)
