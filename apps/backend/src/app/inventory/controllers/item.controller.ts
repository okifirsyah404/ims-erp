import { container } from 'tsyringe';
import type { ErpContext } from '@authorization/elysia-auth';
import { domainPlugin } from '@http/plugin';
import { created, noContent, ok, okPaginated } from '@http/response';
import {
	createItemSchema,
	itemDeactivateSchema,
	itemIdParamSchema,
	itemListQuerySchema,
	updateItemSchema,
} from '../contracts/item.contract';
import { documentImageFrom } from '@providers/s3/document-image';
import {
	galleryCaptionFrom,
	galleryCaptionSchema,
	galleryImageParamSchema,
	galleryOrderSchema,
} from '@shared/media';
import { ITEM_IMAGE_SERVICE_TOKEN, ITEM_SERVICE_TOKEN } from '../constants/di';
import type { ItemService, TItemActor } from '../services/item.service';

/**
 * Audit actor derived from the guard-resolved session and request headers,
 * never from client input (house pattern — mirrors user-admin.controller).
 */
function auditActor(erp: ErpContext, request: Request): TItemActor {
	return {
		userId: erp.session.user.id,
		email: erp.session.user.email,
		ip: request.headers.get('x-forwarded-for'),
		userAgent: request.headers.get('user-agent'),
	};
}

/**
 * REST controller for items - physical tool/asset units (M06, ADR-0024 Q14).
 *
 * @remarks
 * HTTP concerns only. Authorization rides the existing `asset:*` permission
 * matrix (D16) — no new grants. Delete is soft-only; deactivation carries a
 * mandatory reason (D18).
 */
export class ItemController {
	/** Builds the Elysia plugin mounting `/inventory/items`. */
	static plugin() {
		const itemService = container.resolve<ItemService>(ITEM_SERVICE_TOKEN);
		const itemImages = container.resolve(ITEM_IMAGE_SERVICE_TOKEN);

		return domainPlugin({
			name: 'inventory-items',
			prefix: '/inventory/items',
			tags: ['Inventory'],
			guards: 'erp',
		})
			.get(
				'',
				async ({ query, erp }) => {
					const page = await itemService.paginate({
						...itemListQuerySchema.parse(query),
						organizationId: erp.organizationId,
					});
					return okPaginated({ ...page, data: page.data.map((row) => itemImages.withImageUrl(row)) });
				},
				{
					erp: { permission: ['asset:read'] },
					detail: { description: 'Paginated asset register' },
				},
			)
			.get(
				'/kinds',
				async () => ok(await itemService.listKinds()),
				{
					erp: { permission: ['asset:read'] },
					detail: { description: 'Item kinds for form and filter options' },
				},
			)
			.post(
				'',
				async ({ body, erp, request, status }) =>
					status(
						201,
						created(
							itemImages.withImageUrl(
								await itemService.registerItem(
									{
										...createItemSchema.parse(body),
										organizationId: erp.organizationId,
									},
									auditActor(erp, request),
								),
							),
						),
					),
				{
					erp: { permission: ['asset:create'] },
					detail: {
						description:
							'Registers an asset; the code is sequence-allocated (ERP-0009)',
					},
				},
			)
			.patch(
				'/:id',
				async ({ params, body, erp, request }) =>
					ok(
						itemImages.withImageUrl(
							await itemService.updateItem(
								itemIdParamSchema.parse(params).id,
								updateItemSchema.parse(body),
								auditActor(erp, request),
							),
						),
					),
				{
					erp: { permission: ['asset:update'] },
					detail: { description: 'Updates asset master data' },
				},
			)
			.put(
				'/:id/image',
				async ({ params, body, erp }) =>
					ok(await itemImages.setImage(itemIdParamSchema.parse(params).id, erp.organizationId, documentImageFrom(body))),
				{
					erp: { permission: ['asset:update'] },
					detail: { description: 'Uploads the asset photo (multipart `file`)' },
				},
			)
			.delete(
				'/:id/image',
				async ({ params, erp }) =>
					ok(await itemImages.setImage(itemIdParamSchema.parse(params).id, erp.organizationId, null)),
				{
					erp: { permission: ['asset:update'] },
					detail: { description: 'Removes the asset cover photo' },
				},
			)
			.get(
				'/:id/images',
				async ({ params, erp }) =>
					ok(await itemImages.list(itemIdParamSchema.parse(params).id, erp.organizationId)),
				{
					erp: { permission: ['asset:read'] },
					detail: { description: 'Asset image gallery, cover first' },
				},
			)
			.post(
				'/:id/images',
				async ({ params, body, erp, status }) =>
					status(
						201,
						created(
							await itemImages.addImage(
								itemIdParamSchema.parse(params).id,
								erp.organizationId,
								documentImageFrom(body),
								galleryCaptionFrom(body),
							),
						),
					),
				{
					erp: { permission: ['asset:update'] },
					detail: { description: 'Adds a gallery image (multipart `file`, optional `caption`; max 10)' },
				},
			)
			// Static before `/:imageId`.
			.put(
				'/:id/images/order',
				async ({ params, body, erp }) =>
					ok(
						await itemImages.reorder(
							itemIdParamSchema.parse(params).id,
							erp.organizationId,
							galleryOrderSchema.parse(body).imageIds,
						),
					),
				{
					erp: { permission: ['asset:update'] },
					detail: { description: 'Reorders the gallery; the first id becomes the cover' },
				},
			)
			.patch(
				'/:id/images/:imageId',
				async ({ params, body, erp }) => {
					const { id, imageId } = galleryImageParamSchema.parse(params);
					return ok(
						await itemImages.updateCaption(id, erp.organizationId, imageId, galleryCaptionSchema.parse(body).caption),
					);
				},
				{
					erp: { permission: ['asset:update'] },
					detail: { description: 'Edits the caption of a gallery image' },
				},
			)
			.delete(
				'/:id/images/:imageId',
				async ({ params, erp }) => {
					const { id, imageId } = galleryImageParamSchema.parse(params);
					await itemImages.removeImage(id, erp.organizationId, imageId);
					return noContent();
				},
				{
					erp: { permission: ['asset:update'] },
					detail: { description: 'Removes a gallery image' },
				},
			)
			.post(
				'/:id/deactivate',
				async ({ params, body, erp, request }) => {
					const { reason } = itemDeactivateSchema.parse(body);
					return ok(
						await itemService.deactivateItem(
							itemIdParamSchema.parse(params).id,
							reason,
							auditActor(erp, request),
						),
					);
				},
				{
					erp: { permission: ['asset:update'] },
					detail: { description: 'Parks an asset with a mandatory reason (D18)' },
				},
			)
			.post(
				'/:id/reactivate',
				async ({ params, erp, request }) =>
					ok(
						await itemService.reactivateItem(
							itemIdParamSchema.parse(params).id,
							auditActor(erp, request),
						),
					),
				{
					erp: { permission: ['asset:update'] },
					detail: { description: 'Brings a parked asset back to in_stock' },
				},
			)
			.delete(
				'/:id',
				async ({ params, erp, request }) => {
					await itemService.archiveItem(
						itemIdParamSchema.parse(params).id,
						auditActor(erp, request),
					);
					return noContent();
				},
				{
					erp: { permission: ['asset:update'] },
					detail: {
						description:
							'Soft-deletes an asset (only path; history blocks it)',
					},
				},
			);
	}
}
