---
title: Every deletable table gets a nullable deleted_at (ms), no boolean flag
impact: CRITICAL
impactDescription: one column answers alive-or-deleted AND records when — no dual-source-of-truth drift
tags: column, deletedAt, unixTimestampNullable, schema
---

## Every deletable table gets a nullable deleted_at (ms), no boolean flag

A soft-delete table must answer two questions: *is it deleted?* and *when?* A boolean plus a timestamp answers them twice and drifts; the convention answers both with one column: `deletedAt: unixTimestampNullable('deleted_at')` — `NULL` = alive, unix ms = deleted at that instant. The type comes from the shared custom types (see the drizzle-unix-timestamp skill) so storage stays bigint milliseconds.

**Incorrect (what's wrong):**

```typescript
export const invoices = pgTable('invoices', {
  isDeleted: boolean('is_deleted').notNull().default(false), // dual source of truth
  deletedAt: unixTimestampNullable('deleted_at'),            // may disagree with the flag
});

// Or: timestamp type instead of the shared custom type
deletedAt: timestamp('deleted_at', { withTimezone: true }),
```

**Correct (what's right):**

```typescript
import { unixTimestampNullable } from '@providers/drizzle/schemas/unix-timestamp';

export const invoices = pgTable('invoices', {
  deletedAt: unixTimestampNullable('deleted_at'), // NULL = alive, ms = deleted
});
```

```typescript
// Checks read naturally
const isDeleted = invoice.deletedAt !== null;
```

**When NOT to use this pattern:**
- Tables that are truly immutable append-only logs may omit `deletedAt` — they don't support deletion at all.

Reference: `apps/backend-elysia/drizzle/datatypes/unix-timestamp.ts`
