/**
 * Dead-key guard for the locale bundles.
 *
 * A key that exists in `en` but is never referenced in `apps/web-admin` or
 * `apps/backend` is dead weight: it still needs an Indonesian translation, it
 * still has to pass the parity test, and it silently rots as the UI changes.
 * This test fails when such a key appears, so removing a feature forces
 * removing its copy.
 *
 * @remarks
 * This is a heuristic text scan, not a type-aware analysis — the bundles are
 * checked by the compiler at call sites, but a key that is simply never used
 * produces no error. The scan looks for the key in any of the forms the code
 * uses:
 *
 * - `t('some.key')` / `t("some.key")`
 * - `t('ns:some.key')` (namespaced)
 * - `i18nKey='some.key'` (`<Trans>`)
 *
 * Placeholder-shaped keys (interpolated statuses) are matched loosely because
 * the app composes them dynamically, e.g. ``t(`common:status.${status}`)``.
 */

import { describe, expect, test } from 'bun:test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { en } from './index';

const APP_SRC = join(import.meta.dir, '../../../apps/web-admin/src');
/** The backend resolves `api.*` keys from its own controllers and errors. */
const API_SRC = join(import.meta.dir, '../../../apps/backend/src');
/** The package's own entry point: `LANGUAGES` references keys by name. */
const PACKAGE_ENTRY = join(import.meta.dir, './index.ts');

/** Every `.ts`/`.tsx` file under the web-admin source tree. */
function sourceFiles(dir: string): string[] {
	const out: string[] = [];
	for (const entry of readdirSync(dir)) {
		const full = join(dir, entry);
		if (statSync(full).isDirectory()) {
			if (entry === 'node_modules' || entry === 'routeTree.gen.ts') continue;
			out.push(...sourceFiles(full));
		} else if (/\.tsx?$/.test(entry)) {
			out.push(full);
		}
	}
	return out;
}

const SOURCES = [...sourceFiles(APP_SRC), ...sourceFiles(API_SRC), PACKAGE_ENTRY];
const CONCATENATED = SOURCES.map((file) => readFileSync(file, 'utf8')).join('\n');

/**
 * Keys that may be composed at runtime via a template literal, as
 * `namespace:prefix`. A key under one of these is considered live when the
 * source contains the matching `` `namespace:prefix${…}` `` template.
 */
const DYNAMIC_PREFIXES = [
	'common:status.',
	'status.',
	// `t(`inventory:kind.${kind}`)` — an item's kind selects its own label.
	'inventory:kind.',
	// The ledger and the adjustment workflow label their enums the same way:
	// the value comes from the server, so the key has to be composed.
	'inventory:movements.type.',
	'inventory:movements.status.',
	'inventory:adjustments.type.',
	'inventory:adjustments.status.',
	// S4 borrowing workflow: status, purpose, condition, and event type all
	// arrive as server values, so the label key has to be composed.
	'inventory:borrowingStatus.',
	'inventory:borrowingPurpose.',
	'inventory:borrowingCondition.',
	'inventory:borrowingEvent.',
	// Asset module (M06): statuses, conditions, types and workflow enums are
	// server values, so the label keys are composed at runtime.
	'assets:status.',
	'assets:condition.',
	'assets:type.',
	'assets:disposalStatus.',
	'assets:disposalMethod.',
	'assets:maintenanceType.',
	'assets:maintenanceStatus.',
	'assets:maintenanceStatus.',
	'assets:toolSetStatus.',
];

function isReferenced(namespace: string, key: string): boolean {
	const qualified = `${namespace}:${key}`;
	const candidates = [qualified, key, `'${key}'`, `"${key}"`];
	if (candidates.some((candidate) => CONCATENATED.includes(candidate))) {
		return true;
	}
	// Composed keys: `t(`common:status.${status}`)`.
	for (const prefix of DYNAMIC_PREFIXES) {
		const applies = qualified.startsWith(prefix) || key.startsWith(prefix);
		if (applies && CONCATENATED.includes(`${prefix}\${`)) {
			return true;
		}
	}
	return false;
}

describe('locale dead keys', () => {
	for (const [namespace, bundle] of Object.entries(en)) {
		test(`${namespace}: every key is referenced by the app`, () => {
			const dead = Object.keys(bundle).filter(
				(key) => !isReferenced(namespace, key),
			);
			expect(dead).toEqual([]);
		});
	}
});
