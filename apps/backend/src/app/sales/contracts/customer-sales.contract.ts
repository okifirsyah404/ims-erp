import type { TInvoiceItemSelect, TInvoiceSelect, TReceiptSelect } from '@drizzle/schemas/sales.schema';

/**
 * Contracts of sales as one customer sees it (ERP-0070): online orders from
 * the website checkout, the customer's SPHs, sales orders and issued
 * invoices. Consumed by the customer portal through
 * `CUSTOMER_SALES_SERVICE_TOKEN`.
 */

/** Company setting naming the salesperson of online orders without an account manager. */
export const ONLINE_ORDER_OWNER_SETTING = { group: 'sales', key: 'online_order_owner_user_id' } as const;

/**
 * Business copy written onto the SPH of an online order (Indonesian, the
 * company's document language; printed on the SPH and read by sales).
 */
export const ONLINE_ORDER_COPY = {
	title: 'Pesanan online',
	channel: { portal: 'portal pelanggan', website: 'website' },
	requestedBy: (channel: string, name: string) => `Pesanan online lewat ${channel} oleh ${name}.`,
	poNumber: (poNumber: string) => `No. PO pelanggan: ${poNumber}.`,
	note: (note: string) => `Catatan pelanggan: ${note}`,
	acceptedBy: (name: string) => `Disetujui pelanggan di portal oleh ${name}.`,
	/** A line the customer asked for without an online price: sales prices it before sending the SPH. */
	priceOnRequest: 'Harga menyusul — mohon penawaran (permintaan pelanggan)',
	priceOnRequestNote: (count: number) => `${count} baris "harga menyusul": isi harga sebelum SPH dikirim.`,
} as const;

/** Where an online order was placed. */
export type TOnlineOrderSource = 'portal' | 'website';

export type TOnlineOrderInput = {
	customerId: string;
	contactId: string | null;
	/** The person placing the order (portal user name). */
	requestedBy: string;
	source: TOnlineOrderSource;
	/**
	 * Catalog lines: the item and its quantity. The price is the item's, except
	 * `priceOnRequest` lines (ERP-0078), which start at 0 for sales to price.
	 */
	lines: { itemId: string; quantity: number; priceOnRequest?: boolean }[];
	note: string | null;
	poNumber: string | null;
};

/** An issued invoice of the customer with its lines and recorded receipts. */
export type TCustomerInvoice = TInvoiceSelect & { items: TInvoiceItemSelect[]; receipts: TReceiptSelect[] };
