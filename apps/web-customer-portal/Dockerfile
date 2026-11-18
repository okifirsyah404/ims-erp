# syntax=docker/dockerfile:1
# Build context is the repository root:
#   docker build -f apps/web-customer-portal/Dockerfile .
#   docker compose -f docker-compose.yml -f docker-compose.local.yml build web-customer-portal
#
# `astro build` emits a Node standalone server (dist/server/entry.mjs) that imports
# npm packages at runtime (astro, @astrojs/node, react, zod, send, ...), so the
# runtime stage carries a production node_modules next to dist/.

# ---- deps: install workspace deps (the build needs devDeps) ----
FROM oven/bun:1.4-alpine AS deps
WORKDIR /app
COPY package.json bun.lock bunfig.toml ./
# @ims-erp/design-tokens is this app's only workspace dependency (CSS @import);
# bun requires its manifest at install time. Other workspaces are skipped with
# a note by bun.
COPY packages/design-tokens/package.json packages/design-tokens/
COPY apps/web-customer-portal/package.json apps/web-customer-portal/
RUN --mount=type=cache,target=/root/.bun/install/cache \
	bun install --frozen-lockfile --ignore-scripts

# ---- build: astro build (server + client bundles) ----
FROM deps AS build
COPY packages/design-tokens/ packages/design-tokens/
COPY apps/web-customer-portal/ apps/web-customer-portal/
# `astro:env` client-context values are inlined into the bundle at build time,
# so they must be build args, not runtime env. Empty = the app falls back to its
# built-in production defaults (src/lib/urls.ts).
ARG PUBLIC_WEB_URL=
ARG PUBLIC_SUPPORT_WHATSAPP=
ARG PUBLIC_SUPPORT_PHONE=
ENV PUBLIC_WEB_URL=$PUBLIC_WEB_URL \
	PUBLIC_SUPPORT_WHATSAPP=$PUBLIC_SUPPORT_WHATSAPP \
	PUBLIC_SUPPORT_PHONE=$PUBLIC_SUPPORT_PHONE
RUN bun run --cwd apps/web-customer-portal build

# ---- prod-deps: production node_modules only (what entry.mjs imports at runtime) ----
FROM oven/bun:1.4-alpine AS prod-deps
WORKDIR /app
COPY package.json bun.lock bunfig.toml ./
COPY packages/design-tokens/package.json packages/design-tokens/
COPY apps/web-customer-portal/package.json apps/web-customer-portal/
RUN --mount=type=cache,target=/root/.bun/install/cache \
	bun install --frozen-lockfile --production --ignore-scripts

# ---- runtime: node standalone server ----
FROM node:22-alpine AS runtime
# tzdata: the app renders dates and honours TZ. Sessions are server-side: Astro's
# default `fsLite` driver writes under `.astro/session` relative to cwd, so that
# directory must be writable by the runtime user. Compose mounts a named volume
# there so sessions survive a restart.
RUN apk add --no-cache tzdata \
	&& addgroup -S app && adduser -S -G app app \
	&& mkdir -p /app/.astro/session \
	&& chown -R app:app /app
WORKDIR /app
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/apps/web-customer-portal/dist ./dist
COPY --from=build /app/apps/web-customer-portal/package.json ./package.json
USER app
ENV NODE_ENV=production \
	HOST=0.0.0.0 \
	PORT=4322
EXPOSE 4322
# Absolute path: the relative form would resolve against the image's own
# WORKDIR at start, not the WORKDIR above.
CMD ["node", "/app/dist/server/entry.mjs"]
