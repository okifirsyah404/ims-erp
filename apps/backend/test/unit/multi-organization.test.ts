/**
 * Multiple organizations (ADR-0012, ADR-0007 §1): creating and restoring
 * organizations alongside live ones is allowed — no single-organization gate.
 */
import { describe, expect, test } from 'bun:test';
import type { IOrganizationAuthGateway } from '../../src/app/organization/contracts/organization-auth.gateway.interface';
import type { IOrganizationRepository } from '../../src/app/organization/contracts/organization.repository.interface';
import { OrganizationService } from '../../src/app/organization/services/organization.service';

function service() {
	let created = 0;
	const repository = {
		countActive: async () => created,
		findById: async (id: string) => ({ id, deletedAt: new Date() }),
		restore: async () => undefined,
	} as unknown as IOrganizationRepository;
	const gateway = {
		createOrganization: async () => {
			created += 1;
			return { id: `org-${created}` };
		},
	} as unknown as IOrganizationAuthGateway;
	return {
		service: new OrganizationService(
			repository,
			gateway,
			undefined as never,
			undefined as never,
			undefined as never,
			undefined as never,
		),
		created: () => created,
	};
}

describe('multiple organizations (ADR-0012)', () => {
	test('creating a second organization goes through to Better Auth', async () => {
		const { service: svc, created } = service();
		await svc.createOrganization(new Headers(), { name: 'Cabang', slug: 'cabang' } as never);
		await svc.createOrganization(new Headers(), { name: 'Pusat', slug: 'pusat' } as never);
		expect(created()).toBe(2);
	});

	test('restore no longer consults the live-organization count', async () => {
		const { service: svc } = service();
		await expect(svc.restoreOrganization('org-old')).resolves.toBeUndefined();
	});
});
