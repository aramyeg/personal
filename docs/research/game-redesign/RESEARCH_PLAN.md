# Portfolio Game Redesign Research Plan

**Created**: 2026-01-30
**Status**: In Progress

## Current State

The existing implementation is a **Super Mario World-inspired platformer** with:
- 6 worlds mapped to work experiences (BlueNet → xDataGroup)
- Skill progression (double_jump, wall_slide, dash, shield, magnet, float)
- Canvas-based rendering at 620×220 pixels
- ~900 lines of game code

### Strengths
- Skill system tied to technologies learned at each company
- World themes mapped to industry

### Weaknesses
- Experience cards are brief popups, not deeply integrated
- Heavy code complexity for a portfolio piece
- Recruiters may not play long enough to see all content

---

## Research Questions

1. **Game Genre**: What genres work well for portfolios without heavy asset investment?
2. **Visual Style**: How to achieve beauty with minimal custom art?
3. **Experience Integration**: How to make work history a core game mechanic?
4. **Recruiter Appeal**: What creates memorable impressions in short sessions?
5. **Level Design**: What patterns work for data-driven generation?

---

## Research Agents

| # | Agent | Focus | Output File |
|---|-------|-------|-------------|
| 1 | Game Genre Explorer | Alternative game genres | `game-genres.md` |
| 2 | Visual Style Researcher | Minimal-asset beauty | `visual-styles.md` |
| 3 | Portfolio Examples | Real-world examples | `portfolio-examples.md` |
| 4 | Level Design Patterns | Procedural generation | `level-design.md` |
| 5 | Experience Integration | Card/skill mechanics | `experience-integration.md` |
| 6 | Recruiter Psychology | Attention & impressions | `recruiter-psychology.md` |

---

## Alternative Concepts to Evaluate

### Concept A: Tech Tree Explorer
Skill tree visualization where each company unlocks a branch, technologies are nodes to discover.

### Concept B: Card Collection Game
Deck-building where experiences are card packs, technologies are cards with stats.

### Concept C: Timeline Runner
Endless runner with timeline scrolling horizontally, collecting technology badges.

### Concept D: Constellation Map
Interactive star map where companies are constellations, technologies are stars.

### Concept E: Mini-Game Collection
Multiple small games representing different skills (typing, matching, puzzles).

---

## Success Metrics for New Game

| Metric | Target |
|--------|--------|
| Time to First Interaction | < 3 seconds |
| Core Loop Understanding | < 10 seconds |
| Full Experience Discovery | < 2 minutes |
| Mobile Playability | Touch-friendly, < 5MB |
| Code Maintainability | < 500 lines core logic |

---

## Next Steps

1. Run all 6 research agents in parallel
2. Synthesize findings into `synthesis.md`
3. Create decision matrix comparing options
4. Select top 2 concepts for prototyping
5. Create implementation plan
