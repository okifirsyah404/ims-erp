import * as dotenv from 'dotenv';
import * as dotenvExpand from 'dotenv-expand';
import * as path from 'node:path';

import { EnvConfigSchema, type TEnvConfig } from '../schemas/config.schema.js';

/**
 * Resolve the workspace-local `.env`. Env files are decentralized per app,
 * so we only look in the backend workspace itself — never above it.
 */
function findEnvPath(): string {
	return path.resolve(process.cwd(), '.env');
}

export function loadEnvConfig(
	options?: dotenv.DotenvConfigOptions,
): TEnvConfig {
	const result = dotenv.config({
		path: options?.path ?? findEnvPath(),
		...options,
	});

	if (
		result.error &&
		(result.error as NodeJS.ErrnoException).code !== 'ENOENT'
	) {
		throw result.error;
	}

	dotenvExpand.expand(result);

	return EnvConfigSchema.parse({
		instance: {
			env: process.env.NODE_ENV ?? 'development',
			timezone: process.env.TZ ?? 'UTC',
		},

		app: {
			name: process.env.APP_NAME,
			id: process.env.APP_ID,
			secret: process.env.APP_SECRET,
			host: process.env.APP_HOST ?? '0.0.0.0',
			port: Number(process.env.APP_PORT ?? 3000),
			url: process.env.APP_URL || null,
			webUrl: process.env.APP_WEB_URL || null,
			logLevel: process.env.APP_LOG_LEVEL || null,
			corsOrigins: process.env.CORS_ORIGINS
				? process.env.CORS_ORIGINS.split(',')
						.map((o) => o.trim())
						.filter(Boolean)
				: null,
			// Self-hosted DiceBear API by default (docker-compose `dicebear`
			// service). Point at https://api.dicebear.com to use the public one.
			avatarApiUrl: process.env.AVATAR_API_URL || 'https://api.dicebear.com',
		},

		database: {
			host: process.env.POSTGRES_HOST,
			port: Number(process.env.POSTGRES_PORT ?? 5432),
			user: process.env.POSTGRES_USER,
			password: process.env.POSTGRES_PASSWORD,
			db: process.env.POSTGRES_DB,
			url: process.env.POSTGRES_URL || null,
		},

		redis: {
			host: process.env.REDIS_HOST ?? 'localhost',
			port: Number(process.env.REDIS_PORT ?? 6379),
			user: process.env.REDIS_USER || null,
			password: process.env.REDIS_PASSWORD || null,
			db: process.env.REDIS_DB == null ? null : Number(process.env.REDIS_DB),
			queueDb:
				process.env.REDIS_QUEUE_DB == null
					? 1
					: Number(process.env.REDIS_QUEUE_DB),
			url: process.env.REDIS_URL || null,
			cacheTtl:
				process.env.REDIS_CACHE_TTL == null
					? 5 * 60
					: Number(process.env.REDIS_CACHE_TTL),
		},

		s3: {
			accessKey: process.env.S3_ACCESS_KEY,
			secretKey: process.env.S3_SECRET_KEY,
			region: process.env.S3_REGION,
			bucket: process.env.S3_BUCKET,
			endpoint: process.env.S3_ENDPOINT || null,
			usePathStyle:
				process.env.S3_USE_PATH_STYLE == null
					? null
					: process.env.S3_USE_PATH_STYLE.toLowerCase() === 'true',
		},

		mail: {
			provider: process.env.MAIL_PROVIDER || null,
			// A transport block is only populated when its key env var is
			// present, so the resolver can auto-detect which provider to use.
			smtp: process.env.MAIL_SMTP_HOST
				? {
						host: process.env.MAIL_SMTP_HOST,
						port: Number(process.env.MAIL_SMTP_PORT ?? 587),
						user: process.env.MAIL_SMTP_USER || null,
						password: process.env.MAIL_SMTP_PASSWORD || null,
						secure:
							process.env.MAIL_SMTP_SECURE == null
								? null
								: process.env.MAIL_SMTP_SECURE.toLowerCase() === 'true',
					}
				: null,
			resend: process.env.MAIL_RESEND_API_KEY
				? { apiKey: process.env.MAIL_RESEND_API_KEY }
				: null,
			from: process.env.MAIL_FROM || null,
		},

		auth: {
			// Dev-only bootstrap credentials; override via env in any shared env.
			seedAdminEmail: process.env.INITIAL_ADMIN_EMAIL ?? 'admin@example.com',
			seedAdminUsername: process.env.INITIAL_ADMIN_USERNAME ?? 'admin',
			seedAdminPassword: process.env.INITIAL_ADMIN_PASSWORD ?? 'admin123456',
			social: {
				google: {
					clientId: process.env.GOOGLE_CLIENT_ID || null,
					clientSecret: process.env.GOOGLE_CLIENT_SECRET || null,
				},
			},
		},

		integrations: {
			// M04: the n8n webhook that receives ERP events, and the shared
			// secret of its HMAC signature. Server config only; never logged.
			n8nWebhookUrl: process.env.N8N_WEBHOOK_URL || null,
			n8nWebhookSecret: process.env.N8N_WEBHOOK_SECRET || null,
			// M04 stage 2: WAHA posts chats to the ERP and sends the replies;
			// the AI provider is optional (none = hand every chat to an admin).
			wahaUrl: process.env.WAHA_URL || null,
			wahaApiKey: process.env.WAHA_API_KEY || null,
			wahaSession: process.env.WAHA_SESSION || 'default',
			wahaWebhookSecret: process.env.WAHA_WEBHOOK_SECRET || null,
			aiBaseUrl: process.env.AI_BASE_URL || null,
			aiApiKey: process.env.AI_API_KEY || null,
			aiModel: process.env.AI_MODEL || null,
		},

		scheduler: {
			// Off by default: a unit test or a one-off script must never open a
			// Redis worker connection.
			enabled:
				process.env.SCHEDULER_ENABLED == null
					? false
					: process.env.SCHEDULER_ENABLED.toLowerCase() === 'true',
			lateSweepCron: process.env.SCHEDULER_LATE_SWEEP_CRON ?? '*/15 * * * *',
			retentionSweepCron:
				process.env.SCHEDULER_RETENTION_SWEEP_CRON ?? '0 3 * * *',
			// M04: daily license.due reminders, Asia/Jakarta clock (08:00 WIB).
			licenseDueCron: process.env.SCHEDULER_LICENSE_DUE_CRON ?? '0 8 * * *',
			salesFollowUpCron: process.env.SCHEDULER_SALES_FOLLOW_UP_CRON ?? '0 8 * * 1-5',
			guestPiiRetentionMonths:
				process.env.GUEST_PII_RETENTION_MONTHS == null
					? 24
					: Number(process.env.GUEST_PII_RETENTION_MONTHS),
			notificationRetentionCron:
				process.env.SCHEDULER_NOTIFICATION_RETENTION_CRON ?? '0 4 * * *',
			notificationRetentionDays:
				process.env.NOTIFICATION_RETENTION_DAYS == null
					? 90
					: Number(process.env.NOTIFICATION_RETENTION_DAYS),
		},
	});
}
