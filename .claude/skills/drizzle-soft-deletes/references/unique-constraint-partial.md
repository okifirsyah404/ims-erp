---
title: Use partial unique indexes so deleted rows free their unique values
impact: HIGH
impactDescription: prevents "email already exists" errors caused by invisible deleted rows
tags: unique, index, partial, constraint
---

## Use partial unique indexes so deleted rows free their unique values

A plain unique constraint covers deleted rows too: soft-delete a user with email `a@b.c` and nobody can ever register that email again — the colliding row is invisible in normal queries. The prescribed pattern is a **partial unique index** limited to live rows, so unique values become reusable after deletion.

**Incorrect (what's wrong):**

```typescript
export const users = pgTable(
  'users',
  { email: text('email').notNull(), deletedAt: unixTimestampNullable('deleted_at') },
  (t) => [uniqueIndex('users_email_uq').on(t.email)],
  // deleted user with a@b.c blocks re-registration forever
);
```

**Correct (what's right):**

```typescript
import { sql } from 'drizzle-orm';

export const users = pgTable(
  'users',
  { email: text('email').notNull(), deletedAt: unixTimestampNullable('deleted_at') },
  (t) => [
    uniqueIndex('users_email_uq')
      .on(t.email)
      .where(sql`${users.deletedAt} is null`), // live rows only
  ],
);
```

**When NOT to use this pattern:**
- Uniqueness that must survive deletion across re-creations (e.g., an immutable external reference like a government ID) still needs a full unique index — decide per column, explicitly, and document why.

Reference: [Drizzle partial indexes](https://orm.drizzle.team/docs/indexes-constraints#partial-indexes)
