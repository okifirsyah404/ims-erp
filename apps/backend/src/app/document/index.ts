/**
 * Public entry point of the document module.
 *
 * @remarks
 * Re-exports the composition-root registration, the controller and the
 * exported service so consumers only import from `@app/document`.
 */
import Elysia from 'elysia';

import { DocumentController } from './controllers/document.controller';

export * from './container';
export * from './controllers/document.controller';
export type { DocumentService } from './services/document.service';

/** Elysia instance mounting the document controller. */
export function documentModule() {
	return new Elysia({ name: 'document' }).use(DocumentController.plugin());
}
