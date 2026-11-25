/**
 * Portal guard rules.
 *
 * `_authed` depends on this to decide login vs. denial, so the three ways a
 * session can be refused are worth pinning: an excluded app role wins over an
 * employee record, an empty access probe is a denial, and a failed probe fails
 * closed instead of leaving a session the app cannot use.
 */
import { beforeEach, describe, expect, mock, test } from 'bun:test';
import { QueryClient } from '@tanstack/react-query';

const signOutCalls: number[] = [];

mock.module('@/lib/auth-client', () => ({
	signOut: async () => {
		signOutCalls.push(1);
		return { data: null, error: null };
	},
}));

const { canEnterPortal } = await import('@/lib/portal-guard');

function clientWith(probe: () => Promise<unknown>) {
	const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	// The guard only reads the probe's payload, so the whole call is stubbed.
	queryClient.ensureQueryData = (() => probe()) as unknown as typeof queryClient.ensureQueryData;
	return queryClient;
}

beforeEach(() => {
	signOutCalls.length = 0;
});

describe('canEnterPortal', () => {
	test('an app admin is refused even with an employee record, and the session is revoked', async () => {
		const queryClient = clientWith(async () => ({ organizations: [{ organizationId: 'o1' }] }));
		const entry = await canEnterPortal({ user: { role: 'admin' } }, queryClient);
		expect(entry.kind).toBe('denied');
		expect(entry.kind === 'denied' && entry.reason.kind).toBe('excluded-role');
		expect(signOutCalls.length).toBe(1);
	});

	test('investor and customer are refused', async () => {
		for (const role of ['investor', 'customer']) {
			const queryClient = clientWith(async () => ({ organizations: [{ organizationId: 'o1' }] }));
			const entry = await canEnterPortal({ user: { role: `user,${role}` } }, queryClient);
			expect(entry.kind).toBe('denied');
		}
	});

	test('no employee record anywhere is a denial', async () => {
		const queryClient = clientWith(async () => ({ organizations: [] }));
		const entry = await canEnterPortal({ user: { role: 'user' } }, queryClient);
		expect(entry.kind).toBe('denied');
		expect(entry.kind === 'denied' && entry.reason.kind).toBe('no-employee-record');
		expect(signOutCalls.length).toBe(1);
	});

	test('an employee with a record enters', async () => {
		const queryClient = clientWith(async () => ({
			organizations: [{ organizationId: 'o1', employeeId: 'e1', employeeCode: 'EMP-1', fullName: 'A' }],
		}));
		const entry = await canEnterPortal({ user: { role: 'user' } }, queryClient);
		expect(entry.kind).toBe('ok');
		expect(signOutCalls.length).toBe(0);
	});

	test('a failed probe fails closed', async () => {
		const queryClient = clientWith(async () => {
			throw new Error('boom');
		});
		const entry = await canEnterPortal({ user: { role: 'user' } }, queryClient);
		expect(entry.kind).toBe('denied');
		expect(entry.kind === 'denied' && entry.reason.kind).toBe('probe-failed');
		expect(signOutCalls.length).toBe(1);
	});
});
