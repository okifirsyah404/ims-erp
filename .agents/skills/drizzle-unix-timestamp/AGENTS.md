# Drizzle Unix Timestamp

**Version 1.0.0**
OpenAgentic
October 2026

> **Note:**
> This document is mainly for agents and LLMs to follow when maintaining,
> generating, or refactoring codebases. Humans may also find it useful,
> but guidance here is optimized for automation and consistency by AI-assisted workflows.

---

## Abstract

Project datetime convention for Drizzle ORM with PostgreSQL. All datetimes are stored as **unix milliseconds since epoch** in a `bigint` column, using the shared custom types from `apps/backend/src/providers/drizzle/schemas/unix-timestamp.ts`: app-level TypeScript works with `Date` objects, the driver layer works with ms numbers (JS `number` is exact to ±2^53 ms — never `mode: 'bigint'`), conversion happens via luxon inside the type. The API boundary speaks ISO 8601. PostgreSQL-only; if a new dialect is ever introduced, the shared types are extended, not forked. Contains 7 rules across 3 categories, prioritized by impact from critical (column types) to incremental (indexing, extension).

---

## Table of Contents

1. [Column Types](references/_sections.md#1-column-types) — **CRITICAL**
   - 1.1 [Use the Shared unixTimestamp Custom Type](references/column-use-unixtimestamp-type.md) — CRITICAL (Hand-rolled bigint columns have no `Date` conversion, forcing every consumer to convert manually — the seconds-vs-ms bug class)
   - 1.2 [Forbid Native Datetime Types and Raw bigint Columns](references/column-never-native-datetime-types.md) — CRITICAL (`timestamp`/`timestamptz`/`date` serialize inconsistently across drivers and lose precision; one representation eliminates timezone drift)
2. [Boundaries & Defaults](references/_sections.md#2-boundaries--defaults) — **HIGH**
   - 2.1 [Accept ISO 8601 at the API Boundary](references/convert-iso-at-boundaries.md) — HIGH (Raw ms payloads are ambiguous to clients; validation converts ISO 8601 to `Date`, which the custom types store as ms)
   - 2.2 [Set Defaults with $defaultFn(() => new Date())](references/default-fnf-date-now.md) — HIGH (`.defaultNow()` produces a native SQL default incompatible with bigint storage)
3. [Queries & Indexing](references/_sections.md#3-queries--indexing) — **MEDIUM-HIGH**
   - 3.1 [Compare Times with Date Objects](references/query-comparisons-uniform.md) — MEDIUM-HIGH (Numeric literals invite the classic seconds-vs-ms mixing bug that silently matches nothing)
   - 3.2 [Index Time Columns Used in Range Scans or Cursor Pagination](references/index-time-columns.md) — MEDIUM (Time-ordered queries and keyset pagination degrade to sequential scans without an index)
   - 3.3 [Extend the Shared Custom Types for New Dialects](references/extend-type-for-new-dialects.md) — MEDIUM (Per-schema inline conversions fork the convention; all datetime conversion stays in one module)

---

## References

1. [https://orm.drizzle.team/docs/column-types/pg#timestamp](https://orm.drizzle.team/docs/column-types/pg#timestamp)
2. [https://orm.drizzle.team/docs/custom-types](https://orm.drizzle.team/docs/custom-types)
3. [https://moment.github.io/luxon/api-docs/index.html#datetime](https://moment.github.io/luxon/api-docs/index.html#datetime)

---

## Source Files

This document was compiled from individual reference files. For detailed editing or extension:

| File | Description |
|------|-------------|
| [references/_sections.md](references/_sections.md) | Category definitions and impact ordering |
| [assets/templates/_template.md](assets/templates/_template.md) | Template for creating new rules |
| [SKILL.md](SKILL.md) | Quick reference entry point (includes the canonical type source inline) |
| [metadata.json](metadata.json) | Version and reference URLs |
