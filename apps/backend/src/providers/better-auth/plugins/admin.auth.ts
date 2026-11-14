import { admin } from 'better-auth/plugins/admin';
import { adminAccessControl, adminPluginRoles } from '../ac/admin-ac';

// ADR-0018: investor and customer are app roles. admin() is multi-role
// (`user.role` = "admin,investor"), so these roles are declared here with
// their access control. Portal grants stay in `appRoleGrants`.
export const betterAuthAdminPlugin = admin({
	ac: adminAccessControl,
	roles: adminPluginRoles,
	defaultRole: 'user',
});
