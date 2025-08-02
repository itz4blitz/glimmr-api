# Glimmr API - Production Dockerfile
# Multi-stage build for optimized production image

# Stage 1: Build stage
FROM node:20-alpine AS builder

# Install pnpm globally
RUN npm install -g pnpm@10.14.0

# Set working directory
WORKDIR /app

# Copy package files first for better caching
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages ./packages

# Install dependencies (cached if package files haven't changed)
RUN pnpm install --frozen-lockfile --prefer-offline

# Copy source code
COPY apps/api ./apps/api
COPY turbo.json ./

# Build the application
WORKDIR /app/apps/api
RUN pnpm run build

# Stage 2: Production stage
FROM node:20-alpine AS production

# Install pnpm globally and essential build dependencies
RUN npm install -g pnpm@10.14.0 && \
    apk add --no-cache python3 make g++ libc6-compat

# Create app user for security
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nestjs -u 1001

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages ./packages

# Copy built application from builder stage first
COPY --from=builder /app/apps/api/dist ./apps/api/dist

# Install production dependencies only, then rebuild native modules
RUN pnpm install --frozen-lockfile --prod --include-workspace-root && \
    cd /app/apps/api && npm rebuild bcrypt && \
    pnpm store prune

# Create uploads directory and set permissions
RUN mkdir -p /app/uploads && chown -R nestjs:nodejs /app/uploads
RUN mkdir -p /app/logs && chown -R nestjs:nodejs /app/logs

# Switch to non-root user
USER nestjs

# Change to API directory
WORKDIR /app/apps/api

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/v1/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start the application
CMD ["node", "dist/main.js"]
