/**
 * Public entry point of the organization module.
 *
 * @remarks
 * Re-exports the composition-root registration and the two HTTP controllers
 * so consumers only import from `@app/organization`.
 */
import Elysia from 'elysia';

import { CompanyProfileController } from './controllers/company-profile.controller';
import { NumberingController } from './controllers/numbering.controller';
import { OrganizationBootstrapController } from './controllers/organization-bootstrap.controller';
import { OrganizationController } from './controllers/organization.controller';

export * from './container';
export * from './controllers/organization.controller';
export * from './controllers/organization-bootstrap.controller';
export * from './controllers/company-profile.controller';
export * from './controllers/numbering.controller';
export type { TNumberContext } from './domain/document-number';
export type { NumberingService } from './services/numbering.service';

/**
 * Elysia instance mounting every organization controller, in route order.
 *
 * @remarks
 * `OrganizationBootstrapController` rides its own guard: creation accepts an
 * application admin with no organization context (ADR-0007), so it cannot
 * inherit the org-scoped guard used by the rest of the module.
 */
export function organizationModule() {
	return new Elysia({ name: 'organization' })
		.use(OrganizationController.plugin())
		.use(OrganizationBootstrapController.plugin())
		.use(CompanyProfileController.plugin())
		.use(NumberingController.plugin());
}
