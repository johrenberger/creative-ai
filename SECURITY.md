# Security Policy

## Reporting Vulnerabilities

If you discover a security vulnerability, please report it responsibly:

1. **Do NOT** create a public GitHub issue for security vulnerabilities
2. Email the maintainer directly or use private security reporting
3. Include detailed steps to reproduce the issue
4. Allow time for assessment and patch development before disclosure

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x     | :white_check_mark: |

## Security Considerations

### Input Validation
- All user inputs are sanitized before storage
- SQL queries use parameterized statements (no raw concatenation)
- Rate limiting is enforced on all API endpoints

### Authentication
- CTI is designed for local use within a trusted environment
- No external authentication is required when running locally
- If exposing via network, use appropriate firewall/auth measures

### Data Storage
- SQLite database stored locally
- No encryption at rest (add if handling sensitive data)
- Database file permissions should be restricted

### WebSocket
- WebSocket connections are authenticated via origin checks
- Message size limits are enforced
- Rate limiting applies to WebSocket messages

## Dependency Security

We use `npm audit` in our CI pipeline to catch known vulnerabilities:
- Critical vulnerabilities will fail the build
- High vulnerabilities will fail the build
- Medium/Low are logged but don't fail (review manually)

## Best Practices

1. Keep CTI updated to receive security patches
2. Don't run CTI with root privileges unnecessarily
3. Restrict network access if not needed
4. Review and rotate any secrets periodically