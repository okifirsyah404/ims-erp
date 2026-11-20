import { domainPlugin } from '@http/plugin';
import { ok } from '@http/response';
import { documentImageFrom } from '@providers/s3/document-image';
import { container } from 'tsyringe';
import { z } from 'zod';
import { COMPANY_SERVICE_TOKEN } from '../constants/di';
import {
	companyProfilePatchSchema,
	companySettingInputSchema,
	companySettingParamsSchema,
	type TCompanyImageKind,
} from '../contracts/company.contract';

const imageKindSchema = z.object({ kind: z.enum(['logo', 'signature', 'onboarding']) });
const imageKind = (params: unknown): TCompanyImageKind => imageKindSchema.parse(params).kind;

/**
 * REST controller for the company profile (`/companies/profile`).
 *
 * @remarks
 * Any organization member may read it, because every printed document needs
 * the letterhead. Saving needs `company:update`. Invoice bank accounts are not
 * served here: they live in `finance` (`/finance/cash-bank-accounts`).
 */
export class CompanyController {
	static plugin() {
		const service = container.resolve(COMPANY_SERVICE_TOKEN);

		return domainPlugin({
			name: 'company',
			prefix: '/companies',
			tags: ['Company'],
			guards: 'erp',
		})
			.get('/branding', async () => ok(await service.getBranding()), {
				detail: {
					description:
						'Public branding for unauthenticated surfaces (the login page): display name and the onboarding image URL',
				},
			})
			.get('/profile', async () => ok(await service.get()), {
				erp: { permission: [] },
				detail: { description: 'The company profile (null before it is first saved)' },
			})
			.put(
				'/profile',
				async ({ body, erp }) =>
					ok(await service.save(companyProfilePatchSchema.parse(body), erp.session.user.id)),
				{
					erp: { permission: ['company:update'] },
					detail: { description: 'Saves the company profile, its primary address and contacts' },
				},
			)
			.put(
				'/profile/:kind',
				async ({ params, body }) =>
					ok(await service.setImage(imageKind(params), documentImageFrom(body))),
				{
					erp: { permission: ['company:update'] },
					detail: {
						description:
							'Uploads the letterhead logo, signature or onboarding image (multipart `file`)',
					},
				},
			)
			.delete(
				'/profile/:kind',
				async ({ params }) => ok(await service.setImage(imageKind(params), null)),
				{
					erp: { permission: ['company:update'] },
					detail: { description: 'Removes the letterhead logo, signature or onboarding image' },
				},
			)
			.get('/settings', async () => ok(await service.listSettings()), {
				erp: { permission: ['company:read'] },
				detail: { description: 'Every company setting (group, key, type, value)' },
			})
			.put(
				'/settings/:group/:key',
				async ({ params, body, erp }) => {
					const { group, key } = companySettingParamsSchema.parse(params);
					return ok(
						await service.upsertSetting(
							group,
							key,
							companySettingInputSchema.parse(body),
							erp.session.user.id,
						),
					);
				},
				{
					erp: { permission: ['company:update'] },
					detail: { description: 'Creates or replaces one company setting' },
				},
			);
	}
}
