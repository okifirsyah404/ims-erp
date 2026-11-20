import type { TFunction } from 'i18next';
import type { TNotification } from './notification-api';

/**
 * Localized copy for a notification (ADR-0016 decision 4).
 *
 * @remarks
 * The server stores an English `title`/`body` as the fallback; the client
 * renders localized copy from `templateCode` + `variables`, so an Indonesian
 * user never reads an English sentence. Each code is spelled out with a literal
 * key and a literal options object, which is what keeps `t()`'s interpolation
 * checking on: a template that gains a `{{placeholder}}` fails to compile here
 * until the producer's variable is passed. Key names are camelCase rather than
 * the code's snake_case because i18next's typed keys read `_` as a plural
 * suffix.
 *
 * A code with no case — a newer backend, or the seeded demo rows — falls back
 * to the stored text instead of rendering a raw key.
 */
export function notificationText(
	t: TFunction<'notifications'>,
	notification: TNotification,
): { title: string; body: string | null } {
	const variables = notification.variables ?? {};
	const fallback = { title: notification.title, body: notification.body };

	switch (notification.templateCode) {
		case 'org.member_added':
			return {
				title: t('template.org.memberAdded.title', {
					organizationName: variables.organizationName ?? '',
				}),
				body: t('template.org.memberAdded.body', {
					organizationName: variables.organizationName ?? '',
					role: variables.role ?? '',
				}),
			};
		case 'org.org_created':
			return {
				title: t('template.org.orgCreated.title', {
					organizationName: variables.organizationName ?? '',
				}),
				body: t('template.org.orgCreated.body', {
					organizationName: variables.organizationName ?? '',
				}),
			};
		case 'crm.company_change_requested':
			return {
				title: t('template.crm.companyChangeRequested.title', {
					customerName: variables.customerName ?? '',
				}),
				body: t('template.crm.companyChangeRequested.body', {
					customerName: variables.customerName ?? '',
					requestedBy: variables.requestedBy ?? '',
					fields: variables.fields ?? '',
				}),
			};
		case 'sales.invoice_issued':
			return {
				title: t('template.sales.invoiceIssued.title', {
					invoiceNumber: variables.invoiceNumber ?? '',
				}),
				body: t('template.sales.invoiceIssued.body', {
					invoiceNumber: variables.invoiceNumber ?? '',
					customerName: variables.customerName ?? '',
					amount: variables.amount ?? '',
				}),
			};
		// ERP-0092: the customer's side of a service ticket.
		case 'aftersales.ticket_opened':
			return {
				title: t('template.aftersales.ticketOpened.title', {
					ticketNumber: variables.ticketNumber ?? '',
					customerName: variables.customerName ?? '',
				}),
				body: t('template.aftersales.ticketOpened.body', {
					ticketNumber: variables.ticketNumber ?? '',
					customerName: variables.customerName ?? '',
					subject: variables.subject ?? '',
				}),
			};
		case 'aftersales.customer_replied':
			return {
				title: t('template.aftersales.customerReplied.title', {
					ticketNumber: variables.ticketNumber ?? '',
					author: variables.author ?? '',
				}),
				body: t('template.aftersales.customerReplied.body', {
					ticketNumber: variables.ticketNumber ?? '',
					customerName: variables.customerName ?? '',
					author: variables.author ?? '',
					message: variables.message ?? '',
				}),
			};
		case 'aftersales.ticket_confirmed':
			return {
				title: t('template.aftersales.ticketConfirmed.title', {
					ticketNumber: variables.ticketNumber ?? '',
					customerName: variables.customerName ?? '',
				}),
				body: t('template.aftersales.ticketConfirmed.body', {
					ticketNumber: variables.ticketNumber ?? '',
					confirmedBy: variables.confirmedBy ?? '',
				}),
			};
		case 'sales.online_order_received':
			return {
				title: t('template.sales.onlineOrderReceived.title', {
					quotationNumber: variables.quotationNumber ?? '',
					customerName: variables.customerName ?? '',
				}),
				body: t('template.sales.onlineOrderReceived.body', {
					quotationNumber: variables.quotationNumber ?? '',
					customerName: variables.customerName ?? '',
					amount: variables.amount ?? '',
				}),
			};
		case 'sales.quotation_accepted':
			return {
				title: t('template.sales.quotationAccepted.title', {
					quotationNumber: variables.quotationNumber ?? '',
					customerName: variables.customerName ?? '',
				}),
				body: t('template.sales.quotationAccepted.body', {
					quotationNumber: variables.quotationNumber ?? '',
					customerName: variables.customerName ?? '',
					orderNumber: variables.orderNumber ?? '',
				}),
			};
		case 'sales.quotation_revision_requested':
			return {
				title: t('template.sales.quotationRevisionRequested.title', {
					quotationNumber: variables.quotationNumber ?? '',
					customerName: variables.customerName ?? '',
				}),
				body: t('template.sales.quotationRevisionRequested.body', {
					quotationNumber: variables.quotationNumber ?? '',
					customerName: variables.customerName ?? '',
					message: variables.message ?? '',
				}),
			};
		case 'document.signature_requested':
			return {
				title: t('template.document.signatureRequested.title', {
					documentName: variables.documentName ?? '',
				}),
				body: t('template.document.signatureRequested.body', {
					requesterName: variables.requesterName ?? '',
					documentName: variables.documentName ?? '',
				}),
			};
		case 'document.signature_signed':
			return {
				title: t('template.document.signatureSigned.title', {
					documentName: variables.documentName ?? '',
				}),
				body: t('template.document.signatureSigned.body', {
					signerName: variables.signerName ?? '',
					documentName: variables.documentName ?? '',
				}),
			};
		case 'document.signature_declined':
			return {
				title: t('template.document.signatureDeclined.title', {
					documentName: variables.documentName ?? '',
				}),
				body: t('template.document.signatureDeclined.body', {
					signerName: variables.signerName ?? '',
					documentName: variables.documentName ?? '',
				}),
			};
		default:
			return fallback;
	}
}
