import { container } from 'tsyringe';
import { requireGlobalAdmin } from '@authorization/require-global-admin';
import { domainPlugin } from '@http/plugin';
import { created, ok, okPaginated } from '@http/response';
import {
	createStorageSchema,
	createWarehouseSchema,
	idParamSchema,
	nestedIdParamSchema,
	storageListQuerySchema,
	updateStorageSchema,
	updateWarehouseSchema,
	warehouseAddressSchema,
	warehouseListQuerySchema,
} from '../contracts/warehouse.contract';
import { WAREHOUSE_SERVICE_TOKEN } from '../constants/di';
import type { WarehouseService } from '../services/warehouse.service';
import type { TInventoryAuditActor } from '../constants/audit-actor';

/**
 * Audit actor from the session (global-admin routes; no `erp` context).
 */
function auditActor(session: { user: { id: string; email?: string | null } }, request: Request): TInventoryAuditActor {
	return {
		userId: session.user.id,
		email: session.user.email ?? null,
		ip: request.headers.get('x-forwarded-for'),
		userAgent: request.headers.get('user-agent'),
	};
}

/**
 * REST controller for warehouses, their 1:1 addresses, and their storages.
 *
 * @remarks
 * **Authorization.** Every route rides `sessionGuard` + the
 * {@link requireGlobalAdmin} policy. There is no `warehouse:*` permission
 * check: no organization role holds one (ADR-0008), so being an application
 * administrator *is* the check. A non-admin receives 403
 * `user.globalAdminRequired` — note that reads also 403 rather than returning
 * an empty list, because an empty list would read as "no warehouses exist"
 * instead of "you may not see them".
 *
 * **Tenant scope.** These handlers must **not** read `ctx.erp.organizationId`:
 * `sessionGuard` intentionally does not resolve it (it is exclusive to
 * `erpGuard`). Scope comes from the request instead — `organizationId` on
 * create (defaulting to `null` = global, plan §6 D-C) and the `scope` query
 * filter on list. That is legitimate here precisely because the guard already
 * proved the caller is a platform admin; there is no tenant to protect an
 * admin from.
 */
export class WarehouseController {
	/**
	 * Builds the Elysia plugin mounting `/warehouses`.
	 *
	 * @returns An Elysia instance with the session guard and error mapping applied
	 */
	static plugin() {
		const warehouseService = container.resolve<WarehouseService>(
			WAREHOUSE_SERVICE_TOKEN,
		);

		/** Shared route options: session only, admin policy, no org context. */
		const adminRoute = (description: string) => ({
			erpSession: { policy: requireGlobalAdmin },
			detail: { description },
		});

		return domainPlugin({
			name: 'inventory-warehouses',
			prefix: '/warehouses',
			tags: ['Inventory'],
			guards: 'session',
		})
			.get(
				'',
				async ({ query }) =>
					okPaginated(
						await warehouseService.paginate(warehouseListQuerySchema.parse(query)),
					),
				adminRoute('Paginated warehouse list across every scope'),
			)
			.get(
				'/:id',
				async ({ params }) =>
					ok(await warehouseService.getWarehouse(idParamSchema.parse(params).id)),
				adminRoute('One warehouse with its address and storages'),
			)
			.post(
				'',
				async ({ body, erp, request, status }) => {
					const { address, ...rest } = createWarehouseSchema.parse(body);
					const row = await warehouseService.createWarehouse(
						address ? { ...rest, address } : rest,
						auditActor(erp.session, request),
					);
					return status(201, created(row));
				},
				{
					...adminRoute(
						'Creates a warehouse (global unless organizationId is given) with an optional address',
					),
				},
			)
			.patch(
				'/:id',
				async ({ params, body, erp, request }) =>
					ok(
						await warehouseService.updateWarehouse(
							idParamSchema.parse(params).id,
							updateWarehouseSchema.parse(body),
							auditActor(erp.session, request),
						),
					),
				adminRoute(
					'Updates a warehouse. Code and scope are immutable after creation',
				),
			)
			.delete(
				'/:id',
				async ({ params, erp, request }) =>
					ok(await warehouseService.archiveWarehouse(
						idParamSchema.parse(params).id,
						auditActor(erp.session, request),
					)),
				adminRoute('Archives a warehouse that holds no live units'),
			)
			// 1:1 address: PUT upserts, GET reads, DELETE removes. No POST —
			// there is never a second address to create.
			.get(
				'/:id/address',
				async ({ params }) => {
					const warehouse = await warehouseService.getWarehouse(
						idParamSchema.parse(params).id,
					);
					return ok(warehouse.address);
				},
				adminRoute('The warehouse address, or null when unset'),
			)
			.put(
				'/:id/address',
				async ({ params, body }) =>
					ok(
						await warehouseService.upsertAddress(
							idParamSchema.parse(params).id,
							warehouseAddressSchema.parse(body),
						),
					),
				adminRoute('Creates or replaces the warehouse address (strict 1:1)'),
			)
			.delete(
				'/:id/address',
				async ({ params }) =>
					ok({
						removed: await warehouseService.removeAddress(
							idParamSchema.parse(params).id,
						),
					}),
				adminRoute('Removes the warehouse address (idempotent)'),
			)
			.get(
				'/:id/storages',
				async ({ params, query }) =>
					ok(
						await warehouseService.listStorages(
							idParamSchema.parse(params).id,
							storageListQuerySchema.parse(query),
						),
					),
				adminRoute('Storages (bins) of a warehouse'),
			)
			.post(
				'/:id/storages',
				async ({ params, body, erp, request, status }) =>
					status(
						201,
						created(
							await warehouseService.createStorage(
								idParamSchema.parse(params).id,
								createStorageSchema.parse(body),
								auditActor(erp.session, request),
							),
						),
					),
				adminRoute('Adds a storage (bin) to a warehouse'),
			)
			.patch(
				'/:id/storages/:storageId',
				async ({ params, body, erp, request }) => {
					const parsed = nestedIdParamSchema.parse(params);
					return ok(
						await warehouseService.updateStorage(
							parsed.id,
							parsed.storageId,
							updateStorageSchema.parse(body),
							auditActor(erp.session, request),
						),
					);
				},
				adminRoute('Updates a storage. Code is immutable'),
			)
			.delete(
				'/:id/storages/:storageId',
				async ({ params, erp, request }) => {
					const parsed = nestedIdParamSchema.parse(params);
					return ok(
						await warehouseService.archiveStorage(
							parsed.id,
							parsed.storageId,
							auditActor(erp.session, request),
						),
					);
				},
				adminRoute('Archives a storage'),
			);
	}

	/**
	 * Builds the Elysia plugin mounting `GET /warehouses/linked`.
	 *
	 * @returns An Elysia instance with the `erp` guard applied
	 *
	 * @remarks
	 * Split from {@link WarehouseController.plugin} because the guards differ:
	 * the admin CRUD rides `sessionGuard` (a global admin may have no
	 * membership), while the linked read is an organization-scoped call that
	 * needs the validated `erp.organizationId`. Mounted in the same class so
	 * the service resolution and route ownership stay together.
	 */
	static linkedPlugin() {
		const warehouseService = container.resolve<WarehouseService>(
			WAREHOUSE_SERVICE_TOKEN,
		);

		return domainPlugin({
			name: 'inventory-warehouses-linked',
			prefix: '/warehouses/linked',
			tags: ['Inventory'],
			guards: 'erp',
		}).get(
			'',
			async ({ erp }) =>
				ok(await warehouseService.listLinkedWarehouses(erp.organizationId)),
			{
				erp: { permission: ['warehouse:read'] },
				detail: {
					description:
						'Warehouses the active organization is linked to (ERP-0031)',
				},
			},
		);
	}
}
