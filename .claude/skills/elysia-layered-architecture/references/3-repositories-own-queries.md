# 1.3 Repositories Own Queries and Caching

**Impact: HIGH**

## The Rule

All Drizzle queries, soft-delete filters, and cache-aside logic live in
repositories behind interfaces declared in `contracts/`. Services and
controllers see data, not SQL.

## Canonical Example (from this repo)

`apps/backend/src/app/location/repositories/province.repository.ts` —
implements `IProvinceRepository`, filters soft-deleted rows, and caches
hot reads:

```typescript
async findById(id: string | number): Promise<TProvinceSelect | null> {
	const cacheKey = `${this.cachePrefix}:id:${id}`;
	const cached = await this.redisClient.get(cacheKey);
	if (cached === 'null') return null;
	if (cached) return JSON.parse(cached) as TProvinceSelect;

	const [row] = await this.database
		.select()
		.from(province)
		.where(and(eq(province.id, String(id)), isNull(province.deletedAt)));

	await this.redisClient.set(
		cacheKey, JSON.stringify(row ?? null), 'EX', this.cacheTtlSeconds,
	);
	return row ?? null;
}
```

## Why

- Caching and query tuning change together; keeping them beside the query
  they cache prevents stale-read bugs.
- The repository interface is the seam for testing services without a DB.
- Soft-delete semantics (`deletedAt` filtering, `restore`, `forceDelete`)
  must be enforced in exactly one place — see `drizzle-soft-deletes`.

## Anti-patterns

- A service building its own `db.select(...)` "just this once" — now cache
  invalidation has two writers.
- Repositories returning HTTP envelopes or `{ message: '...' }` error
  shapes — they return domain rows or `null`.
- Ad-hoc queries in controllers bypassing the repository entirely.
