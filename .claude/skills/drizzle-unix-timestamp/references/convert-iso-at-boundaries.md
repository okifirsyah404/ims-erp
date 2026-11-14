---
title: Accept ISO 8601 at the API boundary, Date inside the app
impact: HIGH
impactDescription: prevents client-side unit ambiguity and keeps payloads human-readable
tags: boundary, api, iso, validation
---

## Accept ISO 8601 at the API boundary, Date inside the app

Raw unix ms in API payloads is ambiguous to clients (seconds? ms? an int that just looks like a date?) and unreadable in logs/tools. The API layer accepts and returns ISO 8601 strings; validation (class-validator / zod) converts to `Date`, which the custom types convert to ms for storage. Raw ms is exposed only for fields that are *explicitly epoch semantics* (e.g., a cursor token).

**Incorrect (what's wrong):**

```typescript
// DTO exposes raw ms — clients guess the unit
@Post()
create(@Body() dto: { dueAt: number }) {} // 1700000000 or 1700000000000?
```

**Correct (what's right):**

```typescript
import { Transform } from 'class-transformer';

export class CreateOrderDto {
  @Transform(({ value }) => new Date(value)) // ISO 8601 string -> Date
  @IsDate()
  dueAt: Date; // stored as ms by the custom type on insert
}

// Response serialization
@Transform(({ value }) => (value instanceof Date ? value.toISOString() : value))
createdAt: string;
```

**When NOT to use this pattern:**
- Explicit epoch fields (pagination cursors, rate-limit windows) may expose ms — name them clearly (e.g., `cursorAfterMs`).

Reference: [Luxon toISO](https://moment.github.io/luxon/api-docs/index.html#datetimeprototypetoiso)
