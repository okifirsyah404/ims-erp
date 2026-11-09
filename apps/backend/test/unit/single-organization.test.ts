/**
 * Single-organization rule (ADR-0012): the deployment serves one company, so
 * a second live organization can be neither created nor restored.
 */
import { describe, expect, test } from 'bun:test';
import type { IOrganizationAuthGateway } from '../../src/app/organization/contracts/organization-auth.gateway.interface';
import type { IOrganizationRepository } from '../../src/app/organization/contracts/organization.repository.interface';
import { SingleOrganizationError } from '../../src/app/organization/errors/organization.errors';
import { OrganizationService } from '../../src/app/organization/services/organization.service';

function service(live: number, deletedRow = false) {
	let created = 0;
	const repository = {
		countActive: async () => live,
		findById: async (id: string) => ({ id, deletedAt: deletedRow ? new Date() : null }),
		restore: async () => undefined,
	} as unknown as IOrganizationRepository;
	const gateway = {
		createOrganization: async () => {
			created += 1;
			return { id: 'org-new' };
		},
	} as unknown as IOrganizationAuthGateway;
	return { service: new OrganizationService(repository, gateway), created: () => created };
}

describe('single organization (ADR-0012)', () => {
	test('a second organization is refused before Better Auth is called', async () => {
		const { service: svc, created } = service(1);
		await expect(
			svc.createOrganization(new Headers(), { name: 'Cabang', slug: 'cabang' } as never),
		).rejects.toBeInstanceOf(SingleOrganizationError);
		expect(created()).toBe(0);
	});

	test('restoring a deleted organization next to the live one is refused', async () => {
		const { service: svc } = service(1, true);
		await expect(svc.restoreOrganization('org-old')).rejects.toBeInstanceOf(SingleOrganizationError);
	});

	test('the first organization can still be created (fresh install)', async () => {
		const { service: svc, created } = service(0);
		await svc.createOrganization(new Headers(), { name: 'Entragate', slug: 'entragate' } as never).catch(() => undefined);
		expect(created()).toBe(1);
	});
});
