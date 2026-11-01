/**
 * Dev/ops script: re-sync existing system role rows with the shared catalog
 * grants. Run after a catalog change that must reach already-seeded
 * organizations.
 *
 *   cd apps/backend && bun run scripts/refresh-role-grants.ts
 */
import { closeDB } from '../drizzle/db';
import { refreshSystemRoleGrants } from '../database/seeders/seed/organization-roles.seeder';

const updated = await refreshSystemRoleGrants();
console.log(`system role rows updated: ${updated}`);
await closeDB();
