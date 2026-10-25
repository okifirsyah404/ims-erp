---
title: Declare relations once with defineRelations and pass them to drizzle()
impact: HIGH
impactDescription: enables fully typed nested reads without manual joins
tags: schema, relations, rqb, defineRelations
---

## Declare relations once with defineRelations and pass them to drizzle()

Relational queries (`db.query.<table>`) need a relations object. Declaring relations per-query with ad-hoc joins loses type safety and duplicates association knowledge across the codebase. Define all relations in one place with `defineRelations()`, pass them via the `relations` option, and type the database with them. Foreign key constraints still come from `references()` in the table definition — relations only drive relational queries.

**Incorrect (what's wrong):**

```typescript
// Manual joins everywhere, repeated in every service
const rows = await this.db
  .select()
  .from(users)
  .leftJoin(photos, eq(photos.userId, users.id))
  .where(eq(users.id, id));
// returns flat [user, photo | null] tuples, manual grouping needed
```

**Correct (what's right):**

```typescript
// db/schema.ts
export const photos = pgTable('photos', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  url: text().notNull(),
  userId: integer('user_id').notNull().references(() => users.id),
});

// db/relations.ts
import { defineRelations } from 'drizzle-orm';
import * as schema from './schema.js';

export const relations = defineRelations(schema, (r) => ({
  users: { photos: r.many.photos() },
  photos: { user: r.one.users({ from: r.photos.userId, to: r.users.id }) },
}));
```

```typescript
DrizzleModule.forRoot({ drizzle, connection: process.env.DATABASE_URL!, relations });
```

```typescript
// Fully typed nested read
findOneWithPhotos(id: number) {
  return this.db.query.users.findFirst({
    where: { id },
    with: { photos: true },
  });
}
```

**When NOT to use this pattern:**
- Relations exist only for relational queries. If you only need an FK constraint (no nested reads), `references()` alone is enough.

Reference: [Relations v2](https://orm.drizzle.team/docs/relations-v2)
