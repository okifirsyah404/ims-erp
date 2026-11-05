import type { ErpContext } from '@authorization/elysia-auth';
import { container } from 'tsyringe';
import { domainPlugin } from '@http/plugin';
import { ok } from '@http/response';
import { authorizeErpPermissions } from '@providers/better-auth/ac/organization-ac';
import { COMPANY_PROFILE_SERVICE_TOKEN } from '../constants/di';
import { companyProfileSchema } from '../contracts/company-profile.contract';

/** Invoice bank accounts go to `invoice:read` or `company_setting:read` holders. */
function canSeeBanks(erp: ErpContext): boolean {
	const roles = erp.member.role.split(',').map((r) => r.trim());
	return (
		authorizeErpPermissions(roles, { invoice: ['read'] }) ||
		authorizeErpPermissions(roles, { company_setting: ['read'] })
	);
}

/**
 * REST controller for the company profile (`/company-profile`).
 *
 * @remarks
 * Any organization member may read it, because every printed document
 * needs the letterhead; the invoice bank accounts only go to holders of
 * `invoice:read` or `company_setting:read`. Saving needs
 * `company_setting:update`.
 */
export class CompanyProfileController {
	static plugin() {
		const service = container.resolve(COMPANY_PROFILE_SERVICE_TOKEN);

		return domainPlugin({
			name: 'company-profile',
			prefix: '/company-profile',
			tags: ['Organization'],
			guards: 'erp',
		})
			.get('', async ({ erp }) => ok(await service.get(canSeeBanks(erp))), {
				erp: { permission: [] },
				detail: { description: 'The company profile (null before it is first saved)' },
			})
			.put(
				'',
				async ({ body, erp }) =>
					ok(await service.save(companyProfileSchema.parse(body), erp.session.user.id, canSeeBanks(erp))),
				{
					erp: { permission: ['company_setting:update'] },
					detail: { description: 'Saves the company profile and its invoice bank accounts' },
				},
			);
	}
}
