import { documentImageUrl, storeDocumentImage } from '@providers/s3/document-image';
import { type IObjectStorage, OBJECT_STORAGE_TOKEN } from '@providers/s3/object-storage';
import {
	type ITransactionRunner,
	TRANSACTION_RUNNER_TOKEN,
} from '@providers/database/transaction-runner';
import { inject, injectable } from 'tsyringe';
import {
	COMPANY_ADDRESS_REPOSITORY_TOKEN,
	COMPANY_CONTACT_REPOSITORY_TOKEN,
	COMPANY_PROFILE_REPOSITORY_TOKEN,
	COMPANY_SETTING_REPOSITORY_TOKEN,
} from '../constants/di';
import type {
	TCompanyBranding,
	TCompanyImageKind,
	TCompanyProfileInput,
	TCompanyProfilePatch,
	TCompanyProfileView,
	TCompanySettingInput,
	TCompanySettingView,
} from '../contracts/company.contract';
import type {
	ICompanyAddressRepository,
	ICompanyContactRepository,
	ICompanyProfileRepository,
	ICompanySettingRepository,
	TCompanyProfileRecord,
} from '../contracts/company.repository.interface';
import { CompanyProfileRequiredError, CompanySettingInvalidError } from '../errors/company.errors';
import { toContactChannels, toFlat } from '../utils/profile-mapper';

/** Checks a raw setting value against its declared type; `null` is always allowed (cleared). */
function assertSettingValue(valueType: TCompanySettingInput['valueType'], value: string | null): void {
	if (value === null) return;
	const valid: Record<TCompanySettingInput['valueType'], (v: string) => boolean> = {
		string: () => true,
		number: (v) => Number.isFinite(Number(v)) && v.trim() !== '',
		boolean: (v) => v === 'true' || v === 'false',
		json: (v) => {
			try {
				JSON.parse(v);
				return true;
			} catch {
				return false;
			}
		},
		date: (v) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`)),
	};
	if (!valid[valueType](value)) throw new CompanySettingInvalidError(valueType);
}

function toView(record: TCompanyProfileRecord, storage: IObjectStorage): TCompanyProfileView {
	return {
		...toFlat(record),
		logoUrl: documentImageUrl(storage, record.profile.logoObjectKey),
		signatureUrl: documentImageUrl(storage, record.profile.signatureObjectKey),
		onboardingUrl: documentImageUrl(storage, record.profile.onboardingObjectKey),
	};
}

function toSettingView(row: {
	settingGroup: string;
	settingKey: string;
	valueType: string;
	settingValue: string | null;
}): TCompanySettingView {
	return {
		settingGroup: row.settingGroup,
		settingKey: row.settingKey,
		valueType: row.valueType as TCompanySettingView['valueType'],
		value: row.settingValue,
	};
}

/**
 * Company use cases: one profile for the whole company (ADR-0011).
 *
 * @remarks
 * Readable by every organization member because every print needs the
 * letterhead. The profile, its primary address and its contacts commit in one
 * transaction. Other modules read the letterhead through
 * `ExportedCompanyService`, never this class. Invoice bank accounts are served
 * by `finance` (`/finance/cash-bank-accounts`), not by company.
 */
@injectable()
export class CompanyService {
	constructor(
		@inject(COMPANY_PROFILE_REPOSITORY_TOKEN)
		private readonly profiles: ICompanyProfileRepository,
		@inject(COMPANY_ADDRESS_REPOSITORY_TOKEN)
		private readonly addresses: ICompanyAddressRepository,
		@inject(COMPANY_CONTACT_REPOSITORY_TOKEN)
		private readonly contacts: ICompanyContactRepository,
		@inject(COMPANY_SETTING_REPOSITORY_TOKEN)
		private readonly settings: ICompanySettingRepository,
		@inject(OBJECT_STORAGE_TOKEN)
		private readonly storage: IObjectStorage,
		@inject(TRANSACTION_RUNNER_TOKEN)
		private readonly transactions: ITransactionRunner,
	) {}

	private async readRecord(tx?: Parameters<ICompanyProfileRepository['find']>[0]): Promise<TCompanyProfileRecord | null> {
		const profile = await this.profiles.find(tx);
		if (!profile) return null;
		const [address, contacts] = await Promise.all([
			this.addresses.findPrimary(tx),
			this.contacts.findAll(tx),
		]);
		return { profile, address, contacts };
	}

	/** The profile, or `null` before it was first saved. */
	async get(): Promise<TCompanyProfileView | null> {
		const record = await this.readRecord();
		return record ? toView(record, this.storage) : null;
	}

	/**
	 * Public branding for unauthenticated surfaces (the login page): display
	 * name and the onboarding image URL. Only non-sensitive fields.
	 */
	async getBranding(): Promise<TCompanyBranding> {
		const profile = await this.profiles.find();
		return {
			name: profile ? (profile.tradingName ?? profile.legalName) : null,
			onboardingUrl: profile ? documentImageUrl(this.storage, profile.onboardingObjectKey) : null,
		};
	}

	/**
	 * Saves the profile, its primary address and its contacts together.
	 *
	 * @throws {CompanyProfileRequiredError} When the first save lacks `legalName` or `documentCode`
	 */
	async save(patch: TCompanyProfilePatch, actorUserId: string): Promise<TCompanyProfileView> {
		// Merge over the stored profile so omitted fields keep their value.
		const current = await this.readRecord();
		const sent = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
		const merged = { ...(current ? toFlat(current) : {}), ...sent } as TCompanyProfileInput;
		if (!merged.legalName || !merged.documentCode) throw new CompanyProfileRequiredError();

		const { addressLine, postalCode, phone, email, website, ...columns } = merged;
		const record = await this.transactions.run(async (tx) => {
			await this.profiles.save({ ...columns, updatedBy: actorUserId }, tx);
			await this.addresses.savePrimary({ addressLine, postalCode }, tx);
			await this.contacts.syncChannels(toContactChannels({ phone, email, website }), tx);
			const saved = await this.readRecord(tx);
			if (!saved) throw new Error('Company profile disappeared inside its own transaction');
			return saved;
		});
		await this.profiles.invalidate();
		return toView(record, this.storage);
	}

	/** Every company setting. Values are plain text; typing is checked on write. */
	async listSettings(): Promise<TCompanySettingView[]> {
		return (await this.settings.findAll()).map(toSettingView);
	}

	/**
	 * Creates or replaces one setting. `isSecret` is never set here: the column
	 * stays `false` until the dynamic-secret feature exists (ERP-0045 decision).
	 */
	async upsertSetting(
		group: string,
		key: string,
		input: TCompanySettingInput,
		actorUserId: string,
	): Promise<TCompanySettingView> {
		assertSettingValue(input.valueType, input.value);
		const row = await this.settings.upsert(group, key, {
			valueType: input.valueType,
			value: input.value,
			updatedBy: actorUserId,
		});
		return toSettingView(row);
	}

	/**
	 * Replaces (or, with `null`, removes) one profile image (logo, signature,
	 * onboarding). A new key every time, so nothing already printed changes.
	 *
	 * @throws {CompanyProfileRequiredError} Before the profile was first saved
	 */
	async setImage(kind: TCompanyImageKind, file: File | null): Promise<TCompanyProfileView> {
		if (!(await this.profiles.find())) throw new CompanyProfileRequiredError();
		const key = file ? await storeDocumentImage(this.storage, `company/${kind}`, file) : null;
		const profile = await this.profiles.setImage(kind, key);
		if (!profile) throw new CompanyProfileRequiredError();
		const record = await this.readRecord();
		if (!record) throw new CompanyProfileRequiredError();
		return toView(record, this.storage);
	}
}
