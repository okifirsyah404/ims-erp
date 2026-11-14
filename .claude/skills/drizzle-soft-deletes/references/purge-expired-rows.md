---
title: Purge jobs hard-delete rows past a per-table retention window
impact: MEDIUM
impactDescription: bounds table growth while keeping the recovery window explicit and documented
tags: purge, retention, cron, hard-delete
---

## Purge jobs hard-delete rows past a per-table retention window

Soft-deleted rows accumulate forever unless a purge job physically removes them. Each soft-delete table defines its own retention window in code (e.g., in its schema or config module) — no global constant, since a login session and a signed contract have different lifetimes. The job runs on a schedule, hard-deletes rows where `deletedAt` is older than the window, and relies on an indexed `deletedAt` for the scan.

**Incorrect (what's wrong):**

```typescript
// One global window for every table
const PURGE_AFTER_DAYS = 30;
await this.db.delete(sessions).where(lt(sessions.deletedAt, cutoff));
await this.db.delete(contracts).where(lt(contracts.deletedAt, cutoff)); // same window as sessions!
```

**Correct (what's right):**

```typescript
// Retention defined per table, next to its schema/config
export const SESSION_RETENTION_DAYS = 7;
export const CONTRACT_RETENTION_DAYS = 365;
```

```typescript
// Purge job — one method per table, batched
@Cron(CronExpression.EVERY_DAY_AT_3AM)
async purgeSessions() {
  const cutoff = DateTime.now().minus({ days: SESSION_RETENTION_DAYS }).toJSDate();
  await this.db.delete(sessions)
    .where(lt(sessions.deletedAt, cutoff)) // only rows ALREADY soft-deleted past the window
    .limit(1000); // batch to avoid long locks
}
```

**When NOT to use this pattern:**
- Tables under legal-hold or audit requirements are exempt from purge — mark them explicitly as "no purge" so the absence of a job is intentional, not forgotten.
- The purge job is the only place hard `DELETE` is legitimate in application code (see delete-never-hard-delete).

Reference: [Drizzle delete](https://orm.drizzle.team/docs/delete)
