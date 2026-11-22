# syntax=docker/dockerfile:1
# Build context is the repository root:
#   docker build -f apps/web-landing/Dockerfile .
#   docker compose -f docker-compose.yml -f docker-compose.local.yml build web-landing
#
# `astro build` emits a standalone server (@astrojs/node, dist/server/entry.mjs)
# that imports npm packages at runtime (astro, @astrojs/node, react, zod, send,
# ...), so the runtime stage carries a production node_modules next to dist/.
# Every stage runs on Bun, the server included (`bun dist/server/entry.mjs`).

# ---- deps: install workspace deps (the build needs devDeps) ----
FROM oven/bun:1.4-alpine AS deps
WORKDIR /app
COPY package.json bun.lock bunfig.toml ./
# patchedDependencies (package.json): bun install applies these files.
COPY patches/ patches/
# @ims-erp/design-tokens is this app's only workspace dependency (CSS @import);
# bun requires its manifest at install time. Other workspaces are skipped with
# a note by bun.
COPY packages/design-tokens/package.json packages/design-tokens/
COPY packages/common/package.json packages/common/
COPY apps/web-landing/package.json apps/web-landing/
RUN --mount=type=cache,target=/root/.bun/install/cache \
	bun install --frozen-lockfile --ignore-scripts

# ---- build: astro build (server + client bundles) ----
FROM deps AS build
COPY packages/design-tokens/ packages/design-tokens/
COPY apps/web-landing/ apps/web-landing/
# `astro:env` client-context values are inlined into the bundle at build time,
# so they must be build args, not runtime env. Empty = the app falls back to its
# built-in production defaults (src/lib/urls.ts).
ARG PUBLIC_WEB_URL=
ARG PUBLIC_CUSTOMER_URL=
# Same value as the schema default in astro.config.mjs; override per build.
ARG PUBLIC_WHATSAPP_NUMBER=6281280002020
ENV PUBLIC_WEB_URL=$PUBLIC_WEB_URL \
	PUBLIC_CUSTOMER_URL=$PUBLIC_CUSTOMER_URL \
	PUBLIC_WHATSAPP_NUMBER=$PUBLIC_WHATSAPP_NUMBER \
	ASTRO_TELEMETRY_DISABLED=1
# --bun: run the astro CLI on Bun even where a Node is on PATH.
RUN bun --bun run --cwd apps/web-landing build

# ---- prod-deps: production node_modules only (what entry.mjs imports at runtime) ----
FROM oven/bun:1.4-alpine AS prod-deps
WORKDIR /app
COPY package.json bun.lock bunfig.toml ./
COPY patches/ patches/
COPY packages/design-tokens/package.json packages/design-tokens/
COPY packages/common/package.json packages/common/
COPY apps/web-landing/package.json apps/web-landing/
RUN --mount=type=cache,target=/root/.bun/install/cache \
	bun install --frozen-lockfile --production --ignore-scripts

# ---- runtime: standalone server on Bun ----
FROM oven/bun:1.4-alpine AS runtime
# tzdata: the app renders dates and honours TZ. The session driver (Astro's
# default `fsLite`) writes under `.astro/session` relative to cwd, so it must
# be writable by the runtime user (the image's `bun` user).
RUN apk add --no-cache tzdata \
	&& mkdir -p /app/.astro/session \
	&& chown -R bun:bun /app
WORKDIR /app
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/apps/web-landing/dist ./dist
COPY --from=build /app/apps/web-landing/package.json ./package.json
USER bun
ENV NODE_ENV=production \
	HOST=0.0.0.0 \
	PORT=4321
EXPOSE 4321
# Absolute path: the relative form would resolve against the image's own
# WORKDIR at start, not the WORKDIR above.
CMD ["bun", "/app/dist/server/entry.mjs"]
