---
title: Forbid timestamp(), datetime(), date() and raw bigint datetime columns
impact: CRITICAL
impactDescription: eliminates timezone drift and unit-mixing bugs at the schema level
tags: column, timestamp, datetime, convention
---

## Forbid timestamp(), datetime(), date() and raw bigint datetime columns

A single datetime representation is the whole point of the convention. Native `timestamp`/`timestamptz` columns store driver-specific formats that serialize inconsistently across drivers and tools; `date` loses time; raw `bigint` columns without the shared custom type have no `Date` conversion, forcing every consumer to convert manually (and eventually wrongly). All datetime columns go through `unixTimestamp` / `unixTimestampNullable`.

**Incorrect (what's wrong):**

```typescript
export const orders = pgTable('orders', {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(), // native type
  dueDate: date('due_date'),                         // loses time component
  cancelledAt: datetime('cancelled_at'),             // not even a pg type
  lastPingAt: bigint('last_ping_at', { mode: 'number' }), // untyped conversion burden
});
```

**Correct (what's right):**

```typescript
export const orders = pgTable('orders', {
  createdAt: unixTimestamp('created_at').notNull(),
  dueDate: unixTimestamp('due_date'),          // deadline at ms precision
  cancelledAt: unixTimestampNullable('cancelled_at'),
  lastPingAt: unixTimestampNullable('last_ping_at'),
});
```

**When NOT to use this pattern:**
- `timestamptz` is acceptable only in database-managed infrastructure (migration bookkeeping, drizzle-kit internals) — never in application schemas.

Reference: [Drizzle pg-core column types](https://orm.drizzle.team/docs/column-types/pg#timestamp)
