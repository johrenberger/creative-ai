# Contributing to CTI

Thank you for your interest in contributing to Clawdexter's Thinking Interface!

## Project Structure

```
creative-ai/
├── src/
│   ├── server.js    # Express API server + WebSocket
│   ├── db.js        # SQLite database management
│   ├── tasks.js     # Task management module
│   ├── context.js   # Context/state management
│   ├── memory.js    # Memory bank module
│   ├── bridge.js    # Communication patterns
│   └── cli.js       # Interactive CLI client
├── tests/           # Jest unit tests
├── db/
│   └── schema.sql   # Database schema
└── public/
    └── index.html   # Web UI
```

## Development Setup

```bash
# Clone and install
npm install

# Run tests
npm test

# Start server
npm start

# Run CLI
npm run cli

# Lint code
npm run lint
```

## Code Style

- Use ES modules (import/export)
- 2-space indentation
- Semantic variable naming
- JSDoc comments for public functions
- Single quotes for strings

## Testing

All new features should include tests:
- Unit tests in `tests/` directory
- Use Jest with `--experimental-vm-modules`
- Mock external dependencies (database, etc.)
- Test happy path AND error cases

## Commit Messages

Format: `type(scope): description`

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `test`: Tests
- `refactor`: Code refactoring
- `security`: Security improvements

Example: `feat(tasks): add priority scoring by urgency`

## Pull Request Process

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Make your changes with tests
4. Ensure CI passes
5. Submit a PR with description of changes

## Modules

### Tasks
Structured task management with priority/urgency scoring.

### Context
Project state and key-value storage for persistent context.

### Memory
Structured knowledge storage with type classification and retrieval.

### Bridge
Communication patterns that enforce intentional exchanges (subject, content, intent, impact).

## API Design Principles

- RESTful endpoint structure
- JSON request/response bodies
- Consistent error format: `{ "error": "message" }`
- Input validation with sanitization
- Rate limiting on sensitive endpoints