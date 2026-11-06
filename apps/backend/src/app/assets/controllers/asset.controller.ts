import { container } from 'tsyringe';
import type { ErpContext } from '@authorization/elysia-auth';
import { domainPlugin } from '@http/plugin';
import { created, noContent, ok, okPaginated } from '@http/response';
import {
	assetCreateSchema,
	assetDeactivateSchema,
	assetIdParamSchema,
	assetListQuerySchema,
	assetUpdateSchema,
} from '../contracts/asset.contract';
import { ASSET_SERVICE_TOKEN } from '../constants/di';
import type { AssetService, TAssetActor } from '../services/asset.service';

/**
 * Audit actor derived from the guard-resolved session and request headers,
 * never from client input (house pattern — mirrors user-admin.controller).
 */
function auditActor(erp: ErpContext, request: Request): TAssetActor {
	return {
		userId: erp.session.user.id,
		email: erp.session.user.email,
		ip: request.headers.get('x-forwarded-for'),
		userAgent: request.headers.get('user-agent'),
	};
}

/**
 * REST controller for the asset register (M06).
 *
 * @remarks
 * HTTP concerns only. Authorization rides the existing `asset:*` permission
 * matrix (D16) — no new grants. Delete is soft-only; deactivation carries a
 * mandatory reason (D18).
 */
export class AssetController {
	/** Builds the Elysia plugin mounting `/assets`. */
	static plugin() {
		const assetService = container.resolve<AssetService>(ASSET_SERVICE_TOKEN);

		return domainPlugin({
			name: 'assets',
			prefix: '/assets',
			tags: ['Assets'],
			guards: 'erp',
		})
			.get(
				'',
				async ({ query, erp }) =>
					okPaginated(
						await assetService.paginate({
							...assetListQuerySchema.parse(query),
							organizationId: erp.organizationId,
						}),
					),
				{
					erp: { permission: ['asset:read'] },
					detail: { description: 'Paginated asset register' },
				},
			)
			.get(
				'/types',
				async () => ok(await assetService.listTypes()),
				{
					erp: { permission: ['asset:read'] },
					detail: { description: 'Active asset types for form and filter options' },
				},
			)
			.post(
				'',
				async ({ body, erp, request, status }) =>
					status(
						201,
						created(
							await assetService.registerAsset(
								{
									...assetCreateSchema.parse(body),
									organizationId: erp.organizationId,
								},
								auditActor(erp, request),
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
						await assetService.updateAsset(
							assetIdParamSchema.parse(params).id,
							assetUpdateSchema.parse(body),
							auditActor(erp, request),
						),
					),
				{
					erp: { permission: ['asset:update'] },
					detail: { description: 'Updates asset master data' },
				},
			)
			.post(
				'/:id/deactivate',
				async ({ params, body, erp, request }) => {
					const { reason } = assetDeactivateSchema.parse(body);
					return ok(
						await assetService.deactivateAsset(
							assetIdParamSchema.parse(params).id,
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
						await assetService.reactivateAsset(
							assetIdParamSchema.parse(params).id,
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
					await assetService.archiveAsset(
						assetIdParamSchema.parse(params).id,
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
