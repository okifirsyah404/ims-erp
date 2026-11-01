import { describe, expect, mock, test } from 'bun:test';
import type { TUserSelect } from '../../drizzle/schemas/auth.schema';
import type { TRoleSelect } from '../../drizzle/schemas/role.schema';
import type {
	IRoleRepository,
	IUserManagementRepository,
	TAdminUserRow,
} from '../../src/app/user-management/contracts/repositories.interface';
import type { IUserManagementAuthGateway } from '../../src/app/user-management/contracts/gateways.interface';
import type { AuditService } from '../../src/app/user-management/services/audit.service';
import {
	RankGuardError,
	UserNotFoundError,
	UserStateError,
} from '../../src/app/user-management/services/invitation.errors';
import type { TActor } from '../../src/app/user-management/services/invitation.service';
import { UserAdminService } from '../../src/app/user-management/services/user-admin.service';

/**
 * Unit tests for the phase-4 account lifecycle service. All dependencies are
 * mocks — no database or Better Auth session store is touched.
 */

const ORG = 'org-1';
const ACTOR: TActor = {
	userId: 'actor-1',
	email: 'actor@example.com',
	ip: null,
	userAgent: 'bun-test',
};

function makeUser(overrides: Partial<TUserSelect> = {}): TUserSelect {
	return {
		id: 'user-1',
		name: 'Target User',
		email: 'target@example.com',
		emailVerified: false,
		image: null,
		createdAt: new Date(),
		updatedAt: new Date(),
		role: 'user',
		banned: false,
		banReason: null,
		banExpires: null,
		bio: null,
		username: 'target',
		displayUsername: 'target',
		deletedAt: null,
		status: 'active',
		phone: null,
		...overrides,
	};
}

function makeService(options: {
	user?: TUserSelect | null;
	anyUser?: TUserSelect | null;
	memberships?: Array<{ id: string; name: string; role: string }>;
	holderRole?: TRoleSelect | null;
	paginate?: {
		data: Array<{ user: TUserSelect; organizations: TAdminUserRow['organizations'] }>;
		meta: { page: number; limit: number; total: number; totalPages: number };
	};
} = {}) {
	const users = {
		findById: mock(() => Promise.resolve(options.user ?? null)),
		findAnyById: mock(() => Promise.resolve(options.anyUser ?? null)),
		setStatus: mock(() => Promise.resolve()),
		delete: mock(() => Promise.resolve()),
		restore: mock(() => Promise.resolve()),
		reactivate: mock(() => Promise.resolve()),
		listMemberships: mock(() =>
			Promise.resolve(options.memberships ?? []),
		),
		listUsers: mock(() =>
			Promise.resolve(
				options.paginate ?? {
					data: [],
					meta: { page: 1, limit: 20, total: 0, totalPages: 1 },
				},
			),
		),	};
	const gateway = { revokeSessions: mock(() => Promise.resolve()) };
	const roles = {
		findByName: mock(() => Promise.resolve(options.holderRole ?? null)),
	};
	const audit = { record: mock(() => Promise.resolve()) };

	const service = new UserAdminService(
		users as unknown as IUserManagementRepository,
		gateway as unknown as IUserManagementAuthGateway,
		roles as unknown as IRoleRepository,
		audit as unknown as AuditService,
	);
	return { service, users, gateway, roles, audit };
}

describe('UserAdminService.list', () => {
	test('every projected row carries an organizations array', async () => {
		// Regression: `GET /users` was answering from the legacy user
		// controller, which returns bare user columns with no membership
		// join. The admin UI reads `user.organizations.length` and crashed
		// with "can't access property 'length', user.organizations is
		// undefined". The admin projection must always include the field.
		const { service } = makeService({
			paginate: {
				data: [
					{
						user: makeUser({ id: 'u-with-orgs' }),
						organizations: [{ id: ORG, name: 'Entragate', role: 'member' }],
					},
					{
						user: makeUser({ id: 'u-no-orgs', email: 'lone@example.com' }),
						organizations: [],
					},
				],
				meta: { page: 1, limit: 20, total: 2, totalPages: 1 },
			},
		});

		const result = await service.list({ page: 1, limit: 20 });

		expect(result.data).toHaveLength(2);
		for (const row of result.data) {
			expect(Array.isArray(row.organizations)).toBe(true);
		}
		expect(result.data[0]?.organizations[0]?.role).toBe('member');
		// A user with no memberships must be an empty array, never undefined.
		expect(result.data[1]?.organizations).toEqual([]);
	});
});

describe('UserAdminService.deactivate', () => {
	test('sets status, revokes sessions and audits', async () => {
		const { service, users, gateway, audit } = makeService({
			user: makeUser(),
		});

		await service.deactivate('user-1', 80, ACTOR);

		expect(users.setStatus).toHaveBeenCalledWith('user-1', 'deactivated');
		// Locked decision D9: deactivation always kills sessions.
		expect(gateway.revokeSessions).toHaveBeenCalledWith('user-1');
		expect(audit.record).toHaveBeenCalledTimes(1);
	});

	test('rejects a non-active account without touching sessions', async () => {
		const { service, gateway } = makeService({
			user: makeUser({ status: 'deactivated' }),
		});

		await expect(
			service.deactivate('user-1', 80, ACTOR),
		).rejects.toBeInstanceOf(UserStateError);
		expect(gateway.revokeSessions).not.toHaveBeenCalled();
	});

	test('rejects an unknown user', async () => {
		const { service } = makeService({ user: null });

		await expect(
			service.deactivate('missing', 80, ACTOR),
		).rejects.toBeInstanceOf(UserNotFoundError);
	});

	test('rejects deactivating a user who outranks the caller', async () => {
		const { service, gateway } = makeService({
			user: makeUser(),
			memberships: [{ id: ORG, name: 'Entragate', role: 'owner' }],
			holderRole: {
				id: 'r-owner',
				organizationId: ORG,
				name: 'owner',
				rank: 100,
				permissions: {},
				isSystem: true,
				deletedAt: null,
				createdAt: new Date(),
				updatedAt: new Date(),
			},
		});

		await expect(
			service.deactivate('user-1', 80, ACTOR),
		).rejects.toBeInstanceOf(RankGuardError);
		expect(gateway.revokeSessions).not.toHaveBeenCalled();
	});

	test('allows deactivating a user ranked below the caller', async () => {
		const { service, users } = makeService({
			user: makeUser(),
			memberships: [{ id: ORG, name: 'Entragate', role: 'member' }],
			holderRole: {
				id: 'r-member',
				organizationId: ORG,
				name: 'member',
				rank: 10,
				permissions: {},
				isSystem: true,
				deletedAt: null,
				createdAt: new Date(),
				updatedAt: new Date(),
			},
		});

		await service.deactivate('user-1', 80, ACTOR);
		expect(users.setStatus).toHaveBeenCalled();
	});
});

describe('UserAdminService.restore', () => {
	test('reactivates a deactivated account', async () => {
		const { service, users } = makeService({
			anyUser: makeUser({ status: 'deactivated' }),
		});

		await service.restore('user-1', ACTOR);

		expect(users.reactivate).toHaveBeenCalledWith('user-1');
	});

	test('clears a soft-deleted account before reactivating', async () => {
		const { service, users } = makeService({
			anyUser: makeUser({
				status: 'pending',
				deletedAt: new Date(),
			}),
		});

		await service.restore('user-1', ACTOR);

		expect(users.restore).toHaveBeenCalledWith('user-1');
		expect(users.reactivate).toHaveBeenCalledWith('user-1');
	});

	test('rejects an already-active account', async () => {
		const { service } = makeService({ anyUser: makeUser({ status: 'active' }) });

		await expect(service.restore('user-1', ACTOR)).rejects.toBeInstanceOf(
			UserStateError,
		);
	});
});

describe('UserAdminService.remove', () => {
	test('soft-deletes and revokes sessions', async () => {
		const { service, users, gateway, audit } = makeService({
			user: makeUser(),
		});

		await service.remove('user-1', 80, ACTOR);

		expect(users.delete).toHaveBeenCalledWith('user-1');
		expect(gateway.revokeSessions).toHaveBeenCalledWith('user-1');
		expect(audit.record).toHaveBeenCalledTimes(1);
	});

	test('rejects deleting a user who outranks the caller', async () => {
		const { service, users } = makeService({
			user: makeUser(),
			memberships: [{ id: ORG, name: 'Entragate', role: 'admin' }],
			holderRole: {
				id: 'r-admin',
				organizationId: ORG,
				name: 'admin',
				rank: 80,
				permissions: {},
				isSystem: true,
				deletedAt: null,
				createdAt: new Date(),
				updatedAt: new Date(),
			},
		});

		await expect(service.remove('user-1', 80, ACTOR)).rejects.toBeInstanceOf(
			RankGuardError,
		);
		expect(users.delete).not.toHaveBeenCalled();
	});
});
