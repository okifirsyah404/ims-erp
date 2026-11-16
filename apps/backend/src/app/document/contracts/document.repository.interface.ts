import type {
	DocumentAccessAction,
	TDocumentAccessLogSelect,
	TDocumentFileInsert,
	TDocumentFileSelect,
	TDocumentInsert,
	TDocumentSelect,
	TDocumentShareInsert,
	TDocumentShareSelect,
	TDocumentTemplateInsert,
	TDocumentTemplateSelect,
} from '@drizzle/schemas/document.schema';
import type { TTx } from '@drizzle/types';
import type { TPaginationResult } from '@ims-erp/common';
import type { TDocumentListQuery } from './document.contract';

/**
 * Persistence port for `document.*`: the registry, its templates, files,
 * access trail and share links.
 */
export interface IDocumentRepository {
	/** Live documents, newest first, filtered by the registry query. */
	list(filter: TDocumentListQuery): Promise<TPaginationResult<TDocumentSelect>>;

	/** One live document, if it exists. */
	findById(id: string): Promise<TDocumentSelect | null>;

	/** Inserts an issued document. */
	insert(values: TDocumentInsert, tx?: TTx): Promise<TDocumentSelect>;

	/** Marks a live document void; `null` when there is none. */
	markVoid(id: string): Promise<TDocumentSelect | null>;

	/**
	 * Voids every live registry row of one source document.
	 *
	 * @returns How many rows were voided (0 when the source was never registered)
	 */
	markVoidBySource(
		module: string,
		sourceType: string,
		sourceId: string,
		tx?: TTx,
	): Promise<number>;

	/** The live (not void) current registry row of one source document, if any. */
	findLiveBySource(module: string, sourceType: string, sourceId: string): Promise<TDocumentSelect | null>;

	/** Appends one access-trail row (never updated, never skipped). */
	logAccess(entry: {
		documentId: string;
		organizationId: string | null;
		accessedByUserId: string | null;
		action: DocumentAccessAction;
		ipAddress?: string | null;
		userAgent?: string | null;
	}): Promise<void>;

	/** The access trail of one document, newest first. */
	listAccessTrail(documentId: string, limit: number): Promise<TDocumentAccessLogSelect[]>;

	/** Live files of one document, newest first. */
	listFiles(documentId: string): Promise<TDocumentFileSelect[]>;

	/** One live file of one document. */
	findFile(documentId: string, fileId: string): Promise<TDocumentFileSelect | null>;

	/** Inserts a file row. */
	insertFile(values: TDocumentFileInsert): Promise<TDocumentFileSelect>;

	/** Soft-deletes a file; `null` when there is no live row. */
	softDeleteFile(fileId: string): Promise<TDocumentFileSelect | null>;

	/** Live share links of one document, newest first. */
	listShares(documentId: string): Promise<TDocumentShareSelect[]>;

	/** Inserts a share link. */
	insertShare(values: TDocumentShareInsert): Promise<TDocumentShareSelect>;

	/** One share by its public token, live and not revoked. */
	findShareByToken(token: string): Promise<TDocumentShareSelect | null>;

	/** Revokes a share; `null` when there is no live, unrevoked row. */
	revokeShare(shareId: string): Promise<TDocumentShareSelect | null>;

	/** Live templates, company-wide and tenant ones alike. */
	listTemplates(organizationId: string | null): Promise<TDocumentTemplateSelect[]>;

	/** Inserts a template version. */
	insertTemplate(values: TDocumentTemplateInsert): Promise<TDocumentTemplateSelect>;
}
