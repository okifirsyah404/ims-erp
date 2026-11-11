# syntax=docker/dockerfile:1
# Build context is the repository root:
#   docker build -f apps/backend/Dockerfile .
# The backend is compiled to a single self-contained executable with Bun's
# `--compile` mode (the `build` script in apps/backend/package.json), so the
# runtime image is a plain Alpine base plus the binary. @ims-erp/common is a
# workspace dep exposing compiled dist/, so it is built inside the image first;
# @ims-erp/locales and @ims-erp/react-email are source-only deps that are
# copied straight into the build.

# ---- deps: install workspace deps ----
# No --platform pin: each stage already builds for the build target by default,
# which is what the install needs — bun resolves the native packages (@resvg,
# @img) from the installer's libc and the executable embeds whatever was
# installed, so the tree must match the runtime, not the build host.
FROM oven/bun:1.4-alpine AS deps
WORKDIR /app
COPY package.json bun.lock bunfig.toml ./
COPY packages/common/package.json packages/common/
# @ims-erp/locales is a source-only workspace package (exports resolve to
# src/*.ts); bun requires its manifest at install time.
# @ims-erp/react-email is also source-only — same requirement.
COPY packages/locales/package.json packages/locales/
COPY packages/react-email/package.json packages/react-email/
COPY apps/backend/package.json apps/backend/
RUN --mount=type=cache,target=/root/.bun/install/cache \
	bun install --frozen-lockfile --ignore-scripts

# ---- build: compile @ims-erp/common, then the backend executable ----
FROM deps AS build
COPY packages/common/ packages/common/
# @ims-erp/locales has no build step - its package.json exports point straight
# at src/*.ts, so the sources are all the compile needs. @ims-erp/react-email
# is source-only the same way.
COPY packages/locales/ packages/locales/
COPY packages/react-email/ packages/react-email/
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
FROM alpine:3.24 AS runtime
# The executable is musl-linked (Bun resolves `--target bun` to the build host's
# libc, and the build stage is Alpine), so no glibc shim is needed — verified
# with `ldd`: ld-musl-x86_64.so.1, libstdc++.so.6, libgcc_s.so.1.
#   - libstdc++ / libgcc: required by the Bun runtime linked into the executable.
#   - tzdata: the app reads process.env.TZ (see docker-compose `TZ`), and Alpine
#     ships no zone database, so without this the app silently runs in UTC.
#   - CA bundle: already in the base image; the avatar worker calls the DiceBear
#     API over HTTPS.
RUN apk add --no-cache libstdc++ libgcc tzdata
# Non-root: the avatar worker writes to a cwd-relative `.tmp/avatars`, so the
# whole workspace dir must belong to the runtime user.
RUN addgroup -S app && adduser -S -G app app \
	&& mkdir -p /app/apps/backend \
	&& chown -R app:app /app
WORKDIR /app
COPY --from=build /app/apps/backend/dist/server ./server
# Keep process.cwd() at the backend workspace: the config loader resolves
# `.env` from cwd (config/loaders/config.loader.ts) and the avatar worker
# writes to cwd-relative `.tmp/avatars` (src/app/user/queues/avatar.worker.ts).
WORKDIR /app/apps/backend
USER app
# Absolute path: relative CMD entries resolve against the image's own WORKDIR
# at start, not the WORKDIR above.
CMD ["/app/server"]
