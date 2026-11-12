---
title: Extend the shared custom types for new dialects — never write per-schema conversions
impact: MEDIUM
impactDescription: keeps the single datetime representation intact if storage changes
tags: dialect, customType, extension
---

## Extend the shared custom types for new dialects — never write per-schema conversions

This project is PostgreSQL-only. If another dialect is ever introduced, the datetime convention must not fork: extend `unix-timestamp.ts` (or a dialect-specific sibling) so conversion logic stays in one place. Per-schema inline `customType` definitions or scattered `Date.now()` conversions are how the convention erodes.

**Incorrect (what's wrong):**

```typescript
// One-off inline custom type in a feature schema
const myTimestamp = customType<{ data: Date; driverData: number }>({
  dataType() { return 'BIGINT'; },
  toDriver: (d: Date) => d.getTime(), // duplicated conversion, drifts from shared type
});
```

**Correct (what's right):**

```typescript
// apps/backend-elysia/drizzle/datatypes/unix-timestamp.ts
// Add or extend variants there — e.g., a non-nullable update helper or a
// dialect-specific dataType — keeping all datetime conversion in one module.

export const unixTimestamp = customType<{ data: Date; driverData: bigint | number }>({
  dataType() {
    return 'bigint';
  },
  toDriver(value: Date) {
    return DateTime.fromJSDate(value).toMillis();
  },
  fromDriver(value: bigint | number) {
    return DateTime.fromMillis(Number(value)).toJSDate();
  },
});
```

**When NOT to use this pattern:**
- None — the shared module is the single source of truth for datetime conversion.

Reference: [Drizzle custom types](https://orm.drizzle.team/docs/custom-types)
