import type { CodeNumberService } from '@app/code-number';
import type { TDocumentSelect, TDocumentTemplateSelect } from '@drizzle/schemas/document.schema';
import type { TTx } from '@drizzle/types';
import type { TPaginationResult } from '@ims-erp/common';
import { inject, injectable } from 'tsyringe';
import { CODE_NUMBER_SERVICE_TOKEN } from '@app/code-number';
import { DOCUMENT_REPOSITORY_TOKEN } from '../constants/di';
import type {
	TCreateDocumentTemplateInput,
	TDocumentListQuery,
	TIssueDocumentInput,
} from '../contracts/document.contract';
import type { IDocumentRepository } from '../contracts/document.repository.interface';
import { DocumentNotFoundError, DocumentNotVoidableError } from '../errors/document.errors';

/**
 * Today as a Jakarta business date (`YYYY-MM-DD`).
 *
 * @remarks
 * `en-CA` formats as ISO, so no manual padding. The stored `issued_on` is a
 * plain `date` column, not an instant.
 */
function todayJakarta(): string {
	return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
}

/**
 * Document registry and issuance (ERP-0042).
 *
 * @remarks
 * Business documents stay in their owning module's tables; this service owns
 * the issued copy, its code (allocated by the numbering authority), its files
 * and signatures. Exported API for other modules:
 * {@link DocumentService.issue}.
 */
@injectable()
export class DocumentService {
	constructor(
		@inject(DOCUMENT_REPOSITORY_TOKEN)
		private readonly repository: IDocumentRepository,
		@inject(CODE_NUMBER_SERVICE_TOKEN)
		private readonly codeNumbers: CodeNumberService,
	) {}

	list(query: TDocumentListQuery): Promise<TPaginationResult<TDocumentSelect>> {
		return this.repository.list(query);
	}

	/** One document; reading it appends a `view` row to the access trail. */
	async get(id: string, actorUserId: string): Promise<TDocumentSelect> {
		const document = await this.repository.findById(id);
		if (!document) throw new DocumentNotFoundError();
		await this.repository.logAccess({
			documentId: document.id,
			organizationId: document.organizationId,
			accessedByUserId: actorUserId,
			action: 'view',
		});
		return document;
	}

	/**
	 * Issues a document: allocates its code and stores the issued copy.
	 *
	 * @param tx - The caller's transaction, so a failed write rolls back the
	 * allocated number too
	 */
	async issue(
		input: TIssueDocumentInput,
		actorUserId: string,
		tx?: TTx,
	): Promise<TDocumentSelect> {
		const now = new Date();
		const issuedOn = input.issuedOn ?? todayJakarta();
		const code = await this.codeNumbers.next(input.documentType, {
			date: new Date(issuedOn),
			tx,
		});
		return this.repository.insert(
			{
				organizationId: input.organizationId,
				code,
				documentType: input.documentType,
				title: input.title,
				templateId: input.templateId ?? null,
				module: input.module,
				sourceType: input.sourceType,
				sourceId: input.sourceId,
				status: 'issued',
				issuedOn,
				issuedByUserId: actorUserId,
				version: 1,
				isCurrent: true,
				createdAt: now,
				updatedAt: now,
			},
			tx,
		);
	}

	/** Voids a live document; the row is kept, never deleted. */
	async void(id: string, actorUserId: string): Promise<TDocumentSelect> {
		const existing = await this.repository.findById(id);
		if (!existing) throw new DocumentNotFoundError();
		if (existing.status === 'void') throw new DocumentNotVoidableError();
		const document = await this.repository.markVoid(id);
		if (!document) throw new DocumentNotFoundError();
		await this.repository.logAccess({
			documentId: document.id,
			organizationId: document.organizationId,
			accessedByUserId: actorUserId,
			action: 'delete',
		});
		return document;
	}

	listTemplates(organizationId: string | null): Promise<TDocumentTemplateSelect[]> {
		return this.repository.listTemplates(organizationId);
	}

	createTemplate(input: TCreateDocumentTemplateInput): Promise<TDocumentTemplateSelect> {
		const now = new Date();
		return this.repository.insertTemplate({
			organizationId: input.organizationId,
			code: input.code,
			name: input.name,
			documentType: input.documentType,
			module: input.module,
			version: input.version,
			contentTemplate: input.contentTemplate,
			numberingPattern: input.numberingPattern,
			createdAt: now,
			updatedAt: now,
		});
	}
}
