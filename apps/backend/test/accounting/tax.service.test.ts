/**
 * TaxService unit tests (ERP-0016).
 *
 * The repository is a hand-written in-memory double; the service rules are
 * what is under test: state-machine edges, draft-only edits, corrections
 * (signed, tax_amount untouched), and rate-window overlap.
 */
import 'reflect-metadata';
import { beforeEach, describe, expect, test } from 'bun:test';
import { TaxService } from '../../src/app/accounting/services/tax.service';
import type {
	TTaxCorrectionSelect,
	TTaxRecordSelect,
	TTaxTypeSelect,
	TWithholdingTaxRecordSelect,
} from '@drizzle/schemas/accounting.schema';

const ORG = 'org-1';
const ACTOR = 'user-1';
const ctx = { organizationId: ORG, actorUserId: ACTOR };

function taxTypeRow(overrides: Partial<TTaxTypeSelect> = {}): TTaxTypeSelect {
	return {
		id: 'tt-1',
		organizationId: ORG,
		code: 'PPN',
		name: 'PPN',
		taxType: 'vat',
		rate: '11',
		baseType: 'gross',
		isInclusive: false,
		effectiveFrom: '2026-01-01',
		effectiveTo: null,
		isActive: true,
		createdAt: new Date(),
		updatedAt: new Date(),
		deletedAt: null,
		...overrides,
	} as TTaxTypeSelect;
}

function taxRecordRow(overrides: Partial<TTaxRecordSelect> = {}): TTaxRecordSelect {
	return {
		id: 'tr-1',
		organizationId: ORG,
		code: 'TR-202601-AAAAAAAA',
		taxTypeId: 'tt-1',
		periodYear: 2026,
		periodMonth: 1,
		taxableBase: 100_000_000,
		taxAmount: 11_000_000,
		filingStatus: 'draft',
		verifiedBy: null,
		filedOn: null,
		notes: null,
		createdAt: new Date(),
		updatedAt: new Date(),
		deletedAt: null,
		...overrides,
	} as TTaxRecordSelect;
}

/** In-memory store + repo double covering only what the tests exercise. */
function makeHarness() {
	const types = new Map<string, TTaxTypeSelect>([['tt-1', taxTypeRow()]]);
	const records = new Map<string, TTaxRecordSelect>([['tr-1', taxRecordRow()]]);
	const corrections: TTaxCorrectionSelect[] = [];
	let correctionSequence = 0;

	const repo = {
		findTaxTypesByCode: async () => [...types.values()],
		listTaxTypes: async () => ({
			data: [...types.values()],
			meta: { page: 1, limit: 20, total: types.size, totalPages: 1 },
		}),
		findTaxTypeById: async (_org: string, id: string) => types.get(id) ?? null,
		insertTaxType: async (row: Record<string, unknown>) => {
			const created = taxTypeRow({ id: 'tt-new', ...row } as never);
			types.set(created.id, created);
			return created;
		},
		updateTaxType: async () => null,
		softDeleteTaxType: async () => true,
		countReferencesToTaxType: async () => 0,
		listTaxRecords: async () => ({
			data: [...records.values()],
			meta: { page: 1, limit: 20, total: records.size, totalPages: 1 },
		}),
		findTaxRecordById: async (_org: string, id: string) => records.get(id) ?? null,
		findTaxRecordByPeriod: async () => null,
		insertTaxRecord: async (row: Record<string, unknown>) => {
			const created = taxRecordRow({ id: 'tr-new', ...row } as never);
			records.set(created.id, created);
			return created;
		},
		updateDraftTaxRecord: async (
			org: string,
			id: string,
			patch: Record<string, unknown>,
		) => {
			const row = records.get(id);
			if (!row || row.organizationId !== org || row.filingStatus !== 'draft')
				return null;
			const updated = { ...row, ...patch, updatedAt: new Date() };
			records.set(id, updated);
			return updated;
		},
		transitionTaxRecord: async (
			org: string,
			id: string,
			from: string,
			to: string,
			extra: Record<string, unknown>,
		) => {
			const row = records.get(id);
			if (!row || row.organizationId !== org || row.filingStatus !== from)
				return null;
			const updated = { ...row, filingStatus: to, ...extra, updatedAt: new Date() };
			records.set(id, updated);
			return updated;
		},
		recap: async () => ({ lines: [], totalNetPayable: 0 }),
		listCorrections: async () => corrections,
		insertCorrection: async (row: Record<string, unknown>) => {
			correctionSequence += 1;
			const created = {
				id: `corr-${correctionSequence}`,
				...row,
				createdAt: new Date(),
			} as TTaxCorrectionSelect;
			corrections.push(created);
			return created;
		},
		listWithholding: async () => ({
			data: [] as TWithholdingTaxRecordSelect[],
			meta: { page: 1, limit: 20, total: 0, totalPages: 1 },
		}),
		findWithholdingById: async () => null,
		insertWithholding: async () => null,
		updateRecordedWithholding: async () => null,
		transitionWithholding: async () => null,
	};

	return { repo: repo as never, types, records, corrections };
}

describe('TaxService — record state machine', () => {
	let service: TaxService;
	let records: Map<string, TTaxRecordSelect>;

	beforeEach(() => {
		const harness = makeHarness();
		service = new TaxService(harness.repo);
		records = harness.records;
	});

	test('draft → verified → filed succeeds and stamps verifier and date', async () => {
		await service.transitionTaxRecord('tr-1', 'verified', null, ctx);
		expect(records.get('tr-1')?.filingStatus).toBe('verified');
		expect(records.get('tr-1')?.verifiedBy).toBe(ACTOR);

		await service.transitionTaxRecord('tr-1', 'filed', '2026-02-10', ctx);
		expect(records.get('tr-1')?.filingStatus).toBe('filed');
		expect(records.get('tr-1')?.filedOn).toBe('2026-02-10');
	});

	test('draft → filed is rejected (verification cannot be skipped)', async () => {
		await expect(
			service.transitionTaxRecord('tr-1', 'filed', null, ctx),
		).rejects.toThrow();
		expect(records.get('tr-1')?.filingStatus).toBe('draft');
	});

	test('filed → verified is rejected (filed is terminal)', async () => {
		records.set('tr-1', taxRecordRow({ filingStatus: 'filed', filedOn: '2026-02-01' }));
		await expect(
			service.transitionTaxRecord('tr-1', 'verified', null, ctx),
		).rejects.toThrow();
	});

	test('a record in another tenant cannot be transitioned', async () => {
		// The repository is tenant-scoped, so the row reads as absent and the
		// transition fails as an illegal edge rather than leaking existence.
		await expect(
			service.transitionTaxRecord('tr-1', 'verified', null, {
				organizationId: 'org-other',
				actorUserId: ACTOR,
			}),
		).rejects.toThrow('That status change is not allowed');
		expect(records.get('tr-1')?.filingStatus).toBe('draft');
	});
});

describe('TaxService — draft-only edits', () => {
	let service: TaxService;
	let records: Map<string, TTaxRecordSelect>;

	beforeEach(() => {
		const harness = makeHarness();
		service = new TaxService(harness.repo);
		records = harness.records;
	});

	test('a draft record accepts base and amount edits', async () => {
		const row = await service.updateDraftTaxRecord(
			'tr-1',
			{ taxableBase: 200_000_000, taxAmount: 22_000_000 },
			ctx,
		);
		expect(row.taxableBase).toBe(200_000_000);
		expect(row.taxAmount).toBe(22_000_000);
	});

	test('a verified record is locked; changes go through corrections', async () => {
		records.set('tr-1', taxRecordRow({ filingStatus: 'verified', verifiedBy: ACTOR }));
		await expect(
			service.updateDraftTaxRecord('tr-1', { taxableBase: 1 }, ctx),
		).rejects.toThrow('Tax record is no longer editable');
	});
});

describe('TaxService — corrections', () => {
	let service: TaxService;
	let records: Map<string, TTaxRecordSelect>;
	let corrections: TTaxCorrectionSelect[];

	beforeEach(() => {
		const harness = makeHarness();
		service = new TaxService(harness.repo);
		records = harness.records;
		corrections = harness.corrections;
	});

	test('a correction on a verified record is signed and flips it to corrected', async () => {
		records.set('tr-1', taxRecordRow({ filingStatus: 'verified', verifiedBy: ACTOR }));
		const correction = await service.addCorrection(
			'tr-1',
			{ amount: -500_000, reason: 'Over-declared base', evidenceDocumentId: null },
			ctx,
		);
		expect(correction.amount).toBe(-500_000);
		expect(correction.createdBy).toBe(ACTOR);
		expect(records.get('tr-1')?.filingStatus).toBe('corrected');
		// tax_amount is untouched by design (D15).
		expect(records.get('tr-1')?.taxAmount).toBe(11_000_000);
		expect(corrections).toHaveLength(1);
	});

	test('a draft record cannot take a correction; edit it instead', async () => {
		await expect(
			service.addCorrection(
				'tr-1',
				{ amount: 1, reason: 'x', evidenceDocumentId: null },
				ctx,
			),
		).rejects.toThrow();
		expect(corrections).toHaveLength(0);
		expect(records.get('tr-1')?.filingStatus).toBe('draft');
	});
});

describe('TaxService — rate windows', () => {
	test('a second active row for the same code that overlaps is rejected', async () => {
		const harness = makeHarness();
		harness.types.set(
			'tt-1',
			taxTypeRow({ effectiveFrom: '2026-01-01', effectiveTo: '2026-12-31' }),
		);
		harness.types.set(
			'tt-2',
			taxTypeRow({ id: 'tt-2', effectiveFrom: '2026-03-01', effectiveTo: null }),
		);
		const service = new TaxService(harness.repo);
		await expect(
			service.createTaxType(
				{
					code: 'PPN',
					name: 'PPN new',
					taxType: 'vat',
					rate: '12',
					baseType: 'gross',
					isInclusive: false,
					effectiveFrom: '2026-06-01',
					effectiveTo: null,
					isActive: true,
				},
				ctx,
			),
		).rejects.toThrow('overlaps');
	});

	test('a non-overlapping successor window is accepted', async () => {
		const harness = makeHarness();
		harness.types.set(
			'tt-1',
			taxTypeRow({ effectiveFrom: '2026-01-01', effectiveTo: '2026-12-31' }),
		);
		const service = new TaxService(harness.repo);
		const created = await service.createTaxType(
			{
				code: 'PPN',
				name: 'PPN new',
				taxType: 'vat',
				rate: '12',
				baseType: 'gross',
				isInclusive: false,
				effectiveFrom: '2027-01-01',
				effectiveTo: null,
				isActive: true,
			},
			ctx,
		);
		expect(created.rate).toBe('12');
	});
});

describe('TaxService — preview', () => {
	test('previews tax from the rate effective on the given date', async () => {
		const harness = makeHarness();
		const service = new TaxService(harness.repo);
		const preview = await service.previewTax(ORG, {
			taxTypeId: 'tt-1',
			taxableBase: 122_500,
			date: '2026-06-15',
		});
		// 2%... no: PPN 11% of 1,225.00 = 134.75 -> half-up 135 IDR
		expect(preview.taxAmount).toBe(13_500);
		expect(preview.rate).toBe('11');
	});
});
