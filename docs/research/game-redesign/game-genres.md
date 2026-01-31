# Portfolio Game Genre Research

> Research conducted: January 2026
> Current implementation: Super Mario World-inspired 2D platformer
> Goal: Find genres that better showcase work experience to recruiters

## Executive Summary

After researching portfolio games, interactive resumes, and browser-based game genres, five alternatives emerge as strong candidates for a career-focused portfolio game. The **Interactive Side-Scroller Resume** (à la Robby Leonardi) and **Skill Tree Visualization** stand out as the most recruiter-friendly options, while **Idle/Incremental Career Progression** offers the best natural integration of work history mechanics.

---

## Top 5 Recommended Genres

### 1. Interactive Side-Scroller Resume

**Description:** A scrollable, animated journey through your career where the user controls or observes a character moving through different "levels" representing career milestones. The most famous example is [Robby Leonardi's Interactive Resume](http://www.rleonardi.com/interactive-resume/).

**How it showcases career:**
- Each "level" or section represents a job/company
- Skills displayed as collectibles or achievements
- Timeline naturally flows left-to-right or top-to-bottom
- Work history presented as a literal journey

**Pros:**
- Proven concept with multiple award wins (FWA, Awwwards, CSS Design Awards)
- Highly memorable and shareable
- Forces recruiters to engage with entire resume
- Shows technical skills through the implementation itself
- Works well on both desktop and mobile with scroll controls

**Cons:**
- "Horrible at providing information" to recruiters who need quick scanning
- Risk of style over substance
- Some recruiters may find it frustrating vs. traditional resume
- Requires significant illustration/animation work

**Implementation Complexity:** Medium-High
- Parallax scrolling with GSAP or Framer Motion
- Character animation states
- Section transitions and triggers
- Responsive design challenges

**Asset Requirements:** Medium-High
- Character sprites (multiple states)
- Background illustrations per section
- Icons for skills/achievements
- Animated elements

**Examples:**
- [Robby Leonardi](http://www.rleonardi.com/interactive-resume/) - The gold standard
- [GitHub: interactiveCV](https://github.com/matatacmca/interactiveCV) - Open source inspired version

**Sources:**
- [The FWA - Making of Robby Leonardi's Interactive Resume](https://thefwa.com/article/the-making-of-robby-leonardi-s-interactive-resume)
- [It's Nice That - Animation Analysis](https://www.itsnicethat.com/articles/animation-robby-leonardi)
- [DEV Community - Interactive Resume Discussion](https://dev.to/_bigblind/what-do-you-think-about-interactive-resumes-1154)

---

### 2. Skill Tree / Tech Tree Visualization

**Description:** An RPG-style skill tree where technical skills are organized in a hierarchical, interconnected graph. Users can explore nodes to see proficiency levels, projects using that skill, and how skills connect.

**How it showcases career:**
- Skills organized by category (Frontend, Backend, DevOps, etc.)
- Node connections show skill relationships
- Click/hover reveals projects and experience
- Progression paths mirror actual learning journey
- Unlock animations can show growth over time

**Pros:**
- Immediately familiar to gamers and tech recruiters
- Information-dense but visually engaging
- Natural hierarchy for skill categorization
- Can include interactive demos per skill
- Low asset requirements (geometric shapes, icons)
- Excellent mobile experience with pan/zoom

**Cons:**
- May feel less "game-like" than other options
- Requires careful information architecture
- Can become cluttered with many skills
- Less narrative/story element

**Implementation Complexity:** Medium
- D3.js or custom Canvas rendering for tree
- Node interaction states
- Zoom/pan controls
- Responsive layout

**Asset Requirements:** Low
- Icon set for skills (can use existing libraries)
- Node/connection styling
- Optional: skill category illustrations

**Examples:**
- [Nexora - AI Career Navigation](https://nexora-skilltree-navigator.vercel.app/)
- [SkillSeed - Devpost](https://devpost.com/software/skillseed)
- [GitHub: sicambria/skilltree](https://github.com/sicambria/skilltree)
- [Maker Skill Trees](https://github.com/sjpiper145/MakerSkillTree)

**Sources:**
- [Level Up Coding - Building RPG-like Skill Tree with D3 and Vue](https://levelup.gitconnected.com/building-a-rpg-like-skill-tree-98bfdbef01de)
- [DEV Community - Project Skill Tree Tech Stack](https://dev.to/tieje/project-skill-tree-tech-stack-1274)
- [Creately - Skill Tree Maker](https://creately.com/lp/skill-tree-maker/)

---

### 3. Idle/Incremental Career Progression

**Description:** An idle game where the player "relives" your career journey, starting from entry-level and progressing through roles. Skills accumulate, projects complete in the background, and prestige mechanics allow exploring different career paths.

**How it showcases career:**
- Each job is a "prestige" level with multipliers
- Skills are upgrades that unlock over time
- Projects are achievements that provide bonuses
- Idle mechanics let recruiters leave it running
- Multiple endings show career possibilities

**Pros:**
- Highly addictive format keeps recruiters engaged
- Natural progression mirrors career growth
- Works perfectly on mobile (tap-based)
- Very low asset requirements (numbers, progress bars)
- Can include actual project metrics

**Cons:**
- Takes time to experience full content
- Less immediate information access
- May feel gimmicky to some recruiters
- Requires balancing game economy

**Implementation Complexity:** Medium
- State management for resources/upgrades
- Save/load system (localStorage)
- Prestige/reset mechanics
- Number formatting for large values

**Asset Requirements:** Very Low
- UI components (buttons, progress bars)
- Icons for skills/achievements
- Optional: simple character representation

**Examples:**
- [Progress Knight](https://almostidle.com/) - Career progression idle game
- [Idle Game Dev Simulator](https://www.incrementaldb.com/) - Studio management
- [Cookie Clicker](https://orteil.dashnet.org/cookieclicker/) - Format inspiration

**Sources:**
- [Almost Idle - Incremental Gaming](https://almostidle.com/)
- [Wikipedia - Incremental Games](https://en.wikipedia.org/wiki/Incremental_game)
- [Inc.com - Gamify Career Paths](https://www.inc.com/ryan-jenkins/how-to-gamify-career-paths-to-retain-and-engage-millennials.html)

---

### 4. Interactive Fiction / Text Adventure

**Description:** A choice-based narrative where recruiters make decisions that reveal different aspects of your career story. Built with tools like Twine or custom React, it presents your experience as an interactive story.

**How it showcases career:**
- Branching paths explore different projects/roles
- Choices reveal problem-solving approach
- "Endings" show different skill focuses
- Can include code snippets as puzzle elements
- Narrative voice shows personality

**Pros:**
- Zero graphical assets needed (text-only possible)
- Deep exploration of specific experiences
- Shows communication and writing skills
- Highly accessible (screen readers, mobile)
- Fast to iterate and update

**Cons:**
- Requires strong writing skills
- Less visually impressive
- May not appeal to visually-oriented recruiters
- Takes time to read through

**Implementation Complexity:** Low-Medium
- Twine export or custom state machine
- Branching logic
- Save/checkpoint system
- Optional: visual enhancements

**Asset Requirements:** Very Low to None
- Text styling/typography
- Optional: mood illustrations
- Optional: character portraits

**Examples:**
- [Emily Short's Interactive Storytelling](https://emshort.blog/commercial-portfolio/)
- [Twine](https://twinery.org/) - Free tool
- [Arcweave](https://blog.arcweave.com/industry-applications-making-a-portfolio) - Professional tool

**Sources:**
- [Game Design Skills - Narrative Design Portfolio](https://gamedesignskills.com/game-design/narrative-design-portfolio/)
- [Speckyboy - Storytelling in Portfolio Design](https://speckyboy.com/tell-story-portfolio/)
- [Treezy Play - Choose Your Own Adventure Makers](https://treezyplay.com/choose-your-own-adventure-game-maker-2/)

---

### 5. Card Game / Deck Builder

**Description:** A card-based game where your skills, projects, and experiences are represented as cards. Players can build "decks" for different roles or see how your skill cards combine for specific challenges.

**How it showcases career:**
- Each skill/technology is a card with stats
- Projects are card combinations or achievements
- "Synergies" show how skills work together
- Deck building shows role flexibility
- Can include actual code snippets on cards

**Pros:**
- Familiar metaphor (collectible cards)
- Each card is a bite-sized info chunk
- Easy to add new cards (extensible)
- Can show skill relationships through mechanics
- Works well on mobile (tap to flip/select)

**Cons:**
- Requires designing meaningful card mechanics
- May need illustration for each card
- Game balance can be tricky
- Less narrative structure

**Implementation Complexity:** Medium-High
- Card state management
- Drag/drop or tap interactions
- Animation for card effects
- Optional: deck building UI

**Asset Requirements:** Medium
- Card frame design
- Icons or illustrations per card
- Effect animations
- Optional: card art

**Examples:**
- [Slay the Web](https://github.com/oskarrough/slaytheweb) - Open source deck builder
- [Dulst](https://dulst.com/) - No-code card game platform
- [MTG Deck Builder](https://iristormdesign.com/portfolio/mtg-deck-builder/) - Portfolio example

**Sources:**
- [Medium - Designing a Card Game](https://batiste.medium.com/designing-a-card-game-5f610a1fcc71)
- [itch.io - HTML5 Deck Building Games](https://itch.io/games/html5/tag-deck-building)

---

## Comparison Matrix

| Genre | Learning Curve | Mobile Support | Asset Needs | Info Density | Engagement |
|-------|---------------|----------------|-------------|--------------|------------|
| Side-Scroller Resume | Low (scroll) | Good | High | Medium | Very High |
| Skill Tree | Low (click) | Excellent | Low | High | Medium |
| Idle/Incremental | Very Low | Excellent | Very Low | Medium | High |
| Interactive Fiction | Low (read/click) | Excellent | Very Low | Very High | Medium |
| Card Game | Medium | Good | Medium | High | High |

---

## Recommendation for Portfolio Use

### Primary Recommendation: Hybrid Skill Tree + Timeline

Combine **Skill Tree Visualization** with a **Timeline Journey** element:

1. **Main View:** Interactive skill tree showing all technical competencies
2. **Timeline Mode:** Click a skill to see it appear/grow across your career timeline
3. **Project Cards:** Hovering over intersections shows relevant projects
4. **Quick Stats:** Always-visible summary for recruiters who need fast info

**Why this approach:**
- Addresses the main criticism of game resumes (hard to scan)
- Provides both exploration AND quick access
- Low asset requirements (icons, not illustrations)
- Natural fit for technical portfolios
- Excellent mobile experience
- Can progressively enhance with animations

### Secondary Recommendation: Idle Career Simulator

If engagement is the priority over information density:

1. Start as "Junior Developer" at your first company
2. Accumulate skills, complete projects
3. Prestige to next role/company
4. End state shows current position with full skill tree unlocked

**Why this works:**
- Addictive format ensures full exploration
- Natural career narrative
- Very low asset requirements
- Can include actual project completion metrics
- Mobile-first friendly

---

## Implementation Notes for Current Stack

Given your tech stack (Next.js 15, React 19, Canvas-based rendering):

### Skill Tree Implementation
```typescript
// Use existing Canvas setup for skill tree rendering
// D3.js force-directed graph or custom layout
// Framer Motion for node hover/click animations
// Zustand for skill state (already familiar pattern)
```

### Key Considerations
1. **Reuse existing Canvas knowledge** from platformer
2. **Zustand store** can manage skill tree state
3. **Framer Motion** for smooth transitions
4. **Progressive enhancement:** Start simple, add animations later

### Migration Path from Platformer
1. Keep platformer as "arcade mode" / easter egg
2. Add skill tree as primary portfolio view
3. Skills unlocked in platformer could populate skill tree
4. Worlds completed could unlock "deep dive" project cards

---

## Additional Resources

### Frameworks
- [Phaser.io](https://phaser.io/) - HTML5 game framework
- [D3.js](https://d3js.org/) - Data visualization
- [PixiJS](https://pixijs.com/) - 2D rendering

### Platforms for Hosting
- [itch.io](https://itch.io/) - Game hosting with portfolio features
- [Vercel](https://vercel.com/) - Next.js deployment

### Inspiration Collections
- [Smashing Magazine - CSS/JS Game Portfolio](https://www.smashingmagazine.com/2012/05/develop-a-one-of-a-kind-cssjs-based-game-portfolio/)
- [SiteBuilder Report - Game Developer Portfolios](https://www.sitebuilderreport.com/inspiration/game-developer-portfolios)
- [Alvaro Trigo - Game Design Portfolios](https://alvarotrigo.com/blog/game-design-portfolios/)
