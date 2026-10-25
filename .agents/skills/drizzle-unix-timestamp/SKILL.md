---
name: drizzle-unix-timestamp
description: Project datetime convention for Drizzle ORM with PostgreSQL — all datetimes are stored as unix milliseconds since epoch in a bigint column, using the shared unixTimestamp custom types from apps/backend/src/providers/drizzle/schemas/unix-timestamp.ts (Date at the app layer, ms at the driver layer, converted via luxon). Use when defining any Drizzle schema column that holds a date/time (createdAt, updatedAt, expiresAt, deletedAt, scheduledAt...), writing queries that filter or sort by time, setting column defaults, or exposing datetime fields through an API. Does NOT cover non-PostgreSQL dialects or Drizzle query syntax in general.
license: MIT
metadata:
  author: OpenAgentic
  version: "1.0.0"
  canonicalType: apps/backend/src/providers/drizzle/schemas/unix-timestamp.ts
---

# Drizzle Unix Timestamp Convention

All datetimes in this project are stored as **unix milliseconds since epoch** in a PostgreSQL `bigint` column. Schema columns use the shared custom types; application code works with `Date` objects; conversion happens only inside the type.

## When to Apply

Reference these guidelines when:

- Defining any Drizzle schema column that holds a date/time (`createdAt`, `updatedAt`, `expiresAt`, `deletedAt`, `lastSeenAt`, ...)
- Setting defaults for time columns
- Writing queries that filter, sort, or paginate by time
- Exposing datetime fields through REST/GraphQL APIs
- Reviewing schema files for datetime correctness

## The Convention

| Layer | Representation |
|-------|---------------|
| PostgreSQL column | `bigint` — unix milliseconds since epoch |
| Drizzle schema | `unixTimestamp()` / `unixTimestampNullable()` custom types |
| Application code (TS) | `Date` objects |
| API boundary (REST/GraphQL) | ISO 8601 strings (converted to/from `Date` at the validation layer) |

JS `number` holds ms exactly up to ±2^53 ms (~273,790 years) — the driver data is a number, never a JS `BigInt`. Never `mode: 'bigint'`.

## Canonical Type

Defined once in `apps/backend/src/providers/drizzle/schemas/unix-timestamp.ts` — import it, do not redefine it:

```typescript
import { customType } from 'drizzle-orm/pg-core';
import { DateTime } from 'luxon';

export const unixTimestamp = customType<{ data: Date; driverData: bigint | number }>({
  dataType() {
    return 'bigint';
  },
  toDriver(value: Date) {
    return DateTime.fromJSDate(value).toMillis();
  },
  fromDriver(value: bigint | number) {
    return DateTime.fromMillis(Number(value)).toJSDate();
  },
});

export const unixTimestampNullable = customType<{
  data: Date | null;
  driverData: bigint | number | null;
}>({
  dataType() {
    return 'bigint';
  },
  toDriver(value: Date | null) {
    return value ? DateTime.fromJSDate(value).toMillis() : null;
  },
  fromDriver(value: bigint | number | null) {
    return value === null ? null : DateTime.fromMillis(Number(value)).toJSDate();
  },
});
```

## Quick Reference

### 1. Column Types (CRITICAL)

- `column-use-unixtimestamp-type` - Every datetime column uses the shared `unixTimestamp` custom types
- `column-never-native-datetime-types` - Forbid `timestamp()`, `datetime()`, `date()`, and hand-rolled `bigint()` datetime columns

### 2. Boundaries & Defaults (HIGH)

- `convert-iso-at-boundaries` - API accepts/returns ISO 8601; conversion to `Date` happens at the validation layer
- `default-fnf-date-now` - Defaults via `.$defaultFn(() => new Date())`; never `.defaultNow()` or SQL `now()`

### 3. Queries & Indexing (MEDIUM-HIGH)

- `query-comparisons-uniform` - Compare with `Date` objects (luxon helpers); never mix seconds vs ms literals
- `index-time-columns` - Index time columns used in range scans or cursor pagination
- `extend-type-for-new-dialects` - If a non-PG dialect is ever introduced, extend the custom types there — never per-schema conversions

## Anti-Patterns Cheat Sheet

| Never | Instead |
|-------|---------|
| `timestamp('created_at')` | `unixTimestamp('created_at')` |
| `bigint('created_at', { mode: 'bigint' })` | `unixTimestamp('created_at')` |
| `.defaultNow()` / SQL `now()` | `.$defaultFn(() => new Date())` |
| Seconds literals in queries (`1700000000`) | `DateTime.fromISO(...).toMillis()` / `Date` objects |
| Raw ms in API payloads | ISO 8601 strings (unless field is explicitly an epoch field) |

## References

1. [Drizzle pg-core column types](https://orm.drizzle.team/docs/column-types/pg#timestamp)
2. [Drizzle custom types](https://orm.drizzle.team/docs/custom-types)
3. [Luxon DateTime](https://moment.github.io/luxon/api-docs/index.html#datetime)

## Source Files

| File | Description |
|------|-------------|
| [references/](references/) | Individual rule files with incorrect/correct examples |
| [assets/templates/_template.md](assets/templates/_template.md) | Template for creating new rules |
| [AGENTS.md](AGENTS.md) | Agent-oriented index with impact rationale |
