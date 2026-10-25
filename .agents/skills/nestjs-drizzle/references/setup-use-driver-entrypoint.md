---
title: Import drizzle from the matching driver entrypoint
impact: CRITICAL
impactDescription: prevents runtime crashes and type mismatch between schema and driver
tags: setup, driver, postgres, mysql, sqlite
---

## Import drizzle from the matching driver entrypoint

`drizzle()` is not a single factory — every driver has its own entrypoint with its own `drizzle()` function and database type. Importing from the wrong entrypoint (or a generic path) yields a database instance whose types don't match your driver, or fails at runtime when the driver package is missing.

**Incorrect (what's wrong):**

```typescript
import { drizzle } from 'drizzle-orm'; // no such entrypoint / wrong driver types

DrizzleModule.forRoot({
  drizzle,
  connection: process.env.DATABASE_URL!,
});
```

**Correct (what's right):**

```typescript
// PostgreSQL with node-postgres
import { drizzle } from 'drizzle-orm/node-postgres';

// Other databases — use the entrypoint matching your driver:
// import { drizzle } from 'drizzle-orm/mysql2';        // MySQL
// import { drizzle } from 'drizzle-orm/better-sqlite3'; // SQLite
// import { drizzle } from 'drizzle-orm/libsql';        // Turso / libSQL

DrizzleModule.forRoot({
  drizzle,
  connection: process.env.DATABASE_URL!,
});
```

**When NOT to use this pattern:**
- Serverless databases (Neon, Turso, Cloudflare D1) still follow the same pattern — just pick their entrypoint; there is no alternative generic import.

Reference: [Connect overview](https://orm.drizzle.team/docs/connect-overview)
