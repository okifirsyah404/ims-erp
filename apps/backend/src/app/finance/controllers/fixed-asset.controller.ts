import type { ErpContext } from '@authorization/elysia-auth';
import { domainPlugin } from '@http/plugin';
import { ok } from '@http/response';
import { container } from 'tsyringe';
import { z } from 'zod';
import { FIXED_ASSET_SERVICE_TOKEN } from '../constants/di';
import { capitalizeSchema, depreciationRunSchema, fiscalGroupSchema } from '../contracts/fixed-asset.contract';

const itemParam = z.object({ itemId: z.uuid() });

/**
 * Fixed assets in the GL (`/finance/fixed-assets`, ERP-0145): capitalized
 * books, capitalization, the monthly depreciation run and the fiscal report.
 * Reading uses `asset:read`; anything that posts a journal needs
 * `journal:post`.
 */
export class FixedAssetController {
	static plugin() {
		const service = container.resolve(FIXED_ASSET_SERVICE_TOKEN);
		const ctxOf = (erp: ErpContext) => ({ organizationId: erp.organizationId, actorUserId: erp.session.user.id });

		return domainPlugin({ name: 'finance-fixed-assets', prefix: '/finance/fixed-assets', tags: ['Finance'], guards: 'erp' })
			.get('', async ({ erp }) => ok(await service.list(erp.organizationId)), {
				erp: { permission: ['asset:read'] },
				detail: { description: 'Capitalized assets with their book and valuation' },
			})
			.get(
				'/fiscal-report',
				async ({ query, erp }) => ok(await service.fiscalReport(erp.organizationId, z.coerce.number().int().min(2000).max(2100).parse((query as { year?: unknown }).year))),
				{ erp: { permission: ['asset:read'] }, detail: { description: 'Fiscal (UU PPh Pasal 11) vs commercial depreciation for a tax year' } },
			)
			.post(
				'/depreciation-runs',
				async ({ body, erp }) => {
					const { year, month } = depreciationRunSchema.parse(body);
					return ok(await service.runMonth(ctxOf(erp), year, month));
				},
				{ erp: { permission: ['journal:post'] }, detail: { description: 'Depreciates every capitalized asset for a month and posts one journal' } },
			)
			.post(
				'/:itemId/capitalize',
				async ({ params, body, erp }) => ok(await service.capitalize(ctxOf(erp), itemParam.parse(params).itemId, capitalizeSchema.parse(body))),
				{ erp: { permission: ['journal:post'] }, detail: { description: 'Capitalizes an inventory item: Dr fixed asset / Cr counterpart' } },
			)
			.patch(
				'/:itemId/fiscal-group',
				async ({ params, body, erp }) =>
					ok(await service.setFiscalGroup(ctxOf(erp), itemParam.parse(params).itemId, fiscalGroupSchema.parse(body).fiscalGroup)),
				{ erp: { permission: ['journal:post'] }, detail: { description: 'Sets the fiscal depreciation group of a capitalized asset' } },
			);
	}
}
