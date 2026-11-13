/**
 * Public entry point of the code-number module.
 *
 * @remarks
 * Re-exports the composition-root registration, the controller and the
 * exported service so consumers only import from `@app/code-number`.
 */
import Elysia from 'elysia';

import { CodeNumberController } from './controllers/code-number.controller';

export * from './container';
export * from './controllers/code-number.controller';
export type { TNumberContext } from './domain/code-number';
export type { CodeNumberService, TCodeNumberSetting } from './services/code-number.service';

/** Elysia instance mounting the code-number controller. */
export function codeNumberModule() {
	return new Elysia({ name: 'code-number' }).use(CodeNumberController.plugin());
}
