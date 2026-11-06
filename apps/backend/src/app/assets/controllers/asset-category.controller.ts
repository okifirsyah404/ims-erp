import { container } from 'tsyringe';
import type { ErpContext } from '@authorization/elysia-auth';
import { domainPlugin } from '@http/plugin';
import { created, noContent, ok, okPaginated } from '@http/response';
import {
	assetCategoryCreateSchema,
	assetCategoryListQuerySchema,
	assetCategoryUpdateSchema,
	assetIdParamSchema,
} from '../contracts/asset.contract';
import { ASSET_CATEGORY_SERVICE_TOKEN } from '../constants/di';
import type {
	AssetCategoryService,
} from '../services/asset-category.service';
import type { TInventoryAuditActor } from '../../inventory/constants/audit-actor';

/**
 * Audit actor derived from the guard-resolved session and request headers,
 * never from client input (house pattern).
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
 * REST controller for asset categories.
 *
 * @remarks
 * Categories are master data gating asset creation, so writes need
 * `asset:create`/`asset:update` — reads need only `asset:read` (D16, no
 * new grants).
 */
export class AssetCategoryController {
	/** Builds the Elysia plugin mounting `/asset-categories`. */
	static plugin() {
		const categoryService = container.resolve<AssetCategoryService>(
			ASSET_CATEGORY_SERVICE_TOKEN,
		);

		return domainPlugin({
			name: 'asset-categories',
			prefix: '/asset-categories',
			tags: ['Assets'],
			guards: 'erp',
		})
			.get(
				'',
				async ({ query, erp }) =>
					okPaginated(
						await categoryService.paginate({
							...assetCategoryListQuerySchema.parse(query),
							organizationId: erp.organizationId,
						}),
					),
				{
					erp: { permission: ['asset:read'] },
					detail: { description: 'Paginated asset categories' },
				},
			)
			.get(
				'/:id',
				async ({ params }) =>
					ok(
						await categoryService.getCategory(
							assetIdParamSchema.parse(params).id,
						),
					),
				{
					erp: { permission: ['asset:read'] },
					detail: { description: 'One asset category' },
				},
			)
			.post(
				'',
				async ({ body, erp, request, status }) => {
					const parsed = assetCategoryCreateSchema.parse(body);
					return status(
						201,
						created(
							await categoryService.createCategory(
								{
									...parsed,
									organizationId: erp.organizationId,
								},
								auditActor(erp, request),
							),
						),
					);
				},
				{
					erp: { permission: ['asset:create'] },
					detail: { description: 'Creates an asset category' },
				},
			)
			.patch(
				'/:id',
				async ({ params, body, erp, request }) =>
					ok(
						await categoryService.updateCategory(
							assetIdParamSchema.parse(params).id,
							assetCategoryUpdateSchema.parse(body),
							auditActor(erp, request),
						),
					),
				{
					erp: { permission: ['asset:update'] },
					detail: { description: 'Updates an asset category' },
				},
			)
			.delete(
				'/:id',
				async ({ params, erp, request }) => {
					await categoryService.archiveCategory(
						assetIdParamSchema.parse(params).id,
						auditActor(erp, request),
					);
					return noContent();
				},
				{
					erp: { permission: ['asset:update'] },
					detail: { description: 'Soft-deletes an asset category' },
				},
			);
	}
}
