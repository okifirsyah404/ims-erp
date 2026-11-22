import { container } from 'tsyringe';
import { isGlobalAdmin, requireGlobalAdmin } from '@authorization/require-global-admin';
import type { TWarehouseAction } from '@authorization/elysia-auth';
import { domainPlugin } from '@http/plugin';
import { created, ok, okPaginated } from '@http/response';
import {
	assignManagerSchema,
	createStorageSchema,
	createWarehouseSchema,
	idParamSchema,
	managerCandidateQuerySchema,
	managerParamSchema,
	nestedIdParamSchema,
	storageListQuerySchema,
	updateStorageSchema,
	updateWarehouseSchema,
	warehouseAddressSchema,
	warehouseLinkParamSchema,
	warehouseLinkSchema,
	warehouseListQuerySchema,
} from '../contracts/warehouse.contract';
import {
	WAREHOUSE_IMAGE_SERVICE_TOKEN,
	WAREHOUSE_MANAGER_SERVICE_TOKEN,
	WAREHOUSE_SERVICE_TOKEN,
} from '../constants/di';
import { documentImageFrom } from '@providers/s3/document-image';
import type { WarehouseService } from '../services/warehouse.service';
import type { WarehouseManagerService } from '../services/warehouse-manager.service';
import type { TAuditActor } from '@shared/audit';

/**
 * Audit actor from the session (global-admin routes; no `erp` context).
 */
function auditActor(session: { user: { id: string; email?: string | null } }, request: Request): TAuditActor {
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
 * **Authorization.** Two guards share this plugin (ADR-0017):
 *
 * - `sessionGuard` + {@link requireGlobalAdmin} on the application-admin
 *   surface: the paginated list, create, organization links, and
 *   person-in-charge assign/unassign. There is no `warehouse:*` organization
 *   permission to consult: no organization role holds one (ADR-0008), so being
 *   an application administrator *is* the check. A non-admin receives 403
 *   `user.globalAdminRequired` — reads included, because an empty list would
 *   read as "no warehouses exist" instead of "you may not see them".
 * - `warehouseGuard` (`warehouse` macro) on the per-warehouse routes a person
 *   in charge may call: read, update, archive, import, export. A PIC of
 *   *another* warehouse gets 404, not 403, so existence is not leaked.
 *   `GET /warehouses/mine` is session-only and answers "which warehouses may
 *   I see" for the sidebar and pickers.
 *
 * **Tenant scope.** These handlers must **not** read `ctx.erp.organizationId`:
 * neither guard resolves it. Scope comes from the request instead —
 * `organizationId` on create (frozen at `null` = global) and the `scope` query
 * filter on list. That is legitimate here precisely because the guard already
 * proved the caller is an application admin; there is no tenant to protect an
 * admin from. A PIC's scope is their own grant, not an organization.
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
		const managerService = container.resolve<WarehouseManagerService>(
			WAREHOUSE_MANAGER_SERVICE_TOKEN,
		);
		const warehouseImages = container.resolve(WAREHOUSE_IMAGE_SERVICE_TOKEN);

		/** Shared route options: session only, admin policy, no org context. */
		const adminRoute = (description: string) => ({
			erpSession: { policy: requireGlobalAdmin },
			detail: { description },
		});

		/**
		 * Route options for a warehouse a person in charge may touch (ADR-0017).
		 *
		 * @remarks
		 * `warehouseGuard` resolves the session itself and answers 401/403/404;
		 * the resolved `erp.session` is what `auditActor` needs, so the handlers
		 * below are identical to their admin counterparts.
		 */
		const picRoute = (action: TWarehouseAction, description: string) => ({
			warehouse: { action },
			detail: { description },
		});

		return domainPlugin({
			name: 'warehouses',
			prefix: '/warehouses',
			tags: ['Warehouse'],
			// Both macros are mounted; each route opts into exactly one:
			// `erpSession` for application admins, `warehouse` for a PIC.
			guards: 'session+warehouse',
		})
			.get(
				'',
				async ({ query }) => {
					const page = await warehouseService.paginate(warehouseListQuerySchema.parse(query));
					return okPaginated({
						...page,
						data: page.data.map((row) => warehouseImages.withImageUrl(row)),
					});
				},
				adminRoute('Paginated warehouse list across every scope'),
			)
			// Static before `/:id`: the sidebar and pickers call this.
			.get(
				'/mine',
				async ({ erp }) =>
					ok(
						await managerService.listMine(
							erp.session.user.id,
							isGlobalAdmin({ erp }),
						),
					),
				{
					erpSession: { session: true },
					detail: {
						description:
							'Warehouses the caller is a person in charge of, each with its bins (ADR-0017). Application admins get every live warehouse',
					},
				},
			)
			.get(
				'/manager-candidates',
				async ({ query }) => {
					const { search, limit } = managerCandidateQuerySchema.parse(query);
					return ok(await managerService.searchCandidates(search, limit));
				},
				adminRoute(
					'Accounts an application admin may assign as a warehouse person in charge (ADR-0017)',
				),
			)
			.get(
				'/:id',
				async ({ params }) =>
					ok(
						warehouseImages.withImageUrl(
							await warehouseService.getWarehouse(idParamSchema.parse(params).id),
						),
					),
				picRoute('read', 'One warehouse with its address and storages'),
			)
			.post(
				'',
				async ({ body, erp, request, status }) => {
					const { address, ...rest } = createWarehouseSchema.parse(body);
					const row = await warehouseService.createWarehouse(
						address ? { ...rest, address } : rest,
						auditActor(erp.session, request),
					);
					return status(201, created(warehouseImages.withImageUrl(row)));
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
						warehouseImages.withImageUrl(
							await warehouseService.updateWarehouse(
								idParamSchema.parse(params).id,
								updateWarehouseSchema.parse(body),
								auditActor(erp.session, request),
							),
						),
					),
				picRoute(
					'update',
					'Updates a warehouse. Code and scope are immutable after creation',
				),
			)
			.put(
				'/:id/image',
				async ({ params, body }) =>
					ok(await warehouseImages.setImage(idParamSchema.parse(params).id, documentImageFrom(body))),
				picRoute('update', 'Uploads the warehouse photo (multipart `file`)'),
			)
			.delete(
				'/:id/image',
				async ({ params }) =>
					ok(await warehouseImages.setImage(idParamSchema.parse(params).id, null)),
				picRoute('update', 'Removes the warehouse photo'),
			)
			.delete(
				'/:id',
				async ({ params, erp, request }) =>
					ok(await warehouseService.archiveWarehouse(
						idParamSchema.parse(params).id,
						auditActor(erp.session, request),
					)),
				picRoute('archive', 'Archives a warehouse that holds no live units'),
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
				picRoute('read', 'The warehouse address, or null when unset'),
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
				picRoute('update', 'Creates or replaces the warehouse address (strict 1:1)'),
			)
			.delete(
				'/:id/address',
				async ({ params }) =>
					ok({
						removed: await warehouseService.removeAddress(
							idParamSchema.parse(params).id,
						),
					}),
				picRoute('update', 'Removes the warehouse address (idempotent)'),
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
				picRoute('read', 'Storages (bins) of a warehouse'),
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
				// Creating a *storage* is `update` on the warehouse: the PIC
				// grant has no `create` action, and that action belongs to the
				// warehouse itself, not to its bins (ADR-0017 §2).
				picRoute('update', 'Adds a storage (bin) to a warehouse'),
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
				picRoute('update', 'Updates a storage. Code is immutable'),
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
				picRoute('archive', 'Archives a storage'),
			)
			/* ------------- persons in charge (ADR-0017) ------------- */
			.get(
				'/:id/managers',
				async ({ params }) =>
					ok(
						await managerService.listManagers(
							idParamSchema.parse(params).id,
						),
					),
				adminRoute('Live persons in charge of a warehouse (ADR-0017)'),
			)
			.post(
				'/:id/managers',
				async ({ params, body, erp, request, status }) => {
					const { userId } = assignManagerSchema.parse(body);
					const assignment = await managerService.assign(
						idParamSchema.parse(params).id,
						userId,
						auditActor(erp.session, request),
					);
					return status(201, created(assignment));
				},
				{
					erpSession: { policy: requireGlobalAdmin },
					body: assignManagerSchema,
					detail: {
						description:
							'Grants a user person-in-charge access to a warehouse (ADR-0017). 409 when the grant already exists',
					},
				},
			)
			.delete(
				'/:id/managers/:userId',
				async ({ params, erp, request }) => {
					const parsed = managerParamSchema.parse(params);
					return ok(
						await managerService.unassign(
							parsed.id,
							parsed.userId,
							auditActor(erp.session, request),
						),
					);
				},
				{
					erpSession: { policy: requireGlobalAdmin },
					detail: {
						description:
							'Revokes a person-in-charge grant (ADR-0017). Idempotent: `removed: false` when no live grant exists',
					},
				},
			)
			/* ------------------- organization links (ERP-0031) ------------------- */
			.get(
				'/:id/organizations',
				async ({ params }) =>
					ok(
						await warehouseService.listWarehouseOrganizations(
							idParamSchema.parse(params).id,
						),
					),
				adminRoute('Organizations linked to a warehouse (ERP-0031)'),
			)
			.post(
				'/:id/organizations',
				async ({ params, body, erp, request, status }) => {
					const { organizationId } = warehouseLinkSchema.parse(body);
					const result = await warehouseService.linkOrganization(
						idParamSchema.parse(params).id,
						organizationId,
						auditActor(erp, request),
					);
					return status(result.created ? 201 : 200, created(result));
				},
				{
					erpSession: { policy: requireGlobalAdmin },
					body: warehouseLinkSchema,
					detail: {
						description:
							'Grants an organization access to a warehouse (ERP-0031). Idempotent: 201 when created, 200 when already linked',
					},
				},
			)
			.delete(
				'/:id/organizations/:organizationId',
				async ({ params, erp, request }) => {
					const parsed = warehouseLinkParamSchema.parse(params);
					const result = await warehouseService.unlinkOrganization(
						parsed.id,
						parsed.organizationId,
						auditActor(erp, request),
					);
					return ok(result);
				},
				{
					erpSession: { policy: requireGlobalAdmin },
					detail: {
						description:
							'Revokes an organization\u2019s access to a warehouse (ERP-0031). Refused with 409 while the organization holds open borrowings originating in the warehouse',
					},
				},
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
			name: 'warehouses-linked',
			prefix: '/warehouses/linked',
			tags: ['Warehouse'],
			guards: 'erp',
		}).get(
			'',
			async ({ erp }) =>
				ok(await warehouseService.listLinkedWarehouses(erp.organizationId)),
			{
				// The `erp` macro resolves the session and the active
				// organization; without it `erp` is undefined (500, fixed on
				// the 2026-11-06 merge).
				erp: {},
				// No `warehouse:*` permission — no organization role holds one
				// (ADR-0008), and the invariant test pins that. The response only
				// ever contains warehouses already linked to the caller's own
				// validated organization, so any authenticated member may read it;
				// there is nothing here a non-admin could escalate to.
				detail: {
					description:
						'Warehouses the active organization is linked to (ERP-0031). Any authenticated organization member; the list is scoped to the caller\u2019s own links',
				},
			},
		);
	}
}
