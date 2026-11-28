import { describe, expect, mock, test } from 'bun:test';
import type { TUserSelect } from '../../drizzle/schemas/auth.schema';
import type {
	IUserManagementRepository,
} from '../../src/app/user/contracts/user-management.repository.interface';
import type { TAdminUserRow } from '../../src/app/user/contracts/admin-listing.types';
import type { IUserManagementAuthGateway } from '../../src/app/user/contracts/user-management-auth.gateway.interface';
import type { AuditService } from '../../src/app/audit/services/audit.service';
import {
	UserNotFoundError,
	UserStateError,
} from '../../src/app/user/errors/invitation.errors';
import type { TActor } from '../../src/app/user/services/invitation.service';
import { UserAdminService } from '../../src/app/user/services/user-admin.service';

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
		claimedAt: null,
		gender: null,
		birthDate: null,
		birthPlace: null,
		maritalStatus: null,
		...overrides,
	};
}

function makeService(options: {
	user?: TUserSelect | null;
	anyUser?: TUserSelect | null;
	memberships?: Array<{ id: string; name: string; role: string }>;
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
		paginateUsers: mock(() =>
			Promise.resolve(
				options.paginate ?? {
					data: [],
					meta: { page: 1, limit: 20, total: 0, totalPages: 1 },
				},
			),
		),	};
	const gateway = { revokeSessions: mock(() => Promise.resolve()) };
	const audit = { record: mock(() => Promise.resolve()) };
	const memberRoles = {
		updateRolesByUser: mock(() =>
			Promise.resolve({ id: 'member-1', role: 'sales' }),
		),
	};

	const service = new UserAdminService(
		users as unknown as IUserManagementRepository,
		gateway as unknown as IUserManagementAuthGateway,
		audit as unknown as AuditService,
		memberRoles as never,
	);
	return { service, users, gateway, audit, memberRoles };
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

		const result = await service.list({
			page: 1,
			limit: 20,
			sortBy: 'createdAt',
			sortDir: 'desc',
		});

		expect(result.data).toHaveLength(2);
		for (const row of result.data) {
			expect(Array.isArray(row.organizations)).toBe(true);
		}
		expect(result.data[0]?.organizations[0]?.role).toBe('member');
		// A user with no memberships must be an empty array, never undefined.
		expect(result.data[1]?.organizations).toEqual([]);
	});

	test('remaps the image S3 key to a presigned URL', async () => {
		// Regression: the list projected `image` raw — an S3 object key
		// (`user/<id>/avatar.webp`), not a URL. The browser cannot load a
		// relative key as <img src>, so AvatarImage failed and every row
		// fell back to initials. Same convention as the profile path.
		const { service } = makeService({
			paginate: {
				data: [
					{
						user: makeUser({
							id: 'u-avatar',
							image: 'user/u-avatar/avatar.webp',
						}),
						organizations: [],
					},
					{
						user: makeUser({ id: 'u-bare', email: 'bare@example.com' }),
						organizations: [],
					},
				],
				meta: { page: 1, limit: 20, total: 2, totalPages: 1 },
			},
		});

		const result = await service.list({
			page: 1,
			limit: 20,
			sortBy: 'createdAt',
			sortDir: 'desc',
		});

		const withAvatar = result.data.find((row) => row.id === 'u-avatar');
		const withoutAvatar = result.data.find((row) => row.id === 'u-bare');
		// Presigned URL: absolute http(s) with AWS query params — never the
		// bare object key.
		expect(withAvatar?.image).toMatch(/^https?:\/\//);
		expect(withAvatar?.image).toContain('X-Amz-');
		expect(withAvatar?.image).not.toBe('user/u-avatar/avatar.webp');
		// A user without an avatar stays null (renders the fallback).
		expect(withoutAvatar?.image).toBeNull();
	});
});

describe('UserAdminService.deactivate', () => {
	test('sets status, revokes sessions and audits', async () => {
		const { service, users, gateway, audit } = makeService({
			user: makeUser(),
		});

		await service.deactivate('user-1', ACTOR);

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
			service.deactivate('user-1', ACTOR),
		).rejects.toBeInstanceOf(UserStateError);
		expect(gateway.revokeSessions).not.toHaveBeenCalled();
	});

	test('rejects deactivating a missing user', async () => {
		const { service } = makeService({ user: null });

		await expect(service.deactivate('missing', ACTOR)).rejects.toBeInstanceOf(
			UserNotFoundError,
		);
	});

	test('deactivates an active user and revokes sessions', async () => {
		const { service, gateway, users } = makeService({ user: makeUser() });

		await service.deactivate('user-1', ACTOR);

		expect(users.setStatus).toHaveBeenCalledWith('user-1', 'deactivated');
		expect(gateway.revokeSessions).toHaveBeenCalledWith('user-1');
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

		await service.remove('user-1', ACTOR);

		expect(users.delete).toHaveBeenCalledWith('user-1');
		expect(gateway.revokeSessions).toHaveBeenCalledWith('user-1');
		expect(audit.record).toHaveBeenCalledTimes(1);
	});
});

describe('UserAdminService.updateRoles (M12-14)', () => {
	test('delegates to the organization member-role port with the caller tier', async () => {
		const { service, memberRoles } = makeService({ user: makeUser() });

		await service.updateRoles(
			'user-1',
			'org-1',
			['sales', 'finance'],
			ACTOR,
			{ callerRoles: ['owner'], isPlatformAdmin: false },
			new Headers(),
		);

		expect(memberRoles.updateRolesByUser).toHaveBeenCalledTimes(1);
		expect(memberRoles.updateRolesByUser).toHaveBeenCalledWith(
			expect.objectContaining({
				organizationId: 'org-1',
				userId: 'user-1',
				roles: ['sales', 'finance'],
				callerRoles: ['owner'],
				isPlatformAdmin: false,
			}),
		);
	});

	test('audits the change as member.roleChanged', async () => {
		const { service, audit } = makeService({ user: makeUser() });

		await service.updateRoles(
			'user-1',
			'org-1',
			['sales'],
			ACTOR,
			{ callerRoles: ['owner'], isPlatformAdmin: false },
			new Headers(),
		);

		expect(audit.record).toHaveBeenCalledWith(
			expect.objectContaining({
				action: 'member.roleChanged',
				targetId: 'user-1',
				meta: expect.objectContaining({ organizationId: 'org-1' }),
			}),
		);
	});

	test('refuses an unknown user before touching the organization module', async () => {
		const { service, memberRoles } = makeService({ user: null });

		await expect(
			service.updateRoles(
				'user-missing',
				'org-1',
				['sales'],
				ACTOR,
				{ callerRoles: ['owner'], isPlatformAdmin: false },
				new Headers(),
			),
		).rejects.toBeInstanceOf(UserNotFoundError);
		expect(memberRoles.updateRolesByUser).not.toHaveBeenCalled();
	});
});
