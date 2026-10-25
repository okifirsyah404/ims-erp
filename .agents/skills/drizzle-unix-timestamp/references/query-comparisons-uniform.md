---
title: Compare times with Date objects — never mix seconds and ms literals
impact: MEDIUM-HIGH
impactDescription: prevents the classic *1000 unit-mixing bug in time filters
tags: query, comparison, gte, luxon
---

## Compare times with Date objects — never mix seconds and ms literals

Time filters should be built from `Date` objects (or luxon conversions at the edges), so the unit is unambiguous: the custom type converts to ms for the query. Hand-written numeric literals invite the classic bug — `1700000000` (seconds) used where ms is expected silently matches nothing (or everything).

**Incorrect (what's wrong):**

```typescript
// Unit ambiguity: is 1700000000 seconds or ms? It's seconds — silently wrong result
const active = await db.select().from(sessions)
  .where(gte(sessions.lastSeenAt, 1700000000));

// Mixing units in the same query
.where(and(
  gte(sessions.createdAt, new Date('2024-01-01')),      // ms via type
  lt(sessions.createdAt, 1704067200),                    // seconds literal — wrong
))
```

**Correct (what's right):**

```typescript
// Date objects — the type handles conversion
const active = await db.select().from(sessions)
  .where(gte(sessions.lastSeenAt, DateTime.now().minus({ days: 7 }).toJSDate()));

// Explicit, uniform unit when numbers are unavoidable
const cutoffMs = DateTime.fromISO('2024-01-01').toMillis();
const active = await db.select().from(sessions)
  .where(gte(sessions.createdAt, new Date(cutoffMs)));
```

**When NOT to use this pattern:**
- Raw ms comparisons are acceptable inside the storage layer itself (e.g., a raw SQL migration checking bigint values) — the values there are already ms by definition.

Reference: [Drizzle select operators](https://orm.drizzle.team/docs/select)
