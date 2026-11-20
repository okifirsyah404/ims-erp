/**
 * Public entry point of the project module (ADR-0024 Q12, P6).
 *
 * @remarks
 * Absorbs the former `projects`, `licensing` modules and the `aftersales`
 * warranty certificate. URLs live under `/projects`; the machine license API
 * serves the machine license API at `/projects/api/v1/licenses` and the
 * website inquiry API at `/projects/public/v1`.
 */
import Elysia from 'elysia';

import { LeadController } from './controllers/lead.controller';
import { LicenseApiController } from './controllers/license-api.controller';
import { LicensingController } from './controllers/licensing.controller';
import { ProjectController } from './controllers/project.controller';
import { PublicWebsiteController } from './controllers/public-website.controller';
import { WarrantyController } from './controllers/warranty.controller';

export { registerProject } from './container';
export { registerLeadFollowUpSchedule } from './queues/lead-follow-up.queue';
export { startLeadFollowUpWorker } from './queues/lead-follow-up.worker';
export { registerLicenseDueSchedule } from './queues/license-due.queue';
export { startLicenseDueWorker } from './queues/license-due.worker';
export {
	HANDOVER_SERVICE_TOKEN,
	LEAD_SERVICE_TOKEN,
	LICENSING_SERVICE_TOKEN,
	PROJECT_LOOKUP_SERVICE_TOKEN,
	PROJECT_PORTAL_SERVICE_TOKEN,
	PROJECT_SERVICE_TOKEN,
	WARRANTY_SERVICE_TOKEN,
} from './constants/di';
export type { LeadService } from './services/lead.service';
export type { ProjectLookupService } from './services/project-lookup.service';
export type { ProjectPortalService } from './services/project-portal.service';
export type { ProjectService } from './services/project.service';
export type { WarrantyService } from './services/warranty.service';
export type { LicensingService } from './services/licensing.service';

/** Elysia instance mounting the project module's controllers, in route order. */
export function projectModule() {
	return new Elysia({ name: 'project' })
		.use(LeadController.plugin())
		.use(ProjectController.plugin())
		.use(WarrantyController.plugin())
		.use(LicensingController.plugin())
		// Machine API of installed applications.
		.use(LicenseApiController.plugin())
		// Server-to-server website API: API-key guard, no session.
		.use(PublicWebsiteController.plugin());
}
