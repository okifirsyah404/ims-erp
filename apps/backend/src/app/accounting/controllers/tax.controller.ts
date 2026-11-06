import { container } from 'tsyringe';
import type { ErpContext } from '@authorization/elysia-auth';
import { domainPlugin } from '@http/plugin';
import { created, ok, okPaginated } from '@http/response';
import {
	recapQuerySchema,
	taxCorrectionCreateSchema,
	taxIdParamSchema,
	taxPreviewQuerySchema,
	taxRecordCreateSchema,
	taxRecordFileSchema,
	taxRecordListQuerySchema,
	taxRecordUpdateSchema,
	taxTypeCreateSchema,
	taxTypeListQuerySchema,
	taxTypeUpdateSchema,
	withholdingCreateSchema,
	withholdingListQuerySchema,
	withholdingTransitionSchema,
} from '../contracts/tax.contract';
import { TAX_SERVICE_TOKEN } from '../constants/di';
import type { TaxService } from '../services/tax.service';

/**
 * REST controller for the tax slice (ERP-0016).
 *
 * @remarks
 * Permissions come from the existing `tax` resource in
 * `erp-permissions.ts` (D9): `read` views, `update` edits rates, records and
 * corrections, `verify` moves a record or withholding row through its status,
 * `export` is reserved for CSV/XLSX (phases 2 and 3). Controllers only parse,
 * call the service, and envelope the result.
 */
export class TaxController {
	/** Builds the Elysia plugin mounting `/tax`. */
	static plugin() {
		const tax = container.resolve<TaxService>(TAX_SERVICE_TOKEN);

		const ctxOf = (erp: ErpContext) => ({
			organizationId: erp.organizationId,
			actorUserId: erp.session.user.id,
		});

		return domainPlugin({
			name: 'tax',
			prefix: '/tax',
			tags: ['Tax'],
			guards: 'erp',
		})
			/* ---------------- tax types ---------------- */
			.get(
				'/types',
				async ({ query, erp }) =>
					okPaginated(
						await tax.listTaxTypes(
							erp.organizationId,
							taxTypeListQuerySchema.parse(query),
						),
					),
				{
					erp: { permission: ['tax:read'] },
					detail: { description: 'Paginated tax rate rows' },
				},
			)
			// Static `/types/preview` must mount before `/types/:id`, or `:id`
			// swallows it and the UUID check rejects the request.
			.get(
				'/types/preview',
				async ({ query, erp }) =>
					ok(
						await tax.previewTax(
							erp.organizationId,
							taxPreviewQuerySchema.parse(query),
						),
					),
				{
					erp: { permission: ['tax:read'] },
					detail: { description: 'Previews tax for a base on a date' },
				},
			)
			.get(
				'/types/:id',
				async ({ params, erp }) =>
					ok(
						await tax.getTaxType(
							erp.organizationId,
							taxIdParamSchema.parse(params).id,
						),
					),
				{
					erp: { permission: ['tax:read'] },
					detail: { description: 'One tax rate row' },
				},
			)
			.post(
				'/types',
				async ({ body, erp, status }) =>
					status(
						201,
						created(
							await tax.createTaxType(
								taxTypeCreateSchema.parse(body),
								ctxOf(erp),
							),
						),
					),
				{
					erp: { permission: ['tax:update'] },
					detail: { description: 'Creates an effective-dated tax rate' },
				},
			)
			.patch(
				'/types/:id',
				async ({ params, body, erp }) =>
					ok(
						await tax.updateTaxType(
							taxIdParamSchema.parse(params).id,
							taxTypeUpdateSchema.parse(body),
							ctxOf(erp),
						),
					),
				{
					erp: { permission: ['tax:update'] },
					detail: { description: 'Updates name, active flag, or end date' },
				},
			)
			.delete(
				'/types/:id',
				async ({ params, erp }) => {
					await tax.removeTaxType(
						taxIdParamSchema.parse(params).id,
						ctxOf(erp),
					);
					return ok({ removed: true });
				},
				{
					erp: { permission: ['tax:update'] },
					detail: { description: 'Soft-deletes an unused tax rate row' },
				},
			)
			/* ---------------- period records ---------------- */
			.get(
				'/records',
				async ({ query, erp }) => {
					const { page, limit, year, month } = taxRecordListQuerySchema.parse(query);
					return okPaginated(
						await tax.listTaxRecords(
							erp.organizationId,
							{ year, month },
							{ page, limit },
						),
					);
				},
				{
					erp: { permission: ['tax:read'] },
					detail: { description: 'Paginated period working papers' },
				},
			)
			.get(
				'/records/recap',
				async ({ query, erp }) => {
					const { year, month } = recapQuerySchema.parse(query);
					return ok(await tax.recap(erp.organizationId, year, month));
				},
				{
					erp: { permission: ['tax:read'] },
					detail: { description: 'Period recap with corrections and net payable' },
				},
			)
			.get(
				'/records/:id',
				async ({ params, erp }) =>
					ok(
						await tax.getTaxRecord(
							erp.organizationId,
							taxIdParamSchema.parse(params).id,
						),
					),
				{
					erp: { permission: ['tax:read'] },
					detail: { description: 'One period working paper' },
				},
			)
			.get(
				'/records/:id/corrections',
				async ({ params, erp }) =>
					ok(
						await tax.listCorrections(
							erp.organizationId,
							taxIdParamSchema.parse(params).id,
						),
					),
				{
					erp: { permission: ['tax:read'] },
					detail: { description: 'Corrections against one working paper' },
				},
			)
			.post(
				'/records',
				async ({ body, erp, status }) =>
					status(
						201,
						created(
							await tax.createTaxRecord(
								taxRecordCreateSchema.parse(body),
								ctxOf(erp),
							),
						),
					),
				{
					erp: { permission: ['tax:update'] },
					detail: { description: 'Creates a draft period working paper' },
				},
			)
			.patch(
				'/records/:id',
				async ({ params, body, erp }) =>
					ok(
						await tax.updateDraftTaxRecord(
							taxIdParamSchema.parse(params).id,
							taxRecordUpdateSchema.parse(body),
							ctxOf(erp),
						),
					),
				{
					erp: { permission: ['tax:update'] },
					detail: { description: 'Edits a draft working paper' },
				},
			)
			.post(
				'/records/:id/verify',
				async ({ params, erp }) =>
					ok(
						await tax.transitionTaxRecord(
							taxIdParamSchema.parse(params).id,
							'verified',
							null,
							ctxOf(erp),
						),
					),
				{
					erp: { permission: ['tax:verify'] },
					detail: { description: 'Moves a draft record to verified' },
				},
			)
			.post(
				'/records/:id/file',
				async ({ params, body, erp }) =>
					ok(
						await tax.transitionTaxRecord(
							taxIdParamSchema.parse(params).id,
							'filed',
							taxRecordFileSchema.parse(body ?? {}).filedOn ?? null,
							ctxOf(erp),
						),
					),
				{
					erp: { permission: ['tax:verify'] },
					detail: { description: 'Moves a verified record to filed' },
				},
			)
			.post(
				'/records/:id/corrections',
				async ({ params, body, erp, status }) =>
					status(
						201,
						created(
							await tax.addCorrection(
								taxIdParamSchema.parse(params).id,
								taxCorrectionCreateSchema.parse(body),
								ctxOf(erp),
							),
						),
					),
				{
					erp: { permission: ['tax:update'] },
					detail: { description: 'Adds a signed correction to a filed or verified record' },
				},
			)
			/* ---------------- withholding ---------------- */
			.get(
				'/withholding',
				async ({ query, erp }) =>
					okPaginated(
						await tax.listWithholding(
							erp.organizationId,
							withholdingListQuerySchema.parse(query),
						),
					),
				{
					erp: { permission: ['tax:read'] },
					detail: { description: 'Paginated withholding records' },
				},
			)
			.get(
				'/withholding/:id',
				async ({ params, erp }) =>
					ok(
						await tax.getWithholding(
							erp.organizationId,
							taxIdParamSchema.parse(params).id,
						),
					),
				{
					erp: { permission: ['tax:read'] },
					detail: { description: 'One withholding record' },
				},
			)
			.post(
				'/withholding',
				async ({ body, erp, status }) =>
					status(
						201,
						created(
							await tax.createWithholding(
								withholdingCreateSchema.parse(body),
								ctxOf(erp),
							),
						),
					),
				{
					erp: { permission: ['tax:update'] },
					detail: { description: 'Records withholding on a payment' },
				},
			)
			.post(
				'/withholding/:id/transition',
				async ({ params, body, erp }) =>
					ok(
						await tax.transitionWithholding(
							taxIdParamSchema.parse(params).id,
							withholdingTransitionSchema.parse(body).to,
							ctxOf(erp),
						),
					),
				{
					erp: { permission: ['tax:verify'] },
					detail: { description: 'Moves a withholding row through its status' },
				},
			);
	}
}
