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
	SALES_ORDER_REPOSITORY_TOKEN,
} from '../../src/app/sales/constants/di';
import {
	PERMISSION_RESOLVER_TOKEN,
	type IPermissionResolver,
} from '../../src/authorization/permission-resolver';
import type { ErpPermissionRequest } from '@ims-erp/common';

export type TestUser = {
	id: string;
	/** Organization id the user is a member of (null = no membership). */
	organizationId: string | null;
	/** Comma-separated organization roles. */
	role: string;
	/**
	 * Platform role stored on the Better Auth user row (ADR-0006).
	 *
	 * @remarks
	 * Deliberately a separate key from {@link role}, which is the
	 * **organization** role. `requireGlobalAdmin` reads `user.role` on the
	 * session, so the two must not be conflated: a user can be an
	 * organization `admin` and still not be a platform admin.
	 */
	globalRole?: 'admin' | 'user';
};

export type FixtureState = {
	users: Record<string, TestUser>;
	/** Simulated removal: header keys that lost membership mid-session. */
	revoked: Set<string>;
};

export const ORG_A = 'org-a';const ORG_B = 'org-b';

export const fixture = {
	orgA: ORG_A,
	orgB: ORG_B,
	users: {
		owner: {
			id: 'user-owner',
			organizationId: ORG_A,
			role: 'owner',
			globalRole: 'user',
		},
		admin: {
			id: 'user-org-admin',
			organizationId: ORG_A,
			role: 'admin',
			globalRole: 'user',
		},
		sales: {
			id: 'user-sales',
			organizationId: ORG_A,
			role: 'sales',
			globalRole: 'user',
		},
		salesFinance: {
			id: 'user-sales-finance',
			organizationId: ORG_A,
			role: 'sales,owner',
			globalRole: 'user',
		},
		technician: {
			id: 'user-tech',
			organizationId: ORG_A,
			role: 'technician',
			globalRole: 'user',
		},
		member: {
			id: 'user-member',
			organizationId: ORG_A,
			role: 'member',
			globalRole: 'user',
		},
		/**
		 * Stock-capable roles used by the S3 tests.
		 *
		 * @remarks
		 * `warehouse` holds every `stock:*` grant plus
		 * `stock_adjustment:read|create|submit` — but **not** `approve`/`post`.
		 * `finance` holds only `stock:read`. Those two roles are the interesting
		 * pair for proving the stock walls; the older fixtures all lack stock
		 * grants entirely.
		 */
		warehouse: {
			id: 'user-warehouse',
			organizationId: ORG_A,
			role: 'warehouse',
			globalRole: 'user',
		},
		finance: {
			id: 'user-finance',
			organizationId: ORG_A,
			role: 'finance',
			globalRole: 'user',
		},
		globalAdmin: {
			id: 'user-global-admin',
			organizationId: null,
			role: '',
			globalRole: 'admin',
		},
		/** Platform admin who is ALSO an owner of org A — warehouse routes use this. */
		globalAdminOwner: {
			id: 'user-global-admin-owner',
			organizationId: ORG_A,
			role: 'owner',
			globalRole: 'admin',
		},
		revoked: {
			id: 'user-revoked',
			organizationId: ORG_A,
			role: 'sales',
			globalRole: 'user',
		},
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
 * Static closed-catalog permission resolver stub. The production resolver
 * reads `erpRoleGrants` via `authorizeErpPermissions`; the mock mirrors it
 * (roles are a closed enum — no dynamic grant rows exist any more).
 */
export function installPermissionResolverMock(): void {
	const resolver: IPermissionResolver = {
		async hasPermission(
			_organizationId: string,
			roleNames: readonly string[],
			request: ErpPermissionRequest,
		): Promise<boolean> {
			const { authorizeErpPermissions } = await import(
				'../../src/providers/better-auth/ac/organization-ac'
			);
			return authorizeErpPermissions(roleNames, request);
		},
	};
	container.register(PERMISSION_RESOLVER_TOKEN, { useValue: resolver });
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
						user: {
							id: user.id,
							email: `${user.id}@test.local`,
							name: key,
							// Platform role, read by `requireGlobalAdmin`. Absent
							// here, no fixture could ever pass that policy.
							role: user.globalRole ?? 'user',
						},
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

import type { IQuotationRepository } from '../../src/app/sales/contracts/quotation.repository.interface';
import type { TPaymentRepository } from '../../src/app/sales/contracts/payment.repository.interface';
import { CUSTOMER_SERVICE_TOKEN, LEAD_SERVICE_TOKEN } from '../../src/app/crm/constants/di';
import { ITEM_SERVICE_TOKEN } from '../../src/app/inventory/constants/di';
import { NUMBERING_SERVICE_TOKEN } from '../../src/app/organization/constants/di';
import { USER_SERVICE_TOKEN } from '../../src/app/user/constants/di';
import { OBJECT_STORAGE_TOKEN } from '../../src/providers/s3/object-storage';

export const TEST_CUSTOMER_ID = '0190a1b2-0000-7000-8000-000000000001';
export const TEST_ITEM_ID = '0190a1b2-0000-7000-8000-000000000002';

/** A valid quotation body: one active customer, one item line. */
export function quotationBody(title = 'Penawaran access door') {
	return {
		customerId: TEST_CUSTOMER_ID,
		title,
		lines: [{ itemId: TEST_ITEM_ID, quantity: 2 }],
	};
}

/** Registers mock repositories and neighbour services for the sales module. */
export function installSalesMocks() {
	const quotationStore = new Map<string, Record<string, unknown>>();
	let sequence = 0;

	/**
	 * In-memory quotations, typed as the real contract so a fake that drifts
	 * from `IQuotationRepository` is a compile error.
	 */
	const quotationRepository: IQuotationRepository = {
		async paginate(request) {
			const all = [...quotationStore.values()].filter(
				(row) => !request.createdBy || row.createdBy === request.createdBy,
			);
			const data = all.slice((request.page - 1) * request.limit, request.page * request.limit);
			return {
				data: data as never[],
				meta: {
					page: request.page,
					limit: request.limit,
					total: all.length,
					totalPages: Math.ceil(all.length / request.limit) || 1,
				},
			};
		},
		async findById(id) {
			return (quotationStore.get(id) ?? null) as never;
		},
		async findItems() {
			return [];
		},
		async findRevisions(baseCode) {
			return [...quotationStore.values()].filter((row) => row.baseCode === baseCode) as never[];
		},
		async findHistory() {
			return [];
		},
		async create(header) {
			const id = `0190a1b2-0000-7000-8000-${String(++sequence).padStart(12, '0')}`;
			const row = { ...header, id, baseCode: header.code, revision: 0, status: 'draft', validUntil: null };
			quotationStore.set(id, row);
			return row as never;
		},
		async replaceDraft(id, header) {
			const row = quotationStore.get(id);
			if (!row || row.status !== 'draft') return null;
			const updated = { ...row, ...header };
			quotationStore.set(id, updated);
			return updated as never;
		},
		async transition(id, from, to, patch) {
			const row = quotationStore.get(id);
			if (!row || !from.includes(row.status as never)) return null;
			const updated = { ...row, ...patch, status: to };
			quotationStore.set(id, updated);
			return updated as never;
		},
		async createRevision() {
			return null;
		},
	};

	container.register(CUSTOMER_SERVICE_TOKEN, {
		useValue: {
			async getActiveCustomer(id: string) {
				return id === TEST_CUSTOMER_ID
					? {
							id,
							code: 'PT-UJI',
							name: 'PT Uji',
							customerType: 'company',
							email: null,
							phone: null,
							whatsapp: null,
							taxId: null,
							addressLine: null,
							postalCode: null,
						}
					: null;
			},
			async getContact() {
				return null;
			},
		} as never,
	});
	container.register(LEAD_SERVICE_TOKEN, { useValue: { noteQuotation: async () => true } as never });
	container.register(ITEM_SERVICE_TOKEN, {
		useValue: {
			async getActiveItems(ids: string[]) {
				return ids.includes(TEST_ITEM_ID)
					? [
							{
								id: TEST_ITEM_ID,
								sku: 'SG-01',
								name: 'Swing gate',
								specification: null,
								unitLabel: 'unit',
								sellingPrice: 150_000_000,
							},
						]
					: [];
			},
		} as never,
	});
	container.register(NUMBERING_SERVICE_TOKEN, {
		useValue: { next: async () => `${sequence + 1}/QT/IMS/XI/26` } as never,
	});
	container.register(USER_SERVICE_TOKEN, { useValue: { getUser: async () => null } as never });
	container.register(OBJECT_STORAGE_TOKEN, { useValue: { presignGet: () => '', put: async () => undefined } as never });

	const payments: Record<string, Record<string, unknown>> = {};
	let paySeq = 0;
	/** Typed as the real contract - see {@link quotationRepository}. */
	const paymentRepository: TPaymentRepository = {
		async create(input) {
			const id = `p-${++paySeq}`;
			const row = { id, ...input, status: 'pending' };
			payments[id] = row;
			return row as never;
		},
		async findById(organizationId, id) {
			const row = payments[id];
			if (!row || row.organizationId !== organizationId) return null;
			return row as never;
		},
		async approve(organizationId, id, actorUserId) {
			const row = payments[id];
			if (!row || row.organizationId !== organizationId) return null;
			if (row.status !== 'pending') return null;
			const updated = {
				...row,
				status: 'approved',
				approvedBy: actorUserId,
			};
			payments[id] = updated;
			return updated as never;
		},
		async execute(organizationId, id, actorUserId) {
			const row = payments[id];
			if (!row || row.organizationId !== organizationId) return null;
			if (row.status !== 'approved') return null;
			const updated = {
				...row,
				status: 'executed',
				executedBy: actorUserId,
			};
			payments[id] = updated;
			return updated as never;
		},
	};

	container.register(QUOTATION_REPOSITORY_TOKEN, { useValue: quotationRepository });
	container.register(SALES_ORDER_REPOSITORY_TOKEN, { useValue: { findLiveByQuotation: async () => null } as never });
	container.register(PAYMENT_REPOSITORY_TOKEN, { useValue: paymentRepository });

	return { quotationStore, payments };
}

/**
 * Builds the Elysia app: real erpGuard + real quotation and payment
 * controllers and services over mocked repositories and neighbours.
 */
export async function buildTestApp() {
	installSalesMocks();
	installPermissionResolverMock();
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
	const { QuotationService } = await import('../../src/app/sales/services/quotation.service');
	const { QuotationController } = await import(
		'../../src/app/sales/controllers/quotation.controller'
	);
	const { erpGuard } = await import('../../src/authorization/elysia-auth');

	const { QUOTATION_SERVICE_TOKEN } = await import('../../src/app/sales/constants/di');
	container.register(SALES_SERVICE_TOKEN, { useClass: SalesService });
	container.register(QUOTATION_SERVICE_TOKEN, { useClass: QuotationService });

	return new Elysia()
		.use(erpGuard())
		.use(QuotationController.plugin())
		.use(SalesController.plugin());
}
