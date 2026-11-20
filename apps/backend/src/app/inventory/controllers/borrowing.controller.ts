import type { ErpContext } from '@authorization/elysia-auth';
import { PERMISSION_RESOLVER_TOKEN } from '@authorization/permission-resolver';
import type { IPermissionResolver } from '@authorization/permission-resolver';
import { domainPlugin } from '@http/plugin';
import { created, ok, okPaginated } from '@http/response';
import { container } from 'tsyringe';
import { BORROWING_REQUEST_SERVICE_TOKEN, BORROWING_SERVICE_TOKEN } from '../constants/di';
import type { TBorrowingActor } from '../contracts/borrowing-view.types';
import {
	borrowingListQuerySchema,
	borrowingRequestListQuerySchema,
	createBorrowingSchema,
	extendBorrowingSchema,
	markLostSchema,
	returnBorrowingSchema,
} from '../contracts/borrowing.contract';
import { idParamSchema } from '../contracts/pagination.contract';

/**
 * Builds the actor context for one request.
 *
 * @remarks
 * The actor flags are computed here, never in the service, so the service takes
 * a plain {@link TBorrowingActor} and never reads a session. Uses the resolver
 * and the dynamic-then-static fallback of `erpGuard`, so a capability computed
 * here cannot disagree with the route's own permission check:
 * - `canApprove`: the self-approval bypass;
 * - `canIssue`: skipping approval is a privilege, not a default;
 * - `canSeeGuestPii`: keyed on `asset_borrowing:mark_lost`, deliberately not a new statement.
 */
function actorResolver(resolver: IPermissionResolver) {
	return async (erp: ErpContext): Promise<TBorrowingActor> => {
		const roles = erp.member.role.split(',').map((role) => role.trim());
		const has = (action: string) =>
			resolver.hasPermission(erp.organizationId, roles, { asset_borrowing: [action] } as never);
		return {
			actorUserId: erp.session.user.id,
			canApprove: await has('approve'),
			canIssue: await has('issue'),
			canSeeGuestPii: await has('mark_lost'),
		};
	};
}

/**
 * REST controller for borrowing requests (`/inventory/borrowing-requests`):
 * raise, submit, approve, reject, cancel, extend and issue.
 *
 * @remarks
 * Permissions per route (`asset_borrowing:*`): `create` raises/submits/cancels,
 * `approve` approves/rejects, `issue` issues, `extend` moves the due date.
 * Tenant scope is always `ctx.erp.organizationId`; a cross-tenant id is a 404.
 */
export class BorrowingRequestController {
	static plugin() {
		const requests = container.resolve(BORROWING_REQUEST_SERVICE_TOKEN);
		const borrowings = container.resolve(BORROWING_SERVICE_TOKEN);
		const actorFor = actorResolver(container.resolve<IPermissionResolver>(PERMISSION_RESOLVER_TOKEN));
		const id = (params: unknown) => idParamSchema.parse(params).id;

		return domainPlugin({
			name: 'inventory-borrowing-requests',
			prefix: '/inventory/borrowing-requests',
			tags: ['Inventory'],
			guards: 'erp',
		})
			.get(
				'',
				async ({ query, erp }) =>
					okPaginated(
						await requests.paginate({
							...borrowingRequestListQuerySchema.parse(query),
							organizationId: erp.organizationId,
						}),
					),
				{
					erp: { permission: ['asset_borrowing:read'] },
					detail: { description: 'Paginated borrowing requests' },
				},
			)
			.get(
				'/:id',
				async ({ params, erp }) =>
					ok(await requests.getById(id(params), erp.organizationId, await actorFor(erp))),
				{
					erp: { permission: ['asset_borrowing:read'] },
					detail: {
						description: 'One request with its items, borrowing (once issued) and both timelines',
					},
				},
			)
			.post(
				'',
				async ({ body, erp }) => {
					const parsed = createBorrowingSchema.parse(body);
					const guest = parsed.borrowerType === 'guest' ? parsed : null;
					const view = await requests.create(
						{
							branch: parsed.borrowerType,
							purpose: parsed.purpose,
							dueAt: parsed.dueAt,
							borrowerUserId: parsed.borrowerType === 'user' ? parsed.borrowerUserId : null,
							borrowerCustomerId:
								parsed.borrowerType === 'customer' ? parsed.borrowerCustomerId : null,
							guestName: guest?.guestName ?? null,
							guestPhone: guest?.guestPhone ?? null,
							guestIdType: guest?.guestIdType ?? null,
							guestIdNumber: guest?.guestIdNumber ?? null,
							guestAddressText: guest?.guestAddressText ?? null,
							guestIdDocumentRef: guest?.guestIdDocumentRef ?? null,
							notes: parsed.notes ?? null,
							toolSetId: parsed.toolSetId ?? null,
							items: parsed.items,
						},
						erp.organizationId,
						await actorFor(erp),
						parsed.draft ? 'draft' : 'requested',
					);
					return created(view);
				},
				{
					erp: { permission: ['asset_borrowing:create'] },
					detail: { description: 'Raises a borrowing request' },
				},
			)
			.post(
				'/:id/submit',
				async ({ params, erp }) =>
					ok(await requests.submit(id(params), erp.organizationId, await actorFor(erp))),
				{
					erp: { permission: ['asset_borrowing:create'] },
					detail: { description: 'Submits a draft request for approval' },
				},
			)
			.post(
				'/:id/approve',
				async ({ params, erp }) =>
					ok(await requests.approve(id(params), erp.organizationId, await actorFor(erp))),
				{
					erp: { permission: ['asset_borrowing:approve'] },
					detail: { description: 'Approves a requested borrowing' },
				},
			)
			.post(
				'/:id/reject',
				async ({ params, erp }) =>
					ok(await requests.reject(id(params), erp.organizationId, await actorFor(erp))),
				{
					erp: { permission: ['asset_borrowing:approve'] },
					detail: { description: 'Rejects a requested borrowing' },
				},
			)
			.post(
				'/:id/cancel',
				async ({ params, erp }) =>
					ok(await requests.cancel(id(params), erp.organizationId, await actorFor(erp))),
				{
					erp: { permission: ['asset_borrowing:create'] },
					detail: { description: 'Cancels a request that was not issued' },
				},
			)
			.post(
				'/:id/extend',
				async ({ params, body, erp }) =>
					ok(
						await requests.extend(
							id(params),
							erp.organizationId,
							await actorFor(erp),
							extendBorrowingSchema.parse(body).dueAt,
						),
					),
				{
					erp: { permission: ['asset_borrowing:extend'] },
					detail: { description: 'Moves the due date of a request that is not issued yet' },
				},
			)
			.post(
				'/:id/issue',
				async ({ params, erp }) =>
					ok(await borrowings.issue(id(params), erp.organizationId, await actorFor(erp))),
				{
					erp: { permission: ['asset_borrowing:issue'] },
					detail: {
						description:
							'Issues the request: creates the borrowing and moves every item out of its warehouse',
					},
				},
			);
	}
}

/**
 * REST controller for borrowings, the issue/return documents
 * (`/inventory/borrowings`): list, read, return, extend, report lost, close.
 */
export class BorrowingController {
	static plugin() {
		const borrowings = container.resolve(BORROWING_SERVICE_TOKEN);
		const actorFor = actorResolver(container.resolve<IPermissionResolver>(PERMISSION_RESOLVER_TOKEN));
		const id = (params: unknown) => idParamSchema.parse(params).id;

		return domainPlugin({
			name: 'inventory-borrowings',
			prefix: '/inventory/borrowings',
			tags: ['Inventory'],
			guards: 'erp',
		})
			.get(
				'',
				async ({ query, erp }) =>
					okPaginated(
						await borrowings.paginate({
							...borrowingListQuerySchema.parse(query),
							organizationId: erp.organizationId,
						}),
					),
				{
					erp: { permission: ['asset_borrowing:read'] },
					detail: { description: 'Paginated borrowings (issue documents)' },
				},
			)
			.get(
				'/:id',
				async ({ params, erp }) =>
					ok(await borrowings.getById(id(params), erp.organizationId, await actorFor(erp))),
				{
					erp: { permission: ['asset_borrowing:read'] },
					detail: { description: 'One borrowing as its request view' },
				},
			)
			.post(
				'/:id/return',
				async ({ params, body, erp }) => {
					const parsed = returnBorrowingSchema.parse(body);
					return ok(
						await borrowings.returnItems(id(params), erp.organizationId, await actorFor(erp), {
							borrowingItemId: parsed.borrowingItemId,
							condition: parsed.condition,
							note: parsed.note ?? null,
						}),
					);
				},
				{
					erp: { permission: ['asset_borrowing:return'] },
					detail: { description: 'Returns one item, or every open item' },
				},
			)
			.post(
				'/:id/extend',
				async ({ params, body, erp }) =>
					ok(
						await borrowings.extend(
							id(params),
							erp.organizationId,
							await actorFor(erp),
							extendBorrowingSchema.parse(body).dueAt,
						),
					),
				{
					erp: { permission: ['asset_borrowing:extend'] },
					detail: { description: 'Extends the due date of an issued borrowing' },
				},
			)
			.post(
				'/:id/mark-lost',
				async ({ params, body, erp }) => {
					const parsed = markLostSchema.parse(body);
					return ok(
						await borrowings.markLost(id(params), erp.organizationId, await actorFor(erp), {
							borrowingItemId: parsed.borrowingItemId,
							note: parsed.note ?? null,
						}),
					);
				},
				{
					erp: { permission: ['asset_borrowing:mark_lost'] },
					detail: { description: 'Reports an item lost; the unit is parked as lost' },
				},
			)
			.post(
				'/:id/close',
				async ({ params, erp }) =>
					ok(await borrowings.close(id(params), erp.organizationId, await actorFor(erp))),
				{
					erp: { permission: ['asset_borrowing:update'] },
					detail: { description: 'Closes a returned borrowing, starting the PII retention clock' },
				},
			);
	}
}
