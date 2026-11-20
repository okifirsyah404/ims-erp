import type { ErpContext } from '@authorization/elysia-auth';
import { domainPlugin } from '@http/plugin';
import { created, noContent, ok, okPaginated } from '@http/response';
import { container } from 'tsyringe';
import { z } from 'zod';
import type { TAuditActor } from '@shared/audit';
import {
	DISPOSAL_SERVICE_TOKEN,
	ITEM_CUSTODY_SERVICE_TOKEN,
	ITEM_DOCUMENT_SERVICE_TOKEN,
	ITEM_REPOSITORY_TOKEN,
	MAINTENANCE_SERVICE_TOKEN,
	TOOL_SET_SERVICE_TOKEN,
} from '../constants/di';
import {
	conditionCheckSchema,
	disposalCreateSchema,
	itemDocumentUploadSchema,
	itemMoveSchema,
	itemPlaceSchema,
	itemTransferSchema,
	listQuery,
	maintenanceCreateSchema,
	toolSetCreateSchema,
	toolSetItemAddSchema,
	toolSetUpdateSchema,
} from '../contracts/item-operations.contract';
import { idParamSchema } from '../contracts/pagination.contract';
import { ItemRuleViolationError } from '../errors/item.errors';

/**
 * Audit actor derived from the guard-resolved session and request headers,
 * never from client input (house pattern).
 */
function auditActor(erp: ErpContext, request: Request): TAuditActor {
	return {
		userId: erp.session.user.id,
		email: erp.session.user.email,
		ip: request.headers.get('x-forwarded-for'),
		userAgent: request.headers.get('user-agent'),
	};
}

/**
 * REST controller for the operations of item units (`/inventory/...`):
 * location, movements, condition checks, maintenance, documents, disposal and
 * tool sets.
 *
 * @remarks
 * Permissions ride the existing `asset:*` matrix (D16): location changes need
 * `asset:update`, service logs `asset:maintain`, the disposal workflow
 * `asset:dispose`, everything else read/update. Unit sub-resources nest under
 * `/inventory/items/:id/...`; disposals and tool sets are organization-level
 * documents. Depreciation is not here: finance owns it (ADR-0024 Q15).
 */
export class ItemOperationsController {
	static plugin() {
		const custody = container.resolve(ITEM_CUSTODY_SERVICE_TOKEN);
		const maintenance = container.resolve(MAINTENANCE_SERVICE_TOKEN);
		const disposals = container.resolve(DISPOSAL_SERVICE_TOKEN);
		const documents = container.resolve(ITEM_DOCUMENT_SERVICE_TOKEN);
		const toolSets = container.resolve(TOOL_SET_SERVICE_TOKEN);
		const items = container.resolve(ITEM_REPOSITORY_TOKEN);
		const id = (params: unknown) => idParamSchema.parse(params).id;

		return (
			domainPlugin({
				name: 'inventory-item-operations',
				prefix: '/inventory',
				tags: ['Inventory'],
				guards: 'erp',
			})
				/* ------------------------------ location ----------------------------- */
				.post(
					'/items/:id/place',
					async ({ params, body, erp, request, status }) =>
						status(
							201,
							created(
								await custody.place(
									id(params),
									erp.organizationId,
									itemPlaceSchema.parse(body),
									auditActor(erp, request),
								),
							),
						),
					{
						erp: { permission: ['asset:update'] },
						detail: { description: 'Places a ready unit into a warehouse storage (receipt movement)' },
					},
				)
				.post(
					'/items/:id/transfer',
					async ({ params, body, erp, request, status }) =>
						status(
							201,
							created(
								await custody.transfer(
									id(params),
									erp.organizationId,
									itemTransferSchema.parse(body),
									auditActor(erp, request),
								),
							),
						),
					{
						erp: { permission: ['asset:update'] },
						detail: { description: 'Transfers a ready unit to another storage' },
					},
				)
				/* ----------------------------- movements ----------------------------- */
				.post(
					'/items/:id/movements',
					async ({ params, body, erp, request, status }) =>
						status(
							201,
							created(
								await custody.move(
									id(params),
									erp.organizationId,
									itemMoveSchema.parse(body),
									auditActor(erp, request),
								),
							),
						),
					{
						erp: { permission: ['asset:update'] },
						detail: { description: 'Records an off-site (project site) move' },
					},
				)
				.get(
					'/items/:id/movements',
					async ({ params, query, erp }) =>
						okPaginated(
							await custody.listMovements({
								itemId: id(params),
								organizationId: erp.organizationId,
								...listQuery.parse(query),
							}),
						),
					{
						erp: { permission: ['asset:read'] },
						detail: { description: 'Movement trail of a unit' },
					},
				)
				/* -------------------------- condition checks ------------------------- */
				.post(
					'/items/:id/condition-checks',
					async ({ params, body, erp, request, status }) =>
						status(
							201,
							created(
								await maintenance.recordCondition(
									id(params),
									erp.organizationId,
									conditionCheckSchema.parse(body),
									auditActor(erp, request),
								),
							),
						),
					{
						erp: { permission: ['asset:update'] },
						detail: { description: 'Records a condition check; the unit condition follows it' },
					},
				)
				.get(
					'/items/:id/condition-checks',
					async ({ params, query, erp }) =>
						okPaginated(
							await maintenance.listConditionChecks({
								itemId: id(params),
								organizationId: erp.organizationId,
								...listQuery.parse(query),
							}),
						),
					{
						erp: { permission: ['asset:read'] },
						detail: { description: 'Condition check history' },
					},
				)
				/* ---------------------------- maintenances --------------------------- */
				.post(
					'/items/:id/maintenances',
					async ({ params, body, erp, request, status }) =>
						status(
							201,
							created(
								await maintenance.logMaintenance(
									id(params),
									erp.organizationId,
									maintenanceCreateSchema.parse(body),
									auditActor(erp, request),
								),
							),
						),
					{
						erp: { permission: ['asset:maintain'] },
						detail: { description: 'Logs a service record; the code is sequence-allocated' },
					},
				)
				.get(
					'/items/:id/maintenances',
					async ({ params, query, erp }) =>
						okPaginated(
							await maintenance.listMaintenances({
								itemId: id(params),
								organizationId: erp.organizationId,
								...listQuery.parse(query),
							}),
						),
					{
						erp: { permission: ['asset:read'] },
						detail: { description: 'Service history of a unit' },
					},
				)
				/* ------------------------------ documents ---------------------------- */
				.post(
					'/items/:id/documents',
					async ({ params, body, erp, request, status }) => {
						const parsed = body as { file?: unknown; documentType?: unknown };
						if (!(parsed.file instanceof File)) {
							throw new ItemRuleViolationError('document_file_required');
						}
						const { documentType } = itemDocumentUploadSchema.parse({
							documentType: parsed.documentType,
						});
						return status(
							201,
							created(
								await documents.upload(
									id(params),
									erp.organizationId,
									parsed.file,
									documentType,
									auditActor(erp, request),
								),
							),
						);
					},
					{
						erp: { permission: ['asset:update'] },
						detail: { description: 'Uploads a document of a unit (multipart `file` + `documentType`)' },
					},
				)
				.get(
					'/items/:id/documents',
					async ({ params, erp }) => ok(await documents.list(id(params), erp.organizationId)),
					{
						erp: { permission: ['asset:read'] },
						detail: { description: 'Documents of a unit, with short-lived download links' },
					},
				)
				/* ------------------------------ disposals ---------------------------- */
				.post(
					'/items/:id/disposals',
					async ({ params, body, erp, request, status }) =>
						status(
							201,
							created(
								await disposals.requestDisposal(
									id(params),
									erp.organizationId,
									disposalCreateSchema.parse(body),
									auditActor(erp, request),
								),
							),
						),
					{
						erp: { permission: ['asset:dispose'] },
						detail: { description: 'Raises a disposal in draft (D21)' },
					},
				)
				.get(
					'/items/:id/history',
					async ({ params, erp }) => {
						const itemId = id(params);
						const item = await items.findById(itemId);
						if (!item || item.organizationId !== erp.organizationId) return ok(null);
						const historyRequest = {
							itemId,
							organizationId: erp.organizationId,
							page: 1,
							limit: 20,
						};
						const [movements, checks, maintenances, docs] = await Promise.all([
							custody.listMovements(historyRequest),
							maintenance.listConditionChecks(historyRequest),
							maintenance.listMaintenances(historyRequest),
							documents.list(itemId, erp.organizationId),
						]);
						return ok({
							item,
							history: {
								movements: movements.data,
								conditionChecks: checks.data,
								maintenances: maintenances.data,
								documents: docs,
							},
						});
					},
					{
						erp: { permission: ['asset:read'] },
						detail: { description: 'A unit with its movement, condition, service and document history' },
					},
				)
				.get(
					'/disposals',
					async ({ query, erp }) =>
						okPaginated(
							await disposals.list({
								organizationId: erp.organizationId,
								...listQuery.parse(query),
							}),
						),
					{
						erp: { permission: ['asset:read'] },
						detail: { description: 'Paginated disposal records' },
					},
				)
				.get(
					'/disposals/:id',
					async ({ params, erp }) => ok(await disposals.getDisposal(id(params), erp.organizationId)),
					{
						erp: { permission: ['asset:read'] },
						detail: { description: 'One disposal record' },
					},
				)
				.post(
					'/disposals/:id/approve',
					async ({ params, erp, request }) =>
						ok(await disposals.approveDisposal(id(params), erp.organizationId, auditActor(erp, request))),
					{
						erp: { permission: ['asset:dispose'] },
						detail: { description: 'Approves a draft or submitted disposal' },
					},
				)
				.post(
					'/disposals/:id/execute',
					async ({ params, erp, request }) =>
						ok(await disposals.executeDisposal(id(params), erp.organizationId, auditActor(erp, request))),
					{
						erp: { permission: ['asset:dispose'] },
						detail: {
							description:
								'Executes an approved disposal; the unit is flipped to disposed and soft-deleted in the same transaction (D21)',
						},
					},
				)
				.post(
					'/disposals/:id/cancel',
					async ({ params, erp, request }) =>
						ok(await disposals.cancelDisposal(id(params), erp.organizationId, auditActor(erp, request))),
					{
						erp: { permission: ['asset:dispose'] },
						detail: { description: 'Cancels a non-executed disposal' },
					},
				)
				/* ------------------------------ tool sets ---------------------------- */
				.get(
					'/tool-sets',
					async ({ query, erp }) =>
						okPaginated(
							await toolSets.list({
								organizationId: erp.organizationId,
								...listQuery.parse(query),
							}),
						),
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
								await toolSets.create(
									erp.organizationId,
									toolSetCreateSchema.parse(body),
									auditActor(erp, request),
								),
							),
						),
					{
						erp: { permission: ['asset:create'] },
						detail: { description: 'Creates a tool set (TST code)' },
					},
				)
				.get(
					'/tool-sets/:id',
					async ({ params, erp }) => ok(await toolSets.get(id(params), erp.organizationId)),
					{
						erp: { permission: ['asset:read'] },
						detail: { description: 'One tool set with its items' },
					},
				)
				.patch(
					'/tool-sets/:id',
					async ({ params, body, erp, request }) =>
						ok(
							await toolSets.update(
								id(params),
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
						await toolSets.archive(id(params), erp.organizationId, auditActor(erp, request));
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
						const setId = id(params);
						const row = await toolSets.addItem(
							setId,
							erp.organizationId,
							toolSetItemAddSchema.parse(body),
							auditActor(erp, request),
						);
						return status(201, created({ ...row, toolSetId: setId }));
					},
					{
						erp: { permission: ['asset:update'] },
						detail: { description: 'Adds a unit to a tool set' },
					},
				)
				.delete(
					'/tool-sets/:id/items/:rowId',
					async ({ params, erp, request }) => {
						await toolSets.removeItem(
							id(params),
							z.string().uuid().parse((params as { rowId: string }).rowId),
							erp.organizationId,
							auditActor(erp, request),
						);
						return noContent();
					},
					{
						erp: { permission: ['asset:update'] },
						detail: { description: 'Removes a unit from a tool set' },
					},
				)
		);
	}
}
