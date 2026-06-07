# TODO Component Analysis — creative-ai

## Context

- [x] **CTA-CTX-1 [Repository]**
  - Repository URL: https://github.com/johrenberger/creative-ai
  - Branch: main
  - Commit: 657358b
  - Timestamp: 2026-06-07T22:14:00+02:00
  - Profile: standard
  - Output Directory: /data/component-analysis-runs/creative-ai-2026-06-08/

## Checkpoints

- [x] CTA-CKPT-1 INPUT_VALIDATED
- [x] CTA-CKPT-2 REPO_ACQUIRED
- [x] CTA-CKPT-3 STACK_DETECTED
- [x] CTA-CKPT-4 COMPONENTS_DETECTED
- [x] CTA-CKPT-5 RISK_BEHAVIOR_GAP_DONE
- [x] CTA-CKPT-6 CONTRACTS_FIDELITY_DONE
- [x] CTA-CKPT-7 RANKING_GATES_ROLLOUT
- [ ] CTA-CKPT-8 SECURITY_ARCH_PLAYBOOKS (FULL only — skipped)
- [x] CTA-CKPT-9 OUTPUTS_ASSEMBLED

## Section 1 — Repository Analysis

### Repository Overview

```
Name: creative-ai (Clawdexter's Thinking Interface / CTI)
Description: Local-first productivity layer for structured communication
             between Justin and Clawdexter (task capture, context, memory,
             priority queue, structured exchanges)
Primary language: JavaScript (Node.js)
Test framework: Jest + supertest
Build system: npm
Package manager: npm
CI/CD: GitHub Actions (lint, test, security, build+e2e, docker, deploy)
Source layout: src/ (9 modules), src/middleware/ (1 module)
Test layout: tests/ (13 unit + integration), tests/e2e/ (1 Python/Playwright)
Infrastructure: SQLite via better-sqlite3 (file-based)
Messaging: WebSocket via ws
External integrations: bcrypt, helmet, express-rate-limit, cors, dompurify, jsdom, marked
Public APIs: REST + WebSocket at http://localhost:3456
Internal APIs: none (single-process)
Shared libraries: none (no monorepo / no shared packages)
Configuration: env vars (CTI_DB_PATH, CTI_URL, CTI_WEBHOOK_SECRET, CTI_START_SERVER, CTI_PORT)
```

### Technology Inventory

| Category | Tool | Version | Purpose |
|---|---|---|---|
| Language | JavaScript (ES modules) | Node 22 | All source + tests |
| Framework | Express | ^4.21.0 | HTTP server |
| WebSocket | ws | ^8.18.0 | Real-time broadcast |
| Build | npm | (npm 10) | Package management |
| Test framework | Jest | ^29.7.0 | Unit + integration tests |
| HTTP test | supertest | ^7.2.2 | API integration tests |
| Coverage | Istanbul (Jest built-in) | (Jest 29) | Statement/function/branch coverage |
| Lint | ESLint | ^9.12.0 | Style + syntax |
| Security headers | helmet | ^8.0.0 | Default OWASP headers |
| Rate limiting | express-rate-limit | ^7.4.0 | 429 on excess requests |
| CORS | cors | ^2.8.5 | Cross-origin policy |
| Database | better-sqlite3 | ^12.10.0 | Synchronous SQLite binding |
| Auth hashing | bcrypt | ^6.0.0 | Password hashing |
| Markdown | marked | ^14.1.0 | Render content as HTML |
| XSS sanitize | DOMPurify + jsdom | ^3.1.6 / ^25.0.0 | Strip dangerous HTML |
| E2E | Playwright + pytest | (latest) | Headless browser tests |
| Container | Docker | (Dockerfile) | Production runtime |
| CI/CD | GitHub Actions | v4/v5 | Lint, test, deploy |
| Deploy | Hostinger | (manual) | VPS via hostinger/deploy-on-vps@v2 |

### Dependency Inventory

(Same as `dependency-risk-matrix.json` — 12 dependencies, see that file.)

### Architecture Summary

**Single-process monolith** with three layers: HTTP API (Express), domain modules (auth, tasks, context, memory, bridge), and data access (db.js). All state is in SQLite at `db/cti.db`. The CLI is a separate process that talks to the server over HTTP. WebSocket is used for real-time broadcast of events.

The codebase is well-structured: each domain module has clear responsibilities, exports are explicit (named + default), and the auth surface is isolated in `src/middleware/auth.js`. There is one minor architectural concern: `parseSessionCookie` is duplicated between `src/auth.js` (line 105) and `src/middleware/auth.js` (line 56). See CTA-GAP-005.

### Assumptions

- The repo is a single-package Node.js project, not a monorepo. No `packages/` or `workspaces` in package.json.
- Production deployment uses Docker (per Dockerfile + docker-compose.yml + .github/workflows/ci.yml deploy step).
- The 13 unit/integration test files in `tests/` are the only test infrastructure. `node_modules/**/test/` are excluded from analysis.
- Coverage artifacts at `coverage/coverage-final.json` (Istanbul 1.0 format) are from the most recent local run. They are not part of the repo source but are checked in.
- Tests in `tests/e2e/test_cti.py` are run against the deployed production instance (`https://cti.clawdexter.tech`), not locally. They are part of CI's `e2e-ui-tests` job.

## Section 2 — Component Inventory

| Component | Risk | Source | Tests | Coverage (stmt) |
|---|---:|---|---|---:|
| db | T1 | src/db.js | tests/db.test.js, tests/sql.test.js | 94.1% |
| auth | T1 | src/auth.js | tests/auth.test.js, tests/auth.unit.test.js | 76.1% |
| auth-middleware | T1 | src/middleware/auth.js | tests/middleware-auth.test.js | 52.4% |
| tasks | T1 | src/tasks.js | tests/tasks.test.js | 94.6% |
| context | T2 | src/context.js | tests/context.test.js | 88.1% |
| memory | T2 | src/memory.js | tests/memory.test.js | 100.0% |
| bridge | T2 | src/bridge.js | tests/bridge.test.js | 97.9% |
| server | T1 | src/server.js | tests/server.test.js, server-coverage.test.js, security.test.js, e2e | 67.4% |
| cli | T3 | src/cli.js | tests/cli.test.js | 0.0% |

(Detail in `component-inventory.json`.)

## Section 3 — Dependency Risk Matrix

12 dependencies. 5 T3 (medium), 5 T4 (low), 2 between. Full table in `dependency-risk-matrix.json`.

| Notable | Why |
|---|---|
| **bcrypt** | Security boundary, real (no mock). Low cost factor in tests (4 vs 10 in prod). |
| **better-sqlite3** | Database. Use `:memory:` for tests. |
| **DOMPurify + jsdom** | XSS protection, real (mocking defeats the test). |
| **express-rate-limit** | 429 trigger; real. |
| **ws** | WebSocket; real ws client. |
| **helmet** | Verify security headers; real. |

## Section 4 — Component Testing Definition

(This section is FULL-only. Skipped in STANDARD.)

**For this repo specifically**, "component testing" means:

- **Unit tests** for each domain module (auth, tasks, context, memory, bridge, db) — call exported functions directly, use a real in-memory SQLite.
- **Component tests** for the auth-middleware — test the Express middleware in isolation, with mocked req/res.
- **Integration tests** for the server — supertest-based, full HTTP round-trip with the real Express app, in-memory SQLite.
- **E2E tests** for the CLI — spawn the CLI as a child process and parse stdout.
- **E2E tests** for the full system — Playwright against the deployed instance (CI only).

## Section 5 — Dataset Integrity Analysis

**Datasets detected:**

| Path | Type | Size | Risk |
|---|---|---|---|
| db/schema.sql | SQL schema (CREATE TABLE IF NOT EXISTS) | 7 tables, 9 indexes | T1 |

**Tables:** users, sessions, tasks, context, memories, exchanges, preferences.

**Integrity issues:** None found at the schema level. All FKs use `ON DELETE CASCADE`. Indexes are present for query patterns (status, project, tags, expires_at).

**No test data fixtures** in the repo (no `seeds/`, no `fixtures/`, no `test-data/`). Tests construct their own in-memory DBs and populate via API calls. This is the right pattern for a unit-testable codebase.

## Section 6 — State Transition Matrix

4 components have non-trivial state machines. 27 transitions total. See `state-transition-matrix.json` for the full matrix.

- **auth:** Anonymous → Registered → Authenticated → (SessionExpired | LoggedOut)
- **tasks:** pending ↔ in_progress ↔ blocked ↔ done ↔ cancelled
- **bridge:** open → (responded | escalated) → closed
- **context:** absent → set → updated → deleted

## Section 7 — Behavioral Coverage Model

| Component | Covered | Total | Score |
|---|---:|---:|---:|
| db | 5 | 5 | 100.0% |
| auth | 7 | 12 | 58.3% |
| auth-middleware | 4 | 6 | 66.7% |
| tasks | 7 | 7 | 100.0% |
| context | 7 | 8 | 87.5% |
| memory | 8 | 8 | 100.0% |
| bridge | 7 | 7 | 100.0% |
| server | 22 | 26 | 84.6% |
| cli | 0 | 4 | 0.0% |
| **Total** | **67** | **83** | **80.7%** |

(Behavior-level, not code-level. See `behavior-coverage.json` for per-behavior detail.)

**Behavioral Coverage Score: 80.7% aggregate** (counted as: sum(covered paths) / sum(max paths)).

Note: This is **higher** than code coverage would suggest, because behaviors are coarse-grained. A test that exercises 3 happy paths on 3 different functions contributes 3 to the numerator but only 1/3 to the line-coverage denominator.

## Section 8 — Current Test Analysis

| Test File | Lines | describe | it | Component |
|---|---:|---:|---:|---|
| tests/auth.test.js | 236 | 6 | 19 | auth (integration) |
| tests/auth.unit.test.js | 394 | 9 | 30 | auth (unit) |
| tests/bridge.test.js | 355 | 10 | 22 | bridge |
| tests/cli.test.js | 505 | 9 | 36 | cli (subprocess) |
| tests/context.test.js | 264 | 7 | 18 | context |
| tests/db.test.js | 291 | 10 | 32 | db |
| tests/memory.test.js | 379 | 11 | 23 | memory |
| tests/middleware-auth.test.js | 231 | 3 | 17 | auth-middleware |
| tests/security.test.js | 322 | 9 | 24 | security (cross-cutting) |
| tests/server-coverage.test.js | 689 | 23 | 67 | server (coverage-focused) |
| tests/server.test.js | 870 | 33 | 87 | server (full integration) |
| tests/sql.test.js | 42 | 0 | 0 | db (SQL smoke) |
| tests/tasks.test.js | 379 | 11 | 23 | tasks |
| tests/e2e/conftest.py | (Python) | — | — | e2e setup |
| tests/e2e/test_cti.py | (Python) | — | — | e2e (CI-only, deployed) |
| **Total** | 4,957 | 143 | 398 | |

The test suite is substantial: ~400 tests, well-organized. server.test.js (870 lines, 87 it) is the biggest; it covers the full HTTP surface. server-coverage.test.js is a focused coverage-fill suite for the server.

## Section 9 — Test Gap Analysis

10 gaps total. Full backlog in `gap-backlog.json`. Top 5 by priority:

| ID | Component | Description | Priority | Effort |
|---|---|---|---|---|
| CTA-GAP-001 | auth | password validation (bcrypt.compare) untested, coverage 76% | P0 | 1-4h |
| CTA-GAP-002 | auth-middleware | expired session not tested, coverage 52% | P0 | 1-4h |
| CTA-GAP-008 | server | XSS in markdown may not be tested in server.js, coverage 67% | P0 | 1-4h |
| CTA-GAP-009 | auth | session expiration policy unclear, may accept expired sessions | P0 | < 1h |
| CTA-GAP-003 | auth-middleware | parseSessionCookie malformed-cookie handling, 0% on that function | P1 | < 1h |

## Section 13 — Coverage Strategy

| Coverage Type | Expectation | Threshold |
|---|---|---|
| Functional | All exported functions called at least once in the happy path | 100% of exports |
| Behavioral | Each documented behavior has at least one test for each path | 80%+ of behaviors at 100% |
| State | Each documented state transition has a test | 100% of T1 components; 80%+ of T2 |
| Dependency | Each T1 dependency has a failure-mode test (mock the failure, not the dep) | 100% of T1/T2 deps |
| Security | Each T1 auth surface has a negative test (wrong password, expired session, etc.) | 100% of T1 |
| Configuration | Each env var has a default-or-validation test | 100% (CTI has 5 env vars) |
| Data | Schema constraints tested (UNIQUE, FK, CHECK) | 100% of constraints |
| Contract | Each public API endpoint has a request/response test | 100% of endpoints |
| Accessibility | N/A (no UI) | — |

## Section 14 — Test Fidelity Strategy

(See `dependency-risk-matrix.json` for per-dependency recommendations. Summary: Real > Fake > Stub > Mock. The codebase uses real in-memory SQLite (not mocks), real bcrypt (with low cost factor in tests), real ws client. The one place a mock would be appropriate — external HTTP clients — doesn't apply because the repo doesn't make outbound HTTP calls.)

## Section 15 — Test Architecture Decision Tree

```
Uses DB?
 → better-sqlite3 with `:memory:` (one DB per test)
Uses Express route?
 → supertest with the actual app from src/server.js
Uses WebSocket?
 → real ws client connecting to the test server
Uses bcrypt?
 → real bcrypt with cost factor 4 (vs 10 in production)
Uses child process (CLI)?
 → spawn + parse stdout (no in-process coverage)
Needs deterministic time?
 → inject a clock (not yet implemented; recommend for future)
Needs test data isolation?
 → unique DB per test file via CTI_DB_PATH=/tmp/cti-test-<pid>.db
```

## Section 19 — Flaky Test Prevention Checklist  (STANDARD+)

- [x] No `Thread.sleep` (N/A — Node.js)
- [x] No execution-order dependency (tests use unique DBs)
- [x] No shared mutable state (each test file gets its own DB)
- [x] No external network access in unit/component tests (CI's e2e-ui-tests is the only one that hits the deployed instance)
- [ ] Deterministic clocks (NOT YET — recommend injecting a clock for time-dependent tests)
- [x] Deterministic randomness (no `Math.random` in source)
- [x] No filesystem writes to absolute paths (CTI_DB_PATH env var is the only fs dependency, and tests use /tmp)
- [x] No timing-based assertions (tests assert on response bodies, not timing)

**1 of 8 not met: deterministic clocks.** Recommendation: inject a clock into tasks.js (for completed_at) and auth.js (for session expiration).

## Section 20 — Test Data Governance  (STANDARD+)

| Data Class | Source | Lifecycle | Governance |
|---|---|---|---|
| Static | None in repo | n/a | — |
| Generated | Tests construct in-memory SQLite | per test | unique DB per test file |
| Reference | `db/schema.sql` is the only reference | long-lived | versioned in git |
| Edge Case | Test cases for boundary conditions | per test | documented in test name |
| Security | Test cases for XSS, auth bypass | per test | explicitly security-tagged |

## Section 21 — Risk Priority Ranking

| Rank | Component | Score | Priority |
|---:|---|---:|---|
| 1 | server | 26 | P0 |
| 2 | auth | 22 | P1 |
| 3 | auth-middleware | 21 | P1 |
| 4 | tasks | 17 | P2 |
| 5 | memory | 16 | P2 |
| 6 | bridge | 16 | P2 |
| 7 | db | 15 | P2 |
| 8 | context | 15 | P2 |
| 9 | cli | 14 | P3 |

(Full scoring in `risk-priority-ranking.json`.)

## Section 22 — Production Feedback Loop

```
Incident
 ↓ (user reports a bug in production)
Root Cause
 ↓ (debug: which component, which test missed it?)
Missing Scenario
 ↓ (add to gap-backlog as CTA-GAP-NNN)
Backlog
 ↓ (prioritize via risk-priority-ranking.json)
Test Creation
 ↓ (run application-test-coverage with the gap as a focused pick)
```

The CTI repo has an existing `TEST_COVERAGE_REMEDIATION.md` (7832 bytes) at the repo root, which appears to be an earlier instance of this loop. Recommend linking the gap-backlog to the remediation doc so future gaps are tracked alongside historical ones.

## Section 23 — Machine-Readable Outputs

7 JSONs emitted (1 skipped per profile rules + 1 always-on handoff-manifest):

| File | Bytes | Section |
|---|---|---|
| component-inventory.json | 9,253 | 2 |
| dependency-risk-matrix.json | 5,512 | 3 |
| behavior-coverage.json | 11,260 | 7 |
| gap-backlog.json | 9,723 | 9 |
| state-transition-matrix.json | 4,896 | 6 |
| contract-inventory.json | 8,366 | 11 |
| risk-priority-ranking.json | 3,575 | 21 |
| handoff-manifest.json | 4,954 | 23 (always) |

**2 skipped (FULL-only):** mutation-roadmap.json, test-creation-input-schema.json.

## Section 26 — Implementation Rollout Plan

| Phase | Focus | Success Criteria |
|---|---|---|
| 1 | Data Integrity (CTA-GAP-010) | db.js idempotent init test passes |
| 2 | Highest Risk Component — server (CTA-GAP-004, -005, -008) | server.js coverage ≥ 90% |
| 3 | Remaining T1 — auth, auth-middleware (CTA-GAP-001, -002, -003, -009) | auth.js + middleware/auth.js coverage ≥ 90% |
| 4 | T2 components (CTA-GAP-007) | context.js coverage ≥ 95% |
| 5 | Mutation Testing (P0/P1) | mutation score ≥ 60% on server, auth |
| 6 | Continuous Improvement | gap-backlog integrated into TEST_COVERAGE_REMEDIATION.md |

## Section 27 — Quality Gates  (STANDARD+)

| Gate | Threshold | Owner | Action on Failure |
|---|---|---|---|
| Pull Request | tests pass, server.js coverage ≥ 80%, auth.js ≥ 80% | PR author | block merge |
| Branch Build | + auth-middleware ≥ 80%, all T1 components ≥ 80% | branch | block merge |
| Nightly Build | + mutation score on server ≥ 50% | on-call | warn |
| Release Candidate | + coverage ≥ 90% on all T1, mutation ≥ 60% | release captain | block tag |
| Regression Suite | + all e2e (Playwright) pass | release captain | block release |

## Section 28 — Test Pyramid Alignment  (STANDARD+)

| Layer | Recommended | Actual | Notes |
|---|---:|---:|---|
| Unit | 60% | ~60% (db, tasks, memory, bridge, context unit tests) | matches |
| Component | 20% | ~25% (auth.test.js, middleware-auth.test.js, server-coverage.test.js) | slightly over |
| Contract | 10% | ~5% (no Pact, no OpenAPI; contract tests are in server.test.js) | under — recommendation: extract |
| Integration | 7% | ~10% (server.test.js with supertest) | matches |
| E2E | 3% | ~5% (e2e/test_cti.py) | matches |

**Recommendation:** Add a dedicated contract-test layer (extract from server.test.js), even if it's just supertest-based contract assertions. This decouples API contract verification from full HTTP integration tests.

---

## Handoff Manifest

See `handoff-manifest.json`. Summary: 4 P0 gaps to feed `application-test-coverage` first; 5 T1 components to focus on; 1 architectural concern (parseSessionCookie duplication).
