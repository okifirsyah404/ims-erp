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

  if (result.error && (result.error as NodeJS.ErrnoException).code !== 'ENOENT') {
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
      logLevel: process.env.APP_LOG_LEVEL || null,
      corsOrigins: process.env.CORS_ORIGINS
        ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean)
        : null,
      // Self-hosted DiceBear API by default (docker-compose `dicebear`
      // service). Point at https://api.dicebear.com to use the public one.
      avatarApiUrl: process.env.AVATAR_API_URL || 'http://localhost:3000',
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

    smtp: {
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      user: process.env.SMTP_USER,
      password: process.env.SMTP_PASSWORD,
      secure:
        process.env.SMTP_SECURE == null
          ? null
          : process.env.SMTP_SECURE.toLowerCase() === 'true',
    },

    auth: {
      // Dev-only bootstrap credentials; override via env in any shared env.
      seedAdminEmail:
        process.env.INITIAL_ADMIN_EMAIL ?? 'admin@example.com',
      seedAdminUsername: process.env.INITIAL_ADMIN_USERNAME ?? 'admin',
      seedAdminPassword: process.env.INITIAL_ADMIN_PASSWORD ?? 'admin123456',
    },
  });
}
