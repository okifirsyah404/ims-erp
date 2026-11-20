/**
 * Maps Sales records onto the customer portal's `PortalSource` view types for
 * quotations, orders, invoices and payment (ERP-0070). Same rules as
 * `portal-presenter.ts`: labels in the caller's language, Jakarta dates,
 * money as whole rupiah (the portal's `Money`), pure functions.
 *
 * Customers never see costs, internal notes or staff ids: only the
 * customer-facing columns of the SPH, order and invoice are mapped.
 */
import type { TCustomerInvoice } from '@app/sales/contracts/customer-sales.contract';
import type { TQuotationDetail, TQuotationView } from '@app/sales/services/quotation.service';
import type { TSalesOrderDetail } from '@app/sales/services/sales-order.service';
import type { TInvoiceSelect, TSalesOrderSelect } from '@drizzle/schemas/sales.schema';
import { dateLabel, documentFileUrl, type TPresenter } from './portal-presenter';

/** "25 Oct" / "25 Okt": the portal's quotation screens add the year themselves. */
function shortDate(p: TPresenter, value: string | null): string {
	if (!value) return '';
	return new Intl.DateTimeFormat(p.language === 'id' ? 'id-ID' : 'en-GB', { day: 'numeric', month: 'short', timeZone: 'Asia/Jakarta' }).format(
		new Date(`${value}T00:00:00+07:00`),
	);
}

/** IDR minor units → whole rupiah (the portal's `Money`). */
export const toMoney = (minor: number | bigint | null | undefined): number => Math.round(Number(minor ?? 0) / 100);

/* ------------------------------------------------------------------------ *
 * Quotations
 * ------------------------------------------------------------------------ */

/** The portal's quotation statuses; `in_review` = an online order sales has not sent yet. */
export type TPortalQuotationStatus = 'in_review' | 'needs_approval' | 'revised' | 'accepted' | 'expired' | 'rejected';

export function quotationStatus(quotation: TQuotationView): TPortalQuotationStatus {
	switch (quotation.status) {
		case 'sent':
			return quotation.expired ? 'expired' : 'needs_approval';
		case 'won':
			return 'accepted';
		case 'lost':
			return 'rejected';
		case 'superseded':
			return 'revised';
		default:
			// draft, submitted, approved, rejected by the manager: still with sales.
			return 'in_review';
	}
}

const daysLeft = (p: TPresenter, quotation: TQuotationView): number | undefined => {
	if (quotation.status !== 'sent' || quotation.expiresAt === null || quotation.expired) return undefined;
	return Math.max(0, Math.ceil((quotation.expiresAt - p.now.getTime()) / (24 * 60 * 60 * 1000)));
};

function quotationMeta(p: TPresenter, quotation: TQuotationView, orderCode: string | null): string {
	switch (quotationStatus(quotation)) {
		case 'in_review':
			return p.t('portal.sales.meta.inReview');
		case 'accepted':
			return orderCode ? p.t('portal.sales.meta.accepted', { code: orderCode }) : p.t('portal.sales.status.accepted');
		case 'rejected':
			return p.t('portal.sales.meta.closed', { date: dateLabel(p, quotation.closedAt) });
		default:
			return p.t('portal.sales.meta.sent', { date: dateLabel(p, quotation.sentAt) });
	}
}

export function quotationSummary(p: TPresenter, quotation: TQuotationView, lineCount = 0, preparedBy = '', orderCode: string | null = null) {
	const expiresInDays = daysLeft(p, quotation);
	return {
		id: quotation.id,
		number: quotation.code,
		title: quotation.title,
		status: quotationStatus(quotation),
		total: toMoney(quotation.grandTotal),
		lineCount,
		preparedBy,
		...(expiresInDays === undefined ? {} : { expiresInDays }),
		meta: quotationMeta(p, quotation, orderCode),
		version: quotation.revision + 1,
	};
}

export function quotationDetail(
	p: TPresenter,
	quotation: TQuotationDetail,
	ctx: { companyName: string; approvers: { id: string; label: string }[] },
) {
	const lines = quotation.items.map((item) => ({
		name: item.name,
		detail: item.specification ?? item.sku ?? '',
		quantity: Number(item.quantity),
		unitPrice: toMoney(item.unitPrice),
		amount: toMoney(item.lineTotal),
	}));
	const breakdown = [
		{ label: p.t('portal.sales.subtotal'), amount: toMoney(quotation.subtotal) },
		...(quotation.discountTotal > 0 ? [{ label: p.t('portal.sales.discount'), amount: -toMoney(quotation.discountTotal), tone: 'success' as const }] : []),
		...(quotation.vatEnabled ? [{ label: p.t('portal.sales.vat', { rate: (quotation.vatRateBps / 100).toString() }), amount: toMoney(quotation.taxTotal) }] : []),
		{ label: p.t('portal.sales.total'), amount: toMoney(quotation.grandTotal) },
	];
	const schedule = quotation.paymentSchedule ?? [];
	const milestones = schedule.map((term) => ({
		label: term.label,
		note: `${term.percentBps / 100}%`,
		amount: Math.round((toMoney(quotation.grandTotal) * term.percentBps) / 10_000),
	}));
	const downPaymentRate = schedule[0] ? schedule[0].percentBps / 10_000 : 0;
	return {
		...quotationSummary(p, quotation, lines.length, quotation.creator?.name ?? '', quotation.salesOrder?.code ?? null),
		heading: quotation.heading ?? quotation.title,
		issuedLabel: shortDate(p, quotation.quotationDate),
		validUntilLabel: quotation.validUntil ? shortDate(p, quotation.validUntil) : p.t('portal.sales.validOpen'),
		deliveryLabel: p.t('portal.sales.deliveryTbc'),
		...(quotation.terms || quotation.guarantee || quotation.paymentTerms
			? { terms: { warranty: quotation.guarantee ?? '', delivery: quotation.paymentTerms ?? '', conditions: quotation.terms ?? '' } }
			: {}),
		lines,
		breakdown,
		milestones,
		accountManager: {
			name: quotation.creator?.name ?? '',
			role: p.t('portal.sales.accountManager'),
			replyLabel: p.t('portal.sales.replyLabel'),
		},
		downPaymentRate,
		downPaymentDue: Math.round(toMoney(quotation.grandTotal) * downPaymentRate),
		approvers: ctx.approvers,
		companyName: ctx.companyName,
	};
}

/* ------------------------------------------------------------------------ *
 * Orders
 * ------------------------------------------------------------------------ */

/** Sales order status → the portal's order status and its step on a 4-step bar. */
const ORDER_STEPS: Record<TSalesOrderSelect['status'], { status: 'confirmed' | 'production' | 'delivered' | 'cancelled'; step: number }> = {
	confirmed: { status: 'confirmed', step: 1 },
	in_progress: { status: 'production', step: 2 },
	delivered: { status: 'delivered', step: 3 },
	completed: { status: 'delivered', step: 4 },
	cancelled: { status: 'cancelled', step: 0 },
};
const ORDER_STEP_COUNT = 4;

export function orderSummary(p: TPresenter, order: TSalesOrderSelect) {
	const { status, step } = ORDER_STEPS[order.status];
	const statusLabel = p.t(`portal.sales.order.${order.status}`);
	return {
		id: order.id,
		number: order.code,
		title: order.title,
		status,
		statusLabel,
		step,
		stepCount: ORDER_STEP_COUNT,
		stepLabel: statusLabel,
		// 0..1, like every other portal progress value (the portal draws `progress * 100`%).
		progress: step / ORDER_STEP_COUNT,
		etaLabel: order.deliveryDate ? p.t('portal.sales.order.eta', { date: dateLabel(p, order.deliveryDate) }) : p.t('portal.sales.order.etaOpen'),
		total: toMoney(order.grandTotal),
		placedAt: order.orderDate,
	};
}

export function orderDetail(p: TPresenter, order: TSalesOrderDetail, paidTotalMinor: number) {
	const summary = orderSummary(p, order);
	return {
		...summary,
		arrivalLabel: summary.etaLabel,
		arrivalWindow: '',
		lines: order.items.map((item) => ({
			name: item.name,
			detail: item.specification ?? item.sku ?? '',
			quantity: Number(item.quantity),
			amount: toMoney(item.lineTotal),
		})),
		delivery: { site: order.customerSnapshot.name, address: order.customerSnapshot.addressLine ?? '', courier: '', awb: '' },
		payment: {
			subtotal: toMoney(order.subtotal),
			...(order.discountTotal > 0 ? { discountLabel: p.t('portal.sales.discount'), discount: toMoney(order.discountTotal) } : {}),
			tax: toMoney(order.taxTotal),
			total: toMoney(order.grandTotal),
			...(paidTotalMinor > 0 ? { paidLabel: p.t('portal.sales.invoice.paidAmount', { amount: toMoney(paidTotalMinor).toLocaleString('id-ID') }) } : {}),
		},
		documents: [],
		timeline: order.history.map((entry) => ({
			label: p.t(`portal.sales.order.${entry.toStatus as TSalesOrderSelect['status']}`),
			time: dateLabel(p, entry.createdAt),
		})),
	};
}

/* ------------------------------------------------------------------------ *
 * Invoices and payment
 * ------------------------------------------------------------------------ */

const invoiceState = (p: TPresenter, invoice: TInvoiceSelect): 'unpaid' | 'paid' | 'overdue' => {
	if (invoice.status === 'paid') return 'paid';
	return invoice.dueDate && invoice.dueDate < p.today ? 'overdue' : 'unpaid';
};

export function invoiceSummary(p: TPresenter, invoice: TInvoiceSelect) {
	const status = invoiceState(p, invoice);
	return {
		id: invoice.id,
		number: invoice.code ?? '',
		description: invoice.title,
		amount: toMoney(status === 'paid' ? invoice.grandTotal : invoice.outstandingTotal),
		status,
		...(invoice.dueDate && status !== 'paid' ? { dueLabel: p.t('portal.sales.invoice.due', { date: dateLabel(p, invoice.dueDate) }), dueDate: invoice.dueDate } : {}),
	};
}

export function invoiceList(p: TPresenter, invoices: TInvoiceSelect[]) {
	const year = p.today.slice(0, 4);
	const open = invoices.filter((invoice) => invoice.status !== 'paid');
	return {
		outstanding: open.reduce((sum, invoice) => sum + toMoney(invoice.outstandingTotal), 0),
		paidThisYear: invoices
			.filter((invoice) => (invoice.issueDate ?? '').startsWith(year))
			.reduce((sum, invoice) => sum + toMoney(invoice.paidTotal), 0),
		overdue: open.filter((invoice) => invoiceState(p, invoice) === 'overdue').reduce((sum, invoice) => sum + toMoney(invoice.outstandingTotal), 0),
		invoices: invoices.map((invoice) => invoiceSummary(p, invoice)),
	};
}

export function invoiceDetail(p: TPresenter, invoice: TCustomerInvoice) {
	return {
		...invoiceSummary(p, invoice),
		issuedLabel: dateLabel(p, invoice.issueDate),
		orderNumber: invoice.salesOrderCode ?? '',
		lines: invoice.items.map((item) => ({ label: item.description, amount: toMoney(item.lineTotal) })),
		subtotal: toMoney(invoice.subtotal),
		tax: toMoney(invoice.taxTotal),
		total: toMoney(invoice.grandTotal),
		payments: invoice.receipts
			.filter((receipt) => receipt.status !== 'reversed')
			.map((receipt) => ({
				label: p.t('portal.sales.invoice.receipt', { code: receipt.code ?? '' }),
				dateLabel: dateLabel(p, receipt.receivedDate),
				amount: toMoney(receipt.amount),
				method: receipt.method,
			})),
		milestones: [],
		document: { id: invoice.id, name: invoice.code ?? '', meta: dateLabel(p, invoice.issueDate), kind: 'pdf' as const, url: documentFileUrl('invoice', invoice.id) },
	};
}

/** The one payment method the portal offers: the active gateway's hosted checkout. */
export function paymentMethods(p: TPresenter, gateway: { enabled: boolean; provider: string | null }) {
	if (!gateway.enabled || !gateway.provider) return [];
	return [
		{
			id: gateway.provider,
			kind: 'virtual_account' as const,
			name: p.t('portal.sales.payment.online'),
			detail: p.t('portal.sales.payment.onlineDetail'),
		},
	];
}
