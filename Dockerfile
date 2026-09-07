FROM node:22-alpine AS builder

WORKDIR /app

# Enable pnpm via corepack
RUN corepack enable && corepack prepare pnpm@10.4.1 --activate

# Add build tools for native dependencies (like better-sqlite3 on Alpine)
RUN apk add --no-cache python3 make g++

# Copy dependency specifications
COPY package.json pnpm-lock.yaml ./
COPY patches ./patches

# Install all dependencies including devDependencies for build
RUN pnpm install --frozen-lockfile

# Copy source code and datasets
COPY . .

# Build Vite client assets and esbuild server bundle
RUN pnpm run build

# Production Runtime Stage
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5000
ENV DATABASE_URL=/data/burnin-sentinel.db

# Create persistent storage and backup directories for SQLite
RUN mkdir -p /data/backups /app/dist

# Copy built artifacts and production dependencies
COPY --from=builder /app/package.json ./
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server/data ./server/data
COPY --from=builder /app/node_modules ./node_modules

# Ensure /data is declared as volume mount point
VOLUME ["/data"]

EXPOSE 5000

# Health check using native node HTTP request
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:' + (process.env.PORT || 5000) + '/api/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

CMD ["node", "dist/index.js"]
