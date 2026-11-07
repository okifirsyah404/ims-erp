/**
 * Verification script for the user-management schema (organization_role
 * enum, user_invitations, users.status). Dev-only; not part of the app
 * runtime.
 */
import { SQL } from 'bun';
import { appConfig } from '../config/providers/config';

const sql = new SQL(appConfig.database.url!);

const enumValues = await sql`
	select unnest(enum_range(null::auth.organization_role)) as value`;
console.log(
	'organization_role enum values:',
	enumValues.map((r: { value: string }) => r.value),
);

const inv = await sql`select count(*)::int as n from auth.user_invitations`;
console.log('user_invitations rows:', inv[0].n);

const st = await sql`select status, count(*)::int as n from auth.users group by status`;
console.log('user status distribution:', st);

await sql.end();
