import { CUSTOMER_SERVICE_TOKEN } from '@app/crm/constants/di';
import type { CustomerService } from '@app/crm/services/customer.service';
import { PROJECT_PORTAL_SERVICE_TOKEN } from '@app/projects/constants/di';
import type { ProjectPortalService, TPortalProject } from '@app/projects/services/project-portal.service';
import { ORDER_TRACKING_SERVICE_TOKEN } from '@app/sales/constants/di';
import type { OrderTrackingService, TOrderTracking } from '@app/sales/services/order-tracking.service';
import type { ICacheClient } from '@cache/cache.client';
import { CACHE_CLIENT_TOKEN } from '@di/tokens';
import { inject, injectable } from 'tsyringe';

/** Public lookups per client address: 30 per 10 minutes. */
export const PUBLIC_TRACKING_WINDOW_SECONDS = 10 * 60;
export const PUBLIC_TRACKING_MAX_LOOKUPS = 30;

export type TTrackedOrder = TOrderTracking & { project: TPortalProject | null };

/** Digits of a phone number in the 62… form (`0812…` and `+62 812…` match). */
export function phoneDigits(value: string): string {
	const digits = value.replace(/\D/g, '');
	return digits.startsWith('0') ? `62${digits.slice(1)}` : digits;
}

/**
 * Whether `contact` is the email or the phone on the order. An email must
 * match exactly (case-insensitive); a phone must be the whole number (at least
 * 8 digits) — the last digits alone are too easy to guess with an order number.
 */
export function contactMatches(contact: string, known: (string | null | undefined)[]): boolean {
	const given = contact.trim().toLowerCase();
	if (!given) return false;
	if (given.includes('@')) return known.some((value) => value?.trim().toLowerCase() === given);
	const digits = phoneDigits(given);
	if (digits.length < 8) return false;
	return known.some((value) => Boolean(value) && !value!.includes('@') && phoneDigits(value!) === digits);
}

/**
 * Public order tracking (ERP-0073). Owns no data: Sales gives the order with
 * payment and delivery progress, Projects the installation, CRM the
 * customer's current email and phone.
 *
 * - The website's `/track` (website key) sees the full status only when the
 *   visitor gives the order number **and** the email or phone on the order.
 * - The portal's sign-in-free lookup (no key) gets a minimal status by order
 *   number, without customer, prices or addresses, rate limited per address.
 */
@injectable()
export class PublicTrackingService {
	constructor(
		@inject(ORDER_TRACKING_SERVICE_TOKEN) private readonly orders: Pick<OrderTrackingService, 'findByNumber'>,
		@inject(PROJECT_PORTAL_SERVICE_TOKEN) private readonly projects: Pick<ProjectPortalService, 'findForSalesOrder'>,
		@inject(CUSTOMER_SERVICE_TOKEN) private readonly customers: Pick<CustomerService, 'getActiveCustomer'>,
		@inject(CACHE_CLIENT_TOKEN) private readonly cache: Pick<ICacheClient, 'get' | 'set'>,
	) {}

	/** The full status when the contact matches the order; `null` otherwise (unknown order or wrong contact alike). */
	async track(orderNumber: string, contact: string): Promise<TTrackedOrder | null> {
		const tracking = await this.orders.findByNumber(orderNumber);
		if (!tracking) return null;
		const { order } = tracking;
		const customer = order.customerId ? await this.customers.getActiveCustomer(order.customerId) : null;
		const known = [order.customerSnapshot.email, order.customerSnapshot.phone, order.customerSnapshot.whatsapp, customer?.email, customer?.phone];
		if (!contactMatches(contact, known)) return null;
		return { ...tracking, project: await this.projects.findForSalesOrder(order.id) };
	}

	/** Minimal status by number for the portal's sign-in-free lookup. */
	async lookup(orderNumber: string): Promise<TOrderTracking | null> {
		return this.orders.findByNumber(orderNumber);
	}

	/** `false` once a client address made too many public lookups in the window. */
	async allow(client: string): Promise<boolean> {
		const key = `portal:public-track:${client}`;
		const count = ((await this.cache.get<number>(key)) ?? 0) + 1;
		await this.cache.set<number>(key, count, PUBLIC_TRACKING_WINDOW_SECONDS);
		return count <= PUBLIC_TRACKING_MAX_LOOKUPS;
	}
}
