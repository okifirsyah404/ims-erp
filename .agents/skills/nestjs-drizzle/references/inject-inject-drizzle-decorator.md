---
title: Inject the database with @InjectDrizzle
impact: CRITICAL
impactDescription: avoids manual module wiring and gives every class direct database access
tags: inject, decorator, token, DI
---

## Inject the database with @InjectDrizzle

`@InjectDrizzle()` is the only injection point needed — no module imports required, it is globally available once `DrizzleModule` is registered at the root. For factories or tests, use `getDrizzleToken()` which returns the injection token (pass a name for a named database). Avoid ad-hoc string tokens or re-exporting the database through wrapper providers.

**Incorrect (what's wrong):**

```typescript
// Wrapping the db in a custom provider duplicates what @InjectDrizzle already does
@Module({
  providers: [{ provide: 'DB', useExisting: getDrizzleToken() }],
})
export class UsersModule {}

@Injectable()
export class UsersService {
  constructor(@Inject('DB') private readonly db: NodePgDatabase) {}
}
```

**Correct (what's right):**

```typescript
import { Injectable } from '@nestjs/common';
import { InjectDrizzle } from '@nestjs/drizzle';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

@Injectable()
export class UsersService {
  constructor(
    @InjectDrizzle()
    private readonly db: Database, // shared type alias, see schema-infer-types
  ) {}
}

// Named database
@Injectable()
export class ReportsService {
  constructor(
    @InjectDrizzle('analytics')
    private readonly analyticsDb: NodePgDatabase,
  ) {}
}
```

**When NOT to use this pattern:**
- In factory providers or test modules use `getDrizzleToken()` (optionally with the database name) instead of the decorator — decorators cannot be used in `inject: [...]` arrays.

Reference: [NestJS Drizzle — Injecting the database](https://docs.nestjs.com/data/drizzle)
