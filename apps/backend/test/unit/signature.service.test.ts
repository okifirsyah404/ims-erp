/**
 * Signature flow unit tests (ERP-0048 / ERP-0049).
 *
 * @remarks
 * The repository, storage, notification service and user service are fakes:
 * the rules under test are the service's (only the addressed signer may act,
 * a non-pending or expired request refuses the action, signing writes exactly
 * one immutable evidence row and notifies the requester, a duplicate pending
 * request is rejected, images are presigned and soft-deleted). The SQL itself
 * is checked against PostgreSQL by the live verification recorded in
 * `docs/plan/progress.md`.
 */
import { beforeEach, describe, expect, test } from 'bun:test';
import type {
	TDocumentSelect,
	TDocumentSignatureRequestSelect,
	TDocumentSignatureSelect,
	TDocumentUserSignatureSelect,
} from '@drizzle/schemas/document.schema';
import type { IDocumentRepository } from '../../src/app/document/contracts/document.repository.interface';
import type { ISignatureRepository } from '../../src/app/document/contracts/signature.repository.interface';
import {
	NotRequestOwnerError,
	NotRequestSignerError,
	SignatureImageNotFoundError,
	SignatureRequestNotFoundError,
	SignatureRequestStateError,
} from '../../src/app/document/errors/signature.errors';
import { SignatureService } from '../../src/app/document/services/signature.service';

const ORG = 'org_1';
const REQUESTER = 'user_requester';
const SIGNER = 'user_signer';
const OTHER = 'user_other';

function documentRow(overrides: Partial<TDocumentSelect> = {}): TDocumentSelect {
	const now = new Date();
	return {
		id: '01930000-0000-7000-8000-000000000001',
		organizationId: ORG,
		code: 'BAST-00001',
		documentType: 'bast',
		title: 'BAST Swing Gate',
		templateId: null,
		module: 'projects',
		sourceType: 'bast',
		sourceId: 'bast_1',
		status: 'issued',
		issuedOn: '2026-11-16',
		issuedByUserId: REQUESTER,
		approvedByUserId: null,
		approvedAt: null,
		version: 1,
		isCurrent: true,
		supersedesDocumentId: null,
		createdAt: now,
		updatedAt: now,
		deletedAt: null,
		...overrides,
	};
}

function requestRow(
	overrides: Partial<TDocumentSignatureRequestSelect> = {},
): TDocumentSignatureRequestSelect {
	const now = new Date();
	return {
		id: 'req-1',
		organizationId: ORG,
		documentId: documentRow().id,
		requestedByUserId: REQUESTER,
		signerUserId: SIGNER,
		signerName: 'Siti Rahmawati',
		status: 'pending',
		note: null,
		declineReason: null,
		expiresAt: null,
		respondedAt: null,
		createdAt: now,
		updatedAt: now,
		deletedAt: null,
		...overrides,
	};
}

class FakeSignatureRepository implements Partial<ISignatureRepository> {
	requests: TDocumentSignatureRequestSelect[] = [];
	signatures: TDocumentSignatureSelect[] = [];
	images = new Map<string, TDocumentUserSignatureSelect>();
	transitionRacedFor = new Set<string>();
	private seq = 0;

	async findRequestById(id: string) {
		return this.requests.find((row) => row.id === id) ?? null;
	}

	async findPendingRequest(documentId: string, signerUserId: string) {
		return (
			this.requests.find(
				(row) =>
					row.documentId === documentId &&
					row.signerUserId === signerUserId &&
					row.status === 'pending',
			) ?? null
		);
	}

	async insertRequest(values: Record<string, unknown>) {
		const duplicate = await this.findPendingRequest(
			String(values.documentId),
			String(values.signerUserId),
		);
		if (duplicate) throw new SignatureRequestStateError();
		this.seq += 1;
		const row = requestRow({
			...values,
			id: `req-${this.seq}`,
		} as Partial<TDocumentSignatureRequestSelect>);
		this.requests.unshift(row);
		return row;
	}

	async transitionRequest(
		id: string,
		patch: {
			status: 'signed' | 'declined' | 'cancelled';
			respondedAt: Date;
			declineReason?: string | null;
		},
	) {
		const row = this.requests.find((candidate) => candidate.id === id);
		if (!row || row.status !== 'pending' || this.transitionRacedFor.has(id)) return null;
		row.status = patch.status;
		row.respondedAt = patch.respondedAt;
		row.declineReason = patch.declineReason ?? null;
		return row;
	}

	async insertSignature(values: Record<string, unknown>) {
		const row = {
			id: `sig-${this.signatures.length + 1}`,
			certificateSerial: null,
			...values,
		} as TDocumentSignatureSelect;
		this.signatures.push(row);
		return row;
	}

	async findUserSignature(userId: string) {
		return this.images.get(userId) ?? null;
	}

	async listUserSignatures(userIds: string[]) {
		return userIds.flatMap((id) => {
			const row = this.images.get(id);
			return row ? [row] : [];
		});
	}

	async upsertUserSignature(values: Record<string, unknown>, previousId: string | null) {
		if (previousId) this.images.clear();
		const row = {
			id: `img-${this.images.size + 1}`,
			...values,
		} as TDocumentUserSignatureSelect;
		this.images.set(row.userId, row);
		return row;
	}

	async softDeleteUserSignature(userId: string) {
		const row = this.images.get(userId) ?? null;
		if (row) this.images.delete(userId);
		return row;
	}

	async listSignaturesOfDocument(documentId: string) {
		return this.signatures.filter((row) => row.documentId === documentId);
	}

	async listRequestsOfDocument(documentId: string) {
		return this.requests.filter((row) => row.documentId === documentId);
	}

	async listOutgoing(requestedByUserId: string) {
		const rows = this.requests.filter((row) => row.requestedByUserId === requestedByUserId);
		return {
			meta: { page: 1, limit: 20, total: rows.length, totalPages: 1 },
			data: rows,
		};
	}

	async listIncoming(signerUserId: string) {
		const rows = this.requests.filter((row) => row.signerUserId === signerUserId);
		return {
			meta: { page: 1, limit: 20, total: rows.length, totalPages: 1 },
			data: rows,
		};
	}
}

class FakeDocumentRepository {
	document: TDocumentSelect | null = documentRow();

	async findById(id: string) {
		return this.document?.id === id ? this.document : null;
	}
}

const notifications: { userIds: string[]; templateCode: string; variables: Record<string, string> }[] =
	[];

const storage = {
	presignGet: (key: string) => `https://files.test/${key}`,
};

const users = {
	getUser: async (id: string) =>
		id === SIGNER
			? { id: SIGNER, name: 'Siti Rahmawati' }
			: id === REQUESTER
				? { id: REQUESTER, name: 'Budi Santoso' }
				: id === OTHER
					? { id: OTHER, name: 'Andi Wijaya' }
					: null,
};

function serviceWith(
	repository: FakeSignatureRepository,
	documents: FakeDocumentRepository = new FakeDocumentRepository(),
) {
	return new SignatureService(
		repository as unknown as ISignatureRepository,
		{
			notify: async (input: {
				userIds: string[];
				templateCode: string;
				variables?: Record<string, string>;
			}) => {
				notifications.push({
					userIds: input.userIds,
					templateCode: input.templateCode,
					variables: input.variables ?? {},
				});
			},
		} as never,
		documents as unknown as Pick<IDocumentRepository, 'findById'>,
		storage as never,
		{} as never,
		users as never,
	);
}

let repository: FakeSignatureRepository;
let documents: FakeDocumentRepository;
let service: SignatureService;

beforeEach(() => {
	notifications.length = 0;
	repository = new FakeSignatureRepository();
	documents = new FakeDocumentRepository();
	service = serviceWith(repository, documents);
});

describe('createRequests', () => {
	test('creates one pending request per resolvable signer and notifies them', async () => {
		const created = await service.createRequests(
			{
				documentId: documents.document!.id,
				signerUserIds: [SIGNER, OTHER],
				note: 'Please sign before Friday',
				expiresAt: null,
			},
			REQUESTER,
		);

		expect(created).toHaveLength(2);
		expect(created.every((row) => row.status === 'pending')).toBe(true);
		expect(repository.requests).toHaveLength(2);
		expect(notifications).toHaveLength(1);
		expect(notifications[0]).toMatchObject({
			userIds: [SIGNER, OTHER],
			templateCode: 'document.signature_requested',
		});
	});

	test('drops a signer id that does not resolve to a user', async () => {
		const created = await service.createRequests(
			{ documentId: documents.document!.id, signerUserIds: [SIGNER, 'ghost'], note: null, expiresAt: null },
			REQUESTER,
		);
		expect(created).toHaveLength(1);
		expect(created[0]?.signerUserId).toBe(SIGNER);
	});

	test('rejects a duplicate pending request for the same document and signer', async () => {
		await service.createRequests(
			{ documentId: documents.document!.id, signerUserIds: [SIGNER], note: null, expiresAt: null },
			REQUESTER,
		);
		await expect(
			service.createRequests(
				{ documentId: documents.document!.id, signerUserIds: [SIGNER], note: null, expiresAt: null },
				REQUESTER,
			),
		).rejects.toBeInstanceOf(SignatureRequestStateError);
	});

	test('rejects an unknown document', async () => {
		documents.document = null;
		await expect(
			service.createRequests(
				{ documentId: 'missing', signerUserIds: [SIGNER], note: null, expiresAt: null },
				REQUESTER,
			),
		).rejects.toBeInstanceOf(SignatureRequestNotFoundError);
	});
});

describe('sign', () => {
	test('writes the evidence row, flips the request and notifies the requester', async () => {
		const [request] = await service.createRequests(
			{ documentId: documents.document!.id, signerUserIds: [SIGNER], note: null, expiresAt: null },
			REQUESTER,
		);
		notifications.length = 0;

		const evidence = await service.sign(request!.id, SIGNER, '203.0.113.9');

		expect(evidence).toMatchObject({
			signerUserId: SIGNER,
			signerName: 'Siti Rahmawati',
			method: 'electronic',
			ipAddress: '203.0.113.9',
		});
		expect(repository.signatures).toHaveLength(1);
		expect(repository.requests[0]?.status).toBe('signed');
		expect(notifications[0]).toMatchObject({
			userIds: [REQUESTER],
			templateCode: 'document.signature_signed',
		});
	});

	test('records a self-reported wet-ink signature', async () => {
		const [request] = await service.createRequests(
			{ documentId: documents.document!.id, signerUserIds: [SIGNER], note: null, expiresAt: null },
			REQUESTER,
		);
		const evidence = await service.sign(request!.id, SIGNER, null, 'wet_ink');
		expect(evidence.method).toBe('wet_ink');
		expect(evidence.signerUserId).toBe(SIGNER);
	});

	test('rejects a caller the request is not addressed to', async () => {
		const [request] = await service.createRequests(
			{ documentId: documents.document!.id, signerUserIds: [SIGNER], note: null, expiresAt: null },
			REQUESTER,
		);
		await expect(service.sign(request!.id, OTHER, null)).rejects.toBeInstanceOf(
			NotRequestSignerError,
		);
	});

	test('rejects an already signed request', async () => {
		const [request] = await service.createRequests(
			{ documentId: documents.document!.id, signerUserIds: [SIGNER], note: null, expiresAt: null },
			REQUESTER,
		);
		await service.sign(request!.id, SIGNER, null);
		await expect(service.sign(request!.id, SIGNER, null)).rejects.toBeInstanceOf(
			SignatureRequestStateError,
		);
	});

	test('rejects an expired request without writing evidence', async () => {
		const [request] = await service.createRequests(
			{
				documentId: documents.document!.id,
				signerUserIds: [SIGNER],
				note: null,
				expiresAt: new Date(Date.now() - 60_000),
			},
			REQUESTER,
		);
		await expect(service.sign(request!.id, SIGNER, null)).rejects.toBeInstanceOf(
			SignatureRequestStateError,
		);
		expect(repository.signatures).toHaveLength(0);
	});

	test('rejects when the status transition lost a race', async () => {
		const [request] = await service.createRequests(
			{ documentId: documents.document!.id, signerUserIds: [SIGNER], note: null, expiresAt: null },
			REQUESTER,
		);
		repository.transitionRacedFor.add(request!.id);
		await expect(service.sign(request!.id, SIGNER, null)).rejects.toBeInstanceOf(
			SignatureRequestStateError,
		);
		expect(repository.signatures).toHaveLength(0);
	});

	test('rejects an unknown request id', async () => {
		await expect(service.sign('missing', SIGNER, null)).rejects.toBeInstanceOf(
			SignatureRequestNotFoundError,
		);
	});
});

describe('decline', () => {
	test('records the reason and notifies the requester', async () => {
		const [request] = await service.createRequests(
			{ documentId: documents.document!.id, signerUserIds: [SIGNER], note: null, expiresAt: null },
			REQUESTER,
		);
		notifications.length = 0;

		const row = await service.decline(request!.id, SIGNER, 'Nominal salah');

		expect(row.status).toBe('declined');
		expect(row.declineReason).toBe('Nominal salah');
		expect(notifications[0]).toMatchObject({
			userIds: [REQUESTER],
			templateCode: 'document.signature_declined',
		});
	});

	test('rejects a caller the request is not addressed to', async () => {
		const [request] = await service.createRequests(
			{ documentId: documents.document!.id, signerUserIds: [SIGNER], note: null, expiresAt: null },
			REQUESTER,
		);
		await expect(service.decline(request!.id, OTHER, 'no')).rejects.toBeInstanceOf(
			NotRequestSignerError,
		);
	});
});

describe('cancel', () => {
	test('lets the requester cancel a pending request', async () => {
		const [request] = await service.createRequests(
			{ documentId: documents.document!.id, signerUserIds: [SIGNER], note: null, expiresAt: null },
			REQUESTER,
		);
		const row = await service.cancel(request!.id, REQUESTER);
		expect(row.status).toBe('cancelled');
	});

	test('rejects a cancel from anyone but the requester', async () => {
		const [request] = await service.createRequests(
			{ documentId: documents.document!.id, signerUserIds: [SIGNER], note: null, expiresAt: null },
			REQUESTER,
		);
		await expect(service.cancel(request!.id, SIGNER)).rejects.toBeInstanceOf(
			NotRequestOwnerError,
		);
	});

	test('rejects cancelling a request that is no longer pending', async () => {
		const [request] = await service.createRequests(
			{ documentId: documents.document!.id, signerUserIds: [SIGNER], note: null, expiresAt: null },
			REQUESTER,
		);
		await service.sign(request!.id, SIGNER, null);
		await expect(service.cancel(request!.id, REQUESTER)).rejects.toBeInstanceOf(
			SignatureRequestStateError,
		);
	});
});

describe('expiry reads as expired', () => {
	test('a past-due pending row reads as expired and is hidden by pendingOnly', async () => {
		const [request] = await service.createRequests(
			{ documentId: documents.document!.id, signerUserIds: [SIGNER], note: null, expiresAt: null },
			REQUESTER,
		);
		expect(request).toBeDefined();
		repository.requests[0]!.expiresAt = new Date(Date.now() - 1_000);

		const all = await service.listOutgoing(REQUESTER, {
			page: 1,
			limit: 20,
			pendingOnly: null,
		});
		const pending = await service.listOutgoing(REQUESTER, {
			page: 1,
			limit: 20,
			pendingOnly: true,
		});

		expect(all.data[0]?.effectiveStatus).toBe('expired');
		expect(pending.data).toHaveLength(0);
	});
});

describe('signature image', () => {
	test('presigns the caller image', async () => {
		await service.uploadImage(SIGNER, `signatures/${SIGNER}/abc.webp`);
		expect(await service.myImage(SIGNER)).toBe(
			`https://files.test/signatures/${SIGNER}/abc.webp`,
		);
	});

	test('returns null when the caller has no image', async () => {
		expect(await service.myImage(SIGNER)).toBeNull();
	});

	test('replacing an image keeps exactly one live row per user', async () => {
		await service.uploadImage(SIGNER, `signatures/${SIGNER}/one.webp`);
		await service.uploadImage(SIGNER, `signatures/${SIGNER}/two.webp`);
		expect(repository.images.size).toBe(1);
		expect(await service.myImage(SIGNER)).toContain('two.webp');
	});

	test('batch lookup only returns users that have an image', async () => {
		await service.uploadImage(SIGNER, `signatures/${SIGNER}/abc.webp`);
		const urls = await service.userImages([SIGNER, OTHER]);
		expect(urls.size).toBe(1);
		expect(urls.get(SIGNER)).toContain('abc.webp');
	});

	test('deleting without an image is a not-found', async () => {
		await expect(service.deleteImage(SIGNER)).rejects.toBeInstanceOf(
			SignatureImageNotFoundError,
		);
	});

	test('deleting removes the live image', async () => {
		await service.uploadImage(SIGNER, `signatures/${SIGNER}/abc.webp`);
		await service.deleteImage(SIGNER);
		expect(await service.myImage(SIGNER)).toBeNull();
	});
});
