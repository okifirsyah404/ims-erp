# 3.2 No FKs Across Schemas

**Impact: CRITICAL**

## The Rule

Cross-module relations are stored as plain columns without
`.references()`. Integrity across the boundary is enforced at the service
layer. Foreign keys are allowed only **within** a module's own schema
(and within the `auth` schema, which Better Auth generates).

## Canonical Example (from this repo)

Inside the location schema — FK allowed, same module:

```typescript
// drizzle/schemas/location.schema.ts
provinceId: uuid('province_id').references(() => province.id, {
	onDelete: 'cascade',
}),
```

The cross-module shape — a future employee table referencing location:

```typescript
// drizzle/schemas/employee.schema.ts (hypothetical, correct form)
villageId: uuid('village_id'), // plain column, NO .references()
```

## Why

- Cross-schema FKs couple module migrations: dropping or moving the
  referenced module requires coordinated DDL in every referencing module.
- Deletion semantics stay local: a province deleted in the location module
  cannot silently cascade into another module's rows; the owning module
  decides cleanup explicitly (see `drizzle-soft-deletes`).
- Validation ("does this villageId exist?") is a service-layer rule —
  resolve via the owning module's service (rule 3.5), not a DB constraint.

## Anti-patterns

- `userId: text('user_id').references(() => users.id)` in a non-auth
  schema — hard coupling to the auth module's tables.
- Relying on `onDelete: 'cascade'` across modules for cleanup — orphan
  handling becomes invisible and un-auditable.
- Adding a cross-schema FK "temporarily" — it ships and stays.
