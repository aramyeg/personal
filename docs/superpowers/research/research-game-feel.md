# What Makes Slide/Flow Snowboard Games Genuinely Fun

Research brief for redesigning a browser snowboard game that currently plays lifeless.
Focus games: Alto's Adventure/Odyssey, Tiny Wings, Ski Safari, SSX (Tricky), Journey. Plus the "game feel / juice" literature (Swink; Jonasson & Purho).

The short version: these games are fun **before** you add content, because the *act of moving* is rewarding on a sub-100ms loop, momentum is a currency the player spends and earns, and every action is over-reported with cheap sensory feedback. Terrain, tricks, and scoring are scaffolding hung on that core. A lifeless snowboard game almost always has a dead *core loop* (movement gives no feedback, momentum isn't a felt resource, landings aren't rewarded) — not a content problem.

---

## Part 1 — Principles, ranked by impact

### 1. Momentum must be a felt, spendable currency (the #1 thing)
Every one of these games is really a **momentum game wearing a snowboard costume**.
- **Tiny Wings** is the purest example: you hold to dive down the *backside* of a hill to build speed, release at the trough so momentum slingshots you up and off the crest into the air. Hit the dips well and you fly far; mistime them and you crawl. Three perfect dips in a row triggers a visible sparkle boost. The entire game is "convert slope shape into speed." ([macworld](https://www.macworld.com/article/212903/tiny_wings.html), [gamedev.net](https://www.gamedev.net/forums/topic/632589-game-design-tiny-wings-jetpack-joyride/))
- **Ski Safari**: "the cleaner you land, the faster you go, and the faster you go, the more space you put between you and your impending snowy doom." Speed is survival. ([photics](https://photics.com/ski-safari-ios-review-and-hints/), [unwinnable](https://unwinnable.com/2012/05/01/pocket-treasures-ski-safari/))
- **Alto**: doing tricks builds a combo meter that *literally makes you move faster* and grants a temporary force-field that smashes through rocks. Speed is the reward for skill. ([imore Odyssey tips](https://www.imore.com/altos-odyssey-tips-and-tricks-help-you-escape-lemurs-ride-walls-over-chasms-and-more))
- **Journey**: movement speed is directly tied to slope and surface friction — downhill sand feels effortless and fast, uphill feels like work. The player *feels* the terrain through their speed. ([mechanicsofmagic](https://mechanicsofmagic.com/2021/04/25/flow-in-journey/), [journey wiki](https://journey.fandom.com/wiki/Surfing,_Slides_and_Drops))

**Design implication:** the player must be able to *build* speed (pumping/tucking down slopes), *lose* it (bad landings, flat ground, uphill), and *spend* it (jumps, tricks). If speed is constant or scripted, the game is dead. Gaining speed by playing a slope well should be the primary intrinsic reward — before any score number.

### 2. Terrain rhythm creates flow (rolling hills, not obstacles)
The slope is an instrument, not a hazard course.
- Alto uses Perlin-noise + spline curves to make smooth, rolling, *natural* terrain — continuous hills that invite jumps, not spiky obstacles that punish. ([bitshiftprogrammer](https://www.bitshiftprogrammer.com/game-dev/altos-adventure-style-procedural), [grokipedia: Alto](https://grokipedia.com/page/Alto's_Adventure))
- Tiny Wings' hills are hand-tuned so their crests and troughs form a *pumpable rhythm*; the levels are fixed, and "a lot of the gameplay is about learning the levels and finding the flow." ([medium: Tiny Wings](https://medium.com/@ericlbarnes/tiny-wings-7beba0f554de))
- Csikszentmihalyi-style flow (Jenova Chen's design north star in Journey) comes from a smooth, readable difficulty ramp matched to skill, with continuous feedback and perceived control. ([mechanicsofmagic](https://mechanicsofmagic.com/2021/04/25/flow-in-journey/), [fastcompany: Chen](https://www.fastcompany.com/1680062/game-designer-jenova-chen-on-the-art-behind-his-journey))

**Design implication:** author terrain as a wave with a *tempo* — gentle build-up hills, launch crests, soft landing troughs — so a skilled player can find a groove of jump → land → pump → jump. Smooth splines beat jagged obstacles.

### 3. Responsiveness first: the control loop must close under 100ms
Swink defines game feel as real-time control (a "correction cycle" — read feedback, decide, act, get new feedback — of **under 100ms**) over a simulated space, wrapped in polish. Sluggish input reads as "lifeless" no matter how pretty the art. ([gamedeveloper: Principles of Virtual Sensation](https://www.gamedeveloper.com/design/principles-of-virtual-sensation), [wikipedia: Game feel](https://en.wikipedia.org/wiki/Game_feel))
Swink's other key insight: simple button inputs should trigger **longer, fluid states with overlap** ("state overlaps") — that's what produces the sensation of momentum rather than twitchy on/off control. ([bookey summary](https://www.bookey.app/book/game-feel))

**Design implication:** input must register on the same frame; the *character's response* can be smooth and weighty (eased rotation, carve lean, momentum), but the acknowledgment of input cannot lag. A jump press should never be dropped (see forgiveness below).

### 4. One-button depth: easy to learn, hard to master
Alto's whole control scheme is a single button whose meaning is contextual: tap on ground = jump, hold in air = backflip, land the flip well = speed boost. That's "easy to learn, difficult to master," explicitly modelled on Ski Safari/Tiny Wings for simplicity and on **Tony Hawk's Pro Skater for the combo/chaining feeling**. ([builtbysnowman press](https://www.builtbysnowman.com/press/sheet.php?p=altos_adventure), [noodlecake](https://noodlecake.com/games/altos-adventure/))
Ski Safari packs "nearly unprecedented" interaction into one press: jump, flip, tweak fall angle for better landings, or nail a re-entry rocket boost. ([unwinnable](https://unwinnable.com/2012/05/01/pocket-treasures-ski-safari/))

**Design implication:** a keyboard game can keep this: one primary action (Space/Up = jump/hold-to-flip) does 90% of the game. Depth comes from *timing and context*, not from more buttons.

### 5. Tricks are momentum bets: risk/reward, chained, with a proximity dial
Tricks aren't decoration — they're how you gamble speed for more speed.
- **Alto/Odyssey**: chain backflips, wall-grinds, balloon-bounces, rock-jumps *without touching the ground* to build a multiplier; each trick adds to the multiplier so a 5-trick chain scores ~5x. ([imore Odyssey](https://www.imore.com/altos-odyssey-tips-and-tricks-help-you-escape-lemurs-ride-walls-over-chasms-and-more))
- **The proximity dial (huge):** backflips *close to the ground* score more and give a better speed boost — but risk a crash. You can keep holding for double/triple/quad flips, but you must have the height/time. This is a continuous risk/reward knob the player controls every jump. ([imore Adventure](https://www.imore.com/altos-adventure-tips-tricks-and-pointers-get-you-past-triple-backflip-and-more))
- **SSX Tricky**: land Uber-tricks to fill the adrenaline bar and spell "TRICKY"; completing it grants unlimited boost. Tricks feed speed, speed enables bigger tricks — a self-reinforcing loop with escalating spectacle. ([wikipedia: SSX Tricky](https://en.wikipedia.org/wiki/SSX_Tricky), [gamespot review](https://www.gamespot.com/reviews/ssx-tricky-review/1900-2823422/microsoft-xbox/))
- Provide **safe vs risky lines**: Alto's grinds pay steady points-per-meter (safe), while low late backflips pay big (risky). ([imore Odyssey](https://www.imore.com/altos-odyssey-tips-and-tricks-help-you-escape-lemurs-ride-walls-over-chasms-and-more))

**Design implication:** the landing is the moment of truth. Tricks must be (a) discoverable (one hold), (b) readable mid-air (rotation animation + a landing-safety cue), (c) rewarded on clean landing with *speed*, and (d) chainable for a multiplier. Reward landing *closer to the ground / later* to give the player a risk dial.

### 6. Juice: over-report every action with cheap feedback
Jonasson & Purho's thesis ("Juice it or lose it") and the broader literature converge on: **"a game with mediocre mechanics and great juice will often outperform a game with great mechanics and no juice."** Juice = the small, layered, reactive effects that make actions feel alive. ([gamejuice: Juice it or lose it](https://gamejuice.co.uk/resources/juice-it-or-lose-it), [hackread: juice factor](https://hackread.com/the-juice-factor-designing-game-feel/), [abagames](https://abagames.github.io/joys-of-small-game-development-en/make_game_juicy.html))
This is the single cheapest, highest-leverage fix for a "lifeless" game. Details in Part 2.

### 7. Forgiveness: interpret intent, not raw input
The best-feeling platformers (Celeste, Super Meat Boy) are built on invisible grace windows.
- **Coyote time**: still accept a jump for ~5–8 frames (~80–130ms) *after* leaving an edge/crest. Celeste uses ~5 frames. ([gamejuice: coyote time](https://www.gamejuice.co.uk/articles/coyote-time-input-buffering), [ketra-games](https://www.ketra-games.com/2021/08/coyote-time-and-jump-buffering.html))
- **Input buffering**: if the player presses jump ~6–9 frames (~0.1s) *before* landing, fire it on landing. ([gamejuice](https://www.gamejuice.co.uk/articles/coyote-time-input-buffering), [hackread](https://hackread.com/the-juice-factor-designing-game-feel/))
- **Landing assist / auto-snap**: snap near-complete rotations to a clean landing (Ski Safari lets you "tweak" fall angle to line up landings and even earn a re-entry boost). ([unwinnable](https://unwinnable.com/2012/05/01/pocket-treasures-ski-safari/))
- Principle: "the game should interpret player intent, not just player input" — a *buffered* jump rewards intent; an *auto*-jump invents it, and players can feel the difference. ([gamejuice](https://www.gamejuice.co.uk/articles/coyote-time-input-buffering))

**Design implication:** these are invisible and turn "the game dropped my input / that crash felt unfair" into "smooth." Non-negotiable for a good-feeling jump.

### 8. Camera as a speed instrument
- Alto's camera **pulls out as you speed up** — so you see more of what's ahead (readability) *and* the widening view + faster-scrolling foreground sells speed. Important elements glow / hold a distinct silhouette so they stay legible at night. ([grokipedia: Alto](https://grokipedia.com/page/Alto's_Adventure))
- Racing-game wisdom: sense of speed is mostly **FOV/zoom + near-field motion**. Looser/wider view and objects that whip past close to camera read as fast; near objects appear to move faster than far ones (parallax). Camera shake and slight "tunnel" at top speed add to it. ([lfs forum: FOV](https://www.lfs.net/forum/thread/27179-FOV---Sense-of-Speed), [overtake](https://www.overtake.gg/threads/no-sense-of-speed.52958/))

**Design implication:** don't lock the camera. Zoom out with speed, lead the camera in the direction of travel, add fast-moving foreground parallax and speed lines at high velocity. This alone can transform a "lifeless" feel.

### 9. Session shape: escalation, near-misses, and the "one more run" pull
- **Difficulty via environment, not rules:** Alto ramps difficulty through the day/night cycle and weather (fog/snow reduce visibility) — "no mechanical change to what the player must do; instead they're affected in a very natural way by the environment." Elegant, non-punishing escalation. ([gamedeveloper: Let's Talk About Alto's Adventure](https://www.gamedeveloper.com/design/let-s-talk-about-alto-s-adventure))
- **Near-miss = reward:** Cambridge research finds near-misses activate much of the same reward circuitry as actual wins and *increase* the desire to keep playing — strongest when the player feels in control. Design runs so the player is constantly *almost* nailing a bigger combo. ([alphai](https://alphai.io/news/article/06-12/babcf38151a690d4/the-psychology-of-one-more-run-why-players-cant-quit-extraction-and-survival-games), [arxiv: near-miss](https://arxiv.org/pdf/1108.4843))
- **Bank-vs-risk loop + loss aversion:** the "one more run" compulsion comes from perceived control ("that was my mistake, I can fix it") plus a combo you didn't want to lose. ([thexboxhub](https://www.thexboxhub.com/the-psychology-of-one-more-run-why-players-cant-quit-extraction-and-survival-games/))

**Design implication:** a 90s run should *escalate* — gently speed up, thicken terrain rhythm, layer in weather/light shifts — and end on a natural crescendo, with the score/combo clearly "so close" to the next tier.

### 10. Aesthetic cohesion & audio-visual rhythm
Journey's team obsessed over the *quality* of a single material: how sand sparkles in different light, that it behaves "almost like a liquid," that you leave trails. That tactile, reactive surface is a huge part of why sliding feels good. ([pushsquare interview](https://www.pushsquare.com/news/2012/02/interview_thatgamecompany_journey), [alanzucconi: sand shader](https://www.alanzucconi.com/2019/10/08/journey-sand-shader-1/)) Alto keeps a tight palette and silhouette-legible art so the whole thing reads as one calm, cohesive world. Even without sound, a *visual* rhythm (pulsing trails, particle bursts on the beat of a landing) carries the flow.

---

## Part 2 — Concrete technique inventory
Each: **what** it is, **why** it works, **effort** (S = hours, M = a day-ish, L = multi-day) for a JS/Canvas browser game.

### Core movement & physics
| Technique | What / Why | Effort |
|---|---|---|
| **Slope-follow + gravity momentum** | Board hugs terrain; velocity gains going downhill, bleeds uphill/on flats. This is the whole game's soul — speed becomes a felt resource. | **M** |
| **Pump / tuck to build speed** | Hold-down (or auto on descent) increases acceleration down a slope's backside; release at the trough to launch. Tiny Wings' core; gives the player agency over momentum. | **M** |
| **Launch off crests** | When terrain angle drops away under the board at speed, auto-launch into air proportional to speed. Turns terrain rhythm into airtime. | **S–M** |
| **Landing quality → speed** | Landing with board angle aligned to slope = speed boost + clean effect; mismatched angle = speed loss / stumble; too steep = crash. Makes every landing a skill check with a payoff. | **M** |
| **Air control rotation** | Hold to rotate (backflip); rotation speed tuned so 1 flip needs a normal jump, 2–3 need a big launch. Readable, weighty, eased. | **S–M** |

### Feel & forgiveness (invisible, high ROI)
| Technique | What / Why | Effort |
|---|---|---|
| **Sub-100ms input** | Register on the same frame; never gate input behind an animation. Baseline for not feeling dead. | **S** |
| **Coyote time (~5–8 frames / ~100ms)** | Accept jump just after leaving a crest/edge. Kills "the game ate my jump." | **S** |
| **Input buffering (~0.1s)** | Queue a jump pressed just before landing; fire on contact. Enables fast rhythmic jumping. | **S** |
| **Landing / rotation snap-assist** | If rotation is within ~15–20° of a clean landing at touchdown, snap to clean and count it. Ski-Safari-style "tweak your landing." Converts near-misses into wins. | **S–M** |
| **Speed floor after clean landing** | Guarantee a small boost on clean land so skilled play always feels rewarded. | **S** |

### Juice — visual (the "lifeless → alive" bucket)
| Technique | What / Why | Effort |
|---|---|---|
| **Snow spray particles on carve/land** | Burst of particles kicked up on landing and continuous spray while carving. The #1 signal that the board is *touching a surface*. Cheap, transformative. | **S** |
| **Trail ribbon** | A fading ribbon/line behind the board (Journey's sand trails). Draws the arc of your momentum; makes speed visible. | **S** |
| **Squash & stretch** | On landing, squash the board/rider (scaleY down, scaleX up), rebound on launch — animate scaleX/scaleY in *opposition* so area is conserved = reads as weight/energy. | **S** |
| **Screen shake (scaled)** | Tiny shake on hard landing / big-trick land / crash, magnitude scaled to impact. "Nothing says impact like a quick shake." Keep it *small*. | **S** |
| **Hit-stop / freeze (3–5 frames, 0.05–0.2s)** | On a big trick landing or crash, freeze the affected object for a few frames then resume. Sells the impact ("cutting through bone, not air"). Use sparingly for peaks. | **S** |
| **Speed lines / motion streaks** | Fine streaks at the screen edges that intensify above a speed threshold. Reads instantly as "fast." | **S** |
| **Camera zoom-out with speed** | Widen view as velocity rises (Alto). Both readability and speed sensation. | **S–M** |
| **Camera lead + slight air-hang** | Lead the camera toward travel direction; on a big launch, ease the camera to follow the arc, briefly hanging at apex. Makes airtime feel airborne. | **M** |
| **Flash / color pop on reward** | Brief white/color flash + scale-pop on the combo counter when a trick lands or a tier is hit. | **S** |
| **Combo escalation FX** | Bigger particle bursts, brighter trail, subtle time-slow at high multipliers (SSX "Tricky" energy). Escalating spectacle = escalating reward. | **M** |
| **Reactive surface** | Slight terrain deform / darker carve line where the board passed; sparkle highlights (Journey sand). Tactile, reactive world. | **M–L** |

### Juice — audio (works even minimal)
| Technique | What / Why | Effort |
|---|---|---|
| **Layered carve/land SFX** | Continuous carve whoosh (pitch/volume scaled to speed) + a satisfying "thunk/whump" on land. Speed you can *hear*. | **S–M** |
| **Rising pitch with combo** | Each chained trick pings a note a step higher (Ski Safari / arcade combo feel). Turns a chain into a melody. | **S** |
| **Wind rush at speed** | Low wind layer that swells with velocity. Reinforces the speed sensation. | **S** |
| *(If muted-by-default in a portfolio embed, all the above must be duplicated visually — see the "sound-free rhythm" note.)* | | |

### Scoring / risk-reward
| Technique | What / Why | Effort |
|---|---|---|
| **Chain multiplier** | Tricks/grinds while airborne/not-grounded stack a multiplier; touching ground banks it. The core "one more run" hook. | **M** |
| **Proximity/lateness bonus** | More points + bigger boost for flips landed *late / close to ground*. A continuous risk dial the player owns. | **S–M** |
| **Safe vs risky lines** | Grinds = steady points-per-meter (safe); low late tricks = big/risky. Player chooses their appetite. | **M** |
| **Near-miss detection** | Detect "almost hit / almost bigger combo" and reward it visually (spark, slow-mo). Near-misses drive replay. | **M** |

---

## Part 3 — Top 10 changes that would most increase fun for a ~90s skill-showcase snowboard run

Ranked by fun-per-effort. The first three fix "lifeless"; the rest add depth and the "one more run" pull.

1. **Make momentum real and spendable.** Board gains speed down slopes, loses it uphill/flat; let the player pump/tuck down a slope's backside to build speed and launch off crests. Without this, nothing else matters. *(M)*
2. **Juice the ground contact.** Snow-spray particles on carve + a burst on landing, a fading trail ribbon, and squash-&-stretch on land/launch. This is the biggest visible "dead → alive" jump for the least code. *(S)*
3. **Close the input loop + forgive it.** Same-frame input, coyote time (~100ms), input buffering (~0.1s), and rotation snap-assist on landing. Turns "unfair/floaty" into "tight." *(S)*
4. **Reward the landing with speed.** Clean, aligned landings give a speed boost + clean-land pop; sloppy ones bleed speed. Make the landing the skill moment. *(M)*
5. **Camera as a speed instrument.** Zoom out with speed, lead toward travel, add edge speed-lines above a threshold, tiny shake on hard landings. Instantly sells velocity. *(S–M)*
6. **One-button trick with a risk dial.** Hold-to-backflip; reward flips landed *later/closer to the ground* with more points + bigger boost. Depth from timing, not extra keys. *(S–M)*
7. **Chain multiplier + rising audio pings.** Tricks/grinds stack a multiplier that banks on landing, each chained trick pinging a higher note. The compulsive core. *(M)*
8. **Author terrain as a pumpable rhythm.** Smooth spline/Perlin hills with a build-jump-land tempo (not spiky obstacles) so a skilled player finds a groove. *(M)*
9. **Escalate the 90s arc via environment.** Gently ramp speed and shift light/weather across the run (Alto-style), ending on a crescendo — difficulty from atmosphere, not punishment. *(M)*
10. **Peak-moment juice: hit-stop + combo escalation.** On big-trick landings/crashes, a 3–5 frame freeze + small screen shake; at high multipliers, brighter trail, bigger bursts, a whisper of slow-mo. Reserve for peaks so they stay special. *(S–M)*

---

## What translates to a keyboard/touch browser portfolio game — and what doesn't

**Translates well (do these):**
- One-button/one-key control with contextual meaning (Space = jump / hold = flip). Keyboard and touch both map cleanly. *(Alto, Ski Safari, Tiny Wings model.)*
- Momentum physics, slope-pumping, landing-quality → speed. Pure math, framework-agnostic.
- All forgiveness mechanics (coyote/buffer/snap) — cheap, invisible, huge.
- The entire visual-juice inventory — particles, trails, squash/stretch, shake, hit-stop, speed lines, camera zoom — is standard Canvas/WebGL and cheap.
- Camera-as-speed-instrument and terrain-rhythm authoring.
- Chain-multiplier scoring + near-miss rewards + environmental escalation.

**Translates with care:**
- **Audio**: a portfolio embed is often muted or autoplay-blocked. Assume no sound and make every audio beat *also* a visual beat (flash, particle burst, combo pop on landing). Journey/Tiny Wings lean on audio; you may not be able to.
- **SSX's deep multi-button trick vocabulary and rivalries**: too much for a 90s embed. Steal only the *escalation loop* (tricks → boost → bigger tricks) and the spelling-out-a-word crescendo idea, not the button complexity.
- **Long-session / meta-progression** (unlocks, currencies, biomes): a portfolio piece wants an immediate, self-contained ~90s loop. Bake escalation *into the single run* rather than across sessions.

**Doesn't translate (skip):**
- Heavy simulation/shaders (Journey's liquid-sand shader, full fluid sim) — overkill for the goal; fake the reactive-surface feel with a carve line + sparkle particles.
- Emotional/multiplayer/exploration pillars (Journey's companions, Sky's social flight) — irrelevant to a fast skill-showcase slide.
- Precision-platformer punishment (Super Meat Boy death loops) — borrow their *forgiveness tech*, not their difficulty.

---

## Sources
- Alto's Adventure/Odyssey — [builtbysnowman press sheet](https://www.builtbysnowman.com/press/sheet.php?p=altos_adventure), [Noodlecake](https://noodlecake.com/games/altos-adventure/), [Harry Nesbitt: The Making of Alto's Adventure](http://www.harrynesbitt.com/blog/the-making-of-altos-adventure/), [Grokipedia: Alto's Adventure](https://grokipedia.com/page/Alto's_Adventure), [Wikipedia: Alto's Adventure](https://en.wikipedia.org/wiki/Alto's_Adventure), [bitshiftprogrammer: procedural surface](https://www.bitshiftprogrammer.com/game-dev/altos-adventure-style-procedural), [GameDeveloper: Let's Talk About Alto's Adventure](https://www.gamedeveloper.com/design/let-s-talk-about-alto-s-adventure), [iMore: Odyssey tips](https://www.imore.com/altos-odyssey-tips-and-tricks-help-you-escape-lemurs-ride-walls-over-chasms-and-more), [iMore: Adventure tips](https://www.imore.com/altos-adventure-tips-tricks-and-pointers-get-you-past-triple-backflip-and-more)
- Tiny Wings — [Macworld](https://www.macworld.com/article/212903/tiny_wings.html), [Medium: Tiny Wings](https://medium.com/@ericlbarnes/tiny-wings-7beba0f554de), [GameDev.net: Tiny Wings + Jetpack Joyride](https://www.gamedev.net/forums/topic/632589-game-design-tiny-wings-jetpack-joyride/)
- Ski Safari — [Unwinnable: Pocket Treasures](https://unwinnable.com/2012/05/01/pocket-treasures-ski-safari/), [Photics review](https://photics.com/ski-safari-ios-review-and-hints/)
- SSX Tricky — [Wikipedia: SSX Tricky](https://en.wikipedia.org/wiki/SSX_Tricky), [GameSpot review](https://www.gamespot.com/reviews/ssx-tricky-review/1900-2823422/microsoft-xbox/), [SSX Wiki: Uber Tricks](https://ssx.fandom.com/wiki/List_of_Uber_Tricks_in_SSX_Tricky)
- Journey — [Fast Company: Jenova Chen](https://www.fastcompany.com/1680062/game-designer-jenova-chen-on-the-art-behind-his-journey), [Journey Wiki: Surfing, Slides and Drops](https://journey.fandom.com/wiki/Surfing,_Slides_and_Drops), [Flow in Journey](https://mechanicsofmagic.com/2021/04/25/flow-in-journey/), [Push Square interview](https://www.pushsquare.com/news/2012/02/interview_thatgamecompany_journey), [Alan Zucconi: Journey sand shader](https://www.alanzucconi.com/2019/10/08/journey-sand-shader-1/)
- Game Feel / Swink — [GameDeveloper: Principles of Virtual Sensation](https://www.gamedeveloper.com/design/principles-of-virtual-sensation), [Wikipedia: Game feel](https://en.wikipedia.org/wiki/Game_feel), [Bookey: Game Feel summary](https://www.bookey.app/book/game-feel), [Medium: Lessons from Steve Swink](https://medium.com/design-bootcamp/game-feel-and-player-control-lessons-from-steve-swink-beae0ea1987f)
- Juice / game feel techniques — [GameJuice: Juice it or Lose it](https://gamejuice.co.uk/resources/juice-it-or-lose-it), [abagames: Make Game Juicy](https://abagames.github.io/joys-of-small-game-development-en/make_game_juicy.html), [Hackread: The Juice Factor](https://hackread.com/the-juice-factor-designing-game-feel/), [GameAnalytics: Squeezing more juice](https://www.gameanalytics.com/blog/squeezing-more-juice-out-of-your-game-design)
- Forgiveness mechanics — [GameJuice: Coyote Time & Input Buffering](https://www.gamejuice.co.uk/articles/coyote-time-input-buffering), [Ketra Games: Coyote Time and Jump Buffering](https://www.ketra-games.com/2021/08/coyote-time-and-jump-buffering.html)
- Hit-stop / impact — [SmashWiki: Hitlag](https://www.ssbwiki.com/Hitlag), [Sonic Hurricane: Impact Freeze](https://sonichurricane.com/?p=1043)
- Sense of speed — [LFS Forum: FOV & Sense of Speed](https://www.lfs.net/forum/thread/27179-FOV---Sense-of-Speed), [OverTake: No sense of speed](https://www.overtake.gg/threads/no-sense-of-speed.52958/)
- Near-miss / "one more run" — [alphai: Psychology of One More Run](https://alphai.io/news/article/06-12/babcf38151a690d4/the-psychology-of-one-more-run-why-players-cant-quit-extraction-and-survival-games), [TheXboxHub: Psychology of One More Run](https://www.thexboxhub.com/the-psychology-of-one-more-run-why-players-cant-quit-extraction-and-survival-games/), [arXiv: Simplicity Effects in Near-Miss](https://arxiv.org/pdf/1108.4843)
