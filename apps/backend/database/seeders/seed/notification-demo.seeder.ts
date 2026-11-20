import { and, eq, inArray, isNull } from 'drizzle-orm';
import pino from 'pino';
import { appConfig } from '../../../config/providers/config';
import { isProductionEnv } from '../../../config/providers/env';
import { drizzleDB } from '../../../drizzle/db';
import { users } from '../../../drizzle/schemas/auth.schema';
import {
	pushNotificationTemplates,
	pushNotifications,
	type PushNotificationTemplateCode,
} from '../../../drizzle/schemas/notification.schema';
import { SEED_ORGANIZATION_NAME } from './organization.seeder';

const logger = pino({
	timestamp: false,
	formatters: {
		level: (label) => ({ level: label }),
	},
});

/** Marks every row this seeder owns, so the anchors never collide with real ones. */
const DEMO_SOURCE_TYPE = 'seed_demo';

/**
 * Three demo pushNotifications for the seed admin, so the bell has something to
 * render (and a non-zero unread badge) on a freshly seeded database.
 *
 * @remarks
 * `title`/`body` are stored pre-rendered, exactly as the worker would write
 * them: importing the worker here would open a Redis connection through the
 * queue module at seeder load, which a seeder must not do. `createdAt` is
 * staggered so "newest first" ordering is visible.
 */
const DEMO_ROWS: ReadonlyArray<{
	sourceId: string;
	templateCode: PushNotificationTemplateCode;
	title: string;
	body: string;
	tags: string[];
	variables: Record<string, string>;
	status: 'sent' | 'read';
	ageMs: number;
}> = [
	{
		sourceId: 'seed-demo-member-added',
		templateCode: 'org.member_added',
		title: `You joined ${SEED_ORGANIZATION_NAME}`,
		body: `You were added to ${SEED_ORGANIZATION_NAME} as sales.`,
		tags: [SEED_ORGANIZATION_NAME],
		variables: { organizationName: SEED_ORGANIZATION_NAME, role: 'sales' },
		status: 'sent',
		ageMs: 2 * 60 * 60 * 1_000,
	},
	{
		sourceId: 'seed-demo-invoice-issued',
		templateCode: 'sales.invoice_issued',
		title: 'Invoice INV-DEV-0001 issued',
		body: 'Invoice INV-DEV-0001 for PT Nusantara Akses was issued for Rp 27.500.000.',
		tags: [SEED_ORGANIZATION_NAME, 'Invoice'],
		variables: {
			invoiceNumber: 'INV-DEV-0001',
			customerName: 'PT Nusantara Akses',
			amount: 'Rp 27.500.000',
		},
		status: 'sent',
		ageMs: 26 * 60 * 60 * 1_000,
	},
	{
		sourceId: 'seed-demo-signature-requested',
		templateCode: 'document.signature_requested',
		title: 'Signature requested: BAST Swing Gate',
		body: 'Siti Rahmawati requested your signature on BAST Swing Gate.',
		tags: [SEED_ORGANIZATION_NAME, 'Signature'],
		variables: {
			requesterName: 'Siti Rahmawati',
			documentName: 'BAST Swing Gate',
		},
		status: 'read',
		ageMs: 3 * 24 * 60 * 60 * 1_000,
	},
];

/**
 * Idempotent demo-notification seeder (dev only).
 *
 * @remarks
 * Deliberately one fixed user — the seed admin (`admin@local.com` by default) —
 * not every user: the point is a meaningful unread badge in the UI, not noise
 * across the whole directory.
 *
 * Anchored on `(user_id, source_id)` with `source_type='seed_demo'`, so a
 * re-run inserts nothing and a real notification can never be mistaken for a
 * demo row. Skipped in production (demo content) and when the seed user does
 * not exist (a partial seed must not abort the remaining seeders).
 */
export async function seedNotificationDemo(): Promise<void> {
	if (isProductionEnv()) {
		logger.info('Production environment; skipping demo pushNotifications');
		return;
	}

	const [user] = await drizzleDB
		.select({ id: users.id })
		.from(users)
		.where(eq(users.email, appConfig.auth.seedAdminEmail))
		.limit(1);
	if (!user) {
		logger.info(
			{ email: appConfig.auth.seedAdminEmail },
			'Seed admin not found; skipping demo pushNotifications',
		);
		return;
	}

	const codes = DEMO_ROWS.map((row) => row.templateCode);
	const templates = await drizzleDB
		.select({ id: pushNotificationTemplates.id, code: pushNotificationTemplates.code })
		.from(pushNotificationTemplates)
		.where(
			and(
				isNull(pushNotificationTemplates.deletedAt),
				inArray(pushNotificationTemplates.code, codes),
			),
		);
	const templateIdByCode = new Map(
		templates.map((template) => [template.code, template.id]),
	);

	const existing = await drizzleDB
		.select({ sourceId: pushNotifications.sourceId })
		.from(pushNotifications)
		.where(
			and(
				eq(pushNotifications.userId, user.id),
				eq(pushNotifications.sourceType, DEMO_SOURCE_TYPE),
				inArray(
					pushNotifications.sourceId,
					DEMO_ROWS.map((row) => row.sourceId),
				),
			),
		);
	const have = new Set(existing.map((row) => row.sourceId));

	const now = Date.now();
	const missing = DEMO_ROWS.filter((row) => !have.has(row.sourceId));
	if (missing.length > 0) {
		await drizzleDB.insert(pushNotifications).values(
			missing.map((row) => {
				const sentAt = new Date(now - row.ageMs);
				return {
					notificationTemplateId: templateIdByCode.get(row.templateCode) ?? null,
					userId: user.id,
					templateCode: row.templateCode,
					title: row.title,
					body: row.body,
					tags: row.tags,
					variables: row.variables,
					metadata: null,
					channel: 'in_app' as const,
					status: row.status,
					sentAt,
					readAt: row.status === 'read' ? sentAt : null,
					sourceType: DEMO_SOURCE_TYPE,
					sourceId: row.sourceId,
					createdAt: sentAt,
					updatedAt: sentAt,
				};
			}),
		);
	}

	logger.info(
		{ inserted: missing.length, userId: user.id },
		'Demo pushNotifications seeded',
	);
}
