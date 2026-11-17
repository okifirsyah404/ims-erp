import { ProjectPortalService } from './services/project-portal.service';
import type { DependencyContainer } from 'tsyringe';
import {
	HANDOVER_REPOSITORY_TOKEN,
	HANDOVER_SERVICE_TOKEN,
	PROJECT_PORTAL_SERVICE_TOKEN,
	PROJECT_LOOKUP_SERVICE_TOKEN,
	PROJECT_REPOSITORY_TOKEN,
	PROJECT_SERVICE_TOKEN,
} from './constants/di';
import { HandoverRepository } from './repositories/handover.repository';
import { HandoverService } from './services/handover.service';
import { ProjectRepository } from './repositories/project.repository';
import { ProjectLookupService } from './services/project-lookup.service';
import { ProjectService } from './services/project.service';

export * from './constants/di';

/**
 * Registers the projects module (M07, ADR-0011 step 6a).
 *
 * @param container - The tsyringe container to populate
 */
export function registerProjects(container: DependencyContainer): void {
	container.register(PROJECT_REPOSITORY_TOKEN, { useClass: ProjectRepository });
	container.register(PROJECT_SERVICE_TOKEN, { useClass: ProjectService });
	container.register(PROJECT_LOOKUP_SERVICE_TOKEN, { useClass: ProjectLookupService });
	container.register(HANDOVER_REPOSITORY_TOKEN, { useClass: HandoverRepository });
	container.register(HANDOVER_SERVICE_TOKEN, { useClass: HandoverService });
	container.register(PROJECT_PORTAL_SERVICE_TOKEN, { useClass: ProjectPortalService });
}
