/**
 * Verify the org-path claim smoke result: membership attached, invitation
 * accepted. Dev-only; not part of the app runtime.
 */
import { SQL } from 'bun';
import { appConfig } from '../config/providers/config';

const sql = new SQL(appConfig.database.url!);

const membership = await sql`
	select u.email, u.username, m.role, m.organization_id
	from auth.members m join auth.users u on u.id = m.user_id
	where u.email in ('tech@entragate.test', 'fallback@entragate.test', 'tech2@entragate.test')`;
console.log('memberships:', membership);

const invitations = await sql`
	select email, status, type from auth.user_invitations
	where email in ('tech@entragate.test', 'fallback@entragate.test', 'tech2@entragate.test')`;
console.log('invitations:', invitations);

await sql.end();
