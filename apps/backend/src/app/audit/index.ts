/**
 * Public entry point of the audit module.
 *
 * @remarks
 * Re-exports the composition-root registration, the controller, and the
 * ledger contracts so writer modules only import from `@app/audit`.
 */
export * from './container';
export * from './contracts/audit.repository.interface';
export * from './controllers/audit.controller';
