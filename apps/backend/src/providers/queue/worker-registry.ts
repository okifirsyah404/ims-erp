/**
 * Supervises background BullMQ workers started by the process entrypoint.
 *
 * @remarks
 * A **collector, not a container**: modules still own their workers — the
 * BullMQ `Worker` type, job processors, event names and shutdown order all stay
 * inside `<module>/queues/`. The registry only aggregates the handles the
 * composition root was handed and delegates to them, so `src/index.ts` stays at
 * one call each for start and stop regardless of how many queues exist.
 *
 * Deliberately takes **already-constructed** handles rather than resolving
 * services itself: constructing a worker requires the DI graph to be populated
 * first, and keeping construction at the call site makes that ordering visible.
 * A registry that resolved its own workers would move correctness back into
 * import order — the exact failure mode `createApp()` exists to avoid.
 *
 * The queue *connection* is not owned here. `closeQueueConnection()` must run
 * after every worker has stopped, so the entrypoint keeps both calls and their
 * order: `stopWorkers()` then `closeQueueConnection()`.
 */
export type QueueWorker = {
	/** Registers the failure listener; the registry logs, it does not rethrow. */
	onError(listener: (error: Error) => void): void;
	/** Stops the worker, letting in-flight jobs finish. */
	close(): Promise<void>;
};

/** Handles started by {@link startWorkers}, in registration order. */
let started: QueueWorker[] = [];

/**
 * Starts supervision of the given workers.
 *
 * @remarks
 * Every worker gets the same failure listener, so a worker error is logged and
 * never takes the process down — a Redis outage must not kill the HTTP API.
 * Calling twice rejects rather than silently leaking the first set.
 *
 * @param workers - Handles built after the DI graph is registered
 * @param onError - Failure sink, typically the shared pino logger
 */
export function startWorkers(
	workers: QueueWorker[],
	onError: (error: Error) => void,
): void {
	if (started.length > 0) {
		throw new Error('startWorkers() called twice; workers already started');
	}

	for (const worker of workers) {
		worker.onError(onError);
	}
	started = [...workers];
}

/**
 * Stops every started worker.
 *
 * @remarks
 * `allSettled`, not `all`: one worker hanging on `close()` must not block the
 * others or hold up process exit. Safe to call when nothing was started.
 *
 * @returns The errors from workers that failed to close, for the caller to log
 */
export async function stopWorkers(): Promise<unknown[]> {
	const workers = started;
	started = [];

	const results = await Promise.allSettled(
		workers.map((worker) => worker.close()),
	);

	return results.flatMap((result) =>
		result.status === 'rejected' ? [result.reason] : [],
	);
}
