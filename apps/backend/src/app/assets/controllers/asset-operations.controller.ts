import { container } from 'tsyringe';
import { z } from 'zod';
import type { ErpContext } from '@authorization/elysia-auth';
import { domainPlugin } from '@http/plugin';
import { created, noContent, ok, okPaginated } from '@http/response';
import { assetIdParamSchema } from '../contracts/asset.contract';
import {
	assignmentListQuerySchema,
	assetAssignSchema,
	assetReturnSchema,
	assetMoveSchema,
	conditionCheckSchema,
	conditionCheckListQuerySchema,
	maintenanceCreateSchema,
	maintenanceListQuerySchema,
	depreciationCreateSchema,
	depreciationListQuerySchema,
	disposalCreateSchema,
	disposalListQuerySchema,
	documentAttachSchema,
	toolSetCreateSchema,
	toolSetUpdateSchema,
	toolSetListQuerySchema,
	toolSetItemAddSchema,
	listQuery,
} from '../contracts/asset-operations.contract';
import {
	ASSET_OPERATIONS_SERVICE_TOKEN,
	ASSET_REPOSITORY_TOKEN,
} from '../constants/di';
import type { AssetOperationsService } from '../services/asset-operations.service';
import type { IAssetRepository } from '../contracts/asset.repository.interface';
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
 * REST controller for asset operations (Phase A-3): custody, movements,
 * condition checks, maintenances, depreciations, disposals, documents and
 * tool sets.
 *
 * @remarks
 * Permission mapping rides the existing `asset:*` matrix (D16): custody
 * needs `asset:assign`/`asset:return`, service logs `asset:maintain`,
 * disposal workflow `asset:dispose`, everything else read/update. All
 * sub-resources nest under `/assets/:id/...` except disposals and tool
 * sets, which are organization-level documents.
 */
export class AssetOperationsController {
	/** Builds the Elysia plugin mounting the operation routes. */
	static plugin() {
		const operations = container.resolve<AssetOperationsService>(
			ASSET_OPERATIONS_SERVICE_TOKEN,
		);
		const assets = container.resolve<IAssetRepository>(ASSET_REPOSITORY_TOKEN);

		return domainPlugin({
			name: 'asset-operations',
			prefix: '/assets',
			tags: ['Assets'],
			guards: 'erp',
		})
			/* ------------------------------ custody ------------------------------ */
			.post(
				'/:id/assignments',
				async ({ params, body, erp, request, status }) =>
					status(
						201,
						created(
							await operations.assign(
								assetIdParamSchema.parse(params).id,
								erp.organizationId,
								assetAssignSchema.parse(body),
								auditActor(erp, request),
							),
						),
					),
				{
					erp: { permission: ['asset:assign'] },
					detail: { description: 'Assigns an asset to a holder (D12)' },
				},
			)
			.get(
				'/:id/assignments',
				async ({ params, query, erp }) => {
					const { id } = assetIdParamSchema.parse(params);
					return okPaginated(
						await operations.listAssignments({
							assetId: id,
							organizationId: erp.organizationId,
							...assignmentListQuerySchema.parse(query),
						}),
					);
				},
				{
					erp: { permission: ['asset:read'] },
					detail: { description: 'Custody history of an asset' },
				},
			)
			.post(
				'/:id/return',
				async ({ params, body, erp, request }) =>
					ok(
						await operations.returnAsset(
							assetIdParamSchema.parse(params).id,
							erp.organizationId,
							assetReturnSchema.parse(body),
							auditActor(erp, request),
						),
					),
				{
					erp: { permission: ['asset:return'] },
					detail: {
						description:
							'Returns an assigned asset; condition-in is mandatory (D12)',
					},
				},
			)
			/* ----------------------------- movements ----------------------------- */
			.post(
				'/:id/movements',
				async ({ params, body, erp, request, status }) =>
					status(
						201,
						created(
							await operations.move(
								assetIdParamSchema.parse(params).id,
								erp.organizationId,
								assetMoveSchema.parse(body),
								auditActor(erp, request),
							),
						),
					),
				{
					erp: { permission: ['asset:update'] },
					detail: { description: 'Records an asset transfer / site move' },
				},
			)
			.get(
				'/:id/movements',
				async ({ params, query, erp }) => {
					const { id } = assetIdParamSchema.parse(params);
					const { page, limit } = listQuery.parse(query);
					return okPaginated(
						await operations.listMovements(
							id,
							erp.organizationId,
							page,
							limit,
						),
					);
				},
				{
					erp: { permission: ['asset:read'] },
					detail: { description: 'Movement trail of an asset' },
				},
			)
			/* -------------------------- condition checks ------------------------- */
			.post(
				'/:id/condition-checks',
				async ({ params, body, erp, request, status }) =>
					status(
						201,
						created(
							await operations.recordCondition(
								assetIdParamSchema.parse(params).id,
								erp.organizationId,
								conditionCheckSchema.parse(body),
								auditActor(erp, request),
							),
						),
					),
				{
					erp: { permission: ['asset:update'] },
					detail: {
						description:
							'Records a condition check; the asset condition follows it',
					},
				},
			)
			.get(
				'/:id/condition-checks',
				async ({ params, query, erp }) => {
					const { id } = assetIdParamSchema.parse(params);
					const { page, limit } = conditionCheckListQuerySchema.parse(query);
					return okPaginated(
						await operations.listConditionChecks(
							id,
							erp.organizationId,
							page,
							limit,
						),
					);
				},
				{
					erp: { permission: ['asset:read'] },
					detail: { description: 'Condition check history' },
				},
			)
			/* ---------------------------- maintenances --------------------------- */
			.post(
				'/:id/maintenances',
				async ({ params, body, erp, request, status }) =>
					status(
						201,
						created(
							await operations.logMaintenance(
								assetIdParamSchema.parse(params).id,
								erp.organizationId,
								maintenanceCreateSchema.parse(body),
								auditActor(erp, request),
							),
						),
					),
				{
					erp: { permission: ['asset:maintain'] },
					detail: {
						description:
							'Logs a service record; the code is sequence-allocated (ERP-0009)',
					},
				},
			)
			.get(
				'/:id/maintenances',
				async ({ params, query, erp }) => {
					const { id } = assetIdParamSchema.parse(params);
					const { page, limit } = maintenanceListQuerySchema.parse(query);
					return okPaginated(
						await operations.listMaintenances(
							id,
							erp.organizationId,
							page,
							limit,
						),
					);
				},
				{
					erp: { permission: ['asset:read'] },
					detail: { description: 'Service history of an asset' },
				},
			)
			/* ---------------------------- depreciations --------------------------- */
			.post(
				'/:id/depreciations',
				async ({ params, body, erp, request, status }) =>
					status(
						201,
						created(
							await operations.recordDepreciation(
								assetIdParamSchema.parse(params).id,
								erp.organizationId,
								depreciationCreateSchema.parse(body),
								auditActor(erp, request),
							),
						),
					),
				{
					erp: { permission: ['asset:update'] },
					detail: {
						description:
							'Records a manual depreciation entry; idempotent per period (D14)',
					},
				},
			)
			.get(
				'/:id/depreciations',
				async ({ params, query, erp }) => {
					const { id } = assetIdParamSchema.parse(params);
					const { page, limit } = depreciationListQuerySchema.parse(query);
					return okPaginated(
						await operations.listDepreciations(
							id,
							erp.organizationId,
							page,
							limit,
						),
					);
				},
				{
					erp: { permission: ['asset:read'] },
					detail: { description: 'Depreciation trail of an asset' },
				},
			)
			/* ------------------------------ documents ---------------------------- */
			.post(
				'/:id/documents',
				async ({ params, body, erp, request, status }) =>
					status(
						201,
						created(
							await operations.attachDocument(
								assetIdParamSchema.parse(params).id,
								erp.organizationId,
								documentAttachSchema.parse(body),
								auditActor(erp, request),
							),
						),
					),
				{
					erp: { permission: ['asset:update'] },
					detail: {
						description: 'Attaches a logical document reference (D19)',
					},
				},
			)
			.get(
				'/:id/documents',
				async ({ params, erp }) =>
					ok(
						await operations.listDocuments(
							assetIdParamSchema.parse(params).id,
							erp.organizationId,
						),
					),
				{
					erp: { permission: ['asset:read'] },
					detail: { description: 'Documents attached to an asset' },
				},
			)
			/* ------------------------------ disposals ---------------------------- */
			.post(
				'/:id/disposals',
				async ({ params, body, erp, request, status }) =>
					status(
						201,
						created(
							await operations.requestDisposal(
								assetIdParamSchema.parse(params).id,
								erp.organizationId,
								disposalCreateSchema.parse(body),
								auditActor(erp, request),
							),
						),
					),
				{
					erp: { permission: ['asset:dispose'] },
					detail: {
						description: 'Raises a disposal in draft (D21)',
					},
				},
			)
			/* ------------------------------ tool sets ---------------------------- */
			.get(
				'/tool-sets',
				async ({ query, erp }) => {
					const { page, limit } = toolSetListQuerySchema.parse(query);
					return okPaginated(
						await operations.listToolSets(erp.organizationId, page, limit),
					);
				},
				{
					erp: { permission: ['asset:read'] },
					detail: { description: 'Paginated tool sets' },
				},
			)
			.post(
				'/tool-sets',
				async ({ body, erp, request, status }) =>
					status(
						201,
						created(
							await operations.createToolSet(
								erp.organizationId,
								toolSetCreateSchema.parse(body),
								auditActor(erp, request),
							),
						),
					),
				{
					erp: { permission: ['asset:create'] },
					detail: { description: 'Creates a tool set (TST-KIT code)' },
				},
			)
			.get(
				'/tool-sets/:id',
				async ({ params, erp }) => {
					const { id } = assetIdParamSchema.parse(params);
					return ok(await operations.getToolSet(id, erp.organizationId));
				},
				{
					erp: { permission: ['asset:read'] },
					detail: { description: 'One tool set with its items' },
				},
			)
			.patch(
				'/tool-sets/:id',
				async ({ params, body, erp, request }) =>
					ok(
						await operations.updateToolSet(
							assetIdParamSchema.parse(params).id,
							erp.organizationId,
							toolSetUpdateSchema.parse(body),
							auditActor(erp, request),
						),
					),
				{
					erp: { permission: ['asset:update'] },
					detail: { description: 'Updates a tool set' },
				},
			)
			.delete(
				'/tool-sets/:id',
				async ({ params, erp, request }) => {
					await operations.archiveToolSet(
						assetIdParamSchema.parse(params).id,
						erp.organizationId,
						auditActor(erp, request),
					);
					return noContent();
				},
				{
					erp: { permission: ['asset:update'] },
					detail: { description: 'Soft-deletes an empty tool set' },
				},
			)
			.post(
				'/tool-sets/:id/items',
				async ({ params, body, erp, request, status }) => {
					const { id } = assetIdParamSchema.parse(params);
					const item = await operations.addToolSetItem(
						id,
						erp.organizationId,
						toolSetItemAddSchema.parse(body),
						auditActor(erp, request),
					);
					return status(201, created({ ...item, toolSetId: id }));
				},
				{
					erp: { permission: ['asset:update'] },
					detail: { description: 'Adds an asset to a tool set' },
				},
			)
			.delete(
				'/tool-sets/:id/items/:itemId',
				async ({ params, erp, request }) => {
					const { id } = assetIdParamSchema.parse(params);
					await operations.removeToolSetItem(
						id,
						z.string().uuid().parse(params.itemId),
						erp.organizationId,
						auditActor(erp, request),
					);
					return noContent();
				},
				{
					erp: { permission: ['asset:update'] },
					detail: { description: 'Removes an item from a tool set' },
				},
			)
			/* ------------------------- disposal document routes ------------------ */
			.get(
				'/disposals',
				async ({ query, erp }) => {
					const { page, limit } = disposalListQuerySchema.parse(query);
					return okPaginated(
						await operations.listDisposals(erp.organizationId, page, limit),
					);
				},
				{
					erp: { permission: ['asset:read'] },
					detail: { description: 'Paginated disposal records' },
				},
			)
			.get(
				'/disposals/:id',
				async ({ params, erp }) => {
					const { id } = assetIdParamSchema.parse(params);
					return ok(await operations.getDisposal(id, erp.organizationId));
				},
				{
					erp: { permission: ['asset:read'] },
					detail: { description: 'One disposal record' },
				},
			)
			.post(
				'/disposals/:id/approve',
				async ({ params, erp, request }) =>
					ok(
						await operations.approveDisposal(
							assetIdParamSchema.parse(params).id,
							erp.organizationId,
							auditActor(erp, request),
						),
					),
				{
					erp: { permission: ['asset:dispose'] },
					detail: { description: 'Approves a draft/submitted disposal' },
				},
			)
			.post(
				'/disposals/:id/execute',
				async ({ params, erp, request }) =>
					ok(
						await operations.executeDisposal(
							assetIdParamSchema.parse(params).id,
							erp.organizationId,
							auditActor(erp, request),
						),
					),
				{
					erp: { permission: ['asset:dispose'] },
					detail: {
						description:
							'Executes an approved disposal; the asset is flipped to disposed and soft-deleted in the same transaction (D21)',
					},
				},
			)
			.post(
				'/disposals/:id/cancel',
				async ({ params, erp, request }) =>
					ok(
						await operations.cancelDisposal(
							assetIdParamSchema.parse(params).id,
							erp.organizationId,
							auditActor(erp, request),
						),
					),
				{
					erp: { permission: ['asset:dispose'] },
					detail: { description: 'Cancels a non-executed disposal' },
				},
			)
			/* ------------------------- asset detail (history) ------------------- */
			.get(
				'/:id',
				async ({ params, erp }) => {
					const { id } = assetIdParamSchema.parse(params);
					const asset = await assets.findById(id);
					if (!asset || asset.organizationId !== erp.organizationId) {
						return ok(null);
					}
					const [assignments, movements, checks, maintenances, depreciations, documents] =
						await Promise.all([
							operations.listAssignments({
								assetId: id,
								organizationId: erp.organizationId,
								page: 1,
								limit: 20,
							}),
							operations.listMovements(id, erp.organizationId, 1, 20),
							operations.listConditionChecks(id, erp.organizationId, 1, 20),
							operations.listMaintenances(id, erp.organizationId, 1, 20),
							operations.listDepreciations(id, erp.organizationId, 1, 20),
							operations.listDocuments(id, erp.organizationId),
						]);
					return ok({
						asset,
						history: {
							assignments: assignments.data,
							movements: movements.data,
							conditionChecks: checks.data,
							maintenances: maintenances.data,
							depreciations: depreciations.data,
							documents,
						},
					});
				},
				{
					erp: { permission: ['asset:read'] },
					detail: { description: 'Asset detail with full history' },
				},
			);
	}
}
