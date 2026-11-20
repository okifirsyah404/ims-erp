import { SQL } from 'bun';
import { drizzle } from 'drizzle-orm/bun-sql';
import { appConfig } from '../config/providers/config';

/**
 * Drizzle client.
 *
 * @remarks
 * Relational v2 relation parts are not registered: no repository uses
 * `db.query.*`, and the baseline rewrite (ADR-0024) declares the schema
 * contract without them. Add a `defineRelationsPart` export to a schema file
 * and spread it here if a repository ever needs the relational query API.
 */
const client = new SQL(appConfig.database.url!);

export const drizzleDB = drizzle({ client });

process.on('SIGTERM', async () => {
	await client.end();
	process.exit(0);
});

export async function closeDB(): Promise<void> {
	await client.end();
}
