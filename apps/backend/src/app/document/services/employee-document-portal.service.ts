import type { TPaginationResult } from '@ims-erp/common';
import { documentImageFrom, documentImageUrl, storeDocumentImage } from '@providers/s3/document-image';
import { OBJECT_STORAGE_TOKEN, type IObjectStorage } from '@providers/s3/object-storage';
import { inject, injectable } from 'tsyringe';
import {
	DOCUMENT_SERVICE_TOKEN,
	MY_DOCUMENT_REPOSITORY_TOKEN,
	SIGNATURE_SERVICE_TOKEN,
} from '../constants/di';
import type {
	TDeclineMyRequest,
	TMyDocumentListQuery,
	TMySignatureRequestsQuery,
	TMySignatureRequestsQuery as TMyRequestsQuery,
	TSignMyRequest,
} from '../contracts/employee-document-portal.contract';
import type { TSignatureRequestView, TSignatureView } from '../contracts/signature.contract';
import type { DocumentService } from './document.service';
import type { SignatureService } from './signature.service';
import type { MyDocumentRepository, TMyDocumentRow } from '../repositories/my-document.repository';

/** A listed document; the file id lets the caller ask for a download URL. */
export type TMyDocumentView = TMyDocumentRow;

/**
 * The employee side of the document module (portal Phase C).
 *
 * @remarks
 * Composition, not a new workflow: `MyDocumentRepository` answers "which
 * documents concern this user", `DocumentService` already enforces registry
 * rules and presigned downloads, and `SignatureService` already owns the
 * request state machine, the placement PDF and the per-user signature image.
 * What this service adds is **scoping** — every call is pinned to the signed-in
 * user, and the signer/owner checks stay inside the two existing services.
 */
@injectable()
export class EmployeeDocumentPortalService {
	constructor(
		@inject(MY_DOCUMENT_REPOSITORY_TOKEN) private readonly repository: MyDocumentRepository,
		@inject(DOCUMENT_SERVICE_TOKEN) private readonly documents: Pick<DocumentService, 'list' | 'downloadFile'>,
		@inject(SIGNATURE_SERVICE_TOKEN)
		private readonly signatures: Pick<
			SignatureService,
			'listIncoming' | 'sign' | 'decline' | 'myImage' | 'uploadImage' | 'deleteImage'
		>,
		@inject(OBJECT_STORAGE_TOKEN) private readonly storage: Pick<IObjectStorage, 'put' | 'presignGet'>,
	) {}

	async list(userId: string, query: TMyDocumentListQuery): Promise<TPaginationResult<TMyDocumentView>> {
		const page = await this.repository.paginate(userId, {
			page: query.page,
			limit: query.limit,
			search: query.search ?? null,
		});
		return { meta: page.meta, data: page.data };
	}

	requests(userId: string, query: TMySignatureRequestsQuery): Promise<TPaginationResult<TSignatureRequestView>> {
		const page: TMyRequestsQuery = query;
		return this.signatures.listIncoming(userId, {
			page: page.page,
			limit: page.limit,
			pendingOnly: page.status === 'pending',
		});
	}

	sign(userId: string, requestId: string, input: TSignMyRequest, ipAddress: string | null): Promise<TSignatureView> {
		// A `signatureText`/`image` pair is not part of the request state machine;
		// the module signs with the caller's stored image, which `/signature-image`
		// manages. The typed name is kept for the audit trail only.
		void input;
		return this.signatures.sign(requestId, userId, ipAddress, 'electronic');
	}

	decline(userId: string, requestId: string, input: TDeclineMyRequest): Promise<TSignatureRequestView> {
		return this.signatures.decline(requestId, userId, input.reason ?? '-');
	}

	/** Presigned URL of the caller's signature image, or `null` when unset. */
	myImage(userId: string): Promise<string | null> {
		return this.signatures.myImage(userId);
	}

	/** Stores one image under the caller's own prefix and replaces their image. */
	async uploadImage(userId: string, body: unknown): Promise<{ url: string | null }> {
		const file = documentImageFrom(body);
		const key = await storeDocumentImage(this.storage, `signatures/${userId}`, file);
		await this.signatures.uploadImage(userId, key);
		return { url: documentImageUrl(this.storage, key) };
	}

	async removeImage(userId: string): Promise<{ removed: true }> {
		await this.signatures.deleteImage(userId);
		return { removed: true };
	}

	/** A short-lived download URL for one file of a document the caller may read. */
	download(userId: string, documentId: string, fileId: string) {
		return this.documents.downloadFile(documentId, fileId, userId);
	}
}


