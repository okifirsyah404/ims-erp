---
title: Restore sets deletedAt back to null
impact: HIGH
impactDescription: keeps row state fully encoded in one column
tags: restore, undelete, deletedAt
---

## Restore sets deletedAt back to null

Restoration is exactly the inverse of deletion: `deletedAt = null`. Do not add companion columns (`restoredAt`, `isRestored`) or status enums to track the cycle — the column already encodes the state. If deletion/restore history matters for compliance or forensics, write an audit-log record; do not overload the column.

**Incorrect (what's wrong):**

```typescript
// State spread across columns, guaranteed to drift
await db.update(invoices).set({
  deletedAt: null,
  restoredAt: new Date(),     // extra state to keep in sync
  isRestored: true,
}).where(eq(invoices.id, id));
```

**Correct (what's right):**

```typescript
async restore(id: number) {
  await this.db.update(invoices)
    .set({ deletedAt: null })
    .where(and(eq(invoices.id, id), isNotNull(invoices.deletedAt))); // only deleted rows can be restored
}

// If history matters, it belongs in an audit log:
await this.audit.record({ action: 'invoice.restored', entityId: id, at: new Date() });
```

**When NOT to use this pattern:**
- If a row's content was overwritten (not just marked deleted) after deletion, "restore" can only bring back the marker, not the data — that's what the audit log or backups are for.

Reference: [Drizzle update](https://orm.drizzle.team/docs/update)
