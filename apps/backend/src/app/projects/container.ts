import type { DependencyContainer } from 'tsyringe';
import { PROJECT_LOOKUP_SERVICE_TOKEN, PROJECT_REPOSITORY_TOKEN, PROJECT_SERVICE_TOKEN } from './constants/di';
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
}
