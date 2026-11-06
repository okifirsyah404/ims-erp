/**
 * Injection tokens for the projects module (M07, ADR-0011 step 6a).
 *
 * @remarks
 * Every token carries an `InjectionToken<T>` annotation so registrations
 * and resolutions type-check against the contract.
 */
import type { InjectionToken } from 'tsyringe';
import type { IProjectRepository } from '../contracts/project.repository.interface';
import type { ProjectLookupService } from '../services/project-lookup.service';
import type { ProjectService } from '../services/project.service';

/** Token resolving to the project repository implementation. */
export const PROJECT_REPOSITORY_TOKEN: InjectionToken<IProjectRepository> = Symbol('PROJECT_REPOSITORY_TOKEN');

/** Token resolving to the {@link ProjectService}. */
export const PROJECT_SERVICE_TOKEN: InjectionToken<ProjectService> = Symbol('PROJECT_SERVICE_TOKEN');

/** Token resolving to the {@link ProjectLookupService} (Projects contract for Sales). */
export const PROJECT_LOOKUP_SERVICE_TOKEN: InjectionToken<ProjectLookupService> = Symbol('PROJECT_LOOKUP_SERVICE_TOKEN');
