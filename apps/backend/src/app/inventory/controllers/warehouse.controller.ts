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
				async ({ body, status }) => {
					const { address, ...rest } = createWarehouseSchema.parse(body);
					const row = await warehouseService.createWarehouse(
						address ? { ...rest, address } : rest,
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
				async ({ params, body }) =>
					ok(
						await warehouseService.updateWarehouse(
							idParamSchema.parse(params).id,
							updateWarehouseSchema.parse(body),
						),
					),
				adminRoute(
					'Updates a warehouse. Code and scope are immutable after creation',
				),
			)
			.delete(
				'/:id',
				async ({ params }) =>
					ok(await warehouseService.archiveWarehouse(idParamSchema.parse(params).id)),
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
				async ({ params, body, status }) =>
					status(
						201,
						created(
							await warehouseService.createStorage(
								idParamSchema.parse(params).id,
								createStorageSchema.parse(body),
							),
						),
					),
				adminRoute('Adds a storage (bin) to a warehouse'),
			)
			.patch(
				'/:id/storages/:storageId',
				async ({ params, body }) => {
					const parsed = nestedIdParamSchema.parse(params);
					return ok(
						await warehouseService.updateStorage(
							parsed.id,
							parsed.storageId,
							updateStorageSchema.parse(body),
						),
					);
				},
				adminRoute('Updates a storage. Code is immutable'),
			)
			.delete(
				'/:id/storages/:storageId',
				async ({ params }) => {
					const parsed = nestedIdParamSchema.parse(params);
					return ok(
						await warehouseService.archiveStorage(parsed.id, parsed.storageId),
					);
				},
				adminRoute('Archives a storage'),
			);
	}
}
