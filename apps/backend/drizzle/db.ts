import { SQL } from 'bun';
import { drizzle } from 'drizzle-orm/bun-sql';
import { appConfig } from '../config/providers/config';
import { authRelations } from './schemas/auth.schema';
import { auditLogRelations } from './schemas/audit.schema';
import { locationRelations } from './schemas/location.schema';
import { roleRelations } from './schemas/role.schema';
import { salesRelations } from './schemas/sales.schema';

const client = new SQL(appConfig.database.url!);

export const drizzleDB = drizzle({
	client,
	relations: {
		...locationRelations,
		...authRelations,
		...roleRelations,
		...auditLogRelations,
		...salesRelations,
	},
});

process.on('SIGTERM', async () => {
	await client.end();
	process.exit(0);
});

export async function closeDB(): Promise<void> {
	await client.end();
}
