# ADR-0005 — Custom Drizzle Client Coexists with @nestjs/drizzle Token

- **Status:** accepted (2026-10-25)
- **Context:** The repository has a custom module-owned `drizzleDB` singleton
  (`src/providers/drizzle/drizzle.ts`) wired into Better Auth's drizzle adapter
  and (scaffold-era) repositories, plus `DrizzleModule.forRootAsync({ db:
drizzleDB })` registering `@nestjs/drizzle` whose `@InjectDrizzle()` token is
  the established repository DI pattern (`user.repository.ts`).
- **Decision:** Keep both, with a clear role split:
  - `drizzleDB` singleton: **provider bootstrap only** (Better Auth adapter,
    seeder/CLI scripts). Schemas/relations live next to it.
  - Repositories: **always** inject via `@InjectDrizzle()` from
    `@nestjs/drizzle` — never import `drizzleDB` directly. Existing
    scaffold-era files that import `drizzleDB` inside repositories
    (e.g. `customer.repository.ts`) are defects fixed when their domain slice
    is built.
- **Consequences:**
  - One connection set per process; no duplicate pools created to satisfy file
    naming or module symmetry feelings.
  - Services gain transaction ownership by passing tx handles obtained from
    the injected client into repositories.
- **Alternatives considered:**
  - Replace `@nestjs/drizzle` with custom tokens (rejected: installed and
    already the proved pattern; the package's consistent DI surface reduces
    maintenance).
  - Relative import of `drizzleDB` in repos (rejected: untestable DIs and
    hidden singleton coupling).
