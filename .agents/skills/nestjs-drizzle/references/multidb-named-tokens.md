---
title: Register multiple databases with unique named tokens
impact: MEDIUM-HIGH
impactDescription: prevents silent injection collisions when adding a second database
tags: multidb, forRoot, token, named
---

## Register multiple databases with unique named tokens

Multiple `DrizzleModule.forRoot()` calls must each pass a unique `name`. The default (unnamed) registration can be used only once — a second unnamed `forRoot()` collides with the first and silently overrides it, so later databases in the project appear broken with no obvious error.

**Incorrect (what's wrong):**

```typescript
DrizzleModule.forRoot({ drizzle, connection: process.env.DATABASE_URL! }),
DrizzleModule.forRoot({ drizzle, connection: process.env.ANALYTICS_URL! }), // collides!
```

**Correct (what's right):**

```typescript
DrizzleModule.forRoot({ drizzle, connection: process.env.DATABASE_URL! }),
DrizzleModule.forRoot({
  name: 'analytics',
  drizzle,
  connection: process.env.ANALYTICS_URL!,
}),
```

```typescript
@Injectable()
export class ReportsService {
  constructor(
    @InjectDrizzle() private readonly db: Database, // default database
    @InjectDrizzle('analytics') private readonly analyticsDb: NodePgDatabase,
  ) {}
}
```

**When NOT to use this pattern:**
- `forRootAsync()` accepts the same `name` option — `createDrizzleOptions()` receives the registered name (`undefined` for the default), letting one config class serve all databases.

Reference: [NestJS Drizzle — Multiple databases](https://docs.nestjs.com/data/drizzle)
