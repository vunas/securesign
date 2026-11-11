FROM node:22-alpine AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY web-lms-demo/package.json ./web-lms-demo/package.json
RUN pnpm install --frozen-lockfile --filter web-lms-demo...

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY web-lms-demo ./web-lms-demo
WORKDIR /app/web-lms-demo
ARG NEXT_PUBLIC_API_URL=http://localhost:8000
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/web-lms-demo/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/web-lms-demo/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/web-lms-demo/.next/static ./.next/static

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
