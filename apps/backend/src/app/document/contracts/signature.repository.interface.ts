import type {
	TDocumentSignatureInsert,
	TDocumentSignatureRequestInsert,
	TDocumentSignatureRequestSelect,
	TDocumentSignatureSelect,
	TDocumentUserSignatureInsert,
	TDocumentUserSignatureSelect,
} from '@drizzle/schemas/document.schema';
import type { TTx } from '@drizzle/types';
import type { TPaginationResult } from '@ims-erp/common';
import type {
	TSignaturePaginationRequest,
	TSignatureRequestPaginationRequest,
	TSignatureRequestView,
	TSignatureView,
} from './signature.contract';

/**
 * Persistence port for `document.signature_requests`, `document.signatures`
 * and `document.user_signatures`.
 *
 * @remarks
 * Every read filters soft-deleted rows. The pending-unique rule lives in the
 * database; the repository surfaces the violation as a thrown error the
 * service maps to `SignatureRequestStateError`.
 */
export interface ISignatureRepository {
	/** Fetches one page of live signature evidence, newest first. */
	paginate(
		request: TSignaturePaginationRequest,
	): Promise<TPaginationResult<TDocumentSignatureSelect>>;

	/** Live signature evidence of one document, newest first. */
	listSignaturesOfDocument(documentId: string): Promise<TDocumentSignatureSelect[]>;

	/** Inserts one evidence row. */
	insertSignature(
		values: TDocumentSignatureInsert,
		tx?: TTx,
	): Promise<TDocumentSignatureSelect>;

	/** Fetches one page of live requests addressed to one signer, newest first. */
	paginateIncoming(
		request: TSignatureRequestPaginationRequest & { signerUserId: string },
	): Promise<TPaginationResult<TDocumentSignatureRequestSelect>>;

	/** Fetches one page of live requests one requester created, newest first. */
	paginateOutgoing(
		request: TSignatureRequestPaginationRequest & { requestedByUserId: string },
	): Promise<TPaginationResult<TDocumentSignatureRequestSelect>>;

	/** Live requests of one document, newest first. */
	listRequestsOfDocument(
		documentId: string,
	): Promise<TDocumentSignatureRequestSelect[]>;

	/** One live request by id. */
	findRequestById(id: string): Promise<TDocumentSignatureRequestSelect | null>;

	/** One live pending request of one document and signer. */
	findPendingRequest(
		documentId: string,
		signerUserId: string,
	): Promise<TDocumentSignatureRequestSelect | null>;

	/** Inserts one request row; rejects when the pending-unique index fires. */
	insertRequest(
		values: TDocumentSignatureRequestInsert,
		tx?: TTx,
	): Promise<TDocumentSignatureRequestSelect>;

	/** Applies a status transition to a pending request; `null` when it raced. */
	transitionRequest(
		id: string,
		patch: {
			status: 'signed' | 'declined' | 'cancelled';
			respondedAt: Date;
			declineReason?: string | null;
		},
	): Promise<TDocumentSignatureRequestSelect | null>;

	/** The newest evidence row of one signer on one document. */
	findLatestSignature(
		documentId: string,
		signerUserId: string,
	): Promise<TDocumentSignatureSelect | null>;

	/**
	 * Records the signed PDF on an evidence row that has none yet.
	 *
	 * @returns `null` when the row is gone or already carries a signed PDF
	 */
	attachSignedPdf(
		signatureId: string,
		patch: { sourceFileId: string; signedFileKey: string },
	): Promise<TDocumentSignatureSelect | null>;

	/** The live signature image of one user, if any. */
	findUserSignature(userId: string): Promise<TDocumentUserSignatureSelect | null>;

	/** Live signature images of many users. */
	listUserSignatures(
		userIds: string[],
	): Promise<TDocumentUserSignatureSelect[]>;

	/** Inserts an image row, replacing (soft-deleting) the previous one. */
	upsertUserSignature(
		values: TDocumentUserSignatureInsert,
		previousId: string | null,
	): Promise<TDocumentUserSignatureSelect>;

	/** Soft-deletes the user's image; `null` when there is none. */
	softDeleteUserSignature(userId: string): Promise<TDocumentUserSignatureSelect | null>;
}

/** Signature evidence + request rows as the client sees them. */
export type { TSignatureView, TSignatureRequestView };
