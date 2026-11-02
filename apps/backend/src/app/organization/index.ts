/**
 * Public entry point of the organization module.
 *
 * @remarks
 * Re-exports the composition-root registration and the two HTTP controllers
 * so consumers only import from `@app/organization`.
 */
export * from './container';
export * from './controllers/organization.controller';
export * from './controllers/organization-bootstrap.controller';
