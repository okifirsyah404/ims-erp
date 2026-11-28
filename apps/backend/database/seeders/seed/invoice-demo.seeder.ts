import { and, asc, eq, isNull } from 'drizzle-orm';
import pino from 'pino';
import { drizzleDB } from '../../../drizzle/db';
import { organizations } from '../../../drizzle/schemas/auth.schema';
import { customers } from '../../../drizzle/schemas/customer.schema';
import { invoiceItems, invoices } from '../../../drizzle/schemas/sale.schema';
import { isProductionEnv } from '../../../config/providers/env';
import { SEED_ORGANIZATION_SLUG } from './organization.seeder';

const logger = pino({
	timestamp: false,
	formatters: {
		level: (label) => ({ level: label }),
	},
});

/** Anchor of the demo row: the seeder writes it once. */
const DEMO_TITLE = 'Demo: Jasa servis tanpa SO (B-42)';
/** A demo-only code, outside the numbering series, so real numbers stay gap-free. */
const DEMO_CODE = 'DEMO/INV/B42/0001';
/** Rp 500.000 before VAT, 11% VAT (integer IDR minor units, ADR-0002). */
const BASE = 50_000_000;
const VAT_BPS = 1100;
const VAT = Math.round((BASE * VAT_BPS) / 10_000);

/** Jakarta business date `days` from today. */
function businessDate(days: number): string {
	return new Date(Date.now() + 7 * 3_600_000 + days * 86_400_000).toISOString().slice(0, 10);
}

/**
 * One draft invoice without a sales order (B-42, KF-S6) for the demo screens:
 * a service line billed straight to the first active customer.
 *
 * @remarks
 * - Dev only; idempotent on {@link DEMO_TITLE}.
 * - No customer is seeded anywhere (every customer owns a Better Auth account,
 *   ERP-0114), so the row is skipped until one exists in CRM; a second run
 *   after that inserts it, a third inserts nothing.
 * - A draft posts nothing: issuing it from the invoice page is the demo.
 */
export async function seedInvoiceDemo(): Promise<void> {
	if (isProductionEnv()) {
		logger.info('Invoice demo skipped in production');
		return;
	}
	const [organization] = await drizzleDB
		.select({ id: organizations.id })
		.from(organizations)
		.where(eq(organizations.slug, SEED_ORGANIZATION_SLUG))
		.limit(1);
	if (!organization) return;

	const [existing] = await drizzleDB
		.select({ id: invoices.id })
		.from(invoices)
		.where(and(eq(invoices.title, DEMO_TITLE), isNull(invoices.deletedAt)))
		.limit(1);
	if (existing) {
		logger.info({ inserted: 0 }, 'Invoice demo already seeded');
		return;
	}

	const [customer] = await drizzleDB
		.select({ id: customers.id, code: customers.code, name: customers.name, type: customers.customerType, phone: customers.phone })
		.from(customers)
		.where(and(eq(customers.status, 'active'), isNull(customers.deletedAt)))
		.orderBy(asc(customers.createdAt))
		.limit(1);
	if (!customer) {
		logger.info('Invoice demo skipped: no active customer yet (create one in CRM, then seed again)');
		return;
	}

	const now = new Date();
	const [invoice] = await drizzleDB
		.insert(invoices)
		.values({
			organizationId: organization.id,
			code: DEMO_CODE,
			invoiceType: 'sales',
			customerId: customer.id,
			customerSnapshot: {
				code: customer.code,
				name: customer.name,
				type: customer.type,
				email: null,
				phone: customer.phone,
				taxId: null,
				addressLine: null,
				postalCode: null,
			} as never,
			title: DEMO_TITLE,
			dueDate: businessDate(30),
			vatEnabled: true,
			vatRateBps: VAT_BPS,
			subtotal: BASE,
			discountTotal: 0,
			taxTotal: VAT,
			grandTotal: BASE + VAT,
			paidTotal: 0,
			outstandingTotal: 0,
			currencyCode: 'IDR',
			status: 'draft',
			createdAt: now,
			updatedAt: now,
		})
		.returning({ id: invoices.id });
	await drizzleDB.insert(invoiceItems).values({
		organizationId: organization.id,
		invoiceId: invoice!.id,
		description: 'Jasa servis',
		quantity: '1',
		unitPrice: BASE,
		discountAmount: 0,
		taxAmount: VAT,
		lineTotal: BASE + VAT,
		currencyCode: 'IDR',
		createdAt: now,
		updatedAt: now,
	});
	logger.info({ inserted: 1, customer: customer.code }, 'Invoice demo seeded');
}
