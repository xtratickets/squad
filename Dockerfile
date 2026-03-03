# Multi-stage Dockerfile for optimized builds
# This is more efficient than Nixpacks for Node.js applications

FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev)
RUN npm ci --prefer-offline --no-audit && \
    npm cache clean --force

# Copy Prisma schema
COPY prisma ./prisma

# Generate Prisma client
RUN npx prisma generate

# Copy source code
COPY src ./src
COPY tsconfig.json ./
COPY frontend ./frontend

# Build backend
RUN npm run build:backend

# Build frontend (this includes tsc -b in frontend)
RUN npm run build:frontend

# ============================================
# Production stage - minimal runtime
# ============================================
FROM node:22-alpine

WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Copy package files
COPY package*.json ./

# Install ONLY production dependencies
RUN npm ci --omit=dev --prefer-offline --no-audit && \
    npm cache clean --force

# Copy Prisma files (needed at runtime)
COPY prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/frontend/dist ./frontend/dist

# Copy config and utils if needed at runtime
COPY config ./config 2>/dev/null || true
COPY public ./public 2>/dev/null || true

# Set environment
ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=2048"

# Expose port
EXPOSE 3000

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start application with migrations
CMD ["sh", "-c", "npx prisma migrate deploy --skip-generate && npm run start:prod"]

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"
