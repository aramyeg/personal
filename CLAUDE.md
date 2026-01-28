# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Purpose

This is a Claude Code configuration repository containing reusable agents, skills, hooks, and rules. These configurations are designed to be shared across multiple projects or used as a personal workspace template.

## Structure

```
.claude/
├── agents/          # Specialized sub-agent definitions
├── hooks/           # Event-based automation scripts
├── rules/           # Project-agnostic coding standards
└── skills/          # Invocable skill definitions with reference docs
```

## Agents

Use the Task tool to invoke these specialized agents:

| Agent | Purpose |
|-------|---------|
| `explorer` | Deep codebase analysis, tech stack discovery, Notion sync |
| `planner` | Implementation planning for complex features |
| `architect` | System design and architectural decisions |
| `tdd-guide` | Test-driven development workflow enforcement |
| `code-reviewer` | Code quality review (use after writing code) |
| `security-reviewer` | Security vulnerability analysis |
| `build-error-resolver` | Fix build/type errors with minimal changes |
| `e2e-runner` | Maestro/Detox E2E test management |
| `refactor-cleaner` | Dead code removal (knip, depcheck, ts-prune) |
| `doc-updater` | Documentation updates with Notion sync |

## Active Hooks

Hooks in `.claude/hooks/hooks.json` provide automatic behaviors:

**PreToolUse:**
- Blocks code edits on main/master branches (enforces feature branch workflow)
- Blocks dev server commands outside tmux
- Suggests tmux for long-running commands (npm/yarn/pnpm install/test, cargo, docker)
- Blocks creation of non-standard .md files (only README, CLAUDE, AGENTS, CONTRIBUTING allowed)

**PostToolUse:**
- Auto-formats JS/TS files with Prettier after edits
- Runs TypeScript type check after .ts/.tsx edits
- Warns about console.log statements
- Logs PR URL after `gh pr create`

**Stop:**
- Audits all modified files for console.log before session ends

## Skills

Available skills in `.claude/skills/`:

- `coding-standards` - TypeScript/React best practices
- `continuous-learning` - Auto-extract reusable patterns from sessions
- `frontend-patterns` - React/Next.js patterns
- `react-native-best-practices` - RN performance optimization
- `security-review` - Security checklist for sensitive features
- `strategic-compact` - Context compaction suggestions
- `supabase-postgres-best-practices` - Postgres optimization rules

## Key Rules (from .claude/rules/)

### Immutability (Critical)
Always create new objects with spread operator; never mutate directly.

### File Size Limits
- 200-400 lines typical
- 800 lines maximum
- Functions under 50 lines
- Nesting under 4 levels

### Git Workflow
- Feature branches required for code edits
- Commit format: `<type>: <description>` (feat, fix, refactor, docs, test, chore, perf, ci)

### Testing
- 80% minimum coverage required
- TDD workflow: RED (write failing test) → GREEN (implement) → IMPROVE (refactor)
- Use `tdd-guide` agent proactively for new features

### Error Handling
Always use try/catch with user-friendly error messages. Return `{ data, error }` tuples from data functions.

### Input Validation
Use Zod schemas for all user input validation.

## When Starting Work

1. Use `explorer` agent for unfamiliar codebases
2. Use `planner` agent for complex features
3. Use `code-reviewer` agent after writing code
4. Use `security-reviewer` agent before commits involving auth/input/secrets
