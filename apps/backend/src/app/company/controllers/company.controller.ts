import type { ErpContext } from '@authorization/elysia-auth';
import {
	type IPermissionResolver,
	PERMISSION_RESOLVER_TOKEN,
} from '@authorization/permission-resolver';
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

/**
 * Invoice bank accounts go to `invoice:read` or `company:read` holders,
 * resolved like the `erp` guard (dynamic, admin-editable roles).
 */
async function canSeeBanks(permissions: IPermissionResolver, erp: ErpContext): Promise<boolean> {
	const roles = erp.member.role.split(',').map((r) => r.trim());
	return (
		(await permissions.hasPermission(erp.organizationId, roles, { invoice: ['read'] })) ||
		(await permissions.hasPermission(erp.organizationId, roles, { company: ['read'] }))
	);
}

const imageKindSchema = z.object({ kind: z.enum(['logo', 'signature', 'onboarding']) });
const imageKind = (params: unknown): TCompanyImageKind => imageKindSchema.parse(params).kind;

/**
 * REST controller for the company profile (`/company/profile`).
 *
 * @remarks
 * Any organization member may read it, because every printed document needs
 * the letterhead; the invoice bank accounts only go to holders of
 * `invoice:read` or `company:read`. Saving needs `company:update`.
 */
export class CompanyController {
	static plugin() {
		const service = container.resolve(COMPANY_SERVICE_TOKEN);
		const permissions = container.resolve(PERMISSION_RESOLVER_TOKEN);

		return domainPlugin({
			name: 'company',
			prefix: '/company',
			tags: ['Company'],
			guards: 'erp',
		})
			.get(
				'/branding',
				async () => ok(await service.getBranding()),
				{
					detail: {
						description:
							'Public branding for unauthenticated surfaces (the login page): display name and the onboarding image URL',
					},
				},
			)
			.get('/profile', async ({ erp }) => ok(await service.get(await canSeeBanks(permissions, erp))), {
				erp: { permission: [] },
				detail: { description: 'The company profile (null before it is first saved)' },
			})
			.put(
				'/profile',
				async ({ body, erp }) =>
					ok(
						await service.save(
							companyProfilePatchSchema.parse(body),
							erp.session.user.id,
							await canSeeBanks(permissions, erp),
						),
					),
				{
					erp: { permission: ['company:update'] },
					detail: { description: 'Saves the company profile and its invoice bank accounts' },
				},
			)
			.put(
				'/profile/:kind',
				async ({ params, body, erp }) =>
					ok(
						await service.setImage(
							imageKind(params),
							documentImageFrom(body),
							await canSeeBanks(permissions, erp),
						),
					),
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
				async ({ params, erp }) =>
					ok(await service.setImage(imageKind(params), null, await canSeeBanks(permissions, erp))),
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
						await service.upsertSetting(group, key, companySettingInputSchema.parse(body), erp.session.user.id),
					);
				},
				{
					erp: { permission: ['company:update'] },
					detail: { description: 'Creates or replaces one company setting' },
				},
			);
	}
}
