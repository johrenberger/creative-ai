# Test Coverage Remediation

## Overview

This document tracks the test coverage remediation effort for the `creative-ai` repository.
Goal: Ensure every testable JavaScript file individually exceeds 90% statements, branches, functions, and lines coverage.

---

## Baseline State (May 22 2026)

### Current Coverage Summary

| File | % Stmts | % Branch | % Funcs | % Lines | Status |
|------|---------|----------|---------|---------|--------|
| src/auth.js | 6.52 | 0 | 0 | 6.97 | ❌ FAR BELOW |
| src/bridge.js | 97.91 | 95 | 100 | 97.91 | ✅ PASS |
| src/cli.js | 0 | 0 | 0 | 0 | ❌ FAR BELOW |
| src/context.js | 88.09 | 80 | 90 | 89.47 | ❌ CLOSE |
| src/db.js | 23.52 | 50 | 60 | 23.52 | ❌ FAR BELOW |
| src/memory.js | 100 | 83.33 | 100 | 100 | ✅ PASS |
| src/server.js | 16.07 | 3.52 | 0 | 17.54 | ❌ FAR BELOW |
| src/middleware/auth.js | 0 | 0 | 0 | 0 | ❌ FAR BELOW |

Global: 26.7% stmts, 25.18% branch, 23.86% func, 28.52% lines

---

## Testable File Inventory

### src/ (Backend Application Logic)
- `src/auth.js` — Authentication: password hashing, sessions, user creation, validation. **NEEDS TESTS.**
- `src/bridge.js` — Bridge: exchange CRUD, respond, close, escalate, stats. **GOOD.**
- `src/cli.js` — CLI: interactive readline interface, HTTP API calls. **NEEDS TESTS.**
- `src/context.js` — Context: key-value store, preferences. **NEEDS TEST POLISH.**
- `src/db.js` — Database: SQLite initialization, schema, stats. **NEEDS TESTS.**
- `src/memory.js` — Memory: store, search, recent. **GOOD.**
- `src/server.js` — Server: Express app, routes, middleware, WebSocket, image proxy. **NEEDS TESTS.**
- `src/tasks.js` — Tasks: task CRUD, stats. **GOOD.**
- `src/middleware/auth.js` — Auth middleware: requireAuth, optionalAuth. **NEEDS TESTS.**

### public/
- `public/index.html` — Static HTML, not JavaScript. **EXCLUDED** (not a JS file).

### db/
- `db/schema.sql` — SQL schema, not JavaScript. **EXCLUDED** (not a JS file).
- `db/cti.db` — SQLite database file. **EXCLUDED** (not a JS file).

### config/
- No JavaScript config files found.

### scripts/
- No scripts/ directory found in this repo.

### Root-level
- `eslint.config.js` — ESLint config (static configuration, minimal logic). **EXCLUDED** (pure config, no testable logic).
- `add-tests.cjs` — One-time test generation script. **EXCLUDED** (bootstrap/task script, not production logic).

### Excluded (Non-testable)
- `public/index.html` — HTML, not JS
- `db/schema.sql` — SQL, not JS
- `db/cti.db` — Binary DB
- `eslint.config.js` — Pure config
- `add-tests.cjs` — Task script
- `tests/` — Test files themselves
- `node_modules/` — Dependencies
- `coverage/` — Generated artifacts

---

## Exclusions Rationale

| File | Reason |
|------|--------|
| public/index.html | Static HTML, no JS logic |
| db/schema.sql | SQL schema, not executable JS |
| db/cti.db | Binary SQLite database |
| eslint.config.js | Pure ESLint configuration, no runtime logic |
| add-tests.cjs | One-time test scaffolding script, not production code |

---

## Story Backlog

### COV-001: Coverage Infrastructure
**Scope:** Fix Jest config to collect coverage from all testable files, add coverageThreshold, add coverage:check script.
**Files covered:** package.json, jest.config equivalent
**Status:** PENDING

### COV-002: src/auth.js Coverage
**Scope:** Test password hashing, session creation, session validation, session destruction, user creation, user lookup, idle timeout, sliding expiration.
**Files covered:** src/auth.js
**Status:** PENDING

### COV-003: src/middleware/auth.js Coverage
**Scope:** Test requireAuth, optionalAuth, parseSessionCookie edge cases.
**Files covered:** src/middleware/auth.js
**Status:** PENDING

### COV-004: src/server.js Coverage
**Scope:** Test all Express routes: health, stats, auth (register/login/logout/session), tasks CRUD, context CRUD, memory CRUD, bridge CRUD, preferences, image proxy SSRF, WebSocket broadcast, error handling.
**Files covered:** src/server.js
**Status:** PENDING

### COV-005: src/db.js Coverage
**Scope:** Test initializeDatabase, getDb, closeDatabase, getSchemaStats, pragma configuration, error paths.
**Files covered:** src/db.js
**Status:** PENDING

### COV-006: src/context.js Polish
**Scope:** Push context.js from 88%/80%/90%/89.47% to 90%+ on all metrics. Cover JSON type inference, project-scoped queries, history tracking.
**Files covered:** src/context.js
**Status:** PENDING

### COV-007: src/cli.js Coverage
**Scope:** Test API helper, all mode commands (tasks/memory/bridge/context), mode switching, help output, error handling for network failures.
**Files covered:** src/cli.js
**Status:** PENDING

### COV-008: CI Enforcement
**Scope:** Update GitHub Actions ci.yml to run coverage:check and fail on insufficient coverage.
**Files covered:** .github/workflows/ci.yml
**Status:** PENDING

### COV-009: Documentation Finalization
**Scope:** Finalize this document with all story results, final coverage table, commit mapping.
**Status:** PENDING

---

## Validation Commands

```bash
npm test -- --coverage
npm run coverage:check
npm run lint
npm run security
```

---

## Notes

- `sql.test.js` has a native module registration issue with `better-sqlite3` in Jest ESM context. May need to skip or fix that test file to get clean test runs.
- `server.test.js` has many passing tests already, but the server is not fully started during coverage runs.
- cli.js has no tests at all — requires mocking readline and HTTP requests.
- auth.js has 0% coverage despite existing auth.test.js — likely because auth.test.js tests the HTTP API layer (register/login), not the internal auth.js module functions directly.