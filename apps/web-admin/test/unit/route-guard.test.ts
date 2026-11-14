import { describe, expect, mock, test } from 'bun:test';

// Stub the Better Auth client: canOpenPath only reaches it through the
// permission query, which these tests replace with a fake queryClient.
mock.module('@/lib/auth-client', () => ({
	organization: { hasPermission: async () => ({ data: { success: false } }) },
	useSession: () => ({ data: null, isPending: false }),
}));

const { canOpenPath } = await import('../../src/lib/route-guard');

type Session = {
	user: { role?: string | null };
	session: { userId: string; activeOrganizationId?: string | null };
};

/** Fake QueryClient: `orgs` for my-organizations, `grants` maps permission -> bool. */
function fakeClient(orgs: { role: string }[], grants: Record<string, boolean> = {}) {
	return {
		ensureQueryData: async () => orgs,
		fetchQuery: async (opts: { queryKey: unknown[] }) => {
			const permission = String(opts.queryKey[3]);
			return grants[permission] === true;
		},
	} as unknown as import('@tanstack/react-query').QueryClient;
}

const investorOnly: Session = {
	user: { role: 'user' },
	session: { userId: 'u1', activeOrganizationId: 'org1' },
};
const internal: Session = investorOnly;
const admin: Session = { user: { role: 'admin' }, session: { userId: 'a1', activeOrganizationId: null } };

describe('canOpenPath', () => {
	test('dashboard "/" is always allowed (no redirect loop)', async () => {
		expect(await canOpenPath('/', investorOnly, fakeClient([]))).toBe(true);
	});

	test('investor-only user is denied a permission-gated page', async () => {
		// Realistic: an investor app role holds no organization membership with
		// an internal role, so no ERP permission is granted (ADR-0018).
		const client = fakeClient([], {});
		expect(await canOpenPath('/crm/customers', investorOnly, client)).toBe(false);
	});

	test('user with internal role and the permission is allowed', async () => {
		const client = fakeClient([{ role: 'sales' }], { 'customer.read': true });
		expect(await canOpenPath('/crm/customers', internal, client)).toBe(true);
	});

	test('user with internal role but without the permission is denied', async () => {
		const client = fakeClient([{ role: 'sales' }], {});
		expect(await canOpenPath('/crm/customers', internal, client)).toBe(false);
	});

	test('app admin-only page: admin allowed, others denied', async () => {
		const client = fakeClient([]);
		expect(await canOpenPath('/admin/users', admin, client)).toBe(true);
		expect(await canOpenPath('/admin/users', investorOnly, client)).toBe(false);
	});

	test('/organizations/new is app admin only, even with organization.read', async () => {
		// The nav leaf for `/organizations` carries organization.read, which a
		// non-admin org owner holds; creating an org is still platform-only.
		const client = fakeClient([{ role: 'owner' }], { 'organization.read': true });
		expect(await canOpenPath('/organizations/new', admin, client)).toBe(true);
		expect(await canOpenPath('/organizations/new', investorOnly, client)).toBe(false);
	});

	test('path with no nav leaf is allowed here (backend still enforces)', async () => {
		expect(await canOpenPath('/account', investorOnly, fakeClient([]))).toBe(true);
	});

	test('lookup failure fails closed', async () => {
		const broken = {
			ensureQueryData: async () => {
				throw new Error('network');
			},
		} as unknown as import('@tanstack/react-query').QueryClient;
		expect(await canOpenPath('/crm/customers', investorOnly, broken)).toBe(false);
	});
});
