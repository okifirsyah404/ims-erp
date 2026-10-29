import type { TPaginationResult } from '@ims-erp/common';

type Row = Record<string, unknown>;

type ChainConfig = {
	/** Rows returned when the chain executes (select ... / returning). */
	rows?: Row[];
	/** Value returned for count-style selects: [{ value: n }] via `count`. */
	count?: number;
};

/**
 * Minimal record of calls captured from the fluent chain, for assertions
 * (e.g. which table was queried, what the caller did with the builder).
 */
export type CapturedQuery = {
	method: string;
	table?: unknown;
	args?: unknown[];
};

/**
 * Chainable Drizzle query-builder mock.
 *
 * Returns a self-proxy so any method chain works; awaiting it resolves to
 * the configured rows (or count result). Captures method calls for
 * filter/cache assertions. Per bun-test skill rule 2.1: one shared helper,
 * configured per test, never a real connection.
 */
export function mockDb(config: ChainConfig = {}) {
	const captured: CapturedQuery[] = [];
	const resolveValue = () => config.rows ?? [];

	const builder: any = new Proxy(
		{},
		{
			get(_target, prop: string) {
				if (prop === 'then' || prop === 'catch' || prop === 'finally') {
					// Awaited execution — resolve configured data.
					if (prop === 'then') {
						return (onFulfilled: (v: unknown) => unknown) =>
							Promise.resolve(resolveValue()).then(onFulfilled);
					}
					return (handler: (e?: unknown) => unknown) =>
						Promise.resolve(resolveValue())[prop](handler as never);
				}
				return (...args: unknown[]) => {
					captured.push({ method: prop, args });
					// count() selects resolve as [{ value: n }]
					if (prop === 'select' && args.length > 0) {
						// caller passes select projection; nothing to do
					}
					if (prop === 'from') captured[captured.length - 1].table = args[0];
					return builder;
				};
			},
		},
	);

	/**
	 * Configure the mock so that the *first* awaited chain in a paginate()
	 * (count select) resolves to `[{ value: count }]` and subsequent chains
	 * resolve to `rows`. Simpler variant: always return `config.rows` unless
	 * `config.count` is set, in which case the first execution returns the
	 * count shape and later ones return rows.
	 */
	let executions = 0;
	// Wrap execution to alternate count/rows for paginate()-style usage.
	// eslint-disable-next-line unicorn/no-thenable -- builder must be awaitable, like the real Drizzle query builder
	builder.then = (onFulfilled: (v: unknown) => unknown) => {
		executions += 1;
		const value =
			config.count !== undefined && executions === 1
				? [{ value: config.count }]
				: resolveValue();
		return Promise.resolve(value).then(onFulfilled);
	};

	return {
		db: builder as never,
		captured,
	};
}

/**
 * Redis client mock per bun-test skill rule 2.2: captures TTLs and deletions.
 */
export function mockRedis(initial: Record<string, string | null> = {}) {
	const store = new Map<string, string | null>(Object.entries(initial));
	const ttls = new Map<string, number>();

	return {
		client: {
			get: async (key: string) => store.get(key) ?? null,
			set: async (key: string, value: string, _mode?: string, ttl?: number) => {
				store.set(key, value);
				if (ttl !== undefined) ttls.set(key, ttl);
				return 'OK';
			},
			del: async (...keys: string[]) => {
				let n = 0;
				for (const key of keys) {
					if (store.delete(key)) n += 1;
				}
				return n;
			},
		} as never,
		store,
		ttls,
	};
}

export type { TPaginationResult };
