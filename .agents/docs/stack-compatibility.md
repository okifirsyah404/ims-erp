# Stack Compatibility

Exact resolved versions from `bun.lock` and installed sources, recorded
2026-10-25. Sources are linked; verify again before upgrading anything.

## Runtime matrix

| Component | Resolved | Manifest spec | Notes |
|---|---|---|---|
| Bun | 1.4.2 | `packageManager: "bun@1.4.2"` | Windows, all verified runs executed with it |
| Turborepo | 2.10.13 | `^2.10.13` | task graph: `build`→`^build`; `test`→`^build`; `lint`/`format`/`typecheck` dependency-chained |
| TypeScript | 6.0.3 channel | `^6.0.3` everywhere | `nodenext` module resolution, `emitDecoratorMetadata` on; thallesp peer accepts TS 6 |
| Node runtime | Node (not Bun) for `start:prod` (`node dist/main`) | — | Bun is the package manager only; do not switch backend runtime to Bun |
| NestJS | 12.2.0 channel | core/common/config/platform-fastify/etc. | Fastify adapter, `bodyParser: false` set in `main.ts` |
| `@nestjs/drizzle` | 0.0.2 | `^0.0.2` | peer allows `drizzle-orm >=1.0.0-0` |
| drizzle-orm | **1.0.0-rc.4** | `^1.0.0-rc.4` | Relational **v2** in active use (`defineRelationsPart`, `r.one`) — see ADR-0004 |
| drizzle-kit | 1.0.0-rc.4 | `^1.0.0-rc.4` | migration tooling; unknown `meta` journal state |
| PostgreSQL driver | `pg` 8.23.1 | `^8.23.1` | `drizzle/orm/node-postgres` entrypoint with `connection:` config |
| Better Auth | 1.7.12 | `^1.7.12` + `@better-auth/{drizzle-adapter,i18n,passkey}` 1.7.12 | adapter peer accepts `>=1.0.0-rc.1 <2`, satisfied |
| `@thallesp/nestjs-better-auth` | 2.8.0 | `^2.8.0` | peer: NestJS 12, better-auth >=1.5 <2, express ^5 (optional), TS ^5.9.2\|\|^6 |
| zod | 4.6.7 | `^4.6.7` | ConfigModule schemas, future DTOs |
| Keyv / cache | keyv 6.1.0, `@keyv/redis` 6.1.0, `@nestjs/cache-manager` 12.0.1, cache-manager 7.2.9 | — | Keyv TTL in ms; Better Auth `secondaryStorage` TTL in seconds (both handled) |
| BullMQ | `@nestjs/bullmq` 12.0.0, bullmq 6.4.1 | — | connection from Redis config, `defaultJobOptions.attempts: 3` |
| Vite / React web | vite 8.3.5, React 19.3.1, TanStack Query 5.66+, Router 1.130+ (generator 1.168.48/core 1.171.39 in lock), Form 1.0+ | — | `@tanstack/router-plugin` generates `routeTree.gen.ts` |
| Lint/test tooling | vitest 4.1.12, oxlint 1.89.0, prettier 3.9.10, supertest 7.3.1 | — | vitest globals + `vite-tsconfig-paths` |

## Auth integration specifics (`@thallesp/nestjs-better-auth`)

- Requires Fastify body-parser disabled before route registration
  (`main.ts` sets `bodyParser: false`) so better-auth can read raw bodies.
- `AuthModule.forRootAsync({ useFactory: () => ({ auth }) })` is registered in
  `app.module.ts`; guard/session decorators come from the integration
  (see skill `nestjs-better-auth` in `.agents/skills/`).
- Source: https://github.com/thallesp/nestjs-better-auth — checked 2026-10-25.

## Relational v2 requirements

- Relations declared via `defineRelationsPart(...)` (v2), combined into
  `drizzleDB` at construction: `relations: { ...authRelations, ...erpRelations }`.
- **Never mix v1 (`relations()`/` extending`) with v2 in the same schema file or
  client.** New tables must be added through v2 declarations.
- Adapter entrypoint: `@better-auth/drizzle-adapter/relations-v2` (imported in
  `auth-options.ts`, `provider: 'pg'`, `schemaName: 'auth'`, `usePlural: true`).
- Sources: https://orm.drizzle.team/docs/relations ,
  https://better-auth.com/docs/adapters/drizzle — checked 2026-10-25.

## Cache and queues

- `CacheModule.registerAsync` — `ttl: 300_000` (**ms**, matched to repository
  docstrings that say "5-minute TTL"), `namespace: 'ims-erp'` prefixes physical
  Redis keys (e.g. `ims-erp:user:<id>`).
- `BullModule.forRootAsync` — separate `queueDb` Redis config supported.
- Source: https://docs.nestjs.com/data/caching — checked 2026-10-25.

## Unresolved issues

| Issue | Status |
|---|---|
| drizzle-orm/drizzle-kit on rc channel; rc→stable may change migration journal format | track before any upgrade; never regenerate the baseline migration |
| `dotenv-expand` pinned at `1000.0.0` (likely a version-selected snapshot) | verify expansion behavior when touching config; do not replace silently |
| `@nestjs/i18n` at `^0.0.1` and `@nestjs/http-client` at `^0.0.2` — version ranges look anomalous | inspect before first use; not exercised by any code yet |
| `auth:generate` script uses `bunx auth@latest` (unpinned) | pin a version before running; never regenerate auth schema blindly |
| Web-admin `@tanstack/react-router` spec `^1.130.0` vs installed generator newer | harmless; keep lockfile authoritative |
