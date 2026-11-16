/**
 * Document module schema — owns the `document` Postgres schema.
 *
 * @remarks
 * Registry + issuance (ERP-0042): the business documents stay in their
 * owning module's tables (`sales.quotations`, `accounting.sales_invoices`,
 * …); this module owns the issued copy, its files and signatures. File bytes
 * live in object storage — this module owns the metadata and the access
 * rules. A document is never hard deleted, a new version supersedes the old.
 *
 * `organization_id` is nullable: `NULL` means company-wide, the same scope
 * carve-out as Inventory and Assets (ADR-0011). Uniqueness is enforced by
 * partial indexes, because PostgreSQL treats NULLs as distinct.
 */
import {
	unixTimestamp,
	unixTimestampNullable,
} from '@drizzle/datatypes/unix-timestamp';
import { sql } from 'drizzle-orm';
import {
	bigint,
	boolean,
	check,
	date,
	index,
	integer,
	pgSchema,
	text,
	uniqueIndex,
	uuid,
	varchar,
} from 'drizzle-orm/pg-core';

export const documentSchema = pgSchema('document');

/** Lifecycle of an issued document. */
export const DOCUMENT_STATUSES = [
	'draft',
	'submitted',
	'approved',
	'issued',
	'void',
	'expired',
	'archived',
] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

export const DOCUMENT_SIGNER_TYPES = [
	'internal',
	'customer',
	'partner',
] as const;
export type DocumentSignerType = (typeof DOCUMENT_SIGNER_TYPES)[number];

export const DOCUMENT_SIGNATURE_METHODS = [
	'electronic',
	'wet_ink',
	'stamp',
] as const;
export type DocumentSignatureMethod =
	(typeof DOCUMENT_SIGNATURE_METHODS)[number];

/** Lifecycle of a signature request (ERP-0048). */
export const SIGNATURE_REQUEST_STATUSES = [
	'pending',
	'signed',
	'declined',
	'expired',
	'cancelled',
] as const;
export type SignatureRequestStatus =
	(typeof SIGNATURE_REQUEST_STATUSES)[number];

export const DOCUMENT_ACCESS_ACTIONS = [
	'view',
	'download',
	'print',
	'share',
	'delete',
] as const;
export type DocumentAccessAction = (typeof DOCUMENT_ACCESS_ACTIONS)[number];

export const DOCUMENT_SHARE_TYPES = [
	'internal',
	'customer',
	'portal',
	'public_link',
] as const;
export type DocumentShareType = (typeof DOCUMENT_SHARE_TYPES)[number];

/** Shared soft-delete + audit columns. */
const timestamps = {
	createdAt: unixTimestamp('created_at').notNull(),
	updatedAt: unixTimestamp('updated_at')
		.notNull()
		.$onUpdate(() => new Date()),
	deletedAt: unixTimestampNullable('deleted_at'),
};

/* ------------------------------------------------------------------------ *
 * document.templates
 * ------------------------------------------------------------------------ */

/**
 * Reusable document template. A new version is a new row, an issued document
 * keeps pointing at the version it used.
 *
 * @remarks
 * `numbering_pattern` is display-only; the numbering authority is
 * `code_number.series`.
 */
export const documentTemplates = documentSchema.table(
	'templates',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		/** Logical reference to auth.organizations.id; NULL = company-wide. */
		organizationId: text('organization_id'),
		code: varchar('code', { length: 32 }).notNull(),
		name: text('name').notNull(),
		documentType: text('document_type').notNull(),
		module: text('module'),
		version: integer('version').notNull().default(1),
		contentTemplate: text('content_template'),
		numberingPattern: text('numbering_pattern'),
		isActive: boolean('is_active').notNull().default(true),
		...timestamps,
	},
	(table) => [
		uniqueIndex('templates_org_code_version_uq')
			.on(table.organizationId, table.code, table.version)
			.where(sql`deleted_at IS NULL AND organization_id IS NOT NULL`),
		uniqueIndex('templates_global_code_version_uq')
			.on(table.code, table.version)
			.where(sql`deleted_at IS NULL AND organization_id IS NULL`),
		check('templates_version_check', sql`${table.version} > 0`),
	],
);

/* ------------------------------------------------------------------------ *
 * document.documents
 * ------------------------------------------------------------------------ */

/** Document master (registry + issuance). */
export const documents = documentSchema.table(
	'documents',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		/** Logical reference to auth.organizations.id; NULL = company-wide. */
		organizationId: text('organization_id'),
		code: varchar('code', { length: 32 }).notNull(),
		documentType: text('document_type').notNull(),
		title: text('title').notNull(),
		templateId: uuid('template_id'),
		module: text('module'),
		sourceType: text('source_type'),
		sourceId: text('source_id'),
		status: text('status').notNull().default('draft'),
		issuedOn: date('issued_on'),
		/** Logical reference to auth.users.id — cross-module FK omitted. */
		issuedByUserId: text('issued_by_user_id'),
		/** Logical reference to auth.users.id — cross-module FK omitted. */
		approvedByUserId: text('approved_by_user_id'),
		approvedAt: unixTimestampNullable('approved_at'),
		version: integer('version').notNull().default(1),
		isCurrent: boolean('is_current').notNull().default(true),
		supersedesDocumentId: uuid('supersedes_document_id'),
		...timestamps,
	},
	(table) => [
		uniqueIndex('documents_org_code_uq')
			.on(table.organizationId, table.code)
			.where(sql`deleted_at IS NULL AND organization_id IS NOT NULL`),
		uniqueIndex('documents_global_code_uq')
			.on(table.code)
			.where(sql`deleted_at IS NULL AND organization_id IS NULL`),
		index('documents_template_id_idx').on(table.templateId),
		index('documents_source_idx').on(
			table.module,
			table.sourceType,
			table.sourceId,
		),
		index('documents_status_idx').on(table.status),
		check(
			'documents_status_check',
			sql`${table.status} IN ('draft', 'submitted', 'approved', 'issued', 'void', 'expired', 'archived')`,
		),
		check('documents_version_check', sql`${table.version} > 0`),
	],
);

/* ------------------------------------------------------------------------ *
 * document.files
 * ------------------------------------------------------------------------ */

/** Binary attachment of a document. The storage key never contains a public URL. */
export const documentFiles = documentSchema.table(
	'files',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		/** Logical reference to auth.organizations.id; NULL = company-wide. */
		organizationId: text('organization_id'),
		documentId: uuid('document_id').notNull(),
		fileName: text('file_name').notNull(),
		storageKey: text('storage_key').notNull(),
		mimeType: text('mime_type'),
		sizeBytes: bigint('size_bytes', { mode: 'number' })
			.notNull()
			.default(0),
		checksum: text('checksum'),
		/** Logical reference to auth.users.id — cross-module FK omitted. */
		uploadedByUserId: text('uploaded_by_user_id'),
		uploadedAt: unixTimestamp('uploaded_at').notNull(),
		...timestamps,
	},
	(table) => [
		index('files_document_id_idx').on(table.documentId),
		uniqueIndex('files_storage_key_uq').on(table.storageKey),
		check('files_size_bytes_check', sql`${table.sizeBytes} >= 0`),
	],
);

/* ------------------------------------------------------------------------ *
 * document.signatures
 * ------------------------------------------------------------------------ */

/** Signature evidence of a document. */
export const documentSignatures = documentSchema.table(
	'signatures',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		/** Logical reference to auth.organizations.id; NULL = company-wide. */
		organizationId: text('organization_id'),
		documentId: uuid('document_id').notNull(),
		signerType: text('signer_type').notNull(),
		/** Logical reference to auth.users.id — cross-module FK omitted. */
		signerUserId: text('signer_user_id'),
		signerName: text('signer_name').notNull(),
		signedAt: unixTimestamp('signed_at').notNull(),
		signatureMethod: text('signature_method').notNull().default('electronic'),
		ipAddress: text('ip_address'),
		certificateSerial: text('certificate_serial'),
		...timestamps,
	},
	(table) => [
		index('signatures_document_id_idx').on(table.documentId),
		check(
			'signatures_signer_type_check',
			sql`${table.signerType} IN ('internal', 'customer', 'partner')`,
		),
		check(
			'signatures_signature_method_check',
			sql`${table.signatureMethod} IN ('electronic', 'wet_ink', 'stamp')`,
		),
	],
);

/* ------------------------------------------------------------------------ *
 * document.access_logs
 * ------------------------------------------------------------------------ */

/**
 * Access trail of a document.
 *
 * @remarks
 * Append-only: the audit reads are never cached and never skipped, so the row
 * is written on every access and never edited.
 */
export const documentAccessLogs = documentSchema.table(
	'access_logs',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		/** Logical reference to auth.organizations.id; NULL = company-wide. */
		organizationId: text('organization_id'),
		documentId: uuid('document_id').notNull(),
		/** Logical reference to auth.users.id — cross-module FK omitted. */
		accessedByUserId: text('accessed_by_user_id'),
		action: text('action').notNull(),
		accessedAt: unixTimestamp('accessed_at').notNull(),
		ipAddress: text('ip_address'),
		userAgent: text('user_agent'),
		...timestamps,
	},
	(table) => [
		index('access_logs_document_id_idx').on(table.documentId),
		index('access_logs_accessed_at_idx').on(table.accessedAt),
		check(
			'access_logs_action_check',
			sql`${table.action} IN ('view', 'download', 'print', 'share', 'delete')`,
		),
	],
);

/* ------------------------------------------------------------------------ *
 * document.shares
 * ------------------------------------------------------------------------ */

/** External sharing of a document, e.g. a portal share with a customer. */
export const documentShares = documentSchema.table(
	'shares',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		/** Logical reference to auth.organizations.id; NULL = company-wide. */
		organizationId: text('organization_id'),
		documentId: uuid('document_id').notNull(),
		shareType: text('share_type').notNull(),
		/**
		 * Opaque public-link token, never the row id. Unique across tenants
		 * because the public route resolves it without a session.
		 */
		token: uuid('token'),
		sharedWithType: text('shared_with_type'),
		sharedWithId: text('shared_with_id'),
		/** Logical reference to auth.users.id — cross-module FK omitted. */
		sharedByUserId: text('shared_by_user_id'),
		sharedAt: unixTimestamp('shared_at').notNull(),
		expiresAt: unixTimestampNullable('expires_at'),
		isRevoked: boolean('is_revoked').notNull().default(false),
		...timestamps,
	},
	(table) => [
		index('shares_document_id_idx').on(table.documentId),
		index('shares_target_idx').on(
			table.shareType,
			table.sharedWithType,
			table.sharedWithId,
		),
		uniqueIndex('shares_token_uq')
			.on(table.token)
			.where(sql`deleted_at IS NULL`),
		index('shares_token_live_idx')
			.on(table.token, table.expiresAt)
			.where(sql`deleted_at IS NULL AND is_revoked = false`),
		check(
			'shares_share_type_check',
			sql`${table.shareType} IN ('internal', 'customer', 'portal', 'public_link')`,
		),
	],
);

/* ------------------------------------------------------------------------ *
 * document.tags
 * ------------------------------------------------------------------------ */

/** Free form tag applied to documents. */
export const documentTags = documentSchema.table(
	'tags',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		/** Logical reference to auth.organizations.id; NULL = company-wide tag. */
		organizationId: text('organization_id'),
		tag: text('tag').notNull(),
		isActive: boolean('is_active').notNull().default(true),
		...timestamps,
	},
	(table) => [
		uniqueIndex('tags_org_tag_uq')
			.on(table.organizationId, table.tag)
			.where(sql`deleted_at IS NULL AND organization_id IS NOT NULL`),
		uniqueIndex('tags_global_tag_uq')
			.on(table.tag)
			.where(sql`deleted_at IS NULL AND organization_id IS NULL`),
	],
);

/* ------------------------------------------------------------------------ *
 * document.tag_links
 * ------------------------------------------------------------------------ */

/** Link between a document and a tag. */
export const documentTagLinks = documentSchema.table(
	'tag_links',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		/** Logical reference to auth.organizations.id; NULL = company-wide. */
		organizationId: text('organization_id'),
		documentId: uuid('document_id').notNull(),
		documentTagId: uuid('document_tag_id').notNull(),
		...timestamps,
	},
	(table) => [
		uniqueIndex('tag_links_uq').on(table.documentId, table.documentTagId),
		index('tag_links_tag_id_idx').on(table.documentTagId),
	],
);

/* ------------------------------------------------------------------------ *
 * document.signature_requests
 * ------------------------------------------------------------------------ */

/**
 * Workflow state of a signature request.
 *
 * @remarks
 * The immutable evidence lives in {@link documentSignatures}; this table owns
 * the ask. Expiry is evaluated at read time — a pending row past `expires_at`
 * is treated as expired — so no job ever flips the status. The pending-unique
 * index is partial: one live pending request per document and signer, and
 * re-requesting after a terminal state creates a new row.
 */
export const documentSignatureRequests = documentSchema.table(
	'signature_requests',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		/** Logical reference to auth.organizations.id; NULL = company-wide. */
		organizationId: text('organization_id'),
		documentId: uuid('document_id').notNull(),
		/** Logical reference to auth.users.id — cross-module FK omitted. */
		requestedByUserId: text('requested_by_user_id').notNull(),
		/** Logical reference to auth.users.id — cross-module FK omitted. */
		signerUserId: text('signer_user_id').notNull(),
		/** Signer display name snapshot at request time. */
		signerName: text('signer_name').notNull(),
		status: text('status').notNull().default('pending'),
		/** Requester message to the signer. */
		note: text('note'),
		declineReason: text('decline_reason'),
		expiresAt: unixTimestampNullable('expires_at'),
		respondedAt: unixTimestampNullable('responded_at'),
		...timestamps,
	},
	(table) => [
		index('signature_requests_document_id_idx').on(table.documentId),
		index('signature_requests_signer_status_idx').on(
			table.signerUserId,
			table.status,
		),
		index('signature_requests_requested_by_idx').on(table.requestedByUserId),
		uniqueIndex('signature_requests_pending_uq')
			.on(table.documentId, table.signerUserId)
			.where(sql`status = 'pending' AND deleted_at IS NULL`),
		check(
			'signature_requests_status_check',
			sql`${table.status} IN ('pending', 'signed', 'declined', 'expired', 'cancelled')`,
		),
	],
);

/* ------------------------------------------------------------------------ *
 * document.user_signatures
 * ------------------------------------------------------------------------ */

/**
 * Signature image a user uploads for themselves (ERP-0049).
 *
 * @remarks
 * One live image per user (partial unique on `user_id`). Not rendered into
 * any document layout yet — V1.5 wires it into the print components.
 */
export const documentUserSignatures = documentSchema.table(
	'user_signatures',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		/** Logical reference to auth.organizations.id; NULL = company-wide. */
		organizationId: text('organization_id'),
		/** Logical reference to auth.users.id — cross-module FK omitted. */
		userId: text('user_id').notNull(),
		/** Object-storage key of the WebP signature/stamp image; never a public URL. */
		objectKey: text('object_key').notNull(),
		uploadedAt: unixTimestamp('uploaded_at').notNull(),
		...timestamps,
	},
	(table) => [
		uniqueIndex('user_signatures_user_id_uq')
			.on(table.userId)
			.where(sql`deleted_at IS NULL`),
	],
);
export type TDocumentTemplateInsert = typeof documentTemplates.$inferInsert;
export type TDocumentTemplateSelect = typeof documentTemplates.$inferSelect;
export type TDocumentSignatureRequestSelect = typeof documentSignatureRequests.$inferSelect;
export type TDocumentSignatureRequestInsert = typeof documentSignatureRequests.$inferInsert;
export type TDocumentUserSignatureSelect = typeof documentUserSignatures.$inferSelect;
export type TDocumentUserSignatureInsert = typeof documentUserSignatures.$inferInsert;
export type TDocumentSelect = typeof documents.$inferSelect;
export type TDocumentInsert = typeof documents.$inferInsert;
export type TDocumentFileSelect = typeof documentFiles.$inferSelect;
export type TDocumentFileInsert = typeof documentFiles.$inferInsert;
export type TDocumentSignatureSelect = typeof documentSignatures.$inferSelect;
export type TDocumentSignatureInsert = typeof documentSignatures.$inferInsert;
export type TDocumentAccessLogSelect = typeof documentAccessLogs.$inferSelect;
export type TDocumentAccessLogInsert = typeof documentAccessLogs.$inferInsert;
export type TDocumentShareSelect = typeof documentShares.$inferSelect;
export type TDocumentShareInsert = typeof documentShares.$inferInsert;
export type TDocumentTagSelect = typeof documentTags.$inferSelect;
export type TDocumentTagInsert = typeof documentTags.$inferInsert;
export type TDocumentTagLinkSelect = typeof documentTagLinks.$inferSelect;
export type TDocumentTagLinkInsert = typeof documentTagLinks.$inferInsert;
