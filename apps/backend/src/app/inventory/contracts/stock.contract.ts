import { z } from 'zod';
import { MOVEMENT_TYPES } from '@drizzle/schemas/inventory.schema';
import { inventoryPaginationSchema } from './pagination.contract';
import { booleanQuerySchema } from './pagination.contract';

/**
 * Request schemas for the stock ledger, balances, and receipts/issues.
 *
 * @remarks
 * Parsed at the controller boundary. **Nothing here accepts an
 * `organizationId`**: the ledger's tenant is the caller's, resolved by
 * `erpGuard` and passed by the controller from `ctx.erp`. A body field would
 * be a client-supplied authorization claim.
 */

/**
 * A positive quantity, serialized to the column's `numeric(18,3)` scale.
 *
 * @remarks
 * `.positive()` is the important half: movements carry an unsigned quantity and
 * derive direction from their type, so a negative number here would be an
 * attempt to smuggle direction past {@link isOutbound}.
 */
export const quantitySchema = z.coerce
	.number()
	.positive()
	.transform((value) => value.toFixed(3));

/**
 * Tri-state scope filter shared by the ledger and balance lists.
 *
 * @remarks
 * A query string cannot express JSON `null`, so the literal `'global'` selects
 * the shared rows (`organization_id IS NULL`). Any other value is an exact
 * organization id, and is only honoured for an application admin — a tenant
 * caller is pinned to its own scope in the controller.
 */
const scopeQuerySchema = z
	.union([z.literal('global'), z.string().min(1)])
	.optional();

/**
 * Optional ISO-8601 timestamp bound.
 *
 * @remarks
 * `bigint` timestamps are compared as `Date`s, so the string is converted here
 * rather than in the repository.
 */
const dateQuerySchema = z.iso.datetime({ offset: true }).optional();

/** List filter for the movement ledger. */
export const movementListQuerySchema = inventoryPaginationSchema
	.extend({
		scope: scopeQuerySchema,
		warehouseId: z.uuid().optional(),
		productId: z.uuid().optional(),
		movementType: z.enum(MOVEMENT_TYPES).optional(),
		status: z.enum(['draft', 'posted', 'reversed']).optional(),
		occurredFrom: dateQuerySchema,
		occurredTo: dateQuerySchema,
		referenceType: z.string().min(1).optional(),
	})
	.transform((query) => ({
		...query,
		/**
		 * Normalizes the tri-state scope for the repository.
		 *
		 * @remarks
		 * `'global'` becomes `null`, an absent value stays `undefined` (all
		 * scopes). Keeping the wire format a string means `GET` and `POST` agree
		 * on what a scope is.
		 */
		scopeOrganizationId:
			query.scope === undefined
				? undefined
				: query.scope === 'global'
					? null
					: query.scope,
		occurredFrom: query.occurredFrom
			? new Date(query.occurredFrom)
			: undefined,
		occurredTo: query.occurredTo ? new Date(query.occurredTo) : undefined,
	}));

/** List filter for balances. */
export const balanceListQuerySchema = inventoryPaginationSchema
	.extend({
		scope: scopeQuerySchema,
		warehouseId: z.uuid().optional(),
		productId: z.uuid().optional(),
		binId: z.uuid().optional(),
		inStockOnly: booleanQuerySchema.optional(),
	})
	.transform((query) => ({
		...query,
		scopeOrganizationId:
			query.scope === undefined
				? undefined
				: query.scope === 'global'
					? null
					: query.scope,
	}));

/**
 * Body for a receipt (stock entering a warehouse).
 *
 * @remarks
 * A receipt deliberately has **no** `organizationId` and no derived scope: the
 * warehouse decides which balance is affected (see the scope rule on
 * `StockService`), so posting into a global warehouse by any tenant updates the
 * one shared balance.
 */
export const receiptSchema = z.object({
	warehouseId: z.uuid(),
	binId: z.uuid().nullable().optional(),
	productId: z.uuid(),
	quantity: quantitySchema,
	occurredAt: z.iso.datetime({ offset: true }).optional(),
	referenceType: z.string().max(64).nullable().optional(),
	referenceId: z.string().max(64).nullable().optional(),
	notes: z.string().max(2000).nullable().optional(),
	/**
	 * B-29: the project the stock is for (logical reference to
	 * project.projects.id). Recorded as `reference_type = 'project'`; a posted
	 * issue counts as the project's material cost.
	 */
	projectId: z.uuid().nullable().optional(),
	/**
	 * B-29: one serial number per unit for a serialized product (the quantity
	 * must then be a whole number equal to the count). An issue takes
	 * `in_stock` units of this warehouse out; a receipt brings `issued` units
	 * back or registers new ones.
	 */
	serialNumbers: z.array(z.string().trim().min(1).max(100)).max(500).optional(),
});

/** Body for an issue (stock leaving a warehouse). */
export const issueSchema = receiptSchema;

/** Body for the balance recompute repair operation. */
export const recomputeSchema = z.object({
	/**
	 * Which balance scope to rebuild.
	 *
	 * @remarks
	 * `'global'` rebuilds the shared scope; a uuid rebuilds one tenant's. Absent
	 * means "the caller's organization", which the controller supplies — an
	 * application admin must be explicit so a typo cannot rebuild everything.
	 */
	scope: z.union([z.literal('global'), z.uuid()]).optional(),
});

/** Request types inferred from the schemas above. */
export type TReceiptRequest = z.infer<typeof receiptSchema>;
export type TIssueRequest = z.infer<typeof issueSchema>;
export type TRecomputeRequest = z.infer<typeof recomputeSchema>;
export type TMovementListQuery = z.infer<typeof movementListQuerySchema>;
export type TBalanceListQuery = z.infer<typeof balanceListQuerySchema>;
