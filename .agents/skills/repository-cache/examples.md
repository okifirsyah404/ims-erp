# Worked examples

Both examples live in `apps/backend/src/app/location/repositories/`.

## Leaf entity — `province.repository.ts`

No parent. Prefix `location:province`.

```ts
private readonly cachePrefix = 'location:province';
private readonly cacheTtlSeconds = 300;

async findAll() {
	const cacheKey = `${this.cachePrefix}:all`;
	const cached = await this.redisClient.get(cacheKey);
	if (cached) return JSON.parse(cached) as TProvinceSelect[];
	// ... SELECT ... ORDER BY name
	await this.redisClient.set(cacheKey, JSON.stringify(rows), 'EX', this.cacheTtlSeconds);
	return rows;
}

private async invalidate(ids: string[]): Promise<void> {
	await this.redisClient.del(
		`${this.cachePrefix}:all`,
		...ids.map((id) => `${this.cachePrefix}:id:${id}`),
	);
}
```

Keys used: `location:province:all`, `location:province:id:{id}`.

## Child entity — `district.repository.ts`

Child of `regency`. Prefix `location:district`, parent key segment `regency`.

```ts
private readonly cachePrefix = 'location:district';

// per-parent list cache
async findByRegencyId(regencyId: string) {
	const cacheKey = `${this.cachePrefix}:regency:${regencyId}`;
	const cached = await this.redisClient.get(cacheKey);
	if (cached) return JSON.parse(cached) as TDistrictSelect[];
	// ... SELECT ... WHERE regencyId = ? AND deletedAt IS NULL
	await this.redisClient.set(cacheKey, JSON.stringify(rows), 'EX', this.cacheTtlSeconds);
	return rows;
}

private async invalidate(ids: string[], regencyIds: (string | null)[]): Promise<void> {
	await this.redisClient.del(
		`${this.cachePrefix}:all`,
		...ids.map((id) => `${this.cachePrefix}:id:${id}`),
		...regencyIds.map((rid) => `${this.cachePrefix}:regency:${rid}`),
	);
}
```

Keys used:

| Key                                    | Populated by         |
| -------------------------------------- | -------------------- |
| `location:district:all`                | `findAll`            |
| `location:district:id:{id}`            | `findById`           |
| `location:district:regency:{regencyId}`| `findByRegencyId`    |

Writes take ids **and** parent ids from the `RETURNING` clause:

```ts
const affected = await this.database
	.update(district)
	.set({ deletedAt: new Date() })
	.where(and(inArray(district.id, ids), isNull(district.deletedAt)))
	.returning({ id: district.id, regencyId: district.regencyId });

await this.invalidate(
	affected.map((row) => row.id),
	[...new Set(affected.map((row) => row.regencyId).filter(Boolean))],
);
```

`village.repository.ts` and `regency.repository.ts` are the same shape with
`district` / `province` as the parent key.

### Code-based parent lookup (regency)

`findByProvinceCode` resolves the code to an id with one uncached query, then
delegates to the cached `findByProvinceId`. Use this whenever the public API
takes a natural key but the cache is keyed by surrogate id.

## Tenant-scoped variant — `sales/repositories/`

`quotation.repository.ts` and `payment.repository.ts` cache their hot read
(`findById`) with keys scoped by tenant, since every query filters by
`organizationId`:

```ts
const cacheKey = `${this.cachePrefix}:${organizationId}:id:${id}`; // sales:quotation:org_x:id:y
// ... miss → SELECT WHERE id = ? AND organizationId = ? LIMIT 1
if (row) await this.invalidate(organizationId, id); // after update / transitionStatus / approve / execute
```

Note: `organization.repository.ts` caches `findById` (which intentionally
includes soft-deleted rows per its contract) but deliberately does **not**
cache member reads — membership mutations go through the Better Auth API
outside the repository, so there is no invalidation hook.
