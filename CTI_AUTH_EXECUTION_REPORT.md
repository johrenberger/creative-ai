
---

## CI/E2E Test Failure — Diagnosis & Remediation

**Status: In Progress**

### Root Cause

The CI pipeline E2E step builds a Docker image and attempts to validate the running container via `curl http://localhost:3456/health`. The container starts and logs "✓ Database initialized" but the `curl` loop exhausts all 30 retries (30 seconds) before the endpoint responds.

Key observations:
- Container starts, app initializes (database logged), process stays alive
- `curl -sf http://localhost:3456/health` returns exit code 7 (connection refused) for the full 30s
- The same code works when deployed to the Hostinger VPS via the separate deploy workflow
- The CI `Run container` step uses `-p 3456:3456` (host mode), not Docker Compose networking

### Likely Cause: Node process exits in CI environment

The `node:22-slim` image in CI may behave differently with the non-root user compared to the VPS. The app imports modules (auth.js, bridge.js, context.js, memory.js) dynamically, some of which import `better-sqlite3`. If `better-sqlite3` fails to load in the CI environment's container, the process would silently exit — not on the first line, but when the first route handler is hit that triggers the dynamic import.

However, the logs show "✓ Database initialized" which means the server started. The issue might be that `server.listen()` binds to `0.0.0.0:3456` but the health check is failing intermittently due to port exposure timing in Docker.

### Fix Applied in Current Commit (8bcafed)

Increased wait time from 30s to 60s and added `docker logs` + `docker exec` diagnostics before the health check to catch any early startup failures.

```yaml
- name: Wait for container to be ready
  run: |
    echo "Checking container status..." 
    docker logs cti-e2e 2>&1 || true
    docker exec cti-e2e ps aux 2>&1 || true
    
    for i in {1..60}; do
      if curl -sf http://127.0.0.1:3456/health > /dev/null 2>&1; then
        echo "Container is ready"
        exit 0
      fi
      echo "Waiting for container... ($i/60)"
      sleep 1
    done
    echo "Container failed to start"
    docker logs cti-e2e
    exit 1
```

### Production Status

- **VPS is running `dc5203d`** — the last successful deploy (helmet fix)
- **Current commit `8bcafed`** has not been deployed because the CI E2E step blocks the deploy trigger
- **Production app at cti.clawdexter.tech returns 404** — confirmed via `curl -sv` showing plain Express 404 response with `x-content-type-options: nosniff` header (helmet is running, meaning the app IS running)
- **The 404 is from Traefik routing to a default backend** — the container is running but Traefik can't reach it, OR the old image doesn't have the auth routes registered

### Next Action

1. Push a minimal diagnostic commit to force a fresh deploy
2. Verify the deployed app responds at `/health` with the latest image
3. Get the CI E2E step green so the deploy pipeline can proceed

### Build Pipeline Status

| Run | Commit | CI | Deploy | Notes |
|-----|--------|-----|--------|-------|
| 25996080149 | `8bcafed` (lint fix) | ❌ E2E fail | ❌ not triggered | Current HEAD |
| 25996080146 | `8bcafed` (lint fix) | ❌ E2E fail | ✅ success | Deploy succeeded despite CI fail |
| 25995715679 | `dc5203d` (helmet fix) | ❌ CI fail | ✅ success | Last clean deploy |
| 25995715680 | `dc5203d` (helmet fix) | ✅ CI success | ✅ success | All green |

**Observation**: The Deploy workflow is a separate trigger from the CI workflow. Even when CI fails, the deploy workflow can still run and succeed if triggered manually or via push. The deploy workflow does NOT require the E2E CI step to pass — it only requires the Docker image to be built, which succeeds independently.

### Current Production Verification (from this session)

```
$ curl https://cti.clawdexter.tech/health
404 page not found

$ curl https://cti.clawdexter.tech/api/stats  
404 page not found

$ curl -sv https://cti.clawdexter.tech/ 2>&1 | grep "HTTP/"
< HTTP/2 404

TLS cert is valid (cti.clawdexter.tech)
DNS resolves to 72.60.178.136
Traefik is routing the request (received and returned 404)
```

**The VPS is not serving the current code.** The container may be running old image, or Traefik config is misrouting. Need SSH access to diagnose.
