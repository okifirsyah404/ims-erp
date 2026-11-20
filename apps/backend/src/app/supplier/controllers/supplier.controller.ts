import { container } from 'tsyringe';
import type { ErpContext } from '@authorization/elysia-auth';
import {
	type IPermissionResolver,
	PERMISSION_RESOLVER_TOKEN,
} from '@authorization/permission-resolver';
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
import { SupplierBankForbiddenError } from '../errors/supplier.errors';

/** Bank columns of a supplier company, restricted to supplier:read_bank. */
const BANK_FIELDS = ['bankName', 'bankAccountNumber', 'bankAccountHolder'] as const;

function hideBank<T extends object>(row: T): T {
	const copy = { ...row } as Record<string, unknown>;
	for (const field of BANK_FIELDS) delete copy[field];
	return copy as T;
}

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
		const permissions = container.resolve<IPermissionResolver>(PERMISSION_RESOLVER_TOKEN);
		const canSeeBank = (erp: ErpContext) =>
			permissions.hasPermission(
				erp.organizationId,
				erp.member.role.split(',').map((role) => role.trim()),
				{ supplier: ['read_bank'] },
			);
		/** Rejects a write that carries bank fields without supplier:read_bank. */
		const assertBankWrite = async (erp: ErpContext, input: object) => {
			const touchesBank = BANK_FIELDS.some((field) => (input as Record<string, unknown>)[field] !== undefined);
			if (touchesBank && !(await canSeeBank(erp))) throw new SupplierBankForbiddenError();
		};
		const view = async <T extends object>(erp: ErpContext, row: T | null): Promise<T | null> =>
			row === null || (await canSeeBank(erp)) ? row : hideBank(row);

		return domainPlugin({
			name: 'supplier-master',
			prefix: '/suppliers',
			tags: ['Supplier'],
			guards: 'erp',
		})
			.get(
				'/companies',
				async ({ query, erp }) => {
					const page = await service.listCompanies(supplierCompanyListQuerySchema.parse(query));
					return okPaginated((await canSeeBank(erp)) ? page : { ...page, data: page.data.map(hideBank) });
				},
				{
					erp: { permission: ['supplier:read'] },
					detail: { description: 'Paginated supplier companies' },
				},
			)
			.get(
				'/companies/:id',
				async ({ params, erp }) =>
					ok(await view(erp, await service.getCompany(uuidParamSchema.parse(params).id))),
				{
					erp: { permission: ['supplier:read'] },
					detail: { description: 'One supplier company with its people' },
				},
			)
			.post(
				'/companies',
				async ({ body, erp, status }) => {
					const input = supplierCompanyCreateSchema.parse(body);
					await assertBankWrite(erp, input);
					return status(201, created(await view(erp, await service.createCompany(input, erp.session.user.id))));
				},
				{
					erp: { permission: ['supplier:create'] },
					detail: { description: 'Creates a supplier company' },
				},
			)
			.patch(
				'/companies/:id',
				async ({ params, body, erp }) => {
					const patch = supplierCompanyUpdateSchema.parse(body);
					await assertBankWrite(erp, patch);
					return ok(await view(erp, await service.updateCompany(uuidParamSchema.parse(params).id, patch)));
				},
				{
					erp: { permission: ['supplier:update'] },
					detail: { description: 'Updates a supplier company' },
				},
			)
			.post(
				'/companies/:id/activate',
				async ({ params, erp }) =>
					ok(await view(erp, await service.setCompanyActive(uuidParamSchema.parse(params).id, true))),
				{
					erp: { permission: ['supplier:archive'] },
					detail: { description: 'Reactivates a supplier company' },
				},
			)
			.post(
				'/companies/:id/deactivate',
				async ({ params, erp }) =>
					ok(await view(erp, await service.setCompanyActive(uuidParamSchema.parse(params).id, false))),
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
