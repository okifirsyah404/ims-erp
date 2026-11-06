import { container } from 'tsyringe';
import type { ErpContext } from '@authorization/elysia-auth';
import { PERMISSION_RESOLVER_TOKEN } from '@authorization/permission-resolver';
import type { IPermissionResolver } from '@authorization/permission-resolver';
import { domainPlugin } from '@http/plugin';
import { created, ok, okPaginated } from '@http/response';
import {
	borrowingListQuerySchema,
	createBorrowingSchema,
	extendBorrowingSchema,
	markLostSchema,
	returnBorrowingSchema,
} from '../contracts/borrowing.contract';
import { assetIdParamSchema } from '../contracts/asset.contract';
import { BORROWING_SERVICE_TOKEN } from '../constants/di';
import type {
	BorrowingService,
	TBorrowingActor,
} from '../services/borrowing.service';

/**
 * REST controller for the borrowing workflow.
 *
 * @remarks
 * **Authorization is declared per route** (§7): `asset_borrowing:create` to raise,
 * `asset_borrowing:approve` to approve/reject, `asset_borrowing:issue` to issue,
 * `asset_borrowing:return` to return, `asset_borrowing:extend` to extend,
 * `asset_borrowing:mark_lost` to report a loss, and `asset_borrowing:update` to cancel.
 *
 * **The actor flags are computed here, not in the service.** The service
 * receives a plain {@link TBorrowingActor} so it never reads a session — the
 * same split the adjustment workflow uses. Three capabilities matter:
 * - `canApprove` — the self-approval bypass.
 * - `canIssue` — skipping approval is a privilege, not a default.
 * - `canSeeGuestPii` — the guest-PII tier from §6, deliberately keyed on
 *   `asset_borrowing:mark_lost` rather than a new statement.
 *
 * **Tenant scope** is always `ctx.erp.organizationId`; every service call takes
 * it explicitly so a cross-tenant id is a 404 rather than a leak.
 */
export class BorrowingController {
	/**
	 * Builds the Elysia plugin mounting `/borrowings`.
	 *
	 * @returns An Elysia instance with the guard and error mapping applied
	 */
	static plugin() {
		const borrowingService = container.resolve<BorrowingService>(
			BORROWING_SERVICE_TOKEN,
		);
		const resolver = container.resolve<IPermissionResolver>(
			PERMISSION_RESOLVER_TOKEN,
		);

		/**
		 * Builds the actor context for one request.
		 *
		 * @param erp - The guard-resolved context
		 * @remarks
		 * Uses the same resolver and the same dynamic-then-static fallback as
		 * `erpGuard`, so a capability computed here cannot disagree with what the
		 * route's own permission check decided.
		 */
		const actorFor = async (erp: ErpContext): Promise<TBorrowingActor> => {
			const roles = erp.member.role.split(',').map((role) => role.trim());
			const canSeeGuestPii = await resolver.hasPermission(
				erp.organizationId,
				roles,
				{ asset_borrowing: ['mark_lost'] },
			);
			return {
				actorUserId: erp.session.user.id,
				canApprove: await resolver.hasPermission(erp.organizationId, roles, {
					asset_borrowing: ['approve'],
				}),
				canIssue: await resolver.hasPermission(erp.organizationId, roles, {
					asset_borrowing: ['issue'],
				}),
				canSeeGuestPii,
			};
		};

		return domainPlugin({
			name: 'asset-borrowings',
			prefix: '/borrowings',
			tags: ['Assets'],
			guards: 'erp',
		})
			.get(
				'',
				async ({ query, erp }) =>
					okPaginated(
						await borrowingService.paginate({
							...borrowingListQuerySchema.parse(query),
							organizationId: erp.organizationId,
						}),
					),
				{
					erp: { permission: ['asset_borrowing:read'] },
					detail: { description: 'Paginated borrowings' },
				},
			)
			.get(
				'/:id',
				async ({ params, erp }) =>
					ok(
						await borrowingService.getById(
							assetIdParamSchema.parse(params).id,
							erp.organizationId,
							await actorFor(erp),
						),
					),
				{
					erp: { permission: ['asset_borrowing:read'] },
					detail: {
						description: 'One borrowing with its lines and event timeline',
					},
				},
			)
			.post(
				'',
				async ({ body, erp }) => {
					const parsed = createBorrowingSchema.parse(body);
					const actor = await actorFor(erp);
					const view = await borrowingService.create(
						{
							branch: parsed.borrowerType,
							purpose: parsed.purpose,
							dueAt: parsed.dueAt,
							borrowerUserId:
								parsed.borrowerType === 'user'
									? parsed.borrowerUserId
									: null,
							borrowerCustomerId:
								parsed.borrowerType === 'customer'
									? parsed.borrowerCustomerId
									: null,
							guestName:
								parsed.borrowerType === 'guest' ? parsed.guestName : null,
							guestPhone:
								parsed.borrowerType === 'guest' ? parsed.guestPhone : null,
							guestIdType:
								parsed.borrowerType === 'guest'
									? (parsed.guestIdType ?? null)
									: null,
							guestIdNumber:
								parsed.borrowerType === 'guest'
									? parsed.guestIdNumber
									: null,
							guestAddressText:
								parsed.borrowerType === 'guest'
									? (parsed.guestAddressText ?? null)
									: null,
							guestIdDocumentRef:
								parsed.borrowerType === 'guest'
									? (parsed.guestIdDocumentRef ?? null)
									: null,
							notes: parsed.notes ?? null,
							toolSetId: parsed.toolSetId ?? null,
							lines: parsed.lines,
						},
						erp.organizationId,
						actor,
						parsed.draft ? 'draft' : 'requested',
					);
					return created(view);
				},
				{
					erp: { permission: ['asset_borrowing:create'] },
					detail: { description: 'Raises a borrowing' },
				},
			)
			.post(
				'/:id/submit',
				async ({ params, erp }) =>
					ok(
						await borrowingService.submit(
							assetIdParamSchema.parse(params).id,
							erp.organizationId,
							await actorFor(erp),
						),
					),
				{
					erp: { permission: ['asset_borrowing:create'] },
					detail: { description: 'Submits a draft borrowing for approval' },
				},
			)
			.post(
				'/:id/approve',
				async ({ params, erp }) =>
					ok(
						await borrowingService.approve(
							assetIdParamSchema.parse(params).id,
							erp.organizationId,
							await actorFor(erp),
						),
					),
				{
					erp: { permission: ['asset_borrowing:approve'] },
					detail: { description: 'Approves a requested borrowing' },
				},
			)
			.post(
				'/:id/reject',
				async ({ params, erp }) =>
					ok(
						await borrowingService.reject(
							assetIdParamSchema.parse(params).id,
							erp.organizationId,
							await actorFor(erp),
						),
					),
				{
					erp: { permission: ['asset_borrowing:approve'] },
					detail: { description: 'Rejects a requested borrowing' },
				},
			)
			.post(
				'/:id/issue',
				async ({ params, erp }) =>
					ok(
						await borrowingService.issue(
							assetIdParamSchema.parse(params).id,
							erp.organizationId,
							await actorFor(erp),
						),
					),
				{
					erp: { permission: ['asset_borrowing:issue'] },
					detail: {
						description:
							'Issues every open line, moving custody out of the warehouse',
					},
				},
			)
			.post(
				'/:id/return',
				async ({ params, body, erp }) => {
					const parsed = returnBorrowingSchema.parse(body);
					return ok(
						await borrowingService.returnLines(
							assetIdParamSchema.parse(params).id,
							erp.organizationId,
							await actorFor(erp),
							{
								lineId: parsed.lineId,
								condition: parsed.condition,
								note: parsed.note ?? null,
							},
						),
					);
				},
				{
					erp: { permission: ['asset_borrowing:return'] },
					detail: { description: 'Returns one line, or every open line' },
				},
			)
			.post(
				'/:id/extend',
				async ({ params, body, erp }) =>
					ok(
						await borrowingService.extend(
							assetIdParamSchema.parse(params).id,
							erp.organizationId,
							await actorFor(erp),
							extendBorrowingSchema.parse(body).dueAt,
						),
					),
				{
					erp: { permission: ['asset_borrowing:extend'] },
					detail: { description: 'Extends the due date' },
				},
			)
			.post(
				'/:id/mark-lost',
				async ({ params, body, erp }) => {
					const parsed = markLostSchema.parse(body);
					return ok(
						await borrowingService.markLost(
							assetIdParamSchema.parse(params).id,
							erp.organizationId,
							await actorFor(erp),
							{ lineId: parsed.lineId, note: parsed.note ?? null },
						),
					);
				},
				{
					erp: { permission: ['asset_borrowing:mark_lost'] },
					detail: {
						description: 'Reports a line lost; the asset is parked as lost',
					},
				},
			)
			.post(
				'/:id/cancel',
				async ({ params, erp }) =>
					ok(
						await borrowingService.cancel(
							assetIdParamSchema.parse(params).id,
							erp.organizationId,
							await actorFor(erp),
						),
					),
				{
					erp: { permission: ['asset_borrowing:create'] },
					detail: { description: 'Cancels a borrowing that was not issued' },
				},
			)
			.post(
				'/:id/close',
				async ({ params, erp }) =>
					ok(
						await borrowingService.close(
							assetIdParamSchema.parse(params).id,
							erp.organizationId,
							await actorFor(erp),
						),
					),
				{
					erp: { permission: ['asset_borrowing:update'] },
					detail: {
						description:
							'Closes a returned borrowing, starting the PII retention clock',
					},
				},
			);
	}
}
