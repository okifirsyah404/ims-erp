/**
 * Shared HTTP surface of one `<schema>.code_numberings` (ADR-0024 Q6).
 *
 * @remarks
 * Each module that owns a numbering table mounts this under its own prefix
 * from its `controllers/code-numbering.controller.ts`, handing in its own
 * numbering service - there is no central numbering module. The routes are
 * identical everywhere, so the three handlers exist once:
 *
 * - `GET    {prefix}/code-numberings`                     every series + next number
 * - `POST   {prefix}/code-numberings/:codeType/preview`   renders a pattern, saves nothing
 *   (answers `{ nextNumber, sampleContext, maxLength }`)
 * - `PUT    {prefix}/code-numberings/:codeType`           saves pattern + reset policy
 *
 * Authorization rides `adminOrErpGuard`: an application admin always passes;
 * an organization member needs `code_number:read` (list, preview) or
 * `code_number:update` (save). `appAdminOnly` closes a series to everyone
 * but application admins (warehouse, ADR-0008).
 */
import type { AdminOrErpContext } from '@authorization/elysia-auth';
import { domainPlugin } from '@http/plugin';
import { ok } from '@http/response';
import { z } from 'zod';

import { PATTERN_MAX_LENGTH, RESET_POLICIES } from './domain';
import type { CodeNumberingServiceBase } from './service-base';

const codeTypeParamSchema = z.object({ codeType: z.string().min(1).max(32) });

/** Body of the preview and save routes. */
export const codeNumberSettingSchema = z.object({
	pattern: z.string().trim().min(1).max(PATTERN_MAX_LENGTH),
	resetPolicy: z.enum(RESET_POLICIES),
});

/**
 * Body of the preview route: the setting plus optional preview hints.
 *
 * @remarks
 * `supplierCompanyId` renders the PO example with that supplier's code
 * instead of the longest live one (K6). Series without `{SUPPLIER}` ignore it.
 */
export const codeNumberPreviewSchema = codeNumberSettingSchema.extend({
	supplierCompanyId: z.uuid().nullish(),
});

/** Options of {@link codeNumberingController}. */
export type TCodeNumberingControllerOptions = {
	/** Unique plugin name, e.g. `sale-code-numbering`. */
	name: string;
	/** The owning module's URL prefix, e.g. `/sales`. */
	prefix: string;
	/** OpenAPI tag. */
	tag: string;
	/** The owning module's numbering service. */
	service: CodeNumberingServiceBase;
	/** Only application admins may read or change this schema's series. */
	appAdminOnly?: boolean;
};

/** The handler context (`domainPlugin` is untyped, the guard resolves `erp`). */
type TCtx = { erp: AdminOrErpContext; params: unknown; body: unknown };

const ctxOf = (context: Record<string, unknown>) => context as unknown as TCtx;

/** Builds the code-numbering routes of one module. */
export function codeNumberingController(options: TCodeNumberingControllerOptions) {
	const { service, appAdminOnly = false } = options;
	const read = { permission: ['code_number:read'] as const, appAdminOnly };
	const update = { permission: ['code_number:update'] as const, appAdminOnly };

	return domainPlugin({
		name: options.name,
		prefix: `${options.prefix}/code-numberings`,
		tags: [options.tag, 'Code Numbering'],
		guards: 'admin-or-erp',
	})
		.get('', async (context) => ok(await service.listSettings(ctxOf(context).erp.organizationId)), {
			adminOrErp: read,
			detail: { description: 'Every numbering series of this module with its next number' },
		})
		.post(
			'/:codeType/preview',
			async (context) => {
				const { erp, params, body } = ctxOf(context);
				const { supplierCompanyId, ...setting } = codeNumberPreviewSchema.parse(body);
				return ok(
					await service.previewSetting(
						codeTypeParamSchema.parse(params).codeType,
						setting,
						erp.organizationId,
						{ supplierCompanyId },
					),
				);
			},
			{
				adminOrErp: read,
				detail: { description: 'Renders a numbering pattern without saving it' },
			},
		)
		.put(
			'/:codeType',
			async (context) => {
				const { erp, params, body } = ctxOf(context);
				return ok(
					await service.updateSetting(
						codeTypeParamSchema.parse(params).codeType,
						codeNumberSettingSchema.parse(body),
						erp.session.user.id,
						erp.organizationId,
					),
				);
			},
			{
				adminOrErp: update,
				detail: { description: 'Saves the pattern and reset policy of a series' },
			},
		);
}
