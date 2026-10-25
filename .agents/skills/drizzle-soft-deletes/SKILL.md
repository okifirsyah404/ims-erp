---
name: drizzle-soft-deletes
description: Soft-delete convention for Drizzle ORM schemas in this project — rows are never hard-deleted by feature code; instead a nullable deleted_at column (unixTimestampNullable, bigint unix milliseconds via the shared custom type) marks deletion. Use when adding or reviewing tables that support deletion, writing delete/remove operations, building queries that must exclude deleted rows, designing unique constraints on deletable tables, restoring rows, or planning purge jobs. Depends on the drizzle-unix-timestamp skill for the datetime type itself. Does NOT cover hard-delete infrastructure, audit logging implementation, or the repository pattern (a future pattern will centralize the deleted-filter helpers).
license: MIT
metadata:
  author: OpenAgentic
  version: "1.0.0"
  dependsOn: drizzle-unix-timestamp
---

# Drizzle Soft Deletes Convention

Deleted rows are never removed by feature code. Every deletable table carries a nullable `deleted_at` column — `unixTimestampNullable` (bigint unix milliseconds from the shared custom type). `NULL` means the row is alive; a value means it was deleted at that instant. The timestamp doubles as the deletion audit record; there is **no** `isDeleted` boolean.

## When to Apply

Reference these guidelines when:

- Defining tables that support deletion (`deletedAt`, soft delete, trash)
- Writing delete/remove operations in services or repositories
- Writing any query against a soft-delete table (selects, updates, joins, relational queries)
- Designing unique constraints or indexes on deletable tables
- Implementing restore/undelete flows
- Planning background purge jobs

## The Convention

```typescript
import { unixTimestampNullable } from '@providers/drizzle/schemas/unix-timestamp';

export const documents = pgTable('documents', {
  // ...business columns...
  deletedAt: unixTimestampNullable('deleted_at'),
});
```

| State | `deleted_at` |
|-------|--------------|
| Alive | `NULL` |
| Deleted | unix ms (instant of deletion) |
| Restored | `NULL` again |

## Quick Reference

### 1. Column & Delete Semantics (CRITICAL)

- `column-use-deleted-at` - Every deletable table gets nullable `deletedAt` (ms via shared custom type); no boolean flag
- `query-always-filter-deleted` - Every query on a soft-delete table filters `isNull(deletedAt)` unless explicitly including deleted rows
- `delete-never-hard-delete` - Feature code sets `deletedAt: new Date()`; hard `DELETE` is purge/infra only

### 2. Constraints & Recovery (HIGH)

- `unique-constraint-partial` - Unique values must be reusable after deletion: partial unique index `WHERE deleted_at IS NULL`
- `restore-clears-timestamp` - Restore sets `deletedAt: null`; deletion history belongs in an audit log, not column tricks

### 3. Leaks & Lifecycle (MEDIUM-HIGH)

- `relations-filter-deleted` - Relational query `with` cannot filter deleted nested rows — know the leak
- `purge-expired-rows` - A scheduled job hard-deletes rows past a retention window that must be defined per table

## Anti-Patterns Cheat Sheet

| Never | Instead |
|-------|---------|
| `isDeleted: boolean('is_deleted')` | `deletedAt: unixTimestampNullable('deleted_at')` |
| `db.delete(table).where(...)` in feature code | `db.update(table).set({ deletedAt: new Date() })` |
| `select()` without `isNull(table.deletedAt)` | every select filtered, or explicit "include deleted" path |
| `unique('uq_x').on(t.email)` on deletable table | `uniqueIndex('uq_x').on(t.email).where(sql`deleted_at is null`)` |
| Global retention constant | retention defined per table |

## References

1. [drizzle-unix-timestamp skill](../drizzle-unix-timestamp/SKILL.md) — the datetime type
2. [Drizzle select operators](https://orm.drizzle.team/docs/select)
3. [Drizzle indexes & constraints](https://orm.drizzle.team/docs/indexes-constraints)
4. [Drizzle partial indexes (sql condition)](https://orm.drizzle.team/docs/indexes-constraints#partial-indexes)

## Source Files

| File | Description |
|------|-------------|
| [references/](references/) | Individual rule files with incorrect/correct examples |
| [assets/templates/_template.md](assets/templates/_template.md) | Template for creating new rules |
| [AGENTS.md](AGENTS.md) | Agent-oriented index with impact rationale |
