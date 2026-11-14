/**
 * Public entry point of the organization module.
 *
 * @remarks
 * Re-exports the composition-root registration and the HTTP controllers so
 * consumers only import from `@app/organization`.
 */
import Elysia from 'elysia';

import { OrganizationBootstrapController } from './controllers/organization-bootstrap.controller';
import {
	OrganizationController,
	OrganizationMembershipController,
} from './controllers/organization.controller';
import { OrganizationInvitationController } from './controllers/organization-invitation.controller';

export * from './container';
export * from './controllers/organization.controller';
export * from './controllers/organization-bootstrap.controller';
export * from './controllers/organization-invitation.controller';
export {
	type OrgLogoWorkerHandle,
	startOrgLogoWorker,
} from './queues/org-logo.worker';

/**
 * Elysia instance mounting every organization controller, in route order.
 *
 * @remarks
 * `OrganizationBootstrapController` rides its own guard: creation accepts an
 * application admin with no organization context (ADR-0007), so it cannot
 * inherit the org-scoped guard used by the rest of the module.
 *
 * The company profile and the numbering settings moved to the `company` and
 * `code-number` modules in ERP-0042.
 */
export function organizationModule() {
	return new Elysia({ name: 'organization' })
		// `/mine` must register before `OrganizationController`'s `/:organizationId`.
		.use(OrganizationMembershipController.plugin())
		.use(OrganizationController.plugin())
		.use(OrganizationInvitationController.plugin())
		.use(OrganizationBootstrapController.plugin());
}
