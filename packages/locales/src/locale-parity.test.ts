import { describe, expect, test } from 'bun:test';

import { en, id } from './index';

/**
 * Guards translation drift. The TypeScript `Record<keyof typeof en, string>`
 * annotation already rejects a *missing* Indonesian key at compile time, but
 * it cannot catch an empty string, an untranslated copy-paste, or a mismatch
 * in `{{interpolation}}` placeholders. Those are what this file covers.
 */

type Bundle = Record<string, Record<string, string>>;

const en_ = en as unknown as Bundle;
const id_ = id as unknown as Bundle;

/** Extracts `{{name}}` placeholders from a translation string. */
function placeholders(value: string): string[] {
	return [...value.matchAll(/\{\{(\w+)\}\}/g)]
		.map((match) => match[1]!)
		.sort();
}

describe('locale parity', () => {
	test('both locales expose the same namespaces', () => {
		expect(Object.keys(id_).sort()).toEqual(Object.keys(en_).sort());
	});

	for (const namespace of Object.keys(en_)) {
		test(`${namespace}: key sets are identical`, () => {
			expect(Object.keys(id_[namespace]!).sort()).toEqual(
				Object.keys(en_[namespace]!).sort(),
			);
		});

		test(`${namespace}: no empty translations`, () => {
			const empty = Object.entries(en_[namespace]!)
				.concat(Object.entries(id_[namespace]!))
				.filter(([, value]) => value.trim() === '')
				.map(([key]) => key);
			expect(empty).toEqual([]);
		});

		test(`${namespace}: interpolation placeholders match`, () => {
			const mismatched = Object.entries(en_[namespace]!).flatMap(
				([key, english]) => {
					const indonesian = id_[namespace]![key]!;
					return placeholders(english).join() === placeholders(indonesian).join()
						? []
						: [key];
				},
			);
			expect(mismatched).toEqual([]);
		});
	}
});

describe('locale values', () => {
	test('Indonesian is actually translated where English is text', () => {
		// Guards against copy-pasting the English bundle into `id`. Brand names
		// and locale-neutral tokens are expected to match, so they're exempt.
		const ALLOWED_IDENTICAL = new Set([
			'common:language.switchToEnglish',
			'common:language.switchToIndonesian',
			'nav:section.platform',
			'nav:item.organizations',
			'nav:item.crm',
			'auth:login.email',
			'auth:login.emailPlaceholder',
			'account:tab.email',
			'account:email.title',
			'account:profile.email',
			'account:profile.bio',
			'admin:users.email',
			'admin:users.status',
			'admin:users.filterStatus',
			'admin:invite.email',
			'admin:invitations.email',
			'admin:invitations.status',
			'account:sessions.status',
			'admin:orgDetail.memberEmail',
			'admin:audit.metadata',
			'admin:roles.rank',
			'admin:roles.namePlaceholder',
			'admin:orgs.slug',
			'admin:orgEdit.slug',
			'admin:orgDetail.slug',
			'admin:orgDetail.info',
			// Indonesian terms used verbatim in the English UI: RT/RW are
			// neighbourhood administrative units with no English equivalent.
			// Same word in both languages.
			'sales:quotation.status',
			'sales:quotation.subtotal',
			'sales:detail.email',
			'sales:status.won',
			// The printed SPH keeps the company's own (partly English) labels.
			'sales:doc.date',
			'inventory:address.rt',
			'inventory:address.rw',
			'inventory:address.label',
			// "Global" is the standard Indonesian term for a company-wide scope.
			'inventory:warehouses.global',
			// "Total" is the same word in Indonesian.
			'dashboard:widget.cash.total',
			// Business terms the company uses verbatim in Indonesian documents.
			'settings:companyProfile.email',
			'settings:companyProfile.bankName',
			'settings:numbering.type.sales_order',
			'settings:numbering.type.invoice',
			'settings:numbering.type.purchase_order',
			// "Slug" is the same technical term in Indonesian.
			'inventory:categories.slug',
			'crm:customer.email',
			'crm:customer.whatsapp',
			'crm:customer.status',
		]);

		const untranslated = Object.entries(en_).flatMap(([namespace, bundle]) =>
			Object.entries(bundle)
				.filter(([key, english]) => {
					if (ALLOWED_IDENTICAL.has(`${namespace}:${key}`)) return false;
					// Pure interpolation templates are locale-neutral.
					if (english.includes('{{') && !/[a-z]{3}/i.test(english.replace(/\{\{\w+\}\}/g, ''))) {
						return false;
					}
					return id_[namespace]![key] === english;
				})
				.map(([key]) => `${namespace}:${key}`),
		);

		expect(untranslated).toEqual([]);
	});
});
