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
