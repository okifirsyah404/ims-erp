/**
 * ERP-0047 Phase 5: the organization module is the first notification producer.
 *
 * @remarks
 * Two paths notify, all through `ExportedNotificationService` (D7):
 * `addMember` and the invitation claim that actually creates a membership.
 * Organization creation is closed (K12, M12-2: one company), so its
 * notification path no longer exists. Invite *send* and
 * rejected/expired tokens never notify.
 *
 * The outage case uses the **real** `ExportedNotificationService` over a
 * throwing dispatcher, so it proves the production contract (a Redis outage is
 * swallowed) rather than a double's politeness.
 */
import { describe, expect, mock, test } from 'bun:test';
import type { IOrganizationAuthGateway } from '../../src/app/organization/contracts/organization-auth.gateway.interface';
import type { IOrganizationRepository } from '../../src/app/organization/contracts/organization.repository.interface';
import { OrganizationService } from '../../src/app/organization/services/organization.service';
import { InvitationService } from '../../src/app/user/services/invitation.service';
import { ExportedNotificationService } from '../../src/app/notification/services/exported-notification.service';
import type { TNotifyInput } from '../../src/app/notification/services/exported-notification.service';

function recordingNotifications() {
	const calls: TNotifyInput[] = [];
	return {
		calls,
		service: {
			notify: async (input: TNotifyInput) => {
				calls.push(input);
			},
		} as unknown as ExportedNotificationService,
	};
}

function organizationRow(name = 'Entragate') {
	return { id: 'org-1', name, slug: 'entragate', logo: null, deletedAt: null };
}

function makeOrganizationService(options: {
	pushNotifications: ExportedNotificationService;
	gateway?: Partial<IOrganizationAuthGateway>;
	users?: { findActiveByEmail: (email: string) => Promise<{ id: string } | null> };
	invitations?: { invite: () => Promise<{ invitation: { id: string } }> };
	organizationName?: string;
}) {
	const gateway = {
		createOrganization: async () => ({ id: 'org-1' }),
		addMember: async (input: { userId: string }) => ({
			id: `member-${input.userId}`,
		}),
		...options.gateway,
	} as unknown as IOrganizationAuthGateway;
	const repository = {
		findById: async () => organizationRow(options.organizationName),
	} as unknown as IOrganizationRepository;
	return new OrganizationService(
		repository,
		gateway,
		(options.invitations ?? {}) as never,
		(options.users ?? { findActiveByEmail: async () => null }) as never,
		{} as never,
		options.pushNotifications,
	);
}

describe('addMember producer', () => {
	test('enqueues org.member_added for the new member with the organization tag', async () => {
		const { calls, service: pushNotifications } = recordingNotifications();
		const service = makeOrganizationService({ pushNotifications });

		await service.addMember(
			new Headers(),
			'org-1',
			{
				userId: 'u-new',
				roles: ['sales'],
			} as never,
			{ callerRoles: ['owner'], isPlatformAdmin: false },
		);

		expect(calls).toHaveLength(1);
		expect(calls[0]).toMatchObject({
			userIds: ['u-new'],
			templateCode: 'org.member_added',
			tags: ['Entragate'],
			variables: { organizationName: 'Entragate', role: 'sales' },
			sourceType: 'organization_member',
			// The member row makes the job id deterministic.
			sourceId: 'member-u-new',
		});
	});

	test('a queue outage does not fail the add-member request', async () => {
		const failing = new ExportedNotificationService(async () => {
			throw new Error('redis down');
		});
		const service = makeOrganizationService({ pushNotifications: failing });

		await expect(
			service.addMember(
				new Headers(),
				'org-1',
				{
					userId: 'u-new',
					roles: ['sales'],
				} as never,
				{ callerRoles: ['owner'], isPlatformAdmin: false },
			),
		).resolves.toEqual({ id: 'member-u-new' });
	});
});

describe('invitation claim producer', () => {
	function makeClaimService(options: {
		pushNotifications: ExportedNotificationService;
		organizationRole?: string;
	}) {
		const invitations = {
			findByTokenHash: mock(() => Promise.resolve(null)),
			setDeliveryFailed: mock(() => Promise.resolve()),
		};
		const users = {
			findById: mock(() => Promise.resolve(null)),
			isUsernameAvailable: mock(() => Promise.resolve(true)),
			isPhoneAvailable: mock(() => Promise.resolve(true)),
			setClaimed: mock(() => Promise.resolve()),
		};
		const authGateway = {
			claimCredentials: mock(() => Promise.resolve()),
			attachMembership: mock(() => Promise.resolve('Entragate')),
			createSession: mock(() => Promise.resolve({ setCookie: 'session=abc' })),
		};
		const service = new InvitationService(
			invitations as never,
			users as never,
			authGateway as never,
			{ sendInvite: mock(() => Promise.resolve()) } as never,
			{} as never,
			{ record: mock(() => Promise.resolve()) } as never,
			options.pushNotifications,
		);
		// Claim's own token validation is covered elsewhere; this test is about
		// the notification fired once the membership exists.
		service.resolveClaimToken = async () => ({
			invitation: {
				id: 'inv-1',
				type: 'org',
				organizationId: 'org-1',
				organizationRole: options.organizationRole ?? 'member',
			},
			user: {
				id: 'u-ani',
				name: 'Ani',
				email: 'ani@example.com',
				status: 'pending',
			},
		}) as never;
		return { service, authGateway };
	}

	test('a successful org claim enqueues org.member_added once', async () => {
		const { calls, service: pushNotifications } = recordingNotifications();
		const { service } = makeClaimService({
			pushNotifications,
			organizationRole: 'admin,sales',
		});

		await service.claim(
			'raw-token',
			{ username: 'ani', password: 'secret123', phone: '+628123456789' },
			new Headers(),
		);

		expect(calls).toHaveLength(1);
		expect(calls[0]).toMatchObject({
			userIds: ['u-ani'],
			templateCode: 'org.member_added',
			variables: { organizationName: 'Entragate', role: 'admin, sales' },
			tags: ['Entragate'],
			sourceType: 'organization_member',
			sourceId: 'org-1',
		});
	});

	test('a queue outage does not fail the claim', async () => {
		const failing = new ExportedNotificationService(async () => {
			throw new Error('redis down');
		});
		const { service } = makeClaimService({ pushNotifications: failing });

		const result = await service.claim(
			'raw-token',
			{ username: 'ani', password: 'secret123', phone: '+628123456789' },
			new Headers(),
		);

		expect(result.userId).toBe('u-ani');
	});
});
