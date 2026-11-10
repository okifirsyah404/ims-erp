/**
 * Public entry point of the projects module.
 *
 * @remarks
 * Exports the module's HTTP surface as a single Elysia factory
 * (`projectsModule()`) plus the composition-root registration, so
 * `src/app/app.ts` only mounts `.use(projectsModule())` and never lists
 * the module's controllers individually. Mirrors every other module
 * entry point.
 */
import Elysia from 'elysia';

import { ProjectController } from './controllers/project.controller';

export { registerProjects } from './container';

/** Elysia instance mounting every projects controller, in route order. */
export function projectsModule() {
	return new Elysia({ name: 'projects' }).use(ProjectController.plugin());
}
