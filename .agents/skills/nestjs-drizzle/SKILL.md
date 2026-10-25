---
name: nestjs-drizzle
description: NestJS integration patterns for Drizzle ORM using the @nestjs/drizzle package. This skill should be used when configuring DrizzleModule, injecting databases with @InjectDrizzle, defining Drizzle schemas and relations, writing custom repositories, running transactions, applying migrations with drizzle-kit, or registering multiple databases in NestJS. This skill does NOT cover general Drizzle query syntax in depth (use https://orm.drizzle.team/docs) or other ORMs like TypeORM (use nestjs-best-practices skill).
license: MIT
metadata:
  author: OpenAgentic
  version: "1.0.0"
  source: https://docs.nestjs.com/data/drizzle
---

# NestJS + Drizzle Best Practices

Integration guide for Drizzle ORM in NestJS applications via `@nestjs/drizzle`. Contains 11 rules across 6 categories, prioritized by impact. Covers Drizzle v1 (currently `rc` tag); `@nestjs/drizzle` also supports Drizzle v0.35+, where only relations/relational queries differ.

## When to Apply

Reference these guidelines when:

- Setting up or reviewing `DrizzleModule.forRoot()` / `forRootAsync()` configuration
- Defining Drizzle schemas, relations, and inferred types
- Injecting databases with `@InjectDrizzle()` or `getDrizzleToken()`
- Writing repositories or services that query the database
- Managing transactions across services
- Configuring migrations with `drizzle-kit`
- Registering multiple database connections
- Writing unit tests for classes that depend on the database

## Rule Categories by Priority

| Priority | Category | Impact | Prefix |
|----------|----------|--------|--------|
| 1 | Setup & Registration | CRITICAL | `setup-` |
| 2 | Injection | CRITICAL | `inject-` |
| 3 | Schema & Types | HIGH | `schema-` |
| 4 | Queries & Transactions | HIGH | `query-` |
| 5 | Migrations & Multi-DB | MEDIUM-HIGH | `migrate-` / `multidb-` |
| 6 | Repositories | MEDIUM | `repo-` |

## Quick Reference

### 1. Setup & Registration (CRITICAL)

- `setup-use-driver-entrypoint` - Import `drizzle()` from the matching driver entrypoint (`drizzle-orm/node-postgres`, `drizzle-orm/mysql2`, etc.)
- `setup-forroot-options` - Use `DrizzleModule.forRoot()` with `drizzle` + `connection`; pool closes automatically on shutdown
- `setup-forroot-async-config` - Use `forRootAsync()` when options come from `ConfigService`; supports `useFactory`, `useClass`, `useExisting`

### 2. Injection (CRITICAL)

- `inject-inject-drizzle-decorator` - Inject with `@InjectDrizzle()` anywhere without importing modules; use `getDrizzleToken()` in factories/tests

### 3. Schema & Types (HIGH)

- `schema-infer-types` - Derive row types with `$inferSelect`/`$inferInsert`; declare a shared `Database` type alias
- `schema-relations-define-relations` - Declare relations once with `defineRelations()` and pass to `drizzle()` for typed `db.query` API

### 4. Queries & Transactions (HIGH)

- `query-transaction-scope` - Run all queries of a transaction through `tx`, never the injected `db`; repository methods are not transaction-aware
- `query-relational-queries` - Use `db.query.<table>.findFirst/findMany` with `with` for nested reads instead of manual joins

### 5. Migrations & Multi-DB (MEDIUM-HIGH)

- `migrate-drizzle-kit` - Manage schema changes with `drizzle-kit generate`/`migrate`; migrate-on-startup only via `forRootAsync` factory; never concurrent startup migrations
- `multidb-named-tokens` - Register multiple databases with unique names; inject with `@InjectDrizzle('name')`; never register two unnamed databases

### 6. Repositories (MEDIUM)

- `repo-custom-repository` - Keep a table's queries in a plain `@Injectable()` repository; mock the repository, not the chainable query builder

## Installation

```bash
npm install --save @nestjs/drizzle drizzle-orm@rc pg
npm install --save-dev drizzle-kit@rc @types/pg
```

Same steps for every database: install the driver, import `drizzle()` from the matching entrypoint (e.g., `drizzle-orm/mysql2`, `drizzle-orm/libsql`).

## References

1. [NestJS Drizzle chapter](https://docs.nestjs.com/data/drizzle)
2. [Drizzle ORM docs](https://orm.drizzle.team/docs)
3. [Drizzle upgrade to v1](https://orm.drizzle.team/docs/upgrade-v1)
4. [Drizzle Kit overview](https://orm.drizzle.team/docs/kit-overview)
5. [nestjs-cls Drizzle adapter](https://papooch.github.io/nestjs-cls/plugins/available-plugins/transactional/drizzle-orm-adapter)

## Source Files

| File | Description |
|------|-------------|
| [references/](references/) | Individual rule files with incorrect/correct examples |
| [assets/templates/_template.md](assets/templates/_template.md) | Template for creating new rules |
| [AGENTS.md](AGENTS.md) | Agent-oriented index with impact rationale |
