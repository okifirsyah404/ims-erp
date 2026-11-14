---
title: Index time columns used in range scans or cursor pagination
impact: MEDIUM
impactDescription: keeps time-ordered queries off sequential scans as tables grow
tags: index, performance, pagination
---

## Index time columns used in range scans or cursor pagination

Time-ordered access (`orderBy(desc(createdAt))`, range filters, keyset/cursor pagination over time) degrades to sequential scans without an index, and bigint columns are wide enough that this hurts early. Index every time column that participates in `ORDER BY`, `WHERE` range filters, or cursor pagination — compound indexes should lead with the time column when it drives ordering.

**Incorrect (what's wrong):**

```typescript
export const events = pgTable('events', {
  createdAt: unixTimestamp('created_at').notNull(),
  orgId: integer('org_id').notNull(),
  // no index: ORDER BY createdAt on millions of rows -> seq scan
});

// Cursor pagination over an unindexed column
.where(lt(events.createdAt, new Date(cursorAfterMs)))
.orderBy(desc(events.createdAt)).limit(20)
```

**Correct (what's right):**

```typescript
export const events = pgTable(
  'events',
  {
    createdAt: unixTimestamp('created_at').notNull(),
    orgId: integer('org_id').notNull(),
  },
  (t) => [
    index('events_created_at_idx').on(t.createdAt),
    // tenant-scoped cursor pagination: lead with org filter, then time
    index('events_org_created_idx').on(t.orgId, t.createdAt),
  ],
);
```

**When NOT to use this pattern:**
- Write-only audit timestamps that are never queried or sorted don't need an index — every index costs write throughput.

Reference: [Drizzle indexes](https://orm.drizzle.team/docs/indexes-constraints)
