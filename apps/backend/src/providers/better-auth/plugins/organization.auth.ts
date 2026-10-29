import { organization } from "better-auth/plugins/organization";
import { erpAccessControl, erpRoles } from '../ac/organization-ac';

export const betterAuthOrganizationPlugin = organization({
	ac: erpAccessControl,
	roles: erpRoles,
	teams: { enabled: false },
});
