---
title: Run all queries of a transaction through tx
impact: HIGH
impactDescription: prevents partial writes and data corruption on failure
tags: query, transaction, rollback, consistency
---

## Run all queries of a transaction through tx

Inside `db.transaction(async (tx) => ...)`, every query MUST use the `tx` parameter — queries built from the outer `db` run outside the transaction and can be committed even after `tx.rollback()`. Repository methods that capture `db` at construction time are not transaction-aware: you cannot pass a transaction into an existing repository, so keep multi-statement transactions in services.

**Incorrect (what's wrong):**

```typescript
await this.db.transaction(async (tx) => {
  await this.usersRepo.create(userData);          // uses this.db — outside tx!
  await this.db.insert(auditLogs).values(log);     // outside tx!
  await tx.rollback(); // neither insert is rolled back
});
```

**Correct (what's right):**

```typescript
await this.db.transaction(async (tx) => {
  await tx.insert(users).values(userData);
  await tx.insert(auditLogs).values(log);
  if (!valid) {
    await tx.rollback(); // both inserts rolled back
  }
});
```

**When NOT to use this pattern:**
- Repository methods are fine inside transactions as long as they run only reads that don't require atomicity, or you restructure them to accept a `tx` parameter.
- For transactional business logic across many repositories, consider the [nestjs-cls Drizzle adapter](https://papooch.github.io/nestjs-cls/plugins/available-plugins/transactional/drizzle-orm-adapter) to propagate transactions implicitly.

Reference: [Drizzle transactions](https://orm.drizzle.team/docs/transactions)
