# NestJS Drizzle

**Version 1.0.0**
OpenAgentic
October 2026

> **Note:**
> This document is mainly for agents and LLMs to follow when maintaining,
> generating, or refactoring codebases. Humans may also find it useful,
> but guidance here is optimized for automation and consistency by AI-assisted workflows.

---

## Abstract

Integration guide for Drizzle ORM in NestJS applications via `@nestjs/drizzle`, designed for AI agents and LLMs. Covers Drizzle v1 (published under the `rc` tag); `@nestjs/drizzle` also supports Drizzle v0.35+, where only relations and relational queries differ (see [Upgrading to v1](https://orm.drizzle.team/docs/upgrade-v1)). Contains 11 rules across 6 categories, prioritized by impact from critical (module setup, database injection) to incremental (repository organization).

---

## Table of Contents

1. [Setup & Registration](references/_sections.md#1-setup--registration) — **CRITICAL**
   - 1.1 [Import drizzle from the Matching Driver Entrypoint](references/setup-use-driver-entrypoint.md) — CRITICAL (Each driver has its own `drizzle()` entrypoint and database type; a wrong import fails at runtime or produces mismatched types)
   - 1.2 [Use DrizzleModule.forRoot with drizzle and connection Options](references/setup-forroot-options.md) — CRITICAL (Manual pool creation leaks connections on shutdown; `forRoot()` closes the pool per application instance, including e2e tests)
   - 1.3 [Configure Asynchronously with forRootAsync](references/setup-forroot-async-config.md) — CRITICAL (Reading `process.env` at module-import time bypasses validation and fails when config loads later; `useFactory`/`useClass`/`useExisting` integrate with `ConfigService`)
2. [Injection](references/_sections.md#2-injection) — **CRITICAL**
   - 2.1 [Inject the Database with @InjectDrizzle](references/inject-inject-drizzle-decorator.md) — CRITICAL (Wrapper providers around the token duplicate built-in behavior; `@InjectDrizzle()` needs no module imports and `getDrizzleToken()` serves factories and tests)
3. [Schema & Types](references/_sections.md#3-schema--types) — **HIGH**
   - 3.1 [Derive Row Types with $inferSelect/$inferInsert and a Shared Database Alias](references/schema-infer-types.md) — HIGH (Hand-written model classes drift from tables; inferred types guarantee the type matches the schema, and a shared `Database` alias keeps `db.query` typed)
   - 3.2 [Declare Relations Once with defineRelations](references/schema-relations-define-relations.md) — HIGH (Ad-hoc joins duplicate association knowledge and lose nested-result typing; `defineRelations()` plus the `relations` option enables the fully typed `db.query` API)
4. [Queries & Transactions](references/_sections.md#4-queries--transactions) — **HIGH**
   - 4.1 [Run All Queries of a Transaction through tx](references/query-transaction-scope.md) — HIGH (Queries built from the outer `db` run outside the transaction and survive rollback; repository methods capturing `db` are not transaction-aware)
   - 4.2 [Use Relational Queries for Nested Reads](references/query-relational-queries.md) — HIGH (Manual joins return flat tuples requiring reshaping, and per-row fetch loops cause N+1; `db.query` with `with` fetches nested data in one typed query)
5. [Migrations & Multi-DB](references/_sections.md#5-migrations--multi-db) — **MEDIUM-HIGH**
   - 5.1 [Manage Schema Changes with drizzle-kit](references/migrate-drizzle-kit.md) — MEDIUM-HIGH (Concurrent startup migrations race across instances; `drizzle-kit generate`/`migrate` as a deployment step keeps migrations reviewed and applied exactly once)
   - 5.2 [Register Multiple Databases with Unique Named Tokens](references/multidb-named-tokens.md) — MEDIUM-HIGH (Two unnamed `forRoot()` calls share one injection token; the second silently overrides the first)
6. [Repositories](references/_sections.md#6-repositories) — **MEDIUM**
   - 6.1 [Keep a Table's Queries in a Custom Repository](references/repo-custom-repository.md) — MEDIUM (Drizzle's chainable query builder is hard to mock in unit tests; a repository gives a stable mock seam — but the caveat is real: repository methods cannot join an existing transaction)

---

## References

1. [https://docs.nestjs.com/data/drizzle](https://docs.nestjs.com/data/drizzle)
2. [https://orm.drizzle.team/docs](https://orm.drizzle.team/docs)
3. [https://orm.drizzle.team/docs/upgrade-v1](https://orm.drizzle.team/docs/upgrade-v1)
4. [https://orm.drizzle.team/docs/kit-overview](https://orm.drizzle.team/docs/kit-overview)
5. [https://papooch.github.io/nestjs-cls/plugins/available-plugins/transactional/drizzle-orm-adapter](https://papooch.github.io/nestjs-cls/plugins/available-plugins/transactional/drizzle-orm-adapter)

---

## Source Files

This document was compiled from individual reference files. For detailed editing or extension:

| File | Description |
|------|-------------|
| [references/_sections.md](references/_sections.md) | Category definitions and impact ordering |
| [assets/templates/_template.md](assets/templates/_template.md) | Template for creating new rules |
| [SKILL.md](SKILL.md) | Quick reference entry point |
| [metadata.json](metadata.json) | Version and reference URLs |
