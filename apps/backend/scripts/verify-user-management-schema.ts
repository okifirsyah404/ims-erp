/**
 * Verification script for the user-management phase-1 schema (roles,
 * user_invitations, users.status). Dev-only; not part of the app runtime.
 */
import { SQL } from 'bun';
import { appConfig } from '../config/providers/config';

const sql = new SQL(appConfig.database.url!);

const roleSample = await sql`select name, rank, is_system from auth.roles order by rank desc, name limit 8`;
console.log('roles (top 8 by rank):');
for (const r of roleSample) console.log(' ', r);

const counts = await sql`select count(*)::int as n from auth.roles`;
console.log('total roles:', counts[0].n);

const inv = await sql`select count(*)::int as n from auth.user_invitations`;
console.log('user_invitations rows:', inv[0].n);

const st = await sql`select status, count(*)::int as n from auth.users group by status`;
console.log('user status distribution:', st);

await sql.end();
