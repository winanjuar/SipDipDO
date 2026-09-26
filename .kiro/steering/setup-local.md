---
inclusion: auto
name: Local Development Setup Check
description: Auto-detect and conditionally start Docker/Supabase at session start
---

# Local Development Setup Check

**Trigger:** Session start, or when user mentions setup/docker/supabase/local dev/environment.

## Kiro Instructions

At the start of each session, run this check sequence:

### Step 1: Check Docker Status
```bash
docker info > /dev/null 2>&1 && echo "DOCKER_RUNNING" || echo "DOCKER_STOPPED"
```

### Step 2: Check Supabase Status (only if Docker is running)
```bash
cd /Users/mochamadrih/Documents/SipNDipCafe/Coding/SipDipDO && supabase status 2>&1 | grep -q "local development setup is running" && echo "SUPABASE_RUNNING" || echo "SUPABASE_STOPPED"
```

### Step 3: Conditional Actions

**If DOCKER_STOPPED:**
```bash
open -a Docker
```
Then wait 30-60 seconds and verify with `docker info` before proceeding.

**If DOCKER_RUNNING but SUPABASE_STOPPED:**
```bash
cd /Users/mochamadrih/Documents/SipNDipCafe/Coding/SipDipDO && supabase start
```

**If both DOCKER_RUNNING and SUPABASE_RUNNING:**
Do nothing — services are already up. Just report status to user:
> ✅ Local dev environment ready (Docker + Supabase already running)

### Step 4: Report Final Status

After any startup actions complete, show:

| Service | Status |
|---------|--------|
| Docker Desktop | ✅/❌ |
| Supabase | ✅/❌ |

And remind user:
- Dev server: `npm run dev` → http://localhost:3000
- Supabase Studio: http://127.0.0.1:54323
- Mailpit: http://127.0.0.1:54324

## Key Behavior

- **Idempotent**: Only start services that are not already running
- **No redundant restarts**: If already running, skip startup commands entirely
- **Silent when healthy**: If everything is up, just confirm with a one-liner
- **Auto-start when needed**: Don't ask permission, just start and report

## Troubleshooting Commands

If startup fails:
```bash
# Force restart Supabase
supabase stop && supabase start

# Check what's using ports
lsof -i :54321 -i :54322 -i :54323 -i :54324
```
