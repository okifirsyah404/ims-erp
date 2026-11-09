import type { ErpContext } from '@authorization/elysia-auth';
import {
	type IPermissionResolver,
	PERMISSION_RESOLVER_TOKEN,
} from '@authorization/permission-resolver';
import { container } from 'tsyringe';
import { domainPlugin } from '@http/plugin';
import { created, ok, okPaginated } from '@http/response';
import { SUPPLIER_SERVICE_TOKEN } from '../constants/di';
import {
	createSupplierSchema,
	idParamSchema,
	supplierListQuerySchema,
	updateSupplierSchema,
} from '../contracts/supplier.contract';

/**
 * REST controller for suppliers (`/suppliers`, ADR-0011 step 4a).
 *
 * @remarks
 * HTTP concerns only. Bank details follow `supplier:read_bank`, resolved
 * like the `erp` guard (dynamic, admin-editable roles).
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
		const id = (params: unknown) => idParamSchema.parse(params).id;

		return domainPlugin({ name: 'procurement-suppliers', prefix: '/suppliers', tags: ['Procurement'], guards: 'erp' })
			.get(
				'',
				async ({ query, erp }) => okPaginated(await service.list(supplierListQuerySchema.parse(query), await canSeeBank(erp))),
				{ erp: { permission: ['supplier:read'] }, detail: { description: 'Paginated suppliers' } },
			)
			.get('/:id', async ({ params, erp }) => ok(await service.get(id(params), await canSeeBank(erp))), {
				erp: { permission: ['supplier:read'] },
				detail: { description: 'One supplier (bank details with supplier:read_bank)' },
			})
			.post(
				'',
				async ({ body, erp, status }) =>
					status(
						201,
						created(await service.create(createSupplierSchema.parse(body), erp.session.user.id, await canSeeBank(erp))),
					),
				{ erp: { permission: ['supplier:create'] }, detail: { description: 'Creates a supplier' } },
			)
			.patch(
				'/:id',
				async ({ params, body, erp }) =>
					ok(await service.update(id(params), updateSupplierSchema.parse(body), await canSeeBank(erp))),
				{ erp: { permission: ['supplier:update'] }, detail: { description: 'Updates a supplier' } },
			)
			.post(
				'/:id/deactivate',
				async ({ params, erp }) => ok(await service.setActive(id(params), false, await canSeeBank(erp))),
				{ erp: { permission: ['supplier:archive'] }, detail: { description: 'Deactivates a supplier (no new POs)' } },
			)
			.post(
				'/:id/activate',
				async ({ params, erp }) => ok(await service.setActive(id(params), true, await canSeeBank(erp))),
				{ erp: { permission: ['supplier:archive'] }, detail: { description: 'Reactivates a supplier' } },
			);
	}
}
