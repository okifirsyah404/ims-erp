import type { ICompanyService } from '@app/company';
import {
	CODE_TYPES,
	type CodeType,
	type ResetPolicy,
	type TCodeNumberSeriesSelect,
} from '@drizzle/schemas/code-number.schema';
import type { TTx } from '@drizzle/types';
import { inject, injectable } from 'tsyringe';
import { CODE_NUMBER_REPOSITORY_TOKEN } from '../constants/di';
import { COMPANY_SERVICE_TOKEN } from '@app/company';
import type { ICodeNumberRepository } from '../contracts/code-number.repository.interface';
import {
	CODE_TYPE_CODES,
	CODE_TYPE_MODULES,
	PREVIEW_CONTEXT,
	type TNumberContext,
	defaultPattern,
	defaultResetPolicy,
	periodKey,
	renderNumber,
	validatePattern,
} from '../domain/code-number';
import {
	CompanyProfileRequiredError,
	NumberingPatternError,
	UnknownCodeTypeError,
} from '../errors/code-number.errors';

/** One numbering series as the settings page shows it. */
export type TCodeNumberSetting = {
	codeType: CodeType;
	typeCode: string;
	pattern: string;
	resetPolicy: ResetPolicy;
	/** True when no override is stored (code defaults apply). */
	isDefault: boolean;
	/** The number the next document would get (not reserved). */
	nextNumber: string;
};

/** Effective pattern and reset policy of a series. */
function effective(codeType: CodeType, row: TCodeNumberSeriesSelect | null) {
	return {
		pattern: row?.pattern ?? defaultPattern(codeType),
		resetPolicy: (row?.resetPolicy as ResetPolicy | null) ?? defaultResetPolicy(codeType),
		isDefault: !row?.pattern && !row?.resetPolicy,
	};
}

/**
 * Code numbering: pattern-driven, collision-safe series, one per code type for
 * the whole company (ADR-0011 §2).
 *
 * @remarks
 * Exported API for other modules: {@link CodeNumberService.next}. Issued
 * numbers are never recomputed, so editing a pattern only affects numbers
 * issued afterwards. Callers that must be gap-free (invoices, receipts) call
 * `next` only when the document is issued, inside their transaction.
 */
@injectable()
export class CodeNumberService {
	constructor(
		@inject(CODE_NUMBER_REPOSITORY_TOKEN)
		private readonly series: ICodeNumberRepository,
		@inject(COMPANY_SERVICE_TOKEN)
		private readonly company: ICompanyService,
	) {}

	private assertType(codeType: string): asserts codeType is CodeType {
		if (!(CODE_TYPES as readonly string[]).includes(codeType)) {
			throw new UnknownCodeTypeError();
		}
	}

	private assertValid(pattern: string, codeType: CodeType) {
		const [problem] = validatePattern(pattern, codeType);
		if (problem) throw new NumberingPatternError(problem);
	}

	private async companyCode(tx?: TTx): Promise<string> {
		const profile = await this.company.getProfile(tx);
		if (!profile) throw new CompanyProfileRequiredError();
		return profile.documentCode;
	}

	/**
	 * Reserves and returns the next number of a code type.
	 *
	 * @param tx - The caller's transaction, so a failed document rolls back
	 * its number too
	 * @param context - Document tokens ({SUPPLIER}, {CATEGORY}, {CUSTOMER})
	 */
	async next(
		codeType: CodeType,
		options: { date?: Date; context?: TNumberContext; tx?: TTx } = {},
	): Promise<string> {
		const date = options.date ?? new Date();
		const row = await this.series.findByType(codeType, options.tx);
		const { pattern, resetPolicy } = effective(codeType, row);
		const companyCode = await this.companyCode(options.tx);
		const seq = await this.series.allocate(
			CODE_TYPE_MODULES[codeType],
			codeType,
			periodKey(resetPolicy, date),
			options.tx,
		);
		return renderNumber(pattern, {
			seq,
			typeCode: CODE_TYPE_CODES[codeType],
			companyCode,
			date,
			context: options.context,
		});
	}

	/** Renders what the next number would be, without reserving it. */
	private render(
		codeType: CodeType,
		config: { pattern: string; resetPolicy: ResetPolicy },
		row: TCodeNumberSeriesSelect | null,
		companyCode: string,
		date = new Date(),
	): string {
		const key = periodKey(config.resetPolicy, date);
		return renderNumber(config.pattern, {
			seq: row && row.periodKey === key ? row.nextNumber : 1,
			typeCode: CODE_TYPE_CODES[codeType],
			companyCode,
			date,
			context: PREVIEW_CONTEXT,
		});
	}

	/** Previews a pattern the owner is typing (validated, nothing saved). */
	async preview(
		codeType: string,
		config: { pattern: string; resetPolicy: ResetPolicy },
	): Promise<string> {
		this.assertType(codeType);
		this.assertValid(config.pattern, codeType);
		const row = await this.series.findByType(codeType);
		return this.render(codeType, config, row, await this.companyCode());
	}

	async listSettings(): Promise<TCodeNumberSetting[]> {
		const rows = new Map((await this.series.findAll()).map((row) => [row.codeType, row]));
		const companyCode = await this.companyCode();
		return CODE_TYPES.map((codeType) => {
			const row = rows.get(codeType) ?? null;
			const config = effective(codeType, row);
			return {
				codeType,
				typeCode: CODE_TYPE_CODES[codeType],
				...config,
				nextNumber: this.render(codeType, config, row, companyCode),
			};
		});
	}

	async updateSetting(
		codeType: string,
		input: { pattern: string; resetPolicy: ResetPolicy },
		actorUserId: string,
	): Promise<TCodeNumberSetting> {
		this.assertType(codeType);
		const pattern = input.pattern.trim();
		this.assertValid(pattern, codeType);
		const companyCode = await this.companyCode();
		const row = await this.series.saveSettings(
			{
				module: CODE_TYPE_MODULES[codeType],
				codeType,
				pattern,
				resetPolicy: input.resetPolicy,
				updatedBy: actorUserId,
			},
			periodKey(input.resetPolicy, new Date()),
		);
		const config = { pattern, resetPolicy: input.resetPolicy };
		return {
			codeType,
			typeCode: CODE_TYPE_CODES[codeType],
			...config,
			isDefault: false,
			nextNumber: this.render(codeType, config, row, companyCode),
		};
	}
}
