import type {
	TTaxCorrectionSelect,
	TTaxRecordSelect,
	TTaxSelect,
	TWithholdingTaxRecordSelect,
} from '@drizzle/schemas/tax.schema';
import type { TPaginationResult } from '@ims-erp/common';
import { inject, injectable } from 'tsyringe';
import { TAX_REPOSITORY_TOKEN } from '../constants/di';
import type { TTaxRepository, TTaxPaginationRequest, TTaxRecordPaginationRequest } from '../contracts/tax.repository.interface';
import {
	TaxRateNotFoundError,
	TaxRecordLockedError,
	TaxRecordNotFoundError,
	TaxRecordPeriodTakenError,
	TaxTransitionError,
	TaxTypeInUseError,
	TaxTypeNotFoundError,
	TaxTypeOverlapError,
	WithholdingLockedError,
	WithholdingNotFoundError,
	WithholdingTransitionError,
} from '../errors/tax.errors';
import {
	computeTaxAmountMinor,
	periodStartDate,
	pickEffectiveRow,
	windowsOverlap,
	type TEffectiveWindow,
} from '../utils/tax-math';

/** Allowed working-paper transitions. Corrections are a separate path. */
const RECORD_TRANSITIONS: Record<string, readonly string[]> = {
	draft: ['verified'],
	verified: ['filed'],
	filed: [],
	corrected: [],
};

/** Statuses that accept a correction. Draft amounts are edited instead. */
const CORRECTABLE_STATUSES = new Set(['verified', 'filed', 'corrected']);

/** Allowed withholding transitions. */
const WITHHOLDING_TRANSITIONS: Record<string, readonly string[]> = {
	recorded: ['verified'],
	verified: ['paid', 'reversed'],
	paid: ['reversed'],
	reversed: [],
};

export type TTaxActionContext = {
	organizationId: string;
	actorUserId: string;
};

export type TCreateTaxTypeInput = {
	code: string;
	name: string;
	taxType: string;
	rate: string;
	baseType: string;
	isInclusive: boolean;
	effectiveFrom: string;
	effectiveTo: string | null;
	isActive: boolean;
};

export type TCreateTaxRecordInput = {
	taxTypeId: string;
	periodYear: number;
	periodMonth: number;
	taxableBase: number;
	/** When omitted, computed from the rate effective on `rateDate` (default: period start). */
	taxAmount?: number;
	rateDate?: string;
	notes?: string | null;
};

export type TRecapLine = {
	taxRecordId: string;
	taxTypeId: string;
	code: string;
	taxableBase: number;
	taxAmount: number;
	correctionTotal: number;
	netPayable: number;
	filingStatus: string;
};

/**
 * Application service for the tax slice of the accounting module.
 *
 * @remarks
 * Enforces what the schema cannot: no overlapping rate windows per code,
 * the working-paper state machine, draft-only amount edits, one recap per
 * tax type per period, and corrections that never rewrite the original
 * `tax_amount`. Every method is tenant-scoped through the context.
 */
@injectable()
export class TaxService {
	constructor(
		@inject(TAX_REPOSITORY_TOKEN) private readonly repo: TTaxRepository,
	) {}

	/* -------------------------------------------------------------- *
	 * Tax types (effective-dated rates)
	 * -------------------------------------------------------------- */

	/** Fetches one page of the tenant's tax types. */
	async listTaxTypes(
		request: TTaxPaginationRequest,
	): Promise<TPaginationResult<TTaxSelect>> {
		return this.repo.paginateTaxTypes(request);
	}

	async getTaxType(organizationId: string, id: string): Promise<TTaxSelect> {
		const row = await this.repo.findTaxTypeById(organizationId, id);
		if (!row) throw new TaxTypeNotFoundError();
		return row;
	}

	/**
	 * Creates one effective-dated rate row. Refused when its window overlaps
	 * another live row for the same code (D7).
	 *
	 * @throws TaxTypeOverlapError 409 when the window overlaps
	 */
	async createTaxType(
		input: TCreateTaxTypeInput,
		ctx: TTaxActionContext,
	): Promise<TTaxSelect> {
		const siblings = await this.repo.findTaxTypesByCode(
			ctx.organizationId,
			input.code,
		);
		const range: TEffectiveWindow = {
			effectiveFrom: input.effectiveFrom,
			effectiveTo: input.effectiveTo,
		};
		if (siblings.some((row) => windowsOverlap(row, range))) {
			throw new TaxTypeOverlapError();
		}
		return this.repo.insertTaxType({ ...input, organizationId: ctx.organizationId });
	}

	/**
	 * Updates name, active flag, or end date. The start date and code are the
	 * row's identity and are not editable. An end-date change is re-checked
	 * against the other rows of the same code.
	 *
	 * @throws TaxTypeNotFoundError 404
	 * @throws TaxTypeOverlapError 409 when the new end date overlaps a sibling
	 */
	async updateTaxType(
		id: string,
		patch: Partial<{ name: string; isActive: boolean; effectiveTo: string | null }>,
		ctx: TTaxActionContext,
	): Promise<TTaxSelect> {
		const current = await this.getTaxType(ctx.organizationId, id);
		if (patch.effectiveTo !== undefined) {
			const siblings = await this.repo.findTaxTypesByCode(
				ctx.organizationId,
				current.code,
			);
			const next: TEffectiveWindow = {
				effectiveFrom: current.effectiveFrom,
				effectiveTo: patch.effectiveTo,
			};
			const clash = siblings.some(
				(row) => row.id !== id && windowsOverlap(row, next),
			);
			if (clash) throw new TaxTypeOverlapError();
		}
		const row = await this.repo.updateTaxType(ctx.organizationId, id, patch);
		if (!row) throw new TaxTypeNotFoundError();
		return row;
	}

	/**
	 * Soft deletes a rate row. Refused while recaps or withholding rows still
	 * reference the tax type, so history stays readable.
	 *
	 * @throws TaxTypeInUseError 409
	 */
	async removeTaxType(id: string, ctx: TTaxActionContext): Promise<void> {
		await this.getTaxType(ctx.organizationId, id);
		const refs = await this.repo.countReferencesToTaxType(ctx.organizationId, id);
		if (refs > 0) throw new TaxTypeInUseError();
		const removed = await this.repo.softDeleteTaxType(ctx.organizationId, id);
		if (!removed) throw new TaxTypeNotFoundError();
	}

	/**
	 * Resolves the rate that applies to `code` on `date`. Deny by default: no
	 * covering active row means an error, never a silent zero.
	 *
	 * @throws TaxRateNotFoundError 422
	 */
	async resolveRate(
		organizationId: string,
		code: string,
		date: string,
	): Promise<TTaxSelect> {
		const rows = await this.repo.findTaxTypesByCode(organizationId, code);
		const active = rows.filter((row) => row.isActive);
		const row = pickEffectiveRow(active, date);
		if (!row) throw new TaxRateNotFoundError();
		return row;
	}

	/**
	 * Previews the tax on a base for a tax type on a date. Read-only: nothing is
	 * stored. Used by the record form before the user saves.
	 */
	async previewTax(
		organizationId: string,
		input: { taxTypeId: string; taxableBase: number; date: string },
	): Promise<{ taxAmount: number; rate: string; effectiveFrom: string }> {
		const type = await this.getTaxType(organizationId, input.taxTypeId);
		const rate = await this.resolveRate(organizationId, type.code, input.date);
		return {
			taxAmount: computeTaxAmountMinor(input.taxableBase, rate.rate),
			rate: rate.rate,
			effectiveFrom: rate.effectiveFrom,
		};
	}

	/* -------------------------------------------------------------- *
	 * Tax records (period working papers)
	 * -------------------------------------------------------------- */

	/** Fetches one page of the tenant's tax records, optionally by period. */
	async listTaxRecords(
		request: TTaxRecordPaginationRequest,
	): Promise<TPaginationResult<TTaxRecordSelect>> {
		return this.repo.paginateTaxRecords(request);
	}

	async getTaxRecord(organizationId: string, id: string): Promise<TTaxRecordSelect> {
		const row = await this.repo.findTaxRecordById(organizationId, id);
		if (!row) throw new TaxRecordNotFoundError();
		return row;
	}

	/**
	 * Creates a draft recap for one tax type and period. When the caller gives
	 * no tax amount, it is computed from the rate effective on `rateDate`
	 * (default: the first day of the period).
	 *
	 * @throws TaxTypeNotFoundError 404
	 * @throws TaxRecordPeriodTakenError 409
	 * @throws TaxRateNotFoundError 422 when computing with no covering rate
	 */
	async createTaxRecord(
		input: TCreateTaxRecordInput,
		ctx: TTaxActionContext,
	): Promise<TTaxRecordSelect> {
		const type = await this.getTaxType(ctx.organizationId, input.taxTypeId);
		const taken = await this.repo.findTaxRecordByPeriod(
			ctx.organizationId,
			input.taxTypeId,
			input.periodYear,
			input.periodMonth,
		);
		if (taken) throw new TaxRecordPeriodTakenError();

		let taxAmount = input.taxAmount;
		if (taxAmount === undefined) {
			const date = input.rateDate ?? periodStartDate(input.periodYear, input.periodMonth);
			const rate = await this.resolveRate(ctx.organizationId, type.code, date);
			taxAmount = computeTaxAmountMinor(input.taxableBase, rate.rate);
		}

		return this.repo.insertTaxRecord({
			organizationId: ctx.organizationId,
			code: recordCode(input.periodYear, input.periodMonth),
			taxTypeId: input.taxTypeId,
			periodYear: input.periodYear,
			periodMonth: input.periodMonth,
			taxableBase: input.taxableBase,
			taxAmount,
			notes: input.notes ?? null,
		});
	}

	/**
	 * Edits amounts and notes. Only draft records are editable; anything past
	 * draft changes through a correction instead.
	 *
	 * @throws TaxRecordNotFoundError 404
	 * @throws TaxRecordLockedError 409
	 */
	async updateDraftTaxRecord(
		id: string,
		patch: Partial<{ taxableBase: number; taxAmount: number; notes: string | null }>,
		ctx: TTaxActionContext,
	): Promise<TTaxRecordSelect> {
		const current = await this.getTaxRecord(ctx.organizationId, id);
		if (current.filingStatus !== 'draft') throw new TaxRecordLockedError();
		const row = await this.repo.updateDraftTaxRecord(ctx.organizationId, id, patch);
		if (!row) throw new TaxRecordLockedError();
		return row;
	}

	/**
	 * Moves a record along the working-paper state machine (draft → verified
	 * → filed). Verifying stamps the verifier; filing stamps the filing date.
	 *
	 * @throws TaxTransitionError 409 when the edge is not allowed or lost a race
	 */
	async transitionTaxRecord(
		id: string,
		to: 'verified' | 'filed',
		filedOn: string | null,
		ctx: TTaxActionContext,
	): Promise<TTaxRecordSelect> {
		const current = await this.getTaxRecord(ctx.organizationId, id);
		if (!RECORD_TRANSITIONS[current.filingStatus]?.includes(to)) {
			throw new TaxTransitionError();
		}
		const extra =
			to === 'verified'
				? { verifiedBy: ctx.actorUserId }
				: { filedOn: filedOn ?? new Date().toISOString().slice(0, 10) };
		const row = await this.repo.transitionTaxRecord(
			ctx.organizationId,
			id,
			current.filingStatus,
			to,
			extra,
		);
		if (!row) throw new TaxTransitionError();
		return row;
	}

	/**
	 * Adds a signed correction to a verified, filed, or already corrected
	 * record. The record moves to `corrected`; `tax_amount` is untouched.
	 *
	 * @throws TaxTransitionError 409 when the record is still draft
	 */
	async addCorrection(
		taxRecordId: string,
		input: { amount: number; reason: string; evidenceDocumentId: string | null },
		ctx: TTaxActionContext,
	): Promise<TTaxCorrectionSelect> {
		const current = await this.getTaxRecord(ctx.organizationId, taxRecordId);
		if (!CORRECTABLE_STATUSES.has(current.filingStatus)) {
			throw new TaxTransitionError();
		}
		const correction = await this.repo.insertCorrection({
			organizationId: ctx.organizationId,
			taxRecordId,
			amount: input.amount,
			reason: input.reason,
			evidenceDocumentId: input.evidenceDocumentId,
			createdBy: ctx.actorUserId,
		});
		if (current.filingStatus !== 'corrected') {
			await this.repo.transitionTaxRecord(
				ctx.organizationId,
				taxRecordId,
				current.filingStatus,
				'corrected',
				{},
			);
		}
		return correction;
	}

	async listCorrections(
		organizationId: string,
		taxRecordId: string,
	): Promise<TTaxCorrectionSelect[]> {
		await this.getTaxRecord(organizationId, taxRecordId);
		return this.repo.listCorrections(organizationId, taxRecordId);
	}

	/**
	 * Recap for a period: each record with its corrections summed, plus the
	 * net payable (`tax_amount` + corrections) and the overall total.
	 */
	async recap(
		organizationId: string,
		year: number,
		month: number,
	): Promise<{ lines: TRecapLine[]; totalNetPayable: number }> {
		const rows = await this.repo.recapForPeriod(organizationId, year, month);
		const lines = rows.map((row) => ({
			...row,
			netPayable: row.taxAmount + row.correctionTotal,
		}));
		return {
			lines,
			totalNetPayable: lines.reduce((sum, line) => sum + line.netPayable, 0),
		};
	}

	/* -------------------------------------------------------------- *
	 * Withholding
	 * -------------------------------------------------------------- */

	async listWithholding(
		request: TTaxPaginationRequest,
	): Promise<TPaginationResult<TWithholdingTaxRecordSelect>> {
		return this.repo.paginateWithholding(request);
	}

	async getWithholding(
		organizationId: string,
		id: string,
	): Promise<TWithholdingTaxRecordSelect> {
		const row = await this.repo.findWithholdingById(organizationId, id);
		if (!row) throw new WithholdingNotFoundError();
		return row;
	}

	/**
	 * Records withholding collected on a payment. Counterparty is free text
	 * with no cross-module validation (D11).
	 *
	 * @throws TaxTypeNotFoundError 404
	 */
	async createWithholding(
		input: {
			code: string;
			taxTypeId: string;
			counterpartyType: string | null;
			counterpartyId: string | null;
			baseAmount: number;
			taxAmount: number;
			transactionDate: string | null;
			periodYear: number | null;
			periodMonth: number | null;
		},
		ctx: TTaxActionContext,
	): Promise<TWithholdingTaxRecordSelect> {
		await this.getTaxType(ctx.organizationId, input.taxTypeId);
		return this.repo.insertWithholding({ ...input, organizationId: ctx.organizationId });
	}

	/**
	 * Edits a withholding row. Only `recorded` rows are editable; later states
	 * are money already moved and change only through a transition.
	 *
	 * @throws WithholdingNotFoundError 404
	 * @throws WithholdingLockedError 409
	 */
	async updateWithholding(
		id: string,
		patch: Partial<{
			counterpartyType: string | null;
			counterpartyId: string | null;
			baseAmount: number;
			taxAmount: number;
			transactionDate: string | null;
		}>,
		ctx: TTaxActionContext,
	): Promise<TWithholdingTaxRecordSelect> {
		const current = await this.getWithholding(ctx.organizationId, id);
		if (current.status !== 'recorded') throw new WithholdingLockedError();
		const row = await this.repo.updateRecordedWithholding(ctx.organizationId, id, patch);
		if (!row) throw new WithholdingLockedError();
		return row;
	}

	/**
	 * @throws WithholdingTransitionError 409 when the edge is not allowed
	 */
	async transitionWithholding(
		id: string,
		to: 'verified' | 'paid' | 'reversed',
		ctx: TTaxActionContext,
	): Promise<TWithholdingTaxRecordSelect> {
		const current = await this.getWithholding(ctx.organizationId, id);
		if (!WITHHOLDING_TRANSITIONS[current.status]?.includes(to)) {
			throw new WithholdingTransitionError();
		}
		const row = await this.repo.transitionWithholding(
			ctx.organizationId,
			id,
			current.status,
			to,
		);
		if (!row) throw new WithholdingTransitionError();
		return row;
	}

}

/**
 * Working-paper code: period plus a random 8-hex suffix. Rate rows of the same
 * tax code get different `tax_type_id`s, so a code built from the tax code
 * would collide on `tax_records_org_code_uq` for the same period. The index
 * remains the real uniqueness guard.
 */
function recordCode(year: number, month: number): string {
	const period = `${year}${String(month).padStart(2, '0')}`;
	const random = crypto.randomUUID().replace(/-/g, '').slice(0, 8);
	return `TR-${period}-${random}`.toUpperCase();
}
