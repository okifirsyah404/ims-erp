import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** This folder (`e2e/support`), resolved for ESM where `__dirname` is absent. */
const here = dirname(fileURLToPath(import.meta.url));

/** Backend origin the dev stack listens on. */
export const API_URL = process.env.E2E_API_URL ?? 'http://localhost:3001';

/** Seeded UAT accounts used by the checklists (`<role>_seed` / `<role>123456`). */
export const ROLES = [
	'admin',
	'hr_seed',
	'purchasing_seed',
	'operations_manager_seed',
	'warehouse_seed',
	'finance_seed',
	'technician_seed',
] as const;
export type TRole = (typeof ROLES)[number];

/** Where a role's logged-in browser state is cached between specs. */
export function statePath(role: TRole): string {
	return resolve(here, '..', '.state', `${role}.json`);
}

/**
 * Password of a seeded account.
 *
 * @remarks
 * The owner account's password lives in `apps/backend/.env`
 * (`INITIAL_ADMIN_PASSWORD`, or `E2E_ADMIN_PASSWORD` when set); it is read at
 * run time and never written anywhere else. Seed accounts follow the dev
 * convention `<role>123456`.
 */
export function passwordOf(role: TRole): string {
	if (role === 'admin') {
		if (process.env.E2E_ADMIN_PASSWORD) return process.env.E2E_ADMIN_PASSWORD;
		const env = readFileSync(resolve(here, '..', '..', '..', 'backend', '.env'), 'utf8');
		const line = env.split(/\r?\n/).find((entry) => entry.startsWith('INITIAL_ADMIN_PASSWORD='));
		const value = line?.slice('INITIAL_ADMIN_PASSWORD='.length).trim().replace(/^["']|["']$/g, '');
		if (!value) throw new Error('INITIAL_ADMIN_PASSWORD is not set in apps/backend/.env');
		return value;
	}
	return `${role.replace(/_seed$/, '')}123456`;
}

/** A short suffix that makes this run's sample data unique. */
export const RUN_ID = (process.env.E2E_RUN_ID ?? Date.now().toString(36).slice(-5)).toUpperCase();
