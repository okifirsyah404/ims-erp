import type {
	TCompanyAddressSelect,
	TCompanyProfileSelect,
	TCompanySettingSelect,
	TContactSelect,
	TLetterheadSelect,
} from '@drizzle/schemas/company.schema';
import type { TTx } from '@drizzle/types';
import type { TCompanySettingValueType } from './company.contract';

/** Letterhead columns of `company.profiles` (everything but id, audit and image keys). */
export type TCompanyProfileColumns = Omit<
	TCompanyProfileSelect,
	| 'id'
	| 'createdAt'
	| 'updatedAt'
	| 'deletedAt'
	| 'logoObjectKey'
	| 'signatureObjectKey'
	| 'onboardingObjectKey'
	| 'status'
>;

/** A contact channel the flat profile keeps in sync. */
export type TContactChannel = {
	contactType: string;
	value: string;
	label: string;
	isPrimary: boolean;
};

/** Everything a profile read needs, already assembled by the service/facade. */
export type TCompanyProfileRecord = {
	profile: TCompanyProfileSelect;
	address: TCompanyAddressSelect | null;
	contacts: TContactSelect[];
};

/** Persistence port for `company.profiles` (singleton live row). */
export interface ICompanyProfileRepository {
	/** The live profile row, or `null` before the first save. Cached outside a tx. */
	find(tx?: TTx): Promise<TCompanyProfileSelect | null>;

	/**
	 * Updates the live profile, or inserts the first one. With `tx` the cache
	 * is left alone: the caller calls {@link invalidate} after the commit.
	 */
	save(data: TCompanyProfileColumns, tx?: TTx): Promise<TCompanyProfileSelect>;

	/** Evicts the cached profile; call after the surrounding transaction commits. */
	invalidate(): Promise<void>;

	/** Sets (or clears) one image key of the live profile; `null` when there is no profile. */
	setImage(
		kind: 'logo' | 'signature' | 'onboarding',
		key: string | null,
	): Promise<TCompanyProfileSelect | null>;
}

/** Persistence port for `company.addresses`. */
export interface ICompanyAddressRepository {
	/** The live primary address, or `null`. */
	findPrimary(tx?: TTx): Promise<TCompanyAddressSelect | null>;

	/** Keeps exactly one live primary address; `addressLine: null` soft-deletes it. */
	savePrimary(
		data: { addressLine: string | null; postalCode: string | null },
		tx?: TTx,
	): Promise<void>;
}

/** Persistence port for `company.contacts`. */
export interface ICompanyContactRepository {
	/** Every live contact channel. */
	findAll(tx?: TTx): Promise<TContactSelect[]>;

	/** Keeps one live row per channel type; a `null` value removes the type. */
	syncChannels(channels: Array<TContactChannel | { contactType: string; value: null }>, tx?: TTx): Promise<void>;
}

/** Persistence port for `company.settings`. */
export interface ICompanySettingRepository {
	/** Every live company setting. */
	findAll(): Promise<TCompanySettingSelect[]>;

	/** The live setting for a group/key, if any. */
	find(group: string, key: string): Promise<TCompanySettingSelect | null>;

	/** Creates or updates the live setting for a group/key. */
	upsert(
		group: string,
		key: string,
		data: { valueType: TCompanySettingValueType; value: string | null; updatedBy: string },
	): Promise<TCompanySettingSelect>;
}

/** Persistence port for `company.letterheads` (ERP-0165). */
export interface ILetterheadRepository {
	/** Live letterheads, the default first, then by name. */
	findAll(): Promise<TLetterheadSelect[]>;

	/** A live letterhead, or `null`. */
	findLive(id: string): Promise<TLetterheadSelect | null>;

	/** A letterhead even after it was deleted (an issued document still prints with it), or `null`. */
	findAny(id: string): Promise<TLetterheadSelect | null>;

	/** The live default letterhead, or `null`. */
	findDefault(): Promise<TLetterheadSelect | null>;

	/** Inserts one; with `isDefault` the previous default stops being one, in the same transaction. */
	create(data: {
		name: string;
		headerObjectKey: string;
		footerObjectKey: string | null;
		isDefault: boolean;
		updatedBy: string;
	}): Promise<TLetterheadSelect>;

	/**
	 * Changes a live letterhead; `isDefault: true` takes the default from the
	 * previous one in the same transaction. `null` when it is not live.
	 */
	update(
		id: string,
		data: Partial<Pick<TLetterheadSelect, 'name' | 'isDefault' | 'headerObjectKey' | 'footerObjectKey'>> & { updatedBy: string },
	): Promise<TLetterheadSelect | null>;

	/** Soft-deletes a live letterhead (it also stops being the default); `false` when it is not live. */
	softDelete(id: string, updatedBy: string): Promise<boolean>;
}
