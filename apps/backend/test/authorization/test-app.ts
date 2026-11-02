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
import {
	PERMISSION_RESOLVER_TOKEN,
	grantsAllow,
	type IPermissionResolver,
} from '../../src/authorization/permission-resolver';
import { erpRoleGrants, type ErpPermissionRequest, type ErpRoleName } from '@ims-erp/common';

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

const ORG_A = 'org-a';
const ORG_B = 'org-b';

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
	resetRoleGrants();
}

/**
 * In-memory stand-in for the per-organization `auth.roles` master data.
 * Defaults to the shared catalog grants (what the seeder materializes) and
 * can be overridden per test to prove that dynamic grants - not the static
 * catalog - decide access.
 */
const roleGrants = new Map<string, ErpPermissionRequest>();

/** Roles that always have a live row (the seeded catalog roles). */
const SEEDED_ROLES: readonly ErpRoleName[] = [
	'owner',
	'admin',
	'member',
	'sales',
	'technician',
	'finance',
];

export function resetRoleGrants(): void {
	roleGrants.clear();
	for (const role of SEEDED_ROLES) roleGrants.set(role, erpRoleGrants[role]);
}

/** Registers live role grants for one role name (per org). */
export function setRoleGrants(
	roleName: string,
	grants: ErpPermissionRequest,
): void {
	roleGrants.set(roleName, grants);
}

/**
 * Registers the mock permission resolver (the seam the guard uses). Mirrors
 * the production resolver: union the live grants of the member's roles, and
 * fall back to the static shared catalog when no live role row matches.
 */
export function installPermissionResolverMock(): void {
	const resolver: IPermissionResolver = {
		async hasPermission(
			_organizationId: string,
			roleNames: readonly string[],
			request: ErpPermissionRequest,
		): Promise<boolean> {
			const live = roleNames
				.map((name) => roleGrants.get(name))
				.filter((g): g is ErpPermissionRequest => g !== undefined);
			if (live.length === 0) {
				const { authorizeErpPermissions } = await import(
					'../../src/providers/better-auth/ac/organization-ac'
				);
				return authorizeErpPermissions(roleNames, request);
			}
			return grantsAllow(live, request);
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

import type { TPaginationResult } from '@ims-erp/common';
import type { TQuotationRepository } from '../../src/app/sales/contracts/quotation.repository.interface';
import type { TPaymentRepository } from '../../src/app/sales/contracts/payment.repository.interface';

/** Registers mock repositories for the sales module (records calls). */
export function installSalesMocks() {
	const quotationStore = new Map<string, Record<string, unknown>>();
	let sequence = 0;

	/**
	 * Typed as the real contract so the typed DI tokens accept it: a fake that
	 * drifts from `TQuotationRepository` is now a compile error, not a
	 * runtime surprise when the service calls a method that isn't there.
	 */
	const quotationRepository: TQuotationRepository = {
		async create(input) {
			const id = `q-${++sequence}`;
			const row = { id, status: 'draft', ...input };
			quotationStore.set(id, row);
			return row as never;
		},
		async findById(organizationId, id) {
			const row = quotationStore.get(id);
			if (!row || row.organizationId !== organizationId) return null;
			return row as never;
		},
		async list(organizationId, pagination) {
			const all = [...quotationStore.values()].filter(
				(r) => r.organizationId === organizationId,
			);
			const page = all.slice(
				(pagination.page - 1) * pagination.limit,
				pagination.page * pagination.limit,
			);
			const result: TPaginationResult<never> = {
				data: page as never[],
				meta: {
					page: pagination.page,
					limit: pagination.limit,
					total: all.length,
					totalPages: Math.ceil(all.length / pagination.limit) || 1,
				},
			};
			return result;
		},
		async update(organizationId, id, patch) {
			const row = quotationStore.get(id);
			if (!row || row.organizationId !== organizationId) return null;
			const updated = { ...row, ...patch };
			quotationStore.set(id, updated);
			return updated as never;
		},
		async transitionStatus(organizationId, id, from, to) {
			const row = quotationStore.get(id);
			if (!row || row.organizationId !== organizationId) return null;
			if (row.status !== from) return null;
			const updated = { ...row, status: to };
			quotationStore.set(id, updated);
			return updated as never;
		},
	};

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
	container.register(PAYMENT_REPOSITORY_TOKEN, { useValue: paymentRepository });

	return { quotationStore, payments };
}

/**
 * Builds the Elysia app: real erpGuard + real SalesController + real
 * SalesService over mocked repositories.
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
	const { erpGuard } = await import('../../src/authorization/elysia-auth');

	container.register(SALES_SERVICE_TOKEN, { useClass: SalesService });

	return new Elysia().use(erpGuard()).use(SalesController.plugin());
}
