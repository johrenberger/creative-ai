# ADR-001: Current Architecture Baseline

## Status

Accepted

## Context

CTI (Clawdexter's Thinking Interface) is a local-first productivity layer designed to structure human-AI collaboration through task management, context storage, memory bank, and communication exchanges.

## Decision

Document the current architecture as the baseline for future decisions.

## Architecture Style

- **Monolithic Node.js application** — single Express server with all modules
- **Local-first** — all data persisted in local SQLite database
- **RESTful API** — synchronous HTTP endpoints with WebSocket for real-time
- **Session-based authentication** — server-side sessions with httpOnly cookies

## Major Technologies

- **Runtime:** Node.js >= 18 (ES modules)
- **HTTP Server:** Express ^4.21.0
- **WebSocket:** ws ^8.18.0
- **Database:** SQLite via better-sqlite3 ^12.10.0
- **Auth:** bcrypt ^6.0.0 (cost factor 12)
- **Security:** helmet ^8.0.0, cors, express-rate-limit
- **Testing:** Jest ^29.7.0 + supertest ^7.2.2
- **Linting:** ESLint ^9.12.0
- **Containerization:** Docker + docker-compose

## Key Tradeoffs

| Decision | Tradeoff |
|----------|----------|
| SQLite over PostgreSQL | Simpler ops, no network DB needed, limited scaling |
| Session auth over JWT | Simpler implementation, but requires server-side token storage |
| ES modules over CommonJS | Modern standard, but requires Node >= 18 |
| Monolithic over microservices | Simpler deployment, but less fault isolation |

## Known Constraints

- Database file stored locally on filesystem (`db/cti.db`)
- No external API integrations — fully self-contained
- No distributed tracing or structured logging
- Single-server deployment (no horizontal scaling mechanism)
- CORS origin hardcoded to `https://cti.clawdexter.tech` (configurable via env)

## Known Unknowns

- How database migrations are handled for schema changes
- Python e2e test CI integration
- Deployment specifics for Hostinger VPS
- Whether WebSocket has authentication

## Evidence

- [src/server.js](https://github.com/johrenberger/creative-ai/blob/cd7585619f307bcae533ea785cea4c668733166a/src/server.js)
- [src/auth.js](https://github.com/johrenberger/creative-ai/blob/cd7585619f307bcae533ea785cea4c668733166a/src/auth.js)
- [db/schema.sql](https://github.com/johrenberger/creative-ai/blob/cd7585619f307bcae533ea785cea4c668733166a/db/schema.sql)
- [package.json](https://github.com/johrenberger/creative-ai/blob/cd7585619f307bcae533ea785cea4c668733166a/package.json)