import { container } from 'tsyringe';
import type { ErpContext } from '@authorization/elysia-auth';
import { GLOBAL_ADMIN_ROLE, hasAppRole } from '@providers/better-auth/ac/admin-ac';
import { domainPlugin } from '@http/plugin';
import { created, ok, okPaginated } from '@http/response';
import {
	balanceListQuerySchema,
	issueSchema,
	movementListQuerySchema,
	receiptSchema,
	recomputeSchema,
} from '../contracts/stock.contract';
import { idParamSchema } from '../contracts/item.contract';
import { STOCK_SERVICE_TOKEN } from '../constants/di';
import type { StockService } from '../services/stock.service';
import {
	type IPermissionResolver,
	PERMISSION_RESOLVER_TOKEN,
} from '@authorization/permission-resolver';

/** Cost columns (ADR-0011 §5) are restricted to `product:read_cost`. */
const COST_FIELDS = ['unitCost', 'averageCost', 'totalValue'] as const;

function hideCost<T extends object>(row: T): T {
	const copy = { ...row } as Record<string, unknown>;
	for (const field of COST_FIELDS) delete copy[field];
	return copy as T;
}

/**
 * REST controller for the stock ledger, balances, receipts, and issues.
 *
 * @remarks
 * **Authorization** is declared per route through the `erp` macro on
 * `stock:*` permissions and enforced by `erpGuard` before the handler runs.
 *
 * **Scope.** Every read handler narrows to the caller with
 * {@link resolveReadScope}: a tenant caller cannot widen its scope through the
 * query string, it can only narrow within it. The one legitimate cross-tenant
 * read is an application admin asking for `scope=global`, which selects the
 * shared balance rows — those *are* visible to everyone by design.
 *
 * Writes take no organization from the body at all: the acting organization is
 * `ctx.erp.organizationId`, and which balance moves is decided by the warehouse
 * (see the scope rule on `StockService`).
 */
export class StockController {
	/**
	 * Builds the Elysia plugin mounting `/stock`.
	 *
	 * @returns An Elysia instance with the guard and error mapping applied
	 */
	static plugin() {
		const stockService = container.resolve<StockService>(STOCK_SERVICE_TOKEN);
		const permissions = container.resolve<IPermissionResolver>(PERMISSION_RESOLVER_TOKEN);
		const canSeeCost = (erp: ErpContext) =>
			permissions.hasPermission(erp.organizationId, erp.member.role.split(',').map((role) => role.trim()), {
				product: ['read_cost'],
			});
		const page = async <T extends object>(erp: ErpContext, result: { meta: unknown; data: T[] }) =>
			(await canSeeCost(erp)) ? result : { ...result, data: result.data.map(hideCost) };
		const posted_ = async <T extends { movement: object; balance: object }>(erp: ErpContext, result: T): Promise<T> =>
			(await canSeeCost(erp)) ? result : { ...result, movement: hideCost(result.movement), balance: hideCost(result.balance) };

		return domainPlugin({
			name: 'inventory-stock',
			prefix: '/stock',
			tags: ['Inventory'],
			guards: 'erp',
		})
			.get(
				'/balances',
				async ({ query, erp }) => {
					const parsed = balanceListQuerySchema.parse(query);
					return okPaginated(
						await page(
							erp,
							await stockService.paginateBalances({
								...parsed,
								scopeOrganizationId: resolveReadScope(
									parsed.scopeOrganizationId,
									erp,
								),
							}),
						) as never,
					);
				},
				{
					erp: { permission: ['stock:read'] },
					detail: { description: 'Paginated stock balances' },
				},
			)
			.get(
				'/movements',
				async ({ query, erp }) => {
					const parsed = movementListQuerySchema.parse(query);
					return okPaginated(
						await page(
							erp,
							await stockService.paginateMovements({
								...parsed,
								scopeOrganizationId: resolveReadScope(
									parsed.scopeOrganizationId,
									erp,
								),
							}),
						) as never,
					);
				},
				{
					erp: { permission: ['stock:read'] },
					detail: { description: 'Paginated stock movement ledger' },
				},
			)
			.post(
				'/receipts',
				async ({ body, erp, status }) => {
					const parsed = receiptSchema.parse(body);
					await assertWarehouseAccessible(stockService, parsed.warehouseId, erp);
					const result = await stockService.postMovement({
						actorOrganizationId: erp.organizationId,
						warehouseId: parsed.warehouseId,
						binId: parsed.binId ?? null,
						itemId: parsed.itemId,
						movementType: 'receipt',
						quantity: parsed.quantity,
						occurredAt: parsed.occurredAt
							? new Date(parsed.occurredAt)
							: undefined,
						referenceType: parsed.referenceType ?? null,
						referenceId: parsed.referenceId ?? null,
						createdBy: erp.session.user.id,
						notes: parsed.notes ?? null,
					});
					return status(201, created(await posted_(erp, result)));
				},
				{
					erp: { permission: ['stock:receive'] },
					detail: { description: 'Receives stock into a warehouse' },
				},
			)
			.post(
				'/issues',
				async ({ body, erp, status }) => {
					const parsed = issueSchema.parse(body);
					await assertWarehouseAccessible(stockService, parsed.warehouseId, erp);
					const result = await stockService.postMovement({
						actorOrganizationId: erp.organizationId,
						warehouseId: parsed.warehouseId,
						binId: parsed.binId ?? null,
						itemId: parsed.itemId,
						movementType: 'issue',
						quantity: parsed.quantity,
						occurredAt: parsed.occurredAt
							? new Date(parsed.occurredAt)
							: undefined,
						referenceType: parsed.referenceType ?? null,
						referenceId: parsed.referenceId ?? null,
						createdBy: erp.session.user.id,
						notes: parsed.notes ?? null,
					});
					return status(201, created(await posted_(erp, result)));
				},
				{
					erp: { permission: ['stock:issue'] },
					detail: {
						description:
							'Issues stock out of a warehouse. Refused if it would go negative',
					},
				},
			)
			.post(
				'/movements/:id/reverse',
				async ({ params, erp }) => {
					const posted = await stockService.reverseMovement(
						idParamSchema.parse(params).id,
						erp.organizationId,
						erp.session.user.id,
					);
					return ok(posted);
				},
				{
					erp: { permission: ['stock_adjustment:post'] },
					detail: {
						description:
							'Reverses a posted movement by appending an opposing row. One-shot',
					},
				},
			)
			.post(
				'/balances/recompute',
				async ({ body, erp }) => {
					const parsed = recomputeSchema.parse(body);
					return ok(
						await stockService.recomputeFromLedger(
							resolveRecomputeScope(parsed.scope, erp),
						),
					);
				},
				{
					erp: { permission: ['stock_adjustment:post'] },
					detail: {
						description:
							'Rebuilds balances from the ledger for one scope (repair operation)',
					},
				},
			);
	}
}

/**
 * Narrows a requested read scope to what the caller may actually see.
 *
 * @param requested - `undefined` = every scope, `null` = shared rows only
 * @param erp - The guard-resolved context
 * @returns The scope to hand the repository, or `undefined` for "no filter"
 * @remarks
 * A tenant caller is pinned to its own organization: asking for another
 * tenant's id yields its own scope rather than an error, because a scope query
 * string is a **filter**, not an authorization decision, and the guard has
 * already established the caller's membership. Only an application admin
 * (no organization membership role `admin`) may read across tenants or ask for
 * the unrestricted view.
 */
function resolveReadScope(
	requested: string | null | undefined,
	erp: ErpContext,
): string | null | undefined {
	if (isApplicationAdmin(erp)) return requested;
	// Shared (global) rows are readable by everyone: a global warehouse is one
	// shared physical space, so its balances are not tenant data.
	if (requested === null) return null;
	return erp.organizationId;
}

/**
 * Resolves the scope a recompute should rebuild.
 *
 * @param requested - `'global'`, a tenant id, or absent
 * @param erp - The guard-resolved context
 * @remarks
 * Unlike a read filter, rebuilding the wrong scope *writes*, so a tenant caller
 * is pinned without a fallback-to-own-scope shortcut and an admin must name a
 * scope explicitly.
 */
function resolveRecomputeScope(
	requested: string | undefined,
	erp: ErpContext,
): string | null {
	if (requested === undefined) return erp.organizationId;
	if (requested === 'global') return null;
	if (isApplicationAdmin(erp)) return requested;
	// A tenant may only recompute its own scope, or the shared one (which it
	// writes to like anyone else). Silently pinning rather than erroring keeps
	// a stale UI's scope value from turning a repair into a 403.
	return erp.organizationId;
}

/**
 * Whether the caller is an application administrator.
 *
 * @param erp - The guard-resolved context
 */
function isApplicationAdmin(erp: ErpContext): boolean {
	return hasAppRole(erp.session.user.role, GLOBAL_ADMIN_ROLE);
}

/**
 * ERP-0031 gate for actor-driven stock writes: the caller's organization must
 * be linked to the named warehouse. A global admin bypasses (manages every
 * scope); everyone else gets a 404 for unlinked warehouses so ids cannot be
 * probed.
 */
async function assertWarehouseAccessible(
	stockService: StockService,
	warehouseId: string,
	erp: ErpContext,
): Promise<void> {
	if (isApplicationAdmin(erp)) return;
	await stockService.assertWarehouseLinkedFor(warehouseId, erp.organizationId);
}
