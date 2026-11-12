import { describe, expect, mock, test } from 'bun:test';

// organizationNameFor() dynamically imports the Better Auth instance, whose
// $context needs Postgres. Mock it so unit tests never touch a database.
mock.module('@providers/better-auth/auth', () => ({
	auth: {
		// ponytail: minimal stub — tests only exercise the failure path
		// (catch -> null), never a successful adapter read.
		// Accessing $context throws synchronously; the service's catch turns
		// it into a null org name (the only path unit tests exercise).
		get $context() {
			throw new Error('no db in unit tests');
		},
	},
}));
import type { TUserInvitationSelect } from '../../drizzle/schemas/role.schema';
import type { TUserSelect } from '../../drizzle/schemas/auth.schema';
import type { IInvitationRepository } from '../../src/app/user/contracts/invitation.repository.interface';
import type { IUserManagementRepository } from '../../src/app/user/contracts/user-management.repository.interface';
import type { IInvitationMailer } from '../../src/app/user/contracts/invitation-mailer.gateway.interface';
import type { IUserManagementAuthGateway } from '../../src/app/user/contracts/user-management-auth.gateway.interface';
import type { AuditService } from '../../src/app/audit/services/audit.service';
import {
	InvitationNotFoundError,
	InvitationPendingExistsError,
} from '../../src/app/user/errors/invitation.errors';
import {
	InvitationService,
	type TActor,
} from '../../src/app/user/services/invitation.service';
import { claimInvitationSchema } from '../../src/app/user/contracts/invitation.contract';

/**
 * Unit tests for the invitation pipeline's tenant rules and the claim phone
 * contract. Every dependency is a mock — no database, mailer, queue or Better
 * Auth context is touched.
 */

const ORG_A = 'org-a';
const ORG_B = 'org-b';
const ACTOR: TActor = {
	userId: 'actor-1',
	email: 'actor@example.com',
	ip: null,
	userAgent: 'bun-test',
};

function makeInvitation(
	overrides: Partial<TUserInvitationSelect> = {},
): TUserInvitationSelect {
	return {
		id: 'inv-1',
		type: 'org',
		email: 'invitee@example.com',
		name: 'Invitee',
		organizationId: ORG_A,
		orgRole: 'member',
		tokenHash: 'hash',
		status: 'pending',
		invitedBy: ACTOR.userId,
		expiresAt: new Date(Date.now() + 60_000),
		resentCount: 0,
		deliveryFailed: false,
		claimedAt: null,
		deletedAt: null,
		createdAt: new Date(),
		updatedAt: new Date(),
		...overrides,
	};
}

function makeUser(overrides: Partial<TUserSelect> = {}): TUserSelect {
	return {
		id: 'user-1',
		name: 'Invitee',
		email: 'invitee@example.com',
		emailVerified: false,
		image: null,
		createdAt: new Date(),
		updatedAt: new Date(),
		role: 'user',
		banned: false,
		banReason: null,
		banExpires: null,
		bio: null,
		username: null,
		displayUsername: null,
		deletedAt: null,
		status: 'pending',
		phone: null,
		claimedAt: null,
		gender: null,
		birthDate: null,
		birthPlace: null,
		maritalStatus: null,
		...overrides,
	};
}

function makeService(
	options: {
		pending?: TUserInvitationSelect | null;
		invitation?: TUserInvitationSelect | null;
		user?: TUserSelect | null;
	} = {},
) {
	const invitations = {
		findById: mock(() => Promise.resolve(options.invitation ?? null)),
		findPendingByEmail: mock(() => Promise.resolve(options.pending ?? null)),
		findByTokenHash: mock(() => Promise.resolve(null)),
		list: mock(() => Promise.resolve({ data: [], meta: {} })),
		create: mock((input: Partial<TUserInvitationSelect>) =>
			Promise.resolve(makeInvitation({ ...input, id: 'inv-new' })),
		),
		updateToken: mock(() => Promise.resolve()),
		markStatus: mock(() => Promise.resolve()),
		delete: mock(() => Promise.resolve()),
		setDeliveryFailed: mock(() => Promise.resolve()),
	};
	const users = {
		findById: mock(() => Promise.resolve(options.user ?? null)),
		findByEmail: mock(() => Promise.resolve(options.user ?? null)),
		findAnyByEmail: mock(() => Promise.resolve(null)),
		createPendingUser: mock(() => Promise.resolve({ id: 'user-new' })),
		renamePendingUser: mock(() => Promise.resolve()),
		restore: mock(() => Promise.resolve()),
		delete: mock(() => Promise.resolve()),
	};
	const mailer = { sendInvite: mock(() => Promise.resolve()) };
	const slugResolver = { resolveIdBySlug: mock(() => Promise.resolve('org-a')) };
	const gateway = {};
	const audit = { record: mock(() => Promise.resolve()) };

	const service = new InvitationService(
		invitations as unknown as IInvitationRepository,
		users as unknown as IUserManagementRepository,
		gateway as unknown as IUserManagementAuthGateway,
		mailer as unknown as IInvitationMailer,
		slugResolver as unknown as import('../../src/app/user/contracts/organization-slug-resolver.port').IOrganizationSlugResolverPort,
		audit as unknown as AuditService,
	);
	return { service, invitations, users, mailer, audit, slugResolver };
}

describe('InvitationService — tenant rules on the overwrite path', () => {
	test('rejects a pending invitation owned by another organization', async () => {
		const { service, invitations } = makeService({
			pending: makeInvitation({ organizationId: ORG_B }),
		});

		await expect(
			service.invite(
				{
					email: 'invitee@example.com',
					name: 'Invitee',
					organizationId: ORG_A,
					organizationRoles: ['member'],
				},
				ACTOR,
			),
		).rejects.toBeInstanceOf(InvitationPendingExistsError);
		// Rejection happens before any write.
		expect(invitations.updateToken).not.toHaveBeenCalled();
	});

	test('adopts the organization context when overwriting an app-level invite', async () => {
		const existing = makeInvitation({
			type: 'app',
			organizationId: null,
			orgRole: null,
		});
		const { service, invitations } = makeService({
			pending: existing,
			invitation: makeInvitation({ type: 'org', organizationId: ORG_A }),
			user: makeUser(),
		});

		const result = await service.invite(
			{
				email: 'invitee@example.com',
				name: 'Invitee',
				organizationId: ORG_A,
				organizationRoles: ['admin'],
			},
			ACTOR,
		);

		expect(result.overwritten).toBe(true);
		expect(invitations.updateToken).toHaveBeenCalledWith(
			existing.id,
			expect.objectContaining({
				type: 'org',
				organizationId: ORG_A,
				orgRole: 'admin',
			}),
		);
	});

	test('rejects an app-level invite that would downgrade an org pending invite', async () => {
		const { service, invitations } = makeService({
			pending: makeInvitation({ organizationId: ORG_A }),
		});

		await expect(
			service.invite(
				{ email: 'invitee@example.com', name: 'Invitee' },
				ACTOR,
			),
		).rejects.toBeInstanceOf(InvitationPendingExistsError);
		expect(invitations.updateToken).not.toHaveBeenCalled();
	});

	test('overwrites within the same organization and syncs the pending name', async () => {
		const existing = makeInvitation({ name: 'Old Name' });
		const { service, users } = makeService({
			pending: existing,
			invitation: makeInvitation({ name: 'New Name' }),
			user: makeUser({ name: 'Old Name' }),
		});

		await service.invite(
			{
				email: 'invitee@example.com',
				name: 'New Name',
				organizationId: ORG_A,
				organizationRoles: ['member'],
			},
			ACTOR,
		);

		expect(users.renamePendingUser).toHaveBeenCalledWith(
			'user-1',
			'New Name',
		);
	});
});

describe('InvitationService — organization scope on id-targeted actions', () => {
	const scoped = { organizationId: ORG_A };

	test('resend refuses an invitation owned by another organization', async () => {
		const { service, invitations } = makeService({
			invitation: makeInvitation({ organizationId: ORG_B }),
		});

		await expect(
			service.resend('inv-1', ACTOR, scoped),
		).rejects.toBeInstanceOf(InvitationNotFoundError);
		expect(invitations.updateToken).not.toHaveBeenCalled();
	});

	test('cancel refuses an invitation owned by another organization', async () => {
		const { service, invitations } = makeService({
			invitation: makeInvitation({ organizationId: ORG_B }),
		});

		await expect(
			service.cancel('inv-1', ACTOR, scoped),
		).rejects.toBeInstanceOf(InvitationNotFoundError);
		expect(invitations.markStatus).not.toHaveBeenCalled();
	});

	test('delete refuses an invitation owned by another organization', async () => {
		const { service, invitations } = makeService({
			invitation: makeInvitation({ organizationId: ORG_B }),
		});

		await expect(
			service.deleteUnclaimed('inv-1', ACTOR, scoped),
		).rejects.toBeInstanceOf(InvitationNotFoundError);
		expect(invitations.delete).not.toHaveBeenCalled();
	});

	test('resend succeeds inside its own organization', async () => {
		const { service, invitations } = makeService({
			invitation: makeInvitation({ organizationId: ORG_A }),
		});

		await service.resend('inv-1', ACTOR, scoped);

		expect(invitations.updateToken).toHaveBeenCalledTimes(1);
	});

	test('an unscoped (application-admin) caller keeps cross-organization reach', async () => {
		const { service, invitations } = makeService({
			invitation: makeInvitation({ organizationId: ORG_B }),
		});

		await service.resend('inv-1', ACTOR);

		expect(invitations.updateToken).toHaveBeenCalledTimes(1);
	});
});

describe('claimInvitationSchema — phone is E.164', () => {
	const base = { username: 'invitee_1', password: 'supersecret' };

	test('accepts and normalizes a valid international number', () => {
		const parsed = claimInvitationSchema.parse({
			...base,
			phone: '+62 812-3456-7890',
		});
		expect(parsed.phone).toBe('+6281234567890');
	});

	test('rejects a national number without a country prefix', () => {
		expect(() =>
			claimInvitationSchema.parse({ ...base, phone: '08123456789' }),
		).toThrow();
	});

	test('rejects a number that is not a valid subscriber number', () => {
		expect(() =>
			claimInvitationSchema.parse({ ...base, phone: '+6212' }),
		).toThrow();
	});
});
