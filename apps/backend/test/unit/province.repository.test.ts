import { describe, expect, test } from 'bun:test';
import { ProvinceRepository } from '../../src/app/location/repositories/province.repository';
import { mockCache, mockDb } from '../helpers/mock-db';

// Cache round-trips rows through JSON, so Dates come back as strings; the
// repository returns the deserialized cache value as-is.
const row = {
	id: '1',
	code: '11',
	name: 'Aceh',
	createdAt: new Date('2024-01-01T00:00:00Z'),
	updatedAt: null,
	deletedAt: null,
};

describe('ProvinceRepository', () => {
	test('findAll: cache miss queries DB excluding soft-deleted rows, then caches with 300s TTL', async () => {
		const { db, captured } = mockDb({ rows: [row] });
		const cache = mockCache();

		const repository = new ProvinceRepository(db, cache.client);
		const result = await repository.findAll();

		expect(result).toEqual([row]);
		// soft-delete filter was applied via where(isNull(deletedAt))
		const whereCall = captured.find((c) => c.method === 'where');
		expect(whereCall).toBeDefined();
		// cache write with TTL
		expect(cache.store.get('location:province:all')).toBe(JSON.stringify([row]));
		expect(cache.ttls.get('location:province:all')).toBe(300);
	});

	test('findAll: cache hit skips DB entirely', async () => {
		const { db, captured } = mockDb({ rows: [row] });
		const cache = mockCache({
			'location:province:all': JSON.stringify([row]),
		});

		const repository = new ProvinceRepository(db, cache.client);
		const result = await repository.findAll();

		expect(result).toEqual(JSON.parse(JSON.stringify([row])));
		expect(captured.find((c) => c.method === 'select')).toBeUndefined();
	});

	test('findById: cache miss stores row under id key', async () => {
		const { db } = mockDb({ rows: [row] });
		const cache = mockCache();

		const repository = new ProvinceRepository(db, cache.client);
		const result = await repository.findById('1');

		expect(result).toEqual(row);
		expect(cache.store.get('location:province:id:1')).toBe(JSON.stringify(row));
		expect(cache.ttls.get('location:province:id:1')).toBe(300);
	});

	test('findById: cached "null" short-circuits without DB query', async () => {
		const { db, captured } = mockDb({ rows: [] });
		const cache = mockCache({ 'location:province:id:404': 'null' });

		const repository = new ProvinceRepository(db, cache.client);
		const result = await repository.findById('404');

		expect(result).toBeNull();
		expect(captured.find((c) => c.method === 'select')).toBeUndefined();
	});

	test('create: inserts and invalidates list + id cache keys', async () => {
		const { db } = mockDb({ rows: [row] });
		const cache = mockCache({
			'location:province:all': JSON.stringify([row]),
			'location:province:id:1': JSON.stringify(row),
		});

		const repository = new ProvinceRepository(db, cache.client);
		const created = await repository.create(row as never);

		expect(created).toEqual(row);
		expect(cache.store.has('location:province:all')).toBe(false);
		expect(cache.store.has('location:province:id:1')).toBe(false);
	});
});
