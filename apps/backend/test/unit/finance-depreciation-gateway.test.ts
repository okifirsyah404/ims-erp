/**
 * Finance (ADR-0024 P5): depreciation entries (idempotent per item and period,
 * the valuation change goes through inventory's `applyDepreciation`) and the
 * payment gateway configuration (secrets sealed with AES-256-GCM, never
 * returned; only the last four characters are visible).
 */
import { beforeEach, describe, expect, test } from 'bun:test';
import type { TAssetDepreciationSelect } from '@drizzle/schemas/finance.schema';
import type { TGatewaySelect as TPaymentGatewaySelect } from '@drizzle/schemas/payment.schema';
import { DepreciationPeriodTakenError } from '../../src/app/finance/errors/depreciation.errors';
import { DepreciationService } from '../../src/app/finance/services/depreciation.service';
import { ItemNotFoundError, ItemRuleViolationError } from '../../src/app/inventory/errors/item.errors';
import { GatewayNotFoundError, GatewaySecretKeyMissingError } from '../../src/app/payment/errors/payment-gateway.errors';
import { GatewayConfigService } from '../../src/app/payment/services/gateway-config.service';
import { openSecret, paymentSecretKey, sealSecret } from '../../src/app/payment/utils/secret-cipher';

const ORG = 'org-1';
const ITEM = '0190a1b2-0000-7000-8000-0000000000a1';
const KEY = 'a'.repeat(64);

/* ------------------------------- depreciation ------------------------------ */

let entries: TAssetDepreciationSelect[];
let item: { id: string; organizationId: string; bookValue: number; accumulatedDepreciation: number; currencyCode: string; depreciationMethod: string | null };
let applied: number[];
let service: DepreciationService;

beforeEach(() => {
	entries = [];
	item = {
		id: ITEM,
		organizationId: ORG,
		bookValue: 10_000_000,
		accumulatedDepreciation: 1_000_000,
		currencyCode: 'IDR',
		depreciationMethod: 'straight_line',
	};
	applied = [];
	service = new DepreciationService(
		{
			findPeriod: async (itemId, year, month) =>
				entries.find((row) => row.itemId === itemId && row.periodYear === year && row.periodMonth === month) ?? null,
			create: async (data) => {
				const row = { id: `dep-${entries.length + 1}`, ...data } as TAssetDepreciationSelect;
				entries.push(row);
				return row;
			},
			list: async () => ({ meta: { page: 1, limit: 20, total: entries.length, totalPages: 1 }, data: entries }),
		} as never,
		{
			getItem: async (id: string) => {
				if (id !== item.id) throw new ItemNotFoundError();
				return item as never;
			},
			applyDepreciation: async (_id: string, organizationId: string, amount: number) => {
				if (organizationId !== item.organizationId) throw new ItemNotFoundError();
				if (amount > item.bookValue) throw new ItemRuleViolationError('depreciation_exceeds_book_value');
				item.bookValue -= amount;
				item.accumulatedDepreciation += amount;
				applied.push(amount);
				return { ...item } as never;
			},
		} as never,
		{ next: async () => 'DEP-00001' } as never,
		{ run: async (work: (tx: never) => Promise<unknown>) => work({} as never) } as never,
	);
});

describe('DepreciationService', () => {
	test('snapshots the opening and closing book value and moves the item valuation', async () => {
		const entry = await service.record(ORG, { itemId: ITEM, periodYear: 2026, periodMonth: 11, depreciationAmount: 2_500_000 });
		expect(entry).toMatchObject({
			itemId: ITEM,
			periodYear: 2026,
			periodMonth: 11,
			depreciationAmount: 2_500_000,
			openingBookValue: 10_000_000,
			closingBookValue: 7_500_000,
			depreciationMethod: 'straight_line',
		});
		expect(applied).toEqual([2_500_000]);
		expect(item.bookValue).toBe(7_500_000);
		expect(item.accumulatedDepreciation).toBe(3_500_000);
	});

	test('the same period cannot be depreciated twice', async () => {
		await service.record(ORG, { itemId: ITEM, periodYear: 2026, periodMonth: 11, depreciationAmount: 1_000 });
		await expect(
			service.record(ORG, { itemId: ITEM, periodYear: 2026, periodMonth: 11, depreciationAmount: 1_000 }),
		).rejects.toBeInstanceOf(DepreciationPeriodTakenError);
		expect(applied).toHaveLength(1);
	});

	test('an unknown item and another organization are refused before anything is written', async () => {
		await expect(
			service.record(ORG, { itemId: 'missing', periodYear: 2026, periodMonth: 11, depreciationAmount: 1 }),
		).rejects.toBeInstanceOf(ItemNotFoundError);
		await expect(
			service.record('other-org', { itemId: ITEM, periodYear: 2026, periodMonth: 11, depreciationAmount: 1 }),
		).rejects.toBeInstanceOf(ItemNotFoundError);
		expect(entries).toHaveLength(0);
	});

	test('an amount above the book value surfaces the inventory rule', async () => {
		await expect(
			service.record(ORG, { itemId: ITEM, periodYear: 2026, periodMonth: 11, depreciationAmount: 10_000_001 }),
		).rejects.toBeInstanceOf(ItemRuleViolationError);
		expect(entries).toHaveLength(0);
	});
});

/* ----------------------------- gateway secrets ---------------------------- */

let gateways: TPaymentGatewaySelect[];
let config: GatewayConfigService;

const row = (patch: Partial<TPaymentGatewaySelect> = {}): TPaymentGatewaySelect =>
	({
		id: 'gw-1',
		organizationId: ORG,
		provider: 'xendit',
		code: 'XND',
		name: 'Xendit',
		mode: 'sandbox',
		config: null,
		secretCiphertext: null,
		secretIv: null,
		secretTag: null,
		secretLast4: null,
		keyVersion: 1,
		webhookTokenCiphertext: null,
		webhookTokenIv: null,
		webhookTokenTag: null,
		isActive: true,
		isDefault: false,
		rotatedAt: null,
		createdBy: null,
		createdAt: new Date(),
		updatedAt: new Date(),
		deletedAt: null,
		...patch,
	}) as TPaymentGatewaySelect;

beforeEach(() => {
	process.env.PAYMENT_SECRET_KEY = KEY;
	gateways = [];
	config = new GatewayConfigService({
		list: async () => gateways,
		findById: async (_org: string, id: string) => gateways.find((g) => g.id === id) ?? null,
		findByCode: async () => null,
		findDefault: async () => gateways.find((g) => g.isDefault) ?? null,
		findActiveByProvider: async (_org: string | null, provider: string) =>
			gateways.find((g) => g.provider === provider && g.isActive) ?? null,
		create: async (data: never) => {
			const created = row({ id: `gw-${gateways.length + 1}`, ...(data as object) } as Partial<TPaymentGatewaySelect>);
			gateways.push(created);
			return created;
		},
		update: async (_org: string, id: string, patch: never) => {
			const found = gateways.find((g) => g.id === id);
			return found ? Object.assign(found, patch) : null;
		},
		setDefault: async (_org: string, id: string) => {
			for (const g of gateways) g.isDefault = g.id === id;
			return gateways.find((g) => g.id === id) ?? null;
		},
	} as never);
});

describe('GatewayConfigService', () => {
	test('the secret is sealed and never returned; only the last four characters are', async () => {
		const view = await config.create(
			ORG,
			{ provider: 'xendit', code: 'XND', name: 'Xendit', mode: 'sandbox', secret: 'xnd_secret_abcd', webhookToken: 'cb-token-1234' },
			'user-1',
		);
		expect(view).toMatchObject({ hasSecret: true, hasWebhookToken: true, secretLast4: 'abcd', isDefault: true });
		expect(view).not.toHaveProperty('secretCiphertext');
		expect(view).not.toHaveProperty('secretIv');
		expect(view).not.toHaveProperty('secretTag');
		expect(view).not.toHaveProperty('webhookTokenCiphertext');
		expect(JSON.stringify(view)).not.toContain('xnd_secret_abcd');
		// The row keeps ciphertext only, and it round-trips with the key.
		const stored = gateways[0]!;
		expect(stored.secretCiphertext).not.toContain('xnd_secret_abcd');
		expect(
			openSecret(
				{ ciphertext: stored.secretCiphertext!, iv: stored.secretIv!, tag: stored.secretTag! },
				paymentSecretKey(KEY),
			),
		).toBe('xnd_secret_abcd');
	});

	test('a new secret rotates and updates the last four; omitting it keeps the old one', async () => {
		const created = await config.create(ORG, { provider: 'xendit', code: 'XND', name: 'Xendit', mode: 'sandbox', secret: 'old-secret-1111' }, 'u');
		const before = gateways[0]!.secretCiphertext;
		await config.update(ORG, created.id, { name: 'Xendit live' });
		expect(gateways[0]!.secretCiphertext).toBe(before);
		const rotated = await config.update(ORG, created.id, { secret: 'new-secret-2222' });
		expect(rotated.secretLast4).toBe('2222');
		expect(gateways[0]!.secretCiphertext).not.toBe(before);
		expect(gateways[0]!.rotatedAt).not.toBeNull();
	});

	test('an unknown gateway and a missing key are refused', async () => {
		await expect(config.update(ORG, 'missing', { name: 'x' })).rejects.toBeInstanceOf(GatewayNotFoundError);
		await expect(config.get(ORG, 'missing')).rejects.toBeInstanceOf(GatewayNotFoundError);
		delete process.env.PAYMENT_SECRET_KEY;
		await expect(
			config.create(ORG, { provider: 'xendit', code: 'X', name: 'X', mode: 'sandbox', secret: 'secret-1234' }, 'u'),
		).rejects.toBeInstanceOf(GatewaySecretKeyMissingError);
	});

	test('the adapter is built from the row and decrypts its own secret', async () => {
		const sealed = sealSecret('local-secret-0123456789', paymentSecretKey(KEY));
		const fakeRow = row({
			provider: 'fake',
			secretCiphertext: sealed.ciphertext,
			secretIv: sealed.iv,
			secretTag: sealed.tag,
		});
		const adapter = config.adapterOf(fakeRow);
		expect(adapter.provider).toBe('fake');
		// A tampered tag fails the GCM check instead of yielding a wrong secret.
		await expect(async () => config.adapterOf(row({ secretCiphertext: sealed.ciphertext, secretIv: sealed.iv, secretTag: 'AAAA' }))).toThrow();
	});
});
