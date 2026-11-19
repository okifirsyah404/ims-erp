/**
 * Public entry point of the project module: composition-root registration,
 * the HTTP surface as a single Elysia factory, and the lead follow-up schedule.
 *
 * @remarks
 * Holds the lead pipeline and the website inquiry surface so far (ADR-0024
 * Q12, moved from `crm`); the rest of the former `projects` module moves in
 * with P6.
 */
import Elysia from 'elysia';

import { LeadController } from './controllers/lead.controller';
import { PublicWebsiteController } from './controllers/public-website.controller';

export { registerProject } from './container';
export { registerLeadFollowUpSchedule } from './queues/lead-follow-up.queue';
export { startLeadFollowUpWorker } from './queues/lead-follow-up.worker';
export { LEAD_SERVICE_TOKEN } from './constants/di';
export type { LeadService } from './services/lead.service';

/** Elysia instance mounting the project module's controllers, in route order. */
export function projectModule() {
	return (
		new Elysia({ name: 'project' })
			.use(LeadController.plugin())
			// Server-to-server website API: API-key guard, no session. The URL
			// stays `/public/v1` until the Q34 alias cut-over (ADR-0024 P8).
			.use(PublicWebsiteController.plugin())
	);
}
