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
	// Online payment status labels come from server values (ERP-0020).
	'finance:gateway.status.',
	'status.',
	// Company setting value types, rendered from the stored `valueType`.
	'settings:settings.type.',
	// The detail page labels the access trail with the server's action value.
	'documents:action.',
	// `t(`inventory:kind.${kind}`)` — an item's kind selects its own label.
	'inventory:kind.',
	// The ledger and the adjustment workflow label their enums the same way:
	// the value comes from the server, so the key has to be composed.
	'inventory:movements.type.',
	'inventory:movements.status.',
	'inventory:adjustments.type.',
	'inventory:adjustments.status.',
	// Numbering pattern problems: the backend error composes
	// `numbering.pattern.${code}` from the validator's problem code.
	'numbering.pattern.',
	// Website inquiry errors compose `publicApi.${kind}`.
	'publicApi.',
	// The website content editor labels registry fields, content types and
	// statuses by composing the key (ERP-0071).
	'website.content.field.',
	'website.content.type.',
	'website.content.status.',
	// The numbering settings page labels server values (document type,
	// reset policy) by composing the key.
	'settings:numbering.type.',
	'settings:numbering.reset.',
	// Customer type and status labels come from server values.
	'crm:customerType.',
	'crm:customerStatus.',
	'crm:leadStatus.',
	'crm:leadSource.',
	'crm:leadChannel.',
	'crm:activityType.',
	// Quotation status and lost-reason labels come from server values; the
	// backend composes `sales.quotationState.${kind}` errors.
	'sales:status.',
	// The logo and signature upload fields compose their label key.
	'settings:companyProfile.image.',
	'sales:lostReason.',
	'sales:orderStatus.',
	// Invoice status, term kind and receipt method labels come from server values.
	'finance:status.',
	'finance:termKind.',
	'finance:method.',
	// Procurement labels composed from server values or form field names.
	'procurement:supplier.',
	'procurement:supplierType.',
	'procurement:category.',
	'procurement:vatMode.',
	'procurement:status.',
	'procurement:returnStatus.',
	'sales:returnStatus.',
	'sales:returnCondition.',
	// Purchase request status labels come from server values (M05).
	'procurement:prStatus.',
	'doc.statusText.',
	'method.',
	'sales.quotationState.',
	'deliveryStatus.',
	'projects:status.',
	'projects:stage.',
	'projects:taskStatus.',
	'projects:evidenceKind.',
	'projects:costCategory.',
	'projects:bast.party',
	'projects:ticketStatus.',
	'projects:channel.',
	'licensing:status.',
	'licensing:cycle.',
	'licensing:source.',
	// Employee enum labels (status, employment type, work type) come from
	// server values and are composed by the HR UI.
	'hr:status.',
	'hr:employmentType.',
	'hr:workType.',
	// M08 records: server values composed into label keys.
	'hr:request.status.',
	'hr:request.done.',
	'hr:import.error.',
	'hr:taskStatus.',
	'hr:salary.state.',
	'licensing:keys.source.',
	'licensing:keys.status.',
	'licensing:events.kind.',
	'licensing:result.',
	'integrations:catalog.priceMode.',
	'integrations:catalog.outOfStock.',
	'integrations:outbox.status.',
	'integrations:outbox.topic.',
	'integrations:whatsapp.missing.',
	'integrations:whatsapp.status.',
	'integrations:whatsapp.reason.',
	'integrations:whatsapp.author.',
	// Finance errors compose `finance.term.${problem}` / `finance.invoiceState.${kind}`.
	'finance.term.',
	'finance.invoiceState.',
	'procurement.poState.',
	'procurement.prState.',
	'procurement.receiptLine.',
	'accounting.billLine.',
	'finance:bills.fromOrder.vat.',
	'procurement.returnLine.',
	'procurement.returnState.',
	'sales.returnLine.',
	'sales.returnState.',
	'sales.returnReceive.',
	'sales.deliveryLine.',
	'sales.deliveryState.',
	'projects.deal.',
	'projects.staff.',
	'projects.childNotFound.',
	'projects.forbidden.',
	'projects.file.',
	'aftersales.ticketRef.',
	'sales.invoiceTerm.',
	'aftersales.ticketState.',
	'hr.notFound.',
	'hr.employeeState.',
	'hr.leave.',
	'hr.requestState.',
	'hr.salary.',
	'hr.import.',
	'licensing.notFound.',
	'licensing.contract.',
	'licensing.state.',
	'licensing.key.',
	'licensing.api.',
	'licensing.refused.',
	'licensing.apiKey.',
	// Customer portal (ERP-0022): stage and evidence labels are composed from
	// the server value in `portal-presenter.ts`.
	'portal.stage.',
	// Portal order status labels compose `portal.sales.order.${status}` (ERP-0070).
	'portal.sales.order.',
	// Website RFQ status labels compose `portal.rfq.status.${status}` (ERP-0072).
	'portal.rfq.status.',
	// Order tracking labels compose the stage name (ERP-0073).
	'tracking.stage.',
	'tracking.text.',
	'tracking.now.',
	// Website settings (ERP-0071) label socials and menus by their server code.
	'website.social.',
	'website.menu.title.',
	'website.menu.hint.',
	'website.menu.default.',
	'portal.evidence.',
	'portal.role.',
	'crm:portal.role.',
	'catalog.notFound.',
	'catalog.listing.',
	'automation.whatsappNotFound.',
	'automation.whatsappWebhook.',
	'automation.whatsappState.',
	// Borrowing workflow (ERP-0036): status, purpose, condition, and event
	// type all arrive as server values, so the label key has to be composed.
	'assets:borrowingStatus.',
	'assets:borrowingPurpose.',
	'assets:borrowingCondition.',
	'assets:borrowingEvent.',
	// Asset module (M06): statuses, conditions and workflow enums are
	// server values, so the label keys are composed at runtime.
	'assets:status.',
	'assets:condition.',
	'assets:disposalStatus.',
	'assets:disposalMethod.',
	'assets:maintenanceType.',
	'assets:maintenanceStatus.',
	'assets:toolSetStatus.',
	'assets:movementType.',
	// Finance/accounting (M09): statuses, enum labels and report sections are
	// server values, so the label keys are composed at runtime.
	'finance:accountType.',
	'finance:normalBalance.',
	'finance:cashFlowCategory.',
	'finance:periods.status.',
	'finance:periods.transition.',
	'finance:payments.status.',
	'finance:payments.method.',
	'finance:payments.type.',
	'finance:bills.status.',
	'finance:aging.bucket.',
	'finance:reconciliation.status.',
	'finance:closing.item.',
	// Organization info dashboard composes role, project status, activity
	// action and account type labels from dummy data values.
	'orgDashboard.roles.',
	'orgDashboard.projects.status.',
	'orgDashboard.activity.actions.',
	'orgDashboard.cash.',
	// Signature flow (ERP-0048/ERP-0049): the method and request status labels
	// are composed from the server's value, so the prefix is what to match.
	'signatures:methodOption.',
	'signatures:status.',
	// Notification templates are rendered from `templateCode` (server value).
	'template.document.signatureRequested.',
	'template.document.signatureSigned.',
	'template.document.signatureDeclined.',
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
