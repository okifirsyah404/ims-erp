import type { ErpContext } from '@authorization/elysia-auth';
import { container } from 'tsyringe';
import { z } from 'zod';
import { domainPlugin } from '@http/plugin';
import { ok } from '@http/response';
import {
	type IPermissionResolver,
	PERMISSION_RESOLVER_TOKEN,
} from '@authorization/permission-resolver';
import { COMPANY_PROFILE_SERVICE_TOKEN } from '../constants/di';
import { companyProfileSchema, type TCompanyImageKind } from '../contracts/company-profile.contract';
import { documentImageFrom } from '@providers/s3/document-image';

/**
 * Invoice bank accounts go to `invoice:read` or `company_setting:read`
 * holders, resolved like the `erp` guard (dynamic, admin-editable roles).
 */
async function canSeeBanks(permissions: IPermissionResolver, erp: ErpContext): Promise<boolean> {
	const roles = erp.member.role.split(',').map((r) => r.trim());
	return (
		(await permissions.hasPermission(erp.organizationId, roles, { invoice: ['read'] })) ||
		(await permissions.hasPermission(erp.organizationId, roles, { company_setting: ['read'] }))
	);
}

const imageKindSchema = z.object({ kind: z.enum(['logo', 'signature']) });
const imageKind = (params: unknown): TCompanyImageKind => imageKindSchema.parse(params).kind;

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
		const permissions = container.resolve(PERMISSION_RESOLVER_TOKEN);

		return domainPlugin({
			name: 'company-profile',
			prefix: '/company-profile',
			tags: ['Organization'],
			guards: 'erp',
		})
			.get('', async ({ erp }) => ok(await service.get(await canSeeBanks(permissions, erp))), {
				erp: { permission: [] },
				detail: { description: 'The company profile (null before it is first saved)' },
			})
			.put(
				'',
				async ({ body, erp }) =>
					ok(await service.save(companyProfileSchema.parse(body), erp.session.user.id, await canSeeBanks(permissions, erp))),
				{
					erp: { permission: ['company_setting:update'] },
					detail: { description: 'Saves the company profile and its invoice bank accounts' },
				},
			)
			.put(
				'/:kind',
				async ({ params, body, erp }) =>
					ok(await service.setImage(imageKind(params), documentImageFrom(body), await canSeeBanks(permissions, erp))),
				{
					erp: { permission: ['company_setting:update'] },
					detail: { description: 'Uploads the letterhead logo or the signature image (multipart `file`)' },
				},
			)
			.delete(
				'/:kind',
				async ({ params, erp }) =>
					ok(await service.setImage(imageKind(params), null, await canSeeBanks(permissions, erp))),
				{
					erp: { permission: ['company_setting:update'] },
					detail: { description: 'Removes the letterhead logo or the signature image' },
				},
			);
	}
}
