FROM node:20-alpine
RUN corepack enable
WORKDIR /app

# ── Dependency layer (cached when only source changes) ────────────
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY apps/realtime/package.json apps/realtime/
COPY packages/shared/package.json packages/shared/
COPY packages/db/package.json packages/db/
RUN pnpm install --frozen-lockfile || pnpm install

# ── Source ────────────────────────────────────────────────────────
COPY tsconfig*.json ./
COPY packages packages
COPY apps/realtime apps/realtime

# Generate Prisma client (engine + types ready at runtime).
RUN pnpm --filter @groupspeak/db exec prisma generate

# Type-check the realtime server (no emit; tsx runs the TS source).
RUN pnpm --filter @groupspeak/realtime build

ENV NODE_ENV=production
EXPOSE 4000

# Run the TypeScript entry directly with tsx so workspace-package
# imports (which point at TS source) resolve correctly.
CMD ["pnpm", "--filter", "@groupspeak/realtime", "start"]
