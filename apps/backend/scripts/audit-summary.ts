/** Dev-only: summarize audit rows by action. */
import { SQL } from 'bun';
import { appConfig } from '../config/providers/config';

const sql = new SQL(appConfig.database.url!);
console.log(await sql`select action, count(*)::int as n from audit.audit_logs group by action order by action`);
await sql.end();
