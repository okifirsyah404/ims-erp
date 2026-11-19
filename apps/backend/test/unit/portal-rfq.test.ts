/**
 * Website RFQs in the customer portal (ERP-0072).
 *
 * Covers: the account's RFQs with the SPH sent for each (drafts are internal),
 * the customer-facing status, and the guest-RFQ claim — a code mailed to the
 * address on the RFQ, unknown or already-linked RFQs refused, wrong codes
 * counted (5 attempts), the code bound to the account that asked for it.
 */
import 'reflect-metadata';
import { beforeEach, describe, expect, test } from 'bun:test';
import type { TClaimableRfq, TPortalRfq } from '@app/crm';
import type { PortalContext } from '@authorization/portal-auth';
import { maskEmail, PortalRfqService, RFQ_CLAIM_MAX_ATTEMPTS } from '../../src/app/portal/services/portal-rfq.service';

const portal = (customerId: string) => ({ customerId, userId: 'u', identityId: 'i', contactId: null, role: 'owner' }) as unknown as PortalContext;

let rfqs: (TPortalRfq & { customerId: string | null })[];
let claimable: Map<string, TClaimableRfq>;
let quotations: { id: string; leadId: string | null; status: string; createdAt: Date }[];
let mails: { to: string; code: string; reference: string }[];
let store: Map<string, unknown>;
let service: PortalRfqService;

const rfq = (overrides: Partial<TPortalRfq & { customerId: string | null }>) => ({
	id: crypto.randomUUID(),
	reference: 'RFQ-2026-00001',
	title: 'Lobby',
	siteLocation: 'Jakarta',
	status: 'new' as const,
	submittedAt: new Date('2026-11-20T03:00:00Z'),
	itemCount: 2,
	origin: 'account' as const,
	customerId: 'c1',
	...overrides,
});

beforeEach(() => {
	rfqs = [];
	claimable = new Map();
	quotations = [];
	mails = [];
	store = new Map();
	service = new PortalRfqService(
		{
			listPortalRfqs: async (customerId) => rfqs.filter((row) => row.customerId === customerId),
			findClaimableRfq: async (reference) => claimable.get(reference.trim().toUpperCase()) ?? null,
			claimRfq: async (id, customerId) => {
				const row = [...claimable.values()].find((entry) => entry.id === id);
				if (!row || row.linked) return false;
				row.linked = true;
				rfqs.push(rfq({ id, reference: row.reference, origin: 'claimed_guest', customerId }));
				return true;
			},
		},
		{ listQuotations: async () => quotations as never },
		{ sendRfqClaimCode: async (input) => void mails.push(input) },
		{
			get: async <T>(key: string) => store.get(key) as T | undefined,
			set: async (key: string, value: unknown) => void store.set(key, value),
			del: async (key: string) => void store.delete(key),
		},
	);
});

describe('PortalRfqService.list', () => {
	test('shows only this account, with the newest SPH the customer can see', async () => {
		const mine = rfq({});
		rfqs.push(mine, rfq({ customerId: 'c2', reference: 'RFQ-OTHER' }));
		quotations.push(
			{ id: 'q-draft', leadId: mine.id, status: 'draft', createdAt: new Date('2026-11-21') },
			{ id: 'q-old', leadId: mine.id, status: 'sent', createdAt: new Date('2026-11-19') },
			{ id: 'q-new', leadId: mine.id, status: 'accepted', createdAt: new Date('2026-11-20') },
		);
		const [row, ...rest] = await service.list(portal('c1'));
		expect(rest).toEqual([]);
		expect(row).toMatchObject({ reference: 'RFQ-2026-00001', quotationId: 'q-new', portalStatus: 'quoted' });
	});

	test('maps lead statuses to what the customer sees', async () => {
		rfqs.push(
			rfq({ reference: 'A', status: 'new' }),
			rfq({ reference: 'B', status: 'survey' }),
			rfq({ reference: 'C', status: 'quotation' }),
			rfq({ reference: 'D', status: 'lost' }),
		);
		const statuses = (await service.list(portal('c1'))).map((row) => [row.reference, row.portalStatus]);
		expect(statuses).toEqual([
			['A', 'received'],
			['B', 'in_review'],
			['C', 'quoted'],
			['D', 'closed'],
		]);
	});
});

describe('PortalRfqService claim', () => {
	beforeEach(() => {
		claimable.set('RFQ-2026-00009', { id: 'lead-9', reference: 'RFQ-2026-00009', email: 'sari@example.com', name: 'Sari', linked: false });
	});

	test('mails a code to the RFQ address and adds the RFQ with the right code', async () => {
		const challenge = await service.requestClaim(portal('c1'), 'rfq-2026-00009');
		expect(challenge).toEqual({ reference: 'RFQ-2026-00009', maskedEmail: 's***@example.com', expiresInMinutes: 15 });
		expect(mails).toHaveLength(1);
		expect(mails[0]!.to).toBe('sari@example.com');
		expect(await service.confirmClaim(portal('c1'), 'RFQ-2026-00009', mails[0]!.code)).toBe(true);
		expect((await service.list(portal('c1')))[0]!.origin).toBe('claimed_guest');
		// The code is single-use.
		expect(await service.confirmClaim(portal('c1'), 'RFQ-2026-00009', mails[0]!.code)).toBe(false);
	});

	test('refuses unknown, already-linked and email-less RFQs without mailing', async () => {
		expect(await service.requestClaim(portal('c1'), 'RFQ-NOPE')).toBeNull();
		claimable.set('RFQ-LINKED', { id: 'l', reference: 'RFQ-LINKED', email: 'a@b.co', name: 'A', linked: true });
		expect(await service.requestClaim(portal('c1'), 'RFQ-LINKED')).toBeNull();
		claimable.set('RFQ-NOMAIL', { id: 'n', reference: 'RFQ-NOMAIL', email: null, name: 'N', linked: false });
		expect(await service.requestClaim(portal('c1'), 'RFQ-NOMAIL')).toBeNull();
		expect(mails).toEqual([]);
	});

	test('the code belongs to the account that asked for it', async () => {
		await service.requestClaim(portal('c1'), 'RFQ-2026-00009');
		expect(await service.confirmClaim(portal('c2'), 'RFQ-2026-00009', mails[0]!.code)).toBe(false);
	});

	test(`a wrong code counts; after ${RFQ_CLAIM_MAX_ATTEMPTS} attempts the claim must start over`, async () => {
		await service.requestClaim(portal('c1'), 'RFQ-2026-00009');
		const code = mails[0]!.code;
		const wrong = code === '000000' ? '111111' : '000000';
		for (let attempt = 0; attempt < RFQ_CLAIM_MAX_ATTEMPTS; attempt += 1) {
			expect(await service.confirmClaim(portal('c1'), 'RFQ-2026-00009', wrong)).toBe(false);
		}
		expect(await service.confirmClaim(portal('c1'), 'RFQ-2026-00009', code)).toBe(false);
	});

	test('masks the address', () => {
		expect(maskEmail('budi.santoso@entragate.co.id')).toBe('b***@entragate.co.id');
	});
});
