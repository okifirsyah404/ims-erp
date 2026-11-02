/**
 * Public entry point of the organization module.
 *
 * @remarks
 * Re-exports the composition-root registration and the HTTP controller so
 * consumers only import from `@app/organization`.
 */
export * from './container';
export * from './routes/organization.controller';
