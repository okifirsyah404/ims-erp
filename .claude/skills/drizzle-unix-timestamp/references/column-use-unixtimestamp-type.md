---
title: Use the shared unixTimestamp custom type for every datetime column
impact: CRITICAL
impactDescription: guarantees one datetime representation across the whole database
tags: column, customType, unixTimestamp, schema
---

## Use the shared unixTimestamp custom type for every datetime column

The project stores datetimes as unix milliseconds since epoch in a `bigint` column. The shared custom types (`unixTimestamp`, `unixTimestampNullable`) bridge app-level `Date` objects (also required by better-auth) with ms storage, converting via luxon. Hand-rolling the conversion per schema duplicates the seconds-vs-ms bug class and drifts from the convention.

**Incorrect (what's wrong):**

```typescript
import { bigint } from 'drizzle-orm/pg-core';

export const sessions = pgTable('sessions', {
  createdAt: bigint('created_at', { mode: 'number' }).notNull(), // raw bigint: app must convert everywhere
  lastSeenAt: bigint('last_seen_at', { mode: 'bigint' }),        // JS BigInt: wrong, unnecessary
  expiresAt: bigint('expires_at', { mode: 'number' }),           // forgot nullability variant
});
```

**Correct (what's right):**

```typescript
import { unixTimestamp, unixTimestampNullable } from '@providers/drizzle/schemas/unix-timestamp';

export const sessions = pgTable('sessions', {
  createdAt: unixTimestamp('created_at').notNull(), // data type: Date
  lastSeenAt: unixTimestampNullable('last_seen_at'), // data type: Date | null
  expiresAt: unixTimestampNullable('expires_at'),
});
```

```typescript
// App code works with Date objects — conversion is inside the type
const [row] = await db.select().from(sessions).where(eq(sessions.id, id));
row.createdAt.getTime(); // Date at the app layer
row.lastSeenAt?.toISOString();
```

**When NOT to use this pattern:**
- Nothing — there is no legitimate per-schema datetime column type in this project. If a case seems to need one, extend the shared type instead (see extend-type-for-new-dialects).

Reference: canonical definition at `apps/backend-elysia/drizzle/datatypes/unix-timestamp.ts`
