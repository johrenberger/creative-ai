# CTI - Clawdexter's Thinking Interface
# Build stage
FROM node:22-slim AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .

# Production stage
FROM node:22-slim AS production

WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodeuser -u 1001

# Copy dependencies
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/src ./src
COPY --from=builder /app/db ./db
COPY --from=builder /app/public ./public
COPY --from=builder /app/package*.json ./

# Create db directory
RUN mkdir -p db && chown -R nodeuser:nodejs /app

USER nodeuser

EXPOSE 3456

ENV NODE_ENV=production
ENV CTI_PORT=3456

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3456/health || exit 1

CMD ["node", "src/server.js"]