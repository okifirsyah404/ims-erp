---
title: Manage schema changes with drizzle-kit, migrate on startup only from one instance
impact: MEDIUM-HIGH
impactDescription: prevents schema drift and deployment race conditions
tags: migrate, drizzle-kit, migrations, deployment
---

## Manage schema changes with drizzle-kit, migrate on startup only from one instance

Schema changes should go through generated migration files (`drizzle-kit generate`), reviewed in version control, then applied with `drizzle-kit migrate` as a deployment step. Running `migrate()` on every app startup is acceptable only when exactly one instance performs it — multiple instances starting concurrently race on the migrations table.

**Incorrect (what's wrong):**

```typescript
// Every replica runs migrate on boot -> race conditions
DrizzleModule.forRootAsync({
  drizzle,
  useFactory: async () => {
    const db = drizzle(process.env.DATABASE_URL!);
    await db.migrate(); // all instances do this
    return { db };
  },
});
```

**Correct (what's right):**

```bash
# 1. Declare schema in TypeScript
# 2. Generate migration SQL (review + commit it)
npx drizzle-kit generate
# 3. Apply as a deployment step (single runner)
npx drizzle-kit migrate
```

```typescript
// drizzle.config.ts
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL! },
});
```

If startup migration is required, gate it through a `forRootAsync` factory and ensure only one instance runs it:

```typescript
DrizzleModule.forRootAsync({
  drizzle,
  useFactory: async () => {
    const db = drizzle(process.env.DATABASE_URL!);
    await migrate(db, { migrationsFolder: './drizzle' }); // e.g., leader-elected instance only
    return { db };
  },
});
```

**When NOT to use this pattern:**
- CI pipelines or single-instance dev environments can safely use startup `migrate()`.

Reference: [Drizzle Kit overview](https://orm.drizzle.team/docs/kit-overview)
