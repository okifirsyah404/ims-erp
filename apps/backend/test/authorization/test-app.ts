/**
 * Test app factory for ERP authorization tests.
 *
 * Strategy (per testing-strategy.md + bun-test skill): the Better Auth
 * server API and the Drizzle database are mocked at their seams; the Elysia
 * request pipeline (erpGuard macro + controller + service) is REAL and
 * exercised through app.handle().
 */
import { Elysia } from 'elysia';
import { container } from 'tsyringe';
import { mock } from 'bun:test';
import {
	QUOTATION_REPOSITORY_TOKEN,
	PAYMENT_REPOSITORY_TOKEN,
} from '../../src/app/sales/constants/di';

export type TestUser = {
	id: string;
	/** Organization id the user is a member of (null = no membership). */
	organizationId: string | null;
	/** Comma-separated organization roles. */
	role: string;
};

export type FixtureState = {
	users: Record<string, TestUser>;
	/** Simulated removal: header keys that lost membership mid-session. */
	revoked: Set<string>;
};

const ORG_A = 'org-a';
const ORG_B = 'org-b';

export const fixture = {
	orgA: ORG_A,
	orgB: ORG_B,
	users: {
		owner: { id: 'user-owner', organizationId: ORG_A, role: 'owner' },
		admin: { id: 'user-org-admin', organizationId: ORG_A, role: 'admin' },
		sales: { id: 'user-sales', organizationId: ORG_A, role: 'sales' },
		salesFinance: {
			id: 'user-sales-finance',
			organizationId: ORG_A,
			role: 'sales,owner',
		},
		technician: { id: 'user-tech', organizationId: ORG_A, role: 'technician' },
		member: { id: 'user-member', organizationId: ORG_A, role: 'member' },
		globalAdmin: { id: 'user-global-admin', organizationId: null, role: '' },
		revoked: { id: 'user-revoked', organizationId: ORG_A, role: 'sales' },
	} satisfies Record<string, TestUser>,
};

let state: FixtureState = {
	users: { ...fixture.users },
	revoked: new Set(['user-revoked']),
};

export function resetFixture(): void {
	state = {
		users: { ...fixture.users },
		revoked: new Set(['user-revoked']),
	};
}

/**
 * Installs a mock for the Better Auth auth module seam used by the guard.
 * Session resolution: header `x-test-session: <key>`; no header = anonymous.
 * Membership resolution: getFullOrganization only returns an organization
 * when the session user is a member of the queried id.
 */
export function installAuthMock(): void {
	mock.module('@providers/better-auth/auth', () => ({
		auth: {
			api: {
				async getSession({ headers }: { headers: Headers }) {
					const key = headers.get('x-test-session');
					if (!key) return null;
					const user = state.users[key];
					if (!user) return null;
					return {
						user: { id: user.id, email: `${user.id}@test.local`, name: key },
						session: {
							activeOrganizationId: user.organizationId,
							userId: user.id,
						},
					};
				},
				async getFullOrganization({
					headers,
					query,
				}: {
					headers: Headers;
					query: { organizationId?: string };
				}) {
					const key = headers.get('x-test-session');
					if (!key) return null;
					const user = state.users[key];
					if (!user || state.revoked.has(user.id)) return null;
					const organizationId = query?.organizationId;
					if (!organizationId || user.organizationId !== organizationId) {
						// Not a member of the queried organization.
						return null;
					}
					return {
						id: organizationId,
						name: 'Org',
						members: [
							{
								id: `member-${user.id}`,
								userId: user.id,
								organizationId,
								role: user.role,
							},
						],
					};
				},
			},
		},
	}));
}

/** Registers mock repositories for the sales module (records calls). */
export function installSalesMocks() {
	const quotationStore = new Map<string, Record<string, unknown>>();
	let sequence = 0;

	const quotationRepository = {
		async create(input: Record<string, unknown>) {
			const id = `q-${++sequence}`;
			const row = { id, status: 'draft', ...input };
			quotationStore.set(id, row);
			return row;
		},
		async findById(organizationId: string, id: string) {
			const row = quotationStore.get(id);
			if (!row || row.organizationId !== organizationId) return null;
			return row;
		},
		async list(organizationId: string, pagination: { page: number; limit: number }) {
			const all = [...quotationStore.values()].filter(
				(r) => r.organizationId === organizationId,
			);
			return {
				total: all.length,
				data: all.slice(
					(pagination.page - 1) * pagination.limit,
					pagination.page * pagination.limit,
				),
			};
		},
		async update(
			organizationId: string,
			id: string,
			patch: Record<string, unknown>,
		) {
			const row = quotationStore.get(id);
			if (!row || row.organizationId !== organizationId) return null;
			const updated = { ...row, ...patch };
			quotationStore.set(id, updated);
			return updated;
		},
		async transitionStatus(
			organizationId: string,
			id: string,
			from: string,
			to: string,
		) {
			const row = quotationStore.get(id);
			if (!row || row.organizationId !== organizationId) return null;
			if (row.status !== from) return null;
			const updated = { ...row, status: to };
			quotationStore.set(id, updated);
			return updated;
		},
	};

	const payments: Record<string, Record<string, unknown>> = {};
	let paySeq = 0;
	const paymentRepository = {
		async create(input: Record<string, unknown>) {
			const id = `p-${++paySeq}`;
			const row = { id, ...input, status: 'pending' };
			payments[id] = row;
			return row;
		},
		async findById(organizationId: string, id: string) {
			const row = payments[id];
			if (!row || row.organizationId !== organizationId) return null;
			return row;
		},
		async approve(
			organizationId: string,
			id: string,
			actorUserId: string,
		) {
			const row = payments[id];
			if (!row || row.organizationId !== organizationId) return null;
			if (row.status !== 'pending') return null;
			const updated = {
				...row,
				status: 'approved',
				approvedBy: actorUserId,
			};
			payments[id] = updated;
			return updated;
		},
		async execute(
			organizationId: string,
			id: string,
			actorUserId: string,
		) {
			const row = payments[id];
			if (!row || row.organizationId !== organizationId) return null;
			if (row.status !== 'approved') return null;
			const updated = {
				...row,
				status: 'executed',
				executedBy: actorUserId,
			};
			payments[id] = updated;
			return updated;
		},
	};

	container.register(QUOTATION_REPOSITORY_TOKEN, { useValue: quotationRepository });
	container.register(PAYMENT_REPOSITORY_TOKEN, { useValue: paymentRepository });

	return { quotationStore, payments };
}

/**
 * Builds the Elysia app: real erpGuard + real SalesController + real
 * SalesService over mocked repositories.
 */
export async function buildTestApp() {
	installSalesMocks();
	// Import after mocks are installed (bun mock.module is hoist-sensitive).
	const { SalesService } = await import(
		'../../src/app/sales/services/sales.service'
	);
	const { SALES_SERVICE_TOKEN } = await import(
		'../../src/app/sales/constants/di'
	);
	const { SalesController } = await import(
		'../../src/app/sales/controllers/sales.controller'
	);
	const { erpGuard } = await import('../../src/authorization/elysia-auth');

	container.register(SALES_SERVICE_TOKEN, { useClass: SalesService });

	return new Elysia().use(erpGuard()).use(SalesController.plugin());
}
