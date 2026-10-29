import { defineConfig } from 'drizzle-kit';
import { appConfig } from './config/providers/config';

export default defineConfig({
	dialect: 'postgresql',
	schema: './drizzle/schemas',
	out: './database/migrations',
	dbCredentials: {
		url: appConfig.database.url!,
	},
});
