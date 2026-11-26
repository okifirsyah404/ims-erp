import type {
	TDocumentSignatureRequestSelect,
	TDocumentSignatureSelect,
	TDocumentUserSignatureSelect,
} from '@drizzle/schemas/document.schema';
import type { TTx } from '@drizzle/types';
import type { TPaginationResult } from '@ims-erp/common';
import { EXPORTED_NOTIFICATION_SERVICE_TOKEN } from '@app/notification/constants/di';
import type { ExportedNotificationService } from '@app/notification/services/exported-notification.service';
import type { IPermissionResolver } from '@authorization/permission-resolver';
import { PERMISSION_RESOLVER_TOKEN } from '@authorization/permission-resolver';
import type { UserService } from '@app/user/services/user.service';
import { USER_SERVICE_TOKEN } from '@app/user/constants/di';
import { type IObjectStorage, OBJECT_STORAGE_TOKEN } from '@providers/s3/object-storage';
import { documentFileFrom, storeDocumentFile } from '@providers/s3/document-file';
import { inject, injectable } from 'tsyringe';
import { DOCUMENT_REPOSITORY_TOKEN, SIGNATURE_REPOSITORY_TOKEN } from '../constants/di';
import type { IDocumentRepository } from '../contracts/document.repository.interface';
import type { ISignatureRepository } from '../contracts/signature.repository.interface';
import {
	createSignatureRequestsSchema,
	attachSignedPdfSchema,
	type TCreateSignatureRequestsInput,
	type TSignaturePaginationRequest,
	type TSignatureRequestPaginationRequest,
	type TSignatureRequestView,
	type TSignSignatureRequestInput,
	type TSignatureView,
} from '../contracts/signature.contract';
import {
	NotRequestOwnerError,
	NotRequestSignerError,
	SignatureImageNotFoundError,
	SignaturePdfInvalidError,
	SignaturePdfStateError,
	SignatureRequestNotFoundError,
	SignatureRequestStateError,
} from '../errors/signature.errors';
import { documentFileName } from '../utils/document-file-name';

/** Presigned URLs for the signed PDF artifact live this long (seconds). */
const DOWNLOAD_TTL_SECONDS = 300;

/** Presigned URLs for a signer's image live this long (seconds). */
const IMAGE_URL_SECONDS = 300;

/** How many request rows the Mine page shows per page. */
const REQUEST_PAGE_LIMIT = 20;

/**
 * Signature request use cases (ERP-0048).
 *
 * @remarks
 * The evidence row is written only through {@link SignatureService.sign};
 * everything else reads. Expiry is lazy: a pending request past `expiresAt`
 * reads as `expired` in every view, and no job ever flips the status.
 */
@injectable()
export class SignatureService {
	private readonly repository: ISignatureRepository;
	private readonly notifications: ExportedNotificationService;
	private readonly permissions: IPermissionResolver;
	private readonly users: Pick<UserService, 'getUser'>;
	private readonly documents: Pick<
		IDocumentRepository,
		'findById' | 'findFile' | 'logAccess'
	>;
	private readonly storage: Pick<IObjectStorage, 'presignGet' | 'put'>;

	constructor(
		@inject(SIGNATURE_REPOSITORY_TOKEN)
		repository: ISignatureRepository,
		@inject(EXPORTED_NOTIFICATION_SERVICE_TOKEN)
		notifications: ExportedNotificationService,
		@inject(DOCUMENT_REPOSITORY_TOKEN)
		documents: Pick<IDocumentRepository, 'findById' | 'findFile' | 'logAccess'>,
		@inject(OBJECT_STORAGE_TOKEN)
		storage: Pick<IObjectStorage, 'presignGet' | 'put'>,
		@inject(PERMISSION_RESOLVER_TOKEN)
		permissions: IPermissionResolver,
		@inject(USER_SERVICE_TOKEN)
		users: Pick<UserService, 'getUser'>,
	) {
		this.repository = repository;
		this.notifications = notifications;
		this.documents = documents;
		this.storage = storage;
		this.permissions = permissions;
		this.users = users;
	}

	/** Evidence register (permission `document:signature_read`). */
	async listSignatures(request: TSignaturePaginationRequest) {
		const result = await this.repository.paginate(request);
		const documents = await this.documentMeta(result.data.map((row) => row.documentId));
		return {
			meta: result.meta,
			data: result.data.map((row) =>
				this.signatureView(row, documents.get(row.documentId) ?? null),
			),
		};
	}

	/** Evidence of one document (detail tab). */
	async listSignaturesOfDocument(documentId: string) {
		const rows = await this.repository.listSignaturesOfDocument(documentId);
		const document = await this.documents.findById(documentId);
		return rows.map((row) => this.signatureView(row, document));
	}

	/** Requests addressed to the caller (Mine page, incoming). */
	async listIncoming(
		signerUserId: string,
		request: TSignatureRequestPaginationRequest,
	) {
		const result = await this.repository.paginateIncoming({
			...request,
			signerUserId,
		});
		return this.requestPage(result, request);
	}

	/** Requests the caller created (Mine page, outgoing). */
	async listOutgoing(
		requestedByUserId: string,
		request: TSignatureRequestPaginationRequest,
	) {
		const result = await this.repository.paginateOutgoing({
			...request,
			requestedByUserId,
		});
		return this.requestPage(result, request);
	}

	/**
	 * Applies the lazy expiry rule to a page of requests.
	 *
	 * @remarks
	 * A past-due pending row reads as `expired` without a write, so
	 * `pendingOnly` never shows a request the signer can no longer act on.
	 * Document codes, titles and requester names are resolved in one pass so
	 * the UI never renders a raw id.
	 */
	private async requestPage(
		result: { meta: TPaginationResult<unknown>['meta']; data: TDocumentSignatureRequestSelect[] },
		filter: TSignatureRequestPaginationRequest,
	) {
		const documents = await this.documentMeta(result.data.map((row) => row.documentId));
		const people = await this.people(result.data.map((row) => row.requestedByUserId));
		const views = await Promise.all(
			result.data.map((row) =>
				this.requestView(row, {
					document: documents.get(row.documentId) ?? null,
					requestedByName: row.requestedByUserId
						? (people.get(row.requestedByUserId) ?? null)
						: null,
				}),
			),
		);
		return {
			meta: result.meta,
			data: filter.pendingOnly
				? views.filter((view) => view.effectiveStatus === 'pending')
				: views,
		};
	}

	/** Document code/title/type for a set of ids, one lookup each. */
	private async documentMeta(ids: string[]) {
		const unique = [...new Set(ids)];
		const rows = await Promise.all(unique.map((id) => this.documents.findById(id)));
		const map = new Map<
			string,
			{ code: string; title: string; documentType: string } | null
		>();
		for (const [index, row] of rows.entries()) {
			map.set(
				unique[index]!,
				row ? { code: row.code, title: row.title, documentType: row.documentType } : null,
			);
		}
		return map;
	}

	/** Display names for a set of user ids. */
	private async people(ids: (string | null)[]) {
		const unique = [...new Set(ids.filter((id): id is string => id !== null))];
		const found = await Promise.all(unique.map((id) => this.users.getUser(id)));
		const map = new Map<string, string>();
		for (const [index, user] of found.entries()) {
			if (user) map.set(unique[index]!, user.name);
		}
		return map;
	}

	/** Evidence + requests of one document (detail tab). */
	async documentSection(documentId: string) {
		const [signatures, requests] = await Promise.all([
			this.repository.listSignaturesOfDocument(documentId),
			this.repository.listRequestsOfDocument(documentId),
		]);
		const document = await this.documents.findById(documentId);
		const documents = new Map([[documentId, document]]);
		const people = await this.people(requests.map((row) => row.requestedByUserId));
		return {
			signatures: signatures.map((row) => this.signatureView(row, document)),
			requests: requests.map((row) =>
				this.requestView(row, {
					document: documents.get(row.documentId) ?? null,
					requestedByName: row.requestedByUserId
						? (people.get(row.requestedByUserId) ?? null)
						: null,
				}),
			),
		};
	}

	/**
	 * Creates one pending request per signer.
	 *
	 * @throws {SignatureRequestStateError} A live pending request already
	 * exists for the same document and signer (the DB index backs this up)
	 */
	async createRequests(
		input: TCreateSignatureRequestsInput,
		requestedByUserId: string,
	): Promise<TSignatureRequestView[]> {
		const now = new Date();
		const document = await this.documents.findById(input.documentId);
		if (!document) throw new SignatureRequestNotFoundError();

		const signers = await this.resolveSigners(input.signerUserIds);
		const created = await Promise.all(
			signers.map((signer) =>
				this.repository.insertRequest(
					{
						documentId: input.documentId,
						requestedByUserId,
						signerUserId: signer.userId,
						signerName: signer.name,
						status: 'pending',
						note: input.note ?? null,
						organizationId: document.organizationId,
						expiresAt: this.expiry(input, now),
						createdAt: now,
						updatedAt: now,
					},
				),
			),
		);
		await this.notifications.notify({
			userIds: signers.map((signer) => signer.userId),
			templateCode: 'document.signature_requested',
			variables: {
				requesterName: requestedByUserId,
				documentName: document.title,
			},
			tags: [document.code],
			sourceType: 'document',
			sourceId: document.id,
		});
		const requesterName = (await this.users.getUser(requestedByUserId))?.name ?? null;
		const meta = {
			document: {
				code: document.code,
				title: document.title,
				documentType: document.documentType,
			},
			requestedByName: requesterName,
		};
		return Promise.all(created.map((row) => this.requestView(row, meta)));
	}

	/**
	 * Signs a request addressed to the caller.
	 *
	 * @throws {NotRequestSignerError} The request is not addressed to the caller
	 * @throws {SignatureRequestStateError} Not pending, or expired
	 */
	async sign(
		requestId: string,
		actorUserId: string,
		ipAddress: string | null,
		method: TSignSignatureRequestInput['method'] = 'electronic',
	): Promise<TSignatureView> {
		const request = await this.repository.findRequestById(requestId);
		if (!request) throw new SignatureRequestNotFoundError();
		if (request.signerUserId !== actorUserId) throw new NotRequestSignerError();
		if (request.status !== 'pending') throw new SignatureRequestStateError();
		if (request.expiresAt && request.expiresAt.getTime() <= Date.now()) {
			throw new SignatureRequestStateError();
		}

		const now = new Date();
		const transitioned = await this.repository.transitionRequest(requestId, {
			status: 'signed',
			respondedAt: now,
		});
		if (!transitioned) throw new SignatureRequestStateError();

		// Snapshot the image the signer had at this moment: replacing it later
		// must never rewrite a signature that was already made.
		const image = await this.repository.findUserSignature(actorUserId);
		const evidence = await this.repository.insertSignature({
			createdAt: now,
			documentId: request.documentId,
			signerType: 'internal',
			signerUserId: actorUserId,
			signerName: request.signerName,
			signatureMethod: method,
			signedAt: now,
			ipAddress: ipAddress ?? null,
			signatureImageKey: image?.objectKey ?? null,
			organizationId: request.organizationId,
		});
		// A request whose requester was never recorded has nobody to notify.
		if (request.requestedByUserId) {
			await this.notifications.notify({
				userIds: [request.requestedByUserId],
				templateCode: 'document.signature_signed',
				variables: { signerName: request.signerName },
				sourceType: 'document',
				sourceId: request.documentId,
			});
		}
		const document = await this.documents.findById(request.documentId);
		return this.signatureView(evidence, document);
	}

	/** Declines a request addressed to the caller, with a reason. */
	async decline(
		requestId: string,
		actorUserId: string,
		reason: string,
	): Promise<TSignatureRequestView> {
		const request = await this.repository.findRequestById(requestId);
		if (!request) throw new SignatureRequestNotFoundError();
		if (request.signerUserId !== actorUserId) throw new NotRequestSignerError();
		if (request.status !== 'pending') throw new SignatureRequestStateError();
		if (request.expiresAt && request.expiresAt.getTime() <= Date.now()) {
			throw new SignatureRequestStateError();
		}
		const row = await this.repository.transitionRequest(requestId, {
			status: 'declined',
			respondedAt: new Date(),
			declineReason: reason,
		});
		if (!row) throw new SignatureRequestStateError();
		if (request.requestedByUserId) {
			await this.notifications.notify({
				userIds: [request.requestedByUserId],
				templateCode: 'document.signature_declined',
				variables: { signerName: request.signerName, reason },
				sourceType: 'document',
				sourceId: request.documentId,
			});
		}
		return this.requestView(row);
	}

	/** Cancels a pending request; requester only. */
	async cancel(requestId: string, actorUserId: string): Promise<TSignatureRequestView> {
		const request = await this.repository.findRequestById(requestId);
		if (!request) throw new SignatureRequestNotFoundError();
		if (request.requestedByUserId !== actorUserId) throw new NotRequestOwnerError();
		if (request.status !== 'pending') throw new SignatureRequestStateError();
		const row = await this.repository.transitionRequest(requestId, {
			status: 'cancelled',
			respondedAt: new Date(),
		});
		if (!row) throw new SignatureRequestStateError();
		return this.requestView(row);
	}

	/** The caller's live signature image, presigned. */
	async myImage(actorUserId: string): Promise<string | null> {
		const row = await this.repository.findUserSignature(actorUserId);
		if (!row) return null;
		return this.presignImage(row.objectKey);
	}

	/** Presigned images of many users (print pages, D12). */
	async userImages(userIds: string[]): Promise<Map<string, string>> {
		const rows = await this.repository.listUserSignatures(userIds);
		const urls = new Map<string, string>();
		for (const row of rows) {
			if (row.userId) urls.set(row.userId, this.presignImage(row.objectKey));
		}
		return urls;
	}

	/** Uploads (or replaces) the caller's signature image. */
	async uploadImage(
		actorUserId: string,
		objectKey: string,
	): Promise<TDocumentUserSignatureSelect> {
		const previous = await this.repository.findUserSignature(actorUserId);
		const row = await this.repository.upsertUserSignature(
			{
				createdAt: new Date(),
				userId: actorUserId,
				objectKey,
				uploadedAt: new Date(),
			},
			previous?.id ?? null,
		);
		return row;
	}

	/** Removes the caller's signature image (soft delete). */
	async deleteImage(actorUserId: string): Promise<void> {
		const row = await this.repository.softDeleteUserSignature(actorUserId);
		if (!row) throw new SignatureImageNotFoundError();
	}

	/**
	 * Records the signed PDF on the caller's signature of one request.
	 *
	 * @remarks
	 * The browser does the actual work: it renders the PDF page, lets the user
	 * place the signature image on it, and uploads the finished PDF here. The
	 * server only enforces who, on what, and how often — once. Placement is
	 * final: the row keeps its artifact forever, and a mistake means a new
	 * signature, not an edit.
	 *
	 * @throws {SignatureRequestNotFoundError} The request or the signature row is gone
	 * @throws {NotRequestSignerError} The caller is not the addressed signer
	 * @throws {SignatureRequestStateError} The request is not signed yet
	 * @throws {SignaturePdfStateError} The placement already happened
	 * @throws {SignaturePdfInvalidError} The source file is not this document's PDF
	 */
	async attachSignedPdf(
		requestId: string,
		body: unknown,
		actorUserId: string,
	): Promise<TSignatureView> {
		const input = attachSignedPdfSchema.parse(body);
		const request = await this.repository.findRequestById(requestId);
		if (!request) throw new SignatureRequestNotFoundError();
		if (request.signerUserId !== actorUserId) throw new NotRequestSignerError();
		if (request.status !== 'signed') throw new SignatureRequestStateError();

		const signature = await this.repository.findLatestSignature(
			request.documentId,
			actorUserId,
		);
		if (!signature) throw new SignatureRequestNotFoundError();

		const source = await this.documents.findFile(request.documentId, input.sourceFileId);
		if (!source || source.mimeType !== 'application/pdf') {
			throw new SignaturePdfInvalidError();
		}

		const file = documentFileFrom(body);
		if (file.type !== 'application/pdf') throw new SignaturePdfInvalidError();
		const key = await storeDocumentFile(
			this.storage,
			`documents/${request.documentId}/signed`,
			file,
		);
		const updated = await this.repository.attachSignedPdf(signature.id, {
			sourceFileId: source.id,
			signedFileKey: key,
		});
		if (!updated) throw new SignaturePdfStateError();

		await this.documents.logAccess({
			documentId: request.documentId,
			organizationId: signature.organizationId,
			accessedByUserId: actorUserId,
			action: 'pdf_sign',
		});
		const document = await this.documents.findById(request.documentId);
		return this.signatureView(updated, document);
	}

	/** A presigned URL for the signed PDF artifact, with a download row. */
	async signedPdfUrl(
		requestId: string,
		actorUserId: string,
		meta: { ipAddress?: string | null; userAgent?: string | null } = {},
	): Promise<{ url: string; fileName: string }> {
		const request = await this.repository.findRequestById(requestId);
		if (!request) throw new SignatureRequestNotFoundError();
		if (request.signerUserId !== actorUserId) throw new NotRequestSignerError();
		const signature = await this.repository.findLatestSignature(
			request.documentId,
			actorUserId,
		);
		if (!signature?.signedFileKey) throw new SignaturePdfStateError();
		await this.documents.logAccess({
			documentId: request.documentId,
			organizationId: signature.organizationId,
			accessedByUserId: actorUserId,
			action: 'download',
			ipAddress: meta.ipAddress ?? null,
			userAgent: meta.userAgent ?? null,
		});
		const document = await this.documents.findById(request.documentId);
		// Same rule as a stored document file, plus `_signed` so the artifact is
		// never confused with the file it was placed on.
		const fileName = document
			? documentFileName({
					title: `${document.title} - signed`,
					code: document.code,
					extension: 'pdf',
					at: signature.signedAt ?? new Date(),
				})
			: 'signed.pdf';
		return {
			url: this.storage.presignGet(signature.signedFileKey, {
				fileName,
				expiresIn: DOWNLOAD_TTL_SECONDS,
			}),
			fileName,
		};
	}

	private expiry(input: TCreateSignatureRequestsInput, _now: Date): Date | null {
		// D5: an omitted `expiresAt` is "no expiry". The
		// `document.signature_request_expiry_days` default is applied by the
		// caller that has the settings row (the web form pre-fills it), and a
		// null here never silently expires a request.
		return input.expiresAt ?? null;
	}

	private presignImage(objectKey: string): string {
		return this.storage.presignGet(objectKey, {
			fileName: 'signature.webp',
			inline: true,
			expiresIn: IMAGE_URL_SECONDS,
		});
	}

	private signatureView(
		row: TDocumentSignatureSelect,
		document: { code: string; title: string } | null,
	): TSignatureView {
		return {
			id: row.id,
			documentId: row.documentId,
			documentCode: document?.code ?? null,
			documentTitle: document?.title ?? null,
			signerType: row.signerType,
			signerUserId: row.signerUserId,
			signerName: row.signerName,
			signedAt: row.signedAt.toISOString(),
			method: row.signatureMethod as TSignatureView['method'],
			ipAddress: row.ipAddress,
			signatureImageUrl: row.signatureImageKey
				? this.presignImage(row.signatureImageKey)
				: null,
			sourceFileId: row.sourceFileId,
			hasSignedPdf: row.signedFileKey !== null,
		};
	}

	private async requestView(
		row: TDocumentSignatureRequestSelect,
		meta: {
			document: { code: string; title: string; documentType: string } | null;
			requestedByName: string | null;
		} = { document: null, requestedByName: null },
	): Promise<TSignatureRequestView> {
		const expired =
			row.status === 'pending' && row.expiresAt !== null && row.expiresAt.getTime() <= Date.now();
		const status = expired ? 'expired' : (row.status as TSignatureRequestView['status']);
		// The image snapshot and the signed-PDF fact live on the evidence row;
		// enrich when it exists so the UI never resolves them itself.
		const signature = row.status === 'signed' && row.signerUserId
			? await this.repository.findLatestSignature(row.documentId, row.signerUserId)
			: null;
		return {
			id: row.id,
			documentId: row.documentId,
			documentCode: meta.document?.code ?? null,
			documentTitle: meta.document?.title ?? null,
			documentType: meta.document?.documentType ?? null,
			requestedByUserId: row.requestedByUserId,
			requestedByName: meta.requestedByName,
			signerUserId: row.signerUserId,
			signerName: row.signerName,
			status,
			effectiveStatus: status,
			note: row.note,
			declineReason: row.declineReason,
			expiresAt: row.expiresAt?.toISOString() ?? null,
			respondedAt: row.respondedAt?.toISOString() ?? null,
			createdAt: row.createdAt.toISOString(),
			signatureImageUrl: signature?.signatureImageKey
				? this.presignImage(signature.signatureImageKey)
				: null,
			sourceFileId: signature?.sourceFileId ?? null,
			hasSignedPdf: signature?.signedFileKey != null,
		};
	}

	private async resolveSigners(userIds: string[]) {
		const ids = [...new Set(userIds.filter(Boolean))];
		const found = await Promise.all(ids.map((id) => this.users.getUser(id)));
		return found.flatMap((user) =>
			user ? [{ userId: user.id, name: user.name }] : [],
		);
	}
}
