---
title: Set defaults with .$defaultFn(() => new Date()), never .defaultNow()
impact: HIGH
impactDescription: keeps defaults consistent with bigint ms storage
tags: default, defaultFn, defaultNow
---

## Set defaults with .$defaultFn(() => new Date()), never .defaultNow()

`.defaultNow()` / SQL `now()` produce a native timestamp default — incompatible with the `bigint` storage column and inconsistent with the convention. `.$defaultFn(() => new Date())` runs in JS (both on insert and in drizzle-kit-generated rows), and the custom type converts the `Date` to ms on write. `.$onUpdateFn(() => new Date())` follows the same rule for auto-update columns.

**Incorrect (what's wrong):**

```typescript
export const users = pgTable('users', {
  createdAt: unixTimestamp('created_at').defaultNow().notNull(),        // wrong: SQL default, type mismatch
  updatedAt: unixTimestamp('updated_at').$onUpdateFn(() => new Date()), // wrong: fine fn, but check storage below
});
// $onUpdateFn returning Date is correct ONLY with the custom types; .defaultNow() is never correct
```

**Correct (what's right):**

```typescript
export const users = pgTable('users', {
  createdAt: unixTimestamp('created_at')
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: unixTimestamp('updated_at')
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date())
    .notNull(),
});
```

**When NOT to use this pattern:**
- None — no datetime column should carry a SQL-level time default.

Reference: [Drizzle column defaults](https://orm.drizzle.team/docs/column-types/pg#timestamp)
