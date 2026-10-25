---
title: Use relational queries for nested reads instead of manual joins
impact: HIGH
impactDescription: removes join/grouping boilerplate and N+1-prone loops
tags: query, rqb, findFirst, findMany, with
---

## Use relational queries for nested reads instead of manual joins

The relational query API (`db.query.<table>.findFirst/findMany`) fetches nested data declaratively via `with` and returns properly shaped, typed results. Hand-written joins return flat tuples requiring manual grouping, and naive per-row fetch loops cause N+1 queries.

**Incorrect (what's wrong):**

```typescript
// N+1: one query per user's photos
const allUsers = await this.db.select().from(users);
for (const u of allUsers) {
  u.photos = await this.db.select().from(photos).where(eq(photos.userId, u.id));
}

// Or flat join rows needing manual reshaping
const rows = await this.db.select().from(users).leftJoin(photos, eq(photos.userId, users.id));
```

**Correct (what's right):**

```typescript
// Single query, nested result, fully typed (requires relations — see schema-relations-define-relations)
const user = await this.db.query.users.findFirst({
  where: { id },
  with: { photos: true },
});

const usersWithPhotos = await this.db.query.users.findMany({
  with: { photos: true },
  limit: 20,
});
```

**When NOT to use this pattern:**
- For aggregations, custom projections, or very selective column reads, the SQL-like query builder (`select().from()`) gives finer control.

Reference: [Relational queries v2](https://orm.drizzle.team/docs/rqb-v2)
