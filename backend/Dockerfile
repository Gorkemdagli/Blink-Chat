# ══════════════════════════════════════
# STAGE 1: Builder
# ══════════════════════════════════════
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ══════════════════════════════════════
# STAGE 2: Runner
# ══════════════════════════════════════
FROM node:22-alpine AS runner

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --chown=appuser:appgroup --from=builder /app/dist ./dist

USER appuser

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://localhost:3000/health || exit 1

EXPOSE 3000

CMD ["node", "dist/index.js"]
