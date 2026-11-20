import {
	CODE_TYPES,
	type CodeType,
} from '@shared/numbering';
import {
	DOCUMENT_STATUSES,
	type DocumentAccessAction,
	type TDocumentSelect,
} from '@drizzle/schemas/document.schema';
import { z } from 'zod';

const optionalText = (max: number) =>
	z
		.string()
		.trim()
		.max(max)
		.nullish()
		.transform((value) => (value ? value : null));

/** Query of the document registry. */
export const documentListQuerySchema = z.object({
	page: z.coerce.number().int().min(1).default(1),
	limit: z.coerce.number().int().min(1).max(100).default(20),
	search: optionalText(200),
	status: z.enum(DOCUMENT_STATUSES).nullish(),
	documentType: optionalText(64),
	organizationId: optionalText(64),
});

/** Page settings plus the filters of the document registry listing. */
export type TDocumentPaginationRequest = z.output<typeof documentListQuerySchema>;

/** Issue a document: the code is allocated by the numbering authority. */
export const issueDocumentSchema = z.object({
	/** The code the owning module allocated from its own series (ADR-0024 Q6). */
	code: z.string().trim().min(1).max(40),
	/** Code type of that code (`QT`, `INV`, …), for grouping and search. */
	documentType: z.enum(CODE_TYPES),
	title: z.string().trim().min(1).max(500),
	module: optionalText(64),
	sourceType: optionalText(64),
	sourceId: optionalText(128),
	templateId: z.uuid().nullish(),
	/** Omit for a company-wide document (ADR-0011 scope carve-out). */
	organizationId: optionalText(64),
	/** Business date (Asia/Jakarta); defaults to today. */
	issuedOn: z.iso.date().nullish(),
});

export type TIssueDocumentInput = z.output<typeof issueDocumentSchema>;

/** Create a reusable document template (a new version is a new row). */
export const createDocumentTemplateSchema = z.object({
	code: z.string().trim().min(1).max(32),
	name: z.string().trim().min(1).max(200),
	documentType: z.string().trim().min(1).max(64),
	module: optionalText(64),
	version: z.coerce.number().int().min(1).default(1),
	contentTemplate: optionalText(20000),
	numberingPattern: optionalText(100),
	organizationId: optionalText(64),
});

export type TCreateDocumentTemplateInput = z.output<typeof createDocumentTemplateSchema>;

/**
 * One already-issued business document to record in the registry (ERP-0044).
 *
 * @remarks
 * Not a request schema: this is the internal contract other modules call, so
 * it takes the code they already allocated instead of allocating another one.
 */
export type TRegisterDocumentInput = {
	/** Code the owning module allocated for the same row. */
	code: string;
	documentType: CodeType;
	/** Defaults to `code`. */
	title?: string | null;
	/** Owning module, e.g. `sales`. */
	module: string;
	/** Source table discriminator, e.g. `quotation`. */
	sourceType: string;
	/** Source row id. */
	sourceId: string;
	/** `null` = company-wide. */
	organizationId: string | null;
	/** Business date (Asia/Jakarta); defaults to today when null. */
	issuedOn?: string | null;
	issuedByUserId?: string | null;
	templateId?: string | null;
};

/** The `codeType` of an issued document is always one of the code types. */
export type TDocumentCodeType = CodeType;

/** Create a public share link: the token is generated server-side. */
export const createDocumentShareSchema = z.object({
	/** Days until the link stops working; the cap is one year. */
	expiresInDays: z.coerce.number().int().min(1).max(365).default(30),
});

export type TCreateDocumentShareInput = z.output<typeof createDocumentShareSchema>;

/** One file of a document as the client sees it (plus a download URL). */
export type TDocumentFileView = {
	id: string;
	fileName: string;
	mimeType: string | null;
	sizeBytes: number;
	uploadedAt: string;
	/** Short-lived presigned URL; reading the file appends a download row. */
	url: string;
};

/** One share link as the client sees it. */
export type TDocumentShareView = {
	id: string;
	token: string;
	sharedAt: string;
	expiresAt: string | null;
	isRevoked: boolean;
};

/** The document detail screen: registry row, files, links and the access trail. */
export type TDocumentDetail = TDocumentSelect & {
	files: TDocumentFileView[];
	shares: TDocumentShareView[];
	accessTrail: {
		id: string;
		action: DocumentAccessAction;
		accessedAt: string;
		accessedByUserId: string | null;
	}[];
};

/** What a public share link exposes - never the organization or the trail. */
export type TPublicDocumentView = {
	code: string;
	documentType: string;
	title: string;
	issuedOn: string | null;
	status: string;
	files: { fileName: string; mimeType: string | null; sizeBytes: number; url: string }[];
};
