# syntax=docker/dockerfile:1
# Build context is the repository root:
#   docker build -f apps/backend/Dockerfile .
# Backend runs from source (Bun resolves tsconfig paths natively); no bundling
# step. @ims-erp/common is a workspace dep exposing compiled dist/, so it is
# built inside the image.

# ---- deps: install workspace deps ----
FROM oven/bun:1.4-alpine AS deps
WORKDIR /app
COPY package.json bun.lock bunfig.toml ./
COPY packages/common/package.json packages/common/
COPY apps/backend/package.json apps/backend/
RUN --mount=type=cache,target=/root/.bun/install/cache \
	bun install --frozen-lockfile --ignore-scripts

# ---- build: compile @ims-erp/common to dist/ ----
FROM deps AS build
COPY packages/common/ packages/common/
COPY tsconfig.json ./
RUN bun run --cwd packages/common build
COPY apps/backend/ apps/backend/

# ---- runtime: run the Elysia server from source ----
FROM oven/bun:1.4-alpine AS runtime
WORKDIR /app
COPY --from=build /app /app
WORKDIR /app/apps/backend
EXPOSE 3000
CMD ["bun", "run", "src/index.ts"]
