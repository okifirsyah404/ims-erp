# syntax=docker/dockerfile:1
# Build context must be the repository root:
#   docker build -f apps/web-admin/Dockerfile .

# ---- build: bundle SPA with vite ----
FROM oven/bun:1.3-alpine AS build
WORKDIR /app
COPY package.json bun.lock bunfig.toml ./
COPY packages/common/package.json packages/common/
COPY packages/ui/package.json packages/ui/
COPY apps/backend/package.json apps/backend/
COPY apps/web-admin/package.json apps/web-admin/
RUN bun install --frozen-lockfile
COPY packages/common/ packages/common/
COPY packages/ui/ packages/ui/
COPY apps/web-admin/ apps/web-admin/
RUN bun run --filter '@ims-erp/web-admin' build

# ---- runtime: serve static files with nginx ----
FROM nginx:1.29-alpine AS runtime
COPY apps/web-admin/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web-admin/dist /usr/share/nginx/html
EXPOSE 80
