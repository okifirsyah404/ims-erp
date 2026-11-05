import { z } from 'zod';

/**
 * Request schemas for the borrowing workflow.
 *
 * @remarks
 * The body never carries `organizationId`, `status`, `code`, or any of the
 * `requested_by` / `approved_by` / `issued_by` actor columns: all are decided by
 * the service from the guard-resolved context, because a client that could set
 * them could approve its own borrowing or issue its own assets.
 *
 * The three borrower paths are modelled as a **discriminated union on
 * `borrowerType`**, so an inconsistent body (a guest with a `borrowerUserId`)
 * is rejected at the edge with a 400 rather than reaching the service's
 * identity check, which exists for defence in depth.
 */

/** The borrower paths, matching `assets.borrowings.borrower_type`. */
export const BORROWER_TYPES = ['user', 'customer', 'guest'] as const;

/** The borrowing purposes (D8). */
export const BORROWING_PURPOSES = [
	'rental',
	'internal_use',
	'testing',
	'warranty_service',
] as const;

/** The condition an asset comes back in. */
export const RETURN_CONDITIONS = ['good', 'damaged', 'incomplete'] as const;

/** Guest identity document kinds. */
export const GUEST_ID_TYPES = ['ktp', 'sim', 'passport', 'other'] as const;

/** One requested asset. */
export const borrowingLineSchema = z.object({
	/** The physical asset. Borrowing is serialized-only (D1). */
	assetId: z.string().uuid(),
	/** Per-line due date; defaults to the header's. */
	dueAt: z.coerce.date().nullable().optional(),
	siteAddressText: z.string().max(1000).nullable().optional(),
	projectId: z.string().uuid().nullable().optional(),
	notes: z.string().max(1000).nullable().optional(),
});

/**
 * A registered-user borrower.
 *
 * @remarks
 * `borrowerUserId` is required: the user must exist in `auth.users`, but that
 * reference is logical (no cross-module FK), so the service cannot verify
 * existence today and records what the client asserts.
 */
export const userBorrowerSchema = z.object({
	borrowerType: z.literal('user'),
	borrowerUserId: z.string().min(1),
});

/** A registered-customer borrower (`crm.customers.id`, logical ref). */
export const customerBorrowerSchema = z.object({
	borrowerType: z.literal('customer'),
	borrowerCustomerId: z.uuid(),
});

/**
 * A guest borrower.
 *
 * @remarks
 * Name, phone, and ID number are all required — the schema CHECK enforces the
 * same triple, and the field values are KTP-class personal data subject to the
 * retention sweep (§11).
 */
export const guestBorrowerSchema = z.object({
	borrowerType: z.literal('guest'),
	guestName: z.string().min(1).max(200),
	guestPhone: z.string().min(1).max(40),
	guestIdType: z.enum(GUEST_ID_TYPES).nullable().optional(),
	guestIdNumber: z.string().min(1).max(64),
	guestAddressText: z.string().max(1000).nullable().optional(),
	guestIdDocumentRef: z.string().max(500).nullable().optional(),
});

/** Creates a borrowing. Header fields plus one or more lines. */
export const createBorrowingSchema = z
	.object({
		purpose: z.enum(BORROWING_PURPOSES).default('internal_use'),
		dueAt: z.coerce.date(),
		notes: z.string().max(2000).nullable().optional(),
		/**
		 * Lend a whole tool set (D6): the service expands it to one line per
		 * member asset and marks the set `lent`. `lines` may be empty then.
		 */
		toolSetId: z.string().uuid().nullable().optional(),
		/** Start as a draft instead of raising it immediately. */
		draft: z.boolean().optional(),
		lines: z.array(borrowingLineSchema).default([]),
	})
	.and(
		z.discriminatedUnion('borrowerType', [
			userBorrowerSchema,
			customerBorrowerSchema,
			guestBorrowerSchema,
		]),
	);

/** Filters for the borrowing list. */
export const borrowingListQuerySchema = z.object({
	page: z.coerce.number().int().min(1).default(1),
	limit: z.coerce.number().int().min(1).max(100).default(20),
	status: z
		.enum([
			'draft',
			'requested',
			'approved',
			'rejected',
			'issued',
			'partially_returned',
			'returned',
			'closed',
			'cancelled',
		])
		.optional(),
	borrowerType: z.enum(BORROWER_TYPES).optional(),
	search: z.string().min(1).optional(),
});

/** Body for a return: one line or all, always with a condition. */
export const returnBorrowingSchema = z.object({
	/** Omit to return every open line. */
	lineId: z.uuid().optional(),
	condition: z.enum(RETURN_CONDITIONS),
	note: z.string().max(1000).nullable().optional(),
});

/** Body for reporting a line lost. */
export const markLostSchema = z.object({
	lineId: z.uuid(),
	note: z.string().max(1000).nullable().optional(),
});

/** Body for extending the due date. */
export const extendBorrowingSchema = z.object({
	dueAt: z.coerce.date(),
});
