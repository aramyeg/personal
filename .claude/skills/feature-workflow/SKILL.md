---
name: feature-workflow
description: Complete multi-agent workflow for implementing features and bug fixes. Use this skill when starting any new feature or bug fix to ensure consistent, high-quality development.
---

# Feature Implementation Workflow

This skill provides a comprehensive, repeatable workflow for implementing features and bug fixes using multiple specialized agents. It ensures consistent quality, thorough testing, and proper documentation.

## When to Activate

- Starting any new feature from a GitHub issue
- Fixing bugs with assigned issue numbers
- Implementing enhancements or improvements
- Any change requiring a pull request

## Branch Naming Convention

```
<type>/<issue-number>/<short-description>
```

| Type | Description | Example |
|------|-------------|---------|
| `feat` | New features | `feat/6/voice-capture` |
| `fix` | Bug fixes | `fix/12/memory-deletion` |
| `refactor` | Code refactoring | `refactor/15/auth-flow` |
| `test` | Test additions | `test/18/e2e-coverage` |
| `docs` | Documentation | `docs/20/api-docs` |
| `chore` | Maintenance | `chore/22/deps-update` |

## Complete Workflow

### Phase 1: Setup

```bash
# 1. Ensure you're on main and up to date
git checkout main
git pull origin main

# 2. Create feature branch
git checkout -b feat/<issue-number>/<short-description>

# 3. Verify branch created
git branch --show-current
```

### Phase 2: Research (Explorer Agent)

**Purpose**: Build comprehensive context before implementation

The explorer agent:
- Analyzes the GitHub issue requirements
- Researches implementation approaches
- Evaluates library options
- Documents compatibility considerations
- Identifies potential challenges

**Expected Outputs**:
- Recommended implementation approach
- Library recommendations with rationale
- Compatibility matrix (iOS/Android/Web)
- Known limitations or challenges

### Phase 3: Planning (Planner Agent)

**Purpose**: Create detailed, phased implementation plan

The planner agent creates:
- Multi-phase implementation plan
- Task breakdown with dependencies
- Risk assessment
- Timeline estimates
- Success criteria

**Plan Structure**:
```
Phase 1: Foundation
  - Task 1.1: Create types
  - Task 1.2: Setup dependencies

Phase 2: Core Implementation
  - Task 2.1: Create hooks
  - Task 2.2: Create components

Phase 3: Integration
  - Task 3.1: Wire up UI
  - Task 3.2: Add error handling

Phase 4: Testing
  - Task 4.1: Unit tests
  - Task 4.2: Integration tests

Phase 5: Polish
  - Task 5.1: Accessibility
  - Task 5.2: Documentation
```

### Phase 4: Architecture Design (Architect Agent)

**Purpose**: Design system architecture before coding

The architect agent defines:
- Component hierarchy
- State management approach
- Data flow diagrams
- Type definitions
- Error handling strategy
- Permission flows

**Deliverables**:
- Architecture decision records (ADRs)
- Component diagrams
- State machine definitions
- Type interfaces
- Error handling matrix

### Phase 5: Test-Driven Development (TDD Agent)

**Purpose**: Implement with tests first

**TDD Cycle**:
1. **RED**: Write failing tests
2. **GREEN**: Write minimal code to pass
3. **REFACTOR**: Improve code quality

**Coverage Requirements**:
- Minimum 80% global coverage
- 85%+ for critical business logic
- 90%+ for core utilities

**Test Types**:
- Unit tests (Jest)
- Integration tests (Jest)
- E2E tests (Maestro for mobile, Playwright for web)

### Phase 6: Code Cleanup (Refactor-Cleaner Agent)

**Purpose**: Remove dead code and improve quality

The refactor-cleaner:
- Removes unused imports
- Eliminates dead code
- Consolidates duplicate functions
- Improves naming
- Ensures immutability patterns

### Phase 7: End-to-End Testing (E2E Agent)

**Purpose**: Verify complete user flows

The E2E agent creates:
- Mobile E2E tests (Maestro YAML)
- Web E2E tests (Playwright)
- Manual testing checklists
- Accessibility verification

**Critical Flows to Test**:
- Happy path (main user journey)
- Error handling (permissions, failures)
- Edge cases (cancel, retry)
- Accessibility (VoiceOver, TalkBack)

### Phase 8: Build Verification (Build-Error-Resolver Agent)

**Purpose**: Ensure all builds pass

The build-error-resolver:
- Runs TypeScript validation
- Executes full test suite
- Verifies iOS build
- Verifies Android build
- Verifies web build

```bash
# Validation commands
npm run typecheck
npm run test:ci
npm run ios
npm run android
npm run web
```

### Phase 9: Code Review (Code-Reviewer Agent)

**Purpose**: Final quality gate before PR

The code-reviewer evaluates:
- Code quality and patterns
- Security vulnerabilities
- Performance concerns
- Accessibility compliance
- Documentation completeness

**Issue Severity**:
| Level | Action Required |
|-------|-----------------|
| CRITICAL | Must fix before merge |
| HIGH | Should fix before merge |
| MEDIUM | Recommended to fix |
| LOW | Optional improvement |

### Phase 10: Pull Request

**Purpose**: Create PR for review (DO NOT MERGE)

```bash
# Create PR via GitHub MCP or gh CLI
gh pr create --title "feat: <description>" --body "$(cat <<'EOF'
## Summary
- <bullet point 1>
- <bullet point 2>
- <bullet point 3>

## Changes
- <file changes summary>

## Test Plan
- [ ] Unit tests pass
- [ ] E2E tests pass
- [ ] Manual testing complete
- [ ] Accessibility verified

## Screenshots/Videos
<if applicable>
EOF
)"
```

### Phase 11: Documentation (Doc-Updater Agent)

**Purpose**: Update all documentation

The doc-updater:
- Updates CLAUDE.md with new architecture
- Updates file structure documentation
- Creates/updates Notion pages
- Documents new patterns or conventions

**Documentation Checklist**:
- [ ] CLAUDE.md updated
- [ ] Architecture section added
- [ ] File structure updated
- [ ] Notion synced
- [ ] README updated (if needed)

## Skills to Apply

Apply these skills throughout the workflow:

| Skill | When to Apply |
|-------|---------------|
| `/coding-standards` | All code changes |
| `/frontend-patterns` | React/Next.js components |
| `/game-development` | Canvas game code |
| `/backend-patterns` | API and data layer |
| `/security-review` | Auth, inputs, data |
| `/tdd-workflow` | All new code |
| `/strategic-compact` | Long sessions |

## Game Development Workflow (Portfolio-Specific)

When implementing game features, follow this specialized flow:

### Phase 1: Game Feature Research
- Review `docs/GAME_DESIGN.md` for specifications
- Check existing skill/world implementations in `lib/game/world/`
- Understand the state machine (overworld/level/complete/unlock)

### Phase 2: Game-Specific TDD
```
1. Write physics tests first (delta time, collisions)
2. Write skill state immutability tests (CRITICAL)
3. Implement feature to pass tests
4. Verify no state mutations
```

### Phase 3: Game Testing with game-tester Agent
- Physics tests (gravity, friction, delta time)
- Collision tests (AABB, edge cases)
- Skill tests (cooldowns, immutability)
- Performance tests (frame time < 16ms)

### Game Code Quality Gates
- [ ] Skill state updates are immutable
- [ ] Delta time used in all physics
- [ ] requestAnimationFrame cleaned up
- [ ] Refs used for game loop data
- [ ] Canvas context null-checked
- [ ] Game runs at stable 60fps

## Parallel Agent Execution

For efficiency, run independent agents in parallel:

```
Parallel Group 1 (Research):
  - Explorer agent

Parallel Group 2 (Design):
  - Planner agent
  - Architect agent (can run after explorer)

Parallel Group 3 (Review):
  - Security-reviewer agent
  - Code-reviewer agent

Sequential (must be in order):
  1. TDD agent (depends on design)
  2. Refactor-cleaner agent (depends on TDD)
  3. E2E agent (depends on implementation)
  4. Build-error-resolver (depends on code)
```

## Commit Message Format

Use gitmoji + conventional commits:

```
<emoji> <type>: <description>

[optional body]
```

| Type | Emoji | Example |
|------|-------|---------|
| feat | ✨ | `✨ feat: add voice capture` |
| fix | 🐛 | `🐛 fix: resolve memory leak` |
| refactor | ♻️ | `♻️ refactor: simplify auth flow` |
| test | ✅ | `✅ test: add unit tests` |
| docs | 📝 | `📝 docs: update README` |
| chore | 🔧 | `🔧 chore: update deps` |

## Quality Gates

Before creating PR, verify:

- [ ] All tests pass (231+ tests)
- [ ] Coverage >= 80%
- [ ] TypeScript clean (no errors)
- [ ] No console.log statements
- [ ] No hardcoded values
- [ ] Immutability patterns used
- [ ] Accessibility labels added
- [ ] Error handling complete
- [ ] Documentation updated

## Example Workflow Execution

```
1. git checkout -b feat/6/voice-capture
2. Explorer agent: Research expo-speech-recognition
3. Planner agent: Create 5-phase plan
4. Architect agent: Design state machine
5. TDD agent: Write tests first, implement
6. Refactor-cleaner: Remove dead code
7. E2E agent: Create Maestro + Playwright tests
8. Build-error-resolver: Verify all builds
9. Code-reviewer: Final quality check
10. Create PR (DO NOT MERGE)
11. Doc-updater: Update CLAUDE.md + Notion
```

## Troubleshooting

### Agent Not Starting
- Verify agent definition in `.claude/agents/`
- Check for syntax errors in agent file
- Ensure proper subagent_type specified

### Tests Failing
- Run tests in isolation
- Check mock setup
- Verify test utilities imported correctly

### Build Errors
- Run `npm run typecheck` first
- Check for circular dependencies
- Verify all imports resolve

### PR Creation Fails
- Ensure branch pushed to remote
- Verify GitHub authentication
- Check for merge conflicts

## Success Metrics

| Metric | Target |
|--------|--------|
| Test Coverage | >= 80% |
| Tests Passing | 100% |
| TypeScript Errors | 0 |
| Critical Review Issues | 0 |
| Build Status | Green |

---

**Remember**: This workflow ensures consistent, high-quality feature development. Each phase builds on the previous, creating a comprehensive implementation with proper testing and documentation.
