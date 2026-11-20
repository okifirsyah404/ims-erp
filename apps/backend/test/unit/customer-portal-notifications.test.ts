/**
 * Customer notifications in the portal (ERP-0077).
 *
 * Covers: the notifier reaches only the customer's active portal logins,
 * is a no-op without a customer or logins, never fails the producer, and the
 * portal view (kind, link, today/earlier, unread, unknown templates dropped).
 */
import 'reflect-metadata';
import { describe, expect, test } from 'bun:test';
import type { TNotificationView } from '@app/notification/contracts/notification.contract';
import type { TPortalIdentitySelect } from '@drizzle/schemas/portal.schema';
import type { TPresenter } from '../../src/app/portal/utils/portal-presenter';
import { portalNotification } from '../../src/app/portal/utils/portal-presenter';
import { CustomerPortalNotifier } from '../../src/app/user/services/customer-portal-notifier.service';

const identity = (userId: string, status: TPortalIdentitySelect['status']) => ({ userId, status, portalType: 'customer' }) as TPortalIdentitySelect;

describe('CustomerPortalNotifier', () => {
	const notice = {
		customerId: 'c1',
		templateCode: 'portal.invoice_issued' as const,
		variables: { invoiceNumber: 'INV-1', amount: 'Rp 1.000', dueDate: '2026-12-01' },
		sourceType: 'invoice' as const,
		sourceId: 'inv-1',
	};

	test('reaches the active logins of the customer only', async () => {
		const sent: string[][] = [];
		const notifier = new CustomerPortalNotifier(
			{ listLiveByCustomer: async () => [identity('u1', 'active'), identity('u2', 'suspended'), identity('u3', 'active')] },
			{ notify: async (input) => void sent.push(input.userIds) },
		);
		await notifier.notify(notice);
		expect(sent).toEqual([['u1', 'u3']]);
	});

	test('no customer or no logins: nothing is sent; a failure never reaches the producer', async () => {
		const sent: string[][] = [];
		const quiet = new CustomerPortalNotifier({ listLiveByCustomer: async () => [] }, { notify: async (input) => void sent.push(input.userIds) });
		await quiet.notify({ ...notice, customerId: null });
		await quiet.notify(notice);
		expect(sent).toEqual([]);
		const broken = new CustomerPortalNotifier(
			{ listLiveByCustomer: async () => [identity('u1', 'active')] },
			{
				notify: async () => {
					throw new Error('queue down');
				},
			},
		);
		await expect(broken.notify(notice)).resolves.toBeUndefined();
	});
});

describe('portal notification view', () => {
	const p = { t: (key: string) => key, language: 'en', today: '2026-11-20', now: new Date('2026-11-20T05:00:00Z') } as unknown as TPresenter;
	const row = (overrides: Partial<TNotificationView>): TNotificationView =>
		({
			id: 'n1',
			templateCode: 'portal.ticket_replied',
			title: 'fallback',
			body: null,
			tags: [],
			variables: { ticketNumber: 'TKT-1', author: 'Rina' },
			metadata: null,
			channel: 'in_app',
			status: 'sent',
			sentAt: null,
			readAt: null,
			sourceType: 'service_ticket',
			sourceId: 't1',
			createdAt: '2026-11-20T02:00:00.000Z',
			...overrides,
		}) as TNotificationView;

	test('kind, link, group and unread come from the template and the row', () => {
		expect(portalNotification(p, row({}))).toMatchObject({
			kind: 'support',
			href: '/support/t1',
			group: 'today',
			unread: true,
			title: 'portal.notification.ticketReplied.title',
		});
		expect(portalNotification(p, row({ templateCode: 'portal.order_shipped', sourceId: 'so-1', readAt: '2026-11-19T00:00:00.000Z', createdAt: '2026-11-18T02:00:00.000Z' }))).toMatchObject({
			kind: 'order',
			href: '/orders/so-1',
			group: 'earlier',
			unread: false,
		});
	});

	test('a staff template is not shown in the portal', () => {
		expect(portalNotification(p, row({ templateCode: 'sales.invoice_issued' }))).toBeNull();
	});
});
