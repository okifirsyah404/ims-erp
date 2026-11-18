import type {
	TBankAccountSelect,
} from '@drizzle/schemas/company.schema';
import type { TTx } from '@drizzle/types';
import { documentImageUrl, storeDocumentImage } from '@providers/s3/document-image';
import { type IObjectStorage, OBJECT_STORAGE_TOKEN } from '@providers/s3/object-storage';
import { inject, injectable } from 'tsyringe';
import { COMPANY_REPOSITORY_TOKEN } from '../constants/di';
import type {
	TCompanyBranding,
	TCompanyImageKind,
	TCompanyProfileInput,
	TCompanyProfilePatch,
	TCompanyProfileSnapshot,
	TCompanyProfileView,
	TCompanySettingInput,
	TCompanySettingView,
	TInvoiceBankAccount,
} from '../contracts/company.contract';
import type {
	ICompanyRepository,
	TCompanyProfileRecord,
} from '../contracts/company.repository.interface';
import { CompanyProfileRequiredError, CompanySettingInvalidError } from '../errors/company.errors';

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

function toAccount(row: TBankAccountSelect | undefined): TInvoiceBankAccount | null {
	return row
		? {
				bankName: row.bankName,
				accountNumber: row.accountNumber,
				accountHolder: row.accountHolder,
			}
		: null;
}

/** Flat view of the split storage (profile + primary address + contacts). */
function toFlat(
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

function toSnapshot(record: TCompanyProfileRecord): TCompanyProfileSnapshot {
	return {
		...toFlat(record),
		logoObjectKey: record.profile.logoObjectKey,
		signatureObjectKey: record.profile.signatureObjectKey,
		onboardingObjectKey: record.profile.onboardingObjectKey,
	};
}

function toView(
	record: TCompanyProfileRecord,
	accounts: TBankAccountSelect[] | null,
	storage: IObjectStorage,
): TCompanyProfileView {
	return {
		...toFlat(record),
		logoUrl: documentImageUrl(storage, record.profile.logoObjectKey),
		signatureUrl: documentImageUrl(storage, record.profile.signatureObjectKey),
		onboardingUrl: documentImageUrl(storage, record.profile.onboardingObjectKey),
		bankAccounts: accounts
			? {
					vat: toAccount(accounts.find((a) => a.invoiceUsage === 'vat')),
					nonVat: toAccount(accounts.find((a) => a.invoiceUsage === 'non_vat')),
				}
			: null,
	};
}

/**
 * Company use cases: one profile for the whole company (ADR-0011).
 *
 * @remarks
 * Readable by every organization member because every print needs the
 * letterhead; the invoice bank accounts only when `includeBanks` (decided by
 * the controller from the caller's grants). The profile and its two invoice
 * accounts are saved in one transaction; omitted accounts, or accounts sent by
 * a caller without bank access, are left unchanged.
 */
@injectable()
export class CompanyService {
	constructor(
		@inject(COMPANY_REPOSITORY_TOKEN)
		private readonly repository: ICompanyRepository,
		@inject(OBJECT_STORAGE_TOKEN)
		private readonly storage: IObjectStorage,
	) {}

	/**
	 * The letterhead snapshot other modules render.
	 *
	 * @remarks
	 * `tx` lets a caller read inside its own transaction (e.g. a number issued
	 * while a document is created).
	 */
	async getProfile(tx?: TTx): Promise<TCompanyProfileSnapshot | null> {
		const record = await this.repository.findProfile(tx);
		return record ? toSnapshot(record) : null;
	}

	/** Display name for user-facing surfaces: `tradingName ?? legalName`. */
	async getDisplayName(): Promise<string | null> {
		const record = await this.repository.findProfile();
		return record ? (record.profile.tradingName ?? record.profile.legalName) : null;
	}

	/** The profile, or `null` before it was first saved. */
	async get(includeBanks: boolean): Promise<TCompanyProfileView | null> {
		const record = await this.repository.findProfile();
		if (!record) return null;
		return toView(record, includeBanks ? await this.repository.findInvoiceAccounts() : null, this.storage);
	}

	/**
	 * Public branding for unauthenticated surfaces (the login page): display
	 * name and the onboarding image URL. Only non-sensitive fields.
	 */
	async getBranding(): Promise<TCompanyBranding> {
		const record = await this.repository.findProfile();
		const name = record
			? (record.profile.tradingName ?? record.profile.legalName)
			: null;
		return {
			name,
			onboardingUrl: record
				? documentImageUrl(this.storage, record.profile.onboardingObjectKey)
				: null,
		};
	}

	async save(
		patch: TCompanyProfilePatch,
		actorUserId: string,
		includeBanks: boolean,
	): Promise<TCompanyProfileView> {
		const { bankAccounts, ...fields } = patch;
		// Merge over the stored profile so omitted fields keep their value.
		const current = await this.repository.findProfile();
		const sent = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined));
		const merged = { ...(current ? toFlat(current) : {}), ...sent } as TCompanyProfileInput;
		if (!merged.legalName || !merged.documentCode) throw new CompanyProfileRequiredError();
		// Callers who may not see the accounts may not change them either.
		const saved = await this.repository.save(
			{ ...merged, updatedBy: actorUserId },
			includeBanks ? bankAccounts : undefined,
		);
		return toView(saved.record, includeBanks ? saved.accounts : null, this.storage);
	}

	/**
	 * Replaces (or, with `null`, removes) one profile image. A new key every
	 * time, so nothing already printed changes.
	 *
	 * @throws {CompanyProfileRequiredError} Before the profile was first saved
	 */
	/** Every company setting. Values are plain text; typing is checked on write. */
	async listSettings(): Promise<TCompanySettingView[]> {
		const rows = await this.repository.findSettings();
		return rows.map((row) => ({
			settingGroup: row.settingGroup,
			settingKey: row.settingKey,
			valueType: row.valueType as TCompanySettingView['valueType'],
			value: row.settingValue,
		}));
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
		const row = await this.repository.upsertSetting(group, key, {
			valueType: input.valueType,
			value: input.value,
			updatedBy: actorUserId,
		});
		return {
			settingGroup: row.settingGroup,
			settingKey: row.settingKey,
			valueType: row.valueType as TCompanySettingView['valueType'],
			value: row.settingValue,
		};
	}

	/**
	 * Replaces (or, with `null`, removes) one profile image (logo, signature,
	 * onboarding). A new key every time, so nothing already printed changes.
	 *
	 * @throws {CompanyProfileRequiredError} Before the profile was first saved
	 */
	async setImage(
		kind: TCompanyImageKind,
		file: File | null,
		includeBanks: boolean,
	): Promise<TCompanyProfileView> {
		if (!(await this.repository.findProfile())) throw new CompanyProfileRequiredError();
		const key = file ? await storeDocumentImage(this.storage, `company/${kind}`, file) : null;
		const record = await this.repository.setImage(kind, key);
		if (!record) throw new CompanyProfileRequiredError();
		return toView(record, includeBanks ? await this.repository.findInvoiceAccounts() : null, this.storage);
	}
}
