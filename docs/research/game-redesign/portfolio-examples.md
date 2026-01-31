# Interactive Portfolio Games & Resume Visualizations Research

> Research conducted January 2026 for portfolio game redesign

## Executive Summary

Interactive portfolio games have proven highly effective at capturing recruiter attention and demonstrating technical skills. The most successful examples share common traits: clear navigation, short completion times (under 2 minutes), and seamless integration of work history with interactive elements.

**Key Finding**: Recruiters spend an average of 55 seconds evaluating both resume and portfolio combined. Interactive portfolios that hook users in the first 10 seconds see significantly higher engagement.

---

## Top Interactive Portfolio Examples

### 1. Bruno Simon (bruno-simon.com)

**Type**: 3D Driving Game
**Tech Stack**: Three.js, WebGL, JavaScript
**Awards**: Awwwards Site of the Day (8.04/10), multiple web design awards

**What Makes It Work**:
- Users drive a small car through a 3D world to explore projects
- Intuitive controls (arrow keys/WASD)
- Physics-based interactions with objects
- Each "room" contains portfolio content
- Viral on Hacker News (front page December 2025)

**Metrics**:
- Estimated 1M+ visitors
- Creator of Three.js Journey course (700+ students)
- Industry standard reference for creative portfolios

**Lessons**:
- 3D experiences require significant development time
- Performance optimization is critical
- Mobile support is challenging with 3D

---

### 2. Robby Leonardi (rleonardi.com/interactive-resume/)

**Type**: 2D Side-Scrolling Platformer (Super Mario inspired)
**Tech Stack**: HTML5, CSS3, JavaScript
**Awards**: FWA, Awwwards, CSS Design Awards, CSS Winner

**What Makes It Work**:
- Horizontal scrolling through career sections
- Four "levels": Profile, Skills (swim), Experience (climb), Awards (float)
- Retro 8-bit aesthetic creates nostalgia
- Natural progression mirrors career journey
- Works on desktop and mobile

**Why It's Memorable**:
- Pioneered the "portfolio as game" concept
- Clear metaphor: career as a journey/adventure
- Users complete it to see all content (gamification psychology)

**Client Work**: Fox, FX Networks, myNetworkTV

---

### 3. JSLegendDev 2D Portfolio Template (GitHub)

**Type**: Top-Down 2D RPG (Zelda/Pokemon style)
**Tech Stack**: Kaboom.js, Vite, Vanilla JavaScript
**URL**: github.com/JSLegendDev/2d-portfolio-kaboom

**What Makes It Work**:
- Open-source template for developers
- Desktop and mobile compatible
- Dialogue system for project descriptions
- NPCs represent different portfolio sections
- FreeCodeCamp tutorial (1h 38min)

**Why Notable**:
- Lowered barrier to entry for portfolio games
- Active community and forks
- Educational resource for learning game dev

---

### 4. Scott Huebscher's Gamified Resume

**Type**: Playable Interactive Game
**Tech Stack**: JavaScript (migrated from Flash)
**URL**: cargocollective.com/shuebscher/My-Resume-Gamified

**What Makes It Work**:
- Originally Flash, rebuilt in JS after Flash deprecation
- Demonstrates adaptability and modern skills
- Works on both desktop and mobile

**Lesson**: Build with future-proof technologies

---

### 5. WoraWork (Worapat Supameteeworakul)

**Type**: 3D Walking Simulator
**Tech Stack**: Three.js, WebGL
**Style**: Zelda: A Link Between Worlds / Animal Crossing inspired

**What Makes It Work**:
- Cozy, approachable aesthetic
- Character-controlled exploration
- House and garden environment
- Low-stress exploration pace

**Lesson**: Friendly aesthetics lower user resistance to interaction

---

### 6. JReyes MC Minecraft Portfolio

**Type**: 3D Scroll-Driven Experience
**Tech Stack**: Three.js
**Awards**: Awwwards Honorable Mention

**What Makes It Work**:
- Minecraft aesthetic appeals to gaming audience
- Scroll-driven (no complex controls needed)
- House tour reveals portfolio sections

---

### 7. Sébastien Lempens

**Type**: 3D Scroll-Driven Paris Tour
**Tech Stack**: Three.js, WebGL

**What Makes It Work**:
- Scroll drives camera through 3D Paris
- First-person view on a scooter
- Includes skydiving sequence
- Cinematic storytelling

---

### 8. Terminal Portfolio Style

**Examples**:
- satnaing/terminal-portfolio (React, TypeScript, Styled-Components)
- navnee1h/terminal-portfolio (React, TypeScript)
- iamdhakrey/terminal-portfolio (Astro, MDX)

**What Makes It Work**:
- Appeals to developer/hacker aesthetic
- Commands: `about`, `projects`, `contact`, `help`
- Multiple theme support (dark, light, matrix, cyberpunk)
- Familiar interface for technical recruiters

**NPX Portfolio** (vishalrmahajan): Runs directly in terminal via `npx vishalrmahajan`

---

### 9. Jesse's Ramen Portfolio

**Type**: 3D Environment
**Tech Stack**: Three.js

**What Makes It Work**:
- Navigate around a 3D ramen hut
- Vending machine displays projects
- Television shows video projects
- Unique metaphor (nourishment/craft)

---

### 10. Brittany Chiang (brittanychiang.com)

**Type**: Traditional (Not Game-Based)
**Tech Stack**: React, TypeScript

**Why Included**:
- Industry standard for clean developer portfolios
- Dark theme with vibrant accent color
- Extensive project archive with GitHub links
- Clients: Harvard Business School, Vanderbilt, Pratt Institute

**Lesson**: Not all great portfolios need gamification

---

### 11. Josh Comeau (joshwcomeau.com)

**Type**: Interactive Blog/Portfolio
**Tech Stack**: React, MDX

**What Makes It Work**:
- Delightful microinteractions throughout
- Sound effects on hover (satisfying "pop")
- Interactive code examples in blog posts
- Playful retro aesthetic

**Lesson**: Interactivity doesn't require full game mechanics

---

### 12. Lynn Fisher (lynnandtonic.com)

**Type**: Responsive CSS Art
**Tech Stack**: Pure CSS, HTML

**What Makes It Work**:
- New design every year for 10+ years
- Responsive illustrations that change with browser width
- CSS Grid, blend modes, filters
- A Single Div project (CSS art from one element)

**Why Notable**:
- Featured on web.dev, Adobe Blog
- Demonstrates deep CSS mastery
- Projects: nestflix.fun, airportcod.es, hollywoodagegap.com

---

## Technologies Comparison

| Portfolio | Primary Tech | Complexity | Mobile Support | Load Time |
|-----------|-------------|------------|----------------|-----------|
| Bruno Simon | Three.js | Very High | Limited | Slow |
| Robby Leonardi | HTML5/CSS3/JS | Medium | Good | Fast |
| JSLegendDev | Kaboom.js | Medium | Good | Fast |
| Terminal Style | React/Astro | Low | Good | Very Fast |
| Brittany Chiang | React | Low | Excellent | Very Fast |
| Lynn Fisher | Pure CSS | Medium | Excellent | Very Fast |

### Recommended Tech Stack for Canvas Platformer

Based on your existing stack (Next.js 15, React 19, Canvas):

1. **Kaboom.js** - Easiest for 2D platformers, good docs
2. **Phaser 3** - More mature, better mobile support
3. **Raw Canvas** - Most control, no dependencies
4. **PixiJS** - High performance 2D rendering

---

## Engagement Metrics & Statistics

### Recruiter Behavior

| Metric | Time |
|--------|------|
| Average resume review | 6-7 seconds |
| Resume + portfolio evaluation | 55 seconds |
| Opinion formation | 90 seconds (33% of employers) |
| In-depth portfolio review | 2-3 minutes (hiring manager stage) |

**Key Insight**: The portfolio isn't for the recruiter—it's for the hiring manager. By the time you reach the hiring manager, they have 10-15 candidates (not 100+) and more time to explore.

### Portfolio Performance Benchmarks

| Metric | Target | Notes |
|--------|--------|-------|
| Bounce Rate | <50% | Interactive portfolios see 30-40% |
| Time on Site | >2 minutes | Games extend this significantly |
| Pages/Session | 3+ | Each "level" counts |
| Mobile Bounce | Higher than desktop | Optimize mobile UX |

### Load Time Impact

- **1 second delay**: 123% increase in bounce rate
- **Target**: Under 3 seconds for initial load
- **Progressive loading**: Show something within 1 second

---

## What Makes Portfolios Memorable vs Forgettable

### Memorable Portfolios Share These Traits

1. **Immediate Hook** (0-5 seconds)
   - Clear visual identity
   - Obvious call to action
   - Something moves/responds

2. **Intuitive Controls**
   - Arrow keys or WASD for games
   - Scroll for linear experiences
   - Touch support for mobile

3. **Clear Progress Indicators**
   - How much content remains?
   - What have I seen?
   - Where can I go next?

4. **Reward Loop**
   - Discovering new content feels rewarding
   - Completion provides satisfaction
   - Easter eggs for thorough explorers

5. **Work Integration**
   - Portfolio content is part of the experience
   - Not just decoration—functional information
   - Links to live projects and GitHub

6. **Performance**
   - Fast initial load
   - Smooth 60fps animations
   - No jarring transitions

### Forgettable Portfolios Suffer From

1. **Style Over Substance**
   - Beautiful but empty
   - No actual work samples
   - Just tech demos

2. **Friction**
   - Confusing controls
   - No skip option
   - Forced to watch animations

3. **Mobile Neglect**
   - Desktop-only experiences
   - Broken touch controls
   - Unreadable text

4. **Slow Performance**
   - Long initial load
   - Laggy interactions
   - Frame drops

5. **Unclear Navigation**
   - Where do I go?
   - What can I click?
   - How do I get back?

6. **Cookie-Cutter Design**
   - Generic templates
   - No personality
   - Indistinguishable from others

---

## Common Patterns Across Successful Examples

### Structural Patterns

1. **Career as Journey**
   - Linear progression through work history
   - Each "world" or "level" = one job/project
   - Natural start-to-finish narrative

2. **Hub World + Levels**
   - Central navigation space
   - Branch into detailed content
   - Return to hub after each section

3. **Single Continuous Scroll**
   - One long journey
   - Parallax storytelling
   - Progress bar visible

### Interaction Patterns

1. **Player Character**
   - Avatar represents the developer
   - Movement through space
   - Interactions reveal content

2. **Object Interaction**
   - Click/touch objects for details
   - NPCs deliver information
   - Items represent projects

3. **Scroll-Driven Animation**
   - Scroll controls progress
   - No complex controls needed
   - Universal interaction model

### Content Patterns

1. **About Section** → Profile, bio, personality
2. **Skills Section** → Technologies, tools, languages
3. **Projects Section** → Case studies, demos, links
4. **Experience Section** → Work history, companies
5. **Contact Section** → Email, social links, availability

---

## Key Takeaways for Our Implementation

### Must-Haves

1. **Fast Load Time** (<3 seconds)
2. **Mobile Support** (touch controls)
3. **Skip Option** (respect user time)
4. **Clear Navigation** (always know where you are)
5. **Actual Portfolio Content** (not just a tech demo)
6. **Links That Work** (GitHub, live demos, contact)

### Nice-to-Haves

1. **Sound Effects** (with mute option)
2. **Easter Eggs** (for engaged users)
3. **Progress Saving** (localStorage)
4. **Keyboard Shortcuts** (accessibility)
5. **Theme Options** (dark/light)

### Avoid

1. **Forced Animations** (let users skip)
2. **Complex Controls** (keep it simple)
3. **Desktop-Only** (mobile is 50%+ of traffic)
4. **Empty Demo** (must showcase real work)
5. **Long Load Times** (optimize assets)
6. **Unpolished UX** (bugs kill credibility)

### Recommended Approach

Given your existing implementation (Super Mario World style with 6 worlds representing career companies):

1. **Keep the World Structure** - Maps well to career progression
2. **Ensure Skip/Fast-Travel** - Recruiters have 55 seconds
3. **Integrate Real Content** - Each world should link to actual projects
4. **Optimize for Mobile** - Test touch controls thoroughly
5. **Add Progress Persistence** - Save unlocked worlds
6. **Quick Win State** - Show impressive content early

### Differentiators to Consider

1. **Skills as Game Mechanics** (your current approach is strong)
2. **Speed Run Mode** - For returning visitors
3. **Accessible Alt View** - Traditional resume toggle
4. **Social Proof Integration** - GitHub stats, testimonials
5. **Real-time Updates** - Pull from APIs if relevant

---

## Sources

### Primary Examples
- [Bruno Simon Portfolio](https://bruno-simon.com/)
- [Robby Leonardi Interactive Resume](http://www.rleonardi.com/interactive-resume/)
- [JSLegendDev 2D Portfolio](https://github.com/JSLegendDev/2d-portfolio-kaboom)
- [Brittany Chiang](https://brittanychiang.com/)
- [Josh Comeau](https://joshwcomeau.com/)
- [Lynn Fisher](https://lynnandtonic.com/)

### Award Sites
- [Awwwards Portfolio Winners](https://www.awwwards.com/websites/winner_category_portfolio/)
- [CSS Design Awards](https://www.cssdesignawards.com/)
- [The FWA](https://thefwa.com/)

### Tutorials & Resources
- [FreeCodeCamp: Create a Developer Portfolio as a 2D Game](https://www.freecodecamp.org/news/create-a-developer-portfolio-as-a-2d-game/)
- [Three.js Journey](https://threejs-journey.com/)
- [Smashing Magazine: CSS/JS Game Portfolio](https://www.smashingmagazine.com/2012/05/develop-a-one-of-a-kind-cssjs-based-game-portfolio/)

### Research & Statistics
- [Presentum: How They Evaluate Your Portfolio](https://presentum.io/design/hiring-explained/evaluating-portfolio-and-resume)
- [Plausible: Bounce Rate Benchmarks](https://plausible.io/blog/bounce-rate)
- [Hacker News: Bruno Simon Portfolio Discussion](https://news.ycombinator.com/item?id=46206531)

### Inspiration Collections
- [Muzli: Top 100 Creative Portfolios 2025](https://muz.li/blog/top-100-most-creative-and-unique-portfolio-websites-of-2025/)
- [GitHub: Developer Portfolios List](https://github.com/emmabostian/developer-portfolios)
- [GitHub: Portfolio Ideas](https://github.com/Evavic44/portfolio-ideas)
