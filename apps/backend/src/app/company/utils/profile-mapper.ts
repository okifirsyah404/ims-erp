import type { TCompanyProfileInput, TCompanyProfileSnapshot } from '../contracts/company.contract';
import type { TCompanyProfileRecord, TContactChannel } from '../contracts/company.repository.interface';

/**
 * Contact channels kept in sync with the flat profile contract: phone and
 * email are primary (printed on the letterhead), the website is not.
 */
export const PROFILE_CONTACTS = [
	{ field: 'phone', contactType: 'phone', label: 'Phone', isPrimary: true },
	{ field: 'email', contactType: 'email', label: 'Email', isPrimary: true },
	{ field: 'website', contactType: 'other', label: 'Website', isPrimary: false },
] as const;

/** Maps the flat contact fields of the profile to channel rows (`null` value removes the type). */
export function toContactChannels(
	data: Pick<TCompanyProfileInput, 'phone' | 'email' | 'website'>,
): Array<TContactChannel | { contactType: string; value: null }> {
	return PROFILE_CONTACTS.map(({ field, contactType, label, isPrimary }) => {
		const value = data[field];
		return value ? { contactType, value, label, isPrimary } : { contactType, value: null };
	});
}

/** Flat view of the split storage (profile + primary address + contacts). */
export function toFlat(
	record: TCompanyProfileRecord,
): Omit<TCompanyProfileSnapshot, 'logoObjectKey' | 'signatureObjectKey' | 'onboardingObjectKey'> {
	const { profile, address, contacts } = record;
	const contact = (type: string) => contacts.find((c) => c.contactType === type)?.value ?? null;
	return {
		legalName: profile.legalName,
		tradingName: profile.tradingName,
		documentCode: profile.documentCode,
		tagline: profile.tagline,
		taxId: profile.taxId,
		addressLine: address?.addressLine ?? null,
		postalCode: address?.postalCode ?? null,
		phone: contact('phone'),
		email: contact('email'),
		website: contact('other'),
		signatoryName: profile.signatoryName,
		signatoryTitle: profile.signatoryTitle,
		defaultQuotationTerms: profile.defaultQuotationTerms,
		defaultInvoiceTerms: profile.defaultInvoiceTerms,
		warrantyCoverage: profile.warrantyCoverage,
		warrantyExclusions: profile.warrantyExclusions,
		warrantyServiceTerms: profile.warrantyServiceTerms,
	};
}

/** The letterhead snapshot other modules render (flat fields plus image keys). */
export function toSnapshot(record: TCompanyProfileRecord): TCompanyProfileSnapshot {
	return {
		...toFlat(record),
		logoObjectKey: record.profile.logoObjectKey,
		signatureObjectKey: record.profile.signatureObjectKey,
		onboardingObjectKey: record.profile.onboardingObjectKey,
	};
}
