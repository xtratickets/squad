# ============================================================
# Stage 1: Builder — installs all deps and compiles everything
# ============================================================
FROM node:22-alpine AS builder

# Upgrade all Alpine packages to patch OS-level vulnerabilities
RUN apk upgrade --no-cache

WORKDIR /app

# Install root dependencies first (layer-cached until package.json changes)
COPY package*.json ./
RUN npm ci --no-audit --no-fund

# Install frontend dependencies separately (layer-cached until frontend/package.json changes)
COPY frontend/package*.json ./frontend/
RUN cd frontend && npm ci --no-audit --no-fund

# Generate Prisma client
COPY prisma ./prisma
RUN npx prisma generate

# Copy all source files and build
COPY tsconfig.json ./
COPY src ./src
COPY frontend ./frontend

# Build backend (tsc) then frontend (vite)
RUN npm run build:backend
RUN npm run build:frontend

# ============================================================
# Stage 2: Production — minimal runtime image
# ============================================================
FROM node:22-alpine

# Upgrade all Alpine packages to patch OS-level vulnerabilities
RUN apk upgrade --no-cache

WORKDIR /app

# dumb-init for proper PID 1 signal handling
RUN apk add --no-cache dumb-init

# Copy Prisma schema BEFORE npm ci so @prisma/client postinstall can find it
COPY prisma ./prisma
COPY package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev --no-audit --no-fund

# Copy pre-generated Prisma client from builder
# (avoids a second `prisma generate` run in the production stage)
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Copy compiled backend and built frontend
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/frontend/dist ./frontend/dist

# Copy static public assets
COPY public ./public

ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=512"

EXPOSE 3000

ENTRYPOINT ["dumb-init", "--"]

# Run migrations then start — NODE_ENV is already set via ENV above
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"
