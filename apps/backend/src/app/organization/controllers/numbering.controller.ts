import { RESET_POLICIES } from '@drizzle/schemas/organization.schema';
import { container } from 'tsyringe';
import { z } from 'zod';
import { domainPlugin } from '@http/plugin';
import { ok } from '@http/response';
import { NUMBERING_SERVICE_TOKEN } from '../constants/di';

const documentTypeParamSchema = z.object({ documentType: z.string().min(1).max(32) });

const settingSchema = z.object({
	pattern: z.string().trim().min(1).max(100),
	resetPolicy: z.enum(RESET_POLICIES),
});

/**
 * REST controller for document numbering settings (`/document-numbering`).
 *
 * @remarks
 * Reading and previewing need `company_setting:read`; saving a pattern
 * needs `company_setting:update`. Numbers themselves are only issued by
 * the owning modules through `NumberingService.next`.
 */
export class NumberingController {
	static plugin() {
		const service = container.resolve(NUMBERING_SERVICE_TOKEN);

		return domainPlugin({
			name: 'document-numbering',
			prefix: '/document-numbering',
			tags: ['Organization'],
			guards: 'erp',
		})
			.get('', async () => ok(await service.listSettings()), {
				erp: { permission: ['company_setting:read'] },
				detail: { description: 'Every numbering series with its next number' },
			})
			.post(
				'/:documentType/preview',
				async ({ params, body }) =>
					ok({
						nextNumber: await service.preview(
							documentTypeParamSchema.parse(params).documentType,
							settingSchema.parse(body),
						),
					}),
				{
					erp: { permission: ['company_setting:read'] },
					detail: { description: 'Previews a pattern without saving it' },
				},
			)
			.put(
				'/:documentType',
				async ({ params, body, erp }) =>
					ok(
						await service.updateSetting(
							documentTypeParamSchema.parse(params).documentType,
							settingSchema.parse(body),
							erp.session.user.id,
						),
					),
				{
					erp: { permission: ['company_setting:update'] },
					detail: { description: 'Saves the pattern and reset policy of a series' },
				},
			);
	}
}
