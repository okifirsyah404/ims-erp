import { afterEach, describe, expect, mock, test } from 'bun:test';

/**
 * Unit tests for the Better Auth secondary-storage adapter.
 * The shared Bun RedisClient is mocked at its module seam; no real Redis
 * connection is required.
 */

const calls = {
	get: [] as string[],
	setex: [] as { key: string; ttl: number; value: string }[],
	set: [] as { key: string; value: string }[],
	del: [] as string[],
	getdel: [] as string[],
	incr: [] as string[],
	expire: [] as { key: string; ttl: number }[],
};

const store = new Map<string, string>();

mock.module('@providers/redis/redis', () => ({
	redisClient: {
		get: async (key: string) => {
			calls.get.push(key);
			return store.get(key) ?? null;
		},
		set: async (key: string, value: string) => {
			calls.set.push({ key, value });
			store.set(key, value);
			return 'OK';
		},
		setex: async (key: string, ttl: number, value: string) => {
			calls.setex.push({ key, ttl, value });
			store.set(key, value);
			return 'OK';
		},
		del: async (key: string) => {
			calls.del.push(key);
			return store.delete(key) ? 1 : 0;
		},
		getdel: async (key: string) => {
			calls.getdel.push(key);
			const value = store.get(key) ?? null;
			store.delete(key);
			return value;
		},
		incr: async (key: string) => {
			calls.incr.push(key);
			const next = Number(store.get(key) ?? '0') + 1;
			store.set(key, String(next));
			return next;
		},
		expire: async (key: string, ttl: number) => {
			calls.expire.push({ key, ttl });
			return 1;
		},
	},
}));

const { betterAuthSecondaryStorage } = await import(
	'@providers/better-auth/options/secondary-storage.auth'
);

afterEach(() => {
	store.clear();
	calls.get.length = 0;
	calls.set.length = 0;
	calls.setex.length = 0;
	calls.del.length = 0;
	calls.getdel.length = 0;
	calls.incr.length = 0;
	calls.expire.length = 0;
});

describe('betterAuthSecondaryStorage', () => {
	test('get returns null for missing keys and prefixes with better-auth:', async () => {
		const value = await betterAuthSecondaryStorage.get('missing');
		expect(value).toBeNull();
		expect(calls.get).toEqual(['better-auth:missing']);
	});

	test('set with ttl uses setex with seconds and get round-trips', async () => {
		await betterAuthSecondaryStorage.set('session-token', '{"userId":"u1"}', 7 * 24 * 60 * 60);
		expect(calls.setex).toEqual([
			{ key: 'better-auth:session-token', ttl: 604800, value: '{"userId":"u1"}' },
		]);
		const value = await betterAuthSecondaryStorage.get('session-token');
		expect(value).toBe('{"userId":"u1"}');
	});

	test('set without ttl falls back to non-expiring set', async () => {
		await betterAuthSecondaryStorage.set('no-expiry', 'v');
		expect(calls.setex.length).toBe(0);
		expect(calls.set).toEqual([{ key: 'better-auth:no-expiry', value: 'v' }]);
	});

	test('set with ttl=0 uses non-expiring set', async () => {
		await betterAuthSecondaryStorage.set('zero-ttl', 'v', 0);
		expect(calls.setex.length).toBe(0);
		expect(calls.set).toEqual([{ key: 'better-auth:zero-ttl', value: 'v' }]);
	});

	test('delete removes the key and returns void', async () => {
		await betterAuthSecondaryStorage.set('k', 'v');
		await betterAuthSecondaryStorage.delete('k');
		expect(calls.del).toEqual(['better-auth:k']);
		expect(await betterAuthSecondaryStorage.get('k')).toBeNull();
	});

	test('getAndDelete is atomic and returns the previous value', async () => {
		await betterAuthSecondaryStorage.set('otp', '123456');
		const value = await betterAuthSecondaryStorage.getAndDelete('otp');
		expect(value).toBe('123456');
		expect(await betterAuthSecondaryStorage.get('otp')).toBeNull();
	});

	test('increment creates a counter with ttl on first call then extends it', async () => {
		const first = await betterAuthSecondaryStorage.increment('rate:u1', 60);
		expect(first).toBe(1);
		const second = await betterAuthSecondaryStorage.increment('rate:u1', 60);
		expect(second).toBe(2);
		expect(calls.expire).toEqual([{ key: 'better-auth:rate:u1', ttl: 60 }]);
	});
});
