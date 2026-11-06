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
import type { IHandoverRepository } from '../contracts/handover.repository.interface';
import type { HandoverService } from '../services/handover.service';

/** Token resolving to the project repository implementation. */
export const PROJECT_REPOSITORY_TOKEN: InjectionToken<IProjectRepository> = Symbol('PROJECT_REPOSITORY_TOKEN');

/** Token resolving to the {@link ProjectService}. */
export const PROJECT_SERVICE_TOKEN: InjectionToken<ProjectService> = Symbol('PROJECT_SERVICE_TOKEN');

/** Token resolving to the {@link ProjectLookupService} (Projects contract for Sales). */
export const PROJECT_LOOKUP_SERVICE_TOKEN: InjectionToken<ProjectLookupService> = Symbol('PROJECT_LOOKUP_SERVICE_TOKEN');

/** Token resolving to the BAST repository implementation. */
export const HANDOVER_REPOSITORY_TOKEN: InjectionToken<IHandoverRepository> = Symbol('HANDOVER_REPOSITORY_TOKEN');

/** Token resolving to the {@link HandoverService} (BAST; Projects contract for After-Sales). */
export const HANDOVER_SERVICE_TOKEN: InjectionToken<HandoverService> = Symbol('HANDOVER_SERVICE_TOKEN');
