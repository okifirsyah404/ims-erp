import { afterEach, describe, expect, test } from 'bun:test';
import {
	type QueueWorker,
	startWorkers,
	stopWorkers,
} from '../../src/providers/queue/worker-registry';

/** Builds a stub worker that records how it was driven. */
function stubWorker(behavior: { failClose?: Error } = {}): QueueWorker & {
	errorListeners: Array<(error: Error) => void>;
	closed: number;
} {
	const worker = {
		errorListeners: [] as Array<(error: Error) => void>,
		closed: 0,
		onError(listener: (error: Error) => void) {
			worker.errorListeners.push(listener);
		},
		async close() {
			worker.closed += 1;
			if (behavior.failClose) throw behavior.failClose;
		},
	};
	return worker;
}

afterEach(async () => {
	// The registry is module state; leave it clean for the next test.
	await stopWorkers();
});

describe('startWorkers', () => {
	test('forwards the failure sink to every worker', () => {
		const first = stubWorker();
		const second = stubWorker();
		const sink = () => {};

		startWorkers([first, second], sink);

		expect(first.errorListeners).toEqual([sink]);
		expect(second.errorListeners).toEqual([sink]);
	});

	test('rejects a second call instead of leaking the first set', () => {
		startWorkers([stubWorker()], () => {});

		expect(() => startWorkers([stubWorker()], () => {})).toThrow(
			'startWorkers() called twice',
		);
	});

	test('allows a fresh start after stopping', async () => {
		startWorkers([stubWorker()], () => {});
		await stopWorkers();

		expect(() => startWorkers([stubWorker()], () => {})).not.toThrow();
	});
});

describe('stopWorkers', () => {
	test('closes every started worker', async () => {
		const first = stubWorker();
		const second = stubWorker();
		startWorkers([first, second], () => {});

		await stopWorkers();

		expect(first.closed).toBe(1);
		expect(second.closed).toBe(1);
	});

	test('closes the rest when one worker throws', async () => {
		const failure = new Error('close timed out');
		const failing = stubWorker({ failClose: failure });
		const healthy = stubWorker();
		startWorkers([failing, healthy], () => {});

		const errors = await stopWorkers();

		// allSettled, not all: one bad worker must not block the others.
		expect(healthy.closed).toBe(1);
		expect(errors).toEqual([failure]);
	});

	test('is safe when nothing was started', async () => {
		expect(await stopWorkers()).toEqual([]);
	});
});
