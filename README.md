# Clawdexter's Thinking Interface (CTI)

A local-first productivity layer that improves communication between Justin and Clawdexter by creating structured workflows for task capture, context management, and intentional exchanges.

## What It Does

CTI runs locally in the Docker container and provides:
- **Task Capture** — Structured input for tasks, ideas, and context
- **Context Engine** — Maintains project state, preferences, and ongoing work
- **Memory Bank** — Structured knowledge access with fast retrieval
- **Priority Queue** — Attention management with urgency/importance scoring
- **Communication Bridge** — Structured exchanges to reduce miscommunication

## Quick Start

```bash
npm install
npm run build
npm start
```

## Architecture

```
creative-ai/
├── src/
│   ├── server.js          # Express API + WebSocket
│   ├── db.js              # SQLite schema + migrations
│   ├── tasks.js           # Task CRUD + priority scoring
│   ├── context.js         # Project/context management
│   ├── memory.js          # Memory bank + retrieval
│   ├── bridge.js          # Communication patterns
│   └── cli.js             # Interactive CLI client
├── tests/
│   ├── tasks.test.js
│   ├── context.test.js
│   ├── memory.test.js
│   └── bridge.test.js
├── db/
│   └── schema.sql
└── package.json
```

## Design Principles

1. **Local-first** — All data stays in the container
2. **Structured over implicit** — Explicit context beats tribal knowledge
3. **Atomic commits** — Every task idea is its own unit
4. **Fast retrieval** — Sub-100ms context lookups
5. **No magic** — Clear data flow, observable state

## API

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/tasks | Create task |
| GET | /api/tasks | List tasks (filterable) |
| PATCH | /api/tasks/:id | Update task |
| DELETE | /api/tasks/:id | Remove task |
| POST | /api/context | Set context |
| GET | /api/context | Get current context |
| POST | /api/memory | Store memory |
| GET | /api/memory/search | Search memories |
| POST | /api/bridge/message | Send structured message |
| GET | /api/bridge/exchange | Get exchange history |

## Web UI

Run `npm start` then open http://localhost:3456

## CLI

```bash
node src/cli.js
```

## Test

```bash
npm test
```
