---
title: Derive row types with $inferSelect/$inferInsert and a shared Database alias
impact: HIGH
impactDescription: eliminates model/schema drift — types always match tables
tags: schema, types, inference, database
---

## Derive row types with $inferSelect/$inferInsert and a shared Database alias

Drizzle has no entity classes. Keeping a hand-written model class in sync with the table definition guarantees drift. Derive row types from the table (`$inferSelect` for reads, `$inferInsert` for writes) and declare one `Database` type alias (including `relations`) reused everywhere `@InjectDrizzle()` is used — this keeps `db.query` fully typed.

**Incorrect (what's wrong):**

```typescript
// Duplicated model, will drift from the table definition
export interface User {
  id: number;
  firstName: string;
  lastName: string;
  isActive: boolean;
}

constructor(@InjectDrizzle() private readonly db: NodePgDatabase) {}
// db.query.* untyped because relations are not part of the type
```

**Correct (what's right):**

```typescript
// db/schema.ts
import { boolean, integer, pgTable, text } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  isActive: boolean('is_active').notNull().default(true),
});

export type User = typeof users.$inferSelect;   // row shape for reads
export type NewUser = typeof users.$inferInsert; // insert shape
```

```typescript
// db/database.ts — declare once, reuse everywhere
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { relations } from './relations.js';

export type Database = NodePgDatabase<typeof relations>;
```

**When NOT to use this pattern:**
- Never write a separate model class "for clarity" — the inferred types are the single source of truth; a duplicate is pure maintenance cost.

Reference: [Schema declaration](https://orm.drizzle.team/docs/sql-schema-declaration)
