import { container } from 'tsyringe';
import type { ErpContext } from '@authorization/elysia-auth';
import { GLOBAL_ADMIN_ROLE, hasAppRole } from '@providers/better-auth/ac/admin-ac';
import { PERMISSION_RESOLVER_TOKEN } from '@authorization/permission-resolver';
import type { IPermissionResolver } from '@authorization/permission-resolver';
import { domainPlugin } from '@http/plugin';
import { created, ok, okPaginated } from '@http/response';
import {
	adjustmentListQuerySchema,
	createAdjustmentSchema,
	setAdjustmentLinesSchema,
} from '../contracts/adjustment.contract';
import { idParamSchema } from '../contracts/item.contract';
import { ADJUSTMENT_SERVICE_TOKEN, STOCK_SERVICE_TOKEN } from '../constants/di';
import type {
	AdjustmentService,
	TAdjustmentActor,
	TAdjustmentDetail,
} from '../services/adjustment.service';
import type { StockService } from '../services/stock.service';

/**
 * REST controller for the stock adjustment document workflow.
 *
 * @remarks
 * **Authorization** is declared per route: `stock_adjustment:create` to raise,
 * `stock_adjustment:approve` to approve or reject, and the state handlers
 * (submit/cancel/post) ride the same write permission as creation. The
 * **self-approval bypass** is computed here, not in the service: the service
 * receives a plain {@link TAdjustmentActor} flag so it never reads a session.
 *
 * **Tenant scope** is always `ctx.erp.organizationId`. An adjustment is raised
 * by a tenant even when it targets a global warehouse — the document belongs to
 * the tenant, the stock does not.
 */
export class AdjustmentController {
	/**
	 * Builds the Elysia plugin mounting `/stock/adjustments`.
	 *
	 * @returns An Elysia instance with the guard and error mapping applied
	 */
	static plugin() {
		const adjustmentService = container.resolve<AdjustmentService>(
			ADJUSTMENT_SERVICE_TOKEN,
		);
		// ERP-0031: link check for the create route. Same module, so reusing the
		// stock service's assert avoids teaching AdjustmentService the rule.
		const stockServiceForLinks = container.resolve<StockService>(
			STOCK_SERVICE_TOKEN,
		);
		const resolver = container.resolve<IPermissionResolver>(
			PERMISSION_RESOLVER_TOKEN,
		);

		/**
		 * Builds the actor context for a transition.
		 *
		 * @param erp - The guard-resolved context
		 * @remarks
		 * `canSelfApprove` mirrors exactly what `erpGuard` would decide for
		 * `stock_adjustment:approve`, using the same resolver and the same
		 * dynamic-then-static fallback. It is a **bypass**, not a second rule:
		 * someone who can approve other people's adjustments can also approve
		 * their own.
		 */
		const actorFor = async (erp: ErpContext): Promise<TAdjustmentActor> => ({
			actorUserId: erp.session.user.id,
			canSelfApprove: await resolver.hasPermission(
				erp.organizationId,
				erp.member.role.split(',').map((role) => role.trim()),
				{ stock_adjustment: ['approve'] },
			),
		});

		/** Line costs (opening stock) are for `product:read_cost` holders only. */
		const canSeeCost = (erp: ErpContext) =>
			resolver.hasPermission(
				erp.organizationId,
				erp.member.role.split(',').map((role) => role.trim()),
				{ product: ['read_cost'] },
			);
		const present = async (erp: ErpContext, detail: TAdjustmentDetail) =>
			(await canSeeCost(erp))
				? detail
				: { ...detail, lines: detail.lines.map((line) => ({ ...line, unitCost: null })) };
		const withoutCostInput = async <T extends { lines: { unitCost?: number | null }[] }>(
			erp: ErpContext,
			body: T,
		): Promise<T> =>
			(await canSeeCost(erp))
				? body
				: { ...body, lines: body.lines.map((line) => ({ ...line, unitCost: null })) };
		/** Full audit actor from the session + request headers. */
		const auditActor = (erp: ErpContext, request: Request) => ({
			userId: erp.session.user.id,
			email: erp.session.user.email,
			ip: request.headers.get('x-forwarded-for'),
			userAgent: request.headers.get('user-agent'),
		});

		return domainPlugin({
			name: 'inventory-adjustments',
			prefix: '/stock/adjustments',
			tags: ['Inventory'],
			guards: 'erp',
		})
			.get(
				'',
				async ({ query, erp }) =>
					okPaginated(
						await adjustmentService.paginate({
							...adjustmentListQuerySchema.parse(query),
							organizationId: erp.organizationId,
						}),
					),
				{
					erp: { permission: ['stock_adjustment:read'] },
					detail: { description: 'Paginated stock adjustments' },
				},
			)
			.get(
				'/:id',
				async ({ params, erp }) =>
					ok(
						await present(
							erp,
							await adjustmentService.findDetail(
								idParamSchema.parse(params).id,
								erp.organizationId,
							),
						),
					),
				{
					erp: { permission: ['stock_adjustment:read'] },
					detail: { description: 'One stock adjustment with its lines' },
				},
			)
			.post(
				'',
				async ({ body, erp, status }) => {
					const parsed = await withoutCostInput(erp, createAdjustmentSchema.parse(body));
					// ERP-0031: the target warehouse must be linked to the caller's
					// organization. A global admin bypasses; unlinked is a 404 so
					// warehouse ids cannot be probed.
					if (!hasAppRole(erp.session.user.role, GLOBAL_ADMIN_ROLE)) {
						await stockServiceForLinks.assertWarehouseLinkedFor(
							parsed.warehouseId,
							erp.organizationId,
						);
					}
					const detail = await adjustmentService.create(
						erp.organizationId,
						parsed,
						await actorFor(erp),
					);
					return status(201, created(await present(erp, detail)));
				},
				{
					erp: { permission: ['stock_adjustment:create'] },
					detail: { description: 'Raises a stock adjustment in draft' },
				},
			)
			.put(
				'/:id/lines',
				async ({ params, body, erp }) =>
					ok(
						await present(
							erp,
							await adjustmentService.setLines(
								idParamSchema.parse(params).id,
								erp.organizationId,
								(await withoutCostInput(erp, setAdjustmentLinesSchema.parse(body))).lines,
							),
						),
					),
				{
					erp: { permission: ['stock_adjustment:create'] },
					detail: {
						description: 'Replaces the lines of a draft adjustment',
					},
				},
			)
			.post(
				'/:id/submit',
				async ({ params, erp, request }) =>
					ok(
						await adjustmentService.submit(
							idParamSchema.parse(params).id,
							erp.organizationId,
							auditActor(erp, request),
						),
					),
				{
					erp: { permission: ['stock_adjustment:create'] },
					detail: { description: 'Submits a draft for approval' },
				},
			)
			.post(
				'/:id/approve',
				async ({ params, erp }) =>
					ok(
						await adjustmentService.approve(
							idParamSchema.parse(params).id,
							erp.organizationId,
							await actorFor(erp),
						),
					),
				{
					erp: { permission: ['stock_adjustment:approve'] },
					detail: {
						description:
							'Approves a submitted adjustment. Self-approval needs stock_adjustment:approve',
					},
				},
			)
			.post(
				'/:id/reject',
				async ({ params, erp, request }) =>
					ok(
						await adjustmentService.reject(
							idParamSchema.parse(params).id,
							erp.organizationId,
							auditActor(erp, request),
						),
					),
				{
					erp: { permission: ['stock_adjustment:approve'] },
					detail: { description: 'Rejects a submitted adjustment' },
				},
			)
			.post(
				'/:id/cancel',
				async ({ params, erp, request }) =>
					ok(
						await adjustmentService.cancel(
							idParamSchema.parse(params).id,
							erp.organizationId,
							auditActor(erp, request),
						),
					),
				{
					erp: { permission: ['stock_adjustment:create'] },
					detail: {
						description: 'Cancels a draft or submitted adjustment',
					},
				},
			)
			.post(
				'/:id/post',
				async ({ params, erp }) =>
					ok(
						await present(
							erp,
							await adjustmentService.post(
								idParamSchema.parse(params).id,
								erp.organizationId,
								await actorFor(erp),
							),
						),
					),
				{
					erp: { permission: ['stock_adjustment:post'] },
					detail: {
						description:
							'Posts an approved adjustment, writing one movement per changed line',
					},
				},
			);
	}
}
