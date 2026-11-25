# syntax=docker/dockerfile:1
# Build context is the repository root:
#   docker build -f apps/web-employee-portal/Dockerfile .
#   docker compose build web-employee-portal

# ---- deps: install workspace deps (build needs devDeps) ----
# bun.lock lists every workspace; manifests for web-employee-portal + packages/ui (its
# only imported workspace dep, via tsconfig path aliases) are provided. Other
# workspaces are skipped with a note by bun.
FROM oven/bun:1.4-alpine AS deps
WORKDIR /app
COPY package.json bun.lock bunfig.toml ./
# patchedDependencies (package.json): bun install needs the patch files.
COPY patches/ patches/
COPY packages/ui/package.json packages/ui/
# web-employee-portal imports @ims-erp/common (browser-safe permission catalog); bun
# requires the workspace manifest at install time.
COPY packages/common/package.json packages/common/
# Same for @ims-erp/locales: bun.lock lists it as a web-employee-portal workspace dep, so
# a frozen install fails outright unless the manifest is on disk.
COPY packages/locales/package.json packages/locales/
COPY apps/web-employee-portal/package.json apps/web-employee-portal/
RUN --mount=type=cache,target=/root/.bun/install/cache \
	bun install --frozen-lockfile --ignore-scripts

# ---- build: bundle SPA with vite ----
FROM deps AS build
COPY packages/ui/ packages/ui/
# tsconfig.json is needed by both builds: packages/common/tsconfig.json
# extends it, and web-employee-portal's tsconfig references it.
COPY tsconfig.json ./
# @ims-erp/common has no tsconfig path alias; its package.json points at
# dist/, so the package must be fully copied and compiled before the
# web-employee-portal build. (bun install used --ignore-scripts, so `prepare` did not
# build it.)
COPY packages/common/ packages/common/
RUN bun run --cwd packages/common build
# @ims-erp/locales is source-only (no build step): web-employee-portal's tsconfig aliases
# it to ../../packages/locales/src/index.ts and src/i18n imports `en`/`id` at
# runtime, so vite needs the sources present.
COPY packages/locales/ packages/locales/
COPY apps/web-employee-portal/ apps/web-employee-portal/
# Layout /app/apps/web-employee-portal + /app/packages/ui keeps the tsconfig path
# aliases (@ims-erp/ui/*, @workspace/ui/* -> ../../packages/ui/src/*) valid.
RUN bun run --cwd apps/web-employee-portal build

# ---- runtime: nginx serving static files ----
FROM nginx:1.31-alpine AS runtime
COPY apps/web-employee-portal/.docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web-employee-portal/dist /usr/share/nginx/html
EXPOSE 80
