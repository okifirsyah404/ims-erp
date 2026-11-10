/**
 * Public entry point of the HR module.
 *
 * @remarks
 * Re-exports the composition-root registration and the HTTP controller so
 * consumers only import from `@app/hr`.
 */
export * from './container';
export * from './controllers/employee.controller';
export type { ExportedHrService } from './services/exported-hr.service';
