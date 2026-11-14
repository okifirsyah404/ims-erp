import { container } from 'tsyringe';
import type { ErpContext } from '@authorization/elysia-auth';
import { GLOBAL_ADMIN_ROLE, hasAppRole } from '@providers/better-auth/ac/admin-ac';
import { domainPlugin } from '@http/plugin';
import { created, noContent, ok, okPaginated } from '@http/response';
import {
	createItemSchema,
	createUnitSchema,
	idParamSchema,
	itemListQuerySchema,
	replaceSerialSchema,
	unitListQuerySchema,
	updateItemSchema,
} from '../contracts/item.contract';
import { documentImageFrom } from '@providers/s3/document-image';
import { ITEM_IMAGE_SERVICE_TOKEN, ITEM_SERVICE_TOKEN } from '../constants/di';
import type { ItemService } from '../services/item.service';
import type { TInventoryAuditActor } from '../constants/audit-actor';

/**
 * Audit actor derived from the guard-resolved session and request headers,
 * never from client input (house pattern — mirrors user-admin.controller).
 */
function auditActor(erp: ErpContext, request: Request): TInventoryAuditActor {
	return {
		userId: erp.session.user.id,
		email: erp.session.user.email,
		ip: request.headers.get('x-forwarded-for'),
		userAgent: request.headers.get('user-agent'),
	};
}

/**
 * REST controller for the item master and its serialized units.
 *
 * @remarks
 * HTTP concerns only: schema parsing, envelope mapping, `ctx.erp` unwrapping.
 * Authorization is declared per route through the `erp` macro
 * (`product:read|create|update|archive`) and enforced by `erpGuard` before
 * the handler runs, so nothing here reads the session for permission
 * evidence.
 *
 * `organizationId` comes from the guard-resolved context, never from the
 * request body, except where the plan allows a global (`null`) item — that is
 * decided by the caller's context below, not trusted blindly.
 */
export class ItemController {
	/**
	 * Builds the Elysia plugin mounting `/items`.
	 *
	 * @returns An Elysia instance with the guard and error mapping applied
	 */
	static plugin() {
		const itemService = container.resolve<ItemService>(ITEM_SERVICE_TOKEN);
		const itemImages = container.resolve(ITEM_IMAGE_SERVICE_TOKEN);

		return domainPlugin({
			name: 'inventory-items',
			prefix: '/items',
			tags: ['Inventory'],
			guards: 'erp',
		})
			.get(
				'',
				async ({ query }) =>
					okPaginated(
						await itemService.paginate(itemListQuerySchema.parse(query)).then((page) => ({
							...page,
							data: page.data.map((row) => itemImages.withImageUrl(row)),
						})),
					),
				{
					erp: { permission: ['product:read'] },
					detail: { description: 'Paginated item master' },
				},
			)
			.get(
				'/:id',
				async ({ params }) =>
					ok(itemImages.withImageUrl(await itemService.getItem(idParamSchema.parse(params).id))),
				{
					erp: { permission: ['product:read'] },
					detail: { description: 'One item by id' },
				},
			)
			.post(
				'',
				async ({ body, erp, request, status }) => {
					const parsed = createItemSchema.parse(body);
					const row = await itemService.createItem(
						{
							...parsed,
							// Tenant scope is the caller's organization; an
							// application admin may create a global item.
							organizationId: resolveOrganizationId(parsed.organizationId, erp),
							createdBy: erp.session.user.id,
						} as never,
						auditActor(erp, request),
					);
					return status(201, created(row));
				},
				{
					erp: { permission: ['product:create'] },
					detail: { description: 'Creates an item' },
				},
			)
			.patch(
				'/:id',
				async ({ params, body, erp, request }) => {
					const id = idParamSchema.parse(params).id;
					const row = await itemService.updateItem(
						id,
						updateItemSchema.parse(body),
						auditActor(erp, request),
					);
					return ok(row);
				},
				{
					erp: { permission: ['product:update'] },
					detail: { description: 'Updates an item' },
				},
			)
			.delete(
				'/:id',
				async ({ params, erp, request }) => {
					const id = idParamSchema.parse(params).id;
					await itemService.archiveItem(id, auditActor(erp, request));
					return noContent();
				},
				{
					erp: { permission: ['product:archive'] },
					detail: { description: 'Archives an item (soft delete)' },
				},
			)
			.put(
				'/:id/image',
				async ({ params, body }) =>
					ok(await itemImages.setImage(idParamSchema.parse(params).id, documentImageFrom(body))),
				{
					erp: { permission: ['product:update'] },
					detail: { description: 'Uploads the photo printed on documents (multipart `file`)' },
				},
			)
			.delete(
				'/:id/image',
				async ({ params }) => ok(await itemImages.setImage(idParamSchema.parse(params).id, null)),
				{
					erp: { permission: ['product:update'] },
					detail: { description: 'Removes the document photo' },
				},
			)
			.get(
				'/:id/units',
				async ({ params, query }) => {
					const id = idParamSchema.parse(params).id;
					const parsed = unitListQuerySchema.parse(query);
					return okPaginated(
						await itemService.paginateUnits({ ...parsed, itemId: id }),
					);
				},
				{
					erp: { permission: ['product:read'] },
					detail: { description: 'Paginated units of one item' },
				},
			)
			.post(
				'/:id/units',
				async ({ params, body, erp, status }) => {
					const id = idParamSchema.parse(params).id;
					const parsed = createUnitSchema.parse(body);
					const row = await itemService.registerUnit(id, {
						...parsed,
						organizationId: resolveOrganizationId(
							parsed.organizationId,
							erp,
						),
					});
					return status(201, created(row));
				},
				{
					erp: { permission: ['product:update'] },
					detail: { description: 'Registers a unit for a serialized item' },
				},
			)
			.patch(
				'/:id/units/:unitId',
				async ({ params, body }) => {
					const { unitId } = params as { unitId: string };
					const row = await itemService.replaceProvisionalSerial(
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
 * Resolves the tenant scope for a new row.
 *
 * @remarks
 * A client may only request a **global** row (`null`) when it is an
 * application administrator. Everyone else is pinned to their own
 * organization regardless of what the body asked for — the body is input,
 * never authorization evidence.
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
		// Silently coercing would hide a client bug; the guard already
		// established membership, so a mismatch is a bad request.
		return erp.organizationId;
	}
	return erp.organizationId;
}
