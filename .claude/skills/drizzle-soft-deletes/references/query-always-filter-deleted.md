---
title: Every query on a soft-delete table filters isNull(deletedAt)
impact: CRITICAL
impactDescription: prevents deleted rows from leaking into business results
tags: query, isNull, filter, select
---

## Every query on a soft-delete table filters isNull(deletedAt)

Deleting a row only hides it from queries that filter `deletedAt IS NULL`. Any unfiltered `select`, `update`, or `delete` silently includes/excludes deleted rows incorrectly — a deleted-but-unfiltered row resurfaces in lists, gets matched in uniqueness checks, or is "re-deleted". The only exceptions are explicit "include deleted" or "trash" code paths.

Filtering is written inline (`isNull(table.deletedAt)`) today. A future repository pattern will centralize this — when that lands, services stop writing the condition themselves.

**Incorrect (what's wrong):**

```typescript
// Deleted invoices appear in the list
const invoices = await db.select().from(invoices).where(eq(invoices.orgId, orgId));

// Update resurrects a deleted row's data
await db.update(invoices).set({ status: 'paid' }).where(eq(invoices.id, id));
```

**Correct (what's right):**

```typescript
import { isNull, isNotNull } from 'drizzle-orm';

// Live rows only
const invoices = await db.select().from(invoices)
  .where(and(eq(invoices.orgId, orgId), isNull(invoices.deletedAt)));

// Only alive rows can be mutated
await db.update(invoices).set({ status: 'paid' })
  .where(and(eq(invoices.id, id), isNull(invoices.deletedAt)));

// Trash view — explicit
const trashed = await db.select().from(invoices)
  .where(and(eq(invoices.orgId, orgId), isNotNull(invoices.deletedAt)));
```

**When NOT to use this pattern:**
- Admin/audit views that intentionally show deleted rows (`isNotNull` or no filter) must be named so reviewers can tell — e.g., `findTrashed`, `includeDeleted`.

Reference: [Drizzle isNull operator](https://orm.drizzle.team/docs/select)
