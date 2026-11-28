# Stack Compatibility

Exact resolved versions, recorded from `bun.lock`. Sources are linked; verify
again before upgrading anything.

> 2026-10-28: `apps/backend-nest` (NestJS backend) deleted. The NestJS /
> `@thallesp/nestjs-better-auth` / `@nestjs/drizzle` / `@nestjs/bullmq` rows
> below are historical. `apps/backend-elysia` is the backend; its rows are
> re-recorded on the next verified install.

## Runtime matrix

| Component | Resolved | Manifest spec | Notes |
|---|---|---|---|
| Bun | 1.4.2 | `packageManager: "bun@1.4.2"` | Windows, all verified runs executed with it; Bun is also the backend runtime (`bun run --watch src/index.ts`) |
| Turborepo | 2.10.13 | `^2.10.13` | task graph: `build`→`^build`; `test`→`^build`; `lint`/`format`/`typecheck` dependency-chained |
| TypeScript | 6.0.3 channel | `^6.0.3` everywhere | `nodenext` module resolution |
| Elysia | 1.4.30 | `1.4.30` | backend framework; `@elysia/openapi` for docs |
| drizzle-orm | **1.0.0-rc channel** | `^1.0.0-rc.5` (backend-elysia) | Relational **v2** — see ADR-0004 |
| drizzle-kit | 1.0.0-rc.5 (root) | `^1.0.0-rc.5` | migration tooling; journal state unverified |
| PostgreSQL driver | `pg` 8.x | — | `drizzle-orm/node-postgres` entrypoint |
| Better Auth | 1.7.14 | `^1.7.14` + `@better-auth/{api-key,drizzle-adapter,passkey}` 1.7.14 | direct integration (no Nest adapter) |
| zod | 4.x | `^4.x` | boundary validation |
| Keyv / cache | keyv 6.x, `@keyv/redis` 6.x | — | Keyv TTL in ms; Better Auth `secondaryStorage` TTL in seconds (do not mix) |
| Vite / React web | vite 8.3.5, React 19.3.1, TanStack Query 5.66+, Router 1.130+ | — | `@tanstack/router-plugin` generates `routeTree.gen.ts` |
| TanStack Form (web-admin) | `@tanstack/react-form` 1.33.x | `^1.0.0` | form state for web forms since P7-6; rules come from the shared zod schemas in `@ims-erp/common` (validated with `schemaIssues`, no form-level validator adapter); reference form: `components/crm/lead-form-dialog.tsx` |
| Lint/test tooling | oxlint, prettier 3.9.10, vitest 4.x | - | verify per-workspace configs |
| @faker-js/faker | 10.6.0 | `^10.6.0` (backend, devDependency) | seeders only — never imported in runtime code or tests (`.agents/skills/faker`); note this table's driver row predates the `bun-sql` switch (`drizzle-orm/bun-sql` is the real entrypoint per `AGENTS.md`) |
| DiceBear HTTP API | `10.x` major (pinned in `avatar.worker.ts`) | external service, no package | user avatars: `10.x/initials/webp`, 72px, seed = display name. **v10 constraint:** `backgroundColor` is hex-pattern-validated — the legacy `transparent` value returns 400; send no background parameter. Object key `users/<id>/avatar.webp`, presigned per request |

## Auth integration specifics (Better Auth direct)

- Better Auth instance built in `src/providers/better-auth/auth.ts` with
  options split per option (`options/*.auth.ts`) and plugins under
  `plugins/*.auth.ts`.
- Session/secondary-storage TTLs: Better Auth options in **seconds**; Keyv
  cache TTL in **milliseconds** — do not mix units.

## Relational v2 requirements

- Relations declared via v2 APIs only.
- **Never mix v1 (`relations()`/`extending`) with v2 in the same schema file
  or client.** New tables must use v2 declarations.
- Adapter entrypoint: `@better-auth/drizzle-adapter/relations-v2`
  (`provider: 'pg'`, `schemaName: 'auth'`, `usePlural: true`).
- Sources: https://orm.drizzle.team/docs/relations ,
  https://better-auth.com/docs/adapters/drizzle — checked 2026-10-25.

## Unresolved issues

| Issue | Status |
|---|---|
| drizzle-orm/drizzle-kit on rc channel; rc→stable may change migration journal format | track before any upgrade; never regenerate the baseline migration |
| `dotenv-expand` pinned at `1000.0.0` (likely a version-selected snapshot) | verify expansion behavior when touching config; do not replace silently |
| `auth:generate` script uses `bunx auth@latest` (unpinned) | pin a version before running; never regenerate auth schema blindly |
| Web-admin `@tanstack/react-router` spec `^1.130.0` vs installed generator newer | harmless; keep lockfile authoritative |
| `@vite-pwa/workbox-build@8.0.15` and `@unplugin-pwa/core@0.0.8` import `findPackageJSON` from `node:module`, which Bun 1.4.x lacks (link error, so the portal's `astro build` failed on Bun) | patched with `bun patch` (`patches/`, `patchedDependencies` in the root `package.json`, ERP-0107): runtime lookup via `process.getBuiltinModule`, falling back to a `node_modules` walk-up / `createRequire`. A version bump of either package drops the patch: re-check `bun --bun run --cwd apps/web-customer-portal build` (only `@unplugin-pwa/core/dist/resolve-inspector-dist.mjs` still carries the static import as of `0.0.8`; the `@unplugin-pwa/vite` `0.0.8` files are clean) |
| Stack versions above re-recorded after backend-nest deletion; many rows carried over unverified for backend-elysia | re-verify from `bun.lock` on next backend work session |
