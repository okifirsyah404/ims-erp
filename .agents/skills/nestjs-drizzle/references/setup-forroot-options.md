---
title: Use DrizzleModule.forRoot with drizzle and connection options
impact: CRITICAL
impactDescription: prevents leaked connection pools and misconfigured instances
tags: setup, forRoot, options, lifecycle
---

## Use DrizzleModule.forRoot with drizzle and connection options

`DrizzleModule.forRoot()` takes a mandatory `drizzle` function (the driver entrypoint import) plus either a `connection` (connection string/URL handled by the driver) or a `db` (a pre-created database instance). All remaining options are passed through to `drizzle()` (e.g., `relations`, `logger`, `casing`). The module closes the connection pool automatically when `app.close()` / shutdown hooks run — this is why the pool must be closed via module lifecycle, not manually.

**Incorrect (what's wrong):**

```typescript
// Creating the pool yourself and leaking it on shutdown
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

@Module({
  imports: [DrizzleModule.forRoot({ drizzle, db })],
})
export class AppModule {}
// pool never ends on app.close() -> sockets hang, tests never exit
```

**Correct (what's right):**

```typescript
import { Module } from '@nestjs/common';
import { DrizzleModule } from '@nestjs/drizzle';
import { drizzle } from 'drizzle-orm/node-postgres';

@Module({
  imports: [
    DrizzleModule.forRoot({
      drizzle,
      connection: process.env.DATABASE_URL!,
      relations, // optional passthrough option, forwarded to drizzle()
      logger: true,
    }),
  ],
})
export class AppModule {}
// Enable shutdown hooks so the pool is closed on SIGTERM:
// app.enableShutdownHooks();
```

**When NOT to use this pattern:**
- If you already own a database instance created elsewhere (rare), you may pass `db` — but then you are responsible for closing it.

Reference: [NestJS Drizzle — Registering the database](https://docs.nestjs.com/data/drizzle)
