---
title: Feature code sets deletedAt — hard DELETE is purge/infra only
impact: CRITICAL
impactDescription: preserves recoverability and referential integrity of business data
tags: delete, soft-delete, hard-delete, purge
---

## Feature code sets deletedAt — hard DELETE is purge/infra only

Hard `DELETE` in feature code destroys history and violates the convention: recovery becomes impossible and dependent rows (orphaned children, dangling FKs) break silently. Deletion in services/repositories means setting `deletedAt: new Date()`. Physical `DELETE` statements exist only in dedicated purge jobs or infrastructure migrations.

**Incorrect (what's wrong):**

```typescript
// Controller-triggered hard delete
async remove(id: number) {
  await this.db.delete(invoices).where(eq(invoices.id, id));
}
```

**Correct (what's right):**

```typescript
async remove(id: number) {
  await this.db.update(invoices)
    .set({ deletedAt: new Date() }) // custom type converts to ms
    .where(and(eq(invoices.id, id), isNull(invoices.deletedAt)));
}
```

**When NOT to use this pattern:**
- Purge jobs (see purge-expired-rows) and data-privacy erasure requests (GDPR-style, legally mandated) are the legitimate hard-delete paths — they are separate, deliberate code, not service CRUD.
- Junction/derived tables that are fully owned by a parent row may be hard-deleted when the parent is soft-deleted and recreated atomically on restore — decide per aggregate, explicitly.

Reference: [Drizzle update](https://orm.drizzle.team/docs/update)
