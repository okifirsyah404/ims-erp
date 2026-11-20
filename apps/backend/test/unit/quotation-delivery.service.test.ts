/**
 * Quotation delivery unit tests (ERP-0067): the SPH PDF of a sent quotation
 * and its `quotation.sent` event.
 *
 * @remarks
 * Every port is a fake: the rules under test are the service's (render token
 * scope and expiry, the PDF lands on the registry document with a link of the
 * configured lifetime, one event per sending, the last attempt goes out
 * without the PDF). Chromium and the real print view are checked by the live
 * verification recorded in `docs/plan/progress.md`.
 */
import { afterAll, beforeEach, describe, expect, test } from 'bun:test';
import { appConfig } from '@config/providers/config';
import { createRenderToken, verifyRenderToken } from '../../src/providers/pdf/render-token';
import type { IPdfRenderer } from '../../src/providers/pdf/pdf-renderer';
import { QuotationDeliveryService } from '../../src/app/sale/services/quotation-delivery.service';

const ID = '01930000-0000-7000-8000-0000000000aa';
const SECRET = 'render-secret-for-tests-only';
const SENT_AT = new Date('2026-11-17T03:00:00.000Z');

describe('render tokens', () => {
	test('valid only for the kind and id it was minted for', () => {
		const token = createRenderToken('quotation', ID, 60_000, SECRET);
		expect(verifyRenderToken('quotation', ID, token, SECRET)).toBe(true);
		expect(verifyRenderToken('quotation', 'other', token, SECRET)).toBe(false);
		expect(verifyRenderToken('invoice', ID, token, SECRET)).toBe(false);
		expect(verifyRenderToken('quotation', ID, token, 'another-secret')).toBe(false);
	});

	test('expired, tampered or malformed tokens are rejected', () => {
		expect(verifyRenderToken('quotation', ID, createRenderToken('quotation', ID, -1, SECRET), SECRET)).toBe(false);
		const [expiry, mac] = createRenderToken('quotation', ID, 60_000, SECRET).split('.');
		expect(verifyRenderToken('quotation', ID, `${Number(expiry) + 1000}.${mac}`, SECRET)).toBe(false);
		expect(verifyRenderToken('quotation', ID, 'garbage', SECRET)).toBe(false);
		expect(verifyRenderToken('quotation', ID, '', SECRET)).toBe(false);
	});
});

type TPublished = { topic: string; data: Record<string, unknown>; dedupeKey?: string };

let quotation: Record<string, unknown>;
let rendered: string[];
let attached: { source: unknown; file: File; actor: string | null }[];
let shares: { id: string; days: number; actor: string | null }[];
let published: TPublished[];
let renderer: IPdfRenderer & { fail: boolean };
let documentId: string | null;
let service: QuotationDeliveryService;
const savedPdf = { ...appConfig.pdf };
const savedUrl = appConfig.app.url;

beforeEach(() => {
	Object.assign(appConfig.pdf, { chromiumPath: '/usr/bin/chromium', renderBaseUrl: 'http://web.test/', linkDays: 30 });
	(appConfig.app as { url: string | null }).url = 'https://erp.test';
	quotation = {
		id: ID,
		code: '1376/QT/IMS/XI/26',
		title: 'Swing gate',
		status: 'sent',
		sentAt: SENT_AT,
		sentBy: 'sales-1',
		createdBy: 'sales-1',
		validUntil: '2026-12-17',
		grandTotal: 1_665_000_000,
		currencyCode: 'IDR',
		customerId: 'cust-1',
		customerSnapshot: { name: 'PT Maju', email: 'rina@maju.test', phone: '0215550100', whatsapp: '081234567890' },
	};
	rendered = [];
	attached = [];
	shares = [];
	published = [];
	documentId = 'doc-1';
	renderer = {
		fail: false,
		get configured() {
			return true;
		},
		async render(url: string) {
			if (renderer.fail) throw new Error('chromium crashed');
			rendered.push(url);
			return new Uint8Array([37, 80, 68, 70]);
		},
	};
	service = new QuotationDeliveryService(
		{ get: async () => quotation as never },
		{ get: async () => ({ name: 'PT Entragate' }) as never },
		{
			attachGeneratedFile: async (source, file, actor) => {
				attached.push({ source, file, actor });
				return documentId;
			},
			createShare: async (id, days, actor) => {
				shares.push({ id, days, actor });
				return { id: 'share-1', token: 'tok-1', sharedAt: '', expiresAt: '2026-12-17T03:00:00.000Z', isRevoked: false };
			},
		},
		renderer,
		{ getUser: async (id: string) => ({ id, name: 'Sari', phone: '0811', email: 'sari@erp.test' }) as never },
		{
			publish: async (topic: string, _aggregate: unknown, data: Record<string, unknown>, options?: { dedupeKey?: string }) => {
				published.push({ topic, data, dedupeKey: options?.dedupeKey });
				return {} as never;
			},
		} as never,
	);
});

describe('quotation delivery', () => {
	test('renders the print view, files the PDF, shares it for 30 days, publishes once per sending', async () => {
		await service.deliver(ID, false);

		expect(rendered).toHaveLength(1);
		expect(rendered[0]).toStartWith(`http://web.test/print/quotations/${ID}?token=`);
		expect(attached[0]).toMatchObject({ source: { module: 'sale', sourceType: 'quotation', sourceId: ID }, actor: 'sales-1' });
		expect(attached[0].file.name).toBe('1376-QT-IMS-XI-26.pdf');
		expect(attached[0].file.type).toBe('application/pdf');
		expect(shares).toEqual([{ id: 'doc-1', days: 30, actor: 'sales-1' }]);
		expect(published).toHaveLength(1);
		expect(published[0].topic).toBe('quotation.sent');
		expect(published[0].dedupeKey).toBe(`quotation.sent:${ID}:${SENT_AT.getTime()}`);
		expect(published[0].data).toMatchObject({
			code: '1376/QT/IMS/XI/26',
			customer: { name: 'PT Maju', whatsapp: '081234567890' },
			owner: { userId: 'sales-1', name: 'Sari' },
			pdf: {
				url: 'https://erp.test/documents/public/v1/shares/tok-1/file',
				fileName: '1376-QT-IMS-XI-26.pdf',
				expiresAt: '2026-12-17T03:00:00.000Z',
			},
		});
	});

	test('the render URL carries a token the render endpoint accepts', async () => {
		await service.deliver(ID, false);
		const token = decodeURIComponent(new URL(rendered[0]).searchParams.get('token')!);
		expect(await service.renderData(ID, token)).toMatchObject({ quotation: { id: ID }, profile: { name: 'PT Entragate' } });
		expect(await service.renderData(ID, 'wrong')).toBeNull();
		expect(await service.renderData('other-id', token)).toBeNull();
	});

	test('a render failure is retried; the last attempt publishes without the PDF', async () => {
		renderer.fail = true;
		await expect(service.deliver(ID, false)).rejects.toThrow('chromium crashed');
		expect(published).toHaveLength(0);

		await service.deliver(ID, true);
		expect(published).toHaveLength(1);
		expect(published[0].data.pdf).toBeNull();
	});

	test('PDFs not configured: the event goes out without a link and nothing renders', async () => {
		appConfig.pdf.chromiumPath = null;
		Object.defineProperty(renderer, 'configured', { get: () => false });
		await service.deliver(ID, false);
		expect(rendered).toHaveLength(0);
		expect(published[0].data.pdf).toBeNull();
	});

	test('an unregistered quotation (seeded data) is sent without a link', async () => {
		documentId = null;
		await service.deliver(ID, false);
		expect(shares).toHaveLength(0);
		expect(published[0].data.pdf).toBeNull();
	});

	test('a quotation no longer sent (won, lost, superseded) is skipped', async () => {
		quotation.status = 'won';
		await service.deliver(ID, true);
		expect(rendered).toHaveLength(0);
		expect(published).toHaveLength(0);
	});
});

afterAll(() => {
	Object.assign(appConfig.pdf, savedPdf);
	(appConfig.app as { url: string | null }).url = savedUrl ?? null;
});
