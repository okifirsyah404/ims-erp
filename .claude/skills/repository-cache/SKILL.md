---
name: repository-cache
description: >-
  Conventions and template for repository-level Redis cache-aside caching in
  apps/backend. Use when creating a new Drizzle repository that needs caching
  for hot read paths (reference data like location, catalog, or lookup
  entities). Documents cache key naming, TTL rules, what to cache vs. never
  cache, and per-write invalidation rules.
---

# Repository-Level Redis Cache (cache-aside)

Source of truth: `apps/backend/src/app/location/repositories/`
(`province`, `regency`, `district`, `village` repositories).

## Pattern overview

Cache-aside (lazy loading): reads check Redis first; on miss, query Postgres
and backfill Redis with a TTL. Writes go straight to Postgres, then
explicitly evict affected keys. There is no cache warm-up and no
write-through.

```
read:   Redis GET → hit? return JSON.parse
                → miss? Postgres SELECT → Redis SET (EX ttl) → return
write:  Postgres INSERT/UPDATE/DELETE (RETURNING affected rows)
        → Redis DEL :all + :id:{id}... + :parent:{parentId}...
```

## Setup

- Inject `@inject(DRIZZLE_TOKEN) database: BunSQLDatabase` and
  `@inject(REDIS_TOKEN) redisClient: RedisClient` (Bun's RedisClient).
- Class-level fields:

```ts
private readonly cachePrefix = '{domain}:{entity}'; // e.g. 'location:district'
private readonly cacheTtlSeconds = 300;             // 5 minutes
```

## Cache key convention

| Key                                      | Contents                        |
| ---------------------------------------- | ------------------------------- |
| `{prefix}:all`                           | `findAll()` result (array)      |
| `{prefix}:id:{id}`                       | single row JSON, or `"null"`    |
| `{prefix}:{parentKey}:{parentId}`        | rows scoped to one parent       |

- Parent-scoped example: `location:district:regency:{regencyId}`.
- Negative caching: `findById` stores the literal string `"null"` for missing
  rows and checks `cached === 'null'` to avoid repeated misses.

## What to cache vs. never cache

**Cached (hot reads):**
- `findAll` (`:all`)
- `findById` (`:id:{id}`)
- Parent-scoped single-parent lookup, e.g. `findByRegencyId`

**Never cached (always Postgres):**
- `paginate` — filters make keys unbounded
- `findAllWithDeleted`, `findSoftDeletedById` — audit/soft-delete views
- Multi-parent lookups (`findBy*Ids`, `findBy*Codes`) — resolved via one
  `inArray` query; code variants resolve parent codes to ids first
  (uncached), then reuse the id-based path
- `findByIds` (currently uncached in the reference implementations)

All cached reads exclude soft-deleted rows (`isNull(entity.deletedAt)`) and
order by `asc(entity.name)`.

## Invalidation rules

`invalidate(ids, parentIds?)` deletes, in a single `DEL`:

1. `{prefix}:all` (list changed)
2. `{prefix}:id:{id}` for every affected row
3. `{prefix}:{parentKey}:{parentId}` for every affected parent (deduped,
   nulls filtered)

| Operation                          | After write, call invalidate with |
| ---------------------------------- | --------------------------------- |
| `create` / `createMany`            | created ids + their parentIds     |
| `update` (row found)               | `[updated.id]` + its parentId     |
| `softDeleteMany` (delete/deleteMany) | affected ids + parentIds (use `.returning({ id, parentId })`) |
| `forceDeleteMany`                  | affected ids + parentIds (same as above) |
| `restore` (row found)              | `[restored.id]` + its parentId    |

Notes:
- Invalidation happens **after** the DB write, using the `RETURNING` rows —
  never speculative deletion.
- Writes that affect no rows skip invalidation.

## Checklist for a new cached repository

1. Define the interface in `contracts/{entity}.repository.interface.ts`.
2. Repository class: `@injectable()`, inject `DRIZZLE_TOKEN` + `REDIS_TOKEN`,
   set `cachePrefix` (`{domain}:{entity}`) and `cacheTtlSeconds = 300`.
3. Cache `findAll`, `findById` (with `"null"` negative caching), and the
   single-parent lookup if the entity has a parent.
4. Leave `paginate`, `findAllWithDeleted`, `findSoftDeletedById`,
   `findByIds`, and multi-parent lookups uncached.
5. Implement `invalidate(ids, parentIds?)` and call it from every write
   (`create`, `createMany`, `update`, `softDeleteMany`, `forceDeleteMany`,
   `restore`) with ids/parents from `.returning()`.
6. Document the strategy in the class JSDoc `@remarks`.
7. Copy and fill in `template/repository.template.ts` as a starting point.

## Tenant-scoped keys

For repositories where every query is scoped by `organizationId`
(transactional data, e.g. `sales:quotation`, `sales:payment`), scope the cache
key by tenant instead of using an `:all` list key:

```
{prefix}:{organizationId}:id:{id}   e.g. sales:quotation:org_123:id:q_456
```

- Cache only the hot read (`findById`); list/paginate stay uncached.
- Writes invalidate just the affected tenant-scoped id key:
  `invalidate(organizationId, id)`.
- Reference the example implementations in `apps/backend/src/app/sales/repositories/`.

## Known trade-offs (accepted)

- Up to 5 minutes of staleness after a write on other app instances.
- `:all` and `:id:` entries can briefly disagree after invalidation races.
- No locking/stampede protection; acceptable for low-write reference data.
