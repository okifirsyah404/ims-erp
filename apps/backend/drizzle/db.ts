import { SQL } from 'bun';
import { drizzle } from 'drizzle-orm/bun-sql';
import { appConfig } from '../config/providers/config';
import { authRelations } from './schemas/auth.schema';
import { auditLogRelations } from './schemas/audit.schema';
import { crmRelations } from './schemas/crm.schema';
import { procurementRelations } from './schemas/procurement.schema';
import { inventoryRelations } from './schemas/inventory.schema';
import { locationRelations } from './schemas/location.schema';
import { roleRelations } from './schemas/role.schema';
import { salesRelations } from './schemas/sales.schema';
import { paymentRelations } from './schemas/payment.schema';

const client = new SQL(appConfig.database.url!);

export const drizzleDB = drizzle({
	client,
	relations: {
		...locationRelations,
		...authRelations,
		...roleRelations,
		...auditLogRelations,
		...salesRelations,
		...paymentRelations,
		...inventoryRelations,
		...crmRelations,
			...procurementRelations,
	},
});

process.on('SIGTERM', async () => {
	await client.end();
	process.exit(0);
});

export async function closeDB(): Promise<void> {
	await client.end();
}
