import { container } from 'tsyringe';
import type { ErpContext } from '@authorization/elysia-auth';
import { GLOBAL_ADMIN_ROLE, hasAppRole } from '@providers/better-auth/ac/admin-ac';
import { domainPlugin } from '@http/plugin';
import { created, ok, okPaginated } from '@http/response';
import {
	createUnitSchema,
	replaceSerialSchema,
	unitListQuerySchema,
} from '../contracts/serial-unit.contract';
import { idParamSchema } from '../contracts/pagination.contract';
import { SERIAL_UNIT_SERVICE_TOKEN } from '../constants/di';
import type { SerialUnitService } from '../services/serial-unit.service';

/**
 * REST controller for serial units of a serialized product (ADR-0026).
 *
 * @remarks
 * The routes are nested under the product they describe (`/products/:id/units`)
 * so the URLs the web-admin already calls keep their shape, but the unit rows
 * are `inventory.item_serials` and the matrix lives in this module, so the
 * controller and the service do too. The product id is validated by the
 * service through the `product` module contract, never by a local join.
 */
export class SerialUnitController {
	/** Builds the Elysia plugin mounting the unit routes. */
	static plugin() {
		const units = container.resolve<SerialUnitService>(SERIAL_UNIT_SERVICE_TOKEN);

		return domainPlugin({
			name: 'inventory-serial-units',
			prefix: '/products',
			tags: ['Inventory'],
			guards: 'erp',
		})
			.get(
				'/:id/units',
				async ({ params, query }) => {
					const id = idParamSchema.parse(params).id;
					const parsed = unitListQuerySchema.parse(query);
					return okPaginated(await units.paginate({ ...parsed, productId: id }));
				},
				{
					erp: { permission: ['product:read'] },
					detail: { description: 'Paginated units of one serialized product' },
				},
			)
			.post(
				'/:id/units',
				async ({ params, body, erp, status }) => {
					const id = idParamSchema.parse(params).id;
					const parsed = createUnitSchema.parse(body);
					const row = await units.registerUnit(id, {
						...parsed,
						organizationId: resolveOrganizationId(parsed.organizationId, erp),
					});
					return status(201, created(row));
				},
				{
					erp: { permission: ['product:update'] },
					detail: { description: 'Registers a unit for a serialized product' },
				},
			)
			.patch(
				'/:id/units/:unitId',
				async ({ params, body }) => {
					const { unitId } = params as { unitId: string };
					const row = await units.replaceProvisionalSerial(
						unitId,
						replaceSerialSchema.parse(body).serialNumber,
					);
					return ok(row);
				},
				{
					erp: { permission: ['product:update'] },
					detail: {
						description:
							'Replaces a pre-ordered unit provisional serial exactly once',
					},
				},
			);
	}
}

/**
 * Resolves the tenant scope for a new unit.
 *
 * @remarks
 * A client may only request a **global** row (`null`) when it is an
 * application administrator. Everyone else is pinned to their own organization
 * regardless of what the body asked for - the body is input, never
 * authorization evidence.
 *
 * @param requested - The `organizationId` the body asked for, if any
 * @param erp - The guard-resolved context
 */
function resolveOrganizationId(
	requested: string | null | undefined,
	erp: ErpContext,
): string | null {
	if (hasAppRole(erp.session.user.role, GLOBAL_ADMIN_ROLE)) {
		return requested ?? erp.organizationId;
	}
	if (requested && requested !== erp.organizationId) {
		return erp.organizationId;
	}
	return erp.organizationId;
}
