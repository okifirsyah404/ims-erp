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

export const SMTPConfigSchema = z.object({
	host: z.string().min(1),
	port: z.number().int().min(1).max(65535),
	user: z.string().min(1),
	password: z.string().min(1),
	secure: z.boolean().nullish(),
});

/**
 * Bootstrap/auth configuration. Seed credentials are dev-only defaults
 * overridable by env; values are never logged.
 */
export const AuthConfigSchema = z.object({
	seedAdminEmail: z.string().email(),
	seedAdminUsername: z.string().min(1),
	seedAdminPassword: z.string().min(8),
});

export const EnvConfigSchema = z.object({
	instance: InstanceConfigSchema,
	app: AppConfigSchema,
	database: DatabaseConfigSchema,
	redis: RedisConfigSchema,
	s3: S3ConfigSchema,
	smtp: SMTPConfigSchema,
	auth: AuthConfigSchema,
});

export type TInstanceConfig = z.infer<typeof InstanceConfigSchema>;
export type TAppConfig = z.infer<typeof AppConfigSchema>;
export type TDatabaseConfig = z.infer<typeof DatabaseConfigSchema>;
export type TRedisConfig = z.infer<typeof RedisConfigSchema>;
export type TS3Config = z.infer<typeof S3ConfigSchema>;
export type TSMTPConfig = z.infer<typeof SMTPConfigSchema>;
export type TAuthConfig = z.infer<typeof AuthConfigSchema>;
export type TEnvConfig = z.infer<typeof EnvConfigSchema>;
