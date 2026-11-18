import type { CodeNumberService } from '@app/code-number';
import type { TDocumentSelect, TDocumentTemplateSelect } from '@drizzle/schemas/document.schema';
import type { TTx } from '@drizzle/types';
import type { TPaginationResult } from '@ims-erp/common';
import { documentFileFrom, storeDocumentFile } from '@providers/s3/document-file';
import { type IObjectStorage, OBJECT_STORAGE_TOKEN } from '@providers/s3/object-storage';
import { inject, injectable } from 'tsyringe';
import { CODE_NUMBER_SERVICE_TOKEN } from '@app/code-number';
import { DOCUMENT_REPOSITORY_TOKEN } from '../constants/di';
import type {
	TCreateDocumentTemplateInput,
	TDocumentDetail,
	TDocumentFileView,
	TDocumentListQuery,
	TDocumentShareView,
	TIssueDocumentInput,
	TPublicDocumentView,
	TRegisterDocumentInput,
} from '../contracts/document.contract';
import type { IDocumentRepository } from '../contracts/document.repository.interface';
import {
	DocumentFileNotFoundError,
	DocumentFileStateError,
	DocumentNotFoundError,
	DocumentNotVoidableError,
	DocumentShareNotFoundError,
} from '../errors/document.errors';

/** Presigned URLs live five minutes: long enough to click, short enough to leak slowly. */
const DOWNLOAD_TTL_SECONDS = 300;

/** How many access-trail rows the detail screen shows. */
const ACCESS_TRAIL_LIMIT = 50;

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
		@inject(OBJECT_STORAGE_TOKEN)
		private readonly storage: IObjectStorage,
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

	/**
	 * Registers an already-issued business document in the registry.
	 *
	 * @remarks
	 * ERP-0044: the owning module allocates the code (its own numbering call,
	 * usually inside the write transaction) and this only records the issued
	 * copy. Nothing is allocated here, so the business row and the registry row
	 * always share one code.
	 *
	 * @param tx - The caller's transaction, so the registry row rolls back with
	 * the business row
	 */
	register(input: TRegisterDocumentInput, tx?: TTx): Promise<TDocumentSelect> {
		const now = new Date();
		return this.repository.insert(
			{
				organizationId: input.organizationId,
				code: input.code,
				documentType: input.documentType,
				// The code doubles as the title until a printed name is needed.
				title: input.title ?? input.code,
				templateId: input.templateId ?? null,
				module: input.module,
				sourceType: input.sourceType,
				sourceId: input.sourceId,
				status: 'issued',
				issuedOn: input.issuedOn ?? todayJakarta(),
				issuedByUserId: input.issuedByUserId ?? null,
				version: 1,
				isCurrent: true,
				createdAt: now,
				updatedAt: now,
			},
			tx,
		);
	}

	/**
	 * Voids every live registry row of one source document.
	 *
	 * @remarks
	 * Called when a business document is cancelled/voided, so the registry
	 * never keeps a live copy of a dead document. A no-op when the source was
	 * never registered (seeded or pre-ERP-0044 data).
	 *
	 * @returns How many registry rows were voided
	 */
	voidBySource(
		module: string,
		sourceType: string,
		sourceId: string,
		tx?: TTx,
	): Promise<number> {
		return this.repository.markVoidBySource(module, sourceType, sourceId, tx);
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

	/**
	 * The detail screen: the registry row, its files, its links and the trail.
	 *
	 * @remarks
	 * Reading it appends one `view` row, exactly like {@link DocumentService.get}.
	 */
	async detail(id: string, actorUserId: string): Promise<TDocumentDetail> {
		const document = await this.get(id, actorUserId);
		const [files, shares, trail] = await Promise.all([
			this.repository.listFiles(document.id),
			this.repository.listShares(document.id),
			this.repository.listAccessTrail(document.id, ACCESS_TRAIL_LIMIT),
		]);
		return {
			...document,
			files: files.map((file) => this.fileView(file)),
			shares: shares
				.filter((share) => share.token !== null)
				.map((share) => ({
					id: share.id,
					token: share.token!,
					sharedAt: share.sharedAt.toISOString(),
					expiresAt: share.expiresAt?.toISOString() ?? null,
					isRevoked: share.isRevoked,
				})),
			accessTrail: trail.map((row) => ({
				id: row.id,
				action: row.action as TDocumentDetail['accessTrail'][number]['action'],
				accessedAt: row.accessedAt.toISOString(),
				accessedByUserId: row.accessedByUserId,
			})),
		};
	}

	/**
	 * Attaches a file to a live document.
	 *
	 * @throws {DocumentNotFoundError} The document is absent or void
	 */
	async uploadFile(
		id: string,
		body: unknown,
		actorUserId: string,
	): Promise<TDocumentFileView> {
		const document = await this.repository.findById(id);
		if (!document) throw new DocumentNotFoundError();
		if (document.status === 'void') throw new DocumentFileStateError();
		const file = documentFileFrom(body);
		const key = await storeDocumentFile(this.storage, `documents/${document.id}`, file);
		const now = new Date();
		const row = await this.repository.insertFile({
			organizationId: document.organizationId,
			documentId: document.id,
			fileName: file.name,
			storageKey: key,
			mimeType: file.type,
			sizeBytes: file.size,
			uploadedByUserId: actorUserId,
			uploadedAt: now,
			createdAt: now,
			updatedAt: now,
		});
		return this.fileView(row);
	}

	/**
	 * Attaches a system-generated file (e.g. a rendered PDF) to the live
	 * registry row of a source document (ERP-0067).
	 *
	 * @returns The registry document id; `null` when the source was never
	 * registered (seeded or pre-ERP-0044 data) or is void
	 */
	async attachGeneratedFile(
		source: { module: string; sourceType: string; sourceId: string },
		file: File,
		actorUserId: string | null,
	): Promise<string | null> {
		const document = await this.repository.findLiveBySource(source.module, source.sourceType, source.sourceId);
		if (!document) return null;
		const key = await storeDocumentFile(this.storage, `documents/${document.id}`, file);
		const now = new Date();
		await this.repository.insertFile({
			organizationId: document.organizationId,
			documentId: document.id,
			fileName: file.name,
			storageKey: key,
			mimeType: file.type,
			sizeBytes: file.size,
			uploadedByUserId: actorUserId,
			uploadedAt: now,
			createdAt: now,
			updatedAt: now,
		});
		return document.id;
	}

	/** Removes a file (soft delete) and records it on the trail. */
	async deleteFile(id: string, fileId: string, actorUserId: string): Promise<void> {
		const document = await this.repository.findById(id);
		if (!document) throw new DocumentNotFoundError();
		const file = await this.repository.findFile(document.id, fileId);
		if (!file) throw new DocumentFileNotFoundError();
		await this.repository.softDeleteFile(file.id);
		await this.repository.logAccess({
			documentId: document.id,
			organizationId: document.organizationId,
			accessedByUserId: actorUserId,
			action: 'delete',
		});
	}

	/**
	 * A presigned download URL, with a `download` row on the trail.
	 *
	 * @throws {DocumentFileNotFoundError} The file is absent or already deleted
	 */
	async downloadFile(
		id: string,
		fileId: string,
		actorUserId: string,
		meta: { ipAddress?: string | null; userAgent?: string | null } = {},
	): Promise<{ url: string; fileName: string; mimeType: string | null }> {
		const document = await this.repository.findById(id);
		if (!document) throw new DocumentNotFoundError();
		const file = await this.repository.findFile(document.id, fileId);
		if (!file) throw new DocumentFileNotFoundError();
		await this.repository.logAccess({
			documentId: document.id,
			organizationId: document.organizationId,
			accessedByUserId: actorUserId,
			action: 'download',
			ipAddress: meta.ipAddress ?? null,
			userAgent: meta.userAgent ?? null,
		});
		return {
			url: this.storage.presignGet(file.storageKey, {
				fileName: file.fileName,
				expiresIn: DOWNLOAD_TTL_SECONDS,
			}),
			fileName: file.fileName,
			mimeType: file.mimeType,
		};
	}

	/**
	 * Creates a public link for a live document.
	 *
	 * @remarks
	 * The token is its own uuid, never the share row id, and expiry is
	 * mandatory here even though the column allows null.
	 */
	async createShare(
		id: string,
		expiresInDays: number,
		actorUserId: string | null,
	): Promise<TDocumentShareView> {
		const document = await this.repository.findById(id);
		if (!document) throw new DocumentNotFoundError();
		const now = new Date();
		const share = await this.repository.insertShare({
			organizationId: document.organizationId,
			documentId: document.id,
			shareType: 'public_link',
			token: crypto.randomUUID(),
			sharedByUserId: actorUserId,
			sharedAt: now,
			expiresAt: new Date(now.getTime() + expiresInDays * 24 * 60 * 60 * 1000),
			isRevoked: false,
			createdAt: now,
			updatedAt: now,
		});
		await this.repository.logAccess({
			documentId: document.id,
			organizationId: document.organizationId,
			accessedByUserId: actorUserId,
			action: 'share',
		});
		return {
			id: share.id,
			token: share.token!,
			sharedAt: share.sharedAt.toISOString(),
			expiresAt: share.expiresAt?.toISOString() ?? null,
			isRevoked: share.isRevoked,
		};
	}

	/** Revokes a link; the row is kept so the trail stays readable. */
	async revokeShare(id: string, shareId: string): Promise<TDocumentShareView> {
		const document = await this.repository.findById(id);
		if (!document) throw new DocumentNotFoundError();
		const share = await this.repository.revokeShare(shareId);
		if (!share || share.documentId !== document.id) throw new DocumentShareNotFoundError();
		return {
			id: share.id,
			token: share.token ?? '',
			sharedAt: share.sharedAt.toISOString(),
			expiresAt: share.expiresAt?.toISOString() ?? null,
			isRevoked: share.isRevoked,
		};
	}

	/**
	 * The public view of a shared document.
	 *
	 * @remarks
	 * Anonymous: no session and no organization is exposed. An expired or
	 * revoked token answers 404, and every hit appends a `view` row with no
	 * user id so the trail still shows the access.
	 *
	 * @throws {DocumentShareNotFoundError} The token is unknown, expired or revoked
	 */
	async resolvePublicShare(token: string): Promise<TPublicDocumentView> {
		const document = await this.sharedDocument(token);
		const files = await this.repository.listFiles(document.id);
		await this.repository.logAccess({
			documentId: document.id,
			organizationId: document.organizationId,
			accessedByUserId: null,
			action: 'view',
		});
		return {
			code: document.code,
			documentType: document.documentType,
			title: document.title,
			issuedOn: document.issuedOn,
			status: document.status,
			files: files.map((file) => ({
				fileName: file.fileName,
				mimeType: file.mimeType,
				sizeBytes: file.sizeBytes,
				url: this.storage.presignGet(file.storageKey, {
					fileName: file.fileName,
					inline: true,
					expiresIn: DOWNLOAD_TTL_SECONDS,
				}),
			})),
		};
	}

	/**
	 * A short-lived URL of the newest file of a shared document (ERP-0067:
	 * the link n8n sends with a quotation PDF), with a `download` row on the
	 * trail.
	 *
	 * @throws {DocumentShareNotFoundError} The token is unknown, expired or revoked
	 * @throws {DocumentFileNotFoundError} The document has no live file
	 */
	async resolvePublicFile(token: string): Promise<string> {
		const document = await this.sharedDocument(token);
		const [file] = await this.repository.listFiles(document.id);
		if (!file) throw new DocumentFileNotFoundError();
		await this.repository.logAccess({
			documentId: document.id,
			organizationId: document.organizationId,
			accessedByUserId: null,
			action: 'download',
		});
		return this.storage.presignGet(file.storageKey, {
			fileName: file.fileName,
			inline: true,
			expiresIn: DOWNLOAD_TTL_SECONDS,
		});
	}

	/** The live document behind an unexpired, unrevoked public token. */
	private async sharedDocument(token: string): Promise<TDocumentSelect> {
		const share = await this.repository.findShareByToken(token);
		if (!share) throw new DocumentShareNotFoundError();
		if (share.expiresAt && share.expiresAt.getTime() <= Date.now()) {
			throw new DocumentShareNotFoundError();
		}
		const document = await this.repository.findById(share.documentId);
		if (!document || document.status === 'void') throw new DocumentShareNotFoundError();
		return document;
	}

	/** One file row as the client sees it, with a presigned inline URL. */
	private fileView(file: {
		id: string;
		fileName: string;
		mimeType: string | null;
		sizeBytes: number;
		uploadedAt: Date;
		storageKey: string;
	}): TDocumentFileView {
		return {
			id: file.id,
			fileName: file.fileName,
			mimeType: file.mimeType,
			sizeBytes: file.sizeBytes,
			uploadedAt: file.uploadedAt.toISOString(),
			url: this.storage.presignGet(file.storageKey, {
				fileName: file.fileName,
				inline: true,
				expiresIn: DOWNLOAD_TTL_SECONDS,
			}),
		};
	}
}
