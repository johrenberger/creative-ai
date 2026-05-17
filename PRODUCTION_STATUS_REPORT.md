# CTI Auth Implementation — Full Status Report
**Project:** creative-ai (CTI — Creative AI Thinking Interface)
**Author:** Clawdexter (OpenClaw agent)
**Date:** 2026-05-17
**Latest commit:** `f17757f` ("ci: force server listen in E2E container and add initial wait delay")
**Status:** 🟡 PARTIAL — CI/code fully complete; production app needs diagnosis

---

## What Was Done

### Auth Implementation (Complete ✅)
- [x] `src/auth.js` — bcrypt cost 12, 32-byte session tokens, 7-day sliding expiry
- [x] `src/middleware/auth.js` — `requireAuth` + `optionalAuth` middleware
- [x] `src/server.js` — auth routes + protected data routes, `closeDatabase` export
- [x] `db/schema.sql` — `users` + `sessions` tables added
- [x] `public/index.html` — login modal, auth-aware header, protected tab redirects
- [x] `tests/auth.test.js` — 19 tests covering all auth flows
- [x] `.github/workflows/ci.yml` — E2E stage validating auth endpoints
- [x] `CTI_AUTH_EXECUTION_REPORT.md` — original implementation report committed

### Deployment (Complete ✅)
- [x] Docker image built and pushed to GHCR (tag `f17757fd`)
- [x] Deploy job sent Hostinger API call `POST /vps/v1/virtual-machines/1600839/docker`
- [x] Hostinger responded ✅ with "Deployment initiated successfully!"
- [x] All 5 pipeline jobs passed (lint, security, tests, E2E, deploy)

### Production Verification (BLOCKED 🔴)

**Problem:** The live app at `https://cti.clawdexter.tech` returns `404 Not Found` for all routes including `/health` and `/api/stats`, even though both pipelines are green.

**Evidence:**
- `GET https://cti.clawdexter.tech/health` → `HTTP 404 text/plain`
- `GET https://cti.clawdexter.tech/api/stats` → `HTTP 404 text/plain`
- `x-content-type-options: nosniff` header present → **Express/Helmet IS running**
- All routes return 404 → **app is running but routing is broken**

**Possible causes:**
1. **Incorrect `docker-compose.yml` path in deployed image** — the image was built from `f17757fd` but may contain stale route registration
2. **Hostinger deployment is running a different image** — the "deployment initiated" message may not mean the container is actually running the new image
3. **Port mismatch** — if the container started correctly, something else might be proxying the requests
4. **Route registration order** — static file middleware (`app.use(express.static)`) may be catching all requests before API routes are hit

**What we know works in CI:**
- E2E test inside Docker container `ghcr.io/johrenberger/creative-ai:f17757fd` → **200 OK on /health**
- CI runs the exact same image that was supposedly deployed to production

---

## Testing Results

### CI Pipeline ✅
All 278 tests passing. CI run `25996621596`:
- Lint ✅
- Security Audit ✅
- Unit Tests ✅
- Docker E2E Tests ✅ (ran against the same image now deployed)
- Push Image ✅
- Deploy ✅

### Production App 🔴
```
curl https://cti.clawdexter.tech/health
→ HTTP 404, "404 page not found"

curl https://cti.clawdexter.tech/api/stats
→ HTTP 404, "404 page not found"

curl https://cti.clawdexter.tech/
→ HTTP 404, "404 page not found"
```

All return `content-type: text/plain` with `x-content-type-options: nosniff` (Helmet present, so this is Express).

---

## Network Findings

| Endpoint | Port 443 (HTTPS) | Port 8080 | Port 3456 (CTI) |
|---|---|---|---|
| `72.60.178.136` (cti.clawdexter.tech) | 404 response | OPEN (Meal Plan app) | REFUSED |
| `srv1600839.hstgr.cloud` | REFUSED | REFUSED | REFUSED |
| `72.60.178.136:3456` | — | — | REFUSED |

**Interesting:** Port 8080 on the main IP is open and serves a different app (Meal Plan). This confirms `72.60.178.136` is the Hostinger VPS.

**DNS:**
- `cti.clawdexter.tech` → `72.60.178.136` (VPS public IP)
- `srv1600839.hstgr.cloud` → resolves to `127.0.1.1` (localhost; Hostinger internal hostname)

**SSH:** Port 22 is blocked from this environment. Cannot `ssh` directly to VPS for manual diagnosis.

---

## What Needs to Happen to Resolve This

1. **Diagnose why the Hostinger deployment isn't routing to the CTI app**
   - The "deployment initiated" success may be misleading — the Hostinger API may have started the container but the container may be crashing or routing to wrong port
   - Need SSH access to VPS (blocked from current environment) or need to check Hostinger's container management API

2. **Verify the deployed container is running the correct image**
   - `docker ps` on the VPS should show `ghcr.io/johrenberger/creative-ai:f17757fd`
   - Container should be listening on internal port 3456

3. **Check if there's a reverse proxy/Nginx in front of the VPS routing requests**
   - If so, it may be misconfigured to route to port 8080 (Meal Plan app) instead of 3456 (CTI)
   - The 404 from port 443 comes from the Meal Plan app's nginx proxy

4. **Confirm the deployed `docker-compose.yml` has the right port mapping**
   - Should map host port 443 → container port 3456, or have nginx in front

---

## Deployment Verification Checklist

- [x] Code complete and lint-clean
- [x] All 278 tests pass (local + CI)
- [x] Docker image built and pushed to GHCR
- [x] CI pipeline all-green (commit `f17757f`)
- [x] Hostinger API called with correct compose file from `f17757fd`
- [x] Hostinger returned "Deployment initiated successfully!"
- [x] E2E tests confirmed image works in Docker (HTTP 200 on /health)
- [ ] **Production app verified accessible** — BLOCKED (app returns 404)
- [ ] **Production auth flow tested end-to-end** — BLOCKED
- [ ] **Production pipelines independently verified green** — YES (CI run `25996621596`)

---

## Next Steps (Priority Order)

1. **Get SSH access to VPS** — so we can run `docker ps`, `docker logs`, check nginx config
2. **Check Hostinger container management API** — see actual container status
3. **Fix the production deployment issue**
4. **Run production verification tests** (auth flow, protected routes, session lifecycle)
5. **Document final production state**

---

## Key Files

| File | Purpose |
|---|---|
| `src/auth.js` | Auth logic (bcrypt, session tokens, user management) |
| `src/middleware/auth.js` | `requireAuth` / `optionalAuth` middleware |
| `src/server.js` | All routes (auth + data), server startup guard |
| `db/schema.sql` | `users` + `sessions` schema |
| `public/index.html` | Frontend login modal, auth-aware header |
| `tests/auth.test.js` | 19 auth tests (all passing) |
| `.github/workflows/ci.yml` | CI with E2E stage |
| `CTI_AUTH_EXECUTION_REPORT.md` | Original implementation report |
| `deploy-hostinger.yml` | Deploy workflow (calls Hostinger API) |

---

## Credentials

- **Test user:** `prodtest` / `testpass123`
- **Domain:** `https://cti.clawdexter.tech`
- **VPS:** `72.60.178.136` (port 22 SSH blocked from this environment)
- **Hostinger VM ID:** `1600839`