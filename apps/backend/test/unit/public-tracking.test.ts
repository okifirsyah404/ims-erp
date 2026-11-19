/**
 * Public order tracking (ERP-0073).
 *
 * Covers: the contact check (exact email, whole phone in any 0/62/+62 form,
 * never the last digits alone), unknown order and wrong contact answering the
 * same, the stage derivation (payment, delivery notes, installation project),
 * the minimal portal status (no customer name, prices or addresses), and the
 * per-address limit on sign-in-free lookups.
 */
import 'reflect-metadata';
import { beforeEach, describe, expect, test } from 'bun:test';
import type { TPortalProject } from '@app/projects/services/project-portal.service';
import type { TOrderTracking } from '@app/sales/services/order-tracking.service';
import {
	contactMatches,
	phoneDigits,
	PUBLIC_TRACKING_MAX_LOOKUPS,
	PublicTrackingService,
	type TTrackedOrder,
} from '../../src/app/portal/services/public-tracking.service';
import type { TPresenter } from '../../src/app/portal/utils/portal-presenter';
import { publicOrderStatus, publicTracking, trackingStages } from '../../src/app/portal/utils/tracking-presenter';

const p: TPresenter = { t: (key: string) => key, language: 'en', today: '2026-11-20', now: new Date('2026-11-20T03:00:00Z') } as unknown as TPresenter;

function tracking(overrides: Partial<TOrderTracking['order']> = {}, extra: Partial<TOrderTracking> = {}): TOrderTracking {
	const now = new Date('2026-11-18T03:00:00Z');
	return {
		order: {
			id: 'so-1',
			code: '0001/SO/IMS/XI/26',
			customerId: 'c1',
			customerSnapshot: { code: 'C1', name: 'PT Maju', type: 'company', email: 'Finance@Maju.co.id', phone: '021-5550101', whatsapp: '0812-3456-7890', taxId: null, addressLine: 'Jl. Raya 1, Bekasi', postalCode: null },
			status: 'confirmed',
			orderDate: '2026-11-18',
			deliveryDate: '2026-11-25',
			subtotal: 1_000_000_00,
			discountTotal: 0,
			taxTotal: 110_000_00,
			grandTotal: 1_110_000_00,
			items: [{ name: 'Swing gate', quantity: '2', lineTotal: 1_000_000_00 }],
			history: [],
			salesPerson: { id: 'u1', name: 'Budi' },
			updatedAt: now,
			...overrides,
		} as unknown as TOrderTracking['order'],
		paidMinor: 0,
		fullyPaid: false,
		deliveryNotes: [],
		...extra,
	};
}

describe('contact check', () => {
	test('email matches exactly, case-insensitively', () => {
		expect(contactMatches('finance@maju.co.id', ['Finance@Maju.co.id'])).toBe(true);
		expect(contactMatches('finance@maju.co', ['Finance@Maju.co.id'])).toBe(false);
	});

	test('a phone matches as the whole number in 0 / 62 / +62 form, never by its last digits', () => {
		expect(phoneDigits('+62 812-3456-7890')).toBe(phoneDigits('0812 3456 7890'));
		expect(contactMatches('+62 812 3456 7890', ['0812-3456-7890'])).toBe(true);
		expect(contactMatches('7890', ['0812-3456-7890'])).toBe(false);
		expect(contactMatches('34567890', ['0812-3456-7890'])).toBe(false);
		expect(contactMatches('0812345678', [null, undefined, 'a@b.co'])).toBe(false);
	});
});

describe('tracking stages', () => {
	test('a fresh order is received, then waits for payment', () => {
		const view = publicTracking(p, { ...tracking(), project: null });
		expect(view.status).toBe('paid');
		expect(view.timeline.map((step) => [step.stage, step.state])).toEqual([
			['received', 'done'],
			['paid', 'current'],
			['production', 'upcoming'],
			['qc', 'upcoming'],
			['shipped', 'upcoming'],
			['completed', 'upcoming'],
		]);
		expect(view.progress).toBeCloseTo(1 / 6);
		expect(view.totals).toMatchObject({ subtotal: 1_000_000, tax: 110_000, total: 1_110_000, paymentNote: 'tracking.unpaid' });
		expect(view.delivery).toMatchObject({ daysToShip: 5, onSchedule: true, installationLabel: 'tracking.noInstallation' });
	});

	test('paid, shipped and installing: the installation step carries the task progress', () => {
		const project = {
			status: 'active',
			siteName: 'Lobby Utama',
			targetStartDate: '2026-11-26',
			targetEndDate: '2026-11-30',
			closedAt: null,
			manager: { name: 'Rina' },
			tasks: [
				{ title: 'Pasang', status: 'done' },
				{ title: 'Uji', status: 'in_progress' },
			],
		} as unknown as TPortalProject;
		const shipped = { status: 'shipped', shippedAt: new Date('2026-11-19T03:00:00Z'), createdAt: new Date('2026-11-19T01:00:00Z'), updatedAt: new Date('2026-11-19T03:00:00Z'), driverName: 'Adi', vehicleNumber: 'B 1234 CD', recipientAddress: 'Gedung A', recipientPic: 'Sari', recipientContact: '0812', projectLocation: 'Bekasi' };
		const tracked: TTrackedOrder = { ...tracking({ status: 'delivered' }, { fullyPaid: true, paidMinor: 1_110_000_00, deliveryNotes: [shipped as never] }), project };
		const view = publicTracking(p, tracked);
		expect(view.status).toBe('installation');
		const install = view.timeline.find((step) => step.stage === 'installation')!;
		expect(install.state).toBe('current');
		expect(install.progress).toEqual({ value: 0.5, tasks: [{ label: 'Pasang', state: 'done' }, { label: 'Uji', state: 'current' }] });
		expect(view.shipping).toEqual({ address: 'Gedung A', courier: 'Adi · B 1234 CD', siteContact: 'Sari · 0812', installationTeam: 'Rina' });
		expect(view.siteLabel).toBe('Lobby Utama');
		expect(view.totals.paymentNote).toBe('tracking.paidInFull');
	});

	test('a completed order is done on every step', () => {
		const facts = trackingStages({ ...tracking({ status: 'completed' }, { fullyPaid: true }), project: null });
		expect(facts.every((fact) => fact.done)).toBe(true);
	});

	test('the portal status hides the customer, prices and addresses', () => {
		const status = publicOrderStatus(p, tracking({ status: 'in_progress' }));
		expect(status).toEqual({
			orderNumber: '0001/SO/IMS/XI/26',
			title: 'tracking.publicTitle',
			status: 'production',
			statusLabel: 'portal.sales.order.in_progress',
			arrivalLabel: 'portal.sales.order.eta',
			step: 2,
			stepCount: 4,
			stepLabel: 'portal.sales.order.in_progress',
			progress: 0.5,
		});
		expect(JSON.stringify(status)).not.toContain('Maju');
	});
});

describe('PublicTrackingService', () => {
	let store: Map<string, unknown>;
	let service: PublicTrackingService;

	beforeEach(() => {
		store = new Map();
		service = new PublicTrackingService(
			{ findByNumber: async (number) => (number === '0001/SO/IMS/XI/26' ? tracking() : null) },
			{ findForSalesOrder: async () => null },
			{ getActiveCustomer: async () => ({ email: 'owner@maju.co.id', phone: null }) as never },
			{ get: async <T>(key: string) => store.get(key) as T | undefined, set: async (key: string, value: unknown) => void store.set(key, value) },
		);
	});

	test('unknown order and wrong contact answer the same', async () => {
		expect(await service.track('9999/SO/X', 'finance@maju.co.id')).toBeNull();
		expect(await service.track('0001/SO/IMS/XI/26', 'someone@else.co')).toBeNull();
		expect(await service.track('0001/SO/IMS/XI/26', 'finance@maju.co.id')).not.toBeNull();
		// The customer's current email works too.
		expect(await service.track('0001/SO/IMS/XI/26', 'owner@maju.co.id')).not.toBeNull();
	});

	test(`sign-in-free lookups stop after ${PUBLIC_TRACKING_MAX_LOOKUPS} per address`, async () => {
		for (let i = 0; i < PUBLIC_TRACKING_MAX_LOOKUPS; i += 1) expect(await service.allow('1.2.3.4')).toBe(true);
		expect(await service.allow('1.2.3.4')).toBe(false);
		expect(await service.allow('5.6.7.8')).toBe(true);
	});
});
