import {
	CODE_TYPES,
	type CodeType,
} from '@drizzle/schemas/code-number.schema';
import { DOCUMENT_STATUSES } from '@drizzle/schemas/document.schema';
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

export type TDocumentListQuery = z.output<typeof documentListQuerySchema>;

/** Issue a document: the code is allocated by the numbering authority. */
export const issueDocumentSchema = z.object({
	/** Code type whose series numbers this document (`QT`, `INV`, …). */
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

/** The `codeType` of an issued document is always one of the code types. */
export type TDocumentCodeType = CodeType;
