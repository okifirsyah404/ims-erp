import type {
	TTaxCorrectionSelect,
	TTaxRecordSelect,
	TTaxTypeSelect,
	TWithholdingTaxRecordSelect,
} from '@drizzle/schemas/accounting.schema';
import type { TPaginationResult } from '@ims-erp/common';

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
	): Promise<TTaxTypeSelect[]>;

	/** Lists the tenant's tax type rows, active or not. */
	listTaxTypes(
		organizationId: string,
		pagination: { page: number; limit: number },
	): Promise<TPaginationResult<TTaxTypeSelect>>;

	findTaxTypeById(
		organizationId: string,
		id: string,
	): Promise<TTaxTypeSelect | null>;

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
	}): Promise<TTaxTypeSelect>;

	updateTaxType(
		organizationId: string,
		id: string,
		patch: Partial<{
			name: string;
			isActive: boolean;
			effectiveTo: string | null;
		}>,
	): Promise<TTaxTypeSelect | null>;

	/** Soft delete. Returns `false` when the row is absent or foreign. */
	softDeleteTaxType(organizationId: string, id: string): Promise<boolean>;

	/** Counts live recaps and withholding rows that reference a tax type. */
	countReferencesToTaxType(
		organizationId: string,
		taxTypeId: string,
	): Promise<number>;

	listTaxRecords(
		organizationId: string,
		filter: { year?: number; month?: number },
		pagination: { page: number; limit: number },
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

	listWithholding(
		organizationId: string,
		pagination: { page: number; limit: number },
	): Promise<TPaginationResult<TWithholdingTaxRecordSelect>>;

	findWithholdingById(
		organizationId: string,
		id: string,
	): Promise<TWithholdingTaxRecordSelect | null>;

	insertWithholding(row: {
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
	}): Promise<TWithholdingTaxRecordSelect>;

	transitionWithholding(
		organizationId: string,
		id: string,
		from: string,
		to: string,
	): Promise<TWithholdingTaxRecordSelect | null>;
};
