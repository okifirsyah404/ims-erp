/**
 * P7-4: every organization role write carries the base `member` role, added
 * by the backend whether or not the form sent it, and the roles removed from
 * the catalog are refused.
 */
import { describe, expect, test } from 'bun:test';
import type { IOrganizationAuthGateway } from '../../src/app/organization/contracts/organization-auth.gateway.interface';
import type { IOrganizationRepository } from '../../src/app/organization/contracts/organization.repository.interface';
import { MemberRoleNotAssignableError } from '../../src/app/organization/errors/organization.errors';
import { OrganizationService } from '../../src/app/organization/services/organization.service';

const OWNER = { callerRoles: ['member', 'owner'], isPlatformAdmin: false };

function makeService(memberRole = 'member,sales') {
	const added: Array<{ roles: string[] }> = [];
	const updated: Array<{ role: string }> = [];
	const gateway = {
		addMember: async (input: { userId: string; roles: string[] }) => {
			added.push({ roles: input.roles });
			return { id: `member-${input.userId}` };
		},
		updateMemberRole: async (
			_headers: Headers,
			input: { memberId: string; role: string },
		) => {
			updated.push({ role: input.role });
			return { member: { id: input.memberId, role: input.role } };
		},
	} as unknown as IOrganizationAuthGateway;
	const repository = {
		findById: async () => ({ id: 'org-1', name: 'Entragate', deletedAt: null }),
		findMemberById: async () => ({ id: 'm-1', role: memberRole, user: null }),
	} as unknown as IOrganizationRepository;
	const service = new OrganizationService(
		repository,
		gateway,
		{} as never,
		{ findActiveByEmail: async () => null } as never,
		{} as never,
		{ notify: async () => {} } as never,
	);
	return { service, added, updated };
}

describe('base member role on every role write (P7-4)', () => {
	test('adding a member stores member plus the picked roles', async () => {
		const { service, added } = makeService();
		await service.addMember(
			new Headers(),
			'org-1',
			{ userId: 'u-1', roles: ['sales', 'warehouse'] } as never,
			OWNER,
		);
		expect(added[0]?.roles).toEqual(['member', 'sales', 'warehouse']);
	});

	test('changing roles without member still keeps member', async () => {
		const { service, updated } = makeService('member,sales');
		const result = await service.updateMemberRole(
			new Headers(),
			'org-1',
			'm-1',
			{ roles: ['finance'] } as never,
			OWNER,
		);
		expect(updated[0]?.role).toBe('member,finance');
		expect(result.role).toBe('member,finance');
	});

	test('sending member explicitly is accepted and not duplicated', async () => {
		const { service, updated } = makeService();
		await service.updateMemberRole(
			new Headers(),
			'org-1',
			'm-1',
			{ roles: ['member', 'sales', 'member'] } as never,
			OWNER,
		);
		expect(updated[0]?.role).toBe('member,sales');
	});

	test('a removed role is refused even when the member still holds it', async () => {
		const { service, updated } = makeService('member,admin');
		await expect(
			service.updateMemberRole(
				new Headers(),
				'org-1',
				'm-1',
				{ roles: ['admin', 'sales'] } as never,
				OWNER,
			),
		).rejects.toBeInstanceOf(MemberRoleNotAssignableError);
		expect(updated).toHaveLength(0);
	});
});
