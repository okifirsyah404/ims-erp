import { container } from 'tsyringe';
import type { ErpContext } from '@authorization/elysia-auth';
import { EXPORTED_COMPANY_SERVICE_TOKEN } from '@app/company/constants/di';
import { domainPlugin } from '@http/plugin';
import { created, ok, okPaginated } from '@http/response';
import {
	recapQuerySchema,
	taxCorrectionCreateSchema,
	taxIdParamSchema,
	taxPreviewSchema,
	taxRecordCreateSchema,
	taxRecordListQuerySchema,
	taxRecordTransitionSchema,
	taxRecordUpdateSchema,
	taxTypeCreateSchema,
	taxTypeListQuerySchema,
	taxTypeUpdateSchema,
	withholdingCreateSchema,
	withholdingListQuerySchema,
	withholdingPatchSchema,
	withholdingTransitionSchema,
} from '../contracts/tax.contract';
import { CORETAX_EXPORT_SERVICE_TOKEN, PPH21_TABLE_SERVICE_TOKEN, TAX_SERVICE_TOKEN } from '../constants/di';
import type { Pph21TableService } from '../services/pph21-table.service';
import type { CoretaxExportService } from '../services/coretax-export.service';
import { z } from 'zod';
import type { TaxService } from '../services/tax.service';
import { recapToCsv } from '../utils/tax-csv';
import { recapToXlsx } from '../utils/tax-xlsx';

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
		const coretax = container.resolve<CoretaxExportService>(CORETAX_EXPORT_SERVICE_TOKEN);
		const pph21 = container.resolve<Pph21TableService>(PPH21_TABLE_SERVICE_TOKEN);
		const tableDateSchema = z.object({ date: z.iso.date().optional() });
		const coretaxPatchSchema = z
			.object({
				coretaxStatus: z.enum(['not_exported', 'exported', 'uploaded']).optional(),
				withholdingSlipNumber: z.string().trim().max(40).nullable().optional(),
				counterpartyTaxId: z.string().trim().max(32).nullable().optional(),
				taxObjectCode: z.string().trim().max(20).nullable().optional(),
			})
			.refine((data) => Object.keys(data).length > 0, { message: 'At least one field is required' });

		const ctxOf = (erp: ErpContext) => ({
			organizationId: erp.organizationId,
			actorUserId: erp.session.user.id,
		});

		return domainPlugin({
			name: 'tax',
			prefix: '/taxes',
			tags: ['Tax'],
			guards: 'erp',
		})
			/* ---------------- PPh 21 tables (ERP-0138) ---------------- */
			.get(
				'/pph21/tables',
				async ({ query }) => {
					const { date } = tableDateSchema.parse(query);
					return ok({ ...(await pph21.tables(date ?? new Date().toISOString().slice(0, 10))), terVersions: await pph21.terVersions() });
				},
				{
					erp: { permission: ['tax:read'] },
					detail: { description: 'PTKP, TER and Pasal 17 tables in force on a date, plus the stored TER versions' },
				},
			)
			.get(
				'/pph21/ter-rates/template.csv',
				() =>
					new Response(pph21.template(), {
						headers: {
							'content-type': 'text/csv; charset=utf-8',
							'content-disposition': 'attachment; filename="ter-template.csv"',
						},
					}),
				{ erp: { permission: ['tax:read'] }, detail: { description: 'CSV template of the TER import' } },
			)
			.post(
				'/pph21/ter-rates/import',
				async ({ body }) => {
					const file = body && typeof body === 'object' && 'file' in body ? (body as { file: unknown }).file : undefined;
					return ok(await pph21.importTer(file));
				},
				{
					erp: { permission: ['tax:update'] },
					detail: { description: 'Imports the official TER table (CSV); all rows or none, replacing each effective date it carries' },
				},
			)
			/* ---------------- tax types ---------------- */
			.get(
				'',
				async ({ query, erp }) =>
					okPaginated(
						await tax.listTaxTypes({
							organizationId: erp.organizationId,
							...taxTypeListQuerySchema.parse(query),
						}),
					),
				{
					erp: { permission: ['tax:read'] },
					detail: { description: 'Paginated tax rate rows' },
				},
			)
			.get(
				'/:id',
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
				'',
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
				'/:id',
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
				'/:id',
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
				'/recap',
				async ({ query, erp }) => {
					const { year, month } = recapQuerySchema.parse(query);
					return ok(await tax.recap(erp.organizationId, year, month));
				},
				{
					erp: { permission: ['tax:read'] },
					detail: { description: 'Period recap with corrections and net payable' },
				},
			)
			/* ---------------- Coretax XML (ERP-0140) ---------------- */
			.get(
				'/coretax/faktur.xml',
				async ({ query, erp, set }) => {
					const { year, month } = recapQuerySchema.parse(query);
					const { xml } = await coretax.fakturXml(erp.organizationId, year, month);
					set.headers['content-type'] = 'application/xml; charset=utf-8';
					set.headers['content-disposition'] = `attachment; filename="coretax-faktur-${year}-${String(month).padStart(2, '0')}.xml"`;
					return xml;
				},
				{
					erp: { permission: ['tax:export'] },
					detail: { description: 'Output invoices of a period as Coretax TaxInvoiceBulk XML (manual upload; format unverified until a test import passes)' },
				},
			)
			.get(
				'/coretax/bupot.xml',
				async ({ query, erp, set }) => {
					const { year, month } = recapQuerySchema.parse(query);
					const { xml } = await coretax.bupotXml(erp.organizationId, year, month);
					set.headers['content-type'] = 'application/xml; charset=utf-8';
					set.headers['content-disposition'] = `attachment; filename="coretax-bupot-${year}-${String(month).padStart(2, '0')}.xml"`;
					return xml;
				},
				{
					erp: { permission: ['tax:export'] },
					detail: { description: 'Withholdings of a period as Coretax BpuBulk XML (manual upload; format unverified until a test import passes)' },
				},
			)
			.patch(
				'/withholdings/:id/coretax',
				async ({ params, body, erp }) =>
					ok(await coretax.updateCoretax(erp.organizationId, z.object({ id: z.string().uuid() }).parse(params).id, coretaxPatchSchema.parse(body))),
				{
					erp: { permission: ['tax:update'] },
					detail: { description: 'Records bukti-potong data and the Coretax status of a withholding' },
				},
			)
			.get(
				'/export.csv',
				async ({ query, erp, set }) => {
					const { year, month } = recapQuerySchema.parse(query);
					const { lines } = await tax.recap(erp.organizationId, year, month);
					set.status = 200;
					set.headers['content-type'] = 'text/csv; charset=utf-8';
					set.headers['content-disposition'] =
						`attachment; filename="tax-recap-${year}-${String(month).padStart(2, '0')}.csv"`;
					return recapToCsv(
						lines.map((line) => ({
							code: line.code,
							taxableBase: line.taxableBase,
							taxAmount: line.taxAmount,
							correctionTotal: line.correctionTotal,
							netPayable: line.netPayable,
							filingStatus: line.filingStatus,
						})),
					);
				},
				{
					erp: { permission: ['tax:export'] },
					detail: { description: 'Period recap as CSV (placeholder columns, D12)' },
				},
			)
			.get(
				'/export.xlsx',
				async ({ query, erp, set }) => {
					const { year, month } = recapQuerySchema.parse(query);
					const [{ lines }, company] = await Promise.all([
						tax.recap(erp.organizationId, year, month),
						container.resolve(EXPORTED_COMPANY_SERVICE_TOKEN).getLetterhead(),
					]);
					const buffer = await recapToXlsx(
						lines.map((line) => ({
							code: line.code,
							taxableBase: line.taxableBase,
							taxAmount: line.taxAmount,
							correctionTotal: line.correctionTotal,
							netPayable: line.netPayable,
							filingStatus: line.filingStatus,
						})),
						{ year, month },
						company,
					);
					set.status = 200;
					set.headers['content-type'] =
						'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
					set.headers['content-disposition'] =
						`attachment; filename="tax-recap-${year}-${String(month).padStart(2, '0')}.xlsx"`;
					return buffer;
				},
				{
					erp: { permission: ['tax:export'] },
					detail: { description: 'Period recap as XLSX (placeholder columns, D12)' },
				},
			)
			.get(
				'/records',
				async ({ query, erp }) =>
					okPaginated(
						await tax.listTaxRecords({
							organizationId: erp.organizationId,
							...taxRecordListQuerySchema.parse(query),
						}),
					),
				{
					erp: { permission: ['tax:read'] },
					detail: { description: 'Paginated period working papers' },
				},
			)
			// Static `/records/preview` must mount before `/records/:id`; it is a
			// POST so it cannot clash with the GET param route, but keep it first.
			.post(
				'/records/preview',
				async ({ body, erp }) =>
					ok(
						await tax.previewTax(
							erp.organizationId,
							taxPreviewSchema.parse(body),
						),
					),
				{
					erp: { permission: ['tax:read'] },
					detail: { description: 'Previews tax for a base on a date (no persistence)' },
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
				'/records/:id/transition',
				async ({ params, body, erp }) => {
					const input = taxRecordTransitionSchema.parse(body);
					return ok(
						await tax.transitionTaxRecord(
							taxIdParamSchema.parse(params).id,
							input.to,
							input.filedOn,
							ctxOf(erp),
						),
					);
				},
				{
					erp: { permission: ['tax:verify'] },
					detail: { description: 'Moves a record draft → verified → filed' },
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
				'/withholdings',
				async ({ query, erp }) =>
					okPaginated(
						await tax.listWithholding({
							organizationId: erp.organizationId,
							...withholdingListQuerySchema.parse(query),
						}),
					),
				{
					erp: { permission: ['tax:read'] },
					detail: { description: 'Paginated withholding records' },
				},
			)
			.get(
				'/withholdings/:id',
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
			.patch(
				'/withholdings/:id',
				async ({ params, body, erp }) =>
					ok(
						await tax.updateWithholding(
							taxIdParamSchema.parse(params).id,
							withholdingPatchSchema.parse(body),
							ctxOf(erp),
						),
					),
				{
					erp: { permission: ['tax:update'] },
					detail: { description: 'Edits a recorded withholding row' },
				},
			)
			.post(
				'/withholdings',
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
				'/withholdings/:id/transition',
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
