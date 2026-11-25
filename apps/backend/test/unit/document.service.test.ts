/**
 * Document service unit tests for the files, share links and public view
 * (ERP-0044).
 *
 * @remarks
 * The repository and object storage are fakes: the rules under test are the
 * service's (void documents take no files, downloads append a `download` row,
 * a share token is its own uuid, an expired or revoked link answers 404). The
 * SQL itself is checked against PostgreSQL by the live verification recorded
 * in `docs/plan/progress.md`.
 */
import { beforeEach, describe, expect, test } from 'bun:test';
import type {
	TDocumentAccessLogSelect,
	TDocumentFileSelect,
	TDocumentSelect,
	TDocumentShareSelect,
} from '@drizzle/schemas/document.schema';
import type { IDocumentRepository } from '../../src/app/document/contracts/document.repository.interface';
import {
	DocumentFileNotFoundError,
	DocumentFileStateError,
	DocumentNotFoundError,
	DocumentShareNotFoundError,
} from '../../src/app/document/errors/document.errors';
import { DocumentService } from '../../src/app/document/services/document.service';

const ORG = 'org_1';
const USER = 'user_1';

function documentRow(overrides: Partial<TDocumentSelect> = {}): TDocumentSelect {
	const now = new Date();
	return {
		id: '01930000-0000-7000-8000-000000000001',
		organizationId: ORG,
		code: 'INV-00001',
		documentType: 'invoice',
		title: 'Invoice 1',
		templateId: null,
		module: 'accounting',
		sourceType: 'sales_invoice',
		sourceId: 'inv_1',
		status: 'issued',
		issuedOn: '2026-11-13',
		issuedByUserId: USER,
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

class FakeRepository {
	document: TDocumentSelect | null = documentRow();
	files: TDocumentFileSelect[] = [];
	shares: TDocumentShareSelect[] = [];
	trail: { action: string; accessedByUserId: string | null }[] = [];

	async findById(id: string) {
		return this.document?.id === id ? this.document : null;
	}

	async paginate() {
		const rows = this.document ? [this.document] : [];
		return {
			meta: { page: 1, limit: 20, total: rows.length, totalPages: rows.length ? 1 : 0 },
			data: rows,
		};
	}

	async latestFiles(documentIds: string[]) {
		return this.files
			.filter((file) => documentIds.includes(file.documentId))
			.sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime());
	}

	async findLiveBySource(module: string, sourceType: string, sourceId: string) {
		const doc = this.document;
		return doc && doc.status !== 'void' && doc.module === module && doc.sourceType === sourceType && doc.sourceId === sourceId
			? doc
			: null;
	}

	async logAccess(entry: { action: string; accessedByUserId: string | null }) {
		this.trail.push(entry);
	}

	async listAccessTrail() {
		return [] as TDocumentAccessLogSelect[];
	}

	async listFiles() {
		return this.files;
	}

	async findFile(_documentId: string, fileId: string) {
		return this.files.find((file) => file.id === fileId) ?? null;
	}

	async insertFile(values: Omit<TDocumentFileSelect, 'id' | 'deletedAt'>) {
		const row = { ...values, id: `file_${this.files.length + 1}`, deletedAt: null } as TDocumentFileSelect;
		this.files.push(row);
		return row;
	}

	async softDeleteFile(fileId: string) {
		const row = this.files.find((file) => file.id === fileId);
		if (!row) return null;
		row.deletedAt = new Date();
		this.files = this.files.filter((file) => file.id !== fileId);
		return row;
	}

	async listShares() {
		return this.shares;
	}

	async insertShare(values: Omit<TDocumentShareSelect, 'id' | 'deletedAt'>) {
		const row = { ...values, id: `share_${this.shares.length + 1}`, deletedAt: null } as TDocumentShareSelect;
		this.shares.push(row);
		return row;
	}

	async findShareByToken(token: string) {
		return this.shares.find((share) => share.token === token && !share.isRevoked) ?? null;
	}

	async revokeShare(shareId: string) {
		const row = this.shares.find((share) => share.id === shareId);
		if (!row) return null;
		row.isRevoked = true;
		return row;
	}
}

const stored: string[] = [];
const storage = {
	put: async (key: string) => {
		stored.push(key);
	},
	presignGet: (key: string) => `https://files.test/${key}`,
};

let repository: FakeRepository;
let service: DocumentService;

/** The newest access-trail row (the fake appends in call order). */
function lastTrail() {
	return repository.trail[repository.trail.length - 1];
}

function serviceWith(repo: FakeRepository) {
	return new DocumentService(repo as unknown as IDocumentRepository, storage);
}

beforeEach(() => {
	stored.length = 0;
	repository = new FakeRepository();
	service = serviceWith(repository);
});

describe('document files', () => {
	test('uploads under a fresh key and keeps the file name', async () => {
		const file = new File(['hello'], 'scan.pdf', { type: 'application/pdf' });
		const view = await service.uploadFile(repository.document!.id, { file }, USER);

		expect(view.fileName).toBe('scan.pdf');
		expect(view.sizeBytes).toBe(5);
		expect(view.url).toContain('https://files.test/documents/');
		expect(stored).toHaveLength(1);
	});

	test('rejects a void document', async () => {
		repository.document = documentRow({ status: 'void' });
		const file = new File(['x'], 'scan.pdf', { type: 'application/pdf' });
		await expect(service.uploadFile(repository.document!.id, { file }, USER)).rejects.toBeInstanceOf(
			DocumentFileStateError,
		);
	});

	test('rejects a missing document', async () => {
		repository.document = null;
		await expect(service.deleteFile('missing', 'file_1', USER)).rejects.toBeInstanceOf(
			DocumentNotFoundError,
		);
	});

	test('a download appends a download row with the request metadata', async () => {
		const file = new File(['x'], 'scan.pdf', { type: 'application/pdf' });
		const uploaded = await service.uploadFile(repository.document!.id, { file }, USER);
		const result = await service.downloadFile(repository.document!.id, uploaded.id, USER, {
			ipAddress: '203.0.113.5',
			userAgent: 'bun-test',
		});

		expect(result.url).toContain('https://files.test/documents/');
		expect(lastTrail()).toMatchObject({
			action: 'download',
			accessedByUserId: USER,
			ipAddress: '203.0.113.5',
			userAgent: 'bun-test',
		});
	});

	test('a deleted file is gone from the list and no longer downloadable', async () => {
		const file = new File(['x'], 'scan.pdf', { type: 'application/pdf' });
		const uploaded = await service.uploadFile(repository.document!.id, { file }, USER);
		await service.deleteFile(repository.document!.id, uploaded.id, USER);

		expect(repository.files).toHaveLength(0);
		await expect(
			service.downloadFile(repository.document!.id, uploaded.id, USER),
		).rejects.toBeInstanceOf(DocumentFileNotFoundError);
	});
});

describe('document share links', () => {
	test('the token is its own uuid and expiry is mandatory', async () => {
		const share = await service.createShare(repository.document!.id, 30, USER);
		expect(share.token).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-/);
		expect(share.token).not.toBe(share.id);
		expect(share.expiresAt).not.toBeNull();
		expect(lastTrail()?.action).toBe('share');
	});

	test('a public link exposes the narrow view and logs an anonymous view', async () => {
		const share = await service.createShare(repository.document!.id, 30, USER);
		const view = await service.resolvePublicShare(share.token);

		expect(view.code).toBe('INV-00001');
		expect(view).not.toHaveProperty('organizationId');
		expect(lastTrail()).toMatchObject({ action: 'view', accessedByUserId: null });
	});

	test('an expired link is rejected', async () => {
		const share = await service.createShare(repository.document!.id, 1, USER);
		repository.shares[0].expiresAt = new Date(Date.now() - 1000);
		await expect(service.resolvePublicShare(share.token)).rejects.toBeInstanceOf(
			DocumentShareNotFoundError,
		);
	});

	test('a revoked link is rejected', async () => {
		const share = await service.createShare(repository.document!.id, 30, USER);
		await service.revokeShare(repository.document!.id, share.id);
		await expect(service.resolvePublicShare(share.token)).rejects.toBeInstanceOf(
			DocumentShareNotFoundError,
		);
	});

	test('a voided document is not reachable through an existing link', async () => {
		const share = await service.createShare(repository.document!.id, 30, USER);
		repository.document = documentRow({ status: 'void' });
		await expect(service.resolvePublicShare(share.token)).rejects.toBeInstanceOf(
			DocumentShareNotFoundError,
		);
	});

	test('revoking a share of another document is rejected', async () => {
		const share = await service.createShare(repository.document!.id, 30, USER);
		const other = documentRow({ id: '01930000-0000-7000-8000-0000000000ff' });
		repository.document = other;
		await expect(service.revokeShare(other.id, share.id)).rejects.toBeInstanceOf(
			DocumentShareNotFoundError,
		);
	});
});

describe('document list previews', () => {
	test('a row carries the newest file and the preview writes no trail row', async () => {
		const first = new File(['a'], 'original.pdf', { type: 'application/pdf' });
		const second = new File(['bb'], 'signed.pdf', { type: 'application/pdf' });
		await service.uploadFile(repository.document!.id, { file: first }, USER);
		repository.files[0].uploadedAt = new Date(Date.now() - 60_000);
		await service.uploadFile(repository.document!.id, { file: second }, USER);

		const page = await service.list({ page: 1, limit: 20, search: null, status: null, documentType: null, organizationId: null });

		expect(page.data[0].preview).toMatchObject({ fileName: 'signed.pdf', mimeType: 'application/pdf' });
		expect(page.data[0].preview?.url).toContain('https://files.test/documents/');
		expect(repository.trail).toHaveLength(0);
	});

	test('a row with no file has a null preview', async () => {
		const page = await service.list({ page: 1, limit: 20, search: null, status: null, documentType: null, organizationId: null });
		expect(page.data[0].preview).toBeNull();
	});
});

describe('document detail', () => {
	test('returns the row with its files, live links and the trail', async () => {
		const file = new File(['x'], 'scan.pdf', { type: 'application/pdf' });
		await service.uploadFile(repository.document!.id, { file }, USER);
		await service.createShare(repository.document!.id, 30, USER);

		const detail = await service.detail(repository.document!.id, USER);
		expect(detail.files).toHaveLength(1);
		expect(detail.shares).toHaveLength(1);
		expect(lastTrail()).toMatchObject({ action: 'view', accessedByUserId: USER });
	});
});

describe('generated files (ERP-0067)', () => {
	const source = { module: 'accounting', sourceType: 'sales_invoice', sourceId: 'inv_1' };
	const pdf = () => new File([new Uint8Array([37, 80, 68, 70])], 'INV-00001.pdf', { type: 'application/pdf' });

	test('attaches to the live registry row of the source, without a user', async () => {
		const id = await service.attachGeneratedFile(source, pdf(), null);
		expect(id).toBe(repository.document!.id);
		expect(repository.files[0]).toMatchObject({ fileName: 'INV-00001.pdf', mimeType: 'application/pdf', uploadedByUserId: null });
		expect(stored[0]).toStartWith(`documents/${repository.document!.id}/`);
	});

	test('a source that was never registered, or is void, gets nothing', async () => {
		expect(await service.attachGeneratedFile({ ...source, sourceId: 'other' }, pdf(), null)).toBeNull();
		repository.document!.status = 'void';
		expect(await service.attachGeneratedFile(source, pdf(), null)).toBeNull();
		expect(repository.files).toHaveLength(0);
	});

	test('a public link resolves to the newest file and logs an anonymous download', async () => {
		await service.attachGeneratedFile(source, pdf(), null);
		const share = await service.createShare(repository.document!.id, 30, null);
		const url = await service.resolvePublicFile(share.token);
		expect(url).toStartWith(`https://files.test/documents/${repository.document!.id}/`);
		expect(lastTrail()).toMatchObject({ action: 'download', accessedByUserId: null });
	});

	test('a link to a document with no file, or a revoked link, answers not found', async () => {
		const share = await service.createShare(repository.document!.id, 30, null);
		await expect(service.resolvePublicFile(share.token)).rejects.toBeInstanceOf(DocumentFileNotFoundError);
		await service.attachGeneratedFile(source, pdf(), null);
		repository.shares[0].isRevoked = true;
		await expect(service.resolvePublicFile(share.token)).rejects.toBeInstanceOf(DocumentShareNotFoundError);
	});
});
