# Level Design Patterns for Procedural Generation

**Research Date**: 2026-01-30
**Context**: Portfolio career platformer with 6 worlds (620×220 canvas)

---

## Table of Contents

1. [Level Generation Algorithms](#level-generation-algorithms)
2. [Career Data to Level Parameters](#career-data-to-level-parameters)
3. [Difficulty Curve Design](#difficulty-curve-design)
4. [Platform Placement Patterns](#platform-placement-patterns)
5. [Collectible & Goal Placement](#collectible--goal-placement)
6. [Making Procedural Feel Hand-Crafted](#making-procedural-feel-hand-crafted)
7. [Code Patterns & Pseudocode](#code-patterns--pseudocode)
8. [Recommendations for Portfolio](#recommendations-for-portfolio)

---

## Level Generation Algorithms

### Ranked by Complexity (Low → High)

| Rank | Algorithm | Complexity | Best For | Guarantees Playability |
|------|-----------|------------|----------|------------------------|
| 1 | **Tile-Based Templates** | Low | Fixed structures | Yes |
| 2 | **Binary Tree / Sidewinder** | Low | Maze-like paths | Yes |
| 3 | **Drunkard's Walk** | Low-Med | Organic caves | Yes (path guaranteed) |
| 4 | **Solution Path First** | Medium | Platformers | Yes |
| 5 | **Rhythm-Based Generation** | Medium | Action platformers | Yes |
| 6 | **Genetic Algorithms** | High | Difficulty curves | Requires fitness testing |
| 7 | **Context-Free Grammars** | High | Complex structures | Requires validation |
| 8 | **Machine Learning (VAE/LLM)** | Very High | Style matching | Requires training data |

### Algorithm Details

#### 1. Solution Path First (Recommended)

Generate a guaranteed-playable path first, then add decorative elements:

```
1. Generate critical path from start to exit
2. Ensure all jumps are within physics constraints
3. Add branching paths for collectibles
4. Fill remaining space with obstacles/decorations
5. Validate reachability of all collectibles
```

**Source**: [GameDev.net - Procedural Level Generation](https://www.gamedev.net/articles/programming/general-and-gameplay-programming/procedural-level-generation-for-a-2d-platformer-r3794/)

#### 2. Rhythm-Based Generation

Creates levels with natural pacing based on action-rest cycles:

```
Level = [Rhythm Group 1] + [Rhythm Group 2] + ...
Rhythm Group = Action Segment + Rest Segment
Action Segment = Jumps, Obstacles, Enemies
Rest Segment = Safe platform, Collectibles
```

**Source**: [Rhythm-based level generation for 2D platformers](https://www.researchgate.net/publication/220795055_Rhythm-based_level_generation_for_2D_platformers)

#### 3. Hybrid Approach (Dead Cells Model)

Human designers create "skeletons" defining:
- Key locations (start, checkpoints, exit)
- Required collectibles
- Locked doors/keys
- Difficulty zones

Algorithm fills gaps with procedural content.

**Source**: [Gamedeveloper - Procedural Platformer Levels](https://www.gamedeveloper.com/design/how-to-make-insane-procedural-platformer-levels)

---

## Career Data to Level Parameters

### Mapping Career Attributes to Game Elements

| Career Data | Level Parameter | Example |
|-------------|-----------------|---------|
| **Years at company** | Level length | 2 years → 800px wide |
| **Number of projects** | Platform count | 5 projects → 5 major platforms |
| **Technologies used** | Collectible types | React, Node, AWS → 3 collectible variants |
| **Role complexity** | Jump difficulty | Junior → simple, Senior → precision jumps |
| **Team size** | NPC helpers/obstacles | Large team → more elements |
| **Industry sector** | Visual theme | Fintech → circuit boards, E-commerce → shopping carts |

### Skill-Based Level Modifiers

Each unlocked skill should influence subsequent levels:

```typescript
interface LevelModifiers {
  // Skills affect level generation
  hasDoubleJump: boolean;    // → Taller platforms, more vertical space
  hasWallSlide: boolean;     // → Vertical shafts, wall sequences
  hasDash: boolean;          // → Wider gaps, horizontal challenges
  hasShield: boolean;        // → More hazards, risk/reward zones
  hasMagnet: boolean;        // → Collectibles placed farther from path
  hasFloat: boolean;         // → Precision platforming, moving platforms
}
```

### World-Specific Data Mapping

```typescript
interface WorldLevelConfig {
  worldId: string;
  company: {
    name: string;
    duration: number;        // months
    technologies: string[];
    projectCount: number;
    complexity: 1 | 2 | 3;   // junior/mid/senior
  };

  // Derived level parameters
  levelWidth: number;        // duration * 40px
  platformDensity: number;   // projectCount / 10
  collectibleTypes: number;  // technologies.length
  difficultyBase: number;    // complexity * 0.3
}
```

---

## Difficulty Curve Design

### Classic Difficulty Curve Shapes

```
Linear:     ─────────────────────────/
Stepped:    ────┐    ┌────┐    ┌────
S-Curve:    ────────/────────────────
Wave:       ─/\──/\──/\──/\──/\──/\─
Sawtooth:   /│/│/│/│/│/│/│/│/│/│/│/│
```

### Recommended: Sawtooth with Increasing Baseline

```
Difficulty
    │    ╱│   ╱│   ╱│
    │   ╱ │  ╱ │  ╱ │
    │  ╱  │ ╱  │ ╱  │
    │ ╱   │╱   │╱   │
    │╱    │    │    │
    └─────┴────┴────┴──> Progress
      W1    W2    W3
```

Each world:
- Starts slightly easier than previous world's end
- Peaks higher than previous world
- Creates "breathing room" between challenges

### Difficulty Parameters

```typescript
interface DifficultyConfig {
  // Platform parameters
  platformWidth: [min, max];     // 40-120px early, 20-60px late
  gapWidth: [min, max];          // 60-100px early, 100-180px late
  verticalVariation: number;     // 0.3 early, 0.7 late

  // Timing parameters
  movingPlatformSpeed: number;   // 0.5 early, 2.0 late
  hazardDensity: number;         // 0.1 early, 0.4 late

  // Reward parameters
  collectibleAccessibility: number; // 0.9 early, 0.5 late
}
```

### Fitness Function for Difficulty Curve

From genetic algorithm research:

```typescript
function difficultyFitness(level: Level, targetCurve: number[]): number {
  const actualCurve = calculateDifficultyCurve(level);
  let difference = 0;

  for (let i = 0; i < targetCurve.length; i++) {
    difference += Math.abs(targetCurve[i] - actualCurve[i]);
  }

  // Lower is better
  return difference;
}
```

**Source**: [ResearchGate - PCG and Difficulty Curves](https://www.researchgate.net/publication/261266812_An_approach_to_level_design_using_procedural_content_generation_and_difficulty_curves)

---

## Platform Placement Patterns

### Jump Physics Constraints

Understanding reachability is critical for playable levels.

```typescript
// Core physics equations
const GRAVITY = 0.5;
const JUMP_VELOCITY = -11;
const MOVE_SPEED = 4;

// Derived constraints
const TIME_TO_APEX = Math.abs(JUMP_VELOCITY / GRAVITY); // ~22 frames
const MAX_JUMP_HEIGHT = (JUMP_VELOCITY ** 2) / (2 * GRAVITY); // ~121px
const MAX_HORIZONTAL_JUMP = MOVE_SPEED * TIME_TO_APEX * 2; // ~176px
```

**Source**: [Error454 - Platformer Physics 101](https://error454.com/2013/10/23/platformer-physics-101-and-the-3-fundamental-equations-of-platformers/)

### Reachability Check Algorithm

```typescript
function canReach(from: Platform, to: Platform): boolean {
  const dx = to.x - (from.x + from.width);
  const dy = to.y - from.y;

  // Account for running start
  const runningJumpBonus = MOVE_SPEED * 4; // frames of momentum

  // Can jump up to this platform?
  if (dy < -MAX_JUMP_HEIGHT) return false;

  // Can reach horizontally?
  const effectiveJumpTime = calculateJumpTime(dy);
  const maxHorizontal = MOVE_SPEED * effectiveJumpTime + runningJumpBonus;

  return dx <= maxHorizontal;
}
```

### Mario-Style Design Patterns

From academic analysis of Super Mario Bros:

| Pattern | Description | Use Case |
|---------|-------------|----------|
| **Ramp-Up** | Ascending platforms | Introduce vertical movement |
| **Stair-Step** | Uniform height increments | Teach jump timing |
| **Gap Sequence** | Series of gaps with platforms | Test horizontal jumping |
| **Risk/Reward** | Collectibles on dangerous paths | Optional challenge |
| **Two Paths** | Easy low path, hard high path | Player choice |
| **Silent Tutorial** | Safe space to learn mechanic | Skill introduction |

**Source**: [ResearchGate - Level Design Patterns in 2D Games](https://www.researchgate.net/publication/336013560_Level_Design_Patterns_in_2D_Games)

### Platform Generation Algorithm

```typescript
function generatePlatforms(seed: number, config: LevelConfig): Platform[] {
  const random = createSeededRandom(seed);
  const platforms: Platform[] = [];

  // 1. Create solution path
  let x = 0;
  let y = config.groundLevel;

  while (x < config.levelWidth) {
    const platform = createPlatform(x, y, config, random);
    platforms.push(platform);

    // Calculate next position (within reachability)
    const jump = calculateNextJump(platform, config, random);
    x = platform.x + platform.width + jump.gapWidth;
    y = Math.max(
      config.minY,
      Math.min(config.maxY, y + jump.heightChange)
    );
  }

  // 2. Add branching paths
  for (const platform of [...platforms]) {
    if (random() < config.branchProbability) {
      const branch = createBranchPath(platform, config, random);
      platforms.push(...branch);
    }
  }

  // 3. Validate all platforms reachable
  return validateReachability(platforms);
}
```

---

## Collectible & Goal Placement

### Placement Strategies

#### 1. Path-Aligned Placement
Collectibles follow the main path, rewarding progression:

```typescript
function placePathCollectibles(platforms: Platform[]): Collectible[] {
  return platforms.map((p, i) => ({
    x: p.x + p.width / 2,
    y: p.y - 30,
    type: 'coin',
    required: false
  }));
}
```

#### 2. Risk/Reward Placement
Valuable items in dangerous locations:

```typescript
function placeRiskRewardCollectibles(
  platforms: Platform[],
  hazards: Hazard[]
): Collectible[] {
  return hazards
    .filter(h => h.type === 'gap')
    .map(h => ({
      x: h.x + h.width / 2,
      y: h.y - 50, // Above the gap
      type: 'gem',
      value: 3,    // Higher value for risk
      required: false
    }));
}
```

#### 3. Exploration Reward Placement
Hidden items off the main path:

```typescript
function placeHiddenCollectibles(
  mainPath: Platform[],
  branchPaths: Platform[][]
): Collectible[] {
  return branchPaths.flatMap(branch => {
    const lastPlatform = branch[branch.length - 1];
    return {
      x: lastPlatform.x + lastPlatform.width / 2,
      y: lastPlatform.y - 30,
      type: 'secret',
      value: 5
    };
  });
}
```

### Career-Themed Collectibles

Map technologies to collectible types:

```typescript
const TECH_COLLECTIBLES: Record<string, CollectibleConfig> = {
  'React': { sprite: 'react-logo', category: 'frontend', value: 2 },
  'Node.js': { sprite: 'node-logo', category: 'backend', value: 2 },
  'AWS': { sprite: 'aws-logo', category: 'cloud', value: 3 },
  'TypeScript': { sprite: 'ts-logo', category: 'language', value: 2 },
  'PostgreSQL': { sprite: 'postgres-logo', category: 'database', value: 2 },
};

function mapTechToCollectibles(technologies: string[]): CollectibleType[] {
  return technologies.map(tech => TECH_COLLECTIBLES[tech] || DEFAULT_COLLECTIBLE);
}
```

### Pacing Principles

From reward psychology research:

1. **Variable Reinforcement**: Don't space collectibles evenly
2. **Immediate Gratification**: First collectible within 5 seconds
3. **Scaling Value**: Later collectibles worth more
4. **Set Completion**: Bonus for collecting all in a category

**Source**: [GameAnalytics - Mobile Game Collectibles](https://www.gameanalytics.com/blog/design-mobile-game-collectibles)

---

## Making Procedural Feel Hand-Crafted

### Key Techniques

#### 1. Curated Randomness
Use constrained random ranges instead of pure randomness:

```typescript
// Bad: Pure random
const gapWidth = Math.random() * 200;

// Good: Constrained to playable values
const gapWidth = lerp(60, 120, easeInOut(Math.random()));
```

#### 2. Rhythm Groups
Structure levels as repeating patterns with variation:

```typescript
interface RhythmGroup {
  type: 'action' | 'rest' | 'challenge' | 'reward';
  duration: number;  // in tiles/pixels
  intensity: number; // 0-1
}

const levelRhythm: RhythmGroup[] = [
  { type: 'rest', duration: 100, intensity: 0.2 },
  { type: 'action', duration: 200, intensity: 0.5 },
  { type: 'reward', duration: 50, intensity: 0.3 },
  { type: 'action', duration: 200, intensity: 0.6 },
  { type: 'challenge', duration: 150, intensity: 0.8 },
  { type: 'rest', duration: 100, intensity: 0.2 },
];
```

#### 3. Template Hybridization
Combine procedural generation with hand-crafted chunks:

```typescript
const HAND_CRAFTED_CHUNKS = {
  'skill_intro_double_jump': [
    { type: 'platform', x: 0, y: 150, width: 80 },
    { type: 'platform', x: 150, y: 80, width: 60 },  // Requires double jump
    { type: 'collectible', x: 180, y: 50 },
  ],
  'risk_reward_gap': [
    { type: 'platform', x: 0, y: 150, width: 60 },
    { type: 'collectible', x: 110, y: 100 },  // Over gap
    { type: 'platform', x: 160, y: 150, width: 60 },
  ],
  // ... more templates
};

function generateLevel(config: LevelConfig): Level {
  const sections: Section[] = [];

  // Decide which chunks to use based on context
  if (config.introducesSkill) {
    sections.push(HAND_CRAFTED_CHUNKS[`skill_intro_${config.newSkill}`]);
  }

  // Fill remaining with procedural content
  while (totalLength(sections) < config.levelWidth) {
    sections.push(generateProceduralSection(config));
  }

  return assembleLevel(sections);
}
```

#### 4. Meaningful Constraints
Every random choice should serve gameplay purpose:

```typescript
function choosePlatformWidth(context: GenerationContext): number {
  const baseWidth = 60;

  // After hazard: wider for safety
  if (context.previousElement === 'hazard') {
    return baseWidth + 40;
  }

  // Before collectible: narrower for precision
  if (context.nextElement === 'collectible') {
    return baseWidth - 20;
  }

  // Near skill introduction: appropriate for skill
  if (context.nearSkillIntro) {
    return SKILL_PLATFORM_WIDTHS[context.skill];
  }

  return baseWidth + random(-10, 20);
}
```

**Source**: [The Game Design Forum - Reverse Design: Super Mario World](https://thegamedesignforum.com/features/RD_SMW_1.html)

---

## Code Patterns & Pseudocode

### Complete Level Generator

```typescript
interface LevelGeneratorConfig {
  seed: number;
  worldId: string;
  levelIndex: number;
  careerData: CareerData;
  unlockedSkills: Skill[];
  difficulty: number; // 0-1
}

class LevelGenerator {
  private random: SeededRandom;
  private config: LevelGeneratorConfig;

  constructor(config: LevelGeneratorConfig) {
    this.config = config;
    this.random = createSeededRandom(config.seed);
  }

  generate(): Level {
    // 1. Calculate level parameters from career data
    const params = this.calculateParameters();

    // 2. Generate rhythm structure
    const rhythm = this.generateRhythm(params);

    // 3. Generate solution path
    const solutionPath = this.generateSolutionPath(rhythm, params);

    // 4. Add platforms along path
    const platforms = this.generatePlatforms(solutionPath, params);

    // 5. Add collectibles
    const collectibles = this.placeCollectibles(platforms, params);

    // 6. Add hazards
    const hazards = this.placeHazards(platforms, params);

    // 7. Validate and adjust
    this.validate(platforms, collectibles, hazards);

    return {
      platforms,
      collectibles,
      hazards,
      startPosition: { x: 20, y: params.groundLevel },
      exitPosition: this.calculateExitPosition(platforms),
      width: params.levelWidth,
      height: 220,
    };
  }

  private calculateParameters(): LevelParams {
    const { careerData, difficulty, unlockedSkills } = this.config;

    return {
      levelWidth: Math.min(2000, careerData.durationMonths * 40 + 400),
      groundLevel: 180,
      minY: 40,
      maxY: 180,
      platformWidthRange: [
        lerp(80, 40, difficulty),
        lerp(140, 80, difficulty)
      ],
      gapWidthRange: [
        lerp(50, 80, difficulty),
        lerp(100, 160, difficulty)
      ],
      collectibleCount: careerData.technologies.length * 3,
      hazardDensity: lerp(0.1, 0.4, difficulty),
      branchProbability: unlockedSkills.length > 2 ? 0.3 : 0.1,
    };
  }

  private generateRhythm(params: LevelParams): RhythmGroup[] {
    const groups: RhythmGroup[] = [];
    let position = 0;

    // Always start with a rest period
    groups.push({ type: 'rest', start: 0, end: 100, intensity: 0.2 });
    position = 100;

    while (position < params.levelWidth - 100) {
      const type = this.chooseRhythmType(groups);
      const duration = this.chooseRhythmDuration(type);
      const intensity = this.chooseIntensity(type, position / params.levelWidth);

      groups.push({ type, start: position, end: position + duration, intensity });
      position += duration;
    }

    // Always end with approach to exit
    groups.push({ type: 'rest', start: position, end: params.levelWidth, intensity: 0.3 });

    return groups;
  }

  private generateSolutionPath(rhythm: RhythmGroup[], params: LevelParams): Point[] {
    const path: Point[] = [];
    let x = 40;
    let y = params.groundLevel;

    for (const group of rhythm) {
      while (x < group.end) {
        path.push({ x, y });

        // Calculate next point based on rhythm intensity
        const step = this.calculatePathStep(group, y, params);
        x += step.dx;
        y = Math.max(params.minY, Math.min(params.maxY, y + step.dy));
      }
    }

    return path;
  }

  private generatePlatforms(path: Point[], params: LevelParams): Platform[] {
    const platforms: Platform[] = [];

    for (let i = 0; i < path.length; i++) {
      const point = path[i];
      const width = this.random.range(...params.platformWidthRange);

      platforms.push({
        x: point.x,
        y: point.y,
        width,
        height: 20,
        type: 'solid'
      });
    }

    return platforms;
  }

  private placeCollectibles(platforms: Platform[], params: LevelParams): Collectible[] {
    const collectibles: Collectible[] = [];
    const technologies = this.config.careerData.technologies;

    // Distribute collectibles across level
    const spacing = params.levelWidth / params.collectibleCount;

    for (let i = 0; i < params.collectibleCount; i++) {
      const targetX = spacing * i + this.random.range(0, spacing * 0.5);
      const nearestPlatform = this.findNearestPlatform(platforms, targetX);

      if (nearestPlatform) {
        const tech = technologies[i % technologies.length];
        collectibles.push({
          x: nearestPlatform.x + nearestPlatform.width / 2,
          y: nearestPlatform.y - 40,
          type: tech,
          value: TECH_COLLECTIBLES[tech]?.value || 1
        });
      }
    }

    return collectibles;
  }

  private placeHazards(platforms: Platform[], params: LevelParams): Hazard[] {
    const hazards: Hazard[] = [];

    for (let i = 1; i < platforms.length; i++) {
      const gap = platforms[i].x - (platforms[i-1].x + platforms[i-1].width);

      // Add spike hazard in some gaps
      if (gap > 80 && this.random.next() < params.hazardDensity) {
        hazards.push({
          x: platforms[i-1].x + platforms[i-1].width + gap / 2 - 20,
          y: params.groundLevel,
          width: 40,
          height: 20,
          type: 'spikes'
        });
      }
    }

    return hazards;
  }

  private validate(
    platforms: Platform[],
    collectibles: Collectible[],
    hazards: Hazard[]
  ): void {
    // Ensure all platforms are reachable
    for (let i = 1; i < platforms.length; i++) {
      if (!canReach(platforms[i-1], platforms[i], this.config.unlockedSkills)) {
        // Adjust platform position or add stepping stone
        this.fixReachability(platforms, i);
      }
    }

    // Ensure collectibles are reachable
    for (const collectible of collectibles) {
      if (!this.isCollectibleReachable(collectible, platforms)) {
        this.adjustCollectible(collectible, platforms);
      }
    }
  }
}

// Seeded random helper
function createSeededRandom(seed: number): SeededRandom {
  let state = seed;

  return {
    next(): number {
      state = (state * 1103515245 + 12345) & 0x7fffffff;
      return state / 0x7fffffff;
    },
    range(min: number, max: number): number {
      return min + this.next() * (max - min);
    },
    choice<T>(array: T[]): T {
      return array[Math.floor(this.next() * array.length)];
    }
  };
}
```

---

## Recommendations for Portfolio

### Priority Recommendations

#### 1. Use Solution Path First Algorithm
- Guarantees playability
- Simple to implement
- Easy to tune difficulty
- Naturally creates interesting level shapes

#### 2. Map Career Data Meaningfully

| Career Attribute | Level Element | Reasoning |
|-----------------|---------------|-----------|
| Tenure (months) | Level length | Longer experience = longer journey |
| Technologies | Collectible types | Visual representation of skills gained |
| Company industry | Visual theme | Memorable association |
| Role seniority | Difficulty modifier | Career progression = game progression |

#### 3. Implement Rhythm Groups
- Create natural pacing
- Prevent monotony
- Allow "breathing room" for exploration
- Make levels feel designed, not random

#### 4. Use Hybrid Generation
- Hand-craft skill introduction sections
- Procedurally generate connecting content
- Ensure consistent quality at key moments

### Implementation Order

1. **Phase 1**: Basic solution path generation with physics constraints
2. **Phase 2**: Career data integration (technologies, duration)
3. **Phase 3**: Rhythm-based pacing
4. **Phase 4**: Hand-crafted template chunks for skill intros
5. **Phase 5**: Difficulty curve tuning

### Canvas Constraints (620×220)

Given the small canvas:
- **Horizontal scrolling** is essential
- **Max 3-4 vertical platform layers**
- **Platform width**: 40-100px recommended
- **Gap width**: 50-120px to fit multiple jumps on screen
- **Collectible visibility**: At least 20px diameter

### Performance Considerations

```typescript
// Generate level once, store result
const levelCache = new Map<string, Level>();

function getOrGenerateLevel(worldId: string, levelIndex: number): Level {
  const key = `${worldId}-${levelIndex}`;

  if (!levelCache.has(key)) {
    const seed = hashString(`${worldId}-${levelIndex}`);
    levelCache.set(key, generator.generate(seed));
  }

  return levelCache.get(key)!;
}
```

---

## Sources

### Level Generation Algorithms
- [GameDev.net - Procedural Level Generation for 2D Platformers](https://www.gamedev.net/articles/programming/general-and-gameplay-programming/procedural-level-generation-for-a-2d-platformer-r3794/)
- [Gamedeveloper - How to Make Procedural Platformer Levels](https://www.gamedeveloper.com/design/how-to-make-insane-procedural-platformer-levels)
- [kode80 - Level Generation for Platform Games](https://kode80.com/blog/2015/02/02/level-generation-for-platform-games/index.html)
- [ResearchGate - Rhythm-based Level Generation](https://www.researchgate.net/publication/220795055_Rhythm-based_level_generation_for_2D_platformers)

### Mario & Design Patterns
- [The Game Design Forum - Reverse Design: Super Mario World](https://thegamedesignforum.com/features/RD_SMW_1.html)
- [ResearchGate - Level Design Patterns in 2D Games](https://www.researchgate.net/publication/336013560_Level_Design_Patterns_in_2D_Games)
- [ResearchGate - Design Patterns of Super Mario Series](https://www.researchgate.net/publication/280943816_The_Fine_Line_Between_Rehash_and_Sequel_Design_Patterns_of_the_Super_Mario_Series)
- [UCSC - Framework for Analysis of 2D Platformer Levels](https://users.soe.ucsc.edu/~ejw/papers/smith-sandbox-2008.pdf)

### Physics & Reachability
- [Error454 - Platformer Physics 101](https://error454.com/2013/10/23/platformer-physics-101-and-the-3-fundamental-equations-of-platformers/)
- [Job Talle - 2D Platformer Physics](https://jobtalle.com/2d_platformer_physics.html)
- [Levi.dev - Calculating Jump Trajectories](https://devlog.levi.dev/2021/09/building-platformer-ai-part-3.html)
- [Gamedeveloper - Designing a 2D Jump](https://www.gamedeveloper.com/design/designing-a-2d-jump)

### Difficulty & Progression
- [ResearchGate - PCG and Difficulty Curves](https://www.researchgate.net/publication/261266812_An_approach_to_level_design_using_procedural_content_generation_and_difficulty_curves)
- [ACM - Hybrid Approach to Roguelike Level Generation](https://dl.acm.org/doi/10.1145/3402942.3402945)

### Collectibles & Rewards
- [GameAnalytics - Mobile Game Collectibles](https://www.gameanalytics.com/blog/design-mobile-game-collectibles)
- [Game Wisdom - Collectible Design in Videogames](https://game-wisdom.com/critical/collectible-design-videogames)
- [Gamedeveloper - How to Make Catchy Collectibles](https://www.gamedeveloper.com/design/how-to-make-catchy-collectibles)
