---
inclusion: always
---

# SipDipDO Project Context

This steering file is automatically included in every Kiro session for the SipDipDO project.

> **Session Continuity:** See current-work.md for active story and resume instructions.

## Project Overview

**snd-dash** — Dashboard Kepemilikan Saham Sip & Dip (Phase 1)

| Stack | Details |
|-------|---------|
| Framework | Nuxt 4.5.2 (Vue 3 + TypeScript, SSR) |
| Database | PostgreSQL 17 via Supabase, Drizzle ORM |
| Auth | NuxtAuth (Google OAuth) |
| UI | shadcn-vue + Tailwind v4 + reka-ui |
| Deployment | Vercel |

## Local Development

| Service | URL |
|---------|-----|
| Dev Server | http://localhost:3000 |
| Smoke Test | http://localhost:3000/smoke |
| Supabase Studio | http://127.0.0.1:54323 |
| Mailpit | http://127.0.0.1:54324 |

## Key Files & Directories

| Path | Purpose |
|------|---------|
| AGENTS.md | Project policies & conventions (auto-loaded by Kiro) |
| SETUP-LOCAL.md | Detailed local setup guide |
| _bmad-output/planning-artifacts/ | PRD, UX, Architecture docs |
| server/domain/ | Domain modules (10 modules) |
| shared/domain/ | Pure functions (money, calendar) |
| drizzle/schema.ts | Database schema |

## Architecture Invariants

- **AD-5**: Import across domain modules only via index.ts
- **AD-9**: Calendar/timezone via shared/domain/calendar.ts (Asia/Jakarta)
- **AD-10**: Money/ratio as decimal strings only, never number/parseFloat
- **AD-12**: PWA shell = fingerprinted assets + offline.html only

## Critical Policies

1. **No real owner data in repo** — use synthetic data only
2. **Don't edit _bmad/ or _bmad-output/** — they are frozen artifacts
3. **Git flow required** — work on feature/* branches from develop
4. **Test Design gating** — run bmad-testarch-test-design before implementation

## Code Conventions

- Clean Architecture: dependencies point inward to domain
- pages/ and server/api/ are thin — logic in server/domain/*.service.ts
- Drizzle queries only in *.repo.ts
- Branded types over primitives where possible
- No magic numbers — use named constants

## E2E Test Best Practices (Playwright)

**IMPORTANT:** Follow these patterns to avoid flaky tests.

### 1. Always wait for hydration after navigation

After page.goto(), always add page.waitForLoadState('networkidle').

**Why:** Vue/Nuxt apps use SSR + client hydration. Without waiting, buttons may be visible but not yet interactive (event handlers not attached).

### 2. Use serial mode for tests that share database state

Add test.describe.configure({ mode: 'serial' }) at top of test file.

**Why:** When multiple workers run in parallel, they all hit the same database. If tests mint the same user session or modify shared data, they interfere with each other causing 403 errors or stale data assertions.

### 3. Wait for API responses before DOM assertions

Use page.waitForResponse() to capture API calls before checking dialog content.

**Why:** Dialogs that fetch data may show loading states or errors if the test checks too early.

### 4. Use expect.poll() for eventual consistency

For database reads that may have lag, use expect.poll() with retry intervals.

**Why:** Database writes may not be immediately visible due to transaction timing.

### 5. Avoid editing shared data in parallel tests

Create isolated test data with unique identifiers (e.g., emailUjiUnik('suffix')) instead of editing the first row.

**Why:** Parallel tests modifying the same row cause race conditions.

## Common Test Commands

- npm run test:e2e — Run all E2E tests
- npm run test:e2e -- --grep="#17" — Run specific test by number
- npm run test:e2e -- --workers=1 — Force serial execution
- npm run test:e2e -- --repeat-each=10 — Stress test for flakiness

## Current Work

See current-work.md for active story status and next steps.
