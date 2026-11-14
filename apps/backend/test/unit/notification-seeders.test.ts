/**
 * Drift guard for the notification seeders (ERP-0047 Phase 6).
 *
 * @remarks
 * The template list is duplicated by necessity: the Drizzle schema declares the
 * closed code vocabulary, the seeder owns the copy, and the client owns the
 * localized strings. This test fails the moment a code is added to the
 * vocabulary without a seed row, which would otherwise surface as a worker job
 * skipped at runtime ("template missing or inactive").
 */
import { describe, expect, test } from 'bun:test';
import { NOTIFICATION_TEMPLATE_CODES } from '../../drizzle/schemas/notification.schema';
import { NOTIFICATION_TEMPLATE_SEEDS } from '../../database/seeders/seed/notification-templates.seeder';

describe('notification template seeds', () => {
	test('every declared code has exactly one seed row', () => {
		const seeded = NOTIFICATION_TEMPLATE_SEEDS.map((template) => template.code);
		expect(new Set(seeded).size).toBe(seeded.length);
		expect([...seeded].sort()).toEqual([...NOTIFICATION_TEMPLATE_CODES].sort());
	});

	test('every seed declares the variables its own placeholders use', () => {
		for (const template of NOTIFICATION_TEMPLATE_SEEDS) {
			const placeholders = new Set(
				[...`${template.subjectTemplate} ${template.bodyTemplate}`.matchAll(
					/\{\{\s*(\w+)\s*\}\}/g,
				)].map((match) => match[1]),
			);
			// A placeholder the producer is never told to fill renders as an
			// empty gap; a declared-but-unused variable is dead contract.
			expect([...placeholders].sort()).toEqual([...template.variables].sort());
		}
	});
});
