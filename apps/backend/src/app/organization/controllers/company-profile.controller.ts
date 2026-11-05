import { container } from 'tsyringe';
import { domainPlugin } from '@http/plugin';
import { ok } from '@http/response';
import { authorizeErpPermissions } from '@providers/better-auth/ac/organization-ac';
import { COMPANY_PROFILE_SERVICE_TOKEN } from '../constants/di';
import { companyProfileSchema } from '../contracts/company-profile.contract';

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
			.get(
				'',
				async ({ erp }) => {
					const roles = erp.member.role.split(',').map((r: string) => r.trim());
					const includeBanks =
						authorizeErpPermissions(roles, { invoice: ['read'] }) ||
						authorizeErpPermissions(roles, { company_setting: ['read'] });
					return ok(await service.get(includeBanks));
				},
				{
					erp: { permission: [] },
					detail: { description: 'The company profile (null before it is first saved)' },
				},
			)
			.put(
				'',
				async ({ body, erp }) =>
					ok(await service.save(companyProfileSchema.parse(body), erp.session.user.id)),
				{
					erp: { permission: ['company_setting:update'] },
					detail: { description: 'Saves the company profile and its invoice bank accounts' },
				},
			);
	}
}
