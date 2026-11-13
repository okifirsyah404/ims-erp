import { RESET_POLICIES } from '@drizzle/schemas/code-number.schema';
import { domainPlugin } from '@http/plugin';
import { ok } from '@http/response';
import { container } from 'tsyringe';
import { z } from 'zod';
import { CODE_NUMBER_SERVICE_TOKEN } from '../constants/di';

const codeTypeParamSchema = z.object({ codeType: z.string().min(1).max(32) });

const settingSchema = z.object({
	pattern: z.string().trim().min(1).max(100),
	resetPolicy: z.enum(RESET_POLICIES),
});

/**
 * REST controller for code numbering settings (`/code-numbers`).
 *
 * @remarks
 * Reading and previewing need `code_number:read`; saving a pattern needs
 * `code_number:update`. Numbers themselves are only issued by the owning
 * modules through `CodeNumberService.next`.
 */
export class CodeNumberController {
	static plugin() {
		const service = container.resolve(CODE_NUMBER_SERVICE_TOKEN);

		return domainPlugin({
			name: 'code-number',
			prefix: '/code-numbers',
			tags: ['Code Number'],
			guards: 'erp',
		})
			.get('', async () => ok(await service.listSettings()), {
				erp: { permission: ['code_number:read'] },
				detail: { description: 'Every numbering series with its next number' },
			})
			.post(
				'/:codeType/preview',
				async ({ params, body }) =>
					ok({
						nextNumber: await service.preview(
							codeTypeParamSchema.parse(params).codeType,
							settingSchema.parse(body),
						),
					}),
				{
					erp: { permission: ['code_number:read'] },
					detail: { description: 'Previews a pattern without saving it' },
				},
			)
			.put(
				'/:codeType',
				async ({ params, body, erp }) =>
					ok(
						await service.updateSetting(
							codeTypeParamSchema.parse(params).codeType,
							settingSchema.parse(body),
							erp.session.user.id,
						),
					),
				{
					erp: { permission: ['code_number:update'] },
					detail: { description: 'Saves the pattern and reset policy of a series' },
				},
			);
	}
}
