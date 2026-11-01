# syntax=docker/dockerfile:1
# Build context is the repository root:
#   docker build -f apps/backend/Dockerfile .
# The backend is compiled to a single self-contained executable with Bun's
# `--compile` mode (the `build` script in apps/backend/package.json), so the
# runtime image ships one binary plus the two things that cannot be embedded:
# exiftool's perl script and libvips. @ims-erp/common is a workspace dep
# exposing compiled dist/, so it is built inside the image first.

# ---- deps: install workspace deps ----
FROM oven/bun:1.4-alpine AS deps
WORKDIR /app
COPY package.json bun.lock bunfig.toml ./
COPY packages/common/package.json packages/common/
COPY apps/backend/package.json apps/backend/
RUN --mount=type=cache,target=/root/.bun/install/cache \
	bun install --frozen-lockfile --ignore-scripts

# ---- build: compile @ims-erp/common, then the backend executable ----
FROM deps AS build
# The executable bundles whatever the host's bun install produced, so install
# for the RUNTIME platform, not the host architecture. @resvg/resvg-js and sharp
# pick prebuilt natives from the target libc at install time, which here yields
# @resvg/resvg-js-linux-x64-musl, @img/sharp-linuxmusl-x64 and
# @img/sharp-libvips-linuxmusl-x64 — the Linux natives the executable embeds.
# ponytail: amd64-only, matching compose and the deploy workflow `platforms`.
# For multi-arch, move deps to `FROM --platform=$BUILDPLATFORM` and pass bun
# `--os linux --cpu x64 --libc musl`-style flags instead.
FROM --platform=linux/amd64 deps AS build
COPY packages/common/ packages/common/
COPY tsconfig.json ./
RUN bun run --cwd packages/common build
# apps/backend/.dockerignore keeps the host's dist/, .env, data/ and tests out
# of this layer so the compile is hermetic.
COPY apps/backend/ apps/backend/
# Same command as the package.json `build` script:
#   bun build src/index.ts --compile --outfile dist/server \
#     --minify-whitespace --minify-syntax --target bun
RUN bun run --cwd apps/backend build
# Fail here, not at container start, when the executable was not produced.
RUN test -x apps/backend/dist/server

# ---- runtime: run the compiled executable ----
FROM oven/bun:1.4-alpine AS runtime
# `--target bun` compiles against glibc (it never downloads a runtime), so the
# musl-based Alpine image needs a glibc shim for the executable to start.
# gcompat is a translation layer, not a full glibc: if an unimplemented symbol
# is ever hit, switch only this stage to `oven/bun:1.4-slim`.
RUN apk add --no-cache libstdc++ libgcc gcompat
WORKDIR /app
# The executable is self-contained: the only native dependency left in the tree
# (the DiceBear image chain: sharp / libvips / resvg / exiftool) was replaced by
# HTTP calls to the DiceBear API, so nothing needs to ship beside the binary.
COPY --from=build /app/apps/backend/dist/server ./server
# Keep process.cwd() at the backend workspace: the config loader resolves
# `.env` from cwd (config/loaders/config.loader.ts) and the avatar worker
# writes to cwd-relative `.tmp/avatars` (src/app/user/queues/avatar.worker.ts).
WORKDIR /app/apps/backend
# Absolute path: the base image entrypoint resolves a relative CMD against its
# own cwd (/app), not this WORKDIR, and would fall through to `bun run`.
CMD ["/app/server"]
