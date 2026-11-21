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
			// "Target" is the Indonesian word too (customer portal, ERP-0022).
			'api:portal.label.target',
			// `JSON` is the format name in both languages.
			'settings:settings.type.json',
			// `Logo` is the same word in Indonesian.
			'settings:companyProfile.image.logo',
			// `Material` is the same word in both languages.
			'settings:numbering.type.item_material',
			'common:language.switchToEnglish',
			'common:language.switchToIndonesian',
			'nav:section.platform',
			'nav:item.organizations',
			'nav:item.crm',
			'auth:login.email',
			'auth:login.emailPlaceholder',
			'account:email.title',
			// Brand name of the social login provider (ERP-0107).
			'account:connected.google',
			'account:profile.email',
			'account:profile.bio',
			'admin:users.email',
	'admin:orgs.userEmail',
			'admin:users.status',
			'admin:users.filterStatus',
			// "Invoice" and "Status" are the Indonesian words too.
			'documents:status',
			// Digit-only phone example: the placeholder is a number pattern,
			// not prose, so it is identical in both bundles.
			'claim:form.phonePlaceholder',
		'inventory:warehouses.filterStatus',
		'inventory:warehouses.sortStatus',
			'admin:invite.email',
			'admin:invitations.email',
			'admin:invitations.status',
			'account:sessions.status',
			'admin:audit.metadata',
			'admin:roles.rank',
			'admin:roles.namePlaceholder',
			'admin:orgs.slug',
			'admin:orgEdit.slug',
			'admin:orgDetail.slug',
			// Shared role/finance terms identical in both languages.
			'admin:orgDashboard.roles.admin',
			'admin:orgDashboard.roles.total',
			'admin:orgDashboard.cash.bank',
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
			'finance:invoices.title',
			'finance:invoice.status',
			'finance:invoice.salesOrder',
			'finance:invoice.void',
			'finance:status.void',
			'finance:doc.title',
			'finance:doc.email',
			'finance:doc.status',
			'finance:doc.no',
			'finance:doc.qty',
			'finance:doc.subtotal',
			'finance:doc.customer',
			'finance:doc.web',
			'finance:doc.subTotal',
			'procurement:supplier.whatsapp',
			'procurement:supplier.status',
			'procurement:supplier.bankName',
			'procurement:pos.title',
			'procurement:po.status',
			'procurement:po.subtotal',
			'procurement:po.grandTotal',
			'procurement:po.vatMode',
			'procurement:doc.title',
			'procurement:doc.idr',
			'procurement:doc.status',
			'procurement:doc.email',
			'procurement:doc.pic',
			'procurement:doc.no',
			'procurement:doc.qty',
			'procurement:doc.subtotal',
			'procurement:doc.vatIncluded',
			'procurement:doc.vatAdded',
			'procurement:doc.total',
			'sales:doc.heading',
			'sales:doc.total',
			'sales:orders.open',
			// Surat jalan print labels the company uses verbatim.
			'sales:sj.no',
			'sales:sj.qty',
			'sales:sj.email',
			'sales:sj.serials',
			// Project terms used verbatim in Indonesian.
			// Integration terms used verbatim in Indonesian (M04).
			'integrations:outbox.event',
			'integrations:whatsapp.title',
			'integrations:whatsapp.state',
			'integrations:whatsapp.author.admin',
			'integrations:faq.state',
			// License terms used verbatim in Indonesian (M03).
			'licensing:field.salesOrder',
			'licensing:field.status',
			'licensing:field.vendor',
			'licensing:keys.source.vendor',
			'projects:stage.training',
			'projects:evidenceKind.training',
			'projects:costCategory.material',
			'projects:costs.margin',
			'projects:channel.whatsapp',
			'projects:channel.email',
			'projects:items.no',
			'projects:bastList.title',
			'projects:bastDoc.no',
			'projects:bastDoc.volume',
			'projects:warrantyDoc.email',
			'sales:delivery.status',
			'inventory:address.rt',
			'inventory:address.rw',
			'inventory:address.label',
			// "Global" is the standard Indonesian term for a company-wide scope.
			'inventory:warehouses.global',
			// "Total" is the same word in Indonesian.
			'dashboard:widget.cash.total',
			// Business terms the company uses verbatim in Indonesian documents.
			'settings:companyProfile.email',
			// "Mode", "Status" and "Live" are the Indonesian words too.
			'settings:paymentGateways.mode',
			'settings:paymentGateways.modeLive',
			'settings:paymentGateways.status',
			// "Slug" is the same technical term in Indonesian.
			'inventory:categories.slug',
			'crm:customer.email',
			'crm:customer.whatsapp',
			'crm:customer.status',
			// Status/label column headers read the same in both locales.
			'assets:register.status',
			'assets:disposals.status',
			'assets:service.status',
			'assets:toolSets.status',
			'tax:recap.column.filingStatus',
			'tax:records.status',
			'tax:withholding.status',
			// "Transfer" is a loanword in Indonesian.
			'assets:disposalMethod.transfer',
			// Work arrangements use the English terms verbatim in Indonesian HR.
			'hr:workType.onsite',
			'hr:workType.remote',
			'hr:workType.hybrid',
			// "Company-level" is the code's own term for organization_id NULL.
			'hr:list.companyLevel',
			// HR terms used verbatim in Indonesian (M08).
			'hr:field.status',
			'hr:bank.name',
			'hr:import.file',
			'hr:salary.bonus',
			'hr:salary.total',
			'hr:detail.companyLevel',
			// Standard accounting vocabulary is identical in Indonesian.
			'finance:normalBalance.debit',
			'finance:normalBalance.credit',
			'finance:journal.debit',
			'finance:journal.credit',
			'finance:journal.totalDebit',
			'finance:journal.totalCredit',
			'finance:accountType.bank',
			'finance:payments.method.virtual_account',
			'finance:closing.item.pass',
			// The em-dash placeholder is locale-neutral.
			'finance:common.none',
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
