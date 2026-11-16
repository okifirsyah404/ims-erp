import { z } from 'zod';

export const InstanceConfigSchema = z.object({
	env: z.enum([
		'local',
		'dev',
		'development',
		'staging',
		'prod',
		'production',
		'test',
	]),
	timezone: z.string().min(1),
});

export const AppConfigSchema = z.object({
	name: z.string().min(1),
	id: z.string().min(1),
	secret: z.string().min(1),
	host: z.string().min(1),
	port: z.number().int().min(1).max(65535),
	url: z.url().nullish(),
	/**
	 * Base URL of the admin web app — where invitation claim links point.
	 * Falls back to `url` when unset (single-origin deployments).
	 */
	webUrl: z.url().nullish(),
	logLevel: z.enum(['debug', 'info', 'warn', 'error']).nullish(),
	/** Comma-separated list of origins allowed for credentialed CORS. */
	corsOrigins: z.array(z.string()).nullish(),
	/** Base URL of the DiceBear HTTP API used to render avatars. */
	avatarApiUrl: z.url(),
});

export const DatabaseConfigSchema = z.object({
	host: z.string().min(1),
	port: z.number().int().min(1).max(65535),
	user: z.string().min(1),
	password: z.string(),
	db: z.string().min(1),
	url: z.url().nullish(),
});

export const RedisConfigSchema = z.object({
	host: z.string().min(1),
	port: z.number().int().min(1).max(65535),
	user: z.string().nullish(),
	password: z.string().nullish(),
	db: z.number().int().min(0).nullish(),
	queueDb: z.number().int().min(0).nullish(),
	url: z.url().nullish(),
	cacheTtl: z.number().int().min(0),
});

export const S3ConfigSchema = z.object({
	accessKey: z.string().min(1),
	secretKey: z.string().min(1),
	region: z.string().min(1),
	bucket: z.string().min(1),
	endpoint: z.string().url().nullish(),
	usePathStyle: z.boolean().nullish(),
});

export const MailConfigSchema = z.object({
	/**
	 * Explicit transport selection. When null the resolver auto-detects:
	 * resend when an API key is present, else smtp when a host is present.
	 */
	provider: z.enum(['smtp', 'resend']).nullish(),
	smtp: z
		.object({
			host: z.string().min(1),
			port: z.number().int().min(1).max(65535),
			user: z.string().nullish(),
			password: z.string().nullish(),
			secure: z.boolean().nullish(),
		})
		.nullish(),
	resend: z
		.object({
			apiKey: z.string().min(1),
		})
		.nullish(),
	/** Envelope sender, e.g. `"ERP <noreply@example.com>"`. */
	from: z.string().min(1).nullish(),
});

/**
 * Bootstrap/auth configuration. Seed credentials are dev-only defaults
 * overridable by env; values are never logged.
 */
export const AuthConfigSchema = z.object({
	seedAdminEmail: z.string().email(),
	seedAdminUsername: z.string().min(1),
	seedAdminPassword: z.string().min(8),
	/**
	 * Social login providers. A provider is enabled only when both of its
	 * credentials are present; unset vars simply leave it disabled.
	 */
	social: z
		.object({
			google: z
				.object({
					clientId: z.string().min(1).nullish(),
					clientSecret: z.string().min(1).nullish(),
				})
				.nullish(),
		})
		.nullish(),
});

/**
 * Background scheduler configuration (first introduced by S4).
 *
 * @remarks
 * `enabled` defaults to `false` so unit tests and one-off scripts never open a
 * Redis worker connection. `guestPiiRetentionMonths` is the OPEN-2 window,
 * expressed as config rather than a constant in the sweep so the answer can
 * change without a redeploy of new code.
 */
export const SchedulerConfigSchema = z.object({
	enabled: z.boolean(),
	/** Cron for the late-return sweep; every 15 minutes by default (§8). */
	lateSweepCron: z.string().min(1),
	/** Cron for the guest-PII retention sweep; daily by default (§11). */
	retentionSweepCron: z.string().min(1),
	/** Cron (Asia/Jakarta) for the `license.due` reminders to n8n; daily 08:00 by default (M04). */
	licenseDueCron: z.string().min(1),
	/** ERP-0066: lead and quotation follow-up reminders (Asia/Jakarta, weekdays). */
	salesFollowUpCron: z.string().min(1),
	/** Guest PII is nulled this many months after `closed_at`. */
	guestPiiRetentionMonths: z.number().int().min(1),
	/** Cron for the read-notification prune; daily by default. */
	notificationRetentionCron: z.string().min(1),
	/** Read notifications are hard-deleted this many days after `read_at`. */
	notificationRetentionDays: z.number().int().min(1),
});

/** M04 integrations: the n8n webhook of ERP events (server config only). */
export const IntegrationsConfigSchema = z.object({
	n8nWebhookUrl: z.url().nullable(),
	n8nWebhookSecret: z.string().min(16).nullable(),
	/** WAHA (self-hosted WhatsApp HTTP API) base URL, API key and session name. */
	wahaUrl: z.url().nullable(),
	wahaApiKey: z.string().min(1).nullable(),
	wahaSession: z.string().min(1),
	/** HMAC key WAHA signs its webhooks with (`X-Webhook-Hmac`, sha512). */
	wahaWebhookSecret: z.string().min(16).nullable(),
	/** OpenAI-compatible chat completions endpoint for the assistant; none = every chat goes to an admin. */
	aiBaseUrl: z.url().nullable(),
	aiApiKey: z.string().min(1).nullable(),
	aiModel: z.string().min(1).nullable(),
});

export const EnvConfigSchema = z.object({
	instance: InstanceConfigSchema,
	app: AppConfigSchema,
	database: DatabaseConfigSchema,
	redis: RedisConfigSchema,
	s3: S3ConfigSchema,
	mail: MailConfigSchema,
	auth: AuthConfigSchema,
	scheduler: SchedulerConfigSchema,
	integrations: IntegrationsConfigSchema,
});

export type TInstanceConfig = z.infer<typeof InstanceConfigSchema>;
export type TAppConfig = z.infer<typeof AppConfigSchema>;
export type TDatabaseConfig = z.infer<typeof DatabaseConfigSchema>;
export type TRedisConfig = z.infer<typeof RedisConfigSchema>;
export type TS3Config = z.infer<typeof S3ConfigSchema>;
export type TMailConfig = z.infer<typeof MailConfigSchema>;
export type TAuthConfig = z.infer<typeof AuthConfigSchema>;
export type TSchedulerConfig = z.infer<typeof SchedulerConfigSchema>;
export type TEnvConfig = z.infer<typeof EnvConfigSchema>;
