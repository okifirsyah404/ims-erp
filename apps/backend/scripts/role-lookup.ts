import { SQL } from 'bun';
import { appConfig } from '../config/providers/config';

const sql = new SQL(appConfig.database.url!);
const orgId = process.argv[2]!;
const rows = await sql`select id, name from auth.roles where organization_id = ${orgId} and name in ('technician','member') order by name`;
for (const r of rows) console.log(r.name, r.id);
await sql.end();
