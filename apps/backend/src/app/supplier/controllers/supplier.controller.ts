import { container } from 'tsyringe';
import { domainPlugin } from '@http/plugin';
import { created, noContent, ok, okPaginated } from '@http/response';
import { SUPPLIER_SERVICE_TOKEN } from '../constants/di';
import {
	supplierCompanyCreateSchema,
	supplierCompanyListQuerySchema,
	supplierCompanyUpdateSchema,
	supplierCreateSchema,
	supplierListQuerySchema,
	supplierUpdateSchema,
} from '../contracts/supplier.contract';
import { uuidParamSchema } from '../contracts/params.schema';

/**
 * REST controller for the supplier master (`/suppliers`).
 *
 * @remarks
 * HTTP concerns only. Suppliers are company-wide (ADR-0011). The actor always
 * comes from `ctx.erp`, never from the body. Bank details ride along on the
 * company row; exposure is gated by `supplier:read_bank` here and at every
 * other read site through `ExportedSupplierService`.
 */
export class SupplierController {
	static plugin() {
		const service = container.resolve(SUPPLIER_SERVICE_TOKEN);

		return domainPlugin({
			name: 'supplier-master',
			prefix: '/suppliers',
			tags: ['Supplier'],
			guards: 'erp',
		})
			.get(
				'/companies',
				async ({ query }) =>
					okPaginated(
						await service.listCompanies(
							supplierCompanyListQuerySchema.parse(query),
						),
					),
				{
					erp: { permission: ['supplier:read'] },
					detail: { description: 'Paginated supplier companies' },
				},
			)
			.get(
				'/companies/:id',
				async ({ params }) =>
					ok(
						await service.getCompany(
							uuidParamSchema.parse(params).id,
						),
					),
				{
					erp: { permission: ['supplier:read'] },
					detail: { description: 'One supplier company with its people' },
				},
			)
			.post(
				'/companies',
				async ({ body, erp, status }) =>
					status(
						201,
						created(
							await service.createCompany(
								supplierCompanyCreateSchema.parse(body),
								erp.session.user.id,
							),
						),
					),
				{
					erp: { permission: ['supplier:create'] },
					detail: { description: 'Creates a supplier company' },
				},
			)
			.patch(
				'/companies/:id',
				async ({ params, body }) =>
					ok(
						await service.updateCompany(
							uuidParamSchema.parse(params).id,
							supplierCompanyUpdateSchema.parse(body),
						),
					),
				{
					erp: { permission: ['supplier:update'] },
					detail: { description: 'Updates a supplier company' },
				},
			)
			.post(
				'/companies/:id/activate',
				async ({ params }) =>
					ok(
						await service.setCompanyActive(
							uuidParamSchema.parse(params).id,
							true,
						),
					),
				{
					erp: { permission: ['supplier:archive'] },
					detail: { description: 'Reactivates a supplier company' },
				},
			)
			.post(
				'/companies/:id/deactivate',
				async ({ params }) =>
					ok(
						await service.setCompanyActive(
							uuidParamSchema.parse(params).id,
							false,
						),
					),
				{
					erp: { permission: ['supplier:archive'] },
					detail: {
						description:
							'Deactivates a supplier company (no new purchase orders)',
					},
				},
			)
			.get(
				'/people',
				async ({ query }) =>
					okPaginated(
						await service.listPeople(supplierListQuerySchema.parse(query)),
					),
				{
					erp: { permission: ['supplier:read'] },
					detail: { description: 'Paginated supplier people (PIC)' },
				},
			)
			.post(
				'/people',
				async ({ body, erp, status }) =>
					status(
						201,
						created(
							await service.createPerson(
								supplierCreateSchema.parse(body),
								erp.session.user.id,
							),
						),
					),
				{
					erp: { permission: ['supplier:create'] },
					detail: { description: 'Creates a supplier person' },
				},
			)
			.patch(
				'/people/:id',
				async ({ params, body }) =>
					ok(
						await service.updatePerson(
							uuidParamSchema.parse(params).id,
							supplierUpdateSchema.parse(body),
						),
					),
				{
					erp: { permission: ['supplier:update'] },
					detail: { description: 'Updates a supplier person' },
				},
			)
			.delete(
				'/people/:id',
				async ({ params }) => {
					await service.removePerson(uuidParamSchema.parse(params).id);
					return noContent();
				},
				{
					erp: { permission: ['supplier:update'] },
					detail: { description: 'Removes a supplier person (soft delete)' },
				},
			);
	}
}
