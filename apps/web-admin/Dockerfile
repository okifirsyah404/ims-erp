# syntax=docker/dockerfile:1
# Build context is the repository root:
#   docker build -f apps/web-admin/Dockerfile .
#   docker compose build web-admin

# ---- deps: install workspace deps (build needs devDeps) ----
# bun.lock lists every workspace; manifests for web-admin + packages/ui (its
# only imported workspace dep, via tsconfig path aliases) are provided. Other
# workspaces are skipped with a note by bun.
FROM oven/bun:1.4-alpine AS deps
WORKDIR /app
COPY package.json bun.lock bunfig.toml ./
COPY packages/ui/package.json packages/ui/
# web-admin imports @ims-erp/common (browser-safe permission catalog); bun
# requires the workspace manifest at install time.
COPY packages/common/package.json packages/common/
COPY apps/web-admin/package.json apps/web-admin/
RUN --mount=type=cache,target=/root/.bun/install/cache \
	bun install --frozen-lockfile --ignore-scripts

# ---- build: bundle SPA with vite ----
FROM deps AS build
COPY packages/ui/ packages/ui/
# tsconfig.json is needed by both builds: packages/common/tsconfig.json
# extends it, and web-admin's tsconfig references it.
COPY tsconfig.json ./
# @ims-erp/common has no tsconfig path alias; its package.json points at
# dist/, so the package must be fully copied and compiled before the
# web-admin build. (bun install used --ignore-scripts, so `prepare` did not
# build it.)
COPY packages/common/ packages/common/
RUN bun run --cwd packages/common build
COPY apps/web-admin/ apps/web-admin/
# Layout /app/apps/web-admin + /app/packages/ui keeps the tsconfig path
# aliases (@ims-erp/ui/*, @workspace/ui/* -> ../../packages/ui/src/*) valid.
RUN bun run --cwd apps/web-admin build

# ---- runtime: nginx serving static files ----
FROM nginx:1.29-alpine AS runtime
COPY apps/web-admin/.docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web-admin/dist /usr/share/nginx/html
EXPOSE 80
