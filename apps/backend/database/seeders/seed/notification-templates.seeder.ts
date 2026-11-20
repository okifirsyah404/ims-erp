import { and, inArray, isNull } from 'drizzle-orm';
import pino from 'pino';
import { drizzleDB } from '../../../drizzle/db';
import {
	notificationTemplates,
	type NotificationTemplateCode,
} from '../../../drizzle/schemas/notification.schema';

const logger = pino({
	timestamp: false,
	formatters: {
		level: (label) => ({ level: label }),
	},
});

/**
 * The canonical notification templates (ERP-0047), one per `module.event`
 * code in `NOTIFICATION_TEMPLATE_CODES`.
 *
 * @remarks
 * Copy is **English** on purpose: the server copy is the fallback the worker
 * writes onto the row, while the client renders localized copy from
 * `templateCode` + `variables`. Adding a code means adding it to
 * `NOTIFICATION_TEMPLATE_CODES`, to this list, and to the client
 * `notifications` locale namespace.
 *
 * `variables` is the contract a producer must satisfy — the worker renders
 * `{{name}}` placeholders and a missing value becomes an empty string, so a
 * declared variable the producer forgets is a visible gap, not a crash.
 */
export const NOTIFICATION_TEMPLATE_SEEDS: ReadonlyArray<{
	code: NotificationTemplateCode;
	name: string;
	subjectTemplate: string;
	bodyTemplate: string;
	variables: string[];
}> = [
	{
		code: 'org.member_added',
		name: 'Member added',
		subjectTemplate: 'You joined {{organizationName}}',
		bodyTemplate: 'You were added to {{organizationName}} as {{role}}.',
		variables: ['organizationName', 'role'],
	},
	{
		code: 'org.org_created',
		name: 'Organization created',
		subjectTemplate: '{{organizationName}} is ready',
		bodyTemplate: 'You created {{organizationName}}. Invite your team to get started.',
		variables: ['organizationName'],
	},
	{
		code: 'sales.invoice_issued',
		name: 'Invoice issued',
		subjectTemplate: 'Invoice {{invoiceNumber}} issued',
		bodyTemplate:
			'Invoice {{invoiceNumber}} for {{customerName}} was issued for {{amount}}.',
		variables: ['invoiceNumber', 'customerName', 'amount'],
	},
	{
		// Customer portal (ERP-0077): the portal renders its own localized copy; this is the stored fallback.
		code: 'portal.quotation_sent',
		name: 'Quotation … is ready',
		subjectTemplate: 'Quotation {{quotationNumber}} is ready',
		bodyTemplate: 'Your quotation {{quotationNumber}} ({{amount}}) is ready for review.',
		variables: ['quotationNumber', 'amount'],
	},
	{
		// Customer portal (ERP-0077): the portal renders its own localized copy; this is the stored fallback.
		code: 'portal.order_shipped',
		name: 'Order … is on its way',
		subjectTemplate: 'Order {{orderNumber}} is on its way',
		bodyTemplate: 'Delivery {{deliveryNumber}} for order {{orderNumber}} has left our warehouse.',
		variables: ['orderNumber', 'deliveryNumber'],
	},
	{
		// Customer portal (ERP-0077): the portal renders its own localized copy; this is the stored fallback.
		code: 'portal.invoice_issued',
		name: 'Invoice … issued',
		subjectTemplate: 'Invoice {{invoiceNumber}} issued',
		bodyTemplate: 'Invoice {{invoiceNumber}} for {{amount}} is due {{dueDate}}.',
		variables: ['invoiceNumber', 'amount', 'dueDate'],
	},
	{
		// Customer portal (ERP-0077): the portal renders its own localized copy; this is the stored fallback.
		code: 'portal.payment_received',
		name: 'Payment received for …',
		subjectTemplate: 'Payment received for {{invoiceNumber}}',
		bodyTemplate: 'We received {{amount}} for invoice {{invoiceNumber}}. Thank you.',
		variables: ['invoiceNumber', 'amount'],
	},
	{
		// Customer portal (ERP-0077): the portal renders its own localized copy; this is the stored fallback.
		code: 'portal.ticket_replied',
		name: 'New reply on ticket …',
		subjectTemplate: 'New reply on ticket {{ticketNumber}}',
		bodyTemplate: '{{author}} replied to your support ticket {{ticketNumber}}.',
		variables: ['ticketNumber', 'author'],
	},
	{
		code: 'crm.company_change_requested',
		name: 'Company data change requested in the customer portal',
		subjectTemplate: '{{customerName}} asked to change company data',
		bodyTemplate: '{{requestedBy}} asked to change {{fields}} of {{customerName}} in the customer portal. Review it on the customer page.',
		variables: ['customerName', 'requestedBy', 'fields'],
	},
	{
		code: 'sales.online_order_received',
		name: 'Online order received',
		subjectTemplate: 'Online order {{quotationNumber}} from {{customerName}}',
		bodyTemplate:
			'{{customerName}} ordered online ({{amount}}). Review and submit draft SPH {{quotationNumber}}.',
		variables: ['quotationNumber', 'customerName', 'amount'],
	},
	{
		code: 'sales.quotation_accepted',
		name: 'Quotation accepted by the customer',
		subjectTemplate: '{{customerName}} accepted {{quotationNumber}}',
		bodyTemplate:
			'{{customerName}} accepted {{quotationNumber}} in the customer portal. Sales order {{orderNumber}} was created.',
		variables: ['quotationNumber', 'customerName', 'orderNumber'],
	},
	{
		code: 'sales.quotation_revision_requested',
		name: 'Quotation revision requested by the customer',
		subjectTemplate: '{{customerName}} asked to revise {{quotationNumber}}',
		bodyTemplate: '{{customerName}} asked to revise {{quotationNumber}}: {{message}}',
		variables: ['quotationNumber', 'customerName', 'message'],
	},
	{
		code: 'document.signature_requested',
		name: 'Signature requested',
		subjectTemplate: 'Signature requested: {{documentName}}',
		bodyTemplate:
			'{{requesterName}} requested your signature on {{documentName}}.',
		variables: ['requesterName', 'documentName'],
	},
	{
		code: 'document.signature_signed',
		name: 'Signature signed',
		subjectTemplate: 'Document signed: {{documentName}}',
		bodyTemplate: '{{signerName}} signed {{documentName}}.',
		variables: ['signerName', 'documentName'],
	},
	{
		code: 'document.signature_declined',
		name: 'Signature declined',
		subjectTemplate: 'Signature declined: {{documentName}}',
		bodyTemplate: '{{signerName}} declined to sign {{documentName}}.',
		variables: ['signerName', 'documentName'],
	},
];

/**
 * Idempotent template seeder: inserts only the codes that have no live row.
 *
 * @remarks
 * Anchored on `code`, which carries a partial unique index over live rows, so
 * re-running is a no-op and an operator's edited copy is never overwritten.
 * Runs in every environment — these are reference rows, not demo content.
 */
export async function seedNotificationTemplates(): Promise<void> {
	const codes = NOTIFICATION_TEMPLATE_SEEDS.map((template) => template.code);
	const existing = await drizzleDB
		.select({ code: notificationTemplates.code })
		.from(notificationTemplates)
		.where(
			and(
				isNull(notificationTemplates.deletedAt),
				inArray(notificationTemplates.code, codes),
			),
		);
	const have = new Set(existing.map((row) => row.code));
	const missing = NOTIFICATION_TEMPLATE_SEEDS.filter(
		(template) => !have.has(template.code),
	);

	if (missing.length > 0) {
		const now = new Date();
		await drizzleDB.insert(notificationTemplates).values(
			missing.map((template) => ({
				code: template.code,
				name: template.name,
				channel: 'in_app' as const,
				subjectTemplate: template.subjectTemplate,
				bodyTemplate: template.bodyTemplate,
				variables: template.variables,
				isActive: true,
				createdAt: now,
				updatedAt: now,
			})),
		);
	}

	logger.info(
		{ inserted: missing.length, total: codes.length },
		'Notification templates seeded',
	);
}
