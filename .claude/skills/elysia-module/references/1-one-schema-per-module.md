# 3.1 One Module = One Postgres Schema = One Schema File

**Impact: CRITICAL**

## The Rule

Each module under `src/app/<module>/` pairs with
`drizzle/schemas/<module>.schema.ts` declaring its own
`pgSchema("<module>")`. No two modules share a schema; there is no shared
"common" schema.

## Canonical Example (from this repo)

`apps/backend/drizzle/schemas/location.schema.ts`:

```typescript
export const locationSchema = pgSchema('location');

export const province = locationSchema.table(
	'provinces',
	{
		id: uuid('id').primaryKey().default(sql`uuidv7()`),
		code: varchar('code', { length: 20 }).notNull().unique(),
		name: text('name').notNull(),
		// ...
	},
);
```

Matches `src/app/location/` — the module owns every table in the `location`
schema and nothing else does.

## Why

- One schema per module makes ownership greppable: a table's Postgres
  schema names its module.
- Separate schemas allow per-module migrations, `REVOKE`s, and (later)
  clean extraction into services — a shared schema blocks all three.
- Cross-module table edits become visible in review: touching another
  module's schema file is a boundary event, not a casual change.

## Anti-patterns

- A `common.schema.ts` with "lookup tables" referenced by several modules —
  grows into the god schema this skill exists to prevent.
- Two modules adding tables to one schema file "since they're related" —
  relation is expressed by rule 3.2's id columns, not co-location.
- A schema file with zero tables kept indefinitely — placeholder
  reservations (`document.schema.ts`, `warehouse.schema.ts`, ...) are fine
  while pending; implement the module or drop the file.
