import { DRIZZLE_TOKEN } from '@di/provider';
import type { TTx } from '@drizzle/types';
import type { TPaginationResult } from '@ims-erp/common';
import { paginationResult } from '@utils/pagination.util';
import { and, asc, count, desc, eq, inArray, isNull } from 'drizzle-orm';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { inject, injectable } from 'tsyringe';
import {
	documentSignatureRequests,
	documentSignatures,
	documentUserSignatures,
	type TDocumentSignatureInsert,
	type TDocumentSignatureRequestInsert,
	type TDocumentSignatureRequestSelect,
	type TDocumentSignatureSelect,
	type TDocumentUserSignatureInsert,
	type TDocumentUserSignatureSelect,
} from '@drizzle/schemas/document.schema';
import type { ISignatureRepository } from '../contracts/signature.repository.interface';
import type {
	TSignaturePaginationRequest,
	TSignatureRequestPaginationRequest,
} from '../contracts/signature.contract';

/**
 * Drizzle implementation of {@link ISignatureRepository}.
 *
 * @remarks
 * Evidence rows are append-only: inserted once, never updated, never
 * soft-deleted. Request rows carry the workflow state and are soft-deleted
 * like every business row. The pending-unique rule lives in the database
 * (`signature_requests_pending_uq`); a violation surfaces as a thrown error
 * the service maps to `SignatureRequestStateError`.
 */
@injectable()
export class SignatureRepository implements ISignatureRepository {
	constructor(@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase) {}

	/**
	 * Fetches one filtered page of the signature evidence register.
	 *
	 * @param request - Page settings plus the optional document/method filters
	 */
	async paginate(
		request: TSignaturePaginationRequest,
	): Promise<TPaginationResult<TDocumentSignatureSelect>> {
		const { page, limit, documentId, method } = request;
		const conditions = [isNull(documentSignatures.deletedAt)];
		if (documentId) conditions.push(eq(documentSignatures.documentId, documentId));
		if (method) conditions.push(eq(documentSignatures.signatureMethod, method));
		const where = and(...conditions);

		const [rows, [totals]] = await Promise.all([
			this.database
				.select()
				.from(documentSignatures)
				.where(where)
				.orderBy(desc(documentSignatures.signedAt), desc(documentSignatures.id))
				.limit(limit)
				.offset((page - 1) * limit),
			this.database.select({ value: count() }).from(documentSignatures).where(where),
		]);
		const total = Number(totals?.value ?? 0);
		return paginationResult(request, total, rows);
	}

	async listSignaturesOfDocument(
		documentId: string,
	): Promise<TDocumentSignatureSelect[]> {
		return this.database
			.select()
			.from(documentSignatures)
			.where(
				and(
					eq(documentSignatures.documentId, documentId),
					isNull(documentSignatures.deletedAt),
				),
			)
			.orderBy(desc(documentSignatures.signedAt));
	}

	async insertSignature(
		values: TDocumentSignatureInsert,
		tx?: TTx,
	): Promise<TDocumentSignatureSelect> {
		const database = (tx ?? this.database) as BunSQLDatabase;
		const [row] = await database.insert(documentSignatures).values(values).returning();
		return row;
	}

	/** Fetches one page of live requests addressed to one signer, newest first. */
	async paginateIncoming(
		request: TSignatureRequestPaginationRequest & { signerUserId: string },
	): Promise<TPaginationResult<TDocumentSignatureRequestSelect>> {
		return this.paginateRequests(
			eq(documentSignatureRequests.signerUserId, request.signerUserId),
			request,
		);
	}

	/** Fetches one page of live requests one requester created, newest first. */
	async paginateOutgoing(
		request: TSignatureRequestPaginationRequest & { requestedByUserId: string },
	): Promise<TPaginationResult<TDocumentSignatureRequestSelect>> {
		return this.paginateRequests(
			eq(documentSignatureRequests.requestedByUserId, request.requestedByUserId),
			request,
		);
	}

	private async paginateRequests(
		scope: ReturnType<typeof eq>,
		request: TSignatureRequestPaginationRequest,
	): Promise<TPaginationResult<TDocumentSignatureRequestSelect>> {
		const { page, limit, pendingOnly } = request;
		const conditions = [
			scope,
			isNull(documentSignatureRequests.deletedAt),
		];
		if (pendingOnly) {
			conditions.push(eq(documentSignatureRequests.status, 'pending'));
		}
		const where = and(...conditions);

		const [rows, [totals]] = await Promise.all([
			this.database
				.select()
				.from(documentSignatureRequests)
				.where(where)
				.orderBy(desc(documentSignatureRequests.createdAt), desc(documentSignatureRequests.id))
				.limit(limit)
				.offset((page - 1) * limit),
			this.database
				.select({ value: count() })
				.from(documentSignatureRequests)
				.where(where),
		]);
		const total = Number(totals?.value ?? 0);
		return paginationResult(request, total, rows);
	}

	async listRequestsOfDocument(
		documentId: string,
	): Promise<TDocumentSignatureRequestSelect[]> {
		return this.database
			.select()
			.from(documentSignatureRequests)
			.where(
				and(
					eq(documentSignatureRequests.documentId, documentId),
					isNull(documentSignatureRequests.deletedAt),
				),
			)
			.orderBy(desc(documentSignatureRequests.createdAt));
	}

	async findRequestById(id: string): Promise<TDocumentSignatureRequestSelect | null> {
		const [row] = await this.database
			.select()
			.from(documentSignatureRequests)
			.where(
				and(eq(documentSignatureRequests.id, id), isNull(documentSignatureRequests.deletedAt)),
			)
			.limit(1);
		return row ?? null;
	}

	async findPendingRequest(
		documentId: string,
		signerUserId: string,
	): Promise<TDocumentSignatureRequestSelect | null> {
		const [row] = await this.database
			.select()
			.from(documentSignatureRequests)
			.where(
				and(
					eq(documentSignatureRequests.documentId, documentId),
					eq(documentSignatureRequests.signerUserId, signerUserId),
					eq(documentSignatureRequests.status, 'pending'),
					isNull(documentSignatureRequests.deletedAt),
				),
			)
			.limit(1);
		return row ?? null;
	}

	async insertRequest(
		values: TDocumentSignatureRequestInsert,
		tx?: TTx,
	): Promise<TDocumentSignatureRequestSelect> {
		const database = (tx ?? this.database) as BunSQLDatabase;
		const [row] = await database
			.insert(documentSignatureRequests)
			.values(values)
			.returning();
		return row;
	}

	async transitionRequest(
		id: string,
		patch: {
			status: 'signed' | 'declined' | 'cancelled';
			respondedAt: Date;
			declineReason?: string | null;
		},
	): Promise<TDocumentSignatureRequestSelect | null> {
		const [row] = await this.database
			.update(documentSignatureRequests)
			.set({
				status: patch.status,
				respondedAt: patch.respondedAt,
				declineReason: patch.declineReason ?? null,
				updatedAt: new Date(),
			})
			.where(
				and(
					eq(documentSignatureRequests.id, id),
					eq(documentSignatureRequests.status, 'pending'),
					isNull(documentSignatureRequests.deletedAt),
				),
			)
			.returning();
		return row ?? null;
	}

	async findLatestSignature(
		documentId: string,
		signerUserId: string,
	): Promise<TDocumentSignatureSelect | null> {
		const [row] = await this.database
			.select()
			.from(documentSignatures)
			.where(
				and(
					eq(documentSignatures.documentId, documentId),
					eq(documentSignatures.signerUserId, signerUserId),
					isNull(documentSignatures.deletedAt),
				),
			)
			.orderBy(desc(documentSignatures.signedAt), desc(documentSignatures.id))
			.limit(1);
		return row ?? null;
	}

	async attachSignedPdf(
		signatureId: string,
		patch: { sourceFileId: string; signedFileKey: string },
	): Promise<TDocumentSignatureSelect | null> {
		const [row] = await this.database
			.update(documentSignatures)
			.set({
				sourceFileId: patch.sourceFileId,
				signedFileKey: patch.signedFileKey,
				updatedAt: new Date(),
			})
			.where(
				and(
					eq(documentSignatures.id, signatureId),
					isNull(documentSignatures.signedFileKey),
					isNull(documentSignatures.deletedAt),
				),
			)
			.returning();
		return row ?? null;
	}

	async findUserSignature(
		userId: string,
	): Promise<TDocumentUserSignatureSelect | null> {
		const [row] = await this.database
			.select()
			.from(documentUserSignatures)
			.where(
				and(
					eq(documentUserSignatures.userId, userId),
					isNull(documentUserSignatures.deletedAt),
				),
			)
			.orderBy(asc(documentUserSignatures.id))
			.limit(1);
		return row ?? null;
	}

	async listUserSignatures(
		userIds: string[],
	): Promise<TDocumentUserSignatureSelect[]> {
		if (userIds.length === 0) return [];
		return this.database
			.select()
			.from(documentUserSignatures)
			.where(
				and(
					inArray(documentUserSignatures.userId, userIds),
					isNull(documentUserSignatures.deletedAt),
				),
			);
	}

	async upsertUserSignature(
		values: TDocumentUserSignatureInsert,
		previousId: string | null,
	): Promise<TDocumentUserSignatureSelect> {
		// ponytail: two statements instead of a transaction — losing the old
		// image before the new insert lands only costs the old presigned key;
		// wrap in `tx` when a real replace-all-or-nothing is needed.
		if (previousId) {
			await this.database
				.update(documentUserSignatures)
				.set({ deletedAt: new Date(), updatedAt: new Date() })
				.where(
					and(
						eq(documentUserSignatures.id, previousId),
						isNull(documentUserSignatures.deletedAt),
					),
				);
		}
		const [row] = await this.database
			.insert(documentUserSignatures)
			.values(values)
			.returning();
		return row;
	}

	async softDeleteUserSignature(
		userId: string,
	): Promise<TDocumentUserSignatureSelect | null> {
		const [row] = await this.database
			.update(documentUserSignatures)
			.set({ deletedAt: new Date(), updatedAt: new Date() })
			.where(
				and(
					eq(documentUserSignatures.userId, userId),
					isNull(documentUserSignatures.deletedAt),
				),
			)
			.returning();
		return row ?? null;
	}
}
