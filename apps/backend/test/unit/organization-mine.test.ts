/**
 * `GET /organizations/mine` service mapping: the caller's live memberships,
 * their comma-joined role string, and the logo presigned only when set.
 */
import { describe, expect, test } from 'bun:test';
import type { IOrganizationAuthGateway } from '../../src/app/organization/contracts/organization-auth.gateway.interface';
import type { IOrganizationRepository } from '../../src/app/organization/contracts/organization.repository.interface';
import { OrganizationService } from '../../src/app/organization/services/organization.service';

function service(memberships: unknown[]) {
	const repository = {
		findMembershipsForUser: async (userId: string) => {
			expect(userId).toBe('user-1');
			return memberships;
		},
	} as unknown as IOrganizationRepository;
	return new OrganizationService(
		repository,
		{} as IOrganizationAuthGateway,
		undefined as never,
		undefined as never,
		undefined as never,
		undefined as never,
	);
}

describe('listMyOrganizations', () => {
	test('keeps the comma-joined role string as-is', async () => {
		const svc = service([
			{
				organization: { id: 'o1', name: 'Pusat', slug: 'pusat', logo: null },
				role: 'sales,finance',
			},
		]);
		const [row] = await svc.listMyOrganizations('user-1');
		expect(row.role).toBe('sales,finance');
		expect(row.logo).toBeNull();
	});

	test('returns an empty list when the user has no live membership', async () => {
		const svc = service([]);
		expect(await svc.listMyOrganizations('user-1')).toEqual([]);
	});
});
