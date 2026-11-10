/**
 * Public entry point of the audit module.
 *
 * @remarks
 * Exports the module's HTTP surface as a single Elysia factory
 * (`auditModule()`) plus the composition-root registration, contracts, and
 * the controller so writer modules only import from `@app/audit`.
 * `src/app/app.ts` only mounts `.use(auditModule())`.
 */
import Elysia from 'elysia';

import { AuditController } from './controllers/audit.controller';

export * from './container';
export * from './contracts/audit.repository.interface';

/** Elysia instance mounting every audit controller, in route order. */
export function auditModule() {
	return new Elysia({ name: 'audit' }).use(AuditController.plugin());
}
