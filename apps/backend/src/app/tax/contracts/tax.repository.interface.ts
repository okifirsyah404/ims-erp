import type {
	TTaxCorrectionSelect,
	TTaxRecordSelect,
	TTaxSelect,
	TWithholdingTaxRecordSelect,
} from '@drizzle/schemas/tax.schema';
import type { TPaginationRequest, TPaginationResult } from '@ims-erp/common';

/**
 * Page settings plus the tenant of a tax listing.
 *
 * @remarks
 * Every tax listing is tenant-scoped, so `organizationId` is required here
 * rather than passed positionally.
 */
export type TTaxPaginationRequest = TPaginationRequest & {
	organizationId: string;
};

/** Page settings, tenant and the period filters of the tax-record listing. */
export type TTaxRecordPaginationRequest = TTaxPaginationRequest & {
	year?: number;
	month?: number;
};

/**
 * Data-access contract for the tax slice of the accounting module.
 *
 * @remarks
 * Every method takes `organizationId` and filters by it. Soft-deleted rows
 * are excluded everywhere except where noted.
 */
export type TTaxRepository = {
	/** Lists the tenant's tax rows for one code, oldest effective date first. */
	findTaxTypesByCode(
		organizationId: string,
		code: string,
	): Promise<TTaxSelect[]>;

	/** Fetches one page of the tenant's tax type rows, active or not. */
	paginateTaxTypes(
		request: TTaxPaginationRequest,
	): Promise<TPaginationResult<TTaxSelect>>;

	findTaxTypeById(
		organizationId: string,
		id: string,
	): Promise<TTaxSelect | null>;

	insertTaxType(row: {
		organizationId: string;
		code: string;
		name: string;
		taxType: string;
		rate: string;
		baseType: string;
		isInclusive: boolean;
		effectiveFrom: string;
		effectiveTo: string | null;
		isActive: boolean;
	}): Promise<TTaxSelect>;

	updateTaxType(
		organizationId: string,
		id: string,
		patch: Partial<{
			name: string;
			isActive: boolean;
			effectiveTo: string | null;
		}>,
	): Promise<TTaxSelect | null>;

	/** Soft delete. Returns `false` when the row is absent or foreign. */
	softDeleteTaxType(organizationId: string, id: string): Promise<boolean>;

	/** Counts live recaps and withholding rows that reference a tax type. */
	countReferencesToTaxType(
		organizationId: string,
		taxTypeId: string,
	): Promise<number>;

	paginateTaxRecords(
		request: TTaxRecordPaginationRequest,
	): Promise<TPaginationResult<TTaxRecordSelect>>;

	findTaxRecordById(
		organizationId: string,
		id: string,
	): Promise<TTaxRecordSelect | null>;

	findTaxRecordByPeriod(
		organizationId: string,
		taxTypeId: string,
		year: number,
		month: number,
	): Promise<TTaxRecordSelect | null>;

	insertTaxRecord(row: {
		organizationId: string;
		code: string;
		taxTypeId: string;
		periodYear: number;
		periodMonth: number;
		taxableBase: number;
		taxAmount: number;
		notes: string | null;
	}): Promise<TTaxRecordSelect>;

	/**
	 * Updates amounts and notes while the record is in `draft`. Conditional on
	 * the status, so a concurrent transition cannot be overwritten.
	 */
	updateDraftTaxRecord(
		organizationId: string,
		id: string,
		patch: Partial<{ taxableBase: number; taxAmount: number; notes: string | null }>,
	): Promise<TTaxRecordSelect | null>;

	/** Race-safe status change: applies only when the row is still in `from`. */
	transitionTaxRecord(
		organizationId: string,
		id: string,
		from: string,
		to: string,
		extra: { verifiedBy?: string | null; filedOn?: string | null },
	): Promise<TTaxRecordSelect | null>;

	listCorrections(
		organizationId: string,
		taxRecordId: string,
	): Promise<TTaxCorrectionSelect[]>;

	insertCorrection(row: {
		organizationId: string;
		taxRecordId: string;
		amount: number;
		reason: string;
		evidenceDocumentId: string | null;
		createdBy: string;
	}): Promise<TTaxCorrectionSelect>;

	/** Recap totals for one period, grouped per tax type, with corrections summed. */
	recapForPeriod(
		organizationId: string,
		year: number,
		month: number,
	): Promise<
		Array<{
			taxRecordId: string;
			taxTypeId: string;
			code: string;
			taxableBase: number;
			taxAmount: number;
			correctionTotal: number;
			filingStatus: string;
		}>
	>;

	paginateWithholding(
		request: TTaxPaginationRequest,
	): Promise<TPaginationResult<TWithholdingTaxRecordSelect>>;

	findWithholdingById(
		organizationId: string,
		id: string,
	): Promise<TWithholdingTaxRecordSelect | null>;

	insertWithholding(
		row: {
			organizationId: string;
			code: string;
			taxTypeId: string;
			counterpartyType: string | null;
			counterpartyId: string | null;
			baseAmount: number;
			taxAmount: number;
			transactionDate: string | null;
			periodYear: number | null;
			periodMonth: number | null;
			taxObjectCode?: string | null;
			counterpartyTaxId?: string | null;
			sourceModule?: string | null;
			sourceId?: string | null;
		},
		tx?: unknown,
	): Promise<TWithholdingTaxRecordSelect>;
	/** Live, non-reversed withholding rows of a tax period (Coretax export). */
	listWithholdingsForPeriod(organizationId: string, year: number, month: number): Promise<TWithholdingTaxRecordSelect[]>;
	/** Bukti-potong data and Coretax status; any status but reversed (ERP-0140). */
	updateWithholdingCoretax(
		organizationId: string,
		id: string,
		patch: Partial<{
			coretaxStatus: string;
			withholdingSlipNumber: string | null;
			counterpartyTaxId: string | null;
			taxObjectCode: string | null;
		}>,
	): Promise<TWithholdingTaxRecordSelect | null>;
	/** Reverses the live withholding a source document produced (ERP-0140). */
	reverseWithholdingBySource(
		organizationId: string,
		sourceModule: string,
		sourceId: string,
		tx?: unknown,
	): Promise<void>;

	/** Edits a withholding row only while it is still `recorded`. */
	updateRecordedWithholding(
		organizationId: string,
		id: string,
		patch: Partial<{
			counterpartyType: string | null;
			counterpartyId: string | null;
			baseAmount: number;
			taxAmount: number;
			transactionDate: string | null;
		}>,
	): Promise<TWithholdingTaxRecordSelect | null>;

	transitionWithholding(
		organizationId: string,
		id: string,
		from: string,
		to: string,
	): Promise<TWithholdingTaxRecordSelect | null>;
};
