# Local Development Setup Guide

> Last updated: September 18, 2026

## Prerequisites Installed

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | v24.21.0 | Via nvm (required ≥24.19.0 per `.nvmrc`) |
| npm | 11.19.0 | Bundled with Node 24 |
| Docker Desktop | 29.8.0 | Required for local Supabase |
| Supabase CLI | 2.117.0 | Installed via Homebrew |

## Quick Start

```bash
# 1. Use correct Node version
source ~/.nvm/nvm.sh && nvm use 24

# 2. Start Docker Desktop (if not running)
open -a Docker

# 3. Start Supabase local database
supabase start

# 4. Run database migrations (if needed)
npm run db:migrate

# 5. Start dev server
npm run dev
```

## Service URLs (When Running)

| Service | URL | Purpose |
|---------|-----|---------|
| **Nuxt Dev Server** | http://localhost:3000 | Main application |
| **Smoke Test Page** | http://localhost:3000/smoke | UI component testing |
| **Login Page** | http://localhost:3000/login | Google OAuth login |
| **Supabase Studio** | http://127.0.0.1:54323 | Database GUI |
| **Mailpit** | http://127.0.0.1:54324 | Email testing inbox |
| **Supabase API** | http://127.0.0.1:54321 | REST/GraphQL APIs |

## Database Connection

```
postgresql://postgres:postgres@127.0.0.1:54322/postgres
```

## Environment Variables

The `.env` file is configured with:
- Google OAuth credentials (from repo owner)
- Local Supabase database URL
- Test auth enabled for E2E testing

## Common Commands

```bash
# Development
npm run dev              # Start dev server
npm run build            # Production build
npm run preview          # Preview production build

# Database
supabase start           # Start local Supabase (requires Docker)
supabase stop            # Stop local Supabase
supabase db reset        # Reset & replay migrations
npm run db:generate      # Generate migrations from schema changes
npm run db:migrate       # Apply migrations

# Quality
npm run typecheck        # TypeScript type checking
npm run lint             # ESLint
npm test                 # Unit tests (Vitest)
npm run test:e2e         # E2E tests (Playwright)
npm run test:coverage    # Unit tests with coverage
```

## Troubleshooting

### Node version mismatch
```bash
source ~/.nvm/nvm.sh && nvm use 24
# Or install if missing:
nvm install 24
```

### Docker not found
```bash
# Add Docker CLI to PATH
export PATH="$HOME/.docker/bin:$PATH"
```

### Supabase won't start
1. Ensure Docker Desktop is running (whale icon in menu bar)
2. Check Docker has enough resources (Settings → Resources)
3. Try `supabase stop` then `supabase start`

### Database connection refused
- Verify Supabase is running: `supabase status`
- Check `.env` has correct `DATABASE_URL` pointing to `127.0.0.1:54322`

## Architecture Reference

See `_bmad-output/planning-artifacts/architecture/` for:
- `ARCHITECTURE-SPINE.md` — Core invariants (AD-1..AD-12)
- Domain module structure
- Coding conventions

## Notes

- Google OAuth is in "Testing" mode — only approved test users can log in
- Data owner nyata (real owner data) tidak boleh masuk repo — use synthetic data only
- Always work on feature branches, never commit directly to `main`/`develop`
