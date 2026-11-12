import type {
	DocumentAccessAction,
	TDocumentInsert,
	TDocumentSelect,
	TDocumentTemplateInsert,
	TDocumentTemplateSelect,
} from '@drizzle/schemas/document.schema';
import type { TTx } from '@drizzle/types';
import type { TPaginationResult } from '@ims-erp/common';
import type { TDocumentListQuery } from './document.contract';

/** Persistence port for `document.documents` and `document.templates`. */
export interface IDocumentRepository {
	/** Live documents, newest first, filtered by the registry query. */
	list(filter: TDocumentListQuery): Promise<TPaginationResult<TDocumentSelect>>;

	/** One live document, if it exists. */
	findById(id: string): Promise<TDocumentSelect | null>;

	/** Inserts an issued document. */
	insert(values: TDocumentInsert, tx?: TTx): Promise<TDocumentSelect>;

	/** Marks a live document void; `null` when there is none. */
	markVoid(id: string): Promise<TDocumentSelect | null>;

	/** Appends one access-trail row (never updated, never skipped). */
	logAccess(entry: {
		documentId: string;
		organizationId: string | null;
		accessedByUserId: string;
		action: DocumentAccessAction;
	}): Promise<void>;

	/** Live templates, company-wide and tenant ones alike. */
	listTemplates(organizationId: string | null): Promise<TDocumentTemplateSelect[]>;

	/** Inserts a template version. */
	insertTemplate(values: TDocumentTemplateInsert): Promise<TDocumentTemplateSelect>;
}
