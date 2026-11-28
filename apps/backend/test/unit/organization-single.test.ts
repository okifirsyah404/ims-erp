/**
 * K12 (M12-2): the ERP uses exactly one company, so organization creation is
 * closed. The first organization comes from the seeder's system call, never
 * from `OrganizationService.createOrganization`.
 */
import { describe, expect, mock, test } from 'bun:test';
import type { IOrganizationAuthGateway } from '../../src/app/organization/contracts/organization-auth.gateway.interface';
import type { IOrganizationRepository } from '../../src/app/organization/contracts/organization.repository.interface';
import { OrganizationAlreadyExistsError } from '../../src/app/organization/errors/organization.errors';
import { OrganizationService } from '../../src/app/organization/services/organization.service';

function service(options: {
	createOrganization?: (...args: never[]) => Promise<unknown>;
	findById?: IOrganizationRepository['findById'];
} = {}) {
	const gateway = {
		createOrganization:
			options.createOrganization ??
			(async () => ({ id: 'org-new' })),
	} as unknown as IOrganizationAuthGateway;
	const repository = {
		findById:
			options.findById ??
			(async (id: string) => ({ id, name: 'Entragate', slug: 'entragate', logo: null, deletedAt: null })),
		restore: mock(async () => undefined),
	} as unknown as IOrganizationRepository;
	return {
		service: new OrganizationService(
			repository,
			gateway,
			undefined as never,
			undefined as never,
			undefined as never,
			undefined as never,
		),
		repository,
	};
}

describe('single organization (K12, M12-2)', () => {
	test('creating an organization is rejected with a translated-key error', async () => {
		const { service: svc } = service();

		await expect(
			svc.createOrganization(new Headers(), { name: 'Cabang', slug: 'cabang' } as never),
		).rejects.toBeInstanceOf(OrganizationAlreadyExistsError);
	});

	test('the gateway is never called, even for the first organization', async () => {
		const createOrganization = mock(async () => ({ id: 'org-new' }));
		const { service: svc } = service({ createOrganization });

		await expect(
			svc.createOrganization(new Headers(), { name: 'Entragate', slug: 'entragate' } as never),
		).rejects.toBeInstanceOf(OrganizationAlreadyExistsError);
		expect(createOrganization).not.toHaveBeenCalled();
	});

	test('restore still works and never consults a live-organization count', async () => {
		const { service: svc, repository } = service({
			findById: (async (id: string) => ({
				id,
				name: 'Entragate',
				slug: 'entragate',
				logo: null,
				deletedAt: new Date(0),
			})) as unknown as IOrganizationRepository['findById'],
		});

		await expect(svc.restoreOrganization('org-old')).resolves.toBeUndefined();
		expect(repository.restore).toHaveBeenCalledWith('org-old');
	});
});
