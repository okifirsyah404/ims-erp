import { EMPTY_LOCATION_SELECTION, type TLocationSelection } from '@/components/inventory/location-cascade';
import type { TClaimPersonalData } from '@/lib/claim-api';

/** Form state of the personal section; `null`s until chosen. */
export type TClaimPersonalDraft = {
	nationalId: string;
	birthPlace: string;
	birthDate: string;
	gender: TClaimPersonalData['gender'] | null;
	maritalStatus: TClaimPersonalData['maritalStatus'];
	addressLine: string;
	location: TLocationSelection;
	postalCode: string;
};

export const EMPTY_CLAIM_PERSONAL: TClaimPersonalDraft = {
	nationalId: '',
	birthPlace: '',
	birthDate: '',
	gender: null,
	maritalStatus: null,
	addressLine: '',
	location: EMPTY_LOCATION_SELECTION,
	postalCode: '',
};

/**
 * The draft as the claim body expects it, or the i18n key of the first
 * problem (the backend checks the same rules).
 */
export function toClaimPersonal(draft: TClaimPersonalDraft): { data: TClaimPersonalData } | { error: 'nationalId' | 'birth' | 'gender' | 'address' | 'postalCode' } {
	if (!/^\d{16}$/.test(draft.nationalId)) return { error: 'nationalId' };
	if (!draft.birthPlace.trim() || !draft.birthDate) return { error: 'birth' };
	if (!draft.gender) return { error: 'gender' };
	if (!draft.addressLine.trim() || !draft.location.villageId) return { error: 'address' };
	if (!/^\d{5}$/.test(draft.postalCode)) return { error: 'postalCode' };
	return {
		data: {
			nationalId: draft.nationalId,
			birthPlace: draft.birthPlace.trim(),
			birthDate: draft.birthDate,
			gender: draft.gender,
			maritalStatus: draft.maritalStatus,
			address: { addressLine: draft.addressLine.trim(), villageId: draft.location.villageId, postalCode: draft.postalCode },
		},
	};
}
