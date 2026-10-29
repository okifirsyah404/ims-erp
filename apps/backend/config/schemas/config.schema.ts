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

export const EnvConfigSchema = z.object({
	instance: InstanceConfigSchema,
	app: AppConfigSchema,
	database: DatabaseConfigSchema,
	redis: RedisConfigSchema,
	s3: S3ConfigSchema,
	smtp: SMTPConfigSchema,
});

export type TInstanceConfig = z.infer<typeof InstanceConfigSchema>;
export type TAppConfig = z.infer<typeof AppConfigSchema>;
export type TDatabaseConfig = z.infer<typeof DatabaseConfigSchema>;
export type TRedisConfig = z.infer<typeof RedisConfigSchema>;
export type TS3Config = z.infer<typeof S3ConfigSchema>;
export type TSMTPConfig = z.infer<typeof SMTPConfigSchema>;
export type TEnvConfig = z.infer<typeof EnvConfigSchema>;
