---
title: Relational query 'with' cannot filter deleted nested rows — know the leak
impact: MEDIUM-HIGH
impactDescription: prevents deleted children from silently appearing in nested API payloads
tags: relations, rqb, with, leak
---

## Relational query 'with' cannot filter deleted nested rows — know the leak

`db.query.users.findFirst({ with: { documents: true } })` fetches **all** children — including soft-deleted ones. The relational query API has no per-relation `deletedAt IS NULL` filter, so nested deleted rows leak into results. Handle this deliberately: filter the loaded array in code, drop to a manual join query when correctness matters, or query children separately with the filter.

**Incorrect (what's wrong):**

```typescript
const user = await db.query.users.findFirst({
  where: { id },
  with: { documents: true },
});
// user.documents includes soft-deleted docs — returned to the client as-is
return user;
```

**Correct (what's right):**

```typescript
// Option 1: filter after load (fine for small relation sets)
const user = await db.query.users.findFirst({
  where: { id },
  with: { documents: true },
});
const documents = user?.documents.filter((d) => d.deletedAt === null) ?? [];

// Option 2: separate filtered query for correctness
const documents = await db.select().from(documentsTable)
  .where(and(eq(documentsTable.userId, id), isNull(documentsTable.deletedAt)));

// Option 3: manual join when nesting is essential
const rows = await db.select().from(usersTable)
  .leftJoin(documentsTable, and(
    eq(documentsTable.userId, usersTable.id),
    isNull(documentsTable.deletedAt),
  ))
  .where(eq(usersTable.id, id));
```

**When NOT to use this pattern:**
- Relations whose deleted children are harmless (pure metadata) may skip filtering — but make that a conscious, documented choice.

Reference: [Relational queries v2](https://orm.drizzle.team/docs/rqb-v2)
