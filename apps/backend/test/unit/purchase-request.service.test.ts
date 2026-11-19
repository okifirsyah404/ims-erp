/**
 * Purchase requests (M05, owner decisions 2026-11-15): item and free-text
 * lines with estimated totals, the requester-only edits / submit / cancel,
 * numbering on the first submit (kept after a rejection), one-level approval
 * never by the requester, rejection back to draft with the reason, cancelling
 * refused once a line is on a purchase order; and the purchase order side
 * mapping a refused request line to its error.
 */
import { beforeEach, describe, expect, test } from 'bun:test';
import type {
	PurchaseRequestStatus,
	TPurchaseRequestItemSelect,
	TPurchaseRequestSelect,
} from '@drizzle/schemas/procurement.schema';
import type {
	IPurchaseRequestRepository,
	TPurchaseRequestLineView,
} from '../../src/app/procurement/contracts/procurement.repository.interface';
import { purchaseRequestBodySchema } from '../../src/app/procurement/contracts/purchase-request.contract';
import {
	PurchaseOrderItemUnavailableError,
	PurchaseRequestNotOwnerError,
	PurchaseRequestSelfApprovalError,
	PurchaseRequestStateError,
} from '../../src/app/procurement/errors/procurement.errors';
import { PurchaseRequestService } from '../../src/app/procurement/services/purchase-request.service';

const ITEM = '0190a1b2-0000-7000-8000-00000000e001';
const REQUESTER = { userId: 'tech-1', name: 'Budi Teknisi', organizationId: 'org-1' };
const MANAGER = 'ops-1';

class FakeRequests implements IPurchaseRequestRepository {
	rows: TPurchaseRequestSelect[] = [];
	lines = new Map<string, TPurchaseRequestItemSelect[]>();
	ordered = new Set<string>();
	async paginate() {
		return { meta: { page: 1, limit: 20, total: this.rows.length, totalPages: 1 }, data: this.rows };
	}
	async findById(id: string) {
		return this.rows.find((row) => row.id === id) ?? null;
	}
	async findLines(id: string): Promise<TPurchaseRequestLineView[]> {
		return (this.lines.get(id) ?? []).map((line) => ({ ...line, purchaseOrderId: null, purchaseOrderCode: null, purchaseOrderStatus: null }));
	}
	async create(header: Parameters<IPurchaseRequestRepository['create']>[0], items: Parameters<IPurchaseRequestRepository['create']>[1]) {
		const row = { ...header, id: crypto.randomUUID(), code: null, status: 'draft', rejectionReason: null } as TPurchaseRequestSelect;
		this.rows.push(row);
		this.lines.set(row.id, items as TPurchaseRequestItemSelect[]);
		return row;
	}
	async replaceDraft(id: string, header: object, items: unknown[]) {
		const row = await this.findById(id);
		if (!row || row.status !== 'draft') return null;
		this.lines.set(id, items as TPurchaseRequestItemSelect[]);
		return Object.assign(row, header);
	}
	async transition(id: string, from: readonly PurchaseRequestStatus[], to: PurchaseRequestStatus, patch: object) {
		const row = await this.findById(id);
		if (!row || !from.includes(row.status)) return null;
		return Object.assign(row, patch, { status: to });
	}
	async hasOrderedLines(id: string) {
		return this.ordered.has(id);
	}
	async cancelUnordered(id: string, from: readonly PurchaseRequestStatus[], patch: object) {
		if (this.ordered.has(id)) return 'ordered' as const;
		return this.transition(id, from, 'cancelled', patch);
	}
	async openLines() {
		return [];
	}
}

let repo: FakeRequests;
let service: PurchaseRequestService;
let numbered: { type: string; date?: Date }[];
let searched: unknown[];
const QR50 = { id: ITEM, sku: 'QR50', name: 'QR50 Mifare', specification: 'Color: Black', unitLabel: 'pcs', purchasePrice: 190_000_000 };

const body = (extra: Record<string, unknown> = {}) =>
	purchaseRequestBodySchema.parse({
		subject: 'Kabel dan reader untuk proyek Gym Jakarta',
		requestDate: '2026-11-15',
		neededBy: '2026-11-20',
		lines: [
			{ productId: ITEM, quantity: '2' },
			{ name: 'Kabel UTP Cat6 roll 305m', unit: 'roll', quantity: '1.5', estimatedUnitPrice: 150_000_000 },
		],
		...extra,
	});

beforeEach(() => {
	repo = new FakeRequests();
	numbered = [];
	searched = [];
	service = new PurchaseRequestService(
		repo,
		{
			getActiveProducts: async (ids: string[]) => (ids.includes(ITEM) ? ([QR50] as never) : []),
			paginate: async (request) => {
				searched.push(request);
				return { meta: { page: 1, limit: 20, total: 1, totalPages: 1 }, data: [{ ...QR50, isActive: true, imageUrl: 'x' }] as never };
			},
		},
		{
			next: async (type, options) => {
				numbered.push({ type, date: options?.date });
				return `000${numbered.length}/PR/IMS/XI/26`;
			},
		},
	);
});

describe('drafting', () => {
	test('item lines take the master snapshot and price; free-text lines keep what was typed', async () => {
		const request = await service.create(REQUESTER, body());
		const lines = repo.lines.get(request.id)!;
		expect(lines[0]).toMatchObject({ productId: ITEM, sku: 'QR50', name: 'QR50 Mifare', unit: 'pcs', estimatedUnitPrice: 190_000_000, estimatedTotal: 380_000_000 });
		expect(lines[1]).toMatchObject({ productId: null, sku: null, name: 'Kabel UTP Cat6 roll 305m', unit: 'roll', estimatedTotal: 225_000_000 });
		expect(request).toMatchObject({
			estimatedTotal: 605_000_000,
			requestedBy: 'tech-1',
			requestedByName: 'Budi Teknisi',
			organizationId: 'org-1',
			status: 'draft',
			code: null,
		});
	});

	test('a free-text line needs a name and a unit; needed-by cannot precede the request date', () => {
		expect(() => body({ lines: [{ quantity: '1' }] })).toThrow();
		expect(() => body({ neededBy: '2026-11-01' })).toThrow();
		expect(() => body({ lines: [{ productId: ITEM, quantity: '0' }] })).toThrow();
	});

	test('an inactive or unknown item is refused with its line number', async () => {
		await expect(
			service.create(REQUESTER, body({ lines: [{ productId: '0190a1b2-0000-7000-8000-00000000e999', quantity: '1' }] })),
		).rejects.toBeInstanceOf(PurchaseOrderItemUnavailableError);
	});

	test('only the requester edits their draft', async () => {
		const request = await service.create(REQUESTER, body());
		await expect(service.update('someone-else', request.id, body())).rejects.toBeInstanceOf(PurchaseRequestNotOwnerError);
		const updated = await service.update('tech-1', request.id, body({ subject: 'Revisi' }));
		expect(updated.subject).toBe('Revisi');
	});
});

describe('item search for requesters', () => {
	test('active items only, with just the fields a request needs', async () => {
		const found = await service.searchItems('qr');
		expect(searched).toEqual([{ page: 1, limit: 20, search: 'qr', activeOnly: true }]);
		expect(found).toEqual([QR50]);
	});
});

describe('approval', () => {
	test('numbered on the first submit from the request date, and the number survives a rejection', async () => {
		const request = await service.create(REQUESTER, body());
		await expect(service.submit('someone-else', request.id)).rejects.toBeInstanceOf(PurchaseRequestNotOwnerError);
		const submitted = await service.submit('tech-1', request.id);
		expect(submitted).toMatchObject({ status: 'submitted', code: '0001/PR/IMS/XI/26' });
		expect(numbered[0]).toEqual({ type: 'purchase_request', date: new Date('2026-11-15T12:00:00+07:00') });
		await expect(service.update('tech-1', request.id, body())).rejects.toBeInstanceOf(PurchaseRequestStateError);

		const rejected = await service.reject(MANAGER, request.id, 'Pakai stok gudang dulu');
		expect(rejected).toMatchObject({ status: 'draft', rejectionReason: 'Pakai stok gudang dulu' });
		const again = await service.submit('tech-1', request.id);
		expect(again).toMatchObject({ status: 'submitted', code: '0001/PR/IMS/XI/26', rejectionReason: null });
		expect(numbered).toHaveLength(1);
	});

	test('one level, never by the requester, only from submitted', async () => {
		const request = await service.create(REQUESTER, body());
		await expect(service.approve(MANAGER, request.id)).rejects.toBeInstanceOf(PurchaseRequestStateError);
		await service.submit('tech-1', request.id);
		await expect(service.approve('tech-1', request.id)).rejects.toBeInstanceOf(PurchaseRequestSelfApprovalError);
		await expect(service.reject('tech-1', request.id, 'x')).rejects.toBeInstanceOf(PurchaseRequestSelfApprovalError);
		const approved = await service.approve(MANAGER, request.id);
		expect(approved).toMatchObject({ status: 'approved', approvedBy: MANAGER });
		await expect(service.approve(MANAGER, request.id)).rejects.toBeInstanceOf(PurchaseRequestStateError);
	});
});

describe('cancelling', () => {
	test('the requester cancels a draft, submitted or approved request', async () => {
		const request = await service.create(REQUESTER, body());
		await expect(service.cancel('someone-else', request.id, 'x')).rejects.toBeInstanceOf(PurchaseRequestNotOwnerError);
		await service.submit('tech-1', request.id);
		await service.approve(MANAGER, request.id);
		const cancelled = await service.cancel('tech-1', request.id, 'Tidak jadi');
		expect(cancelled).toMatchObject({ status: 'cancelled', cancelledBy: 'tech-1', cancelledReason: 'Tidak jadi' });
		await expect(service.cancel('tech-1', request.id, 'again')).rejects.toBeInstanceOf(PurchaseRequestStateError);
	});

	test('refused once a line is on a purchase order', async () => {
		const request = await service.create(REQUESTER, body());
		await service.submit('tech-1', request.id);
		await service.approve(MANAGER, request.id);
		repo.ordered.add(request.id);
		await expect(service.cancel('tech-1', request.id, 'x')).rejects.toBeInstanceOf(PurchaseRequestStateError);
		expect(repo.rows[0]!.status).toBe('approved');
	});
});
